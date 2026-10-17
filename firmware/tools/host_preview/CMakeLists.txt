cmake_minimum_required(VERSION 3.20)
project(badge_host_preview LANGUAGES C CXX ASM)
set(CMAKE_C_STANDARD 11)
get_filename_component(FIRMWARE "${CMAKE_CURRENT_SOURCE_DIR}/../.." ABSOLUTE)
get_filename_component(WORKSPACE "${FIRMWARE}/../../.." ABSOLUTE)
# LVGL lives in this repo's managed_components in the current layout.
if(EXISTS "${FIRMWARE}/managed_components/lvgl__lvgl")
  set(LVGL_DIR "${FIRMWARE}/managed_components/lvgl__lvgl")
else()
  set(LVGL_DIR "${WORKSPACE}/firmware/managed_components/lvgl__lvgl")
endif()
set(LV_BUILD_CONF_PATH "${CMAKE_CURRENT_SOURCE_DIR}/lv_conf.h" CACHE PATH "" FORCE)
set(CONFIG_LV_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(CONFIG_LV_BUILD_DEMOS OFF CACHE BOOL "" FORCE)
set(CONFIG_LV_USE_THORVG_INTERNAL OFF CACHE BOOL "" FORCE)
add_subdirectory("${LVGL_DIR}" lvgl)
set(ASSETS "${FIRMWARE}/main/assets")

# preview_glue.c supplies a blank room canvas and the diagnostics-only l2_runtime_* symbols,
# so no objcopy-embedded warm-room blob is required for host rendering.
set(CJSON_SRC "")
if(DEFINED ENV{IDF_PATH})
  file(TO_CMAKE_PATH "$ENV{IDF_PATH}" IDF_DIR)
  if(EXISTS "${IDF_DIR}/components/json/cJSON/cJSON.c")
    set(CJSON_SRC "${IDF_DIR}/components/json/cJSON/cJSON.c")
  endif()
endif()
add_executable(badge_host_preview preview.c diag_stubs.c preview_glue.c ${CJSON_SRC}
  "${FIRMWARE}/main/badge_scene.c" "${FIRMWARE}/main/badge_gesture.c"
  "${FIRMWARE}/main/local2_core.c" "${FIRMWARE}/main/local2_day.c"
  "${ASSETS}/local2_fonts.c"
  "${ASSETS}/badge_f16.c" "${ASSETS}/badge_f20.c" "${ASSETS}/badge_f24.c" "${ASSETS}/badge_n40.c"
  "${ASSETS}/cat_idle.c" "${ASSETS}/cat_paw.c"
  "${ASSETS}/game_assets.c" "${ASSETS}/game_idle.c" "${ASSETS}/game_pet.c" "${ASSETS}/game_walk.c" "${ASSETS}/game_attention.c")
target_include_directories(badge_host_preview PRIVATE stubs diag_stubs "${FIRMWARE}/main")
# cJSON ships inside the local ESP-IDF tree; point at it when IDF_PATH is set.
if(DEFINED IDF_DIR AND EXISTS "${IDF_DIR}/components/json/cJSON/cJSON.h")
  target_include_directories(badge_host_preview PRIVATE "${IDF_DIR}/components/json/cJSON")
endif()
target_compile_definitions(badge_host_preview PRIVATE LV_LVGL_H_INCLUDE_SIMPLE)
target_link_libraries(badge_host_preview PRIVATE lvgl m)

target_compile_options(badge_host_preview PRIVATE -UNDEBUG)
# MinGW has no POSIX strlcpy/gmtime_r; host-only compat shim, never part of firmware builds.
if(WIN32)
  target_compile_options(badge_host_preview PRIVATE "-include" "${CMAKE_CURRENT_SOURCE_DIR}/stubs/host_compat.h")
endif()

add_executable(badge_diagnostics_test diag_test.c)
target_include_directories(badge_diagnostics_test PRIVATE diag_stubs stubs "${FIRMWARE}/main")
target_compile_definitions(badge_diagnostics_test PRIVATE LV_LVGL_H_INCLUDE_SIMPLE)
target_compile_options(badge_diagnostics_test PRIVATE -UNDEBUG -Wall -Wextra -Werror)
target_link_libraries(badge_diagnostics_test PRIVATE lvgl m)
