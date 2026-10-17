/*
 * badge_ui_plan - the repaint diff, and the {token} expander, with no LVGL.
 *
 * See badge_ui_plan.h for the contract. This file has two halves:
 *
 *   1. the template expander, which is the runtime implementation of the
 *      specification's `{token}` strings. The ground truth is the reference
 *      renderer's fill() (吧唧渲染参考.html line 1334-1344), and the token list is
 *      the contract tests/host/test_badge_geom.c already enforces against the
 *      generated string pool.
 *   2. the per-element digest, which decides which boxes the next frame repaints.
 *
 * Both are pure: no allocation, no LVGL call, no ESP-IDF, no static mutable state
 * except the two buffers the multi-pass expander needs and the unknown-token counter
 * (this is called from one thread, the LVGL task, like everything else in the UI).
 */
#include "badge_ui_plan.h"

#include <math.h>
#include <string.h>

/* ================================================================== tokens ====*/

/*
 * The reference substitutes into the string twice (`for(let i=0;i<2;i++)`), and the
 * specification's own place strings are the reason: place[0].text is literally
 * "{name}在公司楼下花坛", so the 生活同步 screen's "{placeText}" has to resolve twice
 * before it stops containing a token. Four passes is the point at which a cycle in
 * the data is clearly a bug rather than a nesting level, so that is the cap.
 */
#define UI_EXPAND_PASSES 4
#define UI_EXPAND_MAX    512

enum { VT_STR = 0, VT_INT, VT_S32, VT_PCT, VT_CARE };

typedef struct {
    const char *name;
    uint8_t     kind;
    uint16_t    off;  /* offsetof(badge_ui_vars_t, field), for the value kinds */
    uint16_t    arg;  /* VT_PCT: which stat; VT_CARE: unused */
} ui_token_t;

/* One row per token the reference's fill() knows. The test's TOKENS[] list in
 * tests/host/test_badge_geom.c is the same set, and test_badge_ui_plan.c walks the
 * whole generated string pool through this table. */
static const ui_token_t UI_TOKENS[] = {
    {"name", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, name), 0},
    {"food", VT_PCT, 0, BADGE_STAT_FOOD},
    {"mood", VT_PCT, 0, BADGE_STAT_MOOD},
    {"clean", VT_PCT, 0, BADGE_STAT_CLEAN},
    {"energy", VT_PCT, 0, BADGE_STAT_ENERGY},
    {"health", VT_PCT, 0, BADGE_STAT_HEALTH},
    {"coins", VT_INT, (uint16_t)offsetof(badge_ui_vars_t, coins), 0},
    {"growth", VT_INT, (uint16_t)offsetof(badge_ui_vars_t, growth), 0},
    {"nextGrowth", VT_S32, (uint16_t)offsetof(badge_ui_vars_t, next_growth), 0},
    {"stage", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, stage), 0},
    {"bat", VT_INT, (uint16_t)offsetof(badge_ui_vars_t, bat), 0},
    {"phoneText", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, phone_text), 0},
    {"syncText", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, sync_text), 0},
    {"time", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, time), 0},
    {"pairCode", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, pair_code), 0},
    {"peer", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, peer), 0},
    {"peerBreed", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, peer_breed), 0},
    {"meetGift", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, meet_gift), 0},
    {"placeText", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, place_text), 0},
    {"placeSub", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, place_sub), 0},
    {"guideTitle", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, guide_title), 0},
    {"guideSub", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, guide_sub), 0},
    {"brightText", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, bright_text), 0},
    {"ttXY", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, tt_xy), 0},
    {"ttText", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, tt_text), 0},
    {"voiceState", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, voice_state), 0},
    {"ver", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, ver), 0},
    {"step", VT_INT, (uint16_t)offsetof(badge_ui_vars_t, step), 0},
    {"n", VT_INT, (uint16_t)offsetof(badge_ui_vars_t, n), 0},
    {"sleepNow", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, sleep_now), 0},
    {"guideIcon", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, guide_icon), 0},
    {"placeIcon", VT_STR, (uint16_t)offsetof(badge_ui_vars_t, place_icon), 0},
    {"careLabel", VT_CARE, 0, 0}, /* the parameterised one; see ui_token_care() */
};

#define UI_TOKEN_COUNT ((int)(sizeof(UI_TOKENS) / sizeof(UI_TOKENS[0])))

static unsigned g_unknown;
static bool     g_count_unknown;

unsigned badge_ui_expand_unknown(void)
{
    return g_unknown;
}

void badge_ui_expand_unknown_reset(void)
{
    g_unknown = 0;
}

/* -- bounded appenders, snprintf semantics --------------------------------- */

/* Append `len` bytes and return the new LOGICAL length, which may exceed cap: the
 * caller reports the truncation the way snprintf does rather than lying about it. */
static size_t ui_put(char *out, size_t cap, size_t n, const char *s, size_t len)
{
    if (out && cap > 0 && n < cap - 1) {
        const size_t room = cap - 1 - n;
        memcpy(out + n, s, len < room ? len : room);
    }
    return n + len;
}

static size_t ui_puts(char *out, size_t cap, size_t n, const char *s)
{
    return ui_put(out, cap, n, s, s ? strlen(s) : 0);
}

static size_t ui_put_i32(char *out, size_t cap, size_t n, int32_t v)
{
    char tmp[12];
    int  len = 0;
    const bool neg = v < 0;
    uint32_t u = neg ? (uint32_t)(-(int64_t)v) : (uint32_t)v;
    do {
        tmp[len++] = (char)('0' + (int)(u % 10u));
        u /= 10u;
    } while (u != 0u && len < (int)sizeof tmp);
    if (neg) tmp[len++] = '-';
    for (int i = 0; i < len / 2; i++) {
        const char t = tmp[i];
        tmp[i] = tmp[len - 1 - i];
        tmp[len - 1 - i] = t;
    }
    return ui_put(out, cap, n, tmp, (size_t)len);
}

/* A stat percentage: the reference's Math.round() of a 0..100 value, clamped so a
 * phone that syncs 120 cannot make the badge draw "120%". */
static size_t ui_put_pct(char *out, size_t cap, size_t n, int32_t v)
{
    if (v < 0) v = 0;
    if (v > 100) v = 100;
    return ui_put_i32(out, cap, n, v);
}

/* -- {careLabel:<key>} ----------------------------------------------------- */

static int ui_care_index(const char *key, size_t klen)
{
    for (int i = 0; i < BADGE_CARE_COUNT_SPEC; i++) {
        const char *k = badge_care_keys[i];
        if (k && strlen(k) == klen && memcmp(k, key, klen) == 0) return i;
    }
    return -1;
}

/* The reference: `blockOf(k) || S.care[k].label` -- the refusal wording while the
 * care is refused, the care's own label otherwise. So a NULL vars->care_label[i]
 * means "not refused" and the spec's label is used. */
static size_t ui_token_care(const char *key, size_t klen, const badge_ui_vars_t *vars, char *out,
                            size_t cap, size_t n)
{
    const int i = ui_care_index(key, klen);
    if (i < 0) return n;
    const uint16_t lbl = badge_care_defs[i].label;
    const char    *fallback = (lbl > 0 && lbl < BADGE_STRING_COUNT) ? badge_strings[lbl] : "";
    const char    *v = (vars && vars->care_label[i]) ? vars->care_label[i] : fallback;
    return ui_puts(out, cap, n, v);
}

/* -- one {token} ----------------------------------------------------------- */

/* Returns false when the token is not one of the specification's, in which case the
 * caller drops it (expands to nothing) and counts it. */
static bool ui_token(const char *key, size_t klen, const badge_ui_vars_t *vars, char *out, size_t cap,
                     size_t *n)
{
    if (!vars || klen == 0) return false;

    /* careLabel:<key> -- matched before the plain table, because the table entry
     * for "careLabel" is the parameterised form and never stands alone. */
    if (klen > 10u && memcmp(key, "careLabel:", 10u) == 0) {
        if (ui_care_index(key + 10, klen - 10u) < 0) return false; /* an unknown care key */
        *n = ui_token_care(key + 10, klen - 10u, vars, out, cap, *n);
        return true;
    }

    for (int i = 0; i < UI_TOKEN_COUNT; i++) {
        const ui_token_t *t = &UI_TOKENS[i];
        if (strlen(t->name) != klen || memcmp(t->name, key, klen) != 0) continue;
        switch (t->kind) {
        case VT_STR: {
            const char *v = *(const char *const *)(const void *)((const char *)vars + t->off);
            *n = ui_puts(out, cap, *n, v);
            return true;
        }
        case VT_INT: {
            const int v = *(const int *)(const void *)((const char *)vars + t->off);
            *n = ui_put_i32(out, cap, *n, (int32_t)v);
            return true;
        }
        case VT_S32: {
            const int32_t v = *(const int32_t *)(const void *)((const char *)vars + t->off);
            *n = ui_put_i32(out, cap, *n, v);
            return true;
        }
        case VT_PCT: {
            const int32_t v = vars->stat ? (int32_t)vars->stat[t->arg] : 0;
            *n = ui_put_pct(out, cap, *n, v);
            return true;
        }
        case VT_CARE:
        default:
            /* "careLabel" with no ":<key>": the parameterised token is malformed. */
            return false;
        }
    }
    return false;
}

/* -- the pass ------------------------------------------------------------- */

static size_t ui_expand_pass(const char *tmpl, const badge_ui_vars_t *vars, char *out, size_t cap)
{
    size_t n = 0;
    const char *p = tmpl;
    while (p && *p) {
        if (*p == '{') {
            const char *close = strchr(p + 1, '}');
            if (close) {
                const size_t klen = (size_t)(close - (p + 1));
                if (!ui_token(p + 1, klen, vars, out, cap, &n)) {
                    /* Unknown: expand to nothing, and say so. A '{typo}' on the glass
                     * has no other symptom, which is why this is counted rather than
                     * ignored. */
                    if (g_count_unknown) g_unknown++;
                }
                p = close + 1;
                continue;
            }
        }
        n = ui_put(out, cap, n, p, 1);
        p++;
    }
    if (out && cap > 0) out[n < cap ? n : cap - 1] = '\0';
    return n;
}

/* Two buffers rather than recursion: an 8 KB stack frame once rebooted this board
 * (docs/gap-vs-v1.5.md), and a nested {placeText}->{name} chain is data, not control
 * flow. */
static char g_mid_a[UI_EXPAND_MAX];
static char g_mid_b[UI_EXPAND_MAX];

int badge_ui_expand(const char *tmpl, const badge_ui_vars_t *vars, char *out, size_t cap)
{
    if (!out || cap == 0) return 0;
    out[0] = '\0';
    if (!tmpl) return 0;

    /* The common case: a plain string with no placeholder at all. */
    if (!strchr(tmpl, '{')) {
        const size_t need = ui_puts(out, cap, 0, tmpl);
        out[need < cap ? need : cap - 1] = '\0';
        return (int)need;
    }

    g_count_unknown = true;
    (void)ui_expand_pass(tmpl, vars, g_mid_a, sizeof g_mid_a);
    g_count_unknown = false;

    const char *src = g_mid_a;
    for (int pass = 1; pass < UI_EXPAND_PASSES; pass++) {
        if (!strchr(src, '{')) break;
        char *dst = (src == g_mid_a) ? g_mid_b : g_mid_a;
        (void)ui_expand_pass(src, vars, dst, UI_EXPAND_MAX);
        src = dst;
    }

    const size_t need = ui_puts(out, cap, 0, src);
    out[need < cap ? need : cap - 1] = '\0';
    return (int)need;
}

/* =================================================================== digest ====*/

/* Which of badge_paint_el()'s inputs an element actually reads. A flag that is not
 * set cannot make an element look changed, which is how a static label, an icon, a
 * painted button and the QR square stay out of the repaint list for ever. */
#define UIP_TEXT     (1u << 0)  /* the element shows text (label, pill) */
#define UIP_STAT     (1u << 1)  /* it draws its own stat's value */
#define UIP_CARE     (1u << 2)  /* the care it belongs to can be refused (drawn dim) */
#define UIP_CLOCK    (1u << 3)  /* the painter reads st->now_ms directly */
#define UIP_RING     (1u << 4)  /* a ring element: owns no rectangle */
#define UIP_WAVE     (1u << 5)  /* st->wave_phase */
#define UIP_ANIM     (1u << 6)  /* st->anim_phase */
#define UIP_BAT      (1u << 7)  /* bat_pct / charging */
#define UIP_DAY      (1u << 8)  /* the 24-hour ring */
#define UIP_SEGS     (1u << 9)  /* st->step */
#define UIP_DOTS     (1u << 10) /* st->dots_value */
#define UIP_TOGGLE   (1u << 11) /* a setting */
#define UIP_DYN      (1u << 12) /* a {guideIcon} / {placeIcon} icon */
#define UIP_ALERT    (1u << 13) /* alert_show / alert_bright / alert_icon */

/* The feather's two sources. The idle drift is a sine of the raw clock, so now_ms has
 * to enter the feather's digest under its own name rather than through UIP_CLOCK:
 * that flag means "the painter reads now_ms at full resolution", which is true of the
 * Zzz and the falling hearts but must NOT be true of a still feather. */
#define UIP_FEATHER_DRIFT (1u << 14)

/* The repaint regions of the decorations, which own no rectangle in badge_geom.h.
 * These mirror badge_paint.c's own drawing constants, each cited below. */
#define UIP_HEART_SPAN_X    120 /* drawEl('hearts'): C + sin(i*2.1) * 120 */
#define UIP_HEART_HALF      8   /* BADGE_ICON_PX / 2 */
#define UIP_HEART_TOP       120 /* drawEl('hearts'): 380 - p * 260 */
#define UIP_HEART_BOTTOM    380
#define UIP_FEATHER_DRIFT_X 60  /* drawEl('feather'): C + 60 sin(1.2 ts) */
#define UIP_FEATHER_DRIFT_Y 10  /* 330 + 10 sin(2 ts) */
#define UIP_FEATHER_BASE_Y  330

int badge_ui_plan_capacity(void)
{
    return BADGE_UI_PLAN_MAX_EL;
}

bool badge_ui_plan_care_blocked(const badge_paint_state_t *st, int care)
{
    if (!st || care < 0 || care >= BADGE_CARE_COUNT_SPEC) return false;
    const badge_care_def_t *cd = &badge_care_defs[care];
    for (int i = 0; i < (int)cd->block_count; i++) {
        const int idx = (int)cd->block_first + i;
        if (idx < 0 || idx >= BADGE_BLOCK_COUNT) break;
        const badge_block_t *b = &badge_blocks[idx];

        /*
         * 生病 and 喵币 are state badge_paint_state_t does not carry -- the sick flag and
         * the coin count live in badge_game_t, not in the painter's struct -- so those
         * two rows are SKIPPED here rather than treated as a hit.
         *
         * Treating them as a hit is the trap: 喂食 has a 喵币 < 3 row and 逗猫 has a
         * 生病 == 1 row, so "unknown therefore blocked" would report both cares refused
         * at every stat value, and badge_paint.c would grey them out permanently.
         * badge_paint.c's bp_care_blocking_stat() skips exactly these rows for exactly
         * this reason, so the two must agree.
         *
         * The CONSEQUENCE of skipping them is that this function is the PAINTER'S
         * answer, not the full one: it can say "not blocked" for a care the game would
         * refuse for lack of coins. The full answer is badge_fsm_care_blocked(), which
         * sees the whole badge_game_t; badge_ui.c uses that one to colour a care label
         * and uses this one only to decide whether the pixels need repainting.
         */
        if (b->stat == BADGE_STAT_COINS || b->stat == BADGE_STAT_SICK) continue;
        if (b->stat >= BADGE_STAT_COUNT) continue;

        const int v = st->stat[b->stat];
        if (b->op == BADGE_OP_GE && v >= b->value) return true;
        if (b->op == BADGE_OP_LT && v < b->value) return true;
        if (b->op == BADGE_OP_EQ && v == b->value) return true;
    }
    return false;
}

static uint32_t ui_text_hash(const char *s)
{
    uint32_t h = 2166136261u;
    for (const unsigned char *p = (const unsigned char *)(s ? s : ""); *p; p++) {
        h ^= (uint32_t)*p;
        h *= 16777619u;
    }
    return h;
}

static void ui_copy_text(char *dst, const char *src)
{
    size_t i = 0;
    if (src) {
        for (; src[i] && i + 1 < BADGE_UI_PLAN_TEXT_CAP; i++) dst[i] = src[i];
    }
    dst[i] = '\0';
}

static int ui_screen_index(const badge_screen_def_t *sd)
{
    for (int i = 0; i < BADGE_SCREEN_COUNT_SPEC; i++) {
        if (sd == &badge_screens[i]) return i;
    }
    return -1;
}

static uint32_t ui_el_masks(const badge_el_t *el, const badge_paint_state_t *st)
{
    uint32_t f = 0;
    switch (el->type) {
    case BE_LABEL:
        if (el->care != BADGE_CARE_NONE) f |= UIP_CARE;
        if (el->value >= BADGE_VALUE_FOOD && el->value <= BADGE_VALUE_HEALTH) f |= UIP_STAT;
        break;
    case BE_PILL:
        f |= UIP_TEXT;
        break;
    case BE_ICON:
        if (el->icon == BADGE_ICON_DYN_PLACE || el->icon == BADGE_ICON_DYN_GUIDE) f |= UIP_DYN;
        break;
    case BE_BATTERY:
        f |= UIP_BAT;
        break;
    case BE_ALERT:
        f |= UIP_ALERT;
        break;
    case BE_ARC:
        f |= UIP_RING;
        if (el->value >= BADGE_VALUE_FOOD && el->value <= BADGE_VALUE_HEALTH) f |= UIP_STAT;
        break;
    case BE_SEGS:
        f |= UIP_RING | UIP_SEGS;
        break;
    case BE_DAYRING:
        f |= UIP_RING | UIP_DAY;
        break;
    case BE_WAVE:
        f |= UIP_RING | UIP_WAVE | UIP_CLOCK; /* the "thinking" state rotates with ts */
        break;
    case BE_BAR:
        if (el->value >= BADGE_VALUE_FOOD && el->value <= BADGE_VALUE_HEALTH) f |= UIP_STAT;
        break;
    case BE_TOGGLE:
        f |= UIP_TOGGLE;
        break;
    case BE_BTN:
        if (el->care != BADGE_CARE_NONE) f |= UIP_CARE;
        break;
    case BE_ZZZ:
        f |= UIP_CLOCK | UIP_ANIM;
        break;
    case BE_HEARTS:
        f |= UIP_CLOCK | UIP_ANIM;
        break;
    case BE_FEATHER:
        if (!st->finger_down) f |= UIP_FEATHER_DRIFT;
        break;
    case BE_DOTS:
        f |= UIP_DOTS;
        if (el->flags & BADGE_ELF_ANIM) f |= UIP_CLOCK; /* on = ((ts * 2.5) | 0) % n */
        break;
    case BE_QR:
    case BE_HIT:
    default:
        break;
    }
    return f;
}

/*
 * Visibility. `when` is the specification's gate, and it needs three facts:
 *
 *   ALERT              st->alert_show, which badge_paint_el() itself reads;
 *   PHONE / NO_PHONE   whether the phone link is up.
 *
 * The link state is not a field of badge_paint_state_t: badge_paint_el() never reads
 * it, because an icon's visibility is the widget tree's business, not the canvas's.
 * So badge_ui.c announces it once per frame with badge_ui_plan_phone(), the same way
 * it announces the guide page and the settings, and this is where it is consumed.
 */
static bool ui_visible(const badge_ui_plan_t *plan, const badge_el_t *el,
                       const badge_paint_state_t *st)
{
    switch (el->when) {
    case BADGE_WHEN_PHONE: return plan->phone;
    case BADGE_WHEN_NO_PHONE: return !plan->phone;
    case BADGE_WHEN_ALERT: return st->alert_show;
    default: return true;
    }
}

/* The FEATHER's digest and box are both derived from what the painter reads, and the
 * painter reads a different thing depending on the finger:
 *
 *   finger down  -> the finger's position (plus the +16/-16 the icon is offset by)
 *   finger up    -> the reference's idle drift, C + 60 sin(1.2 ts) and 330 + 10 sin(2 ts)
 *
 * badge_paint_state_t has no "idle phase", so the raw clock in clock_ms IS the idle
 * phase: a still finger therefore does not repaint the feather (clock_ms is not part
 * of its mask unless the drift is what is being drawn), and a drifting one moves as
 * the reference's does. `-1` in the digest means "the finger", `-2` "the drift". */
static int32_t ui_feather_pos(const badge_paint_state_t *st, int *x, int *y)
{
    if (st->finger_down) {
        if (x) *x = st->finger_x + 16;
        if (y) *y = st->finger_y - 16;
        return -1;
    }
    if (x) *x = BADGE_CX;
    if (y) *y = UIP_FEATHER_BASE_Y;
    return -2;
}

static int32_t ui_stat_of(const badge_el_t *el, const badge_paint_state_t *st)
{
    if (el->value >= BADGE_VALUE_FOOD && el->value <= BADGE_VALUE_HEALTH) {
        return (int32_t)st->stat[el->value - BADGE_VALUE_FOOD];
    }
    return -1;
}

static int32_t ui_setting_of(const badge_ui_plan_t *plan, const badge_el_t *el)
{
    const int idx = (int)el->value - (int)BADGE_VALUE_BRIGHT;
    if (idx < 0 || idx >= BADGE_UI_SETTING_COUNT) return 0;
    return plan->settings[idx] ? 1 : 0;
}

static int32_t ui_dyn_of(const badge_ui_plan_t *plan, const badge_el_t *el)
{
    if (el->icon == BADGE_ICON_DYN_GUIDE) return (int32_t)plan->guide_page;
    if (el->icon == BADGE_ICON_DYN_PLACE) return (int32_t)plan->place;
    return -1;
}

/* -- the repaint region ---------------------------------------------------- */

/* Mirrors badge_paint.c's bp_icon_scale(): the spec stores an icon scale as twice its
 * value (1.5 is a real scale), rounded up, and never below 1. */
static int ui_icon_scale(const badge_el_t *el)
{
    const int s = ((int)el->scale_x2 + 1) / 2;
    return s < 1 ? 1 : s;
}

static void ui_box_clamp(badge_box_t *b)
{
    int x0 = b->x, y0 = b->y;
    int x1 = b->x + b->w - 1, y1 = b->y + b->h - 1;
    if (x1 < x0 || y1 < y0) {
        b->x = b->y = b->w = b->h = 0;
        return;
    }
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > BADGE_SCR_W - 1) x1 = BADGE_SCR_W - 1;
    if (y1 > BADGE_SCR_H - 1) y1 = BADGE_SCR_H - 1;
    b->x = x0;
    b->y = y0;
    b->w = x1 - x0 + 1;
    b->h = y1 - y0 + 1;
}

/*
 * The point accumulator behind the ring and decoration boxes.
 *
 * `valid` is the whole point of this struct: a box grows from the FIRST point it is
 * given, and an accumulator that has not been given one has no box at all. Seeding the
 * extremes at 0 (or at the panel corner) instead unions every part of the ring into
 * that seed -- a 7-degree stat arc then reports a box spanning from the panel origin out
 * to the arc, i.e. 383x426 where its band is a few thousand pixels.
 *
 * That is not a correctness bug, because a box that is too big still contains the
 * changed pixels and nothing goes stale. It is a budget bug, and the budget is the whole
 * reason this module exists: the box is what gets repainted over QSPI, and 383x426 is
 * 75% of a 466x466 AMOLED for a one-point change on a stat arc.
 */
typedef struct {
    int  x0, y0, x1, y1;
    bool valid;
} ui_pts_t;

static void ui_pts_clear(ui_pts_t *p)
{
    p->x0 = p->y0 = p->x1 = p->y1 = 0;
    p->valid = false;
}

static void ui_box_add_point(ui_pts_t *p, int x, int y)
{
    if (!p->valid) {
        p->x0 = p->x1 = x;
        p->y0 = p->y1 = y;
        p->valid = true;
        return;
    }
    if (x < p->x0) p->x0 = x;
    if (y < p->y0) p->y0 = y;
    if (x > p->x1) p->x1 = x;
    if (y > p->y1) p->y1 = y;
}

static void ui_box_arc_point(double deg, double radius, ui_pts_t *p)
{
    const double rad = deg * 3.14159265358979323846 / 180.0;
    const int x = BADGE_CX + (int)floor(cos(rad) * radius + 0.5);
    const int y = BADGE_CY + (int)floor(sin(rad) * radius + 0.5);
    ui_box_add_point(p, x, y);
}

/* The bounding box of the annular sector a0..a1 at outer radius `ro`: the two ends
 * plus every 90-degree crossing inside the window (which is where a sector's bbox
 * touches its extremes). Angles increase clockwise on screen (badge_paint.h). */
static void ui_box_arc_window(double a0, double a1, double ro, ui_pts_t *p)
{
    if (a1 < a0) {
        const double t = a0;
        a0 = a1;
        a1 = t;
    }
    ui_box_arc_point(a0, ro, p);
    ui_box_arc_point(a1, ro, p);
    if (a1 - a0 >= 360.0) {
        ui_box_add_point(p, BADGE_CX - (int)ro, BADGE_CY - (int)ro);
        ui_box_add_point(p, BADGE_CX + (int)ro, BADGE_CY + (int)ro);
        return;
    }
    for (int q = 0; q <= (int)((a1 + 360.0) / 90.0) + 1; q++) {
        const double d = (double)q * 90.0;
        if (d >= a0 && d <= a1) ui_box_arc_point(d, ro, p);
    }
}

/*
 * The box an arc of `a0..a1` covers on BOTH sides of its centreline.
 *
 * An arc is stroked along a centreline at radius `r` with a half-width of `w/2`
 * (badge_paint.c: bp_stroke()'s `r_in = r_mid - w * 0.5`, :473, and it paints every pixel
 * whose distance to the centreline is within that half-width). So the drawn band spans
 * the radii [r - w/2, r + w/2] and the box must union the window at BOTH of them.
 *
 * Unioning only the OUTER radius is the trap: for 主表盘 A's stat arcs (r 214, w 8) it
 * yields 44x33 at the outer edge and entirely misses the inner half, so the change a
 * stat arc makes where it is drawn nearest the centre would fall outside the repaint
 * region and the old pixels would stay on the glass. The test caught this by asserting
 * the box contains the arc's own midline point.
 */
static void ui_box_arc_band(double a0, double a1, double r_mid, double w, ui_pts_t *p)
{
    const double half = w / 2.0;
    if (r_mid - half > 0.0) {
        ui_box_arc_window(a0, a1, r_mid - half, p);
    }
    ui_box_arc_window(a0, a1, r_mid + half, p);
}

/* Every element's repaint region. Returns false only for an element that is never
 * drawn (BE_HIT). The boxes are the same arithmetic badge_geom.h does for content
 * elements -- this module deliberately does not re-implement it -- with the ring and
 * decoration extents added, because those own no rectangle there. */
static bool ui_area(const badge_el_t *el, const char *text, const badge_paint_state_t *st,
                    badge_box_t *out)
{
    if (badge_el_box(el, text, out)) {
        /* A degenerate box is real: an empty label has no width, and an icon whose
         * scale rounds to zero still paints a 16x16 tile (bp_icon_scale() clamps to
         * 1). Give the repaint a region rather than silently never repainting it. */
        if (el->type == BE_ICON) {
            const int s = BADGE_ICON_PX * ui_icon_scale(el);
            if (out->w <= 0) out->w = s;
            if (out->h <= 0) out->h = s;
        } else {
            if (out->w <= 0) out->w = 1;
            if (out->h <= 0) out->h = 1;
        }
        ui_box_clamp(out);
        return out->w > 0 && out->h > 0;
    }

    /* The ring and decoration boxes grow from their FIRST point, so the accumulator
     * starts empty rather than at the panel origin (see ui_pts_t). */
    ui_pts_t pts;
    ui_pts_clear(&pts);
    switch (el->type) {
    case BE_ARC: {
        const int w = el->w > 0 ? el->w : 8;
        const int r = el->r > 0 ? el->r : (BADGE_SAFE_R - w);
        ui_box_arc_band((double)el->a0, (double)el->a1, (double)r, (double)w, &pts);
        break;
    }
    case BE_SEGS: {
        const int w = el->w > 0 ? el->w : 8;
        const int r = el->r > 0 ? el->r : 222;
        ui_box_arc_band((double)el->a0, (double)el->a1, (double)r, (double)w, &pts);
        break;
    }
    case BE_DAYRING: {
        const int r = el->r > 0 ? el->r : 218;
        const int w = el->w > 0 ? el->w : 18;
        const int ro = r + w / 2 + 1;
        ui_box_add_point(&pts, BADGE_CX - ro, BADGE_CY - ro);
        ui_box_add_point(&pts, BADGE_CX + ro, BADGE_CY + ro);
        break;
    }
    case BE_WAVE: {
        const int r = el->r > 0 ? el->r : 206;
        const int ro = r + 22 + 2; /* drawEl('wave'): the outermost ripple at r + 22 */
        ui_box_add_point(&pts, BADGE_CX - ro, BADGE_CY - ro);
        ui_box_add_point(&pts, BADGE_CX + ro, BADGE_CY + ro);
        break;
    }
    case BE_FEATHER: {
        int fx, fy;
        (void)ui_feather_pos(st, &fx, &fy);
        const int rx = st->finger_down ? 0 : UIP_FEATHER_DRIFT_X;
        const int ry = st->finger_down ? 0 : UIP_FEATHER_DRIFT_Y;
        ui_box_add_point(&pts, fx - rx - UIP_HEART_HALF, fy - ry - UIP_HEART_HALF);
        ui_box_add_point(&pts, fx + rx + UIP_HEART_HALF, fy + ry + UIP_HEART_HALF);
        break;
    }
    case BE_HEARTS:
        ui_box_add_point(&pts, BADGE_CX - UIP_HEART_SPAN_X - UIP_HEART_HALF,
                         UIP_HEART_TOP - UIP_HEART_HALF);
        ui_box_add_point(&pts, BADGE_CX + UIP_HEART_SPAN_X + UIP_HEART_HALF,
                         UIP_HEART_BOTTOM + UIP_HEART_HALF);
        break;
    case BE_HIT:
    default:
        return false; /* never drawn */
    }

    if (!pts.valid) return false;
    out->x = pts.x0;
    out->y = pts.y0;
    out->w = pts.x1 - pts.x0 + 1;
    out->h = pts.y1 - pts.y0 + 1;
    ui_box_clamp(out);
    return out->w > 0 && out->h > 0;
}

/* -- the digest ------------------------------------------------------------ */

static void ui_digest(badge_ui_plan_el_t *d, const badge_ui_plan_t *plan, const badge_el_t *el,
                      uint32_t flags, const char *text, bool store_text, const badge_paint_state_t *st)
{
    d->flags = flags;
    d->ident = el;
    if ((flags & UIP_TEXT) && store_text) {
        d->text_hash = ui_text_hash(text);
        ui_copy_text(d->text, text);
    } else if (!(flags & UIP_TEXT)) {
        /* Nothing to remember, so a later frame cannot think it changed. */
        d->text_hash = 0;
        d->text[0] = '\0';
    }
    /* (UIP_TEXT && !store_text): the caller had no text array this frame, so what the
     * element already shows is left exactly as it was. */
    d->stat = ui_stat_of(el, st);
    d->now_min = st->now_min;
    d->step = st->step;
    d->dots = st->dots_value;
    d->setting = ui_setting_of(plan, el);
    d->dyn = ui_dyn_of(plan, el);
    d->battery = (int32_t)st->bat_pct | (st->charging ? 0x100 : 0);
    d->alert = (st->alert_show ? 1 : 0) | (st->alert_bright ? 2 : 0) | ((int32_t)st->alert_icon << 8);
    d->care = (int32_t)el->care | (badge_ui_plan_care_blocked(st, (int)el->care) ? 0x100 : 0);
    d->clock_ms = st->now_ms;
    d->wave_phase = st->wave_phase;
    d->anim_phase = st->anim_phase;
    d->finger_x = st->finger_x;
    d->finger_y = st->finger_y;
    d->finger_pos = ui_feather_pos(st, NULL, NULL);
    d->day[0] = (const void *)st->day_owner;
    d->day[1] = (const void *)st->day_cat;
    d->day[2] = (const void *)st->hearts;
    d->day_n[0] = st->day_owner_n;
    d->day_n[1] = st->day_cat_n;
    d->day_n[2] = st->hearts_n;
}

static bool ui_digest_differs(const badge_ui_plan_el_t *a, const badge_ui_plan_el_t *b)
{
    if (a->ident != b->ident || a->flags != b->flags) return true;
    const uint32_t f = a->flags;
    if ((f & UIP_TEXT) && (a->text_hash != b->text_hash || strcmp(a->text, b->text) != 0)) return true;
    if ((f & UIP_STAT) && a->stat != b->stat) return true;
    if ((f & UIP_CARE) && a->care != b->care) return true;
    if ((f & UIP_BAT) && a->battery != b->battery) return true;
    if ((f & UIP_DAY) && (a->now_min != b->now_min || a->day_n[0] != b->day_n[0] ||
                          a->day_n[1] != b->day_n[1] || a->day_n[2] != b->day_n[2] ||
                          a->day[0] != b->day[0] || a->day[1] != b->day[1] || a->day[2] != b->day[2])) {
        return true;
    }
    if ((f & UIP_SEGS) && a->step != b->step) return true;
    if ((f & UIP_DOTS) && a->dots != b->dots) return true;
    if ((f & UIP_WAVE) && a->wave_phase != b->wave_phase) return true;
    if ((f & UIP_ANIM) && a->anim_phase != b->anim_phase) return true;
    if ((f & UIP_FEATHER_DRIFT) &&
        (a->finger_pos != b->finger_pos || a->finger_x != b->finger_x || a->finger_y != b->finger_y)) {
        return true;
    }
    if ((f & UIP_CLOCK) && a->clock_ms != b->clock_ms) return true;
    if ((f & UIP_ALERT) && a->alert != b->alert) return true;
    if ((f & UIP_TOGGLE) && a->setting != b->setting) return true;
    if ((f & UIP_DYN) && a->dyn != b->dyn) return true;
    return false;
}

/* -- the frame ------------------------------------------------------------- */

void badge_ui_plan_reset(badge_ui_plan_t *plan)
{
    if (!plan) return;
    memset(plan, 0, sizeof *plan);
    plan->screen_idx = -1;
    plan->guide_page = 0xFFu;
    plan->place = 0xFFu;
    plan->dyn_dirty = true;
    plan->settings_dirty = true;
    plan->reset_pending = true;
}

void badge_ui_plan_dyn(badge_ui_plan_t *plan, int guide_page, int place)
{
    if (!plan) return;
    const uint8_t g = (uint8_t)(guide_page < 0 ? 0 : (guide_page > 0xFE ? 0xFE : guide_page));
    const uint8_t p = (uint8_t)(place < 0 ? 0 : (place > 0xFE ? 0xFE : place));
    if (g != plan->guide_page) {
        plan->guide_page = g;
        plan->dyn_dirty = true;
    }
    if (p != plan->place) {
        plan->place = p;
        plan->dyn_dirty = true;
    }
}

void badge_ui_plan_settings(badge_ui_plan_t *plan, const uint8_t on[BADGE_UI_SETTING_COUNT])
{
    if (!plan || !on) return;
    for (int i = 0; i < BADGE_UI_SETTING_COUNT; i++) {
        const uint8_t v = on[i] ? 1u : 0u;
        if (v != plan->settings[i]) {
            plan->settings[i] = v;
            plan->settings_dirty = true;
        }
    }
}

void badge_ui_plan_phone(badge_ui_plan_t *plan, bool linked)
{
    if (!plan) return;
    if (plan->phone != linked) {
        plan->phone = linked;
        plan->dyn_dirty = true; /* re-evaluated by the same walk */
    }
}

void badge_ui_plan_text(badge_ui_plan_t *plan, const badge_el_t *el, const char *resolved)
{
    if (!plan || !el || !plan->valid || plan->screen_idx < 0) return;
    const badge_screen_def_t *sd = &badge_screens[plan->screen_idx];
    for (int k = 0; k < plan->el_count && k < BADGE_UI_PLAN_MAX_EL; k++) {
        if (&badge_els[sd->el_first + k] != el) continue;
        plan->el[k].text_hash = ui_text_hash(resolved);
        ui_copy_text(plan->el[k].text, resolved);
        return;
    }
}

bool badge_ui_plan_state_eq(const badge_ui_plan_t *plan, const badge_paint_state_t *st)
{
    if (!plan || !st || !plan->valid) return false;
    const badge_paint_state_t *p = &plan->state;
    if (p->now_ms != st->now_ms) return false;
    for (int i = 0; i < BADGE_STAT_COUNT; i++) {
        if (p->stat[i] != st->stat[i]) return false;
    }
    return p->bat_pct == st->bat_pct && p->charging == st->charging && p->now_min == st->now_min &&
           p->day_owner == st->day_owner && p->day_owner_n == st->day_owner_n &&
           p->day_cat == st->day_cat && p->day_cat_n == st->day_cat_n && p->hearts == st->hearts &&
           p->hearts_n == st->hearts_n && p->step == st->step && p->finger_x == st->finger_x &&
           p->finger_y == st->finger_y && p->finger_down == st->finger_down &&
           p->wave_phase == st->wave_phase && p->alert_icon == st->alert_icon &&
           p->alert_show == st->alert_show && p->alert_bright == st->alert_bright &&
           p->anim_phase == st->anim_phase && p->dots_value == st->dots_value &&
           p->dots_n == st->dots_n;
}

static void ui_plan_add(badge_box_t *out, int max, int *n, const badge_box_t *box, badge_box_t *fallback)
{
    if (!box || box->w <= 0 || box->h <= 0) return;
    if (out && *n < max) {
        out[*n] = *box;
    } else if (!out && fallback) {
        /* The caller asked only to be told *whether* something changed, so merge the
         * boxes into the one it handed over. */
        if (*n == 0) {
            *fallback = *box;
        } else {
            const int x0 = fallback->x < box->x ? fallback->x : box->x;
            const int y0 = fallback->y < box->y ? fallback->y : box->y;
            const int x1a = fallback->x + fallback->w - 1, x1b = box->x + box->w - 1;
            const int y1a = fallback->y + fallback->h - 1, y1b = box->y + box->h - 1;
            const int x1 = x1a > x1b ? x1a : x1b;
            const int y1 = y1a > y1b ? y1a : y1b;
            fallback->x = x0;
            fallback->y = y0;
            fallback->w = x1 - x0 + 1;
            fallback->h = y1 - y0 + 1;
        }
    }
    (*n)++;
}

int badge_ui_plan_face(badge_ui_plan_t *plan, const badge_screen_def_t *sd, const badge_paint_state_t *st,
                       const char *const *texts, badge_box_t *out, int max, bool *full)
{
    if (full) *full = false;
    if (!plan || !st) return 0;
    if (max < 0) max = 0;

    const int  idx = ui_screen_index(sd);
    const bool known = (sd != NULL) && (idx >= 0) && (sd->el_count <= BADGE_UI_PLAN_MAX_EL);
    const int  count = known ? (int)sd->el_count : 0;

    /* A caller that has no text array cannot have changed any text, so the elements
     * that show text are not diffed at all (the text baked into them was already
     * repainted by whoever wrote it, which is what badge_ui_plan_text() records). This
     * is what lets the app tick ask "did any *state* move?" with no strings at all. */
    const bool texts_live = (texts != NULL);

    /* Nothing that a painter reads can have moved: no fresh text, no dynamic icon
     * movement, no setting movement, and the state struct is identical field for
     * field. Return without touching anything. */
    if (known && plan->valid && plan->screen_idx == idx && !texts_live && !plan->dyn_dirty &&
        !plan->settings_dirty && badge_ui_plan_state_eq(plan, st)) {
        return 0;
    }

    /* The screen changed: the widgets are about to be recreated and the face canvas
     * repainted from scratch, so the caller must be told to repaint everything. A plan
     * that was merely reset on the SAME screen is a full face repaint but not a screen
     * change: the element diff below is still meaningful for the label widgets. */
    const bool screen_changed = !known || (plan->valid && plan->screen_idx != idx);

    int  n = 0;
    bool is_full = false;

    if (!known || !plan->valid || screen_changed) {
        for (int k = 0; k < count; k++) {
            const badge_el_t *el = &badge_els[sd->el_first + k];
            const char      *txt = texts_live ? texts[k] : NULL;
            const uint32_t   flags = ui_el_masks(el, st);
            const bool       vis = ui_visible(plan, el, st);
            badge_ui_plan_el_t d;
            memset(&d, 0, sizeof d);
            ui_digest(&d, plan, el, flags, txt, texts_live, st);
            if (!vis) {
                /* Not drawn: keep no identity, so a later frame can tell that it
                 * appeared, and report no box. */
                d.ident = NULL;
            }
            plan->el[k] = d;
            if (!vis) continue;
            badge_box_t box;
            if (ui_area(el, txt, st, &box)) ui_plan_add(out, max, &n, &box, NULL);
        }
        for (int k = count; k < BADGE_UI_PLAN_MAX_EL; k++) {
            memset(&plan->el[k], 0, sizeof plan->el[k]);
        }
        is_full = screen_changed;
    } else {
        for (int k = 0; k < count; k++) {
            badge_ui_plan_el_t *slot = &plan->el[k];
            const badge_el_t   *el = &badge_els[sd->el_first + k];
            const uint32_t      flags = ui_el_masks(el, st);
            const char         *txt = texts_live ? texts[k] : NULL;

            if (!ui_visible(plan, el, st)) {
                if (slot->ident != NULL) {
                    /* It was drawn last frame and is not now: its old region has to be
                     * repainted with the element gone, or the pixels stay on the glass
                     * (the alert bubble leaving is exactly this case). */
                    badge_box_t box;
                    if (ui_area(el, slot->text[0] ? slot->text : txt, st, &box)) {
                        ui_plan_add(out, max, &n, &box, NULL);
                    }
                }
                memset(slot, 0, sizeof *slot);
                continue;
            }

            badge_ui_plan_el_t d;
            memset(&d, 0, sizeof d);
            if (!texts_live) {
                /* This frame has nothing to say about the element's text, so keep what
                 * it last showed (badge_ui_plan_text() is how a caller updates it). */
                d.text_hash = slot->text_hash;
                memcpy(d.text, slot->text, sizeof d.text);
            }
            ui_digest(&d, plan, el, flags, txt, texts_live, st);
            const bool changed = ui_digest_differs(slot, &d);
            *slot = d;
            if (!changed) continue;

            badge_box_t box;
            if (ui_area(el, txt, st, &box)) ui_plan_add(out, max, &n, &box, NULL);
        }
        for (int k = count; k < BADGE_UI_PLAN_MAX_EL; k++) {
            plan->el[k].ident = NULL; /* the screen shrank: nothing there any more */
        }
    }

    plan->screen_idx = idx;
    plan->screen_name = known ? sd->name : NULL;
    plan->el_count = count;
    plan->valid = true;
    plan->state = *st;
    plan->dyn_dirty = false;
    plan->settings_dirty = false;
    if (plan->reset_pending) {
        /* Consumed: a reset means exactly one full frame. */
        is_full = true;
        plan->reset_pending = false;
    }

    if (n > max) {
        /* More boxes than the caller can repaint one by one: repaint the panel. */
        is_full = true;
        n = 0;
    }
    if (full) *full = is_full;
    return is_full ? 0 : n;
}
