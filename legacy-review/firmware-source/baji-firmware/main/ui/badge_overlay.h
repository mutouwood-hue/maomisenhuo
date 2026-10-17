/* Pure overlay refresh policy shared by the LVGL compositor and host tests. */
#pragma once
#include "badge_fsm.h"

typedef struct {
    badge_feedback_t feedback;
    uint32_t consumed_pet_rev;
    bool had_pixels;
} badge_overlay_t;

typedef struct {
    bool redraw; /* Active animation OR one final erase of the previous pixels. */
    bool new_pet;
    bool bubble_changed, toast_changed;
} badge_overlay_update_t;

badge_overlay_update_t badge_overlay_update(badge_overlay_t *state,
    const badge_feedback_t *feedback, bool local_active);
