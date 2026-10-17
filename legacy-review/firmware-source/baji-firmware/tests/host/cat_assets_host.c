/*
 * Host asset provider for the CPU tests: loads the generated .bin textures from
 * the build tree instead of linking them into the binary.
 */
#include "cat3d_assets.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static uint8_t *g_tex[CAT3D_BREED_COUNT];
static size_t g_len[CAT3D_BREED_COUNT];

static const char *const NAMES[CAT3D_BREED_COUNT] = {
    "orange", "silver", "tuxedo", "siamese", "ragdoll", "blue",
};

int cat_assets_host_load(const char *dir)
{
    for (int i = 0; i < CAT3D_BREED_COUNT; i++) {
        char path[1024];
        snprintf(path, sizeof(path), "%s/tex_%s.bin", dir, NAMES[i]);
        FILE *f = fopen(path, "rb");
        if (!f) {
            fprintf(stderr, "cat_assets_host: cannot open %s\n", path);
            return -1;
        }
        fseek(f, 0, SEEK_END);
        const long n = ftell(f);
        fseek(f, 0, SEEK_SET);
        if (n != CAT_TEX_BYTES) {
            fprintf(stderr, "cat_assets_host: %s is %ld bytes, expected %d\n", path, n, CAT_TEX_BYTES);
            fclose(f);
            return -1;
        }
        g_tex[i] = malloc((size_t)n);
        g_len[i] = (size_t)n;
        if (fread(g_tex[i], 1, (size_t)n, f) != (size_t)n) {
            fprintf(stderr, "cat_assets_host: short read on %s\n", path);
            fclose(f);
            return -1;
        }
        fclose(f);
    }
    return 0;
}

const uint8_t *cat3d_platform_tex(int breed, size_t *len)
{
    if (breed < 0 || breed >= CAT3D_BREED_COUNT) {
        if (len) *len = 0;
        return NULL;
    }
    if (!g_tex[breed]) {
        fprintf(stderr, "cat_assets_host: breed %d not loaded\n", breed);
        if (len) *len = 0;
        return NULL;
    }
    if (len) *len = g_len[breed];
    return g_tex[breed];
}
