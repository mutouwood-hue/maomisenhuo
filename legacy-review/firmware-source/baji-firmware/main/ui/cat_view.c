#include "cat_view.h"
#include "badge_frame_clock.h"

#include <string.h>

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_timer.h"

#include "cat3d.h"

static const char *TAG = "cat_view";

struct cat_view {
    lv_obj_t *canvas;
    cat3d_t *cat;
    uint16_t *fb;
    uint8_t *tex_cache; /* PSRAM copy of the active breed texture */

    int w, h;
    int breed, anim;
    float time;
    float yaw, pitch;
    /* Explicit projection; scale <= 0 means "auto-fit" (see cat_view_set_view). */
    float view_scale, pan_x, pan_y;

    badge_frame_clock_t frame_clock;

    bool dirty;
    uint32_t render_us_avg;
    int last_dirty_px;
};

/*
 * The adaptive guard.
 *
 * A redraw has to share the frame with the compositor (which streams the dirty
 * rectangle to the panel over QSPI) and with the touch reader. If rasterisation is
 * allowed to use the whole frame, the panel starves and the cat becomes a
 * slideshow that also drops touches. So the guard aims for a fixed duty cycle:
 * rasterisation may use at most RENDER_DUTY_NUM/RENDER_DUTY_DEN of the interval
 * implied by the requested rate, and the rate is lowered until that holds.
 *
 * The floor keeps the cat alive rather than frozen: below it, something is badly
 * wrong and a slow animation is still better than a still image.
 */

/*
 * Memory placement.
 *
 * The renderer's state is touched per pixel (the 8 KB of shading tables) or per
 * frame (bone matrices), so it belongs in internal SRAM. The framebuffer is only
 * ever written once per pixel and then streamed to the panel, so PSRAM is the
 * right home for it and there is no reason to spend internal SRAM on 400+ KB.
 * The size threshold below is what expresses that split.
 */
#define CAT_VIEW_INTERNAL_MAX (64u * 1024u)

static void *cat_view_alloc(size_t n)
{
    if (n > CAT_VIEW_INTERNAL_MAX) {
        void *p = heap_caps_malloc(n, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (p) return p;
        ESP_LOGW(TAG, "PSRAM allocation of %u bytes failed, falling back to internal RAM", (unsigned)n);
    }
    return heap_caps_malloc(n, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
}

static void cat_view_free(void *p)
{
    heap_caps_free(p);
}

static const cat3d_allocator_t CAT_VIEW_ALLOCATOR = {
    .alloc = cat_view_alloc,
    .release = cat_view_free,
};

/* ------------------------------------------------------------------ */

cat_view_t *cat_view_create(lv_obj_t *parent, int w, int h)
{
    cat_view_t *v = heap_caps_calloc(1, sizeof(cat_view_t), MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    if (!v) {
        ESP_LOGE(TAG, "out of memory allocating cat_view");
        return NULL;
    }

    v->w = w;
    v->h = h;
    badge_frame_target(&v->frame_clock, 0);
    v->dirty = true;
    v->pitch = 12.0f;
    /* Start on "nothing selected" so the first set_pose() always applies. */
    v->breed = -1;
    v->anim = -1;

    v->cat = cat3d_create(w, h, &CAT_VIEW_ALLOCATOR);
    if (!v->cat) {
        ESP_LOGE(TAG, "cat3d_create(%d,%d) failed", w, h);
        heap_caps_free(v);
        return NULL;
    }

    /*
     * Paint the canvas's own background BLACK, not cat3d's default.
     *
     * cat3d's default gradient (#edf7f6 -> #e4f0ee, cat3d.c:546-547) is the HTML *page*
     * background of the reference, lifted along with the rasteriser. It is not the badge's
     * background: the specification's `colors.bg` is #000000 and the reference's own
     * `.screen` rule is `background:#000` (吧唧渲染参考.html:10), with the cat's framebuffer
     * cleared to zero every full repaint (`R.fb.fill(0)`, :395).
     *
     * The framebuffer is RGB565, so it has no alpha to make these pixels transparent. Left
     * at the ported default it is an opaque near-white slab that covers the whole glass,
     * and the badge's black background never shows. Measured on the board: the entire dial
     * read as a bright lavender-white panel with the cat floating on it.
     *
     * Black is the correct stand-in for "transparent" here: the cat layer is bottom-most
     * (badge_ui.c's z-order) and the layers above it are transparent where they draw
     * nothing, so what shows through is this black -- which is exactly what the
     * specification asks the screen to be.
     */
    cat3d_set_background(v->cat, 0x0000, 0x0000);

    /* cat3d owns the buffer; keep a plain pointer for the LVGL canvas. */
    v->fb = (uint16_t *)cat3d_render(v->cat);
    if (!v->fb) {
        ESP_LOGE(TAG, "renderer produced no framebuffer");
        cat3d_destroy(v->cat);
        heap_caps_free(v);
        return NULL;
    }

    /*
     * Keep the active breed's texture in PSRAM.
     *
     * The embedded textures live in flash, and the rasteriser fetches texels in
     * essentially random order. A cache miss there lands in the middle of the
     * innermost loop, which shows up as frame-time jitter rather than as an average
     * cost -- and jitter is what breaks a frame-rate guarantee, because the frame
     * that misses its deadline is the one the player notices. One 128 KB copy in
     * PSRAM (of the 8 MB available) removes that variance.
     */
    v->tex_cache = heap_caps_malloc(CAT_TEX_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (v->tex_cache) {
        if (cat3d_set_texel_cache(v->cat, v->tex_cache, CAT_TEX_BYTES) != CAT3D_OK) {
            ESP_LOGW(TAG, "texel cache rejected; falling back to flash fetches");
            heap_caps_free(v->tex_cache);
            v->tex_cache = NULL;
        }
    } else {
        ESP_LOGW(TAG, "no PSRAM for the texel cache; textures will be read from flash");
    }

    v->canvas = lv_canvas_create(parent);
    lv_canvas_set_buffer(v->canvas, v->fb, w, h, LV_COLOR_FORMAT_RGB565);
    lv_obj_remove_flag(v->canvas, LV_OBJ_FLAG_SCROLLABLE);
    /* The canvas stays clickable: petting and orbit are driven by touch on it. */

    ESP_LOGI(TAG, "canvas %dx%d, framebuffer %u bytes @%p",
             w, h, (unsigned)(w * h * 2), (void *)v->fb);
    return v;
}

void cat_view_destroy(cat_view_t *v)
{
    if (!v) return;
    /* The canvas only borrows the buffer, so it must go first. */
    if (v->canvas) lv_obj_delete(v->canvas);
    if (v->cat) cat3d_destroy(v->cat);
    if (v->tex_cache) heap_caps_free(v->tex_cache);
    heap_caps_free(v);
}

lv_obj_t *cat_view_obj(const cat_view_t *v) { return v ? v->canvas : NULL; }

void cat_view_set_pose(cat_view_t *v, int breed, int anim, float time_seconds)
{
    if (!v) return;
    if (breed != v->breed) {
        if (cat3d_set_breed(v->cat, breed) == CAT3D_OK) {
            v->breed = breed;
            v->dirty = true;
        }
    }
    if (anim != v->anim) {
        if (cat3d_set_anim(v->cat, anim) == CAT3D_OK) {
            v->anim = anim;
            v->dirty = true;
        }
    }
    v->time = time_seconds;
}

void cat_view_set_orbit(cat_view_t *v, float yaw_deg, float pitch_deg)
{
    if (!v) return;
    if (pitch_deg < -80.0f) pitch_deg = -80.0f;
    if (pitch_deg > 80.0f) pitch_deg = 80.0f;
    v->yaw = yaw_deg;
    v->pitch = pitch_deg;
}

/*
 * Explicit projection (see the header).
 *
 * cat3d's camera is the only thing that consumes these, so they are passed straight
 * through on the next tick; the renderer only re-fits when scale <= 0, which is what
 * keeps every pre-existing caller on the automatic path.
 */
void cat_view_set_view(cat_view_t *v, float scale, float pan_x, float pan_y)
{
    if (!v) return;
    if (scale != v->view_scale || pan_x != v->pan_x || pan_y != v->pan_y) v->dirty = true;
    v->view_scale = scale;
    v->pan_x = pan_x;
    v->pan_y = pan_y;
}

void cat_view_invalidate(cat_view_t *v)
{
    if (!v) return;
    v->dirty = true;
    cat3d_invalidate_all(v->cat);
}

void cat_view_set_target_fps(cat_view_t *v, int fps)
{
    if (!v) return;
    badge_frame_target(&v->frame_clock, fps);
}

/*
 * Lower the redraw rate until rasterisation fits inside its share of the frame.
 *
 * Called after a frame is timed, so the decision uses a measurement rather than a
 * guess. It only ever lowers the rate within one session; the rate recovers as soon
 * as a frame is comfortably cheap, which is what lets the cat run at full speed
 * indoors and slow down only when the scene genuinely costs more.
 */
static void cat_view_update_rate(cat_view_t *v, uint32_t frame_us)
{
    badge_frame_cost(&v->frame_clock, frame_us);
}

bool cat_view_tick(cat_view_t *v, float dt_seconds)
{
    if (!v) return false;

    if (dt_seconds < 0.0f) dt_seconds = 0.0f;
    if (dt_seconds > 0.5f) dt_seconds = 0.5f; /* never let a stall fast-forward the cat */

    if (!badge_frame_due(&v->frame_clock, dt_seconds, v->dirty)) return false;

    cat3d_camera_t cam = {
        .yaw_deg = v->yaw,
        .pitch_deg = v->pitch,
        .scale = v->view_scale, /* 0 => auto-fit */
        .pan_x = v->pan_x,
        .pan_y = v->pan_y,
    };
    cat3d_set_camera(v->cat, &cam);
    cat3d_set_time(v->cat, v->time);

    const int64_t t0 = esp_timer_get_time();
    cat3d_render(v->cat);
    const int64_t t1 = esp_timer_get_time();

    const uint32_t us = (uint32_t)(t1 - t0);
    /* Exponential moving average; cheap and good enough for an on-screen readout. */
    v->render_us_avg = v->render_us_avg ? (v->render_us_avg * 7u + us) / 8u : us;
    cat_view_update_rate(v, v->render_us_avg);

    int dx, dy, dw, dh;
    cat3d_dirty_rect(v->cat, &dx, &dy, &dw, &dh);
    if (dw > 0 && dh > 0) {
        lv_area_t origin;
        lv_obj_get_coords(v->canvas, &origin);
        lv_area_t area = {.x1 = origin.x1 + dx, .y1 = origin.y1 + dy,
            .x2 = origin.x1 + dx + dw - 1, .y2 = origin.y1 + dy + dh - 1};
        lv_obj_invalidate_area(v->canvas, &area);
        v->last_dirty_px = dw * dh;
    } else v->last_dirty_px = 0;

    v->dirty = false;
    return true;
}

uint32_t cat_view_render_us_avg(const cat_view_t *v) { return v ? v->render_us_avg : 0; }
int cat_view_effective_fps(const cat_view_t *v) { return v ? v->frame_clock.effective : 0; }
int cat_view_last_pixels(const cat_view_t *v) { return v ? cat3d_last_pixels(v->cat) : 0; }
int cat_view_last_faces(const cat_view_t *v) { return v ? cat3d_last_faces_drawn(v->cat) : 0; }
int cat_view_last_dirty_px(const cat_view_t *v) { return v ? v->last_dirty_px : 0; }
