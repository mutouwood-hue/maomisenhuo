/* Pure renderer pacing. Effective FPS is a policy, not a measured presentation FPS. */
#pragma once
#include <stdbool.h>
#include <stdint.h>
typedef struct { int target, effective; double elapsed; } badge_frame_clock_t;
void badge_frame_target(badge_frame_clock_t *clock, int fps);
bool badge_frame_due(badge_frame_clock_t *clock, double dt, bool dirty);
void badge_frame_cost(badge_frame_clock_t *clock, uint32_t render_us);
