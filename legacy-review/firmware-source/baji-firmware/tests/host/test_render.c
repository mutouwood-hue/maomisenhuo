/*
 * Host-side render test.
 *
 * Renders a fixed set of poses with the *firmware* rasteriser and dumps both the
 * raw RGB565 buffer and a PPM for eyeballing. tools/compare-render.mjs then
 * checks these buffers pixel-by-pixel against the independent JavaScript
 * reference implementation, which is what actually proves the C port is correct
 * rather than merely plausible.
 *
 * Usage: cat_render_test <assets_dir> <out_dir> [size]
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "cat3d.h"

int cat_assets_host_load(const char *dir);

typedef struct {
    const char *name;
    int breed;
    int anim;
    float time;
    float yaw;
    float pitch;
} case_t;

static const case_t CASES[] = {
    {"01-orange-idle-front",  0, 0, 0.00f,    0.0f, 12.0f},
    {"02-orange-idle-3q",     0, 0, 0.00f,   35.0f, 12.0f},
    {"03-orange-idle-side",   0, 0, 0.80f,   90.0f,  0.0f},
    {"04-silver-idle-3q",     1, 0, 0.40f,   35.0f, 12.0f},
    {"05-tuxedo-walk",        2, 1, 0.25f,   35.0f, 12.0f},
    {"06-siamese-walk",       3, 1, 0.50f,   35.0f, 12.0f},
    {"07-ragdoll-paw",        4, 2, 1.00f,  -35.0f, 10.0f},
    {"08-blue-paw-back",      5, 2, 1.60f,  180.0f, 12.0f},
    {"09-orange-idle-top",    0, 0, 1.60f,   20.0f, 70.0f},
    {"10-orange-walk-3q",     0, 1, 0.75f,   50.0f,  8.0f},
};
#define NCASES ((int)(sizeof(CASES) / sizeof(CASES[0])))

static void write_ppm(const char *path, const uint16_t *fb, int w, int h)
{
    FILE *f = fopen(path, "wb");
    if (!f) return;
    fprintf(f, "P6\n%d %d\n255\n", w, h);
    for (int i = 0; i < w * h; i++) {
        const uint16_t v = fb[i];
        const unsigned r = ((v >> 11) & 31u) * 255u / 31u;
        const unsigned g = ((v >> 5) & 63u) * 255u / 63u;
        const unsigned b = (v & 31u) * 255u / 31u;
        const unsigned char px[3] = {(unsigned char)r, (unsigned char)g, (unsigned char)b};
        fwrite(px, 1, 3, f);
    }
    fclose(f);
}

static void write_raw(const char *path, const uint16_t *fb, int w, int h)
{
    FILE *f = fopen(path, "wb");
    if (!f) return;
    fwrite(fb, 2, (size_t)w * (size_t)h, f);
    fclose(f);
}

int main(int argc, char **argv)
{
    if (argc < 3) {
        fprintf(stderr, "usage: %s <assets_dir> <out_dir> [size]\n", argv[0]);
        return 2;
    }
    const int size = argc > 3 ? atoi(argv[3]) : 466;

    if (cat_assets_host_load(argv[1]) != 0) return 1;

    cat3d_t *c = cat3d_create(size, size, NULL);
    if (!c) {
        fprintf(stderr, "cat3d_create failed\n");
        return 1;
    }

    printf("viewport            %d x %d\n", cat3d_view_w(c), cat3d_view_h(c));
    printf("frame buffer        %zu bytes\n", cat3d_frame_bytes(c));
    printf("animations          %d\n", cat3d_anim_count());

    for (int i = 0; i < NCASES; i++) {
        const case_t *t = &CASES[i];

        if (cat3d_set_breed(c, t->breed) != CAT3D_OK) { fprintf(stderr, "set_breed failed\n"); return 1; }
        if (cat3d_set_anim(c, t->anim) != CAT3D_OK) { fprintf(stderr, "set_anim failed\n"); return 1; }
        cat3d_set_time(c, t->time);

        cat3d_camera_t cam = {0};
        cam.yaw_deg = t->yaw;
        cam.pitch_deg = t->pitch;
        cam.scale = 0.0f;
        cat3d_set_camera(c, &cam);

        /* One clean frame, no history. */
        cat3d_invalidate_all(c);
        const clock_t t0 = clock();
        const uint16_t *fb = cat3d_render(c);
        const clock_t t1 = clock();

        int dx, dy, dw, dh;
        cat3d_dirty_rect(c, &dx, &dy, &dw, &dh);

        char path[1024];
        snprintf(path, sizeof(path), "%s/%s.ppm", argv[2], t->name);
        write_ppm(path, fb, size, size);
        snprintf(path, sizeof(path), "%s/%s.565", argv[2], t->name);
        write_raw(path, fb, size, size);

        printf("%-22s breed=%-8s anim=%-4s t=%4.2f yaw=%6.1f pitch=%5.1f | faces=%3d px=%6d dirty=%dx%d@%d,%d | host=%.2f ms\n",
               t->name, cat3d_breed_name(t->breed), cat3d_anim_name(t->anim), t->time, t->yaw, t->pitch,
               cat3d_last_faces_drawn(c), cat3d_last_pixels(c), dw, dh, dx, dy,
               (double)(t1 - t0) * 1000.0 / (double)CLOCKS_PER_SEC);
    }

    cat3d_destroy(c);
    printf("OK: %d frames written to %s\n", NCASES, argv[2]);
    return 0;
}
