/*
 * A deterministic badge_icon_rgba() for the host test binary.
 *
 * The real one lives in main/ui/badge_assets_data.c, which is generated and is owned
 * by another agent -- the paint test must not depend on it, and it must not link it.
 * This stand-in returns a synthetic 16x16 RGBA8888 tile for every icon:
 *
 *   - every pixel is opaque except a one-pixel transparent border, so a test can tell
 *     "the icon was drawn" from "the icon blitted its full square";
 *   - the RGB at (u, v) is a pure function of (icon, u, v): red = icon * 8, green =
 *     u * 16, blue = v * 16. That makes nearest-neighbour scaling directly
 *     checkable -- at scale s, output pixel (ox, oy) must equal the source texel at
 *     (ox / s, oy / s), and a dropped row or column shows up as the wrong green or
 *     blue.
 *
 * It is deliberately NOT alpha-premultiplied and deliberately has no antialiasing, so
 * every expected value in the test is an exact integer. The transparent border is the
 * only alpha-0 pixel: an extra transparent texel in the middle would make a
 * "is the icon here" probe depend on which texel it happened to land on.
 *
 * Worst case here is 1 + 1 = 2, so the cache is a plain static table; it is built
 * once and never freed.
 */
#include <stdint.h>

#include "badge_spec.h"

#define BADGE_ICON_TEST_STUB_STRIDE 16
#define BADGE_ICON_TEST_STUB_STRIDE_BYTES (BADGE_ICON_TEST_STUB_STRIDE * BADGE_ICON_TEST_STUB_STRIDE * 4)

/* The stub covers the generated icon list plus the two dynamic placeholders the UI
 * resolves, and BADGE_ICON_NONE never has data. The count is fixed rather than taken
 * from badge_spec_data.h so this file does not have to link the generated tables. */
#define BADGE_ICON_TEST_STUB_MAX 64

static uint8_t badge_icon_test_tile[BADGE_ICON_TEST_STUB_MAX][BADGE_ICON_TEST_STUB_STRIDE_BYTES];
static uint8_t badge_icon_test_ready[BADGE_ICON_TEST_STUB_MAX];

static void badge_icon_test_make(int icon)
{
    uint8_t *tile = badge_icon_test_tile[icon];
    for (int v = 0; v < BADGE_ICON_TEST_STUB_STRIDE; v++) {
        for (int u = 0; u < BADGE_ICON_TEST_STUB_STRIDE; u++) {
            uint8_t *p = tile + (v * BADGE_ICON_TEST_STUB_STRIDE + u) * 4;
            const bool border = (u == 0 || v == 0 || u == BADGE_ICON_TEST_STUB_STRIDE - 1 ||
                                 v == BADGE_ICON_TEST_STUB_STRIDE - 1);
            p[0] = (uint8_t)((icon * 8) & 0xFF);   /* red   */
            p[1] = (uint8_t)((u * 16) & 0xFF);     /* green */
            p[2] = (uint8_t)((v * 16) & 0xFF);     /* blue  */
            p[3] = border ? 0u : 255u;             /* alpha */
        }
    }
    badge_icon_test_ready[icon] = 1u;
}

const uint8_t *badge_icon_rgba(int icon)
{
    if (icon < 0 || icon >= BADGE_ICON_TEST_STUB_MAX) return 0;
    if (!badge_icon_test_ready[icon]) badge_icon_test_make(icon);
    return badge_icon_test_tile[icon];
}
