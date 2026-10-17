/*
 * ESP-IDF asset provider: the six breed textures.
 *
 * The textures are linked into the application image by this component's CMakeLists
 * (EMBED_FILES), so no filesystem, SPIFFS partition or SD card is involved. They are
 * read straight out of flash through the cache, which costs zero bytes of the
 * precious internal SRAM.
 */
#include "cat3d_assets.h"

#include <assert.h>
#include <stddef.h>
#include <stdint.h>

/*
 * ESP-IDF's embed step (tools/cmake/scripts/data_file_embed_asm.cmake) emits, per
 * file, three globals in .rodata.embedded:
 *
 *     <base>_start      first byte of the data
 *     <base>_end        one past the last byte
 *     <base>_length     a .long holding the byte count
 *
 * <base> is the file's basename with non-identifier characters replaced, so
 * tex_orange.bin becomes tex_orange_bin.
 *
 * NOTE ON WHY THE TABLE HOLDS A POINTER TO THE LENGTH RATHER THAN THE LENGTH.
 * A static initialiser may only contain constant expressions, and on a linked
 * target that means: addresses, arithmetic on addresses, and integer literals.
 * Neither of the two obvious ways to get a file's size satisfies that rule:
 *
 *   - `_end - _start` is a pointer subtraction. It is perfectly well defined at
 *     run time, but it is not a constant expression, so GCC rejects it with
 *     "initializer element is not constant".
 *   - `tex_orange_bin_length` is a variable. Reading a variable is a load, which
 *     is likewise not a constant expression, and fails the same way.
 *
 * Taking the *address* of the linker's count is a relocation, hence constant, so
 * the table stores `&tex_orange_bin_length` and the dereference happens inside the
 * accessor. The count therefore still comes from the linker rather than from a
 * number written here, and it cannot drift out of sync if an asset is regenerated
 * at a different size.
 */
#define DECLARE_TEX(name)                                  \
    extern const uint8_t _binary_tex_##name##_bin_start[]; \
    extern const uint32_t tex_##name##_bin_length

DECLARE_TEX(orange);
DECLARE_TEX(silver);
DECLARE_TEX(tuxedo);
DECLARE_TEX(siamese);
DECLARE_TEX(ragdoll);
DECLARE_TEX(blue);

#define TEX_ENTRY(name) \
    { _binary_tex_##name##_bin_start, &tex_##name##_bin_length }

typedef struct {
    const uint8_t *data;
    const uint32_t *len;
} tex_entry_t;

static const tex_entry_t TEX[CAT3D_BREED_COUNT] = {
    TEX_ENTRY(orange),
    TEX_ENTRY(silver),
    TEX_ENTRY(tuxedo),
    TEX_ENTRY(siamese),
    TEX_ENTRY(ragdoll),
    TEX_ENTRY(blue),
};

const uint8_t *cat3d_platform_tex(int breed, size_t *len)
{
    if (breed < 0 || breed >= CAT3D_BREED_COUNT) {
        if (len) *len = 0;
        return NULL;
    }
    if (len) *len = (size_t)*TEX[breed].len;
    return TEX[breed].data;
}

/*
 * The rasteriser reads texels as two separate bytes, so alignment is not strictly
 * required. It is still worth asserting that the linker produced sane assets: a
 * mismatch here would otherwise surface later as a garbled cat or an out-of-bounds
 * read rather than as a clear failure at startup.
 */
__attribute__((constructor)) static void cat3d_assets_check(void)
{
    for (int i = 0; i < CAT3D_BREED_COUNT; i++) {
        assert(TEX[i].data != NULL);
        assert(*TEX[i].len == (uint32_t)CAT_TEX_BYTES);
    }
}
