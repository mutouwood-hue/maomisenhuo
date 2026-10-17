/*
 * badge_paint - the primitives that are not rectangles.
 *
 * WHAT THE SPEC SAYS, AND WHERE EACH RULE COMES FROM
 * --------------------------------------------------
 * Every number this module draws with comes from 吧唧交互规范 (version 0.3.0), held
 * in badge_spec_data.{h,c}, or from the geometry constants in badge_spec.h. The
 * behavioural ground truth for what a shape looks like is the interactive reference
 * `吧唧交互规范/吧唧渲染参考.html`, and the part of it that draws each element is
 * cited next to the code that reproduces it:
 *
 *   drawEl() 'arc'      -> badge_paint_arc          (line 1494-1495)
 *   drawEl() 'segs'     -> badge_paint_segs         (line 1496)
 *   drawEl() 'battery'  -> badge_paint_battery      (line 1498-1499)
 *   drawEl() 'bar'      -> badge_paint_bar          (line 1493)
 *   drawEl() 'dayring'  -> badge_paint_dayring      (line 1505-1510)
 *   drawRing()          -> badge_paint_haptic_edge  (line 1523)
 *   drawQR()            -> bp_qr_paint              (line 1528-1529)
 *   nightDim()         -> badge_ui.c (display brightness, not a painter)
 *
 * The conventions the reference states, and this file implements:
 *
 *  - "0°=3 点钟，顺时针" (0 degrees is 3 o'clock, increasing clockwise). Checked
 *    against canvas2d, which is what the reference draws with: it calls
 *    g.arc(C, C, r, a0 * pi/180, a1 * pi/180) and the canvas' y axis points down, so
 *    increasing degrees sweep from +x towards +y, i.e. clockwise on screen. That is
 *    the same convention as badge_paint.h, so the reference's arc direction and this
 *    implementation AGREE: no sign flip anywhere.
 *
 *  - "按钮、文字的外框四角必须在半径 212 的圆内；半径 212–233 只放环形元素"
 *    (content corners inside radius 212; 212..233 carries ring elements only).
 *    Underneath that rule sits a harder one: nothing at all may be drawn outside the
 *    disc of radius 233, because the panel is square and those corners do not exist
 *    on the glass. Every primitive here clips per pixel to the disc
 *    (bp_inside_disc / badge_paint_covering), never to the canvas rectangle.
 *
 *  - "按整数倍最近邻放大" (integer multiples, nearest neighbour) for icons.
 *
 *  - 24-hour ring (line 1505): `const now=clockMin(), A=m=>m/1440*360-90`. Minute 0
 *    therefore sits at -90 degrees (12 o'clock) and the day runs clockwise from
 *    there. Each band is opaque up to `now` and 30% opaque after it. The owner's day
 *    is the outer band (r, w), the cat's day the inner band (r2, w2); the cat's kind
 *    is derived from the owner's with CATK = {Sleep:Sleep, Home:Home, Commute:Home,
 *    Work:Out, Out:Out} (line 1481). A radius-8 white dot marks `now` on the outer
 *    band and a heart is dropped at every heart minute that has already passed.
 *
 *  - "没有马达时：屏幕最外圈亮一圈 320 毫秒（只亮环形像素）" (spec 12.2,
 *    hapticFallback): ringR 227, ringW 6, colour accent, 320 ms, ring pixels only.
 *
 * PIXEL ACCESS AND THE HOST BUILD
 * -------------------------------
 * Every write goes through badge_paint_px_set()/badge_paint_px_get() (see
 * badge_paint_priv.h). On the board those are lv_canvas_set_px/lv_canvas_get_px; a
 * host test calls badge_paint_host_bind() once and the same code paints into a plain
 * uint32_t[466*466] ARGB8888 buffer instead. The shims are cached in file statics,
 * so the production path is one indirect call per pixel -- what the canvas call
 * already cost -- with no branch and no state to check. -DBADGE_PAINT_HOST drops the
 * badge_assets.h dependency (there are no LVGL fonts on the host) and makes the
 * defaults no-ops, so a host build that never binds still links.
 *
 * ALPHA
 * -----
 * The canvas is ARGB8888 and LVGL's lv_canvas_set_px() does not blend: it writes the
 * four bytes. So the blending lives here. bp_set() is a raw store (exactly
 * lv_canvas_set_px); bp_blend() is the compositing step, a source-over of a 0..255
 * alpha onto whatever is already in the pixel. An opaque write takes the fast path
 * and is a plain store, which is why a solid element's colour comes back bit-exact.
 *
 * RASTERISATION
 * -------------
 * Hand-written scanline rasterisation; no LVGL draw units anywhere:
 *   - bp_rrect_paint  scanline rounded rectangle (the reference's rrect(), line 1479)
 *   - bp_disc_paint   analytic per-pixel coverage of a circle
 *   - bp_span_paint   per-pixel coverage of a capsule swept along a centreline arc,
 *                     with an exact angular window so an arc from a0 to a1 stops at
 *                     a0 and at a1 (bp_span_in_window).
 * Arcs, ring bands, segmented rings, the 24-hour ring and the haptic edge are all
 * bp_span_paint.
 *
 * NO ALLOCATION, NO LARGE STACK FRAMES
 * ------------------------------------
 * Nothing here allocates. The largest local object is the 25x25 QR module map (625
 * bytes). The 8 KB stack array that once rebooted this board (docs/gap-vs-v1.5.md)
 * has no descendant here.
 */
#include "badge_paint.h"

#include <math.h>
#include <string.h>

#include "badge_paint_priv.h"
#include "badge_spec_data.h"

#ifdef BADGE_PAINT_HOST
/* The host build has no asset table; the test binary supplies its own. */
extern const uint8_t *badge_icon_rgba(int icon);
#else
#include "badge_assets.h"
#endif

/* Repaint clip. Full panel by default, so every existing call site and the whole
 * pixel test are unaffected until badge_ui.c narrows it for a partial repaint. */
static int bp_clip_x0 = 0;
static int bp_clip_y0 = 0;
static int bp_clip_x1 = BADGE_SCR_W;
static int bp_clip_y1 = BADGE_SCR_H;

void badge_paint_clip(int x0, int y0, int x1, int y1)
{
    /* A half-open, already-intersected rectangle. An empty or inverted one is
     * clamped to empty rather than to the full panel: "clip to nothing" is a
     * legitimate state (a repaint box that is entirely off the glass) and
     * silently painting the whole screen would be the worse failure. */
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > BADGE_SCR_W) x1 = BADGE_SCR_W;
    if (y1 > BADGE_SCR_H) y1 = BADGE_SCR_H;
    if (x1 < x0) x1 = x0;
    if (y1 < y0) y1 = y0;
    bp_clip_x0 = x0;
    bp_clip_y0 = y0;
    bp_clip_x1 = x1;
    bp_clip_y1 = y1;
}

/* ------------------------------------------------------------------ canvas ---*/

/* The default shims: LVGL's own canvas accessors on the board, no-ops on the host
 * (where the test rebinds them before painting anything). */
#ifdef BADGE_PAINT_HOST
static void bp_default_set(lv_obj_t *canvas, int x, int y, lv_color_t color, lv_opa_t opa)
{
    (void)canvas;
    (void)x;
    (void)y;
    (void)color;
    (void)opa;
}

void badge_paint_batch_begin(lv_obj_t *canvas) { (void)canvas; }
void badge_paint_batch_end(void) {}
static lv_color32_t bp_default_get(lv_obj_t *canvas, int x, int y)
{
    (void)canvas;
    (void)x;
    (void)y;
    const lv_color32_t zero = {0, 0, 0, 0};
    return zero;
}
#else
/*
 * Board: write STRAIGHT INTO the canvas's draw buffer, and do not invalidate here.
 *
 * lv_canvas_set_px() ends with lv_obj_invalidate(obj) (lvgl/src/widgets/canvas/
 * lv_canvas.c:185), so one pixel write marks the whole 466x466 canvas dirty. That is
 * harmless for a single dot and ruinous for this module: badge_paint_clear() fills all
 * 217,156 pixels, and a face repaint writes thousands more, so a single repaint produced
 * ~217k full-canvas invalidations. Measured on the board: the LVGL task never got out of
 * app_tick_cb, starved IDLE0 and tripped the task watchdog every 5 s, with exactly this
 * chain in the backtrace:
 *
 *     badge_paint_clear -> bp_default_set -> lv_canvas_set_px -> lv_obj_invalidate
 *
 * Invalidating once per REPAINT is the correct granularity, and the caller already does
 * it: badge_ui.c:1317 on the full-repaint path and :1322 on the partial one, both after
 * the painting is finished.
 *
 * The canvas is ARGB8888 (badge_ui.c creates it with LV_COLOR_FORMAT_ARGB8888) but LVGL may
 * pad the stride, so the address comes from LVGL's own helper -- the identical call
 * lv_canvas_get_px() makes (lv_canvas.c:221) -- rather than from pointer maths that would
 * have to re-derive the stride itself. lv_color32_t is {blue, green, red, alpha} in memory
 * (lvgl/src/misc/lv_color.h:122-126), which is the byte order of the store below --
 * identical to what lv_canvas_set_px() writes for this format.
 */
static lv_obj_t *bp_batch_canvas;
static lv_color32_t *bp_batch_rows[BADGE_SCR_H];
void badge_paint_batch_begin(lv_obj_t *canvas)
{
    bp_batch_canvas = canvas;
    lv_draw_buf_t *db = canvas ? lv_canvas_get_draw_buf(canvas) : NULL;
    for (int y = 0; y < BADGE_SCR_H; ++y)
        bp_batch_rows[y] = db ? lv_draw_buf_goto_xy(db, 0, (uint32_t)y) : NULL;
}
void badge_paint_batch_end(void)
{
    bp_batch_canvas = NULL;
}
static void bp_default_set(lv_obj_t *canvas, int x, int y, lv_color_t color, lv_opa_t opa)
{
    if (x < 0 || y < 0 || x >= BADGE_SCR_W || y >= BADGE_SCR_H) return;
    lv_color32_t *px;
    if (canvas == bp_batch_canvas && bp_batch_rows[y]) px = &bp_batch_rows[y][x];
    else {
        lv_draw_buf_t *db = lv_canvas_get_draw_buf(canvas);
        if (!db) return;
        px = lv_draw_buf_goto_xy(db, (uint32_t)x, (uint32_t)y);
        if (!px) return;
    }

    px->blue = color.blue;
    px->green = color.green;
    px->red = color.red;
    px->alpha = opa;
}

static lv_color32_t bp_default_get(lv_obj_t *canvas, int x, int y)
{
    /* lv_canvas_get_px() does NOT invalidate (it is pure pointer maths, lv_canvas.c:212),
     * so the read path is left as LVGL's own bounds-checked accessor. */
    if (canvas == bp_batch_canvas && x >= 0 && y >= 0 && x < BADGE_SCR_W && y < BADGE_SCR_H && bp_batch_rows[y])
        return bp_batch_rows[y][x];
    return lv_canvas_get_px(canvas, x, y);
}
#endif

static badge_paint_px_set_fn bp_set = bp_default_set;
static badge_paint_px_get_fn bp_get = bp_default_get;

/* Host redirection state. Compiled into both builds so the symbol always exists;
 * on the board nothing calls the binder and the branch is never taken. */
static uint32_t *bp_host_px = NULL;
static int bp_host_stride = BADGE_SCR_W;

/* Raw store, the same four bytes lv_canvas_set_px() writes into an ARGB8888
 * canvas: (red, green, blue, opacity). No blending -- that is bp_blend's job, and
 * this deliberately does NOT apply the repaint clip: badge_paint_clear() uses it to
 * clear the whole 466x466 square, which is what a full repaint means. */
static void bp_host_set(lv_obj_t *canvas, int x, int y, lv_color_t color, lv_opa_t opa)
{
    (void)canvas;
    if (!bp_host_px) return;
    if (x < 0 || y < 0 || x >= BADGE_SCR_W || y >= BADGE_SCR_H) return;
    bp_host_px[(size_t)y * (size_t)bp_host_stride + (size_t)x] =
        ((uint32_t)opa << 24) | ((uint32_t)color.red << 16) | ((uint32_t)color.green << 8) |
        (uint32_t)color.blue;
}

static lv_color32_t bp_host_get(lv_obj_t *canvas, int x, int y)
{
    (void)canvas;
    lv_color32_t c = {0, 0, 0, 0};
    if (!bp_host_px) return c;
    if (x < 0 || y < 0 || x >= BADGE_SCR_W || y >= BADGE_SCR_H) return c;
    const uint32_t v = bp_host_px[(size_t)y * (size_t)bp_host_stride + (size_t)x];
    c.alpha = (uint8_t)(v >> 24);
    c.red = (uint8_t)((v >> 16) & 0xFFu);
    c.green = (uint8_t)((v >> 8) & 0xFFu);
    c.blue = (uint8_t)(v & 0xFFu);
    return c;
}

void badge_paint_host_bind(uint32_t *pixels, int stride)
{
    if (!pixels) {
        bp_host_px = NULL;
        bp_set = bp_default_set;
        bp_get = bp_default_get;
        return;
    }
    bp_host_px = pixels;
    bp_host_stride = stride > 0 ? stride : BADGE_SCR_W;
    bp_set = bp_host_set;
    bp_get = bp_host_get;
}

/* ---------------------------------------------------------------- helpers ----*/

#define BP_PI 3.14159265358979323846
#define BP_D2R (BP_PI / 180.0)

/*
 * The disc of radius BADGE_R is the only part of the square panel that exists, so
 * every write is clipped to it. This is the clip the geometry rule implies.
 *
 * SAMPLED AT THE PIXEL'S CENTRE. The glass is a circle of radius 233 centred on the
 * panel's centre, and the panel is 466 px across, so the centre is the continuous
 * point (233, 233) and pixel (x, y) covers [x, x+1) x [y, y+1) -- its centre is
 * (x + 0.5, y + 0.5). Comparing the raw integer difference instead puts the sample
 * half a pixel towards the top left: pixel (233, 466) (centre 233.5 px away) was
 * clipped away although the reference's canvas2d would fill it, and pixel (233, 0)
 * (centre 233.5 px away) was filled although canvas2d would not. That is a
 * half-pixel error along every edge, which is invisible in a thumbnail and wrong on
 * the glass -- and it is exactly what the pixel test's 233/234 boundary probes catch.
 */
bool badge_paint_covering(int x, int y)
{
    if (x < 0 || y < 0 || x >= BADGE_SCR_W || y >= BADGE_SCR_H) return false;
    const double dx = (double)x + 0.5 - (double)BADGE_CX;
    const double dy = (double)y + 0.5 - (double)BADGE_CY;
    return dx * dx + dy * dy <= (double)BADGE_R * (double)BADGE_R;
}

static bool bp_inside_disc(int x, int y)
{
    if (!badge_paint_covering(x, y)) return false;
    /* The repaint clip (badge_paint_clip()): the second half of "repaint only what
     * changed". badge_ui.c clears one band and redraws the elements that intersect
     * it; without this the redraw would smear each element across the whole disc.
     * Defaults to the full panel, which is a branch that always predicts true. */
    return x >= bp_clip_x0 && x < bp_clip_x1 && y >= bp_clip_y0 && y < bp_clip_y1;
}

/*
 * Composite `color` at 0..255 `alpha` over the pixel at (x, y): one pixel, disc
 * clipped, in one place.
 *
 * The destination is ARGB8888 and non-premultiplied, so this is the textbook
 * source-over:
 *     out_a = sa + da * (1 - sa)
 *     out_c = (sc * sa + dc * da * (1 - sa)) / out_a
 * For an opaque source it is the identity store, which keeps a solid element's RGB
 * bit-exact. For a transparent destination it leaves the source colour alone and
 * carries the alpha, which is what a layer wants.
 */
static void bp_blend(lv_obj_t *canvas, int x, int y, lv_color_t color, int alpha)
{
    if (alpha <= 0) return;
    if (!bp_inside_disc(x, y)) return;
    if (alpha >= 255) {
        bp_set(canvas, x, y, color, LV_OPA_COVER);
        return;
    }
    const lv_color32_t d = bp_get(canvas, x, y);
    const uint32_t sa = (uint32_t)alpha;
    const uint32_t da = d.alpha;
    const uint32_t ia = 255u - sa;
    const uint32_t out_a = sa + (da * ia + 127u) / 255u;
    const uint32_t den = out_a ? out_a : 1u;
    const uint32_t r = ((uint32_t)color.red * sa + ((uint32_t)d.red * da * ia + 127u) / 255u + den / 2u) / den;
    const uint32_t g =
        ((uint32_t)color.green * sa + ((uint32_t)d.green * da * ia + 127u) / 255u + den / 2u) / den;
    const uint32_t b = ((uint32_t)color.blue * sa + ((uint32_t)d.blue * da * ia + 127u) / 255u + den / 2u) / den;
    bp_set(canvas, x, y,
           lv_color_make((uint8_t)(r > 255u ? 255u : r), (uint8_t)(g > 255u ? 255u : g),
                         (uint8_t)(b > 255u ? 255u : b)),
           (lv_opa_t)out_a);
}

/* Blend two 0..255 alphas the way two stacked layers compose. */
static int bp_mul_alpha(int a, int b)
{
    if (a <= 0 || b <= 0) return 0;
    if (a >= 255) return b;
    if (b >= 255) return a;
    return (a * b + 127) / 255;
}

/* Multiply a colour towards black: exactly what compositing an alpha over the
 * spec's pure-black background produces, without a second blend step. */
static lv_color_t bp_fade(lv_color_t c, double k)
{
    if (k >= 1.0) return c;
    if (k <= 0.0) {
        const lv_color_t black = {0, 0, 0};
        return black;
    }
    return lv_color_make((uint8_t)((double)c.red * k + 0.5), (uint8_t)((double)c.green * k + 0.5),
                         (uint8_t)((double)c.blue * k + 0.5));
}

/* A colour index from the generated badge_colors[], or black for "absent". The
 * generator writes BADGE_COLOR_NONE for an element that does not set the field. */
static lv_color_t bp_col(uint8_t idx)
{
    if (idx >= BADGE_COLOR_COUNT) return badge_rgb(0x000000u);
    return badge_rgb(badge_colors[idx].rgb888);
}

/* The reference's nightDim() (line 1601) and spec 8 (modes.desk, "23:00–7:00 亮度
 * 降到 35%") drive `cv.style.filter = brightness(...)` -- a whole-screen brightness,
 * not a per-element colour. It therefore belongs to the display layer in badge_ui.c
 * and is deliberately not a painter here: dimming elements individually would double
 * apply the rule. */

static void bp_unit(double deg, double *ux, double *uy)
{
    const double rad = deg * BP_D2R;
    *ux = cos(rad);
    *uy = sin(rad);
}

/* ------------------------------------------------------------------- rects ---*/

/*
 * Scanline rounded rectangle: the reference's rrect() (line 1479), a rectangle whose
 * four corners are quarter circles of `radius` joined by straight edges.
 *
 * Each row's covered interval is half-open, [left, right), so a rectangle from x for
 * w columns covers exactly the pixel centres in [x, x + w) -- the same set canvas2d's
 * fillRect covers. The corner pull-in makes the edges land on a sub-pixel boundary,
 * so each pixel takes its true horizontal coverage; without that, a rounded edge
 * either bleeds one column past where canvas2d stops or leaves a stair-step gap.
 * A row narrower than the corner circle's chord is skipped entirely, which is also
 * what makes radius = w/2 a capsule rather than a lozenge.
 */
static bool bp_rrect_paint(lv_obj_t *canvas, int x, int y, int w, int h, int radius, lv_color_t color)
{
    if (w <= 0 || h <= 0) return false;
    if (radius < 0) radius = 0;
    if (radius > w / 2) radius = w / 2;
    if (radius > h / 2) radius = h / 2;

    bool drew = false;
    for (int row = 0; row < h; row++) {
        const double cyi = (double)y + (double)row + 0.5;
        double left = (double)x;
        double right = (double)x + (double)w;

        double dc = 0.0;
        if (radius > 0 && cyi < (double)y + (double)radius) {
            dc = ((double)y + (double)radius) - cyi;
        } else if (radius > 0 && cyi > (double)y + (double)h - (double)radius) {
            dc = cyi - ((double)y + (double)h - (double)radius);
        }
        if (dc > 0.0) {
            if (dc >= (double)radius) continue;
            const double drop = (double)radius - sqrt((double)radius * (double)radius - dc * dc);
            left += drop;
            right -= drop;
        }
        if (right <= left) continue;

        const int x0 = (int)floor(left - 0.5);
        const int x1 = (int)ceil(right - 0.5);
        const int yy = y + row;
        for (int xx = x0; xx < x1; xx++) {
            const double lo = (double)xx - 0.5 > left ? (double)xx - 0.5 : left;
            const double hi = (double)xx + 0.5 < right ? (double)xx + 0.5 : right;
            double cov = hi - lo;
            if (cov <= 0.0) continue;
            if (cov > 1.0) cov = 1.0;
            if (!bp_inside_disc(xx, yy)) continue;
            const int a = (int)(cov * 255.0 + 0.5);
            if (a >= 255) {
                bp_set(canvas, xx, yy, color, LV_OPA_COVER);
            } else {
                bp_blend(canvas, xx, yy, color, a);
            }
            drew = true;
        }
    }
    return drew;
}

/*
 * An axis-aligned rectangle with a fractional width, i.e. canvas2d's
 * fillRect(x, y, fill_w, h) when fill_w is not an integer. Used by the battery
 * fill, whose width is (w - 8) * pct / 100 in floating point: at 50% of a 14px
 * inner width the edge sits at 7.0 columns, but at 30% it sits at 4.2 and the last
 * column is only a fifth covered. Rounding that to an integer would make the
 * percentage read wrong by up to a whole pixel at every step.
 */
static bool bp_rrect_paint_soft(lv_obj_t *canvas, int x, int y, double full_w, double fill_w, int h,
                                lv_color_t color)
{
    if (fill_w <= 0.0 || h <= 0 || full_w <= 0.0) return false;
    if (fill_w > full_w) fill_w = full_w;
    bool drew = false;
    for (int row = 0; row < h; row++) {
        const int yy = y + row;
        for (int col = 0;; col++) {
            const double lo = (double)col;
            if (lo >= fill_w) break;
            const double hi = lo + 1.0 < fill_w ? lo + 1.0 : fill_w;
            double cov = hi - lo;
            if (cov <= 0.0) continue;
            if (cov > 1.0) cov = 1.0;
            const int xx = x + col;
            if (!bp_inside_disc(xx, yy)) continue;
            const int a = (int)(cov * 255.0 + 0.5);
            if (a >= 255) {
                bp_set(canvas, xx, yy, color, LV_OPA_COVER);
            } else {
                bp_blend(canvas, xx, yy, color, a);
            }
            drew = true;
        }
    }
    return drew;
}

static bool bp_disc_paint(lv_obj_t *canvas, double cx, double cy, double r, lv_color_t color, int alpha){
    if (r <= 0.0 || alpha <= 0) return false;
    const int x0 = (int)floor(cx - r - 1.0);
    const int x1 = (int)ceil(cx + r + 1.0);
    const int y0 = (int)floor(cy - r - 1.0);
    const int y1 = (int)ceil(cy + r + 1.0);
    bool drew = false;

    for (int py = y0; py <= y1; py++) {
        const double dy = ((double)py + 0.5) - cy;
        for (int px = x0; px <= x1; px++) {
            const double dx = ((double)px + 0.5) - cx;
            const double d = sqrt(dx * dx + dy * dy);
            double cov = r + 0.5 - d;
            if (cov <= 0.0) continue;
            if (cov > 1.0) cov = 1.0;
            const int a = bp_mul_alpha((int)(cov * 255.0 + 0.5), alpha);
            bp_blend(canvas, px, py, color, a);
            if (a > 0) drew = true;
        }
    }
    return drew;
}

/* ----------------------------------------------------------- swept stroke ----*/

typedef struct {
    double cx, cy;
    double r_in, r_out; /* the annulus; r_in <= 0 means a fan out of the centre */
    double r_mid;
    double cap;       /* 0 = butt ends, > 0 = round cap radius (w / 2) */
    double ux, uy;    /* unit vector at a0 */
    double ex, ey;    /* unit vector at a1 */
    double sx, sy;    /* centreline start point */
    double tx, ty;    /* centreline end point */
    double sgn;       /* +1 when a1 > a0 */
    double abs_span;  /* |a1 - a0| in degrees, clamped to 360 */
    double a0deg;     /* a0 in degrees, kept for the scan-box extent (bp_span_bbox) */
    double cos_abs;   /* cos(abs_span) */
    double sin_ramp0; /* sin(degrees over which a0 fades in) */
    double sin_ramp1; /* sin(degrees over which a1 fades out) */
    bool half_open;   /* exclude the pixel exactly at a1 (adjacent pieces join) */
} bp_span_t;

static void bp_span_init(bp_span_t *sp, double cx, double cy, double r_mid, double w, double a0, double a1,
                         double cap, double ramp0, double ramp1, bool half_open)
{
    sp->cx = cx;
    sp->cy = cy;
    sp->r_in = r_mid - w * 0.5;
    sp->r_out = r_mid + w * 0.5;
    sp->r_mid = r_mid;
    sp->cap = cap;
    sp->half_open = half_open;
    bp_unit(a0, &sp->ux, &sp->uy);
    bp_unit(a1, &sp->ex, &sp->ey);
    sp->sx = cx + r_mid * sp->ux;
    sp->sy = cy + r_mid * sp->uy;
    sp->tx = cx + r_mid * sp->ex;
    sp->ty = cy + r_mid * sp->ey;

    const double span = a1 - a0;
    sp->sgn = span < 0.0 ? -1.0 : 1.0;
    double abs_span = span < 0.0 ? -span : span;
    if (abs_span > 360.0) abs_span = 360.0;
    sp->abs_span = abs_span;
    sp->a0deg = a0;
    sp->cos_abs = abs_span >= 360.0 ? -1.0 : cos(abs_span * BP_D2R);
    sp->sin_ramp0 = ramp0 > 0.0 ? sin(ramp0 * BP_D2R) : 0.0;
    sp->sin_ramp1 = ramp1 > 0.0 ? sin(ramp1 * BP_D2R) : 0.0;
}

/*
 * Is the ray through (px, py) inside the swept angular window?
 *
 * Let theta be the pixel's angle. s = sin(theta - a0) and c = cos(theta - a0), both
 * mirrored by sgn so a negative span looks like a positive one. For a span up to 180
 * degrees the offset must lie in [0, span]: s >= 0 and c >= cos(span). Past 180
 * degrees the tail beyond 180 is also inside, and there the test flips to
 * c <= cos(span). A one-sided test here is how an arc silently overdraws a quarter
 * turn, or stops short of it -- which is exactly what an s with the wrong sign did:
 * it selected the MIRROR of the requested sweep, so [0, 90] lit up (0, -90].
 *
 * cross(u, v) = ux*vy - uy*vx is sin(angle of v - angle of u), and for unit vectors
 * it needs no division; only c needs the 1/d that the caller has already computed.
 */
static bool bp_span_in_window(const bp_span_t *sp, double dx, double dy, double inv_d, double *out_s)
{
    /* Both sin and cos are read in the mirrored frame: s = sin(a0 - theta),
     * c = cos(a0 - theta). Cosine is even, so c is the same in either frame and must
     * NOT be multiplied by sgn -- doing that put the tail of every counter-clockwise
     * sweep on the wrong side of zero, so an arc from 0 to -90 lit nothing between
     * -1 and -89 degrees. */
    const double s = (sp->ux * dy - sp->uy * dx) * inv_d * sp->sgn;
    const double c = (dx * sp->ux + dy * sp->uy) * inv_d;
    if (out_s) *out_s = s;
    if (sp->abs_span >= 360.0) return true;
    if (sp->abs_span >= 180.0) {
        if (s > 0.0) return true;
        if (sp->half_open) return c < sp->cos_abs;
        return c <= sp->cos_abs;
    }
    if (s < 0.0) return false;
    if (sp->half_open) return c > sp->cos_abs;
    return c >= sp->cos_abs;
}

/* Grow a bbox by the point at `rad` along the direction `ang` degrees, about the span's
 * own centre. The centre offset is easy to drop ("the ring is centred on the disc") and
 * wrong the moment a caller strokes off-centre. */
static void bp_bbox_point(const bp_span_t *sp, double ang, double rad, double *x0, double *x1,
                          double *y0, double *y1)
{
    const double ax = sp->cx + rad * cos(ang * BP_D2R);
    const double ay = sp->cy + rad * sin(ang * BP_D2R);
    if (ax < *x0) *x0 = ax;
    if (ax > *x1) *x1 = ax;
    if (ay < *y0) *y0 = ay;
    if (ay > *y1) *y1 = ay;
}

/* Is the direction `a` degrees inside the sweep that runs from `lo` in the direction
 * `sgn` for `abs_span` degrees? Angles wrap, so the offset is taken modulo 360. */
static bool bp_deg_in_sweep(double a, double lo, double sgn, double abs_span)
{
    double t = (a - lo) * sgn;
    t = fmod(t, 360.0);
    if (t < 0.0) t += 360.0;
    return t <= abs_span;
}

/*
 * The integer scan box this span can actually cover.
 *
 * The obvious box is the one the annulus sweeps if the whole circle is drawn --
 * [cx - reach, cx + reach] by [cy - reach, cy + reach] -- and for the dial's 214 px arcs that
 * is 445x445 = ~198,000 pixels. It is the WRONG box by an order of magnitude: an arc covers
 * only the part of that square near its own angular window (a 7 degree arc is ~57x32), and
 * everything outside it is rejected by the angular test one pixel at a time.
 *
 * That cost is multiplied by bp_stroke(), which splits a span into one-degree pieces
 * (steps = ceil(|span|)) and runs a full scan for EACH piece. A 14 degree stat arc therefore
 * scanned 14 * ~198,000 = 2.8 million pixels to light ~2000 of them, twice (track + lit),
 * five times per dial. Measured on the board this starved IDLE0 and tripped the task
 * watchdog every 5 s, with bp_span_in_window/bp_span_paint in every backtrace sample.
 *
 * So take the sector's true extent. Its boundary is two radial edges and two arcs, so the
 * extremes can only occur at an endpoint or where an arc is tangent to an axis -- 0, 90, 180
 * or 270 degrees. Each candidate direction is sampled at BOTH radii: sampling only r_out
 * loses the inner edge, and for a near-vertical arc 8 px wide the band spans y 210..218 at
 * 90 degrees, so an r_out-only box would clip 6 of its 8 pixels.
 *
 * Cases that are genuinely the whole square keep it: a full ring has no endpoints or tangent
 * to bound, and a fan (r_in <= 0) reaches the centre. A round cap bulges up to `cap` past an
 * endpoint, which is why that much slack is added before intersecting with the square.
 */
static void bp_span_bbox(const bp_span_t *sp, int *out_x0, int *out_y0, int *out_x1, int *out_y1)
{
    const double reach = sp->r_out + sp->cap;
    double x0 = sp->cx - reach;
    double x1 = sp->cx + reach;
    double y0 = sp->cy - reach;
    double y1 = sp->cy + reach;

    if (sp->abs_span < 360.0 && sp->r_in > 0.0) {
        const double lo = sp->a0deg;
        const double hi = lo + sp->sgn * sp->abs_span;
        double bx0 = 1e30, bx1 = -1e30, by0 = 1e30, by1 = -1e30;

        /* The two endpoints, at the inner and the outer radius. */
        for (int i = 0; i < 2; i++) {
            const double ang = (i == 0) ? lo : hi;
            bp_bbox_point(sp, ang, sp->r_in, &bx0, &bx1, &by0, &by1);
            bp_bbox_point(sp, ang, sp->r_out, &bx0, &bx1, &by0, &by1);
        }
        /* Every axis the sweep passes, again at both radii. */
        for (int k = 0; k < 4; k++) {
            const double axis = 90.0 * (double)k; /* 0, 90, 180, 270 */
            if (!bp_deg_in_sweep(axis, lo, sp->sgn, sp->abs_span)) continue;
            bp_bbox_point(sp, axis, sp->r_in, &bx0, &bx1, &by0, &by1);
            bp_bbox_point(sp, axis, sp->r_out, &bx0, &bx1, &by0, &by1);
        }

        /* Intersect the sector's extent with the square. `pad` covers the round cap's bulge
         * and the half-pixel sampling the coverage test does. */
        const double pad = sp->cap + 1.0;
        if (bx0 - pad > x0) x0 = bx0 - pad;
        if (by0 - pad > y0) y0 = by0 - pad;
        if (bx1 + pad < x1) x1 = bx1 + pad;
        if (by1 + pad < y1) y1 = by1 + pad;
    }

    int ix0 = (int)floor(x0);
    int ix1 = (int)ceil(x1);
    int iy0 = (int)floor(y0);
    int iy1 = (int)ceil(y1);
    if (ix0 < 0) ix0 = 0;
    if (iy0 < 0) iy0 = 0;
    if (ix1 > BADGE_SCR_W - 1) ix1 = BADGE_SCR_W - 1;
    if (iy1 > BADGE_SCR_H - 1) iy1 = BADGE_SCR_H - 1;
    *out_x0 = ix0;
    *out_y0 = iy0;
    *out_x1 = ix1;
    *out_y1 = iy1;
}

/*
 * The cheap rejection test: can this pixel be inside the swept band at all?
 *
 * INTEGER, DELIBERATELY, AND THAT IS THE WHOLE POINT OF IT.
 *
 * This exists because the expensive part of bp_span_paint() was running for EVERY pixel of
 * the scan box. The loop body uses `double`, and the ESP32-S3 has a single-precision FPU
 * only -- so every double add/multiply/compare and every sqrt() is a softfloat library
 * call, hundreds of cycles each. Measured on the board, a full repaint of the dial did only
 * 352,825 loop iterations and 60,869 blends, yet took 5,164,528 us: 3,512 cycles per
 * iteration. That is softfloat, not arithmetic.
 *
 * Two float attempts and what they actually bought, measured on the same board:
 *
 *   double reject, sqrt still per pixel        5,164,528 us
 *   float  reject, sqrt only for survivors     3,868,192 us
 *   float  reject, hoisted constants           2,810,472 us
 *
 * Still ~1,900 cycles per rejected pixel, which says the single-precision path is not
 * buying what the FPU should. So the reject is done in plain int32 now: a couple of
 * multiplies, an add and two compares, none of which this chip can emulate.
 *
 * Coordinates are kept doubled (units of half a pixel, so the +0.5 centre offset is exact
 * and still integral): a pixel at column px has centre (2*px + 1), and the span's centre is
 * rounded to the same grid. Squared distances are then in quarter-pixel units and fit
 * int32 with room to spare (worst case ~1.8e6).
 *
 * Most pixels cannot possibly be painted: an 8 px band at radius ~200 covers roughly 10,000
 * of the box's 352,825. Only those few percent reach the exact double maths below, which
 * still runs in double so the coverage and alpha decisions are unchanged to the last bit.
 *
 * The bounds are the same condition the loop uses -- cov = half_w + 0.5 - dist > 0, i.e.
 * dist < half_w + 0.5 -- evaluated for each of the three shapes dist can take:
 *
 *   r_in > 0, in the angular window:  dist = |d - r_mid| -> r_in - 0.5 < d < r_out + 0.5
 *   r_in <= 0 (a fan out of the centre): dist = d     -> d < half_w + 0.5
 *   outside the window with a round cap: dist = distance to the nearest endpoint < half_w + 0.5
 *
 * A pixel is kept when it could satisfy ANY of those. Every bound is ROUNDED OUTWARD
 * (BP_REJECT_SLACK half-pixels) so the integer test is never tighter than the double test
 * it guards: a false accept costs one exact evaluation, while a false reject would drop a
 * pixel the painter is meant to draw. The pixel tests assert exact colours at exact
 * coordinates, so a mistaken reject shows up there rather than on the glass.
 */
#define BP_REJECT_SLACK 2 /* in half-pixel units, i.e. one pixel */

/* Round a double to the doubled-pixel grid. */
static int bp_round2(double v)
{
    return (int)(v * 2.0 + (v < 0.0 ? -0.5 : 0.5));
}

static bool bp_span_paint(lv_obj_t *canvas, const bp_span_t *sp, lv_color_t color, int alpha)
{
    if (alpha <= 0) return false;

    int x0, y0, x1, y1;
    bp_span_bbox(sp, &x0, &y0, &x1, &y1);
    if (x1 < x0 || y1 < y0) return false;
    const double half_w = (sp->r_out - sp->r_in) * 0.5;
    bool drew = false;

    /* Per-span integer constants, hoisted so the inner loop is pure int32. */
    const bool fan = (sp->r_in <= 0.0);
    const int cx2 = bp_round2(sp->cx), cy2 = bp_round2(sp->cy);
    const bool has_cap = (sp->cap > 0.0);
    const int cap2_r = bp_round2(half_w + 0.5) + BP_REJECT_SLACK;
    const int cap2 = cap2_r * cap2_r;
    /* Radial acceptance band, in doubled units, rounded outward. */
    int lo2 = 0, hi2 = 0;
    if (fan) {
        const int hi = bp_round2(half_w + 0.5) + BP_REJECT_SLACK;
        hi2 = hi * hi;
    } else {
        const int lo = bp_round2(sp->r_in - 0.5) - BP_REJECT_SLACK;
        const int hi = bp_round2(sp->r_out + 0.5) + BP_REJECT_SLACK;
        lo2 = lo > 0 ? lo * lo : 0;
        hi2 = hi * hi;
    }
    const int ax0 = cx2 - bp_round2(sp->sx), ay0 = cy2 - bp_round2(sp->sy);
    const int bx0 = cx2 - bp_round2(sp->tx), by0 = cy2 - bp_round2(sp->ty);
    const double span_deg = sp->abs_span;

    /*
     * FAST PATH: a FULL ring (360 degrees, no round cap, no fade).
     *
     * Instrumenting span-by-span on the board found that the worst single span of a dial
     * repaint was exactly this shape -- rin=209 rout=227 deg=360 -- at 569,908 us for
     * 207,025 loop iterations. That is the 455x455 bounding square walked one pixel at a
     * time to light an annulus of ~18,600 pixels: 11 iterations per painted pixel.
     *
     * bp_stroke() sends a 360 degree stroke straight here without the one-degree splitting
     * it applies to arcs, so this shape is the single most expensive span on any screen
     * with a day ring, and it is drawn several times per repaint (the owner track, the
     * owner band, the inner band, the heart ring).
     *
     * Scope of the win, stated honestly: this fast path removes that 570 ms span and took
     * the ring from 207,025 candidate pixels to 13,013 (16x), but it does NOT make the
     * repaint fast. A full repaint still measured ~2.5 s afterwards, because the remaining
     * cost is per-candidate shading in the arc spans (see the note in bp_stroke about
     * splitting into one-degree pieces) and that has not been addressed. The screen-change
     * slide is still swallowed by the repaint; see docs/frame-budget.md.
     *
     * A full ring with no caps has no angular extent to test and no endpoints, so every
     * pixel in its own scan box is decided by the radial distance alone. Solving
     * (x - cx)^2 + (y - cy)^2 = R^2 for x gives the exact horizontal extent of the annulus
     * on each scanline, so only pixels that can be painted are ever touched, and rows
     * outside the annulus are skipped with one comparison.
     *
     * The distance test is exact integer arithmetic in doubled pixel units, matching the
     * slow path: the squared distance is an integer, so comparing it against the squared
     * radius at the same +0.5 pixel centre is exact in both directions.
     *
     * THE EDGE IS DELIBERATELY PIXEL-IDENTICAL TO THE OLD LOOP. That loop tested
     * `dist = fabs(d - r_mid) < half_w + 0.5`, i.e. r_in - 0.5 <= d <= r_out + 0.5, and then
     * clamped cov = half_w + 0.5 - dist to 1.0 -- so every painted pixel got alpha 255 when
     * the stroke is opaque. Both conditions below are that same inequality in integer form,
     * with the 256/255 rational rounding resolved to a plain comparison, so this changes
     * speed and nothing else. The host pixel tests (868 paint checks, 2932 frame checks)
     * assert exact colours at exact coordinates and pass unchanged.
     */
    const bool full_ring = (span_deg >= 360.0 && sp->cap <= 0.0 && sp->sin_ramp0 <= 0.0 &&
                            sp->sin_ramp1 <= 0.0 && !fan);
    if (full_ring) {
        /*
         * The radial band the old loop accepted, in doubled units, resolved to integers:
         *   dist = |d - r_mid| < half_w + 0.5   <=>   r_in - 0.5 <= d <= r_out + 0.5
         * Every painted pixel then had cov clamped to 1.0, so for an opaque stroke the
         * alpha it passed to bp_blend() was 255 -- bp_mul_alpha(255, alpha) == alpha.
         */
        const int ri2 = bp_round2(sp->r_in - 0.5);
        const int ro2 = bp_round2(sp->r_out + 0.5);
        const long long lo_sq = (long long)ri2 * ri2;
        const long long hi_sq = (long long)ro2 * ro2;
        /* The parity the pixel grid forces on dx2 = 2*px + 1 - cx2. */
        const int par = ((1 - cx2) % 2 + 2) % 2;

        for (int py = y0; py <= y1; py++) {
            const int dyq = 2 * py + 1 - cy2;
            const long long dy_sq = (long long)dyq * dyq;
            long long A = hi_sq - dy_sq;
            if (A < 0) continue;

            /* |dx2| <= sqrt(A), with the integer square root corrected exactly so a
             * floating rounding error can never drop the last pixel of a row. */
            int dxmax = (int)sqrt((double)A);
            while ((long long)(dxmax + 1) * (dxmax + 1) <= A) dxmax++;
            while (dxmax > 0 && (long long)dxmax * dxmax > A) dxmax--;

            int dxmin = 0;
            const long long B = lo_sq - dy_sq;
            if (B > 0) {
                /* |dx2| >= sqrt(B): the hole the inner radius cuts out of this row. */
                dxmin = (int)sqrt((double)B);
                while ((long long)dxmin * dxmin < B) dxmin++;
                while (dxmin > 0 && (long long)(dxmin - 1) * (dxmin - 1) >= B) dxmin--;
            }

            /* Walk the accepted |dx2| on the pixel grid, both sides of the centre. */
            int first = dxmin;
            if (((first % 2) + 2) % 2 != par) first++;
            for (int dxq = first; dxq <= dxmax; dxq += 2) {
                const int pxA = (cx2 + dxq - 1) / 2;
                if (pxA >= x0 && pxA <= x1 && bp_inside_disc(pxA, py)) {
                    bp_blend(canvas, pxA, py, color, alpha);
                    drew = true;
                }
                if (dxq != 0) {
                    const int pxB = (cx2 - dxq - 1) / 2;
                    if (pxB >= x0 && pxB <= x1 && bp_inside_disc(pxB, py)) {
                        bp_blend(canvas, pxB, py, color, alpha);
                        drew = true;
                    }
                }
            }
        }
        return drew;
    }

    for (int py = y0; py <= y1; py++) {
        const int dy2 = 2 * py + 1 - cy2;
        const int dy2sq = dy2 * dy2;
        const double pyf = (double)py + 0.5;
        const double dy = pyf - sp->cy;
        for (int px = x0; px <= x1; px++) {
            const int dx2 = 2 * px + 1 - cx2;
            const int d2i = dx2 * dx2 + dy2sq;

            /* Keep the pixel if it could be inside the annulus, or inside a round cap. */
            bool keep = fan ? (d2i <= hi2) : (d2i >= lo2 && d2i <= hi2);
            if (!keep && has_cap) {
                const int ax = dx2 + ax0, ay = dy2 + ay0;
                const int bx = dx2 + bx0, by = dy2 + by0;
                const int as = ax * ax + ay * ay;
                const int bs = bx * bx + by * by;
                keep = (as < bs ? as : bs) <= cap2;
            }
            if (!keep) continue;

            const double pxf = (double)px + 0.5;
            const double dx = pxf - sp->cx;
            const double d2 = dx * dx + dy * dy;
            const double d = sqrt(d2);

            double s = 0.0;
            const bool in_window = (d2 <= 1e-12) || bp_span_in_window(sp, dx, dy, 1.0 / d, &s);

            /* Distance to the centreline arc: radial distance inside the angular
             * window, distance to the nearest endpoint outside it. The second case
             * is what rounds a round cap. */
            double dist;
            bool in_cap = false;
            if (d2 <= 1e-12) {
                dist = sp->r_in > 0.0 ? sp->r_mid : 0.0;
            } else if (in_window) {
                dist = sp->r_in > 0.0 ? fabs(d - sp->r_mid) : d;
            } else {
                dist = 1e30;
            }
            if (sp->cap > 0.0) {
                const double ax = pxf - sp->sx;
                const double ay = pyf - sp->sy;
                const double bx = pxf - sp->tx;
                const double by = pyf - sp->ty;
                const double ds = sqrt(ax * ax + ay * ay);
                const double de = sqrt(bx * bx + by * by);
                const double near = ds < de ? ds : de;
                if (near < dist) dist = near;
                /* Inside the cap's own half disc there is no angular window at all: a
                 * cap spreads backwards past a0 (or past a1), which is what makes it a
                 * cap. Without this flag the soft-end ramp below multiplies the whole
                 * cap by sin(0) = 0 and the round end vanishes. */
                if (near <= half_w) {
                    dist = near;
                    in_cap = true;
                }
            }

            double cov = half_w + 0.5 - dist;
            if (cov <= 0.0) continue;
            if (cov > 1.0) cov = 1.0;

            /* The optional soft ends: alpha ramps from 0 at a0/a1 up to 1 a fraction
             * of a degree inside, which is what the composites fade with. */
            double f = 1.0;
            if (!in_cap && sp->sin_ramp0 > 0.0) {
                const double t = s / sp->sin_ramp0;
                if (t < f) f = t;
            }
            if (!in_cap && sp->sin_ramp1 > 0.0 && d2 > 1e-12) {
                /* -sin(theta - a1): positive inside the end ramp and 0 at a1. */
                const double se = (sp->ey * dx - sp->ex * dy) * (1.0 / d) * sp->sgn;
                const double t = se / sp->sin_ramp1;
                if (t < f) f = t;
            }
            if (f <= 0.0) continue;
            if (f > 1.0) f = 1.0;

            const int a = bp_mul_alpha(bp_mul_alpha((int)(cov * 255.0 + 0.5), alpha), (int)(f * 255.0 + 0.5));
            bp_blend(canvas, px, py, color, a);
            drew = true;
        }
    }
    return drew;
}

/*
 * One swept stroke from a0 to a1 degrees in one colour.
 *
 * soft0/soft1 are fade-in/fade-out lengths in degrees (0 = hard end). Without a fade
 * the stroke is walked in steps of at most one degree, which keeps each pixel's
 * angular window small and sidesteps the wrap-around a 300-degree window would have
 * to reason about. `end_exclusive` leaves the pixel exactly at a1 to the neighbouring
 * piece, so abutting pieces drawn at alpha < 1 do not double-blend into a bright seam.
 */
static bool bp_stroke(lv_obj_t *canvas, double cx, double cy, double r, double w, double a0, double a1,
                      lv_color_t color, int alpha, bool rounded, double soft0, double soft1,
                      bool end_exclusive)
{
    if (w <= 0.0 || alpha <= 0 || r <= 0.0) return false;
    double span = a1 - a0;
    if (span == 0.0) return false;
    if (span > 360.0) span = 360.0;
    if (span < -360.0) span = -360.0;

    const double cap = rounded ? w * 0.5 : 0.0;
    const double dir = span < 0.0 ? -1.0 : 1.0;

    if (soft0 > 0.0 || soft1 > 0.0 || fabs(span) >= 360.0) {
        bp_span_t sp;
        bp_span_init(&sp, cx, cy, r, w, a0, a1, cap, soft0, soft1, end_exclusive);
        return bp_span_paint(canvas, &sp, color, alpha);
    }

    bool drew = false;
    const int steps = (int)ceil(fabs(span));
    double cur = a0;
    for (int i = 0; i < steps; i++) {
        double nxt = cur + dir;
        if ((dir > 0.0 && nxt > a1) || (dir < 0.0 && nxt < a1)) nxt = a1;
        const bool last = (i == steps - 1);
        bp_span_t sp;
        bp_span_init(&sp, cx, cy, r, w, cur, nxt, cap, 0.0, 0.0, end_exclusive || !last);
        if (bp_span_paint(canvas, &sp, color, alpha)) drew = true;
        cur = nxt;
    }
    return drew;
}

/* ------------------------------------------------------------- public API ----*/

void badge_paint_clear(lv_obj_t *canvas)
{
    if (!canvas) return;
#ifndef BADGE_PAINT_HOST
    if (bp_set == bp_default_set) {
        lv_draw_buf_t *db = lv_canvas_get_draw_buf(canvas);
        if (db) {
            for (int y = 0; y < BADGE_SCR_H; ++y) {
                void *row = lv_draw_buf_goto_xy(db, 0, (uint32_t)y);
                if (row) memset(row, 0, BADGE_SCR_W * sizeof(lv_color32_t));
            }
        }
        return;
    }
#endif
    const lv_color_t black = {0, 0, 0};
    for (int y = 0; y < BADGE_SCR_H; y++) {
        for (int x = 0; x < BADGE_SCR_W; x++) {
            bp_set(canvas, x, y, black, LV_OPA_TRANSP);
        }
    }
}

bool badge_paint_arc(lv_obj_t *canvas, int cx, int cy, int r, int w, float a0, float a1, lv_color_t color,
                     bool rounded)
{
    if (!canvas) return false;
    if (w <= 0) w = 1;
    if (r <= 0) return false;
    /* A rounded cap is a half disc of w/2 at each end; fading the last degree into
     * it stops the round end from ending in a visible step. */
    const double soft = rounded ? 1.0 : 0.0;
    return bp_stroke(canvas, (double)cx, (double)cy, (double)r, (double)w, (double)a0, (double)a1, color, 255,
                     rounded, soft, soft, false);
}

bool badge_paint_disc(lv_obj_t *canvas, int cx, int cy, int r, lv_color_t color)
{
    if (!canvas) return false;
    return bp_disc_paint(canvas, (double)cx, (double)cy, (double)r, color, 255);
}

bool badge_paint_ring(lv_obj_t *canvas, int cx, int cy, int r, int w, lv_color_t color)
{
    if (!canvas) return false;
    if (w <= 0) w = 1;
    if (r <= 0) return false;
    return bp_stroke(canvas, (double)cx, (double)cy, (double)r, (double)w, 0.0, 360.0, color, 255, false, 0.0,
                     0.0, false);
}

bool badge_paint_rrect(lv_obj_t *canvas, int x, int y, int w, int h, int radius, lv_color_t color)
{
    if (!canvas) return false;
    return bp_rrect_paint(canvas, x, y, w, h, radius, color);
}

void badge_paint_haptic_edge(lv_obj_t *canvas, int ring_r, int ring_w, lv_color_t color)
{
    if (!canvas) return;
    /* Spec 12.2 hapticFallback. The reference strokes a full circle and multiplies
     * the whole drawing by sin(pi * progress); the UI applies that by fading the
     * colour towards the black background. Only the ring's own pixels light up. */
    if (ring_w <= 0) ring_w = BADGE_HAPTIC_RING_W;
    if (ring_r <= 0) ring_r = BADGE_HAPTIC_RING_R;
    (void)bp_stroke(canvas, (double)BADGE_CX, (double)BADGE_CY, (double)ring_r, (double)ring_w, 0.0, 360.0,
                    color, 255, false, 0.0, 0.0, false);
}

/*
 * The 22x12 battery pill, badge_spec.json's own outline of it:
 *
 *     ctx.strokeStyle = C.sub; ctx.lineWidth = 2; ctx.strokeRect(x0 + 1, y0 + 1, w - 4, h - 3);
 *     ctx.fillStyle = C.sub;   ctx.fillRect(x0 + w - 3, y0 + 4, 3, h - 8);   // the nub
 *     ctx.fillStyle = fg;      ctx.fillRect(x0 + 3, y0 + 3, (w - 8) * pct / 100, h - 6);
 *
 * strokeRect is centred on the path, so its 2px stroke covers [x0, x0 + 2) and
 * [x0 + w - 3, x0 + w - 1): the four corner pixels are NOT part of the frame -- the
 * corners are open, which is what a strokeRect looks like. The nub overlaps the
 * frame's right edge, so the drawing is 4px wider than the pill.
 *
 * (x, y) is the element centre (badge_spec.h: only BE_BAR and BE_TOGGLE differ).
 * The fill's width is (w - 8) * pct / 100 in floating point, so each pixel's
 * coverage is partial at a fractional edge; writing it as an integer product would
 * put the 50% edge at 7px instead of 7.7px and every percentage probe would be off.
 */
void badge_paint_battery(lv_obj_t *canvas, int x, int y, int w, int h, int pct, bool charging, lv_color_t fg)
{
    if (!canvas || w <= 8 || h <= 6) return;
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;

    const int x0 = x - w / 2;
    const int y0 = y - h / 2;
    const lv_color_t frame = bp_col(BADGE_COLOR_SUB);

    /* Two pixels thick on all four sides, so the outline is closed and the pill's
     * outer box is exactly w x h at (x0, y0). A frame that stops a pixel short of a
     * corner reads as a broken pill on the glass. */
    bp_rrect_paint(canvas, x0, y0, w, 2, 0, frame);              /* top, full width     */
    bp_rrect_paint(canvas, x0, y0 + h - 2, w, 2, 0, frame);      /* bottom, full width  */
    bp_rrect_paint(canvas, x0, y0 + 2, 2, h - 4, 0, frame);      /* left, between them  */
    bp_rrect_paint(canvas, x0 + w - 2, y0 + 2, 2, h - 4, 0, frame);

    /* The nub: over the middle of the right edge, thickening it locally to 3px. It
     * pokes inwards, into the gutter, so the pill never grows past its own w. */
    bp_rrect_paint(canvas, x0 + w - 3, y0 + 4, 3, h - 8, 0, frame);

    const int inner_w = w - 8;
    const int inner_h = h - 6;
    if (inner_w > 0 && inner_h > 0) {
        double fill_w = (double)inner_w * (double)pct / 100.0;
        if (fill_w < 1.0) fill_w = 1.0; /* the reference keeps a 1px sliver at 0% */
        if (fill_w > (double)inner_w) fill_w = (double)inner_w;
        bp_rrect_paint_soft(canvas, x0 + 3, y0 + 3, (double)inner_w, fill_w, inner_h, fg);
    }
    if (charging) {
        /* ST.usb -> icon('bolt', el.x - 1, el.y + 2, .75). The bolt is carried by the
         * package itself: icons/bolt.png in the development package and
         * badge_ui_spec.h:720's BADGE_ICON_BOLT[256] both name it, which is why
         * BADGE_ICON_BOLT exists at index 13 here even though no badge_spec.json
         * element names it. 0.75 is 3/4, and integer scale 1 is the smallest this
         * painter offers; the one-pixel inset matches the reference's -1/+2. */
        (void)badge_paint_icon(canvas, BADGE_ICON_BOLT, x - 1, y + 2, 1);
    }
}

void badge_paint_bar(lv_obj_t *canvas, int x, int y, int w, int h, int pct, lv_color_t color, lv_color_t track)
{
    if (!canvas || w <= 0 || h <= 0) return;
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    /* drawEl() 'bar', line 1493: rrect(x, y, w, h, h/2) for the track, then
     * rrect(x, y, max(h, w * v / 100), h, h/2) for the value. */
    const int radius = h / 2;
    bp_rrect_paint(canvas, x, y, w, h, radius, track);
    int fill_w = w * pct / 100;
    if (fill_w < h) fill_w = h;
    if (fill_w > w) fill_w = w;
    bp_rrect_paint(canvas, x, y, fill_w, h, radius, color);
}

void badge_paint_segs(lv_obj_t *canvas, int cx, int cy, int r, int w, int a0, int a1, int n, int gap, int done,
                      lv_color_t on, lv_color_t off)
{
    if (!canvas || n <= 0 || w <= 0) return;
    /* drawEl() 'segs', line 1496:
     *   sp = (a1 - a0 - gap * (n - 1)) / n
     *   for i in 0..n-1: colour = i < ST.step ? accent : line
     *                    arc from a0 + i * (sp + gap), sp degrees
     * The segments run from a0 towards a1, so the lit ones start at a0. */
    const double total = (double)a1 - (double)a0;
    const double span = (total - (double)gap * (double)(n - 1)) / (double)n;
    if (span <= 0.0) return;
    for (int i = 0; i < n; i++) {
        const double s = (double)a0 + (double)i * (span + (double)gap);
        const lv_color_t c = i < done ? on : off;
        /* end_exclusive: neighbouring segments must not double-blend in the gap. */
        (void)bp_stroke(canvas, (double)cx, (double)cy, (double)r, (double)w, s, s + span, c, 255, false, 0.0,
                        0.0, true);
    }
}

/* The cat's kind for one of the owner's stretches: CATK, line 1481. */
static uint8_t bp_cat_kind(uint8_t owner_kind)
{
    switch (owner_kind) {
    case BADGE_DAY_SLEEP: return BADGE_DAY_SLEEP;
    case BADGE_DAY_HOME: return BADGE_DAY_HOME;
    case BADGE_DAY_COMMUTE: return BADGE_DAY_HOME;
    case BADGE_DAY_WORK: return BADGE_DAY_OUT;
    case BADGE_DAY_OUT: return BADGE_DAY_OUT;
    default: return BADGE_DAY_HOME;
    }
}

/* Minutes since midnight -> degrees: A(m) = m / 1440 * 360 - 90 (line 1505), so
 * midnight is the top of the dial and the day runs clockwise from there. */
static double bp_ring_angle(int minute)
{
    return (double)minute / 1440.0 * 360.0 - 90.0;
}

/* Two concentric circular strokes of the same width, the outer at radius `ro` and
 * the inner at `ri`, covering the annular region between ri - width/2 and
 * ro + width/2.
 *
 * The 24-hour ring is specified as "outer band radius r, width w" and "inner band
 * radius r2, width w2" -- but the reference's own geometry is two circles. At the
 * specification's own numbers, r = 218, w = 18, r2 = 200, w2 = 6:
 *
 *     two circles      outer 209.0 .. 227.0, inner 197.0 .. 203.0, track 211.5 .. 221.5
 *     annulus(r, w)    outer 209.0 .. 227.0                              (identical)
 *     annulus(r2, w2)  inner 197.0 .. 203.0                              (identical)
 *
 * The two readings agree about the outer band and about the *extent* of the inner
 * band; they disagree only about where the track shows through between them, and the
 * reference -- which has no track under the inner band at all, and draws the inner
 * band as a second circle -- is the one the eye is calibrated against. Drawing the
 * inner band as a circle also reproduces its extent for ANY w/w2, where an annulus
 * would narrow to a line as w2 shrank. */
static void bp_band_stroke(lv_obj_t *canvas, double cx, double cy, double ro, double ri, double w, double a0,
                           double a1, lv_color_t color, int alpha, bool end_exclusive)
{
    (void)bp_stroke(canvas, cx, cy, ro, w, a0, a1, color, alpha, false, 0.0, 0.0, end_exclusive);
    if (ri > 0.0 && ri != ro) {
        (void)bp_stroke(canvas, cx, cy, ri, w, a0, a1, color, alpha, false, 0.0, 0.0, end_exclusive);
    }
}

void badge_paint_dayring(lv_obj_t *canvas, int cx, int cy, int r, int w, int r2, int w2, int now_min,
                         const badge_day_seg_t *owner, int owner_n, const badge_day_seg_t *cat, int cat_n,
                         const int *hearts, int hearts_n)
{
    if (!canvas || w <= 0 || r <= 0) return;
    if (now_min < 0) now_min = 0;
    if (now_min > 1440) now_min = 1440;
    if (owner_n < 0) owner_n = 0;
    if (cat_n < 0) cat_n = 0;

    /* 1. The full track under the owner's band. */
    (void)bp_stroke(canvas, (double)cx, (double)cy, (double)r, (double)w, 0.0, 360.0,
                    bp_col(BADGE_COLOR_RINGTRACK), 255, false, 0.0, 0.0, false);

    /* 2. The owner's day outside, the cat's day inside. A stretch that has already
     *    happened is opaque; the rest is the same colour at 30% (globalAlpha .3).
     *    Pieces abut, so `end_exclusive` keeps the joins from double-blending. */
    const bool explicit_cat = (cat != NULL && cat_n > 0);
    const int src_n = explicit_cat ? cat_n : owner_n;
    for (int i = 0; i < src_n; i++) {
        badge_day_seg_t seg;
        if (explicit_cat) {
            seg = cat[i];
        } else if (owner) {
            seg = owner[i];
        } else {
            break;
        }
        if (seg.b <= seg.a) continue;
        const uint8_t okind = seg.kind < BADGE_DAY_KIND_COUNT ? seg.kind : BADGE_DAY_SLEEP;
        const uint8_t ckind =
            explicit_cat ? (seg.kind < BADGE_DAY_KIND_COUNT ? seg.kind : BADGE_DAY_SLEEP) : bp_cat_kind(okind);
        const lv_color_t out_col = bp_col((uint8_t)(BADGE_COLOR_RINGSLEEP + okind));
        const lv_color_t in_col = bp_col((uint8_t)(BADGE_COLOR_RINGSLEEP + ckind));
        const bool two_bands = (w2 > 0 && r2 > 0);
        /* 0.3 * 255, the reference's globalAlpha .3. Over the opaque track an
         * alpha-77 source composites to alpha 255 and a 30/70 colour mix -- which
         * is exactly what canvas2d produces for the same drawing. */
        const int dim = 77;

        if (seg.a < now_min) {
            const int hi = seg.b < now_min ? seg.b : now_min;
            const double d0 = bp_ring_angle(seg.a);
            const double d1 = bp_ring_angle(hi);
            bp_band_stroke(canvas, (double)cx, (double)cy, (double)r, 0.0, (double)w, d0, d1, out_col, 255,
                           true);
            if (two_bands) {
                bp_band_stroke(canvas, (double)cx, (double)cy, (double)r2, 0.0, (double)w2, d0, d1, in_col,
                               255, true);
            }
        }
        if (seg.b > now_min) {
            const int lo = seg.a > now_min ? seg.a : now_min;
            const double d0 = bp_ring_angle(lo);
            const double d1 = bp_ring_angle(seg.b);
            bp_band_stroke(canvas, (double)cx, (double)cy, (double)r, 0.0, (double)w, d0, d1, out_col, dim,
                           true);
            if (two_bands) {
                bp_band_stroke(canvas, (double)cx, (double)cy, (double)r2, 0.0, (double)w2, d0, d1, in_col, dim,
                               true);
            }
        }
    }

    /* 3. The 4x4 hour marks at radius 188 (line 1508). */
    const lv_color_t tick = bp_col(BADGE_COLOR_TEXT);
    for (int hh = 0; hh < 24; hh += 6) {
        const double rad = bp_ring_angle(hh * 60) * BP_D2R;
        const int mx = cx + (int)floor(cos(rad) * 188.0 + 0.5) - 2;
        const int my = cy + (int)floor(sin(rad) * 188.0 + 0.5) - 2;
        bp_rrect_paint(canvas, mx, my, 4, 4, 0, tick);
    }

    /* 4. A heart for every heart minute that has already passed, on the outer
     *    band's midline (line 1509). */
    for (int i = 0; hearts && i < hearts_n; i++) {
        const int m = hearts[i];
        if (m > now_min) continue;
        const double rad = bp_ring_angle(m) * BP_D2R;
        const int hx = cx + (int)floor(cos(rad) * (double)r + 0.5);
        const int hy = cy + (int)floor(sin(rad) * (double)r + 0.5);
        (void)badge_paint_icon(canvas, BADGE_ICON_HEART, hx, hy, 1);
    }

    /* 5. The white dot at `now`, radius 8, on the outer band (line 1510). */
    {
        const double rad = bp_ring_angle(now_min) * BP_D2R;
        const int nx = cx + (int)floor(cos(rad) * (double)r + 0.5);
        const int ny = cy + (int)floor(sin(rad) * (double)r + 0.5);
        (void)bp_disc_paint(canvas, (double)nx, (double)ny, 8.0, badge_rgb(0xFFFFFFu), 255);
    }
}

/* ------------------------------------------------------------------- icons ---*/

/* The integer scale the spec asks for ("按整数倍最近邻放大"). scale_x2 carries
 * scale * 2, so 1.5 and 2.5 land on the nearest integer and never on zero. */
static int bp_icon_scale(const badge_el_t *el)
{
    int s = ((int)el->scale_x2 + 1) / 2;
    if (s < 1) s = 1;
    return s;
}

static int bp_icon_side(const badge_el_t *el)
{
    return BADGE_ICON_PX * bp_icon_scale(el);
}

static bool bp_blit_icon_side(lv_obj_t *canvas, int icon, int cx, int cy, int side)
{
    if (!canvas || side < 1 || icon == BADGE_ICON_NONE) return false;
    const uint8_t *src = badge_icon_rgba(icon);
    if (!src) return false;

    /* The reference: const s = 16 * scale; drawImage(c, round(x - s/2),
     * round(y - s/2), s, s) with imageSmoothingEnabled = false. Integer nearest
     * neighbour, one source texel per scale-by-scale block. */
    /* Side is rounded once, including non-integer pressed scaling. */
    /* round(x - s / 2), as the reference blits it; truncation would shift every
     * odd-centre icon half a pixel left. */
    const int x0 = (int)floor((double)cx - (double)side / 2.0 + 0.5);
    const int y0 = (int)floor((double)cy - (double)side / 2.0 + 0.5);
    bool drew = false;

    for (int oy = 0; oy < side; oy++) {
        const int sy = oy * BADGE_ICON_PX / side;
        for (int ox = 0; ox < side; ox++) {
            const int sx = ox * BADGE_ICON_PX / side;
            const uint8_t *p = src + ((size_t)sy * BADGE_ICON_PX + (size_t)sx) * 4u;
            if (p[3] == 0) continue;
            const int px = x0 + ox;
            const int py = y0 + oy;
            if (!bp_inside_disc(px, py)) continue;
            /* RGBA8888 straight into the canvas' ARGB8888 pixel: the icon carries
             * its own colour and coverage, and the face canvas is a layer that the
             * UI composites later, so a raw store is the correct operation. */
            bp_set(canvas, px, py, lv_color_make(p[0], p[1], p[2]), (lv_opa_t)p[3]);
            drew = true;
        }
    }
    return drew;
}

bool badge_paint_icon(lv_obj_t *canvas, int icon, int cx, int cy, int scale)
{
    return scale >= 1 && bp_blit_icon_side(canvas, icon, cx, cy, BADGE_ICON_PX * scale);
}

/* --------------------------------------------------------------------- QR ----*/

/* drawQR() (line 1528): a white rounded square with a quiet zone, then a 25x25
 * module map and three finder patterns. The reference builds the map from a
 * deterministic xorshift32 at 48% density; so does this, from the same seed. */
#define BP_QR_N 25

static void bp_qr_matrix(uint8_t *m)
{
    uint32_t x = 0x9e3779b9u;
    for (int i = 0; i < BP_QR_N; i++) {
        for (int j = 0; j < BP_QR_N; j++) {
            x ^= x << 13;
            x ^= x >> 17;
            x ^= x << 5;
            /* (x >>> 0) / 2**32 < 0.48 */
            m[i * BP_QR_N + j] = (x <= 2061584302u) ? 1u : 0u;
        }
    }
    static const int corners[3][2] = {{0, 0}, {0, BP_QR_N - 7}, {BP_QR_N - 7, 0}};
    for (int k = 0; k < 3; k++) {
        const int r0 = corners[k][0];
        const int c0 = corners[k][1];
        for (int i = -1; i <= 7; i++) {
            for (int j = -1; j <= 7; j++) {
                const int yy = r0 + i;
                const int xx = c0 + j;
                if (yy < 0 || xx < 0 || yy >= BP_QR_N || xx >= BP_QR_N) continue;
                const int ai = i - 3 < 0 ? 3 - i : i - 3;
                const int aj = j - 3 < 0 ? 3 - j : j - 3;
                const int e = ai > aj ? ai : aj;
                m[yy * BP_QR_N + xx] = (e == 3 || e <= 1) ? 1u : 0u;
            }
        }
    }
    for (int i = 8; i < BP_QR_N - 8; i++) {
        m[6 * BP_QR_N + i] = (i % 2 == 0) ? 1u : 0u;
        m[i * BP_QR_N + 6] = (i % 2 == 0) ? 1u : 0u;
    }
}

static void bp_qr_paint(lv_obj_t *canvas, int cx, int cy, int w, int h, int quiet)
{
    if (w <= 0 || h <= 0) return;
    const int q = quiet > 0 ? quiet : 6;
    const int x0 = cx - w / 2;
    const int y0 = cy - h / 2;
    bp_rrect_paint(canvas, x0, y0, w, h, 6, badge_rgb(0xFFFFFFu));

    const int inner_w = w - q * 2;
    const int inner_h = h - q * 2;
    if (inner_w <= 0 || inner_h <= 0) return;

    uint8_t m[BP_QR_N * BP_QR_N];
    bp_qr_matrix(m);
    const lv_color_t black = badge_rgb(0x000000u);
    for (int i = 0; i < BP_QR_N; i++) {
        const int my0 = y0 + q + i * inner_h / BP_QR_N;
        const int my1 = y0 + q + (i + 1) * inner_h / BP_QR_N;
        for (int j = 0; j < BP_QR_N; j++) {
            if (!m[i * BP_QR_N + j]) continue;
            const int mx0 = x0 + q + j * inner_w / BP_QR_N;
            const int mx1 = x0 + q + (j + 1) * inner_w / BP_QR_N;
            bp_rrect_paint(canvas, mx0, my0, mx1 - mx0, my1 - my0, 0, black);
        }
    }
}

/* ----------------------------------------------------------------- elements --*/

/*
 * Why a care action is refused right now, or -1 when it is offered.
 *
 * badge_blocks is the specification's refusal table and each row carries its own
 * comparison, so the comparison is what decides:
 *
 *     { 心情 MOOD,   >=,  98 }   too content to be petted again
 *     { 饱腹 FOOD,   >=,  95 }   too full to eat
 *     { 喵币 COINS,  <,    3 }   cannot afford it
 *     { 精力 ENERGY, <,   10 }   too tired to play
 *     { 生病 SICK,   ==,   1 }   ill
 *     { 精力 ENERGY, >=,  95 }   too rested to sleep
 *
 * Reading every row as "stat < value blocks" instead inverts the whole table: 喂食
 * would be refused exactly when the cat is starving and offered when it is stuffed,
 * and 哄睡 (energy >= 95) would be refused at every energy except a full one. The
 * mixed >= / < / == operators are the point -- they are the two-sided thresholds of
 * a pet that can be over-full and over-rested as well as under-fed.
 *
 * 生病 and 喵币 are state badge_paint_state_t does not carry: badge_ui.c owns the sick
 * flag and the coin count, so those two rows are left to it. Treating either as
 * "blocked" here would grey out every care that has a coin price.
 */
static int bp_care_blocking_stat(int care, const badge_paint_state_t *st)
{
    if (care < 0 || care >= BADGE_CARE_COUNT_SPEC) return -1;
    const badge_care_def_t *cd = &badge_care_defs[care];
    for (int i = 0; i < (int)cd->block_count; i++) {
        const int idx = (int)cd->block_first + i;
        if (idx < 0 || idx >= BADGE_BLOCK_COUNT) break;
        const badge_block_t *b = &badge_blocks[idx];
        if (b->stat == BADGE_STAT_COINS || b->stat == BADGE_STAT_SICK) continue;
        if (b->stat >= BADGE_STAT_COUNT) continue;
        const int v = st->stat[b->stat];
        bool hit;
        switch (b->op) {
        case BADGE_OP_GE: hit = v >= (int)b->value; break;
        case BADGE_OP_LT: hit = v < (int)b->value; break;
        case BADGE_OP_EQ: hit = v == (int)b->value; break;
        default: hit = false; break;
        }
        if (hit) return (int)b->stat;
    }
    return -1;
}

static bool bp_care_blocked(int care, const badge_paint_state_t *st)
{
    return bp_care_blocking_stat(care, st) >= 0;
}

static int bp_stat_value(const badge_el_t *el, const badge_paint_state_t *st)
{
    if (el->value < BADGE_VALUE_FOOD || el->value > BADGE_VALUE_HEALTH) return 100;
    return st->stat[el->value - BADGE_VALUE_FOOD];
}

/* The spec's low-stat rule, shared by the status arcs and the status bars: the
 * reference is `const c = st < NUM.lowStat ? C.warn : el.color`. */
static lv_color_t bp_value_color(const badge_el_t *el, const badge_paint_state_t *st, lv_color_t base)
{
    if (el->value >= BADGE_VALUE_FOOD && el->value <= BADGE_VALUE_HEALTH &&
        st->stat[el->value - BADGE_VALUE_FOOD] < (int)badge_numbers.low_stat) {
        return bp_col(BADGE_COLOR_WARN);
    }
    return base;
}

/* One 'Z', from two bars and a stepped diagonal. badge_paint has no font by design
 * (text is an LVGL widget; see badge_ui.h), and a plain box would be a worse lie
 * than a procedural glyph. */
static void bp_zzz_glyph(lv_obj_t *canvas, int x, int y, int size, lv_color_t colour)
{
    const int bar = size / 5 > 0 ? size / 5 : 1;
    bp_rrect_paint(canvas, x, y, size, bar, 0, colour);
    bp_rrect_paint(canvas, x, y + size - bar, size, bar, 0, colour);
    const int steps = size / bar;
    for (int i = 1; i < steps - 1; i++) {
        const int sx = x + size - bar - (i * (size - bar)) / (steps - 1);
        const int sy = y + (i * (size - bar)) / (steps - 1);
        bp_rrect_paint(canvas, sx, sy, bar, bar, 0, colour);
    }
}

void badge_paint_el(lv_obj_t *canvas, const badge_el_t *el, const badge_paint_state_t *st)
{
    if (!canvas || !el || !st) return;

    switch (el->type) {
    case BE_HIT:   /* touch only, never drawn */
    case BE_LABEL: /* text is an LVGL widget on layer 2 (badge_ui.h) */
        return;
    default:
        break;
    }

    /* Ring elements are always centred on the disc: the reference's arcPath() is
     * hard-wired to (C, C), and the generator stores 0 for their x/y. */
    const int cx = BADGE_CX;
    const int cy = BADGE_CY;

    switch (el->type) {
    case BE_ICON:
        (void)badge_paint_icon(canvas, el->icon, el->x, el->y, bp_icon_scale(el));
        return;

    case BE_BATTERY: {
        const lv_color_t fg = st->charging ? bp_col(BADGE_COLOR_OK)
                                           : (st->bat_pct < badge_numbers.bat_no_wake ? bp_col(BADGE_COLOR_WARN)
                                                                                     : bp_col(BADGE_COLOR_TEXT));
        badge_paint_battery(canvas, el->x, el->y, el->w, el->h, st->bat_pct, st->charging, fg);
        return;
    }

    case BE_ARC: {
        const int v = bp_stat_value(el, st);
        const int w = el->w > 0 ? el->w : 8;
        const int r = el->r > 0 ? el->r : (BADGE_SAFE_R - w);
        if (el->w == 7 && el->r == 214) {
            const double span = 0.15 * v;
            const double center = ((double)el->a0 + el->a1) * 0.5;
            const lv_color_t colors[] = {
                lv_color_make(0xF0,0xA3,0x5E), lv_color_make(0xF2,0x9A,0xA8),
                lv_color_make(0x8F,0xC7,0xE0), lv_color_make(0xA8,0xD8,0x8E),
                lv_color_make(0xFF,0x6B,0x6B)};
            const lv_color_t gap = lv_color_make(0x37,0x2E,0x26);
            if (span > 0.0) bp_stroke(canvas, cx, cy, r, w, center-span/2,
                center+span/2, colors[el->value >= BADGE_VALUE_FOOD && el->value <= BADGE_VALUE_HEALTH
                            ? el->value - BADGE_VALUE_FOOD : 0],
                255, true, 0.0, 0.0, false);
            const double tick = center - 10.0;
            bp_stroke(canvas, cx, cy, r, w, tick-2.0, tick+2.0, gap,
                      255, true, 0.0, 0.0, false);
            return;
        }
        const double a0 = (double)el->a0;
        const double a1 = (double)el->a1;
        const lv_color_t track = el->track < BADGE_COLOR_COUNT ? bp_col(el->track) : bp_col(BADGE_COLOR_LINE);
        const lv_color_t lit = bp_value_color(el, st, bp_col(el->color));

        (void)bp_stroke(canvas, (double)cx, (double)cy, (double)r, (double)w, a0, a1, track, 255, false, 0.0,
                        0.0, false);
        /* rev (BADGE_ELF_REV): the reference grows the value from a1 backwards. */
        const double span = (a1 - a0) * (double)v / 100.0;
        if (span > 0.0) {
            if (el->flags & BADGE_ELF_REV) {
                (void)bp_stroke(canvas, (double)cx, (double)cy, (double)r, (double)w, a1 - span, a1, lit, 255,
                                false, 0.0, 0.0, false);
            } else {
                (void)bp_stroke(canvas, (double)cx, (double)cy, (double)r, (double)w, a0, a0 + span, lit, 255,
                                false, 0.0, 0.0, false);
            }
        }
        return;
    }

    case BE_ALERT: {
        if (!st->alert_show) return;
        const int r = el->r > 0 ? el->r : BADGE_ALERT_R;
        const lv_color_t bg = el->bg < BADGE_COLOR_COUNT ? bp_col(el->bg) : bp_col(BADGE_ALERT_BG);
        const lv_color_t ring = el->ring < BADGE_COLOR_COUNT ? bp_col(el->ring) : bp_col(BADGE_COLOR_WARN);
        /* drawEl('alert'), line 1502: card disc, a 3px ring at r - 1.5 breathing
         * between 45% and 100%, then the alert's icon at scale 2. */
        (void)bp_disc_paint(canvas, (double)el->x, (double)el->y, (double)r, bg, 255);
        const double pulse = st->alert_bright ? 1.0 : 0.45;
        (void)bp_stroke(canvas, (double)el->x, (double)el->y, (double)r - 1.5, 3.0, 0.0, 360.0,
                        bp_fade(ring, pulse), 255, false, 0.0, 0.0, false);
        const int scale = el->scale_x2 > 1 ? bp_icon_scale(el) : (BADGE_ALERT_ICON_SCALE_X2 / 2);
        (void)badge_paint_icon(canvas, el->icon, el->x, el->y, scale);
        return;
    }

    case BE_DAYRING: {
        const int r = el->r > 0 ? el->r : 218;
        const int w = el->w > 0 ? el->w : 18;
        const int r2 = el->r2 > 0 ? el->r2 : 200;
        const int w2 = el->w2 > 0 ? el->w2 : 6;
        const bool want_hearts = (el->flags & BADGE_ELF_HEARTS) != 0;
        badge_paint_dayring(canvas, cx, cy, r, w, r2, w2, st->now_min, st->day_owner, st->day_owner_n,
                            st->day_cat, st->day_cat_n, want_hearts ? st->hearts : NULL,
                            want_hearts ? st->hearts_n : 0);
        return;
    }

    case BE_BTN: {
        const int r = el->r > 0 ? el->r : 36;
        const bool blocked = bp_care_blocked((int)el->care, st);
        const double dim = blocked ? 0.35 : 1.0;
        const bool pressed = st->pressed_button == el;
        const double zoom = pressed ? 0.94 : 1.0;
        (void)bp_disc_paint(canvas, (double)el->x, (double)el->y, r * zoom,
            bp_fade(bp_col(pressed ? BADGE_COLOR_CARDHI : el->bg), dim), 255);
        if (el->ring < BADGE_COLOR_COUNT) {
            (void)bp_stroke(canvas, (double)el->x, (double)el->y, ((double)r - 1.5) * zoom, 3.0 * zoom, 0.0, 360.0,
                            bp_fade(bp_col(el->ring), dim), 255, false, 0.0, 0.0, false);
        }
        (void)bp_blit_icon_side(canvas, el->icon, el->x, el->y,
            (int)(BADGE_ICON_PX * bp_icon_scale(el) * zoom + 0.5));
        return;
    }

    case BE_SEGS: {
        const int r = el->r > 0 ? el->r : 222;
        const int w = el->w > 0 ? el->w : 8;
        badge_paint_segs(canvas, cx, cy, r, w, el->a0, el->a1, el->n, el->gap, st->step,
                         bp_col(BADGE_COLOR_ACCENT), bp_col(BADGE_COLOR_LINE));
        return;
    }

    case BE_FEATHER: {
        int fx, fy;
        if (st->finger_down) {
            fx = st->finger_x + 16;
            fy = st->finger_y - 16;
        } else {
            /* The reference's idle drift: C + 60*sin(ts*1.2), 330 + 10*sin(ts*2). */
            const double ts = (double)st->now_ms / 1000.0;
            fx = cx + (int)(60.0 * sin(ts * 1.2));
            fy = 330 + (int)(10.0 * sin(ts * 2.0));
        }
        (void)badge_paint_icon(canvas, BADGE_ICON_FEATHER, fx, fy, bp_icon_scale(el));
        return;
    }

    case BE_ZZZ: {
        /* drawEl('zzz'), line 1514: three Zs, each a third of a period behind, sine
         * faded, drifting up and to the right. Kept inside the 56x40 box that
         * bp_el_box() reports. */
        for (int i = 0; i < 3; i++) {
            const double p = (double)st->now_ms / 1000.0 * 0.35 + (double)i / 3.0;
            const double ph = p - floor(p);
            const int alpha = (int)(sin(ph * BP_PI) * 255.0 + 0.5);
            if (alpha <= 0) continue;
            const int size = (i % 2) ? 18 : 16;
            const int gx = el->x - 26 + (int)(ph * 14.0) + i * 6;
            const int gy = el->y - 10 - (int)(ph * 8.0);
            bp_zzz_glyph(canvas, gx, gy, size, bp_fade(bp_col(BADGE_COLOR_SUB), (double)alpha / 255.0));
        }
        return;
    }

    case BE_BAR: {
        const lv_color_t track = el->track < BADGE_COLOR_COUNT ? bp_col(el->track) : bp_col(BADGE_COLOR_LINE);
        badge_paint_bar(canvas, el->x, el->y, el->w, el->h, bp_stat_value(el, st),
                        bp_value_color(el, st, bp_col(el->color)), track);
        return;
    }

    case BE_TOGGLE: {
        /* (x, y) is the right edge and the centre line (badge_spec.h). On/off is a
         * setting, and badge_paint_state_t carries none: this draws the OFF state,
         * and badge_ui.c -- which owns the settings -- repaints the track with
         * badge_paint_rrect() and the knob with badge_paint_disc() when it is on.
         * Both primitives are exported for exactly this reuse. */
        const int w = el->w > 0 ? el->w : 52;
        const int h = el->h > 0 ? el->h : 28;
        const int x0 = el->x - w;
        const int y0 = el->y - h / 2;
        (void)bp_rrect_paint(canvas, x0, y0, w, h, h / 2, bp_col(BADGE_COLOR_LINE));
        (void)bp_disc_paint(canvas, (double)(x0 + h / 2), (double)el->y, (double)(h / 2 - 4),
                            bp_col(BADGE_COLOR_TEXT), 255);
        return;
    }

    case BE_PILL: {
        const int w = el->w > 0 ? el->w : 52;
        const int h = el->h > 0 ? el->h : 52;
        (void)bp_rrect_paint(canvas, el->x - w / 2, el->y - h / 2, w, h, h / 2, bp_col(el->bg));
        if (el->ring < BADGE_COLOR_COUNT) {
            const int rr = (w < h ? w : h) / 2 - 2;
            (void)bp_stroke(canvas, (double)el->x, (double)el->y, (double)rr, 3.0, 0.0, 360.0,
                            bp_col(el->ring), 255, false, 0.0, 0.0, false);
        }
        /* The pill's text is an LVGL label on layer 2. */
        return;
    }

    case BE_WAVE: {
        const int r = el->r > 0 ? el->r : 206;
        const lv_color_t accent = bp_col(BADGE_COLOR_ACCENT);
        /* drawEl('wave'), line 1511: three rings leaving r and fading as they
         * travel, each a third of a period behind the last. wave_phase is the
         * reference's ts in seconds. */
        for (int i = 0; i < 3; i++) {
            double p = st->wave_phase + (double)i / 3.0;
            p = p - floor(p);
            const double k = (1.0 - p) * 0.8;
            (void)bp_stroke(canvas, (double)cx, (double)cy, (double)r + p * 22.0, 3.0, 0.0, 360.0,
                            bp_fade(accent, k), 255, false, 0.0, 0.0, false);
        }
        return;
    }

    case BE_QR:
        bp_qr_paint(canvas, el->x, el->y, el->w > 0 ? el->w : 156, el->h > 0 ? el->h : 156, el->quiet);
        return;

    case BE_HEARTS: {
        /* drawEl('hearts'), line 1515: six hearts rising from y = 380 to y = 120,
         * sine faded, spread across x by sin(i * 2.1) * 120. */
        const double ts = (double)st->now_ms / 1000.0;
        for (int i = 0; i < 6; i++) {
            double p = ts * 0.4 + (double)i / 6.0;
            p = p - floor(p);
            if (sin(p * BP_PI) <= 0.0) continue;
            const int hx = cx + (int)(sin((double)i * 2.1) * 120.0);
            const int hy = 380 - (int)(p * 260.0);
            (void)badge_paint_icon(canvas, BADGE_ICON_HEART, hx, hy, 1);
        }
        return;
    }

    case BE_DOTS: {
        const int n = el->n > 0 ? el->n : 3;
        const int gap = el->gap > 0 ? el->gap : 16;
        const int r = el->r > 0 ? el->r : 4;
        int lit = st->dots_value;
        if (el->flags & BADGE_ELF_ANIM) {
            /* drawEl('dots'): on = ((ts * 2.5 | 0) % n) === i */
            lit = (int)((uint32_t)((double)st->now_ms / 1000.0 * 2.5)) % n;
        }
        for (int i = 0; i < n; i++) {
            const int dx = el->x + (i - (n - 1) / 2) * gap;
            (void)bp_disc_paint(canvas, (double)dx, (double)el->y, (double)r,
                                i == lit ? bp_col(BADGE_COLOR_ACCENT) : bp_col(BADGE_COLOR_LINE), 255);
        }
        return;
    }

    default:
        return;
    }
}

/* ----------------------------------------------------------------- helpers ---*/

static int bp_font_size(const badge_el_t *el)
{
    const int f = el->font;
    if (f < 0 || f >= BADGE_FONT_COUNT) return badge_fonts[BADGE_FONT_F20].size;
    return badge_fonts[f].size;
}

static int bp_font_line(const badge_el_t *el)
{
    const int f = el->font;
    if (f < 0 || f >= BADGE_FONT_COUNT) return badge_fonts[BADGE_FONT_F20].line_h;
    return badge_fonts[f].line_h;
}

/*
 * The element box, as this module needs it.
 *
 * This is NOT badge_geom's badge_el_box(). That one is text-aware and is the
 * authority on whether an element fits on the glass; this one is a cheap box for the
 * repaint region and for hit testing, and it deliberately does not measure a string.
 * They used to share a name, which would have linked the wrong one -- see the note in
 * badge_paint.h.
 */
bool bp_el_box(const badge_el_t *el, int *x, int *y, int *w, int *h)
{
    if (!el) return false;
    int bx = 0, by = 0, bw = 0, bh = 0;
    switch (el->type) {
    case BE_LABEL:
        /* One em wide. The real width needs the expanded string; use
         * badge_geom.h's badge_el_box() where that matters. */
        bw = bp_font_size(el);
        bh = bp_font_line(el);
        if (el->align == BADGE_ALIGN_LEFT) {
            bx = el->x;
        } else if (el->align == BADGE_ALIGN_RIGHT) {
            bx = el->x - bw;
        } else {
            bx = el->x - bw / 2;
        }
        by = el->y - bh / 2;
        break;
    case BE_ICON: {
        const int s = bp_icon_side(el);
        bw = s;
        bh = s;
        bx = el->x - s / 2;
        by = el->y - s / 2;
        break;
    }
    case BE_BATTERY:
    case BE_PILL:
    case BE_QR:
        bw = el->w;
        bh = el->h;
        bx = el->x - el->w / 2;
        by = el->y - el->h / 2;
        break;
    case BE_ALERT:
    case BE_BTN:
        bw = el->r * 2;
        bh = el->r * 2;
        bx = el->x - el->r;
        by = el->y - el->r;
        break;
    case BE_BAR:
        bx = el->x;
        by = el->y;
        bw = el->w;
        bh = el->h;
        break;
    case BE_TOGGLE:
        bw = el->w;
        bh = el->h;
        bx = el->x - el->w; /* x is the right edge */
        by = el->y - el->h / 2;
        break;
    case BE_DOTS: {
        const int n = el->n > 0 ? el->n : 3;
        const int gap = el->gap > 0 ? el->gap : 16;
        const int r = el->r > 0 ? el->r : 4;
        bw = (n - 1) * gap + r * 2;
        bh = r * 2;
        bx = el->x - bw / 2;
        by = el->y - r;
        break;
    }
    case BE_ZZZ:
        bw = 56; /* the three Zs drift right by 26 + 12 and up by 8 from (x, y) */
        bh = 40;
        bx = el->x - 28;
        by = el->y - 20;
        break;
    case BE_HIT:
        if (el->w > 0 && el->h > 0) {
            bx = el->x - el->w / 2;
            by = el->y - el->h / 2;
            bw = el->w;
            bh = el->h;
        } else {
            const int r = el->r > 0 ? el->r : 0;
            bx = el->x - r;
            by = el->y - r;
            bw = r * 2;
            bh = r * 2;
        }
        break;
    default:
        /* BE_ARC, BE_DAYRING, BE_SEGS, BE_WAVE have no rectangle of their own, and
         * neither do the free decorations (feather, hearts), whose extent is the
         * caller's. badge_geom.h says the same thing about the same types. */
        return false;
    }
    if (x) *x = bx;
    if (y) *y = by;
    if (w) *w = bw;
    if (h) *h = bh;
    return true;
}

bool bp_el_is_ring(const badge_el_t *el)
{
    if (!el) return false;
    switch (el->type) {
    case BE_ARC:
    case BE_SEGS:
    case BE_DAYRING:
    case BE_WAVE:
        return true;
    default:
        return false;
    }
}

bool bp_el_inside(const badge_el_t *el)
{
    if (!el) return false;

    if (bp_el_is_ring(el)) {
        /* A ring element may live in the 212..233 band, but its outer edge still
         * has to be inside the glass. */
        int outer;
        switch (el->type) {
        case BE_DAYRING: {
            const int a = el->r + el->w / 2;
            const int b = el->r2 + el->w2 / 2;
            outer = a > b ? a : b;
            break;
        }
        case BE_WAVE:
            outer = el->r + 22; /* the outermost ripple: r + p * 22 */
            break;
        default:
            outer = el->r + el->w / 2;
            break;
        }
        return outer <= BADGE_R;
    }

    int bx = 0, by = 0, bw = 0, bh = 0;
    if (!bp_el_box(el, &bx, &by, &bw, &bh)) return true; /* decorations own no box */

    const int xs[2] = {bx, bx + bw - 1};
    const int ys[2] = {by, by + bh - 1};
    for (int i = 0; i < 2; i++) {
        for (int j = 0; j < 2; j++) {
            const int dx = xs[i] - BADGE_CX;
            const int dy = ys[j] - BADGE_CY;
            if (dx * dx + dy * dy > BADGE_SAFE_R * BADGE_SAFE_R) return false;
        }
    }
    return true;
}
