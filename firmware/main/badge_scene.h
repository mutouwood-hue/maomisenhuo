#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "lvgl.h"
#include "local2_core.h"
#include "badge_appearance.h"

/* Original PCAT poses plus authored native action clips; all are presentation only.
 * Every sprite uses one shared 192x208 canvas and foot anchor (96,196).
 * RGB565A8 or LVGL indexed descriptors are accepted without per-frame cropping. */
typedef enum {
    BADGE_SCENE_IDLE, BADGE_SCENE_PET, BADGE_SCENE_WALK,
    BADGE_SCENE_ATTENTION, BADGE_SCENE_SNIFF, BADGE_SCENE_POUNCE,
    BADGE_SCENE_CLIP_COUNT
} badge_scene_clip_id_t;
typedef struct {
    const lv_image_dsc_t *const *frames;
    uint16_t count;
    uint32_t cycle_ms;
    bool loop;
} badge_scene_clip_t;
typedef struct {
    badge_scene_clip_t clips[BADGE_SCENE_CLIP_COUNT];
    const lv_image_dsc_t *room; /* Reserved enhancement; reference-first UI ignores it. */
} badge_scene_assets_t;

/* Defined by the generated asset registry, explicitly linked in main/CMakeLists.
 * Returning NULL keeps the recovery fallback visible; it is not animation QA. */
const badge_scene_assets_t *badge_game_assets(void);
typedef struct badge_scene badge_scene_t;
badge_scene_t *badge_scene_create(lv_obj_t *parent);
void badge_scene_set_face(badge_scene_t *scene, unsigned face);
void badge_scene_set_compact(badge_scene_t *scene, bool compact);
void badge_scene_set_foot_y(badge_scene_t *scene,int foot_y);
void badge_scene_play(badge_scene_t *scene, badge_scene_clip_id_t clip, uint32_t now);
void badge_scene_tick(badge_scene_t *scene, uint32_t now, bool animate);
void badge_scene_set_dimmed(badge_scene_t *scene, bool dimmed);
bool badge_scene_has_animation(const badge_scene_t *scene);
/* Presentation only: saved context is static until a fresh snapshot this boot.
 * action is a short observed/locally persisted action; interaction is an optional
 * volatile detail for that action, never a care event or inferred stat. */
void badge_scene_set_context(badge_scene_t *,bool known,l2_scene_t,l2_weather_t,l2_action_t,bool live);
void badge_scene_set_interaction(badge_scene_t *,l2_interaction_t);

/* Local presentation only; no domain events, storage or timer changes. */
void badge_scene_enable_world(badge_scene_t *);
void badge_scene_set_overlay(badge_scene_t *,bool);
void badge_scene_set_slide_offset(badge_scene_t *,int);

bool badge_scene_is_warm(const badge_scene_t *scene);
bool badge_scene_thought_visible(const badge_scene_t *scene,uint32_t now);

bool badge_scene_light_background(const badge_scene_t *scene);

void badge_scene_set_interacting(badge_scene_t *scene,bool active);
/* GUI-only checkpoint for composing the other HOME face. */
bool badge_scene_save_pose(badge_scene_t *scene);
void badge_scene_restore_pose(badge_scene_t *scene);
int badge_scene_prop_offset(const badge_scene_t *scene);

void badge_scene_cancel_prop(badge_scene_t *scene);

void badge_scene_day_preview(badge_scene_t *scene,bool known,unsigned kind,unsigned minute);

/* Neutral anticipation presentation only; no event or historical action. */
void badge_scene_day_expectation(badge_scene_t *scene);

void badge_scene_day_current(badge_scene_t *,bool known,l2_scene_t,l2_weather_t,l2_action_t,bool live);

/* Parent integration supplies validated matching-pet presentation data. NULL
 * clears it on identity/reset; never infer growth from encounter.stage or time.
 * These calls do not emit events, change save state or own a refresh timer. */
void badge_scene_set_appearance(badge_scene_t *,const badge_appearance_t *);
bool badge_scene_appearance_ready(const badge_scene_t *);
