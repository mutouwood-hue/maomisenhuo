/*
 * badge_fsm - the badge's rules and screen flow, with no LVGL in sight.
 *
 * Everything the specification says about *behaviour* lives here: which screen is
 * current, the five gestures and when each one fires, the five care flows and their
 * numbers, the five working modes and their auto-down timers, the four quirks, the
 * alert rule, the guide pages, the settings, the encounter flow, the wake causes
 * and what each of them emits upstream.
 *
 * It is deliberately free of LVGL, hardware and the radio, exactly like
 * pet_state.c was: that is what lets tests/host/test_badge_fsm.c drive a whole
 * interaction on a PC -- press, move, release, watch the screen change, the event
 * queue fill and the care numbers move -- including the paths that are impossible
 * to reproduce by hand (a care cancelled halfway, a quirk caught at the right
 * moment, the AOD ladder under a silent clock).
 *
 * The reference implementation of all of this is 吧唧渲染参考.html: `go()`,
 * `swipe()`, `act()`, `tick()`, `updateMode()` and `visible()`.
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "badge_spec_data.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ---------------------------------------------------------------- game ------*/

/* The badge's own view of the pet. The App is authoritative (the badge's events
 * are settled there); this is what the glass can show while offline, and what the
 * status screen and the lock rules read. */
typedef struct {
    uint8_t  stat[BADGE_STAT_COUNT]; /* 0..100 */
    int32_t  growth;
    int32_t  coins;
    bool     sick;
    uint8_t  face;        /* 0..2: which main dial */
    uint8_t  guide_page;  /* 0..BADGE_GUIDE_COUNT-1 */
    uint8_t  bright;      /* 0 低 / 1 中 / 2 高 */
    bool     wake_word;
    bool     discover;
    bool     aod;
    char     name[13];    /* UTF-8, NUL padded */
    uint8_t  breed;       /* 0..5, the cat3d palette */
} badge_game_t;

/** @brief The three brightness levels of the settings screen (低/中/高). */
#define BADGE_BRIGHT_LEVELS 3
extern const uint8_t badge_bright_scale_pct[BADGE_BRIGHT_LEVELS];

/* ---------------------------------------------------------------- modes -----*/

typedef enum {
    BADGE_MODE_DESK = 0, /* 桌面充电态：USB 供电、放平静止 */
    BADGE_MODE_PLAY,     /* 互动态：半分辨率，10 秒无操作回陪伴态 */
    BADGE_MODE_COMP,     /* 陪伴态：默认，30 秒无操作进待机态 */
    BADGE_MODE_AOD,      /* 待机常显：不渲染 3D，每分钟重画时间 */
    BADGE_MODE_OFF,      /* 息屏 */
    BADGE_MODE_COUNT
} badge_mode_t;

/* ---------------------------------------------------------------- state -----*/

/* Which one-shot animation the cat is playing, if any. */
typedef struct {
    uint8_t  quirk;     /* BADGE_QUIRK_NONE, or an index + 1 while one is running */
    uint32_t t0;        /* start of the one-shot animation */
    uint32_t ms;        /* its length */
    float    root_yaw;  /* extra turntable rotation, degrees (追尾巴) */
    float    root_y;    /* hop height in model units (被自己吓到) */
    float    look_x, look_y; /* head-look override in degrees (盯着空气) */
    bool     follow_finger;
} badge_anim_directive_t;

#define BADGE_QUIRK_NONE 0

/* What the UI has to do after an interaction. Any field left zero means "nothing".
 * Keeping the effects in a return value (rather than calling the UI from here) is
 * what keeps this module host-testable. */
typedef struct {
    uint16_t sfx;     /* BADGE_SFX_* bitmask */
    uint8_t  haptic;  /* badge_haptic_kind_t, or BADGE_HAPTIC_NONE */
    uint16_t toast;   /* index into badge_strings[], 0 = none */
    uint16_t bubble;  /* index into badge_strings[], 0 = none */
    bool     went_home;
    bool     started_care;
    bool     finished_care;
    bool     cancelled_care;
    bool     invalidate; /* the whole face needs a repaint */
} badge_fx_t;

/* Read-only visual feedback. Active flags make t0=0 and clock wrap valid. */
typedef struct {
    uint16_t bubble, toast;
    uint32_t bubble_t0, toast_t0, ring_t0, pet_t0;
    uint32_t bubble_rev, toast_rev, pet_rev;
    bool ring, pet_float;
    uint16_t hold_progress; /* 0=hidden, 1..1000 clockwise fill. */
    uint8_t face_dots_alpha, face_dots_current;
} badge_feedback_t;


#define BADGE_SFX_PET       (1u << SND_PET)
#define BADGE_SFX_CARE_DONE (1u << SND_CARE_DONE)
#define BADGE_SFX_MEET      (1u << SND_MEET)
#define BADGE_SFX_WAKE      (1u << SND_WAKE)
#define BADGE_SFX_ERROR     (1u << SND_ERROR)

typedef enum {
    BADGE_HAPTIC_NONE = 0,
    BADGE_HAPTIC_MEET,
    BADGE_HAPTIC_CARE_DONE,
    BADGE_HAPTIC_WAKE,
    BADGE_HAPTIC_ERROR,
    BADGE_HAPTIC_COUNT
} badge_haptic_kind_t;

/* An encounter, as the app layer reports it in. */
typedef struct {
    char     name[13];
    uint8_t  breed;
    uint8_t  stage;
    uint8_t  short_id[4];
} badge_peer_t;

#include "badge_onboarding.h"

typedef struct badge_fsm badge_fsm_t;
/* Attach persisted onboarding before boot; NULL leaves the legacy test/preview model. */
void badge_fsm_set_onboarding(badge_fsm_t *fsm, badge_onboarding_t *state);
/* Only an authenticated App adapter may call this, never GAP connection state. */
void badge_fsm_binding_verified(badge_fsm_t *fsm, uint32_t unix_seconds, uint32_t now_ms);
/* Code must come from the authenticator. No generated code = waiting placeholder. */
bool badge_fsm_set_pair_code(badge_fsm_t *fsm, const char *six_digits);
typedef struct {
    bool active, returning, complete, help, touching, dragging;
    uint8_t step, error; /* 1=direction, 2=distance, 3=hold longer. */
    badge_nav_t direction;
    uint32_t elapsed_ms;
    uint32_t screen_elapsed_ms;
} badge_tutorial_view_t;
void badge_fsm_tutorial_view(const badge_fsm_t *fsm, badge_tutorial_view_t *out);
bool badge_fsm_local_experience(const badge_fsm_t *fsm);
bool badge_fsm_start_local_experience(badge_fsm_t *fsm, uint32_t now_ms);
void badge_fsm_tutorial_replay(badge_fsm_t *fsm, uint32_t now_ms);
void badge_fsm_set_unix_time(badge_fsm_t *fsm, uint32_t unix_seconds, uint32_t now_ms);
typedef struct {
    uint8_t directions; /* bit0=up, bit1=down, bit2=left, bit3=right */
    bool return_hint, nudge;
    uint8_t nudge_skill;
    uint32_t nudge_elapsed;
    badge_nav_t return_direction;
} badge_hint_view_t;
void badge_fsm_hint_view(const badge_fsm_t *fsm, badge_hint_view_t *out);

void badge_fsm_feedback(const badge_fsm_t *fsm, uint32_t now_ms,
                        badge_feedback_t *out);

/* ---------------------------------------------------------------- lifecycle -*/

/**
 * @brief Create the state machine.
 *
 * @param game  borrowed, never copied: the UI reads its numbers straight from here
 * @param now_ms monotonic milliseconds, the clock every timing rule is measured on
 */
badge_fsm_t *badge_fsm_create(badge_game_t *game, uint32_t now_ms);
void badge_fsm_destroy(badge_fsm_t *fsm);

/* ---------------------------------------------------------------- clock -----*/

/** @brief Advance timers, modes, quirks and the care flow. Call from the app tick. */
void badge_fsm_tick(badge_fsm_t *fsm, uint32_t now_ms);

/** @brief Current clock, in minutes since midnight (demo start: 18:40, spec 12.7). */
int badge_fsm_now_min(const badge_fsm_t *fsm);

/** @brief Set the time of day, in minutes since midnight (the App syncs it). */
void badge_fsm_set_time(badge_fsm_t *fsm, int now_min);

/* ---------------------------------------------------------------- screens ---*/

int badge_fsm_screen(const badge_fsm_t *fsm);
int badge_fsm_visual_screen(const badge_fsm_t *fsm);
const badge_screen_def_t *badge_fsm_screen_def(const badge_fsm_t *fsm);

/**
 * @brief Switch screens, with the reference's transition.
 *
 * `dir` is BADGE_NAV_FADE for the fade used by timeout-driven changes, or the swipe
 * direction. Entering a screen resets the care step, the guide page and the touch
 * self-test, and arms the screen's own timeout (遇见 30 s, 成为朋友 4 s, ...).
 */
void badge_fsm_go(badge_fsm_t *fsm, int screen, badge_nav_t dir);

/** @brief True while the transition animation is still running. */
bool badge_fsm_transitioning(const badge_fsm_t *fsm, uint32_t now_ms);

/** @brief Direction of the running transition, for the UI's slide. */
badge_nav_t badge_fsm_transition_dir(const badge_fsm_t *fsm);

/* ---------------------------------------------------------------- input -----*/

/* The three LVGL press events, in screen coordinates. The gesture set is the
 * specification's: tap (<= tapMaxMs and <= tapMoveMax px), swipe up / down /
 * left / right (>= swipeMinPx within swipeMaxMs), long press (>= longPressMs). */
void badge_fsm_press(badge_fsm_t *fsm, int x, int y, uint32_t now_ms);
void badge_fsm_move(badge_fsm_t *fsm, int x, int y, uint32_t now_ms);
void badge_fsm_release(badge_fsm_t *fsm, int x, int y, uint32_t now_ms);

/* Read-only preview: no settlement, event or screen mutation. */
int badge_fsm_swipe_target(const badge_fsm_t *fsm, badge_nav_t dir);
bool badge_fsm_drag(const badge_fsm_t *fsm, badge_nav_t *dir, int *offset);

/** @brief Run an element's action directly (used by tests and by the app layer). */
badge_fx_t badge_fsm_act(badge_fsm_t *fsm, int act, uint32_t now_ms);

/* ---------------------------------------------------------------- keys -------*/

/*
 * The board's two physical keys. They are NOT in the interaction specification: its
 * input model is the touchscreen alone and its hw table lists no buttons.
 * docs/hardware-buttons.md proves both keys exist and how each one is read, so the
 * mapping from key to verb lives here -- next to the gesture verbs, and reachable from
 * the host tests -- while main.c only forwards what the hardware reported.
 */
typedef enum {
    BADGE_BTN_CROWN = 0, /**< beside the crown; the AXP2101's PWRON input, no GPIO */
    BADGE_BTN_LOWER,     /**< the lower oval key; GPIO0, the BOOT strapping pin */
    BADGE_BTN_COUNT
} badge_btn_t;

typedef enum {
    BADGE_BTN_EVT_CLICK = 0, /**< a completed short press */
    BADGE_BTN_EVT_HOLD,      /**< held past the specification's longPressMs */
    BADGE_BTN_EVT_HOLD_END,  /**< that hold was released */
} badge_btn_evt_t;

/**
 * @brief One event from a physical key.
 *
 *   crown + CLICK     the badge is dark -> wake it (EVT_WAKE with a=EVT_WAKE_BUTTON),
 *                     else go home to the main dial. This is the specification's
 *                     抬起、触摸、唤醒词回到互动态 with a fourth trigger.
 *   crown + anything else
 *                     ignored: a long press on this key is the PMIC's hardware
 *                     power-off (OFFLEVEL, 6 s by default), which firmware cannot
 *                     intercept. docs/hardware-buttons.md §3.2.
 *   lower + CLICK     抚摸, on screens whose specification declares tap_cat -- the same
 *                     gate do_tap() consults, so the key can never pet on a screen where
 *                     a tap means something else, and it never navigates on its own (that
 *                     is the crown key's job). On 待机常显 it wakes instead: a key that
 *                     does nothing at all on a dark badge reads as broken.
 *   lower + HOLD      按住说话 starts, on screens that declare `long`, exactly as a
 *                     finger on the glass would.
 *   lower + HOLD_END  the listen ends, as releasing the glass does.
 *
 * Effects go to the same pool as every other input verb, so the app's per-tick
 * badge_fsm_take_fx() drains them without a second path.
 */
void badge_fsm_button(badge_fsm_t *fsm, badge_btn_t btn, badge_btn_evt_t evt, uint32_t now_ms);

/**
 * @brief Which element is under a point on the current screen.
 * @return index into badge_els[], or -1. Follows the reference's hitTest(): the
 *         last matching element wins, so later elements are on top.
 */
int badge_fsm_hit_test(const badge_fsm_t *fsm, int x, int y);

/* ---------------------------------------------------------------- state -----*/

/** @brief The pet's numbers, for the UI to render (never NULL). */
badge_game_t *badge_fsm_game(badge_fsm_t *fsm);
const badge_game_t *badge_fsm_game_const(const badge_fsm_t *fsm);

/** @brief Current working mode. */
badge_mode_t badge_fsm_mode(const badge_fsm_t *fsm);

/**
 * @brief Mode inputs the hardware supplies.
 *
 * `usb` and `flat` place the badge in the desk mode; `raise` is the IMU's
 * raise-to-wake, `touch`/`word` the other two wake causes of EVT_WAKE.
 */
void badge_fsm_set_battery(badge_fsm_t *fsm, int pct, bool valid, bool usb, uint32_t now_ms);
bool badge_fsm_low_battery(const badge_fsm_t *fsm);
void badge_fsm_set_power(badge_fsm_t *fsm, bool usb, bool flat);
void badge_fsm_wake(badge_fsm_t *fsm, uint8_t cause, uint32_t now_ms);

/** @brief Backlight percentage the current mode and settings ask for. */
int badge_fsm_backlight_pct(const badge_fsm_t *fsm);

/** @brief Frames per second the current mode renders at (0 = do not render the cat). */
int badge_fsm_fps(const badge_fsm_t *fsm);

/** @brief Render resolution for the cat layer (233 in play mode, else 466). */
int badge_fsm_res(const badge_fsm_t *fsm);

/* ---------------------------------------------------------------- feedback --*/

/** @brief Index of the string currently shown as a toast, or 0. */
uint16_t badge_fsm_toast(const badge_fsm_t *fsm, uint32_t now_ms);

/** @brief Index of the string currently shown in the cat's bubble, or 0. */
uint16_t badge_fsm_bubble(const badge_fsm_t *fsm, uint32_t now_ms);

/** @brief Show a toast (used by the App link and by the UI). */
void badge_fsm_show_toast(badge_fsm_t *fsm, uint16_t text, uint32_t now_ms);

/** @brief Show a bubble (the cat's speech). */
void badge_fsm_show_bubble(badge_fsm_t *fsm, uint16_t text, uint32_t now_ms);

/** @brief True while the haptic-fallback edge ring should be lit (no motor). */
bool badge_fsm_edge_flash(const badge_fsm_t *fsm, uint32_t now_ms);

/* ---------------------------------------------------------------- alerts ----*/

/**
 * @brief Which alert the head bubble shows, as an index into badge_alerts[], or -1.
 *
 * The rule is the specification's fixed priority list, which the reference renderer
 * states outright: 不舒服 > 饱腹 > 精力 > 心情 > 清洁, each only while below `lowStat`.
 * It is a priority order, NOT "the lowest stat wins" -- the two disagree as soon as
 * two stats are low at once, and the specification's order is what the glass shows.
 * Call badge_pet_alert() in main/pet/badge_pet.c rather than reimplementing it.
 */
int badge_fsm_alert(const badge_fsm_t *fsm);

/* ---------------------------------------------------------------- care ------*/

/** @brief The care flow in progress, or BADGE_CARE_NONE. */
int badge_fsm_care(const badge_fsm_t *fsm);

/** @brief Steps completed in the care flow in progress. */
int badge_fsm_care_step(const badge_fsm_t *fsm);

/** @brief True when the care's own guard refuses it (餵饱了 / 没力气了 / ...). */
bool badge_fsm_care_blocked(const badge_fsm_t *fsm, int care, uint16_t *why);

/* ---------------------------------------------------------------- quirks ----*/

/**
 * @brief The one-shot animation the cat should be playing, if any.
 *
 * Fills `out` and returns true while one is running. Quirks (追尾巴, 盯着空气,
 * 突然舔毛, 被自己吓到) are chosen by badge_fsm_tick() at the specification's
 * intervals; a one-shot animation may also be started by an interaction.
 */
bool badge_fsm_anim(const badge_fsm_t *fsm, uint32_t now_ms, badge_anim_directive_t *out);

/** @brief Index of the running quirk, or -1. */
int badge_fsm_quirk(const badge_fsm_t *fsm);

/* ---------------------------------------------------------------- peers -----*/

/** @brief An encounter was discovered (the radio's callback). */
void badge_fsm_peer_found(badge_fsm_t *fsm, const badge_peer_t *peer, uint32_t now_ms);

/** @brief The encounter was confirmed by the App (scan) or by NFC. */
void badge_fsm_peer_confirmed(badge_fsm_t *fsm, uint32_t now_ms);

/** @brief The peer went away, or the prompt timed out. */
void badge_fsm_peer_lost(badge_fsm_t *fsm, uint32_t now_ms);

/** @brief The peer currently on the 遇见 screens, or NULL. */
const badge_peer_t *badge_fsm_peer(const badge_fsm_t *fsm);

/** @brief The life stage name for the current growth ("幼猫"/"少年猫"/"成年猫"). */
const char *badge_fsm_stage_name(const badge_game_t *game);

/** @brief Growth needed for the next stage, or the current stage's own threshold. */
int32_t badge_fsm_next_growth(const badge_game_t *game);

/** @brief The short pairing code shown on the 配对 screen. */
const char *badge_fsm_pair_code(const badge_fsm_t *fsm);

/* ---------------------------------------------------------------- telemetry -*/

/** @brief The badge's own uplink queue depth, surfaced on the 状态 screen. */
void badge_fsm_set_sync_info(badge_fsm_t *fsm, int pending);
int  badge_fsm_pending(const badge_fsm_t *fsm);

/** @brief Phone link state, for the bluetooth icon and {phoneText}. */
void badge_fsm_set_phone(badge_fsm_t *fsm, bool connected);

/**
 * @brief Whether the phone link is up, as last set by badge_fsm_set_phone().
 *
 * The read side of set_phone(), for the UI. It lives here so the display half of the
 * badge never reaches into main/net/ to ask the radio: the state machine already
 * holds the answer, and {phoneText} / the bluetooth icon must agree with the mode
 * logic that the same flag drives.
 */
bool badge_fsm_phone(const badge_fsm_t *fsm);

/* ---------------------------------------------------------------- voice -----*/

/**
 * @brief Hand the voice flow one report from the recogniser.
 *
 * The 按住说话 flow is otherwise entirely local: the long press (or the wake word)
 * enters the voice screen, listening ends on release, on `voiceSilenceMs` of silence
 * or at the `voiceMaxMs` cap, and `voiceThinkMs` later the reply is resolved. The two
 * things this module cannot know are *what was said* and *whether anything is still
 * being said*, so both arrive here, and the device's audio task is the only caller.
 *
 *   * a non-empty `word` is a final hypothesis. It is matched against the
 *     specification's own command words (badge_voice_defs[]), EVT_VOICE_CMD is
 *     emitted with a = that command's number, and the command's `action`
 *     ("come" / "pet" / "feed" / "water" / "play" / "sleep" / "night" / "say" /
 *     "status" / "face" / "look") is carried out. A word no command matches is a free
 *     question: EVT_VOICE_FREE when the phone link is up, and the
 *     specification's 手机没连上 wording when it is not.
 *   * an empty or NULL `word` is recogniser *activity* with no hypothesis yet: it
 *     only restarts the `voiceSilenceMs` window, which is what ends the listen once
 *     the owner stops talking.
 *
 * Does nothing unless the voice screen is listening, so a late hypothesis from a
 * finished turn cannot re-open it. Exists so tests/host/test_badge_fsm.c can walk
 * all seventeen commands without a microphone.
 */
void badge_fsm_voice_word(badge_fsm_t *fsm, const char *word, uint32_t now_ms);

/**
 * @brief Whether the voice flow is in its "想一想…" phase rather than listening.
 *
 * The read side of the voice flow's own state, for {voiceState}. The reference picks
 * between S.texts.thinking and S.texts.listening from exactly this distinction
 * (line 1339), and the state machine is where the distinction lives.
 */
bool badge_fsm_voice_thinking(const badge_fsm_t *fsm);

/* ---------------------------------------------------------------- uplink ----*/

/**
 * @brief One record this module would send to the phone.
 *
 * The fourteen types, their `a` and their `b` are the specification's (spec 9), and
 * the wire form is main/net/badge_events.c's: `uint32 ts | uint8 type | uint8 a |
 * int16 b`. This record exists so the rules and the transport stay apart -- the
 * display half of the badge never calls into the radio, so it is a plain value.
 */
typedef struct {
    uint32_t         ts_ms; /* monotonic ms, as handed to the event call */
    badge_evt_type_t type;
    uint8_t          a;
    int16_t          b;
} badge_evt_log_t;

/**
 * @brief Where emitted events go.
 *
 * Called once per event, in order. The app wire it to badge_events_push() at start-up;
 * tests/host/test_badge_fsm.c leaves it unset and reads badge_fsm_event_count()
 * instead. A sink must not call back into the state machine.
 */
typedef void (*badge_fsm_event_fn)(void *user, const badge_evt_log_t *evt);

void badge_fsm_set_event_sink(badge_fsm_t *fsm, badge_fsm_event_fn fn, void *user);

/**
 * @brief The events emitted so far, oldest first, for tests and for the log line.
 *
 * The log keeps the most recent BADGE_FSM_EVENT_LOG records; the oldest is dropped
 * once it is full, exactly like the uplink queue.
 */
#define BADGE_FSM_EVENT_LOG 64
int  badge_fsm_event_count(const badge_fsm_t *fsm);
bool badge_fsm_event_at(const badge_fsm_t *fsm, int index, badge_evt_log_t *out);
void badge_fsm_event_clear(badge_fsm_t *fsm);

/**
 * @brief Collect the effects accumulated since the last call, and reset them.
 *
 * The badge_fx_t returned by badge_fsm_act() belongs to that call alone; this is the
 * batch for everything else (a gesture, a tick, an encounter) since it was last read,
 * which is what the app tick hands to the UI, the codec and the haptics driver.
 */
badge_fx_t badge_fsm_take_fx(badge_fsm_t *fsm);

#ifdef __cplusplus
}
#endif
