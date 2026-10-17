/*
 * badge_ui - the screen system, built out of the generated specification tables.
 *
 * WHAT THIS FILE IS
 * -----------------
 * badge_ui.h states the layer order and the repaint discipline; badge_ui_plan.c
 * decides which boxes changed; badge_fsm.h owns the token grammar and the rules. This
 * file is the half that touches LVGL: it owns the layers, resolves the specification's
 * templates into text, hands the planner its inputs, and turns the planner's box list
 * into actual pixel work.
 *
 * It is deliberately the only file in the firmware that knows about both LVGL widgets
 * and the specification's element types. Everything under it is a pure function of
 * (element, state):
 *
 *     badge_spec_data.c   the tables            (generated, no logic)
 *     badge_geom.c        where things are      (no LVGL)
 *     badge_paint.c       what a shape is       (LVGL canvas, no widgets)
 *     badge_ui_plan.c     what must be redrawn  (no LVGL)
 *     badge_fsm.c         what happens, and the {token} grammar
 *     badge_ui.c          THIS: widgets, text, composition, the transition
 *
 * WHAT IS A WIDGET AND WHAT IS A CANVAS
 * -------------------------------------
 * Only text is a widget. Every other element -- the ring, the arcs, the segmented care
 * ring, the battery, the buttons, the toggles, the QR square, the feather, the wave,
 * the hearts, the dots, the Zzz -- is drawn into the face canvas by badge_paint_el().
 * That is the opposite of the previous UI, which built a widget per visual and then
 * could not place 19 of its 20 boxes inside the glass (docs/gap-vs-v1.5.md). A canvas
 * has no layout opinions, so the specification's coordinates are the coordinates.
 *
 * WHY TEXT IS NOT DRAWN INTO THE CANVAS
 * -------------------------------------
 * Because the specification ships four real LVGL faces (main/ui/fonts/) and drawing text
 * by hand would mean reimplementing glyph advance and CJK wrapping -- and then
 * disagreeing with the faces the specification measured its labels against.
 *
 * REPAINT DISCIPLINE, IN THE ORDER IT ACTUALLY RUNS
 * -------------------------------------------------
 * badge_ui_refresh() is called every tick (10 ms). Per call it:
 *
 *   1. builds this frame's badge_paint_state_t from the state machine and badge_hw;
 *   2. hands the planner the three things that are not painter state -- the dynamic
 *      icon sources, the four settings and the phone gate -- plus the resolved text of
 *      every element;
 *   3. asks badge_ui_plan_face() for the boxes whose drawing inputs changed;
 *   4. if `full`, clears and repaints the whole face canvas; otherwise, for each box,
 *      clears just that box and redraws ONLY the elements that intersect it.
 *
 * Step 4's "only the elements that intersect it" is what makes the frame budget real.
 * One stat arc moving by one point changes a band of a few hundred pixels; repainting
 * the panel would be 1.7 MB of QSPI traffic at 100 Hz. The clip that makes it possible
 * lives in badge_paint.c (badge_paint_clip()), because every primitive there routes
 * through one pixel funnel.
 *
 * The one element that is excluded from the partial path is BE_FEATHER. The
 * specification draws the feather at the finger, or on a clock-driven drift when there
 * is no finger -- never at the element's own (x, y) -- so its box would clip the redraw
 * to the wrong place. It is handled by making the frame full whenever the finger moves,
 * which is what the reference does anyway (drawFx, line 1532).
 *
 * THE COMPOSITES
 * --------------
 * The bubble, the toast and the no-motor edge ring are drawn on their own canvas, above
 * the text layer and below the transition. They are transient and they overlap labels;
 * a separate surface means their appearance and disappearance never touches the face
 * canvas's dirty boxes or rebuilds the widget tree. The alert's head bubble is NOT here:
 * it is a BE_ALERT element and badge_paint_el() draws it.
 *
 * The component numbers are the specification's own (badge_spec_data.h's BADGE_BUBBLE_*
 * and BADGE_TOAST_*, generated from S.components).
 *
 * The toast IS clamped to the safe circle, and the clamp is deliberately known to be
 * inert for the specification's current numbers. BADGE_TOAST_Y is a CENTRE line, not a
 * top edge -- the reference's drawToast() draws at `K.y - K.h/2` (吧唧渲染参考.html:1531)
 * and this file's box is `BADGE_TOAST_Y - BADGE_TOAST_H / 2` -- so the toast spans
 * y 360..400, and 220 wide with its bottom edge at 400 puts its worst corner 200 px from
 * the centre, inside BADGE_SAFE_R 212. So the specification does not in fact violate its
 * own rule here, and a first reading that treated y as the top edge produced a wrong
 * "4 px outside" claim that lived in this comment and in badge_geom.h.
 *
 * The clamp stays because the safe half-width at that height (badge_safe_half_width_at,
 * which takes a BOTTOM edge) would still allow 260 px: the defence only bites if the
 * toast is ever moved closer to the rim or allowed to grow. It costs one comparison and
 * cannot make a legal toast illegal.
 *
 * Text inside a composite is an LVGL label, hidden while its composite is not showing,
 * so the wording is rendered by the specification's own faces.
 *
 * THE TRANSITION
 * --------------
 * The reference snapshots the outgoing screen and slides or fades the snapshot over the
 * incoming one (go(), line 1369; the composite at lines 1580-1584):
 *
 *     up:[0,-1] down:[0,1] left:[-1,0] right:[1,0]
 *     slide: drawImage(snap, v*466*e) ; drawImage(buf, -v*466*(1-e))
 *     fade : globalAlpha = 1-e over snap, then e over buf
 *     e = 1 - (1 - p)^3
 *
 * With layers, that is one extra canvas: the snapshot goes on the trans layer and the
 * three live layers slide the other way. Because badge_ui_rebuild() runs before the
 * face canvas is repainted, the snapshot is taken from the face buffer at rebuild time
 * -- while it still holds the screen being left -- which is exactly the reference's
 * `sg.drawImage(cv, 0, 0)` before it switches.
 *
 * MEMORY
 * ------
 * Three full-panel ARGB8888 surfaces, allocated once, from PSRAM:
 *
 *     face   466x466x4 = 848 KB   the screen's own pixels
 *     comp   466x466x4 = 848 KB   the composites
 *     trans  466x466x4 = 848 KB   the transition snapshot, created on the first switch
 *
 * The panel is why the face cannot be smaller: the painter blends, so it has to read the
 * destination, so a 16-bit surface would quantise every composite twice. The snapshot is
 * lazy, so a badge that never changes screen never pays for it. Nothing here allocates
 * per frame, and no LVGL object is created in refresh().
 */
#include "badge_motion.h"
#include "badge_tutorial_visual.h"
#include "badge_overlay.h"
#include "badge_ui.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_timer.h"

#include "badge_assets.h"
#include "badge_geom.h"
#include "badge_hw.h"
#include "badge_paint.h"
#include "badge_paint_priv.h"
#include "badge_spec_data.h"
#include "badge_ui_plan.h"

static const char *TAG = "badge_ui";

/* --------------------------------------------------------------- constants ---*/

#define UI_EL_NONE 0xFFFFu

/* The bubble's resolved text, and the two scratch strings the expansion needs. */
#define UI_STR_CAP (BADGE_UI_PLAN_TEXT_CAP)

#define UI_FLOAT_MAX      3
#define UI_FLOAT_BYTES    24
#define UI_FLOAT_X        BADGE_CX
#define UI_FLOAT_Y        172 /* above the cat's head, as the reference's float is */

/* The specification's three-fade worst case is 200 ms, so the fade window is fixed. */
#define UI_BUBBLE_FADE_IN  150u
#define UI_BUBBLE_FADE_OUT 200u
#define UI_TOAST_FADE_IN   120u
#define UI_TOAST_FADE_OUT  200u
#define UI_TRANSITION_MS   220u
/* 盖入: on the vertical switches the outgoing screen is not dragged anywhere -- it
 * stays put and fades out underneath the incoming one, and is fully gone by the
 * time the cover has travelled this many pixels (the follow-finger spec's
 * vertFadePx). Horizontal face switches keep the reference's push. */
#define UI_VERT_FADE_PX    210u
#define UI_PI              3.14159265358979323846

/* The toast's horizontal padding. The reference writes `textW + 36` inline (drawToast,
 * line 1530); the specification describes it as a padding of 18 per side in words but
 * publishes only the total via maxW, so the total is what is named here. */
#define UI_TOAST_PAD_X 18

/* The reference's 24-hour ring and heart table (lines 1480-1482): the owner's day, the
 * cat's day derived from it by CATK = {Sleep:Sleep, Home:Home, Commute:Home, Work:Out,
 * Out:Out}, and the six minutes at which a heart is dropped. */
static const badge_day_seg_t UI_DAY[] = {
    {0, 435, BADGE_DAY_SLEEP},       {435, 505, BADGE_DAY_HOME},
    {505, 545, BADGE_DAY_COMMUTE},   {545, 725, BADGE_DAY_WORK},
    {725, 780, BADGE_DAY_OUT},       {780, 1115, BADGE_DAY_WORK},
    {1115, 1153, BADGE_DAY_COMMUTE}, {1153, 1230, BADGE_DAY_OUT},
    {1230, 1405, BADGE_DAY_HOME},    {1405, 1440, BADGE_DAY_SLEEP},
};
static const uint8_t UI_CATK[BADGE_DAY_KIND_COUNT] = {
    BADGE_DAY_SLEEP, /* Sleep   -> Sleep */
    BADGE_DAY_HOME,  /* Home    -> Home  */
    BADGE_DAY_HOME,  /* Commute -> Home  */
    BADGE_DAY_OUT,   /* Work    -> Out   */
    BADGE_DAY_OUT,   /* Out     -> Out   */
};
#define UI_DAY_N ((int)(sizeof(UI_DAY) / sizeof(UI_DAY[0])))

static const int UI_HEARTS[] = {452, 748, 1160, 1215, 1290, 1350};
#define UI_HEARTS_N ((int)(sizeof(UI_HEARTS) / sizeof(UI_HEARTS[0])))

/* The cat's day is a function of the owner's, so it is built once rather than per frame.
 * badge_paint_state_t carries the two as pointers and badge_ui_plan_state_eq() compares
 * pointers, so a stable address is also what keeps the day ring out of the dirty list
 * after the first frame. */
static badge_day_seg_t s_day_cat[UI_DAY_N];

/* The five touch-self-test targets (badge_touch_targets[], from the specification's
 * `touchTest`). Which have been hit is UI state: it is a development screen, the
 * specification gives it no rules beyond "点一下", and entering it resets them. */
#define UI_TT_COUNT  BADGE_TOUCH_TARGET_COUNT
#define UI_TT_RADIUS 40

/* --------------------------------------------------------------- the struct ---*/

typedef struct {
    char     text[UI_FLOAT_BYTES];
    int      x, y;
    uint32_t t0;
} ui_float_t;

struct badge_ui {
    badge_fsm_t       *fsm;
    badge_cat_layer_t *cat;

    lv_obj_t *face;  /* layer 1: the screen's own canvas          */
    lv_obj_t *texts; /* layer 2: the container holding the labels */
    lv_obj_t *comp;  /* layer 3: the composites' canvas           */
    lv_obj_t *trans; /* layer 4: the transition snapshot (lazy)   */
    lv_obj_t *dots_root;
    lv_obj_t *dots[3];
    bool preview_guide;
    uint32_t motion_prepare_us, motion_capture_us, motion_build_us;
    lv_obj_t *experience_entry, *experience_status;
    lv_obj_t *tutorial_label, *tutorial_sub, *tutorial_skip;
    lv_obj_t *tutorial_mask, *tutorial_card, *tutorial_back_title, *tutorial_back_sub;
    lv_obj_t *tutorial_finger, *tutorial_segments[5];
    lv_obj_t *hint_arcs[4], *hint_labels[4];

    uint32_t *face_buf;
    uint32_t *comp_buf;
    uint32_t *trans_buf;

    int             screen_idx; /* badge_screen_t built, -1 before the first */
    badge_ui_plan_t plan;

    lv_obj_t *lbl[BADGE_UI_PLAN_MAX_EL];
    uint16_t  lbl_el[BADGE_UI_PLAN_MAX_EL]; /* badge_els[] index, UI_EL_NONE */
    char      text[BADGE_UI_PLAN_MAX_EL][UI_STR_CAP];

    badge_paint_state_t st;
    badge_overlay_t overlay;
    bool preview_render;

    lv_obj_t *bubble_lbl;
    lv_obj_t *toast_lbl;
    lv_obj_t *float_lbl;
    uint16_t  bubble_text;
    uint32_t  bubble_t0;
    uint16_t  toast_text;
    uint32_t  toast_t0;
    uint32_t  edge_t0;
    bool      edge_on;

    ui_float_t floats[UI_FLOAT_MAX];
    int        float_n;

    bool tt_hit[UI_TT_COUNT];
    int  tt_hits;

    /* The finger, for BE_FEATHER. The state machine's gesture recogniser deliberately
     * keeps only what the gestures need, so the live point lives here (badge_ui.h
     * documents why this is a setter rather than painter state). */
    int  finger_x, finger_y;
    int  press_x, press_y;
    bool finger_down;

    int  place;
    bool full; /* repaint everything on the next refresh */

    /* The transition, as the reference keeps it: a snapshot of the outgoing screen, a
     * start time and a direction. */
    uint32_t    trans_t0;
    badge_nav_t trans_dir;
    bool        trans_on;

    lv_draw_buf_t motion_buf[2];
    void *motion_pixels[2];
    lv_obj_t *motion_image[2];
    lv_obj_t *motion_root;
    int motion_source, motion_target, motion_offset, motion_from, motion_to;
    badge_nav_t motion_dir;
    uint32_t motion_t0, motion_ms;
    bool motion_on, motion_settling, motion_demo;
    lv_draw_buf_t cached_target[4];
    void *cached_pixels[4];
    bool cached_ready[4], cached_source, motion_live_fallback;
    int cached_screen, cached_minute;
    uint8_t cached_step;
    bool cached_returning, cached_complete;
    uint32_t cache_idle_t0;
    badge_game_t cached_game;
};

/* The four settings, in badge_spec_data.h's BADGE_SETTING_* order, as the planner wants
 * them. badge_ui_plan.c deliberately does not reach into badge_game_t, so the mapping
 * from the game's flags to the settings array lives here. */
static void ui_settings(const badge_ui_t *ui, uint8_t out[BADGE_UI_SETTING_COUNT])
{
    const badge_game_t *g = badge_fsm_game_const(ui->fsm);
    out[BADGE_SETTING_BRIGHT] = g->bright ? 1u : 0u;
    out[BADGE_SETTING_WAKE] = g->wake_word ? 1u : 0u;
    out[BADGE_SETTING_DISCOVER] = g->discover ? 1u : 0u;
    out[BADGE_SETTING_AOD] = g->aod ? 1u : 0u;
}

/* --------------------------------------------------------------- the layers ---*/

/*
 * The z-order, stated rather than assumed.
 *
 * LVGL 9 draws a parent's children in ascending index order (lv_refr.c:176-178), so
 * index 0 is the BOTTOM of the stack and the last index is the top. badge_ui.h's order
 * is cat 0 / face 1 / labels 2 / composites 3 / transition 4, and the cat is created by
 * main.c inside this same parent before the UI exists, so the UI's three layers go at
 * cat_index + 1, + 2, + 3.
 *
 * Deriving the base instead of hardcoding 1 is what keeps this correct when `cat` is
 * NULL -- a host screenshot build has no 3D engine, and badge_ui.h says the parameter
 * may be NULL. In that case the face is the bottom layer and the indices are 0/1/2.
 */
static int ui_layer_base(const badge_ui_t *ui)
{
    if (!ui->cat) return 0;
    lv_obj_t *o = badge_cat_layer_obj(ui->cat);
    if (!o) return 0;
    /* The cat's index is 0 by construction (created first), but reading it rather than
     * assuming it survives any future re-parenting on main.c's side. */
    const int idx = lv_obj_get_index(o);
    return idx >= 0 ? idx + 1 : 1;
}

static void ui_layers_order(badge_ui_t *ui)
{
    const int base = ui_layer_base(ui);
    lv_obj_move_to_index(ui->face, base);
    lv_obj_move_to_index(ui->texts, base + 1);
    lv_obj_move_to_index(ui->comp, base + 2);
    if (ui->trans) {
        lv_obj_move_to_index(ui->trans, base + 3);
    }

    /* The three composites are labels, so they live on the text layer with the screen's
     * labels. A screen change deletes and recreates those labels, which pushes them
     * above the composites, so the composites are raised back to the top of `texts`
     * here. Without this, a bubble would appear UNDER a stat label it overlaps. */
    const int top = lv_obj_get_child_count(ui->texts) - 1;
    if (top < 0) return;
    if (ui->bubble_lbl) lv_obj_move_to_index(ui->bubble_lbl, top);
    if (ui->toast_lbl) lv_obj_move_to_index(ui->toast_lbl, top);
    if (ui->float_lbl) lv_obj_move_to_index(ui->float_lbl, top);
}

/* ---------------------------------------------------------------- forward -----*/

static void ui_comp_rrect(uint32_t *buf, int x0, int y0, int w, int h, int radius, lv_color_t c,
                          int alpha);
static void ui_apply_setting(badge_ui_t *ui, const badge_el_t *el);
static void ui_apply_dynamic_icon(badge_ui_t *ui, const badge_el_t *el);
static bool ui_transition_is_cover(badge_nav_t dir);

/* ------------------------------------------------------------------ helpers ---*/

static void *ui_alloc(size_t bytes)
{
    void *p = heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!p) {
        ESP_LOGW(TAG, "no PSRAM for %u bytes; falling back to internal RAM", (unsigned)bytes);
        p = heap_caps_malloc(bytes, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    }
    if (p) memset(p, 0, bytes);
    return p;
}

static void ui_day_sync(void)
{
    if (s_day_cat[0].b != 0) return;
    for (int i = 0; i < UI_DAY_N; i++) {
        s_day_cat[i].a = UI_DAY[i].a;
        s_day_cat[i].b = UI_DAY[i].b;
        s_day_cat[i].kind = UI_CATK[UI_DAY[i].kind];
    }
}

static lv_color_t ui_col(int idx)
{
    if (idx < 0 || idx >= BADGE_COLOR_COUNT) return lv_color_make(0xFF, 0xFF, 0xFF);
    return lv_color_make((uint8_t)(badge_colors[idx].rgb888 >> 16),
                         (uint8_t)(badge_colors[idx].rgb888 >> 8),
                         (uint8_t)badge_colors[idx].rgb888);
}

static const char *ui_str(uint16_t idx)
{
    if (idx == 0 || idx >= BADGE_STRING_COUNT) return "";
    return badge_strings[idx];
}

static void ui_copy(char *dst, size_t cap, const char *src)
{
    if (!cap) return;
    if (!src) {
        dst[0] = '\0';
        return;
    }
    const size_t n = strlen(src);
    const size_t len = n < cap - 1u ? n : cap - 1u;
    memcpy(dst, src, len);
    dst[len] = '\0';
}

/*
 * {brightText}: the settings screen's brightness value.
 *
 * The specification defines no wording for it -- `val_bright` is `{brightText}`, the
 * settings screen's label, and badge_spec.json's `texts` has no bright key -- so this is
 * a firmware choice either way. It is filled from the reference's own table,
 * BRIGHT = [['低', .45], ['中', .75], ['高', 1]] (吧唧渲染参考.html:1325), whose level
 * names match badge_bright_levels[] in badge_spec.h one for one.
 *
 * Verified, not assumed: badge_f20.c carries glyph descriptors for all three --
 * U+4F4E 低 at :4818, U+4E2D 中 at :1711 and U+9AD8 高 at :97479 -- and the label is
 * f20 (badge_spec_data.h's BADGE_BUBBLE_FONT-independent `f20` on val_bright). So the
 * words render. (高 is absent from f16 and f24, which is a reason not to move this
 * label to another face, not a reason to avoid the word.)
 */
static void ui_bright_text(int level, char *out, size_t cap)
{
    static const char *const names[BADGE_BRIGHT_LEVELS] = {"低", "中", "高"};
    if (level < 0 || level >= BADGE_BRIGHT_LEVELS) level = 0;
    snprintf(out, cap, "%s", names[level]);
}

/* --------------------------------------------------------------------- text ---*/

/*
 * The resolved text of every element of the current screen, into ui->text[].
 *
 * The expansion itself is badge_ui_expand() (badge_ui_plan.h), which implements the
 * specification's fill(): {careLabel:<key>} first, then every other token, with the
 * substituted values expanded again so that the places' own "{name}在公司楼下花坛"
 * resolves. Keeping ONE implementation of that grammar is why this file builds the
 * variable table and does not parse templates itself.
 */
static void ui_resolve_vars(badge_ui_t *ui, badge_ui_vars_t *v, char *time_buf, size_t time_cap,
                            char *bright_buf, size_t bright_cap, char *tt_xy, size_t tt_xy_cap,
                            char *tt_txt, size_t tt_txt_cap)
{
    const badge_game_t *g = badge_fsm_game_const(ui->fsm);
    const int now_min = badge_fsm_now_min(ui->fsm);

    memset(v, 0, sizeof(*v));

    v->name = g->name;
    v->stat = g->stat;
    v->coins = (int)g->coins;
    v->growth = (int)g->growth;
    v->next_growth = badge_fsm_next_growth(g);
    v->stage = badge_fsm_stage_name(g);
    v->step = badge_fsm_care_step(ui->fsm);
    v->n = badge_fsm_pending(ui->fsm);

    (void)snprintf(time_buf, time_cap, "%02d:%02d", now_min / 60, now_min % 60);
    v->time = time_buf;

    v->bat = ui->st.bat_pct;

    ui_bright_text((int)g->bright, bright_buf, bright_cap);
    v->bright_text = bright_buf;

    v->phone_text = badge_fsm_phone(ui->fsm) ? ui_str(BADGE_TXT_PHONEON) : ui_str(BADGE_TXT_PHONEOFF);
    v->sync_text =
        badge_fsm_pending(ui->fsm) > 0 ? ui_str(BADGE_TXT_SYNCWAIT) : ui_str(BADGE_TXT_SYNCED);
    v->pair_code = badge_fsm_pair_code(ui->fsm);

    const badge_peer_t *peer = badge_fsm_peer(ui->fsm);
    v->peer = peer ? peer->name : "";
    /* The specification has no breed-name table (badge_spec.json's `texts` has 18 keys,
     * none of them a breed). The reference hardcodes 布偶猫; an empty string is the
     * honest answer, and {peerBreed} is only drawn on a screen a peer is already on. */
    v->peer_breed = "";
    v->meet_gift = ui_str(BADGE_TXT_MEETGIFT);

    /* The first of the three places the App can report; badge_ui_set_place() moves it. */
    const badge_place_def_t *pl = badge_place_def(ui->place);
    v->place_icon = pl ? badge_icon_name(pl->icon) : "";
    v->place_text = pl ? ui_str(pl->text) : "";
    v->place_sub = pl ? ui_str(pl->sub) : "";

    const int gp = (int)g->guide_page;
    const badge_guide_def_t *gd = (gp >= 0 && gp < BADGE_GUIDE_COUNT) ? &badge_guide_defs[gp]
                                                                     : &badge_guide_defs[0];
    v->guide_icon = badge_icon_name(gd->icon);
    v->guide_title = ui_str(gd->title);
    v->guide_sub = ui_str(gd->sub);

    if (ui->finger_down) {
        (void)snprintf(tt_xy, tt_xy_cap, "坐标 x %d, y %d", ui->finger_x, ui->finger_y);
    } else {
        ui_copy(tt_xy, tt_xy_cap, "点一个靶点");
    }
    v->tt_xy = tt_xy;

    if (ui->tt_hits >= UI_TT_COUNT) {
        ui_copy(tt_txt, tt_txt_cap, "5 个都对，方向正确");
    } else {
        (void)snprintf(tt_txt, tt_txt_cap, "已点中 %d / %d", ui->tt_hits, UI_TT_COUNT);
    }
    v->tt_text = tt_txt;

    v->voice_state = badge_fsm_voice_thinking(ui->fsm) ? ui_str(BADGE_TXT_THINKING)
                                                       : ui_str(BADGE_TXT_LISTENING);
    /* The 固件 {ver} footer shows the specification version this firmware was generated
     * from -- the number that says whether the tables match the package. */
    v->ver = BADGE_SPEC_VERSION;
    v->sleep_now = ui_str(BADGE_TXT_SLEEPNOW);

    /* {careLabel:<key>}: the care's refusal wording when it is refused right now, the
     * care's own label otherwise. badge_ui_plan.h documents the NULL convention. */
    for (int i = 0; i < BADGE_CARE_COUNT_SPEC; i++) {
        uint16_t why = 0;
        v->care_label[i] = badge_fsm_care_blocked(ui->fsm, i, &why) ? ui_str(why) : NULL;
    }
}

static void ui_resolve_texts(badge_ui_t *ui, const badge_screen_def_t *sd)
{
    if (!sd) return;

    badge_ui_vars_t v;
    char time_buf[16];
    char bright_buf[8];
    char tt_xy[40];
    char tt_txt[40];
    ui_resolve_vars(ui, &v, time_buf, sizeof(time_buf), bright_buf, sizeof(bright_buf), tt_xy,
                    sizeof(tt_xy), tt_txt, sizeof(tt_txt));

    int n = sd->el_count;
    if (n > BADGE_UI_PLAN_MAX_EL) n = BADGE_UI_PLAN_MAX_EL;

    for (int i = 0; i < n; i++) {
        const badge_el_t *el = &badge_els[sd->el_first + i];
        ui->text[i][0] = '\0';
        if (el->text == 0) continue;
        if (el->type != BE_LABEL && el->type != BE_PILL) continue;
        const int need =
            badge_ui_expand(ui_str(el->text), &v, ui->text[i], sizeof(ui->text[i]));
        (void)need; /* truncation is visible: the widget shows a clipped line */
    }
}

static void ui_label_place(lv_obj_t *l, const badge_el_t *el)
{
    switch (el->align) {
    case BADGE_ALIGN_LEFT:
        /* el->x is the LEFT edge, el->y the vertical centre. */
        lv_obj_align(l, LV_ALIGN_LEFT_MID, el->x, el->y - BADGE_CY);
        break;
    case BADGE_ALIGN_RIGHT:
        /* el->x is the RIGHT edge. RIGHT_MID measures from the parent's right edge, so
         * an offset of el->x - BADGE_SCR_W puts the label's right edge at el->x. */
        lv_obj_align(l, LV_ALIGN_RIGHT_MID, el->x - BADGE_SCR_W, el->y - BADGE_CY);
        break;
    default:
        lv_obj_align(l, LV_ALIGN_CENTER, el->x - BADGE_CX, el->y - BADGE_CY);
        break;
    }
}

/*
 * The colour a label draws in.
 *
 * A care label is drawn DIM while that care is refused -- drawEl('label'), line 1485:
 * `let c=el.color; if(el.care&&blockOf(el.care)) c='dim'`. The reference's blockOf() is
 * the FULL rule set, including the 喵币 price and the 生病 flag, so this asks the state
 * machine (badge_fsm_care_blocked(), which walks badge_blocks[] against the whole
 * badge_game_t) rather than badge_ui_plan_care_blocked().
 *
 * That distinction is not academic: the planner's version is the PAINTER's subset, which
 * skips the two rows badge_paint_state_t cannot carry. Asking it here would leave 喂食
 * (which has a 喵币 < 3 row) permanently dim. The planner's answer is used only to
 * decide whether pixels need repainting, which is a question about the painter's state.
 */
static lv_color_t ui_label_color(badge_ui_t *ui, const badge_el_t *el)
{
    int idx = el->color;
    if (el->care != BADGE_CARE_NONE) {
        uint16_t why = 0;
        if (badge_fsm_care_blocked(ui->fsm, (int)el->care, &why)) idx = BADGE_COLOR_DIM;
    }
    return ui_col(idx);
}

/* Create the label widgets for the current screen. Only BE_LABEL and BE_PILL own text:
 * badge_paint.c draws every other type, and draws a pill's rounded box while leaving the
 * pill's text to this layer (badge_paint.h).
 *
 * The screen's labels are deleted ONE BY ONE rather than with lv_obj_clean(ui->texts),
 * and that distinction is load bearing: the bubble, the toast and the float are also
 * children of `texts`, because they are text and this layer is where text lives. A clean
 * would delete them with the screen's labels, and then the first bubble after a screen
 * change would draw into a dangling pointer. */
static void ui_build_widgets(badge_ui_t *ui, const badge_screen_def_t *sd)
{
    for (int i = 0; i < BADGE_UI_PLAN_MAX_EL; i++) {
        if (ui->lbl[i]) lv_obj_delete(ui->lbl[i]);
        ui->lbl[i] = NULL;
        ui->lbl_el[i] = UI_EL_NONE;
    }
    if (!sd) return;

    int n = sd->el_count;
    if (n > BADGE_UI_PLAN_MAX_EL) n = BADGE_UI_PLAN_MAX_EL;

    for (int i = 0; i < n; i++) {
        const badge_el_t *el = &badge_els[sd->el_first + i];
        if (el->type != BE_LABEL && el->type != BE_PILL && el->type != BE_QR) continue;
        if (el->text == 0 && el->type != BE_QR) continue;

        lv_obj_t *l = lv_label_create(ui->texts);
        if (!l) continue;
        /* The reference draws every screen label with a single fillText(), so no
         * wrapping: the specification's own labels are all one line, and a wrapping
         * label would silently re-flow one that ever grew. The composites' labels do
         * wrap, and give themselves a width for it. */
        lv_label_set_long_mode(l, LV_LABEL_LONG_MODE_CLIP);
        extern const lv_font_t badge_n44;
        const bool main_clock = ui->screen_idx == BADGE_SCREEN_MAIN_A &&
                                strcmp(ui_str(el->id), "time") == 0;
        const bool pair_placeholder = ui->screen_idx == BADGE_SCREEN_PAIR && el->font == BADGE_FONT_N40;
        lv_obj_set_style_text_font(l, main_clock ? &badge_n44 :
            pair_placeholder ? &badge_f24 : badge_font(el->font), 0);
        lv_obj_set_style_text_color(l, ui_label_color(ui, el), 0);
        if (el->type == BE_PILL && el->w > 0) {
            /* A pill's text is centred inside the pill and wraps at its width. */
            lv_obj_set_width(l, el->w - 8);
            lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
        } else {
            lv_obj_set_style_text_align(l, el->align == BADGE_ALIGN_LEFT    ? LV_TEXT_ALIGN_LEFT
                                           : el->align == BADGE_ALIGN_RIGHT ? LV_TEXT_ALIGN_RIGHT
                                                                            : LV_TEXT_ALIGN_CENTER,
                                        0);
        }
        if (el->type == BE_QR) {
            lv_obj_set_style_text_font(l, badge_font(BADGE_FONT_F20), 0);
            lv_label_set_text(l, "扫码尚未接入");
        }
        lv_obj_remove_flag(l, LV_OBJ_FLAG_SCROLLABLE);
        ui->lbl[i] = l;
        ui->lbl_el[i] = (uint16_t)(sd->el_first + i);
        ui_label_place(l, el);
    }
}

static void ui_labels_apply(badge_ui_t *ui)
{
    for (int i = 0; i < BADGE_UI_PLAN_MAX_EL; i++) {
        if (!ui->lbl[i]) continue;
        const badge_el_t *el = &badge_els[ui->lbl_el[i]];
        if (el->type == BE_QR) continue;
        if (ui->screen_idx == BADGE_SCREEN_PAIR && el->font == BADGE_FONT_N40)
            lv_obj_set_style_text_font(ui->lbl[i], strchr(ui->text[i], '-') ? &badge_f24 : &badge_n40, 0);
        if (strcmp(lv_label_get_text(ui->lbl[i]), ui->text[i]) != 0)
            lv_label_set_text(ui->lbl[i], ui->text[i]);
    }
}

/* --------------------------------------------------------------- state build ---*/

/*
 * Build this frame's painter state.
 *
 * Everything is read, never derived: the state machine owns the stats and the alert,
 * badge_hw owns the battery, and the day tables are static. `now_ms` goes through as-is
 * because several painters animate from the raw clock (badge_ui_plan.h names them).
 */
static void ui_build_state(badge_ui_t *ui, uint32_t now_ms)
{
    badge_paint_state_t *st = &ui->st;
    const badge_game_t *g = badge_fsm_game_const(ui->fsm);

    ui_day_sync();
    memset(st, 0, sizeof(*st));

    st->now_ms = now_ms;
    memcpy(st->stat, g->stat, sizeof(st->stat));

    st->bat_pct = (uint8_t)badge_hw_battery_pct();
    st->charging = badge_hw_charging();

    st->now_min = badge_fsm_now_min(ui->fsm);
    st->day_owner = UI_DAY;
    st->day_owner_n = UI_DAY_N;
    st->day_cat = s_day_cat;
    st->day_cat_n = UI_DAY_N;
    st->hearts = UI_HEARTS;
    st->hearts_n = UI_HEARTS_N;

    st->step = badge_fsm_care_step(ui->fsm);

    st->finger_down = ui->finger_down;
    st->finger_x = ui->finger_x;
    st->finger_y = ui->finger_y;
    const badge_el_t *old_pressed = st->pressed_button;
    st->pressed_button = NULL;
    if (ui->finger_down && !ui->preview_render) {
        const badge_screen_def_t *screen = &badge_screens[badge_fsm_visual_screen(ui->fsm)];
        badge_nav_t drag_dir; int drag_off;
        if (!badge_fsm_drag(ui->fsm, &drag_dir, &drag_off)) {
            for (int i = 0; i < screen->el_count; ++i) {
                const badge_el_t *el = &badge_els[screen->el_first + i];
                if (el->type == BE_BTN && badge_el_contains(el, NULL, ui->press_x, ui->press_y) &&
                    badge_el_contains(el, NULL, ui->finger_x, ui->finger_y)) {
                    st->pressed_button = el; break;
                }
            }
        }
    }
    if (old_pressed != st->pressed_button) ui->full = true;

    st->wave_phase = (float)((double)now_ms / 1000.0);

    const int alert = badge_fsm_alert(ui->fsm);
    if (alert >= 0 && alert < BADGE_ALERT_COUNT) {
        st->alert_show = true;
        st->alert_icon = badge_alerts[alert].icon;
        /* The reference's pulse: .5 + .5*sin(ts * 2pi / (pulseMs/1000)), bright on the
         * positive half (drawEl('alert'), line 1502). */
        const double ts = (double)now_ms / 1000.0;
        st->alert_bright =
            sin(ts * 2.0 * UI_PI / ((double)BADGE_ALERT_PULSE_MS / 1000.0)) > 0.0;
    }

    /* The dots strip follows the guide page; a BE_DOTS with BADGE_ELF_ANIM ignores this
     * and animates from the clock (badge_paint.c). */
    st->dots_value = (int)g->guide_page;
    st->dots_n = BADGE_GUIDE_COUNT;

    st->anim_phase = (float)fmod((double)now_ms / 1000.0, 1.0);
}

/* ------------------------------------------------------------------ geometry ---*/

static bool ui_box_intersects(const badge_box_t *a, const badge_box_t *b)
{
    return !(a->x >= b->x + b->w || a->x + a->w <= b->x || a->y >= b->y + b->h ||
             a->y + a->h <= b->y);
}

static void ui_box_clamp(badge_box_t *b)
{
    int x1 = b->x + b->w, y1 = b->y + b->h;
    if (b->x < 0) b->x = 0;
    if (b->y < 0) b->y = 0;
    if (x1 > BADGE_SCR_W) x1 = BADGE_SCR_W;
    if (y1 > BADGE_SCR_H) y1 = BADGE_SCR_H;
    if (x1 < b->x) x1 = b->x;
    if (y1 < b->y) y1 = b->y;
    b->w = x1 - b->x;
    b->h = y1 - b->y;
}

/* The partial path clears the band itself: badge_paint_clear() fills the whole square by
 * design (it is what a full repaint means) and must not be used for a band. */
static void ui_clear_box(uint32_t *buf, const badge_box_t *box)
{
    badge_box_t b = *box;
    ui_box_clamp(&b);
    if (!buf || b.w <= 0 || b.h <= 0) return;
    for (int y = b.y; y < b.y + b.h; y++) {
        memset(&buf[(size_t)y * BADGE_SCR_W + (size_t)b.x], 0, (size_t)b.w * sizeof(uint32_t));
    }
}

/* Paint every visible element of the screen, optionally inside a clip rectangle. */
static void ui_paint_elements(badge_ui_t *ui, const badge_screen_def_t *sd, const badge_box_t *clip)
{
    if (!sd) return;
    int n = sd->el_count;
    if (n > BADGE_UI_PLAN_MAX_EL) n = BADGE_UI_PLAN_MAX_EL;

    if (clip) {
        badge_paint_clip(clip->x, clip->y, clip->x + clip->w, clip->y + clip->h);
    }

    badge_paint_batch_begin(ui->face);
    for (int i = 0; i < n; i++) {
        const badge_el_t *el = &badge_els[sd->el_first + i];
        if (el->type == BE_LABEL || el->type == BE_HIT || el->type == BE_QR) continue;
        /* BE_FEATHER is drawn at the finger or on a clock drift, never at its own box,
         * so a band repaint would clip it to the wrong place. It is skipped here and the
         * frame is made full whenever the finger moves (badge_ui_touch). */
        if (clip && el->type == BE_FEATHER) continue;
        badge_paint_el(ui->face, el, &ui->st);
        ui_apply_setting(ui, el);
        ui_apply_dynamic_icon(ui, el);
    }

    badge_paint_batch_end();
    if (clip) badge_paint_clip(0, 0, BADGE_SCR_W, BADGE_SCR_H);
}

/*
 * Repaint one band of the face canvas: clear the band, then redraw only the elements
 * that intersect it. This is the whole point of the module -- badge_paint_clip() makes
 * each primitive discard the pixels outside the band, so redrawing every intersecting
 * element costs the band's pixels rather than the panel's.
 */
static void ui_repaint_box(badge_ui_t *ui, const badge_screen_def_t *sd, const badge_box_t *box)
{
    badge_box_t clip = *box;
    ui_box_clamp(&clip);
    if (clip.w <= 0 || clip.h <= 0) return;

    ui_clear_box(ui->face_buf, &clip);

    int n = sd->el_count;
    if (n > BADGE_UI_PLAN_MAX_EL) n = BADGE_UI_PLAN_MAX_EL;

    badge_paint_clip(clip.x, clip.y, clip.x + clip.w, clip.y + clip.h);
    badge_paint_batch_begin(ui->face);
    for (int i = 0; i < n; i++) {
        const badge_el_t *el = &badge_els[sd->el_first + i];
        if (el->type == BE_LABEL || el->type == BE_HIT || el->type == BE_QR) continue;
        if (el->type == BE_FEATHER) continue;

        /* An element that has nothing to do with this band is skipped, which is what
         * keeps a one-arc change from walking all 27 elements. */
        badge_box_t eb;
        const char *txt = ui->text[i][0] ? ui->text[i] : NULL;
        if (!badge_el_box(el, txt, &eb) || !ui_box_intersects(&eb, &clip)) continue;

        badge_paint_el(ui->face, el, &ui->st);
        ui_apply_setting(ui, el);
        ui_apply_dynamic_icon(ui, el);
    }
    badge_paint_batch_end();
    badge_paint_clip(0, 0, BADGE_SCR_W, BADGE_SCR_H);
    lv_area_t origin;
    lv_obj_get_coords(ui->face, &origin);
    lv_area_t dirty = {.x1 = origin.x1 + clip.x, .y1 = origin.y1 + clip.y,
        .x2 = origin.x1 + clip.x + clip.w - 1, .y2 = origin.y1 + clip.y + clip.h - 1};
    lv_obj_invalidate_area(ui->face, &dirty);
}

/* ------------------------------------------------------- the two painter gaps ---*/

/* badge_paint.c draws BE_TOGGLE in its OFF state and says so: on/off is a setting, which
 * this layer owns (badge_ui_plan_settings()). Repaint the track and move the knob to the
 * right when it is on. */
static void ui_apply_setting(badge_ui_t *ui, const badge_el_t *el)
{
    if (el->type != BE_TOGGLE) return;
    const int idx = (int)el->value - BADGE_VALUE_BRIGHT;
    if (idx < 0 || idx >= BADGE_UI_SETTING_COUNT) return;
    if (!ui->plan.settings[idx]) return;

    const int w = el->w > 0 ? el->w : 52;
    const int h = el->h > 0 ? el->h : 28;
    const int x0 = el->x - w;
    const int y0 = el->y - h / 2;
    (void)badge_paint_rrect(ui->face, x0, y0, w, h, h / 2, ui_col(BADGE_COLOR_ACCENT));
    (void)badge_paint_disc(ui->face, x0 + w - h / 2, el->y, h / 2 - 4, ui_col(BADGE_COLOR_TEXT));
}

/* {placeIcon} / {guideIcon}: the generator stores the two dynamic indices because the
 * icon depends on the screen's data, not on the element (badge_spec.h). The painter has
 * no access to that data, so this layer substitutes the real index and redraws. */
static void ui_apply_dynamic_icon(badge_ui_t *ui, const badge_el_t *el)
{
    if (el->type != BE_ICON) return;
    if (el->icon != BADGE_ICON_DYN_PLACE && el->icon != BADGE_ICON_DYN_GUIDE) return;

    const badge_place_def_t *pl = badge_place_def(ui->place);
    const int gp = (int)badge_fsm_game_const(ui->fsm)->guide_page;
    const badge_guide_def_t *gd =
        (gp >= 0 && gp < BADGE_GUIDE_COUNT) ? &badge_guide_defs[gp] : &badge_guide_defs[0];

    const int real = (el->icon == BADGE_ICON_DYN_PLACE) ? (pl ? (int)pl->icon : BADGE_ICON_OFFICE)
                                                        : (int)gd->icon;
    const int scale = el->scale_x2 > 1 ? (el->scale_x2 + 1) / 2 : 1;
    (void)badge_paint_icon(ui->face, real, el->x, el->y, scale);
}

/* ------------------------------------------------------------------ canvases ---*/

static lv_obj_t *ui_canvas(lv_obj_t *parent, uint32_t *buf)
{
    lv_obj_t *c = lv_canvas_create(parent);
    if (!c) return NULL;
    lv_canvas_set_buffer(c, buf, BADGE_SCR_W, BADGE_SCR_H, LV_COLOR_FORMAT_ARGB8888);
    lv_obj_set_pos(c, 0, 0);
    lv_obj_set_size(c, BADGE_SCR_W, BADGE_SCR_H);
    lv_obj_remove_flag(c, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_remove_flag(c, LV_OBJ_FLAG_CLICKABLE);
    return c;
}

static lv_obj_t *ui_label_layer(lv_obj_t *parent)
{
    lv_obj_t *o = lv_obj_create(parent);
    if (!o) return NULL;
    lv_obj_remove_style_all(o);
    lv_obj_set_size(o, BADGE_SCR_W, BADGE_SCR_H);
    lv_obj_set_pos(o, 0, 0);
    lv_obj_set_layout(o, LV_LAYOUT_NONE);
    lv_obj_set_style_pad_all(o, 0, 0);
    lv_obj_set_style_bg_opa(o, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(o, 0, 0);
    lv_obj_set_style_clip_corner(o, false, 0);
    lv_obj_remove_flag(o, LV_OBJ_FLAG_SCROLLABLE);
    return o;
}

/* A composite's text is a label on the text layer, hidden until its composite shows.
 * Creating them once rather than per use keeps refresh() allocation-free. */
static lv_obj_t *ui_comp_label(badge_ui_t *ui, const lv_font_t *font, int width, int y)
{
    lv_obj_t *l = lv_label_create(ui->texts);
    if (!l) return NULL;
    lv_obj_set_style_text_font(l, font, 0);
    lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_width(l, width);
    lv_label_set_long_mode(l, LV_LABEL_LONG_MODE_WRAP);
    lv_obj_align(l, LV_ALIGN_CENTER, 0, y - BADGE_CY);
    lv_obj_add_flag(l, LV_OBJ_FLAG_HIDDEN);
    lv_obj_remove_flag(l, LV_OBJ_FLAG_SCROLLABLE);
    return l;
}

/* ------------------------------------------------------------------ composites --*/

static void ui_blend_px(uint32_t *buf, int x, int y, lv_color_t c, int alpha)
{
    if (!buf || alpha <= 0) return;
    if (!badge_paint_covering(x, y)) return;
    uint32_t *p = &buf[(size_t)y * BADGE_SCR_W + (size_t)x];
    if (alpha >= 255) {
        *p = 0xFF000000u | ((uint32_t)c.red << 16) | ((uint32_t)c.green << 8) | c.blue;
        return;
    }
    const uint32_t d = *p;
    const uint32_t da = (d >> 24) & 0xFFu;
    const uint32_t sa = (uint32_t)alpha;
    const uint32_t ia = 255u - sa;
    const uint32_t out_a = sa + (da * ia + 127u) / 255u;
    const uint32_t den = out_a ? out_a : 1u;
    const uint32_t dr = (d >> 16) & 0xFFu, dg = (d >> 8) & 0xFFu, db = d & 0xFFu;
    const uint32_t r = ((uint32_t)c.red * sa + (dr * da * ia + 127u) / 255u + den / 2u) / den;
    const uint32_t g = ((uint32_t)c.green * sa + (dg * da * ia + 127u) / 255u + den / 2u) / den;
    const uint32_t b = ((uint32_t)c.blue * sa + (db * da * ia + 127u) / 255u + den / 2u) / den;
    *p = ((out_a > 255u ? 255u : out_a) << 24) | ((r > 255u ? 255u : r) << 16) |
         ((g > 255u ? 255u : g) << 8) | (b > 255u ? 255u : b);
}

/* The only two composite shapes are a rounded rectangle (bubble, toast) and a circle
 * outline (the no-motor edge ring). *Composites are the only writers of comp_buf, so
 * they carry their own blend rather than routing through badge_paint.c, which paints
 * into the face canvas and applies the repaint clip that must not affect them.*/
static void ui_comp_rrect(uint32_t *buf, int x0, int y0, int w, int h, int radius, lv_color_t c,
                          int alpha)
{
    if (w <= 0 || h <= 0) return;
    if (radius < 0) radius = 0;
    if (radius * 2 > w) radius = w / 2;
    if (radius * 2 > h) radius = h / 2;
    const int r2 = radius * radius;

    for (int y = y0; y < y0 + h; y++) {
        for (int x = x0; x < x0 + w; x++) {
            int cx = -1, cy = -1;
            if (x < x0 + radius) cx = x0 + radius;
            else if (x >= x0 + w - radius) cx = x0 + w - radius - 1;
            if (y < y0 + radius) cy = y0 + radius;
            else if (y >= y0 + h - radius) cy = y0 + h - radius - 1;
            if (cx >= 0 && cy >= 0) {
                const int dx = x - cx, dy = y - cy;
                if (dx * dx + dy * dy > r2) continue;
            }
            ui_blend_px(buf, x, y, c, alpha);
        }
    }
}

static void ui_comp_ring(uint32_t *buf, int cx, int cy, int r, int w, lv_color_t c, int alpha)
{
    const int outer = r + w / 2;
    const int inner = r - w / 2;
    if (outer <= 0 || inner < 0) return;
    const int o2 = outer * outer, i2 = inner * inner;
    for (int y = cy - outer; y <= cy + outer; y++) {
        for (int x = cx - outer; x <= cx + outer; x++) {
            const int dx = x - cx, dy = y - cy;
            const int d2 = dx * dx + dy * dy;
            if (d2 > o2 || d2 < i2) continue;
            ui_blend_px(buf, x, y, c, alpha);
        }
    }
}

/* fade(age, total, in_ms, out_ms): the reference's `min(1, age/in, (total-age)/out)`. */
static int ui_fade(uint32_t age, uint32_t total, uint32_t in_ms, uint32_t out_ms)
{
    if (age >= total) return 0;
    int a = (int)((age * 255u) / (in_ms ? in_ms : 1u));
    const int b = (int)(((total - age) * 255u) / (out_ms ? out_ms : 1u));
    if (b < a) a = b;
    if (a < 0) a = 0;
    if (a > 255) a = 255;
    return a;
}

/*
 * The bubble: the cat's speech. Box, tail and text, with the reference's 150 ms fade in
 * and 200 ms fade out (drawBubble, lines 1517-1522). The wording is the pre-created
 * label, which is why this only sets its opacity.
 */
static void ui_draw_bubble(badge_ui_t *ui, uint32_t now_ms)
{
    const uint32_t total = badge_numbers.bubble_ms;
    if (ui->bubble_text == 0) {
        if (ui->bubble_lbl) lv_obj_add_flag(ui->bubble_lbl, LV_OBJ_FLAG_HIDDEN);
        return;
    }
    const uint32_t age = now_ms - ui->bubble_t0;
    if (age >= total) {
        ui->bubble_text = 0;
        if (ui->bubble_lbl) lv_obj_add_flag(ui->bubble_lbl, LV_OBJ_FLAG_HIDDEN);
        return;
    }

    const char *text = ui_str(ui->bubble_text);
    int w = badge_text_width(text, BADGE_BUBBLE_FONT) + BADGE_BUBBLE_PAD_X * 2;
    if (w > BADGE_BUBBLE_MAX_W) w = BADGE_BUBBLE_MAX_W;
    const int lh = badge_fonts[BADGE_BUBBLE_FONT].line_h;
    const bool pet_reply = ui->bubble_text == BADGE_TXT_PETFULL ||
        ui->bubble_text == BADGE_TXT_PETGOOD || ui->bubble_text == BADGE_TXT_PETPLAY ||
        ui->bubble_text == BADGE_TXT_PETMISS;
    const int h = pet_reply ? 46 : BADGE_BUBBLE_MAX_LINES * lh + BADGE_BUBBLE_PAD_Y * 2;
    const int x = BADGE_CX - w / 2;
    const int y = BADGE_BUBBLE_Y - h / 2;

    const int alpha = ui_fade(age, total, UI_BUBBLE_FADE_IN, UI_BUBBLE_FADE_OUT);
    const lv_color_t bg = pet_reply ? lv_color_make(0x20,0x1A,0x14) : ui_col(BADGE_BUBBLE_BG);
    ui_comp_rrect(ui->comp_buf, x, y, w, h, BADGE_BUBBLE_RADIUS, bg, alpha);
    /* The tail: rows narrowing to a point, below the box's centre. */
    for (int i = 0; i <= BADGE_BUBBLE_TAIL; i++) {
        const int half = (BADGE_BUBBLE_TAIL - i) / 2;
        ui_comp_rrect(ui->comp_buf, BADGE_CX - half, y + h + i, half * 2 + 1, 1, 0, bg, alpha);
    }

    if (ui->bubble_lbl) {
        lv_obj_set_width(ui->bubble_lbl, w - BADGE_BUBBLE_PAD_X * 2);
        lv_obj_set_height(ui->bubble_lbl, pet_reply ? lh : BADGE_BUBBLE_MAX_LINES * lh);
        lv_obj_set_style_text_color(ui->bubble_lbl, ui_col(BADGE_BUBBLE_FG), 0);
        lv_obj_set_style_opa(ui->bubble_lbl, (lv_opa_t)alpha, 0);
        lv_obj_align(ui->bubble_lbl, LV_ALIGN_CENTER, 0, y + h / 2 - BADGE_CY);
        lv_obj_remove_flag(ui->bubble_lbl, LV_OBJ_FLAG_HIDDEN);
    }
}

/*
 * The toast: an operation's result. Box and text, 120 ms in and 200 ms out
 * (drawToast, lines 1530-1531).
 *
 * The box is clamped to the safe circle. BADGE_TOAST_Y is a CENTRE line, so the box
 * spans y 360..400 and its worst corner is 200 px from the centre -- inside
 * BADGE_SAFE_R 212. The clamp is therefore inert for the specification's own numbers
 * (see the file header); it is kept as a defence in case the toast moves or grows, and
 * badge_safe_half_width_at() takes a BOTTOM edge, which is why 400 and not 380.
 */
static void ui_draw_toast(badge_ui_t *ui, uint32_t now_ms)
{
    const uint32_t total = badge_numbers.toast_ms;
    if (ui->toast_text == 0) {
        if (ui->toast_lbl) lv_obj_add_flag(ui->toast_lbl, LV_OBJ_FLAG_HIDDEN);
        return;
    }
    const uint32_t age = now_ms - ui->toast_t0;
    if (age >= total) {
        ui->toast_text = 0;
        if (ui->toast_lbl) lv_obj_add_flag(ui->toast_lbl, LV_OBJ_FLAG_HIDDEN);
        return;
    }

    const char *text = ui_str(ui->toast_text);
    int w = badge_text_width(text, BADGE_TOAST_FONT) + UI_TOAST_PAD_X * 2;
    if (w > BADGE_TOAST_MAX_W) w = BADGE_TOAST_MAX_W;
    const int half_max = badge_safe_half_width_at(BADGE_TOAST_Y + BADGE_TOAST_H / 2);
    if (half_max > 0 && w / 2 > half_max) w = half_max * 2;
    if (w < 60) w = 60;

    const int alpha = ui_fade(age, total, UI_TOAST_FADE_IN, UI_TOAST_FADE_OUT);
    ui_comp_rrect(ui->comp_buf, BADGE_CX - w / 2, BADGE_TOAST_Y - BADGE_TOAST_H / 2, w,
                  BADGE_TOAST_H, BADGE_TOAST_RADIUS, ui_col(BADGE_TOAST_BG), alpha);

    if (ui->toast_lbl) {
        lv_obj_set_width(ui->toast_lbl, w - UI_TOAST_PAD_X * 2);
        lv_obj_set_style_text_color(ui->toast_lbl, ui_col(BADGE_TOAST_FG), 0);
        lv_obj_set_style_opa(ui->toast_lbl, (lv_opa_t)alpha, 0);
        lv_obj_align(ui->toast_lbl, LV_ALIGN_CENTER, 0, BADGE_TOAST_Y - BADGE_CY);
        lv_obj_remove_flag(ui->toast_lbl, LV_OBJ_FLAG_HIDDEN);
    }
}

/* The no-motor fallback: the outermost ring lights for BADGE_HAPTIC_MS, faded by
 * sin(pi * progress) as the reference does (drawRing, line 1523, and spec 12.2). */
static void ui_draw_hold(badge_ui_t *ui, uint16_t progress)
{
    if (!progress) return;
    const lv_color_t color = ui_col(BADGE_COLOR_ACCENT);
    const unsigned steps = ((unsigned)progress * 1440u + 999u) / 1000u;
    for (unsigned i = 0; i <= steps; ++i) {
        const double angle = (double)i * UI_PI / 720.0 - UI_PI / 2.0;
        const double c = cos(angle), s = sin(angle);
        for (int r = BADGE_MOTION_HOLD_R - BADGE_MOTION_HOLD_W / 2;
             r < BADGE_MOTION_HOLD_R + BADGE_MOTION_HOLD_W / 2; ++r) {
            const int x = BADGE_CX + (int)lround(c * r);
            const int y = BADGE_CY + (int)lround(s * r);
            ui_blend_px(ui->comp_buf, x, y, color, 255);
        }
    }
}

static void ui_draw_edge(badge_ui_t *ui, uint32_t now_ms)
{
    if (!ui->edge_on) return;
    const uint32_t age = now_ms - ui->edge_t0;
    if (age >= (uint32_t)BADGE_HAPTIC_MS) {
        ui->edge_on = false;
        return;
    }
    const double p = (double)age / (double)BADGE_HAPTIC_MS;
    const int alpha = (int)(sin(UI_PI * p) * 255.0);
    if (alpha <= 0) return;
    ui_comp_ring(ui->comp_buf, BADGE_CX, BADGE_CY, BADGE_HAPTIC_RING_R, BADGE_HAPTIC_RING_W,
                 ui_col(BADGE_COLOR_ACCENT), alpha);
}

/* The floating "+9" over the cat: rise BADGE_FLOAT_RISE px over BADGE_FLOAT_RISE_MS
 * while fading out (drawFx, line 1532). */
static void ui_draw_floats(badge_ui_t *ui, uint32_t now_ms)
{
    int kept = 0;
    for (int i = 0; i < ui->float_n; i++) {
        ui_float_t *f = &ui->floats[i];
        if (now_ms - f->t0 >= (uint32_t)BADGE_FLOAT_RISE_MS) continue;
        ui->floats[kept] = *f;
        kept++;
    }
    ui->float_n = kept;

    if (!ui->float_lbl) return;
    if (ui->float_n == 0) {
        lv_obj_add_flag(ui->float_lbl, LV_OBJ_FLAG_HIDDEN);
        return;
    }
    const ui_float_t *f = &ui->floats[ui->float_n - 1];
    const uint32_t age = now_ms - f->t0;
    const int rise = (int)((uint32_t)BADGE_FLOAT_RISE * age / (uint32_t)BADGE_FLOAT_RISE_MS);
    int alpha = 255 - (int)((age * 255u) / (uint32_t)BADGE_FLOAT_RISE_MS);
    if (alpha < 0) alpha = 0;
    lv_label_set_text(ui->float_lbl, f->text);
    lv_obj_set_style_text_color(ui->float_lbl, ui_col(BADGE_FLOAT_COLOR), 0);
    lv_obj_set_style_opa(ui->float_lbl, (lv_opa_t)alpha, 0);
    lv_obj_align(ui->float_lbl, LV_ALIGN_CENTER, f->x - BADGE_CX, f->y - rise - BADGE_CY);
    lv_obj_remove_flag(ui->float_lbl, LV_OBJ_FLAG_HIDDEN);
}

/* ----------------------------------------------------------------- transition ---*/

/* Snapshot / restore the four layers' positions. A stuck transition must not be able to
 * leave the UI offset, so the reset is unconditional on the way out. */
static void ui_layers_pos(badge_ui_t *ui, int dx, int dy)
{
    lv_obj_set_pos(ui->face, dx, dy);
    lv_obj_set_pos(ui->texts, dx, dy);
    lv_obj_set_pos(ui->comp, dx, dy);
}

static void ui_transition_reset(badge_ui_t *ui)
{
    ui_layers_pos(ui, 0, 0);
    if (ui->trans) {
        lv_obj_set_pos(ui->trans, 0, 0);
        lv_obj_set_style_opa(ui->trans, LV_OPA_COVER, 0);
    }
}

/* The outgoing screen is in face_buf when badge_ui_rebuild() runs, before the face is
 * repainted: that is the reference's `sg.drawImage(cv, 0, 0)`. */
static bool ui_transition_snapshot(badge_ui_t *ui)
{
    if (!ui->trans) {
        ui->trans_buf = (uint32_t *)ui_alloc((size_t)BADGE_SCR_W * BADGE_SCR_H * sizeof(uint32_t));
        if (!ui->trans_buf) return false;
        ui->trans = ui_canvas(lv_obj_get_parent(ui->face), ui->trans_buf);
        if (!ui->trans) return false;
    }
    lv_obj_add_flag(ui->trans, LV_OBJ_FLAG_HIDDEN);
    lv_draw_buf_t snapshot;
    const size_t bytes = (size_t)BADGE_SCR_W * BADGE_SCR_H * sizeof(uint32_t);
    if (lv_draw_buf_init(&snapshot, BADGE_SCR_W, BADGE_SCR_H, LV_COLOR_FORMAT_ARGB8888,
                         BADGE_SCR_W * 4, ui->trans_buf, bytes) != LV_RESULT_OK ||
        lv_snapshot_take_to_draw_buf(lv_obj_get_parent(ui->face), LV_COLOR_FORMAT_ARGB8888,
                                     &snapshot) != LV_RESULT_OK) return false;
    lv_obj_remove_flag(ui->trans, LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_style_opa(ui->trans, LV_OPA_COVER, 0);
    /* Above everything else: the snapshot is the whole outgoing screen, and the layers
     * being slid out from under it are on the stack below it. */
    lv_obj_move_to_index(ui->trans, lv_obj_get_child_count(lv_obj_get_parent(ui->face)) - 1);
    lv_obj_invalidate(ui->trans);
    return true;
}

/* --------------------------------------------------------------------- create ---*/

badge_ui_t *badge_ui_create(lv_obj_t *parent, badge_fsm_t *fsm, badge_cat_layer_t *cat)
{
    if (!parent || !fsm) return NULL;
    lv_obj_set_style_bg_color(parent, ui_col(BADGE_COLOR_BG), 0);
    lv_obj_set_style_bg_opa(parent, LV_OPA_COVER, 0);

    badge_ui_t *ui = heap_caps_calloc(1, sizeof(badge_ui_t), MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    if (!ui) {
        ESP_LOGE(TAG, "out of memory allocating badge_ui");
        return NULL;
    }
    ui->fsm = fsm;
    ui->cat = cat;
    ui->screen_idx = -1;
    ui->full = true;
    badge_ui_plan_reset(&ui->plan);

    const size_t px = (size_t)BADGE_SCR_W * (size_t)BADGE_SCR_H * sizeof(uint32_t);
    ui->face_buf = (uint32_t *)ui_alloc(px);
    ui->comp_buf = (uint32_t *)ui_alloc(px);
    if (!ui->face_buf || !ui->comp_buf) {
        ESP_LOGE(TAG, "out of memory for the %u-byte canvases", (unsigned)px);
        badge_ui_destroy(ui);
        return NULL;
    }

    memset(ui->comp_buf, 0, px);

    /*
     * Layers 1-3, created in order. badge_ui.h explains why the order is stated rather
     * than left implicit in creation order: the previous UI documented "bezel under cat"
     * and then created the cat first, so the documented stack and the real one disagreed
     * with nothing able to see it.
     *
     * The cat layer is NOT created here: main.c creates it inside this same parent and
     * passes it in, because the 3D renderer is the one thing this module does not own.
     * That is also why the cat's z-index relative to these four is main.c's business
     * (badge_ui.h documents the intended order).
     */
    ui->face = ui_canvas(parent, ui->face_buf);
    ui->texts = ui_label_layer(parent);
    ui->comp = ui_canvas(parent, ui->comp_buf);
    if (!ui->face || !ui->texts || !ui->comp) {
        ESP_LOGE(TAG, "could not create the UI layers");
        badge_ui_destroy(ui);
        return NULL;
    }

    ui->bubble_lbl = ui_comp_label(ui, badge_font(BADGE_BUBBLE_FONT), BADGE_BUBBLE_MAX_W, 0);
    ui->toast_lbl = ui_comp_label(ui, badge_font(BADGE_TOAST_FONT), BADGE_TOAST_MAX_W,
                                  BADGE_TOAST_Y);
    ui->float_lbl = ui_comp_label(ui, badge_font(BADGE_FLOAT_FONT), 120, 0);
    if (ui->float_lbl) lv_obj_set_style_text_color(ui->float_lbl, ui_col(BADGE_FLOAT_COLOR), 0);
    if (ui->bubble_lbl) {
        lv_obj_set_height(ui->bubble_lbl,
            badge_fonts[BADGE_BUBBLE_FONT].line_h * BADGE_BUBBLE_MAX_LINES);
        lv_label_set_long_mode(ui->bubble_lbl, LV_LABEL_LONG_MODE_DOTS);
    }
    if (ui->toast_lbl) {
        lv_obj_set_height(ui->toast_lbl, badge_fonts[BADGE_TOAST_FONT].line_h);
        lv_label_set_long_mode(ui->toast_lbl, LV_LABEL_LONG_MODE_DOTS);
    }

    ui->dots_root = lv_obj_create(lv_layer_top());
    if (ui->dots_root) {
        lv_obj_remove_style_all(ui->dots_root);
        lv_obj_set_size(ui->dots_root, 68, 24);
        lv_obj_set_pos(ui->dots_root, BADGE_CX - 34, 426 - 12);
        lv_obj_set_style_bg_color(ui->dots_root, ui_col(BADGE_COLOR_CARD), 0);
        lv_obj_set_style_bg_opa(ui->dots_root, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(ui->dots_root, 12, 0);
        lv_obj_remove_flag(ui->dots_root, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_add_flag(ui->dots_root, LV_OBJ_FLAG_HIDDEN);
        for (int i = 0; i < 3; ++i) {
            ui->dots[i] = lv_obj_create(ui->dots_root);
            if (!ui->dots[i]) continue;
            lv_obj_remove_style_all(ui->dots[i]);
            lv_obj_set_style_radius(ui->dots[i], LV_RADIUS_CIRCLE, 0);
            lv_obj_set_style_bg_opa(ui->dots[i], LV_OPA_COVER, 0);
            lv_obj_remove_flag(ui->dots[i], LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
        }
    }
    for (int i = 0; i < 4; ++i) {
        static const int angle[4] = {270, 90, 180, 0};
        static const int label_x[4] = {173, 173, 10, 336};
        static const int label_y[4] = {28, 384, 223, 223};
        ui->hint_arcs[i] = lv_arc_create(lv_layer_top());
        if (ui->hint_arcs[i]) {
            lv_obj_t *arc = ui->hint_arcs[i];
            lv_obj_remove_style_all(arc);
            lv_obj_set_size(arc, 465, 465);
            lv_obj_set_style_arc_width(arc, 5, LV_PART_MAIN);
            lv_obj_set_style_arc_opa(arc, LV_OPA_COVER, LV_PART_MAIN);
            lv_obj_set_style_arc_color(arc, ui_col(BADGE_COLOR_ACCENT), LV_PART_MAIN);
            lv_arc_set_bg_angles(arc, (angle[i] + 349) % 360, (angle[i] + 11) % 360);
            lv_obj_remove_flag(arc, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_add_flag(arc, LV_OBJ_FLAG_HIDDEN);
        }
        ui->hint_labels[i] = lv_label_create(lv_layer_top());
        if (ui->hint_labels[i]) {
            lv_obj_t *label = ui->hint_labels[i];
            lv_obj_set_width(label, 120);
            lv_obj_set_pos(label, label_x[i], label_y[i]);
            lv_obj_set_style_text_font(label, badge_font(BADGE_FONT_F20), 0);
            lv_obj_set_style_text_color(label, ui_col(BADGE_COLOR_ACCENT), 0);
            lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
            lv_obj_set_style_bg_color(label, ui_col(BADGE_COLOR_CARD), 0);
            lv_obj_set_style_bg_opa(label, 210, 0);
            lv_obj_remove_flag(label, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_add_flag(label, LV_OBJ_FLAG_HIDDEN);
        }
    }
    ui->experience_entry = lv_label_create(lv_layer_top());
    if (ui->experience_entry) {
        lv_obj_set_size(ui->experience_entry, 200, 48);
        lv_obj_set_pos(ui->experience_entry, 133, 350);
        lv_obj_set_style_text_font(ui->experience_entry, badge_font(BADGE_FONT_F20), 0);
        lv_obj_set_style_text_color(ui->experience_entry, ui_col(BADGE_COLOR_TEXT), 0);
        lv_obj_set_style_text_align(ui->experience_entry, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_set_style_bg_color(ui->experience_entry, ui_col(BADGE_COLOR_CARDHI), 0);
        lv_obj_set_style_bg_opa(ui->experience_entry, 255, 0);
        lv_obj_set_style_radius(ui->experience_entry, 16, 0);
        lv_obj_set_style_pad_top(ui->experience_entry, 10, 0);
        lv_label_set_text(ui->experience_entry, "本地体验");
        lv_obj_remove_flag(ui->experience_entry, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_add_flag(ui->experience_entry, LV_OBJ_FLAG_HIDDEN);
    }
    ui->experience_status = lv_label_create(lv_layer_top());
    if (ui->experience_status) {
        lv_obj_set_style_text_font(ui->experience_status, badge_font(BADGE_FONT_F16), 0);
        lv_obj_set_style_text_color(ui->experience_status, ui_col(BADGE_COLOR_ACCENT), 0);
        lv_label_set_text(ui->experience_status, "本地体验 · 未绑定");
        lv_obj_align(ui->experience_status, LV_ALIGN_TOP_MID, 0, 118);
        lv_obj_set_style_bg_color(ui->experience_status, ui_col(BADGE_COLOR_BG), 0);
        lv_obj_set_style_bg_opa(ui->experience_status, LV_OPA_COVER, 0);
        lv_obj_remove_flag(ui->experience_status, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_add_flag(ui->experience_status, LV_OBJ_FLAG_HIDDEN);
    }
    ui->tutorial_mask = lv_obj_create(lv_layer_top());
    if (ui->tutorial_mask) {
        lv_obj_remove_style_all(ui->tutorial_mask);
        lv_obj_set_size(ui->tutorial_mask, 466, 466);
        lv_obj_set_style_radius(ui->tutorial_mask, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_bg_color(ui->tutorial_mask, lv_color_black(), 0);
        lv_obj_set_style_bg_opa(ui->tutorial_mask, 115, 0);
        lv_obj_remove_flag(ui->tutorial_mask, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_add_flag(ui->tutorial_mask, LV_OBJ_FLAG_HIDDEN);
    }
    for (int i = 0; i < 5; ++i) {
        ui->tutorial_segments[i] = lv_arc_create(lv_layer_top());
        lv_obj_t *arc = ui->tutorial_segments[i];
        if (!arc) continue;
        lv_obj_remove_style_all(arc);
        lv_obj_set_size(arc, 452, 452);
        lv_obj_set_pos(arc, 7, 7);
        lv_obj_set_style_arc_width(arc, 8, LV_PART_MAIN);
        lv_obj_set_style_arc_opa(arc, LV_OPA_COVER, LV_PART_MAIN);
        lv_arc_set_bg_angles(arc, (274 + i * 72) % 360, (338 + i * 72) % 360);
        lv_obj_remove_flag(arc, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_add_flag(arc, LV_OBJ_FLAG_HIDDEN);
    }
    ui->tutorial_finger = lv_obj_create(lv_layer_top());
    if (ui->tutorial_finger) {
        lv_obj_remove_style_all(ui->tutorial_finger);
        lv_obj_set_size(ui->tutorial_finger, 76, 76);
        lv_obj_set_style_radius(ui->tutorial_finger, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_bg_color(ui->tutorial_finger, lv_color_hex(0xfff4e0), 0);
        lv_obj_set_style_bg_opa(ui->tutorial_finger, 80, 0);
        lv_obj_set_style_border_width(ui->tutorial_finger, 2, 0);
        lv_obj_set_style_border_color(ui->tutorial_finger, lv_color_hex(0xfff4e0), 0);
        lv_obj_set_style_border_opa(ui->tutorial_finger, 190, 0);
        lv_obj_remove_flag(ui->tutorial_finger, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_add_flag(ui->tutorial_finger, LV_OBJ_FLAG_HIDDEN);
    }
    ui->tutorial_card = lv_obj_create(lv_layer_top());
    if (ui->tutorial_card) {
        lv_obj_remove_style_all(ui->tutorial_card);
        lv_obj_set_size(ui->tutorial_card, 240, 88);
        lv_obj_set_pos(ui->tutorial_card, 113, 189);
        lv_obj_set_style_bg_color(ui->tutorial_card, ui_col(BADGE_COLOR_CARD), 0);
        lv_obj_set_style_bg_opa(ui->tutorial_card, 255, 0);
        lv_obj_set_style_radius(ui->tutorial_card, 20, 0);
        lv_obj_remove_flag(ui->tutorial_card, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
        ui->tutorial_back_title = lv_label_create(ui->tutorial_card);
        ui->tutorial_back_sub = lv_label_create(ui->tutorial_card);
        if (ui->tutorial_back_title) {
            lv_obj_set_style_text_font(ui->tutorial_back_title, badge_font(BADGE_FONT_F24), 0);
            lv_obj_set_style_text_color(ui->tutorial_back_title, ui_col(BADGE_COLOR_TEXT), 0);
            lv_obj_align(ui->tutorial_back_title, LV_ALIGN_CENTER, 0, -14);
        }
        if (ui->tutorial_back_sub) {
            lv_obj_set_style_text_font(ui->tutorial_back_sub, badge_font(BADGE_FONT_F16), 0);
            lv_obj_set_style_text_color(ui->tutorial_back_sub, ui_col(BADGE_COLOR_SUB), 0);
            lv_obj_align(ui->tutorial_back_sub, LV_ALIGN_CENTER, 0, 18);
        }
        lv_obj_add_flag(ui->tutorial_card, LV_OBJ_FLAG_HIDDEN);
    }
    ui->tutorial_label = lv_label_create(lv_layer_top());
    ui->tutorial_sub = lv_label_create(lv_layer_top());
    if (ui->tutorial_sub) {
        lv_obj_set_width(ui->tutorial_sub, 320);
        lv_obj_set_pos(ui->tutorial_sub, 73, 84);
        lv_obj_set_style_text_font(ui->tutorial_sub, badge_font(BADGE_FONT_F16), 0);
        lv_obj_set_style_text_color(ui->tutorial_sub, ui_col(BADGE_COLOR_SUB), 0);
        lv_obj_set_style_text_align(ui->tutorial_sub, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_remove_flag(ui->tutorial_sub, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_flag(ui->tutorial_sub, LV_OBJ_FLAG_HIDDEN);
    }
    ui->tutorial_skip = lv_label_create(lv_layer_top());
    if (ui->tutorial_label) {
        lv_obj_set_width(ui->tutorial_label, 320);
        lv_obj_set_pos(ui->tutorial_label, 73, 320);
        lv_obj_set_style_text_font(ui->tutorial_label, badge_font(BADGE_FONT_F20), 0);
        lv_obj_set_style_text_color(ui->tutorial_label, ui_col(BADGE_COLOR_ACCENT), 0);
        lv_obj_set_style_text_align(ui->tutorial_label, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_remove_flag(ui->tutorial_label, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_flag(ui->tutorial_label, LV_OBJ_FLAG_HIDDEN);
    }
    if (ui->tutorial_skip) {
        lv_label_set_text(ui->tutorial_skip, "跳过");
        lv_obj_set_width(ui->tutorial_skip, 72);
        lv_obj_set_pos(ui->tutorial_skip, BADGE_CX - 36, 410);
        lv_obj_set_style_text_font(ui->tutorial_skip, badge_font(BADGE_FONT_F16), 0);
        lv_obj_set_style_text_color(ui->tutorial_skip, ui_col(BADGE_COLOR_DIM), 0);
        lv_obj_set_style_text_align(ui->tutorial_skip, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_remove_flag(ui->tutorial_skip, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_flag(ui->tutorial_skip, LV_OBJ_FLAG_HIDDEN);
    }
    ui_layers_order(ui);

    badge_paint_clear(ui->face);
    return ui;
}
void badge_ui_destroy(badge_ui_t *ui)
{
    if (!ui) return;
    /* The widgets are children of the layers, so deleting the layers deletes them; only
     * the pixel buffers are ours to free. */
    for (int i = 0; i < 4; ++i) {
        if (ui->hint_arcs[i]) lv_obj_delete(ui->hint_arcs[i]);
        if (ui->hint_labels[i]) lv_obj_delete(ui->hint_labels[i]);
    }
    if (ui->experience_entry) lv_obj_delete(ui->experience_entry);
    if (ui->experience_status) lv_obj_delete(ui->experience_status);
    if (ui->tutorial_mask) lv_obj_delete(ui->tutorial_mask);
    if (ui->tutorial_card) lv_obj_delete(ui->tutorial_card);
    if (ui->tutorial_finger) lv_obj_delete(ui->tutorial_finger);
    for (int i = 0; i < 5; ++i)
        if (ui->tutorial_segments[i]) lv_obj_delete(ui->tutorial_segments[i]);
    if (ui->tutorial_label) lv_obj_delete(ui->tutorial_label);
    if (ui->tutorial_sub) lv_obj_delete(ui->tutorial_sub);
    if (ui->tutorial_skip) lv_obj_delete(ui->tutorial_skip);
    if (ui->dots_root) lv_obj_delete(ui->dots_root);
    if (ui->face) lv_obj_delete(ui->face);
    if (ui->texts) lv_obj_delete(ui->texts);
    if (ui->comp) lv_obj_delete(ui->comp);
    if (ui->trans) lv_obj_delete(ui->trans);
    if (ui->motion_root) lv_obj_delete(ui->motion_root);
    heap_caps_free(ui->motion_pixels[0]);
    heap_caps_free(ui->motion_pixels[1]);
    for (int i = 0; i < 4; ++i) heap_caps_free(ui->cached_pixels[i]);
    heap_caps_free(ui->face_buf);
    heap_caps_free(ui->comp_buf);
    heap_caps_free(ui->trans_buf);
    heap_caps_free(ui);
}

lv_obj_t *badge_ui_screen(badge_ui_t *ui)
{
    return ui ? ui->texts : NULL;
}

/* --------------------------------------------------------------------- inputs ---*/

void badge_ui_touch(badge_ui_t *ui, int x, int y, bool down)
{
    if (!ui) return;
    if (!down) {
        ui->finger_down = false;
        return;
    }
    if (ui->finger_down && ui->finger_x == x && ui->finger_y == y) return;
    if (!ui->finger_down) { ui->press_x = x; ui->press_y = y; }
    ui->finger_down = true;
    ui->finger_x = x;
    ui->finger_y = y;

    /* The feather is excluded from the partial path (see the file header), so its motion
     * asks for a full frame. The touch self-test also counts a hit here, because the
     * specification's targets are hit areas with no action of their own. */
    if (ui->screen_idx == BADGE_SCREEN_CARE_PLAY || ui->screen_idx == BADGE_SCREEN_TOUCH_TEST)
        ui->full = true;

    for (int i = 0; i < UI_TT_COUNT; i++) {
        if (ui->tt_hit[i]) continue;
        if (ui->screen_idx != BADGE_SCREEN_TOUCH_TEST) break;
        const int dx = x - badge_touch_targets[i].x;
        const int dy = y - badge_touch_targets[i].y;
        if (dx * dx + dy * dy <= UI_TT_RADIUS * UI_TT_RADIUS) {
            ui->tt_hit[i] = true;
            ui->tt_hits++;
        }
    }
}

void badge_ui_set_place(badge_ui_t *ui, int place)
{
    if (!ui) return;
    if (place < 0 || place >= BADGE_PLACE_COUNT) return;
    if (place == ui->place) return;
    ui->place = place;
    ui->full = true;
}

/* --------------------------------------------------------------------- rebuild ---*/

static const badge_screen_def_t *ui_scene_definition(const badge_ui_t *ui)
{
    static const badge_screen_def_t guide_scene = {0};
    badge_tutorial_view_t tutorial;
    badge_fsm_tutorial_view(ui->fsm, &tutorial);
    if (ui->preview_guide || (badge_fsm_screen(ui->fsm) == BADGE_SCREEN_GUIDE && tutorial.active))
        return &guide_scene;
    return &badge_screens[badge_fsm_visual_screen(ui->fsm)];
}

void badge_ui_rebuild(badge_ui_t *ui, uint32_t now_ms)
{
    if (!ui || !ui->fsm) return;

    const int was = ui->screen_idx;
    const badge_screen_def_t *sd = ui_scene_definition(ui);
    ui->screen_idx = badge_fsm_visual_screen(ui->fsm);

    /*
     * The transition snapshot has to be taken BEFORE the face canvas is repainted, and
     * only when we are leaving an established screen. main.c calls this function on the
     * tick the screen changed, so face_buf still holds the outgoing screen here.
     */
    const bool leaving = (was >= 0 && was != ui->screen_idx);
    if (leaving && !ui->preview_render && !ui->motion_on && badge_fsm_transitioning(ui->fsm, now_ms)) {
        ui->motion_source = was;
        if (ui_transition_snapshot(ui)) {
            ui->trans_on = true;
            ui->trans_t0 = now_ms;
            ui->trans_dir = badge_fsm_transition_dir(ui->fsm);
        }
    }

    /* The touch self-test's hits are per visit, not per boot. */
    if (ui->screen_idx == BADGE_SCREEN_TOUCH_TEST && was != ui->screen_idx) {
        for (int i = 0; i < UI_TT_COUNT; i++) ui->tt_hit[i] = false;
        ui->tt_hits = 0;
        ui->finger_down = false;
    }

    ui_build_state(ui, now_ms);
    badge_ui_plan_reset(&ui->plan);
    {
        uint8_t set[BADGE_UI_SETTING_COUNT];
        ui_settings(ui, set);
        badge_ui_plan_settings(&ui->plan, set);
    }
    badge_ui_plan_phone(&ui->plan, badge_fsm_phone(ui->fsm));
    badge_ui_plan_dyn(&ui->plan, (int)badge_fsm_game_const(ui->fsm)->guide_page, ui->place);

    ui_resolve_texts(ui, sd);
    ui_build_widgets(ui, sd);
    ui_labels_apply(ui);

    /* The z-order, re-asserted. The text layer was just emptied and refilled, so its
     * children are newer than the composites; ui_layers_order() puts both the layers and
     * the composites' labels back where badge_ui.h says they belong. */
    ui_layers_order(ui);

    /* 盖入: on the vertical switches the snapshot is the static base the incoming
     * screen covers, so it sits UNDER the face layer instead of riding on top. The
     * horizontal push and the fades keep it on top. */
    if (ui->trans_on && ui->trans && ui_transition_is_cover(ui->trans_dir)) {
        lv_obj_move_to_index(ui->trans, ui_layer_base(ui));
    }

    ui->full = true;
}

/* --------------------------------------------------------------------- refresh ---*/

void badge_ui_refresh(badge_ui_t *ui, uint32_t now_ms)
{
    if (!ui || !ui->fsm) return;

    const badge_screen_def_t *sd = ui_scene_definition(ui);
    if (!sd) return;

    ui_build_state(ui, now_ms);

    /* The three things that are not fields of badge_paint_state_t. */
    uint8_t set[BADGE_UI_SETTING_COUNT];
    ui_settings(ui, set);
    badge_ui_plan_dyn(&ui->plan, (int)badge_fsm_game_const(ui->fsm)->guide_page, ui->place);
    badge_ui_plan_settings(&ui->plan, set);
    badge_ui_plan_phone(&ui->plan, badge_fsm_phone(ui->fsm));

    ui_resolve_texts(ui, sd);
    ui_labels_apply(ui);
    badge_box_t boxes[BADGE_UI_PLAN_MAX_EL];
    const char *texts[BADGE_UI_PLAN_MAX_EL];
    for (int i = 0; i < BADGE_UI_PLAN_MAX_EL; i++) {
        texts[i] = ui->text[i][0] ? ui->text[i] : NULL;
    }

    bool full = ui->full;
    int n = badge_ui_plan_face(&ui->plan, sd, &ui->st, texts, boxes, BADGE_UI_PLAN_MAX_EL, &full);
    ui->full = false;
    if (full) n = 0;

    if (full) {
        badge_paint_clear(ui->face);
        ui_paint_elements(ui, sd, NULL);
        lv_obj_invalidate(ui->face);
    } else {
        for (int i = 0; i < n; i++) {
            ui_repaint_box(ui, sd, &boxes[i]);
        }
        /* ui_repaint_box invalidates each repainted display-coordinate region. */
    }

    /* Read original trigger times; refresh never restarts their lifetime. The
     * snapshot is side-effect-free, including on the private preview FSM. */
    badge_feedback_t feedback;
    badge_fsm_feedback(ui->preview_render ? NULL : ui->fsm, now_ms, &feedback);
    if (!ui->preview_render) {
        badge_hint_view_t hint;
        badge_fsm_hint_view(ui->fsm, &hint);
        static const badge_nav_t dirs[4] = {BADGE_NAV_UP, BADGE_NAV_DOWN, BADGE_NAV_LEFT, BADGE_NAV_RIGHT};
        static const char *const texts[4] = {"上滑 照料", "下滑 状态", "左滑 换表盘", "右滑 换表盘"};
        for (int i = 0; i < 4; ++i) {
            const bool returning = hint.return_hint && hint.return_direction == dirs[i];
            const bool show = (hint.directions & (1u << i)) || returning;
            if (ui->hint_arcs[i]) {
                if (show) lv_obj_remove_flag(ui->hint_arcs[i], LV_OBJ_FLAG_HIDDEN);
                else lv_obj_add_flag(ui->hint_arcs[i], LV_OBJ_FLAG_HIDDEN);
            }
            if (ui->hint_labels[i]) {
                if (show) {
                    lv_label_set_text(ui->hint_labels[i], returning ? "返回" : texts[i]);
                    lv_obj_remove_flag(ui->hint_labels[i], LV_OBJ_FLAG_HIDDEN);
                } else lv_obj_add_flag(ui->hint_labels[i], LV_OBJ_FLAG_HIDDEN);
            }
        }
    }
    if (!ui->preview_render) {
        if (ui->experience_entry) {
            if (badge_fsm_screen(ui->fsm) == BADGE_SCREEN_PAIR)
                lv_obj_remove_flag(ui->experience_entry, LV_OBJ_FLAG_HIDDEN);
            else lv_obj_add_flag(ui->experience_entry, LV_OBJ_FLAG_HIDDEN);
        }
        if (ui->experience_status) {
            if (badge_fsm_local_experience(ui->fsm) && !badge_fsm_low_battery(ui->fsm))
                lv_obj_remove_flag(ui->experience_status, LV_OBJ_FLAG_HIDDEN);
            else lv_obj_add_flag(ui->experience_status, LV_OBJ_FLAG_HIDDEN);
        }
    }
    if (!ui->preview_render && ui->tutorial_label) {
        badge_tutorial_view_t tutorial;
        badge_fsm_tutorial_view(ui->fsm, &tutorial);
        badge_tutorial_visual_t visual;
        badge_tutorial_visual(&tutorial, &visual);
        if (ui->motion_on) visual.mask_alpha = 0;
        if (ui->tutorial_card) {
            if (visual.mask_alpha) {
                lv_obj_set_style_opa(ui->tutorial_card,
                    tutorial.screen_elapsed_ms >= 250u ? 255u : tutorial.screen_elapsed_ms * 255u / 250u, 0);
                if (ui->tutorial_back_title) {
                    const char *title = tutorial.direction == BADGE_NAV_UP ? "向上滑" :
                        tutorial.direction == BADGE_NAV_DOWN ? "向下滑" :
                        tutorial.direction == BADGE_NAV_LEFT ? "向左滑" : "向右滑";
                    lv_label_set_text(ui->tutorial_back_title, title);
                    lv_obj_align(ui->tutorial_back_title, LV_ALIGN_CENTER, 0, -14);
                }
                if (ui->tutorial_back_sub) {
                    const char *sub = tutorial.error == 2 ? "再滑远一点" : tutorial.error == 1 ? "方向不对" :
                        tutorial.step == 3 ? "换回刚才的表盘" : "回到小猫这里";
                    lv_label_set_text(ui->tutorial_back_sub, sub);
                    lv_obj_set_style_text_color(ui->tutorial_back_sub,
                        ui_col(tutorial.error ? BADGE_COLOR_ACCENT : BADGE_COLOR_SUB), 0);
                    lv_obj_align(ui->tutorial_back_sub, LV_ALIGN_CENTER, 0, 18);
                }
                lv_obj_remove_flag(ui->tutorial_card, LV_OBJ_FLAG_HIDDEN);
            } else lv_obj_add_flag(ui->tutorial_card, LV_OBJ_FLAG_HIDDEN);
        }
        if (ui->tutorial_mask) {
            if (visual.mask_alpha) {
                lv_obj_set_style_bg_opa(ui->tutorial_mask, visual.mask_alpha, 0);
                lv_obj_remove_flag(ui->tutorial_mask, LV_OBJ_FLAG_HIDDEN);
            } else lv_obj_add_flag(ui->tutorial_mask, LV_OBJ_FLAG_HIDDEN);
        }
        for (int i = 0; i < 5; ++i) {
            lv_obj_t *arc = ui->tutorial_segments[i];
            if (!arc) continue;
            if (visual.show) {
                lv_obj_set_style_arc_color(arc, ui_col(i < visual.completed ? BADGE_COLOR_ACCENT : BADGE_COLOR_LINE), LV_PART_MAIN);
                lv_obj_remove_flag(arc, LV_OBJ_FLAG_HIDDEN);
            } else lv_obj_add_flag(arc, LV_OBJ_FLAG_HIDDEN);
        }
        if (ui->tutorial_finger) {
            if (visual.finger) {
                lv_obj_set_pos(ui->tutorial_finger, visual.finger_x - 38, visual.finger_y - 38);
                lv_obj_set_style_opa(ui->tutorial_finger, visual.finger_alpha, 0);
                lv_obj_remove_flag(ui->tutorial_finger, LV_OBJ_FLAG_HIDDEN);
            } else lv_obj_add_flag(ui->tutorial_finger, LV_OBJ_FLAG_HIDDEN);
        }
        if (ui->tutorial_sub) lv_obj_add_flag(ui->tutorial_sub, LV_OBJ_FLAG_HIDDEN);
        if (!tutorial.active) {
            lv_obj_add_flag(ui->tutorial_label, LV_OBJ_FLAG_HIDDEN);
            if (ui->tutorial_skip) lv_obj_add_flag(ui->tutorial_skip, LV_OBJ_FLAG_HIDDEN);
            badge_hint_view_t hint;
            badge_fsm_hint_view(ui->fsm, &hint);
            if (hint.nudge) {
                lv_obj_set_width(ui->tutorial_label, 320);
                lv_obj_set_pos(ui->tutorial_label, 73, 320);
                lv_obj_set_style_bg_opa(ui->tutorial_label, 0, 0);
                badge_tutorial_view_t demo = {.active = true, .step = hint.nudge_skill,
                    .elapsed_ms = hint.nudge_elapsed,
                    .direction = hint.nudge_skill == 1 ? BADGE_NAV_UP : hint.nudge_skill == 2 ? BADGE_NAV_DOWN : BADGE_NAV_LEFT};
                badge_tutorial_visual(&demo, &visual);
                if (visual.finger && ui->tutorial_finger) {
                    lv_obj_set_pos(ui->tutorial_finger, visual.finger_x - 38, visual.finger_y - 38);
                    lv_obj_remove_flag(ui->tutorial_finger, LV_OBJ_FLAG_HIDDEN);
                }
                static const char *const nudge_text[] = {"", "上滑看照料", "下滑看状态", "左右滑换表盘", "按住说话"};
                lv_label_set_text(ui->tutorial_label, nudge_text[hint.nudge_skill < 5 ? hint.nudge_skill : 0]);
                lv_obj_remove_flag(ui->tutorial_label, LV_OBJ_FLAG_HIDDEN);
            }
        } else {
            static const char *const tasks[] = {
                "轻点小猫", "向上滑 · 看照料", "向下滑 · 看状态", "左右滑 · 换表盘", "按住屏幕 0.6 秒"};
            const char *text = tutorial.error == 3 ? "再按久一点" :
                tutorial.error == 2 ? "再滑远一点" :
                tutorial.error == 1 ? (tutorial.direction == BADGE_NAV_UP ? "方向不对，向上滑" :
                tutorial.direction == BADGE_NAV_DOWN ? "方向不对，向下滑" :
                tutorial.direction == BADGE_NAV_LEFT ? "方向不对，向左滑" : "方向不对，向右滑") :
                tutorial.complete ? "都学会啦 · 点一下" :
                tutorial.returning ? (tutorial.direction == BADGE_NAV_DOWN ? "向下滑 · 回到小猫这里" :
                tutorial.direction == BADGE_NAV_UP ? "向上滑 · 回到小猫这里" :
                tutorial.direction == BADGE_NAV_LEFT ? "向左滑 · 换回来" : "向右滑 · 换回来") :
                tutorial.help ? "跟着手指做一遍" : tasks[tutorial.step < 5 ? tutorial.step : 0];
            static const char *const titles[] = {"轻点小猫", "向上滑", "向下滑", "左右滑", "按住屏幕"};
            static const char *const subtitles[] = {"摸摸它", "看看照料", "看看状态", "换个表盘", "跟它说句话"};
            const bool guide_page = badge_fsm_screen(ui->fsm) == BADGE_SCREEN_GUIDE;
            if (guide_page) {
                lv_obj_set_style_text_font(ui->tutorial_label, badge_font(BADGE_FONT_F24), 0);
                lv_obj_set_style_text_color(ui->tutorial_label, ui_col(BADGE_COLOR_TEXT), 0);
                lv_obj_set_width(ui->tutorial_label, 320);
                lv_obj_align(ui->tutorial_label, LV_ALIGN_TOP_MID, 0, 48);
                lv_obj_set_style_bg_opa(ui->tutorial_label, 0, 0);
                lv_label_set_text(ui->tutorial_label, tutorial.complete ? "都学会啦" : titles[tutorial.step < 5 ? tutorial.step : 0]);
                if (ui->tutorial_sub) {
                    lv_label_set_text(ui->tutorial_sub, tutorial.complete ? "点一下，开始陪伴小橘" :
                        tutorial.error || tutorial.help ? text : subtitles[tutorial.step < 5 ? tutorial.step : 0]);
                    lv_obj_remove_flag(ui->tutorial_sub, LV_OBJ_FLAG_HIDDEN);
                }
            } else {
                lv_obj_set_width(ui->tutorial_label, 240);
                lv_obj_set_pos(ui->tutorial_label, 113, 211);
                lv_obj_set_style_bg_opa(ui->tutorial_label, 255, 0);
                lv_label_set_text(ui->tutorial_label, text);
            }
            if (tutorial.returning) lv_obj_add_flag(ui->tutorial_label, LV_OBJ_FLAG_HIDDEN);
            else lv_obj_remove_flag(ui->tutorial_label, LV_OBJ_FLAG_HIDDEN);
            if (ui->tutorial_skip) lv_obj_remove_flag(ui->tutorial_skip, LV_OBJ_FLAG_HIDDEN);
        }
    }
    if (!ui->preview_render && ui->dots_root) {
        if (!feedback.face_dots_alpha) lv_obj_add_flag(ui->dots_root, LV_OBJ_FLAG_HIDDEN);
        else {
            lv_obj_remove_flag(ui->dots_root, LV_OBJ_FLAG_HIDDEN);
            lv_obj_set_style_opa(ui->dots_root, feedback.face_dots_alpha, 0);
            for (int i = 0; i < 3; ++i) {
                if (!ui->dots[i]) continue;
                const bool selected = i == feedback.face_dots_current;
                const int radius = selected ? 5 : 4;
                lv_obj_set_size(ui->dots[i], radius * 2, radius * 2);
                lv_obj_set_pos(ui->dots[i], 34 + (i - 1) * 18 - radius, 12 - radius);
                lv_obj_set_style_bg_color(ui->dots[i],
                    ui_col(selected ? BADGE_COLOR_ACCENT : BADGE_COLOR_LINE), 0);
            }
        }
    }
    badge_hint_view_t demo_hint;
    badge_fsm_hint_view(ui->fsm, &demo_hint);
    badge_tutorial_view_t hold_tutorial;
    badge_fsm_tutorial_view(ui->fsm, &hold_tutorial);
    const bool teaching_hold = hold_tutorial.active && !hold_tutorial.complete &&
        !hold_tutorial.touching && hold_tutorial.step == 4;
    const unsigned hold_demo = teaching_hold ? badge_demo_hold(hold_tutorial.elapsed_ms % 2400u) :
        demo_hint.nudge && demo_hint.nudge_skill == 4 ? badge_demo_hold(demo_hint.nudge_elapsed) : 0;
    badge_overlay_t preview_overlay = {0};
    const badge_overlay_update_t overlay = badge_overlay_update(
        ui->preview_render ? &preview_overlay : &ui->overlay,
        &feedback, ui->edge_on || ui->float_n > 0 || ui->preview_render ||
            hold_demo > 0);
    ui->bubble_text = feedback.bubble;
    ui->bubble_t0 = feedback.bubble_t0;
    ui->toast_text = feedback.toast;
    ui->toast_t0 = feedback.toast_t0;
    if (overlay.bubble_changed && ui->bubble_lbl)
        lv_label_set_text(ui->bubble_lbl, ui_str(feedback.bubble));
    if (overlay.toast_changed && ui->toast_lbl)
        lv_label_set_text(ui->toast_lbl, ui_str(feedback.toast));
    if (overlay.new_pet) badge_ui_float(ui, "+9", feedback.pet_t0);
    if (feedback.ring) {
        ui->edge_on = true;
        ui->edge_t0 = feedback.ring_t0;
    }
    if (overlay.redraw) {
        /* Active overlays still animate; an inactive layer is erased once only. */
        memset(ui->comp_buf, 0, (size_t)BADGE_SCR_W * BADGE_SCR_H * sizeof(uint32_t));
        ui_draw_bubble(ui, now_ms);
        ui_draw_toast(ui, now_ms);
        ui_draw_edge(ui, now_ms);
        ui_draw_hold(ui, feedback.hold_progress ? feedback.hold_progress : hold_demo);
        ui_draw_floats(ui, now_ms);
        lv_obj_invalidate(ui->comp);
    }
}

/* ---------------------------------------------------------------- transition ----*/

bool badge_ui_input_blocked(const badge_ui_t *ui)
{
    return ui && badge_motion_blocks_input(ui->motion_on, ui->motion_demo, ui->motion_settling);
}

bool badge_ui_motion_active(const badge_ui_t *ui)
{
    return ui && ui->motion_on;
}

static void ui_motion_live(badge_ui_t *ui, bool show)
{
    lv_obj_t *objects[] = {ui->face, ui->texts, ui->comp,
                           ui->cat ? badge_cat_layer_obj(ui->cat) : NULL};
    for (int i = 0; i < 4; ++i) {
        if (!objects[i]) continue;
        if (show) lv_obj_remove_flag(objects[i], LV_OBJ_FLAG_HIDDEN);
        else lv_obj_add_flag(objects[i], LV_OBJ_FLAG_HIDDEN);
    }
}

static bool ui_motion_capture(badge_ui_t *ui, int index)
{
    const size_t bytes = (size_t)BADGE_SCR_W * BADGE_SCR_H * 2;
    if (!ui->motion_pixels[index]) {
        ui->motion_pixels[index] = heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (!ui->motion_pixels[index]) return false;
        if (lv_draw_buf_init(&ui->motion_buf[index], BADGE_SCR_W, BADGE_SCR_H,
                             LV_COLOR_FORMAT_RGB565, BADGE_SCR_W * 2,
                             ui->motion_pixels[index], bytes) != LV_RESULT_OK) return false;
    }
    lv_obj_add_flag(ui->motion_root, LV_OBJ_FLAG_HIDDEN);
    lv_obj_update_layout(lv_obj_get_parent(ui->face));
    const int64_t capture_t0 = esp_timer_get_time();
    const bool captured = lv_snapshot_take_to_draw_buf(lv_obj_get_parent(ui->face), LV_COLOR_FORMAT_RGB565,
                                        &ui->motion_buf[index]) == LV_RESULT_OK;
    ui->motion_capture_us += (uint32_t)(esp_timer_get_time() - capture_t0);
    return captured;
}

void badge_ui_profile_snapshot(badge_ui_t *ui)
{
    if (!ui || ui->motion_on) return;
    const size_t bytes = (size_t)BADGE_SCR_W * BADGE_SCR_H * 2;
    void *pixels = heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!pixels) return;
    lv_draw_buf_t buf;
    const int64_t t0 = esp_timer_get_time();
    bool ok = lv_draw_buf_init(&buf, BADGE_SCR_W, BADGE_SCR_H, LV_COLOR_FORMAT_RGB565,
        BADGE_SCR_W * 2, pixels, bytes) == LV_RESULT_OK;
    if (ok) ok = lv_snapshot_take_to_draw_buf(lv_obj_get_parent(ui->face),
        LV_COLOR_FORMAT_RGB565, &buf) == LV_RESULT_OK;
    ui->motion_prepare_us = (uint32_t)(esp_timer_get_time() - t0);
    ESP_LOGI(TAG, "snapshot_bench us=%lu ok=%d screen=%d", (unsigned long)ui->motion_prepare_us, ok, badge_fsm_screen(ui->fsm));
    heap_caps_free(pixels);
}

static bool ui_motion_prepare(badge_ui_t *ui, badge_nav_t dir, uint32_t now)
{
    const int64_t prepare_t0 = esp_timer_get_time();
    ui->motion_capture_us = 0;
    ui->motion_build_us = 0;
    if (!ui->motion_root) {
        ui->motion_root = lv_obj_create(lv_obj_get_parent(ui->face));
        lv_obj_remove_style_all(ui->motion_root);
        lv_obj_set_size(ui->motion_root, BADGE_SCR_W, BADGE_SCR_H);
        lv_obj_set_pos(ui->motion_root, 0, 0);
        lv_obj_remove_flag(ui->motion_root, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_style_bg_color(ui->motion_root, lv_color_black(), 0);
        lv_obj_set_style_bg_opa(ui->motion_root, LV_OPA_COVER, 0);
        for (int i = 0; i < 2; ++i) {
            ui->motion_image[i] = lv_image_create(ui->motion_root);
            lv_obj_remove_flag(ui->motion_image[i], LV_OBJ_FLAG_CLICKABLE);
        }
    }
    ui->motion_source = badge_fsm_screen(ui->fsm);
    ui->motion_target = badge_fsm_swipe_target(ui->fsm, dir);
    ui->motion_dir = dir;
    ui->trans_on = false;
    if (ui->trans) lv_obj_add_flag(ui->trans, LV_OBJ_FLAG_HIDDEN);
    ui_transition_reset(ui);
    if (!ui_motion_capture(ui, 0)) return false;
    if (ui->motion_target >= 0) {
        /* Preview uses a private FSM/game: never emit or settle real gameplay. */
        badge_game_t game = *badge_fsm_game_const(ui->fsm);
        badge_fsm_t *real = ui->fsm;
        badge_fsm_t *preview = badge_fsm_create(&game, now);
        if (!preview) return false;
        badge_fsm_set_time(preview, badge_fsm_now_min(real));
        badge_fsm_set_phone(preview, badge_fsm_phone(real));
        const int preview_screen = ui->motion_target;
        ui->preview_guide = preview_screen == BADGE_SCREEN_GUIDE;
        badge_fsm_go(preview, preview_screen, BADGE_NAV_FADE);
        ui->fsm = preview;
        ui->preview_render = true;
        const bool saved_edge = ui->edge_on;
        const int saved_float_n = ui->float_n;
        ui->edge_on = false;
        ui->float_n = 0;
        ui_motion_live(ui, true);
        ui->screen_idx = -1;
        badge_ui_rebuild(ui, now);
        badge_ui_refresh(ui, now);
        if (ui->cat) {
            badge_cat_layer_update(ui->cat, ui->preview_guide ? BADGE_SCREEN_MAIN_A : preview_screen, badge_fsm_mode(real), NULL, now);
            badge_cat_layer_tick(ui->cat, 0.04f, 30);
        }
        const bool captured = ui_motion_capture(ui, 1);
        ui->fsm = real;
        ui->preview_guide = false;
        ui->preview_render = false;
        ui->edge_on = saved_edge;
        ui->float_n = saved_float_n;
        /* Preview temporarily hid labels; restore their real text on rebuild. */
        ui->overlay.feedback.bubble = 0;
        ui->overlay.feedback.toast = 0;
        ui->screen_idx = -1;
        badge_ui_rebuild(ui, now);
        badge_ui_refresh(ui, now);
        if (ui->cat) {
            badge_cat_layer_update(ui->cat, badge_fsm_visual_screen(real), badge_fsm_mode(real), NULL, now);
            badge_cat_layer_tick(ui->cat, 0.04f, 30);
        }
        badge_fsm_destroy(preview);
        if (!captured) return false;
    }
    ui->trans_on = false;
    if (ui->trans) lv_obj_add_flag(ui->trans, LV_OBJ_FLAG_HIDDEN);
    ui->motion_on = true;
    ui->motion_settling = false;
    ui_motion_live(ui, false);
    lv_image_set_src(ui->motion_image[0], &ui->motion_buf[0]);
    if (ui->motion_target >= 0) {
        lv_image_set_src(ui->motion_image[1], &ui->motion_buf[1]);
        lv_obj_remove_flag(ui->motion_image[1], LV_OBJ_FLAG_HIDDEN);
    } else lv_obj_add_flag(ui->motion_image[1], LV_OBJ_FLAG_HIDDEN);
    lv_obj_remove_flag(ui->motion_root, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(ui->motion_root);
    ui->motion_prepare_us = (uint32_t)(esp_timer_get_time() - prepare_t0);
    ui->motion_build_us = ui->motion_prepare_us - ui->motion_capture_us;
    ESP_LOGI(TAG, "motion prepare_us=%lu capture_us=%lu build_other_us=%lu source=%d target=%d",
        (unsigned long)ui->motion_prepare_us, (unsigned long)ui->motion_capture_us,
        (unsigned long)ui->motion_build_us, ui->motion_source, ui->motion_target);
    return true;
}

uint32_t badge_ui_motion_prepare_us(const badge_ui_t *ui)
{
    return ui ? ui->motion_prepare_us : 0;
}

static int ui_cache_slot(badge_nav_t dir)
{
    switch (dir) { case BADGE_NAV_UP: return 0; case BADGE_NAV_DOWN: return 1;
        case BADGE_NAV_LEFT: return 2; case BADGE_NAV_RIGHT: return 3; default: return -1; }
}

/* No allocation, rebuilding, snapshots or cat rasterisation in this input path. */
static bool ui_motion_begin(badge_ui_t *ui, badge_nav_t dir, uint32_t now)
{
    (void)now;
    int slot = ui_cache_slot(dir);
    badge_tutorial_view_t tutorial;
    badge_fsm_tutorial_view(ui->fsm, &tutorial);
    bool ready = slot >= 0 && ui->cached_minute == badge_fsm_now_min(ui->fsm) &&
        ui->cached_step == tutorial.step && ui->cached_returning == tutorial.returning &&
        ui->cached_complete == tutorial.complete && ui->cached_source && ui->cached_ready[slot] &&
        ui->cached_screen == badge_fsm_screen(ui->fsm) &&
        memcmp(&ui->cached_game, badge_fsm_game_const(ui->fsm), sizeof(ui->cached_game)) == 0;
    ui->motion_source = badge_fsm_screen(ui->fsm);
    ui->motion_target = badge_fsm_swipe_target(ui->fsm, dir);
    ui->motion_dir = dir;
    ui->motion_offset = 0;
    ui->motion_on = true;
    ui->motion_settling = false;
    ui->motion_live_fallback = !ready;
    if (!ready) return true;
    lv_image_set_src(ui->motion_image[0], &ui->motion_buf[0]);
    lv_image_set_src(ui->motion_image[1], &ui->cached_target[slot]);
    if (ui->motion_target >= 0) lv_obj_remove_flag(ui->motion_image[1], LV_OBJ_FLAG_HIDDEN);
    else lv_obj_add_flag(ui->motion_image[1], LV_OBJ_FLAG_HIDDEN);
    ui_motion_live(ui, false);
    lv_obj_remove_flag(ui->motion_root, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(ui->motion_root);
    return true;
}

static void ui_motion_warm(badge_ui_t *ui, uint32_t now)
{
    int screen = badge_fsm_screen(ui->fsm);
    const badge_game_t *game = badge_fsm_game_const(ui->fsm);
    if (ui->finger_down || ui->motion_on || ui->trans_on) { ui->cache_idle_t0 = now; return; }
    badge_tutorial_view_t tutorial;
    badge_fsm_tutorial_view(ui->fsm, &tutorial);
    if (ui->cached_screen != screen || ui->cached_minute != badge_fsm_now_min(ui->fsm) ||
        ui->cached_step != tutorial.step || ui->cached_returning != tutorial.returning ||
        ui->cached_complete != tutorial.complete || memcmp(&ui->cached_game, game, sizeof(*game))) {
        ui->cached_minute = badge_fsm_now_min(ui->fsm);
        ui->cached_step = tutorial.step;
        ui->cached_returning = tutorial.returning;
        ui->cached_complete = tutorial.complete;
        ui->cached_screen = screen;
        ui->cached_game = *game;
        memset(ui->cached_ready, 0, sizeof(ui->cached_ready));
        ui->cached_source = false;
        ui->cache_idle_t0 = now;
    }
    if (now - ui->cache_idle_t0 < 250) return;
    const badge_nav_t dirs[4] = {BADGE_NAV_UP, BADGE_NAV_DOWN, BADGE_NAV_LEFT, BADGE_NAV_RIGHT};
    for (int i = 0; i < 4; ++i) {
        if (ui->cached_ready[i]) continue;
        if (badge_fsm_swipe_target(ui->fsm, dirs[i]) < 0) { ui->cached_ready[i] = true; continue; }
        if (!ui_motion_prepare(ui, dirs[i], now)) return;
        const size_t bytes = (size_t)BADGE_SCR_W * BADGE_SCR_H * 2;
        if (!ui->cached_pixels[i]) ui->cached_pixels[i] = heap_caps_malloc(bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (ui->cached_pixels[i]) {
            memcpy(ui->cached_pixels[i], ui->motion_pixels[1], bytes);
            if (lv_draw_buf_init(&ui->cached_target[i], BADGE_SCR_W, BADGE_SCR_H,
                LV_COLOR_FORMAT_RGB565, BADGE_SCR_W * 2, ui->cached_pixels[i], bytes) == LV_RESULT_OK) {
                ui->cached_ready[i] = true;
                ui->cached_source = true;
            }
        }
        ui->motion_on = false;
        ui_motion_live(ui, true);
        ui_transition_reset(ui);
        if (ui->motion_root) lv_obj_add_flag(ui->motion_root, LV_OBJ_FLAG_HIDDEN);
        ui->cache_idle_t0 = now;
        return; /* At most one destination per idle iteration. */
    }
}

void badge_ui_motion_frame(badge_ui_t *ui, uint32_t now)
{
    badge_nav_t dir;
    int offset;
    const bool dragging = badge_fsm_drag(ui->fsm, &dir, &offset);
    badge_hint_view_t hint;
    badge_fsm_hint_view(ui->fsm, &hint);
    badge_tutorial_view_t tutorial;
    badge_fsm_tutorial_view(ui->fsm, &tutorial);
    badge_nav_t demo_dir = BADGE_NAV_LEFT;
    uint32_t demo_phase = hint.nudge_elapsed;
    const bool teaching = badge_tutorial_preview(&tutorial, &demo_dir, &demo_phase);
    const bool nudge = hint.nudge && hint.nudge_skill >= 1 && hint.nudge_skill <= 3;
    if (nudge) demo_dir = hint.nudge_skill == 1 ? BADGE_NAV_UP : hint.nudge_skill == 2 ? BADGE_NAV_DOWN : BADGE_NAV_LEFT;
    const bool demo = teaching || nudge;
    if (ui->motion_demo && !demo) {
        ui->motion_demo = ui->motion_on = false;
        ui_motion_live(ui, true);
        ui_transition_reset(ui);
        if (ui->motion_root) lv_obj_add_flag(ui->motion_root, LV_OBJ_FLAG_HIDDEN);
        if (ui->cat) badge_cat_layer_update(ui->cat, badge_fsm_visual_screen(ui->fsm),
                                            badge_fsm_mode(ui->fsm), NULL, now);
        ui->full = true;
    }
    if (!ui->motion_on && demo && !ui->trans_on && ui->cached_source) {
        dir = demo_dir;
        if (!ui_motion_begin(ui, dir, now)) return;
        ui->motion_demo = true;
    }
    if (!ui->motion_on && dragging && !ui->trans_on) {
        if (!ui_motion_begin(ui, dir, now)) return;
    }
    if (!ui->motion_on) { ui_motion_warm(ui, now); return; }
    if (dragging && !ui->motion_settling && dir != ui->motion_dir && abs(offset) >= 12) {
        ui->motion_on = false;
        ui_motion_live(ui, true);
        if (ui->cat) badge_cat_layer_update(ui->cat, badge_fsm_visual_screen(ui->fsm),
                                            badge_fsm_mode(ui->fsm), NULL, now);
        ui_transition_reset(ui);
        if (ui->motion_root) lv_obj_add_flag(ui->motion_root, LV_OBJ_FLAG_HIDDEN);
        if (!ui_motion_begin(ui, dir, now)) return;
    }
    if (ui->motion_demo) {
        const int sign = ui->motion_dir == BADGE_NAV_UP || ui->motion_dir == BADGE_NAV_LEFT ? -1 : 1;
        ui->motion_offset = sign * badge_demo_offset(demo_phase);
    } else if (dragging && !ui->motion_settling) {
        /* Axis and destination stay locked for the lifetime of this gesture. */
        ui->motion_offset = (dir == ui->motion_dir) ? offset : 0;
        if (ui->motion_offset > BADGE_SCR_H) ui->motion_offset = BADGE_SCR_H;
        if (ui->motion_offset < -BADGE_SCR_H) ui->motion_offset = -BADGE_SCR_H;
        if (ui->motion_target < 0) {
            ui->motion_offset = badge_motion_rubber(ui->motion_offset);
        }
    } else if (!ui->motion_settling) {
        ui->motion_settling = true;
        ui->motion_t0 = now;
        ui->motion_from = ui->motion_offset;
        const bool commit = ui->motion_target >= 0 &&
                            badge_fsm_screen(ui->fsm) == ui->motion_target;
        const bool negative = ui->motion_dir == BADGE_NAV_UP || ui->motion_dir == BADGE_NAV_LEFT;
        ui->motion_to = commit ? (negative ? -BADGE_SCR_H : BADGE_SCR_H) : 0;
        ui->motion_ms = badge_motion_duration(commit, ui->motion_target < 0,
            abs(ui->motion_to - ui->motion_from), BADGE_SCR_H);
    }
    if (ui->motion_settling) {
        uint32_t age = now - ui->motion_t0;
        if (age >= ui->motion_ms) {
            ui->motion_on = false;
            ui_motion_live(ui, true);
            if (ui->cat) badge_cat_layer_update(ui->cat, badge_fsm_visual_screen(ui->fsm),
                                                badge_fsm_mode(ui->fsm), NULL, now);
            ui_transition_reset(ui);
            if (ui->motion_root) lv_obj_add_flag(ui->motion_root, LV_OBJ_FLAG_HIDDEN);
            ui->motion_live_fallback = false;
            ui->full = true;
            return;
        }
        float p = (float)age / ui->motion_ms, inv = 1.0f - p;
        float e = 1.0f - inv * inv * inv;
        ui->motion_offset = ui->motion_from + (int)((ui->motion_to - ui->motion_from) * e);
    }
    if (ui->motion_live_fallback) {
        ui_motion_live(ui, true);
        const bool vertical_live = ui->motion_dir == BADGE_NAV_UP || ui->motion_dir == BADGE_NAV_DOWN;
        ui_layers_pos(ui, vertical_live ? 0 : ui->motion_offset, vertical_live ? ui->motion_offset : 0);
        return;
    }
    ui_motion_live(ui, false);
    int off = ui->motion_offset;
    const bool vertical = ui->motion_dir == BADGE_NAV_UP || ui->motion_dir == BADGE_NAV_DOWN;
    const bool cover = vertical && ui->motion_target >= 0;
    lv_obj_set_style_opa(ui->motion_image[0], cover ?
        (lv_opa_t)(255 * (210 - (abs(off) < 210 ? abs(off) : 210)) / 210) : LV_OPA_COVER, 0);
    lv_obj_set_pos(ui->motion_image[0], vertical ? 0 : off, cover ? 0 : (vertical ? off : 0));
    int incoming = off + ((ui->motion_dir == BADGE_NAV_UP || ui->motion_dir == BADGE_NAV_LEFT)
                         ? BADGE_SCR_H : -BADGE_SCR_H);
    lv_obj_set_pos(ui->motion_image[1], vertical ? 0 : incoming, vertical ? incoming : 0);
}

bool badge_ui_transitioning(const badge_ui_t *ui)
{
    return ui ? ui->trans_on : false;
}

/* 盖入: true for the vertical switches, where the snapshot stays put and fades
 * underneath the incoming screen instead of being pushed off the glass. */
static bool ui_transition_is_cover(badge_nav_t dir)
{
    return dir == BADGE_NAV_UP || dir == BADGE_NAV_DOWN;
}

/* The cover fade: gone by UI_VERT_FADE_PX of cover travel, so the base reads as
 * dimming away in place rather than sliding. e is the eased progress 0..1. */
static lv_opa_t ui_cover_opa(double e)
{
    int a = (int)((1.0 - e * ((double)BADGE_SCR_H / (double)UI_VERT_FADE_PX)) * 255.0);
    if (a < 0) a = 0;
    if (a > 255) a = 255;
    return (lv_opa_t)a;
}

void badge_ui_transition_frame(badge_ui_t *ui, uint32_t now_ms)
{
    if (!ui) return;
    if (!ui->trans_on) {
        ui_transition_reset(ui);
        return;
    }

    const uint32_t ms = ui->motion_source == BADGE_SCREEN_BOOT ? 300u :
        (badge_numbers.transition_ms ? badge_numbers.transition_ms : UI_TRANSITION_MS);
    const uint32_t age = now_ms - ui->trans_t0;
    if (age >= ms) {
        ui->trans_on = false;
        if (ui->trans) lv_obj_add_flag(ui->trans, LV_OBJ_FLAG_HIDDEN);
        ui_transition_reset(ui);
        return;
    }

    /* e = 1 - (1 - p)^3, the reference's own easing. */
    const double p = (double)age / (double)ms;
    const double inv = 1.0 - p;
    const double e = 1.0 - inv * inv * inv;
    const int off = (int)(e * (double)BADGE_SCR_W);

    switch (ui->trans_dir) {
    case BADGE_NAV_UP:
        /* 盖入: the incoming screen slides up over the outgoing one, which stays at
         * (0,0) and fades out underneath. Nothing is dragged off the glass. */
        lv_obj_set_pos(ui->trans, 0, 0);
        lv_obj_set_style_opa(ui->trans, ui_cover_opa(e), 0);
        ui_layers_pos(ui, 0, BADGE_SCR_H - off);
        break;
    case BADGE_NAV_DOWN:
        lv_obj_set_pos(ui->trans, 0, 0);
        lv_obj_set_style_opa(ui->trans, ui_cover_opa(e), 0);
        ui_layers_pos(ui, 0, off - BADGE_SCR_H);
        break;
    case BADGE_NAV_LEFT:
        lv_obj_set_pos(ui->trans, -off, 0);
        ui_layers_pos(ui, BADGE_SCR_W - off, 0);
        break;
    case BADGE_NAV_RIGHT:
        lv_obj_set_pos(ui->trans, off, 0);
        ui_layers_pos(ui, off - BADGE_SCR_W, 0);
        break;
    default: {
        /* A fade: the snapshot gives way to the screen behind it. */
        const int a = (int)(inv * 255.0);
        lv_obj_set_pos(ui->trans, 0, 0);
        lv_obj_set_style_opa(ui->trans, (lv_opa_t)(a < 0 ? 0 : (a > 255 ? 255 : a)), 0);
        ui_layers_pos(ui, 0, 0);
        break;
    }
    }
}

void badge_ui_invalidate_face(badge_ui_t *ui)
{
    if (!ui) return;
    ui->full = true;
}

/* -------------------------------------------------------------------- stimuli ---*/

void badge_ui_float(badge_ui_t *ui, const char *text, uint32_t now_ms)
{
    if (!ui || !text || !*text) return;
    if (ui->float_n >= UI_FLOAT_MAX) {
        /* Drop the oldest rather than refuse the new one: the new one is the interaction
         * that just happened. */
        memmove(&ui->floats[0], &ui->floats[1], sizeof(ui->floats[0]) * (UI_FLOAT_MAX - 1));
        ui->float_n = UI_FLOAT_MAX - 1;
    }
    ui_float_t *f = &ui->floats[ui->float_n++];
    ui_copy(f->text, sizeof(f->text), text);
    f->t0 = now_ms;
    f->x = UI_FLOAT_X;
    f->y = UI_FLOAT_Y;
}

void badge_ui_edge_flash(badge_ui_t *ui, uint32_t now_ms)
{
    if (!ui) return;
    /* Only when the board has no motor: with one, the motor is the feedback and the ring
     * would double it (spec 12.2). */
    if (!BADGE_HW_MOTOR) {
        ui->edge_on = true;
        ui->edge_t0 = now_ms;
    }
}

/* --------------------------------------------------------------------- dump -----*/

bool badge_ui_dump_ppm(badge_ui_t *ui, const char *path)
{
    if (!ui || !path) return false;
    FILE *f = fopen(path, "wb");
    if (!f) return false;
    (void)fprintf(f, "P6\n%d %d\n255\n", BADGE_SCR_W, BADGE_SCR_H);
    for (int y = 0; y < BADGE_SCR_H; y++) {
        for (int x = 0; x < BADGE_SCR_W; x++) {
            uint8_t rgb[3] = {0, 0, 0};
            if (badge_paint_covering(x, y)) {
                const uint32_t v = ui->face_buf[(size_t)y * BADGE_SCR_W + (size_t)x];
                rgb[0] = (uint8_t)((v >> 16) & 0xFFu);
                rgb[1] = (uint8_t)((v >> 8) & 0xFFu);
                rgb[2] = (uint8_t)(v & 0xFFu);
            }
            (void)fwrite(rgb, 1, 3, f);
        }
    }
    (void)fclose(f);
    return true;
}
