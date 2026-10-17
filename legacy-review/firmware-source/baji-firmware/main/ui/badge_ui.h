/*
 * badge_ui - the screen system.
 *
 * One LVGL screen per badge screen, built from the generated element tables, with a
 * compositor that keeps the layers in an explicit order:
 *
 *     0  cat canvas        (3D, its own dirty rectangle)
 *     1  face canvas       (ARGB8888, full panel: disc, arcs, icons, everything the
 *                           reference draws with canvas primitives)
 *     2  label widgets     (text, so LVGL's font rendering and kerning are used)
 *     3  bubble / toast / alert / float  (the spec's composite components)
 *     4  transition overlay (the slide used by go())
 *
 * The order is set with lv_obj_move_to_index() rather than left implicit in
 * creation order. That is a bug fix, not tidiness: the previous UI documented
 * "bezel under cat" and then created the cat first, so the documented stack and the
 * real one disagreed (see the survey note in docs/). Nothing in a test could see it.
 *
 * Repaint discipline (this is what keeps the frame budget on a 466x466 AMOLED over
 * QSPI):
 *   - a screen change rebuilds the widgets and repaints the whole face canvas;
 *   - a per-tick refresh diffs the numbers the elements read and repaints ONLY the
 *     bounding boxes that changed, so a stat arc moving by one point costs one band
 *     of pixels rather than 1.7 MB;
 *   - the cat invalidates only its own dirty rectangle (cat3d's contract).
 *
 * Widgets are the exception rather than the rule: only text gets a widget, because
 * a hand-drawn glyph atlas would duplicate what the spec's generated fonts already
 * are.
 */
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "lvgl.h"

#include "badge_cat.h"
#include "badge_fsm.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct badge_ui badge_ui_t;

/**
 * @brief Build the screen system.
 *
 * @param parent  the LVGL screen to build into (usually lv_screen_active())
 * @param fsm     the state machine; borrowed, must outlive the UI
 * @param cat     the cat layer, already created inside `parent`; may be NULL on a
 *                build without the 3D engine (host screenshot tests)
 */
badge_ui_t *badge_ui_create(lv_obj_t *parent, badge_fsm_t *fsm, badge_cat_layer_t *cat);
void badge_ui_destroy(badge_ui_t *ui);

/** @brief The screen object the UI owns. */
lv_obj_t *badge_ui_screen(badge_ui_t *ui);

/**
 * @brief Rebuild everything: new screen, new widgets, full face repaint.
 *
 * Called by the app tick when badge_fsm_screen() changed.
 */
void badge_ui_rebuild(badge_ui_t *ui, uint32_t now_ms);

/**
 * @brief Repaint what changed since the last call, and animate the components.
 *
 * Diffs the stats, the clock minute, the battery, the alert, the care step, the
 * guide page, the settings, the dots and the dynamic icons; repaints only their
 * boxes. Safe to call every tick.
 */
void badge_ui_refresh(badge_ui_t *ui, uint32_t now_ms);

/** @brief True while the transition overlay is running. */
bool badge_ui_transitioning(const badge_ui_t *ui);

/** @brief Draw a transition frame; the app tick calls this while it returns true. */
void badge_ui_transition_frame(badge_ui_t *ui, uint32_t now_ms);

/* Complete-screen snapshot compositor for follow-finger navigation. */
void badge_ui_profile_snapshot(badge_ui_t *ui);
void badge_ui_motion_frame(badge_ui_t *ui, uint32_t now_ms);
uint32_t badge_ui_motion_prepare_us(const badge_ui_t *ui);
bool badge_ui_input_blocked(const badge_ui_t *ui);
bool badge_ui_motion_active(const badge_ui_t *ui);

/** @brief Force the whole face canvas to be repainted on the next refresh. */
void badge_ui_invalidate_face(badge_ui_t *ui);

/** @brief Show a floating "+9" over the cat (摸摸). */
void badge_ui_float(badge_ui_t *ui, const char *text, uint32_t now_ms);

/** @brief Draw the spec's haptic-fallback edge ring for its 320 ms. */
void badge_ui_edge_flash(badge_ui_t *ui, uint32_t now_ms);

/** @brief Paint the whole screen into a PPM file (host screenshot tests only). */
bool badge_ui_dump_ppm(badge_ui_t *ui, const char *path);

/*
 * -- inputs that are neither painter state nor state-machine state ---------------
 *
 * These two are the values the specification's templates read that nothing else owns.
 * They are setters rather than fields of badge_paint_state_t on purpose: the painter
 * never reads them (they feed text and one dynamic icon, not a shape), and adding them
 * to the painter's state struct would make the planner diff values no painter uses.
 */

/**
 * @brief Report the finger, for the feather that follows it (BE_FEATHER).
 *
 * badge_paint.c draws the feather's idle drift from the raw clock while `down` is
 * false and offsets it from the finger while it is true, so this is the one element
 * whose input cannot come from the state machine -- the state machine's gesture
 * recogniser deliberately does not retain the live point.
 */
void badge_ui_touch(badge_ui_t *ui, int x, int y, bool down);

/**
 * @brief Which of the specification's three places the cat is at, for {placeIcon},
 *        {placeText} and {placeSub} on the 生活同步 screen.
 *
 * The place is App data (the phone knows where the owner is), so it arrives here
 * rather than being derived. The default is 0, the specification's first place.
 */
void badge_ui_set_place(badge_ui_t *ui, int place);

#ifdef __cplusplus
}
#endif
