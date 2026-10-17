/*
 * badge_paint_priv - the seam between badge_paint.c and a host test.
 *
 * badge_paint.c paints into an ARGB8888 LVGL canvas, which is the only way the
 * firmware ever calls it. A host test has no LVGL and no canvas, so every pixel
 * write and read goes through the two shims below:
 *
 *     badge_paint_px_set()   -- defaults to lv_canvas_set_px()
 *     badge_paint_px_get()   -- defaults to lv_canvas_get_px()
 *
 * The test calls badge_paint_host_bind() once with a plain uint32_t[466*466]
 * ARGB8888 buffer and the whole module paints into that instead. Nothing else is
 * redirected: the rasterisers, the clipping and the colour maths are the same
 * code on the board and in the test.
 *
 * Cost on the board: badge_paint.c caches the shim pointers in file statics, so
 * the per-pixel path is one indirect call to lv_canvas_set_px (which the linker
 * cannot inline away from a different translation unit anyway). There is no
 * branch, no allocation and no state to check -- see the note at the top of
 * badge_paint.c.
 *
 * Also declared here: badge_paint_covering(), which returns the disc mask that
 * the test needs to decide whether a transparent pixel is "inside the glass" or
 * "in the square corners the panel cannot show anyway".
 *
 * Host build --------------------------------------------------------------
 * The test compiles badge_paint.c with -DBADGE_PAINT_HOST. That does two things:
 * it stops badge_paint.c from pulling in badge_assets.h (the firmware header that
 * declares the LVGL font objects and the generated icon data), and it makes the
 * default shims weak no-op stubs instead of lv_canvas_set_px, so a host build
 * that never calls badge_paint_host_bind() still links.
 */
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "lvgl.h"

#ifdef __cplusplus
extern "C" {
#endif

/** @brief Pixel setter signature: the four arguments of LVGL 9.5's
 *  lv_canvas_set_px(canvas, x, y, color, opa). */
typedef void (*badge_paint_px_set_fn)(lv_obj_t *canvas, int x, int y, lv_color_t color, lv_opa_t opa);

/** @brief Pixel getter signature: LVGL 9.5's lv_canvas_get_px(canvas, x, y). */
typedef lv_color32_t (*badge_paint_px_get_fn)(lv_obj_t *canvas, int x, int y);

/**
 * @brief Route badge_paint's pixel access to a host buffer (test only).
 *
 * @param pixels  BADGE_SCR_W * BADGE_SCR_H ARGB8888 pixels: bits 24..31 alpha,
 *                16..23 red, 8..15 green, 0..7 blue. The buffer must outlive
 *                every paint call and is never freed here.
 * @param stride  pixels per row; BADGE_SCR_W for a full-screen buffer.
 *
 * Passing NULL for `pixels` restores the default LVGL path.
 */
void badge_paint_host_bind(uint32_t *pixels, int stride);

/** @brief Whether (x, y) is inside the disc of radius BADGE_R (the glass). */
bool badge_paint_covering(int x, int y);

/*
 * The painter's own element box, and its two predicates.
 *
 * Named bp_el_* rather than badge_el_* on purpose: badge_geom.h owns
 * badge_el_box()/badge_el_is_ring()/badge_el_placement_ok(), which are text-aware and
 * are the authority on what fits on the glass. These three are the cheap
 * string-free versions the painter uses for repaint regions and hit testing, and
 * sharing the name would have let the wrong one link silently.
 */
bool bp_el_box(const badge_el_t *el, int *x, int *y, int *w, int *h);
bool bp_el_is_ring(const badge_el_t *el);
bool bp_el_inside(const badge_el_t *el);

#ifdef __cplusplus
}
#endif
