/*
 * Host test: badge_paint's pixels.
 *
 * Compiles and runs with no board, no ESP-IDF and no LVGL. badge_paint.c reaches its
 * canvas through badge_paint_priv.h's two shims; this test binds them to a plain
 * uint32_t[466*466] ARGB8888 buffer (badge_paint_host_bind) and then reads pixels
 * back. Nothing else is faked: the rasterisers, the disc clipping, the colour maths
 * and the element dispatch are the code that runs on the board.
 *
 * The assertions are the specification's own claims, restated as pixels:
 *
 *   - `badge_paint_clear` leaves every pixel transparent, including the square
 *     corners outside radius 233 that the panel cannot show anyway;
 *   - no painter ever writes outside that disc (the poisoned-corner check);
 *   - an arc from a0 to a1 covers exactly that angular range -- probed at the
 *     midpoint, inside both ends, and 5 degrees outside both ends;
 *   - 0 degrees is 3 o'clock and increasing degrees run CLOCKWISE, which is what the
 *     reference's canvas2d g.arc() does, so 90 degrees lands at 6 o'clock;
 *   - a 12-segment care ring has a gap at every boundary, lights exactly `done`
 *     segments, and lights them from a0 forwards, as the reference does;
 *   - the battery pill's frame is closed and its fill width is proportional;
 *   - the 24-hour ring's heart markers land on the minutes in HEARTS, the owner's
 *     day is the outer band and the cat's the inner one, and the not-yet part is
 *     drawn at the reference's 0.3 alpha;
 *   - bp_el_box()/bp_el_inside() agree with what badge_paint_el() actually
 *     paints, for every element in the specification's own table.
 *
 * No large arrays on the stack: the canvas is a static buffer (the 8 KB local array
 * that once rebooted this board is exactly the mistake this avoids).
 */
#include <math.h>
#include <stdio.h>
#include <string.h>

#include "badge_geom.h"
#include "badge_paint.h"
#include "badge_paint_priv.h"
#include "badge_spec_data.h"
#include "lvgl.h"

#define PW BADGE_SCR_W
#define PH BADGE_SCR_H

static int failures;
static int checks;

#define CHECK(cond)                                                       \
    do {                                                                  \
        checks++;                                                         \
        if (!(cond)) {                                                    \
            printf("  FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);      \
            failures++;                                                   \
        }                                                                 \
    } while (0)

#define CHECK_EQ(a, b)                                                                     \
    do {                                                                                   \
        checks++;                                                                          \
        long long va_ = (long long)(a), vb_ = (long long)(b);                              \
        if (va_ != vb_) {                                                                  \
            printf("  FAIL %s:%d: %s == %s (%lld != %lld)\n", __FILE__, __LINE__, #a, #b,  \
                   va_, vb_);                                                              \
            failures++;                                                                    \
        }                                                                                  \
    } while (0)

/* --------------------------------------------------------------- the canvas --*/

static uint32_t g_px[PW * PH];
/* The painters never dereference the canvas -- every write goes through the bound
 * shim -- so the "canvas" is just a non-NULL token. lv_obj_t is opaque on the host
 * precisely so no code path here can start depending on its layout. */
static int g_canvas_token;
#define CANVAS ((lv_obj_t *)(void *)&g_canvas_token)

typedef struct {
    uint8_t r, g, b, a;
} rgba_t;

static rgba_t at(int x, int y)
{
    rgba_t c = {0, 0, 0, 0};
    if (x < 0 || y < 0 || x >= PW || y >= PH) return c;
    const uint32_t v = g_px[(size_t)y * PW + x];
    c.a = (uint8_t)(v >> 24);
    c.r = (uint8_t)((v >> 16) & 0xFFu);
    c.g = (uint8_t)((v >> 8) & 0xFFu);
    c.b = (uint8_t)(v & 0xFFu);
    return c;
}

static bool lit(int x, int y)
{
    if (x < 0 || y < 0 || x >= PW || y >= PH) return false;
    return (g_px[(size_t)y * PW + x] >> 24) != 0u;
}

static bool is_rgb(rgba_t c, uint32_t rgb888)
{
    return c.r == (uint8_t)(rgb888 >> 16) && c.g == (uint8_t)(rgb888 >> 8) && c.b == (uint8_t)rgb888;
}

/* True when the pixel is exactly the icon stub's texel (u, v): opaque, with the
 * stub's pure RGB. `lit()` cannot be used to look for an icon on top of a band that
 * is already opaque -- the 24-hour ring's track is drawn under everything. */
static bool is_icon_texel(rgba_t c, int icon, int u, int v)
{
    return c.a == 255 && c.r == (uint8_t)((icon * 8) & 0xFF) && c.g == (uint8_t)(u * 16) &&
           c.b == (uint8_t)(v * 16);
}

/* The number of pixels in a row of the rectangle (x, y, w, h) that the painter
 * touched, i.e. that differ from `background`. Counting `is_rgb(..., fg)` alone is
 * not a width: the edge columns of a rounded end are partially covered, and blending
 * a partial coverage over an opaque track leaves a colour that is neither the fill
 * nor the track. "Differs from the track" is the honest measure of how much of the
 * row the fill covers. */
static int row_extent(int x, int y, int w, uint32_t background)
{
    int n = 0;
    for (int i = 0; i < w; i++) {
        const rgba_t c = at(x + i, y);
        if (c.a != 0u && !is_rgb(c, background)) n++;
    }
    return n;
}

/* The sum of a row's alpha: the covered width in 1/255ths, which is exactly the
 * fractional fill width the painter was asked for. */
static int row_alpha_sum(int x, int y, int w)
{
    int n = 0;
    for (int i = 0; i < w; i++) n += at(x + i, y).a;
    return n;
}
/* True when the pixel is what compositing `alpha` of `src` over the opaque `dst`
 * produces -- the reference's globalAlpha .3 over the ring track, restated. */
static bool rgb_close(rgba_t c, uint32_t src, uint32_t dst, int alpha)
{
    const uint32_t ia = (uint32_t)(255 - alpha);
    for (unsigned sh = 0; sh < 24u; sh += 8u) {
        const uint32_t s = (src >> sh) & 0xFFu;
        const uint32_t d = (dst >> sh) & 0xFFu;
        const uint32_t want = (s * (uint32_t)alpha + d * ia + 127u) / 255u;
        const uint32_t got = sh == 16u ? c.r : (sh == 8u ? c.g : c.b);
        if (got + 1 < want || got > want + 1) return false;
    }
    return true;
}

static void fresh(void)
{
    badge_paint_host_bind(g_px, PW);
    badge_paint_clear(CANVAS);
}

/* Poison every pixel outside the glass so a painter that forgets the disc clip is
 * caught, not merely unobserved. */
static void poison_outside(void)
{
    for (int y = 0; y < PH; y++) {
        for (int x = 0; x < PW; x++) {
            if (!badge_paint_covering(x, y)) g_px[(size_t)y * PW + x] = 0xDEADBEEFu;
        }
    }
}

static int outside_damaged(void)
{
    int bad = 0;
    for (int y = 0; y < PH; y++) {
        for (int x = 0; x < PW; x++) {
            if (!badge_paint_covering(x, y) && g_px[(size_t)y * PW + x] != 0xDEADBEEFu) bad++;
        }
    }
    return bad;
}

/* The pixel whose centre is nearest to (angle, radius) around a centre. */
static void probe(int cx, int cy, double r, double deg, int *px, int *py)
{
    const double rad = deg * 3.14159265358979323846 / 180.0;
    *px = cx + (int)floor(cos(rad) * r + 0.5);
    *py = cy + (int)floor(sin(rad) * r + 0.5);
}

/* Bounding box of everything painted; false when nothing is. */
static bool painted_bbox(int *x, int *y, int *w, int *h)
{
    int x0 = PW, y0 = PH, x1 = -1, y1 = -1;
    for (int yy = 0; yy < PH; yy++) {
        for (int xx = 0; xx < PW; xx++) {
            if ((g_px[(size_t)yy * PW + xx] >> 24) == 0u) continue;
            if (xx < x0) x0 = xx;
            if (yy < y0) y0 = yy;
            if (xx > x1) x1 = xx;
            if (yy > y1) y1 = yy;
        }
    }
    if (x1 < 0) return false;
    if (x) *x = x0;
    if (y) *y = y0;
    if (w) *w = x1 - x0 + 1;
    if (h) *h = y1 - y0 + 1;
    return true;
}

static uint32_t colour_rgb(int idx)
{
    if (idx < 0 || idx >= BADGE_COLOR_COUNT) return 0u;
    return badge_colors[idx].rgb888;
}

/* ------------------------------------------------------------ reference data --*/

/* The reference's own tables, badge_spec.json/吧唧渲染参考.html line 1480-1482. They
 * are reproduced here rather than read from the firmware so the test is checking this
 * module against the reference, not against itself. */
static const int REF_HEARTS[6] = {452, 748, 1160, 1215, 1290, 1350};

static const badge_day_seg_t REF_DAY[10] = {
    {0, 435, BADGE_DAY_SLEEP},   {435, 505, BADGE_DAY_HOME},  {505, 545, BADGE_DAY_COMMUTE},
    {545, 725, BADGE_DAY_WORK},  {725, 780, BADGE_DAY_OUT},   {780, 1115, BADGE_DAY_WORK},
    {1115, 1153, BADGE_DAY_COMMUTE}, {1153, 1230, BADGE_DAY_OUT}, {1230, 1405, BADGE_DAY_HOME},
    {1405, 1440, BADGE_DAY_SLEEP},
};

static void base_state(badge_paint_state_t *st)
{
    memset(st, 0, sizeof *st);
    st->bat_pct = 82;
    st->charging = false;
    st->now_min = 700;
    st->day_owner = REF_DAY;
    st->day_owner_n = 10;
    st->day_cat = NULL;
    st->day_cat_n = 0;
    st->hearts = REF_HEARTS;
    st->hearts_n = 6;
    st->step = 2;
    st->stat[0] = 80;
    st->stat[1] = 70;
    st->stat[2] = 60;
    st->stat[3] = 50;
    st->stat[4] = 40;
    st->dots_value = 1;
    st->dots_n = 3;
    st->alert_icon = BADGE_ICON_HEART;
    st->alert_show = true;
    st->alert_bright = true;
    st->finger_x = 233;
    st->finger_y = 233;
    st->finger_down = false;
    st->wave_phase = 0.25f;
    st->anim_phase = 0.5f;
    st->now_ms = 3200;
}

/* the icon stub's tile (tests/host/badge_icon_test_stub.c) */
static void icon_texel(int icon, int u, int v, uint8_t out[4])
{
    out[0] = (uint8_t)((icon * 8) & 0xFF);
    out[1] = (uint8_t)((u * 16) & 0xFF);
    out[2] = (uint8_t)((v * 16) & 0xFF);
    out[3] = (u == 0 || v == 0 || u == 15 || v == 15) ? 0u : 255u;
}

/* The test's own reading of the specification's refusal table, written from
 * badge_blocks rather than from the painter: a care is refused when any of its rows
 * is satisfied, and a row is satisfied according to its OWN operator. 生病 and 喵币
 * are state the painter does not carry, so a row on either is ignored here too. */
static bool care_is_refused(int care, const badge_paint_state_t *st)
{
    if (care < 0 || care >= BADGE_CARE_COUNT_SPEC) return false;
    const badge_care_def_t *cd = &badge_care_defs[care];
    for (int i = 0; i < (int)cd->block_count; i++) {
        const int idx = (int)cd->block_first + i;
        if (idx < 0 || idx >= BADGE_BLOCK_COUNT) break;
        const badge_block_t *b = &badge_blocks[idx];
        if (b->stat >= BADGE_STAT_COUNT) continue;
        const int v = st->stat[b->stat];
        if (b->op == BADGE_OP_GE && v >= (int)b->value) return true;
        if (b->op == BADGE_OP_LT && v < (int)b->value) return true;
        if (b->op == BADGE_OP_EQ && v == (int)b->value) return true;
    }
    return false;
}

/* --------------------------------------------------------------------- clear --*/

static void test_clear(void)
{
    puts("clear");
    for (size_t i = 0; i < (size_t)PW * PH; i++) g_px[i] = 0xFFFFFFFFu;
    badge_paint_host_bind(g_px, PW);
    badge_paint_clear(CANVAS);

    int opaque = 0, coloured = 0;
    for (size_t i = 0; i < (size_t)PW * PH; i++) {
        if ((g_px[i] >> 24) != 0u) opaque++;
        if ((g_px[i] & 0x00FFFFFFu) != 0u) coloured++;
    }
    CHECK_EQ(opaque, 0);
    CHECK_EQ(coloured, 0);

    /* The four square corners of the panel: outside radius 233, so transparent. */
    CHECK_EQ(g_px[0], 0u);
    CHECK_EQ(g_px[PW - 1], 0u);
    CHECK_EQ(g_px[(size_t)(PH - 1) * PW], 0u);
    CHECK_EQ(g_px[(size_t)(PH - 1) * PW + PW - 1], 0u);
    CHECK(!lit(0, 0));
    CHECK(!lit(PW - 1, 0));
    CHECK(!lit(0, PH - 1));
    CHECK(!lit(PW - 1, PH - 1));
    /* The band just outside the disc is transparent too, and the centre is not. */
    CHECK(!lit(233, 0));
    CHECK(!lit(0, 233));
    CHECK(!lit(465, 233));
    CHECK(!lit(233, 465));
    /* The covering mask is the pixel CENTRE inside the circle, which is what makes it
     * the exact clip the painters use. */
    CHECK(!badge_paint_covering(0, 0));
    CHECK(badge_paint_covering(233, 233));
    CHECK(badge_paint_covering(233, 233 + 232));
    CHECK(!badge_paint_covering(233, 233 + 234));
    CHECK(badge_paint_covering(233 + 232, 233));
    CHECK(!badge_paint_covering(233 + 234, 233));
}

/* --------------------------------------------------------------------- disc ---*/

static void test_disc(void)
{
    puts("disc");
    const lv_color_t c = badge_rgb(0xF0A35Eu);
    fresh();
    poison_outside();
    CHECK(badge_paint_disc(CANVAS, 233, 233, 100, c));

    CHECK(lit(233, 233));
    CHECK(is_rgb(at(233, 233), 0xF0A35Eu));
    CHECK_EQ(at(233, 233).a, 255);

    int missing = 0, extra = 0;
    for (int dy = -110; dy <= 110; dy += 7) {
        for (int dx = -110; dx <= 110; dx += 7) {
            const int d2 = dx * dx + dy * dy;
            if (d2 <= 95 * 95 && !lit(233 + dx, 233 + dy)) missing++;
            if (d2 >= 105 * 105 && lit(233 + dx, 233 + dy)) extra++;
        }
    }
    CHECK_EQ(missing, 0);
    CHECK_EQ(extra, 0);

    /* A disc of radius 0 draws nothing; a negative radius draws nothing; a disc that
     * would reach past the glass is clipped to it. */
    fresh();
    CHECK(!badge_paint_disc(CANVAS, 233, 233, 0, c));
    CHECK(!badge_paint_disc(CANVAS, 233, 233, -5, c));
    CHECK(badge_paint_disc(CANVAS, 233, 233, 400, c));
    CHECK(lit(233, 233));
    CHECK(lit(233, 233 + 231));
    /* The disc fills the covering mask exactly, and the mask is defined by the pixel
     * centre: the pixel at the very top of the centre column has its centre 232.5 away
     * from the middle, so it is inside a 233 radius. The corners are not. */
    CHECK(lit(233, 0));
    CHECK(!lit(0, 0));
    CHECK(!lit(PW - 1, PH - 1));
    /* The pill is inscribed in the screen: its top row is the first row the covering
     * mask reports, so the mask and the painter agree pixel for pixel at the edge. */
    {
        int mask_top = -1;
        for (int y = 0; y < PH; y++) {
            if (badge_paint_covering(233, y)) {
                mask_top = y;
                break;
            }
        }
        CHECK(mask_top >= 0);
        CHECK(lit(233, mask_top + 4));
        if (mask_top > 0) CHECK(!lit(233, mask_top - 1));
    }

    fresh();
    poison_outside();
    badge_paint_disc(CANVAS, 233, 233, 400, c);
    CHECK_EQ(outside_damaged(), 0);
}

/* --------------------------------------------------------------------- ring ---*/

static void test_ring(void)
{
    puts("ring");
    const lv_color_t c = badge_rgb(0x6FA08Bu);
    fresh();
    poison_outside();
    CHECK(badge_paint_ring(CANVAS, 233, 233, 200, 10, c));
    CHECK_EQ(outside_damaged(), 0);

    int lit_mid = 0, stray = 0;
    for (int deg = 0; deg < 360; deg += 5) {
        int px, py;
        probe(233, 233, 200.0, (double)deg, &px, &py);
        if (lit(px, py)) lit_mid++;
        probe(233, 233, 192.0, (double)deg, &px, &py);
        if (lit(px, py)) stray++;
        probe(233, 233, 208.0, (double)deg, &px, &py);
        if (lit(px, py)) stray++;
    }
    CHECK_EQ(lit_mid, 72); /* every one of the 72 probes on the midline */
    CHECK_EQ(stray, 0);    /* and none 8px inside or outside it */

    /* The middle of the annulus is hollow. */
    CHECK(!lit(233, 233));
    CHECK(!badge_paint_ring(CANVAS, 233, 233, 0, 10, c));
    CHECK(!badge_paint_ring(CANVAS, 233, 233, -3, 10, c));

    /* Ring colours come from the spec's own table. */
    fresh();
    badge_paint_ring(CANVAS, 233, 233, 227, 6, badge_rgb(colour_rgb(BADGE_COLOR_RINGTRACK)));
    CHECK(is_rgb(at(233 + 227, 233), colour_rgb(BADGE_COLOR_RINGTRACK)));
    CHECK_EQ(at(233 + 227, 233).a, 255);
}

/* -------------------------------------------------------------------- rrect ---*/

static void test_rrect(void)
{
    puts("rrect");
    const lv_color_t c = badge_rgb(0x7ED492u);
    fresh();
    poison_outside();
    CHECK(badge_paint_rrect(CANVAS, 100, 100, 60, 40, 10, c));
    CHECK_EQ(outside_damaged(), 0);

    /* Filled inside. */
    CHECK(lit(130, 120));
    CHECK(lit(105, 120));
    CHECK(lit(155, 120));
    CHECK(lit(130, 103));
    CHECK(lit(130, 137));
    /* Rounded: the four corners are cut away. */
    CHECK(!lit(100, 100));
    CHECK(!lit(159, 100));
    CHECK(!lit(100, 139));
    CHECK(!lit(159, 139));
    /* The corner arc is present where a full radius reaches. */
    CHECK(lit(110, 110));
    CHECK(!lit(101, 101));
    CHECK(!lit(158, 101));

    /* Nothing outside the rectangle. */
    int outside = 0;
    for (int y = 95; y <= 145; y++) {
        for (int x = 95; x <= 165; x++) {
            const bool in_box = (x >= 100 && x <= 159 && y >= 100 && y <= 139);
            if (!in_box && lit(x, y)) outside++;
        }
    }
    CHECK_EQ(outside, 0);

    /* radius 0 is a plain rectangle; a radius larger than half the smaller side is
     * clamped rather than ignored. */
    fresh();
    CHECK(badge_paint_rrect(CANVAS, 200, 200, 20, 20, 0, c));
    CHECK(lit(200, 200));
    CHECK(lit(219, 219));
    CHECK(!lit(199, 200));
    fresh();
    CHECK(badge_paint_rrect(CANVAS, 200, 200, 20, 20, 999, c));
    CHECK(!lit(200, 200));
    CHECK(lit(210, 210));
    CHECK(!badge_paint_rrect(CANVAS, 200, 200, 0, 20, 4, c));
    CHECK(!badge_paint_rrect(CANVAS, 200, 200, 20, -1, 4, c));
}

/* ---------------------------------------------------------------------- arc ---*/

static void test_arc(void)
{
    puts("arc");
    const lv_color_t c = badge_rgb(0x8FC7E0u);
    int px = 0, py = 0;

    fresh();
    CHECK(badge_paint_arc(CANVAS, 233, 233, 200, 8, 0.0f, 90.0f, c, false));

    /* The midpoint of the sweep is on. */
    probe(233, 233, 200.0, 45.0, &px, &py);
    CHECK(lit(px, py));
    CHECK(is_rgb(at(px, py), 0x8FC7E0u));

    /* The two ends are on, five degrees outside each of them is off. */
    probe(233, 233, 200.0, 0.0, &px, &py);
    CHECK(lit(px, py));
    probe(233, 233, 200.0, 89.0, &px, &py);
    CHECK(lit(px, py));
    probe(233, 233, 200.0, -5.0, &px, &py);
    CHECK(!lit(px, py));
    probe(233, 233, 200.0, 95.0, &px, &py);
    CHECK(!lit(px, py));
    probe(233, 233, 200.0, -30.0, &px, &py);
    CHECK(!lit(px, py));
    probe(233, 233, 200.0, 150.0, &px, &py);
    CHECK(!lit(px, py));

    /* Direction: 0 degrees is 3 o'clock and angles increase CLOCKWISE, so 90 is at
     * 6 o'clock, 180 at 9 o'clock and 270 at 12 o'clock -- exactly what the
     * reference's canvas2d arc(0, pi/2) produces with y pointing down. */
    CHECK(lit(233 + 200, 233));  /* 3 o'clock, in [0, 90) */
    CHECK(lit(233, 233 + 200));  /* 6 o'clock, the far end */
    CHECK(!lit(233 - 200, 233)); /* 9 o'clock */
    CHECK(!lit(233, 233 - 200)); /* 12 o'clock */

    /* Radial extent: |distance - r| <= w/2. */
    CHECK(lit(233 + 203, 233));
    CHECK(lit(233 + 197, 233));
    CHECK(!lit(233 + 206, 233));
    CHECK(!lit(233 + 193, 233));
    CHECK(!lit(233, 233)); /* the centre of the disc is never part of an arc */

    /* A quarter sweep from 180 to 270 covers 9 and 12 o'clock, not 3 or 6.
     *
     * The axis probes below are taken one degree inside each end. A pixel's angle is
     * measured at its centre, and the centre of the pixel at exactly 9 o'clock is
     * half a pixel before 180 degrees, so an exact-boundary probe tests the pixel
     * grid rather than the arc. */
    fresh();
    CHECK(badge_paint_arc(CANVAS, 233, 233, 200, 8, 180.0f, 270.0f, c, false));
    probe(233, 233, 200.0, 181.0, &px, &py);
    CHECK(lit(px, py));
    probe(233, 233, 200.0, 269.0, &px, &py);
    CHECK(lit(px, py));
    probe(233, 233, 200.0, 225.0, &px, &py);
    CHECK(lit(px, py));
    CHECK(!lit(233 + 200, 233));
    CHECK(!lit(233, 233 + 200));
    probe(233, 233, 200.0, 175.0, &px, &py);
    CHECK(!lit(px, py));
    probe(233, 233, 200.0, 275.0, &px, &py);
    CHECK(!lit(px, py));

    /* A negative sweep runs the other way: 0 to -90 is 3 o'clock back up to 12. */
    fresh();
    CHECK(badge_paint_arc(CANVAS, 233, 233, 200, 8, 0.0f, -90.0f, c, false));
    probe(233, 233, 200.0, -45.0, &px, &py);
    CHECK(lit(px, py));
    probe(233, 233, 200.0, -1.0, &px, &py);
    CHECK(lit(px, py));
    probe(233, 233, 200.0, -89.0, &px, &py);
    CHECK(lit(px, py));
    CHECK(lit(233, 233 - 200));
    probe(233, 233, 200.0, 45.0, &px, &py);
    CHECK(!lit(px, py));
    probe(233, 233, 200.0, -95.0, &px, &py);
    CHECK(!lit(px, py));

    probe(233, 233, 200.0, 179.0, &px, &py);
    CHECK(!lit(px, py));

    /* A rounded cap adds a half disc of w/2 at each end; a butt cap does not.
     *
     * The cap's own edge is a circle of radius w/2 = 10 around the endpoint, so a
     * probe 9px from the endpoint is inside it and one 12px away is not -- measured
     * along the radius, where the angular window has no say at all. */
    fresh();
    CHECK(badge_paint_arc(CANVAS, 233, 233, 200, 20, 0.0f, 10.0f, c, true));
    probe(233, 233, 200.0, -1.0, &px, &py);
    CHECK(lit(px, py));
    probe(233, 233, 200.0, 11.0, &px, &py);
    CHECK(lit(px, py));
    probe(233, 233, 209.0, 0.0, &px, &py);
    CHECK(lit(px, py));  /* still inside the cap's disc */
    probe(233, 233, 212.0, 0.0, &px, &py);
    CHECK(!lit(px, py)); /* 12px from the endpoint, past the 10px cap */
    /* The cap spreads backwards past a0, which is the whole point of a round end. */
    probe(233, 233, 200.0, -3.0, &px, &py);
    CHECK(lit(px, py));
    probe(233, 233, 200.0, -6.0, &px, &py);
    CHECK(!lit(px, py)); /* 21px back from the endpoint: outside a 10px cap */
    fresh();
    CHECK(badge_paint_arc(CANVAS, 233, 233, 200, 20, 0.0f, 10.0f, c, false));
    probe(233, 233, 200.0, -1.0, &px, &py);
    CHECK(!lit(px, py));
    probe(233, 233, 209.0, 5.0, &px, &py);
    CHECK(lit(px, py)); /* the butt cut still covers the whole w/2 on the inside */
    probe(233, 233, 212.0, 5.0, &px, &py);
    CHECK(!lit(px, py));

    /* Degenerate and out-of-range arguments draw nothing rather than something
     * arbitrary. */
    fresh();
    CHECK(!badge_paint_arc(CANVAS, 233, 233, 200, 8, 30.0f, 30.0f, c, false));
    CHECK(!badge_paint_arc(CANVAS, 233, 233, 0, 8, 0.0f, 90.0f, c, false));
    CHECK(!badge_paint_arc(CANVAS, 233, 233, -1, 8, 0.0f, 90.0f, c, false));
    CHECK(!painted_bbox(&px, &py, &px, &py));

    /* A full turn is a ring and has no seam. */
    fresh();
    CHECK(badge_paint_arc(CANVAS, 233, 233, 200, 8, 0.0f, 360.0f, c, false));
    int missing = 0;
    for (int deg = 0; deg < 360; deg += 3) {
        probe(233, 233, 200.0, (double)deg, &px, &py);
        if (!lit(px, py)) missing++;
    }
    CHECK_EQ(missing, 0);

    /* An arc that leaves the glass is clipped to the disc. */
    fresh();
    poison_outside();
    CHECK(badge_paint_arc(CANVAS, 233, 233, 240, 30, 0.0f, 360.0f, c, false));
    CHECK_EQ(outside_damaged(), 0);
}

/* ------------------------------------------------------------------ battery --*/

static void test_battery(void)
{
    puts("battery");
    const uint32_t fg = 0x7ED492u;
    const int cx = 226, cy = 60, w = 22, h = 12;
    const int x0 = cx - w / 2; /* 215 */
    const int y0 = cy - h / 2; /* 54  */
    int px = 0, py = 0;

    fresh();
    poison_outside();
    badge_paint_battery(CANVAS, cx, cy, w, h, 50, false, badge_rgb(fg));
    CHECK_EQ(outside_damaged(), 0);

    /* The frame is closed: every pixel of the pill's own outline is painted, which is
     * what stops it reading as a broken rectangle on the glass. The outline is the
     * perimeter of the frame's OUTER box, not an inner line, so a bar that falls one
     * pixel short of a corner is caught here. */
    int holes = 0;
    for (int x = x0; x < x0 + w; x++) {
        if (!lit(x, y0)) holes++;               /* top edge    */
        if (!lit(x, y0 + h - 1)) holes++;       /* bottom edge */
    }
    for (int y = y0; y < y0 + h; y++) {
        if (!lit(x0, y)) holes++;               /* left edge  */
        if (!lit(x0 + w - 1, y)) holes++;       /* right edge */
    }
    CHECK_EQ(holes, 0);
    CHECK(lit(x0, y0));
    CHECK(lit(x0 + w - 1, y0));
    CHECK(lit(x0, y0 + h - 1));
    CHECK(lit(x0 + w - 1, y0 + h - 1));
    /* The frame is 2px thick: its outer column is the pill's left edge and the next
     * one in is still frame, so the interior starts at x0 + 2. */
    CHECK(is_rgb(at(x0 + 1, y0), colour_rgb(BADGE_COLOR_SUB)));
    CHECK(is_rgb(at(x0 + 1, y0 + 1), colour_rgb(BADGE_COLOR_SUB)));
    CHECK(is_rgb(at(x0, y0 + 2), colour_rgb(BADGE_COLOR_SUB)));
    CHECK(!lit(x0 + 2, y0 + 2));
    /* The interior beside the fill is clear. */
    fresh();
    badge_paint_battery(CANVAS, cx, cy, w, h, 0, false, badge_rgb(fg));
    CHECK(!lit(x0 + w - 3, y0 + 2));

    /* The fill is proportional to the percentage, across the frame's inner width.
     * The sum of the row's alpha is the covered width in 1/255ths, which is exactly
     * the fractional width the painter was asked for: at 50% of a 14px inner width
     * the edge sits at 7.0 columns, at 30% at 4.2, and the last column is only a
     * fifth covered. An integer product would get 3 of those 11 steps wrong. */
    const int inner_x = x0 + 3;
    const int inner_w = w - 8; /* 14 */
    const int row = y0 + 3 + 1;
    int covered[11];
    int k = 0;
    for (int pct = 0; pct <= 100; pct += 10) {
        fresh();
        badge_paint_battery(CANVAS, cx, cy, w, h, pct, false, badge_rgb(fg));
        int alph = row_alpha_sum(inner_x, row, inner_w);
        double want = (double)inner_w * (double)pct / 100.0;
        if (want < 1.0) want = 1.0;
        covered[k++] = alph;
        CHECK(alph >= (int)(want * 255.0) - 2 && alph <= (int)(want * 255.0) + 2);
    }
    CHECK_EQ(covered[0], 255);          /* 0% still shows exactly one full column  */
    CHECK_EQ(covered[5], 7 * 255);      /* 50% of 14 = 7.0 columns                 */
    CHECK_EQ(covered[10], inner_w * 255); /* 100% is the whole inner width          */
    /* Integer arithmetic would give 4 * 255 here and 14 * 30 / 100 = 4, so the
     * fractional edge is what distinguishes the two. */
    CHECK(covered[3] > 4 * 255);
    CHECK(covered[3] < 5 * 255);

    /* At 100% the fill stops at the frame's inner edge, and the interior beyond it
     * stays clear -- the reference's own 2px gutter. */
    fresh();
    badge_paint_battery(CANVAS, cx, cy, w, h, 100, false, badge_rgb(fg));
    CHECK(is_rgb(at(inner_x, row), fg));
    CHECK(is_rgb(at(inner_x + inner_w - 1, row), fg));
    CHECK(!lit(inner_x + inner_w, row));
    CHECK(!lit(inner_x + inner_w + 1, row));

    /* The frame is hollow: between the fill's end and the frame's right bar there is a
     * 2px gutter, and the pill never grows past its own w even where the nub is. */
    fresh();
    badge_paint_battery(CANVAS, cx, cy, w, h, 100, false, badge_rgb(fg));
    CHECK(!lit(x0 + w - 4, row)); /* the 2px gutter between fill and frame */
    CHECK(lit(x0 + w - 3, row));  /* the nub thickens the right edge inwards */
    CHECK(lit(x0 + w - 2, row));
    CHECK(lit(x0 + w - 1, row));
    /* The nub runs down the middle rows only; two rows from the bottom the right edge
     * is back to its 2px thickness, which is the frame's own column pair. */
    CHECK(lit(x0 + w - 3, cy));
    CHECK(lit(x0 + w - 2, cy));
    CHECK(lit(x0 + w - 1, cy));
    CHECK(!lit(x0 + w, cy));
    CHECK(!lit(x0 + w + 1, cy));
    /* Outside the nub's rows the right edge is still 2px. */
    CHECK(!lit(x0 + w - 3, y0 + 2));
    /* The whole pill stays inside its declared 22x12 box. */
    {
        int ix = 0, iy = 0, iw = 0, ih = 0;
        CHECK(painted_bbox(&ix, &iy, &iw, &ih));
        CHECK(iw <= w);
        CHECK(ih <= h);
        CHECK(ix >= x0);
        CHECK(iy >= y0);
    }

    /* 0% shows one full sliver, and nothing beyond it. */
    fresh();
    badge_paint_battery(CANVAS, cx, cy, w, h, 0, false, badge_rgb(fg));
    CHECK(is_rgb(at(inner_x, row), fg));
    CHECK(!is_rgb(at(inner_x + 1, row), fg));
    CHECK_EQ(row_extent(inner_x, row, inner_w, colour_rgb(BADGE_COLOR_BG)), 1);

    /* Charging draws the bolt icon on top and still returns nothing outside the disc. */
    fresh();
    poison_outside();
    badge_paint_battery(CANVAS, cx, cy, w, h, 50, true, badge_rgb(fg));
    CHECK_EQ(outside_damaged(), 0);
    CHECK(lit(cx - 1, cy + 2)); /* the icon's own centre block */

    /* Degenerate sizes are refused rather than drawn as a smear. */
    fresh();
    badge_paint_battery(CANVAS, cx, cy, 4, 4, 50, false, badge_rgb(fg));
    CHECK(!painted_bbox(&px, &py, &px, &py));
}

/* ---------------------------------------------------------------------- bar ---*/

static void test_bar(void)
{
    puts("bar");
    const uint32_t fg = 0xF0BF73u, tr = 0x4A3E33u;
    /* status/bar_food: x 140 y 131 w 190 h 10 */
    const int x = 140, y = 131, w = 190, h = 10;

    fresh();
    poison_outside();
    badge_paint_bar(CANVAS, x, y, w, h, 50, badge_rgb(fg), badge_rgb(tr));
    CHECK_EQ(outside_damaged(), 0);

    const int row = y + h / 2;
    /* The fill is w * pct / 100 in floating point, so at 50% of 190 the edge sits at
     * column 95.0 exactly: 95 columns are fully filled and the 96th is empty. */
    CHECK(is_rgb(at(x + 2, row), fg));
    CHECK(is_rgb(at(x + 94, row), fg));
    CHECK(!is_rgb(at(x + 95, row), fg));
    CHECK(is_rgb(at(x + 95, row), tr));
    CHECK(is_rgb(at(x + w - 2, row), tr));

    /* The value is max(h, w * pct / 100) wide, so 0% is not zero pixels: it is one
     * rounded end, which is what the reference draws. The width is a real number, so
     * the measure is how much of the row the fill covers: every pixel that is not
     * still the track colour. Counting exact-colour matches would drop the two
     * partially covered edge columns of each rounded end. */
    int widths[11];
    const int pcts[11] = {0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100};
    for (int k = 0; k < 11; k++) {
        fresh();
        badge_paint_bar(CANVAS, x, y, w, h, pcts[k], badge_rgb(fg), badge_rgb(tr));
        int expect = (int)((double)w * (double)pcts[k] / 100.0);
        if (expect < h) expect = h;
        const int extent = row_extent(x, row, w, tr);
        widths[k] = extent;
        CHECK(extent >= expect - 2 && extent <= expect);
    }
    CHECK_EQ(widths[0], h);
    CHECK_EQ(widths[10], w);
    /* Monotone: more percent is never narrower. */
    int non_monotone = 0;
    for (int k = 1; k < 11; k++) {
        if (widths[k] < widths[k - 1]) non_monotone++;
    }
    CHECK_EQ(non_monotone, 0);
    /* The covered width as a fraction, in 1/255ths, is the requested fill width: the
     * rounded ends make the outer columns partial, so the alpha sum is the honest
     * measure of "how wide is the value". */
    for (int k = 0; k < 11; k++) {
        fresh();
        badge_paint_bar(CANVAS, x, y, w, h, pcts[k], badge_rgb(fg), badge_rgb(tr));
        int want = (int)((double)w * (double)pcts[k] / 100.0);
        if (want < h) want = h;
        const int alph = row_alpha_sum(x, row, want);
        CHECK(alph >= want * 255 - 2 * 255);
        CHECK(alph <= want * 255);
    }

    fresh();
    badge_paint_bar(CANVAS, x, y, w, h, 150, badge_rgb(fg), badge_rgb(tr));
    CHECK(is_rgb(at(x + w - 2, row), fg)); /* clamped, not wrapped */
    fresh();
    badge_paint_bar(CANVAS, x, y, w, h, -20, badge_rgb(fg), badge_rgb(tr));
    CHECK_EQ(at(x + w - 2, row).a, 255);
}

/* --------------------------------------------------------------------- segs ---*/

static void test_segs(void)
{
    puts("segs");
    const uint32_t on_rgb = colour_rgb(BADGE_COLOR_ACCENT);
    const uint32_t off_rgb = colour_rgb(BADGE_COLOR_LINE);
    const lv_color_t on = badge_rgb(on_rgb), off = badge_rgb(off_rgb);
    int px = 0, py = 0;

    /* The specification's own numbers: r 222, w 8, n 3, a0 219, a1 321, gap 6. */
    fresh();
    poison_outside();
    badge_paint_segs(CANVAS, 233, 233, 222, 8, 219, 321, 3, 6, 1, on, off);
    CHECK_EQ(outside_damaged(), 0);

    /* span = (321 - 219 - 6 * 2) / 3 = 30 degrees per segment. */
    probe(233, 233, 222.0, 234.0, &px, &py);
    CHECK(is_rgb(at(px, py), on_rgb));
    probe(233, 233, 222.0, 270.0, &px, &py);
    CHECK(is_rgb(at(px, py), off_rgb));
    probe(233, 233, 222.0, 306.0, &px, &py);
    CHECK(is_rgb(at(px, py), off_rgb));
    /* Exactly one of the three is lit. */
    int lit_count = 0;
    for (int deg = 219; deg <= 321; deg += 1) {
        probe(233, 233, 222.0, (double)deg, &px, &py);
        if (is_rgb(at(px, py), on_rgb)) lit_count++;
    }
    CHECK(lit_count > 0);

    /* A 12-segment ring: exactly `done` lit, the lit ones starting at a0, and a hole
     * at every interior boundary.
     *
     * The reference's formula is `sp = (a1 - a0 - gap * (n - 1)) / n` with segment i
     * at `a0 + i * (sp + gap)`, so a full turn lays down n segments and n - 1 gaps:
     * the span it spends on gaps is (n - 1) * gap, and the ring closes at a1. There is
     * deliberately no gap between the last segment and the first -- asserting n gaps
     * here would be asserting something the specification does not say. */
    const int n = 12, gap = 2;
    const double span = (360.0 - (double)gap * (n - 1)) / (double)n;
    fresh();
    badge_paint_segs(CANVAS, 233, 233, 200, 8, 0, 360, n, gap, 3, on, off);
    for (int i = 0; i < n; i++) {
        probe(233, 233, 200.0, (double)i * (span + gap) + span / 2.0, &px, &py);
        CHECK(is_rgb(at(px, py), i < 3 ? on_rgb : off_rgb));
    }
    /* Every interior boundary is a hole, not a dim pixel: n - 1 of them. */
    int gap_pixels = 0;
    for (int i = 0; i < n - 1; i++) {
        probe(233, 233, 200.0, (double)i * (span + gap) + span + (double)gap / 2.0, &px, &py);
        if (!lit(px, py)) gap_pixels++;
    }
    CHECK_EQ(gap_pixels, n - 1);
    /* Segment 11 (around 346 degrees) is the last, and it is off: the ring runs
     * from a0 forwards, not backwards. */
    probe(233, 233, 200.0, 345.0, &px, &py);
    CHECK(!is_rgb(at(px, py), on_rgb));
    CHECK(is_rgb(at(px, py), off_rgb));

    /* done = 0 lights nothing; done >= n lights everything. */
    fresh();
    badge_paint_segs(CANVAS, 233, 233, 200, 8, 0, 360, n, gap, 0, on, off);
    {
        int any_on = 0;
        for (int i = 0; i < n; i++) {
            probe(233, 233, 200.0, (double)i * (span + gap) + span / 2.0, &px, &py);
            if (is_rgb(at(px, py), on_rgb)) any_on++;
        }
        CHECK_EQ(any_on, 0);
    }
    fresh();
    badge_paint_segs(CANVAS, 233, 233, 200, 8, 0, 360, n, gap, n, on, off);
    {
        int all_on = 0;
        for (int i = 0; i < n; i++) {
            probe(233, 233, 200.0, (double)i * (span + gap) + span / 2.0, &px, &py);
            if (is_rgb(at(px, py), on_rgb)) all_on++;
        }
        CHECK_EQ(all_on, n);
    }
    /* done = 3 lights exactly the first three and stops: the fourth is off and there
     * are no stray lit pixels past the third segment. */
    fresh();
    badge_paint_segs(CANVAS, 233, 233, 200, 8, 0, 360, n, gap, 3, on, off);
    {
        const double stop = 3.0 * (span + gap);
        int strays = 0;
        for (int deg = (int)ceil(stop); deg < 360; deg++) {
            probe(233, 233, 200.0, (double)deg, &px, &py);
            if (is_rgb(at(px, py), on_rgb)) strays++;
        }
        CHECK_EQ(strays, 0);
    }

    /* A span too small for the gaps draws nothing. 12 segments and a 6-degree gap
     * need (12 - 1) * 6 = 66 degrees of gap alone, so a 60-degree sweep has a
     * negative segment span and must paint no pixels at all. */
    fresh();
    badge_paint_segs(CANVAS, 233, 233, 200, 8, 0, 60, 12, 6, 4, on, off);
    CHECK(!painted_bbox(&px, &py, &px, &py));
    CHECK(!lit(233 + 200, 233));
}

/* ------------------------------------------------------------------ dayring ---*/

static void test_dayring(void)
{
    puts("dayring");
    int px = 0, py = 0;
    const int now = 700; /* 11:40 */

    /* 1. owner only: the band reports each stretch in the spec's ring colour. */
    fresh();
    poison_outside();
    badge_paint_dayring(CANVAS, 233, 233, 218, 18, 200, 6, now, REF_DAY, 10, NULL, 0, REF_HEARTS, 6);
    CHECK_EQ(outside_damaged(), 0);

    /* minute 200 (03:20) is Sleep and already happened. */
    probe(233, 233, 218.0, 200.0 / 1440.0 * 360.0 - 90.0, &px, &py);
    CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_RINGSLEEP)));
    CHECK_EQ(at(px, py).a, 255);
    /* minute 600 (10:00) is Work and already happened. */
    probe(233, 233, 218.0, 600.0 / 1440.0 * 360.0 - 90.0, &px, &py);
    CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_RINGWORK)));
    CHECK_EQ(at(px, py).a, 255);
    /* minute 900 (15:00) is Work and has NOT happened: the reference draws the rest
     * of the day at globalAlpha .3 over the opaque track, so the band stays fully
     * opaque and its colour is the ring colour blended 30/70 with the track. */
    probe(233, 233, 218.0, 900.0 / 1440.0 * 360.0 - 90.0, &px, &py);
    CHECK_EQ(at(px, py).a, 255);
    CHECK(!is_rgb(at(px, py), colour_rgb(BADGE_COLOR_RINGWORK)));
    CHECK(!is_rgb(at(px, py), colour_rgb(BADGE_COLOR_RINGTRACK)));
    CHECK(rgb_close(at(px, py), colour_rgb(BADGE_COLOR_RINGWORK), colour_rgb(BADGE_COLOR_RINGTRACK), 77));
    /* The inner band uses CATK: Work maps to Out. */
    probe(233, 233, 200.0, 600.0 / 1440.0 * 360.0 - 90.0, &px, &py);
    CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_RINGOUT)));
    probe(233, 233, 200.0, 900.0 / 1440.0 * 360.0 - 90.0, &px, &py);
    /* The inner band is drawn where nothing else is, so a 30% stroke over the black
     * background keeps alpha 77 -- the same colour the reference composites. */
    CHECK_EQ(at(px, py).a, 77);
    /* Commute (505..545) maps to Home for the cat, Sleep to Sleep. */
    probe(233, 233, 200.0, 520.0 / 1440.0 * 360.0 - 90.0, &px, &py);
    CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_RINGHOME)));
    probe(233, 233, 218.0, 520.0 / 1440.0 * 360.0 - 90.0, &px, &py);
    CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_RINGCOMMUTE)));

    /* 2. Midnight is the top of the dial and the day runs clockwise: minute 2160/4 =
     * 360 is exactly one quarter of the way round, at 3 o'clock. */
    probe(233, 233, 218.0, 0.0, &px, &py);
    CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_RINGSLEEP)));
    CHECK(lit(233, 233 - 218));  /* minute 0 at 12 o'clock */
    CHECK(lit(233 + 218, 233));  /* minute 360 at 3 o'clock */
    CHECK(lit(233, 233 + 218));  /* minute 720 at 6 o'clock */

    /* 3. The track shows wherever there is no day record: pass an empty day. The one
     * exception is the current-minute dot, which is always drawn. */
    fresh();
    badge_paint_dayring(CANVAS, 233, 233, 218, 18, 200, 6, now, NULL, 0, NULL, 0, NULL, 0);
    int track_hits = 0, dot_hits = 0;
    for (int deg = 0; deg < 360; deg += 6) {
        probe(233, 233, 218.0, (double)deg, &px, &py);
        if (is_rgb(at(px, py), colour_rgb(BADGE_COLOR_RINGTRACK))) {
            track_hits++;
        } else if (is_rgb(at(px, py), 0xFFFFFFu)) {
            dot_hits++;
        }
    }
    CHECK_EQ(track_hits + dot_hits, 60);
    CHECK(track_hits >= 59);
    CHECK(dot_hits <= 1);

    /* 4. Heart markers land on the minutes in HEARTS, and only on the ones that have
     * already happened.
     *
     * `lit()` is useless here: the band the hearts sit on is the opaque ring track, so
     * every probe in it is already lit. The hearts are found by their own stub texel
     * instead -- at scale 1 the two-pixel offset lands on source texel (10, 10), which
     * is opaque and whose RGB is a pure function of the icon index. */
    fresh();
    badge_paint_dayring(CANVAS, 233, 233, 218, 18, 0, 0, now, NULL, 0, NULL, 0, REF_HEARTS, 6);
    for (int i = 0; i < 6; i++) {
        const int m = REF_HEARTS[i];
        const double a = (double)m / 1440.0 * 360.0 - 90.0;
        probe(233, 233, 218.0, a, &px, &py);
        /* +2 lands on source texel (10, 10); -2 lands on (6, 6). Both are opaque and
         * both carry the icon's own RGB, so testing either is enough -- and the two
         * together prove the whole tile landed, not a corner of it. */
        const bool on_it = is_icon_texel(at(px + 2, py + 2), BADGE_ICON_HEART, 10, 10) &&
                           is_icon_texel(at(px - 2, py - 2), BADGE_ICON_HEART, 6, 6);
        if (m <= now) {
            CHECK(on_it);
        } else {
            CHECK(!on_it);
        }
    }
    /* Concretely: 452 has happened, 748 has not. */
    {
        const double a452 = 452.0 / 1440.0 * 360.0 - 90.0;
        probe(233, 233, 218.0, a452, &px, &py);
        CHECK(is_icon_texel(at(px + 2, py + 2), BADGE_ICON_HEART, 10, 10));
        const double a748 = 748.0 / 1440.0 * 360.0 - 90.0;
        probe(233, 233, 218.0, a748, &px, &py);
        CHECK(!is_icon_texel(at(px + 2, py + 2), BADGE_ICON_HEART, 10, 10));
    }
    /* Moving `now` past a heart makes it appear -- and then keeps it. The dot is kept
     * away from the probe by moving `now` by a fifth of a day, because the dot sits
     * exactly on the heart when now == the heart's minute and would cover it. */
    for (int i = 0; i < 6; i++) {
        const int m = REF_HEARTS[i];
        const double a = (double)m / 1440.0 * 360.0 - 90.0;
        fresh();
        badge_paint_dayring(CANVAS, 233, 233, 218, 18, 0, 0, m + 200, NULL, 0, NULL, 0, REF_HEARTS, 6);
        probe(233, 233, 218.0, a, &px, &py);
        CHECK(is_icon_texel(at(px + 2, py + 2), BADGE_ICON_HEART, 10, 10));
        fresh();
        badge_paint_dayring(CANVAS, 233, 233, 218, 18, 0, 0, m - 1, NULL, 0, NULL, 0, REF_HEARTS, 6);
        probe(233, 233, 218.0, a, &px, &py);
        CHECK(!is_icon_texel(at(px + 2, py + 2), BADGE_ICON_HEART, 10, 10));
    }
    /* A minute past every heart draws all six at once, and no more. */
    fresh();
    badge_paint_dayring(CANVAS, 233, 233, 218, 18, 0, 0, 1440, NULL, 0, NULL, 0, REF_HEARTS, 6);
    {
        int found = 0;
        for (int i = 0; i < 6; i++) {
            const double a = (double)REF_HEARTS[i] / 1440.0 * 360.0 - 90.0;
            probe(233, 233, 218.0, a, &px, &py);
            if (is_icon_texel(at(px + 2, py + 2), BADGE_ICON_HEART, 10, 10)) found++;
        }
        CHECK_EQ(found, 6);
    }

    /* 5. The current-minute dot is a white disc of radius 8 on the outer band. */
    fresh();
    badge_paint_dayring(CANVAS, 233, 233, 218, 18, 200, 6, now, REF_DAY, 10, NULL, 0, NULL, 0);
    {
        const double a = (double)now / 1440.0 * 360.0 - 90.0;
        probe(233, 233, 218.0, a, &px, &py);
        CHECK(is_rgb(at(px, py), 0xFFFFFFu));
        CHECK(lit(px + 6, py));
        CHECK(lit(px, py + 6));
        /* The dot is radius 8 and sits on the band, which is itself lit, so "nothing
         * here" is measured against the dot's own white. 11px away along +x is
         * outside the dot and still inside the 18px band, so it is the band colour. */
        CHECK(!is_rgb(at(px + 11, py), 0xFFFFFFu));
        CHECK(!is_rgb(at(px, py + 11), 0xFFFFFFu));
        CHECK(!is_rgb(at(px + 11, py), 0x000000u));
    }
    /* Moving `now` moves the dot. */
    fresh();
    badge_paint_dayring(CANVAS, 233, 233, 218, 18, 200, 6, 1200, REF_DAY, 10, NULL, 0, NULL, 0);
    {
        const double a = 1200.0 / 1440.0 * 360.0 - 90.0;
        probe(233, 233, 218.0, a, &px, &py);
        CHECK(is_rgb(at(px, py), 0xFFFFFFu));
    }

    /* 6. The 4x4 hour marks sit at radius 188, every six hours. */
    fresh();
    badge_paint_dayring(CANVAS, 233, 233, 218, 18, 200, 6, now, NULL, 0, NULL, 0, NULL, 0);
    for (int hh = 0; hh < 24; hh += 6) {
        const double a = (double)(hh * 60) / 1440.0 * 360.0 - 90.0;
        probe(233, 233, 188.0, a, &px, &py);
        CHECK(lit(px, py));
        CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_TEXT)));
    }
    /* ... and nowhere in between. */
    probe(233, 233, 188.0, 45.0, &px, &py);
    CHECK(!lit(px, py));

    /* 7. An explicit cat day replaces the CATK derivation. */
    {
        static const badge_day_seg_t cat_day[1] = {{0, 700, BADGE_DAY_OUT}};
        fresh();
        badge_paint_dayring(CANVAS, 233, 233, 218, 18, 200, 6, now, REF_DAY, 10, cat_day, 1, NULL, 0);
        probe(233, 233, 200.0, 200.0 / 1440.0 * 360.0 - 90.0, &px, &py);
        CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_RINGOUT)));
    }

    /* 8. The band never leaves the glass: r + w/2 = 227 < 233. */
    CHECK(218 + 18 / 2 <= BADGE_R);
    CHECK(200 + 6 / 2 <= BADGE_R);
}

/* --------------------------------------------------------------------- icon ---*/

static void test_icon(void)
{
    puts("icon");
    int px = 0, py = 0;
    const int icon = 5;
    const int scale = 3;
    const int side = BADGE_ICON_PX * scale; /* 48 */
    const int x0 = 233 - side / 2;
    const int y0 = 233 - side / 2;

    fresh();
    poison_outside();
    CHECK(badge_paint_icon(CANVAS, icon, 233, 233, scale));
    CHECK_EQ(outside_damaged(), 0);

    int wrong = 0, painted = 0;
    for (int oy = 0; oy < side; oy++) {
        for (int ox = 0; ox < side; ox++) {
            uint8_t want[4];
            icon_texel(icon, ox / scale, oy / scale, want);
            const rgba_t got = at(x0 + ox, y0 + oy);
            if (want[3] == 0u) {
                if (got.a != 0u) wrong++;
            } else {
                if (got.r != want[0] || got.g != want[1] || got.b != want[2] || got.a != 255u) wrong++;
                painted++;
            }
        }
    }
    CHECK_EQ(wrong, 0);
    CHECK_EQ(painted, (side - 2 * scale) * (side - 2 * scale));

    /* Nearest neighbour, not smoothing: every output pixel in a scale x scale block
     * equals one source texel, so the top-left texel fills the first whole block. */
    for (int oy = 0; oy < scale; oy++) {
        for (int ox = 0; ox < scale; ox++) {
            CHECK_EQ(at(x0 + scale + ox, y0 + scale + oy).g, (uint8_t)(1 * 16));
            CHECK_EQ(at(x0 + scale + ox, y0 + scale + oy).b, (uint8_t)(1 * 16));
        }
    }
    /* The icon sits where it says: the block around texel (8, 8) is at the centre. */
    CHECK_EQ(at(233, 233).r, (uint8_t)((icon * 8) & 0xFF));
    CHECK_EQ(at(233, 233).a, 255u);
    /* The transparent border of the stub tile is not painted. */
    CHECK(!lit(x0, y0));
    CHECK(!lit(x0 + side - 1, y0 + side - 1));
    CHECK(!lit(x0 + side - 1, y0));
    CHECK(lit(x0 + scale, y0 + scale));
    /* ... and nothing outside the scaled square. */
    CHECK(!lit(x0 - 1, 233));
    CHECK(!lit(x0 + side, 233));
    CHECK(!lit(233, y0 - 1));
    CHECK(!lit(233, y0 + side));

    /* Scale 1 is the asset's own size. */
    fresh();
    CHECK(badge_paint_icon(CANVAS, icon, 100, 100, 1));
    int s1 = 0;
    for (int y = 92; y < 108; y++) {
        for (int x = 92; x < 108; x++) {
            if (lit(x, y)) s1++;
        }
    }
    CHECK_EQ(s1, 14 * 14); /* the 16x16 tile minus its transparent border */
    CHECK(!lit(100 - 8, 100 - 8));
    CHECK(lit(100 - 6, 100 - 6));

    /* An unknown icon, a null icon and a non-positive scale draw nothing. */
    fresh();
    CHECK(!badge_paint_icon(CANVAS, BADGE_ICON_NONE, 233, 233, 2));
    CHECK(!badge_paint_icon(CANVAS, 1 << 20, 233, 233, 2));
    CHECK(!badge_paint_icon(CANVAS, icon, 233, 233, 0));
    CHECK(!badge_paint_icon(CANVAS, icon, 233, 233, -4));
    CHECK(!painted_bbox(&px, &py, &px, &py));

    /* An icon that straddles the rim is clipped to the disc. */
    fresh();
    poison_outside();
    CHECK(badge_paint_icon(CANVAS, icon, 233 + 230, 233, 4));
    CHECK_EQ(outside_damaged(), 0);
}

/* -------------------------------------------------------------- haptic edge ---*/

static void test_haptic_edge(void)
{
    puts("haptic edge");
    const lv_color_t accent = badge_rgb(colour_rgb(BADGE_COLOR_ACCENT));
    fresh();
    poison_outside();
    badge_paint_haptic_edge(CANVAS, 0, 0, accent); /* 0 = the spec's 227 / 6 */
    CHECK_EQ(outside_damaged(), 0);

    /* Spec 12.2: ringR 227, ringW 6 -- a 6px band on a midline of 227. */
    CHECK_EQ(BADGE_HAPTIC_RING_R, 227);
    CHECK_EQ(BADGE_HAPTIC_RING_W, 6);
    CHECK(lit(233 + 227, 233));
    CHECK(is_rgb(at(233 + 227, 233), colour_rgb(BADGE_COLOR_ACCENT)));
    CHECK(lit(233 - 227, 233));
    CHECK(lit(233, 233 + 227));
    CHECK(lit(233, 233 - 227));
    /* Only the ring's pixels light up: 224..230, nothing at 222 or 232. */
    CHECK(!lit(233 + 222, 233));
    CHECK(!lit(233 + 232, 233));
    CHECK(!lit(233, 233));
    int hollow = 0, stray = 0;
    for (int deg = 0; deg < 360; deg += 4) {
        int px, py;
        probe(233, 233, 210.0, (double)deg, &px, &py);
        if (lit(px, py)) stray++;
        probe(233, 233, 227.0, (double)deg, &px, &py);
        if (!lit(px, py)) hollow++;
    }
    CHECK_EQ(stray, 0);
    CHECK_EQ(hollow, 0);

    /* A wider ring is still clipped to the glass. */
    fresh();
    poison_outside();
    badge_paint_haptic_edge(CANVAS, 232, 12, accent);
    CHECK_EQ(outside_damaged(), 0);
}

/* ------------------------------------------------- element boxes vs ink extent --*/

static bool box_within(int bx, int by, int bw, int bh, int x0, int y0, int x1, int y1, int tol)
{
    return x0 >= bx - tol && y0 >= by - tol && x1 <= bx + bw - 1 + tol && y1 <= by + bh - 1 + tol;
}

static bool type_has_box(uint8_t t)
{
    switch (t) {
    case BE_ICON:
    case BE_BATTERY:
    case BE_ALERT:
    case BE_BTN:
    case BE_ZZZ:
    case BE_BAR:
    case BE_TOGGLE:
    case BE_PILL:
    case BE_QR:
    case BE_DOTS:
    case BE_HIT:
        return true;
    default:
        return false;
    }
}

static void test_element_boxes(void)
{
    puts("element boxes");
    badge_paint_state_t st;
    base_state(&st);

    int with_box = 0, without_box = 0, drawn = 0, outside = 0;
    for (int i = 0; i < BADGE_EL_COUNT; i++) {
        const badge_el_t *el = &badge_els[i];
        int bx = 0, by = 0, bw = 0, bh = 0;
        const bool has = bp_el_box(el, &bx, &by, &bw, &bh);
        if (has) {
            with_box++;
            if (bw <= 0 || bh <= 0) outside++; /* a degenerate box is a bug */
        } else {
            without_box++;
        }

        /* bp_el_inside must be answering the specification's own rule: content
         * four corners inside radius 212, ring elements inside the disc. */
        if (bp_el_is_ring(el)) {
            CHECK(bp_el_inside(el));
        } else if (has) {
            int cx[2] = {bx, bx + bw - 1};
            int cy[2] = {by, by + bh - 1};
            bool all_safe = true;
            for (int a = 0; a < 2; a++) {
                for (int b = 0; b < 2; b++) {
                    const int dx = cx[a] - BADGE_CX, dy = cy[b] - BADGE_CY;
                    if (dx * dx + dy * dy > BADGE_SAFE_R * BADGE_SAFE_R) all_safe = false;
                }
            }
            CHECK_EQ((int)bp_el_inside(el), (int)all_safe);
        }

        if (!type_has_box(el->type) || !has) continue;

        /* Paint this element alone and compare the ink with the declared box. */
        fresh();
        badge_paint_el(CANVAS, el, &st);
        int ix = 0, iy = 0, iw = 0, ih = 0;
        if (!painted_bbox(&ix, &iy, &iw, &ih)) continue;
        drawn++;
        if (!box_within(bx, by, bw, bh, ix, iy, ix + iw - 1, iy + ih - 1, 1)) {
            outside++;
            printf("  el %d type %d box (%d,%d,%d,%d) ink (%d,%d,%d,%d)\n", i, (int)el->type, bx, by, bw, bh,
                   ix, iy, iw, ih);
        }
    }
    CHECK_EQ(outside, 0);
    CHECK(with_box > 100);
    CHECK(without_box > 10);
    CHECK(drawn > 20);
    CHECK_EQ(bp_el_box(NULL, 0, 0, 0, 0), 0);
    CHECK_EQ(bp_el_inside(NULL), 0);
    CHECK_EQ(bp_el_is_ring(NULL), 0);
    CHECK_EQ(bp_el_box(NULL, NULL, NULL, NULL, NULL), 0);

    /* Ring elements own no rectangle and are reported as such. */
    for (int i = 0; i < BADGE_EL_COUNT; i++) {
        const badge_el_t *el = &badge_els[i];
        switch (el->type) {
        case BE_ARC:
        case BE_DAYRING:
        case BE_SEGS:
        case BE_WAVE:
            CHECK(bp_el_is_ring(el));
            CHECK(!bp_el_box(el, NULL, NULL, NULL, NULL));
            break;
        case BE_LABEL:
        case BE_ICON:
        case BE_BATTERY:
        case BE_ALERT:
        case BE_BTN:
        case BE_ZZZ:
        case BE_BAR:
        case BE_TOGGLE:
        case BE_PILL:
        case BE_QR:
        case BE_DOTS:
        case BE_HIT:
            CHECK(!bp_el_is_ring(el));
            break;
        default: /* the free decorations own no box either */
            break;
        }
    }
}

/* --------------------------------------------------------- element dispatch --*/

static const badge_el_t *find_el(uint8_t type, uint8_t value)
{
    for (int i = 0; i < BADGE_EL_COUNT; i++) {
        if (badge_els[i].type == type && (value == BADGE_VALUE_NONE || badge_els[i].value == value)) {
            return &badge_els[i];
        }
    }
    return NULL;
}

static void test_el_dispatch(void)
{
    puts("element dispatch");
    badge_paint_state_t st;
    base_state(&st);
    int px = 0, py = 0;

    /* BE_HIT and BE_LABEL are never drawn by this module: a hit region is touch
     * only, and text is an LVGL widget on the layer above (badge_ui.h). */
    fresh();
    {
        const badge_el_t *hit = find_el(BE_HIT, BADGE_VALUE_NONE);
        const badge_el_t *lbl = find_el(BE_LABEL, BADGE_VALUE_NONE);
        CHECK(hit != NULL);
        CHECK(lbl != NULL);
        if (hit) badge_paint_el(CANVAS, hit, &st);
        if (lbl) badge_paint_el(CANVAS, lbl, &st);
        CHECK(!painted_bbox(&px, &py, &px, &py));
    }
    badge_paint_el(CANVAS, NULL, &st);
    badge_paint_el(CANVAS, &badge_els[0], NULL);

    /* The status arcs: rev means the value grows from a1 backwards, which is what
     * badge_spec_data.c's BADGE_ELF_REV carries. */
    {
        const badge_el_t *spec_arc = find_el(BE_ARC, BADGE_VALUE_FOOD);
        CHECK(spec_arc != NULL);
        badge_el_t generic_arc = spec_arc ? *spec_arc : (badge_el_t){0};
        generic_arc.w = 8;
        const badge_el_t *arc = spec_arc ? &generic_arc : NULL;
        if (spec_arc) {
            const double center = (spec_arc->a0 + spec_arc->a1) * 0.5;
            fresh(); st.stat[0] = 0; badge_paint_el(CANVAS, spec_arc, &st);
            probe(233, 233, 214.0, center, &px, &py);
            CHECK(at(px, py).a == 0);
            probe(233, 233, 214.0, center - 10, &px, &py);
            CHECK(is_rgb(at(px, py), 0x372e26));
            fresh(); st.stat[0] = 100; badge_paint_el(CANVAS, spec_arc, &st);
            probe(233, 233, 214.0, center, &px, &py);
            CHECK(is_rgb(at(px, py), 0xf0a35e));
            fresh(); st.stat[0] = 50; badge_paint_el(CANVAS, spec_arc, &st);
            probe(233, 233, 214.0, center, &px, &py);
            CHECK(is_rgb(at(px, py), 0xf0a35e));
            probe(233, 233, 214.0, center + 7, &px, &py);
            CHECK(at(px, py).a == 0);
        }
        if (arc) {
            const double a0 = (double)arc->a0;
            const double a1 = (double)arc->a1;
            const double mid = (a0 + a1) / 2.0;
            CHECK_EQ(arc->flags & BADGE_ELF_REV, BADGE_ELF_REV);

            /* stat 0: nothing lit, the track shows across the whole arc. */
            fresh();
            st.stat[0] = 0;
            badge_paint_el(CANVAS, arc, &st);
            probe(233, 233, 214.0, mid, &px, &py);
            CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_LINE)));

            /* stat 100: the whole arc is the stat's colour. */
            fresh();
            st.stat[0] = 100;
            badge_paint_el(CANVAS, arc, &st);
            probe(233, 233, 214.0, mid, &px, &py);
            CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_FOOD)));

            /* stat 50 with rev: the lit half abuts a1. */
            fresh();
            st.stat[0] = 50;
            badge_paint_el(CANVAS, arc, &st);
            probe(233, 233, 214.0, a1 - 1.0, &px, &py);
            CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_FOOD)));
            probe(233, 233, 214.0, a1 - (a1 - a0) * 0.6, &px, &py);
            CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_LINE)));
            probe(233, 233, 214.0, a0 + 1.0, &px, &py);
            CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_LINE)));

            /* Below the spec's low-stat threshold the arc uses warn. lowStat is 30,
             * so 29 is the largest value that still counts as low and 30 is the
             * smallest that does not -- the threshold is a strict `<`. */
            CHECK_EQ(badge_numbers.low_stat, 30);
            fresh();
            st.stat[0] = 29;
            badge_paint_el(CANVAS, arc, &st);
            {
                const double lit = (a1 - a0) * 0.29;
                probe(233, 233, 214.0, a1 - lit / 2.0, &px, &py);
                CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_WARN)));
                probe(233, 233, 214.0, a1 - lit - 1.0, &px, &py);
                CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_LINE)));
            }
            fresh();
            st.stat[0] = 30;
            badge_paint_el(CANVAS, arc, &st);
            {
                const double lit = (a1 - a0) * 0.30;
                probe(233, 233, 214.0, a1 - lit / 2.0, &px, &py);
                CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_FOOD)));
            }
            /* A very low stat still lights a sliver, in warn, at the a1 end. */
            fresh();
            st.stat[0] = 5;
            badge_paint_el(CANVAS, arc, &st);
            probe(233, 233, 214.0, a1 - 0.3, &px, &py);
            CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_WARN)));
            probe(233, 233, 214.0, mid, &px, &py);
            CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_LINE)));

            /* The arc must not spill outside the disc. */
            fresh();
            poison_outside();
            st.stat[0] = 100;
            badge_paint_el(CANVAS, arc, &st);
            CHECK_EQ(outside_damaged(), 0);
        }
    }

    /* The status bar reads the same value and the same low-stat rule. The bar's
     * w * pct / 100 is a real number, so a probe inside the filled part must be
     * strictly before that edge: at 5% of 190 = 9.5 columns the last full column is
     * index 8. */
    {
        const badge_el_t *bar = find_el(BE_BAR, BADGE_VALUE_FOOD);
        CHECK(bar != NULL);
        if (bar) {
            const int row = bar->y + bar->h / 2;
            const int probe_col = bar->x + (int)((double)bar->w * 0.05) - 1;
            fresh();
            st.stat[0] = 0;
            badge_paint_el(CANVAS, bar, &st);
            CHECK(is_rgb(at(bar->x + bar->w - 3, row), colour_rgb(BADGE_COLOR_LINE)));
            fresh();
            st.stat[0] = 100;
            badge_paint_el(CANVAS, bar, &st);
            CHECK(is_rgb(at(bar->x + bar->w - 3, row), colour_rgb(BADGE_COLOR_FOOD)));
            fresh();
            st.stat[0] = 5;
            badge_paint_el(CANVAS, bar, &st);
            CHECK(is_rgb(at(probe_col, row), colour_rgb(BADGE_COLOR_WARN)));
            CHECK(is_rgb(at(bar->x + bar->w - 3, row), colour_rgb(BADGE_COLOR_LINE)));
            fresh();
            st.stat[0] = 29;
            badge_paint_el(CANVAS, bar, &st);
            CHECK(is_rgb(at(bar->x + (int)((double)bar->w * 0.29) - 1, row), colour_rgb(BADGE_COLOR_WARN)));
            fresh();
            st.stat[0] = 30;
            badge_paint_el(CANVAS, bar, &st);
            CHECK(is_rgb(at(bar->x + (int)((double)bar->w * 0.30) - 1, row), colour_rgb(BADGE_COLOR_FOOD)));
        }
    }

    /* The battery pill: percentage, plus warn below the spec's no-wake threshold.
     *
     * Charging paints a bolt over the middle of the pill, so the icon covers the
     * whole fill -- which is what the reference does too. The OK colour is therefore
     * asserted through the primitive (test_battery) and the charging branch through
     * the bolt that appears on top of it. */
    {
        const badge_el_t *bat = find_el(BE_BATTERY, BADGE_VALUE_NONE);
        CHECK(bat != NULL);
        if (bat) {
            CHECK_EQ(badge_numbers.bat_no_wake, 20);
            st.bat_pct = 100;
            st.charging = false;
            fresh();
            badge_paint_el(CANVAS, bat, &st);
            CHECK(is_rgb(at(bat->x - bat->w / 2 + 3, bat->y), colour_rgb(BADGE_COLOR_TEXT)));
            st.bat_pct = 19;
            fresh();
            badge_paint_el(CANVAS, bat, &st);
            CHECK(is_rgb(at(bat->x - bat->w / 2 + 3, bat->y), colour_rgb(BADGE_COLOR_WARN)));
            st.bat_pct = 20;
            fresh();
            badge_paint_el(CANVAS, bat, &st);
            CHECK(is_rgb(at(bat->x - bat->w / 2 + 3, bat->y), colour_rgb(BADGE_COLOR_TEXT)));
            /* Charging: the bolt lands at (x - 1, y + 2), so the icon's own red shows
             * over the fill and the un-charged TEXT colour does not. The icon is
             * BADGE_ICON_BOLT, not BAT_LOW: bolt.png is in the development package and
             * the package's own badge_ui_spec.h:720 declares BADGE_ICON_BOLT[256]. */
            st.bat_pct = 82;
            st.charging = true;
            fresh();
            badge_paint_el(CANVAS, bat, &st);
            CHECK(lit(bat->x - 1, bat->y + 2));
            CHECK_EQ(at(bat->x - 1, bat->y + 2).r, (uint8_t)((BADGE_ICON_BOLT * 8) & 0xFF));
            CHECK(!is_rgb(at(bat->x - 1, bat->y + 2), colour_rgb(BADGE_COLOR_TEXT)));
            st.charging = false;
        }
    }

    /* A care button, and the specification's refusal table.
     *
     * badge_blocks carries its own comparison per row, and the table is two-sided:
     * 心情 >= 98 (too content to pet), 饱腹 >= 95 (too full to eat), 喵币 < 3,
     * 精力 < 10 (too tired to play), 生病 == 1, 精力 >= 95 (too rested to sleep).
     * 喂食's rows are 饱腹 and 喵币. A refused care is drawn at 35%. */
    {
        const badge_el_t *btn = find_el(BE_BTN, BADGE_VALUE_NONE);
        CHECK(btn != NULL);
        if (btn) {
            CHECK_EQ(btn->bg, BADGE_COLOR_CARD);
            CHECK_EQ(btn->care, BADGE_CARE_FEED);
            CHECK_EQ(btn->ring, BADGE_COLOR_NONE);
            CHECK_EQ(badge_care_defs[BADGE_CARE_FEED].block_first, 1);
            CHECK_EQ(badge_care_defs[BADGE_CARE_FEED].block_count, 2);
            CHECK_EQ(badge_blocks[1].stat, BADGE_STAT_FOOD);
            CHECK_EQ(badge_blocks[1].op, BADGE_OP_GE);
            CHECK_EQ(badge_blocks[1].value, 95);
            CHECK_EQ(badge_blocks[2].stat, BADGE_STAT_COINS);
            CHECK_EQ(badge_blocks[2].op, BADGE_OP_LT);
            CHECK_EQ(badge_blocks[2].value, 3);

            /* The disc, sampled outside the icon. The button's r is 36 and its icon is
             * 16 x scale_x2 / 2 = 48 pixels square, so the icon covers the middle third
             * of the disc; r - 8 is comfortably outside it and still inside the disc. */
            const int ox = btn->x, oy = btn->y - btn->r + 8;
            badge_paint_state_t ok;
            base_state(&ok);
            fresh();
            badge_paint_el(CANVAS, btn, &ok);
            const rgba_t ok_px = at(ox, oy);
            CHECK(is_rgb(ok_px, colour_rgb(BADGE_COLOR_CARD)));
            CHECK_EQ(ok_px.a, 255);
            /* The disc has radius 36, so its topmost row is y - 36; two pixels above
             * that is clear. */
            CHECK(!lit(btn->x, btn->y - btn->r - 2));

            /* Too full to eat: 95 and above is refused. Exactly 95 is the first
             * refused value, 94 the last offered one. */
            badge_paint_state_t full;
            base_state(&full);
            full.stat[BADGE_STAT_FOOD] = 95;
            fresh();
            badge_paint_el(CANVAS, btn, &full);
            const rgba_t dim_px = at(ox, oy);
            CHECK(dim_px.a != 0u);
            CHECK(!is_rgb(dim_px, colour_rgb(BADGE_COLOR_CARD)));
            /* The whole button is drawn at 35%: the disc colour composited over the
             * black background. The alpha stays opaque; it is the COLOUR that fades,
             * which is what the reference's globalAlpha does to an opaque fill. */
            CHECK_EQ(dim_px.a, 255);
            CHECK(rgb_close(dim_px, colour_rgb(BADGE_COLOR_CARD), 0x000000u, 89));
            CHECK(dim_px.r < ok_px.r);

            full.stat[BADGE_STAT_FOOD] = 94;
            fresh();
            badge_paint_el(CANVAS, btn, &full);
            CHECK(is_rgb(at(ox, oy), colour_rgb(BADGE_COLOR_CARD)));

            /* 喵币 and 生病 are sentinels the painter cannot evaluate -- badge_ui.c
             * owns the coin count and the sick flag -- so they must NOT read as
             * "refused": that would dim every care button whose cost is coins. A cat
             * at full health on every stat is still offered its dinner. */
            badge_paint_state_t topped;
            base_state(&topped);
            for (int k = 0; k < BADGE_STAT_COUNT; k++) topped.stat[k] = 50;
            fresh();
            badge_paint_el(CANVAS, btn, &topped);
            CHECK(is_rgb(at(ox, oy), colour_rgb(BADGE_COLOR_CARD)));

            /* Every care that is refused by a stat rule the painter can evaluate must
             * dim when that rule fires, and stay bright when it does not. 哄睡 is the
             * one that catches a one-sided reading of the table: energy >= 95 refuses
             * it, so a cat with energy 100 is NOT offered a nap. */
            for (int i = 0; i < BADGE_EL_COUNT; i++) {
                const badge_el_t *b = &badge_els[i];
                if (b->type != BE_BTN || b->care == BADGE_CARE_NONE) continue;
                badge_paint_state_t s;
                base_state(&s);
                for (int k = 0; k < BADGE_STAT_COUNT; k++) s.stat[k] = 50;
                s.stat[BADGE_STAT_ENERGY] = 100;
                s.stat[BADGE_STAT_MOOD] = 100;
                fresh();
                badge_paint_el(CANVAS, b, &s);
                int bright = 0, dim = 0;
                for (int y = 0; y < PH; y++) {
                    for (int x = 0; x < PW; x++) {
                        const rgba_t c = at(x, y);
                        if (c.a == 0u) continue;
                        if (is_rgb(c, colour_rgb(b->bg))) {
                            bright++;
                        } else {
                            dim++;
                        }
                    }
                }
                const bool blocked = care_is_refused((int)b->care, &s);
                CHECK(bright + dim > 500); /* the button really was painted */
                CHECK_EQ((int)blocked, (int)(bright == 0));
            }
        }
    }

    /* The care progress ring lights `step` segments from a0. */
    {
        const badge_el_t *segs = find_el(BE_SEGS, BADGE_VALUE_NONE);
        CHECK(segs != NULL);
        if (segs) {
            const double span = ((double)segs->a1 - segs->a0 - (double)segs->gap * (segs->n - 1)) / segs->n;
            st.step = 0;
            fresh();
            badge_paint_el(CANVAS, segs, &st);
            probe(233, 233, (double)segs->r, (double)segs->a0 + span / 2.0, &px, &py);
            CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_LINE)));
            st.step = 1;
            fresh();
            badge_paint_el(CANVAS, segs, &st);
            probe(233, 233, (double)segs->r, (double)segs->a0 + span / 2.0, &px, &py);
            CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_ACCENT)));
            probe(233, 233, (double)segs->r, (double)segs->a0 + span + (double)segs->gap + span / 2.0, &px, &py);
            CHECK(is_rgb(at(px, py), colour_rgb(BADGE_COLOR_LINE)));
        }
    }

    /* The alert bubble follows alert_show: nothing at all when it is off. */
    {
        const badge_el_t *alert = find_el(BE_ALERT, BADGE_VALUE_NONE);
        CHECK(alert != NULL);
        if (alert) {
            st.alert_show = false;
            fresh();
            badge_paint_el(CANVAS, alert, &st);
            CHECK(!painted_bbox(&px, &py, &px, &py));
            st.alert_show = true;
            st.alert_bright = true;
            fresh();
            badge_paint_el(CANVAS, alert, &st);
            CHECK(lit(alert->x, alert->y));
            const rgba_t bright = at(alert->x, alert->y - alert->r + 2);
            st.alert_bright = false;
            fresh();
            badge_paint_el(CANVAS, alert, &st);
            const rgba_t dim = at(alert->x, alert->y - alert->r + 2);
            CHECK(bright.a != 0u);
            CHECK(dim.a != 0u);
            /* The ring breathes: the dark half is strictly darker. */
            CHECK(bright.r > dim.r);
        }
    }

    /* A QR block paints a white field with black modules inside it. */
    {
        const badge_el_t *qr = find_el(BE_QR, BADGE_VALUE_NONE);
        CHECK(qr != NULL);
        if (qr) {
            fresh();
            badge_paint_el(CANVAS, qr, &st);
            CHECK(is_rgb(at(qr->x - qr->w / 2 + 2, qr->y), 0xFFFFFFu));
            CHECK_EQ(at(qr->x, qr->y).a, 255u);
            /* The quiet zone is white, the middle is a module map. */
            int dark = 0, white = 0;
            for (int y = qr->y - qr->h / 2 + 8; y < qr->y + qr->h / 2 - 8; y++) {
                for (int x = qr->x - qr->w / 2 + 8; x < qr->x + qr->w / 2 - 8; x++) {
                    if (is_rgb(at(x, y), 0x000000u)) dark++;
                    if (is_rgb(at(x, y), 0xFFFFFFu)) white++;
                }
            }
            CHECK(dark > 500);
            CHECK(white > 500);
        }
    }

    /* Page dots. One of the specification's two dot elements is a guide pager whose
     * lit dot is `dots_value`; the other is animated and its lit dot is a function of
     * time (`(ts * 2.5 | 0) % n`), so the two are asserted differently -- asserting
     * dots_value on an animated element would be asserting a rule the spec does not
     * state. */
    {
        const badge_el_t *dots = find_el(BE_DOTS, BADGE_VALUE_NONE);
        CHECK(dots != NULL);
        if (dots) {
            const bool anim = (dots->flags & BADGE_ELF_ANIM) != 0;
            CHECK(dots->n >= 3);
            CHECK_EQ(dots->gap, 16);
            CHECK_EQ(dots->r, 4);
            if (!anim) {
                for (int v = 0; v < dots->n; v++) {
                    st.dots_value = v;
                    fresh();
                    badge_paint_el(CANVAS, dots, &st);
                    int ac = 0;
                    for (int i = 0; i < dots->n; i++) {
                        const int dx = dots->x + (i - (dots->n - 1) / 2) * dots->gap;
                        const bool is_accent = is_rgb(at(dx, dots->y), colour_rgb(BADGE_COLOR_ACCENT));
                        CHECK_EQ((int)is_accent, (int)(i == v));
                        CHECK(is_rgb(at(dx, dots->y), i == v ? colour_rgb(BADGE_COLOR_ACCENT)
                                                             : colour_rgb(BADGE_COLOR_LINE)));
                        if (is_accent) ac++;
                    }
                    CHECK_EQ(ac, 1);
                }
                st.dots_value = 1;
            } else {
                /* Exactly one dot is lit, at every instant, and it advances. */
                for (uint32_t t = 0; t < 3000; t += 200) {
                    st.now_ms = t;
                    fresh();
                    badge_paint_el(CANVAS, dots, &st);
                    int ac = 0, idx = -1;
                    for (int i = 0; i < dots->n; i++) {
                        const int dx = dots->x + (i - (dots->n - 1) / 2) * dots->gap;
                        if (is_rgb(at(dx, dots->y), colour_rgb(BADGE_COLOR_ACCENT))) {
                            ac++;
                            idx = i;
                        } else {
                            CHECK(is_rgb(at(dx, dots->y), colour_rgb(BADGE_COLOR_LINE)));
                        }
                    }
                    CHECK_EQ(ac, 1);
                    CHECK_EQ(idx, (int)((uint32_t)((double)t / 1000.0 * 2.5)) % dots->n);
                }
                st.now_ms = 3200;
            }
        }
    }

    /* The toggle is an on/off control whose state is a setting, which
     * badge_paint_state_t does not carry: the base paint is the OFF state, and the
     * track/knob primitives are exported so badge_ui.c can repaint it when it is on. */
    {
        const badge_el_t *tg = find_el(BE_TOGGLE, BADGE_VALUE_NONE);
        CHECK(tg != NULL);
        if (tg) {
            CHECK_EQ(tg->w, 52);
            CHECK_EQ(tg->h, 28);
            fresh();
            badge_paint_el(CANVAS, tg, &st);
            CHECK(lit(tg->x - tg->w + 2, tg->y));
            CHECK(is_rgb(at(tg->x - tg->w + 2, tg->y), colour_rgb(BADGE_COLOR_LINE)));
            /* The knob is the text colour at the left when off. */
            CHECK(is_rgb(at(tg->x - tg->w + tg->h / 2, tg->y), colour_rgb(BADGE_COLOR_TEXT)));
            /* The knob's radius is h/2 - 4 = 10, so it stops short of the track's
             * mid-line and the right half is still the track. */
            CHECK(is_rgb(at(tg->x - 12, tg->y), colour_rgb(BADGE_COLOR_LINE)));
            /* The box starts at x - w and is h tall, centred on y. */
            int bx, by, bw, bh;
            CHECK(bp_el_box(tg, &bx, &by, &bw, &bh));
            CHECK_EQ(bx, tg->x - tg->w);
            CHECK_EQ(by, tg->y - tg->h / 2);
            CHECK_EQ(bw, tg->w);
            CHECK_EQ(bh, tg->h);
        }
    }

    /* The voice wave draws rings at and beyond r. */
    /* The voice wave: three rings leaving r and travelling outwards, each a third of
     * a period behind the last, so at wave_phase 0 they sit at r, r + 22/3 and
     * r + 44/3 and the gaps between them are empty. */
    {
        const badge_el_t *wave = find_el(BE_WAVE, BADGE_VALUE_NONE);
        CHECK(wave != NULL);
        if (wave) {
            CHECK_EQ(wave->r, 206);
            fresh();
            st.wave_phase = 0.0f;
            badge_paint_el(CANVAS, wave, &st);
            const double radii[3] = {(double)wave->r, (double)wave->r + 22.0 / 3.0,
                                     (double)wave->r + 44.0 / 3.0};
            for (int i = 0; i < 3; i++) {
                probe(233, 233, radii[i], 0.0, &px, &py);
                CHECK(lit(px, py));
                probe(233, 233, radii[i], 90.0, &px, &py);
                CHECK(lit(px, py));
                probe(233, 233, radii[i], 180.0, &px, &py);
                CHECK(lit(px, py));
                probe(233, 233, radii[i], 270.0, &px, &py);
                CHECK(lit(px, py));
            }
            /* Between the rings: empty. */
            probe(233, 233, (radii[0] + radii[1]) / 2.0, 45.0, &px, &py);
            CHECK(!lit(px, py));
            probe(233, 233, (radii[1] + radii[2]) / 2.0, 45.0, &px, &py);
            CHECK(!lit(px, py));
            /* r + 22 is the outermost ripple, still well inside the glass, and the
             * whole wave is clipped to the disc. */
            CHECK(wave->r + 22 + 2 < BADGE_R);
            fresh();
            poison_outside();
            for (int k = 0; k < 5; k++) {
                st.wave_phase = (float)k / 5.0f;
                badge_paint_el(CANVAS, wave, &st);
            }
            CHECK_EQ(outside_damaged(), 0);
            st.wave_phase = 0.25f;
        }
    }

    /* The Zzz decoration keeps its ink inside the box it declares. */
    {
        const badge_el_t *zzz = find_el(BE_ZZZ, BADGE_VALUE_NONE);
        CHECK(zzz != NULL);
        if (zzz) {
            int bx, by, bw, bh;
            CHECK(bp_el_box(zzz, &bx, &by, &bw, &bh));
            for (int k = 0; k < 4; k++) {
                st.now_ms = (uint32_t)(k * 400);
                fresh();
                badge_paint_el(CANVAS, zzz, &st);
                int ix, iy, iw, ih;
                if (!painted_bbox(&ix, &iy, &iw, &ih)) continue;
                CHECK(box_within(bx, by, bw, bh, ix, iy, ix + iw - 1, iy + ih - 1, 1));
            }
            st.now_ms = 3200;
        }
    }

    /* The feather follows the finger, and its box is the caller's business. */
    {
        const badge_el_t *f = find_el(BE_FEATHER, BADGE_VALUE_NONE);
        CHECK(f != NULL);
        if (f) {
            st.finger_down = true;
            st.finger_x = 150;
            st.finger_y = 200;
            fresh();
            badge_paint_el(CANVAS, f, &st);
            CHECK(lit(166, 184)); /* the icon is centred at (finger + 16, finger - 16) */
            st.finger_down = false;
            fresh();
            badge_paint_el(CANVAS, f, &st);
            CHECK(painted_bbox(&px, &py, &px, &py));
        }
    }

    /* The falling hearts, over several instants, never leave the glass. */
    {
        const badge_el_t *h = find_el(BE_HEARTS, BADGE_VALUE_NONE);
        CHECK(h != NULL);
        if (h) {
            for (int k = 0; k < 8; k++) {
                fresh();
                poison_outside();
                st.now_ms = (uint32_t)(k * 337);
                badge_paint_el(CANVAS, h, &st);
                CHECK_EQ(outside_damaged(), 0);
            }
            st.now_ms = 3200;
        }
    }
}

/* ---------------------------------------------------------------------- main --*/

static void test_pressed_button(void)
{
    const badge_el_t *btn = find_el(BE_BTN, BADGE_VALUE_NONE);
    CHECK(btn != NULL);
    if (!btn) return;
    badge_paint_state_t st;
    base_state(&st);
    fresh();
    badge_paint_el(CANVAS, btn, &st);
    CHECK(lit(btn->x, btn->y - btn->r + 1));
    st.pressed_button = btn;
    fresh();
    badge_paint_el(CANVAS, btn, &st);
    CHECK(!lit(btn->x, btn->y - btn->r + 1));
    CHECK(is_rgb(at(btn->x, btn->y - btn->r + 8), colour_rgb(BADGE_COLOR_CARDHI)));
    /* Generated feed button's icon is 48px; pressed side rounds to 45px. */
    CHECK_EQ(btn->scale_x2, 6);
    const int x0 = (int)floor(btn->x - 45.0 / 2.0 + 0.5);
    const int y0 = (int)floor(btn->y - 45.0 / 2.0 + 0.5);
    CHECK(is_icon_texel(at(x0 + 3, y0 + 3), btn->icon, 1, 1));
    CHECK(is_icon_texel(at(x0 + 40, y0 + 40), btn->icon, 14, 14));
    CHECK(!is_icon_texel(at(x0 - 1, y0), btn->icon, 0, 0));
    CHECK(badge_el_contains(btn, NULL, btn->x, btn->y - btn->r + 1));
    st.pressed_button = NULL;
    fresh();
    badge_paint_el(CANVAS, btn, &st);
    CHECK(lit(btn->x, btn->y - btn->r + 1));
    CHECK(is_rgb(at(btn->x, btn->y - btn->r + 8), colour_rgb(BADGE_COLOR_CARD)));
}

int main(void)
{
    printf("badge_paint host test: %dx%d canvas, %d elements in the spec's table\n", PW, PH, BADGE_EL_COUNT);

    /* Bind once; individual tests rebind through fresh(). */
    badge_paint_host_bind(g_px, PW);
    CHECK(g_px[(size_t)0] == 0u); /* the buffer starts cleared */

    test_clear();
    test_disc();
    test_ring();
    test_rrect();
    test_arc();
    test_battery();
    test_bar();
    test_segs();
    test_dayring();
    test_icon();
    test_pressed_button();
    test_haptic_edge();
    test_element_boxes();
    test_el_dispatch();

    /* Detaching must leave the module usable in its default (LVGL) mode. */
    badge_paint_host_bind(NULL, 0);

    printf("%d checks, %d failures\n", checks, failures);
    if (checks < 300) {
        printf("FAIL: only %d assertions, the suite expects 300+\n", checks);
        return 1;
    }
    return failures ? 1 : 0;
}
