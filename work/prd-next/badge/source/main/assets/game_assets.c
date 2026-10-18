/* Generated: original PCAT cycles, fixed shared 192x208 frame / anchor (96,196). */
#include "game_assets.h"

static const lv_image_dsc_t *const game_idle_frames[] = {&game_idle_00,&game_idle_01,&game_idle_02,&game_idle_03,&game_idle_04,&game_idle_05,&game_idle_06,&game_idle_07,&game_idle_08,&game_idle_09,&game_idle_10,&game_idle_11,&game_idle_12,&game_idle_13,&game_idle_14,&game_idle_15,&game_idle_16,&game_idle_17,&game_idle_18,&game_idle_19};

static const lv_image_dsc_t *const game_pet_frames[] = {&game_pet_00,&game_pet_01,&game_pet_02,&game_pet_03,&game_pet_04,&game_pet_05,&game_pet_06,&game_pet_07,&game_pet_08,&game_pet_09,&game_pet_10,&game_pet_11,&game_pet_12,&game_pet_13,&game_pet_14,&game_pet_15,&game_pet_16,&game_pet_17,&game_pet_18,&game_pet_19,&game_pet_20,&game_pet_21,&game_pet_22,&game_pet_23};

static const lv_image_dsc_t *const game_walk_frames[] = {&game_walk_00,&game_walk_01,&game_walk_02,&game_walk_03,&game_walk_04,&game_walk_05,&game_walk_06,&game_walk_07,&game_walk_08,&game_walk_09};

static const lv_image_dsc_t *const game_attention_frames[] = {&game_attention_00,&game_attention_01,&game_attention_02,&game_attention_03,&game_attention_04,&game_attention_05,&game_attention_06,&game_attention_07,&game_attention_08,&game_attention_09,&game_attention_10,&game_attention_11};

static const badge_scene_assets_t game_bank = { .clips = {
    [BADGE_SCENE_IDLE] = {.frames=game_idle_frames,.count=20,.cycle_ms=3200,.loop=true},
    [BADGE_SCENE_PET] = {.frames=game_pet_frames,.count=24,.cycle_ms=2400,.loop=false},
    [BADGE_SCENE_WALK] = {.frames=game_walk_frames,.count=10,.cycle_ms=1000,.loop=true},
    [BADGE_SCENE_ATTENTION] = {.frames=game_attention_frames,.count=12,.cycle_ms=3200,.loop=true},
}, .room = NULL };

const badge_scene_assets_t *badge_game_assets(void) {return &game_bank;}
