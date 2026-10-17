#include "badge_overlay.h"

badge_overlay_update_t badge_overlay_update(badge_overlay_t *state,
    const badge_feedback_t *feedback, bool local_active)
{
    badge_overlay_update_t out = {0};
    if (!state || !feedback) return out;
    const bool active = feedback->bubble || feedback->toast || feedback->ring ||
        feedback->pet_float || feedback->hold_progress || local_active;
    out.redraw = active || state->had_pixels;
    out.bubble_changed = feedback->bubble != state->feedback.bubble ||
        feedback->bubble_rev != state->feedback.bubble_rev;
    out.toast_changed = feedback->toast != state->feedback.toast ||
        feedback->toast_rev != state->feedback.toast_rev;
    out.new_pet = feedback->pet_float &&
        feedback->pet_rev != state->consumed_pet_rev;
    /* Consume even expired events: a later refresh must never resurrect them. */
    state->consumed_pet_rev = feedback->pet_rev;
    state->feedback = *feedback;
    state->had_pixels = active;
    return out;
}
