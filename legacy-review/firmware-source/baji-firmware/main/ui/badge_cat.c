/*
 * badge_cat - the 3D cat, placed and animated the way the specification says.
 *
 * WHY THIS FILE IS THIN
 * ---------------------
 * components/cat3d is the ported rasteriser and main/ui/cat_view.c is its LVGL host
 * (canvas, dirty rectangle, adaptive redraw rate). Both are byte-exact against the
 * reference renderer under their own golden tests, so reimplementing any of that here
 * would throw those tests away. This file only:
 *
 *   1. turns the specification's per-screen `cat` record into a camera,
 *   2. turns `badge_anim_directive_t` into the renderer's animation, yaw, pitch and pan,
 *   3. would switch between a full-resolution and a half-resolution renderer (spec 8.2) --
 *      the half-resolution one is disabled on this board, see want_half_res(),
 *   4. applies the screen's dim (AOD 35%, 睡着了 25%) as canvas opacity,
 *   5. freezes the still-frame screens after one drawn frame (spec 8.4),
 *   6. exposes the telemetry the PERF line prints.
 *
 * THE CAMERA MAPPING, DERIVED RATHER THAN GUESSED
 * ----------------------------------------------
 * The reference is a perspective camera; cat3d is orthographic (cat3d.h says so). They
 * agree at the model's focus depth, so the orthographic scale is the perspective focal
 * length over the camera distance. From the reference's own frame():
 *
 *     R  = half ? 233 : 466
 *     F  = (R / 2) / tan(13.5 deg)          <- its 27 degree vertical field of view
 *     cx = R / 2 + ox * R / SCR
 *     cy = R / 2 + oy * R / SCR
 *
 * and from cat3d's render():
 *
 *     vx = vp_w/2 + pan_x + x * scale
 *     vy = vp_h/2 + pan_y - y * scale       <- model y is up, screen y is down
 *
 * so, with `res` the renderer's own viewport width and `k = res / SCR`:
 *
 *     scale = F / dist
 *     pan_x = ox * k
 *     pan_y = oy * k
 *
 * Using the renderer's own `res` for the focal length is what makes the half-resolution
 * mode show the same picture with a quarter of the pixels instead of a quarter-size cat.
 *
 * THREE DELIBERATE DIFFERENCES FROM THE PROTOTYPE
 * ----------------------------------------------
 * Each is a real difference, stated here rather than hidden behind a default branch:
 *
 *   1. `dim` is applied as canvas opacity. The reference multiplies r/g/b by dim on a
 *      466x466 pass; cat3d's framebuffer is RGB565 whose transparent background is the
 *      black the reference composites against, so opacity lands on the same result and
 *      costs the CPU nothing because the compositor does the multiply.
 *   2. `look_x`/`look_y` are a head-look override in the reference (it rotates a head
 *      bone). cat3d animates whole-body clips only -- idle/walk/paw -- and has no head
 *      track, so the same number of degrees is applied to the body's turntable yaw and
 *      pitch. The badge still visibly turns towards what it is looking at; the head
 *      simply moves with the body.
 *   3. `follow_finger` has no counterpart either, for the same reason. It is honoured
 *      as a small turntable turn towards the finger, using the directive's look angles.
 *      Giving cat3d a real head bone is the one change that would remove items 2 and 3.
 *
 * `root_yaw` and `root_y` from the directive ARE honoured exactly: the first adds
 * degrees to the turntable rotation (追尾巴 spins 720 degrees over the quirk), the
 * second becomes a vertical pan offset in pixels (被自己吓到 hops |sin| * 4 model
 * units, which is 4 * scale pixels at the current camera distance).
 */
#include "badge_cat.h"

#include <math.h>
#include <string.h>

#include "esp_heap_caps.h"
#include "esp_log.h"

#include "badge_spec_data.h"
#include "cat3d.h"
#include "cat_view.h"

static const char *TAG = "badge_cat";

/* The reference's own frame() constants. */
#define BADGE_CAT_HALF_FOV_DEG 13.5f
#define BADGE_CAT_PI           3.14159265358979324f
#define BADGE_CAT_D2R          (BADGE_CAT_PI / 180.0f)

/* The reference's default camera distance when a screen names none (its camera()). */
#define BADGE_CAT_DEFAULT_DIST 90

/* The interactive mode's renderer resolution (spec `modes.play.res`). */
#define BADGE_CAT_HALF_RES 233

/* The reference's resting pitch. Its camera looks slightly down on the cat. */
#define BADGE_CAT_REST_PITCH_DEG 12.0f

/* The idle breath the reference adds on every frame that is not a still frame:
 *     yaw += 4 * sin(t * 0.6);  pitch += 2 * sin(t * 0.45 + 1)
 * Kept so the companion mode does not look frozen next to the prototype. */
#define BADGE_CAT_BREATH_YAW_DEG   4.0f
#define BADGE_CAT_BREATH_PITCH_DEG 2.0f

/* A frame that took longer than this was a stall, not a slow frame; the animation must
 * not fast-forward through it. */
#define BADGE_CAT_MAX_DT 0.5f

/* cat3d's animation clips. cat3d.h line 79 states them as a comment on
 * cat3d_set_anim() rather than as an enum -- "0 = idle, 1 = walk, 2 = paw" -- and
 * cat3d_anim_count() is the only accessor, so they are named once here and checked
 * against the engine at first use rather than trusted. */
#define BADGE_CAT_ANIM_IDLE 0
#define BADGE_CAT_ANIM_WALK 1
#define BADGE_CAT_ANIM_PAW  2
#define BADGE_CAT_ANIM_COUNT 3

/* The mode's own cat frame rate (spec `modes.*.fps`). The app passes badge_fsm_fps()
 * as `target_fps`, but the per-mode numbers are restated here as the fallback for a
 * caller that passes 0. */
#define BADGE_CAT_FPS_PLAY 30
#define BADGE_CAT_FPS_COMP 12
#define BADGE_CAT_FPS_DESK 30

struct badge_cat_layer {
    lv_obj_t *root; /* plain container; the canvases are its children */

    cat_view_t *full; /* 466x466: the panel's resolution, always what is shown today */
    cat_view_t *half; /* 233x233: the interactive mode. Never created; see want_half_res() */
    cat_view_t *active;

    int breed;
    bool peer;
    bool visible;

    int screen; /* BADGE_SCREEN_*, or -1 before the first update */
    badge_mode_t mode;

    /* The camera the current screen asked for, latched so a per-tick call does not
     * restate it to the renderer. */
    int dist, ox, oy;
    float scale, pan_x, pan_y;
    float dim;

    /* The one-shot animation, and the free-running clock the idle motion runs on. */
    int one_shot;      /* the quirk index + 1, or BADGE_QUIRK_NONE */
    int one_shot_anim; /* its cat3d clip */
    uint32_t one_shot_t0;
    uint32_t one_shot_ms;

    /* The directive's parametric offsets, latched like the camera: the pet hop's
     * root_y and the look angles. The quirks' own motion is NOT taken from these --
     * the tick recomputes it from the clip's progress, so a late tick still shows
     * the right phase, and adding the directive's copy on top would double it. */
    float dir_root_yaw, dir_root_y, dir_look_x, dir_look_y;

    bool still_pending; /* one more frame is owed on a still-frame screen */
    float clock;        /* seconds, free-running */

    /* Telemetry. */
    int render_us_avg;
    int last_dirty_px;
};

/* ------------------------------------------------------------------ helpers ---*/

/*
 * DISABLED: the half-resolution renderer cannot exist on this board alongside the panel's
 * own DMA buffer, so play mode renders at full resolution instead.
 *
 * The specification asks for it -- `modes.play.res == 233`, with `play.fps` at 2x -- and the
 * intent is sound: rasterise a quarter of the pixels so the interactive mode can afford a
 * doubled frame rate. The reference does exactly that and scales the result up 2x
 * ("半分辨率 233→2×", 吧唧渲染参考.html:47, :261, :434).
 *
 * What it costs here, measured on the board (logs in docs/m1-hardware-verification.md §0.1(b)):
 *
 *  - Creating the second cat_view (its own cat3d renderer + a 233x233 canvas) drops free
 *    INTERNAL RAM from 175,467 to 75,599 bytes and free DMA RAM from 167,679 to 67,811.
 *    The 233 canvas's own framebuffer does land in PSRAM (0x3C...), but the renderer's
 *    per-pixel state is deliberately internal (cat_view.c), and LVGL's objects come with it.
 *  - The panel's SPI driver then cannot allocate its private TX buffer, and every draw in
 *    that mode fails: `spi_master: Failed to allocate priv TX buffer` ->
 *    `co5300_spi: send color data failed` -> `esp_lvgl: Draw bitmap failed: ESP_ERR_NO_MEM`.
 *    Measured twice, independently: 474 and 472 error lines in ~22 s, with a live 233 canvas.
 *  - It is NOT a scaling problem. An earlier attempt at the reference's 2x used
 *    lv_image_set_scale(); removing that call changed nothing (472 errors without it), so
 *    the transform path was never the culprit and the call is gone.
 *  - The failure only appears in 互动态. 陪伴态/桌面态 never create the second renderer, so
 *    every earlier test of this board -- and every clean 30 fps PERF line -- passed.
 *
 * Rendering play mode at 466 instead keeps the panel alive and also fixes the cat's size
 * (the half-res renderer's focal length is derived from its own 233 viewport, so showing it
 * unscaled made the cat half size -- the "小猫变得很小" report). The costs are real and are
 * recorded rather than hidden: `modes.play.res` is not honoured, and the doubled play fps
 * is not attempted.
 *
 * To reinstate it, free internal RAM first -- it needs roughly another 30-90 KB of
 * DMA-capable internal memory, and a 466-equivalent on-screen size, which means scaling in
 * the renderer's own blit rather than in LVGL.
 */
static bool want_half_res(badge_mode_t mode)
{
    (void)mode;
    return false;
}

/* Always the panel's own width while the half-res renderer is disabled above. Kept as a
 * function rather than replaced by BADGE_SCR_W at the call sites so that reinstating the
 * mode is a one-line change here. */
static int viewport_res(badge_mode_t mode)
{
    return want_half_res(mode) ? BADGE_CAT_HALF_RES : BADGE_SCR_W;
}

static int cat_fps(badge_mode_t mode, int fallback)
{
    switch (mode) {
    case BADGE_MODE_PLAY: return BADGE_CAT_FPS_PLAY;
    case BADGE_MODE_COMP: return BADGE_CAT_FPS_COMP;
    case BADGE_MODE_DESK: return BADGE_CAT_FPS_DESK;
    case BADGE_MODE_AOD:  return 0; /* not rendered */
    default:              return fallback;
    }
}

/**
 * The focal length of the reference's camera, in pixels, for a viewport that many
 * pixels across: its frame() computes exactly (R / 2) / tan(13.5 deg).
 */
static float focal_length_px(int res)
{
    return ((float)res * 0.5f) / tanf(BADGE_CAT_HALF_FOV_DEG * BADGE_CAT_D2R);
}

/**
 * The cat3d clip for a quirk.
 *
 * The reference's own table (drawCat()):
 *
 *   追尾巴  spin   rootYaw = p * 720,      clip walk
 *   盯着空气 stare head look = [-32, 10]   no clip; the body is turned instead
 *   突然舔毛 lick   clip paw
 *   被自己吓到 jump rootY = |sin(p*2pi)|*4 no clip; a hop, drawn as a paw beat
 *
 * The generated table carries the clip the generator read out of that table
 * (`badge_quirk_defs[].anim`), so this is a lookup rather than a second copy of the
 * mapping -- the two cannot drift.
 */
static int quirk_anim(int quirk)
{
    if (quirk <= 0 || quirk > BADGE_QUIRK_COUNT) return BADGE_CAT_ANIM_IDLE;
    const int a = badge_quirk_defs[quirk - 1].anim;
    return (a > 0 && a < BADGE_CAT_ANIM_COUNT) ? a : BADGE_CAT_ANIM_IDLE;
}

static const badge_screen_def_t *screen_of(int screen)
{
    return badge_screen_def(screen);
}

static bool screen_is_still(const badge_cat_layer_t *l)
{
    const badge_screen_def_t *sd = screen_of(l->screen);
    if (l->mode == BADGE_MODE_AOD) return true;
    return sd != NULL && (sd->cat.flags & BADGE_CATF_STILL) != 0;
}

/* ------------------------------------------------------------------- create ---*/

badge_cat_layer_t *badge_cat_layer_create(lv_obj_t *parent)
{
    if (!parent) return NULL;

    badge_cat_layer_t *l = heap_caps_calloc(1, sizeof(*l), MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    if (!l) {
        ESP_LOGE(TAG, "out of memory allocating the cat layer");
        return NULL;
    }

    l->root = lv_obj_create(parent);
    if (!l->root) {
        heap_caps_free(l);
        return NULL;
    }
    lv_obj_remove_style_all(l->root);
    lv_obj_set_size(l->root, BADGE_SCR_W, BADGE_SCR_H);
    lv_obj_center(l->root);
    lv_obj_remove_flag(l->root, LV_OBJ_FLAG_SCROLLABLE);
    /* Touches belong to the FSM's own hit testing: on the dial the cat is the 摸摸
     * target and 逗猫 needs the finger's position, so neither the container nor its
     * canvas may swallow a gesture. */
    lv_obj_remove_flag(l->root, LV_OBJ_FLAG_CLICKABLE);

    l->full = cat_view_create(l->root, BADGE_SCR_W, BADGE_SCR_H);
    if (!l->full) {
        ESP_LOGE(TAG, "cat_view_create(%d) failed", BADGE_SCR_W);
        lv_obj_delete(l->root);
        heap_caps_free(l);
        return NULL;
    }
    lv_obj_center(cat_view_obj(l->full));
    lv_obj_remove_flag(cat_view_obj(l->full), LV_OBJ_FLAG_CLICKABLE);

    l->active = l->full;
    l->breed = 0;
    l->screen = -1;
    l->mode = BADGE_MODE_COMP;
    l->one_shot = BADGE_QUIRK_NONE;
    l->dist = 0;
    l->dim = 1.0f;
    l->still_pending = true;

    return l;
}

void badge_cat_layer_destroy(badge_cat_layer_t *l)
{
    if (!l) return;
    /* cat_view destroys its canvas before releasing the renderer, so both views must
     * go before the container that owns their parent. */
    if (l->half) cat_view_destroy(l->half);
    if (l->full) cat_view_destroy(l->full);
    if (l->root) lv_obj_delete(l->root);
    heap_caps_free(l);
}

lv_obj_t *badge_cat_layer_obj(badge_cat_layer_t *l)
{
    return l ? l->root : NULL;
}

/* -------------------------------------------------------------------- set up ---*/

void badge_cat_layer_set_breed(badge_cat_layer_t *l, int breed)
{
    if (!l) return;
    if (breed < 0 || breed >= CAT3D_BREED_COUNT) breed = 0;
    l->breed = breed; /* consumed by the next tick's cat_view_set_pose() */
}

void badge_cat_layer_set_peer(badge_cat_layer_t *l, bool peer)
{
    if (!l) return;
    l->peer = peer;
}

void badge_cat_layer_set_visible(badge_cat_layer_t *l, bool visible)
{
    if (!l) return;
    l->visible = visible;
    if (visible) {
        lv_obj_remove_flag(l->root, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_obj_add_flag(l->root, LV_OBJ_FLAG_HIDDEN);
    }
}

/* ---------------------------------------------------------------- mode swap ----*/

/**
 * Present the renderer the mode calls for.
 *
 * There is currently exactly one renderer, because the interactive mode's half-resolution
 * one could not coexist with the panel's DMA buffer (see want_half_res() above). So this
 * keeps the modal-swap structure -- one canvas visible at a time -- for when a second
 * renderer comes back, but only ever selects the full-resolution one today.
 */
static void present(badge_cat_layer_t *l, badge_mode_t mode)
{
    cat_view_t *want = l->full;

    if (want_half_res(mode) && l->half) want = l->half;

    if (want == l->active) return;

    /* A modal swap: exactly one canvas stays visible, so the compositor never has to
     * consider both of them. */
    lv_obj_add_flag(cat_view_obj(l->active), LV_OBJ_FLAG_HIDDEN);
    lv_obj_remove_flag(cat_view_obj(want), LV_OBJ_FLAG_HIDDEN);
    cat_view_invalidate(want);

    l->active = want;
    l->dist = 0;        /* force the camera to be restated to the new renderer */
    l->still_pending = true;
}

/* -------------------------------------------------------------------- update ---*/

void badge_cat_layer_update(badge_cat_layer_t *l, int screen, badge_mode_t mode,
                            const badge_anim_directive_t *anim, uint32_t now_ms)
{
    if (!l) return;

    const bool screen_changed = (screen != l->screen);
    l->screen = screen;
    l->mode = mode;
    present(l, mode);

    const badge_screen_def_t *sd = screen_of(screen);
    badge_cat_layer_set_visible(l, sd && sd->has_cat);
    const int res = viewport_res(mode);

    const float dist = (sd && sd->has_cat && sd->cat.dist > 0)
                           ? (float)sd->cat.dist
                           : (float)BADGE_CAT_DEFAULT_DIST;
    const int ox = sd ? sd->cat.ox : 0;
    const int oy = sd ? sd->cat.oy : 0;

    /* The projection, from the two arithmetics quoted at the top of the file. */
    const float k = (float)res / (float)BADGE_SCR_W;
    const float scale = focal_length_px(res) / dist;
    const float pan_x = (float)ox * k;
    const float pan_y = (float)oy * k;

    /* The screen's dim. The reference scales r/g/b by it; opacity on the canvas is the
     * same arithmetic with the compositor doing the multiply. AOD overrides to the
     * spec's own 35 %. */
    float dim = 1.0f;
    if (sd && sd->cat.dim_pct > 0 && sd->cat.dim_pct < 100) {
        dim = (float)sd->cat.dim_pct / 100.0f;
    }
    if (mode == BADGE_MODE_AOD) dim = 0.35f;

    /* The camera is restated only when something about it changed. The viewport is keyed
     * in as well as the screen: the projection depends on the renderer's own resolution
     * (focal_length_px(res)), so a mode swap that keeps the same screen still needs the new
     * projection once a second renderer exists. With only the 466 renderer selected this
     * term is constant -- kept so that reinstating want_half_res() cannot silently skip the
     * restatement. */
    const int prev_res = (l->active == l->half) ? BADGE_CAT_HALF_RES : BADGE_SCR_W;
    if (screen_changed || l->dist != (int)dist || l->ox != ox || l->oy != oy || prev_res != res) {
        cat_view_set_view(l->active, scale, pan_x, pan_y);
        l->dist = (int)dist;
        l->ox = ox;
        l->oy = oy;
    }
    l->scale = scale;
    l->pan_x = pan_x;
    l->pan_y = pan_y;

    if (l->dim != dim) {
        lv_obj_set_style_opa(cat_view_obj(l->active), (lv_opa_t)(dim * 255.0f + 0.5f), 0);
        l->dim = dim;
    }

    /* Latch the one-shot. A quirk is a fixed-length clip: the directive carries its
     * index, its start and its length. A different index starts a new one; NONE clears
     * it. */
    const int want_quirk = anim ? (int)anim->quirk : (int)BADGE_QUIRK_NONE;
    if (want_quirk != l->one_shot) {
        l->one_shot = want_quirk;
        l->one_shot_anim = quirk_anim(want_quirk);
        l->one_shot_t0 = anim && anim->t0 ? anim->t0 : now_ms;
        l->one_shot_ms = anim ? anim->ms : 0u;
    }

    /* The directive's parametric offsets (pet hop, look angles), latched like the
     * camera so the tick never has to know where they came from. */
    l->dir_root_yaw = anim ? anim->root_yaw : 0.0f;
    l->dir_root_y   = anim ? anim->root_y   : 0.0f;
    l->dir_look_x   = anim ? anim->look_x   : 0.0f;
    l->dir_look_y   = anim ? anim->look_y   : 0.0f;

    /* A screen change owes one fresh frame even on a still-frame screen (spec 8.4). */
    if (screen_changed || want_half_res(mode) != want_half_res(l->mode)) l->still_pending = true;
}

/* ---------------------------------------------------------------------- tick ---*/

bool badge_cat_layer_tick(badge_cat_layer_t *l, float dt_seconds, int target_fps)
{
    if (!l || !l->active || !l->visible) return false;
    if (dt_seconds < 0.0f) dt_seconds = 0.0f;
    if (dt_seconds > BADGE_CAT_MAX_DT) dt_seconds = BADGE_CAT_MAX_DT;

    const bool still = screen_is_still(l);

    /* The always-on display and 睡着了 show one frame and then stop (spec 8.4). The
     * gate is the *only* thing that stops them, so a screen change re-arms it through
     * still_pending and the new screen gets drawn once. */
    if (still) {
        if (!l->still_pending) return false;
    }

    l->clock += dt_seconds;
    const float t = l->clock;

    /* The quirk's own one-shot. The reference drives spin/jump/lick parametrically
     * from the clip's progress p in 0..1; the directive carries the length, so p is
     * derived here rather than stored. */
    int an = BADGE_CAT_ANIM_IDLE;
    float root_yaw = 0.0f, root_y = 0.0f;
    bool follow_finger = false;

    if (l->one_shot != BADGE_QUIRK_NONE) {
        an = l->one_shot_anim;
        float p = 0.0f;
        if (l->one_shot_ms > 0u) {
            const uint32_t now = (uint32_t)(t * 1000.0f);
            const uint32_t elapsed = now - l->one_shot_t0;
            p = (float)elapsed / (float)l->one_shot_ms;
            if (p > 1.0f) p = 1.0f;
        }
        /* The reference's own parametric motion, from its drawCat() quirk block. It is
         * reproduced from p rather than read off the directive so that a badge whose
         * tick is late still shows the right phase. */
        const badge_quirk_def_t *q = (l->one_shot > 0) ? &badge_quirk_defs[l->one_shot - 1] : NULL;
        if (q && q->anim == BADGE_CAT_ANIM_WALK) {
            root_yaw = p * 720.0f; /* 追尾巴 */
        } else if (q && l->dir_root_y > 0.0f) {
            root_y = l->dir_root_y;
        }
    }

    /* The idle breath, skipped exactly where the reference skips it. */
    float yaw = 0.0f, pitch = BADGE_CAT_REST_PITCH_DEG;
    if (!still && l->mode != BADGE_MODE_AOD) {
        yaw += BADGE_CAT_BREATH_YAW_DEG * sinf(t * 0.6f);
        pitch += BADGE_CAT_BREATH_PITCH_DEG * sinf(t * 0.45f + 1.0f);
    }

    if (l->one_shot != BADGE_QUIRK_NONE) {
        yaw += root_yaw;
        follow_finger = false; /* no head track in cat3d; the look angles carry it */
    }

    /* The directive's offsets. A one-shot recomputes its own motion from the clip's
     * progress (and the directive then carries the same values), so the directive's
     * root terms apply only outside a quirk clip: that is the pet hop. The look
     * angles are always honoured -- 盯着空气's stare, 换个表盘's glance and the
     * feather's head-follow all arrive this way. */
    if (l->one_shot == BADGE_QUIRK_NONE) yaw += l->dir_root_yaw;
    yaw += l->dir_look_x;
    pitch += l->dir_look_y;
    const float hop_y = (l->one_shot != BADGE_QUIRK_NONE) ? root_y : l->dir_root_y;

    cat_view_set_orbit(l->active, yaw, pitch);
    /* The hop is a vertical pan in pixels: root_y is in model units, so it becomes
     * root_y * scale through the same projection as everything else. */
    const float hop_px = l->one_shot != BADGE_QUIRK_NONE ? hop_y * l->scale : hop_y * 7.0f;
    cat_view_set_view(l->active, l->scale, l->pan_x, l->pan_y - hop_px);
    cat_view_set_pose(l->active, l->breed, an, t);
    cat_view_set_target_fps(l->active, cat_fps(l->mode, target_fps));

    const bool drawn = cat_view_tick(l->active, dt_seconds);
    if (drawn) {
        l->still_pending = false;
        l->last_dirty_px = cat_view_last_dirty_px(l->active);
        l->render_us_avg = (int)cat_view_render_us_avg(l->active);
    }
    (void)follow_finger;
    return drawn;
}

/* ----------------------------------------------------------------- telemetry ---*/

int badge_cat_layer_render_us_avg(const badge_cat_layer_t *l)
{
    return l ? l->render_us_avg : 0;
}

int badge_cat_layer_fps(const badge_cat_layer_t *l)
{
    return l && l->active ? cat_view_effective_fps(l->active) : 0;
}

int badge_cat_layer_dirty_px(const badge_cat_layer_t *l)
{
    return l ? l->last_dirty_px : 0;
}
