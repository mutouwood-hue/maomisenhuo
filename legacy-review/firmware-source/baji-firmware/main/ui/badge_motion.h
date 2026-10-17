/* Touch supplement constants and pure arithmetic, shared by FSM and UI. */
#pragma once
#include <stdbool.h>
#include <stdint.h>
#define BADGE_MOTION_LOCK_PX 12
#define BADGE_MOTION_FAST_PX 50
#define BADGE_MOTION_FAST_MS 500u
#define BADGE_MOTION_SLOW_PX 140
#define BADGE_MOTION_REVERSE_MS 80u
#define BADGE_MOTION_HOLD_START_MS 150u
#define BADGE_MOTION_HOLD_END_MS 600u
#define BADGE_MOTION_HOLD_R 224
#define BADGE_MOTION_HOLD_W 6
#define BADGE_MOTION_CANCEL_MS 180u
#define BADGE_MOTION_RUBBER_MS 200u
#define BADGE_MOTION_HISTORY 32

typedef struct { uint32_t t; int x, y; } badge_motion_sample_t;
typedef struct {
    badge_motion_sample_t samples[BADGE_MOTION_HISTORY];
    unsigned count;
} badge_motion_history_t;

void badge_motion_sample(badge_motion_history_t *history, uint32_t t, int x, int y);
bool badge_motion_reverse(const badge_motion_history_t *history, uint32_t t,
                          int x, int y, bool horizontal, int delta);
bool badge_motion_commit(int travel, uint32_t duration, bool reverse);
int badge_motion_rubber(int delta);
uint32_t badge_motion_duration(bool commit, bool rubber, int remaining, int extent);
