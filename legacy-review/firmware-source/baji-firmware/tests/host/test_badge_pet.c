/*
 * Host test: the care kernel's arithmetic and refusal rules.
 *
 * Every number asserted here is the interaction specification's own (via
 * badge_spec_data.c). The point of the test is not that the code multiplies three
 * numbers correctly; it is that the badge never invents a number the App does not
 * know about -- no decay, no clamping that disagrees with the phone, no growth for a
 * care the owner abandoned halfway.
 */
#include <stdio.h>
#include <string.h>

#include "badge_events.h"
#include "badge_pet.h"
#include "badge_spec_data.h"

static int failures;
static int checks;

#define CHECK(cond)                                                     \
    do {                                                                \
        checks++;                                                       \
        if (!(cond)) {                                                  \
            printf("  FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);    \
            failures++;                                                 \
        }                                                               \
    } while (0)

#define CHECK_EQ(a, b)                                                                    \
    do {                                                                                  \
        checks++;                                                                         \
        long long va = (long long)(a), vb = (long long)(b);                               \
        if (va != vb) {                                                                   \
            printf("  FAIL %s:%d: %s == %s (%lld != %lld)\n", __FILE__, __LINE__, #a, #b, \
                   va, vb);                                                               \
            failures++;                                                                   \
        }                                                                                 \
    } while (0)

static const char *S(uint16_t idx)
{
    if (idx == 0 || idx >= BADGE_STRING_COUNT) return "";
    return badge_strings[idx];
}

#define CHECK_STR_EQ(a, b)                                                                 \
    do {                                                                                   \
        checks++;                                                                          \
        const char *sa = (a), *sb = (b);                                                   \
        if (!sa || !sb || strcmp(sa, sb) != 0) {                                           \
            printf("  FAIL %s:%d: \"%s\" != \"%s\"\n", __FILE__, __LINE__, sa ? sa : "",   \
                   sb ? sb : "");                                                          \
            failures++;                                                                    \
        }                                                                                  \
    } while (0)

static void game_new(badge_game_t *g)
{
    memset(g, 0, sizeof(*g));
    for (int i = 0; i < BADGE_STAT_COUNT; i++) g->stat[i] = 65;
    g->coins = 30;
    g->bright = 1;
    g->wake_word = true;
    g->discover = true;
    g->aod = true;
    strcpy(g->name, "小橘");
    g->breed = 0;
}

/* ------------------------------------------------------------------ stages ----*/

static void test_stages(void)
{
    puts("stages");
    badge_game_t g;
    game_new(&g);

    CHECK_EQ(badge_stage_growth[0], 0);
    CHECK_EQ(badge_stage_growth[1], 60);
    CHECK_EQ(badge_stage_growth[2], 160);
    CHECK_EQ(BADGE_STAGE_COUNT, 3);

    const int32_t growth[] = {0, 1, 59, 60, 61, 159, 160, 100000};
    const char *names[] = {"幼猫", "幼猫", "幼猫", "少年猫", "少年猫", "少年猫",
                           "成年猫", "成年猫"};
    const int32_t next[] = {60, 60, 60, 160, 160, 160, 160, 160};
    for (int i = 0; i < 8; i++) {
        g.growth = growth[i];
        CHECK_STR_EQ(badge_pet_stage_name(&g), names[i]);
        CHECK_EQ(badge_pet_next_growth(&g), next[i]);
    }
    /* The stage name comes from the spec's table, not a literal in the kernel. */
    CHECK_STR_EQ(badge_pet_stage_name(&g), badge_stage_names[2]);
}

/* ------------------------------------------------------------------ care -------*/

static void test_pet_care(void)
{
    puts("摸摸 (pet)");
    badge_game_t g;
    game_new(&g);
    g.stat[BADGE_STAT_MOOD] = 90;
    g.growth = 10;

    uint16_t why = 0;
    CHECK(badge_pet_care_allowed(&g, BADGE_CARE_PET, &why));
    CHECK_EQ(why, 0);

    const badge_care_outcome_t out = badge_pet_care_step(&g, BADGE_CARE_PET, 0);
    CHECK_EQ(out.result, BADGE_CARE_DONE);
    CHECK_EQ(out.steps, 1);
    CHECK_EQ(out.step, 1);
    CHECK_EQ(g.stat[BADGE_STAT_MOOD], 99);
    CHECK_EQ(g.growth, 13); /* +3 */
    CHECK_EQ(g.coins, 30);

    /* Already happy: refused with the specification's own wording. */
    g.stat[BADGE_STAT_MOOD] = badge_numbers.mood_full;
    CHECK(!badge_pet_care_allowed(&g, BADGE_CARE_PET, &why));
    CHECK_STR_EQ(S(why), "已经很开心啦");
    const badge_care_outcome_t blocked = badge_pet_care_step(&g, BADGE_CARE_PET, 0);
    CHECK_EQ(blocked.result, BADGE_CARE_BLOCKED);
    CHECK_EQ(g.growth, 13); /* nothing happened */

    /* One below the threshold is still allowed. */
    g.stat[BADGE_STAT_MOOD] = (uint8_t)(badge_numbers.mood_full - 1);
    CHECK(badge_pet_care_allowed(&g, BADGE_CARE_PET, &why));
}

static void test_feed_care(void)
{
    puts("喂食 (feed)");
    badge_game_t g;
    game_new(&g);
    g.stat[BADGE_STAT_FOOD] = 20;
    g.stat[BADGE_STAT_MOOD] = 50;
    g.stat[BADGE_STAT_CLEAN] = 70;
    g.growth = 100;
    g.coins = 10;

    /* Three bites. Each bite moves the stats; growth and coins land on the last. */
    for (int step = 0; step < 3; step++) {
        const badge_care_outcome_t o = badge_pet_care_step(&g, BADGE_CARE_FEED, step);
        CHECK_EQ(o.steps, 3);
        CHECK_EQ(o.step, step + 1);
        CHECK_EQ(o.delta[BADGE_STAT_FOOD], 25);
        CHECK_EQ(o.delta[BADGE_STAT_MOOD], 3);
        CHECK_EQ(o.delta[BADGE_STAT_CLEAN], -2);
        if (step < 2) {
            CHECK_EQ(o.result, BADGE_CARE_OK);
            CHECK_EQ(g.growth, 100);
            CHECK_EQ(g.coins, 10);
        } else {
            CHECK_EQ(o.result, BADGE_CARE_DONE);
            CHECK_EQ(g.growth, 108);
            CHECK_EQ(g.coins, 7);
        }
    }
    CHECK_EQ(g.stat[BADGE_STAT_FOOD], 95); /* 20 + 75, exactly at full */
    CHECK_EQ(g.stat[BADGE_STAT_MOOD], 59); /* 50 + 9 */
    CHECK_EQ(g.stat[BADGE_STAT_CLEAN], 64); /* 70 - 6 */

    /* Refused at full. */
    uint16_t why = 0;
    CHECK(!badge_pet_care_allowed(&g, BADGE_CARE_FEED, &why));
    CHECK_STR_EQ(S(why), "吃饱了");

    /* Refused without coins, and 3 coins is exactly enough. */
    g.stat[BADGE_STAT_FOOD] = 10;
    g.coins = 2;
    CHECK(!badge_pet_care_allowed(&g, BADGE_CARE_FEED, &why));
    CHECK_STR_EQ(S(why), "喵币不够");
    g.coins = 3;
    CHECK(badge_pet_care_allowed(&g, BADGE_CARE_FEED, &why));

    /* A cancelled feed keeps the bites it took and earns no growth. */
    game_new(&g);
    g.stat[BADGE_STAT_FOOD] = 20;
    g.growth = 100;
    (void)badge_pet_care_step(&g, BADGE_CARE_FEED, 0);
    CHECK_EQ(g.stat[BADGE_STAT_FOOD], 45);
    CHECK_EQ(g.growth, 100); /* no settle: the owner stopped halfway */
    CHECK_EQ(g.coins, 30);
}

static void test_water_care(void)
{
    puts("喝水 (water)");
    badge_game_t g;
    game_new(&g);
    g.stat[BADGE_STAT_ENERGY] = 10;

    /* The specification gives 喝水 no refusal rule: water is always allowed. */
    uint16_t why = 123;
    CHECK(badge_pet_care_allowed(&g, BADGE_CARE_WATER, &why));
    CHECK_EQ(why, 0);
    CHECK_EQ(badge_care_defs[BADGE_CARE_WATER].block_count, 0);
    CHECK_EQ(badge_care_defs[BADGE_CARE_WATER].steps, 3);

    for (int step = 0; step < 3; step++) {
        const badge_care_outcome_t o = badge_pet_care_step(&g, BADGE_CARE_WATER, step);
        CHECK_EQ(o.steps, 3);
        CHECK_EQ(o.result, step == 2 ? BADGE_CARE_DONE : BADGE_CARE_OK);
    }
    CHECK_EQ(g.stat[BADGE_STAT_MOOD], 74);   /* 65 + 3 per sip */
    CHECK_EQ(g.stat[BADGE_STAT_ENERGY], 28); /* 10 + 6 per sip */
    /* Growth is settled ONCE for the whole action, not once per step: three sips are
     * still one 喝水, and the specification's table gives it +4. */
    CHECK_EQ(g.growth, 4);
}

static void test_play_care(void)
{
    puts("逗猫 (play)");
    badge_game_t g;
    game_new(&g);
    g.stat[BADGE_STAT_ENERGY] = 50;
    g.stat[BADGE_STAT_MOOD] = 40;
    g.stat[BADGE_STAT_FOOD] = 50;

    uint16_t why = 0;
    CHECK(badge_pet_care_allowed(&g, BADGE_CARE_PLAY, &why));

    for (int step = 0; step < 5; step++) {
        const badge_care_outcome_t o = badge_pet_care_step(&g, BADGE_CARE_PLAY, step);
        CHECK_EQ(o.steps, 5);
        if (step == 4) CHECK_EQ(o.result, BADGE_CARE_DONE);
    }
    CHECK_EQ(g.stat[BADGE_STAT_MOOD], 100);  /* 40 + 60, clamped */
    CHECK_EQ(g.stat[BADGE_STAT_ENERGY], 25); /* 50 - 25 */
    CHECK_EQ(g.stat[BADGE_STAT_FOOD], 35);   /* 50 - 15 */
    CHECK_EQ(g.growth, 8);

    /* Tired: 9 energy is refused, 10 is allowed. */
    game_new(&g);
    g.stat[BADGE_STAT_ENERGY] = badge_numbers.min_energy_play - 1;
    CHECK(!badge_pet_care_allowed(&g, BADGE_CARE_PLAY, &why));
    CHECK_STR_EQ(S(why), "没力气了");
    g.stat[BADGE_STAT_ENERGY] = badge_numbers.min_energy_play;
    CHECK(badge_pet_care_allowed(&g, BADGE_CARE_PLAY, &why));

    /* Ill: refused even with plenty of energy. */
    g.sick = true;
    CHECK(!badge_pet_care_allowed(&g, BADGE_CARE_PLAY, &why));
    CHECK_STR_EQ(S(why), "不舒服");
}

static void test_sleep_care(void)
{
    puts("睡觉 (sleep)");
    badge_game_t g;
    game_new(&g);
    g.stat[BADGE_STAT_ENERGY] = 40;
    g.stat[BADGE_STAT_FOOD] = 60;
    g.stat[BADGE_STAT_HEALTH] = 80;

    uint16_t why = 0;
    CHECK(badge_pet_care_allowed(&g, BADGE_CARE_SLEEP, &why));
    const badge_care_outcome_t o = badge_pet_care_step(&g, BADGE_CARE_SLEEP, 0);
    CHECK_EQ(o.result, BADGE_CARE_DONE);
    CHECK_EQ(g.stat[BADGE_STAT_ENERGY], 75);
    CHECK_EQ(g.stat[BADGE_STAT_FOOD], 56);
    CHECK_EQ(g.stat[BADGE_STAT_HEALTH], 82);
    CHECK_EQ(g.growth, 6);

    /* 95 energy is exactly "not sleepy". */
    g.stat[BADGE_STAT_ENERGY] = (uint8_t)badge_numbers.full;
    CHECK(!badge_pet_care_allowed(&g, BADGE_CARE_SLEEP, &why));
    CHECK_STR_EQ(S(why), "还不困");
    g.stat[BADGE_STAT_ENERGY] = (uint8_t)(badge_numbers.full - 1);
    CHECK(badge_pet_care_allowed(&g, BADGE_CARE_SLEEP, &why));
}

static void test_care_bounds(void)
{
    puts("care bounds");
    badge_game_t g;
    game_new(&g);
    CHECK(!badge_pet_care_allowed(&g, -1, NULL));
    CHECK(!badge_pet_care_allowed(&g, BADGE_CARE_COUNT_SPEC, NULL));
    CHECK_EQ(badge_pet_care_step(&g, -1, 0).result, BADGE_CARE_INVALID);
    CHECK_EQ(badge_pet_care_step(&g, 99, 0).result, BADGE_CARE_INVALID);
    /* A step past the end is invalid, not a silent settle. */
    CHECK_EQ(badge_pet_care_step(&g, BADGE_CARE_FEED, 3).result, BADGE_CARE_INVALID);
    CHECK_EQ(badge_pet_care_step(&g, BADGE_CARE_FEED, -1).result, BADGE_CARE_INVALID);
    /* Every care action has a label and at least one step. 摸摸 and 睡觉 carry no
     * `steps` in the specification -- they are single actions, so the generated table
     * holds 0 and the kernel reads that as "one step". */
    for (int i = 0; i < BADGE_CARE_COUNT_SPEC; i++) {
        CHECK(S(badge_care_defs[i].label)[0]);
        const int want = badge_care_defs[i].steps > 0 ? badge_care_defs[i].steps : 1;
        const badge_care_outcome_t o = badge_pet_care_step(&g, i, 0);
        CHECK_EQ(o.steps, want);
        CHECK(o.steps >= 1);
        CHECK(o.result != BADGE_CARE_INVALID);
    }
    CHECK_EQ(badge_care_defs[BADGE_CARE_PET].steps, 0);
    CHECK_EQ(badge_care_defs[BADGE_CARE_SLEEP].steps, 0);
    CHECK_EQ(badge_care_defs[BADGE_CARE_FEED].steps, 3);
    CHECK_EQ(badge_care_defs[BADGE_CARE_WATER].steps, 3);
    CHECK_EQ(badge_care_defs[BADGE_CARE_PLAY].steps, 5);
}

/* ------------------------------------------------------------------ sync -------*/

static void test_sync_and_clamp(void)
{
    puts("sync from the App");
    badge_game_t g;
    game_new(&g);

    const uint8_t stats[BADGE_STAT_COUNT] = {120, 0, 50, 200, 30};
    badge_pet_sync(&g, stats, -5, 99999999, true);
    CHECK_EQ(g.stat[BADGE_STAT_FOOD], 100);
    CHECK_EQ(g.stat[BADGE_STAT_MOOD], 0);
    CHECK_EQ(g.stat[BADGE_STAT_CLEAN], 50);
    CHECK_EQ(g.stat[BADGE_STAT_ENERGY], 100);
    CHECK_EQ(g.stat[BADGE_STAT_HEALTH], 30);
    CHECK_EQ(g.growth, 0);
    CHECK_EQ(g.coins, 1000000);
    CHECK(g.sick);

    /* A phone that sends nothing (NULL) still gets growth/coins applied. */
    badge_pet_sync(&g, NULL, 200, 5, false);
    CHECK_EQ(g.stat[BADGE_STAT_HEALTH], 30);
    CHECK_EQ(g.growth, 200);
    CHECK_EQ(g.coins, 5);
    CHECK(!g.sick);
}

/* ------------------------------------------------------------------ alerts -----*/

static void test_alerts(void)
{
    puts("alerts");
    badge_game_t g;
    game_new(&g);
    /* Nothing low, and healthy. */
    CHECK_EQ(badge_pet_alert(&g), -1);
    CHECK(!badge_pet_sick(&g));
    CHECK_EQ(badge_pet_lowest_stat(&g), -1);

    /* The illness alert comes first in the specification's list and outranks stats. */
    CHECK_EQ(badge_alerts[0].stat, BADGE_STAT_SICK);
    g.sick = true;
    g.stat[BADGE_STAT_FOOD] = 1; /* even with a starving cat */
    CHECK_EQ(badge_pet_alert(&g), 0);
    CHECK(badge_pet_sick(&g));
    CHECK_STR_EQ(S(badge_alerts[0].text), "有点不舒服，带我去 App 的诊所吧");
    g.sick = false;

    /* Low health is illness even when the App did not say so. */
    g.stat[BADGE_STAT_FOOD] = 80;
    g.stat[BADGE_STAT_HEALTH] = 10;
    CHECK(badge_pet_sick(&g));
    CHECK_EQ(badge_pet_alert(&g), 0);
    g.stat[BADGE_STAT_HEALTH] = 80;

    /* Otherwise the specification's priority order applies, NOT "lowest stat wins":
     * with 饱腹 at 25 and 精力 at 10 the winner is 饱腹, because the renderer's own
     * currentAlert() walks the list in order and the list is
     * 不舒服 > 饱腹 > 精力 > 心情 > 清洁. Two plausible readings disagree here, so this
     * is exactly the kind of thing that must be pinned by a test. */
    g.stat[BADGE_STAT_FOOD] = 25;
    g.stat[BADGE_STAT_ENERGY] = 10;
    const int a = badge_pet_alert(&g);
    CHECK(a > 0);
    CHECK_EQ(badge_alerts[a].stat, BADGE_STAT_FOOD);
    CHECK_STR_EQ(S(badge_alerts[a].text), ""); /* 饱腹's entry has no wording */
    /* ...and the lowest stat is still reported as such, because the care screen
     * wants the number, not the priority. */
    CHECK_EQ(badge_pet_lowest_stat(&g), BADGE_STAT_ENERGY);

    /* With 饱腹 healthy the energy alert wins. */
    g.stat[BADGE_STAT_FOOD] = 80;
    const int e = badge_pet_alert(&g);
    CHECK(e > 0);
    CHECK_EQ(badge_alerts[e].stat, BADGE_STAT_ENERGY);

    /* 清洁 is last in the priority order, and it is the only one with wording. */
    game_new(&g);
    g.stat[BADGE_STAT_CLEAN] = 20;
    const int c = badge_pet_alert(&g);
    CHECK(c > 0);
    CHECK_EQ(badge_alerts[c].stat, BADGE_STAT_CLEAN);
    CHECK_STR_EQ(S(badge_alerts[c].text), "想洗澡了，用 App 帮我洗吧");

    /* Exactly at the threshold is not an alert. */
    game_new(&g);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) g.stat[i] = (uint8_t)badge_numbers.low_stat;
    CHECK_EQ(badge_pet_alert(&g), -1);
    CHECK_EQ(badge_pet_lowest_stat(&g), -1);
    /* One below it is. */
    g.stat[BADGE_STAT_CLEAN] = (uint8_t)(badge_numbers.low_stat - 1);
    CHECK_EQ(badge_pet_lowest_stat(&g), BADGE_STAT_CLEAN);

    /* Every alert has a valid action and an icon. */
    for (int i = 0; i < BADGE_ALERT_COUNT; i++) {
        CHECK(badge_alerts[i].icon != BADGE_ICON_NONE);
        CHECK(badge_alerts[i].action != BADGE_ACT_NONE);
    }
}

/* ------------------------------------------------------------------ settings ---*/

static void test_settings(void)
{
    puts("settings");
    badge_game_t g;
    game_new(&g);

    const int first = badge_pet_toggle(&g, BADGE_SETTING_BRIGHT);
    CHECK_EQ(first, 2); /* 中 -> 高 */
    CHECK_EQ(badge_pet_toggle(&g, BADGE_SETTING_BRIGHT), 0); /* 高 -> 低 */
    CHECK_EQ(badge_pet_toggle(&g, BADGE_SETTING_BRIGHT), 1); /* 低 -> 中 */

    CHECK_EQ(badge_pet_toggle(&g, BADGE_SETTING_WAKE), 0);
    CHECK(!g.wake_word);
    CHECK_EQ(badge_pet_toggle(&g, BADGE_SETTING_WAKE), 1);
    CHECK(g.wake_word);

    CHECK_EQ(badge_pet_toggle(&g, BADGE_SETTING_DISCOVER), 0);
    CHECK_EQ(badge_pet_toggle(&g, BADGE_SETTING_DISCOVER), 1);

    CHECK_EQ(badge_pet_toggle(&g, BADGE_SETTING_AOD), 0);
    CHECK_EQ(badge_pet_toggle(&g, BADGE_SETTING_AOD), 1);

    CHECK_EQ(badge_pet_toggle(&g, 99), -1);
    CHECK_EQ(badge_pet_toggle(&g, -1), -1);
}

/* ------------------------------------------------------------------ save -------*/

static void test_save(void)
{
    puts("save");
    badge_game_t a, b;
    game_new(&a);
    a.stat[BADGE_STAT_FOOD] = 12;
    a.stat[BADGE_STAT_MOOD] = 34;
    a.stat[BADGE_STAT_CLEAN] = 56;
    a.stat[BADGE_STAT_ENERGY] = 78;
    a.stat[BADGE_STAT_HEALTH] = 90;
    a.growth = 12345;
    a.coins = -42;
    a.sick = true;
    a.face = 2;
    a.guide_page = 3;
    a.bright = 0;
    a.wake_word = false;
    a.discover = true;
    a.aod = false;
    a.breed = 4;
    strcpy(a.name, "小橘二号");

    uint8_t buf[128];
    const uint32_t n = badge_pet_serialize(&a, buf, sizeof(buf));
    CHECK(n > 0);
    CHECK(n <= sizeof(buf));

    memset(&b, 0xAA, sizeof(b));
    CHECK(badge_pet_deserialize(&b, buf, n));
    CHECK_EQ(b.stat[BADGE_STAT_FOOD], 12);
    CHECK_EQ(b.stat[BADGE_STAT_MOOD], 34);
    CHECK_EQ(b.stat[BADGE_STAT_CLEAN], 56);
    CHECK_EQ(b.stat[BADGE_STAT_ENERGY], 78);
    CHECK_EQ(b.stat[BADGE_STAT_HEALTH], 90);
    CHECK_EQ(b.growth, 12345);
    CHECK_EQ(b.coins, -42);
    CHECK(b.sick);
    CHECK_EQ(b.face, 2);
    CHECK_EQ(b.guide_page, 3);
    CHECK_EQ(b.bright, 0);
    CHECK(!b.wake_word);
    CHECK(b.discover);
    CHECK(!b.aod);
    CHECK_EQ(b.breed, 4);
    CHECK_STR_EQ(b.name, "小橘二号");

    /* Deterministic: the same state produces the same bytes. */
    uint8_t buf2[128];
    CHECK_EQ(badge_pet_serialize(&a, buf2, sizeof(buf2)), n);
    CHECK(memcmp(buf, buf2, n) == 0);

    /* Corrupt and malformed inputs are rejected, not silently half-applied. */
    CHECK(!badge_pet_deserialize(&b, buf, n - 1));
    CHECK(!badge_pet_deserialize(&b, NULL, 0));
    CHECK(!badge_pet_deserialize(&b, buf, 0));
    uint8_t bad[128];
    memcpy(bad, buf, n);
    bad[0] = (uint8_t)(BADGE_PET_SAVE_VERSION + 1);
    CHECK(!badge_pet_deserialize(&b, bad, n));
    /* A too-small output buffer reports zero rather than writing past the end. */
    CHECK_EQ(badge_pet_serialize(&a, buf, 8), 0);

    /* Out-of-range fields are clamped on the way in, never trusted. */
    uint8_t wild[128];
    memcpy(wild, buf, n);
    wild[1] = 250;               /* food */
    wild[8] = 77;                /* guide page */
    wild[9] = 200;               /* bright */
    wild[11] = 99;               /* breed */
    CHECK(badge_pet_deserialize(&b, wild, n));
    CHECK_EQ(b.stat[BADGE_STAT_FOOD], 100);
    CHECK_EQ(b.bright, 1);
    CHECK_EQ(b.breed, 0);
    CHECK_EQ(b.guide_page, 0);

    /* A name that fills the field is still NUL-terminated. */
    memset(a.name, 'x', sizeof(a.name) - 1);
    a.name[sizeof(a.name) - 1] = '\0';
    const uint32_t n2 = badge_pet_serialize(&a, buf, sizeof(buf));
    CHECK(badge_pet_deserialize(&b, buf, n2));
    CHECK_EQ(strlen(b.name), sizeof(b.name) - 1);
}

/* The kernel must own no timers of its own: the badge does not decay the pet, the
 * App settles it. This test fails if someone adds a decay table the spec does not
 * have -- a real risk, because the previous kernel had one. */
static void test_no_decay(void)
{
    puts("no local decay");
    badge_game_t g;
    game_new(&g);
    uint8_t before[BADGE_STAT_COUNT];
    memcpy(before, g.stat, sizeof(before));
    /* There is deliberately no function to advance the kernel's clock. Asking it to
     * sync the same numbers twice must be idempotent. */
    for (int i = 0; i < 100; i++) {
        badge_pet_sync(&g, before, g.growth, g.coins, g.sick);
    }
    CHECK(memcmp(before, g.stat, sizeof(before)) == 0);
}

int main(void)
{
    puts("badge care kernel:");
    test_stages();
    test_pet_care();
    test_feed_care();
    test_water_care();
    test_play_care();
    test_sleep_care();
    test_care_bounds();
    test_sync_and_clamp();
    test_alerts();
    test_settings();
    test_save();
    test_no_decay();

    printf("\n%d checks, %d failures\n", checks, failures);
    if (failures) {
        printf("BADGE PET: FAILED\n");
        return 1;
    }
    printf("badge pet: OK\n");
    return 0;
}
