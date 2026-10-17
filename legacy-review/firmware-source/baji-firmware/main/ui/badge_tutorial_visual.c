#include "badge_tutorial_visual.h"
#include <string.h>
bool badge_motion_blocks_input(bool active, bool demo, bool settling)
{
    return active && !demo && settling;
}

int badge_demo_offset(uint32_t age)
{
    if (age < 200u || age >= 1450u) return 0;
    if (age < 700u) return (int)((age - 200u) * 120u / 500u);
    if (age < 950u) return 120;
    return (int)((1450u - age) * 120u / 500u);
}
unsigned badge_demo_hold(uint32_t age)
{
    if (age < 150u || age >= 1000u) return 0;
    return age >= 600u ? 100u : (age - 150u) * 100u / 450u;
}
bool badge_tutorial_preview(const badge_tutorial_view_t *v, badge_nav_t *direction, uint32_t *phase)
{
    if (!v || !v->active || v->complete || v->touching || v->step < 1 || v->step > 3 ||
        v->elapsed_ms % 2400u >= 1450u) return false;
    if (direction) *direction = v->direction;
    if (phase) *phase = v->elapsed_ms % 2400u;
    return true;
}
void badge_tutorial_visual(const badge_tutorial_view_t *v, badge_tutorial_visual_t *out)
{
    if (!out) return;
    memset(out, 0, sizeof(*out));
    if (!v || !v->active) return;
    out->show = true;
    out->completed = v->complete ? 5 : v->step;
    out->mask_alpha = v->returning && !v->dragging ?
        (v->screen_elapsed_ms >= 250u ? 115u : v->screen_elapsed_ms * 115u / 250u) : 0;
    if (v->complete || v->touching) return;
    const unsigned phase = v->elapsed_ms % 2400u;
    if (phase >= 1450u) return;
    out->finger = true;
    out->finger_alpha = 160;
    out->finger_x = 233; out->finger_y = 233;
    if (v->step >= 1 && v->step <= 3) {
        const int offset = (int)(phase * 150u / 1450u) - 75;
        if (v->direction == BADGE_NAV_UP) out->finger_y -= offset;
        else if (v->direction == BADGE_NAV_DOWN) out->finger_y += offset;
        else if (v->direction == BADGE_NAV_LEFT) out->finger_x -= offset;
        else out->finger_x += offset;
    } else if (v->step == 0) {
        out->finger_alpha = phase % 600u < 300u ? 180 : 80;
    }
}
