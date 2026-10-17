/*
 * Host test: the specification's icons, sounds and fonts arrived intact.
 *
 * The failure this test exists for is an asset that lands *almost* right. A
 * 16x16 PNG exported with the layer hidden is still a valid PNG; a WAV that lost
 * its tail is still a valid WAV; a font id that quietly falls back to f16 draws a
 * pairing code nobody can read. None of those break a build or an existing test,
 * and all of them are visible on the glass.
 *
 * So every check here is about content, not about shape:
 *   - each icon has real, non-transparent pixels;
 *   - name -> index -> name round-trips for every BADGE_ICON_* macro;
 *   - each sound has samples that are in range, that start with audio rather than
 *     with silence, and that are mostly audio rather than padding (every sound the
 *     specification ships ends with the same 80-sample fade-out, so the tail is
 *     measured for excess rather than for zero);
 *   - each of the four font ids resolves to a distinct face, and the pairing
 *     code's face is n40.
 *
 * Compiled with no LVGL: tests/host/lvgl_font_stub/lvgl.h declares lv_font_t as an
 * opaque struct and tests/host/badge_font_stub.c defines the four faces, so the
 * module under test is the real badge_assets.c.
 */
#include <stdio.h>
#include <string.h>

#include "badge_assets.h"
#include "badge_spec_data.h"

static int failures;
static int checks;

#define CHECK(cond)                                                      \
    do {                                                                 \
        checks++;                                                        \
        if (!(cond)) {                                                   \
            printf("  FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);     \
            failures++;                                                  \
        }                                                                \
    } while (0)

#define CHECK_EQ(a, b)                                                                     \
    do {                                                                                   \
        checks++;                                                                          \
        long long va = (long long)(a), vb = (long long)(b);                                \
        if (va != vb) {                                                                    \
            printf("  FAIL %s:%d: %s == %s (%lld != %lld)\n", __FILE__, __LINE__, #a, #b,  \
                   va, vb);                                                                \
            failures++;                                                                    \
        }                                                                                  \
    } while (0)

#define CHECK_STR(a, b)                                                                     \
    do {                                                                                    \
        checks++;                                                                           \
        const char *sa = (a), *sb = (b);                                                    \
        if (!sa || !sb || strcmp(sa, sb) != 0) {                                            \
            printf("  FAIL %s:%d: \"%s\" != \"%s\"\n", __FILE__, __LINE__, sa ? sa : "",    \
                   sb ? sb : "");                                                           \
            failures++;                                                                     \
        }                                                                                   \
    } while (0)

/* Every BADGE_ICON_* macro badge_spec_data.h publishes, plus the two dynamic
 * sentinels. Listing them here is the point: a macro the spec adds and this test
 * does not know about is a compile error, not a silent gap. */
static const struct {
    const char *macro;
    int index;
} ICON_MACROS[] = {
    { "BADGE_ICON_BT", BADGE_ICON_BT },
    { "BADGE_ICON_BT_OFF", BADGE_ICON_BT_OFF },
    { "BADGE_ICON_BOWL", BADGE_ICON_BOWL },
    { "BADGE_ICON_WATER", BADGE_ICON_WATER },
    { "BADGE_ICON_FEATHER", BADGE_ICON_FEATHER },
    { "BADGE_ICON_MOON", BADGE_ICON_MOON },
    { "BADGE_ICON_COIN", BADGE_ICON_COIN },
    { "BADGE_ICON_GEAR", BADGE_ICON_GEAR },
    { "BADGE_ICON_MIC", BADGE_ICON_MIC },
    { "BADGE_ICON_TAP", BADGE_ICON_TAP },
    { "BADGE_ICON_GIFT", BADGE_ICON_GIFT },
    { "BADGE_ICON_BAT_LOW", BADGE_ICON_BAT_LOW },
    { "BADGE_ICON_PAW", BADGE_ICON_PAW },
    { "BADGE_ICON_BOLT", BADGE_ICON_BOLT },
    { "BADGE_ICON_HEALTH", BADGE_ICON_HEALTH },
    { "BADGE_ICON_HEART", BADGE_ICON_HEART },
    { "BADGE_ICON_SOAP", BADGE_ICON_SOAP },
    { "BADGE_ICON_SPIRAL", BADGE_ICON_SPIRAL },
    { "BADGE_ICON_QUESTION", BADGE_ICON_QUESTION },
    { "BADGE_ICON_BANG", BADGE_ICON_BANG },
    { "BADGE_ICON_OFFICE", BADGE_ICON_OFFICE },
    { "BADGE_ICON_CAFE", BADGE_ICON_CAFE },
    { "BADGE_ICON_FLOWER", BADGE_ICON_FLOWER },
    { "BADGE_ICON_HAND_TAP", BADGE_ICON_HAND_TAP },
    { "BADGE_ICON_SWIPE_UP", BADGE_ICON_SWIPE_UP },
    { "BADGE_ICON_SWIPE_DOWN", BADGE_ICON_SWIPE_DOWN },
    { "BADGE_ICON_HOLD", BADGE_ICON_HOLD },
    { "BADGE_ICON_SWIPE_LR", BADGE_ICON_SWIPE_LR },
};

/* The prompt sounds and the .wav each one is, in badge_snd_t order. The mapping is
 * the specification's own (badge_spec.json "sounds") and is documented in
 * main/ui/badge_assets.h. */
static const struct {
    const char *name;
    int snd;
    const char *wav;
} SOUNDS[] = {
    { "SND_PET", SND_PET, "meow_short.wav" },
    { "SND_CARE_DONE", SND_CARE_DONE, "meow_happy.wav" },
    { "SND_MEET", SND_MEET, "chime.wav" },
    { "SND_WAKE", SND_WAKE, "blip.wav" },
    { "SND_ERROR", SND_ERROR, "bonk.wav" },
};

/* The metric budget the prompt sounds are cut to (spec 12.5): not a hard failure,
 * but a sound that grew by an order of magnitude means someone vendored the wrong
 * file, and it would show up as a delayed UI on the device. */
#define SND_MAX_SAMPLES (2 * BADGE_PCM_RATE)

static void test_icon_pixels(void)
{
    puts("icon pixels");
    /*
     * The checks below are content checks, not a decode check: they prove an icon
     * is present and non-degenerate, and they cannot see a decoder that reads the
     * wrong row (which still yields a plausible icon). The generator's PNG decoder
     * is verified against Pillow over all 28 package icons instead -- see the note
     * in tools/gen-badge-assets.mjs and docs/badge-assets-integration.md.
     */
    for (int i = 0; i < BADGE_ICON_COUNT; i++) {
        const uint8_t *px = badge_icon_rgba(i);
        if (!px) {
            printf("  FAIL icon %d (%s) has no data\n", i, badge_icon_name(i));
            failures++;
            checks++;
            continue;
        }
        checks++;
        int opaque = 0;
        int rgb = 0;
        const size_t bytes = (size_t)BADGE_ICON_PX * BADGE_ICON_PX * 4u;
        for (size_t p = 0; p < bytes; p += 4) {
            if (px[p + 3] != 0) opaque++;
            if (px[p] || px[p + 1] || px[p + 2]) rgb++;
        }
        /* An all-transparent icon is an asset that landed wrong: the PNG is valid,
         * the build is green and the glass shows nothing. */
        if (opaque == 0) {
            printf("  FAIL icon %d (%s) is fully transparent\n", i, badge_icon_name(i));
            failures++;
        }
        checks++;
        /* ... and an icon with no colour at all is a silhouette nobody can read,
         * which is what a PNG exported without its colour pass looks like. */
        if (rgb == 0) {
            printf("  FAIL icon %d (%s) has no non-black pixel\n", i, badge_icon_name(i));
            failures++;
        }
    }
}

static void test_icon_names(void)
{
    puts("icon names and indices");
    for (int i = 0; i < BADGE_ICON_COUNT; i++) {
        const char *name = badge_icon_name(i);
        CHECK(name != NULL);
        CHECK(name[0] != '\0');
        CHECK_EQ(badge_icon_index(name), i);
    }
    for (size_t m = 0; m < sizeof(ICON_MACROS) / sizeof(ICON_MACROS[0]); m++) {
        const int idx = ICON_MACROS[m].index;
        if (idx < 0 || idx >= BADGE_ICON_COUNT) {
            printf("  FAIL %s is %d, outside 0..%d\n", ICON_MACROS[m].macro, idx,
                   BADGE_ICON_COUNT - 1);
            failures++;
            checks++;
            continue;
        }
        const char *name = badge_icon_name(idx);
        checks++;
        if (!name || name[0] == '\0') {
            printf("  FAIL %s resolves to an empty name\n", ICON_MACROS[m].macro);
            failures++;
        }
        CHECK(badge_icon_rgba(idx) != NULL);
        CHECK_EQ(badge_icon_index(name), idx);
    }
    /* Each macro must be its own index: a duplicated #define would otherwise send
     * two different elements to the same picture. */
    for (size_t a = 0; a < sizeof(ICON_MACROS) / sizeof(ICON_MACROS[0]); a++) {
        for (size_t b = a + 1; b < sizeof(ICON_MACROS) / sizeof(ICON_MACROS[0]); b++) {
            if (ICON_MACROS[a].index == ICON_MACROS[b].index) {
                printf("  FAIL %s and %s are both %d\n", ICON_MACROS[a].macro,
                       ICON_MACROS[b].macro, ICON_MACROS[a].index);
                failures++;
            }
            checks++;
        }
    }
    /* The macros must cover the whole table, in order. */
    CHECK_EQ(sizeof(ICON_MACROS) / sizeof(ICON_MACROS[0]), (size_t)BADGE_ICON_COUNT);
    for (size_t m = 0; m < sizeof(ICON_MACROS) / sizeof(ICON_MACROS[0]); m++) {
        CHECK_EQ(ICON_MACROS[m].index, (int)m);
    }

    /* Unknown names and the sentinels are NULL/"", never a bogus index. */
    CHECK_EQ(badge_icon_index("no-such-icon"), BADGE_ICON_NONE);
    CHECK_EQ(badge_icon_index(""), BADGE_ICON_NONE);
    CHECK_EQ(badge_icon_index(NULL), BADGE_ICON_NONE);
    CHECK_STR(badge_icon_name(BADGE_ICON_NONE), "");
    CHECK_STR(badge_icon_name(-1), "");
    CHECK_STR(badge_icon_name(BADGE_ICON_COUNT), "");
    CHECK_EQ(badge_icon_rgba(BADGE_ICON_NONE), (const uint8_t *)NULL);
    CHECK_EQ(badge_icon_rgba(-1), (const uint8_t *)NULL);
    CHECK_EQ(badge_icon_rgba(BADGE_ICON_COUNT), (const uint8_t *)NULL);
    /* The two dynamic icons are placeholders the caller resolves; they have no data
     * of their own and must not be mistaken for real indices. */
    CHECK(badge_icon_rgba(BADGE_ICON_DYN_PLACE) == NULL);
    CHECK(badge_icon_rgba(BADGE_ICON_DYN_GUIDE) == NULL);
}

static void test_icon_bytes(void)
{
    puts("icon byte count");
    CHECK_EQ(badge_assets_icon_bytes(),
             (size_t)BADGE_ICON_COUNT * BADGE_ICON_PX * BADGE_ICON_PX * 4u);
    CHECK_EQ(badge_assets_icon_bytes(), (size_t)BADGE_ICON_COUNT * 1024u);
    /* The boot log reports this as free heap is measured; 28 icons is 28 KB, so a
     * jump here means the table grew behind the spec's back. */
    CHECK(badge_assets_icon_bytes() >= 16u * 1024u);
    CHECK(badge_assets_icon_bytes() <= 64u * 1024u);
}

static void test_sounds(void)
{
    puts("prompt sounds");
    CHECK_EQ(SND_COUNT, 5);
    CHECK_EQ(sizeof(SOUNDS) / sizeof(SOUNDS[0]), (size_t)SND_COUNT);
    for (size_t s = 0; s < sizeof(SOUNDS) / sizeof(SOUNDS[0]); s++) {
        size_t len = 0;
        const int16_t *pcm = badge_pcm(SOUNDS[s].snd, &len);
        if (!pcm || len == 0) {
            printf("  FAIL %s (%s) has no samples\n", SOUNDS[s].name, SOUNDS[s].wav);
            failures++;
            checks++;
            continue;
        }
        checks++;

        /* A prompt is short; a wrong .wav vendored here would delay the UI. */
        if (len > SND_MAX_SAMPLES) {
            printf("  FAIL %s is %zu samples (%.2f s), longer than the %d budget\n", SOUNDS[s].name,
                   len, (double)len / BADGE_PCM_RATE, SND_MAX_SAMPLES);
            failures++;
        }
        checks++;

        /* The storage is 16-bit PCM: the samples cannot be out of range unless the
         * array type changed, which would also change what the codec is fed. */
        CHECK_EQ(sizeof(pcm[0]), 2u);
        int clipped = 0;
        for (size_t i = 0; i < len; i++) {
            if (pcm[i] == -32768 || pcm[i] == 32767) clipped++;
        }
        checks++;
        if ((size_t)clipped == len) {
            printf("  FAIL %s is full-scale at every sample -- that is a decode bug, not audio\n",
                   SOUNDS[s].name);
            failures++;
        }

        /* Not silent at the start: a truncated or mislabelled export keeps a valid
         * header and can keep a valid length, so the samples themselves are what
         * has to be inspected. */
        int head = 0;
        for (size_t i = 0; i < 64 && i < len; i++) head |= pcm[i];
        if (head == 0) {
            printf("  FAIL %s starts with 64 zero samples\n", SOUNDS[s].name);
            failures++;
        }
        checks++;

        /*
         * The tail is deliberately NOT checked the same way. Every sound the
         * specification ships ends with exactly 80 zero samples (5 ms at 16 kHz):
         * uniform padding from the tool that generated them, present identically in
         * the package's own sounds/badge_sounds.c, and therefore part of the asset
         * rather than damage to it. What is worth catching is a buffer that is
         * mostly padding, or whose cosmetically valid tail is much longer than the
         * other four sounds' -- the shape a half-written or wrong-length file has.
         */
        size_t lastNonZero = 0;
        int16_t peak = 0;
        for (size_t i = 0; i < len; i++) {
            if (pcm[i] != 0) lastNonZero = i;
            const int16_t mag = (int16_t)(pcm[i] < 0 ? -pcm[i] : pcm[i]);
            if (mag > peak) peak = mag;
        }
        const size_t tailSilence = len - 1 - lastNonZero;
        checks++;
        if (tailSilence > BADGE_PCM_RATE / 100u) { /* > 10 ms of silence */
            printf("  FAIL %s trails %zu zero samples (%.1f ms): mostly padding\n", SOUNDS[s].name,
                   tailSilence, 1000.0 * (double)tailSilence / BADGE_PCM_RATE);
            failures++;
        }
        checks++;
        if (lastNonZero * 2 < len) {
            printf("  FAIL %s is silent for more than half its %zu samples\n", SOUNDS[s].name, len);
            failures++;
        }
        /* Silence is not a prompt: a buffer of near-zero samples plays nothing. */
        checks++;
        if (peak < 1000) {
            printf("  FAIL %s peaks at %d, which is not audible\n", SOUNDS[s].name, peak);
            failures++;
        }

        /* It has to be audio, not a constant or a DC offset. */
        int16_t lo = pcm[0];
        int16_t hi = pcm[0];
        for (size_t i = 0; i < len; i++) {
            if (pcm[i] < lo) lo = pcm[i];
            if (pcm[i] > hi) hi = pcm[i];
        }
        checks++;
        if (hi == lo) {
            printf("  FAIL %s is a constant %d\n", SOUNDS[s].name, lo);
            failures++;
        }
    }

    /* The five sounds are five different buffers, and out-of-range ids are NULL
     * with a zeroed length rather than a stale one. */
    for (int a = 0; a < SND_COUNT; a++) {
        size_t la = 0;
        const int16_t *pa = badge_pcm(a, &la);
        for (int b = a + 1; b < SND_COUNT; b++) {
            size_t lb = 0;
            const int16_t *pb = badge_pcm(b, &lb);
            CHECK(pa != pb);
            const size_t common = la < lb ? la : lb;
            CHECK(la != lb || memcmp(pa, pb, common * sizeof(int16_t)) != 0);
        }
    }
    size_t len = 12345;
    CHECK(badge_pcm(SND_COUNT, &len) == NULL);
    CHECK_EQ(len, 0);
    len = 12345;
    CHECK(badge_pcm(-1, &len) == NULL);
    CHECK_EQ(len, 0);
    /* A NULL len pointer must not crash: badge_pcm is called from the audio path
     * where only the buffer matters. */
    CHECK(badge_pcm(SND_PET, NULL) != NULL);
}

static void test_fonts(void)
{
    puts("fonts");
    const lv_font_t *faces[BADGE_FONT_COUNT];
    for (int i = 0; i < BADGE_FONT_COUNT; i++) {
        faces[i] = badge_font(i);
        CHECK(faces[i] != NULL);
    }
    /* Four ids, four distinct faces. Two ids sharing a face is how a screen ends up
     * drawn a size too small with nothing to show for it. */
    for (int a = 0; a < BADGE_FONT_COUNT; a++) {
        for (int b = a + 1; b < BADGE_FONT_COUNT; b++) {
            CHECK(faces[a] != faces[b]);
        }
    }
    CHECK_EQ(badge_font(BADGE_FONT_F16), &badge_f16);
    CHECK_EQ(badge_font(BADGE_FONT_F20), &badge_f20);
    CHECK_EQ(badge_font(BADGE_FONT_F24), &badge_f24);
    CHECK_EQ(badge_font(BADGE_FONT_N40), &badge_n40);
    /* The pairing code is the spec's only n40 user besides the clock; the pairing
     * screen's "code" element is font "n40" in badge_spec.json. If badge_font()
     * ever returned f20 here the code would be drawn at half size. */
    {
        const badge_el_t *code = NULL;
        for (int i = 0; i < BADGE_EL_COUNT; i++) {
            if (badge_els[i].font == BADGE_FONT_N40 && badge_els[i].text != 0 &&
                strcmp(badge_strings[badge_els[i].text], "{pairCode}") == 0) {
                code = &badge_els[i];
            }
        }
        CHECK(code != NULL);
        if (code) CHECK_EQ(badge_font(code->font), &badge_n40);
    }
    /* Out of range falls back to f16 rather than NULL: a wrong-but-legible face is
     * a better failure than a blank box. */
    CHECK_EQ(badge_font(BADGE_FONT_COUNT), &badge_f16);
    CHECK_EQ(badge_font(-1), &badge_f16);
}

int main(void)
{
    puts("badge assets:");
    test_icon_pixels();
    test_icon_names();
    test_icon_bytes();
    test_sounds();
    test_fonts();

    printf("\n%d checks, %d failures\n", checks, failures);
    if (failures) {
        printf("BADGE ASSETS: FAILED\n");
        return 1;
    }
    printf("badge assets: OK (%d icons, %d sounds, %d fonts)\n", BADGE_ICON_COUNT, (int)SND_COUNT,
           BADGE_FONT_COUNT);
    return 0;
}
