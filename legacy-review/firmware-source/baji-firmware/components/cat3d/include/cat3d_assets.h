/*
 * Platform asset provider.
 *
 * cat3d.c never knows where the textures live; it only asks this function. On
 * ESP-IDF the textures are embedded into the application image with EMBED_FILES
 * (so they live in flash), and on the host they are loaded from the generated
 * .bin files at start-up.
 */
#pragma once

#include <stddef.h>
#include <stdint.h>

#include "cat3d.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Fetch the RGB565 little-endian texels for one breed.
 *
 * @param breed  0..CAT3D_BREED_COUNT-1
 * @param len    receives CAT_TEX_BYTES on success
 * @return pointer to CAT_TEX_BYTES bytes, or NULL if unavailable
 */
const uint8_t *cat3d_platform_tex(int breed, size_t *len);

#ifdef __cplusplus
}
#endif
