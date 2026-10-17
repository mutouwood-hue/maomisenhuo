/*
 * cat_view - hosts the cat3d rasteriser inside an LVGL canvas.
 *
 * Frame-rate notes
 * ----------------
 * The panel is 466x466 and is driven over QSPI, so two budgets matter: how long
 * we spend rasterising, and how many bytes the compositor has to push. This file
 * addresses both:
 *
 *   * The canvas IS the whole panel (badge_cat.c creates it at BADGE_SCR_W x
 *     BADGE_SCR_H, or at 233x233 in the half-res interactive mode), so the cat's own
 *     framebuffer is what covers the glass. That framebuffer is RGB565 and therefore has
 *     no alpha, so the pixels around the cat are not "transparent" -- they are painted
 *     black, which is the specification's own background (colors.bg = #000000, and the
 *     reference clears its framebuffer with R.fb.fill(0)). cat_view_create() sets that
 *     colour explicitly: cat3d's own default is the reference's HTML *page* background,
 *     not the badge's.
 *
 *     The 233 canvas is shown 1:1, NOT at the reference's 2x, and that is a known
 *     defect: cat size in the interactive mode is half what the specification's camera
 *     implies. Scaling it with lv_image_set_scale() puts the object on LVGL's image
 *     transform path, which needs DMA-capable scratch RAM the board no longer has once
 *     the second renderer exists (~100 KB of internal RAM), and the panel then fails to
 *     draw at all. See badge_cat.c's present() and
 *     docs/m1-hardware-verification.md §0.1(b) for the measurements.
 *   * After each render only the cat's dirty rectangle is invalidated, so the
 *     adapter pushes the dirty area rather than the full 434 KB RGB565 frame -- which
 *     is where the saving actually comes from, not from a smaller canvas.
 *   * The cat's own animation is redrawn at a configurable rate, decoupled from
 *     LVGL's refresh period, so a heavy frame never stalls touch input.
 *   * That rate is not fixed: cat_view_tick() measures its own rasterisation cost
 *     and lowers the redraw rate when a frame would eat the whole budget, so the
 *     compositor and the touch reader always keep their share of the frame. This is
 *     what makes the frame rate a guarantee rather than a hope on a panel that is
 *     scanned out over a shared QSPI bus.
 *   * The renderer's hot state (shading tables, bone matrices) is explicitly
 *     placed in internal SRAM, while the framebuffer - which is only ever
 *     streamed out - lives in PSRAM. Putting the 8 KB of shading LUTs in PSRAM
 *     would put a random access in the innermost loop.
 */
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "lvgl.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct cat_view cat_view_t;

/**
 * @brief Create the canvas and its renderer.
 *
 * @param parent  LVGL parent object
 * @param w,h     canvas size in pixels; keep this near the cat's extent rather
 *                than the panel size, because it directly sets the per-frame
 *                rasterisation budget
 */
cat_view_t *cat_view_create(lv_obj_t *parent, int w, int h);
void cat_view_destroy(cat_view_t *v);

/** @brief Select breed and animation, and set the animation clock in seconds. */
void cat_view_set_pose(cat_view_t *v, int breed, int anim, float time_seconds);

/** @brief Set the yaw/pitch orbit angles in degrees. pitch is clamped. */
void cat_view_set_orbit(cat_view_t *v, float yaw_deg, float pitch_deg);

/**
 * @brief Set an explicit projection instead of the automatic fit.
 *
 * ADDED for the specification rewrite; nothing that existed before calls this, so
 * the behaviour of every existing user is unchanged. It exists because the reference
 * renderer is a perspective camera and this renderer is orthographic (see cat3d.h),
 * and the specification's per-screen camera distances have to be reproduced as an
 * orthographic scale: `scale = focal_length_px / dist`, with `focal_length_px =
 * (viewport / 2) / tan(13.5 deg)` taken from the reference's own frame().
 *
 * @param scale  pixels per model unit; <= 0 restores the automatic fit
 * @param pan_x,pan_y  centre offset in pixels, applied after scaling
 */
void cat_view_set_view(cat_view_t *v, float scale, float pan_x, float pan_y);

/**
 * @brief Advance the animation clock and redraw if a frame is due.
 *
 * Intended to be called from an LVGL timer. Returns true when a frame was drawn.
 * The draw happens on the caller's thread, so the caller must hold the display
 * lock (bsp_display_lock) exactly as it would for any other LVGL call.
 *
 * @param dt_seconds  elapsed time since the previous call
 */
bool cat_view_tick(cat_view_t *v, float dt_seconds);

/** @brief Force a redraw on the next tick, e.g. after the breed changed. */
void cat_view_invalidate(cat_view_t *v);

/** @brief Cap the cat's redraw rate. 0 means "every tick". */
void cat_view_set_target_fps(cat_view_t *v, int fps);

/** @brief Underlying LVGL object, for layout and gesture handling. */
lv_obj_t *cat_view_obj(const cat_view_t *v);

/* -- telemetry, surfaced by the on-screen overlay -------------------------- */

/** @brief Rolling average of the rasteriser time per frame, in microseconds. */
uint32_t cat_view_render_us_avg(const cat_view_t *v);

/** @brief The rate actually being drawn at, after the adaptive guard. */
int cat_view_effective_fps(const cat_view_t *v);

/** @brief Pixels rasterised in the last frame. */
int cat_view_last_pixels(const cat_view_t *v);

/** @brief Faces that survived culling in the last frame. */
int cat_view_last_faces(const cat_view_t *v);

/**
 * @brief Pixels in the last frame's dirty rectangle.
 *
 * This is the number that actually costs bandwidth: the compositor pushes exactly
 * this area to the panel over QSPI, so it is the byte budget (pixels * 2) rather
 * than the rasterised pixel count that decides whether a frame fits.
 */
int cat_view_last_dirty_px(const cat_view_t *v);

#ifdef __cplusplus
}
#endif
