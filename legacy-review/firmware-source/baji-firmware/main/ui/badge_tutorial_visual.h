#pragma once
#include "badge_fsm.h"
/* Pure visual policy, shared by production LVGL and host assertions. */
typedef struct {
    bool show, finger;
    uint8_t completed, mask_alpha, finger_alpha;
    int16_t finger_x, finger_y;
} badge_tutorial_visual_t;
void badge_tutorial_visual(const badge_tutorial_view_t *view, badge_tutorial_visual_t *out);
/* Non-committing preview: reveal 120px then return within 1450ms. */
bool badge_motion_blocks_input(bool active, bool demo, bool settling);
int badge_demo_offset(uint32_t elapsed_ms);
unsigned badge_demo_hold(uint32_t elapsed_ms);
bool badge_tutorial_preview(const badge_tutorial_view_t *view, badge_nav_t *direction, uint32_t *phase);
