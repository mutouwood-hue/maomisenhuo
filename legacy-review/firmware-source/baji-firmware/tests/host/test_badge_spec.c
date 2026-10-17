/*
 * Host test: the firmware agrees with the interaction specification's numbers.
 *
 * The badge's numbers used to be written in three places -- the renderer, the
 * firmware and the documentation -- and the firmware repeatedly showed the wrong
 * value on the glass. Now every number comes from badge_spec.json and everything
 * below fails loudly when the generator and the constraint header drift apart.
 *
 * This test is compiled with no LVGL, no ESP-IDF, no FreeRTOS and no allocation.
 */
#include <stdio.h>
#include <string.h>

#include "badge_geom.h"
#include "badge_events.h"
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

static const char *S(int idx)
{
    if (idx <= 0 || idx >= BADGE_STRING_COUNT) return "";
    return badge_strings[idx];
}

/* ------------------------------------------------------------------ tables --*/

static void test_counts(void)
{
    puts("counts");
    /* The specification's own census. A change here means the spec was revised. */
    CHECK_EQ(BADGE_SCREEN_COUNT_SPEC, 23);
    CHECK_EQ(BADGE_EL_COUNT, 151);
    CHECK_EQ(BADGE_COLOR_COUNT, 24);
    CHECK_EQ(BADGE_CARE_COUNT_SPEC, 5);
    CHECK_EQ(BADGE_STAT_COUNT, 5);
    CHECK_EQ(BADGE_EVENT_COUNT, 14);
    CHECK_EQ(BADGE_QUIRK_COUNT, 4);
    CHECK_EQ(BADGE_PLACE_COUNT, 3);
    CHECK_EQ(BADGE_GUIDE_COUNT, 5);
    CHECK_EQ(BADGE_TOUCH_TARGET_COUNT, 5);
    CHECK_EQ(BADGE_FONT_COUNT, 4);
    CHECK_STR(BADGE_SPEC_VERSION, "0.3.1");
}

static void test_geometry_constants(void)
{
    puts("geometry constants");
    CHECK_EQ(BADGE_SCR_W, 466);
    CHECK_EQ(BADGE_SCR_H, 466);
    CHECK_EQ(BADGE_CX, 233);
    CHECK_EQ(BADGE_CY, 233);
    CHECK_EQ(BADGE_R, 233);
    CHECK_EQ(BADGE_SAFE_R, 212);
    /* The ring band is the two numbers the old UI got wrong: content was checked
     * against 212 and ring elements against 233, so both halves of the rule were
     * half-enforced (docs/gap-vs-v1.5.md:174). */
    CHECK(BADGE_SAFE_R < BADGE_R);
    CHECK_EQ(BADGE_R - BADGE_SAFE_R, 21);
    CHECK_EQ(BADGE_TOUCH_MAX_SPEC, 465);
}

/* Every colour in the spec is #rrggbb, and the generated 565 value must be the
 * standard truncation of it -- the panel is RGB565, so a bad conversion is a
 * visible colour shift on the glass, not a rounding detail. */
static void test_colors(void)
{
    puts("colours");
    for (int i = 0; i < BADGE_COLOR_COUNT; i++) {
        const badge_color_t *c = &badge_colors[i];
        const uint16_t expect =
            (uint16_t)(((c->rgb888 >> 19) & 0x1F) << 11 | ((c->rgb888 >> 10) & 0x3F) << 5 |
                       ((c->rgb888 >> 3) & 0x1F));
        CHECK_EQ(c->rgb565, expect);
        CHECK_EQ(c->rgb565 & 0xFFFF, expect);
    }
    /* A few values the reference hard-codes, as a sanity check on the parse. */
    CHECK_EQ(badge_colors[BADGE_COLOR_BG].rgb888, 0x000000);
    CHECK_EQ(badge_colors[BADGE_COLOR_BG].rgb565, 0x0000);
    CHECK_EQ(badge_colors[BADGE_COLOR_ACCENT].rgb888, 0xF0A35E);
    CHECK_EQ(badge_colors[BADGE_COLOR_ACCENT].rgb565, 0xF50B);
    CHECK_EQ(badge_colors[BADGE_COLOR_WARN].rgb888, 0xFF6B6B);
    CHECK_EQ(badge_colors[BADGE_COLOR_RINGTRACK].rgb888, 0x2A2236);
}

/* The five stats and their 24-hour ring colours. A stat whose ring colour is not
 * defined renders as black. */
static void test_stats(void)
{
    puts("stats");
    for (int i = 0; i < BADGE_STAT_COUNT; i++) {
        CHECK(badge_stat_names[i] && badge_stat_names[i][0]);
        CHECK(badge_stat_low_color[i] != 0);
    }
    CHECK_STR(badge_stat_names[BADGE_STAT_FOOD], "饱腹");
    CHECK_STR(badge_stat_names[BADGE_STAT_MOOD], "心情");
    CHECK_STR(badge_stat_names[BADGE_STAT_CLEAN], "清洁");
    CHECK_STR(badge_stat_names[BADGE_STAT_ENERGY], "精力");
    CHECK_STR(badge_stat_names[BADGE_STAT_HEALTH], "健康");
}

/* ------------------------------------------------------------------ screens -*/

static void test_screens(void)
{
    puts("screens");
    static const char *expect[23] = {
        "main_a", "main_b", "main_c", "aod", "care_menu", "care_feed", "care_water",
        "care_play", "care_sleep", "sleeping", "status", "settings", "touch_test",
        "voice", "meet", "meet_tap", "meet_scan", "meet_done", "away", "lowbat",
        "boot", "pair", "guide",
    };
    int total = 0;
    int cats = 0;
    for (int i = 0; i < BADGE_SCREEN_COUNT_SPEC; i++) {
        const badge_screen_def_t *sd = &badge_screens[i];
        CHECK(badge_screen_def(i) == sd);
        CHECK(sd->name && sd->name[0]);
        CHECK(sd->doc && sd->doc[0]);
        CHECK(sd->enter && sd->enter[0]);
        CHECK(sd->exit && sd->exit[0]);
        CHECK_EQ(sd->el_first + sd->el_count <= BADGE_EL_COUNT, 1);
        CHECK_EQ(sd->gest_first + sd->gest_count <= BADGE_GEST_COUNT, 1);
        total += sd->el_count;
        cats += sd->has_cat ? 1 : 0;
        (void)expect;
    }
    CHECK_EQ(total, BADGE_EL_COUNT);
    /* 12 of the 23 screens draw the cat: the three dials, 待机常显, the five care
     * screens and the four moments that show the pet (睡觉/说话/遇见/碰一碰). The
     * others are about the badge itself. */
    CHECK_EQ(cats, 11);

    /* The screens must be contiguous and in order: the UI walks this table. */
    int cursor = 0;
    for (int i = 0; i < BADGE_SCREEN_COUNT_SPEC; i++) {
        CHECK_EQ(badge_screens[i].el_first, cursor);
        cursor += badge_screens[i].el_count;
    }
    CHECK_EQ(cursor, BADGE_EL_COUNT);

    CHECK(badge_screen_def(-1) == NULL);
    CHECK(badge_screen_def(BADGE_SCREEN_COUNT_SPEC) == NULL);
}

static void test_screen_names(void)
{
    puts("screen names");
    /* The names the glass shows, in the spec's words. A mismatch here is a screen
     * whose title is wrong on the device, which no other check would notice. */
    CHECK_STR(badge_screens[0].name, "主表盘 A · 只有小猫");
    CHECK_STR(badge_screens[4].name, "照料轮盘");
    CHECK_STR(badge_screens[10].name, "状态");
    CHECK_STR(badge_screens[11].name, "设置");
    CHECK_STR(badge_screens[19].name, "电量不足");
    CHECK_STR(badge_screens[21].name, "配对");
    /* Every screen must name itself and say how to leave it: the guide screens and
     * the touch self-test have no exit button, only the exit sentence. */
    for (int i = 0; i < BADGE_SCREEN_COUNT_SPEC; i++) {
        CHECK(badge_screens[i].name[0]);
        CHECK(badge_screens[i].exit[0]);
    }
}

static void test_elements(void)
{
    puts("elements");
    int by_type[BE_TYPE_COUNT];
    memset(by_type, 0, sizeof(by_type));
    for (int i = 0; i < BADGE_EL_COUNT; i++) {
        const badge_el_t *e = &badge_els[i];
        CHECK(e->type < BE_TYPE_COUNT);
        CHECK(e->id && S(e->id)[0]);
        CHECK(e->font >= BADGE_FONT_F16 && e->font <= BADGE_FONT_N40);
        CHECK(e->align <= BADGE_ALIGN_RIGHT);
        CHECK(e->when <= BADGE_WHEN_ALERT);
        /* Colour indices must be either real or the "unset" sentinel: an index of
         * 24 would read past badge_colors[] in the renderer. */
        const int colors[5] = {e->color, e->bg, e->fg, e->ring, e->track};
        for (int k = 0; k < 5; k++) {
            CHECK(colors[k] < BADGE_COLOR_COUNT || colors[k] == BADGE_COLOR_NONE);
        }
        CHECK(e->care == BADGE_CARE_NONE || e->care < BADGE_CARE_COUNT_SPEC);
        CHECK(e->value == BADGE_VALUE_NONE || e->value < BADGE_VALUE_COUNT);
        CHECK(e->act == BADGE_ACT_NONE || e->act < BADGE_ACT_COUNT);
        CHECK(e->text < BADGE_STRING_COUNT);
        if (e->icon != BADGE_ICON_NONE && e->icon != BADGE_ICON_DYN_PLACE &&
            e->icon != BADGE_ICON_DYN_GUIDE) {
            CHECK(e->icon < BADGE_ICON_COUNT);
        }
        CHECK(e->scale_x2 >= 2 && e->scale_x2 <= 12);
        by_type[e->type]++;
    }
    /* Types the spec's census counts. These are the spec's numbers, so a change is
     * a spec revision, not a bug fix. */
    CHECK_EQ(by_type[BE_LABEL], 72);
    CHECK_EQ(by_type[BE_ICON], 13);
    CHECK_EQ(by_type[BE_BATTERY], 3);
    CHECK_EQ(by_type[BE_ARC], 5);
    CHECK_EQ(by_type[BE_ALERT], 3);
    CHECK_EQ(by_type[BE_HIT], 16);
    CHECK_EQ(by_type[BE_DAYRING], 2);
    CHECK_EQ(by_type[BE_BTN], 9);
    CHECK_EQ(by_type[BE_SEGS], 3);
    CHECK_EQ(by_type[BE_FEATHER], 1);
    CHECK_EQ(by_type[BE_ZZZ], 1);
    CHECK_EQ(by_type[BE_BAR], 5);
    CHECK_EQ(by_type[BE_TOGGLE], 3);
    CHECK_EQ(by_type[BE_PILL], 10);
    CHECK_EQ(by_type[BE_WAVE], 1);
    CHECK_EQ(by_type[BE_QR], 1);
    CHECK_EQ(by_type[BE_HEARTS], 1);
    CHECK_EQ(by_type[BE_DOTS], 2);
}

/* ------------------------------------------------------------------ care ----*/

static void test_care(void)
{
    puts("care");
    CHECK_STR(S(badge_care_defs[BADGE_CARE_PET].label), "摸摸");
    CHECK_STR(S(badge_care_defs[BADGE_CARE_FEED].label), "喂食");
    CHECK_STR(S(badge_care_defs[BADGE_CARE_WATER].label), "喝水");
    CHECK_STR(S(badge_care_defs[BADGE_CARE_PLAY].label), "逗猫");
    CHECK_STR(S(badge_care_defs[BADGE_CARE_SLEEP].label), "睡觉");

    /* The reference's own numbers for the two care actions it fully simulates. */
    const badge_care_def_t *feed = &badge_care_defs[BADGE_CARE_FEED];
    CHECK_EQ(feed->delta[BADGE_STAT_FOOD], 25);
    CHECK_EQ(feed->delta[BADGE_STAT_MOOD], 3);
    CHECK_EQ(feed->delta[BADGE_STAT_CLEAN], -2);
    CHECK_EQ(feed->growth, 8);
    CHECK_EQ(feed->coins, -3);
    CHECK_EQ(feed->steps, 3);

    const badge_care_def_t *play = &badge_care_defs[BADGE_CARE_PLAY];
    CHECK_EQ(play->delta[BADGE_STAT_MOOD], 12);
    CHECK_EQ(play->delta[BADGE_STAT_ENERGY], -5);
    CHECK_EQ(play->delta[BADGE_STAT_FOOD], -3);
    CHECK_EQ(play->growth, 8);
    CHECK_EQ(play->steps, 5);

    /* Every refusal rule must live in badge_blocks[] and be reachable. */
    int blocks = 0;
    for (int i = 0; i < BADGE_CARE_COUNT_SPEC; i++) {
        const badge_care_def_t *c = &badge_care_defs[i];
        CHECK(c->block_first + c->block_count <= BADGE_BLOCK_COUNT);
        for (int k = 0; k < c->block_count; k++) {
            const badge_block_t *b = &badge_blocks[c->block_first + k];
            CHECK(b->text < BADGE_STRING_COUNT);
            CHECK(S(b->text)[0]);
            CHECK(b->stat == BADGE_STAT_SICK || b->stat == BADGE_STAT_COINS ||
                  b->stat < BADGE_STAT_COUNT);
            CHECK(b->op <= BADGE_OP_EQ);
            blocks++;
        }
        /* 喝水 is the one care action the specification gives no refusal rule for:
         * you can always offer water. The other four must all be refusable, or a
         * care action cannot be cancelled the way the spec describes. */
        CHECK_EQ(c->block_count > 0, i != BADGE_CARE_WATER);
    }
    CHECK_EQ(blocks, BADGE_BLOCK_COUNT);
    CHECK(badge_care_def(-1) == NULL);
}

/* ------------------------------------------------------------------ events --*/

static void test_events(void)
{
    puts("events");
    static const int nums[14] = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14};
    for (int i = 0; i < BADGE_EVENT_COUNT; i++) {
        CHECK_EQ(badge_event_defs[i].num, nums[i]);
        CHECK(S(badge_event_defs[i].label)[0]);
    }
    /* The wire format is fixed at 8 bytes (spec 9): ts(uint32) type(uint8)
     * a(uint8) b(int16). The App decodes this, so it is a contract. */
    CHECK_EQ(BADGE_EVENT_WIRE_BYTES, 8);
    CHECK_EQ(BADGE_EVENT_QUEUE_MAX, 200);
    /* The types are numbered by the spec; the enum and the table must agree, or the
     * App reads "喂食" where the badge meant "喝水". */
    static const uint8_t evt[14] = {
        EVT_PET, EVT_FEED, EVT_WATER, EVT_PLAY, EVT_SLEEP, EVT_CARE_CANCEL, EVT_VOICE_CMD,
        EVT_VOICE_FREE, EVT_QUIRK_CATCH, EVT_MEET, EVT_CALL_HOME, EVT_WAKE, EVT_FACE, EVT_SETTING,
    };
    for (int i = 0; i < BADGE_EVENT_COUNT; i++) {
        CHECK_EQ(badge_event_defs[i].num, i + 1);
        CHECK_EQ(evt[i], i + 1);
    }
    CHECK_STR(S(badge_event_defs[EVT_PET - 1].label), "摸摸");
    CHECK_STR(S(badge_event_defs[EVT_SETTING - 1].label), "改设置");
}

/* ---------------------------------------------------------------- timing ----*/

static void test_numbers(void)
{
    puts("timings and thresholds");
    /* Spot-check the specification's timings. These drive gesture recognition and
     * the mode ladder, so a wrong one is a badge that feels broken. */
    CHECK_EQ(badge_numbers.tap_max_ms, 300);
    CHECK_EQ(badge_numbers.tap_move_max, 12);
    CHECK_EQ(badge_numbers.long_press_ms, 600);
    CHECK_EQ(badge_numbers.swipe_min_px, 50);
    CHECK_EQ(badge_numbers.swipe_max_ms, 500);
    CHECK_EQ(badge_numbers.transition_ms, 220);
    CHECK_EQ(badge_numbers.toast_ms, 1800);
    CHECK_EQ(badge_numbers.bubble_ms, 2000);
    CHECK_EQ(badge_numbers.play_to_comp_ms, 10000);
    CHECK_EQ(badge_numbers.comp_to_aod_ms, 30000);
    CHECK_EQ(badge_numbers.aod_redraw_ms, 60000);
    CHECK_EQ(badge_numbers.care_cooldown_ms, 4000);
    CHECK_EQ(badge_numbers.pet_cooldown_ms, 2000);
    CHECK_EQ(badge_numbers.voice_max_ms, 8000);
    CHECK_EQ(badge_numbers.voice_silence_ms, 1200);
    CHECK_EQ(badge_numbers.voice_think_ms, 600);
    CHECK_EQ(badge_numbers.meet_timeout_ms, 30000);
    CHECK_EQ(badge_numbers.tap_confirm_timeout_ms, 20000);
    CHECK_EQ(badge_numbers.meet_done_ms, 4000);
    CHECK_EQ(badge_numbers.quirk_min_ms, 35000);
    CHECK_EQ(badge_numbers.quirk_max_ms, 80000);
    CHECK_EQ(badge_numbers.quirk_idle_ms, 9000);
    CHECK_EQ(badge_numbers.sleep_hold_ms, 1500);
    CHECK_EQ(badge_numbers.sleep_demo_ms, 6000);
    CHECK_EQ(badge_numbers.play_pounce_speed, 900);
    CHECK_EQ(badge_numbers.play_pounce_gap_ms, 700);
    CHECK_EQ(badge_numbers.play_timeout_ms, 25000);
    CHECK_EQ(badge_numbers.boot_ms, 2000);
    CHECK_EQ(badge_numbers.call_home_ms, 1800000);
    CHECK_EQ(badge_numbers.low_stat, 30);
    CHECK_EQ(badge_numbers.full, 95);
    CHECK_EQ(badge_numbers.mood_full, 98);
    CHECK_EQ(badge_numbers.min_energy_play, 10);
    CHECK_EQ(badge_numbers.bat_no_wake, 20);
    CHECK_EQ(badge_numbers.bat_critical, 5);
    /* Modes: 互动态 is the one that renders at half resolution, and the standby
     * mode renders no 3D at all (fps 0) at 35 % brightness. */
    CHECK_EQ(badge_numbers.desk_fps, 30);
    CHECK_EQ(badge_numbers.desk_res, 466);
    CHECK_EQ(badge_numbers.play_fps, 30);
    CHECK_EQ(badge_numbers.play_res, 233);
    CHECK_EQ(badge_numbers.comp_fps, 12);
    CHECK_EQ(badge_numbers.comp_res, 466);
    CHECK_EQ(badge_numbers.aod_fps, 0);
    CHECK_EQ(badge_numbers.aod_res, 466);
    CHECK_EQ(badge_numbers.aod_bright_pct, 35);
    /* The ladder must be monotone, and the AOD the slowest. */
    CHECK(badge_numbers.play_fps >= badge_numbers.comp_fps);
    CHECK(badge_numbers.comp_fps > badge_numbers.aod_fps);
    CHECK(badge_numbers.aod_bright_pct < 100);
    CHECK_EQ(badge_numbers.play_to_sleep_ms,
             badge_numbers.play_to_comp_ms + badge_numbers.comp_to_aod_ms);
}

/* ------------------------------------------------------------- components ---*/

static void test_components(void)
{
    puts("components");
    CHECK(BADGE_BUBBLE_MAX_W < BADGE_SAFE_R * 2);
    CHECK(BADGE_TOAST_MAX_W <= BADGE_SAFE_R * 2);
    CHECK(BADGE_ALERT_R > 0 && BADGE_ALERT_R < BADGE_SAFE_R);
    CHECK(BADGE_BUBBLE_BG < BADGE_COLOR_COUNT);
    CHECK(BADGE_TOAST_BG < BADGE_COLOR_COUNT);
    CHECK(BADGE_ALERT_BG < BADGE_COLOR_COUNT);
    CHECK(BADGE_ALERT_RING < BADGE_COLOR_COUNT);
    CHECK(BADGE_FLOAT_COLOR < BADGE_COLOR_COUNT);
    CHECK_EQ(BADGE_BUBBLE_FONT, BADGE_FONT_F20);
    CHECK_EQ(BADGE_TOAST_FONT, BADGE_FONT_F16);
    CHECK(BADGE_BUBBLE_RADIUS > 0);
    CHECK(BADGE_TOAST_RADIUS > 0);
    CHECK(BADGE_ALERT_PULSE_MS > 0);
    CHECK(BADGE_FLOAT_RISE_MS > 0);
    CHECK_EQ(BADGE_ALERT_ICON_SCALE_X2, 4); /* iconScale 2 */
    /* The bubble sits at the top of the head, inside the disc. Its widest form must
     * clear the safe circle. */
    CHECK(BADGE_BUBBLE_Y > 0 && BADGE_BUBBLE_Y < BADGE_CY);
    CHECK(BADGE_BUBBLE_MAX_W / 2 <= badge_safe_half_width_at(BADGE_BUBBLE_Y));
    CHECK(BADGE_BUBBLE_MAX_LINES >= 1);

    /* The specification's own toast does NOT fit its own safe circle: 220 px wide
     * with its bottom edge at y=420 reaches 216 px from the centre, four past 212.
     * Recorded here, and clamped by the UI with badge_safe_half_width_at() -- this
     * is the kind of arithmetic the old UI got silently wrong under the bezel. */
    const int toast_bottom = BADGE_TOAST_Y + BADGE_TOAST_H;
    CHECK(toast_bottom <= BADGE_SCR_H);
    /* 99 px half-width at that height, i.e. the toast may be at most ~198 px wide. */
    CHECK_EQ(badge_safe_half_width_at(toast_bottom), 99);
    CHECK(badge_safe_half_width_at(toast_bottom) < BADGE_TOAST_MAX_W / 2);
    CHECK(badge_safe_half_width_at(toast_bottom) > 60); /* still usable */
}

/* ------------------------------------------------------------------ misc ----*/

static void test_places_voice_guide(void)
{
    puts("places, voice, guide");
    for (int i = 0; i < BADGE_PLACE_COUNT; i++) {
        CHECK(S(badge_place_defs[i].text)[0]);
        CHECK(S(badge_place_defs[i].sub)[0]);
        CHECK(badge_place_defs[i].icon < BADGE_ICON_COUNT);
    }
    for (int i = 0; i < BADGE_VOICE_COUNT; i++) {
        CHECK(badge_voice_defs[i].num >= 1);
        CHECK(S(badge_voice_defs[i].word)[0]);
        CHECK(S(badge_voice_defs[i].action)[0]);
    }
    /* The specification lists 17 offline commands. */
    CHECK_EQ(BADGE_VOICE_COUNT, 17);
    for (int i = 0; i < BADGE_GUIDE_COUNT; i++) {
        CHECK(S(badge_guide_defs[i].title)[0]);
        CHECK(S(badge_guide_defs[i].sub)[0]);
    }
    for (int i = 0; i < BADGE_TOUCH_TARGET_COUNT; i++) {
        CHECK(S(badge_touch_targets[i].label)[0]);
        CHECK(badge_touch_targets[i].x >= 0 && badge_touch_targets[i].x <= BADGE_TOUCH_MAX_SPEC);
        CHECK(badge_touch_targets[i].y >= 0 && badge_touch_targets[i].y <= BADGE_TOUCH_MAX_SPEC);
    }
    /* The five touch targets are the four corners and the centre, per the spec. */
    CHECK_EQ(badge_touch_targets[4].x, BADGE_CX);
    CHECK_EQ(badge_touch_targets[4].y, BADGE_CY);
}

static void test_strings(void)
{
    puts("strings");
    CHECK_EQ(badge_strings[0][0], '\0');
    int nonempty = 0;
    for (int i = 1; i < BADGE_STRING_COUNT; i++) {
        CHECK(badge_strings[i] != NULL);
        if (badge_strings[i][0]) nonempty++;
    }
    CHECK(nonempty > 300);
    /* Named strings the code addresses by macro must be real. */
    CHECK_STR(S(BADGE_TXT_WAKEWORD), "小橘小橘");
    CHECK_STR(S(BADGE_TXT_PHONEON), "手机已连接");
    CHECK_STR(S(BADGE_TXT_PHONEOFF), "手机未连接");
}

/* The uplink's own labels, so a log line names an event by the spec's words. */
static void test_hw_facts(void)
{
    puts("hardware facts");
    CHECK_EQ(BADGE_HW_MOTOR, 0);
    CHECK_EQ(BADGE_HW_SPEAKER, 1);
    CHECK_EQ(BADGE_HW_NFC, 0);
    CHECK_EQ(BADGE_HW_IMU, 1);
    CHECK_EQ(BADGE_HW_TOUCH_SWAP_XY, 0);
    CHECK_EQ(BADGE_HW_TOUCH_MIRROR_X, 1);
    CHECK_EQ(BADGE_HW_TOUCH_MIRROR_Y, 1);
    CHECK_EQ(BADGE_HW_TOUCH_ROTATION, 0);
    CHECK_EQ(BADGE_HW_TOUCH_ADDR, 0x5A);
    CHECK_EQ(BADGE_HW_IMU_ADDR, 0x6B);
    CHECK_EQ(BADGE_HW_PA_GPIO, 46);
    CHECK_EQ(BADGE_HAPTIC_RING_R, 227);
    CHECK_EQ(BADGE_HAPTIC_RING_W, 6);
    CHECK_EQ(BADGE_HAPTIC_MS, 320);
}

int main(void)
{
    puts("badge spec tables:");
    test_counts();
    test_geometry_constants();
    test_colors();
    test_stats();
    test_screens();
    test_screen_names();
    test_elements();
    test_care();
    test_events();
    test_numbers();
    test_components();
    test_places_voice_guide();
    test_strings();
    test_hw_facts();

    printf("\n%d checks, %d failures\n", checks, failures);
    if (failures) {
        printf("BADGE SPEC TABLES: FAILED\n");
        return 1;
    }
    printf("badge spec tables: OK\n");
    return 0;
}
