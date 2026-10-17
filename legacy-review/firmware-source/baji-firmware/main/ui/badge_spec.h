/*
 * badge_spec - the firmware-side view of 吧唧交互规范 (version 0.3.0).
 *
 * THE SPEC IS THE ONLY SOURCE OF TRUTH FOR LAYOUT
 * ----------------------------------------------
 * Every coordinate, colour, font size, timing, care number and string in this
 * firmware comes from the interaction specification's badge_spec.json, converted
 * into C tables by tools/gen-badge-ui.mjs into badge_spec_data.{h,c}. Nothing in
 * this directory may hard-code a pixel position: a second copy of a number is how
 * the old UI ended up with 19 of its 20 element boxes under the bezel while the
 * geometry test still passed (docs/gap-vs-v1.5.md).
 *
 * This header is the hand-written half: the types those generated tables are made
 * of, and the vocabulary (screen ids, element types, actions, stats) the rest of
 * the firmware programs against. It includes nothing from LVGL on purpose, so the
 * layout half of the firmware stays host-testable exactly like badge_geom.c is.
 *
 * Regenerate with:
 *   node tools/gen-badge-ui.mjs
 * and check with:
 *   node tools/check-badge-spec.mjs
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/* ---------------------------------------------------------------- geometry ---*/

/*
 * The badge's uplink to the App (spec 9).
 *
 * Fourteen event types, each an 8-byte record: ts(uint32, unix seconds, LE) then
 * type(uint8), a(uint8), b(int16, LE). The App settles the pet's numbers from
 * these; the badge only reports what the owner did. The vocabulary lives here, next
 * to the element table, because it is a contract with the phone and the host tests
 * must be able to compile it without ESP-IDF (the queue and the radio live in
 * main/net/badge_events.{h,c}).
 */
typedef enum {
    EVT_NONE = 0,
    EVT_PET = 1,         /* 摸摸 */
    EVT_FEED = 2,        /* 喂食完成, a = 口数 */
    EVT_WATER = 3,       /* 喝水完成, a = 口数 */
    EVT_PLAY = 4,        /* 逗猫完成, a = 扑的次数 */
    EVT_SLEEP = 5,       /* 睡觉完成 */
    EVT_CARE_CANCEL = 6, /* 照料中途取消, a = 照料编号 */
    EVT_VOICE_CMD = 7,   /* 命中离线命令词, a = 命令词编号 */
    EVT_VOICE_FREE = 8,  /* 自由对话（经手机）, a = 意图编号 */
    EVT_QUIRK_CATCH = 9, /* 接住怪行为, a = 怪行为编号 */
    EVT_MEET = 10,       /* 遇见并确认, a = 0 碰一碰 / 1 扫码, b = 对方短编号 */
    EVT_CALL_HOME = 11,  /* 叫小猫回家, a = 地点编号 */
    EVT_WAKE = 12,       /* 唤醒, a = 0 抬起 / 1 触摸 / 2 唤醒词 / 3 按键（扩展） */
    EVT_FACE = 13,       /* 切换表盘, a = 表盘编号 */
    EVT_SETTING = 14,    /* 改设置, a = 设置项, b = 新值 */
    EVT_TYPE_COUNT
} badge_evt_type_t;

/* Wake causes for EVT_WAKE.a.
 *
 * 0/1/2 are the specification's own three. 3 is OURS: the board has two physical keys
 * (docs/hardware-buttons.md) and the owner pressing one to light the badge is a fourth
 * wake cause the specification does not enumerate. It is an extension, not a reading of
 * the spec, and it is reported so the App can tell a key press from a lift. */
#define EVT_WAKE_RAISE 0
#define EVT_WAKE_TOUCH 1
#define EVT_WAKE_WORD  2
#define EVT_WAKE_BUTTON 3

/** @brief Wire size of one event record. */
#define BADGE_EVENT_WIRE_BYTES 8

/** @brief Offline queue depth: 200 * 8 bytes = 1.6 KB (spec 9). */
#define BADGE_EVENT_QUEUE_MAX 200

/** @brief One queued record, in host byte order. */
typedef struct {
    uint32_t ts;
    uint8_t  type; /* badge_evt_type_t */
    uint8_t  a;
    int16_t  b;
} badge_evt_t;

/* The panel is 466x466 of addressing; the glass is a disc of radius 233. Content
 * (buttons, labels, their boxes) must sit inside radius BADGE_SAFE_R; radius
 * BADGE_SAFE_R..BADGE_R is reserved for ring elements (time ring, arcs, progress
 * rings) and nothing else. */
#define BADGE_SCR_W 466
#define BADGE_SCR_H 466
#define BADGE_CX 233
#define BADGE_CY 233
#define BADGE_R 233
#define BADGE_SAFE_R 212

/* Touch panels report 0..465; the mirror arithmetic in esp_lcd_touch uses x_max
 * and can hand back 466 (spec 12.6). Clamp at the edge instead of trusting it. */
#define BADGE_TOUCH_MAX 465
static inline int16_t badge_touch_clamp(int v)
{
    return (int16_t)(v < 0 ? 0 : (v > BADGE_TOUCH_MAX ? BADGE_TOUCH_MAX : v));
}

/* Life stages (spec `stages`): 幼猫 from 0 growth, 少年猫 from 60, 成年猫 from 160. */
#define BADGE_STAGE_COUNT 3

/* ---------------------------------------------------------------- screens ----*/

/*
 * The 23 screens of the specification.
 *
 * The order is the order in badge_spec.json, and badge_spec_data.c publishes
 * badge_screens[] in that same order, so BADGE_SCREEN_* doubles as an index.
 */
typedef enum {
    BADGE_SCREEN_MAIN_A = 0, /* 主表盘 A · 只有小猫 */
    BADGE_SCREEN_MAIN_B,     /* 主表盘 B · 24 小时时间环 */
    BADGE_SCREEN_MAIN_C,     /* 主表盘 C · 时间环 + 心动 */
    BADGE_SCREEN_AOD,        /* 待机常显 */
    BADGE_SCREEN_CARE_MENU,  /* 照料轮盘 */
    BADGE_SCREEN_CARE_FEED,  /* 喂食中 */
    BADGE_SCREEN_CARE_WATER, /* 喝水中 */
    BADGE_SCREEN_CARE_PLAY,  /* 逗猫中 */
    BADGE_SCREEN_CARE_SLEEP, /* 哄睡 */
    BADGE_SCREEN_SLEEPING,   /* 睡着了 */
    BADGE_SCREEN_STATUS,     /* 状态 */
    BADGE_SCREEN_SETTINGS,   /* 设置 */
    BADGE_SCREEN_TOUCH_TEST, /* 触摸自检（开发用） */
    BADGE_SCREEN_VOICE,      /* 按住说话 / 唤醒后在听 */
    BADGE_SCREEN_MEET,       /* 遇见：附近有小猫 */
    BADGE_SCREEN_MEET_TAP,   /* 遇见：碰一碰确认 */
    BADGE_SCREEN_MEET_SCAN,  /* 遇见：扫码确认（没有 NFC 时） */
    BADGE_SCREEN_MEET_DONE,  /* 遇见：成为朋友 */
    BADGE_SCREEN_AWAY,       /* 生活同步：小猫在外面 */
    BADGE_SCREEN_LOWBAT,     /* 电量不足 */
    BADGE_SCREEN_BOOT,       /* 开机 */
    BADGE_SCREEN_PAIR,       /* 配对 */
    BADGE_SCREEN_GUIDE,      /* 首次引导 */
    BADGE_SCREEN_COUNT
} badge_screen_t;

/* How a screen is left. 0 = fade, otherwise the slide direction, matching the
 * reference's `go(id, dir)`. */
typedef enum {
    BADGE_NAV_FADE = 0,
    BADGE_NAV_UP,
    BADGE_NAV_DOWN,
    BADGE_NAV_LEFT,
    BADGE_NAV_RIGHT,
} badge_nav_t;

/* ---------------------------------------------------------------- elements ---*/

/* The 18 element types the specification uses (badge_spec.json `t`). */
typedef enum {
    BE_LABEL = 0, /* 文字 */
    BE_ICON,      /* 图标（16px 原图 × scale，整数倍最近邻） */
    BE_BATTERY,   /* 电池（22×12，外框 + 电量填充 + 充电闪电） */
    BE_ARC,       /* 状态弧（环中线，0° = 3 点钟，顺时针） */
    BE_ALERT,     /* 头顶提醒圆（状态低于阈值时呼吸） */
    BE_HIT,       /* 触摸热区（不绘制） */
    BE_DAYRING,   /* 24 小时时间环（外圈主人 / 内圈小猫） */
    BE_BTN,       /* 圆按钮 */
    BE_SEGS,      /* 分段进度环 */
    BE_FEATHER,   /* 羽毛（跟手） */
    BE_ZZZ,       /* Zzz */
    BE_BAR,       /* 进度条（x,y = 左上角） */
    BE_TOGGLE,    /* 开关（x = 右边缘，y = 中心） */
    BE_PILL,      /* 胶囊按钮 */
    BE_WAVE,      /* 声波环 */
    BE_QR,        /* 扫码确认的二维码方块 */
    BE_HEARTS,    /* 爱心飘落 */
    BE_DOTS,      /* 页码点 */
    BE_TYPE_COUNT
} badge_el_type_t;

typedef enum { BADGE_ALIGN_CENTER = 0, BADGE_ALIGN_LEFT, BADGE_ALIGN_RIGHT } badge_align_t;

typedef enum { BADGE_FONT_F16 = 0, BADGE_FONT_F20, BADGE_FONT_F24, BADGE_FONT_N40, BADGE_FONT_COUNT } badge_font_t;

/* Visibility conditions (`when`). BADGE_WHEN_ALWAYS means no condition. */
typedef enum {
    BADGE_WHEN_ALWAYS = 0,
    BADGE_WHEN_PHONE,
    BADGE_WHEN_NO_PHONE,
    BADGE_WHEN_ALERT,
} badge_when_t;

/* The value an element reads (`value`). Stats for arcs/bars, settings for
 * toggles, the guide page for dots. BADGE_VALUE_NONE = "not a value element". */
typedef enum {
    BADGE_VALUE_NONE = 0,
    BADGE_VALUE_FOOD,
    BADGE_VALUE_MOOD,
    BADGE_VALUE_CLEAN,
    BADGE_VALUE_ENERGY,
    BADGE_VALUE_HEALTH,
    BADGE_VALUE_BRIGHT,
    BADGE_VALUE_WAKE,
    BADGE_VALUE_DISCOVER,
    BADGE_VALUE_AOD,
    BADGE_VALUE_GUIDE,
    BADGE_VALUE_COUNT
} badge_value_t;

/* The five stats, in the specification's order. */
typedef enum {
    BADGE_STAT_FOOD = 0,
    BADGE_STAT_MOOD,
    BADGE_STAT_CLEAN,
    BADGE_STAT_ENERGY,
    BADGE_STAT_HEALTH,
    BADGE_STAT_COUNT
} badge_stat_t;

/* What tapping an element does (`act`). */
typedef enum {
    BADGE_ACT_NONE = 0,
    BADGE_ACT_PET,
    BADGE_ACT_ALERT,
    BADGE_ACT_CARE_FEED,
    BADGE_ACT_CARE_WATER,
    BADGE_ACT_CARE_PLAY,
    BADGE_ACT_CARE_SLEEP,
    BADGE_ACT_BITE,      /* 喂食 / 喝水：点一口 */
    BADGE_ACT_HOLD,      /* 哄睡：按住 ring 秒 */
    BADGE_ACT_STAT_FOOD,
    BADGE_ACT_STAT_MOOD,
    BADGE_ACT_STAT_CLEAN,
    BADGE_ACT_STAT_ENERGY,
    BADGE_ACT_STAT_HEALTH,
    BADGE_ACT_SETTINGS,
    BADGE_ACT_SET_BRIGHT,
    BADGE_ACT_SET_WAKE,
    BADGE_ACT_SET_DISCOVER,
    BADGE_ACT_SET_AOD,
    BADGE_ACT_VER,
    BADGE_ACT_TT_1,
    BADGE_ACT_TT_2,
    BADGE_ACT_TT_3,
    BADGE_ACT_TT_4,
    BADGE_ACT_TT_5,
    BADGE_ACT_MEET_HI,
    BADGE_ACT_MEET_SKIP,
    BADGE_ACT_MEET_CANCEL,
    BADGE_ACT_HOME,
    BADGE_ACT_CALL_HOME,
    BADGE_ACT_GUIDE_NEXT,
    BADGE_ACT_WAKE,
    BADGE_ACT_COUNT
} badge_act_t;

/* The five care actions the badge itself performs. Everything else (bath,
 * clinic, wardrobe, going out) lives in the App. */
typedef enum {
    BADGE_CARE_PET = 0,
    BADGE_CARE_FEED,
    BADGE_CARE_WATER,
    BADGE_CARE_PLAY,
    BADGE_CARE_SLEEP,
    BADGE_CARE_COUNT
} badge_care_t;

/* Icons. The 28 spec icons come first in the order tools/gen-badge-assets.mjs
 * emits them; the two dynamic ones are resolved at build time from the current
 * screen's data (`{placeIcon}`, `{guideIcon}`). */
#define BADGE_ICON_DYN_PLACE 0xFEu
#define BADGE_ICON_DYN_GUIDE 0xFDu
#define BADGE_ICON_NONE 0xFFu

/** @brief Side of every icon in the specification's set, in pixels. */
#define BADGE_ICON_PX 16

/* Element flags (`rev`, `hearts`, `pulse`, `anim`, `hold`). */
#define BADGE_ELF_REV    (1u << 0)
#define BADGE_ELF_HEARTS (1u << 1)
#define BADGE_ELF_PULSE  (1u << 2)
#define BADGE_ELF_ANIM   (1u << 3)
#define BADGE_ELF_STILL  (1u << 4) /* screen-level: cat drawn from one frame only */

/*
 * One element of one screen, straight out of the spec.
 *
 * The fields a given type uses are the ones badge_spec.json gives it; the
 * generator rejects an unknown key rather than dropping it, so this struct cannot
 * silently lose a property the reference renders. Unused fields are zero.
 *
 * `x`/`y` are the centre for every type except BE_BAR (top-left corner) and
 * BE_TOGGLE (right edge, centre y) -- that is the specification's own convention,
 * documented in the reference's elInfo().
 */
typedef struct {
    uint8_t  type;      /* badge_el_type_t */
    uint8_t  font;      /* badge_font_t */
    uint8_t  align;     /* badge_align_t */
    uint8_t  color;     /* colour index, BADGE_COLOR_NONE when absent */
    uint8_t  bg;
    uint8_t  fg;
    uint8_t  ring;
    uint8_t  track;
    uint8_t  when;      /* badge_when_t */
    uint8_t  act;       /* badge_act_t */
    uint8_t  value;     /* badge_value_t */
    uint8_t  flags;     /* BADGE_ELF_* */
    uint8_t  scale_x2;  /* icon scale * 2 (1.5 is a real value in the spec) */
    uint8_t  care;      /* badge_care_t or BADGE_CARE_NONE */
    uint16_t text;      /* index into badge_strings[] */
    uint16_t id;        /* index into badge_strings[] (element id, for tests/logs) */
    uint8_t  icon;      /* icon index, or BADGE_ICON_DYN_* */
    int16_t  x, y;
    int16_t  w, h;
    int16_t  r, r2, w2;
    int16_t  a0, a1;
    int16_t  n, gap;
    int16_t  quiet;     /* BE_QR: white margin in pixels */
    uint16_t hold_ms;   /* BE_HIT with a long press: threshold in ms */
} badge_el_t;

#define BADGE_CARE_NONE 0xFFu
#define BADGE_COLOR_NONE 0xFFu

/* The 3D cat's camera parameters for a screen (`cat`). */
typedef struct {
    int16_t  dist;    /* camera distance */
    int16_t  ox, oy;  /* screen-centre offset */
    uint8_t  dim_pct; /* 100 = full brightness; 35 = AOD, 25 = sleeping */
    uint8_t  flags;   /* BADGE_CATF_* */
} badge_cat_t;

#define BADGE_CATF_STILL (1u << 0) /* 只画一帧 */
#define BADGE_CATF_PEER  (1u << 1) /* 用对方的花色与服饰 */

typedef struct {
    const char *name;
    const char *doc;
    const char *enter;
    const char *exit;
    uint16_t    el_first; /* index into badge_els[] */
    uint16_t    el_count;
    uint16_t    gest_first; /* index into badge_gest[] */
    uint8_t     gest_count;
    uint8_t     has_cat;
    badge_cat_t cat;
} badge_screen_def_t;

/* One declared gesture of one screen (`gest`), kept as text so a host test can
 * prove the app implements every one of them. */
typedef struct {
    const char *gesture; /* tap_cat / up / down / long / ... */
    const char *effect;  /* the spec's own wording */
} badge_gest_t;

/* ---------------------------------------------------------------- numbers ----*/

typedef struct {
    /* timing */
    uint16_t tap_max_ms;
    uint16_t tap_move_max;
    uint16_t long_press_ms;
    uint16_t swipe_min_px;
    uint16_t swipe_max_ms;
    uint16_t transition_ms;
    uint16_t toast_ms;
    uint16_t bubble_ms;
    uint16_t play_to_comp_ms;
    uint16_t comp_to_aod_ms;
    uint16_t aod_redraw_ms;
    uint16_t care_cooldown_ms;
    uint16_t pet_cooldown_ms;
    uint16_t bite_gap_ms;
    uint16_t voice_max_ms;
    uint16_t voice_silence_ms;
    uint16_t voice_think_ms;
    uint16_t meet_timeout_ms;
    uint16_t tap_confirm_timeout_ms;
    uint16_t meet_done_ms;
    uint16_t quirk_min_ms;
    uint32_t quirk_max_ms; /* 80000 in the spec: wider than the other timings */
    uint16_t quirk_idle_ms;
    uint16_t sleep_hold_ms;
    uint16_t sleep_demo_ms;
    uint16_t play_pounce_speed; /* pixels per second */
    uint16_t play_pounce_gap_ms;
    uint16_t play_timeout_ms;
    uint16_t boot_ms;
    uint32_t call_home_ms;
    /* thresholds */
    uint8_t low_stat;
    uint8_t full;
    uint8_t mood_full;
    uint8_t min_energy_play;
    uint8_t bat_no_wake;
    uint8_t bat_critical;
    /* modes: frames per second and render resolution (0 = do not render) */
    uint8_t desk_fps;
    uint16_t desk_res;
    uint8_t play_fps;
    uint16_t play_res;
    uint8_t comp_fps;
    uint16_t comp_res;
    uint8_t aod_fps;
    uint16_t aod_res;
    uint8_t aod_bright_pct;
    uint32_t play_to_sleep_ms; /* play_to_comp_ms + comp_to_aod_ms */
} badge_numbers_t;

#define BADGE_STAT_SICK  0xFEu
#define BADGE_STAT_COINS 0xFDu
#define BADGE_OP_GE 0u
#define BADGE_OP_LT 1u
#define BADGE_OP_EQ 2u

/* A refusal rule: `stat op value` => message. */
typedef struct {
    uint8_t  stat;    /* badge_stat_t, or the BADGE_STAT_SICK/BADGE_STAT_COINS sentinels */
    uint8_t  op;      /* BADGE_OP_GE / BADGE_OP_LT / BADGE_OP_EQ */
    int16_t  value;
    uint16_t text;    /* index into badge_strings[] */
} badge_block_t;

typedef struct {
    uint16_t label;   /* index into badge_strings[] */
    int8_t   delta[BADGE_STAT_COUNT];
    int8_t   growth;
    int8_t   coins;
    uint8_t  steps;
    uint8_t  block_first;
    uint8_t  block_count;
} badge_care_def_t;

typedef struct {
    uint8_t  num;    /* the specification's own number, 1..14 */
    uint8_t  type;   /* badge_evt_type_t, equal to num */
    uint16_t label;  /* index into badge_strings[] */
    uint16_t a_desc;
    uint16_t b_desc;
} badge_evt_def_t;

typedef struct {
    uint8_t  stat;  /* whose low value this alert is about */
    uint8_t  icon;
    uint16_t text;  /* 0 when the alert has no wording */
    uint8_t  action; /* badge_act_t to run when tapped */
} badge_alert_def_t;

typedef struct {
    uint16_t id;    /* index into badge_strings[]: the specification's own quirk key */
    uint16_t name;
    uint8_t  icon;
    uint16_t ms;
    uint8_t  anim;  /* 0 idle / 1 walk / 2 paw: the clip the reference plays for it */
} badge_quirk_def_t;

typedef struct {
    uint8_t  icon;
    uint16_t text; /* "{name}在公司楼下花坛" */
    uint16_t sub;
} badge_place_def_t;

typedef struct {
    uint8_t  num;
    uint16_t word;   /* 命令词 */
    uint16_t action; /* come / pet / feed / water / play / sleep / night / say / status / face / look */
    uint16_t reply;  /* 0 when the command has no spoken reply */
} badge_voice_def_t;

typedef struct {
    uint8_t  icon;
    uint16_t title;
    uint16_t sub;
} badge_guide_def_t;

typedef struct {
    uint16_t label;
    int16_t  x, y;
} badge_touch_target_t;

/* ---------------------------------------------------------------- outputs ---*/

/* Colours, named as the spec names them (BG, TEXT, ACCENT, FOOD, ...). The
 * generated header defines BADGE_COLOR_<NAME> for each. */
typedef struct {
    uint32_t rgb888;
    uint16_t rgb565;
} badge_color_t;

/* Font descriptors; the actual faces are the spec's generated badge_f16/f20/f24/
 * n40 (see main/ui/fonts/). */
typedef struct {
    uint8_t  size;
    uint8_t  line_h;
    uint16_t weight;
} badge_font_desc_t;
