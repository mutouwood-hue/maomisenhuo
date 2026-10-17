/*
 * Host-side unit tests for the pet kernel.
 *
 * The kernel is deliberately free of LVGL, NVS, Bluetooth and FreeRTOS, so every
 * rule the board relies on can be checked here on a PC. That matters more than usual
 * for this project: there is no board in hand, so the only honest evidence that a
 * game rule is right is a test that reads the same tables the firmware reads.
 *
 * The expectations below are the HTML prototype's own numbers, quoted in
 * docs/porting-notes.md with their source. Where the board deliberately differs,
 * the test says so.
 *
 * Build: tools/run-host-tests.cmd
 */

#include <math.h>
#include <stdio.h>
#include <string.h>

#include "pet_state.h"

static int g_checks;
static int g_failures;

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

#define CHECK_EQ_I(actual, expected, what)                                      \
    do {                                                                        \
        const long _a = (long)(actual);                                         \
        const long _e = (long)(expected);                                       \
        g_checks++;                                                             \
        if (_a != _e) {                                                         \
            g_failures++;                                                       \
            printf("  FAIL %s:%d: %s: got %ld, expected %ld\n",                 \
                   __FILE__, __LINE__, (what), _a, _e);                         \
        }                                                                       \
    } while (0)

#define CHECK_NEAR(actual, expected, tol, what)                                 \
    do {                                                                        \
        const double _a = (double)(actual);                                     \
        const double _e = (double)(expected);                                   \
        g_checks++;                                                             \
        if (fabs(_a - _e) > (tol)) {                                            \
            g_failures++;                                                       \
            printf("  FAIL %s:%d: %s: got %.6f, expected %.6f\n",               \
                   __FILE__, __LINE__, (what), _a, _e);                         \
        }                                                                       \
    } while (0)

static void section(const char *name)
{
    printf("\n== %s ==\n", name);
}

/* ------------------------------------------------------------------ */
/* a fresh family, exactly as the prototype creates it                 */
/* ------------------------------------------------------------------ */

static void test_fresh_state(void)
{
    section("fresh state");

    pet_game_t g;
    pet_game_init(&g);

    CHECK_EQ_I(g.cat_count, 1, "one cat to start");
    CHECK_EQ_I(g.coins, 30, "starting coins (prototype: 30)");
    CHECK_EQ_I(g.version, 2, "save version");

    const pet_cat_t *c = pet_active_cat_const(&g);
    CHECK(c != NULL, "there is an active cat");
    if (!c) return;

    CHECK_EQ_I(c->stats[PET_STAT_FOOD], 65, "starting food (prototype: 65)");
    CHECK_EQ_I(c->stats[PET_STAT_MOOD], 72, "starting mood (prototype: 72)");
    CHECK_EQ_I(c->stats[PET_STAT_CLEAN], 68, "starting clean (prototype: 68)");
    CHECK_EQ_I(c->stats[PET_STAT_ENERGY], 75, "starting energy (prototype: 75)");
    CHECK_EQ_I(c->health, 100, "starting health");
    CHECK_EQ_I(c->xp, 0, "starting xp");
    CHECK_EQ_I(c->breed, PET_BREED_ORANGE, "starting breed");
    CHECK_EQ_I(c->issue, PET_ISSUE_NONE, "starting health issue");
    CHECK_EQ_I(c->outfit, 0xFF, "no outfit equipped");
    CHECK(strcmp(c->name, "小橘") == 0, "starting name is 小橘, got '%s'", c->name);
}

/* ------------------------------------------------------------------ */
/* decay                                                              */
/* ------------------------------------------------------------------ */

static void test_decay(void)
{
    section("decay");

    pet_game_t g;
    pet_game_init(&g);
    pet_cat_t *c = pet_active_cat(&g);

    /*
     * The first update only latches the clock and must not decay anything. Without
     * that guard a device would lose stats on its very first tick, before any time
     * has actually passed.
     */
    pet_game_update(&g, 1000);
    CHECK_EQ_I(c->stats[PET_STAT_FOOD], 65, "the first update only latches the clock");
    CHECK_EQ_I(c->stats[PET_STAT_MOOD], 72, "mood untouched by the first update");

    /*
     * 100 seconds of wall time, but the reducer caps a single step at 30 s -- the
     * prototype's own `Math.min(30, dt)`.
     *
     * The stats are stored as whole numbers while the rates are fractions of a point
     * per second, so the decay is accumulated and applied a whole point at a time.
     * 30 s of food decay is 0.18 of a point, which is not yet a whole point, so the
     * visible value legitimately does not move: what must move is the accumulator.
     * That is exactly the trap this kernel fell into once -- rounding the fraction
     * into the integer stat made decay impossible at a 20 Hz tick.
     */
    pet_game_update(&g, 101000);
    CHECK_EQ_I(c->stats[PET_STAT_FOOD], 65, "30 s of food decay is under one point");
    CHECK_NEAR(g.decay_frac[PET_STAT_FOOD], 0.006 * 30.0, 1e-4, "food decay accumulates");

    /*
     * A whole point appears once enough time has passed. Food is the fastest rate at
     * 0.006/s, so one point takes ~167 s; the accumulator is checked directly rather
     * than by waiting, because the cap means each call only contributes 30 s.
     */
    for (int i = 0; i < 6; i++) pet_game_update(&g, 101001 + (uint32_t)i * 30000);
    CHECK_EQ_I(c->stats[PET_STAT_FOOD], 64, "food loses a whole point after ~180 s");

    /* A repeated timestamp must be a no-op, not a second helping of decay. */
    const uint8_t before = c->stats[PET_STAT_FOOD];
    const float frac_before = g.decay_frac[PET_STAT_FOOD];
    pet_game_update(&g, 101001 + 5 * 30000);
    CHECK_EQ_I(c->stats[PET_STAT_FOOD], before, "repeated timestamp is idempotent");
    CHECK_NEAR(g.decay_frac[PET_STAT_FOOD], frac_before, 1e-9, "accumulator untouched by a repeated timestamp");

    /* The slowest stat, clean at 0.003/s, must still eventually move. */
    pet_game_t h;
    pet_game_init(&h);
    pet_cat_t *hc = pet_active_cat(&h);
    const uint8_t clean0 = hc->stats[PET_STAT_CLEAN];
    pet_game_update(&h, 1000);
    for (int i = 0; i < 40; i++) pet_game_update(&h, 1001 + (uint32_t)i * 30000);
    CHECK(hc->stats[PET_STAT_CLEAN] < clean0, "clean decays over ~20 minutes: %u -> %u",
          (unsigned)clean0, (unsigned)hc->stats[PET_STAT_CLEAN]);
}

/*
 * Decay has to survive the way the firmware actually drives it: a tick every 50 ms.
 * A single large step is not enough evidence, because the failure mode this guards
 * against only shows up when each step is far smaller than one stat point.
 */
static void test_decay_at_tick_rate(void)
{
    section("decay at the firmware tick rate");

    pet_game_t g;
    pet_game_init(&g);
    pet_cat_t *c = pet_active_cat(&g);

    pet_game_update(&g, 0);
    const uint8_t food0 = c->stats[PET_STAT_FOOD];

    /* 20 Hz for ten minutes. */
    for (int i = 1; i <= 20 * 60 * 10; i++) {
        pet_game_update(&g, (uint32_t)i * 50);
    }

    /* 600 s of food decay at 0.006/s is 3.6 points, so at least 3 whole points
     * should be gone. If the fraction were being rounded away on each tick, the
     * value would not have moved at all. */
    CHECK(food0 - c->stats[PET_STAT_FOOD] >= 3,
          "food decays at a 50 ms tick rate: %u -> %u", (unsigned)food0,
          (unsigned)c->stats[PET_STAT_FOOD]);
    CHECK(c->stats[PET_STAT_MOOD] <= 72, "mood decays at a 50 ms tick rate");
    CHECK_EQ_I(c->health, 100, "health still untouched after ten minutes");
}

/*
 * Health never decays. The prototype starts every cat at 100 and only ever adds to
 * health (bath +1, sleep +2, clinic +30/+8); an earlier revision of this kernel had
 * an untreated illness draining health, which is a rule the game does not have.
 */
static void test_health_never_decays(void)
{
    section("health never decays");

    pet_game_t g;
    pet_game_init(&g);
    pet_cat_t *c = pet_active_cat(&g);

    c->issue = PET_ISSUE_SNIFFLES;
    c->health = 80;
    pet_game_update(&g, 1000);
    pet_game_update(&g, 1000 + 30 * 1000); /* ten capped steps' worth of wall time */
    CHECK_EQ_I(c->health, 80, "an untreated illness does not drain health");

    c->issue = PET_ISSUE_NONE;
    c->health = 50;
    for (int i = 0; i < 20; i++) pet_game_update(&g, 2000 + (uint32_t)i * 30000);
    CHECK_EQ_I(c->health, 50, "health does not regenerate on its own either");
}

/* ------------------------------------------------------------------ */
/* care actions                                                       */
/* ------------------------------------------------------------------ */

static void test_care_effects(void)
{
    section("care effects");

    pet_game_t g;
    pet_game_init(&g);
    pet_cat_t *c = pet_active_cat(&g);

    /* feed: food +25, mood +3, clean -2, xp +8, coins -3 */
    c->stats[PET_STAT_FOOD] = 40;
    c->stats[PET_STAT_MOOD] = 50;
    c->stats[PET_STAT_CLEAN] = 60;
    g.coins = 100;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_FEED, 1000), PET_OK, "feed allowed");
    CHECK_EQ_I(c->stats[PET_STAT_FOOD], 65, "feed food +25");
    CHECK_EQ_I(c->stats[PET_STAT_MOOD], 53, "feed mood +3");
    CHECK_EQ_I(c->stats[PET_STAT_CLEAN], 58, "feed clean -2");
    CHECK_EQ_I(c->xp, 8, "feed xp +8");
    CHECK_EQ_I(g.coins, 97, "feed costs 3 coins");

    /* bath: clean +35, mood +4, energy -3, health +1, xp +8, coins -2 */
    c->stats[PET_STAT_CLEAN] = 40;
    c->stats[PET_STAT_MOOD] = 50;
    c->stats[PET_STAT_ENERGY] = 50;
    c->health = 70;
    c->xp = 0;
    g.coins = 100;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_BATH, 2000), PET_OK, "bath allowed");
    CHECK_EQ_I(c->stats[PET_STAT_CLEAN], 75, "bath clean +35");
    CHECK_EQ_I(c->stats[PET_STAT_MOOD], 54, "bath mood +4");
    CHECK_EQ_I(c->stats[PET_STAT_ENERGY], 47, "bath energy -3");
    CHECK_EQ_I(c->health, 71, "bath health +1");
    CHECK_EQ_I(g.coins, 98, "bath costs 2 coins");

    /* pet: mood +9, xp +3, free */
    c->stats[PET_STAT_MOOD] = 50;
    c->xp = 0;
    g.coins = 100;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_PET, 3000), PET_OK, "pet allowed");
    CHECK_EQ_I(c->stats[PET_STAT_MOOD], 59, "pet mood +9");
    CHECK_EQ_I(c->xp, 3, "pet xp +3");
    CHECK_EQ_I(g.coins, 100, "pet is free");

    /* sleep: energy +35, food -4, health +2, xp +6 */
    c->stats[PET_STAT_ENERGY] = 40;
    c->stats[PET_STAT_FOOD] = 80;
    c->health = 60;
    c->xp = 0;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_SLEEP, 4000), PET_OK, "sleep allowed");
    CHECK_EQ_I(c->stats[PET_STAT_ENERGY], 75, "sleep energy +35");
    CHECK_EQ_I(c->stats[PET_STAT_FOOD], 76, "sleep food -4");
    CHECK_EQ_I(c->health, 62, "sleep health +2");

    /* drink: mood +3, energy +6, xp +4 */
    c->stats[PET_STAT_MOOD] = 50;
    c->stats[PET_STAT_ENERGY] = 50;
    c->xp = 0;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_DRINK, 5000), PET_OK, "drink allowed");
    CHECK_EQ_I(c->stats[PET_STAT_MOOD], 53, "drink mood +3");
    CHECK_EQ_I(c->stats[PET_STAT_ENERGY], 56, "drink energy +6");
    CHECK_EQ_I(c->xp, 4, "drink xp +4");

    /* climb: energy -6, food -3, mood +12, xp +10 */
    c->stats[PET_STAT_ENERGY] = 50;
    c->stats[PET_STAT_FOOD] = 50;
    c->stats[PET_STAT_MOOD] = 50;
    c->xp = 0;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_CLIMB, 6000), PET_OK, "climb allowed");
    CHECK_EQ_I(c->stats[PET_STAT_ENERGY], 44, "climb energy -6");
    CHECK_EQ_I(c->stats[PET_STAT_FOOD], 47, "climb food -3");
    CHECK_EQ_I(c->stats[PET_STAT_MOOD], 62, "climb mood +12");
    CHECK_EQ_I(c->xp, 10, "climb xp +10");

    /* tease: energy -5, food -3, mood +12, xp +8 */
    c->stats[PET_STAT_ENERGY] = 50;
    c->stats[PET_STAT_FOOD] = 50;
    c->stats[PET_STAT_MOOD] = 50;
    c->xp = 0;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_TEASE, 7000), PET_OK, "tease allowed");
    CHECK_EQ_I(c->stats[PET_STAT_ENERGY], 45, "tease energy -5");
    CHECK_EQ_I(c->stats[PET_STAT_MOOD], 62, "tease mood +12");
    CHECK_EQ_I(c->xp, 8, "tease xp +8");

    /*
     * play is a mini-game. The board takes the prototype's mid-range result for a
     * score of 8 of 15: mood 12+round(0.533*13) = 19, xp 10+round(0.533*10) = 15,
     * coins 3+round(0.533*9) = 8.
     */
    c->stats[PET_STAT_MOOD] = 50;
    c->stats[PET_STAT_ENERGY] = 50;
    c->stats[PET_STAT_FOOD] = 50;
    c->xp = 0;
    g.coins = 0;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_PLAY, 8000), PET_OK, "play allowed");
    CHECK_EQ_I(c->stats[PET_STAT_MOOD], 69, "play mood +19");
    CHECK_EQ_I(c->stats[PET_STAT_ENERGY], 42, "play energy -8");
    CHECK_EQ_I(c->stats[PET_STAT_FOOD], 45, "play food -5");
    CHECK_EQ_I(c->xp, 15, "play xp +15");
    CHECK_EQ_I(g.coins, 8, "play earns 8 coins");
}

static void test_action_gates(void)
{
    section("action gates");

    pet_game_t g;
    pet_game_init(&g);
    pet_cat_t *c = pet_active_cat(&g);
    g.coins = 100;

    /* Each of these is the prototype's own threshold, with the prototype's wording. */
    c->stats[PET_STAT_FOOD] = 95;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_FEED, 10000), PET_ERR_SATED, "feed refused at food >= 95");
    c->stats[PET_STAT_FOOD] = 94;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_FEED, 20000), PET_OK, "feed allowed at food 94");

    c->stats[PET_STAT_CLEAN] = 95;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_BATH, 30000), PET_ERR_SATED, "bath refused at clean >= 95");

    c->stats[PET_STAT_MOOD] = 98;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_PET, 40000), PET_ERR_SATED, "pet refused at mood >= 98");

    c->stats[PET_STAT_ENERGY] = 95;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_SLEEP, 50000), PET_ERR_SATED, "sleep refused at energy >= 95");

    /* Strenuous play needs energy 10, and play/climb/tease are refused while unwell. */
    c->stats[PET_STAT_ENERGY] = 9;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_CLIMB, 60000), PET_ERR_TIRED, "climb refused below energy 10");
    c->stats[PET_STAT_ENERGY] = 50;

    c->issue = PET_ISSUE_SNIFFLES;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_CLIMB, 70000), PET_ERR_UNWELL, "climb refused while unwell");
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_TEASE, 80000), PET_ERR_UNWELL, "tease refused while unwell");

    /*
     * pet, feed, bath and drink stay available while unwell: only strenuous play is
     * blocked, which is what the prototype's gate does.
     */
    c->stats[PET_STAT_MOOD] = 50;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_PET, 90000), PET_OK, "pet still allowed while unwell");
    c->issue = PET_ISSUE_NONE;

    /* Coins gate feed and bath, and the check comes before any effect is applied. */
    g.coins = 2;
    c->stats[PET_STAT_FOOD] = 10;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_FEED, 200000), PET_ERR_NO_COINS, "feed refused with 2 coins");
    c->stats[PET_STAT_CLEAN] = 40; /* otherwise the "already clean" gate answers first */
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_BATH, 300000), PET_OK, "bath affordable at 2 coins");
}

static void test_cooldowns(void)
{
    section("cooldowns");

    pet_game_t g;
    pet_game_init(&g);
    pet_cat_t *c = pet_active_cat(&g);
    g.coins = 1000;
    c->stats[PET_STAT_MOOD] = 10;

    CHECK_EQ_I(pet_do_action(&g, PET_ACT_PET, 1000), PET_OK, "first pet succeeds");
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_PET, 1500), PET_ERR_COOLDOWN, "pet on cooldown at +500 ms");

    /* pet's cooldown is 2000 ms, the shortest of the care actions. */
    c->stats[PET_STAT_MOOD] = 10;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_PET, 3001), PET_OK, "pet allowed again after 2000 ms");

    /* feed uses 4000 ms. */
    c->stats[PET_STAT_FOOD] = 10;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_FEED, 10000), PET_OK, "first feed succeeds");
    c->stats[PET_STAT_FOOD] = 10;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_FEED, 13999), PET_ERR_COOLDOWN, "feed on cooldown at +3999 ms");
    c->stats[PET_STAT_FOOD] = 10;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_FEED, 14000), PET_OK, "feed allowed at exactly +4000 ms");

    /* Cooldowns are per action, so a different care action is unaffected. */
    c->stats[PET_STAT_ENERGY] = 10;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_DRINK, 14001), PET_OK, "drink is not blocked by feed's cooldown");
}

/* ------------------------------------------------------------------ */
/* the clinic                                                         */
/* ------------------------------------------------------------------ */

static void test_clinic(void)
{
    section("clinic");

    pet_game_t g;
    pet_game_init(&g);
    pet_cat_t *c = pet_active_cat(&g);

    /*
     * Treating sniffles costs 8 coins and restores 30 health. The prototype's own
     * numbers: cost 4 for a wellness check, 8 when ill; health +8 / +30.
     */
    c->issue = PET_ISSUE_SNIFFLES;
    c->health = 40;
    c->stats[PET_STAT_MOOD] = 50;
    c->xp = 0;
    g.coins = 8;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_CLINIC, 1000), PET_OK, "treatment allowed with exactly 8 coins");
    CHECK_EQ_I(c->issue, PET_ISSUE_NONE, "treatment clears the illness");
    CHECK_EQ_I(c->health, 70, "treatment restores 30 health");
    CHECK_EQ_I(g.coins, 0, "treatment costs 8 coins");
    CHECK_EQ_I(c->stats[PET_STAT_MOOD], 53, "clinic mood +3");
    CHECK_EQ_I(c->xp, 3, "clinic xp +3");

    /*
     * A healthy cat can still be examined: the prototype offers a wellness check for
     * 4 coins. An earlier revision refused this, which made the button dead for a
     * healthy pet.
     *
     * The clock has to step past the clinic's 4000 ms cooldown between visits; the
     * earlier revision gave the clinic no cooldown at all, so three visits could land
     * in the same three milliseconds.
     */
    c->health = 50;
    g.coins = 10;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_CLINIC, 10000), PET_OK, "wellness check allowed when healthy");
    CHECK_EQ_I(c->health, 58, "wellness check restores 8 health");
    CHECK_EQ_I(g.coins, 6, "wellness check costs 4 coins");

    /* Health never exceeds 100. */
    c->health = 95;
    g.coins = 10;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_CLINIC, 20000), PET_OK, "wellness check at health 95");
    CHECK_EQ_I(c->health, 100, "health clamps at 100");

    /* Too poor for either fee. */
    g.coins = 3;
    c->issue = PET_ISSUE_TUMMY;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_CLINIC, 30000), PET_ERR_NO_COINS, "treatment refused with 3 coins");
    CHECK_EQ_I(c->issue, PET_ISSUE_TUMMY, "a refused treatment leaves the illness in place");
}

/* ------------------------------------------------------------------ */
/* progression                                                        */
/* ------------------------------------------------------------------ */

static void test_stages(void)
{
    section("stages");

    /* The prototype's thresholds: <60 kitten, <160 young, else adult. */
    CHECK_EQ_I(pet_stage(0), PET_STAGE_KITTEN, "xp 0 is a kitten");
    CHECK_EQ_I(pet_stage(59), PET_STAGE_KITTEN, "xp 59 is a kitten");
    CHECK_EQ_I(pet_stage(60), PET_STAGE_YOUNG, "xp 60 becomes a young cat");
    CHECK_EQ_I(pet_stage(159), PET_STAGE_YOUNG, "xp 159 is still young");
    CHECK_EQ_I(pet_stage(160), PET_STAGE_ADULT, "xp 160 becomes an adult");

    CHECK(strcmp(pet_stage_name(PET_STAGE_KITTEN), "幼猫") == 0, "kitten label");
    CHECK(strcmp(pet_stage_name(PET_STAGE_YOUNG), "少年猫") == 0, "young label");
    CHECK(strcmp(pet_stage_name(PET_STAGE_ADULT), "成年猫") == 0, "adult label");
}

static void test_xp_and_coin_caps(void)
{
    section("caps");

    pet_game_t g;
    pet_game_init(&g);
    pet_cat_t *c = pet_active_cat(&g);
    g.coins = 1000000; /* 1e6, the prototype's purse limit */

    c->stats[PET_STAT_MOOD] = 10;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_PLAY, 1000), PET_OK, "play allowed at the coin cap");
    CHECK_EQ_I(g.coins, 1000000, "coins clamp at 1e6");

    /* xp caps at 1e7, not 1e6. */
    c->xp = 9999999;
    c->stats[PET_STAT_MOOD] = 10;
    CHECK_EQ_I(pet_do_action(&g, PET_ACT_PET, 2000), PET_OK, "pet allowed near the xp cap");
    CHECK_EQ_I(c->xp, 10000000, "xp clamps at 1e7");
}

/* ------------------------------------------------------------------ */
/* goals                                                             */
/* ------------------------------------------------------------------ */

static void test_goals(void)
{
    section("goals");

    pet_game_t g;
    pet_game_init(&g);
    pet_cat_t *c = pet_active_cat(&g);
    g.coins = 0;

    /* first_meal needs counts.feed >= 1. */
    c->counts[PET_ACT_FEED] = 0;
    CHECK_EQ_I(pet_claim_goal(&g, 0), PET_ERR_NOT_ENOUGH, "first_meal not yet earned");
    c->counts[PET_ACT_FEED] = 1;
    CHECK_EQ_I(pet_claim_goal(&g, 0), PET_OK, "first_meal claimed");
    CHECK_EQ_I(g.coins, 5, "first_meal pays 5 coins");
    CHECK_EQ_I(pet_claim_goal(&g, 0), PET_ERR_ALREADY, "first_meal is one-shot");

    /* playmate needs both a tease and a play, i.e. progress 2 of target 2. */
    c->counts[PET_ACT_TEASE] = 1;
    c->counts[PET_ACT_PLAY] = 0;
    CHECK_EQ_I(pet_claim_goal(&g, 3), PET_ERR_NOT_ENOUGH, "playmate needs both actions");
    c->counts[PET_ACT_PLAY] = 1;
    CHECK_EQ_I(pet_claim_goal(&g, 3), PET_OK, "playmate claimed");
    CHECK_EQ_I(g.coins, 13, "playmate pays 8 coins");

    /* grown_up is xp >= 160 and pays 10. */
    c->xp = 159;
    CHECK_EQ_I(pet_claim_goal(&g, 4), PET_ERR_NOT_ENOUGH, "grown_up needs 160 xp");
    c->xp = 160;
    CHECK_EQ_I(pet_claim_goal(&g, 4), PET_OK, "grown_up claimed");
    CHECK_EQ_I(g.coins, 23, "grown_up pays 10 coins");
}

/* ------------------------------------------------------------------ */
/* economy                                                           */
/* ------------------------------------------------------------------ */

static void test_economy(void)
{
    section("economy");

    pet_game_t g;
    pet_game_init(&g);

    /* Outfits: buy once, then refuse; refuse when short of coins. */
    g.coins = 100;
    CHECK_EQ_I(pet_buy_outfit(&g, 0), PET_OK, "buy bandana for 12");
    CHECK_EQ_I(g.coins, 88, "bandana costs 12");
    CHECK_EQ_I(pet_buy_outfit(&g, 0), PET_ERR_ALREADY, "cannot buy the same outfit twice");

    g.coins = 5;
    CHECK_EQ_I(pet_buy_outfit(&g, 2), PET_ERR_NO_COINS, "cap costs 25; 5 coins is not enough");

    /* Equipping requires ownership; 0xFF means "none" and is always allowed. */
    CHECK_EQ_I(pet_equip_outfit(&g, 1), PET_ERR_NOT_OWNED, "cannot equip an unowned bow");
    CHECK_EQ_I(pet_equip_outfit(&g, 0), PET_OK, "can equip an owned bandana");
    CHECK_EQ_I(pet_active_cat(&g)->outfit, 0, "bandana is equipped");
    CHECK_EQ_I(pet_equip_outfit(&g, 0xFF), PET_OK, "removing the outfit is always allowed");
    CHECK_EQ_I(pet_active_cat(&g)->outfit, 0xFF, "no outfit equipped");

    /* Selling: the prototype's sell prices are fish 3, flower 2, shell 4, star 7. */
    g.coins = 0;
    g.inventory[0] = 2; /* fish */
    CHECK_EQ_I(pet_sell_item(&g, 0), PET_OK, "sell one fish");
    CHECK_EQ_I(g.coins, 3, "fish sells for 3");
    CHECK_EQ_I(g.inventory[0], 1, "one fish left");
    CHECK_EQ_I(pet_sell_item(&g, 0), PET_OK, "sell the second fish");
    CHECK_EQ_I(pet_sell_item(&g, 0), PET_ERR_NOT_ENOUGH, "no fish left to sell");

    g.inventory[3] = 1; /* star */
    CHECK_EQ_I(pet_sell_item(&g, 3), PET_OK, "sell a star");
    CHECK_EQ_I(g.coins, 13, "star sells for 7");
}

/* ------------------------------------------------------------------ */
/* outdoor activities                                                */
/* ------------------------------------------------------------------ */

static void test_activities(void)
{
    section("activities");

    pet_game_t g;
    pet_game_init(&g);
    pet_cat_t *c = pet_active_cat(&g);
    g.coins = 0;

    /* Going outside needs energy >= 12, a higher floor than indoor play. */
    c->stats[PET_STAT_ENERGY] = 11;
    CHECK_EQ_I(pet_start_activity(&g, PET_RUN_WALK), PET_ERR_TIRED, "walk refused below energy 12");

    c->stats[PET_STAT_ENERGY] = 50;
    c->stats[PET_STAT_FOOD] = 50;
    c->stats[PET_STAT_MOOD] = 50;
    c->issue = PET_ISSUE_SNIFFLES;
    CHECK_EQ_I(pet_start_activity(&g, PET_RUN_WALK), PET_ERR_UNWELL, "walk refused while unwell");
    c->issue = PET_ISSUE_NONE;

    CHECK_EQ_I(pet_start_activity(&g, PET_RUN_WALK), PET_OK, "walk started");
    CHECK_EQ_I(pet_start_activity(&g, PET_RUN_EXPLORE), PET_ERR_IN_PROGRESS, "only one trip at a time");
    CHECK_EQ_I(pet_finish_activity(&g), PET_ERR_NOT_ENOUGH, "cannot settle a walk immediately");

    /*
     * walk: target 3 checkpoints, 12 seconds, xp 6, coins 4, and settlement costs
     * energy 4, food 3, and gives mood 9.
     */
    pet_game_update(&g, 1000);
    pet_game_update(&g, 1000 + 13000);
    CHECK_EQ_I(pet_finish_activity(&g), PET_OK, "walk settles after its checkpoints and time");
    CHECK_EQ_I(c->xp, 6, "walk grants 6 xp");
    CHECK_EQ_I(g.coins, 4, "walk grants 4 coins");
    CHECK_EQ_I(c->stats[PET_STAT_ENERGY], 46, "walk costs 4 energy");
    CHECK_EQ_I(c->stats[PET_STAT_FOOD], 47, "walk costs 3 food");
    CHECK_EQ_I(c->stats[PET_STAT_MOOD], 59, "walk gives 9 mood");
    CHECK_EQ_I(c->running, PET_RUN_NONE, "the trip is over");

    /* explore and fish cost 6 energy rather than 4. */
    c->stats[PET_STAT_ENERGY] = 50;
    c->stats[PET_STAT_FOOD] = 50;
    c->stats[PET_STAT_MOOD] = 50;
    g.coins = 0;
    CHECK_EQ_I(pet_start_activity(&g, PET_RUN_EXPLORE), PET_OK, "explore started");
    pet_game_update(&g, 20000);
    pet_game_update(&g, 20000 + 20000);
    CHECK_EQ_I(pet_finish_activity(&g), PET_OK, "explore settles");
    CHECK_EQ_I(c->stats[PET_STAT_ENERGY], 44, "explore costs 6 energy");
    CHECK_EQ_I(g.coins, 5, "explore grants 5 coins");
    CHECK_EQ_I(c->xp, 14, "explore grants 8 xp on top of the walk's 6");

    /* Abandoning a trip is free and returns the cat to idle. */
    c->stats[PET_STAT_ENERGY] = 50;
    CHECK_EQ_I(pet_start_activity(&g, PET_RUN_FISH), PET_OK, "fish started");
    CHECK_EQ_I(pet_cancel_activity(&g), PET_OK, "fish cancelled");
    CHECK_EQ_I(c->running, PET_RUN_NONE, "cancelling ends the trip");
}

/*
 * What a trip brings home.
 *
 * The prototype has no haul field on its activity table: `we()` builds one node per
 * checkpoint from `Wf(mode)` and `he()` folds the collected nodes into the backpack
 * when the trip settles (walk: three nodes, none with an item; explore: flower,
 * flower, shell, star, fish; fish: four fish). Those node lists are what
 * PET_ACTIVITIES' `item_gain` transcribes, and this is the check that the
 * transcription is what actually lands in the inventory -- without it the backpack
 * had no source at all outside the demo seed, so selling was unreachable in practice.
 */
static void test_activity_haul(void)
{
    section("activity haul");

    pet_game_t g;
    pet_game_init(&g);
    pet_cat_t *c = pet_active_cat(&g);

    /* The lookup the settlement and the UI both use. */
    CHECK(pet_activity_by_kind(PET_RUN_WALK) == &PET_ACTIVITIES[0], "walk resolves by kind");
    CHECK(pet_activity_by_kind(PET_RUN_FISH) == &PET_ACTIVITIES[2], "fish resolves by kind");
    CHECK(pet_activity_by_kind(PET_RUN_NONE) == NULL, "no trip resolves for PET_RUN_NONE");

    /* A walk carries nothing home: its three nodes have no item on them. */
    c->stats[PET_STAT_ENERGY] = 50;
    CHECK_EQ_I(pet_start_activity(&g, PET_RUN_WALK), PET_OK, "walk started");
    pet_game_update(&g, 1000);
    pet_game_update(&g, 1000 + 13000);
    CHECK_EQ_I(pet_finish_activity(&g), PET_OK, "walk settles");
    for (int i = 0; i < PET_ITEM_COUNT; i++) {
        CHECK_EQ_I(g.inventory[i], 0, "a walk brings nothing home");
    }

    /* explore: 1 fish, 2 flowers, 1 shell, 1 star. */
    c->stats[PET_STAT_ENERGY] = 50;
    CHECK_EQ_I(pet_start_activity(&g, PET_RUN_EXPLORE), PET_OK, "explore started");
    pet_game_update(&g, 20000);
    pet_game_update(&g, 20000 + 20000);
    CHECK_EQ_I(pet_finish_activity(&g), PET_OK, "explore settles");
    CHECK_EQ_I(g.inventory[0], 1, "explore brings 1 fish");
    CHECK_EQ_I(g.inventory[1], 2, "explore brings 2 flowers");
    CHECK_EQ_I(g.inventory[2], 1, "explore brings 1 shell");
    CHECK_EQ_I(g.inventory[3], 1, "explore brings 1 star");

    /* A cancelled trip keeps nothing. */
    g.inventory[0] = 0;
    c->stats[PET_STAT_ENERGY] = 50;
    CHECK_EQ_I(pet_start_activity(&g, PET_RUN_FISH), PET_OK, "fish started");
    pet_game_update(&g, 50000);
    pet_game_update(&g, 50000 + 20000); /* four checkpoints and 15 s: settleable */
    CHECK_EQ_I(pet_cancel_activity(&g), PET_OK, "fish cancelled");
    CHECK_EQ_I(g.inventory[0], 0, "a cancelled trip brings nothing home");

    /* An unfinished trip refuses to settle, and refuses to pay. */
    c->stats[PET_STAT_ENERGY] = 50;
    CHECK_EQ_I(pet_start_activity(&g, PET_RUN_FISH), PET_OK, "fish started again");
    pet_game_update(&g, 80000);
    pet_game_update(&g, 80000 + 4000); /* 4 s of the 15 it needs */
    CHECK_EQ_I(pet_finish_activity(&g), PET_ERR_NOT_ENOUGH, "an unfinished trip will not settle");
    CHECK_EQ_I(g.inventory[0], 0, "and brings nothing home");

    /* fish: four fish, and the haul is what the backpack then sells. */
    pet_game_update(&g, 80000 + 16000);
    CHECK_EQ_I(pet_finish_activity(&g), PET_OK, "fish settles once its time is in");
    CHECK_EQ_I(g.inventory[0], 4, "fishing brings 4 fish");

    g.coins = 0;
    CHECK_EQ_I(pet_sell_item(&g, 0), PET_OK, "a landed fish can be sold");
    CHECK_EQ_I(g.coins, 3, "and pays its 3 coins");
    CHECK_EQ_I(g.inventory[0], 3, "leaving three in the backpack");
}

/* ------------------------------------------------------------------ */
/* persistence                                                       */
/* ------------------------------------------------------------------ */

static void test_serialization(void)
{
    section("serialization");

    pet_game_t a;
    pet_game_init(&a);

    /* Make every field distinctive so a dropped or transposed one shows up. */
    a.coins = 1234;
    a.wardrobe = 0x0015;
    a.inventory[0] = 7;
    a.inventory[3] = 9;
    a.cat_count = 2;
    a.active = 1;

    strcpy(a.cats[0].name, "小橘");
    a.cats[0].xp = 77;
    a.cats[0].health = 88;
    a.cats[0].issue = PET_ISSUE_SNIFFLES;
    a.cats[0].outfit = 2;
    a.cats[0].stats[PET_STAT_FOOD] = 11;
    a.cats[0].stats[PET_STAT_MOOD] = 22;
    a.cats[0].stats[PET_STAT_CLEAN] = 33;
    a.cats[0].stats[PET_STAT_ENERGY] = 44;
    a.cats[0].counts[PET_ACT_FEED] = 5;
    a.cats[0].goals_claimed = 0x0003;
    a.cats[0].born_at = 1700000000;

    strcpy(a.cats[1].name, "小奶糖");
    a.cats[1].breed = PET_BREED_SIAMESE;
    a.cats[1].xp = 160;
    a.cats[1].run_target = 15;
    a.cats[1].run_progress = 4;

    uint8_t buf[8192];
    const size_t n = pet_game_serialize(&a, buf, sizeof(buf));
    CHECK(n > 0, "serialize produced %u bytes", (unsigned)n);
    CHECK(n <= sizeof(buf), "serialized size fits the save budget");

    pet_game_t b;
    memset(&b, 0xAA, sizeof(b));
    CHECK(pet_game_deserialize(&b, buf, n), "deserialize accepts what serialize produced");

    CHECK_EQ_I(b.cat_count, 2, "cat count round-trips");
    CHECK_EQ_I(b.active, 1, "active index round-trips");
    CHECK_EQ_I(b.coins, 1234, "coins round-trip");
    CHECK_EQ_I(b.wardrobe, 0x0015, "wardrobe round-trips");
    CHECK_EQ_I(b.inventory[0], 7, "inventory[0] round-trips");
    CHECK_EQ_I(b.inventory[3], 9, "inventory[3] round-trips");

    CHECK(strcmp(b.cats[0].name, "小橘") == 0, "name round-trips: '%s'", b.cats[0].name);
    CHECK(strcmp(b.cats[1].name, "小奶糖") == 0, "UTF-8 name round-trips: '%s'", b.cats[1].name);
    CHECK_EQ_I(b.cats[0].xp, 77, "xp round-trips");
    CHECK_EQ_I(b.cats[0].health, 88, "health round-trips");
    CHECK_EQ_I(b.cats[0].issue, PET_ISSUE_SNIFFLES, "health issue round-trips");
    CHECK_EQ_I(b.cats[0].outfit, 2, "outfit round-trips");
    CHECK_EQ_I(b.cats[0].stats[PET_STAT_FOOD], 11, "food round-trips");
    CHECK_EQ_I(b.cats[0].stats[PET_STAT_ENERGY], 44, "energy round-trips");
    CHECK_EQ_I(b.cats[0].counts[PET_ACT_FEED], 5, "counters round-trip");
    CHECK_EQ_I(b.cats[0].goals_claimed, 0x0003, "claimed goals round-trip");
    CHECK_EQ_I(b.cats[0].born_at, 1700000000, "birth time round-trips");
    CHECK_EQ_I(b.cats[1].breed, PET_BREED_SIAMESE, "second cat's breed round-trips");
    CHECK_EQ_I(b.cats[1].run_target, 15, "run target round-trips");
    CHECK_EQ_I(b.cats[1].run_progress, 4, "run progress round-trips");

    /*
     * Runtime-only fields are handled deliberately rather than accidentally:
     *
     *   last_update_ms  is preserved, because the destination is a running game and
     *                   writing a stale clock into it would make the cat decay for the
     *                   whole of the previous session in a single step.
     *   decay_frac      is cleared, because it is bookkeeping about elapsed time that
     *                   the blob does not describe. Losing a sub-point of decay on a
     *                   load is imperceptible; inventing one is not.
     *
     * The buffer was filled with 0xAA before the load, so a preserved field is
     * distinguishable from one that was copied out of the blob by accident.
     */
    CHECK_EQ_I(b.last_update_ms, 0xAAAAAAAAu, "last_update_ms is preserved across a load");
    CHECK_NEAR(b.decay_frac[PET_STAT_FOOD], 0.0, 1e-9,
               "the decay accumulator is cleared, not resurrected");

    /* Truncated and corrupt input must be rejected, not partially applied. */
    pet_game_t c;
    pet_game_init(&c);
    CHECK(!pet_game_deserialize(&c, buf, 0), "empty buffer rejected");
    CHECK(!pet_game_deserialize(&c, buf, 3), "truncated header rejected");
    CHECK(!pet_game_deserialize(&c, buf, n - 1), "truncated body rejected");
    CHECK_EQ_I(c.coins, 30, "a rejected load leaves the previous state alone");

    uint8_t bad[8192];
    memcpy(bad, buf, n);
    bad[0] = 0x00; /* break the magic */
    CHECK(!pet_game_deserialize(&c, bad, n), "bad magic rejected");
}

/* ------------------------------------------------------------------ */

int main(void)
{
    printf("pet kernel host tests\n");

    test_fresh_state();
    test_decay();
    test_decay_at_tick_rate();
    test_health_never_decays();
    test_care_effects();
    test_action_gates();
    test_cooldowns();
    test_clinic();
    test_stages();
    test_xp_and_coin_caps();
    test_goals();
    test_economy();
    test_activities();
    test_activity_haul();
    test_serialization();

    printf("\n%d checks, %d failure(s)\n", g_checks, g_failures);
    if (g_failures == 0) printf("ALL PET KERNEL TESTS PASSED\n");
    return g_failures == 0 ? 0 : 1;
}
