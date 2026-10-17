/*
 * cat3d - a small software rasteriser for the pixel-cat voxel model.
 *
 * Frame-rate strategy
 * -------------------
 * The AMOLED panel is driven over QSPI by LVGL, so the two costs that matter are
 * (a) how long we spend rasterising and (b) how many pixels LVGL has to push.
 *
 *   * The projection is ORTHOGRAPHIC, which makes u, v and z exactly affine in
 *     screen space. Every division therefore lives in per-triangle setup, never in
 *     the per-pixel loop.
 *   * The fill loop is pure integer: u and v step by a fixed 16.16 increment, and
 *     shading is a set of small lookup tables indexed by the 5/6/5 colour channels.
 *   * The background is only repainted inside the dirty rectangle, and the dirty
 *     rectangle is the union of the previous and current frame, so a moving cat
 *     leaves no trail without ever touching the rest of the screen.
 *   * Telemetry (faces drawn / pixels written) is exposed so the caller can verify
 *     the budget instead of guessing.
 */

#include "cat3d.h"
#include "cat3d_assets.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

#define CAT3D_MAX_W 512
#define CAT3D_MAX_H 512

#ifndef CAT3D_SKIP_TRANSPARENT
/* Transparent texels are encoded as magenta (0xF81F) by the asset generator. */
#define CAT3D_SKIP_TRANSPARENT 1
#endif

#define CAT3D_TRANSPARENT_RGB565 0xF81Fu

/* ------------------------------------------------------------------ */
/* 4x4 float matrices, column-major (m[col*4 + row]), matching the JS reference */
/* ------------------------------------------------------------------ */

static void m4_identity(float *m)
{
    memset(m, 0, 16 * sizeof(float));
    m[0] = m[5] = m[10] = m[15] = 1.0f;
}

/* o = a * b */
static void m4_mul(float *o, const float *a, const float *b)
{
    for (int c = 0; c < 4; c++) {
        for (int r = 0; r < 4; r++) {
            o[c * 4 + r] = a[r] * b[c * 4 + 0] + a[4 + r] * b[c * 4 + 1] +
                           a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        }
    }
}

static void m4_translate(float *m, float x, float y, float z)
{
    m4_identity(m);
    m[12] = x;
    m[13] = y;
    m[14] = z;
}

static void m4_scale(float *m, float x, float y, float z)
{
    m4_identity(m);
    m[0] = x;
    m[5] = y;
    m[10] = z;
}

static void m4_rot_x(float *m, float deg)
{
    const float r = deg * (float)M_PI / 180.0f;
    const float c = cosf(r), s = sinf(r);
    m4_identity(m);
    m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
}

static void m4_rot_y(float *m, float deg)
{
    const float r = deg * (float)M_PI / 180.0f;
    const float c = cosf(r), s = sinf(r);
    m4_identity(m);
    m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
}

static void m4_rot_z(float *m, float deg)
{
    const float r = deg * (float)M_PI / 180.0f;
    const float c = cosf(r), s = sinf(r);
    m4_identity(m);
    m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
}

/* Transform a point by an affine matrix (w = 1). */
static inline void m4_point(const float *m, const float *v, float *out)
{
    out[0] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
    out[1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
    out[2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
}

/* ------------------------------------------------------------------ */
/* renderer state                                                      */
/* ------------------------------------------------------------------ */

typedef struct {
    uint16_t face;
    uint8_t shade;   /* quantised Lambert level, index into the shading LUTs */
    uint8_t pad;
    float depth;
} draw_item_t;

struct cat3d {
    int vp_w, vp_h;

    cat3d_allocator_t alloc;
    uint16_t *fb;

    int breed;
    int anim;
    float time;
    uint16_t bg_top, bg_bottom;
    uint16_t row_color[CAT3D_MAX_H];
    cat3d_camera_t cam;

    /* model-space bounds, computed once */
    float focus[3];
    float fit_scale;
    float radius;

    /* per-frame scratch */
    float bone_local[CAT_BONE_COUNT][16];
    float bone_world[CAT_BONE_COUNT][16];
    float bone_view[CAT_BONE_COUNT][16];
    float vx[CAT_VERT_COUNT];
    float vy[CAT_VERT_COUNT];
    float vz[CAT_VERT_COUNT];

    draw_item_t items[CAT_FACE_COUNT];
    int item_count;

    /* shading lookup tables, rebuilt only when the level count changes */
    uint16_t lut_r[CAT3D_SHADE_LEVELS][32];
    uint16_t lut_g[CAT3D_SHADE_LEVELS][64];
    uint16_t lut_b[CAT3D_SHADE_LEVELS][32];

    /* normalised view-space light direction, derived once from LIGHT_DIR_RAW */
    float light[3];

    /* optional private copy of the active texture, to avoid flash-cache jitter */
    uint8_t *tex_cache;
    size_t tex_cache_len;
    int tex_cache_breed;

    /* dirty bookkeeping: inclusive bounds, plus the previous frame's bounds */
    int prev_x0, prev_y0, prev_x1, prev_y1;
    int dirty_x0, dirty_y0, dirty_x1, dirty_y1;

    int last_faces;
    int last_pixels;
    size_t last_bytes;
    /* 1 when this is the first frame or a full repaint was requested */
    int full_repaint;
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/*
 * Light direction in view space: from the upper left, slightly in front of the
 * camera. Normalised at start-up rather than written out as literals, because a
 * hand-transcribed triple is an easy way to get a subtly wrong shading ramp.
 */
#define CAT3D_LIGHT_RAW_X 0.35f
#define CAT3D_LIGHT_RAW_Y 0.62f
#define CAT3D_LIGHT_RAW_Z 0.70f

static void lut_build(cat3d_t *c)
{
    for (int l = 0; l < CAT3D_SHADE_LEVELS; l++) {
        const float f = (float)l / (float)(CAT3D_SHADE_LEVELS - 1);
        for (int i = 0; i < 32; i++) c->lut_r[l][i] = (uint16_t)((float)i * f + 0.5f);
        for (int i = 0; i < 64; i++) c->lut_g[l][i] = (uint16_t)((float)i * f + 0.5f);
        for (int i = 0; i < 32; i++) c->lut_b[l][i] = (uint16_t)((float)i * f + 0.5f);
    }
}

static void light_build(cat3d_t *c)
{
    const float lx = CAT3D_LIGHT_RAW_X;
    const float ly = CAT3D_LIGHT_RAW_Y;
    const float lz = CAT3D_LIGHT_RAW_Z;
    const float n = sqrtf(lx * lx + ly * ly + lz * lz);
    if (n > 1e-9f) {
        c->light[0] = lx / n;
        c->light[1] = ly / n;
        c->light[2] = lz / n;
    } else {
        c->light[0] = 0.0f;
        c->light[1] = 0.0f;
        c->light[2] = 1.0f;
    }
}

static void bg_rebuild(cat3d_t *c)
{
    const int r0 = (c->bg_top >> 11) & 31, g0 = (c->bg_top >> 5) & 63, b0 = c->bg_top & 31;
    const int r1 = (c->bg_bottom >> 11) & 31, g1 = (c->bg_bottom >> 5) & 63, b1 = c->bg_bottom & 31;
    const int n = c->vp_h > 1 ? c->vp_h - 1 : 1;
    for (int y = 0; y < c->vp_h; y++) {
        const int r = r0 + (r1 - r0) * y / n;
        const int g = g0 + (g1 - g0) * y / n;
        const int b = b0 + (b1 - b0) * y / n;
        c->row_color[y] = (uint16_t)((r << 11) | (g << 5) | b);
    }
}

static void compute_model_bounds(cat3d_t *c)
{
    float mn[3] = {1e9f, 1e9f, 1e9f};
    float mx[3] = {-1e9f, -1e9f, -1e9f};
    for (int i = 0; i < CAT_VERT_COUNT; i++) {
        const float *v = &cat_verts[i].x;
        for (int a = 0; a < 3; a++) {
            if (v[a] < mn[a]) mn[a] = v[a];
            if (v[a] > mx[a]) mx[a] = v[a];
        }
    }
    for (int a = 0; a < 3; a++) c->focus[a] = (mn[a] + mx[a]) * 0.5f;

    /* Radius from the focus to the farthest corner, used for stable auto-fitting. */
    float r2 = 0.0f;
    for (int i = 0; i < CAT_VERT_COUNT; i++) {
        const float *v = &cat_verts[i].x;
        const float dx = v[0] - c->focus[0];
        const float dy = v[1] - c->focus[1];
        const float dz = v[2] - c->focus[2];
        const float d = dx * dx + dy * dy + dz * dz;
        if (d > r2) r2 = d;
    }
    c->radius = sqrtf(r2);
    /* Fit the bounding sphere into the viewport with a small margin. */
    const int m = (c->vp_w < c->vp_h) ? c->vp_w : c->vp_h;
    c->fit_scale = (float)m * 0.5f * 0.94f / (c->radius > 0.01f ? c->radius : 1.0f);
}

/* An empty rect is encoded as x0 > x1. */
static void dirty_reset(cat3d_t *c)
{
    c->dirty_x0 = c->vp_w;
    c->dirty_y0 = c->vp_h;
    c->dirty_x1 = -1;
    c->dirty_y1 = -1;
}

static inline void dirty_add(cat3d_t *c, int x0, int y0, int x1, int y1)
{
    if (x1 < x0) { const int t = x0; x0 = x1; x1 = t; }
    if (y1 < y0) { const int t = y0; y0 = y1; y1 = t; }
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > c->vp_w - 1) x1 = c->vp_w - 1;
    if (y1 > c->vp_h - 1) y1 = c->vp_h - 1;
    if (x0 > x1 || y0 > y1) return;
    if (x0 < c->dirty_x0) c->dirty_x0 = x0;
    if (y0 < c->dirty_y0) c->dirty_y0 = y0;
    if (x1 > c->dirty_x1) c->dirty_x1 = x1;
    if (y1 > c->dirty_y1) c->dirty_y1 = y1;
}

/* ------------------------------------------------------------------ */
/* animation -> bone matrices                                          */
/* ------------------------------------------------------------------ */

static void sample_vec3(const cat_track_t *tr, const cat_key_t *keys, float t, float *out)
{
    if (tr->count == 0) return;
    const cat_key_t *k = &keys[tr->first];
    if (tr->count == 1 || t <= k[0].t) {
        out[0] = k[0].v[0]; out[1] = k[0].v[1]; out[2] = k[0].v[2];
        return;
    }
    const cat_key_t *last = &keys[tr->first + tr->count - 1];
    if (t >= last->t) {
        out[0] = last->v[0]; out[1] = last->v[1]; out[2] = last->v[2];
        return;
    }
    int i = 0;
    while (i < tr->count - 1 && k[i + 1].t < t) i++;
    const cat_key_t *a = &k[i];
    const cat_key_t *b = &k[i + 1];
    const float span = b->t - a->t;
    const float f = span > 0.0f ? (t - a->t) / span : 0.0f;
    out[0] = a->v[0] + (b->v[0] - a->v[0]) * f;
    out[1] = a->v[1] + (b->v[1] - a->v[1]) * f;
    out[2] = a->v[2] + (b->v[2] - a->v[2]) * f;
}

static void update_bones(cat3d_t *c)
{
    const cat_anim_t *an = &cat_anims[c->anim];
    float tt = c->time;
    if (an->length > 0.0f) {
        tt = fmodf(tt, an->length);
        if (tt < 0.0f) tt += an->length;
    }

    for (int b = 0; b < CAT_BONE_COUNT; b++) {
        float pos[3] = {0.0f, 0.0f, 0.0f};
        float rot[3] = {0.0f, 0.0f, 0.0f};
        float scl[3] = {1.0f, 1.0f, 1.0f};

        for (int i = 0; i < an->track_count; i++) {
            const cat_track_t *tr = &cat_tracks[an->first_track + i];
            if (tr->bone != b) continue;
            float v[3];
            switch (tr->chan) {
                case 0: sample_vec3(tr, cat_keys, tt, v); pos[0] = v[0]; pos[1] = v[1]; pos[2] = v[2]; break;
                case 1: sample_vec3(tr, cat_keys, tt, v); rot[0] = v[0]; rot[1] = v[1]; rot[2] = v[2]; break;
                case 2: sample_vec3(tr, cat_keys, tt, v); scl[0] = v[0]; scl[1] = v[1]; scl[2] = v[2]; break;
                default: break;
            }
        }

        const float *pv = cat_bones[b].pivot;
        const float piv[3] = {pv[0], pv[1], pv[2]};

        /*
         * Blockbench convention:
         *   M = T(pos) * T(pivot) * Rz * Ry * Rx * S * T(-pivot)
         */
        float m[16], t[16], neg[16], r[16], tmp[16];
        m4_translate(t, pos[0], pos[1], pos[2]);
        m4_translate(tmp, piv[0], piv[1], piv[2]);
        m4_mul(m, t, tmp);

        m4_rot_z(tmp, rot[2]); m4_mul(r, m, tmp);
        m4_rot_y(tmp, rot[1]); m4_mul(m, r, tmp);
        m4_rot_x(tmp, rot[0]); m4_mul(r, m, tmp);

        m4_scale(tmp, scl[0], scl[1], scl[2]); m4_mul(m, r, tmp);
        m4_translate(neg, -piv[0], -piv[1], -piv[2]); m4_mul(r, m, neg);

        memcpy(c->bone_local[b], r, sizeof(float) * 16);
    }

    /* Compose down the hierarchy; parents always precede children in the table. */
    for (int b = 0; b < CAT_BONE_COUNT; b++) {
        const int parent = cat_bones[b].parent;
        if (parent < 0) {
            memcpy(c->bone_world[b], c->bone_local[b], sizeof(float) * 16);
        } else {
            m4_mul(c->bone_world[b], c->bone_world[parent], c->bone_local[b]);
        }
    }

    /* Fold the camera and the focus offset into one matrix per bone. */
    float ry[16], rx[16], rot[16];
    /* The model faces -Z, so add 180 deg: yaw 0 means "looking at the face". */
    m4_rot_y(ry, c->cam.yaw_deg + 180.0f);
    m4_rot_x(rx, c->cam.pitch_deg);
    m4_mul(rot, rx, ry);

    const float cx = c->focus[0], cy = c->focus[1], cz = c->focus[2];
    float center_view[3];
    const float cv[3] = {cx, cy, cz};
    m4_point(rot, cv, center_view);

    for (int b = 0; b < CAT_BONE_COUNT; b++) {
        float mv[16], shift[16];
        m4_mul(mv, rot, c->bone_world[b]);
        m4_translate(shift, -center_view[0], -center_view[1], -center_view[2]);
        m4_mul(c->bone_view[b], shift, mv);
    }
}

/* ------------------------------------------------------------------ */
/* rasteriser                                                          */
/* ------------------------------------------------------------------ */

/*
 * Fills one screen-space triangle. All setup (slopes, colour gradients) happens
 * once per triangle in floating point; the inner loop is integer only.
 */
static void raster_tri(cat3d_t *c, const float *p, const float *uu, const float *vv,
                       int shade, const uint8_t *tex, int tx_max, int ty_max)
{
    /* Sort the three vertices by y so the spans are easy to walk. */
    int o0 = 0, o1 = 1, o2 = 2;
    float py[3] = {p[1], p[3], p[5]};
    if (py[o0] > py[o1]) { int t = o0; o0 = o1; o1 = t; }
    if (py[o1] > py[o2]) { int t = o1; o1 = o2; o2 = t; }
    if (py[o0] > py[o1]) { int t = o0; o0 = o1; o1 = t; }

    const float x[3] = {p[o0 * 2], p[o1 * 2], p[o2 * 2]};
    const float y[3] = {py[o0], py[o1], py[o2]};
    const float u[3] = {uu[o0], uu[o1], uu[o2]};
    const float v[3] = {vv[o0], vv[o1], vv[o2]};

    const float denom = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2]);
    if (fabsf(denom) < 1e-9f) return;
    const float inv = 1.0f / denom;

    /* du/dx, du/dy, dv/dx, dv/dy */
    const float dudx = ((y[1] - y[2]) * u[0] + (y[2] - y[0]) * u[1] + (y[0] - y[1]) * u[2]) * inv;
    const float dudy = ((x[2] - x[1]) * u[0] + (x[0] - x[2]) * u[1] + (x[1] - x[0]) * u[2]) * inv;
    const float dvdx = ((y[1] - y[2]) * v[0] + (y[2] - y[0]) * v[1] + (y[0] - y[1]) * v[2]) * inv;
    const float dvdy = ((x[2] - x[1]) * v[0] + (x[0] - x[2]) * v[1] + (x[1] - x[0]) * v[2]) * inv;

    int y0 = (int)ceilf(y[0] - 0.5f);
    int y1 = (int)floorf(y[2] - 0.5f);
    if (y0 < 0) y0 = 0;
    if (y1 > c->vp_h - 1) y1 = c->vp_h - 1;
    if (y0 > y1) return;

    const uint16_t *lrt = c->lut_r[shade];
    const uint16_t *lgt = c->lut_g[shade];
    const uint16_t *lbt = c->lut_b[shade];

    /* Inverse slopes of the three edges (guarding against horizontal edges). */
    float m01 = 0.0f, m02 = 0.0f, m12 = 0.0f;
    const int has01 = fabsf(y[1] - y[0]) > 1e-6f;
    const int has02 = fabsf(y[2] - y[0]) > 1e-6f;
    const int has12 = fabsf(y[2] - y[1]) > 1e-6f;
    if (has01) m01 = (x[1] - x[0]) / (y[1] - y[0]);
    if (has02) m02 = (x[2] - x[0]) / (y[2] - y[0]);
    if (has12) m12 = (x[2] - x[1]) / (y[2] - y[1]);

    int minx = c->vp_w, maxx = -1;
    int pixels = 0;

    for (int py = y0; py <= y1; py++) {
        const float fy = (float)py + 0.5f;
        float xa, xb;

        /*
         * Pick the two edges that are actually live on this scanline. Using the
         * top-left edge past its lower end would extrapolate it outside the
         * triangle and produce a wrong (usually far too wide) span.
         */
        if (fy < y[1]) {
            /* Upper part: edges 0->1 and 0->2. */
            xa = has01 ? (x[0] + m01 * (fy - y[0])) : x[0];
            xb = has02 ? (x[0] + m02 * (fy - y[0])) : x[0];
        } else {
            /* Lower part: edges 1->2 and 0->2. A flat bottom collapses to x[1]. */
            xa = has12 ? (x[1] + m12 * (fy - y[1])) : x[1];
            xb = has02 ? (x[0] + m02 * (fy - y[0])) : x[0];
        }
        if (xa > xb) { const float t = xa; xa = xb; xb = t; }

        const float x_left = xa;
        const float x_right = xb;

        int px0 = (int)ceilf(x_left - 0.5f);
        int px1 = (int)floorf(x_right - 0.5f);
        if (px0 < 0) px0 = 0;
        if (px1 > c->vp_w - 1) px1 = c->vp_w - 1;
        if (px0 > px1) continue;

        /* Evaluate u,v at the first pixel centre, then step. */
        const float dxs = ((float)px0 + 0.5f) - x[0];
        const float dys = fy - y[0];
        float fu = u[0] + dudx * dxs + dudy * dys;
        float fv = v[0] + dvdx * dxs + dvdy * dys;

        int32_t uq = (int32_t)(fu * 65536.0f);
        int32_t vq = (int32_t)(fv * 65536.0f);
        const int32_t duq = (int32_t)(dudx * 65536.0f);
        const int32_t dvq = (int32_t)(dvdx * 65536.0f);

        uint16_t *row = c->fb + (size_t)py * (size_t)c->vp_w;
        for (int px = px0; px <= px1; px++) {
            int tx = uq >> 16;
            int ty = vq >> 16;
            uq += duq;
            vq += dvq;
            if ((unsigned)tx >= (unsigned)tx_max || (unsigned)ty >= (unsigned)ty_max) continue;
            const size_t to = ((size_t)ty * (size_t)tx_max + (size_t)tx) * 2u;
            const uint16_t texel = (uint16_t)(tex[to] | (uint16_t)(tex[to + 1] << 8));
#if CAT3D_SKIP_TRANSPARENT
            if (texel == CAT3D_TRANSPARENT_RGB565) continue;
#endif
            row[px] = (uint16_t)((lrt[(texel >> 11) & 31] << 11) |
                                 (lgt[(texel >> 5) & 63] << 5) |
                                 lbt[texel & 31]);
            pixels++;
        }
        if (px0 < minx) minx = px0;
        if (px1 > maxx) maxx = px1;
    }

    if (maxx >= minx) {
        dirty_add(c, minx, y0, maxx, y1);
        c->last_pixels += pixels;
    }
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

cat3d_t *cat3d_create(int vp_w, int vp_h, const cat3d_allocator_t *alloc)
{
    if (vp_w <= 0 || vp_h <= 0 || vp_w > CAT3D_MAX_W || vp_h > CAT3D_MAX_H) return NULL;

    cat3d_t *c = (cat3d_t *)(alloc && alloc->alloc ? alloc->alloc(sizeof(cat3d_t))
                                                   : malloc(sizeof(cat3d_t)));
    if (!c) return NULL;
    memset(c, 0, sizeof(*c));

    c->alloc = alloc ? *alloc : (cat3d_allocator_t){NULL, NULL};
    c->vp_w = vp_w;
    c->vp_h = vp_h;

    const size_t bytes = (size_t)vp_w * (size_t)vp_h * 2u;
    c->fb = (uint16_t *)(c->alloc.alloc ? c->alloc.alloc(bytes) : malloc(bytes));
    if (!c->fb) {
        if (c->alloc.release) c->alloc.release(c);
        return NULL;
    }
    c->last_bytes = bytes;

    c->breed = 0;
    c->anim = 0;
    c->time = 0.0f;
    c->cam.yaw_deg = 0.0f;
    c->cam.pitch_deg = 12.0f;
    c->cam.scale = 0.0f; /* auto */
    c->cam.pan_x = 0.0f;
    c->cam.pan_y = 0.0f;
    c->tex_cache = NULL;
    c->tex_cache_len = 0;
    c->tex_cache_breed = -1;
    /* Palette lifted from the HTML game's page background. */
    c->bg_top = 0xEFBEu;    /* #edf7f6 */
    c->bg_bottom = 0xE79Du; /* #e4f0ee */
    c->full_repaint = 1;

    lut_build(c);
    light_build(c);
    compute_model_bounds(c);
    bg_rebuild(c);
    dirty_reset(c);

    return c;
}

void cat3d_destroy(cat3d_t *c)
{
    if (!c) return;
    /* tex_cache is caller-owned and deliberately not freed here. */
    if (c->fb) {
        if (c->alloc.release) c->alloc.release(c->fb); else free(c->fb);
    }
    if (c->alloc.release) c->alloc.release(c); else free(c);
}

cat3d_err_t cat3d_set_breed(cat3d_t *c, int breed)
{
    if (!c) return CAT3D_ERR_INVALID_ARG;
    if (breed < 0 || breed >= CAT3D_BREED_COUNT) return CAT3D_ERR_INVALID_ARG;
    c->breed = breed;
    /* A cached texture belongs to the previous breed; refill on the next render. */
    c->tex_cache_breed = -1;
    return CAT3D_OK;
}

const char *cat3d_breed_name(int breed)
{
    switch (breed) {
        case 0: return "orange";
        case 1: return "silver";
        case 2: return "tuxedo";
        case 3: return "siamese";
        case 4: return "ragdoll";
        case 5: return "blue";
        default: return "?";
    }
}

cat3d_err_t cat3d_set_anim(cat3d_t *c, int anim)
{
    if (!c) return CAT3D_ERR_INVALID_ARG;
    if (anim < 0 || anim >= CAT_ANIM_COUNT) return CAT3D_ERR_INVALID_ARG;
    c->anim = anim;
    return CAT3D_OK;
}

const char *cat3d_anim_name(int anim)
{
    if (anim < 0 || anim >= CAT_ANIM_COUNT) return "?";
    static const char *names[CAT_ANIM_COUNT] = {"idle", "walk", "paw"};
    return names[anim];
}

int cat3d_anim_count(void) { return CAT_ANIM_COUNT; }

void cat3d_set_time(cat3d_t *c, float seconds)
{
    if (c) c->time = seconds;
}

void cat3d_set_background(cat3d_t *c, uint16_t top_rgb565, uint16_t bottom_rgb565)
{
    if (!c) return;
    c->bg_top = top_rgb565;
    c->bg_bottom = bottom_rgb565;
    bg_rebuild(c);
    c->full_repaint = 1;
}

void cat3d_set_camera(cat3d_t *c, const cat3d_camera_t *cam)
{
    if (c && cam) c->cam = *cam;
}

void cat3d_set_allocator(cat3d_t *c, const cat3d_allocator_t *alloc)
{
    if (c && alloc) c->alloc = *alloc;
}

cat3d_err_t cat3d_set_texel_cache(cat3d_t *c, uint8_t *buf, size_t len)
{
    if (!c) return CAT3D_ERR_INVALID_ARG;
    if (!buf) {
        c->tex_cache = NULL;
        c->tex_cache_len = 0;
        c->tex_cache_breed = -1;
        return CAT3D_OK;
    }
    if (len < (size_t)CAT_TEX_BYTES) return CAT3D_ERR_INVALID_ARG;
    c->tex_cache = buf;
    c->tex_cache_len = len;
    c->tex_cache_breed = -1;
    return CAT3D_OK;
}

/**
 * @brief Request a full-viewport repaint on the next frame.
 * Useful after the UI has drawn over the cat's area.
 */
void cat3d_invalidate_all(cat3d_t *c)
{
    if (c) c->full_repaint = 1;
}

const uint16_t *cat3d_render(cat3d_t *c)
{
    if (!c) return NULL;

    /* ---- 1. skinning ---- */
    update_bones(c);

    const float scale = c->cam.scale > 0.0f ? c->cam.scale : c->fit_scale;
    const float half_w = (float)c->vp_w * 0.5f + c->cam.pan_x;
    const float half_h = (float)c->vp_h * 0.5f + c->cam.pan_y;

    /* Transform vertices per part so each part's bone matrix is loaded once. */
    for (int pi = 0; pi < CAT_PART_COUNT; pi++) {
        const cat_part_t *pt = &cat_parts[pi];
        const float *m = c->bone_view[pt->bone];
        for (int k = 0; k < pt->vtx_count; k++) {
            const int vi = pt->first_vtx + k;
            const float *v = &cat_verts[vi].x;
            const float x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
            const float y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
            const float z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
            c->vx[vi] = half_w + x * scale;
            c->vy[vi] = half_h - y * scale;
            c->vz[vi] = z;
        }
    }

    /* ---- 2. build the draw list: backface cull + shade + depth ---- */
    const float *L = c->light;
    int count = 0;
    for (int fi = 0; fi < CAT_FACE_COUNT; fi++) {
        const cat_face_t *f = &cat_faces[fi];
        const int i0 = f->idx[0], i1 = f->idx[1], i2 = f->idx[2], i3 = f->idx[3];

        const float ax = c->vx[i0], ay = c->vy[i0];
        const float bx = c->vx[i1], by = c->vy[i1];
        const float cx = c->vx[i2], cy = c->vy[i2];

        /* Signed area; the model's winding keeps front faces negative. */
        const float area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
        if (area >= 0.0f) continue;

        /* Cheap reject against the viewport. */
        float minx = ax, maxx = ax, miny = ay, maxy = ay;
        const float xs[3] = {bx, cx, c->vx[i3]};
        const float ys[3] = {by, cy, c->vy[i3]};
        for (int k = 0; k < 3; k++) {
            if (xs[k] < minx) minx = xs[k];
            if (xs[k] > maxx) maxx = xs[k];
            if (ys[k] < miny) miny = ys[k];
            if (ys[k] > maxy) maxy = ys[k];
        }
        if (maxx < 0.0f || maxy < 0.0f || minx > (float)(c->vp_w - 1) || miny > (float)(c->vp_h - 1)) continue;

        /* View-space normal, flipped to face the viewer, then Lambert. */
        const float e1x = c->vx[i1] - c->vx[i0], e1y = c->vy[i1] - c->vy[i0], e1z = c->vz[i1] - c->vz[i0];
        const float e2x = c->vx[i2] - c->vx[i0], e2y = c->vy[i2] - c->vy[i0], e2z = c->vz[i2] - c->vz[i0];
        float nx = e1y * e2z - e1z * e2y;
        float ny = e1z * e2x - e1x * e2z;
        float nz = e1x * e2y - e1y * e2x;
        const float nl = sqrtf(nx * nx + ny * ny + nz * nz);
        if (nl < 1e-12f) continue;
        nx /= nl; ny /= nl; nz /= nl;
        if (nz < 0.0f) { nx = -nx; ny = -ny; nz = -nz; }
        float lam = nx * L[0] + ny * L[1] + nz * L[2];
        if (lam < 0.0f) lam = 0.0f;
        const float shade_f = 0.55f + 0.45f * lam;
        int shade = (int)(shade_f * (float)(CAT3D_SHADE_LEVELS - 1) + 0.5f);
        if (shade < 0) shade = 0;
        if (shade > CAT3D_SHADE_LEVELS - 1) shade = CAT3D_SHADE_LEVELS - 1;

        const float depth = (c->vz[i0] + c->vz[i1] + c->vz[i2] + c->vz[i3]) * 0.25f;
        c->items[count].face = (uint16_t)fi;
        c->items[count].shade = (uint8_t)shade;
        c->items[count].depth = depth;
        count++;
    }
    c->item_count = count;

    /* ---- 3. painter's algorithm: insertion sort is O(n) on a nearly
     *         sorted list, which is exactly what consecutive frames give us. ---- */
    for (int i = 1; i < count; i++) {
        const draw_item_t key = c->items[i];
        int j = i - 1;
        while (j >= 0 && c->items[j].depth > key.depth) {
            c->items[j + 1] = c->items[j];
            j--;
        }
        c->items[j + 1] = key;
    }

    /* Remembered here because step 4 is what consumes the flag, and step 6 still
     * needs to know that the whole buffer was rewritten this frame. */
    const int full_frame = c->full_repaint;

    /* ---- 4. repaint background over the previous frame's rectangle ---- */
    /*
     * Only this rectangle is touched, and it covers where the cat was, so the
     * buffer holds no leftover cat pixels, while the rest of the viewport (which
     * holds an identical, static gradient) is never rewritten. That is what keeps
     * the per-frame write count proportional to the cat rather than to the panel.
     *
     * This is *not* enough on its own: the panel is only repainted where step 6
     * says, so the region the cat has left also has to be published there. See
     * the comment on step 6.
     */
    int ux0, uy0, ux1, uy1;
    if (c->full_repaint) {
        ux0 = 0; uy0 = 0; ux1 = c->vp_w - 1; uy1 = c->vp_h - 1;
        c->full_repaint = 0;
    } else if (c->prev_x1 >= c->prev_x0 && c->prev_y1 >= c->prev_y0) {
        ux0 = c->prev_x0; uy0 = c->prev_y0; ux1 = c->prev_x1; uy1 = c->prev_y1;
    } else {
        ux0 = c->vp_w; uy0 = c->vp_h; ux1 = -1; uy1 = -1;
    }
    if (ux0 < 0) ux0 = 0;
    if (uy0 < 0) uy0 = 0;
    if (ux1 > c->vp_w - 1) ux1 = c->vp_w - 1;
    if (uy1 > c->vp_h - 1) uy1 = c->vp_h - 1;
    for (int y = uy0; y <= uy1; y++) {
        uint16_t *row = c->fb + (size_t)y * (size_t)c->vp_w;
        const uint16_t col = c->row_color[y];
        for (int x = ux0; x <= ux1; x++) row[x] = col;
    }

    /* ---- 5. rasterise ---- */
    dirty_reset(c);
    c->last_pixels = 0;
    size_t len = 0;
    const uint8_t *tex = cat3d_asset_texels(c->breed, &len);

    /* Refresh the RAM copy of the texture when the breed changed. */
    if (tex && c->tex_cache) {
        if (c->tex_cache_breed != c->breed && len <= c->tex_cache_len) {
            memcpy(c->tex_cache, tex, len);
            c->tex_cache_breed = c->breed;
        }
        if (c->tex_cache_breed == c->breed) tex = c->tex_cache;
    }

    if (tex) {
        for (int i = 0; i < count; i++) {
            const cat_face_t *f = &cat_faces[c->items[i].face];
            const int shade = c->items[i].shade;
            const int idx[4] = {f->idx[0], f->idx[1], f->idx[2], f->idx[3]};
            float px[8];
            for (int k = 0; k < 4; k++) {
                px[k * 2 + 0] = c->vx[idx[k]];
                px[k * 2 + 1] = c->vy[idx[k]];
            }
            /* Two triangles per quad: (0,1,2) and (0,2,3). */
            static const int TRI[2][3] = {{0, 1, 2}, {0, 2, 3}};
            for (int t = 0; t < 2; t++) {
                const int a = TRI[t][0], b = TRI[t][1], cc = TRI[t][2];
                const float tp[6] = {
                    px[a * 2 + 0], px[a * 2 + 1],
                    px[b * 2 + 0], px[b * 2 + 1],
                    px[cc * 2 + 0], px[cc * 2 + 1],
                };
                const float tu[3] = {f->uv[a][0], f->uv[b][0], f->uv[cc][0]};
                const float tv[3] = {f->uv[a][1], f->uv[b][1], f->uv[cc][1]};
                raster_tri(c, tp, tu, tv, shade, tex, CAT_TEX_W, CAT_TEX_H);
            }
        }
    }
    c->last_faces = count;

    /* ---- 6. publish the dirty rect: previous frame rect UNION current ---- */
    /*
     * This rectangle is what the caller hands to the panel, so it has to cover
     * every pixel whose on-screen value changed -- not merely the pixels the cat
     * wrote this frame. Step 4 cleared the *previous* frame's rectangle in the
     * buffer, so the strip the cat has just vacated already holds background in
     * the buffer while the panel still shows the old cat; reporting only the
     * current frame's rect would leave that strip stale forever (ghosting).
     *
     * `c->prev_*` still holds the previous frame here, and becomes this frame's
     * rect at the end of the block, which is exactly what next frame's step 4
     * needs to clear.
     */
    if (c->dirty_x1 < c->dirty_x0 || c->dirty_y1 < c->dirty_y0) {
        c->dirty_x0 = c->dirty_y0 = 0;
        c->dirty_x1 = c->dirty_y1 = -1;
    }

    /* Inclusive previous-frame bounds; empty is encoded as x1 < x0. */
    int bx0 = c->prev_x0, by0 = c->prev_y0, bx1 = c->prev_x1, by1 = c->prev_y1;
    const int cur_empty = (c->dirty_x1 < c->dirty_x0 || c->dirty_y1 < c->dirty_y0);
    const int prev_empty = (bx1 < bx0 || by1 < by0);

    if (full_frame) {
        /* The whole viewport was repainted, so the whole viewport changed. */
        bx0 = 0; by0 = 0; bx1 = c->vp_w - 1; by1 = c->vp_h - 1;
    } else if (cur_empty && prev_empty) {
        bx0 = 0; by0 = 0; bx1 = -1; by1 = -1;
    } else if (cur_empty) {
        /* The cat left the screen: the vacated pixels still need erasing. */
    } else if (prev_empty) {
        bx0 = c->dirty_x0; by0 = c->dirty_y0; bx1 = c->dirty_x1; by1 = c->dirty_y1;
    } else {
        if (c->dirty_x0 < bx0) bx0 = c->dirty_x0;
        if (c->dirty_y0 < by0) by0 = c->dirty_y0;
        if (c->dirty_x1 > bx1) bx1 = c->dirty_x1;
        if (c->dirty_y1 > by1) by1 = c->dirty_y1;
    }
    /* Clamp to the viewport; a union of two in-range rects is still in range,
     * but the empty encodings and a caller-set pan must not leak through. */
    if (bx0 < 0) bx0 = 0;
    if (by0 < 0) by0 = 0;
    if (bx1 > c->vp_w - 1) bx1 = c->vp_w - 1;
    if (by1 > c->vp_h - 1) by1 = c->vp_h - 1;
    if (bx0 > bx1 || by0 > by1) { bx0 = 0; by0 = 0; bx1 = -1; by1 = -1; }

    /* `prev_*` keeps its existing meaning: this frame's cat bounds. */
    c->prev_x0 = c->dirty_x0;
    c->prev_y0 = c->dirty_y0;
    c->prev_x1 = c->dirty_x1;
    c->prev_y1 = c->dirty_y1;

    c->dirty_x0 = bx0;
    c->dirty_y0 = by0;
    c->dirty_x1 = bx1;
    c->dirty_y1 = by1;

    return c->fb;
}

void cat3d_dirty_rect(const cat3d_t *c, int *x, int *y, int *w, int *h)
{
    if (!c) return;
    const int w_ = (c->dirty_x1 >= c->dirty_x0) ? (c->dirty_x1 - c->dirty_x0 + 1) : 0;
    const int h_ = (c->dirty_y1 >= c->dirty_y0) ? (c->dirty_y1 - c->dirty_y0 + 1) : 0;
    if (x) *x = w_ > 0 ? c->dirty_x0 : 0;
    if (y) *y = h_ > 0 ? c->dirty_y0 : 0;
    if (w) *w = w_;
    if (h) *h = h_;
}

int cat3d_view_w(const cat3d_t *c) { return c ? c->vp_w : 0; }
int cat3d_view_h(const cat3d_t *c) { return c ? c->vp_h : 0; }
int cat3d_last_faces_drawn(const cat3d_t *c) { return c ? c->last_faces : 0; }
int cat3d_last_pixels(const cat3d_t *c) { return c ? c->last_pixels : 0; }
size_t cat3d_frame_bytes(const cat3d_t *c) { return c ? c->last_bytes : 0; }

void cat3d_pose_bounds(const cat3d_t *c, float *min3, float *max3)
{
    if (!c) return;
    float mn[3] = {1e9f, 1e9f, 1e9f};
    float mx[3] = {-1e9f, -1e9f, -1e9f};
    for (int i = 0; i < CAT_VERT_COUNT; i++) {
        const float v[3] = {c->vx[i], c->vy[i], c->vz[i]};
        for (int a = 0; a < 3; a++) {
            if (v[a] < mn[a]) mn[a] = v[a];
            if (v[a] > mx[a]) mx[a] = v[a];
        }
    }
    if (min3) { min3[0] = mn[0]; min3[1] = mn[1]; min3[2] = mn[2]; }
    if (max3) { max3[0] = mx[0]; max3[1] = mx[1]; max3[2] = mx[2]; }
}

const uint8_t *cat3d_asset_texels(int breed, size_t *out_len)
{
    if (breed < 0 || breed >= CAT3D_BREED_COUNT) {
        if (out_len) *out_len = 0;
        return NULL;
    }
    return cat3d_platform_tex(breed, out_len);
}
