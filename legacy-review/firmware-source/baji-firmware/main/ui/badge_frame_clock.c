#include "badge_frame_clock.h"
#include <math.h>

void badge_frame_target(badge_frame_clock_t *c, int fps)
{
    if (!c) return;
    if (fps < 0) fps = 0;
    if (c->target == fps) return; /* Preserve adaptive throttling on every tick. */
    c->target = c->effective = fps;
    c->elapsed = 0;
}

bool badge_frame_due(badge_frame_clock_t *c, double dt, bool dirty)
{
    if (!c) return false;
    if (!isfinite(dt) || dt < 0) dt = 0;
    if (dt > .5) dt = .5;
    if (c->effective <= 0) return dirty; /* Static frame refresh only. */
    c->elapsed += dt;
    const double interval = 1.0 / c->effective;
    if (c->elapsed + 1e-8 < interval) return false;
    /* Retain sub-frame remainder, never replay an unbounded backlog after a stall. */
    c->elapsed = fmod(c->elapsed, interval);
    return true;
}

void badge_frame_cost(badge_frame_clock_t *c, uint32_t us)
{
    if (!c || c->effective <= 0 || c->target <= 0) return;
    const uint32_t budget = (uint32_t)(600000u / (unsigned)c->effective);
    const int floor = c->target < 12 ? c->target : 12;
    if (us > budget && c->effective > floor) {
        c->effective -= 2;
        if (c->effective < floor) c->effective = floor;
    } else if (c->effective < c->target && (uint64_t)us * 2u < budget) {
        c->effective++;
    }
}
