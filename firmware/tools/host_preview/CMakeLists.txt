cmake_minimum_required(VERSION 3.20)
project(badge_host_preview LANGUAGES C CXX ASM)
set(CMAKE_C_STANDARD 11)
get_filename_component(FIRMWARE "${CMAKE_CURRENT_SOURCE_DIR}/../.." ABSOLUTE)
set(LV_BUILD_CONF_PATH "${CMAKE_CURRENT_SOURCE_DIR}/lv_conf.h" CACHE PATH "" FORCE)
set(CONFIG_LV_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(CONFIG_LV_BUILD_DEMOS OFF CACHE BOOL "" FORCE)
set(CONFIG_LV_USE_THORVG_INTERNAL OFF CACHE BOOL "" FORCE)
add_subdirectory("${FIRMWARE}/managed_components/lvgl__lvgl" lvgl)
set(ASSETS "${FIRMWARE}/main/assets")
add_executable(badge_host_preview preview.c "${FIRMWARE}/main/badge_scene.c" "${FIRMWARE}/main/badge_gesture.c"
  "${ASSETS}/badge_f16.c" "${ASSETS}/badge_f20.c" "${ASSETS}/badge_f24.c" "${ASSETS}/badge_n40.c"
  "${ASSETS}/cat_idle.c" "${ASSETS}/cat_paw.c"
  "${ASSETS}/game_assets.c" "${ASSETS}/game_idle.c" "${ASSETS}/game_pet.c" "${ASSETS}/game_walk.c" "${ASSETS}/game_attention.c")
target_include_directories(badge_host_preview PRIVATE stubs "${FIRMWARE}/main")
target_compile_definitions(badge_host_preview PRIVATE LV_LVGL_H_INCLUDE_SIMPLE)
target_link_libraries(badge_host_preview PRIVATE lvgl m)

target_compile_options(badge_host_preview PRIVATE -UNDEBUG)
