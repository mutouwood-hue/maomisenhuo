#pragma once
#include <stdbool.h>
#include <stdint.h>

typedef enum { BADGE_GESTURE_NONE, BADGE_GESTURE_TAP, BADGE_GESTURE_HOLD,
    BADGE_GESTURE_UP, BADGE_GESTURE_DOWN, BADGE_GESTURE_LEFT, BADGE_GESTURE_RIGHT } badge_gesture_kind_t;
typedef struct {
    int16_t x, y, last_x, last_y;
    uint32_t started_ms, maximum_distance_sq;
    uint8_t axis; /* Directional intent after 12 px; ambiguous diagonal waits up to 32 px. */
    bool active;
} badge_gesture_t;
void badge_gesture_begin(badge_gesture_t *g, int16_t x, int16_t y, uint32_t now);
void badge_gesture_move(badge_gesture_t *g, int16_t x, int16_t y);
bool badge_gesture_holding(const badge_gesture_t *g, uint32_t now);
badge_gesture_kind_t badge_gesture_end(badge_gesture_t *g, int16_t x, int16_t y, uint32_t now);
badge_gesture_kind_t badge_gesture_direction(const badge_gesture_t *g);
#define BADGE_GESTURE_AXIS_HORIZONTAL 1
#define BADGE_GESTURE_AXIS_VERTICAL 2
#define BADGE_GESTURE_AXIS_LOCK_PX 12
#define BADGE_DRAG_PAGE_EXTENT_PX 466
#define BADGE_DRAG_LEGACY_RELEASE_MS 120
#define BADGE_DRAG_COMMIT_DISTANCE_PX 160
#define BADGE_DRAG_SLOW_COMMIT_PX BADGE_DRAG_COMMIT_DISTANCE_PX
#define BADGE_DRAG_REBOUND_MS 90
#define BADGE_DRAG_COMMIT_MS 150
#define BADGE_DRAG_NO_TARGET_PX 12
/* A locked target never changes on reversal; opposite travel rebounds at zero. */
int badge_gesture_drag_offset(int raw, badge_gesture_kind_t locked_direction, bool has_target);
