/*
 * badge_cat_layer - the 3D cat, adapted to the specification's per-screen camera.
 *
 * The rasteriser itself (components/cat3d) and its LVGL host (cat_view) are the
 * firmware's most tested pieces: cat3d's output is byte-identical to the reference
 * renderer (tests/host/test_render.c) and its dirty-rectangle contract has its own
 * suite. This file does NOT touch them. It maps what the specification says about
 * the cat on each screen -- `cat.dist`, `cat.ox`, `cat.oy`, `cat.dim`, `cat.still`,
 * `cat.peer` -- onto the renderer's camera, picks the canvas size for the current
 * working mode (互动态 renders at half resolution, spec 8.2), and passes the
 * animation directive through (turntable spin, head look, hop, one-shot clips).
 *
 * It is the only file that knows how many pixels the cat costs, which is why the
 * PERF line reads its telemetry rather than the renderer's directly.
 */
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "lvgl.h"

#include "badge_fsm.h"
#include "badge_spec.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct badge_cat_layer badge_cat_layer_t;

/**
 * @brief Create the layer.
 *
 * The layer owns two renderers: the full-resolution one used by desk/companion
 * modes and a half-resolution one used by the interactive mode, where the spec
 * trades sharpness for frame rate. The second is created lazily, on the first
 * interactive frame, so a badge that never leaves the companion mode never pays for
 * it.
 */
badge_cat_layer_t *badge_cat_layer_create(lv_obj_t *parent);
void badge_cat_layer_destroy(badge_cat_layer_t *layer);

/** @brief The layer's LVGL object, for z-order and hit testing. */
lv_obj_t *badge_cat_layer_obj(badge_cat_layer_t *layer);

/**
 * @brief Show the cat the way a screen asks for it.
 *
 * @param screen  badge_screen_t; its badge_cat_t supplies dist/ox/oy/dim/still
 * @param mode    current working mode (the interactive mode halves the resolution)
 * @param anim    the animation directive, or NULL for the idle animation
 * @param now_ms  the monotonic clock
 */
void badge_cat_layer_update(badge_cat_layer_t *layer, int screen, badge_mode_t mode,
                            const badge_anim_directive_t *anim, uint32_t now_ms);

/** @brief Which fur palette to draw. */
void badge_cat_layer_set_breed(badge_cat_layer_t *layer, int breed);

/** @brief Draw the peer's cat instead of the owner's (遇见 screens). */
void badge_cat_layer_set_peer(badge_cat_layer_t *layer, bool peer);

/** @brief Hide the cat entirely (待机常显 renders one still frame, 生活同步 none). */
void badge_cat_layer_set_visible(badge_cat_layer_t *layer, bool visible);

/**
 * @brief Advance the animation and redraw if a frame is due.
 *
 * Called from the LVGL timer, under the display lock, exactly like cat_view_tick().
 * @return true when a frame was rasterised
 */
bool badge_cat_layer_tick(badge_cat_layer_t *layer, float dt_seconds, int target_fps);

/* -- telemetry, for the PERF log line --------------------------------------- */

int badge_cat_layer_render_us_avg(const badge_cat_layer_t *layer);
int badge_cat_layer_fps(const badge_cat_layer_t *layer);
int badge_cat_layer_dirty_px(const badge_cat_layer_t *layer);

#ifdef __cplusplus
}
#endif
