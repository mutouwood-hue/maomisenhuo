idf_component_register(SRCS "main.c" "badge_state.c" "badge_wire.c" "badge_gesture.c" "badge_ble.c" "badge_pages.c" "badge_scene.c"
    "assets/badge_f16.c" "assets/badge_f20.c" "assets/badge_f24.c" "assets/badge_n40.c"
    "assets/cat_idle.c" "assets/cat_paw.c"
    "assets/game_assets.c" "assets/game_idle.c" "assets/game_pet.c" "assets/game_walk.c" "assets/game_attention.c"
    INCLUDE_DIRS "." REQUIRES nvs_flash bt json esp_timer esp_hw_support
    PRIV_REQUIRES esp_app_format)
# The original generated font supports this switch; preserve its source bytes.
target_compile_definitions(${COMPONENT_LIB} PRIVATE LV_LVGL_H_INCLUDE_SIMPLE)
