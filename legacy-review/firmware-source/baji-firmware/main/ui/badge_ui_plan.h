/*
 * badge_ui_plan - what the next frame has to repaint, decided with no LVGL in sight.
 *
 * WHY THIS FILE IS SEPARATE FROM badge_ui.c
 * -----------------------------------------
 * Repaint discipline is the one part of a screen system that cannot be checked by
 * looking at a screenshot. "A stat arc moving by one point repaints one band of
 * pixels, not 466x466 over QSPI" is a claim about *which boxes changed*, and the only
 * way to keep it true is to make the decision in a module a host test can drive.
 *
 * So this half owns exactly one question: given the previous frame's state and this
 * frame's, which elements' drawing inputs changed? It answers with the list of boxes
 * badge_ui.c then repaints, and with `full` when the answer is "everything".
 *
 * badge_paint_state_t (badge_paint.h) is the state struct the painters read, so the
 * previous frame's copy is a badge_paint_state_t and this header includes
 * badge_paint.h -- which reaches lvgl.h for lv_obj_t/lv_color_t. Nothing in this
 * module *calls* LVGL: the host test supplies tests/host/lvgl_plan_stub/lvgl.h, which
 * carries the four types badge_paint.h names and nothing else. badge_paint.c is not
 * linked into that test at all (see tools/suite/04-frame.cmd).
 *
 * No ESP-IDF, no FreeRTOS, no malloc: the plan is one struct the caller owns.
 *
 * WHAT COUNTS AS "CHANGED"
 * ------------------------
 * An element is reported when any input *badge_paint_el() reads* differs from the
 * previous frame's: its resolved text (for labels and pills), its own stat's value,
 * the care step, the battery percentage and charger flag, the clock minute, the alert
 * and its pulse, the page-dot value, the finger position for BE_FEATHER, the wave
 * phase for BE_WAVE, and the animation phase for BE_HEARTS/BE_DOTS/BE_ZZZ. An element
 * whose inputs cannot change -- a static label, a ring outline, a painted button, an
 * icon, the QR square, a pill's own box -- is never reported after a rebuild.
 *
 * Two inputs are not fields of badge_paint_state_t, because they come from the spec
 * rather than from the painter's state struct, and they are announced separately:
 *
 *   badge_ui_plan_dyn()       the guide page and the place, which the two dynamic
 *                             icons ({guideIcon} / {placeIcon}) resolve from;
 *   badge_ui_plan_settings()  the four settings, which the BE_TOGGLE elements show.
 *
 * Two honest notes about painters that read the raw clock:
 *
 *   * badge_paint_el() draws BE_ZZZ, a BE_DOTS strip with BADGE_ELF_ANIM and BE_HEARTS
 *     from st->now_ms, not from st->anim_phase. Those elements are therefore reported
 *     on every tick that advances the clock -- which is correct, because they animate
 *     continuously -- and the plan tracks both fields, so whichever the painter reads
 *     is covered.
 *   * BE_FEATHER reads the finger while the finger is down and the raw clock's idle
 *     drift (`C + 60 sin(1.2 ts)`, `330 + 10 sin(2 ts)`) while it is not. Its digest
 *     switches between the two, so a still finger does not repaint anything and a
 *     raised one drifts as the reference does.
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "badge_geom.h"  /* badge_box_t, and the box arithmetic this module reuses */
#include "badge_paint.h" /* badge_paint_state_t */
#include "badge_spec_data.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ------------------------------------------------------------------ limits ---*/

/*
 * The specification's biggest screen is 状态 with 27 elements, so a plan holds 32.
 * A screen that ever grew past this is clamped rather than overrun, and
 * badge_ui_plan_capacity() lets the test assert the table still fits.
 */
#define BADGE_UI_PLAN_MAX_EL 32

/*
 * How much of an element's resolved text the plan keeps. The longest resolved string
 * the specification can produce through {token} substitution measures 33 bytes; the
 * stored copy is 64 so there is headroom, and the full-length hash (below) keeps a
 * text that somehow grew longer than the copy from looking unchanged.
 */
#define BADGE_UI_PLAN_TEXT_CAP 64

/** @brief Elements one plan can hold -- pass this as `max` to never see `full`. */
int badge_ui_plan_capacity(void);

/* ------------------------------------------------------- template expanding ---*/

/** @brief Number of settings a BE_TOGGLE can show (badge_spec_data.h BADGE_SETTING_*). */
#define BADGE_UI_SETTING_COUNT (BADGE_SETTING_AOD + 1)
/**
 * @brief The values the specification's `{token}` strings are filled from.
 *
 * One field per token the reference's `fill()` substitutes -- the test's token
 * contract in tests/host/test_badge_geom.c lists all of them. `stat` is the five
 * stats in badge_stat_t order and feeds {food}..{health}; `name` is the pet's name;
 * every other pointer may be NULL, which expands that token to the empty string.
 *
 * The two dynamic icon names ({guideIcon} / {placeIcon}) live here because they are
 * the tokens the reference substitutes into an icon element, even though this module
 * does not paint icons: badge_ui.c resolves them with badge_icon_index().
 */
typedef struct {
    const char *name;

    const uint8_t *stat;      /* BADGE_STAT_COUNT values, 0..100 */

    int         coins;
    int         growth;
    int32_t     next_growth;
    const char *stage;        /* 幼猫 / 少年猫 / 成年猫 */
    int         bat;          /* battery percentage */
    const char *phone_text;
    const char *sync_text;
    const char *time;         /* "09:41" */
    const char *pair_code;
    const char *peer;
    const char *peer_breed;
    const char *meet_gift;
    const char *place_text;
    const char *place_sub;
    const char *guide_title;
    const char *guide_sub;
    const char *bright_text;
    const char *tt_xy;
    const char *tt_text;
    const char *voice_state;
    const char *ver;
    const char *sleep_now;

    int         step;
    int         n;            /* the pending-event count of "{n} 条互动待同步" */

    const char *guide_icon;   /* an icon name, resolved by badge_assets.h */
    const char *place_icon;

    /*
     * {careLabel:<key>}, one entry per badge_care_keys[] entry.
     *
     * This is the parameterised token, and the reference substitutes a care's
     * *refusal* text when it is currently refused and the care's own label otherwise
     * (`blockOf(k) || S.care[k].label`, line 1343). So NULL here means "nothing is
     * refusing it" and the expansion falls back to badge_care_defs[i].label --
     * "{careLabel:feed}" is "喂食" on a normal day and "已经吃饱啦" when it is not.
     */
    const char *care_label[BADGE_CARE_COUNT_SPEC];
} badge_ui_vars_t;

/**
 * @brief Expand one template.
 *
 * Implements the reference's `fill()`: `{careLabel:<key>}` first (against
 * badge_care_keys[], with vars->care_label[] supplying a care's refusal text when it
 * has one), then every `{token}` in the table above. A token that is not in the table
 * -- or a `{careLabel:...}` whose key is not one of the five care keys -- expands to
 * NOTHING and increments badge_ui_expand_unknown(), because a literal `{typo}` drawn
 * on the glass is a visible bug with no other symptom.
 *
 * Substituted values are expanded again, up to four levels: the specification's
 * places are stored as "{name}在公司楼下花坛", so `{placeText}` has to resolve twice --
 * exactly what the reference's two `replace()` passes are for.
 *
 * @param out  receives the result, always NUL-terminated
 * @param cap  its size in bytes
 * @return the number of bytes the expansion NEEDS, as snprintf does: a return value
 *         >= cap means the text was truncated and the caller's buffer is too small.
 */
int badge_ui_expand(const char *tmpl, const badge_ui_vars_t *vars, char *out, size_t cap);

/** @brief Unknown tokens seen since the process started (or since the last reset). */
unsigned badge_ui_expand_unknown(void);

/** @brief Zero the unknown-token counter (tests, and the boot log). */
void badge_ui_expand_unknown_reset(void);

/* -------------------------------------------------------------- the planner ---*/

/** @brief What one element's drawing inputs were when it was last planned. */
typedef struct {
    const void *ident;       /* the element the digest belongs to, NULL when undrawn */
    uint32_t    text_hash;   /* FNV-1a of the full resolved text, 0 when it has none */
    uint32_t    flags;       /* BADGE_UIP_*: which of the fields below are live */
    char        text[BADGE_UI_PLAN_TEXT_CAP]; /* what the element last showed */

    int32_t     stat;        /* its own stat's value (-1 when it draws none) */
    int32_t     now_min;     /* the 24-hour ring's minute */
    int32_t     step;        /* the care step (BE_SEGS) */
    int32_t     dots;        /* the page-dot value (BE_DOTS) */
    int32_t     setting;     /* the toggle's on/off */
    int32_t     dyn;         /* the dynamic icon's source page / place */
    int32_t     alert;       /* alert_show | bright << 1 | icon << 8 */
    int32_t     battery;     /* bat_pct | charging << 8 */
    int32_t     care;        /* care index | blocked << 8 (a refused care is drawn dim) */
    int32_t     finger_pos;  /* the BE_FEATHER source: -1 the finger, -2 the idle drift */
    int32_t     finger_x, finger_y;
    const void *day[3];      /* the owner's day, the cat's day, the heart minutes */
    int32_t     day_n[3];    /* their lengths */
    uint32_t    clock_ms;    /* the raw clock, for the clock-driven painters */
    float       wave_phase;  /* BE_WAVE */
    float       anim_phase;  /* BE_HEARTS / BE_DOTS / BE_ZZZ */
} badge_ui_plan_el_t;

/** @brief One frame's worth of "what the painters read", for one screen. */
typedef struct {
    int      screen_idx;  /* index into badge_screens[], -1 before the first frame */
    const char *screen_name; /* that screen's name, for a debugger and the log */
    bool     valid;       /* false: nothing has been planned yet -> the next frame is full */
    int      el_count;    /* elements the previous frame planned */
    badge_paint_state_t state; /* the previous frame's painter state, as a whole */
    badge_ui_plan_el_t  el[BADGE_UI_PLAN_MAX_EL];
    uint8_t  guide_page;  /* the {guideIcon} source */
    uint8_t  place;       /* the {placeIcon} source */
    uint8_t  settings[BADGE_UI_SETTING_COUNT];
    bool     phone;       /* the PHONE / NO_PHONE gate (badge_ui_plan_phone()) */
    bool     dyn_dirty;      /* plan_dyn() moved something since the last frame */
    bool     settings_dirty; /* plan_settings() moved something since the last frame */
    bool     reset_pending;  /* a reset has not been reported yet: the next frame is full */
} badge_ui_plan_t;

/**
 * @brief Make the next frame a full repaint.
 *
 * Call it after badge_ui_rebuild() (the widgets were recreated and the whole face
 * canvas was repainted) and whenever the face canvas was invalidated for another
 * reason. It drops the screen identity too, so a following plan_face() cannot compare
 * the new screen's element k against the old screen's element k.
 */
void badge_ui_plan_reset(badge_ui_plan_t *plan);

/**
 * @brief Diff one screen against the previous frame and list the boxes to repaint.
 *
 * @param plan   the previous frame's state (holds the state struct it last saw)
 * @param sd     the screen def being drawn (out of badge_screens[])
 * @param st     the painter state for this frame
 * @param texts  resolved text per element, `sd->el_count` entries, NULL for an
 *               element with no text. Passing NULL for the ARRAY itself means "no
 *               text changed this frame": elements that show text keep whatever
 *               badge_ui_plan_text() recorded and are not reported for their text.
 * @param out    receives the boxes whose drawing inputs changed, or NULL to receive
 *               only the count (`*full` is unaffected)
 * @param max    how many boxes `out` can hold
 * @param full   receives true when the caller must repaint everything: the screen
 *               changed, a reset has not been reported yet, or more than `max` boxes
 *               changed
 * @return the number of boxes written to `out`. Always 0 when `*full` is set -- the
 *         caller is repainting the whole panel then, so a box list would be
 *         meaningless; it needs no list to do that.
 *
 * `full` is set by exactly three things: the screen changed (the widgets have to be
 * recreated and the face canvas repainted from scratch), the plan was reset and that
 * reset has not been reported yet, or the diff produced more boxes than `max`.
 */
int badge_ui_plan_face(badge_ui_plan_t *plan, const badge_screen_def_t *sd,
                       const badge_paint_state_t *st, const char *const *texts, badge_box_t *out,
                       int max, bool *full);

/**
 * @brief Announce the two values the dynamic icons resolve from.
 *
 * {guideIcon} follows the guide page, {placeIcon} the place. They are not fields of
 * badge_paint_state_t (which carries what the *painter* reads), so the UI hands them
 * over once per frame. An element whose icon is dynamic is reported when either
 * changes, and only then.
 */
void badge_ui_plan_dyn(badge_ui_plan_t *plan, int guide_page, int place);

/** @brief Announce the four settings, in BADGE_SETTING_* order, 0 = off. */
void badge_ui_plan_settings(badge_ui_plan_t *plan, const uint8_t on[BADGE_UI_SETTING_COUNT]);

/**
 * @brief Announce whether the phone link is up, for the PHONE / NO_PHONE gates.
 *
 * badge_paint_state_t has no such field -- an icon's visibility is the widget tree's
 * business -- so this is how `when` learns it. Changing it reports every element whose
 * `when` is PHONE or NO_PHONE and no other.
 */
void badge_ui_plan_phone(badge_ui_plan_t *plan, bool linked);

/**
 * @brief Tell the plan what an element already shows, without running a frame.
 *
 * The plan stores the text of every element it plans; this is the store side, for a
 * caller that repainted one label by itself (badge_ui.c does exactly that when a
 * widget was recreated) and does not want the next frame to repaint it again.
 */
void badge_ui_plan_text(badge_ui_plan_t *plan, const badge_el_t *el, const char *resolved);

/**
 * @brief Whether `st` is the state struct the previous frame planned.
 *
 * Field by field, including the pointers to the day tables (identical pointer means
 * identical data) -- it is a fast "nothing at all can have changed" test, not a
 * substitute for the per-element diff. A plan that has never run is never equal.
 */
bool badge_ui_plan_state_eq(const badge_ui_plan_t *plan, const badge_paint_state_t *st);

/**
 * @brief Whether the PAINTER would refuse a care right now, per badge_blocks[].
 *
 * The same arithmetic badge_paint.c's bp_care_blocking_stat() does, and deliberately
 * the same SUBSET: the 生病 and 喵币 rows name state badge_paint_state_t does not carry,
 * so both implementations skip them. Treating an unknown row as a hit would be worse
 * than skipping it -- 喂食 has a 喵币 < 3 row and 逗猫 a 生病 == 1 row, so "unknown
 * therefore blocked" would grey out both cares at every stat value.
 *
 * So true here means "the painter drew this refused and badge_paint.c will draw it the
 * same way"; false does NOT mean the game would allow it. For the owner-visible answer
 * -- which also covers the coin price and the illness -- use badge_fsm_care_blocked(),
 * which sees the whole badge_game_t. badge_ui.c colours a care label from that one and
 * uses this one only to decide whether the pixels need repainting.
 */
bool badge_ui_plan_care_blocked(const badge_paint_state_t *st, int care);

#ifdef __cplusplus
}
#endif
