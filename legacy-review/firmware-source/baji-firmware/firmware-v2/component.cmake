set(v2 "${CMAKE_CURRENT_LIST_DIR}")
# Trust roots are public, but supplied by manufacturing outside this repository.
# Empty defaults fail closed; no test key or synthetic model is linked implicitly.
foreach(kind IN ITEMS UPDATE PEER)
    set(root_content "")
    if(DEFINED BJ_${kind}_PUBLIC_KEY_FILE AND NOT "${BJ_${kind}_PUBLIC_KEY_FILE}" STREQUAL "")
        if(NOT EXISTS "${BJ_${kind}_PUBLIC_KEY_FILE}")
            message(FATAL_ERROR "Missing external ${kind} trust root")
        endif()
        file(READ "${BJ_${kind}_PUBLIC_KEY_FILE}" root_content)
        if(NOT root_content MATCHES "-----BEGIN PUBLIC KEY-----")
            message(FATAL_ERROR "Expected external ${kind} public PEM")
        endif()
    endif()
    string(REPLACE "\\" "\\\\" root_content "${root_content}")
    string(REPLACE "\"" "\\\"" root_content "${root_content}")
    string(REPLACE "\r" "" root_content "${root_content}")
    string(REPLACE "\n" "\\n" root_content "${root_content}")
    string(TOLOWER "${kind}" lower_kind)
    file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/baji_${lower_kind}_root.c" "#include <stddef.h>\nconst unsigned char bj_${lower_kind}_root_pem[] = \"${root_content}\";\nconst size_t bj_${lower_kind}_root_pem_size = sizeof(bj_${lower_kind}_root_pem);\n")
endforeach()
file(GLOB assets "${v2}/render/generated/*.c")
idf_component_register(SRCS
    "${v2}/interaction/baji_active.c"
    "${v2}/interaction/baji_peer_auth.c"
    "${v2}/interaction/baji_peer.c"
    "${v2}/runtime/baji_peer_crypto.c"
    "${v2}/runtime/baji_peer_ble.c"
    "${CMAKE_CURRENT_BINARY_DIR}/baji_update_root.c"
    "${CMAKE_CURRENT_BINARY_DIR}/baji_peer_root.c"
    "${v2}/runtime/baji_main.c"
    "${v2}/runtime/baji_pmic.c"
    "${v2}/runtime/baji_ble.c"
    "${v2}/runtime/baji_audio_runtime.c"
    "${v2}/runtime/baji_update_runtime.c"
    "${v2}/runtime/baji_asset_runtime.c"
    "${v2}/interaction/baji_update.c"
    "${v2}/interaction/baji_env_model.c"
    "${v2}/interaction/baji_audio_policy.c"
    "${v2}/interaction/baji_social_policy.c"
    "${v2}/runtime/baji_data_runtime.c"
    "${v2}/interaction/baji_data.c"
    "${v2}/interaction/baji_gesture.c"
    "${v2}/interaction/baji_scene.c"
    "${v2}/interaction/baji_controller.c"
    "${v2}/interaction/baji_power.c"
    "${v2}/interaction/baji_protocol.c"
    "${v2}/interaction/baji_link.c"
    "${v2}/render/baji_render.c"
    "ui/fonts/badge_f16.c" "ui/fonts/badge_n44.c"
    ${assets}
    INCLUDE_DIRS "${v2}/interaction" "${v2}/render" "${v2}/render/generated")
target_compile_definitions(${COMPONENT_LIB} PRIVATE LV_LVGL_H_INCLUDE_SIMPLE)
if(DEFINED BJ_ENV_MODEL_HEADER AND NOT "${BJ_ENV_MODEL_HEADER}" STREQUAL "")
    if(NOT EXISTS "${BJ_ENV_MODEL_HEADER}" OR NOT BJ_ENV_ALLOW_EXPERIMENTAL)
        message(FATAL_ERROR "External model requires existing header and explicit BJ_ENV_ALLOW_EXPERIMENTAL=ON")
    endif()
    file(TO_CMAKE_PATH "${BJ_ENV_MODEL_HEADER}" model_header)
    target_compile_definitions(${COMPONENT_LIB} PRIVATE "BJ_ENV_MODEL_HEADER=\"${model_header}\"" BJ_ENV_ALLOW_EXPERIMENTAL=1)
endif()
target_compile_options(${COMPONENT_LIB} PRIVATE -Wall -Wextra -Werror)
