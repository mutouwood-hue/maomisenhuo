/*
 * Orange Cat Pet - firmware entry point for the ESP32-S3-Touch-AMOLED-1.75C.
 *
 * This file is deliberately thin. It owns only what nothing else can:
 *
 *   1. the boot order (NVS, save, display, UI, radio),
 *   2. the one LVGL timer that is the whole firmware's heartbeat,
 *   3. the translation from LVGL input events to the state machine's own input verbs,
 *   4. the periodic hardware poll (power, IMU, backlight),
 *   5. the PERF log line that says what a frame actually cost.
 *
 * Everything else lives behind a contract with its own host test:
 *
 *   badge_spec_data.c   the specification's tables      (generated, tools/gen-badge-ui.mjs)
 *   badge_fsm.c         screens, gestures, modes, cares (tests/host/test_badge_fsm.c)
 *   badge_ui.c          what gets drawn                 (tools/suite/04-frame.cmd)
 *   badge_ui_plan.c     what gets REPAINTED             (tests/host/test_badge_ui_plan.c)
 *   badge_cat.c         the 3D cat's camera             (cat3d's golden tests + cat_view)
 *   badge_pet.c         the five cares' arithmetic      (tests/host/test_badge_pet.c)
 *   badge_events.c      the 8-byte uplink queue         (tests/host/test_badge_events.c)
 *   badge_hw.c          IMU, PMIC, codec, haptics       (host stubs)
 *
 * Boot order matters on this board:
 *   1. NVS first, because both the event queue and the Bluetooth stack need it.
 *   2. The display, which brings up the CO5300 panel over QSPI and registers the LVGL
 *      port. Everything visual must happen inside a display lock.
 *   3. The save is restored before the UI is built, so the first frame already shows
 *      the right cat and the right numbers.
 *   4. Bluetooth comes up last: the radio and the panel both want internal SRAM and
 *      the cache, and letting the display win the race keeps the first seconds of
 *      animation smooth.
 *
 * The previous version of this file drove a pet_state.c simulation with per-second
 * stat decay. The specification's badge has no decay -- the App is authoritative for
 * the numbers and the badge is event-driven -- so badge_pet.c replaces it. What is
 * kept is the JSON save, now badge_pet_serialize()/badge_pet_deserialize().
 */

#include <stdio.h>
#include <string.h>

#include "esp_err.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "nvs_flash.h"

#include "bsp/display.h"
#include "bsp/esp-bsp.h"
#include "lvgl.h"

#include "app_link.h"
#include "badge_cat.h"
#include "badge_events.h"
#include "badge_fsm.h"
#include "badge_hw.h"
#include "badge_pet.h"
#include "badge_runtime.h"
#include "badge_onboarding_store.h"
#include "badge_pet_store.h"
#include "badge_ui.h"

static const char *TAG = "app";

/*
 * Tick rate.
 *
 * This single timer drives the animation, the state machine's timers and the UI
 * repaint, so its period is a compromise and it is worth stating which way it leans.
 * The cat's renderer needs to be OFFERED frames faster than it draws them: a 20 Hz tick
 * can never produce 30 fps animation, because the animation clock only advances when
 * this timer runs. The renderer's own redraw rate is capped separately
 * (badge_fsm_fps() -> badge_cat_layer_tick), and the specification's timings are all
 * time-based rather than tick-based, so a faster tick costs a little scheduling and
 * buys smoother motion.
 *
 * 10 ms (100 Hz) rather than the previous 20 ms: the interaction spec measures tap
 * (<= tapMaxMs), swipe (>= swipeMinPx within swipeMaxMs) and long press (>= longPressMs)
 * against real elapsed time, and a 20 ms tick quantises a 150 ms long press into 140 or
 * 160 ms. The per-tick work is a handful of comparisons plus a repaint diff.
 */
#define APP_TICK_MS 10

/*
 * How long bring-up waits for the LVGL lock before giving up.
 *
 * Not zero: bsp_display_lock(0) is a non-blocking try, and the LVGL task is already
 * running its first lv_timer_handler() by the time the UI is built, so a try can lose the
 * race and lose the whole UI with it. Generous because it is a one-off: if the lock does
 * not come free in a second something is genuinely wrong and the error is worth having.
 */
#define APP_BOOT_LOCK_MS 1000

/*
 * The place the 生活同步 screen is reporting, as an index into badge_place_defs[]
 * (0 = 工作, 1 = 咖啡店, 2 = 公园; badge_spec.json's own `places` order).
 *
 * The place is App data in the specification's own model: the phone knows where the
 * owner is and tells the badge. No frame on the wire carries it (badge_spec.h's
 * badge_evt_type_t has 15 members and none of them is a place; the only place index is
 * EVT_CALL_HOME.a, which is a command leaving the badge, not one arriving), and
 * net_link/net_proto/net_social have no field for it either. So this is the
 * specification's first place, which is what the reference's `let place='work'` default
 * resolves to, and badge_ui_set_place() is what a future frame will drive. It is a
 * compile-time constant on purpose: the _Static_assert below is where the out-of-range
 * question is answered, rather than in a runtime clamp that could only fail silently.
 */
#define APP_PLACE 0

/* The slow poll: power and IMU. 500 ms matches badge_hw_poll()'s own POLL_MS. */
#define APP_HW_POLL_MS 500

/* The PERF line's period. Long enough not to fill the log, short enough to see a
 * regression while watching a device. */
#define APP_PERF_MS 5000

/* The naming of the badge's own state, for the PERF line. */
static const char *const APP_MODE_NAMES[BADGE_MODE_COUNT] = {
    "desk", "play", "comp", "aod", "off",
};

static badge_game_t  s_game;
static badge_onboarding_t s_onboarding;
static badge_fsm_t  *s_fsm;
static badge_cat_layer_t *s_cat;
static badge_ui_t   *s_ui;

/* Input tracking. The state machine classifies a gesture from the whole press, so the
 * app has to remember where the finger went down. */
static bool     s_pressed;
static int      s_press_x, s_press_y;

/* ------------------------------------------------------------------- save -----*/

/* ------------------------------------------------------------------- input ----*/

/*
 * LVGL input events into the state machine's verbs.
 *
 * The mapping is one event to one verb, with no gesture logic here: the specification's
 * thresholds (tapMaxMs, tapMoveMax, swipeMinPx, swipeMaxMs, longPressMs) all live in
 * badge_numbers and are applied by badge_fsm_release(), which is where the host test can
 * exercise them at their exact boundaries. Re-deriving a swipe here would put the same
 * rule in two places and make the tested one unreachable.
 *
 * Each verb is mirrored to badge_ui_touch(). That is not a second input path: the
 * specification's 逗猫 screen draws the feather AT THE FINGER (drawEl('feather'), line
 * 1500), and the state machine's recogniser deliberately keeps only what the gestures
 * need, so the live point has nowhere else to live. badge_ui.c then asks for a full
 * frame while the finger is down, because a feather that moves cannot be served by a
 * bounding-box repaint whose box would be the element's own (x, y).
 *
 * The coordinates are clamped to the panel: the specification's 12.6 self-test exists
 * because this controller reports 466 on an edge pixel, and a coordinate of 466 indexes
 * one past the end of a 466-wide buffer.
 */
static void app_indev_point(int *x, int *y)
{
    lv_point_t p = {0, 0};
    lv_indev_t *indev = lv_indev_active();
    if (indev) lv_indev_get_point(indev, &p);
    *x = badge_touch_clamp((int)p.x);
    *y = badge_touch_clamp((int)p.y);
}

static void app_indev_cb(lv_event_t *e)
{
    const lv_event_code_t code = lv_event_get_code(e);
    const uint32_t now = (uint32_t)(esp_timer_get_time() / 1000);
    int x = 0, y = 0;

    switch (code) {
    case LV_EVENT_PRESSED:
        if (badge_ui_input_blocked(s_ui)) break;
        app_indev_point(&x, &y);
        s_pressed = true;
        s_press_x = x;
        s_press_y = y;
        badge_runtime_press(s_fsm, x, y, now);
        badge_ui_touch(s_ui, x, y, true);
        break;

    case LV_EVENT_PRESSING:
        /* Only 逗猫 uses a moving finger (the feather follows it). Sending every
         * pressing event would let a 100 Hz tick flood the state machine with useless
         * work on every other screen, so the move is only forwarded when the finger has
         * actually travelled. */
        if (!s_pressed) break;
        app_indev_point(&x, &y);
        if (x != s_press_x || y != s_press_y) {
            s_press_x = x;
            s_press_y = y;
            badge_runtime_move(s_fsm, x, y, now);
            badge_ui_touch(s_ui, x, y, true);
        }
        break;

    case LV_EVENT_RELEASED:
        if (!s_pressed) break;
        app_indev_point(&x, &y);
        s_pressed = false;
        badge_runtime_release(s_fsm, x, y, now);
        badge_ui_touch(s_ui, x, y, false);
        break;

    case LV_EVENT_PRESS_LOST:
        /* The finger left the display (or the panel lost it). The state machine treats
         * that as a release at the last known point, which is what the reference does:
         * it ends the touch, it does not cancel it. */
        if (s_pressed) {
            s_pressed = false;
            badge_runtime_release(s_fsm, s_press_x, s_press_y, now);
            badge_ui_touch(s_ui, s_press_x, s_press_y, false);
        }
        break;

    default:
        break;
    }
}

/* ------------------------------------------------------------------- tick -----*/

static void app_perf_line(uint32_t now_ms)
{
    static uint32_t next_ms;
    if (next_ms == 0) next_ms = now_ms + APP_PERF_MS;
    if ((int32_t)(now_ms - next_ms) < 0) return;
    next_ms = now_ms + APP_PERF_MS;

    const badge_mode_t mode = badge_fsm_mode(s_fsm);
    const char *mode_name = (mode < BADGE_MODE_COUNT) ? APP_MODE_NAMES[mode] : "?";
    const int heap = (int)(heap_caps_get_free_size(MALLOC_CAP_INTERNAL) / 1024);

    /*
     * One line, and every number on it is measured rather than guessed:
     *   mode    the working mode the state machine is in
     *   fps     the cat's EFFECTIVE redraw rate (its own adaptive cap, not the tick)
     *   cat_us  milliseconds the last cat frame spent rasterising
     *   dirty   pixels the cat's dirty rectangle covers (the panel is 466x466)
     *   heap    internal RAM left, which is the one that runs out first on this board
     *
     * The frame budget line from the specification's PERF section is >= 24 fps; a line
     * that shows fps below that is the signal to look at cat_us and dirty together.
     */
    ESP_LOGI(TAG, "PERF mode=%s fps=%d cat_us=%d dirty=%d px heap=%dK screen=%d q=%d snap_us=%lu",
             mode_name,
             s_cat ? badge_cat_layer_fps(s_cat) : 0,
             s_cat ? badge_cat_layer_render_us_avg(s_cat) : 0,
             s_cat ? badge_cat_layer_dirty_px(s_cat) : 0,
             heap,
             badge_fsm_screen(s_fsm),
             badge_events_pending(),
             (unsigned long)badge_ui_motion_prepare_us(s_ui));
}

/* The physical keys' events, queued until the next app tick.
 *
 * badge_hw_button_init() installs these and the lower key's callbacks come from
 * espressif/button's own timer task, so this is the one input that does NOT arrive on
 * the LVGL thread. The state machine and LVGL are both single-threaded here, so the
 * callback only records what happened and app_tick_cb() applies it under the display
 * lock. A short array, not a queue: at most one click and one hold edge can be
 * outstanding between two 10 ms ticks, and dropping the oldest is the right failure for
 * a key press nobody can replay anyway. */
#define APP_KEY_QUEUE 4
static badge_btn_t     s_key_btn[APP_KEY_QUEUE];
static badge_btn_evt_t s_key_evt[APP_KEY_QUEUE];
static volatile int    s_key_head, s_key_tail;

static void app_key_cb(badge_btn_t which, badge_btn_evt_t evt)
{
    const int next = (s_key_head + 1) % APP_KEY_QUEUE;
    if (next == s_key_tail) return; /* full: drop it rather than overwrite an older edge */
    s_key_btn[s_key_head] = which;
    s_key_evt[s_key_head] = evt;
    s_key_head = next;
}

/* Called from the LVGL timer, i.e. with the display lock already held. */
static void app_tick_cb(lv_timer_t *t)
{
    (void)t;
    static int64_t last_us;
    static uint32_t last_hw_ms;
    static int last_screen = -1;

    const int64_t now_us = esp_timer_get_time();
    if (last_us == 0) last_us = now_us;
    float dt = (float)(now_us - last_us) / 1000000.0f;
    last_us = now_us;
    const uint32_t now_ms = (uint32_t)(now_us / 1000);
    badge_events_advance_clock(now_ms); /* Hardware/key events share this clock. */

    /* 1. The slow hardware. Polling it from the tick rather than its own timer keeps
     *    every I2C transaction on this thread, which is the only one that holds the
     *    display lock. */
    if (last_hw_ms == 0 || (now_ms - last_hw_ms) >= APP_HW_POLL_MS) {
        last_hw_ms = now_ms;
        bool raise_to_wake = false;
        badge_hw_poll(now_ms, &raise_to_wake);
        if (raise_to_wake) badge_fsm_wake(s_fsm, EVT_WAKE_RAISE, now_ms);
        badge_fsm_set_battery(s_fsm, badge_hw_battery_pct(), badge_hw_battery_valid(),
                              badge_hw_usb_present(), now_ms);
        badge_fsm_set_power(s_fsm, badge_hw_usb_present(), badge_hw_flat());
    }

    /* 2. The state machine: timers, modes, quirks, care flow, screen timeouts. */
    badge_runtime_tick(s_fsm, now_ms);

    /* 2b. The physical keys, applied here so they run on this thread like every other
     *     input. Their effects land in the same pool as the gestures', so step 4b below
     *     plays the sound and drives the haptic for them without a second path. */
    while (s_key_tail != s_key_head) {
        const badge_btn_t which = s_key_btn[s_key_tail];
        const badge_btn_evt_t evt = s_key_evt[s_key_tail];
        s_key_tail = (s_key_tail + 1) % APP_KEY_QUEUE;
        badge_fsm_button(s_fsm, which, evt, now_ms);
    }

    /* 3. Keep the radio layer's advertisement in step with the cat. Cheap: a breed,
     *    a growth and a name comparison. */
    badge_app_link_sync();

    /* 4. The radio's own state machine and the uplink queue. */
    badge_app_link_poll(now_ms);
    badge_fsm_set_phone(s_fsm, badge_app_link_connected());
    badge_fsm_set_sync_info(s_fsm, badge_events_pending());

    /* 4b. Drain the interaction effects.
     *
     *     badge_fsm_tick() only ACCUMULATES effects (its badge_fx_t carries the sound
     *     bitmask, the haptic kind and the toast/bubble indices), and badge_fsm.h:390
     *     documents badge_fsm_take_fx() as the way to collect them -- "the effects belong
     *     to the caller's own step". NOTHING WAS CALLING IT, so every prompt sound the state
     *     machine asked for was silently dropped: the spec's five sounds (pet/careDone/
     *     meet/wake/error, badge_spec.json "sounds") were never played once on the badge.
     *     The haptic was dropped with them, which is why the spec's
     *     "没有马达 -> 边缘光圈 + 提示音" fallback had no sound half either.
     *
     *     This is the app layer's job and not the UI's: badge_hw owns the codec, and the
     *     UI's own contract (badge_ui.h) says the app drives it. Taking the effects here
     *     covers every producer -- ticks, gestures and the radio -- in one place.
     */
    badge_hw_audio_set_time(badge_fsm_now_min(s_fsm));
    badge_hw_audio_set_enabled(!badge_fsm_low_battery(s_fsm));
    const badge_fx_t fx = badge_fsm_take_fx(s_fsm);
    if (fx.sfx && !badge_fsm_low_battery(s_fsm)) {
        /* One sound per step: the highest-priority bit set. Two sounds at once would
         * overlap in the codec's single playback slot anyway. */
        for (int i = 0; i < SND_COUNT; i++) {
            if (fx.sfx & (1u << i)) {
                (void)badge_hw_audio_play((badge_snd_t)i);
                break;
            }
        }
    }
    if (fx.haptic != BADGE_HAPTIC_NONE) badge_hw_haptic(fx.haptic);

    /* 5. The display.
     *
     *    The UI is rebuilt only when the screen changed, and otherwise refreshed: it
     *    owns the toast, bubble, float and edge ring. Its read-only feedback snapshot
     *    preserves each FSM trigger's original timestamp, so refresh cannot extend
     *    lifetimes. The app owns the ORDER: rebuild must precede refresh and cat
     *    placement because rebuilding can move labels in the z-order. */
    const int screen = badge_fsm_visual_screen(s_fsm);
    if (screen != last_screen) {
        last_screen = screen;
        badge_ui_rebuild(s_ui, now_ms);
    }
    badge_ui_refresh(s_ui, now_ms);
    if (badge_ui_transitioning(s_ui)) badge_ui_transition_frame(s_ui, now_ms);

    /* 6. The 3D cat: told the camera the current screen wants and how fast to draw. */
    badge_anim_directive_t anim;
    const bool animating = badge_fsm_anim(s_fsm, now_ms, &anim);
    badge_cat_layer_update(s_cat, screen, badge_fsm_mode(s_fsm),
                           animating ? &anim : NULL, now_ms);
    if (!s_pressed && !badge_ui_motion_active(s_ui) && !badge_ui_transitioning(s_ui))
        badge_cat_layer_tick(s_cat, dt, badge_fsm_fps(s_fsm));
badge_ui_motion_frame(s_ui, now_ms);

    /* The backlight follows the mode and the settings; badge_hw_set_brightness_pct()
     * ignores a value equal to the one already set, so this is a comparison. */
    badge_hw_set_brightness_pct(badge_fsm_backlight_pct(s_fsm));

    /* 7. Persist, if the debounce has elapsed. */
    (void)badge_pet_store_poll(&s_game, now_ms);
    badge_onboarding_store_poll(&s_onboarding, now_ms);

    app_perf_line(now_ms);
}

/* ------------------------------------------------------------------ bring-up ---*/

/*
 * The panel's own geometry facts, checked at boot rather than assumed.
 *
 * badge_spec.h fixes BADGE_SCR_W/H at 466 and the disc's radius at 233, and every
 * geometry rule in the specification is written against those two numbers. The BSP
 * declares its own copy. If they ever disagree, the safe-circle maths and the actual
 * glass are different circles and every element on screen is misplaced -- which is
 * exactly the class of bug that reached the real board before (see docs/gap-vs-v1.5.md),
 * so it is a boot-time failure and not a comment.
 */
_Static_assert(BADGE_SCR_W == 466 && BADGE_SCR_H == 466,
               "the specification's canvas is 466x466; update BADGE_SCR_W/H if the panel changed");
_Static_assert(BADGE_CX == 233 && BADGE_CY == 233 && BADGE_R == 233,
               "the disc is radius 233 centred on the panel");
_Static_assert(APP_PLACE >= 0 && APP_PLACE < BADGE_PLACE_COUNT,
               "APP_PLACE indexes badge_place_defs[]; badge_ui_set_place() would refuse it");

static esp_err_t app_display_start(void)
{
    /*
     * The BSP's default configuration is the correct one for this glass and it is
     * written out here rather than left implicit, because the two numbers below are the
     * ones that put the image in the wrong place if they drift:
     *
     *   rotation = 0        -- the panel is natively 466x466 and the UI is drawn in that
     *                          space, so any rotation desyncs the touch coordinates
     *                          from the drawing coordinates.
     *   touch_flags         -- mirror_x = 1, mirror_y = 1, swap_xy = 0. This is what the
     *                          BSP itself sets (esp32_s3_touch_amoled_1_75c.c:518-528)
     *                          and what the specification's 12.6 self-test verifies on
     *                          the device: tapping top-left must light the top-left
     *                          target. Getting it wrong mirrors the whole UI, and
     *                          bsp_display_rotation_set() cannot be used to fix it
     *                          afterwards because it moves the panel image without
     *                          moving LVGL's or the touch driver's idea of the axes.
     */
    bsp_display_cfg_t cfg = {
        /* THIS LINE IS LOAD BEARING. Do not drop it.
         *
         * bsp_display_start_with_config() passes &cfg->lv_adapter_cfg straight into
         * esp_lv_adapter_init(), which does `s_ctx.config = *config`. A designated
         * initialiser zeroes every field it does not name, so omitting this line leaves
         * the whole adapter config at 0 -- including task_min_delay_ms AND
         * task_max_delay_ms.
         *
         * esp_lv_adapter_init() only substitutes defaults for task_stack_size and
         * task_priority (`x ? x : DEFAULT`), never for the delays. The worker then does
         * `ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(0))`, and a 0-tick wait does not block,
         * so the LVGL task spins in a tight loop at priority 6 against app_main's
         * priority 1. app_main is starved mid-driver-call and the badge never finishes
         * bring-up: dark screen, and a task_wdt storm naming IDLE0 and CPU 0: lvgl.
         *
         * The BSP's own bsp_display_start() sets exactly this field the same way
         * (esp32_s3_touch_amoled_1_75c.c:521); we build our own cfg only to pin the
         * rotation and touch flags, so the adapter defaults have to be carried over too.
         */
        .lv_adapter_cfg = ESP_LV_ADAPTER_DEFAULT_CONFIG(),
        .rotation = ESP_LV_ADAPTER_ROTATE_0,
        .tear_avoid_mode = ESP_LV_ADAPTER_TEAR_AVOID_MODE_NONE,
        .touch_flags = {
            .swap_xy = 0,
            .mirror_x = 1,
            .mirror_y = 1,
        },
    };

    lv_display_t *disp = bsp_display_start_with_config(&cfg);
    if (!disp) {
        ESP_LOGE(TAG, "bsp_display_start_with_config failed");
        return ESP_FAIL;
    }

    lv_indev_t *indev = bsp_display_get_input_dev();
    if (!indev) {
        ESP_LOGE(TAG, "the BSP registered no input device");
        return ESP_FAIL;
    }
    lv_indev_add_event_cb(indev, app_indev_cb, LV_EVENT_ALL, NULL);
    return ESP_OK;
}

void app_main(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    /* The specification's defaults (spec 12.7: the demo clock starts at 18:40). The
     * save, when there is one and it is readable, replaces them. */
    badge_pet_defaults(&s_game);
    (void)badge_pet_store_load(&s_game);
    (void)badge_onboarding_store_load(&s_onboarding);
 /* a freshly loaded save is not a change to be written back */

    ESP_ERROR_CHECK(app_display_start());

    /*
     * DO NOT call bsp_display_brightness_init() here, and do not drive the panel from
     * app_main at all.
     *
     * It is REDUNDANT and it is the wrong context: bsp_display_start_with_config()
     * already calls bsp_display_brightness_init() itself (esp32_s3_touch_amoled_1_75c.c
     * :543), so the glass is lit to 100% before app_display_start() returns. The
     * brightness the UI actually wants is applied by app_tick_cb() through
     * badge_hw_set_brightness_pct(), which runs as an lv_timer callback -- on the LVGL
     * task, with the lock held, which is the only context where a panel command belongs.
     *
     * (This call was originally blamed for a boot hang. It was not the cause: the real
     * one was the zeroed lv_adapter_cfg above, which starved app_main of CPU. The call
     * is removed because it is pointless and misplaced, not because it was the bug.)
     */

    ESP_ERROR_CHECK(badge_hw_init());
    ESP_LOGI(TAG, "hardware: %s", badge_hw_summary());

    /* The keys, after badge_hw_init() and well after the ROM has sampled the straps:
     * the lower key is GPIO0, and a pull-up configured during boot would turn a held key
     * into a download-mode reset. A failure here is logged, not fatal -- a badge whose
     * keys are missing still runs with the touchscreen. */
    (void)badge_hw_button_init(app_key_cb);

    ESP_ERROR_CHECK(badge_events_init());

    /*
     * NOTE THE `== ESP_OK`. bsp_display_lock() returns esp_err_t, NOT bool, even though
     * the BSP's own header documents it as "@return true Mutex was taken / @return false
     * Mutex was NOT taken" (esp32_s3_touch_amoled_1_75c.h:246-247, next to the
     * esp_err_t signature on :249). ESP_OK is 0, so a bare `if (bsp_display_lock(...))`
     * is inverted: it takes the failure branch precisely when the lock WAS taken, and
     * app_main then returns with no UI at all -- a booted badge, a lit panel, and nothing
     * on it but the cleared screen. That is the "no UI this boot" this used to log.
     *
     * Wait for the lock rather than probing with a zero timeout: the LVGL task is already
     * inside its first lv_timer_handler() by the time bring-up arrives, so
     * xSemaphoreTakeRecursive(mutex, 0) races and can lose on a busy frame. Nothing holds
     * the lock for long (the adapter takes it, runs the handler, releases it), so a
     * bounded wait is the right call and a timeout after it is still worth reporting.
     */
    if (bsp_display_lock(APP_BOOT_LOCK_MS) == ESP_OK) {
        /* The cat layer is created before the UI so badge_ui_create() can put it at the
         * bottom of the compositor's explicit z-order (badge_ui.h). */
        s_cat = badge_cat_layer_create(lv_screen_active());
        if (!s_cat) ESP_LOGE(TAG, "the 3D cat layer could not be created");

        s_fsm = badge_fsm_create(&s_game, (uint32_t)(esp_timer_get_time() / 1000));
        if (!s_fsm) {
            ESP_LOGE(TAG, "out of memory creating the state machine");
            bsp_display_unlock();
            return;
        }

        badge_fsm_set_onboarding(s_fsm, &s_onboarding);
        badge_runtime_attach(s_fsm, (uint32_t)(esp_timer_get_time() / 1000));

        s_ui = badge_ui_create(lv_screen_active(), s_fsm, s_cat);
        if (!s_ui) ESP_LOGE(TAG, "the UI could not be created");

        if (s_cat) {
            badge_cat_layer_set_breed(s_cat, badge_fsm_game_const(s_fsm)->breed);
            badge_cat_layer_set_visible(s_cat, false);
        }

        /* The 生活同步 screen's place: see APP_PLACE. Set through the setter rather than
         * left to the UI's own default so that the one place that decides it is named. */
        badge_ui_set_place(s_ui, APP_PLACE);

        badge_ui_rebuild(s_ui, (uint32_t)(esp_timer_get_time() / 1000));

        lv_timer_create(app_tick_cb, APP_TICK_MS, NULL);
        bsp_display_unlock();
    } else {
        ESP_LOGE(TAG, "the display lock did not become available; no UI this boot");
        return;
    }

    /* The radio last: it wants the same internal SRAM the panel just took, and letting
     * the display win that race is what keeps the first frames smooth. */
    err = badge_app_link_init(&s_game);
    if (err == ESP_OK) {
        err = badge_app_link_start();
        if (err != ESP_OK) ESP_LOGW(TAG, "no radio: %s (the badge works offline)",
                                    esp_err_to_name(err));
    } else {
        ESP_LOGW(TAG, "the link layer failed to init: %s", esp_err_to_name(err));
    }

    ESP_LOGI(TAG, "up: cat=%s breed=%u growth=%d coins=%d screens=%d elements=%d",
             s_game.name, (unsigned)s_game.breed, (int)s_game.growth, (int)s_game.coins,
             BADGE_SCREEN_COUNT_SPEC, BADGE_EL_COUNT);
}
