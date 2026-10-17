/*
 * badge_assets - the specification's icons, sounds and fonts.
 *
 * The interaction specification ships 28 icons (16x16 PNG, 1x and 3x), five
 * 16-bit mono 16 kHz prompt sounds, and four LVGL fonts generated from Noto Sans
 * SC Medium (16 / 20 / 24 / 40 px, 4bpp, uncompressed). This module is the only
 * place in the firmware that knows how they are stored.
 *
 * Icons are converted to RGBA8888 at build time by tools/gen-badge-assets.mjs and
 * blitted by badge_paint with an integer nearest-neighbour scale, which is what
 * the specification asks for ("按整数倍最近邻放大"). They are deliberately NOT
 * lv_image descriptors: the firmware has PNG decoding switched off (LV_USE_LODEPNG
 * / LV_USE_LIBPNG are unset) and a canvas blit gives exact control of the
 * de-pixelation the spec's icons were designed for.
 *
 * Generated data lives in main/ui/badge_assets_data.c; do not edit that file.
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "lvgl.h"

#include "badge_spec.h"

#ifdef __cplusplus
extern "C" {
#endif

/* The four faces, declared by the generated font files (fonts/badge_f*.c). */
extern const lv_font_t badge_f16;
extern const lv_font_t badge_f20;
extern const lv_font_t badge_f24;
extern const lv_font_t badge_n40;

/* BADGE_ICON_PX (16) comes from badge_spec.h: the asset generator and the
 * geometry check must agree on it. */

/* Prompt sounds, in the order the specification maps them. */
typedef enum {
    SND_PET = 0,       /* meow_short */
    SND_CARE_DONE = 1, /* meow_happy */
    SND_MEET = 2,      /* chime */
    SND_WAKE = 3,      /* blip */
    SND_ERROR = 4,     /* bonk */
    SND_COUNT
} badge_snd_t;

/** @brief Sample rate of every prompt sound (16 kHz, 16-bit, mono). */
#define BADGE_PCM_RATE 16000

/**
 * @brief The LVGL face for a badge_font_t (BADGE_FONT_F16..N40).
 *
 * Returns badge_f16 for an out-of-range id rather than NULL: a missing face draws
 * blank boxes silently, and a wrong-but-legible font is the better failure.
 */
const lv_font_t *badge_font(int font_id);

/**
 * @brief RGBA8888 pixels of an icon, BADGE_ICON_PX * BADGE_ICON_PX * 4 bytes.
 *
 * @param icon  index into the spec's icon list, or BADGE_ICON_DYN_PLACE /
 *              BADGE_ICON_DYN_GUIDE (resolved by the caller, which knows the
 *              current screen), or BADGE_ICON_NONE
 * @return NULL when there is no such icon
 */
const uint8_t *badge_icon_rgba(int icon);

/** @brief The spec's name for an icon ("bt", "bowl", ...), or "" when unknown. */
const char *badge_icon_name(int icon);

/** @brief Icon index for a spec name, or BADGE_ICON_NONE. */
int badge_icon_index(const char *name);

/**
 * @brief PCM samples for a prompt sound (16 kHz, 16-bit, mono).
 * @param len  receives the sample count (not bytes)
 * @return NULL when the sound does not exist
 */
const int16_t *badge_pcm(int snd, size_t *len);

/** @brief Total bytes of RGBA icon data, for the boot log's memory report. */
size_t badge_assets_icon_bytes(void);

#ifdef __cplusplus
}
#endif
