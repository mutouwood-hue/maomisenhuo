#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "lvgl.h"

/* Original PCAT poses; walk/attention are local presentation, never a wire event.
 * Every sprite uses one shared 192x208 canvas and foot anchor (96,196).
 * RGB565A8 or LVGL indexed descriptors are accepted without per-frame cropping. */
typedef enum {
    BADGE_SCENE_IDLE, BADGE_SCENE_PET, BADGE_SCENE_WALK,
    BADGE_SCENE_ATTENTION, BADGE_SCENE_CLIP_COUNT
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
void badge_scene_play(badge_scene_t *scene, badge_scene_clip_id_t clip, uint32_t now);
void badge_scene_tick(badge_scene_t *scene, uint32_t now, bool animate);
void badge_scene_set_dimmed(badge_scene_t *scene, bool dimmed);
bool badge_scene_has_animation(const badge_scene_t *scene);
