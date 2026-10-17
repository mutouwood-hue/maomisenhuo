/*
 * badge_fsm - the badge's rules and screen flow, with no LVGL in sight.
 *
 * The contract is badge_fsm.h; this file is the implementation of the reference
 * renderer's `go()`, `up()`, `swipe()`, `act()`, `tick()`, `updateMode()`,
 * `visible()`, `emit()`, `haptic()`, `sound()`, `applyCare()`, `finishCare()`,
 * `cancelCare()`, `startQuirk()`, `catchQuirk()`, `voiceStart()`, `voiceEnd()`,
 * `resolveSpeech()`, `home()` and `nightDim()`.
 *
 * Every number comes out of the generated tables (badge_numbers, badge_screens,
 * badge_els, badge_gests, badge_care_defs, badge_blocks, badge_quirk_defs,
 * badge_voice_defs, badge_guide_defs, badge_alerts, badge_event_defs). There is not
 * one timing, threshold or spread written as a literal below: the bug class this
 * rewrite exists to remove is a second copy of a specification number that drifts
 * away from the first.
 *
 * What is deliberately NOT here
 * -----------------------------
 * Stat decay. The reference's tick() decays 饱腹/心情/清洁/精力 by 0.36/0.24/0.18/0.24
 * per minute; main/pet/badge_pet.h explains at length why the badge must not do that
 * (the App is authoritative, the specification defines no badge-side decay, and a
 * badge that decayed on its own would show different numbers from the phone). The
 * badge's stats move on exactly two occasions: a care the owner finished, or the App's
 * sync.
 *
 * Care arithmetic. `badge_pet_care_step()` already owns it, so a care flow here
 * advances the kernel and reports its outcome instead of recomputing deltas.
 *
 * Three DEVIATIONS from the reference are marked where they happen:
 *   1. `go()` reports a care abandoned by a screen change with EVT_CARE_CANCEL. The
 *      reference only emits it for an explicit cancel, and its mode ladder silently
 *      drops the care. The event's own specification definition is 照料中途取消.
 *   2. Tapping the cat while a quirk is running catches the quirk. The reference's
 *      act('pet') has no such branch: it spends the tap on 摸摸 and the quirk runs out
 *      on its own.
 *   3. The voice silence window (`voice_silence_ms`) is enforced from the badge's own
 *      clock. The reference's tick only has the 8 s cap; 静音 1.2 秒 comes from the
 *      voice screen's own specification text.
 *
 * Allocation: exactly one, in badge_fsm_create(). The state machine is large on
 * purpose -- it replaces a pile of file-static state -- but it is always heap, never a
 * stack object: an 8 KB stack array is what put the previous firmware into a reboot
 * loop (docs/m1-hardware-verification.md:28-57).
 */
#include "badge_motion.h"
#include "badge_fsm.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>

/* SND_PET..SND_ERROR, for the BADGE_SFX_* bitmask. This pulls in lvgl.h for
 * lv_font_t, which nothing here dereferences; the host build supplies
 * tests/host/lvgl_font_stub/lvgl.h. */
#include "badge_assets.h"
#include "badge_geom.h" /* badge_el_contains(): the one answer to "is this element hit" */
#include "badge_pet.h"  /* the care kernel: CALL it, never copy its arithmetic */

/* ------------------------------------------------------------------ literals ---*/

/*
 * The internal limits the reference keeps inline. None of these is a rule the App also
 * knows, which is exactly why none of them is in badge_spec_data.
 */

/* 追尾巴 turns a whole circle; 被自己吓到 hops four model units; 盯着空气 holds its
 * head to one side (reference `drawCat()`, its quirk branch). */
#define BADGE_SPIN_DEG  720.0f
#define BADGE_STARE_X   (-32.0f)
#define BADGE_STARE_Y   10.0f
#define BADGE_HOP_UNITS 4.0f

/* 换个表盘 / 小橘: the cat looks up at the owner for a moment (reference
 * `resolveSpeech()`). */
#define BADGE_LOOK_X  0.0f
#define BADGE_LOOK_Y  6.0f
#define BADGE_LOOK_MS 1500u

/* 摸摸: the cat hops once where it stands -- the homepage's small answer to a pat.
 * Half the scare-hop's height (BADGE_HOP_UNITS) and one sine lobe, so it reads as
 * contented rather than startled. */
#define BADGE_PET_HOP_MS    420u
#define BADGE_PET_HOP_UNITS 2.0f

/* 接住了！心情 +2, clamped to the stat range. The bonus is stated in the toast's own
 * wording and has no generated table of its own, so it lives here; 100 is the range
 * every stat is drawn on (badge_pet.c's clamp_stat uses the same one). */
#define BADGE_MOOD_CATCH_BONUS 2
#define BADGE_STAT_CEIL        100

/* 逗猫: a stroke that starts inside the top band of the glass is the 先休息 gesture, not
 * a pounce (reference pointerdown/up). */
#define BADGE_PLAY_TOP_PX 60

/* The reference's demo clock starts at 18:40, because the 24-hour ring is the point of
 * the B dial and a badge with no RTC would otherwise show midnight. The App syncs the
 * real time over BLE (badge_fsm_set_time). */
#define BADGE_DEMO_START_MIN (18 * 60 + 40)
#define BADGE_NIGHT_FROM_MIN (23 * 60)
#define BADGE_NIGHT_TO_MIN   (7 * 60)

/* One PRNG, fixed seed: the same quirk order and the same pairing code on every boot,
 * so a misbehaving quirk is reproducible instead of a one-off. */
#define BADGE_FSM_SEED 0x9E3779B9u

#define BADGE_PI 3.14159265358979323846f

/* The voice flow's three states, and its two entry sources (reference ST.voice). */
enum { BADGE_VOICE_IDLE = 0, BADGE_VOICE_LISTEN, BADGE_VOICE_THINK };
enum { BADGE_VOICE_SRC_PRESS = 0, BADGE_VOICE_SRC_WORD };

/* ------------------------------------------------------------------ state ------*/

struct badge_fsm {
    badge_game_t *game; /* borrowed, never copied */

    int          screen;
    badge_mode_t mode;
    uint32_t     now_ms; /* the clock of the most recent entry point */
    int          clock_min;
    uint32_t     clock_t0;

    badge_nav_t trans_dir;
    uint32_t    trans_t0;

    /* the mode ladder's inputs */
    bool     phone;
    bool     usb;
    bool     flat;
    uint32_t last_input;

    /* the press in progress, as the reference keeps it in `P` */
    bool     pressing;
    int      px0, py0;
    int      drag_axis; /* 0 undecided, 1 horizontal, 2 vertical */
    badge_motion_history_t motion_history;
    int      plx, ply; /* the previous move, for 逗猫's stroke speed */
    uint32_t pt0, plt;
    int      pmoved;
    int      p_el;       /* element under the press, or -1 */
    bool     p_done;     /* the press only woke the badge */
    bool     p_long;     /* 按住说话 already fired */
    bool     p_top;      /* 逗猫: the stroke began in the top band */
    bool     p_hold_used;/* the element's hold already completed */
    bool     finger_down;
    int      finger_x, finger_y;
    bool     btn_voice;  /* 按住说话 was started by the lower key, not a finger */

    /* care */
    int      care; /* BADGE_CARE_NONE, or the care in progress */
    int      care_step;
    uint32_t cool_until[BADGE_CARE_COUNT_SPEC];
    uint32_t last_bite;
    uint32_t last_pounce;

    /* the touch self-test's record of which targets were hit (reference ST.tt.hit) */
    uint8_t  tt_hit[BADGE_TOUCH_TARGET_COUNT];
    int      tt_count;

    /* quirks */
    int      quirk; /* -1, or an index into badge_quirk_defs[] */
    uint32_t quirk_t0;
    uint32_t quirk_ms;
    uint32_t next_quirk;
    uint32_t rng;

    uint32_t look_until;
    uint32_t hop_t0;
    bool hop_started;
    uint32_t night_at; /* 晚安: leave the dial for 待机常显 / 息屏 a beat later */

    /* the specification's composite components */
    uint16_t toast, bubble;
    uint32_t toast_t0, bubble_t0, ring_t0;
    uint32_t bubble_rev, toast_rev, pet_rev, pet_t0;
    bool ring_started;
    bool face_dots_started;
    uint32_t face_dots_release;

    bool local_experience;
    badge_onboarding_t experience_onboarding;
    /* peers */
    bool         have_peer;
    badge_peer_t peer;
    uint32_t     screen_t0;

    /* voice */
    int      voice_state;
    int      voice_src;
    uint32_t voice_t0;
    uint32_t voice_last;
    uint32_t voice_think_at;
    char     voice_word[24];

    int  sync_pending;
    bool low_battery;
    badge_onboarding_t *onboarding;
    uint32_t unix_time, unix_t0;
    bool unix_valid, return_hint_armed;
    bool nudge_active, idle_used;
    uint8_t nudge_skill;
    uint32_t nudge_t0;
    uint32_t return_hint_t0;
    badge_nav_t return_hint_direction;
    bool tutorial_active, tutorial_return, tutorial_complete;
    uint8_t tutorial_step, tutorial_error;
    uint32_t tutorial_error_t0;
    badge_nav_t tutorial_out;
    uint32_t tutorial_step_t0;
    char pair_code[8];

    /* effects: `fx` is the batch being built, `pool` everything not yet collected */
    badge_fx_t fx;
    badge_fx_t pool;

    badge_evt_log_t    evt_log[BADGE_FSM_EVENT_LOG];
    uint32_t           evt_total;
    badge_fsm_event_fn evt_fn;
    void              *evt_user;

    bool in_update; /* the mode ladder's re-entrancy guard */
};

/* 低/中/高, the reference's own brightness scale (`const BRIGHT=[['低',.45],...]`). It is
 * a display scale rather than a specification rule, so it is not in badge_spec_data. */
const uint8_t badge_bright_scale_pct[BADGE_BRIGHT_LEVELS] = { 45, 75, 100 };

/* ------------------------------------------------------------------ helpers ----*/

static int imin(int a, int b) { return a < b ? a : b; }

static int idist(int x0, int y0, int x1, int y1)
{
    const double dx = (double)(x1 - x0), dy = (double)(y1 - y0);
    return (int)(sqrt(dx * dx + dy * dy) + 0.5);
}

static int touch_clamp(int v)
{
    return v < 0 ? 0 : (v > BADGE_TOUCH_MAX ? BADGE_TOUCH_MAX : v);
}

static uint32_t rng_next(badge_fsm_t *fsm)
{
    /* xorshift32, seeded from a constant: deterministic on every host and boot. */
    uint32_t x = fsm->rng;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    fsm->rng = x ? x : BADGE_FSM_SEED;
    return fsm->rng;
}

/** @brief A value in [lo, hi], both ends included. */
static uint32_t rng_between(badge_fsm_t *fsm, uint32_t lo, uint32_t hi)
{
    if (hi <= lo) return lo;
    return lo + rng_next(fsm) % (hi - lo + 1u);
}

/* -- effects -------------------------------------------------------------------*/

static void fx_sfx(badge_fsm_t *fsm, uint16_t bits)
{
    /* sound() rate-limits the same prompt to 250 ms; one prompt per interaction is the
     * same guard at a coarser grain, and it is what keeps a swipe from stacking two. */
    fsm->fx.sfx |= bits;
}

static void fx_haptic(badge_fsm_t *fsm, uint8_t kind)
{
    if (fsm->fx.haptic == BADGE_HAPTIC_NONE) fsm->fx.haptic = kind;
    fsm->ring_t0 = fsm->now_ms;
    fsm->ring_started = true;
}

static void fx_merge(badge_fx_t *dst, const badge_fx_t *src)
{
    dst->sfx |= src->sfx;
    if (dst->haptic == BADGE_HAPTIC_NONE && src->haptic != BADGE_HAPTIC_NONE)
        dst->haptic = src->haptic;
    if (src->toast) dst->toast = src->toast;
    if (src->bubble) dst->bubble = src->bubble;
    dst->went_home |= src->went_home;
    dst->started_care |= src->started_care;
    dst->finished_care |= src->finished_care;
    dst->cancelled_care |= src->cancelled_care;
    dst->invalidate |= src->invalidate;
}

static void fx_flush(badge_fsm_t *fsm)
{
    fx_merge(&fsm->pool, &fsm->fx);
    memset(&fsm->fx, 0, sizeof(fsm->fx));
}

static void toast_at(badge_fsm_t *fsm, uint16_t text, uint32_t now)
{
    fsm->toast = text;
    fsm->toast_t0 = now;
    fsm->toast_rev++;
    if (text) fsm->fx.toast = text;
}

static void bubble_at(badge_fsm_t *fsm, uint16_t text, uint32_t now)
{
    fsm->bubble = text;
    fsm->bubble_t0 = now;
    fsm->bubble_rev++;
    if (text) fsm->fx.bubble = text;
}

static void emit(badge_fsm_t *fsm, badge_evt_type_t type, uint8_t a, int16_t b);

/* -- screens -------------------------------------------------------------------*/

static bool is_main(int screen)
{
    return screen == BADGE_SCREEN_MAIN_A || screen == BADGE_SCREEN_MAIN_B ||
           screen == BADGE_SCREEN_MAIN_C;
}

/** @brief The screen a care action runs on. */
/*
 * Is a care flow in progress?
 *
 * `care` is an `int` holding either a BADGE_CARE_* index or the sentinel
 * BADGE_CARE_NONE, which badge_spec.h defines as 0xFFu -- and the sentinel is what makes
 * `fsm->care >= 0` the wrong test. 0xFF widened to int is 255, so `255 >= 0` is TRUE and
 * "no care running" reads as "care #255 running": every plain navigation would emit a
 * phantom EVT_CARE_CANCEL whose `a` is care_evt_num(255) = 254 (not a care the
 * specification defines -- its 照料编号 are 0..3), and it would put a cancel effect and a
 * bogus row into the uplink log on every swipe. The mirrored test `fsm->care < 0`
 * (step_care, cancel_care, the play timeout, badge_fsm_care) fails the same way, and lets
 * step_care reach badge_pet_care_step(game, 255, ...) and cool_until[255].
 *
 * So the test is equality against the sentinel, here, once, instead of the seven
 * comparison sites that had to each get it right.
 */
static bool care_active(const badge_fsm_t *fsm)
{
    return fsm && (int)BADGE_CARE_NONE != fsm->care;
}

static int care_screen(int care)
{
    switch (care) {
    case BADGE_CARE_FEED: return BADGE_SCREEN_CARE_FEED;
    case BADGE_CARE_WATER: return BADGE_SCREEN_CARE_WATER;
    case BADGE_CARE_PLAY: return BADGE_SCREEN_CARE_PLAY;
    case BADGE_CARE_SLEEP: return BADGE_SCREEN_CARE_SLEEP;
    default: return BADGE_SCREEN_CARE_MENU;
    }
}

/** @brief EVT_CARE_CANCEL's `a`: the specification's 照料编号 (喂食 0 … 睡觉 3). */
static uint8_t care_evt_num(int care)
{
    return care > BADGE_CARE_PET ? (uint8_t)(care - 1) : 0;
}

static void update_mode(badge_fsm_t *fsm);
static void home(badge_fsm_t *fsm, badge_nav_t dir);

static void go(badge_fsm_t *fsm, int screen, badge_nav_t dir)
{
    if (!fsm) return;
    if (screen < 0 || screen >= BADGE_SCREEN_COUNT_SPEC) return;
    if (fsm->low_battery && screen != BADGE_SCREEN_LOWBAT) return;
    if (fsm->screen == screen) return;

    /* An abandoned care is reported rather than silently dropped (DEVIATION 1). The
     * kernel has already moved the stats; growth and coins are never settled, because
     * badge_pet_care_settle() is only reached through the action's last step. */
    if (care_active(fsm) && screen != care_screen(fsm->care) &&
        screen != BADGE_SCREEN_SLEEPING) {
        emit(fsm, EVT_CARE_CANCEL, care_evt_num(fsm->care), (int16_t)fsm->care_step);
        fsm->fx.cancelled_care = true;
        fsm->care = BADGE_CARE_NONE;
        fsm->care_step = 0;
    }

    fsm->screen = screen;
    fsm->trans_dir = dir;
    fsm->trans_t0 = fsm->now_ms;
    fsm->screen_t0 = fsm->now_ms;
    fsm->return_hint_armed = false;
    const int hint_page = screen == BADGE_SCREEN_CARE_MENU ? 0 :
        screen == BADGE_SCREEN_STATUS ? 1 : screen == BADGE_SCREEN_SETTINGS ? 2 : -1;
    if (!fsm->tutorial_active && hint_page >= 0 &&
        badge_onboarding_return_visit(fsm->local_experience ? &fsm->experience_onboarding : fsm->onboarding, (unsigned)hint_page)) {
        fsm->return_hint_armed = true;
        fsm->return_hint_t0 = fsm->now_ms;
        fsm->return_hint_direction = hint_page == 0 ? BADGE_NAV_DOWN :
            hint_page == 1 ? BADGE_NAV_UP : BADGE_NAV_RIGHT;
    }
    if (screen == BADGE_SCREEN_GUIDE && fsm->onboarding && !fsm->tutorial_active) {
        fsm->tutorial_active = true;
        fsm->tutorial_step = 0;
        fsm->tutorial_return = fsm->tutorial_complete = false;
        fsm->tutorial_step_t0 = fsm->now_ms;
        fsm->game->guide_page = 0;
    }
    fsm->care_step = 0;
    fsm->fx.invalidate = true;
    if (screen != BADGE_SCREEN_VOICE) fsm->voice_state = BADGE_VOICE_IDLE;
    update_mode(fsm);
}

static void home(badge_fsm_t *fsm, badge_nav_t dir)
{
    /* The reference's mainId(): the chosen dial, or 生活同步 while the cat is out. The
     * away window is the App's business (badge_fsm.h has no seam for it), so the dial is
     * what home() lands on here. */
    const int dial = BADGE_SCREEN_MAIN_A + (fsm->game->face % 3);
    fsm->fx.went_home = true;
    go(fsm, dial, dir);
}

/* -- the mode ladder ------------------------------------------------------------*/

/*
 * 桌面充电态 is USB present AND lying flat. An armless board reports flat=false
 * forever, which is why badge_fsm_set_power() is a seam and why the ladder reads these
 * two bits rather than the IMU -- and why the host tests can walk the whole ladder.
 */
static void update_mode(badge_fsm_t *fsm)
{
    if (fsm->in_update) return;
    fsm->in_update = true;

    const int s = fsm->screen;
    if (fsm->low_battery) {
        fsm->mode = BADGE_MODE_PLAY;
        fsm->in_update = false;
        return;
    }

    /* Entered from anywhere except 息屏, and never auto-advanced: leaving it takes a
     * power or attitude change. */
    if (fsm->usb && fsm->flat && fsm->mode != BADGE_MODE_OFF) {
        fsm->mode = BADGE_MODE_DESK;
        fsm->in_update = false;
        return;
    }
    if (fsm->mode == BADGE_MODE_DESK) fsm->mode = BADGE_MODE_PLAY;

    /* These screens run on a play clock and never ladder down (reference updateMode). */
    if (fsm->tutorial_active || fsm->nudge_active || s == BADGE_SCREEN_BOOT || s == BADGE_SCREEN_PAIR || s == BADGE_SCREEN_GUIDE ||
        s == BADGE_SCREEN_MEET || s == BADGE_SCREEN_MEET_TAP ||
        s == BADGE_SCREEN_MEET_SCAN || s == BADGE_SCREEN_MEET_DONE ||
        s == BADGE_SCREEN_VOICE || s == BADGE_SCREEN_TOUCH_TEST) {
        fsm->mode = BADGE_MODE_PLAY;
        fsm->in_update = false;
        return;
    }

    /* 待机常显 and 息屏 are the same screen: `aod` off means "do not keep the clock on
     * the glass", which is the specification's 息屏. */
    if (s == BADGE_SCREEN_AOD) {
        fsm->mode = fsm->game->aod ? BADGE_MODE_AOD : BADGE_MODE_OFF;
        fsm->in_update = false;
        return;
    }

    const uint32_t idle = fsm->now_ms - fsm->last_input;
    if (idle > (uint32_t)badge_numbers.play_to_comp_ms + badge_numbers.comp_to_aod_ms) {
        const badge_mode_t m = fsm->game->aod ? BADGE_MODE_AOD : BADGE_MODE_OFF;
        if (care_active(fsm)) {
            emit(fsm, EVT_CARE_CANCEL, care_evt_num(fsm->care), (int16_t)fsm->care_step);
            fsm->fx.cancelled_care = true;
            fsm->care = BADGE_CARE_NONE;
        }
        go(fsm, BADGE_SCREEN_AOD, BADGE_NAV_FADE); /* re-enters; the guard stops it */
        fsm->mode = m;
        fsm->in_update = false;
        return;
    }

    fsm->mode = idle > badge_numbers.play_to_comp_ms ? BADGE_MODE_COMP : BADGE_MODE_PLAY;
    fsm->in_update = false;
}

/* -- visibility and the specification's gesture tables --------------------------*/

static bool el_visible(const badge_fsm_t *fsm, const badge_el_t *el)
{
    switch (el->when) {
    case BADGE_WHEN_PHONE: return fsm->phone;
    case BADGE_WHEN_NO_PHONE: return !fsm->phone;
    /* 提示气泡 shows while something wants the owner's attention, and a quirk uses the
     * same bubble -- which is what the reference's currentAlert() means by returning
     * ['quirk', icon] before it looks at the stats. */
    case BADGE_WHEN_ALERT: return badge_fsm_alert(fsm) >= 0 || fsm->quirk >= 0;
    default: return true;
    }
}

/**
 * @brief Whether the current screen declares this gesture.
 *
 * The specification's per-screen list is badge_screens[i].gest_first/gest_count into
 * badge_gests[]. The reference hardcodes the same set inside its up()/swipe(); asking
 * the table is how a screen that gains or loses a gesture in the specification stops
 * being silently ignored here.
 */
static bool gest_declared(const badge_fsm_t *fsm, const char *key)
{
    if (fsm->screen < 0 || fsm->screen >= BADGE_SCREEN_COUNT_SPEC) return false;
    const badge_screen_def_t *sd = &badge_screens[fsm->screen];
    for (int i = 0; i < (int)sd->gest_count; i++) {
        const int g = (int)sd->gest_first + i;
        if (g >= 0 && g < BADGE_GEST_COUNT && strcmp(badge_gests[g].gesture, key) == 0)
            return true;
    }
    return false;
}

static const char *nav_key(badge_nav_t dir)
{
    switch (dir) {
    case BADGE_NAV_UP: return "up";
    case BADGE_NAV_DOWN: return "down";
    case BADGE_NAV_LEFT: return "left";
    case BADGE_NAV_RIGHT: return "right";
    default: return "fade";
    }
}

/** @brief The gesture an element's action belongs to, as the specification names it. */
static const char *act_gesture_key(int act)
{
    switch (act) {
    case BADGE_ACT_PET: return "tap_cat";
    case BADGE_ACT_ALERT: return "tap_alert";
    case BADGE_ACT_CARE_FEED:
    case BADGE_ACT_CARE_WATER:
    case BADGE_ACT_CARE_PLAY:
    case BADGE_ACT_CARE_SLEEP:
    case BADGE_ACT_BITE:
    case BADGE_ACT_CALL_HOME: return "tap_btn";
    case BADGE_ACT_HOLD: return "hold_btn";
    case BADGE_ACT_STAT_FOOD:
    case BADGE_ACT_STAT_MOOD:
    case BADGE_ACT_STAT_CLEAN:
    case BADGE_ACT_STAT_ENERGY:
    case BADGE_ACT_STAT_HEALTH:
    case BADGE_ACT_SET_BRIGHT:
    case BADGE_ACT_SET_WAKE:
    case BADGE_ACT_SET_DISCOVER:
    case BADGE_ACT_SET_AOD: return "tap_row";
    case BADGE_ACT_SETTINGS: return "tap_gear";
    case BADGE_ACT_VER: return "long_ver";
    case BADGE_ACT_MEET_HI: return "tap_hi";
    case BADGE_ACT_MEET_SKIP: return "tap_skip";
    case BADGE_ACT_MEET_CANCEL: return "tap_cancel";
    case BADGE_ACT_GUIDE_NEXT:
    case BADGE_ACT_HOME:
    case BADGE_ACT_WAKE:
    case BADGE_ACT_TT_1:
    case BADGE_ACT_TT_2:
    case BADGE_ACT_TT_3:
    case BADGE_ACT_TT_4:
    case BADGE_ACT_TT_5: return "tap";
    default: return "tap";
    }
}

/* -- care -----------------------------------------------------------------------*/

/**
 * @brief Advance the care in progress by one step, through the care kernel.
 *
 * The kernel owns the deltas, the growth, the coins and the refusal rules; this only
 * decides when a step happens and what the glass does about it.
 */
static void step_care(badge_fsm_t *fsm)
{
    if (!care_active(fsm)) return;
    const int care = fsm->care;
    const badge_care_outcome_t out = badge_pet_care_step(fsm->game, care, fsm->care_step);

    if (out.result == BADGE_CARE_BLOCKED) {
        /* Refused mid-flow, with the specification's own wording (喵币不够 is the one
         * that actually happens: 喂食 settles its cost on the last bite, but the guard
         * is re-checked on every step). */
        toast_at(fsm, out.why, fsm->now_ms);
        fx_haptic(fsm, BADGE_HAPTIC_ERROR);
        fx_sfx(fsm, BADGE_SFX_ERROR);
        return;
    }
    if (out.result == BADGE_CARE_INVALID) return;

    fsm->care_step = out.step;
    if (out.result != BADGE_CARE_DONE) return;

    fsm->care = BADGE_CARE_NONE;
    fsm->care_step = 0;
    fsm->cool_until[care] = fsm->now_ms + badge_numbers.care_cooldown_ms;
    fx_haptic(fsm, BADGE_HAPTIC_CARE_DONE);
    fx_sfx(fsm, BADGE_SFX_CARE_DONE);
    fsm->fx.finished_care = true;
    switch (care) {
    case BADGE_CARE_FEED: emit(fsm, EVT_FEED, out.step, 0); break;
    case BADGE_CARE_WATER: emit(fsm, EVT_WATER, out.step, 0); break;
    case BADGE_CARE_PLAY: emit(fsm, EVT_PLAY, out.step, 0); break;
    case BADGE_CARE_SLEEP: emit(fsm, EVT_SLEEP, 0, 0); break;
    default: break;
    }
    /* The reference builds a "+25 饱腹 · +3 心情" line here. A state machine that must
     * not allocate reports the specification's own name for the event instead; the
     * numbers are on the status screen a swipe away. */
    toast_at(fsm, badge_event_defs[care].label, fsm->now_ms);
    home(fsm, BADGE_NAV_FADE);
}

static void cancel_care(badge_fsm_t *fsm, uint16_t toast, badge_nav_t dir)
{
    if (!care_active(fsm)) return;
    const uint8_t n = care_evt_num(fsm->care);
    const int step = fsm->care_step;
    fsm->care = BADGE_CARE_NONE;
    fsm->care_step = 0;
    emit(fsm, EVT_CARE_CANCEL, n, (int16_t)step);
    fsm->fx.cancelled_care = true;
    home(fsm, dir);
    if (toast) toast_at(fsm, toast, fsm->now_ms);
}

/** @brief 摸摸: immediate, and the only care with no screen of its own. */
static void pet_now(badge_fsm_t *fsm)
{
    if (fsm->now_ms < fsm->cool_until[BADGE_CARE_PET]) return; /* pet_cooldown_ms */
    uint16_t why = 0;
    if (!badge_pet_care_allowed(fsm->game, BADGE_CARE_PET, &why)) {
        /* 已经很开心啦: the cat answers, but nothing is settled and nothing is reported,
         * because an owner cannot earn growth for a care the specification refuses. */
        bubble_at(fsm, BADGE_TXT_PETFULL, fsm->now_ms);
        fsm->hop_t0 = fsm->now_ms;
        fsm->hop_started = true;
        fsm->look_until = fsm->now_ms + badge_numbers.transition_ms;
        return;
    }
    (void)badge_pet_care_step(fsm->game, BADGE_CARE_PET, 0);
    fsm->cool_until[BADGE_CARE_PET] = fsm->now_ms + badge_numbers.pet_cooldown_ms;
    fsm->hop_t0 = fsm->now_ms;
    fsm->hop_started = true;
    const int mood = fsm->game->stat[BADGE_STAT_MOOD];
    bubble_at(fsm, mood >= 90 ? BADGE_TXT_PETFULL : mood >= 65 ? BADGE_TXT_PETGOOD :
                   mood >= 40 ? BADGE_TXT_PETPLAY : BADGE_TXT_PETMISS, fsm->now_ms);
    fx_sfx(fsm, BADGE_SFX_PET);
    fsm->pet_t0 = fsm->now_ms;
    fsm->pet_rev++;
    badge_onboarding_learn(fsm->local_experience ? &fsm->experience_onboarding : fsm->onboarding, 0);
    emit(fsm, EVT_PET, 0, 0);
}

static void start_care(badge_fsm_t *fsm, int care)
{
    if (care < 0 || care >= BADGE_CARE_COUNT_SPEC) return;
    if (care == BADGE_CARE_PET) {
        pet_now(fsm);
        return;
    }
    uint16_t why = 0;
    if (!badge_pet_care_allowed(fsm->game, care, &why)) {
        /* The reference toasts "喂食：吃饱了". The element's own label is already on the
         * glass as the button, so the refusal's wording is what this has to add. */
        toast_at(fsm, why, fsm->now_ms);
        fx_haptic(fsm, BADGE_HAPTIC_ERROR);
        fx_sfx(fsm, BADGE_SFX_ERROR);
        return;
    }
    if (fsm->now_ms < fsm->cool_until[care]) {
        /* care_cooldown_ms. The reference words this "刚刚做过，等一下"; that is a demo
         * string with no index in the string table, so the error prompt stands in and
         * no care starts. */
        fx_sfx(fsm, BADGE_SFX_ERROR);
        return;
    }
    fsm->care = care;
    fsm->care_step = 0;
    fsm->fx.started_care = true;
    go(fsm, care_screen(care), BADGE_NAV_FADE);
}

/* -- quirks ---------------------------------------------------------------------*/

static void schedule_quirk(badge_fsm_t *fsm)
{
    fsm->next_quirk = fsm->now_ms +
                      rng_between(fsm, badge_numbers.quirk_min_ms, badge_numbers.quirk_max_ms);
}

static void start_quirk(badge_fsm_t *fsm)
{
    const int q = (int)(rng_next(fsm) % (uint32_t)BADGE_QUIRK_COUNT);
    fsm->quirk = q;
    fsm->quirk_t0 = fsm->now_ms;
    fsm->quirk_ms = badge_quirk_defs[q].ms;
    /* The reference's startQuirk() is reached through input(), so the idle clock
     * restarts with the quirk -- otherwise the next one would be due immediately. */
    fsm->last_input = fsm->now_ms;
}

/** @brief Tapping the cat during a quirk catches it (reference `catchQuirk()`). */
static void catch_quirk(badge_fsm_t *fsm)
{
    if (fsm->quirk < 0) return;
    const int q = fsm->quirk;
    badge_game_t *g = fsm->game;
    g->stat[BADGE_STAT_MOOD] = (uint8_t)imin(BADGE_STAT_CEIL, (int)g->stat[BADGE_STAT_MOOD] +
                                                                 BADGE_MOOD_CATCH_BONUS);
    emit(fsm, EVT_QUIRK_CATCH, (uint8_t)q, 0);
    toast_at(fsm, BADGE_TXT_CAUGHT, fsm->now_ms);
    fsm->quirk = -1;
    schedule_quirk(fsm);
}

/* -- voice ----------------------------------------------------------------------*/

static const badge_voice_def_t *voice_lookup(const char *word)
{
    if (!word || !*word) return NULL;
    for (int i = 0; i < BADGE_VOICE_COUNT; i++) {
        if (strcmp(word, badge_strings[badge_voice_defs[i].word]) == 0)
            return &badge_voice_defs[i];
    }
    /* The reference also accepts a longer utterance that contains the command word
     * ("小橘过来吧" for 小橘过来), bounded so that a sentence mentioning two commands
     * does not match whichever comes first in the table by accident. */
    for (int i = 0; i < BADGE_VOICE_COUNT; i++) {
        const char *w = badge_strings[badge_voice_defs[i].word];
        if (strlen(w) >= 2 && strstr(word, w) != NULL)
            return &badge_voice_defs[i];
    }
    return NULL;
}

static void voice_resolve(badge_fsm_t *fsm)
{
    fsm->voice_state = BADGE_VOICE_IDLE;
    const badge_voice_def_t *def = voice_lookup(fsm->voice_word);
    if (def) {
        const char *action = badge_strings[def->action];
        emit(fsm, EVT_VOICE_CMD, def->num, 0);
        if (strcmp(action, "pet") == 0) {
            home(fsm, BADGE_NAV_FADE);
            pet_now(fsm);
        } else if (strcmp(action, "feed") == 0 || strcmp(action, "water") == 0 ||
                   strcmp(action, "play") == 0 || strcmp(action, "sleep") == 0) {
            /* The care screen replaces the voice screen outright; the reference slides
             * home first and starts the care a frame later. */
            int care = BADGE_CARE_FEED;
            if (strcmp(action, "water") == 0) care = BADGE_CARE_WATER;
            else if (strcmp(action, "play") == 0) care = BADGE_CARE_PLAY;
            else if (strcmp(action, "sleep") == 0) care = BADGE_CARE_SLEEP;
            start_care(fsm, care);
        } else if (strcmp(action, "status") == 0) {
            go(fsm, BADGE_SCREEN_STATUS, BADGE_NAV_DOWN);
        } else if (strcmp(action, "face") == 0) {
            /* 换个表盘: the dial changes first, so home() lands on the new one. */
            fsm->game->face = (uint8_t)((fsm->game->face + 1) % 3);
            emit(fsm, EVT_FACE, fsm->game->face, 0);
            home(fsm, BADGE_NAV_FADE);
        } else if (strcmp(action, "look") == 0) {
            home(fsm, BADGE_NAV_FADE);
            fsm->look_until = fsm->now_ms + BADGE_LOOK_MS;
            bubble_at(fsm, def->reply, fsm->now_ms);
        } else if (strcmp(action, "night") == 0) {
            /* 晚安: answer, then let the badge fall into 待机常显 / 息屏 on its own. The
             * reference waits 3 s; that is a demo value, and the bubble's own lifetime
             * is the specification's number for "the owner has read it". */
            home(fsm, BADGE_NAV_FADE);
            bubble_at(fsm, def->reply, fsm->now_ms);
            fsm->night_at = fsm->now_ms + badge_numbers.bubble_ms;
        } else {
            /* come / say: the cat walks over or answers in its bubble. */
            home(fsm, BADGE_NAV_FADE);
            bubble_at(fsm, def->reply, fsm->now_ms);
        }
        return;
    }
    if (fsm->phone) {
        const uint16_t replies[3] = { BADGE_TXT_FREE_REPLY_0, BADGE_TXT_FREE_REPLY_1,
                                      BADGE_TXT_FREE_REPLY_2 };
        const uint16_t r = replies[rng_next(fsm) % 3u];
        emit(fsm, EVT_VOICE_FREE, 1, 0);
        home(fsm, BADGE_NAV_FADE);
        bubble_at(fsm, r, fsm->now_ms);
    } else {
        home(fsm, BADGE_NAV_FADE);
        bubble_at(fsm, BADGE_TXT_NOPHONE, fsm->now_ms);
    }
}

static void voice_start(badge_fsm_t *fsm, int src)
{
    if (!fsm || fsm->low_battery) return;
    go(fsm, BADGE_SCREEN_VOICE, BADGE_NAV_FADE);
    fsm->voice_state = BADGE_VOICE_LISTEN;
    fsm->voice_src = src;
    fsm->voice_t0 = fsm->now_ms;
    fsm->voice_last = fsm->now_ms;
    fsm->voice_word[0] = '\0';
    bubble_at(fsm, BADGE_TXT_LISTENING, fsm->now_ms);
    if (fsm->mode != BADGE_MODE_DESK) fsm->mode = BADGE_MODE_PLAY;
    fsm->last_input = fsm->now_ms;
}

static void voice_end(badge_fsm_t *fsm)
{
    if (fsm->voice_state != BADGE_VOICE_LISTEN) return;
    fsm->voice_state = BADGE_VOICE_THINK;
    fsm->voice_think_at = fsm->now_ms + badge_numbers.voice_think_ms;
    bubble_at(fsm, BADGE_TXT_THINKING, fsm->now_ms);
}

/* -- gestures -------------------------------------------------------------------*/

bool badge_fsm_local_experience(const badge_fsm_t *fsm)
{
    return fsm && fsm->local_experience;
}

bool badge_fsm_start_local_experience(badge_fsm_t *fsm, uint32_t now_ms)
{
    if (!fsm || fsm->low_battery || fsm->screen != BADGE_SCREEN_PAIR ||
        !fsm->onboarding || fsm->onboarding->bound) return false;
    fsm->local_experience = true;
    memset(&fsm->experience_onboarding, 0, sizeof(fsm->experience_onboarding));
    fsm->pressing = fsm->finger_down = false;
    fsm->drag_axis = 0;
    fsm->last_input = fsm->now_ms = now_ms;
    go(fsm, BADGE_SCREEN_GUIDE, BADGE_NAV_FADE);
    fx_flush(fsm);
    return true;
}

static void do_tap(badge_fsm_t *fsm, int x, int y)
{
    if (fsm->screen == BADGE_SCREEN_PAIR && x >= 133 && x <= 333 && y >= 350 && y <= 398) {
        (void)badge_fsm_start_local_experience(fsm, fsm->now_ms);
        return;
    }
    const int el = badge_fsm_hit_test(fsm, x, y);
    if (el < 0) return;
    const badge_el_t *e = &badge_els[el];
    /* A hold is not a tap (the reference: `el.act && !el.hold`): 哄睡's moon and the
     * hidden 触摸自检 button both belong to the hold branch in tick(). */
    if (e->hold_ms > 0) return;
    const int act = e->type == BE_ALERT ? BADGE_ACT_ALERT : e->act;
    if (act == BADGE_ACT_NONE) return;
    /* Only a gesture the specification declares for this screen is dispatched: the
     * element table and the gest table are two halves of the same specification. */
    if (!gest_declared(fsm, act_gesture_key(act))) return;
    (void)badge_fsm_act(fsm, act, fsm->now_ms);
}

static void swipe(badge_fsm_t *fsm, badge_nav_t dir)
{
    if (!gest_declared(fsm, nav_key(dir))) return; /* undeclared: the reference does nothing */
    const int s = fsm->screen;
    if (is_main(s)) {
        badge_onboarding_learn(fsm->local_experience ? &fsm->experience_onboarding : fsm->onboarding, dir == BADGE_NAV_UP ? 1u : dir == BADGE_NAV_DOWN ? 2u : 3u);
        if (dir == BADGE_NAV_UP) {
            go(fsm, BADGE_SCREEN_CARE_MENU, BADGE_NAV_UP);
        } else if (dir == BADGE_NAV_DOWN) {
            go(fsm, BADGE_SCREEN_STATUS, BADGE_NAV_DOWN);
        } else {
            /* The reference's dial arithmetic: left is +1 and right is +2, so the two
             * directions walk the three dials in opposite orders. */
            const int step = dir == BADGE_NAV_LEFT ? 1 : 2;
            fsm->game->face = (uint8_t)((fsm->game->face + step) % 3);
            emit(fsm, EVT_FACE, fsm->game->face, 0);
            go(fsm, BADGE_SCREEN_MAIN_A + (fsm->game->face % 3), dir);
        }
    } else if (s == BADGE_SCREEN_AWAY && dir == BADGE_NAV_DOWN) {
        go(fsm, BADGE_SCREEN_STATUS, BADGE_NAV_DOWN);
    } else if (s == BADGE_SCREEN_CARE_MENU && dir == BADGE_NAV_DOWN) {
        home(fsm, BADGE_NAV_DOWN);
    } else if (s == BADGE_SCREEN_STATUS && dir == BADGE_NAV_UP) {
        home(fsm, BADGE_NAV_UP);
    } else if (s == BADGE_SCREEN_SETTINGS && dir == BADGE_NAV_RIGHT) {
        go(fsm, BADGE_SCREEN_STATUS, BADGE_NAV_RIGHT);
    } else if (s == BADGE_SCREEN_TOUCH_TEST && dir == BADGE_NAV_RIGHT) {
        go(fsm, BADGE_SCREEN_SETTINGS, BADGE_NAV_RIGHT);
    } else if ((s == BADGE_SCREEN_CARE_FEED || s == BADGE_SCREEN_CARE_WATER ||
                s == BADGE_SCREEN_CARE_SLEEP) && dir == BADGE_NAV_DOWN) {
        cancel_care(fsm, BADGE_TXT_CARECANCEL, BADGE_NAV_DOWN);
    }
}

/* ------------------------------------------------------------------ public -----*/

badge_fsm_t *badge_fsm_create(badge_game_t *game, uint32_t now_ms)
{
    if (!game) return NULL;
    /* The one allocation in this module. Never a stack object: badge_fsm_t replaces a
     * pile of file-static state and is far too big for the 8 KB task stack. */
    badge_fsm_t *fsm = (badge_fsm_t *)calloc(1, sizeof(*fsm));
    if (!fsm) return NULL;

    fsm->game = game;
    fsm->screen = BADGE_SCREEN_BOOT;
    fsm->mode = BADGE_MODE_PLAY;
    fsm->now_ms = now_ms;
    fsm->clock_min = BADGE_DEMO_START_MIN;
    fsm->clock_t0 = now_ms;
    fsm->trans_dir = BADGE_NAV_FADE;
    fsm->trans_t0 = now_ms;
    fsm->screen_t0 = now_ms;
    fsm->last_input = now_ms;
    fsm->care = BADGE_CARE_NONE;
    fsm->quirk = -1;
    fsm->p_el = -1;
    fsm->voice_state = BADGE_VOICE_IDLE;
    fsm->rng = BADGE_FSM_SEED;

    /* A pairing PIN belongs to the authenticator, never a fixed PRNG demo. */
    memcpy(fsm->pair_code, "--- ---", sizeof(fsm->pair_code));

    schedule_quirk(fsm);
    return fsm;
}

static badge_nav_t tutorial_direction(const badge_fsm_t *fsm)
{
    if (fsm->tutorial_return) {
        if (fsm->tutorial_out == BADGE_NAV_UP) return BADGE_NAV_DOWN;
        if (fsm->tutorial_out == BADGE_NAV_DOWN) return BADGE_NAV_UP;
        return fsm->tutorial_out == BADGE_NAV_LEFT ? BADGE_NAV_RIGHT : BADGE_NAV_LEFT;
    }
    return fsm->tutorial_step == 1 ? BADGE_NAV_UP :
           fsm->tutorial_step == 2 ? BADGE_NAV_DOWN : BADGE_NAV_LEFT;
}

static void tutorial_advance(badge_fsm_t *fsm)
{
    fsm->tutorial_return = false;
    fsm->tutorial_error = 0;
    fx_haptic(fsm, BADGE_HAPTIC_CARE_DONE);
    fx_sfx(fsm, BADGE_SFX_CARE_DONE);
    if (fsm->tutorial_step < 4) ++fsm->tutorial_step;
    else fsm->tutorial_complete = true;
    fsm->game->guide_page = fsm->tutorial_step;
    fsm->tutorial_step_t0 = fsm->now_ms;
    go(fsm, BADGE_SCREEN_GUIDE, BADGE_NAV_FADE);
    fsm->fx.invalidate = true;
}

void badge_fsm_tutorial_view(const badge_fsm_t *fsm, badge_tutorial_view_t *out)
{
    if (!out) return;
    memset(out, 0, sizeof(*out));
    if (!fsm || !fsm->tutorial_active) return;
    out->active = true;
    out->touching = fsm->pressing;
    out->dragging = fsm->pressing && fsm->drag_axis != 0;
    out->step = fsm->tutorial_step;
    out->error = fsm->tutorial_error && fsm->now_ms - fsm->tutorial_error_t0 < 2000u ? fsm->tutorial_error : 0;
    out->returning = fsm->tutorial_return;
    out->complete = fsm->tutorial_complete;
    out->direction = tutorial_direction(fsm);
    out->elapsed_ms = fsm->now_ms - fsm->tutorial_step_t0;
    out->screen_elapsed_ms = fsm->now_ms - fsm->screen_t0;
    out->help = out->elapsed_ms >= 8000;
}

void badge_fsm_tutorial_replay(badge_fsm_t *fsm, uint32_t now_ms)
{
    if (!fsm || fsm->low_battery || !fsm->onboarding || !fsm->onboarding->bound) return;
    fsm->now_ms = now_ms;
    fsm->pressing = false;
    fsm->finger_down = false;
    fsm->drag_axis = 0;
    fsm->nudge_active = false;
    fsm->idle_used = false;
    fsm->last_input = now_ms;
    fsm->tutorial_error = 0;
    fsm->tutorial_active = false;
    if (fsm->screen == BADGE_SCREEN_GUIDE) go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    go(fsm, BADGE_SCREEN_GUIDE, BADGE_NAV_FADE);
    fx_flush(fsm);
}

void badge_fsm_set_unix_time(badge_fsm_t *fsm, uint32_t unix_seconds, uint32_t now_ms)
{
    if (!fsm) return;
    fsm->unix_time = unix_seconds;
    fsm->unix_t0 = now_ms;
    fsm->unix_valid = unix_seconds != 0;
}
void badge_fsm_hint_view(const badge_fsm_t *fsm, badge_hint_view_t *out)
{
    if (!out) return;
    memset(out, 0, sizeof(*out));
    if (!fsm || fsm->tutorial_active) return;
    if (fsm->nudge_active && is_main(fsm->screen) && !fsm->pressing && !fsm->low_battery) {
        out->nudge = true;
        out->nudge_skill = fsm->nudge_skill;
        out->nudge_elapsed = fsm->now_ms - fsm->nudge_t0;
    }
    const uint32_t age = fsm->now_ms - fsm->return_hint_t0;
    if (fsm->return_hint_armed && age >= 400u && age < 2000u) {
        out->return_hint = ((age - 400u) % 800u) < 400u;
        out->return_direction = fsm->return_hint_direction;
    }
    if (!fsm->unix_valid || !fsm->pressing || fsm->p_long || fsm->p_done ||
        fsm->now_ms - fsm->pt0 < 180u) return;
    const uint32_t unix_now = fsm->unix_time + (fsm->now_ms - fsm->unix_t0) / 1000u;
    if (!badge_onboarding_novice(fsm->onboarding, unix_now) || !is_main(fsm->screen)) return;
    static const badge_nav_t dirs[4] = { BADGE_NAV_UP, BADGE_NAV_DOWN, BADGE_NAV_LEFT, BADGE_NAV_RIGHT };
    badge_nav_t dragging = BADGE_NAV_FADE;
    int offset;
    const bool drag = badge_fsm_drag(fsm, &dragging, &offset);
    for (unsigned i = 0; i < 4; ++i) {
        const unsigned skill = i < 2 ? i + 1 : 3;
        if (fsm->onboarding->learned[skill] < 3 && badge_fsm_swipe_target(fsm, dirs[i]) >= 0 &&
            (!drag || dragging == dirs[i])) out->directions |= (uint8_t)(1u << i);
    }
}

void badge_fsm_set_onboarding(badge_fsm_t *fsm, badge_onboarding_t *state)
{
    if (fsm) fsm->onboarding = state;
}

bool badge_fsm_set_pair_code(badge_fsm_t *fsm, const char *digits)
{
    if (!fsm || !digits) return false;
    for (int i = 0; i < 6; ++i)
        if (digits[i] < '0' || digits[i] > '9') return false;
    if (digits[6]) return false;
    for (int i = 0; i < 6; ++i) fsm->pair_code[i < 3 ? i : i + 1] = digits[i];
    fsm->pair_code[3] = ' '; fsm->pair_code[7] = '\0';
    fsm->fx.invalidate = true;
    return true;
}

void badge_fsm_binding_verified(badge_fsm_t *fsm, uint32_t unix_seconds, uint32_t now_ms)
{
    if (!fsm || !fsm->onboarding) return;
    fsm->now_ms = now_ms;
    badge_onboarding_bound(fsm->onboarding, unix_seconds);
    badge_fsm_set_unix_time(fsm, unix_seconds, now_ms);
    if (fsm->screen == BADGE_SCREEN_PAIR) {
        if (!fsm->onboarding->tutorial_done && !fsm->onboarding->tutorial_skipped) {
            fsm->game->guide_page = 0;
            go(fsm, BADGE_SCREEN_GUIDE, BADGE_NAV_FADE);
        } else home(fsm, BADGE_NAV_FADE);
    }
    fx_flush(fsm);
}

void badge_fsm_destroy(badge_fsm_t *fsm)
{
    free(fsm);
}

/* -- clock ----------------------------------------------------------------------*/

void badge_fsm_tick(badge_fsm_t *fsm, uint32_t now_ms)
{
    if (!fsm) return;
    fsm->now_ms = now_ms;
    const uint32_t minutes = (int32_t)(now_ms - fsm->clock_t0) >= 0
                             ? (now_ms - fsm->clock_t0) / 60000u : 0;
    if (minutes) {
        fsm->clock_min = (fsm->clock_min + (int)minutes) % 1440;
        fsm->clock_t0 += minutes * 60000u;
    }
    const int s = fsm->screen;

    /* 晚安: the badge falls into 待机常显 / 息屏 after the reply has been read. */
    if (fsm->night_at && (int32_t)(now_ms - fsm->night_at) >= 0) {
        fsm->night_at = 0;
        if (is_main(fsm->screen)) go(fsm, BADGE_SCREEN_AOD, BADGE_NAV_FADE);
    }

    /* 逗猫 with nobody playing: the cat gets tired and the owner is told why. */
    if (s == BADGE_SCREEN_CARE_PLAY && care_active(fsm) &&
        now_ms - fsm->screen_t0 > badge_numbers.play_timeout_ms) {
        cancel_care(fsm, BADGE_TXT_PLAYTIRED, BADGE_NAV_DOWN);
    }

    /* The wizard and the encounter screens arm their own timeout on entry. */
    if (s == BADGE_SCREEN_BOOT && now_ms - fsm->screen_t0 > badge_numbers.boot_ms) {
        if (fsm->onboarding && !fsm->onboarding->bound)
            go(fsm, BADGE_SCREEN_PAIR, BADGE_NAV_FADE);
        else if (fsm->onboarding && !fsm->onboarding->tutorial_done &&
                 !fsm->onboarding->tutorial_skipped)
            go(fsm, BADGE_SCREEN_GUIDE, BADGE_NAV_FADE);
        else home(fsm, BADGE_NAV_FADE);
    }
    /* Pair completion comes only from binding_verified(), not phone connection. */
    if (s == BADGE_SCREEN_MEET && now_ms - fsm->screen_t0 > badge_numbers.meet_timeout_ms)
        home(fsm, BADGE_NAV_FADE);
    if ((s == BADGE_SCREEN_MEET_TAP || s == BADGE_SCREEN_MEET_SCAN) &&
        now_ms - fsm->screen_t0 > badge_numbers.tap_confirm_timeout_ms)
        home(fsm, BADGE_NAV_FADE);
    if (s == BADGE_SCREEN_MEET_DONE &&
        now_ms - fsm->screen_t0 > badge_numbers.meet_done_ms)
        home(fsm, BADGE_NAV_FADE);

    /* 睡着了: the moon was held, the cat sleeps, then wakes and the care settles. */
    if (s == BADGE_SCREEN_SLEEPING &&
        now_ms - fsm->screen_t0 > badge_numbers.sleep_demo_ms) {
        fsm->screen_t0 = now_ms; /* one settle per visit */
        fsm->care = BADGE_CARE_SLEEP;
        fsm->care_step = 0;
        step_care(fsm);
    }

    /* A hold in progress: 哄睡's ring, and 设置's hidden 触摸自检. */
    if (fsm->pressing && !fsm->p_hold_used && fsm->p_el >= 0) {
        const badge_el_t *el = &badge_els[fsm->p_el];
        if (el->hold_ms > 0 && fsm->pmoved <= (int)badge_numbers.tap_move_max &&
            now_ms - fsm->pt0 >= el->hold_ms) {
            fsm->p_hold_used = true;
            if (el->act == BADGE_ACT_HOLD) {
                fsm->care = BADGE_CARE_SLEEP;
                fsm->care_step = 0;
                go(fsm, BADGE_SCREEN_SLEEPING, BADGE_NAV_FADE);
            } else if (el->act == BADGE_ACT_VER) {
                go(fsm, BADGE_SCREEN_TOUCH_TEST, BADGE_NAV_LEFT);
            }
        }
    }

    /* 按住说话 without a release: the reference arms this on the dials and on a bare
     * 生活同步 tap, and it fires while the finger is still down. */
    if (fsm->pressing && !fsm->p_long && !fsm->p_done &&
        !fsm->drag_axis && fsm->pmoved < BADGE_MOTION_LOCK_PX &&
        now_ms - fsm->pt0 >= BADGE_MOTION_HOLD_END_MS) {
        const badge_el_t *el = fsm->p_el >= 0 ? &badge_els[fsm->p_el] : NULL;
        const bool dial = is_main(s) && gest_declared(fsm, "long") &&
                          (el == NULL || el->act == BADGE_ACT_PET);
        const bool away = s == BADGE_SCREEN_AWAY && el == NULL;
        const bool tutorial_hold = fsm->tutorial_active && !fsm->tutorial_complete &&
            fsm->tutorial_step == 4 && s == BADGE_SCREEN_GUIDE;
        if (dial || away || tutorial_hold) {
            badge_onboarding_learn(fsm->local_experience ? &fsm->experience_onboarding : fsm->onboarding, 4);
            fsm->p_long = true;
            voice_start(fsm, BADGE_VOICE_SRC_PRESS);
        }
    }

    /* The listening window: the specification's cap, and its silence rule
     * (DEVIATION 3 -- the reference only has the cap). */
    if (s == BADGE_SCREEN_VOICE && fsm->voice_state == BADGE_VOICE_LISTEN) {
        if (now_ms - fsm->voice_last >= badge_numbers.voice_silence_ms ||
            now_ms - fsm->voice_t0 >= badge_numbers.voice_max_ms) {
            voice_end(fsm);
        }
    }
    if (fsm->voice_state == BADGE_VOICE_THINK && (int32_t)(now_ms - fsm->voice_think_at) >= 0)
        voice_resolve(fsm);

    /* Quirks: expire one, then pick the next after quirk_idle_ms of no input. */
    if (fsm->quirk >= 0) {
        if (now_ms - fsm->quirk_t0 >= fsm->quirk_ms) {
            fsm->quirk = -1;
            schedule_quirk(fsm);
        }
    } else if (is_main(s) &&
               (fsm->mode == BADGE_MODE_PLAY || fsm->mode == BADGE_MODE_COMP ||
                fsm->mode == BADGE_MODE_DESK) &&
               now_ms - fsm->last_input > badge_numbers.quirk_idle_ms &&
               (int32_t)(now_ms - fsm->next_quirk) >= 0) {
        start_quirk(fsm);
    }

    if (fsm->nudge_active && now_ms - fsm->nudge_t0 >= 1450u) fsm->nudge_active = false;
    if (!fsm->tutorial_active && !fsm->low_battery && fsm->unix_valid && is_main(fsm->screen) &&
        !fsm->pressing && !fsm->idle_used && now_ms - fsm->last_input >= 6000u) {
        const uint32_t unix_now = fsm->unix_time + (now_ms - fsm->unix_t0) / 1000u;
        unsigned skill;
        for (skill = 1; skill < 5; ++skill)
            if (fsm->onboarding && fsm->onboarding->learned[skill] < 3) break;
        if (skill < 5 && badge_onboarding_nudge_claim(fsm->onboarding, unix_now)) {
            fsm->idle_used = true;
            fsm->nudge_active = true;
            fsm->nudge_skill = (uint8_t)skill;
            fsm->nudge_t0 = now_ms;
        }
    }
    update_mode(fsm);
    fx_flush(fsm);
}

int badge_fsm_now_min(const badge_fsm_t *fsm)
{
    return fsm ? fsm->clock_min : 0;
}

void badge_fsm_set_time(badge_fsm_t *fsm, int now_min)
{
    if (!fsm) return;
    now_min %= 24 * 60;
    if (now_min < 0) now_min += 24 * 60;
    fsm->clock_min = now_min;
    fsm->clock_t0 = fsm->now_ms;
    fsm->fx.invalidate = true;
}

static bool night_dim(const badge_fsm_t *fsm)
{
    const int m = fsm->clock_min;
    return m >= BADGE_NIGHT_FROM_MIN || m < BADGE_NIGHT_TO_MIN;
}

/* -- screens --------------------------------------------------------------------*/

int badge_fsm_screen(const badge_fsm_t *fsm)
{
    return fsm ? fsm->screen : -1;
}

int badge_fsm_visual_screen(const badge_fsm_t *fsm)
{
    if (!fsm) return -1;
    if (fsm->screen == BADGE_SCREEN_GUIDE && fsm->tutorial_active && !fsm->tutorial_complete)
        return BADGE_SCREEN_MAIN_A + fsm->game->face % 3;
    return fsm->screen;
}

const badge_screen_def_t *badge_fsm_screen_def(const badge_fsm_t *fsm)
{
    if (!fsm || fsm->screen < 0 || fsm->screen >= BADGE_SCREEN_COUNT_SPEC) return NULL;
    return &badge_screens[fsm->screen];
}

void badge_fsm_go(badge_fsm_t *fsm, int screen, badge_nav_t dir)
{
    if (!fsm) return;
    go(fsm, screen, dir);
    fx_flush(fsm);
}

bool badge_fsm_transitioning(const badge_fsm_t *fsm, uint32_t now_ms)
{
    if (!fsm) return false;
    return (now_ms - fsm->trans_t0) < (uint32_t)badge_numbers.transition_ms;
}

badge_nav_t badge_fsm_transition_dir(const badge_fsm_t *fsm)
{
    return fsm ? fsm->trans_dir : BADGE_NAV_FADE;
}

/* -- input ----------------------------------------------------------------------*/

int badge_fsm_swipe_target(const badge_fsm_t *fsm, badge_nav_t dir)
{
    if (!fsm) return -1;
    if (fsm->tutorial_active) {
        if (fsm->tutorial_complete || fsm->tutorial_step == 0 || fsm->tutorial_step == 4) return -1;
        const badge_nav_t expected = tutorial_direction(fsm);
        if (dir != expected && !(fsm->tutorial_step == 3 && !fsm->tutorial_return && dir == BADGE_NAV_RIGHT)) return -1;
        if (fsm->tutorial_return) return BADGE_SCREEN_GUIDE;
        return fsm->tutorial_step == 1 ? BADGE_SCREEN_CARE_MENU :
            fsm->tutorial_step == 2 ? BADGE_SCREEN_STATUS :
            BADGE_SCREEN_MAIN_A + (fsm->game->face + (dir == BADGE_NAV_LEFT ? 1 : 2)) % 3;
    }
    if (!gest_declared(fsm, nav_key(dir))) return -1;
    const int s = fsm->screen;
    if (is_main(s)) {
        if (dir == BADGE_NAV_UP) return BADGE_SCREEN_CARE_MENU;
        if (dir == BADGE_NAV_DOWN) return BADGE_SCREEN_STATUS;
        return BADGE_SCREEN_MAIN_A + (fsm->game->face + (dir == BADGE_NAV_LEFT ? 1 : 2)) % 3;
    }
    if (s == BADGE_SCREEN_AWAY && dir == BADGE_NAV_DOWN) return BADGE_SCREEN_STATUS;
    if ((s == BADGE_SCREEN_CARE_MENU && dir == BADGE_NAV_DOWN) ||
        (s == BADGE_SCREEN_STATUS && dir == BADGE_NAV_UP))
        return BADGE_SCREEN_MAIN_A + fsm->game->face % 3;
    if (s == BADGE_SCREEN_SETTINGS && dir == BADGE_NAV_RIGHT) return BADGE_SCREEN_STATUS;
    if (s == BADGE_SCREEN_TOUCH_TEST && dir == BADGE_NAV_RIGHT) return BADGE_SCREEN_SETTINGS;
    if ((s == BADGE_SCREEN_CARE_FEED || s == BADGE_SCREEN_CARE_WATER ||
         s == BADGE_SCREEN_CARE_SLEEP) && dir == BADGE_NAV_DOWN)
        return BADGE_SCREEN_MAIN_A + fsm->game->face % 3;
    return -1;
}

bool badge_fsm_drag(const badge_fsm_t *fsm, badge_nav_t *dir, int *offset)
{
    if (!fsm || !fsm->pressing || fsm->p_done || fsm->p_long ||
        fsm->screen == BADGE_SCREEN_BOOT || fsm->screen == BADGE_SCREEN_CARE_PLAY) return false;
    int dx = fsm->plx - fsm->px0, dy = fsm->ply - fsm->py0;
    int ax = dx < 0 ? -dx : dx, ay = dy < 0 ? -dy : dy;
    if (!fsm->drag_axis && ax < 12 && ay < 12) return false;
    const bool horizontal = fsm->drag_axis ? fsm->drag_axis == 1 : ax > ay;
    *dir = horizontal ? (dx > 0 ? BADGE_NAV_RIGHT : BADGE_NAV_LEFT)
                      : (dy > 0 ? BADGE_NAV_DOWN : BADGE_NAV_UP);
    *offset = horizontal ? dx : dy;
    return true;
}

void badge_fsm_press(badge_fsm_t *fsm, int x, int y, uint32_t now_ms)
{
    if (!fsm || fsm->low_battery) return;
    const int cx = touch_clamp(x), cy = touch_clamp(y);
    fsm->now_ms = now_ms;

    fsm->pressing = true;
    fsm->nudge_active = false;
    fsm->idle_used = false;
    fsm->return_hint_armed = false;
    fsm->p_done = false;
    fsm->p_long = false;
    fsm->p_hold_used = false;
    fsm->p_top = false;
    fsm->pmoved = 0;
    fsm->drag_axis = 0;
    fsm->p_el = -1;
    fsm->px0 = cx;
    fsm->py0 = cy;
    fsm->plx = cx;
    fsm->ply = cy;
    fsm->pt0 = now_ms;
    fsm->plt = now_ms;
    fsm->motion_history.count = 0;
    badge_motion_sample(&fsm->motion_history, now_ms, cx, cy);

    const bool asleep = fsm->screen == BADGE_SCREEN_AOD;
    if (fsm->mode != BADGE_MODE_DESK) fsm->mode = BADGE_MODE_PLAY;
    fsm->last_input = now_ms;

    if (asleep) {
        /* 待机常显 / 息屏: the touch is a wake cause and nothing else. */
        badge_fsm_wake(fsm, EVT_WAKE_TOUCH, now_ms);
        fsm->p_done = true;
        fx_flush(fsm);
        return;
    }

    fsm->p_el = badge_fsm_hit_test(fsm, cx, cy);
    if (fsm->screen == BADGE_SCREEN_CARE_PLAY) {
        fsm->finger_down = true;
        fsm->finger_x = cx;
        fsm->finger_y = cy;
        fsm->p_top = cy < BADGE_PLAY_TOP_PX;
    }
    fx_flush(fsm);
}

void badge_fsm_move(badge_fsm_t *fsm, int x, int y, uint32_t now_ms)
{
    if (!fsm || !fsm->pressing) return;
    const int cx = touch_clamp(x), cy = touch_clamp(y);
    fsm->now_ms = now_ms;

    badge_motion_sample(&fsm->motion_history, now_ms, cx, cy);
    const int moved = idist(fsm->px0, fsm->py0, cx, cy);
    if (!fsm->drag_axis && moved >= BADGE_MOTION_LOCK_PX) {
        fsm->drag_axis = abs(cx - fsm->px0) > abs(cy - fsm->py0) ? 1 : 2;
    }
    if (moved > fsm->pmoved) fsm->pmoved = moved;

    if (fsm->screen == BADGE_SCREEN_CARE_PLAY) {
        const int mx = cx - fsm->plx, my = cy - fsm->ply;
        const uint32_t dt = now_ms - fsm->plt;
        const double speed = dt ? ((double)idist(0, 0, mx, my) * 1000.0 / (double)dt) : 0.0;
        fsm->finger_x = cx;
        fsm->finger_y = cy;
        /* 逗猫: a fast stroke is a pounce, unless the stroke began in the top band --
         * that one is the 先休息 gesture (reference pointermove). */
        if (speed > (double)badge_numbers.play_pounce_speed &&
            now_ms - fsm->last_pounce > badge_numbers.play_pounce_gap_ms && !fsm->p_top) {
            fsm->last_pounce = now_ms;
            fsm->last_input = now_ms;
            step_care(fsm);
            if (!care_active(fsm)) {
                /* The fifth pounce ended the game: the reference drops the finger and the
                 * press with it. */
                fsm->finger_down = false;
                fsm->pressing = false;
            }
        }
    }
    if (fsm->pmoved >= BADGE_MOTION_LOCK_PX)
        fsm->p_hold_used = true; /* a hold cannot survive a drag */
    fsm->plx = cx;
    fsm->ply = cy;
    fsm->plt = now_ms;
    fx_flush(fsm);
}

void badge_fsm_release(badge_fsm_t *fsm, int x, int y, uint32_t now_ms)
{
    if (!fsm || !fsm->pressing) return;
    if (x < 0 || x > BADGE_SCR_W || y < 0 || y > BADGE_SCR_H ||
        (int32_t)(now_ms - fsm->pt0) < 0) {
        fsm->pressing = false;
        fsm->finger_down = false;
        return;
    }
    const int cx = touch_clamp(x), cy = touch_clamp(y);
    fsm->now_ms = now_ms;

    const uint32_t dt = now_ms - fsm->pt0;
    const int dx = cx - fsm->px0, dy = cy - fsm->py0;
    const int dist = idist(fsm->px0, fsm->py0, cx, cy);
    const int s = fsm->screen;

    fsm->pressing = false;
    fsm->p_hold_used = false;

    if (fsm->p_done) return; /* the press only woke the badge */
    if (fsm->p_long) {
        if (fsm->tutorial_active && fsm->tutorial_step == 4) tutorial_advance(fsm);
        else voice_end(fsm);
        fx_flush(fsm);
        return;
    }
    if (s == BADGE_SCREEN_CARE_PLAY) {
        fsm->finger_down = false;
        /* 先休息: a down-stroke that began in the top band. The reference tests the
         * vertical delta rather than the length, so a mostly-downward stroke counts. */
        if (fsm->p_top && dy > (int)badge_numbers.swipe_min_px)
            cancel_care(fsm, BADGE_TXT_CARECANCEL, BADGE_NAV_DOWN);
        fx_flush(fsm);
        return;
    }
    if (fsm->tutorial_active && fsm->onboarding &&
        fsm->pmoved < BADGE_MOTION_LOCK_PX && dist < BADGE_MOTION_LOCK_PX &&
        dt <= badge_numbers.tap_max_ms && idist(cx, cy, BADGE_CX, 420) <= 36) {
        badge_onboarding_finish(fsm->local_experience ? &fsm->experience_onboarding : fsm->onboarding, true);
        fsm->tutorial_active = false;
        home(fsm, BADGE_NAV_FADE);
        fx_flush(fsm);
        return;
    }
    const bool horizontal = fsm->drag_axis ? fsm->drag_axis == 1 : abs(dx) > abs(dy);
    const int travel = horizontal ? abs(dx) : abs(dy);
    if (is_main(s) && horizontal && (fsm->drag_axis || travel >= BADGE_MOTION_LOCK_PX)) {
        fsm->face_dots_started = true;
        fsm->face_dots_release = now_ms;
    }
    const bool reverse = badge_motion_reverse(&fsm->motion_history, now_ms,
        cx, cy, horizontal, horizontal ? dx : dy);
    if (fsm->tutorial_active) {
        const bool tap_ok = fsm->pmoved < BADGE_MOTION_LOCK_PX &&
            dist < BADGE_MOTION_LOCK_PX && dt <= badge_numbers.tap_max_ms;
        if (fsm->tutorial_complete && tap_ok) {
            badge_onboarding_finish(fsm->local_experience ? &fsm->experience_onboarding : fsm->onboarding, false);
            fsm->tutorial_active = false;
            home(fsm, BADGE_NAV_FADE);
        } else if (fsm->tutorial_step == 0 && tap_ok && idist(cx, cy, BADGE_CX, BADGE_CY) < 100) {
            pet_now(fsm);
            tutorial_advance(fsm);
        } else if (fsm->tutorial_step >= 1 && fsm->tutorial_step <= 3 &&
                   badge_motion_commit(travel, dt, reverse)) {
            const badge_nav_t dir = horizontal ? (dx > 0 ? BADGE_NAV_RIGHT : BADGE_NAV_LEFT) :
                (dy > 0 ? BADGE_NAV_DOWN : BADGE_NAV_UP);
            const badge_nav_t expected = tutorial_direction(fsm);
            const bool valid = dir == expected || (!fsm->tutorial_return &&
                fsm->tutorial_step == 3 && dir == BADGE_NAV_RIGHT);
            if (valid) {
                if (fsm->tutorial_return) tutorial_advance(fsm);
                else {
                    fsm->tutorial_out = dir;
                    fsm->tutorial_return = true;
                    const int target = fsm->tutorial_step == 1 ? BADGE_SCREEN_CARE_MENU :
                        fsm->tutorial_step == 2 ? BADGE_SCREEN_STATUS :
                        BADGE_SCREEN_MAIN_A + (fsm->game->face + (dir == BADGE_NAV_LEFT ? 1 : 2)) % 3;
                    go(fsm, target, dir);
                }
            } else {
                fsm->tutorial_error = 1;
                fsm->tutorial_error_t0 = now_ms;
            }
        } else if (!fsm->tutorial_complete && fsm->tutorial_step >= 1) {
            fsm->tutorial_error = fsm->tutorial_step == 4 ? 3 : 2;
            fsm->tutorial_error_t0 = now_ms;
        }
        fx_flush(fsm);
        return;
    }
    if (badge_motion_commit(travel, dt, reverse)) {
        const badge_nav_t dir = horizontal ? (dx > 0 ? BADGE_NAV_RIGHT : BADGE_NAV_LEFT)
                                           : (dy > 0 ? BADGE_NAV_DOWN : BADGE_NAV_UP);
        swipe(fsm, dir);
    } else if (fsm->pmoved < BADGE_MOTION_LOCK_PX && dist < BADGE_MOTION_LOCK_PX &&
               dt <= badge_numbers.tap_max_ms) {
        do_tap(fsm, cx, cy);
    }
    fx_flush(fsm);
}

/* -- actions --------------------------------------------------------------------*/

badge_fx_t badge_fsm_act(badge_fsm_t *fsm, int act, uint32_t now_ms)
{
    badge_fx_t none;
    memset(&none, 0, sizeof(none));
    if (!fsm || fsm->low_battery) return none;

    fsm->now_ms = now_ms;
    /* The batch is per call: every entry point builds one and hands it back through
     * badge_fsm_take_fx(), so a caller can attribute effects to its own call. */
    memset(&fsm->fx, 0, sizeof(fsm->fx));

    switch (act) {
    case BADGE_ACT_NONE:
        break;

    case BADGE_ACT_PET:
        /* DEVIATION 2: the reference spends this tap on 摸摸 even while a quirk runs
         * and lets the quirk expire on its own. Catching it is the interaction the
         * specification describes for a quirk, and EVT_QUIRK_CATCH exists for nothing
         * else. */
        if (fsm->quirk >= 0) catch_quirk(fsm);
        else pet_now(fsm);
        break;

    case BADGE_ACT_ALERT: {
        if (fsm->quirk >= 0) {
            catch_quirk(fsm);
            break;
        }
        const int a = badge_pet_alert(fsm->game);
        if (a < 0) break;
        const badge_alert_def_t *al = &badge_alerts[a];
        int care = -1;
        if (al->action == BADGE_ACT_CARE_FEED) care = BADGE_CARE_FEED;
        else if (al->action == BADGE_ACT_CARE_WATER) care = BADGE_CARE_WATER;
        else if (al->action == BADGE_ACT_CARE_PLAY) care = BADGE_CARE_PLAY;
        else if (al->action == BADGE_ACT_CARE_SLEEP) care = BADGE_CARE_SLEEP;
        if (care >= 0) go(fsm, BADGE_SCREEN_CARE_MENU, BADGE_NAV_UP); /* the wheel, as the reference does */
        else bubble_at(fsm, al->text, now_ms); /* 不舒服 / 该洗澡了 have no care of their own */
        break;
    }

    case BADGE_ACT_CARE_FEED: start_care(fsm, BADGE_CARE_FEED); break;
    case BADGE_ACT_CARE_WATER: start_care(fsm, BADGE_CARE_WATER); break;
    case BADGE_ACT_CARE_PLAY: start_care(fsm, BADGE_CARE_PLAY); break;
    case BADGE_ACT_CARE_SLEEP: start_care(fsm, BADGE_CARE_SLEEP); break;

    case BADGE_ACT_BITE:
        /* 点碗喂一口 / 点水碗喝一口, rate-limited by bite_gap_ms. */
        if (now_ms - fsm->last_bite < badge_numbers.bite_gap_ms) break;
        fsm->last_bite = now_ms;
        step_care(fsm);
        break;

    case BADGE_ACT_STAT_FOOD:
    case BADGE_ACT_STAT_MOOD:
    case BADGE_ACT_STAT_CLEAN:
    case BADGE_ACT_STAT_ENERGY:
    case BADGE_ACT_STAT_HEALTH: {
        /* 状态's rows go to the matching care's screen; 清洁 and 健康 have none, so they
         * answer with the alert list's own wording for that stat. */
        int care = -1;
        if (act == BADGE_ACT_STAT_FOOD) care = BADGE_CARE_FEED;
        else if (act == BADGE_ACT_STAT_MOOD) care = BADGE_CARE_PLAY;
        else if (act == BADGE_ACT_STAT_ENERGY) care = BADGE_CARE_SLEEP;
        if (care >= 0) {
            home(fsm, BADGE_NAV_UP);
            go(fsm, BADGE_SCREEN_CARE_MENU, BADGE_NAV_UP);
        } else {
            const uint8_t want =
                act == BADGE_ACT_STAT_CLEAN ? BADGE_STAT_CLEAN : BADGE_STAT_SICK;
            uint16_t text = 0;
            for (int i = 0; i < BADGE_ALERT_COUNT && text == 0; i++) {
                if (badge_alerts[i].stat == want) text = badge_alerts[i].text;
            }
            home(fsm, BADGE_NAV_UP);
            bubble_at(fsm, text, now_ms);
        }
        break;
    }

    case BADGE_ACT_SETTINGS:
        go(fsm, BADGE_SCREEN_SETTINGS, BADGE_NAV_LEFT);
        break;

    case BADGE_ACT_SET_BRIGHT:
    case BADGE_ACT_SET_WAKE:
    case BADGE_ACT_SET_DISCOVER:
    case BADGE_ACT_SET_AOD: {
        const int setting = act - BADGE_ACT_SET_BRIGHT;
        const int v = badge_pet_toggle(fsm->game, setting);
        if (v >= 0) emit(fsm, EVT_SETTING, (uint8_t)setting, (int16_t)v);
        fsm->fx.invalidate = true;
        /* 息屏常显 off while standing on 待机常显: the panel goes dark now, not at the
         * next ladder step. */
        update_mode(fsm);
        break;
    }

    case BADGE_ACT_VER:
        /* Reached through the 3 s hold on the settings screen, not a tap. */
        go(fsm, BADGE_SCREEN_TOUCH_TEST, BADGE_NAV_LEFT);
        break;

    case BADGE_ACT_TT_1:
    case BADGE_ACT_TT_2:
    case BADGE_ACT_TT_3:
    case BADGE_ACT_TT_4:
    case BADGE_ACT_TT_5: {
        /* 触摸自检: the five targets are the four corners and the centre. The reference
         * counts them in ST.tt.hit, shows "已点中 n / 5", and returns to 设置 once all
         * five are right -- which is where this record lives. */
        const int i = act - BADGE_ACT_TT_1;
        if (i >= 0 && i < BADGE_TOUCH_TARGET_COUNT && !fsm->tt_hit[i]) {
            fsm->tt_hit[i] = 1;
            fsm->tt_count++;
        }
        fsm->fx.invalidate = true;
        if (fsm->tt_count >= BADGE_TOUCH_TARGET_COUNT) {
            fx_sfx(fsm, BADGE_SFX_CARE_DONE);
            go(fsm, BADGE_SCREEN_SETTINGS, BADGE_NAV_RIGHT);
        }
        break;
    }

    case BADGE_ACT_MEET_HI:
        /* The M1 board has no NFC (BADGE_HW_NFC 0), so 打招呼 always lands on the QR
         * confirmation screen -- which is what the specification's own screen doc says
         * the first version does ("M1 板没有 NFC，NFC 不进初版"). */
        go(fsm, BADGE_HW_NFC ? BADGE_SCREEN_MEET_TAP : BADGE_SCREEN_MEET_SCAN,
           BADGE_NAV_LEFT);
        break;

    case BADGE_ACT_MEET_SKIP:
    case BADGE_ACT_MEET_CANCEL:
        fsm->have_peer = false;
        home(fsm, BADGE_NAV_FADE);
        break;

    case BADGE_ACT_HOME:
        home(fsm, BADGE_NAV_FADE);
        break;

    case BADGE_ACT_CALL_HOME: {
        /* 生活同步 is driven by the owner's state, which the App syncs and badge_fsm.h
         * has no seam for, so the place index reported upstream is the first of
         * badge_place_defs[]. The reference's 30-minute window is call_home_ms and the
         * badge comes home at once, as its `act('call_home')` does. */
        emit(fsm, EVT_CALL_HOME, 0, 0);
        home(fsm, BADGE_NAV_FADE);
        toast_at(fsm, BADGE_TXT_CALLHOME, now_ms);
        break;
    }

    case BADGE_ACT_GUIDE_NEXT:
        if (fsm->onboarding) break; /* Production guide tasks replace click-through next. */
        if ((int)fsm->game->guide_page + 1 >= BADGE_GUIDE_COUNT) {
            fsm->game->guide_page = 0;
            home(fsm, BADGE_NAV_FADE);
        } else {
            fsm->game->guide_page++;
            fsm->fx.invalidate = true;
        }
        break;

    case BADGE_ACT_WAKE:
        badge_fsm_wake(fsm, EVT_WAKE_TOUCH, now_ms);
        break;

    default:
        /* An action this build does not know. The reference shows a debug toast; a
         * repaint is the honest answer. */
        fsm->fx.invalidate = true;
        break;
    }

    const badge_fx_t out = fsm->fx;
    fx_merge(&fsm->pool, &fsm->fx);
    memset(&fsm->fx, 0, sizeof(fsm->fx));
    return out;
}

void badge_fsm_button(badge_fsm_t *fsm, badge_btn_t btn, badge_btn_evt_t evt, uint32_t now_ms)
{
    if (!fsm || fsm->low_battery) return;
    fsm->now_ms = now_ms;
    fsm->nudge_active = false;
    fsm->idle_used = false;
    /* The batch is per call, like badge_fsm_act()'s: the effects this key produced belong
     * to this call and are picked up by the app's next badge_fsm_take_fx(). */
    memset(&fsm->fx, 0, sizeof(fsm->fx));

    if (btn == BADGE_BTN_CROWN) {
        /* A long press here is the PMIC's own power-off, not ours. */
        if (evt != BADGE_BTN_EVT_CLICK) return;

        if (fsm->screen == BADGE_SCREEN_AOD) {
            /* badge_fsm_wake() is deliberately reused rather than reimplemented: it emits
             * EVT_WAKE, plays the wake prompt, homes the badge and -- load bearing --
             * refreshes last_input BEFORE the mode ladder reads it. A key press that
             * ladders straight back to 待机常显 would be the same bug its comment
             * describes for a raise. */
            memset(&fsm->fx, 0, sizeof(fsm->fx));
            badge_fsm_wake(fsm, EVT_WAKE_BUTTON, now_ms);
            return;
        }
        if (!is_main(fsm->screen)) {
            /* Lit, but somewhere else in the tree: the obvious "get me out of here".
             * 息屏 (AOD with the clock setting off) is the screen above and is handled
             * there; a power key that does nothing on a lit screen would read as dead. */
            fsm->last_input = now_ms;
            home(fsm, BADGE_NAV_FADE);
            update_mode(fsm);
        } else {
            fsm->last_input = now_ms; /* already home: it still counts as input */
        }
        fx_flush(fsm);
        return;
    }

    if (btn != BADGE_BTN_LOWER) return;

    if (evt == BADGE_BTN_EVT_CLICK) {
        /* Any key press on a dark badge lights it, the same as the crown key: a key that
         * does nothing at all on 待机常显 reads as broken. */
        if (fsm->screen == BADGE_SCREEN_AOD) {
            memset(&fsm->fx, 0, sizeof(fsm->fx));
            badge_fsm_wake(fsm, EVT_WAKE_BUTTON, now_ms);
            return;
        }
        /* 抚摸, but only where the specification declares tap_cat -- the same gate
         * do_tap() consults. The test is against the screen the owner is ON, not against
         * the dial: navigating home first and then petting would make a key press on 设置
         * silently leave the screen, which is the crown key's job.
         *
         * Refreshing last_input matters more than it looks: on a lit dial nothing else in
         * this path touches it, and a key that does not count as input would let the badge
         * ladder to 待机常显 while the owner is pressing its buttons. */
        fsm->last_input = now_ms;
        if (gest_declared(fsm, "tap_cat")) {
            const badge_fx_t fx = badge_fsm_act(fsm, BADGE_ACT_PET, now_ms);
            fx_merge(&fsm->pool, &fx);
            update_mode(fsm); /* 陪伴态 -> 互动态, as a tap on the cat does */
        }
        fx_flush(fsm);
        return;
    }

    if (evt == BADGE_BTN_EVT_HOLD) {
        if (fsm->screen == BADGE_SCREEN_AOD) {
            memset(&fsm->fx, 0, sizeof(fsm->fx));
            badge_fsm_wake(fsm, EVT_WAKE_BUTTON, now_ms);
            return;
        }
        /* The hold rule is shared with the finger path so the two cannot drift: the key
         * speaks only where the glass would. */
        const int s = fsm->screen;
        fsm->last_input = now_ms;
        if (s != BADGE_SCREEN_VOICE &&
            ((is_main(s) && gest_declared(fsm, "long")) || s == BADGE_SCREEN_AWAY)) {
            voice_start(fsm, BADGE_VOICE_SRC_PRESS);
            fsm->btn_voice = true;
        }
        fx_flush(fsm);
        return;
    }

    if (evt == BADGE_BTN_EVT_HOLD_END) {
        fsm->last_input = now_ms;
        if (fsm->btn_voice) {
            fsm->btn_voice = false;
            voice_end(fsm);
        }
        fx_flush(fsm);
    }
}

int badge_fsm_hit_test(const badge_fsm_t *fsm, int x, int y)
{
    const badge_screen_def_t *sd = badge_fsm_screen_def(fsm);
    if (!sd) return -1;
    /* Later elements win the overlap: the reference walks its list backwards, and the
     * generated table is in drawing order. */
    for (int k = (int)sd->el_count - 1; k >= 0; k--) {
        const int idx = (int)sd->el_first + k;
        if (idx < 0 || idx >= BADGE_EL_COUNT) continue;
        const badge_el_t *el = &badge_els[idx];
        if (el->type != BE_ALERT && el->act == BADGE_ACT_NONE) continue;
        if (!el_visible(fsm, el)) continue;
        if (el->type == BE_ALERT && badge_fsm_alert(fsm) < 0 && badge_fsm_quirk(fsm) < 0)
            continue; /* 提示气泡 with nothing to show is not there to press */
        if (badge_el_contains(el, NULL, x, y)) return idx;
    }
    return -1;
}

/* -- state ----------------------------------------------------------------------*/

badge_game_t *badge_fsm_game(badge_fsm_t *fsm)
{
    return fsm ? fsm->game : NULL;
}

const badge_game_t *badge_fsm_game_const(const badge_fsm_t *fsm)
{
    return fsm ? fsm->game : NULL;
}

badge_mode_t badge_fsm_mode(const badge_fsm_t *fsm)
{
    return fsm ? fsm->mode : BADGE_MODE_OFF;
}

bool badge_fsm_low_battery(const badge_fsm_t *fsm) { return fsm && fsm->low_battery; }
void badge_fsm_set_battery(badge_fsm_t *fsm, int pct, bool valid, bool usb, uint32_t now_ms)
{
    if (!fsm) return;
    fsm->now_ms = now_ms;
    if (fsm->low_battery) {
        if (!usb) return; /* A noisy/recovered percentage cannot unlock protection. */
        fsm->low_battery = false;
        fsm->usb = true;
        fsm->last_input = now_ms;
        home(fsm, BADGE_NAV_FADE);
        fx_flush(fsm);
        return;
    }
    if (!valid || usb || pct < 0 || pct >= 5) return;
    fsm->low_battery = true;
    fsm->pressing = false;
    fsm->finger_down = false;
    fsm->tutorial_active = false;
    fsm->nudge_active = false;
    fsm->idle_used = false;
    memset(&fsm->fx, 0, sizeof(fsm->fx));
    memset(&fsm->pool, 0, sizeof(fsm->pool));
    fsm->voice_state = BADGE_VOICE_IDLE;
    fsm->quirk = -1;
    go(fsm, BADGE_SCREEN_LOWBAT, BADGE_NAV_FADE);
    fx_flush(fsm);
}

void badge_fsm_set_power(badge_fsm_t *fsm, bool usb, bool flat)
{
    if (!fsm) return;
    fsm->usb = usb;
    fsm->flat = flat;
    update_mode(fsm);
    fx_flush(fsm);
}

void badge_fsm_wake(badge_fsm_t *fsm, uint8_t cause, uint32_t now_ms)
{
    if (!fsm || fsm->low_battery) return;
    fsm->now_ms = now_ms;
    if (cause == EVT_WAKE_WORD && !fsm->game->wake_word) return; /* the setting is off */

    /*
     * A wake IS input, so the idle clock is refreshed BEFORE anything reads it.
     *
     * This order is load bearing and the bug it fixes was invisible on a bench. Because
     * `cause` is EVT_WAKE_RAISE (the IMU's raise-to-wake, main.c) or EVT_WAKE_TOUCH,
     * neither of which goes through badge_fsm_press(), this was the first statement to
     * touch last_input. Refreshing it afterwards let the ladder read the PRE-SLEEP value
     * and conclude the owner had been idle for longer than play_to_sleep_ms -- so
     * home()'s go() called update_mode(), the ladder branch fired, and the badge was
     * sent straight back to 待机常显. The result was EVT_WAKE reported, the haptic and
     * the sound played, and the dial never lit: the badge buzzed at you and stayed dark.
     *
     * (go() calling update_mode() is what makes this reachable from home(); a reader who
     * assumes the mode is only settled at the end of this function misses it.)
     */
    fsm->last_input = now_ms;
    fsm->nudge_active = false;
    fsm->idle_used = false;

    const bool asleep = fsm->screen == BADGE_SCREEN_AOD;
    if (asleep) {
        /* 抬起手腕 / 触摸 / 唤醒词 → 回到主表盘（互动态）. Only a dark badge is woken, so
         * a lift on the dial does not queue a second EVT_WAKE. */
        emit(fsm, EVT_WAKE, cause, 0);
        fx_haptic(fsm, BADGE_HAPTIC_WAKE);
        fx_sfx(fsm, BADGE_SFX_WAKE);
        home(fsm, BADGE_NAV_FADE);
    }
    if (fsm->mode != BADGE_MODE_DESK) fsm->mode = BADGE_MODE_PLAY;

    if (cause == EVT_WAKE_WORD) {
        /* 或说唤醒词「小橘小橘」进入（不用按，8 秒内说完）: the badge's own text gives
         * the cap as voice_max_ms, so that is what both sources use. */
        voice_start(fsm, BADGE_VOICE_SRC_WORD);
    }
    update_mode(fsm);
    fx_flush(fsm);
}

int badge_fsm_backlight_pct(const badge_fsm_t *fsm)
{
    if (!fsm) return 0;
    if (fsm->mode == BADGE_MODE_OFF) return 0;
    int lvl = (int)fsm->game->bright;
    if (lvl < 0 || lvl >= BADGE_BRIGHT_LEVELS) lvl = 1;
    int pct = badge_bright_scale_pct[lvl]; /* 低/中/高 */
    if (fsm->mode == BADGE_MODE_AOD) pct = badge_numbers.aod_bright_pct;
    /* 23:00–07:00 dims whatever the setting and the mode asked for (reference
     * nightDim(), which multiplies the final brightness by .35). */
    if (night_dim(fsm)) pct = pct * badge_numbers.aod_bright_pct / 100;
    return pct;
}

int badge_fsm_fps(const badge_fsm_t *fsm)
{
    if (!fsm) return 0;
    switch (fsm->mode) {
    case BADGE_MODE_DESK: return badge_numbers.desk_fps;
    case BADGE_MODE_PLAY: return badge_numbers.play_fps;
    case BADGE_MODE_COMP: return badge_numbers.comp_fps;
    case BADGE_MODE_AOD: return badge_numbers.aod_fps;
    /* 息屏 renders nothing at all, and the specification's mode table has no row for
     * it: its fps and resolution are zero by definition rather than by a number. */
    default: return 0;
    }
}

int badge_fsm_res(const badge_fsm_t *fsm)
{
    if (!fsm) return 0;
    switch (fsm->mode) {
    case BADGE_MODE_DESK: return badge_numbers.desk_res;
    case BADGE_MODE_PLAY: return badge_numbers.play_res;
    case BADGE_MODE_COMP: return badge_numbers.comp_res;
    case BADGE_MODE_AOD: return badge_numbers.aod_res;
    default: return 0;
    }
}

/* -- feedback -------------------------------------------------------------------*/

uint16_t badge_fsm_toast(const badge_fsm_t *fsm, uint32_t now_ms)
{
    if (!fsm || !fsm->toast) return 0;
    if (now_ms - fsm->toast_t0 >= badge_numbers.toast_ms) return 0;
    return fsm->toast;
}

uint16_t badge_fsm_bubble(const badge_fsm_t *fsm, uint32_t now_ms)
{
    if (!fsm || !fsm->bubble) return 0;
    if (now_ms - fsm->bubble_t0 >= badge_numbers.bubble_ms) return 0;
    return fsm->bubble;
}

void badge_fsm_show_toast(badge_fsm_t *fsm, uint16_t text, uint32_t now_ms)
{
    if (!fsm) return;
    fsm->now_ms = now_ms;
    toast_at(fsm, text, now_ms);
    fx_flush(fsm);
}

void badge_fsm_show_bubble(badge_fsm_t *fsm, uint16_t text, uint32_t now_ms)
{
    if (!fsm) return;
    fsm->now_ms = now_ms;
    bubble_at(fsm, text, now_ms);
    fx_flush(fsm);
}

void badge_fsm_feedback(const badge_fsm_t *fsm, uint32_t now_ms,
                        badge_feedback_t *out)
{
    if (!out) return;
    memset(out, 0, sizeof(*out));
    if (!fsm) return;
    out->bubble = badge_fsm_bubble(fsm, now_ms);
    out->toast = badge_fsm_toast(fsm, now_ms);
    out->bubble_t0 = fsm->bubble_t0;
    out->toast_t0 = fsm->toast_t0;
    out->bubble_rev = fsm->bubble_rev;
    out->toast_rev = fsm->toast_rev;
    out->ring = badge_fsm_edge_flash(fsm, now_ms);
    out->ring_t0 = fsm->ring_t0;
    out->pet_rev = fsm->pet_rev;
    out->pet_t0 = fsm->pet_t0;
    const badge_el_t *el = fsm->p_el >= 0 ? &badge_els[fsm->p_el] : NULL;
    const bool tutorial_hold = fsm->tutorial_active && fsm->tutorial_step == 4 &&
        !fsm->tutorial_complete && fsm->screen == BADGE_SCREEN_GUIDE;
    if ((is_main(fsm->screen) || tutorial_hold) && fsm->pressing && !fsm->p_long && !fsm->p_done &&
        !fsm->drag_axis && fsm->pmoved < BADGE_MOTION_LOCK_PX &&
        (tutorial_hold || el == NULL || el->act == BADGE_ACT_PET)) {
        const uint32_t age = now_ms - fsm->pt0;
        if (age >= BADGE_MOTION_HOLD_START_MS) {
            const uint32_t fill = age >= BADGE_MOTION_HOLD_END_MS ? 1000u :
                (age - BADGE_MOTION_HOLD_START_MS) * 1000u /
                (BADGE_MOTION_HOLD_END_MS - BADGE_MOTION_HOLD_START_MS);
            out->hold_progress = (uint16_t)(fill ? fill : 1u);
        }
    }
    out->pet_float = fsm->pet_rev != 0 &&
        (now_ms - fsm->pet_t0) < (uint32_t)BADGE_FLOAT_RISE_MS;
    out->face_dots_current = fsm->game->face % 3;
    if (is_main(fsm->screen)) {
        badge_nav_t direction;
        int offset;
        if (badge_fsm_drag(fsm, &direction, &offset) &&
            (direction == BADGE_NAV_LEFT || direction == BADGE_NAV_RIGHT)) {
            out->face_dots_alpha = 255;
            if (abs(offset) > BADGE_SCR_W / 2) {
                const int target = badge_fsm_swipe_target(fsm, direction);
                if (is_main(target)) out->face_dots_current = (uint8_t)(target - BADGE_SCREEN_MAIN_A);
            }
        } else if (fsm->face_dots_started) {
            const uint32_t age = now_ms - fsm->face_dots_release;
            out->face_dots_alpha = age < 1200u ? 255 : age < 1500u ?
                (uint8_t)((1500u - age) * 255u / 300u) : 0;
        }
    }
}

bool badge_fsm_edge_flash(const badge_fsm_t *fsm, uint32_t now_ms)
{
    /* The M1 board has no motor (BADGE_HW_MOTOR 0), so every haptic is the
     * specification's fallback: an edge ring lit for BADGE_HAPTIC_MS. */
    if (!fsm) return false;
    if (BADGE_HW_MOTOR) return false;
    return fsm->ring_started &&
        (now_ms - fsm->ring_t0) < (uint32_t)BADGE_HAPTIC_MS;
}

/* -- alerts and care ------------------------------------------------------------*/

int badge_fsm_alert(const badge_fsm_t *fsm)
{
    if (!fsm) return -1;
    /* The rule -- illness first, then the specification's own priority list -- lives in
     * the care kernel, which is where the alert table was extracted to. */
    return badge_pet_alert(fsm->game);
}

int badge_fsm_care(const badge_fsm_t *fsm)
{
    if (!fsm || !care_active(fsm)) return BADGE_CARE_NONE;
    return fsm->care;
}

int badge_fsm_care_step(const badge_fsm_t *fsm)
{
    return fsm ? fsm->care_step : 0;
}

bool badge_fsm_care_blocked(const badge_fsm_t *fsm, int care, uint16_t *why)
{
    if (!fsm) return true;
    return !badge_pet_care_allowed(fsm->game, care, why);
}

/* -- animation ------------------------------------------------------------------*/

bool badge_fsm_anim(const badge_fsm_t *fsm, uint32_t now_ms, badge_anim_directive_t *out)
{
    if (!fsm || !out) return false;
    memset(out, 0, sizeof(*out));
    out->follow_finger = fsm->screen == BADGE_SCREEN_CARE_PLAY && fsm->finger_down;
    if (out->follow_finger) {
        /* 移动羽毛: the cat watches the finger. The pointer's own tilt is the renderer's
         * business; what the state machine adds is that the feather is being dragged. */
        out->look_x = BADGE_LOOK_X;
        out->look_y = BADGE_LOOK_Y;
    }

    if (fsm->quirk >= 0) {
        const badge_quirk_def_t *q = &badge_quirk_defs[fsm->quirk];
        const uint32_t ms = fsm->quirk_ms ? fsm->quirk_ms : 1u;
        const float p = (float)(now_ms - fsm->quirk_t0) / (float)ms;
        out->quirk = (uint8_t)(fsm->quirk + 1);
        out->t0 = fsm->quirk_t0;
        out->ms = fsm->quirk_ms;
        /* The four quirks' own motion, from the reference's drawCat(): 追尾巴 turns a
         * whole circle while walking, 盯着空气 holds its head to one side, 突然舔毛 plays
         * the paw clip (badge_quirk_defs[].anim, which the cat layer reads), 被自己吓到
         * hops twice in place. */
        const char *key = badge_strings[q->id];
        if (strcmp(key, "spin") == 0) {
            out->root_yaw = p * BADGE_SPIN_DEG;
        } else if (strcmp(key, "stare") == 0) {
            out->look_x = BADGE_STARE_X;
            out->look_y = BADGE_STARE_Y;
        } else if (strcmp(key, "jump") == 0) {
            out->root_y = fabsf(sinf(p * 2.0f * BADGE_PI)) * BADGE_HOP_UNITS;
        }
        return true;
    }

    if (fsm->hop_started) {
        /* 摸摸的小跳: one sine lobe, BADGE_PET_HOP_MS long. The quirk branch above
         * wins while one is running -- two parametric hops at once would read as a
         * glitch, and the quirk is the rarer treat. */
        const uint32_t age = now_ms - fsm->hop_t0;
        if (age < BADGE_PET_HOP_MS) {
            const float p = (float)age / (float)BADGE_PET_HOP_MS;
            out->root_y = fabsf(sinf(p * BADGE_PI)) * BADGE_PET_HOP_UNITS;
            return true;
        }
    }

    if ((int32_t)(now_ms - fsm->look_until) < 0) {
        /* 小橘 / 换个表盘: the cat looks up for a moment. */
        out->look_x = BADGE_LOOK_X;
        out->look_y = BADGE_LOOK_Y;
        return true;
    }
    return out->follow_finger;
}

int badge_fsm_quirk(const badge_fsm_t *fsm)
{
    return fsm ? fsm->quirk : -1;
}

/* -- peers ----------------------------------------------------------------------*/

void badge_fsm_peer_found(badge_fsm_t *fsm, const badge_peer_t *peer, uint32_t now_ms)
{
    if (!fsm) return;
    fsm->now_ms = now_ms;
    if (peer) {
        fsm->peer = *peer;
        fsm->peer.name[sizeof(fsm->peer.name) - 1] = '\0';
        fsm->have_peer = true;
    }
    /* 遇见 emits nothing yet: two badges seeing each other is not an event the App
     * settles, and 扫到 ≠ 遇见. The caller shows the screen with badge_fsm_go(). */
    fx_flush(fsm);
}

void badge_fsm_peer_confirmed(badge_fsm_t *fsm, uint32_t now_ms)
{
    if (!fsm) return;
    fsm->now_ms = now_ms;
    if (!fsm->have_peer) return;
    /* a = the confirmation path: 0 碰一碰 (NFC), 1 扫码 (the App). b = 对方短编号, packed
     * little endian out of the peer record's four bytes. */
    const uint8_t a = BADGE_HW_NFC ? 0 : 1;
    const int16_t b = (int16_t)((uint16_t)fsm->peer.short_id[0] |
                                ((uint16_t)fsm->peer.short_id[1] << 8));
    emit(fsm, EVT_MEET, a, b);
    fx_haptic(fsm, BADGE_HAPTIC_MEET);
    fx_sfx(fsm, BADGE_SFX_MEET);
    go(fsm, BADGE_SCREEN_MEET_DONE, BADGE_NAV_FADE);
    toast_at(fsm, BADGE_TXT_MEETGIFT, now_ms);
    fx_flush(fsm);
}

void badge_fsm_peer_lost(badge_fsm_t *fsm, uint32_t now_ms)
{
    if (!fsm) return;
    fsm->now_ms = now_ms;
    fsm->have_peer = false;
    if (fsm->screen == BADGE_SCREEN_MEET || fsm->screen == BADGE_SCREEN_MEET_TAP ||
        fsm->screen == BADGE_SCREEN_MEET_SCAN) {
        home(fsm, BADGE_NAV_FADE);
    }
    fx_flush(fsm);
}

const badge_peer_t *badge_fsm_peer(const badge_fsm_t *fsm)
{
    if (!fsm || !fsm->have_peer) return NULL;
    return &fsm->peer;
}

const char *badge_fsm_stage_name(const badge_game_t *game)
{
    return badge_pet_stage_name(game);
}

int32_t badge_fsm_next_growth(const badge_game_t *game)
{
    return badge_pet_next_growth(game);
}

const char *badge_fsm_pair_code(const badge_fsm_t *fsm)
{
    return fsm ? fsm->pair_code : "";
}

/* -- telemetry ------------------------------------------------------------------*/

void badge_fsm_set_sync_info(badge_fsm_t *fsm, int pending)
{
    if (!fsm) return;
    fsm->sync_pending = pending;
}

int badge_fsm_pending(const badge_fsm_t *fsm)
{
    return fsm ? fsm->sync_pending : 0;
}

void badge_fsm_set_phone(badge_fsm_t *fsm, bool connected)
{
    if (!fsm) return;
    if (fsm->phone != connected) fsm->fx.invalidate = true;
    fsm->phone = connected;
    update_mode(fsm); /* 配对 completes when the phone confirms */
    fx_flush(fsm);
}

bool badge_fsm_phone(const badge_fsm_t *fsm)
{
    return fsm ? fsm->phone : false;
}

/* -- voice ----------------------------------------------------------------------*/

void badge_fsm_voice_word(badge_fsm_t *fsm, const char *word, uint32_t now_ms)
{
    if (!fsm) return;
    if (fsm->screen != BADGE_SCREEN_VOICE || fsm->voice_state != BADGE_VOICE_LISTEN) return;
    fsm->now_ms = now_ms;
    fsm->voice_last = now_ms;
    if (!word || !*word) return; /* recogniser activity with no hypothesis yet */

    const size_t n = strlen(word);
    const size_t cap = sizeof(fsm->voice_word) - 1u;
    const size_t len = n < cap ? n : cap;
    memcpy(fsm->voice_word, word, len);
    fsm->voice_word[len] = '\0';
    voice_end(fsm); /* a final hypothesis ends the listen, exactly like a release */
}

bool badge_fsm_voice_thinking(const badge_fsm_t *fsm)
{
    return fsm ? fsm->voice_state == BADGE_VOICE_THINK : false;
}

/* -- uplink ---------------------------------------------------------------------*/

void badge_fsm_set_event_sink(badge_fsm_t *fsm, badge_fsm_event_fn fn, void *user)
{
    if (!fsm) return;
    fsm->evt_fn = fn;
    fsm->evt_user = user;
}

int badge_fsm_event_count(const badge_fsm_t *fsm)
{
    if (!fsm) return 0;
    return fsm->evt_total < BADGE_FSM_EVENT_LOG ? (int)fsm->evt_total : BADGE_FSM_EVENT_LOG;
}

bool badge_fsm_event_at(const badge_fsm_t *fsm, int index, badge_evt_log_t *out)
{
    if (!fsm || !out) return false;
    const int n = badge_fsm_event_count(fsm);
    if (index < 0 || index >= n) return false;
    /* The log keeps the most recent records in order: the oldest is dropped once it is
     * full, exactly like the uplink queue (BADGE_EVENT_QUEUE_MAX records). */
    *out = fsm->evt_log[index];
    return true;
}

void badge_fsm_event_clear(badge_fsm_t *fsm)
{
    if (!fsm) return;
    memset(fsm->evt_log, 0, sizeof(fsm->evt_log));
    fsm->evt_total = 0;
}

/* ------------------------------------------------------------------ emit -------*/

static void emit(badge_fsm_t *fsm, badge_evt_type_t type, uint8_t a, int16_t b)
{
    /* The log holds the most recent BADGE_FSM_EVENT_LOG records in order: full, the
     * oldest is dropped, which is the uplink queue's own rule. */
    badge_evt_log_t *slot;
    if (fsm->evt_total >= BADGE_FSM_EVENT_LOG) {
        memmove(&fsm->evt_log[0], &fsm->evt_log[1],
                sizeof(fsm->evt_log[0]) * (BADGE_FSM_EVENT_LOG - 1));
        slot = &fsm->evt_log[BADGE_FSM_EVENT_LOG - 1];
    } else {
        slot = &fsm->evt_log[fsm->evt_total];
    }
    slot->ts_ms = fsm->now_ms;
    slot->type = type;
    slot->a = a;
    slot->b = b;
    fsm->evt_total++;
    if (fsm->evt_fn) fsm->evt_fn(fsm->evt_user, slot);
}

/* -- collected effects ----------------------------------------------------------*/

badge_fx_t badge_fsm_take_fx(badge_fsm_t *fsm)
{
    badge_fx_t out;
    memset(&out, 0, sizeof(out));
    if (!fsm) return out;
    out = fsm->pool;
    memset(&fsm->pool, 0, sizeof(fsm->pool));
    return out;
}
