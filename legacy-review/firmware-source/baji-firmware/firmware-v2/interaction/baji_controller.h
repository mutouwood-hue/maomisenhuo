#ifndef BAJI_CONTROLLER_H
#define BAJI_CONTROLLER_H
#include "baji_scene.h"
typedef struct {
    bj_scene_t source, target;
    int source_x, source_y, target_x, target_y;
    bool target_visible, autonomous_paused;
    /* Axis-locked touch or unfinished transition, including zero displacement. */
    bool sliding;
} bj_frame_t;
typedef struct {
    bj_scene_t scene;
    bj_gesture_t gesture;
    bj_input_kind_t motion;
    bj_direction_t direction;
    int start_offset;
    uint32_t motion_t0, duration;
    bool suspended;
    uint32_t suspended_t0;
} bj_controller_t;
void bj_controller_init(bj_controller_t *c);
/* Serialized caller; suspend cancels pending work without committing it.
 * Resume excludes suspended time from tutorial timers (uint32 wrap supported).
 * This does not stop physical audio/BLE or choose a power recovery policy. */
void bj_controller_set_suspended(bj_controller_t *c,bool suspended,uint32_t now);
void bj_controller_press(bj_controller_t *c,int x,int y,uint32_t now);
void bj_controller_move(bj_controller_t *c,int x,int y,uint32_t now);
void bj_controller_release(bj_controller_t *c,int x,int y,uint32_t now,bool cancelled);
void bj_controller_tick(bj_controller_t *c,uint32_t now);
bj_frame_t bj_controller_frame(const bj_controller_t *c,uint32_t now);
#endif
