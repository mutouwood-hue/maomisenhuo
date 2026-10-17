/*
 * cat3d - a tiny, allocation-free-at-runtime software rasteriser for the
 * pixel-cat voxel model.
 *
 * Design goals, in order:
 *   1. Deterministic frame cost, so the AMOLED refresh rate can be guaranteed.
 *   2. Affine (not perspective) interpolation: the projection is orthographic, so
 *      u, v and z are all *linear* in screen space. That removes every division
 *      from the inner loop and makes the fill extremely cheap.
 *   3. No floating point in the inner loop: all per-pixel stepping is integer.
 *
 * The output is a plain RGB565 buffer which is handed to LVGL as a canvas, so the
 * panel only ever transfers the rectangle the cat actually touched.
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/* Generated model data (cat_model.h). */
#include "cat_model.h"

#ifdef __cplusplus
extern "C" {
#endif

#define CAT3D_MAX_BONES 24
#define CAT3D_BREED_COUNT 6

/* Fixed-point precision for the rasteriser's sub-pixel stepping. */
#define CAT3D_FRAC_BITS 8
#define CAT3D_FRAC_ONE (1 << CAT3D_FRAC_BITS)

/* Shading is quantised to this many levels; one LUT set per level. */
#define CAT3D_SHADE_LEVELS 32

typedef enum {
    CAT3D_OK = 0,
    CAT3D_ERR_INVALID_ARG,
    CAT3D_ERR_NO_MEM,
    CAT3D_ERR_NO_ASSET,
} cat3d_err_t;

/* PSRAM-aware allocator; supply one on ESP-IDF, leave NULL on the host. */
typedef struct {
    void *(*alloc)(size_t size);
    void (*release)(void *ptr);
} cat3d_allocator_t;

typedef struct {
    float yaw_deg;     /* turntable rotation, 0 = facing the viewer            */
    float pitch_deg;   /* positive = looking slightly down at the cat          */
    float scale;       /* pixels per model unit; 0 => auto-fit to the viewport */
    float pan_x;       /* pixel offset applied after fitting                   */
    float pan_y;
} cat3d_camera_t;

typedef struct cat3d cat3d_t;

/* -- lifecycle ------------------------------------------------------------ */

/**
 * @brief Create a renderer with an internal RGB565 viewport buffer.
 *
 * @param vp_w  viewport width in pixels (<= 466)
 * @param vp_h  viewport height in pixels (<= 466)
 * @param alloc allocator, or NULL to use malloc/free
 */
cat3d_t *cat3d_create(int vp_w, int vp_h, const cat3d_allocator_t *alloc);
void cat3d_destroy(cat3d_t *c);

/* -- configuration -------------------------------------------------------- */

/** Select the fur palette (0..CAT3D_BREED_COUNT-1, see cat3d_breed_name()). */
cat3d_err_t cat3d_set_breed(cat3d_t *c, int breed);
const char *cat3d_breed_name(int breed);

/** Choose the animation: 0 = idle, 1 = walk, 2 = paw (see cat3d_anim_name()). */
cat3d_err_t cat3d_set_anim(cat3d_t *c, int anim);
const char *cat3d_anim_name(int anim);
int cat3d_anim_count(void);

/**
 * @brief Set the animation time. Wrapped into the clip length automatically.
 * @param seconds  time in seconds since the clip started
 */
void cat3d_set_time(cat3d_t *c, float seconds);

/** Vertical background gradient painted before the cat each frame. */
void cat3d_set_background(cat3d_t *c, uint16_t top_rgb565, uint16_t bottom_rgb565);

void cat3d_set_camera(cat3d_t *c, const cat3d_camera_t *cam);

void cat3d_set_allocator(cat3d_t *c, const cat3d_allocator_t *alloc);

/**
 * @brief Force a full-viewport repaint on the next frame.
 *
 * Call this after anything else has drawn over the cat's area (for example when
 * LVGL shows a panel on top of the canvas).
 */
void cat3d_invalidate_all(cat3d_t *c);

/**
 * @brief Keep a private copy of the active breed texture in RAM.
 *
 * The embedded textures live in flash. Random texel fetches can miss the flash
 * cache, which shows up as frame-time jitter; handing the renderer a buffer of
 * CAT_TEX_BYTES (typically in PSRAM) removes that variance. Pass NULL to disable.
 *
 * @param buf   caller-owned scratch buffer, or NULL
 * @param len   buffer length; must be at least CAT_TEX_BYTES
 */
cat3d_err_t cat3d_set_texel_cache(cat3d_t *c, uint8_t *buf, size_t len);

/* -- rendering ------------------------------------------------------------ */

/**
 * @brief Rasterise the current pose into the internal viewport buffer.
 * @return the RGB565 buffer, row-major, vp_w * vp_h pixels (never NULL)
 */
const uint16_t *cat3d_render(cat3d_t *c);

/**
 * @brief Rectangle the panel has to be repainted over, in viewport coordinates.
 *
 * This is the area the last cat3d_render() changed on screen: the union of the
 * previous and the current frame's cat bounds, clamped to the viewport. The
 * union is the point, not a nicety -- cat3d_render() clears the *previous*
 * frame's rectangle in the buffer, so a caller that damaged only the current
 * frame's rectangle would leave the strip the cat has just vacated stale on the
 * panel (ghosting).
 *
 * Special cases:
 *   - nothing was drawn and nothing was drawn before -> w and h are 0;
 *   - the cat left the screen (no pixels this frame, some last frame) -> the
 *     previous frame's rectangle, whose vacated pixels still need erasing;
 *   - the frame was rendered with a forced full repaint (see
 *     cat3d_invalidate_all()) -> the whole viewport.
 *
 * A zero-sized result means the viewport is unchanged, so a caller is free to
 * skip the invalidation entirely.
 */
void cat3d_dirty_rect(const cat3d_t *c, int *x, int *y, int *w, int *h);

int cat3d_view_w(const cat3d_t *c);
int cat3d_view_h(const cat3d_t *c);

/**
 * @brief Model-space AABB of the current pose, useful for tighter dirty rects.
 */
void cat3d_pose_bounds(const cat3d_t *c, float *min3, float *max3);

/* -- telemetry ------------------------------------------------------------ */

/** Number of faces that survived back-face culling in the last frame. */
int cat3d_last_faces_drawn(const cat3d_t *c);
/** Number of pixels written by the last frame. */
int cat3d_last_pixels(const cat3d_t *c);
/** Size in bytes of the RGB565 viewport buffer. */
size_t cat3d_frame_bytes(const cat3d_t *c);

/* -- assets --------------------------------------------------------------- */

/**
 * @brief Fetch the RGB565 texel data for a breed (CAT_TEX_BYTES bytes).
 * @return NULL if the asset is unavailable
 */
const uint8_t *cat3d_asset_texels(int breed, size_t *out_len);

#ifdef __cplusplus
}
#endif
