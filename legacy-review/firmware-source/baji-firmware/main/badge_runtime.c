#include "badge_runtime.h"
#include "badge_events.h"

static void runtime_event(void *user, const badge_evt_log_t *evt)
{
    (void)user;
    if (!evt) return;
    badge_events_push(evt->type, evt->a, evt->b);
}

void badge_runtime_attach(badge_fsm_t *fsm, uint32_t now_ms)
{
    badge_events_advance_clock(now_ms);
    badge_fsm_set_event_sink(fsm, runtime_event, NULL);
}

void badge_runtime_press(badge_fsm_t *fsm, int x, int y, uint32_t now_ms)
{
    badge_events_advance_clock(now_ms);
    badge_fsm_press(fsm, x, y, now_ms);
}

void badge_runtime_move(badge_fsm_t *fsm, int x, int y, uint32_t now_ms)
{
    badge_events_advance_clock(now_ms);
    badge_fsm_move(fsm, x, y, now_ms);
}

void badge_runtime_release(badge_fsm_t *fsm, int x, int y, uint32_t now_ms)
{
    badge_events_advance_clock(now_ms);
    badge_fsm_release(fsm, x, y, now_ms);
}

void badge_runtime_tick(badge_fsm_t *fsm, uint32_t now_ms)
{
    badge_events_tick(now_ms);
    badge_fsm_tick(fsm, now_ms);
}
