/* Production input/event bridge. All calls belong to the LVGL owner thread. */
#pragma once
#include "badge_fsm.h"

/* Attach after events_init and before accepting any input. Does not own the FSM. */
void badge_runtime_attach(badge_fsm_t *fsm, uint32_t now_ms);
void badge_runtime_press(badge_fsm_t *fsm, int x, int y, uint32_t now_ms);
void badge_runtime_move(badge_fsm_t *fsm, int x, int y, uint32_t now_ms);
void badge_runtime_release(badge_fsm_t *fsm, int x, int y, uint32_t now_ms);
/* Advance timers and the deferred event save even with no radio/social instance. */
void badge_runtime_tick(badge_fsm_t *fsm, uint32_t now_ms);
