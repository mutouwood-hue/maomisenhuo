#ifndef BAJI_SCENE_H
#define BAJI_SCENE_H
#include "baji_gesture.h"
typedef enum { BJ_PAIR, BJ_GUIDE, BJ_MAIN_A, BJ_MAIN_B, BJ_MAIN_C, BJ_CARE, BJ_STATUS, BJ_SETTINGS, BJ_VOICE, BJ_DONE } bj_screen_t;
typedef enum { BJ_GUIDE_DO, BJ_GUIDE_BACK, BJ_GUIDE_OK } bj_guide_phase_t;
typedef struct {
    bj_screen_t screen, voice_previous;
    bool local_experience, authenticated, tutorial_active;
    uint8_t step, face;
    bj_guide_phase_t phase;
    bj_direction_t back_direction;
    uint32_t success_t0, back_enter_t0;
    bool voice_success_pending;
    uint32_t voice_return_t0;
} bj_scene_t;
void bj_scene_init(bj_scene_t *s);
bool bj_scene_start_local(bj_scene_t *s);
/* Adapter must verify the owner outside the core before delivering this event. */
void bj_scene_owner_verified(bj_scene_t *s);
int bj_scene_target(const bj_scene_t *s, bj_direction_t dir);
bool bj_scene_commit(bj_scene_t *s, bj_direction_t dir, uint32_t now);
bool bj_scene_can_hold(const bj_scene_t *s);
void bj_scene_hold_start(bj_scene_t *s);
void bj_scene_hold_end(bj_scene_t *s, uint32_t now, bool cancelled);
void bj_scene_tap(bj_scene_t *s, int x, int y, uint32_t now);
void bj_scene_tick(bj_scene_t *s, uint32_t now);
#endif
