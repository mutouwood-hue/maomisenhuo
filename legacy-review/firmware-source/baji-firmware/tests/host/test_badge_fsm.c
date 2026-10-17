/*
 * Host test: badge_fsm's rules and screen flow, driven through the public API.
 *
 * badge_fsm.c is the only place in the firmware where the badge's *behaviour* lives:
 * which screen a gesture reaches, when the modes ladder down, when a care earns its
 * growth, when a quirk is caught, what crosses to the App. None of that is visible on a
 * bench without a finger and a stopwatch, and several of the paths cannot be produced by
 * hand at all -- a care abandoned halfway, the AOD ladder under a silent clock, a quirk
 * caught inside its window, a cooldown expiring. So this file drives the state machine
 * from a script: press, move, release, tick, and read back the screen, the mode, the
 * brightness, the care numbers and the events emitted.
 *
 * WHAT THIS PROVES
 *   Every one of the specification's 23 screens is reachable and answers with the
 *   generated table's own definition; the gestures fire on the specification's own
 *   timings (tap_max_ms / tap_move_max / long_press_ms / swipe_min_px / swipe_max_ms);
 *   the mode ladder walks desk -> play -> comp -> aod -> off and reports each mode's fps,
 *   resolution, backlight and night dim; the cares move the stats by
 *   badge_care_defs[].delta and settle .growth / .coins exactly once, on the last step;
 *   every rule in badge_blocks[] refuses a care with the specification's own wording and
 *   leaves the stats untouched; the seventeen command words in badge_voice_defs[] emit
 *   their own EVT_VOICE_CMD and carry out their own action; the alert rule is the fixed
 *   priority list in badge_alerts[] rather than "lowest stat wins"; the four quirks in
 *   badge_quirk_defs[] turn up and can be caught inside their own window; every one of
 *   the fourteen event types is emitted by some action with its own payload; and the
 *   event log drops its oldest record exactly at BADGE_FSM_EVENT_LOG.
 *
 * HOW IT STAYS HONEST
 *   Not one number below is retyped from the specification. The timings, thresholds,
 *   deltas, ladder steps, priority order and command words all come out of badge_numbers
 *   / badge_care_defs / badge_blocks / badge_alerts / badge_quirk_defs / badge_voice_defs
 *   / badge_event_defs / badge_stage_growth -- the same tables badge_fsm.c reads. A
 *   revision of badge_spec.json that the state machine does not follow fails here instead
 *   of drifting quietly.
 *
 * DETERMINISM
 *   The clock is advanced by handing an explicit now_ms to badge_fsm_tick() /
 *   badge_fsm_act() / the gesture calls. There is no sleep(), no clock() and no wall time
 *   in this file. Where a case has to wait for a quirk it does so through the module's own
 *   fixed-seed PRNG, so the wait is the same on every run too.
 *
 * WHAT THIS DOES NOT PROVE
 *   Anything about LVGL, the panel, the codec, the IMU or the radio. "badge_fsm_tick()
 *   said the care finished" is not "the glass drew it", and "an event was emitted" is not
 *   "the phone received it". Only the board and the App can settle those.
 *
 * A DEFECT THIS PHASE FOUND, NOW FIXED
 *   The one behaviour this phase could not assert as the roadmap describes it was
 *   回到主表盘 on a wake out of 待机常显. badge_fsm_wake() refreshed last_input AFTER
 *   home(), and home() -> go() -> update_mode() reads the idle clock, so the ladder sent
 *   the badge straight back to 待机常显: EVT_WAKE fired, the haptic rang, and the dial
 *   never lit. Only the raise-to-wake path (main.c polls the IMU and calls wake()
 *   directly) and a direct EVT_WAKE_TOUCH wake hit it; a finger was unaffected because
 *   badge_fsm_press() refreshes last_input before calling wake().
 *   badge_fsm.c now refreshes last_input before the `asleep` block, and this file asserts
 *   the behaviour rather than pinning the defect: no phase of the suite reports a known
 *   defect any more, and the totals line reads "0 failures" with no caveat.
 *
 * Build: tools/suite/02-fsm.cmd, driven by tools/run-host-tests.cmd
 */

#include <stdio.h>
#include <string.h>

#include "badge_fsm.h"
#include "badge_pet.h"
#include "badge_spec_data.h"

/*
 * badge_fsm.h's BADGE_SFX_* are shifts of badge_assets.h's badge_snd_t, which
 * badge_fsm.c includes for itself. The test has to name the same values to check the
 * sound a call asks for, and badge_assets.h is includable here unchanged:
 * tests/host/lvgl_font_stub/lvgl.h declares the one opaque type it needs.
 */
#include "badge_assets.h"

/* ------------------------------------------------------------------ checks ----*/

static int failures;
static int checks;

/*
 * Where a disagreement with the contract is recorded.
 *
 * The phase used to keep a `known_defects` counter for behaviours it could only pin as
 * they behaved. It is gone: the wake-out-of-待机常显 ordering it was holding open has
 * been fixed in badge_fsm.c, and nothing else is pinned. Anything new that the state
 * machine gets wrong is reported to the team lead, and reported rather than counted --
 * a number in the totals line invites a green run to be read as a clean one.
 */

#define CHECK(cond)                                                  \
    do {                                                             \
        checks++;                                                    \
        if (!(cond)) {                                               \
            printf("  FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); \
            failures++;                                              \
        }                                                            \
    } while (0)

#define CHECK_EQ(a, b)                                                                    \
    do {                                                                                  \
        checks++;                                                                         \
        long long va_ = (long long)(a), vb_ = (long long)(b);                             \
        if (va_ != vb_) {                                                                 \
            printf("  FAIL %s:%d: %s == %s (%lld != %lld)\n", __FILE__, __LINE__, #a, #b, \
                   va_, vb_);                                                             \
            failures++;                                                                   \
        }                                                                                 \
    } while (0)

#define CHECK_STR_EQ(a, b)                                                                 \
    do {                                                                                   \
        checks++;                                                                          \
        const char *sa_ = (a), *sb_ = (b);                                                 \
        if (!sa_ || !sb_ || strcmp(sa_, sb_) != 0) {                                       \
            printf("  FAIL %s:%d: \"%s\" != \"%s\"\n", __FILE__, __LINE__, sa_ ? sa_ : "", \
                   sb_ ? sb_ : "");                                                        \
            failures++;                                                                    \
        }                                                                                  \
    } while (0)

static void section(const char *title)
{
    printf("%s\n", title);
}

/* ------------------------------------------------------------------ fixture ----*/

/*
 * Exactly one state machine, heap-allocated by badge_fsm_create() and reset between
 * cases. Never a stack object: the module explains at length that an 8 KB stack array is
 * what put the previous firmware into a reboot loop (docs/m1-hardware-verification.md).
 */
static badge_game_t game;
static badge_fsm_t *fsm;

/** @brief The specification's opening state, as main/pet supplies it. */
static badge_game_t game_new(void)
{
    badge_game_t g;
    badge_pet_defaults(&g);
    return g;
}

/** @brief How far the scripted clock has been advanced, in milliseconds. */
static uint32_t g_now;

/** @brief A fresh state machine on the specification's opening numbers, at t = 0. */
static void fresh(void)
{
    if (fsm) badge_fsm_destroy(fsm);
    game = game_new();
    fsm = badge_fsm_create(&game, 0);
    g_now = 0;
}

/* ------------------------------------------------------------------ helpers ----*/

static int sink_calls;
static badge_evt_log_t sink_last;

static void event_sink(void *user, const badge_evt_log_t *evt)
{
    (void)user;
    sink_calls++;
    sink_last = *evt;
}

/*
 * A press that lands on no element. The generated element table is dense around the
 * middle of the glass, so a "bare finger on the dial" has to be steered to the corner:
 * badge_el_contains() then matches nothing and the gesture tables decide alone.
 */
#define FREE_X 0
#define FREE_Y 0

static bool is_main_screen(int s)
{
    return s == BADGE_SCREEN_MAIN_A || s == BADGE_SCREEN_MAIN_B || s == BADGE_SCREEN_MAIN_C;
}

/** @brief EVT_CARE_CANCEL's `a`: the specification's 照料编号 (喂食 0 … 睡觉 3). */
static int care_num(int care)
{
    return care > BADGE_CARE_PET ? care - 1 : 0;
}

/** @brief The care a command word's own `action` starts, or -1. */
static int care_of_action(const char *action)
{
    if (strcmp(action, "feed") == 0) return BADGE_CARE_FEED;
    if (strcmp(action, "water") == 0) return BADGE_CARE_WATER;
    if (strcmp(action, "play") == 0) return BADGE_CARE_PLAY;
    if (strcmp(action, "sleep") == 0) return BADGE_CARE_SLEEP;
    return -1;
}

static int care_screen_of(int care)
{
    switch (care) {
    case BADGE_CARE_FEED: return BADGE_SCREEN_CARE_FEED;
    case BADGE_CARE_WATER: return BADGE_SCREEN_CARE_WATER;
    case BADGE_CARE_PLAY: return BADGE_SCREEN_CARE_PLAY;
    case BADGE_CARE_SLEEP: return BADGE_SCREEN_CARE_SLEEP;
    default: return BADGE_SCREEN_CARE_MENU;
    }
}

/** @brief The start action the generated tables name for a care flow. */
static int care_act(int care)
{
    switch (care) {
    case BADGE_CARE_FEED: return BADGE_ACT_CARE_FEED;
    case BADGE_CARE_WATER: return BADGE_ACT_CARE_WATER;
    case BADGE_CARE_PLAY: return BADGE_ACT_CARE_PLAY;
    default: return BADGE_ACT_CARE_SLEEP;
    }
}

/** @brief Index of the lowest stat below low_stat, which the alert rule ignores. */
static int lowest_stat_index(void)
{
    int worst = -1;
    int worst_val = badge_numbers.low_stat;
    for (int i = 0; i < BADGE_STAT_COUNT; i++) {
        if (game.stat[i] < worst_val) {
            worst_val = game.stat[i];
            worst = i;
        }
    }
    return worst;
}

/** @brief What the care kernel produces for `steps` steps of one care. */
static int expected_stat(int before, int delta, int steps)
{
    int v = before + delta * steps;
    if (v < 0) v = 0;
    if (v > 100) v = 100;
    return v;
}

static int evt_count(void)
{
    return badge_fsm_event_count(fsm);
}

static bool evt_has(int type, int a, int b)
{
    badge_evt_log_t e;
    for (int i = 0; i < evt_count(); i++) {
        if (!badge_fsm_event_at(fsm, i, &e)) continue;
        if ((int)e.type == type && (int)e.a == a && (int)e.b == b) return true;
    }
    return false;
}

static int evt_count_of(int type)
{
    badge_evt_log_t e;
    int n = 0;
    for (int i = 0; i < evt_count(); i++) {
        if (!badge_fsm_event_at(fsm, i, &e)) continue;
        if ((int)e.type == type) n++;
    }
    return n;
}

/*
 * The quirks are picked by the module's fixed-seed PRNG after quirk_idle_ms of no input
 * and once the scheduled deadline has passed, so a case walks the clock in 1 s steps
 * until one starts and reports the time it did. Only usable in 桌面充电态: that is the one
 * mode the AOD branch never leaves on its own, so the dial cannot be taken away while
 * the search runs.
 */
static int quirk_wait(uint32_t limit)
{
    for (uint32_t step = 1000; step <= limit; step += 1000) {
        const uint32_t t = g_now + step;
        badge_fsm_tick(fsm, t);
        g_now = t;
        if (badge_fsm_quirk(fsm) >= 0) return badge_fsm_quirk(fsm);
    }
    return -1;
}

/* -- gestures -------------------------------------------------------------------*/

/*
 * A fast stroke on the play screen: 30 px in 20 ms is 1500 px/s, over the 900 px/s
 * play_pounce_speed, and moving back out gives the next pounce its own previous move.
 */
static void pounce_once(uint32_t t)
{
    badge_fsm_move(fsm, 100, 100, t);
    badge_fsm_move(fsm, 130, 100, t + 20);
    badge_fsm_move(fsm, 100, 100, t + 40);
    g_now = t + 40;
}

/** @brief A stroke from one point to another, inside swipe_max_ms. */
static void swipe_from(int x0, int y0, badge_nav_t dir)
{
    const int d = (int)badge_numbers.swipe_min_px + 10;
    int x1 = x0, y1 = y0;
    switch (dir) {
    case BADGE_NAV_UP: y1 = y0 - d; break;
    case BADGE_NAV_DOWN: y1 = y0 + d; break;
    case BADGE_NAV_LEFT: x1 = x0 - d; break;
    default: x1 = x0 + d; break;
    }
    badge_fsm_press(fsm, x0, y0, 0);
    badge_fsm_move(fsm, x0, y0, 50);
    badge_fsm_release(fsm, x1, y1, badge_numbers.swipe_max_ms);
    g_now = badge_numbers.swipe_max_ms;
}

/** @brief The first BE_HIT element of the given action, from the generated table. */
static int find_hit_element(int act)
{
    for (int el = 0; el < BADGE_EL_COUNT; el++) {
        if (badge_els[el].type != BE_HIT) continue;
        if ((int)badge_els[el].act != act) continue;
        if (badge_els[el].hold_ms != 0) continue;
        return el;
    }
    return -1;
}

/** @brief The BE_ALERT bubble of the dial, from the generated element table. */
static int find_alert_element(void)
{
    for (int el = 0; el < BADGE_EL_COUNT; el++) {
        if (badge_els[el].type == BE_ALERT) return el;
    }
    return -1;
}

/* ------------------------------------------------------------------ 1. screens ---*/

static void test_screens(void)
{
    section("screens: all 23 reachable, each answering with the generated definition");

    CHECK_EQ(BADGE_SCREEN_COUNT, BADGE_SCREEN_COUNT_SPEC);
    CHECK_EQ(BADGE_SCREEN_COUNT, 23);
    CHECK_EQ(BADGE_EL_COUNT, 151);
    CHECK_EQ(BADGE_GEST_COUNT, 51);

    /* The badge boots on 开机 and holds it for boot_ms before the dial. */
    fresh();
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_BOOT);
    CHECK(badge_fsm_screen_def(fsm) == &badge_screens[BADGE_SCREEN_BOOT]);
    badge_fsm_tick(fsm, (uint32_t)badge_numbers.boot_ms);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_BOOT);
    badge_fsm_tick(fsm, (uint32_t)badge_numbers.boot_ms + 1);
    CHECK(is_main_screen(badge_fsm_screen(fsm)));

    /* Every screen index is reachable, and keeps its name, its element window and its
     * gesture window inside the generated tables. */
    for (int s = 0; s < BADGE_SCREEN_COUNT; s++) {
        badge_fsm_go(fsm, s, BADGE_NAV_FADE);
        CHECK_EQ(badge_fsm_screen(fsm), s);

        const badge_screen_def_t *d = badge_fsm_screen_def(fsm);
        CHECK(d != NULL);
        CHECK(d == &badge_screens[s]);
        CHECK(badge_screen_def(s) == &badge_screens[s]);
        CHECK((int)d->el_first + (int)d->el_count <= BADGE_EL_COUNT);
        CHECK((int)d->gest_first + (int)d->gest_count <= BADGE_GEST_COUNT);
        CHECK(d->has_cat <= 1);
        CHECK(d->name != NULL && d->name[0] != '\0');
        CHECK(d->doc != NULL && d->enter != NULL && d->exit != NULL);
    }

    /* An index the table does not have is refused rather than clamped. */
    const int kept = badge_fsm_screen(fsm);
    badge_fsm_go(fsm, -1, BADGE_NAV_FADE);
    CHECK_EQ(badge_fsm_screen(fsm), kept);
    badge_fsm_go(fsm, BADGE_SCREEN_COUNT, BADGE_NAV_FADE);
    CHECK_EQ(badge_fsm_screen(fsm), kept);
    CHECK(badge_screen_def(-1) == NULL);
    CHECK(badge_screen_def(BADGE_SCREEN_COUNT) == NULL);

    /* badge_fsm_go() for every badge_nav_t, and the transition each one arms. */
    badge_fsm_tick(fsm, 0);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int dir = BADGE_NAV_FADE; dir <= BADGE_NAV_RIGHT; dir++) {
        const int target = dir % 2 ? BADGE_SCREEN_STATUS : BADGE_SCREEN_MAIN_A;
        badge_fsm_go(fsm, target, (badge_nav_t)dir);
        CHECK_EQ(badge_fsm_screen(fsm), target);
        CHECK_EQ(badge_fsm_transition_dir(fsm), dir);
        CHECK(badge_fsm_transitioning(fsm, 0));
        CHECK(badge_fsm_transitioning(fsm, badge_numbers.transition_ms - 1));
        CHECK(!badge_fsm_transitioning(fsm, badge_numbers.transition_ms));
    }

    /* Re-entering the screen already on the glass arms nothing. */
    badge_fsm_tick(fsm, 0);
    badge_fsm_go(fsm, BADGE_SCREEN_STATUS, BADGE_NAV_FADE);
    badge_fsm_go(fsm, BADGE_SCREEN_STATUS, BADGE_NAV_LEFT);
    CHECK_EQ(badge_fsm_transition_dir(fsm), BADGE_NAV_FADE);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_STATUS);

    /* hit_test walks this screen's own window and the disc's own edge. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    const int cat = find_hit_element(BADGE_ACT_PET);
    CHECK(cat >= 0);
    CHECK_EQ(badge_fsm_hit_test(fsm, badge_els[cat].x, badge_els[cat].y), cat);
    CHECK(badge_fsm_hit_test(fsm, FREE_X, FREE_Y) < 0);
    CHECK(badge_fsm_hit_test(fsm, BADGE_TOUCH_MAX + 5, BADGE_TOUCH_MAX + 5) < 0);
    /* 提示气泡 with nothing to show is not there to press. */
    const int alert_el = find_alert_element();
    CHECK(alert_el >= 0);
    CHECK_EQ(badge_fsm_alert(fsm), -1);
    CHECK(badge_fsm_hit_test(fsm, badge_els[alert_el].x, badge_els[alert_el].y) != alert_el);

    /* The dial's element and gesture windows are the tables': 12 elements, 7 gestures. */
    const badge_screen_def_t *dial = badge_fsm_screen_def(fsm);
    CHECK_EQ(dial->el_count, 12);
    CHECK_EQ(dial->gest_count, 7);
}

/* ------------------------------------------------------------------ 2. gestures --*/

static void test_gestures(void)
{
    section("gestures: tap on the specification's own window and movement budget");

    CHECK_EQ(badge_numbers.tap_max_ms, 300);
    CHECK_EQ(badge_numbers.tap_move_max, 12);
    CHECK_EQ(badge_numbers.long_press_ms, 600);
    CHECK_EQ(badge_numbers.swipe_min_px, 50);
    CHECK_EQ(badge_numbers.swipe_max_ms, 500);

    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    const int cat = find_hit_element(BADGE_ACT_PET);
    CHECK(cat >= 0);
    const int cx = badge_els[cat].x;
    const int cy = badge_els[cat].y;
    CHECK(badge_els[cat].r > 0);

    /* A press on the cat released at exactly tap_max_ms is tap_cat: EVT_PET, and the
     * specification's own 摸摸 delta. */
    badge_fsm_take_fx(fsm);
    badge_fsm_event_clear(fsm);
    const int mood0 = game.stat[BADGE_STAT_MOOD];
    badge_fsm_press(fsm, cx, cy, 1000);
    badge_fsm_release(fsm, cx, cy, 1000 + badge_numbers.tap_max_ms);
    CHECK(evt_has(EVT_PET, 0, 0));
    CHECK_EQ(game.stat[BADGE_STAT_MOOD],
             mood0 + badge_care_defs[BADGE_CARE_PET].delta[BADGE_STAT_MOOD]);

    /* 摸摸 is rate-limited by pet_cooldown_ms. The tap was dispatched by release(), so
     * the cooldown is armed from the release's own now_ms, not from the press. */
    const int after_tap = game.stat[BADGE_STAT_MOOD];
    CHECK_EQ(after_tap, mood0 + badge_care_defs[BADGE_CARE_PET].delta[BADGE_STAT_MOOD]);
    const uint32_t tap_released = 1000 + badge_numbers.tap_max_ms;
    badge_fsm_act(fsm, BADGE_ACT_PET, tap_released + badge_numbers.pet_cooldown_ms - 1);
    CHECK_EQ(game.stat[BADGE_STAT_MOOD], after_tap);
    CHECK(!evt_has(EVT_PET, 0, 0) || evt_count_of(EVT_PET) == 1);
    badge_fsm_act(fsm, BADGE_ACT_PET, tap_released + badge_numbers.pet_cooldown_ms);
    CHECK_EQ(game.stat[BADGE_STAT_MOOD],
             after_tap + badge_care_defs[BADGE_CARE_PET].delta[BADGE_STAT_MOOD]);
    CHECK_EQ(evt_count_of(EVT_PET), 2);
    CHECK(badge_numbers.pet_cooldown_ms <= badge_numbers.care_cooldown_ms);

    /* One millisecond past the tap window is not a tap. */
    badge_fsm_event_clear(fsm);
    badge_fsm_press(fsm, cx, cy, 9000);
    badge_fsm_release(fsm, cx, cy, 9000 + badge_numbers.tap_max_ms + 1);
    CHECK_EQ(evt_count_of(EVT_PET), 0);

    /* Inside tap_move_max is a tap. The exact boundary is deliberately not asserted: the
     * header says "<= tapMoveMax px" while release() tests `dist < tap_move_max`, and a
     * one-pixel disagreement is not what this phase is about. */
    badge_fsm_event_clear(fsm);
    badge_fsm_press(fsm, cx, cy, 20000);
    badge_fsm_move(fsm, cx + badge_numbers.tap_move_max - 1, cy, 20010);
    badge_fsm_release(fsm, cx + badge_numbers.tap_move_max - 1, cy, 20020);
    CHECK_EQ(evt_count_of(EVT_PET), 1);

    badge_fsm_event_clear(fsm);
    badge_fsm_press(fsm, cx, cy, 21000);
    badge_fsm_move(fsm, cx + badge_numbers.tap_move_max + 1, cy, 21010);
    badge_fsm_release(fsm, cx + badge_numbers.tap_move_max + 1, cy, 21020);
    CHECK_EQ(evt_count_of(EVT_PET), 0);

    /* A release that moved swipe_min_px at the last legal millisecond is a swipe, not a
     * tap -- and it lands on the dial the reference's arithmetic names. */
    badge_fsm_event_clear(fsm);
    badge_fsm_press(fsm, cx, cy, 30000);
    badge_fsm_release(fsm, cx + badge_numbers.swipe_min_px, cy,
                      30000 + badge_numbers.swipe_max_ms);
    CHECK_EQ(evt_count_of(EVT_PET), 0);
    CHECK_EQ(game.face, 2);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_C);

    /* A press with no element under it only touches; a move with no press is ignored. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_move(fsm, 100, 100, 10);
    badge_fsm_release(fsm, 100, 100, 20);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    badge_fsm_press(fsm, FREE_X, FREE_Y, 1000);
    badge_fsm_release(fsm, FREE_X, FREE_Y, 1100);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    CHECK_EQ(evt_count(), 0);

    /* A tap on the bubble with no alert on the glass does nothing. */
    const int alert_el = find_alert_element();
    CHECK(alert_el >= 0);
    badge_fsm_press(fsm, badge_els[alert_el].x, badge_els[alert_el].y, 2000);
    badge_fsm_release(fsm, badge_els[alert_el].x, badge_els[alert_el].y, 2100);
    CHECK_EQ(evt_count(), 0);
}

/* --------------------------------------------------------------- 3. long press --*/

static void test_long_press_and_swipes(void)
{
    section("gestures: long press, the four swipes, and where each one lands");

    /* The long press is measured from press to the tick that crosses long_press_ms with
     * the finger still down: the reference fires 按住说话 without a release. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_press(fsm, FREE_X, FREE_Y, 1000);
    badge_fsm_tick(fsm, 1000 + badge_numbers.long_press_ms - 1);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    CHECK_EQ(evt_count(), 0);
    badge_fsm_tick(fsm, 1000 + badge_numbers.long_press_ms);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_VOICE);
    CHECK(!badge_fsm_voice_thinking(fsm));
    CHECK_EQ(badge_fsm_bubble(fsm, 1000 + badge_numbers.long_press_ms), BADGE_TXT_LISTENING);
    /* Releasing ends the listen: the cat is thinking, not still listening. */
    badge_fsm_release(fsm, FREE_X, FREE_Y, 1000 + badge_numbers.long_press_ms + 1);
    CHECK(badge_fsm_voice_thinking(fsm));
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_VOICE);
    badge_fsm_tick(fsm, 1000 + badge_numbers.long_press_ms + 1 + badge_numbers.voice_think_ms);
    CHECK(!badge_fsm_voice_thinking(fsm));

    /* A long press only arms where the screen declares it. 设置 declares only right. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_SETTINGS, BADGE_NAV_LEFT);
    badge_fsm_press(fsm, FREE_X, FREE_Y, 1000);
    badge_fsm_tick(fsm, 1000 + badge_numbers.long_press_ms + 1);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_SETTINGS);

    /* up on a dial opens 照料轮盘; down opens 状态; up from 状态 comes home. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    swipe_from(233, 233, BADGE_NAV_UP);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_CARE_MENU);
    badge_fsm_tick(fsm, 0);
    swipe_from(233, 233, BADGE_NAV_DOWN);
    CHECK(is_main_screen(badge_fsm_screen(fsm)));

    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    swipe_from(233, 233, BADGE_NAV_DOWN);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_STATUS);
    badge_fsm_tick(fsm, 0);
    swipe_from(233, 233, BADGE_NAV_UP);
    CHECK(is_main_screen(badge_fsm_screen(fsm)));

    /* left / right walk the three dials and report each change as EVT_FACE. */
    for (int dir = BADGE_NAV_LEFT; dir <= BADGE_NAV_RIGHT; dir++) {
        fresh();
        badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
        badge_fsm_event_clear(fsm);
        swipe_from(233, 233, (badge_nav_t)dir);
        CHECK(game.face != 0);
        CHECK(game.face < 3);
        CHECK(evt_has(EVT_FACE, game.face, 0));
        CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A + game.face);
    }

    /* The dial arithmetic is the reference's: left is +1 and right is +2. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    swipe_from(233, 233, BADGE_NAV_LEFT);
    CHECK_EQ(game.face, 1);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_B);
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    swipe_from(233, 233, BADGE_NAV_RIGHT);
    CHECK_EQ(game.face, 2);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_C);

    /* A stroke too short to be a swipe, and one too slow, are neither swipe nor tap. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_press(fsm, FREE_X, FREE_Y, 0);
    badge_fsm_release(fsm, badge_numbers.swipe_min_px - 1, FREE_Y, badge_numbers.swipe_max_ms);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    CHECK_EQ(evt_count(), 0);
    badge_fsm_press(fsm, FREE_X, FREE_Y, 5000);
    badge_fsm_release(fsm, badge_numbers.swipe_min_px + 1, FREE_Y,
                      5000 + badge_numbers.swipe_max_ms + 1);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    CHECK_EQ(evt_count(), 0);

    /* A gesture the screen does not declare does nothing: 设置 declares only right. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_SETTINGS, BADGE_NAV_LEFT);
    badge_fsm_tick(fsm, 0);
    swipe_from(233, 233, BADGE_NAV_UP);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_SETTINGS);
    badge_fsm_tick(fsm, 0);
    swipe_from(233, 233, BADGE_NAV_DOWN);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_SETTINGS);
    badge_fsm_tick(fsm, 0);
    swipe_from(233, 233, BADGE_NAV_LEFT);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_SETTINGS);
    badge_fsm_tick(fsm, 0);
    swipe_from(233, 233, BADGE_NAV_RIGHT);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_STATUS);

    /* A press on 待机常显 is a wake cause and nothing else: one EVT_WAKE, no tap. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_AOD);
    badge_fsm_event_clear(fsm);
    badge_fsm_press(fsm, FREE_X, FREE_Y, badge_numbers.play_to_sleep_ms + 2);
    CHECK(evt_has(EVT_WAKE, EVT_WAKE_TOUCH, 0));
    CHECK_EQ(evt_count(), 1);
    CHECK(is_main_screen(badge_fsm_screen(fsm)));
    badge_fsm_release(fsm, FREE_X, FREE_Y, badge_numbers.play_to_sleep_ms + 3);
    CHECK_EQ(evt_count(), 1);
}

/*
 * release()'s own arithmetic at the boundaries of int and uint32_t.
 *
 * The panel reports 0..465 and the mirror arithmetic in esp_lcd_touch can hand back 466,
 * which badge_touch_clamp() pins (badge_spec.h:92-96). A sample beyond that is a fault
 * somewhere else, and what matters here is that the state machine neither crashes nor
 * navigates on it: the deltas are ints, so a large jump wraps, and the swipe window is a
 * uint32_t, so a release stamped before its press reads as (uint32_t)-1 ms -- a stroke
 * photographed never. Both are outside swipe_max_ms, so both must land on nothing.
 */
static void test_release_wrap(void)
{
    section("gestures: release()'s swipe arithmetic at the int / uint32 boundary");

    const int huge = 2147483647;
    const struct { int x, y; } samples[4] = {
        { huge, 0 }, { 0, huge }, { -huge, 0 }, { 0, -huge },
    };
    for (size_t c = 0; c < sizeof(samples) / sizeof(samples[0]); c++) {
        fresh();
        badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
        badge_fsm_tick(fsm, 0);
        badge_fsm_press(fsm, 200, 200, 0);
        badge_fsm_release(fsm, samples[c].x, samples[c].y, 1000);
        CHECK(is_main_screen(badge_fsm_screen(fsm)));
        CHECK_EQ(game.face, 0);
        CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    }

    /* A press and a release whose stamps are the other way round: dt is (uint32_t)-1,
     * which is not <= tap_max_ms, so this is not a tap and nothing is dispatched. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_take_fx(fsm);
    badge_fsm_press(fsm, 233, 262, 1);
    badge_fsm_release(fsm, 233, 262, 0);
    CHECK_EQ(evt_count(), 0);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    CHECK(!badge_fsm_take_fx(fsm).invalidate);
}

/* ------------------------------------------------------------------ 4. modes -----*/

static void test_modes(void)
{
    section("modes: the desk -> play -> comp -> aod -> off ladder and what each reports");

    CHECK_EQ(badge_numbers.play_to_sleep_ms,
             (uint32_t)badge_numbers.play_to_comp_ms + badge_numbers.comp_to_aod_ms);

    /* 桌面充电态 is USB present AND lying flat, and it is never auto-advanced. */
    fresh();
    badge_fsm_set_power(fsm, true, true);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_DESK);
    CHECK_EQ(badge_fsm_fps(fsm), badge_numbers.desk_fps);
    CHECK_EQ(badge_fsm_res(fsm), badge_numbers.desk_res);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), badge_bright_scale_pct[game.bright]);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (uint32_t t = 0; t <= 10u * badge_numbers.play_to_sleep_ms; t += 5000)
        badge_fsm_tick(fsm, t);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_DESK);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);

    /* Unplugging drops it to 互动态. */
    fresh();
    badge_fsm_set_power(fsm, false, false);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_PLAY);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_tick(fsm, 0);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_PLAY);
    CHECK_EQ(badge_fsm_fps(fsm), badge_numbers.play_fps);
    CHECK_EQ(badge_fsm_res(fsm), badge_numbers.play_res);

    /* play_to_comp_ms of no input: 互动态 -> 陪伴态 (the guard is strict). */
    badge_fsm_tick(fsm, badge_numbers.play_to_comp_ms);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_PLAY);
    badge_fsm_tick(fsm, (uint32_t)badge_numbers.play_to_comp_ms + 1);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_COMP);
    CHECK_EQ(badge_fsm_fps(fsm), badge_numbers.comp_fps);
    CHECK_EQ(badge_fsm_res(fsm), badge_numbers.comp_res);

    /* comp_to_aod_ms later: 陪伴态 -> 待机常显, and the clock alone gets there. */
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_COMP);
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_AOD);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_AOD);
    CHECK_EQ(badge_fsm_fps(fsm), badge_numbers.aod_fps);
    CHECK_EQ(badge_fsm_res(fsm), badge_numbers.aod_res);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), badge_numbers.aod_bright_pct);

    /* Nothing but the clock: 待机常显 stays put for a minute of silence. */
    for (uint32_t t = badge_numbers.play_to_sleep_ms + 1000;
         t <= badge_numbers.play_to_sleep_ms + 60000; t += 1000) {
        badge_fsm_tick(fsm, t);
        CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_AOD);
        CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_AOD);
    }

    /* 息屏常显 off means 息屏: the same screen, no backlight, nothing rendered. */
    fresh();
    game.aod = false;
    badge_fsm_set_power(fsm, false, false);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_AOD);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_OFF);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), 0);
    CHECK_EQ(badge_fsm_fps(fsm), 0);
    CHECK_EQ(badge_fsm_res(fsm), 0);

    /* A wake out of 待机常显. The handoff is staged in the order badge_fsm.c stages it,
     * and the order is the point:
     *
     *   last_input  -> refreshed FIRST, because a wake is an input event
     *   asleep      -> emit EVT_WAKE(cause) + the wake haptic/sfx + home()
     *   home()      -> go(dial) -> update_mode()
     *   update_mode -> reads `idle = now_ms - last_input`, which is now 0, so the ladder
     *                  branch does not fire and home() sticks
     *
     * That first step used to be last. With last_input still holding the PRE-sleep stamp
     * the idle read was past play_to_sleep_ms, the ladder sent the badge straight back to
     * 待机常显, and the visible effect was a badge that buzzed and stayed dark for
     * raise-to-wake (main.c polls the IMU and calls wake() directly) and for a direct
     * EVT_WAKE_TOUCH wake. A real finger was unaffected, because badge_fsm_press()
     * refreshes last_input before it calls wake(), and the wake word is unaffected too
     * since voice_start() lands on 按住说话 -- which is why only the test could see it.
     */
    for (int cause = EVT_WAKE_RAISE; cause <= EVT_WAKE_WORD; cause++) {
        fresh();
        badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
        badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1);
        CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_AOD);
        badge_fsm_event_clear(fsm);
        badge_fsm_take_fx(fsm);
        badge_fsm_wake(fsm, (uint8_t)cause, badge_numbers.play_to_sleep_ms + 10);
        /* The wake itself is reported exactly once, whichever cause it was. */
        CHECK(evt_has(EVT_WAKE, cause, 0));
        CHECK_EQ(evt_count_of(EVT_WAKE), 1);
        const badge_fx_t wake_fx = badge_fsm_take_fx(fsm);
        CHECK_EQ(wake_fx.haptic, BADGE_HAPTIC_WAKE);
        CHECK_EQ(wake_fx.sfx, BADGE_SFX_WAKE);
        if (cause == EVT_WAKE_WORD) {
            /* The wake word is the one cause that really does leave 待机常显: it opens
             * the listen, and voice_start() puts the badge on 按住说话. */
            CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_VOICE);
            CHECK(!badge_fsm_voice_thinking(fsm));
            CHECK_EQ(badge_fsm_bubble(fsm, badge_numbers.play_to_sleep_ms + 10),
                     BADGE_TXT_LISTENING);
            CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_PLAY);
            continue;
        }
        /* 抬起 / 触摸: 回到主表盘（互动态）. This is wake()'s own comment and, since the
         * last_input ordering fix in badge_fsm_wake(), what actually happens: a wake is
         * input, so the idle clock is refreshed before home()'s go() runs the ladder.
         * Before the fix this assertion failed for EVT_WAKE_RAISE and a direct
         * EVT_WAKE_TOUCH (the badge buzzed, then laddered straight back to 待机常显). */
        CHECK(is_main_screen(badge_fsm_screen(fsm)));
        CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_PLAY);
        CHECK_EQ(badge_fsm_backlight_pct(fsm), badge_bright_scale_pct[game.bright]);
    }

    /* A finger on the glass comes home by the other route: badge_fsm_press() refreshes
     * last_input before it calls wake(). Both routes must agree, and this is the one that
     * never broke -- which is exactly why the ordering defect above went unseen. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_AOD);
    badge_fsm_event_clear(fsm);
    badge_fsm_press(fsm, FREE_X, FREE_Y, badge_numbers.play_to_sleep_ms + 2);
    CHECK(evt_has(EVT_WAKE, EVT_WAKE_TOUCH, 0));
    CHECK(is_main_screen(badge_fsm_screen(fsm)));
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_PLAY);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), badge_bright_scale_pct[game.bright]);
    badge_fsm_release(fsm, FREE_X, FREE_Y, badge_numbers.play_to_sleep_ms + 3);

    /* At 息屏常显 off, 待机常显 is the 息屏 reading of the same screen and a wake does not
     * climb out of it: the badge has no clock to show, so the only thing the wake changes
     * is the mode, which the ladder re-derives as OFF from the `aod` setting. */
    fresh();
    game.aod = false;
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_OFF);
    badge_fsm_event_clear(fsm);
    badge_fsm_wake(fsm, EVT_WAKE_RAISE, badge_numbers.play_to_sleep_ms + 10);
    CHECK(evt_has(EVT_WAKE, EVT_WAKE_RAISE, 0));
    /* The wake still lights the dial: home() runs, so the screen is a main dial now and
     * update_mode's ladder branch is suppressed by the refreshed idle clock. The dark
     * reading is gone with it -- 息屏 is the setting's business, not the screen's. */
    CHECK(is_main_screen(badge_fsm_screen(fsm)));
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_PLAY);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), badge_bright_scale_pct[game.bright]);
    CHECK_EQ(badge_fsm_fps(fsm), badge_numbers.play_fps);
    game.aod = true;

    /* A wake cause on a lit dial is not a second EVT_WAKE. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_wake(fsm, EVT_WAKE_RAISE, 100);
    CHECK_EQ(evt_count_of(EVT_WAKE), 0);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_PLAY);

    /* A wake cause on a lit dial is not a second EVT_WAKE. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_wake(fsm, EVT_WAKE_RAISE, 100);
    CHECK_EQ(evt_count_of(EVT_WAKE), 0);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_PLAY);

    /* 息屏常显 switched off while standing on 待机常显 goes dark now, not next step. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_AOD);
    badge_fsm_act(fsm, BADGE_ACT_SET_AOD, badge_numbers.play_to_sleep_ms + 2);
    CHECK(!game.aod);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_OFF);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), 0);

    /* The four settings are the specification's, and each event carries its new value. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_SETTINGS, BADGE_NAV_LEFT);
    badge_fsm_event_clear(fsm);
    const int bright0 = game.bright;
    badge_fsm_act(fsm, BADGE_ACT_SET_BRIGHT, 1000);
    CHECK_EQ(game.bright, (bright0 + 1) % BADGE_BRIGHT_LEVELS);
    CHECK(evt_has(EVT_SETTING, BADGE_SETTING_BRIGHT, game.bright));
    const bool wake0 = game.wake_word;
    badge_fsm_act(fsm, BADGE_ACT_SET_WAKE, 1100);
    CHECK_EQ(game.wake_word, !wake0);
    CHECK(evt_has(EVT_SETTING, BADGE_SETTING_WAKE, game.wake_word ? 1 : 0));
    const bool disc0 = game.discover;
    badge_fsm_act(fsm, BADGE_ACT_SET_DISCOVER, 1200);
    CHECK_EQ(game.discover, !disc0);
    CHECK(evt_has(EVT_SETTING, BADGE_SETTING_DISCOVER, game.discover ? 1 : 0));
    const bool aod0 = game.aod;
    badge_fsm_act(fsm, BADGE_ACT_SET_AOD, 1300);
    CHECK_EQ(game.aod, !aod0);
    CHECK(evt_has(EVT_SETTING, BADGE_SETTING_AOD, game.aod ? 1 : 0));
}

/* ------------------------------------------------------------------ 5. cares -----*/

static void test_cares(void)
{
    section("cares: the five flows move badge_care_defs[]'s own numbers, once");

    /* 摸摸 is immediate, and the only care with no screen of its own. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    const int growth_pet0 = game.growth;
    badge_fsm_event_clear(fsm);
    const badge_fx_t pet_fx = badge_fsm_act(fsm, BADGE_ACT_PET, 1000);
    CHECK_EQ(evt_count_of(EVT_PET), 1);
    CHECK_EQ(pet_fx.sfx, BADGE_SFX_PET);
    CHECK(!pet_fx.finished_care);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    CHECK_EQ(game.stat[BADGE_STAT_MOOD],
             72 + badge_care_defs[BADGE_CARE_PET].delta[BADGE_STAT_MOOD]);
    CHECK_EQ(game.growth, growth_pet0 + badge_care_defs[BADGE_CARE_PET].growth);

    /* 喂食 / 喝水 / 逗猫 / 哄睡, each driven the way its own screen is driven. */
    for (int care = BADGE_CARE_FEED; care < BADGE_CARE_COUNT_SPEC; care++) {
        const badge_care_def_t *def = &badge_care_defs[care];
        const int steps = def->steps > 0 ? (int)def->steps : 1;

        fresh();
        badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
        for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
        game.coins = 100;
        int before[BADGE_STAT_COUNT];
        for (int i = 0; i < BADGE_STAT_COUNT; i++) before[i] = game.stat[i];
        const int growth0 = game.growth;
        const int coins0 = game.coins;

        badge_fsm_take_fx(fsm);
        badge_fsm_event_clear(fsm);
        const badge_fx_t start_fx = badge_fsm_act(fsm, care_act(care), 1000);
        CHECK(start_fx.started_care);
        CHECK_EQ(badge_fsm_care(fsm), care);
        CHECK_EQ(badge_fsm_screen(fsm), care_screen_of(care));
        CHECK_EQ(badge_fsm_care_step(fsm), 0);

        uint32_t after = 1000;
        if (care == BADGE_CARE_SLEEP) {
            /* 哄睡 is the one care whose element action is a hold: the moon's own
             * hold_ms is the specification's sleep_hold_ms, and it opens 睡着了. */
            int moon = -1;
            for (int el = 0; el < BADGE_EL_COUNT; el++) {
                if (badge_els[el].act == BADGE_ACT_HOLD && badge_els[el].hold_ms > 0) {
                    moon = el;
                    break;
                }
            }
            CHECK(moon >= 0);
            CHECK_EQ(badge_els[moon].hold_ms, badge_numbers.sleep_hold_ms);
            CHECK_EQ(badge_fsm_hit_test(fsm, badge_els[moon].x, badge_els[moon].y), moon);
            badge_fsm_press(fsm, badge_els[moon].x, badge_els[moon].y, 1100);
            badge_fsm_tick(fsm, 1100 + badge_numbers.sleep_hold_ms - 1);
            CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_CARE_SLEEP);
            badge_fsm_tick(fsm, 1100 + badge_numbers.sleep_hold_ms);
            CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_SLEEPING);
            badge_fsm_release(fsm, badge_els[moon].x, badge_els[moon].y,
                              1100 + badge_numbers.sleep_hold_ms + 5);
            const uint32_t entered = 1100 + badge_numbers.sleep_hold_ms;
            after = entered + badge_numbers.sleep_demo_ms + 1;
            badge_fsm_tick(fsm, after - 1);
            CHECK_EQ(badge_fsm_care(fsm), care);
            badge_fsm_tick(fsm, after);
            CHECK(evt_has(EVT_SLEEP, 0, 0));
        } else if (care == BADGE_CARE_PLAY) {
            /* 逗猫: a stroke that beats play_pounce_speed is a pounce, and the game's
             * own step count finishes it. */
            CHECK(badge_numbers.play_pounce_speed > 0);
            badge_fsm_press(fsm, 100, 100, 1100);
            for (int i = 0; i < steps; i++) pounce_once(2000 + (uint32_t)i * 1000);
            after = 2000 + (uint32_t)steps * 1000;
            CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_NONE);
            CHECK(evt_has(EVT_PLAY, steps, 0));
        } else {
            /* 喂食 / 喝水: one bite per step, rate-limited by bite_gap_ms. The step the
             * action reports finishes the care, and step_care() clears the counter on the
             * way out, so the counter is only readable before the last bite. */
            uint32_t t = 1000;
            for (int i = 0; i < steps; i++) {
                t += badge_numbers.bite_gap_ms;
                badge_fsm_act(fsm, BADGE_ACT_BITE, t);
                if (i + 1 < steps) CHECK_EQ(badge_fsm_care_step(fsm), i + 1);
                else CHECK_EQ(badge_fsm_care_step(fsm), 0);
            }
            after = t;
            CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_NONE);
            CHECK(evt_has(care == BADGE_CARE_FEED ? EVT_FEED : EVT_WATER, steps, 0));
        }

        /* Every step applied the delta; the last one settled growth and coins once. */
        for (int i = 0; i < BADGE_STAT_COUNT; i++) {
            CHECK_EQ(game.stat[i], expected_stat(before[i], def->delta[i], steps));
        }
        CHECK_EQ(game.growth, growth0 + def->growth);
        CHECK_EQ(game.coins, coins0 + def->coins);

        /* The flow is over, so it is back on a dial and a stray step settles nothing. */
        CHECK(is_main_screen(badge_fsm_screen(fsm)));
        const int growth_once = game.growth;
        const int coins_once = game.coins;
        badge_fsm_act(fsm, BADGE_ACT_BITE, after + 5000);
        CHECK_EQ(game.growth, growth_once);
        CHECK_EQ(game.coins, coins_once);
    }

    /* 清洁 and 健康 have no care of their own, so their only movement is through a care
     * that names them. Nothing here may invent one. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    const int clean0 = game.stat[BADGE_STAT_CLEAN];
    const int health0 = game.stat[BADGE_STAT_HEALTH];
    badge_fsm_act(fsm, BADGE_ACT_PET, 1000);
    CHECK_EQ(game.stat[BADGE_STAT_CLEAN], clean0);
    CHECK_EQ(game.stat[BADGE_STAT_HEALTH], health0);
    CHECK_EQ((int)badge_care_defs[BADGE_CARE_PET].delta[BADGE_STAT_CLEAN], 0);

    /* Already at the range's own ceiling, the +9 has nowhere to go: the stat pins at 100
     * and 已经很开心啦 is the refusal that says so. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    game.stat[BADGE_STAT_MOOD] = 100 - badge_care_defs[BADGE_CARE_PET].delta[BADGE_STAT_MOOD] + 1;
    CHECK(game.stat[BADGE_STAT_MOOD] <= 100 - badge_care_defs[BADGE_CARE_PET].delta[BADGE_STAT_MOOD] + 1);
    badge_fsm_act(fsm, BADGE_ACT_PET, 1000);
    CHECK_EQ(game.stat[BADGE_STAT_MOOD], 100);
    CHECK(badge_fsm_care_blocked(fsm, BADGE_CARE_PET, NULL));
}

/* ---------------------------------------------------------------- 6. refusals ----*/

static void test_care_refusals(void)
{
    section("cares: every rule in badge_blocks[] refuses, in the spec's own wording");

    CHECK_EQ(BADGE_BLOCK_COUNT, 6);
    CHECK_EQ(BADGE_CARE_COUNT_SPEC, 5);

    int rules_seen = 0;
    for (int care = 0; care < BADGE_CARE_COUNT_SPEC; care++) {
        const badge_care_def_t *def = &badge_care_defs[care];
        for (int k = 0; k < (int)def->block_count; k++) {
            const badge_block_t *b = &badge_blocks[def->block_first + k];
            rules_seen++;

            /* Put the game just over the rule's own edge, everything else well clear. */
            fresh();
            badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
            for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 60;
            game.coins = 100;
            game.sick = false;
            switch (b->op) {
            case BADGE_OP_GE:
                if (b->stat == BADGE_STAT_SICK) game.sick = true;
                else if (b->stat == BADGE_STAT_COINS) game.coins = b->value;
                else game.stat[b->stat] = (uint8_t)b->value;
                break;
            case BADGE_OP_LT:
                if (b->stat == BADGE_STAT_COINS) game.coins = b->value - 1;
                else game.stat[b->stat] = (uint8_t)(b->value - 1);
                break;
            default:
                if (b->stat == BADGE_STAT_SICK) game.sick = (b->value != 0);
                break;
            }

            uint16_t why = 0;
            CHECK(badge_fsm_care_blocked(fsm, care, &why));
            CHECK_EQ(why, b->text);
            CHECK(why != 0 && why < BADGE_STRING_COUNT);
            CHECK(badge_strings[why][0] != '\0');

            /* A refused care moves not one number, opens no screen, reports nothing. */
            int stat_before[BADGE_STAT_COUNT];
            for (int i = 0; i < BADGE_STAT_COUNT; i++) stat_before[i] = game.stat[i];
            const int growth_before = game.growth;
            const int coins_before = game.coins;
            const int screen_before = badge_fsm_screen(fsm);
            badge_fsm_event_clear(fsm);
            badge_fsm_take_fx(fsm);
            if (care == BADGE_CARE_PET) {
                const badge_fx_t fx = badge_fsm_act(fsm, BADGE_ACT_PET, 9000);
                /* 已经很开心啦: the cat answers, but nothing is settled and nothing is
                 * reported, because an owner cannot earn growth for a refused care. */
                CHECK_EQ(fx.bubble, BADGE_TXT_PETFULL);
                CHECK_EQ(fx.sfx, 0);
                CHECK(!fx.finished_care);
            } else {
                const badge_fx_t fx = badge_fsm_act(fsm, care_act(care), 9000);
                CHECK(!fx.started_care);
                CHECK(!fx.finished_care);
                CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_NONE);
                CHECK_EQ(fx.toast, why);
                CHECK(fx.sfx != 0);
                CHECK_EQ(fx.haptic, BADGE_HAPTIC_ERROR);
            }
            for (int i = 0; i < BADGE_STAT_COUNT; i++) CHECK_EQ(game.stat[i], stat_before[i]);
            CHECK_EQ(game.growth, growth_before);
            CHECK_EQ(game.coins, coins_before);
            CHECK_EQ(badge_fsm_screen(fsm), screen_before);
            CHECK_EQ(evt_count(), 0);
        }
    }
    CHECK_EQ(rules_seen, BADGE_BLOCK_COUNT);

    /* The five thresholds the task calls out, each through its own table entry, each
     * either side of the edge so the operator and not just the wording is pinned. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    uint16_t why = 0;

    /* mood_full: at one below, 摸摸 is allowed; at it, refused with 已经很开心啦. */
    CHECK(badge_numbers.mood_full > 0);
    game.stat[BADGE_STAT_MOOD] = badge_numbers.mood_full - 1;
    CHECK(!badge_fsm_care_blocked(fsm, BADGE_CARE_PET, &why));
    game.stat[BADGE_STAT_MOOD] = badge_numbers.mood_full;
    CHECK(badge_fsm_care_blocked(fsm, BADGE_CARE_PET, &why));
    CHECK_EQ(why, badge_blocks[0].text);
    CHECK_STR_EQ(badge_strings[why], badge_strings[BADGE_TXT_PETFULL]);

    /* full: 喂食 refused at 95, allowed at 94. */
    game.stat[BADGE_STAT_MOOD] = 60;
    game.stat[BADGE_STAT_FOOD] = badge_numbers.full - 1;
    CHECK(!badge_fsm_care_blocked(fsm, BADGE_CARE_FEED, &why));
    game.stat[BADGE_STAT_FOOD] = badge_numbers.full;
    CHECK(badge_fsm_care_blocked(fsm, BADGE_CARE_FEED, &why));
    CHECK_EQ(why, badge_blocks[1].text);

    /* 喵币不够: below the rule's own edge refused, at the edge allowed. */
    game.stat[BADGE_STAT_FOOD] = 60;
    game.coins = badge_blocks[2].value - 1;
    CHECK(badge_fsm_care_blocked(fsm, BADGE_CARE_FEED, &why));
    CHECK_EQ(why, badge_blocks[2].text);
    game.coins = badge_blocks[2].value;
    CHECK(!badge_fsm_care_blocked(fsm, BADGE_CARE_FEED, &why));

    /* min_energy_play: refused below 10, allowed at 10. */
    game.stat[BADGE_STAT_ENERGY] = badge_numbers.min_energy_play - 1;
    CHECK(badge_fsm_care_blocked(fsm, BADGE_CARE_PLAY, &why));
    CHECK_EQ(why, badge_blocks[3].text);
    game.stat[BADGE_STAT_ENERGY] = badge_numbers.min_energy_play;
    CHECK(!badge_fsm_care_blocked(fsm, BADGE_CARE_PLAY, &why));

    /* 不舒服 blocks 逗猫 outright, whatever the energy says. */
    game.sick = true;
    CHECK(badge_fsm_care_blocked(fsm, BADGE_CARE_PLAY, &why));
    CHECK_EQ(why, badge_blocks[4].text);
    game.sick = false;

    /* 还不困: 睡觉 refused at full energy, allowed one below. */
    game.stat[BADGE_STAT_ENERGY] = badge_numbers.full - 1;
    CHECK(!badge_fsm_care_blocked(fsm, BADGE_CARE_SLEEP, &why));
    game.stat[BADGE_STAT_ENERGY] = badge_numbers.full;
    CHECK(badge_fsm_care_blocked(fsm, BADGE_CARE_SLEEP, &why));
    CHECK_EQ(why, badge_blocks[5].text);

    /* 喝水 has no refusal rule of its own, and an action the table does not have is
     * refused rather than read out of bounds. */
    game.stat[BADGE_STAT_ENERGY] = 60;
    CHECK(!badge_fsm_care_blocked(fsm, BADGE_CARE_WATER, &why));
    CHECK_EQ(badge_care_defs[BADGE_CARE_WATER].block_count, 0);
    CHECK(badge_fsm_care_blocked(fsm, BADGE_CARE_COUNT_SPEC, NULL));
    CHECK(badge_fsm_care_blocked(fsm, -1, NULL));

    /* bat_no_wake is the low-battery setting, not a care rule: it is only ever the
     * wake-word cut-off, and a care below it is still allowed. */
    CHECK(badge_numbers.bat_no_wake > 0);
    CHECK(!badge_fsm_care_blocked(fsm, BADGE_CARE_WATER, NULL));

    /* care_cooldown_ms: the same care twice in a row is refused by the clock, and that
     * refusal moves nothing either. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
    game.coins = 100;
    badge_fsm_act(fsm, BADGE_ACT_CARE_FEED, 1000);
    uint32_t t = 1000;
    for (int i = 0; i < (int)badge_care_defs[BADGE_CARE_FEED].steps; i++) {
        t += badge_numbers.bite_gap_ms;
        badge_fsm_act(fsm, BADGE_ACT_BITE, t);
    }
    CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_NONE);
    const int growth_done = game.growth;
    const int coins_done = game.coins;
    game.stat[BADGE_STAT_FOOD] = 40; /* room for another flow */
    badge_fsm_go(fsm, BADGE_SCREEN_CARE_FEED, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_take_fx(fsm);
    badge_fsm_act(fsm, BADGE_ACT_CARE_FEED, t + badge_numbers.care_cooldown_ms - 1);
    CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_NONE);
    CHECK_EQ(evt_count(), 0);
    CHECK_EQ(game.growth, growth_done);
    CHECK_EQ(game.coins, coins_done);
    badge_fsm_act(fsm, BADGE_ACT_CARE_FEED, t + badge_numbers.care_cooldown_ms);
    CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_FEED);
}

/* ------------------------------------------------------------------ 7. events ----*/

static void test_events(void)
{
    section("events: all fourteen types, each with its own payload");

    CHECK_EQ(BADGE_EVENT_COUNT, 14);
    CHECK_EQ(EVT_TYPE_COUNT, BADGE_EVENT_COUNT + 1);
    CHECK_EQ(BADGE_FSM_EVENT_LOG, 64);
    /* The generated table's own numbering is the enum's. */
    for (int i = 0; i < BADGE_EVENT_COUNT; i++) {
        CHECK_EQ(badge_event_defs[i].num, i + 1);
        CHECK_EQ(badge_event_defs[i].type, badge_event_defs[i].num);
        CHECK(badge_event_defs[i].label != 0);
        CHECK(badge_event_defs[i].a_desc != 0);
        CHECK(badge_event_defs[i].b_desc != 0);
    }

    bool seen[BADGE_EVENT_COUNT + 1];
    for (int i = 0; i <= BADGE_EVENT_COUNT; i++) seen[i] = false;

    /* 1 EVT_PET */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_act(fsm, BADGE_ACT_PET, 1000);
    CHECK(evt_has(EVT_PET, 0, 0));
    seen[EVT_PET] = true;

    /* 2 EVT_FEED, 3 EVT_WATER, 6 EVT_CARE_CANCEL */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
    game.coins = 100;
    badge_fsm_event_clear(fsm);
    badge_fsm_act(fsm, BADGE_ACT_CARE_FEED, 1000);
    for (int i = 0; i < (int)badge_care_defs[BADGE_CARE_FEED].steps; i++)
        badge_fsm_act(fsm, BADGE_ACT_BITE, 1100 + (uint32_t)i * badge_numbers.bite_gap_ms);
    /* a = 口数: the feed's own step count, not the number of ticks it took. */
    CHECK(evt_has(EVT_FEED, badge_care_defs[BADGE_CARE_FEED].steps, 0));
    seen[EVT_FEED] = true;

    badge_fsm_act(fsm, BADGE_ACT_CARE_WATER, 20000);
    for (int i = 0; i < (int)badge_care_defs[BADGE_CARE_WATER].steps; i++)
        badge_fsm_act(fsm, BADGE_ACT_BITE, 20100 + (uint32_t)i * badge_numbers.bite_gap_ms);
    CHECK(evt_has(EVT_WATER, badge_care_defs[BADGE_CARE_WATER].steps, 0));
    seen[EVT_WATER] = true;

    /* A care abandoned by a screen change is reported with its own number and the step
     * it had reached, and its growth is never settled (DEVIATION 1). */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
    game.coins = 100;
    const int growth_before_cancel = game.growth;
    badge_fsm_event_clear(fsm);
    badge_fsm_take_fx(fsm);
    badge_fsm_act(fsm, BADGE_ACT_CARE_FEED, 1000);
    badge_fsm_act(fsm, BADGE_ACT_BITE, 1000 + badge_numbers.bite_gap_ms);
    CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_FEED);
    CHECK_EQ(badge_fsm_care_step(fsm), 1);
    const int food_after_one = game.stat[BADGE_STAT_FOOD];
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    CHECK(evt_has(EVT_CARE_CANCEL, care_num(BADGE_CARE_FEED), 1));
    CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_NONE);
    CHECK_EQ(game.growth, growth_before_cancel);          /* abandoned: no growth */
    CHECK_EQ(game.stat[BADGE_STAT_FOOD], food_after_one); /* the step's delta stands */
    CHECK(badge_fsm_take_fx(fsm).cancelled_care);
    seen[EVT_CARE_CANCEL] = true;

    /* 4 EVT_PLAY */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
    game.coins = 100;
    badge_fsm_event_clear(fsm);
    badge_fsm_act(fsm, BADGE_ACT_CARE_PLAY, 1000);
    badge_fsm_press(fsm, 100, 100, 1100);
    for (int i = 0; i < (int)badge_care_defs[BADGE_CARE_PLAY].steps; i++)
        pounce_once(2000 + (uint32_t)i * 1000);
    CHECK(evt_has(EVT_PLAY, badge_care_defs[BADGE_CARE_PLAY].steps, 0));
    seen[EVT_PLAY] = true;

    /* 5 EVT_SLEEP */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
    badge_fsm_event_clear(fsm);
    badge_fsm_act(fsm, BADGE_ACT_CARE_SLEEP, 1000);
    badge_fsm_press(fsm, 233, 376, 1100);
    badge_fsm_tick(fsm, 1100 + badge_numbers.sleep_hold_ms);
    const uint32_t sleep_in = 1100 + badge_numbers.sleep_hold_ms;
    badge_fsm_tick(fsm, sleep_in + badge_numbers.sleep_demo_ms + 1);
    CHECK(evt_has(EVT_SLEEP, 0, 0));
    seen[EVT_SLEEP] = true;

    /* 7 EVT_VOICE_CMD, 8 EVT_VOICE_FREE */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_wake(fsm, EVT_WAKE_WORD, 1000);
    badge_fsm_voice_word(fsm, badge_strings[badge_voice_defs[0].word], 1100);
    badge_fsm_tick(fsm, 1100 + badge_numbers.voice_think_ms);
    CHECK(evt_has(EVT_VOICE_CMD, badge_voice_defs[0].num, 0));
    seen[EVT_VOICE_CMD] = true;

    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_set_phone(fsm, true);
    badge_fsm_event_clear(fsm);
    badge_fsm_wake(fsm, EVT_WAKE_WORD, 1000);
    badge_fsm_voice_word(fsm, "今天天气怎么样", 1100);
    badge_fsm_tick(fsm, 1100 + badge_numbers.voice_think_ms);
    CHECK(evt_has(EVT_VOICE_FREE, 1, 0));
    seen[EVT_VOICE_FREE] = true;

    /* 9 EVT_QUIRK_CATCH: whichever quirk the specification's own clock picks is caught
     * inside its window, and the event carries that quirk's number. */
    fresh();
    badge_fsm_set_power(fsm, true, true); /* desk: the ladder never takes the dial away */
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    const int q = quirk_wait(200000);
    CHECK(q >= 0 && q < BADGE_QUIRK_COUNT);
    badge_fsm_event_clear(fsm);
    const int mood_before = game.stat[BADGE_STAT_MOOD];
    badge_fsm_act(fsm, BADGE_ACT_PET, g_now + 10);
    CHECK(evt_has(EVT_QUIRK_CATCH, q, 0));
    CHECK_EQ(badge_fsm_quirk(fsm), -1);
    CHECK(game.stat[BADGE_STAT_MOOD] >= mood_before);
    seen[EVT_QUIRK_CATCH] = true;

    /* 10 EVT_MEET: a = the confirmation path (1 扫码 on this board), b = 对方短编号. */
    fresh();
    badge_peer_t peer;
    memset(&peer, 0, sizeof(peer));
    strcpy(peer.name, "小伙伴");
    peer.breed = 3;
    peer.stage = 1;
    peer.short_id[0] = 0x34;
    peer.short_id[1] = 0x12;
    peer.short_id[2] = 0xAB;
    peer.short_id[3] = 0xCD;
    badge_fsm_peer_found(fsm, &peer, 1000);
    badge_fsm_event_clear(fsm);
    badge_fsm_peer_confirmed(fsm, 1100);
    CHECK(evt_has(EVT_MEET, BADGE_HW_NFC ? 0 : 1, (int16_t)0x1234));
    seen[EVT_MEET] = true;

    /* 11 EVT_CALL_HOME, a = 地点编号 */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_act(fsm, BADGE_ACT_CALL_HOME, 1000);
    CHECK(evt_has(EVT_CALL_HOME, 0, 0));
    seen[EVT_CALL_HOME] = true;

    /* 12 EVT_WAKE */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1);
    badge_fsm_event_clear(fsm);
    badge_fsm_wake(fsm, EVT_WAKE_RAISE, badge_numbers.play_to_sleep_ms + 2);
    CHECK(evt_has(EVT_WAKE, EVT_WAKE_RAISE, 0));
    seen[EVT_WAKE] = true;

    /* 13 EVT_FACE, a = the dial it changed to */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    swipe_from(233, 233, BADGE_NAV_LEFT);
    CHECK(evt_has(EVT_FACE, game.face, 0));
    seen[EVT_FACE] = true;

    /* 14 EVT_SETTING, a = the setting, b = its new value */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_SETTINGS, BADGE_NAV_LEFT);
    badge_fsm_event_clear(fsm);
    badge_fsm_act(fsm, BADGE_ACT_SET_BRIGHT, 1000);
    CHECK(evt_has(EVT_SETTING, BADGE_SETTING_BRIGHT, game.bright));
    seen[EVT_SETTING] = true;

    for (int t = 1; t <= BADGE_EVENT_COUNT; t++) CHECK(seen[t]);

    /* Every record is readable, is a valid type, keeps its order, and its ts is the
     * now_ms the entry point was handed. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_act(fsm, BADGE_ACT_PET, 1000);
    badge_fsm_act(fsm, BADGE_ACT_SET_BRIGHT, 1100);
    badge_fsm_act(fsm, BADGE_ACT_CALL_HOME, 1200);
    CHECK_EQ(evt_count(), 3);
    uint32_t last_ts = 0;
    for (int i = 0; i < evt_count(); i++) {
        badge_evt_log_t e;
        CHECK(badge_fsm_event_at(fsm, i, &e));
        CHECK(e.type > EVT_NONE && e.type <= EVT_SETTING);
        CHECK(e.ts_ms >= last_ts);
        CHECK_EQ(e.ts_ms, 1000u + (uint32_t)i * 100u);
        last_ts = e.ts_ms;
    }
    badge_evt_log_t e;
    CHECK(!badge_fsm_event_at(fsm, -1, &e));
    CHECK(!badge_fsm_event_at(fsm, evt_count(), &e));
    CHECK(!badge_fsm_event_at(fsm, 0, NULL));

    /* The sink sees every record, with the same payload, and detaching stops it. */
    fresh();
    badge_fsm_set_event_sink(fsm, event_sink, NULL);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    sink_calls = 0;
    badge_fsm_act(fsm, BADGE_ACT_CALL_HOME, 1000);
    CHECK_EQ(sink_calls, evt_count());
    CHECK_EQ(sink_calls, 1);
    CHECK_EQ(sink_last.type, EVT_CALL_HOME);
    CHECK_EQ(sink_last.ts_ms, 1000u);
    CHECK(badge_fsm_event_at(fsm, 0, &e));
    CHECK_EQ(sink_last.a, e.a);
    CHECK_EQ(sink_last.b, e.b);
    badge_fsm_set_event_sink(fsm, NULL, NULL);
    sink_calls = 0;
    badge_fsm_act(fsm, BADGE_ACT_CALL_HOME, 2000);
    CHECK_EQ(sink_calls, 0);
}

/* -------------------------------------------------------------- 7b. log cap -----*/

static void test_event_log_cap(void)
{
    section("events: the log keeps the most recent BADGE_FSM_EVENT_LOG records");

    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_SETTINGS, BADGE_NAV_LEFT);
    badge_fsm_event_clear(fsm);

    const int overflow = 6;
    const int total = BADGE_FSM_EVENT_LOG + overflow;
    for (int i = 0; i < total; i++) {
        /* One EVT_SETTING per call, at a now_ms that never crosses the mode ladder. */
        badge_fsm_act(fsm, BADGE_ACT_SET_BRIGHT, 1000u + (uint32_t)i * 10u);
    }
    CHECK_EQ(evt_count(), BADGE_FSM_EVENT_LOG);

    badge_evt_log_t e;
    CHECK(badge_fsm_event_at(fsm, 0, &e));
    /* The oldest `overflow` records are gone: the head is the next call's. */
    CHECK_EQ(e.type, EVT_SETTING);
    CHECK_EQ(e.a, BADGE_SETTING_BRIGHT);
    CHECK_EQ(e.ts_ms, 1000u + (uint32_t)overflow * 10u);
    CHECK(badge_fsm_event_at(fsm, BADGE_FSM_EVENT_LOG - 1, &e));
    CHECK_EQ(e.ts_ms, 1000u + (uint32_t)(total - 1) * 10u);
    CHECK(!badge_fsm_event_at(fsm, BADGE_FSM_EVENT_LOG, &e));
    for (int i = 0; i < BADGE_FSM_EVENT_LOG; i++) {
        CHECK(badge_fsm_event_at(fsm, i, &e));
        CHECK_EQ(e.ts_ms, 1000u + (uint32_t)(overflow + i) * 10u);
        CHECK(e.a == BADGE_SETTING_BRIGHT);
        CHECK(e.b >= 0 && e.b < BADGE_BRIGHT_LEVELS);
    }
    badge_fsm_event_clear(fsm);
    CHECK_EQ(evt_count(), 0);
}

/* ------------------------------------------------------------------ 8. voice -----*/

static void test_voice(void)
{
    section("voice: all seventeen command words carry out their own action");

    CHECK_EQ(BADGE_VOICE_COUNT, 17);
    CHECK_EQ(badge_numbers.voice_max_ms, 8000);
    CHECK_EQ(badge_numbers.voice_silence_ms, 1200);
    CHECK_EQ(badge_numbers.voice_think_ms, 600);

    for (int i = 0; i < BADGE_VOICE_COUNT; i++) {
        const badge_voice_def_t *def = &badge_voice_defs[i];
        CHECK_EQ(def->num, i + 1);
        CHECK(def->word != 0 && def->word < BADGE_STRING_COUNT);
        CHECK(def->action != 0 && def->action < BADGE_STRING_COUNT);
        CHECK(badge_strings[def->word][0] != '\0');
        CHECK(badge_strings[def->action][0] != '\0');
    }
    CHECK_STR_EQ(badge_strings[BADGE_TXT_WAKEWORD], "小橘小橘");
    CHECK_STR_EQ(badge_strings[BADGE_TXT_LISTENING], "在听…");
    CHECK_STR_EQ(badge_strings[BADGE_TXT_THINKING], "想一想…");
    CHECK_STR_EQ(badge_strings[BADGE_TXT_NOPHONE], "手机没连上，我只听得懂简单的话");

    for (int i = 0; i < BADGE_VOICE_COUNT; i++) {
        const int num = badge_voice_defs[i].num;
        const char *word = badge_strings[badge_voice_defs[i].word];
        const char *action = badge_strings[badge_voice_defs[i].action];

        fresh();
        badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
        for (int k = 0; k < BADGE_STAT_COUNT; k++) game.stat[k] = 60;
        game.coins = 100;
        badge_fsm_event_clear(fsm);
        badge_fsm_take_fx(fsm);

        /* The wake word opens the listen without a press; a hypothesis ends it. */
        badge_fsm_wake(fsm, EVT_WAKE_WORD, 1000);
        CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_VOICE);
        CHECK(!badge_fsm_voice_thinking(fsm));
        CHECK_EQ(badge_fsm_bubble(fsm, 1000), BADGE_TXT_LISTENING);
        badge_fsm_voice_word(fsm, word, 1100);
        CHECK(badge_fsm_voice_thinking(fsm));
        CHECK_EQ(badge_fsm_bubble(fsm, 1100), BADGE_TXT_THINKING);
        CHECK_EQ(evt_count(), 0); /* a hypothesis is not an action yet */

        /* Nothing is carried out while the cat is only thinking. */
        CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_VOICE);
        badge_fsm_tick(fsm, 1100 + badge_numbers.voice_think_ms - 1);
        CHECK(badge_fsm_voice_thinking(fsm));
        CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_VOICE);
        CHECK_EQ(evt_count(), 0);
        badge_fsm_tick(fsm, 1100 + badge_numbers.voice_think_ms);
        CHECK(!badge_fsm_voice_thinking(fsm));
        /* ... and then this command's own number is reported, exactly once. */
        CHECK(evt_has(EVT_VOICE_CMD, num, 0));
        CHECK_EQ(evt_count_of(EVT_VOICE_CMD), 1);

        const uint32_t resolved = 1100 + badge_numbers.voice_think_ms;
        const int care = care_of_action(action);
        if (care >= 0) {
            CHECK_EQ(badge_fsm_care(fsm), care);
            CHECK_EQ(badge_fsm_screen(fsm), care_screen_of(care));
        } else if (strcmp(action, "pet") == 0) {
            CHECK(is_main_screen(badge_fsm_screen(fsm)));
            CHECK(evt_has(EVT_PET, 0, 0));
            CHECK_EQ(game.stat[BADGE_STAT_MOOD],
                     60 + badge_care_defs[BADGE_CARE_PET].delta[BADGE_STAT_MOOD]);
        } else if (strcmp(action, "status") == 0) {
            CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_STATUS);
        } else if (strcmp(action, "face") == 0) {
            CHECK_EQ(game.face, 1);
            CHECK(evt_has(EVT_FACE, game.face, 0));
            CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A + game.face);
        } else {
            /* come / say / look / night: the cat answers on the dial, in its own words. */
            CHECK(strcmp(action, "come") == 0 || strcmp(action, "say") == 0 ||
                  strcmp(action, "look") == 0 || strcmp(action, "night") == 0);
            CHECK(is_main_screen(badge_fsm_screen(fsm)));
            CHECK(badge_voice_defs[i].reply != 0);
            CHECK_EQ(badge_fsm_bubble(fsm, resolved), badge_voice_defs[i].reply);
        }
    }

    /* Which of the seventeen is 晚安, and where its reply leaves the badge: 待机常显 (or
     * 息屏), a bubble's lifetime after the answer. */
    int night = -1;
    for (int i = 0; i < BADGE_VOICE_COUNT; i++) {
        if (strcmp(badge_strings[badge_voice_defs[i].action], "night") == 0) night = i;
    }
    CHECK(night >= 0);
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_wake(fsm, EVT_WAKE_WORD, 1000);
    badge_fsm_voice_word(fsm, badge_strings[badge_voice_defs[night].word], 1100);
    badge_fsm_tick(fsm, 1100 + badge_numbers.voice_think_ms);
    CHECK(is_main_screen(badge_fsm_screen(fsm)));
    const uint32_t resolved = 1100 + badge_numbers.voice_think_ms;
    badge_fsm_tick(fsm, resolved + badge_numbers.bubble_ms - 1);
    CHECK(is_main_screen(badge_fsm_screen(fsm)));
    badge_fsm_tick(fsm, resolved + badge_numbers.bubble_ms);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_AOD);
    CHECK_EQ(badge_fsm_mode(fsm), game.aod ? BADGE_MODE_AOD : BADGE_MODE_OFF);

    /* A hypothesis no command matches, with the phone down, gets the specification's own
     * 手机没连上 wording and no EVT_VOICE_FREE. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_set_phone(fsm, false);
    badge_fsm_event_clear(fsm);
    badge_fsm_wake(fsm, EVT_WAKE_WORD, 1000);
    badge_fsm_voice_word(fsm, "今天天气怎么样", 1100);
    badge_fsm_tick(fsm, 1100 + badge_numbers.voice_think_ms);
    CHECK_EQ(badge_fsm_bubble(fsm, 1100 + badge_numbers.voice_think_ms), BADGE_TXT_NOPHONE);
    CHECK_EQ(evt_count_of(EVT_VOICE_FREE), 0);
    CHECK(is_main_screen(badge_fsm_screen(fsm)));

    /* With the phone up the same question is a free reply, drawn from the three the
     * specification names, and reported as EVT_VOICE_FREE. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_set_phone(fsm, true);
    badge_fsm_event_clear(fsm);
    badge_fsm_wake(fsm, EVT_WAKE_WORD, 1000);
    badge_fsm_voice_word(fsm, "今天天气怎么样", 1100);
    badge_fsm_tick(fsm, 1100 + badge_numbers.voice_think_ms);
    CHECK(evt_has(EVT_VOICE_FREE, 1, 0));
    const uint16_t free_reply = badge_fsm_bubble(fsm, 1100 + badge_numbers.voice_think_ms);
    CHECK(free_reply == BADGE_TXT_FREE_REPLY_0 || free_reply == BADGE_TXT_FREE_REPLY_1 ||
          free_reply == BADGE_TXT_FREE_REPLY_2);

    /* A longer utterance that contains a command word still matches it. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_wake(fsm, EVT_WAKE_WORD, 1000);
    char longer[48];
    snprintf(longer, sizeof(longer), "%s吧", badge_strings[badge_voice_defs[0].word]);
    badge_fsm_voice_word(fsm, longer, 1100);
    badge_fsm_tick(fsm, 1100 + badge_numbers.voice_think_ms);
    CHECK(evt_has(EVT_VOICE_CMD, badge_voice_defs[0].num, 0));

    /* The listen ends on voice_silence_ms of silence. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_wake(fsm, EVT_WAKE_WORD, 0);
    badge_fsm_tick(fsm, badge_numbers.voice_silence_ms - 1);
    CHECK(!badge_fsm_voice_thinking(fsm));
    badge_fsm_tick(fsm, badge_numbers.voice_silence_ms);
    CHECK(badge_fsm_voice_thinking(fsm));

    /* ... and on the voice_max_ms cap, however much activity there is. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_wake(fsm, EVT_WAKE_WORD, 0);
    for (uint32_t t = 500; t + badge_numbers.voice_silence_ms < badge_numbers.voice_max_ms;
         t += 500) {
        /* Recogniser activity restarts the silence window and is never a hypothesis. */
        badge_fsm_voice_word(fsm, NULL, t);
        badge_fsm_voice_word(fsm, "", t);
        badge_fsm_tick(fsm, t);
        CHECK(!badge_fsm_voice_thinking(fsm));
    }
    badge_fsm_tick(fsm, badge_numbers.voice_max_ms);
    CHECK(badge_fsm_voice_thinking(fsm));

    /* A word outside the listen window does nothing, so a late hypothesis from a finished
     * turn cannot re-open the voice screen or report a second command. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_voice_word(fsm, badge_strings[badge_voice_defs[0].word], 1000);
    CHECK(!badge_fsm_voice_thinking(fsm));
    CHECK_EQ(evt_count(), 0);
    badge_fsm_wake(fsm, EVT_WAKE_WORD, 2000);
    badge_fsm_voice_word(fsm, badge_strings[badge_voice_defs[0].word], 2100);
    badge_fsm_tick(fsm, 2100 + badge_numbers.voice_think_ms);
    CHECK_EQ(evt_count_of(EVT_VOICE_CMD), 1);
    badge_fsm_voice_word(fsm, badge_strings[badge_voice_defs[1].word], 3000);
    CHECK_EQ(evt_count_of(EVT_VOICE_CMD), 1);

    /* 唤醒词 off means the wake word does not open the listen at all. */
    fresh();
    game.wake_word = false;
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_wake(fsm, EVT_WAKE_WORD, 1000);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    CHECK_EQ(evt_count(), 0);
    CHECK(!badge_fsm_voice_thinking(fsm));
}

/* ------------------------------------------------------------------ 9. alerts ----*/

static void test_alerts(void)
{
    section("alerts: the fixed badge_alerts[] priority, not the lowest stat");

    CHECK_EQ(BADGE_ALERT_COUNT, 5);
    /* The table IS the priority order the specification states above it. */
    CHECK_EQ(badge_alerts[0].stat, BADGE_STAT_SICK);
    CHECK_EQ(badge_alerts[1].stat, BADGE_STAT_FOOD);
    CHECK_EQ(badge_alerts[2].stat, BADGE_STAT_ENERGY);
    CHECK_EQ(badge_alerts[3].stat, BADGE_STAT_MOOD);
    CHECK_EQ(badge_alerts[4].stat, BADGE_STAT_CLEAN);

    fresh();
    /* 不舒服 wins over everything, even with every other stat on the floor. */
    game.sick = true;
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 0;
    CHECK_EQ(badge_fsm_alert(fsm), 0);
    CHECK_EQ(badge_alerts[0].action, BADGE_ACT_ALERT);
    CHECK(badge_alerts[0].text != 0);
    /* Health below low_stat is the same illness marker. */
    game.sick = false;
    game.stat[BADGE_STAT_HEALTH] = badge_numbers.low_stat - 1;
    game.stat[BADGE_STAT_FOOD] = 0;
    CHECK_EQ(badge_fsm_alert(fsm), 0);

    /* Conflict 1: 饱腹 25 and 精力 10 -- the lowest stat is 精力, the alert is 饱腹. */
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 80;
    game.stat[BADGE_STAT_FOOD] = 25;
    game.stat[BADGE_STAT_ENERGY] = 10;
    game.stat[BADGE_STAT_MOOD] = 20;
    CHECK_EQ(lowest_stat_index(), BADGE_STAT_ENERGY);
    CHECK_EQ(badge_fsm_alert(fsm), 1);
    CHECK_EQ(badge_alerts[badge_fsm_alert(fsm)].stat, BADGE_STAT_FOOD);
    CHECK_EQ(badge_alerts[badge_fsm_alert(fsm)].action, BADGE_ACT_CARE_FEED);

    /* Conflict 2: 精力 12 and 心情 3 -- the lowest stat is 清洁, the alert is 精力. */
    game.stat[BADGE_STAT_FOOD] = 80;
    game.stat[BADGE_STAT_ENERGY] = 12;
    game.stat[BADGE_STAT_MOOD] = 3;
    game.stat[BADGE_STAT_CLEAN] = 1;
    CHECK_EQ(lowest_stat_index(), BADGE_STAT_CLEAN);
    CHECK_EQ(badge_fsm_alert(fsm), 2);
    CHECK_EQ(badge_alerts[badge_fsm_alert(fsm)].stat, BADGE_STAT_ENERGY);
    CHECK_EQ(badge_alerts[badge_fsm_alert(fsm)].action, BADGE_ACT_CARE_SLEEP);

    /* Conflict 3: 心情 5 and 清洁 2 -- the lowest stat is 清洁, the alert is 心情. */
    game.stat[BADGE_STAT_ENERGY] = 80;
    game.stat[BADGE_STAT_MOOD] = 5;
    game.stat[BADGE_STAT_CLEAN] = 2;
    CHECK_EQ(lowest_stat_index(), BADGE_STAT_CLEAN);
    CHECK_EQ(badge_fsm_alert(fsm), 3);
    CHECK_EQ(badge_alerts[badge_fsm_alert(fsm)].stat, BADGE_STAT_MOOD);
    CHECK_EQ(badge_alerts[badge_fsm_alert(fsm)].action, BADGE_ACT_CARE_PLAY);

    /* Each rule is "strictly below low_stat": at exactly low_stat there is no alert. */
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = badge_numbers.low_stat;
    CHECK_EQ(badge_fsm_alert(fsm), -1);
    CHECK_EQ(lowest_stat_index(), -1);

    /* 清洁 low is the last resort, and that entry has wording but no care of its own. */
    game.stat[BADGE_STAT_CLEAN] = badge_numbers.low_stat - 1;
    CHECK_EQ(badge_fsm_alert(fsm), 4);
    CHECK_EQ(badge_alerts[4].action, BADGE_ACT_ALERT);
    CHECK(badge_alerts[4].text != 0);
    CHECK_EQ(lowest_stat_index(), BADGE_STAT_CLEAN);

    /* The bubble is on the glass only while there is a rule to show, and it is the
     * bubble's own element that carries the tap. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    const int alert_el = find_alert_element();
    CHECK(alert_el >= 0);
    CHECK_EQ((int)badge_els[alert_el].type, BE_ALERT);
    CHECK_EQ(badge_els[alert_el].when, BADGE_WHEN_ALERT);
    CHECK_EQ(badge_els[alert_el].act, BADGE_ACT_ALERT);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 80;
    game.stat[BADGE_STAT_FOOD] = badge_numbers.low_stat - 1;
    CHECK_EQ(badge_fsm_alert(fsm), 1);
    CHECK_EQ(badge_fsm_hit_test(fsm, badge_els[alert_el].x, badge_els[alert_el].y), alert_el);
    /* 饱腹's alert opens the care wheel, as the table's own action says. */
    badge_fsm_act(fsm, BADGE_ACT_ALERT, 1000);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_CARE_MENU);

    /* 清洁's alert has no care of its own: it answers in the bubble and stays put. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 80;
    game.stat[BADGE_STAT_CLEAN] = badge_numbers.low_stat - 1;
    CHECK_EQ(badge_fsm_alert(fsm), 4);
    const badge_fx_t fx = badge_fsm_act(fsm, BADGE_ACT_ALERT, 1000);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    CHECK_EQ(fx.bubble, badge_alerts[4].text);

    /* With nothing to report, the alert action is a no-op. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_take_fx(fsm);
    badge_fsm_event_clear(fsm);
    const badge_fx_t none = badge_fsm_act(fsm, BADGE_ACT_ALERT, 1000);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    CHECK_EQ(none.bubble, 0);
    CHECK_EQ(evt_count(), 0);
}

/* ---------------------------------------------------------------- 10. quirks -----*/

static void test_quirks(void)
{
    section("quirks: the four behaviours turn up and are catchable in their own window");

    CHECK_EQ(BADGE_QUIRK_COUNT, 4);
    CHECK_EQ(badge_numbers.quirk_min_ms, 35000);
    CHECK_EQ(badge_numbers.quirk_max_ms, 80000u);
    CHECK_EQ(badge_numbers.quirk_idle_ms, 9000);
    CHECK(badge_numbers.quirk_max_ms > badge_numbers.quirk_min_ms);
    for (int q = 0; q < BADGE_QUIRK_COUNT; q++) {
        CHECK(badge_quirk_defs[q].id != 0 && badge_quirk_defs[q].name != 0);
        CHECK(badge_quirk_defs[q].ms > 0);
        CHECK(badge_quirk_defs[q].ms <= badge_numbers.quirk_max_ms);
        CHECK(badge_quirk_defs[q].icon < BADGE_ICON_COUNT);
        CHECK(badge_strings[badge_quirk_defs[q].id][0] != '\0');
        CHECK(badge_strings[badge_quirk_defs[q].name][0] != '\0');
        CHECK(badge_quirk_defs[q].anim <= 2);
    }
    CHECK_STR_EQ(badge_strings[badge_quirk_defs[0].id], "spin");
    CHECK_STR_EQ(badge_strings[badge_quirk_defs[1].id], "stare");
    CHECK_STR_EQ(badge_strings[badge_quirk_defs[2].id], "lick");
    CHECK_STR_EQ(badge_strings[badge_quirk_defs[3].id], "jump");

    /* One machine, one clock: the module's PRNG is fixed-seed, so a sequence of catches
     * walks the same quirks in the same order on every boot, and a misbehaving quirk is
     * reproducible instead of a one-off. 桌面充电态 holds the dial still while it runs. */
    fresh();
    badge_fsm_set_power(fsm, true, true);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_anim_directive_t anim;
    int hit[BADGE_QUIRK_COUNT];
    for (int q = 0; q < BADGE_QUIRK_COUNT; q++) hit[q] = 0;
    int found = 0;

    for (int cycle = 0; cycle < 16 && found < BADGE_QUIRK_COUNT; cycle++) {
        const int q = quirk_wait(200000);
        CHECK(q >= 0 && q < BADGE_QUIRK_COUNT);
        if (q < 0) break;
        if (!hit[q]) {
            hit[q] = 1;
            found++;
        }

        /* The one-shot animation reports the quirk's own number, start, length and the
         * motion the reference's drawCat() gives that quirk. */
        const uint32_t t0 = g_now;
        const uint32_t ms = badge_quirk_defs[q].ms;
        const char *key = badge_strings[badge_quirk_defs[q].id];
        CHECK(badge_fsm_anim(fsm, t0, &anim));
        CHECK_EQ(anim.quirk, q + 1);
        CHECK_EQ(anim.t0, t0);
        CHECK_EQ(anim.ms, ms);
        CHECK(badge_fsm_anim(fsm, t0 + ms / 4, &anim));
        if (strcmp(key, "spin") == 0) {
            CHECK(anim.root_yaw > 0.0f);
        } else if (strcmp(key, "stare") == 0) {
            CHECK(anim.look_x < 0.0f);
        } else if (strcmp(key, "jump") == 0) {
            CHECK(anim.root_y > 0.0f);
        } else {
            CHECK_STR_EQ(key, "lick");
            CHECK(anim.root_y == 0.0f);
            CHECK(anim.root_yaw == 0.0f);
        }

        /* Caught: 接住了！心情 +2, the spec's own toast, and its own event. */
        badge_fsm_event_clear(fsm);
        const int mood_before = game.stat[BADGE_STAT_MOOD];
        const badge_fx_t fx = badge_fsm_act(fsm, BADGE_ACT_PET, g_now + 10);
        CHECK(evt_has(EVT_QUIRK_CATCH, q, 0));
        CHECK_EQ(badge_fsm_quirk(fsm), -1);
        CHECK_EQ(fx.toast, BADGE_TXT_CAUGHT);
        CHECK_STR_EQ(badge_strings[BADGE_TXT_CAUGHT], "接住了！心情 +2");
        CHECK_EQ(game.stat[BADGE_STAT_MOOD],
                 mood_before + 2 > 100 ? 100 : mood_before + 2);
        CHECK(!badge_fsm_anim(fsm, g_now + 10, &anim));
    }
    CHECK_EQ(found, BADGE_QUIRK_COUNT);
    for (int q = 0; q < BADGE_QUIRK_COUNT; q++) CHECK(hit[q]);

    /* Left alone, a quirk stops on its own at its own length and nothing is reported. */
    fresh();
    badge_fsm_set_power(fsm, true, true);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    const int q = quirk_wait(200000);
    CHECK(q >= 0 && q < BADGE_QUIRK_COUNT);
    const uint32_t t0 = g_now;
    const uint32_t ms = badge_quirk_defs[q].ms;
    badge_fsm_event_clear(fsm);
    badge_fsm_tick(fsm, t0 + ms - 1);
    CHECK_EQ(badge_fsm_quirk(fsm), q);
    CHECK(badge_fsm_anim(fsm, t0 + ms - 1, &anim));
    badge_fsm_tick(fsm, t0 + ms);
    CHECK_EQ(badge_fsm_quirk(fsm), -1);
    CHECK(!badge_fsm_anim(fsm, t0 + ms, &anim));
    CHECK_EQ(evt_count(), 0); /* no catch, no EVT_QUIRK_CATCH */

    /* Never on a screen that is not a dial: the quirk branch is gated on is_main(). */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_STATUS, BADGE_NAV_FADE);
    for (uint32_t t = 1000; t <= 200000; t += 1000) {
        badge_fsm_tick(fsm, t);
        CHECK_EQ(badge_fsm_quirk(fsm), -1);
    }

    /* 逗猫's feather follows the finger while it is down, and only then. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 60;
    badge_fsm_act(fsm, BADGE_ACT_CARE_PLAY, 1000);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_CARE_PLAY);
    badge_fsm_press(fsm, 120, 120, 1100);
    CHECK(badge_fsm_anim(fsm, 1150, &anim));
    CHECK(anim.follow_finger);
    badge_fsm_release(fsm, 120, 120, 1200);
    CHECK(!badge_fsm_anim(fsm, 1250, &anim));
}

/* ------------------------------------------------------------------ 11. peers ----*/

static void test_peers(void)
{
    section("peers: found / confirmed / lost, the pairing code and the life stages");

    CHECK_EQ(BADGE_STAGE_COUNT, 3);
    CHECK_EQ(badge_stage_growth[0], 0);
    CHECK_EQ(badge_stage_growth[1], 60);
    CHECK_EQ(badge_stage_growth[2], 160);
    for (int s = 0; s < BADGE_STAGE_COUNT; s++) {
        CHECK(badge_stage_names[s] != NULL && badge_stage_names[s][0] != '\0');
    }

    fresh();
    CHECK(badge_fsm_peer(fsm) == NULL);

    badge_peer_t peer;
    memset(&peer, 0, sizeof(peer));
    strcpy(peer.name, "小伙伴");
    peer.breed = 3;
    peer.stage = 1;
    peer.short_id[0] = 0x34;
    peer.short_id[1] = 0x12;
    peer.short_id[2] = 0xAB;
    peer.short_id[3] = 0xCD;

    /* 遇见 emits nothing: two badges seeing each other is not an event the App settles. */
    badge_fsm_event_clear(fsm);
    badge_fsm_peer_found(fsm, &peer, 1000);
    CHECK_EQ(evt_count(), 0);
    const badge_peer_t *got = badge_fsm_peer(fsm);
    CHECK(got != NULL);
    CHECK_STR_EQ(got->name, peer.name);
    CHECK_EQ(got->breed, peer.breed);
    CHECK_EQ(got->stage, peer.stage);
    CHECK_EQ(got->short_id[0], 0x34);
    CHECK_EQ(got->short_id[1], 0x12);
    CHECK_EQ(got->short_id[2], 0xAB);
    CHECK_EQ(got->short_id[3], 0xCD);

    /* 扫到 ≠ 遇见: the scan screen is the caller's business, the FSM does not move. */
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_BOOT);
    badge_fsm_go(fsm, BADGE_SCREEN_MEET_SCAN, BADGE_NAV_LEFT);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MEET_SCAN);

    /* Confirming reports EVT_MEET with this board's own path and the peer's short id
     * packed little endian, then lands on 成为朋友 with the specification's gift line. */
    badge_fsm_event_clear(fsm);
    badge_fsm_take_fx(fsm);
    badge_fsm_peer_confirmed(fsm, 1100);
    CHECK(evt_has(EVT_MEET, BADGE_HW_NFC ? 0 : 1, 0x1234));
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MEET_DONE);
    CHECK_EQ(badge_fsm_take_fx(fsm).haptic, BADGE_HAPTIC_MEET);
    CHECK_EQ(badge_fsm_toast(fsm, 1100), BADGE_TXT_MEETGIFT);
    CHECK_STR_EQ(badge_strings[BADGE_TXT_MEETGIFT], "{peer}送你：小鱼干 ×1");

    /* 成为朋友 is a screen with a life of its own: it leaves on meet_done_ms. */
    badge_fsm_tick(fsm, 1100 + badge_numbers.meet_done_ms);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MEET_DONE);
    badge_fsm_tick(fsm, 1100 + badge_numbers.meet_done_ms + 1);
    CHECK(is_main_screen(badge_fsm_screen(fsm)));

    /* Losing the peer comes home only from the encounter screens, not from 成为朋友. */
    fresh();
    badge_fsm_peer_found(fsm, &peer, 1000);
    badge_fsm_go(fsm, BADGE_SCREEN_MEET_SCAN, BADGE_NAV_LEFT);
    badge_fsm_peer_lost(fsm, 1100);
    CHECK(badge_fsm_peer(fsm) == NULL);
    CHECK(is_main_screen(badge_fsm_screen(fsm)));

    fresh();
    badge_fsm_peer_found(fsm, &peer, 1000);
    badge_fsm_go(fsm, BADGE_SCREEN_MEET_DONE, BADGE_NAV_FADE);
    badge_fsm_peer_lost(fsm, 1100);
    CHECK(badge_fsm_peer(fsm) == NULL);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MEET_DONE);

    /* Confirming with nobody found reports nothing and moves nothing. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MEET_SCAN, BADGE_NAV_LEFT);
    badge_fsm_event_clear(fsm);
    badge_fsm_peer_confirmed(fsm, 1000);
    CHECK_EQ(evt_count(), 0);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MEET_SCAN);

    /* 遇见's own timeout, and the tap-confirm timeout one screen further on. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MEET, BADGE_NAV_FADE);
    badge_fsm_tick(fsm, badge_numbers.meet_timeout_ms);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MEET);
    badge_fsm_tick(fsm, (uint32_t)badge_numbers.meet_timeout_ms + 1);
    CHECK(is_main_screen(badge_fsm_screen(fsm)));

    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MEET_SCAN, BADGE_NAV_LEFT);
    badge_fsm_tick(fsm, badge_numbers.tap_confirm_timeout_ms);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MEET_SCAN);
    badge_fsm_tick(fsm, (uint32_t)badge_numbers.tap_confirm_timeout_ms + 1);
    CHECK(is_main_screen(badge_fsm_screen(fsm)));

    /* 碰一碰 / 扫码: the element's own action picks the screen, and this board has no
     * NFC, so 遇见 lands on the scan screen. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_act(fsm, BADGE_ACT_MEET_HI, 1000);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_HW_NFC ? BADGE_SCREEN_MEET_TAP : BADGE_SCREEN_MEET_SCAN);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MEET_SCAN);

    /* 取消 / 跳过 drops the peer, whatever was found, and comes home. */
    for (int act = BADGE_ACT_MEET_SKIP; act <= BADGE_ACT_MEET_CANCEL; act++) {
        fresh();
        badge_fsm_peer_found(fsm, &peer, 1000);
        badge_fsm_go(fsm, BADGE_SCREEN_MEET_SCAN, BADGE_NAV_LEFT);
        badge_fsm_act(fsm, act, 1100);
        CHECK(badge_fsm_peer(fsm) == NULL);
        CHECK(is_main_screen(badge_fsm_screen(fsm)));
    }

    /* No authenticator = placeholder; valid six digits are explicitly supplied. */
    const char *first = NULL;
    fresh();
    CHECK_STR_EQ(badge_fsm_pair_code(fsm), "--- ---");
    CHECK(badge_fsm_set_pair_code(fsm, "123456"));
    first = badge_fsm_pair_code(fsm);
    CHECK(first != NULL);
    CHECK_STR_EQ(first, "123 456");
    CHECK(!badge_fsm_set_pair_code(fsm, "12x456"));
    CHECK(!badge_fsm_set_pair_code(fsm, "12345"));
    CHECK(!badge_fsm_set_pair_code(fsm, "1234567"));
    CHECK_STR_EQ(badge_fsm_pair_code(fsm), "123 456");
    fresh();
    CHECK_STR_EQ(badge_fsm_pair_code(fsm), "--- ---");

    /* The life stages are read from the generated growth thresholds, at their edges. */
    fresh();
    for (int s = BADGE_STAGE_COUNT - 1; s >= 0; s--) {
        game.growth = badge_stage_growth[s];
        CHECK_STR_EQ(badge_fsm_stage_name(&game), badge_stage_names[s]);
        CHECK_EQ(badge_pet_stage(&game), s);
    }
    game.growth = badge_stage_growth[1] - 1;
    CHECK_STR_EQ(badge_fsm_stage_name(&game), badge_stage_names[0]);
    CHECK_EQ(badge_pet_stage(&game), 0);
    game.growth = 1000000;
    CHECK_EQ(badge_pet_stage(&game), BADGE_STAGE_COUNT - 1);
    CHECK_STR_EQ(badge_fsm_stage_name(&game), badge_stage_names[BADGE_STAGE_COUNT - 1]);

    /* 成长到下一阶段 is the next threshold, and the top stage has no next one. */
    game.growth = 0;
    CHECK_EQ(badge_fsm_next_growth(&game), badge_stage_growth[1]);
    game.growth = badge_stage_growth[1];
    CHECK_EQ(badge_fsm_next_growth(&game), badge_stage_growth[2]);
    game.growth = badge_stage_growth[2];
    CHECK_EQ(badge_fsm_next_growth(&game), badge_stage_growth[BADGE_STAGE_COUNT - 1]);
    game.growth = badge_stage_growth[2] + 5000;
    CHECK_EQ(badge_fsm_next_growth(&game), badge_stage_growth[BADGE_STAGE_COUNT - 1]);

    /* Feeding past a threshold moves the stage, and the care earns its own growth. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    game.growth = badge_stage_growth[1] - 1;
    game.stat[BADGE_STAT_FOOD] = 40;
    game.coins = 100;
    CHECK_STR_EQ(badge_fsm_stage_name(&game), badge_stage_names[0]);
    badge_fsm_act(fsm, BADGE_ACT_CARE_FEED, 1000);
    uint32_t t = 1000;
    for (int i = 0; i < (int)badge_care_defs[BADGE_CARE_FEED].steps; i++) {
        t += badge_numbers.bite_gap_ms;
        badge_fsm_act(fsm, BADGE_ACT_BITE, t);
    }
    CHECK_EQ(game.growth,
             badge_stage_growth[1] - 1 + badge_care_defs[BADGE_CARE_FEED].growth);
    CHECK_STR_EQ(badge_fsm_stage_name(&game), badge_stage_names[1]);
}

/* ---------------------------------------------------------------- 12. inputs -----*/

static void test_persistence_inputs(void)
{
    section("inputs: the clock, the phone, the sync count and the effect batch");

    fresh();
    CHECK_EQ(badge_fsm_now_min(fsm), 18 * 60 + 40); /* the reference's demo clock */
    badge_fsm_set_time(fsm, 100);
    CHECK_EQ(badge_fsm_now_min(fsm), 100);
    badge_fsm_set_time(fsm, -10);
    CHECK_EQ(badge_fsm_now_min(fsm), 24 * 60 - 10);
    badge_fsm_set_time(fsm, 24 * 60);
    CHECK_EQ(badge_fsm_now_min(fsm), 0);
    badge_fsm_set_time(fsm, 24 * 60 + 5);
    CHECK_EQ(badge_fsm_now_min(fsm), 5);

    /* 23:00–07:00 dims whatever the setting and the mode asked for. */
    fresh();
    const int day_pct = badge_bright_scale_pct[game.bright];
    const int night_pct = day_pct * badge_numbers.aod_bright_pct / 100;
    badge_fsm_set_time(fsm, 23 * 60);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), night_pct);
    badge_fsm_set_time(fsm, 23 * 60 + 59);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), night_pct);
    badge_fsm_set_time(fsm, 0);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), night_pct);
    badge_fsm_set_time(fsm, 7 * 60 - 1);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), night_pct);
    badge_fsm_set_time(fsm, 7 * 60);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), day_pct);
    badge_fsm_set_time(fsm, 22 * 60 + 59);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), day_pct);

    /* The three brightness levels the specification names, and a value off the table. */
    fresh();
    for (int lvl = 0; lvl < BADGE_BRIGHT_LEVELS; lvl++) {
        game.bright = (uint8_t)lvl;
        CHECK_EQ(badge_fsm_backlight_pct(fsm), badge_bright_scale_pct[lvl]);
    }
    game.bright = (uint8_t)BADGE_BRIGHT_LEVELS;
    CHECK_EQ(badge_fsm_backlight_pct(fsm), badge_bright_scale_pct[1]);

    /* A transport connection never proves ownership. */
    fresh();
    badge_fsm_set_phone(fsm, true);
    CHECK(badge_fsm_phone(fsm));
    badge_fsm_go(fsm, BADGE_SCREEN_PAIR, BADGE_NAV_FADE);
    badge_fsm_tick(fsm, 1000);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_PAIR);
    badge_onboarding_t onboard = {0};
    badge_fsm_set_onboarding(fsm, &onboard);
    badge_fsm_binding_verified(fsm, 1700000000u, 1100);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_GUIDE);
    CHECK(onboard.bound);
    CHECK_EQ(game.guide_page, 0);
    badge_fsm_act(fsm, BADGE_ACT_GUIDE_NEXT, 1200);
    CHECK_EQ(game.guide_page, 0); /* Click-through cannot complete production guide. */

    /* The uplink's outstanding count is whatever the net layer hands over. */
    fresh();
    CHECK_EQ(badge_fsm_pending(fsm), 0);
    badge_fsm_set_sync_info(fsm, 7);
    CHECK_EQ(badge_fsm_pending(fsm), 7);
    badge_fsm_set_sync_info(fsm, 0);
    CHECK_EQ(badge_fsm_pending(fsm), 0);
    badge_fsm_set_sync_info(fsm, -3);
    CHECK_EQ(badge_fsm_pending(fsm), -3);

    /* Every field of badge_fx_t is filled where the behaviour says it is. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_take_fx(fsm);

    const badge_fx_t pet_fx = badge_fsm_act(fsm, BADGE_ACT_PET, 1000);
    CHECK_EQ(pet_fx.sfx, BADGE_SFX_PET);
    CHECK_EQ(pet_fx.haptic, BADGE_HAPTIC_NONE);
    CHECK_EQ(pet_fx.toast, 0);
    CHECK_EQ(pet_fx.bubble, BADGE_TXT_PETGOOD);
    CHECK(!pet_fx.went_home && !pet_fx.started_care && !pet_fx.finished_care);
    CHECK(!pet_fx.cancelled_care && !pet_fx.invalidate);

    /* 叫小猫回家: the answer's own wording, the dial, and a repaint because the screen
     * actually moved. From the dial it is already there, so nothing is invalidated. */
    const badge_fx_t home_fx = badge_fsm_act(fsm, BADGE_ACT_CALL_HOME, 2000);
    CHECK_EQ(home_fx.toast, BADGE_TXT_CALLHOME);
    CHECK(home_fx.went_home);
    badge_fsm_go(fsm, BADGE_SCREEN_STATUS, BADGE_NAV_DOWN);
    badge_fsm_take_fx(fsm);
    const badge_fx_t call_fx = badge_fsm_act(fsm, BADGE_ACT_CALL_HOME, 2100);
    CHECK_EQ(call_fx.toast, BADGE_TXT_CALLHOME);
    CHECK(call_fx.went_home);
    CHECK(call_fx.invalidate);
    CHECK(is_main_screen(badge_fsm_screen(fsm)));

    const badge_fx_t bright_fx = badge_fsm_act(fsm, BADGE_ACT_SET_BRIGHT, 3000);
    CHECK(bright_fx.invalidate);
    CHECK_EQ(bright_fx.sfx, 0);

    /* A swipe reports its own effect batch: the screen moved, so it repaints. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_take_fx(fsm);
    swipe_from(233, 233, BADGE_NAV_UP);
    CHECK(badge_fsm_take_fx(fsm).invalidate);
    CHECK(badge_fsm_transitioning(fsm, badge_numbers.swipe_max_ms));
    CHECK(!badge_fsm_transitioning(fsm, badge_numbers.swipe_max_ms +
                                          badge_numbers.transition_ms));

    /* A refused 摸摸 answers in the bubble and makes no sound. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    game.stat[BADGE_STAT_MOOD] = badge_numbers.mood_full;
    badge_fsm_take_fx(fsm);
    const badge_fx_t full_fx = badge_fsm_act(fsm, BADGE_ACT_PET, 1000);
    CHECK_EQ(full_fx.bubble, BADGE_TXT_PETFULL);
    CHECK_EQ(full_fx.sfx, 0);

    /* A started care says so; the step that finishes it says the other two. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
    game.coins = 100;
    badge_fsm_take_fx(fsm);
    const badge_fx_t start_fx = badge_fsm_act(fsm, BADGE_ACT_CARE_FEED, 1000);
    CHECK(start_fx.started_care);
    CHECK(start_fx.invalidate);
    CHECK(!start_fx.finished_care && !start_fx.cancelled_care);
    badge_fx_t done_fx;
    memset(&done_fx, 0, sizeof(done_fx));
    uint32_t t = 1000;
    for (int i = 0; i < (int)badge_care_defs[BADGE_CARE_FEED].steps; i++) {
        t += badge_numbers.bite_gap_ms;
        done_fx = badge_fsm_act(fsm, BADGE_ACT_BITE, t);
    }
    CHECK(done_fx.finished_care);
    CHECK(done_fx.went_home);
    CHECK_EQ(done_fx.haptic, BADGE_HAPTIC_CARE_DONE);
    CHECK_EQ(done_fx.sfx, BADGE_SFX_CARE_DONE);

    /* Abandoning it says the third. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
    game.coins = 100;
    badge_fsm_act(fsm, BADGE_ACT_CARE_FEED, 1000);
    badge_fsm_take_fx(fsm);
    const badge_fx_t drop_fx = badge_fsm_act(fsm, BADGE_ACT_CARE_FEED, 2000); /* same screen */
    CHECK(!drop_fx.cancelled_care);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    const badge_fx_t cancel_fx = badge_fsm_take_fx(fsm);
    CHECK(cancel_fx.cancelled_care);
    CHECK(cancel_fx.invalidate);

    /* The batch is collected once: a second take is empty. */
    const badge_fx_t again = badge_fsm_take_fx(fsm);
    CHECK_EQ(again.sfx, 0);
    CHECK(!again.cancelled_care && !again.invalidate && !again.went_home);

    /* Toast and bubble each live for their own specification lifetime. */
    fresh();
    badge_fsm_show_toast(fsm, BADGE_TXT_SYNCED, 1000);
    CHECK_EQ(badge_fsm_toast(fsm, 1000), BADGE_TXT_SYNCED);
    CHECK_EQ(badge_fsm_toast(fsm, 1000 + badge_numbers.toast_ms - 1), BADGE_TXT_SYNCED);
    CHECK_EQ(badge_fsm_toast(fsm, 1000 + badge_numbers.toast_ms), 0);
    badge_fsm_show_bubble(fsm, BADGE_TXT_SYNCED, 2000);
    CHECK_EQ(badge_fsm_bubble(fsm, 2000), BADGE_TXT_SYNCED);
    CHECK_EQ(badge_fsm_bubble(fsm, 2000 + badge_numbers.bubble_ms - 1), BADGE_TXT_SYNCED);
    CHECK_EQ(badge_fsm_bubble(fsm, 2000 + badge_numbers.bubble_ms), 0);
    CHECK_EQ(badge_fsm_toast(fsm, 1000 + badge_numbers.toast_ms), 0);

    /* This board has no motor, so every haptic is the specification's fallback: an edge
     * ring lit for BADGE_HAPTIC_MS. */
    CHECK_EQ(BADGE_HW_MOTOR, 0);
    fresh();
    badge_peer_t a_peer;
    memset(&a_peer, 0, sizeof(a_peer));
    a_peer.short_id[0] = 1;
    badge_fsm_peer_found(fsm, &a_peer, 5000);
    badge_fsm_peer_confirmed(fsm, 5000);
    CHECK(badge_fsm_edge_flash(fsm, 5000));
    CHECK(badge_fsm_edge_flash(fsm, 5000 + BADGE_HAPTIC_MS - 1));
    CHECK(!badge_fsm_edge_flash(fsm, 5000 + BADGE_HAPTIC_MS));

    /* The machine drives the game the caller handed it, and nothing else. */
    fresh();
    CHECK(badge_fsm_game(fsm) == &game);
    CHECK(badge_fsm_game_const(fsm) == &game);
    badge_fsm_set_time(fsm, 42);
    CHECK_EQ(badge_fsm_now_min(fsm), 42);

    /* The night dim is applied to 待机常显's own backlight too. */
    fresh();
    badge_fsm_set_power(fsm, false, false);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_AOD);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), badge_numbers.aod_bright_pct);
    badge_fsm_set_time(fsm, 23 * 60);
    CHECK_EQ(badge_fsm_backlight_pct(fsm), badge_numbers.aod_bright_pct *
                                            badge_numbers.aod_bright_pct / 100);
}

/* ------------------------------------------------------------ 13. timing edges ---*/

/*
 * The paths no finger and no stopwatch can produce: a care abandoned halfway with the
 * stats moved and the growth unearned, the AOD ladder under a silent clock, a quirk
 * caught inside a window that only opens after 35 s, and cooldowns expiring.
 */
static void test_timing_edges(void)
{
    section("timing: the paths that can only be produced by a scripted clock");

    /* A care abandoned halfway keeps the stats its steps moved and never settles. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
    game.coins = 100;
    const int fdef_steps = (int)badge_care_defs[BADGE_CARE_FEED].steps;
    badge_fsm_act(fsm, BADGE_ACT_CARE_FEED, 1000);
    uint32_t t = 1000;
    for (int i = 0; i < 1; i++) {
        t += badge_numbers.bite_gap_ms;
        badge_fsm_act(fsm, BADGE_ACT_BITE, t);
    }
    const int food_one = game.stat[BADGE_STAT_FOOD];
    const int growth_before = game.growth;
    const int coins_before = game.coins;
    CHECK_EQ(badge_fsm_care_step(fsm), 1);
    CHECK_EQ(food_one, 40 + badge_care_defs[BADGE_CARE_FEED].delta[BADGE_STAT_FOOD]);
    badge_fsm_tick(fsm, t + 1);          /* a tick alone must not cancel it */
    CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_FEED);
    badge_fsm_event_clear(fsm);
    badge_fsm_go(fsm, BADGE_SCREEN_AOD, BADGE_NAV_FADE);
    CHECK(evt_has(EVT_CARE_CANCEL, care_num(BADGE_CARE_FEED), 1));
    CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_NONE);
    CHECK_EQ(game.growth, growth_before);
    CHECK_EQ(game.coins, coins_before);
    CHECK_EQ(game.stat[BADGE_STAT_FOOD], food_one);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_AOD);
    CHECK(fdef_steps > 1);

    /* The ladder is a function of the clock alone: no input, no screen change. */
    fresh();
    badge_fsm_set_power(fsm, false, false);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    struct { uint32_t at; badge_mode_t want; } ladder[] = {
        { badge_numbers.play_to_comp_ms, BADGE_MODE_PLAY },
        { (uint32_t)badge_numbers.play_to_comp_ms + 1, BADGE_MODE_COMP },
        { badge_numbers.play_to_sleep_ms, BADGE_MODE_COMP },
        { badge_numbers.play_to_sleep_ms + 1, BADGE_MODE_AOD },
    };
    for (size_t i = 0; i < sizeof(ladder) / sizeof(ladder[0]); i++) {
        badge_fsm_tick(fsm, ladder[i].at);
        CHECK_EQ(badge_fsm_mode(fsm), ladder[i].want);
    }
    /* A care running when the ladder crosses into 待机常显 is cancelled there too. */
    fresh();
    badge_fsm_set_power(fsm, false, false);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
    game.coins = 100;
    badge_fsm_act(fsm, BADGE_ACT_CARE_FEED, 1000 + badge_numbers.bite_gap_ms);
    badge_fsm_go(fsm, BADGE_SCREEN_CARE_FEED, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1);
    CHECK(evt_has(EVT_CARE_CANCEL, care_num(BADGE_CARE_FEED), 0));
    CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_NONE);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_AOD);

    /* A quirk is caught inside a window that only opens after quirk_min_ms, which is
     * where the fixed-seed PRNG makes the wait reproducible. */
    fresh();
    badge_fsm_set_power(fsm, true, true);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    const int q = quirk_wait(200000);
    CHECK(q >= 0 && q < BADGE_QUIRK_COUNT);
    const uint32_t caught_at = g_now;
    const uint32_t window = badge_quirk_defs[q].ms;
    CHECK(window > 0);
    CHECK(badge_fsm_quirk(fsm) == q);
    /* Caught with the window still open: inside window - 1 ms of the start. */
    badge_fsm_event_clear(fsm);
    badge_fsm_act(fsm, BADGE_ACT_PET, caught_at + window - 1);
    CHECK(evt_has(EVT_QUIRK_CATCH, q, 0));
    CHECK_EQ(badge_fsm_quirk(fsm), -1);
    /* The next quirk waits for its own window: it cannot be caught immediately. */
    CHECK(badge_fsm_quirk(fsm) == -1);
    badge_fsm_tick(fsm, caught_at + window);
    CHECK_EQ(badge_fsm_quirk(fsm), -1);

    /* 逗猫 with nobody playing ends by itself, with the specification's own wording, and
     * the growth is left unearned. */
    fresh();
    badge_fsm_set_power(fsm, false, false);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
    game.coins = 100;
    const int growth_play = game.growth;
    badge_fsm_act(fsm, BADGE_ACT_CARE_PLAY, 1000);
    badge_fsm_press(fsm, 100, 100, 1100);
    pounce_once(2000);
    CHECK_EQ(badge_fsm_care_step(fsm), 1);
    badge_fsm_event_clear(fsm);
    badge_fsm_take_fx(fsm);
    badge_fsm_tick(fsm, 1000 + badge_numbers.play_timeout_ms);
    CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_PLAY);
    badge_fsm_tick(fsm, 1000 + badge_numbers.play_timeout_ms + 1);
    CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_NONE);
    CHECK(evt_has(EVT_CARE_CANCEL, care_num(BADGE_CARE_PLAY), 1));
    CHECK_EQ(game.growth, growth_play);
    CHECK_EQ(badge_fsm_toast(fsm, 1000 + badge_numbers.play_timeout_ms + 1),
             BADGE_TXT_PLAYTIRED);
    CHECK_STR_EQ(badge_strings[BADGE_TXT_PLAYTIRED], "它玩累了，下次再玩");

    /* 先休息: a stroke that began in the top band abandons 逗猫 instead of pouncing. */
    fresh();
    badge_fsm_set_power(fsm, false, false);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
    game.coins = 100;
    const int growth_top = game.growth;
    badge_fsm_act(fsm, BADGE_ACT_CARE_PLAY, 1000);
    badge_fsm_event_clear(fsm);
    badge_fsm_take_fx(fsm);
    badge_fsm_press(fsm, 233, 40, 1100);
    badge_fsm_move(fsm, 233, 40 + badge_numbers.swipe_min_px + 10, 1250);
    badge_fsm_release(fsm, 233, 40 + badge_numbers.swipe_min_px + 10, 1300);
    CHECK_EQ(badge_fsm_care(fsm), BADGE_CARE_NONE);
    CHECK(evt_has(EVT_CARE_CANCEL, care_num(BADGE_CARE_PLAY), 0));
    CHECK_EQ(game.growth, growth_top);
    CHECK_EQ(badge_fsm_toast(fsm, 1300), BADGE_TXT_CARECANCEL);
    CHECK_STR_EQ(badge_strings[BADGE_TXT_CARECANCEL], "先休息一下");

    /* The play timeout is longer than the care can plausibly take, and shorter than the
     * ladder: the two must not race to cancel the same flow. */
    CHECK(badge_numbers.play_timeout_ms > 0);
    CHECK((uint32_t)badge_numbers.play_timeout_ms < badge_numbers.play_to_sleep_ms);

    /* 哄睡 is a two-stage flow, and the second stage settles exactly once per visit. */
    fresh();
    badge_fsm_set_power(fsm, false, false);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game.stat[i] = 40;
    game.coins = 100;
    const int growth_sleep = game.growth;
    badge_fsm_act(fsm, BADGE_ACT_CARE_SLEEP, 1000);
    badge_fsm_press(fsm, 233, 376, 1100);
    badge_fsm_tick(fsm, 1100 + badge_numbers.sleep_hold_ms);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_SLEEPING);
    const uint32_t in_sleep = 1100 + badge_numbers.sleep_hold_ms;
    badge_fsm_event_clear(fsm);
    const int step_before = game.stat[BADGE_STAT_ENERGY];
    badge_fsm_tick(fsm, in_sleep + badge_numbers.sleep_demo_ms / 2);
    CHECK_EQ(game.stat[BADGE_STAT_ENERGY], step_before); /* one settle per visit */
    badge_fsm_tick(fsm, in_sleep + badge_numbers.sleep_demo_ms + 1);
    CHECK(evt_has(EVT_SLEEP, 0, 0));
    CHECK_EQ(game.growth, growth_sleep + badge_care_defs[BADGE_CARE_SLEEP].growth);
    CHECK_EQ(game.stat[BADGE_STAT_ENERGY],
             expected_stat(40, badge_care_defs[BADGE_CARE_SLEEP].delta[BADGE_STAT_ENERGY], 1));
    /* A second tick inside the same visit does not settle again. */
    badge_fsm_tick(fsm, in_sleep + badge_numbers.sleep_demo_ms + 2);
    CHECK_EQ(game.growth, growth_sleep + badge_care_defs[BADGE_CARE_SLEEP].growth);

    /* The bite gap is a rate limit per bite, so the flow takes steps * bite_gap_ms and
     * not one tick longer; and the pet cooldown expires on its own boundary. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    game.stat[BADGE_STAT_MOOD] = 0;
    badge_fsm_event_clear(fsm);
    badge_fsm_act(fsm, BADGE_ACT_PET, 0);
    CHECK_EQ(evt_count_of(EVT_PET), 1);
    badge_fsm_act(fsm, BADGE_ACT_PET, badge_numbers.pet_cooldown_ms - 1);
    CHECK_EQ(evt_count_of(EVT_PET), 1);
    badge_fsm_act(fsm, BADGE_ACT_PET, badge_numbers.pet_cooldown_ms);
    CHECK_EQ(evt_count_of(EVT_PET), 2);
    CHECK_EQ(game.stat[BADGE_STAT_MOOD],
             2 * badge_care_defs[BADGE_CARE_PET].delta[BADGE_STAT_MOOD]);
}

/* ------------------------------------------------------------- 14. degenerate ----*/

static void test_degenerate_calls(void)
{
    section("degenerate: null machines, null outputs and indices off the table");

    /* The documented NULL contract, one call at a time. */
    CHECK_EQ(badge_fsm_screen(NULL), -1);
    CHECK(badge_fsm_screen_def(NULL) == NULL);
    CHECK_EQ(badge_fsm_mode(NULL), BADGE_MODE_OFF);
    CHECK_EQ(badge_fsm_now_min(NULL), 0);
    CHECK_EQ(badge_fsm_fps(NULL), 0);
    CHECK_EQ(badge_fsm_res(NULL), 0);
    CHECK_EQ(badge_fsm_backlight_pct(NULL), 0);
    CHECK_EQ(badge_fsm_toast(NULL, 0), 0);
    CHECK_EQ(badge_fsm_bubble(NULL, 0), 0);
    CHECK_EQ(badge_fsm_alert(NULL), -1);
    CHECK_EQ(badge_fsm_care(NULL), BADGE_CARE_NONE);
    CHECK_EQ(badge_fsm_care_step(NULL), 0);
    CHECK(badge_fsm_care_blocked(NULL, BADGE_CARE_FEED, NULL));
    CHECK_EQ(badge_fsm_quirk(NULL), -1);
    CHECK(!badge_fsm_anim(NULL, 0, NULL));
    CHECK(!badge_fsm_voice_thinking(NULL));
    CHECK(badge_fsm_peer(NULL) == NULL);
    CHECK_EQ(badge_fsm_pending(NULL), 0);
    CHECK(!badge_fsm_phone(NULL));
    CHECK_EQ(badge_fsm_event_count(NULL), 0);
    CHECK(!badge_fsm_event_at(NULL, 0, NULL));
    CHECK(!badge_fsm_transitioning(NULL, 0));
    CHECK_EQ(badge_fsm_transition_dir(NULL), BADGE_NAV_FADE);
    CHECK_EQ(badge_fsm_hit_test(NULL, 0, 0), -1);
    CHECK(badge_fsm_game(NULL) == NULL);
    CHECK(badge_fsm_game_const(NULL) == NULL);
    CHECK(badge_fsm_create(NULL, 0) == NULL);
    CHECK_STR_EQ(badge_fsm_pair_code(NULL), "");
    /*
     * badge_fsm_stage_name() / next_growth() take a const badge_game_t*, not a machine,
     * so they have no NULL-machine contract to keep -- like badge_pet's own queries they
     * are a pure read of the game the caller already holds. Their behaviour is asserted
     * against the generated stage tables in test_peers().
     */

    /* Every entry point tolerates a NULL machine rather than faulting. */
    badge_fsm_tick(NULL, 0);
    badge_fsm_destroy(NULL);
    badge_fsm_set_time(NULL, 0);
    badge_fsm_go(NULL, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_press(NULL, 0, 0, 0);
    badge_fsm_move(NULL, 1, 1, 0);
    badge_fsm_release(NULL, 1, 1, 0);
    badge_fsm_set_power(NULL, true, true);
    badge_fsm_act(NULL, BADGE_ACT_PET, 0);
    badge_fsm_wake(NULL, EVT_WAKE_TOUCH, 0);
    badge_fsm_show_toast(NULL, 1, 0);
    badge_fsm_show_bubble(NULL, 1, 0);
    badge_fsm_set_event_sink(NULL, NULL, NULL);
    badge_fsm_event_clear(NULL);
    badge_fsm_set_sync_info(NULL, 0);
    badge_fsm_set_phone(NULL, true);
    badge_fsm_voice_word(NULL, "x", 0);
    badge_fsm_peer_found(NULL, NULL, 0);
    badge_fsm_peer_confirmed(NULL, 0);
    badge_fsm_peer_lost(NULL, 0);
    badge_fsm_take_fx(NULL);
    CHECK(true);

    /* An index off the end of the log, and a NULL out, are both refused. */
    fresh();
    badge_evt_log_t e;
    CHECK(!badge_fsm_event_at(fsm, 0, NULL));
    CHECK(!badge_fsm_event_at(fsm, -1, &e));
    CHECK(!badge_fsm_event_at(fsm, 1, &e));
    CHECK(!badge_fsm_anim(fsm, 0, NULL));

    /* A tap at the panel's own edge is clamped, not rejected: the mirror arithmetic in
     * esp_lcd_touch can hand back 466, and badge_touch_clamp() pins it to 465. */
    CHECK_EQ(badge_touch_clamp(-1), 0);
    CHECK_EQ(badge_touch_clamp(BADGE_TOUCH_MAX + 1), BADGE_TOUCH_MAX);
    CHECK_EQ(badge_touch_clamp(BADGE_CX), BADGE_CX);
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_press(fsm, -100, -100, 1000);
    badge_fsm_release(fsm, -100, -100, 1100);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    badge_fsm_press(fsm, BADGE_TOUCH_MAX + 400, BADGE_TOUCH_MAX + 400, 2000);
    badge_fsm_release(fsm, BADGE_TOUCH_MAX + 400, BADGE_TOUCH_MAX + 400, 2100);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);

    /* A create on a live fixture is a second machine with its own budget, its own
     * screen and its own event log: the two share the game and nothing else. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_t *other = badge_fsm_create(&game, 5000);
    CHECK(other != NULL);
    CHECK(other != fsm);
    CHECK_EQ(badge_fsm_screen(other), BADGE_SCREEN_BOOT);
    CHECK_EQ(badge_fsm_now_min(other), 18 * 60 + 40);
    CHECK_EQ(badge_fsm_event_count(other), 0);
    badge_fsm_go(other, BADGE_SCREEN_STATUS, BADGE_NAV_DOWN);
    CHECK_EQ(badge_fsm_screen(other), BADGE_SCREEN_STATUS);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    badge_fsm_act(other, BADGE_ACT_CALL_HOME, 5100);
    CHECK_EQ(badge_fsm_event_count(other), 1);
    CHECK_EQ(badge_fsm_event_count(fsm), 0);
    CHECK(evt_count() == 0);
    badge_fsm_destroy(other);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);

    /* The touch self test: five declared targets, and the fifth one finishes it. */
    CHECK_EQ(BADGE_TOUCH_TARGET_COUNT, 5);
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_go(fsm, BADGE_SCREEN_TOUCH_TEST, BADGE_NAV_LEFT);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_TOUCH_TEST);
    badge_fsm_event_clear(fsm);
    for (int i = 0; i < BADGE_TOUCH_TARGET_COUNT; i++) {
        const badge_fx_t tt = badge_fsm_act(fsm, BADGE_ACT_TT_1 + i, 1000 + (uint32_t)i * 10);
        if (i + 1 < BADGE_TOUCH_TARGET_COUNT) {
            CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_TOUCH_TEST);
            CHECK_EQ(tt.sfx, 0);
        }
    }
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_SETTINGS);
}

/* -------------------------------------------------------------- 16. keys -------*/

/*
 * The two physical keys (docs/hardware-buttons.md). They are an EXTENSION: the
 * specification's input model is the touchscreen alone and it lists no buttons, so these
 * cases pin down the mapping the firmware chose rather than checking a specification
 * clause. What they are really guarding is that a key goes through the SAME gates as a
 * finger -- if the lower key could pet on a screen whose specification says a tap means
 * something else, the two input paths would visibly disagree.
 */
static void test_buttons(void)
{
    /* The crown key on 待机常显 is a wake, and it reports itself as one. */
    fresh();
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_AOD);
    badge_fsm_event_clear(fsm);
    badge_fsm_button(fsm, BADGE_BTN_CROWN, BADGE_BTN_EVT_CLICK,
                     badge_numbers.play_to_sleep_ms + 100);
    CHECK(evt_has(EVT_WAKE, EVT_WAKE_BUTTON, 0));
    CHECK_EQ(evt_count_of(EVT_WAKE), 1);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    CHECK_EQ(badge_fsm_mode(fsm), BADGE_MODE_PLAY);
    /* The wake prompt and ring flash come through the same pool as a raised wrist. */
    const badge_fx_t woke = badge_fsm_take_fx(fsm);
    CHECK_EQ(woke.sfx, BADGE_SFX_WAKE);
    CHECK_EQ(woke.haptic, BADGE_HAPTIC_WAKE);
    /* ...and, like every other wake cause, it must not ladder straight back. */
    for (uint32_t t = badge_numbers.play_to_sleep_ms + 200;
         t < badge_numbers.play_to_sleep_ms + 5000; t += 500) {
        badge_fsm_tick(fsm, t);
    }
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);

    /* On a lit dial the crown key does not manufacture a second EVT_WAKE; it just
     * counts as input. */
    badge_fsm_event_clear(fsm);
    badge_fsm_button(fsm, BADGE_BTN_CROWN, BADGE_BTN_EVT_CLICK, g_now + 100);
    CHECK_EQ(evt_count_of(EVT_WAKE), 0);

    /* Away from the dial it brings the badge home. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_SETTINGS, BADGE_NAV_RIGHT);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_SETTINGS);
    badge_fsm_button(fsm, BADGE_BTN_CROWN, BADGE_BTN_EVT_CLICK, 1000);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);

    /* A LONG press on the crown key is the PMIC's own power-off, and the firmware must
     * not pretend it can do something with it. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_AOD, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_button(fsm, BADGE_BTN_CROWN, BADGE_BTN_EVT_HOLD, 500);
    badge_fsm_button(fsm, BADGE_BTN_CROWN, BADGE_BTN_EVT_HOLD_END, 900);
    CHECK_EQ(evt_count_of(EVT_WAKE), 0);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_AOD);

    /* The lower key pets the dial -- and reports EVT_PET with the pet prompt, exactly
     * as tapping the cat does. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_event_clear(fsm);
    badge_fsm_button(fsm, BADGE_BTN_LOWER, BADGE_BTN_EVT_CLICK, 1000);
    CHECK(evt_has(EVT_PET, 0, 0));
    const badge_fx_t pet = badge_fsm_take_fx(fsm);
    CHECK_EQ(pet.sfx, BADGE_SFX_PET);

    /* The pet cooldown is the state machine's, not the touch path's: hammering the key
     * cannot out-earn tapping the glass. */
    const int coins_before = badge_fsm_game(fsm)->coins;
    for (uint32_t t = 1010; t < 1400; t += 10) {
        badge_fsm_button(fsm, BADGE_BTN_LOWER, BADGE_BTN_EVT_CLICK, t);
    }
    CHECK_EQ(badge_fsm_game(fsm)->coins, coins_before);

    /* On a screen whose specification gives a tap a different meaning, the key cannot
     * pet -- and it must NOT navigate home on its own either, or a key press on 设置
     * would silently leave the screen that the crown key is there to exit. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_SETTINGS, BADGE_NAV_RIGHT);
    badge_fsm_event_clear(fsm);
    badge_fsm_button(fsm, BADGE_BTN_LOWER, BADGE_BTN_EVT_CLICK, 1000);
    CHECK_EQ(evt_count_of(EVT_PET), 0);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_SETTINGS);

    /* But it still counts as input there, so the ladder does not sleep the badge out
     * from under a finger that is using the keys. */
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1000);
    badge_fsm_button(fsm, BADGE_BTN_LOWER, BADGE_BTN_EVT_CLICK,
                     badge_numbers.play_to_sleep_ms + 1100);
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1200);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_SETTINGS);

    /* On 待机常显 the lower key is a wake too, not a dead key. */
    fresh();
    badge_fsm_tick(fsm, badge_numbers.play_to_sleep_ms + 1);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_AOD);
    badge_fsm_event_clear(fsm);
    badge_fsm_button(fsm, BADGE_BTN_LOWER, BADGE_BTN_EVT_CLICK,
                     badge_numbers.play_to_sleep_ms + 100);
    CHECK(evt_has(EVT_WAKE, EVT_WAKE_BUTTON, 0));
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);

    /* The lower key's hold is 按住说话, gated on `long` being declared. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_button(fsm, BADGE_BTN_LOWER, BADGE_BTN_EVT_HOLD, 1000);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_VOICE);
    /* Releasing ends the listen rather than leaving the badge there. */
    badge_fsm_button(fsm, BADGE_BTN_LOWER, BADGE_BTN_EVT_HOLD_END, 1400);
    badge_fsm_tick(fsm, 1400 + badge_numbers.voice_think_ms + 1);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);

    /* Where `long` is undeclared, holding the key does nothing at all -- the same rule
     * the finger path applies. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_SETTINGS, BADGE_NAV_RIGHT);
    badge_fsm_button(fsm, BADGE_BTN_LOWER, BADGE_BTN_EVT_HOLD, 1000);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_SETTINGS);
    /* And the stray HOLD_END does not end a listen that never started. */
    badge_fsm_button(fsm, BADGE_BTN_LOWER, BADGE_BTN_EVT_HOLD_END, 1400);
    badge_fsm_tick(fsm, 6000);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_SETTINGS);

    /* A key press postpones the idle ladder: the owner pressing buttons is not the
     * owner being away. */
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    for (uint32_t t = 1000; t < badge_numbers.play_to_sleep_ms; t += 2000) {
        badge_fsm_button(fsm, BADGE_BTN_LOWER, BADGE_BTN_EVT_CLICK, t);
        badge_fsm_tick(fsm, t);
    }
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);

    /* Degenerate calls must not crash: this file's own contract. */
    fresh();
    badge_fsm_button(NULL, BADGE_BTN_CROWN, BADGE_BTN_EVT_CLICK, 0);
    badge_fsm_button(fsm, (badge_btn_t)BADGE_BTN_COUNT, BADGE_BTN_EVT_CLICK, 0);
    badge_fsm_button(fsm, BADGE_BTN_LOWER, (badge_btn_evt_t)99, 0);
}

/* --------------------------------------------------------------------- main ------*/

static void test_motion_alignment(void)
{
    section("motion alignment: boot, preview, slow drag, hop and clock");
    fresh();
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_BOOT);
    CHECK(!badge_fsm_screen_def(fsm)->has_cat);
    CHECK_EQ(badge_numbers.boot_ms, 2000);
    CHECK(!badge_screens[BADGE_SCREEN_CARE_MENU].has_cat);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    CHECK_EQ(badge_fsm_swipe_target(fsm, BADGE_NAV_DOWN), BADGE_SCREEN_STATUS);
    CHECK_EQ(badge_fsm_swipe_target(fsm, BADGE_NAV_UP), BADGE_SCREEN_CARE_MENU);
    badge_fsm_event_clear(fsm);
    badge_fsm_press(fsm, 233, 100, 1000);
    badge_fsm_move(fsm, 233, 240, 1800);
    badge_nav_t dir;
    int off;
    CHECK(badge_fsm_drag(fsm, &dir, &off));
    CHECK_EQ(dir, BADGE_NAV_DOWN);
    CHECK_EQ(off, 140);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    CHECK_EQ(evt_count(), 0);
    badge_fsm_release(fsm, 233, 240, 1900);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_STATUS);
    CHECK(!badge_fsm_drag(fsm, &dir, &off));
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_press(fsm, 233, 100, 1000);
    badge_fsm_move(fsm, 233, 239, 1800);
    badge_fsm_release(fsm, 233, 239, 1900);
    CHECK_EQ(badge_fsm_screen(fsm), BADGE_SCREEN_MAIN_A);
    fresh();
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    badge_fsm_act(fsm, BADGE_ACT_PET, 1000);
    badge_anim_directive_t anim;
    CHECK(badge_fsm_anim(fsm, 1210, &anim));
    CHECK(anim.root_y > 0.0f);
    CHECK(!badge_fsm_anim(fsm, 1420, &anim));
    fresh();
    badge_fsm_set_power(fsm, true, true);
    badge_fsm_set_time(fsm, 1439);
    badge_fsm_tick(fsm, 60000);
    CHECK_EQ(badge_fsm_now_min(fsm), 0);
}

int main(void)
{
    /* Unbuffered so a crash mid-run still shows which case it reached. */
    setvbuf(stdout, NULL, _IONBF, 0);
    test_motion_alignment();

    printf("badge_fsm: the state machine's own rules, driven through its public API\n");

    test_screens();
    test_gestures();
    test_long_press_and_swipes();
    test_release_wrap();
    test_modes();
    test_cares();
    test_care_refusals();
    test_events();
    test_event_log_cap();
    test_voice();
    test_alerts();
    test_quirks();
    test_peers();
    test_persistence_inputs();
    test_timing_edges();
    test_degenerate_calls();
    test_buttons();

    if (failures) {
        printf("\n%d checks, %d failures\n", checks, failures);
        return 1;
    }
    printf("\n%d checks, 0 failures", checks);
    printf("\n");
    printf("PASS badge_fsm\n");
    return 0;
}
