/*
 * badge_paint - the primitives that are not rectangles.
 *
 * LVGL widgets are rectangles; almost everything on a badge screen is not. The
 * reference renderer draws the ring, the arcs, the segmented progress ring, the
 * battery pill, the feather, the sound wave, the Zzz, the hearts and the page dots
 * with canvas primitives, and so does this module -- into the same full-screen
 * ARGB8888 canvas, so that a screen can be repainted region by region without
 * touching the widget tree.
 *
 * Everything here is bounded in memory (no per-call allocation) and every function
 * is defined on the host too, so a test can assert the geometry the reference's own
 * rules imply (see tests/host/test_badge_paint.c).
 *
 * Coordinate convention, straight from the specification: 0 degrees is 3 o'clock
 * and angles increase clockwise, and every (x, y) is the element's centre unless
 * its type says otherwise (BE_BAR: top-left; BE_TOGGLE: right edge, centre y).
 * Panels are 466x466 with the origin top-left.
 */
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "lvgl.h"

#include "badge_spec.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Colours in the form the canvas wants them. The generated badge_colors[] carries
 * both RGB888 and RGB565; helpers keep the call sites readable. */
static inline lv_color_t badge_rgb(uint32_t rgb888)
{
    return lv_color_make((uint8_t)(rgb888 >> 16), (uint8_t)(rgb888 >> 8), (uint8_t)rgb888);
}

/* -- dynamic state the painters read --------------------------------------- */

/* One stretch of a day: minutes since midnight [a, b) spent doing `kind`.
 * kind indexes BADGE_DAY_SLEEP.. (the reference's DAY table, ring colours in the
 * spec: ringSleep / ringHome / ringCommute / ringWork / ringOut). */
typedef struct {
    uint16_t a, b;
    uint8_t  kind;
} badge_day_seg_t;

typedef enum {
    BADGE_DAY_SLEEP = 0,
    BADGE_DAY_HOME,
    BADGE_DAY_COMMUTE,
    BADGE_DAY_WORK,
    BADGE_DAY_OUT,
    BADGE_DAY_KIND_COUNT
} badge_day_kind_t;

/*
 * Everything the reference's drawEl() reads out of its live state, gathered in one
 * plain struct so the painters stay pure functions of (element, state). `now_ms` is
 * the same monotonic clock the UI ticks on; `ring_*` and `arc_*` pull the numbers
 * the painter has to animate.
 */
typedef struct {
    uint32_t now_ms;

    /* The five stats, 0..100, in badge_stat_t order. */
    uint8_t stat[BADGE_STAT_COUNT];

    /* Battery: percentage and whether the charger is attached. */
    uint8_t  bat_pct;
    bool     charging;

    /* 24-hour ring: minutes since midnight, the owner's day and the cat's day as
     * minute-range records, and which heart moments have already happened. */
    int      now_min;
    const badge_day_seg_t *day_owner;
    int      day_owner_n;
    const badge_day_seg_t *day_cat;
    int      day_cat_n;
    const int *hearts; /* minutes at which a heart is dropped */
    int      hearts_n;

    /* Care progress for the segmented rings: how many steps are done. */
    int      step;

    /* Feather: where the finger is, in screen pixels. */
    int      finger_x, finger_y;
    bool     finger_down;
    const badge_el_t *pressed_button; /* Visual only; hit area stays unchanged. */

    /* Voice: the current waveform phase in radians. */
    float    wave_phase;

    /* Alert: the icon to show and whether the pulse is on its bright half. */
    uint8_t  alert_icon;
    bool     alert_show;
    bool     alert_bright;

    /* Hearts / dots / zzz animation phase, 0..1. */
    float    anim_phase;

    /* What a page-dot strip should light. */
    int      dots_value;
    int      dots_n;
} badge_paint_state_t;

/* -- primitives ------------------------------------------------------------ */

/** @brief Fill the whole 466x466 canvas with the spec's transparent black. */
void badge_paint_batch_begin(lv_obj_t *canvas);
void badge_paint_batch_end(void);
void badge_paint_clear(lv_obj_t *canvas);

/**
 * @brief Narrow every subsequent write to a half-open rectangle.
 *
 * The other half of "repaint only what changed": badge_ui.c clears one band of the
 * face canvas and then redraws every element that INTERSECTS that band, and without
 * this clip the redraw would smear those elements across the entire disc.
 *
 * (x0, y0) is the top-left corner and (x1, y1) is exclusive; the rectangle is
 * intersected with the panel and an inverted one becomes empty. Passing
 * (0, 0, BADGE_SCR_W, BADGE_SCR_H) restores the full-panel default, which is what a
 * full repaint uses.
 *
 * Applies to every pixel write except badge_paint_clear(), whose whole job is clearing
 * the entire square -- that is what a full repaint means, and it is the only writer
 * that ignores this. badge_ui.c clears a partial band by memsetting that band itself
 * (ui_clear_box) rather than narrowing this clip to it, because a band clear must not
 * be affected by a clip that is set for the redraw that follows.
 */
void badge_paint_clip(int x0, int y0, int x1, int y1);

/** @brief One element, whatever its type. Does nothing for BE_HIT. */
void badge_paint_el(lv_obj_t *canvas, const badge_el_t *el, const badge_paint_state_t *st);

/* Individual primitives, exposed because the components (bubble, toast, alert
 * halo) are drawn by the UI layer and reuse them. All of them clip to the disc of
 * radius BADGE_R and return false when the shape lies entirely outside it. */

/** @brief A ring segment: centre (cx,cy), midline radius r, width w, from a0 to
 *  a1 degrees (0 = 3 o'clock, clockwise). `rounded` caps both ends. */
bool badge_paint_arc(lv_obj_t *canvas, int cx, int cy, int r, int w, float a0, float a1,
                     lv_color_t color, bool rounded);

/** @brief Filled circle. */
bool badge_paint_disc(lv_obj_t *canvas, int cx, int cy, int r, lv_color_t color);

/** @brief Circle outline of width w on the midline radius r. */
bool badge_paint_ring(lv_obj_t *canvas, int cx, int cy, int r, int w, lv_color_t color);

/** @brief Rounded rectangle; (x,y) is the top-left corner. */
bool badge_paint_rrect(lv_obj_t *canvas, int x, int y, int w, int h, int radius, lv_color_t color);

/** @brief One of the spec's 16x16 icons, scaled by an integer factor around its centre. */
bool badge_paint_icon(lv_obj_t *canvas, int icon, int cx, int cy, int scale);

/** @brief White outline over the outermost ring pixels: the no-motor haptic
 *  fallback (spec 12.2), drawn for BADGE_HAPTIC_MS after an event. */
void badge_paint_haptic_edge(lv_obj_t *canvas, int ring_r, int ring_w, lv_color_t color);

/** @brief The 12-segment battery pill (frame 2px, fill by percentage). */
void badge_paint_battery(lv_obj_t *canvas, int x, int y, int w, int h, int pct, bool charging, lv_color_t fg);

/** @brief The status bar's filled bar (BE_BAR): (x,y) is the top-left corner. */
void badge_paint_bar(lv_obj_t *canvas, int x, int y, int w, int h, int pct, lv_color_t color, lv_color_t track);

/** @brief The segmented progress ring used by 喂食/喝水/逗猫. */
void badge_paint_segs(lv_obj_t *canvas, int cx, int cy, int r, int w, int a0, int a1, int n, int gap,
                      int done, lv_color_t on, lv_color_t off);

/** @brief The 24-hour ring: the owner's day (outer band), the cat's day (inner
 *  band) and the current-minute dot. */
void badge_paint_dayring(lv_obj_t *canvas, int cx, int cy, int r, int w, int r2, int w2,
                         int now_min, const badge_day_seg_t *owner, int owner_n,
                         const badge_day_seg_t *cat, int cat_n, const int *hearts, int hearts_n);

/* -- helpers the UI layer uses --------------------------------------------- */

/*
 * The element-box arithmetic lives in badge_geom.h, not here.
 *
 * It was declared in both files, with two different prototypes: this header took
 * (el, int*, int*, int*, int*) and silently assumed an element's box does not depend
 * on its text, while badge_geom takes (el, const char *text, badge_box_t*). A label
 * whose text comes from the specification's pool has a measured width, so the second
 * is the true one -- and the first would have collided at link time while compiling
 * cleanly, because one call site would have passed a text pointer as an int*.
 * badge_geom.h owns this arithmetic and this file includes it.
 */
#include "badge_geom.h"

#ifdef __cplusplus
}
#endif
