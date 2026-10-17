/*
 * Host-side regression test for cat3d's incremental rendering path.
 *
 * Why this file exists
 * --------------------
 * tests/host/test_render.c renders every pose after cat3d_invalidate_all(), so it
 * only ever exercises the full-repaint path: the buffer is rewritten end to end
 * and the whole viewport is handed to the panel. The incremental path -- the one
 * the firmware actually runs at frame rate, where main/ui/cat_view.c invalidates a
 * single LVGL area taken from cat3d_dirty_rect() -- had no coverage at all.
 *
 * That path had a ghosting defect. cat3d_render() clears the *previous* frame's
 * rectangle in the buffer (step 4: correct, and unchanged), but it published only
 * the *current* frame's rectangle (step 6). The caller therefore damaged only the
 * new rectangle, so the pixels the cat had just vacated -- already background in
 * the buffer -- stayed on the panel and were never repainted. The cat dragged a
 * copy of itself behind it.
 *
 * WHAT THIS PROVES
 *   The published rectangle covers every pixel whose value changed on screen, i.e.
 *   it is the previous frame's rectangle unioned with the current frame's, clamped
 *   to the viewport. Concretely, on the real rasteriser with the real generated
 *   textures:
 *     - two frames 90 degrees of yaw apart publish rectangles where neither
 *       contains the other, so "the second covers the first" is not vacuous;
 *     - the second of those rectangles covers the first (the union property);
 *     - the published rectangle covers the framebuffer difference the test
 *       measures for itself, frame by frame (the property the caller relies on);
 *     - a frame that culls the whole cat still publishes the rectangle it has to
 *       vacate, instead of reporting nothing;
 *     - a forced full repaint publishes the whole viewport;
 *     - nothing drawn before anything drawn publishes a zero-sized rectangle.
 *
 * WHAT THIS DOES NOT PROVE
 *   That the residual image is gone from a physical panel. This is a host test
 *   over a plain memory buffer: LVGL, the RGB panel and its transfer window are
 *   not present and no board was flashed. What is proven is the code-level
 *   invariant the firmware depends on -- the published area is a superset of the
 *   area cat3d_render() changed -- not the visible outcome.
 *
 * Usage: cat3d_dirty_test [assets_dir] [size]
 *
 * Build: tools/run-host-tests.cmd
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cat3d.h"

int cat_assets_host_load(const char *dir);

#define VP_DEFAULT 466

/* Two orientations whose published rectangles neither contains the other, so the
 * "second frame covers the first" assertion cannot pass by containment alone.
 * Measured on this viewport: yaw 90 -> 312x358@77,53; yaw 180 -> 188x375@139,49. */
#define YAW_A 90.0f
#define YAW_B 180.0f

static int g_checks;
static int g_failures;
static int g_vp = VP_DEFAULT;

#define CHECK(cond, ...)                                                        \
    do {                                                                        \
        g_checks++;                                                             \
        if (!(cond)) {                                                          \
            g_failures++;                                                       \
            printf("  FAIL %s:%d: ", __FILE__, __LINE__);                       \
            printf(__VA_ARGS__);                                                \
            printf("\n");                                                       \
        }                                                                       \
    } while (0)

/* Published rect: top-left plus size, mirroring cat3d_dirty_rect(). */
typedef struct {
    int x, y, w, h;
} rect_t;

/* Inclusive bounds; empty is encoded as x1 < x0, as cat3d does internally. */
typedef struct {
    int x0, y0, x1, y1;
} bounds_t;

static rect_t publish(cat3d_t *c)
{
    rect_t r = {0, 0, 0, 0};
    cat3d_dirty_rect(c, &r.x, &r.y, &r.w, &r.h);
    return r;
}

static int rect_empty(rect_t r)
{
    return r.w <= 0 || r.h <= 0;
}

static int rect_same(rect_t a, rect_t b)
{
    return a.x == b.x && a.y == b.y && a.w == b.w && a.h == b.h;
}

/* Outer covers inner. An empty inner is covered by definition; an empty outer
 * covers nothing unless inner is empty too. */
static int rect_covers(rect_t outer, rect_t inner)
{
    if (rect_empty(inner)) return 1;
    if (rect_empty(outer)) return 0;
    return outer.x <= inner.x && outer.y <= inner.y &&
           outer.x + outer.w >= inner.x + inner.w &&
           outer.y + outer.h >= inner.y + inner.h;
}

static void rect_print(const char *label, rect_t r)
{
    printf("      %s = %dx%d@%d,%d\n", label, r.w, r.h, r.x, r.y);
}

static void set_pose(cat3d_t *c, float yaw, float pitch)
{
    cat3d_camera_t cam = {0};
    cam.yaw_deg = yaw;
    cam.pitch_deg = pitch;
    cam.scale = 0.0f; /* auto-fit, as the firmware does */
    cam.pan_x = 0.0f;
    cam.pan_y = 0.0f;
    cat3d_set_camera(c, &cam);
}

static void set_pan(cat3d_t *c, float pan_x, float pan_y)
{
    cat3d_camera_t cam = {0};
    cam.yaw_deg = YAW_A;
    cam.pitch_deg = 12.0f;
    cam.scale = 0.0f;
    cam.pan_x = pan_x;
    cam.pan_y = pan_y;
    cat3d_set_camera(c, &cam);
}

/* Snapshot of the viewport buffer, so the test can measure for itself which
 * pixels a frame changed instead of trusting the telemetry. */
static uint16_t *snapshot(const uint16_t *fb, size_t pixels)
{
    uint16_t *copy = malloc(pixels * sizeof(uint16_t));
    if (copy) memcpy(copy, fb, pixels * sizeof(uint16_t));
    return copy;
}

static bounds_t diff_bounds(const uint16_t *before, const uint16_t *after, int w, int h)
{
    bounds_t d = {w, h, -1, -1};
    for (int y = 0; y < h; y++) {
        const uint16_t *ra = before + (size_t)y * (size_t)w;
        const uint16_t *rb = after + (size_t)y * (size_t)w;
        for (int x = 0; x < w; x++) {
            if (ra[x] != rb[x]) {
                if (x < d.x0) d.x0 = x;
                if (y < d.y0) d.y0 = y;
                if (x > d.x1) d.x1 = x;
                if (y > d.y1) d.y1 = y;
            }
        }
    }
    return d;
}

static void bounds_to_rect(bounds_t b, rect_t *out)
{
    if (b.x1 < b.x0 || b.y1 < b.y0) {
        out->x = out->y = out->w = out->h = 0;
        return;
    }
    out->x = b.x0;
    out->y = b.y0;
    out->w = b.x1 - b.x0 + 1;
    out->h = b.y1 - b.y0 + 1;
}

/*
 * The defect's home: two consecutive incremental frames with the cat in two very
 * different orientations.
 *
 * Note the first frame after cat3d_create() legitimately publishes the whole
 * viewport (the constructor asks for a full repaint), so the test warms up with
 * one frame and then renders the same pose again: by then the published rect has
 * collapsed to the cat's own bounds, and the next frame is the incremental one
 * under test.
 */
static void test_union_of_previous_and_current_frame(void)
{
    cat3d_t *c = cat3d_create(g_vp, g_vp, NULL);
    CHECK(c != NULL, "cat3d_create(%d,%d) returned NULL", g_vp, g_vp);
    if (!c) return;

    set_pose(c, YAW_A, 12.0f);

    /* Warm-up frame: consumes the constructor's full repaint. */
    cat3d_render(c);

    /* Frame 1 of the measurement: same pose, so the published rect is exactly
     * the cat's bounds (previous rect unioned with an identical current rect). */
    const uint16_t *fb = cat3d_render(c);
    const rect_t f1 = publish(c);
    CHECK(!rect_empty(f1), "frame 1 published an empty rect, so no cat was drawn");
    if (rect_empty(f1)) { cat3d_destroy(c); return; }
    rect_print("frame 1 published", f1);

    /* Frame 2: 90 degrees of yaw later. */
    uint16_t *before = snapshot(fb, (size_t)g_vp * (size_t)g_vp);
    set_pose(c, YAW_B, 12.0f);
    fb = cat3d_render(c);
    const rect_t f2 = publish(c);
    rect_print("frame 2 published", f2);

    CHECK(!rect_empty(f2), "frame 2 published an empty rect, but the cat is still drawn");

    /* Where the cat actually is in frame 2, measured on a separate renderer with
     * no history: this must differ from the published rect on the incremental
     * renderer, otherwise frame 2's own bounds alone would already satisfy the
     * union assertion and the case would prove nothing. */
    cat3d_t *ref = cat3d_create(g_vp, g_vp, NULL);
    CHECK(ref != NULL, "second cat3d_create failed");
    rect_t f2_own = {0, 0, 0, 0};
    if (ref) {
        set_pose(ref, YAW_B, 12.0f);
        cat3d_render(ref); /* consumes the full repaint */
        cat3d_render(ref);
        f2_own = publish(ref);
        rect_print("frame 2 own bounds", f2_own);
        cat3d_destroy(ref);
    }

    /* Guard against a vacuous union assertion. The mutated step 6 publishes
     * exactly `f2_own`; if that were already identical to the fixed `f2`, or were
     * a strict superset of `f1` that fixes nothing, the checks below would pass
     * without a union. */
    CHECK(!rect_empty(f2_own), "the reference renderer published an empty rect");
    CHECK(!rect_same(f1, f2_own),
          "the two poses have identical extents, so this case is not incremental");
    CHECK(!rect_covers(f2_own, f1),
          "frame 2's own bounds already contain frame 1's, so the union assertion would be vacuous");
    CHECK(!rect_same(f2, f2_own),
          "the published rect equals frame 2's own bounds, so the previous frame was not unioned in");
    CHECK(f2.x <= f2_own.x && f2.y <= f2_own.y &&
              f2.x + f2.w >= f2_own.x + f2_own.w &&
              f2.y + f2.h >= f2_own.y + f2_own.h,
          "published rect does not cover frame 2's own bounds");
    CHECK(f2.w > f2_own.w || f2.h > f2_own.h,
          "published rect is no bigger than frame 2's own bounds, so nothing was unioned in");

    /* The property the caller needs. Reverting step 6's union makes this fail:
     * the mutated code publishes only frame 2's own bounds, which miss frame 1. */
    CHECK(rect_covers(f2, f1),
          "frame 2's published rect does not cover frame 1's: the vacated strip is never repainted (ghosting)");
    CHECK(f2.w >= f1.w && f2.h >= f1.h,
          "published rect is smaller than the previous frame's (%dx%d vs %dx%d)",
          f2.w, f2.h, f1.w, f1.h);

    /* Independent evidence, measured from the buffer itself: every pixel the
     * frame changed -- including the ones step 4 restored to background -- must
     * be inside the published rect, otherwise the panel keeps a stale pixel. */
    if (before) {
        const bounds_t changed = diff_bounds(before, fb, g_vp, g_vp);
        rect_t changed_rect;
        bounds_to_rect(changed, &changed_rect);
        rect_print("buffer diff (true change)", changed_rect);
        CHECK(!rect_empty(changed_rect),
              "the buffer did not change at all between the two poses, so the frame was not rendered");
        CHECK(rect_covers(f2, changed_rect),
              "published rect does not cover the pixels that actually changed in the buffer");
        free(before);
    } else {
        CHECK(0, "out of memory taking a framebuffer snapshot");
    }

    /* The union must stay inside the viewport. */
    CHECK(f2.x >= 0 && f2.y >= 0 && f2.x + f2.w <= cat3d_view_w(c) && f2.y + f2.h <= cat3d_view_h(c),
          "published rect %dx%d@%d,%d leaves the %dx%d viewport",
          f2.w, f2.h, f2.x, f2.y, cat3d_view_w(c), cat3d_view_h(c));

    cat3d_destroy(c);
}

/*
 * The cat leaves the screen entirely (every face is culled outside the
 * viewport). The published rect must still be the rectangle it is vacating:
 * those pixels changed from cat to background in the buffer, and a caller that
 * is told "nothing to repaint" leaves the old cat on the panel forever.
 */
static void test_vacated_rect_is_published_when_the_cat_leaves(void)
{
    cat3d_t *c = cat3d_create(g_vp, g_vp, NULL);
    CHECK(c != NULL, "cat3d_create(%d,%d) returned NULL", g_vp, g_vp);
    if (!c) return;

    set_pose(c, YAW_A, 12.0f);
    cat3d_render(c); /* warm-up: consumes the constructor's full repaint */
    const uint16_t *fb = cat3d_render(c);
    const rect_t before = publish(c);
    CHECK(!rect_empty(before), "expected the cat to be on screen before the pan");
    rect_print("rect before the cat leaves", before);
    if (rect_empty(before)) { cat3d_destroy(c); return; }

    uint16_t *snap = snapshot(fb, (size_t)g_vp * (size_t)g_vp);

    /* 5000 px of pan pushes every vertex outside the viewport: the cheap reject
     * in step 2 drops all faces, so the frame draws nothing at all. */
    set_pan(c, 5000.0f, 0.0f);
    fb = cat3d_render(c);
    CHECK(cat3d_last_faces_drawn(c) == 0,
          "expected all faces culled, but %d were drawn", cat3d_last_faces_drawn(c));
    CHECK(cat3d_last_pixels(c) == 0,
          "expected no pixels written, but %d were", cat3d_last_pixels(c));

    const rect_t after = publish(c);
    rect_print("rect after the cat leaves", after);
    CHECK(rect_same(after, before),
          "the vacated rectangle was not published: the old cat stays on the panel");

    if (snap) {
        const bounds_t changed = diff_bounds(snap, fb, g_vp, g_vp);
        rect_t changed_rect;
        bounds_to_rect(changed, &changed_rect);
        rect_print("buffer diff (true change)", changed_rect);
        CHECK(rect_covers(after, changed_rect),
              "published rect does not cover the pixels the disappearing cat changed");
        free(snap);
    } else {
        CHECK(0, "out of memory taking a framebuffer snapshot");
    }

    /* Once the vacated frame has been published, a second empty frame has
     * nothing left to repaint. */
    cat3d_render(c);
    const rect_t quiet = publish(c);
    CHECK(rect_empty(quiet),
          "an already-empty scene still publishes %dx%d@%d,%d, so every idle frame repaints",
          quiet.w, quiet.h, quiet.x, quiet.y);

    cat3d_destroy(c);
}

/* A forced full repaint rewrites the whole buffer, so the whole viewport has to
 * be published -- that is how the caller learns the panel is fully stale. */
static void test_forced_full_repaint_publishes_the_viewport(void)
{
    cat3d_t *c = cat3d_create(g_vp, g_vp, NULL);
    CHECK(c != NULL, "cat3d_create(%d,%d) returned NULL", g_vp, g_vp);
    if (!c) return;

    set_pose(c, YAW_A, 12.0f);
    cat3d_render(c); /* warm-up: consumes the constructor's full repaint */
    cat3d_render(c);
    const rect_t warmed = publish(c);
    CHECK(!rect_empty(warmed) && warmed.w < g_vp && warmed.h < g_vp,
          "expected the warmed published rect to be the cat's bounds, got %dx%d",
          warmed.w, warmed.h);

    cat3d_invalidate_all(c);
    cat3d_render(c);
    const rect_t full = publish(c);
    rect_print("rect after invalidate_all", full);
    CHECK(full.x == 0 && full.y == 0 && full.w == g_vp && full.h == g_vp,
          "a forced full repaint must publish the whole viewport, got %dx%d@%d,%d",
          full.w, full.h, full.x, full.y);

    cat3d_destroy(c);
}

/* Nothing drawn, nothing drawn before: publish nothing rather than a 1x1 rect at
 * the origin. */
static void test_fresh_renderer_publishes_nothing(void)
{
    cat3d_t *c = cat3d_create(g_vp, g_vp, NULL);
    CHECK(c != NULL, "cat3d_create(%d,%d) returned NULL", g_vp, g_vp);
    if (!c) return;

    const rect_t r = publish(c);
    CHECK(rect_empty(r), "a fresh renderer published %dx%d@%d,%d", r.w, r.h, r.x, r.y);

    /* The first frame after creation is a forced full repaint, so the whole
     * viewport is published even though the cat is off screen and nothing is
     * drawn: the buffer really was rewritten end to end. */
    set_pan(c, -5000.0f, -5000.0f);
    cat3d_render(c);
    const rect_t first = publish(c);
    CHECK(first.x == 0 && first.y == 0 && first.w == g_vp && first.h == g_vp,
          "the first frame (a full repaint) published %dx%d@%d,%d, not the viewport",
          first.w, first.h, first.x, first.y);

    /* With no full repaint pending, a cat that is off screen in both frames has
     * nothing to vacate, so nothing is published. */
    cat3d_render(c);
    const rect_t r2 = publish(c);
    CHECK(rect_empty(r2), "an off-screen cat published %dx%d@%d,%d", r2.w, r2.h, r2.x, r2.y);

    cat3d_destroy(c);
}

int main(int argc, char **argv)
{
    const char *assets = argc > 1 && argv[1][0] ? argv[1] : "components/cat3d/data";
    if (argc > 2 && atoi(argv[2]) > 0) g_vp = atoi(argv[2]);

    printf("=== cat3d dirty rect (incremental path) ===\n");
    printf("viewport            %d x %d\n", g_vp, g_vp);

    if (cat_assets_host_load(assets) != 0) return 1;

    test_union_of_previous_and_current_frame();
    test_vacated_rect_is_published_when_the_cat_leaves();
    test_forced_full_repaint_publishes_the_viewport();
    test_fresh_renderer_publishes_nothing();

    printf("\n%d checks, %d failure(s)\n", g_checks, g_failures);
    if (g_failures == 0) {
        printf("ALL CAT3D DIRTY RECT TESTS PASSED\n");
        return 0;
    }
    printf("CAT3D DIRTY RECT TESTS FAILED\n");
    return 1;
}
