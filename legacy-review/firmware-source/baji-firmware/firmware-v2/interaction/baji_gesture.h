#ifndef BAJI_GESTURE_H
#define BAJI_GESTURE_H
#include <stdbool.h>
#include <stdint.h>
/* Pure input recogniser. No framework, allocation, storage or rendering dependency. */
typedef enum { BJ_DIR_NONE, BJ_UP, BJ_DOWN, BJ_LEFT, BJ_RIGHT } bj_direction_t;
typedef enum { BJ_INPUT_NONE, BJ_TAP, BJ_HOLD_START, BJ_HOLD_END, BJ_COMMIT, BJ_CANCEL, BJ_RUBBER } bj_input_kind_t;
typedef struct {
    int panel, lock_px, tap_move_px, fast_px, commit_px, rubber_max_px;
    uint32_t tap_ms, fast_ms, hold_ms, reverse_window_ms;
    float reverse_speed, rubber_ratio;
    uint32_t commit_ms, commit_min_ms, cancel_ms, rubber_ms;
} bj_gesture_config_t;
typedef struct { uint32_t time; int x, y; } bj_point_t;
typedef struct {
    bj_input_kind_t kind;
    bj_direction_t direction;
    int x, y, offset;
    uint32_t duration_ms;
} bj_input_result_t;
#define BJ_HISTORY_CAPACITY 128
/* Capacity covers 1 kHz sampling over the HTML's 120 ms history window. */
typedef struct {
    bj_gesture_config_t config;
    bool pressed, hold_allowed, holding;
    int axis, x0, y0, x, y;
    uint64_t max_move_sq;
    uint32_t started;
    bj_point_t history[BJ_HISTORY_CAPACITY];
    unsigned head, count;
} bj_gesture_t;
bj_gesture_config_t bj_gesture_html_config(void);
bool bj_gesture_init(bj_gesture_t *g, const bj_gesture_config_t *config);
void bj_gesture_press(bj_gesture_t *g, int x, int y, uint32_t now, bool hold_allowed);
void bj_gesture_move(bj_gesture_t *g, int x, int y, uint32_t now);
bj_input_result_t bj_gesture_tick(bj_gesture_t *g, uint32_t now);
bj_direction_t bj_gesture_direction(const bj_gesture_t *g);
int bj_gesture_offset(const bj_gesture_t *g, bool has_target);
bj_input_result_t bj_gesture_release(bj_gesture_t *g, int x, int y, uint32_t now, bool has_target, bool cancelled);
#endif
