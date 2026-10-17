/*
 * Host test: every element is on the glass.
 *
 * This is the test the old UI needed and did not have. The badge is a disc of radius
 * 233 inside a 466x466 panel; the previous firmware put 19 of its 20 element boxes at
 * least partly under the bezel, one of them with 1.8% of its pixels visible -- a
 * button nobody could see or tap -- and the geometry suite passed anyway because it
 * only ever checked the centre-point distance of a handful of hand-listed widgets.
 *
 * So this walks the generated tables instead of a hand-written list: all 23 screens,
 * all 151 elements, with each label's template expanded the way the renderer will
 * expand it at runtime, and it fails on the first corner that leaves the safe circle.
 *
 * It also pins the other half of the rule that was documented but not enforced: the
 * band between 212 and 233 belongs to the ring elements. A label written at radius
 * 220 is under the bezel even though it is inside the disc, and the arc that carries
 * the stat readout is allowed there by the specification.
 */
#include <stdio.h>
#include <string.h>

#include "badge_geom.h"
#include "badge_pet.h"
#include "badge_spec_data.h"

static int failures;
static int checks;
static int expansion_failures;

#define CHECK(cond)                                                  \
    do {                                                             \
        checks++;                                                    \
        if (!(cond)) {                                               \
            printf("  FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); \
            failures++;                                              \
        }                                                            \
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

static const char *S(uint16_t idx)
{
    if (idx == 0 || idx >= BADGE_STRING_COUNT) return "";
    return badge_strings[idx];
}

/* ------------------------------------------------------------------ templates ---*/

/*
 * The template tokens the specification's strings use. The reference's `fill()` is
 * the ground truth; this list is the contract the firmware's expander must implement,
 * and the test below fails if a string introduces a token that is not here -- which is
 * how a "{nextStage}" typo becomes a build failure instead of a literal brace drawn on
 * the glass.
 */
static const char *const TOKENS[] = {
    "name",       "food",       "mood",   "clean",   "energy",    "health",
    "coins",      "growth",     "stage",  "nextGrowth", "bat",    "phoneText",
    "syncText",   "time",       "pairCode", "peer",  "peerBreed", "meetGift",
    "placeIcon",  "placeText",  "placeSub", "guideIcon", "guideTitle", "guideSub",
    "brightText", "ttXY",       "ttText", "voiceState", "ver",   "step",
    "n",          "sleepNow",   "careLabel",
};
static const int TOKEN_COUNT = (int)(sizeof(TOKENS) / sizeof(TOKENS[0]));

static bool token_known(const char *tok, size_t len)
{
    for (int i = 0; i < TOKEN_COUNT; i++) {
        if (strlen(TOKENS[i]) == len && memcmp(TOKENS[i], tok, len) == 0) return true;
    }
    /* The care screens label their counter with the care's own name:
     * "{careLabel:feed}" / "{careLabel:water}" / "{careLabel:play}" /
     * "{careLabel:sleep}". The reference expands this by looking the key up in its own
     * care table, so the parameter is part of the contract. */
    if (len > 10 && memcmp(tok, "careLabel:", 10) == 0) {
        static const char *const kinds[] = {"pet", "feed", "water", "play", "sleep"};
        for (size_t i = 0; i < sizeof(kinds) / sizeof(kinds[0]); i++) {
            if (strlen(kinds[i]) == len - 10 && memcmp(tok + 10, kinds[i], len - 10) == 0) {
                return true;
            }
        }
    }
    return false;
}

/* The sample values the reference renderer starts from (its ST object), so the
 * expanded widths are the widths the glass will really show. */
static const char *sample_value(const char *tok, size_t len, char *scratch, size_t cap)
{
    struct {
        const char *k;
        const char *v;
    } table[] = {
        {"name", "小橘"},        {"food", "65"},     {"mood", "72"},
        {"clean", "68"},         {"energy", "75"},   {"health", "100"},
        {"coins", "30"},         {"growth", "86"},   {"stage", "少年猫"},
        {"nextGrowth", "160"},   {"bat", "82"},      {"phoneText", "手机已连接"},
        {"syncText", "已同步"},  {"time", "18:40"},  {"pairCode", "384756"},
        {"peer", "小灰"},        {"peerBreed", "银渐层"},
        {"meetGift", "小灰送你：小鱼干 ×1"}, {"placeIcon", "office"},
        {"placeText", "小橘在公司楼下花坛"}, {"placeSub", "晒太阳，等你下班"},
        {"guideIcon", "hand_tap"}, {"guideTitle", "轻点小猫"},
        {"guideSub", "摸摸它，心情 +9"}, {"brightText", "中"},
        {"ttXY", "113, 113"},    {"ttText", "点左上角"}, {"voiceState", "在听…"},
        {"ver", "0.3.0"},        {"step", "2"},       {"n", "3"},
        {"sleepNow", "嘘…小橘睡着了"}, {"careLabel", "喂食"},
    };
    for (size_t i = 0; i < sizeof(table) / sizeof(table[0]); i++) {
        if (strlen(table[i].k) == len && memcmp(table[i].k, tok, len) == 0) {
            snprintf(scratch, cap, "%s", table[i].v);
            return scratch;
        }
    }
    return NULL;
}

/** The sample value of a parameterised token, keyed on the part after ':'. */
static const char *sample_care(const char *tok, size_t len, char *scratch, size_t cap)
{
    if (len < 11 || memcmp(tok, "careLabel:", 10) != 0) return NULL;
    struct {
        const char *k;
        const char *v;
    } table[] = {{"pet", "摸摸"},   {"feed", "喂食"}, {"water", "喝水"},
                 {"play", "逗猫"},  {"sleep", "睡觉"}};
    for (size_t i = 0; i < sizeof(table) / sizeof(table[0]); i++) {
        if (strlen(table[i].k) == len - 10 && memcmp(tok + 10, table[i].k, len - 10) == 0) {
            snprintf(scratch, cap, "%s", table[i].v);
            return scratch;
        }
    }
    return NULL;
}

/**
 * Expand one template the way the UI will. Returns false when it meets a token that is
 * not in the contract, and reports it once per distinct token.
 */
static bool expand(const char *in, char *out, size_t cap)
{
    size_t o = 0;
    const char *p = in;
    while (*p) {
        if (*p == '{') {
            const char *end = strchr(p + 1, '}');
            if (end) {
                const size_t len = (size_t)(end - p - 1);
                char scratch[64];
                if (!token_known(p + 1, len)) {
                    printf("  FAIL unknown template token \"{%.*s}\" in \"%s\"\n", (int)len,
                           p + 1, in);
                    expansion_failures++;
                    failures++;
                    checks++;
                    /* Copy the braces verbatim so the rest of the check still runs. */
                    if (o + len + 2 < cap) {
                        out[o++] = '{';
                        memcpy(out + o, p + 1, len);
                        o += len;
                        out[o++] = '}';
                    }
                    p = end + 1;
                    continue;
                }
                const char *v = sample_value(p + 1, len, scratch, sizeof(scratch));
                if (!v) v = sample_care(p + 1, len, scratch, sizeof(scratch));
                if (v) {
                    const size_t vl = strlen(v);
                    if (o + vl < cap) {
                        memcpy(out + o, v, vl);
                        o += vl;
                    }
                }
                p = end + 1;
                continue;
            }
        }
        if (o + 1 < cap) out[o++] = *p;
        p++;
    }
    out[o] = '\0';
    return true;
}

/* ------------------------------------------------------------------ the walk ----*/

static void test_every_element(void)
{
    puts("every element inside the glass");
    int content = 0, ring = 0, decorations = 0, taps = 0;
    int worst_dist = 0;
    const char *worst_where = "";
    uint16_t worst_id = 0;

    for (int s = 0; s < BADGE_SCREEN_COUNT_SPEC; s++) {
        const badge_screen_def_t *sd = &badge_screens[s];
        const char *screen_name = sd->name;
        for (int k = 0; k < sd->el_count; k++) {
            const badge_el_t *el = &badge_els[sd->el_first + k];
            char text[256];
            expand(S(el->text), text, sizeof(text));

            const char *reason = NULL;
            if (!badge_el_placement_ok(el, text, &reason)) {
                badge_box_t box;
                const bool has = badge_el_box(el, text, &box);
                printf("  FAIL screen %s element \"%s\" (%s): %s\n", screen_name, S(el->id),
                       has ? "box" : "ring", reason ? reason : "?");
                if (has) {
                    printf("        box x=%d y=%d w=%d h=%d farthest=%d\n", box.x, box.y,
                           box.w, box.h, badge_box_farthest(&box));
                }
                failures++;
            }
            checks++;

            if (badge_el_is_ring(el)) {
                ring++;
                const int outer = badge_ring_outer_radius(el);
                if (outer > worst_dist) {
                    worst_dist = outer;
                    worst_where = "ring";
                    worst_id = el->id;
                }
            } else if (el->type == BE_HIT) {
                /* A tap area is not content: the specification's largest are the whole
                 * disc, so it is only held to the physical glass. */
                taps++;
                CHECK_EQ(badge_el_placement_ok(el, text, &reason), true);
            } else {
                badge_box_t box;
                if (badge_el_box(el, text, &box)) {
                    content++;
                    const int d = badge_box_farthest(&box);
                    if (d > worst_dist) {
                        worst_dist = d;
                        worst_where = screen_name;
                        worst_id = el->id;
                    }
                    /* A box with no area cannot be tapped or read. */
                    CHECK(box.w > 0);
                    CHECK(box.h > 0);
                } else {
                    decorations++;
                }
            }
        }
    }

    printf("  %d content boxes, %d ring elements, %d tap areas, %d decorations\n", content,
           ring, taps, decorations);
    printf("  worst content radius %d px (screen %s, element \"%s\")\n", worst_dist,
           worst_where, S(worst_id));
    CHECK_EQ(content + ring + taps + decorations, BADGE_EL_COUNT);
    CHECK(content > 100);
    /* 11 elements are drawn as rings: five stat arcs, three care segment rings, two
     * 24-hour dials and the voice waveform. */
    CHECK_EQ(ring, 11);
    CHECK_EQ(taps, 16);
    CHECK_EQ(decorations, 2);
    /* The whole point: nothing content-shaped may reach past the safe radius. */
    CHECK(worst_dist <= BADGE_SAFE_R || strcmp(worst_where, "ring") == 0);
}

/* Every ring element must stay inside the physical disc, and must not be drawn so far
 * in that it is really content wearing a ring's clothes. */
static void test_ring_band(void)
{
    puts("ring elements in the 212..233 band");
    int n = 0;
    for (int i = 0; i < BADGE_EL_COUNT; i++) {
        const badge_el_t *el = &badge_els[i];
        if (!badge_el_is_ring(el)) continue;
        n++;
        const int outer = badge_ring_outer_radius(el);
        CHECK(outer <= BADGE_R);
        /* The voice waveform is the exception the specification creates for itself: it
         * is drawn at r=206 around the microphone button, well inside the safe radius,
         * because it is decoration rather than a dial. */
        if (el->type == BE_WAVE) {
            CHECK_EQ(el->r, 206);
            continue;
        }
        /* Everything else lives in the band. The stat arcs' inner edge reaches 210 --
         * two pixels inside the safe radius, and that is the specification's own
         * 214/8, not a mistake to correct. */
        const int inner = el->r - el->w / 2;
        CHECK(inner >= BADGE_SAFE_R - 4);
        CHECK(outer <= BADGE_R);
    }
    CHECK_EQ(n, 11);
}

/* A button must be tappable: its own centre must hit-test to itself, and its visible
 * box must be its tap box. The old UI's wardrobe tile failed both. */
static void test_buttons_are_tappable(void)
{
    puts("buttons are tappable");
    int buttons = 0;
    for (int s = 0; s < BADGE_SCREEN_COUNT_SPEC; s++) {
        const badge_screen_def_t *sd = &badge_screens[s];
        for (int k = 0; k < sd->el_count; k++) {
            const badge_el_t *el = &badge_els[sd->el_first + k];
            if (el->type != BE_BTN && el->type != BE_PILL && el->type != BE_ALERT) continue;
            buttons++;
            char text[256];
            expand(S(el->text), text, sizeof(text));
            CHECK(badge_el_contains(el, text, el->x, el->y));
            badge_box_t box;
            CHECK(badge_el_box(el, text, &box));
            if (badge_el_box(el, text, &box)) {
                /* Every corner of the visible box is inside the disc... */
                CHECK(badge_box_farthest(&box) <= BADGE_SAFE_R);
                /* ...and its centre hit-tests to this element. */
                CHECK(badge_el_contains(el, text, box.x + box.w / 2, box.y + box.h / 2));
            }
        }
    }
    /* The specification's census: 10 pills, 9 buttons, 3 alert bubbles. */
    CHECK_EQ(buttons, 22);
}

/* Two interactive elements may not sit on top of each other: the lower one would be
 * untappable, which is the same defect as the invisible wardrobe tile. */
static void test_no_overlapping_targets(void)
{
    puts("no unreachable interactive elements");
    int pairs = 0;
    for (int s = 0; s < BADGE_SCREEN_COUNT_SPEC; s++) {
        const badge_screen_def_t *sd = &badge_screens[s];
        for (int a = 0; a < sd->el_count; a++) {
            const badge_el_t *ea = &badge_els[sd->el_first + a];
            if (ea->act == BADGE_ACT_NONE) continue;
            if (ea->type == BE_HIT) continue; /* the hit areas ARE the tap targets */
            char ta[256];
            expand(S(ea->text), ta, sizeof(ta));
            badge_box_t ba;
            if (!badge_el_box(ea, ta, &ba)) continue;
            for (int b = a + 1; b < sd->el_count; b++) {
                const badge_el_t *eb = &badge_els[sd->el_first + b];
                if (eb->act == BADGE_ACT_NONE) continue;
                if (eb->type == BE_HIT) continue;
                char tb[256];
                expand(S(eb->text), tb, sizeof(tb));
                badge_box_t bb;
                if (!badge_el_box(eb, tb, &bb)) continue;
                /* Overlapping is fine as long as each one has a pixel of its own: the
                 * test below proves that by probing the centre of each. */
                if (ba.x < bb.x + bb.w && bb.x < ba.x + ba.w && ba.y < bb.y + bb.h &&
                    bb.y < ba.y + ba.h) {
                    pairs++;
                    /* The later element wins the overlap (the reference's hitTest walks
                     * backwards), so the earlier one must have a free centre. */
                    const bool a_free = badge_el_contains(ea, ta, ba.x + ba.w / 2, ba.y + ba.h / 2) &&
                                        !badge_el_contains(eb, tb, ba.x + ba.w / 2, ba.y + ba.h / 2);
                    CHECK(a_free);
                }
            }
        }
    }
    printf("  %d overlapping interactive pairs, each with a free centre\n", pairs);
}

/* Hit areas must line up with what they cover: a row whose tap area misses its own
 * label is a row the owner cannot press. */
static void test_hit_areas(void)
{
    puts("hit areas cover their rows");
    int hits = 0;
    for (int i = 0; i < BADGE_EL_COUNT; i++) {
        if (badge_els[i].type != BE_HIT) continue;
        hits++;
        const badge_el_t *el = &badge_els[i];
        CHECK_EQ(el->act != BADGE_ACT_NONE, true);
        /* The hit box is centred on (x,y) and must contain its own centre. */
        CHECK(badge_el_contains(el, NULL, el->x, el->y));
        /* Probing the box's own arithmetic, rather than recomputing it here: the
         * circular form (a whole-disc target) has w/h = 0 and r = 233, and a test that
         * recomputed the box would quietly skip it. */
        badge_box_t box;
        if (!badge_el_box(el, NULL, &box)) continue;
        const int left = box.x, right = box.x + box.w - 1;
        const int top = box.y, bottom = box.y + box.h - 1;
        CHECK(badge_el_contains(el, NULL, left, el->y));
        CHECK(badge_el_contains(el, NULL, right, el->y));
        CHECK(badge_el_contains(el, NULL, el->x, top));
        CHECK(badge_el_contains(el, NULL, el->x, bottom));
        /* Just outside must not hit -- clamped to the panel, because a full-disc target
         * has no outside to test within the coordinate space. */
        if (left - 2 >= 0) CHECK(!badge_el_contains(el, NULL, left - 2, el->y));
        if (right + 2 <= BADGE_TOUCH_MAX) CHECK(!badge_el_contains(el, NULL, right + 2, el->y));
        if (top - 2 >= 0) CHECK(!badge_el_contains(el, NULL, el->x, top - 2));
        if (bottom + 2 <= BADGE_TOUCH_MAX) CHECK(!badge_el_contains(el, NULL, el->x, bottom + 2));
    }
    CHECK_EQ(hits, 16);
}

/* Label alignment: x is the anchor, so a left-aligned label's box starts at x and a
 * right-aligned one ends there. The status screen's values are right-aligned at x=376
 * and must not run off the glass. */
static void test_alignment(void)
{
    puts("label alignment");
    int left = 0, right = 0, center = 0;
    for (int i = 0; i < BADGE_EL_COUNT; i++) {
        const badge_el_t *el = &badge_els[i];
        if (el->type != BE_LABEL) continue;
        char text[256];
        expand(S(el->text), text, sizeof(text));
        badge_box_t box;
        if (!badge_el_box(el, text, &box)) continue;
        switch (el->align) {
        case BADGE_ALIGN_LEFT:
            left++;
            CHECK_EQ(box.x, el->x);
            break;
        case BADGE_ALIGN_RIGHT:
            right++;
            CHECK_EQ(box.x + box.w, el->x);
            break;
        default:
            center++;
            CHECK_EQ(box.x + box.w / 2, el->x);
            break;
        }
    }
    printf("  %d left, %d right, %d centred labels\n", left, right, center);
    CHECK(left > 0);
    CHECK(right > 0);
    CHECK(center > 0);
}

/* The five touch self-test targets, from the specification. Two of them are the ones a
 * mirrored touch panel swaps; the test's whole purpose is that a tap in the top-left
 * lights the top-left pill. So they must be where the spec says, and they must not
 * overlap each other. */
static void test_touch_targets(void)
{
    puts("touch self-test targets");
    CHECK_EQ(BADGE_TOUCH_TARGET_COUNT, 5);
    CHECK_EQ(badge_touch_targets[0].x, 113);
    CHECK_EQ(badge_touch_targets[0].y, 113);
    CHECK_EQ(badge_touch_targets[1].x, 353);
    CHECK_EQ(badge_touch_targets[1].y, 113);
    CHECK_EQ(badge_touch_targets[2].x, 353);
    CHECK_EQ(badge_touch_targets[2].y, 353);
    CHECK_EQ(badge_touch_targets[3].x, 113);
    CHECK_EQ(badge_touch_targets[3].y, 353);
    for (int i = 0; i < 5; i++) {
        /* 52x52 pills must be wholly inside the safe circle. */
        badge_box_t box = {badge_touch_targets[i].x - 26, badge_touch_targets[i].y - 26, 52, 52};
        CHECK(badge_box_farthest(&box) <= BADGE_SAFE_R);
        /* Distinguishable: no target contains another's centre. */
        for (int j = i + 1; j < 5; j++) {
            const int dx = badge_touch_targets[i].x - badge_touch_targets[j].x;
            const int dy = badge_touch_targets[i].y - badge_touch_targets[j].y;
            CHECK(dx * dx + dy * dy > 52 * 52);
        }
    }
}

/* The safe half-width helper the composites clamp with, checked against the circle
 * directly rather than against a hand-computed number. */
static void test_safe_half_width(void)
{
    puts("safe half-width helper");
    for (int y = 0; y <= 465; y += 5) {
        const int hw = badge_safe_half_width_at(y);
        if (hw == 0) continue;
        /* A box of that half-width, its bottom edge at y, must have all four corners
         * inside the safe circle... */
        const int dy = y > BADGE_CY ? y - BADGE_CY : BADGE_CY - y;
        CHECK(dy * dy + hw * hw <= BADGE_SAFE_R * BADGE_SAFE_R);
        /* ...and one pixel wider must not. */
        const int hw2 = hw + 1;
        if (dy * dy + hw2 * hw2 <= BADGE_SAFE_R * BADGE_SAFE_R) {
            printf("  FAIL half-width at y=%d is not maximal (%d)\n", y, hw);
            failures++;
        }
        checks++;
    }
    CHECK_EQ(badge_safe_half_width_at(BADGE_CY), BADGE_SAFE_R);
    CHECK_EQ(badge_safe_half_width_at(BADGE_CY + BADGE_SAFE_R), 0);
    CHECK_EQ(badge_safe_half_width_at(BADGE_CY - BADGE_SAFE_R), 0);
}

/* The publish-side helper the app layer will use: for every alert, the bubble at the
 * top of the head and the toast at the bottom must both fit. */
static void test_composites_fit(void)
{
    puts("composites fit the glass");
    /* The head bubble: widest permitted box, its centre at the spec's y. Two lines of
     * the spec's line height is its tallest form. */
    const int bw = BADGE_BUBBLE_MAX_W;
    const int bh = 2 * (int)badge_fonts[BADGE_BUBBLE_FONT].line_h;
    badge_box_t bubble = {BADGE_CX - bw / 2, BADGE_BUBBLE_Y - bh / 2, bw, bh};
    CHECK(badge_box_farthest(&bubble) <= BADGE_SAFE_R);

    /* The toast: the spec's own number does not fit, so the UI must clamp. Prove the
     * clamp is the thing that rescues it, and that the clamped form is still legible. */
    const int half = badge_safe_half_width_at(BADGE_TOAST_Y + BADGE_TOAST_H);
    CHECK(half < BADGE_TOAST_MAX_W / 2);
    CHECK(half >= 90);
    badge_box_t toast = {BADGE_CX - half, BADGE_TOAST_Y, half * 2, BADGE_TOAST_H};
    CHECK(badge_box_farthest(&toast) <= BADGE_SAFE_R);

    /* The alert bubble and the care buttons are circles: centre plus radius. */
    const badge_box_t alert = {BADGE_CX - BADGE_ALERT_R, 60 - BADGE_ALERT_R, BADGE_ALERT_R * 2,
                               BADGE_ALERT_R * 2};
    CHECK(badge_box_farthest(&alert) <= BADGE_SAFE_R);
}

/* ------------------------------------------------------------------ templates ---*/

static void test_template_contract(void)
{
    puts("template tokens");
    int strings_scanned = 0;
    for (int i = 1; i < BADGE_STRING_COUNT; i++) {
        const char *s = badge_strings[i];
        for (const char *p = s; *p; p++) {
            if (*p != '{') continue;
            const char *end = strchr(p + 1, '}');
            if (!end) continue;
            const size_t len = (size_t)(end - p - 1);
            strings_scanned++;
            if (!token_known(p + 1, len)) {
                printf("  FAIL token \"{%.*s}\" in \"%s\" is not in the expander contract\n",
                       (int)len, p + 1, s);
                failures++;
            }
            checks++;
            p = end;
        }
    }
    printf("  %d tokens found across %d strings\n", strings_scanned, BADGE_STRING_COUNT);

    /* Every token in the contract must actually occur somewhere: a stale entry in the
     * table is a token the UI implements and nothing uses, which hides the fact that
     * the string that used to carry it was renamed. */
    for (int i = 0; i < TOKEN_COUNT; i++) {
        char needle[40];
        snprintf(needle, sizeof(needle), "{%s}", TOKENS[i]);
        bool found = false;
        for (int j = 1; j < BADGE_STRING_COUNT && !found; j++) {
            /* `placeIcon` and `guideIcon` appear as element properties rather than in
             * strings, so those two are exempt. `careLabel` is only ever used with its
             * parameter (`{careLabel:feed}`), so its bare form is exempt too. */
            if (strcmp(TOKENS[i], "placeIcon") == 0 || strcmp(TOKENS[i], "guideIcon") == 0 ||
                strcmp(TOKENS[i], "careLabel") == 0) {
                found = true;
                break;
            }
            if (strstr(badge_strings[j], needle)) found = true;
        }
        if (!found) {
            printf("  FAIL contract token {%s} appears in no string\n", TOKENS[i]);
            failures++;
        }
        checks++;
    }
    /* The four care actions that have their own screen must be labelled by the
     * parameterised token, or the care screen would show a raw brace on the glass.
     * 摸摸 is the fifth and has no screen: it is an immediate action on the cat. */
    static const char *const labelled[] = {"feed", "water", "play", "sleep"};
    for (size_t k = 0; k < sizeof(labelled) / sizeof(labelled[0]); k++) {
        char needle[40];
        snprintf(needle, sizeof(needle), "{careLabel:%s}", labelled[k]);
        bool found = false;
        for (int j = 1; j < BADGE_STRING_COUNT && !found; j++) {
            if (strstr(badge_strings[j], needle)) found = true;
        }
        if (!found) {
            printf("  FAIL no string labels care \"%s\"\n", labelled[k]);
            failures++;
        }
        checks++;
    }
    /* And every key the generated table knows must be one the expander accepts. */
    for (int i = 0; i < BADGE_CARE_COUNT_SPEC; i++) {
        CHECK(badge_care_keys[i] != NULL);
        CHECK(badge_care_keys[i][0]);
    }
    CHECK_EQ(expansion_failures, 0);
}

int main(void)
{
    puts("badge geometry:");
    test_every_element();
    test_ring_band();
    test_buttons_are_tappable();
    test_no_overlapping_targets();
    test_hit_areas();
    test_alignment();
    test_touch_targets();
    test_safe_half_width();
    test_composites_fit();
    test_template_contract();

    printf("\n%d checks, %d failures\n", checks, failures);
    if (failures) {
        printf("BADGE GEOMETRY: FAILED\n");
        return 1;
    }
    printf("badge geometry: OK\n");
    return 0;
}
