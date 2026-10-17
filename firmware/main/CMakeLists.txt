# Final local2 sources only. Missing new modules deliberately fail configuration;
# never fall back to legacy state/BLE under the new application version.
set(local2_sources
    main.c badge_diagnostics.c
    local2_core.c local2_store.c local2_day.c
    local2_ble.c local2_peer.c local2_wire.c badge_local2_facade.c
    badge_gesture.c badge_pages.c badge_scene.c
    assets/badge_f16.c assets/badge_f20.c assets/badge_f24.c assets/badge_n40.c
    assets/local2_fonts.c assets/warm_room.c
    assets/cat_idle.c assets/cat_paw.c
    assets/game_assets.c assets/game_idle.c assets/game_pet.c
    assets/game_walk.c assets/game_attention.c)
foreach(local2_source IN LISTS local2_sources)
    if(NOT EXISTS "${CMAKE_CURRENT_LIST_DIR}/${local2_source}")
        message(FATAL_ERROR "local2 integration pending: ${local2_source}")
    endif()
endforeach()
idf_component_register(SRCS ${local2_sources}
    INCLUDE_DIRS "."
    REQUIRES nvs_flash bt json esp_timer esp_hw_support heap mbedtls
    PRIV_REQUIRES esp_app_format esp_driver_usb_serial_jtag
    EMBED_FILES "assets/warm-room.rgb565")
target_compile_definitions(${COMPONENT_LIB} PRIVATE LV_LVGL_H_INCLUDE_SIMPLE)
target_compile_options(${COMPONENT_LIB} PRIVATE -Wall -Wextra -Werror)
