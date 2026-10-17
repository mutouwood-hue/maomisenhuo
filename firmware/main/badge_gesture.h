#pragma once
#include <stdbool.h>
#include <stdint.h>

typedef enum { BADGE_GESTURE_NONE, BADGE_GESTURE_TAP, BADGE_GESTURE_HOLD,
    BADGE_GESTURE_UP, BADGE_GESTURE_DOWN, BADGE_GESTURE_LEFT, BADGE_GESTURE_RIGHT } badge_gesture_kind_t;
typedef struct {
    int16_t x, y, last_x, last_y;
    uint32_t started_ms, maximum_distance_sq;
    bool active;
} badge_gesture_t;
void badge_gesture_begin(badge_gesture_t *g, int16_t x, int16_t y, uint32_t now);
void badge_gesture_move(badge_gesture_t *g, int16_t x, int16_t y);
bool badge_gesture_holding(const badge_gesture_t *g, uint32_t now);
badge_gesture_kind_t badge_gesture_end(badge_gesture_t *g, int16_t x, int16_t y, uint32_t now);
