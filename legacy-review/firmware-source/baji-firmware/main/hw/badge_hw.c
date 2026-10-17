/*
 * badge_hw - the board, and the honest list of what it does not have.
 *
 * Read docs/m1-hardware-verification.md before changing anything in here. The short
 * version, all of it measured on the M1 board rather than assumed:
 *
 *   motor   absent. The spec's haptics fall back to an edge-ring flash plus a
 *           prompt sound (spec 12.2). BADGE_HW_MOTOR is 0, so the fallback is the
 *           only path that exists -- there is no motor code to rot.
 *   NFC     absent. Encounters confirm by QR (the meet_scan screen). BADGE_HW_NFC 0.
 *   IMU     a QMI8658 at 0x6B on the BSP's I2C bus. The BSP has no driver and no
 *           API (BSP_CAPS_IMU is 0), so it is driven directly here. Raise-to-wake and
 *           "lying flat" are the only things the UI asks of it; if every register
 *           read fails, both report false forever and the badge still works, which
 *           is the correct degradation for a feature the spec calls optional.
 *   power   an AXP2101 at 0x34, also with no BSP driver. The battery percentage and
 *           the charger bit are read here. Unreadable -> the spec's demo value and
 *           one warning.
 *   audio   ES8311 at 0x30 plus a power amp on GPIO46, through the BSP. The
 *           microphone is a different chip (ES7210 at 0x80); the BSP header's claim
 *           that one ES8311 serves both directions is wrong.
 *   touch   CST9217 at 0x5A, owned by the BSP's LVGL input device. This module does
 *           NOT create a second handle: doing so re-drives the reset line the
 *           registered instance owns. The only touch handling here is the edge
 *           clamp, because the panel's mirror arithmetic can return 466 for a
 *           0..465 axis (spec 12.6).
 *
 * The I2C helpers below are the one place in the firmware that talks raw I2C, and
 * they are deliberately not in the paint or UI layers.
 */
#include "badge_hw.h"

#include <stdio.h>
#include <string.h>
#include <stdatomic.h>
#include "badge_audio_policy.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

#include "esp_check.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "bsp/esp-bsp.h"
#include "button_gpio.h"
#include "driver/i2c_master.h"
#include "esp_codec_dev.h"
#include "iot_button.h"

#include "badge_spec_data.h"

static bool s_battery_valid;
static const char *TAG = "badge_hw";

/* ---------------------------------------------------------------- registers --*/

/* QMI8658: WHO_AM_I lives at 0x00 and reads 0x05 on this part; CTRL1 at 0x02 starts
 * the accelerometer, CTRL7 at 0x08 enables it. The rest of the sequence is the
 * datasheet's. */
#define QMI_ADDR 0x6B
#define QMI_WHO_AM_I 0x00
#define QMI_WHO_VALUE 0x05
#define QMI_CTRL1 0x02
#define QMI_CTRL2 0x03
#define QMI_CTRL3 0x04
#define QMI_CTRL5 0x06
#define QMI_CTRL7 0x08
#define QMI_AX_L 0x35
#define QMI_RESET 0x60

/* AXP2101 (XPowersLib's register map): the ADC enable bits and the battery voltage
 * registers used by every open driver for this PMIC. Reading the percentage the same
 * way XPowersLib does keeps the number comparable with what the App already shows. */
#define AXP_ADDR 0x34
#define AXP_STATUS1 0x00
#define AXP_ADC_CHANNEL_CTRL 0x30
#define AXP_VBAT_H 0x34
#define AXP_VBAT_L 0x35
#define AXP_IRS1 0x48
#define AXP_IRS2 0x49
#define AXP_STATUS2 0x01

/* The PWRON key's IRQ registers and the interrupt-enable register that fronts them.
 * Addresses and bit positions are the datasheet's (§6.13.2.42, §6.13.2.44) and were
 * confirmed on the board; docs/hardware-buttons.md is the write-up. */
#define AXP_INTEN2 0x41
#define AXP_INTEN2_PKEY_SHORT (1u << 3)

#define AXP_ADC_VBAT_EN (1u << 2)
#define AXP_ADC_TS_EN (1u << 3)

/* The demo battery value, used only when the PMIC cannot be read. 82 % is what the
 * reference renderer starts from, so an unreadable badge still looks like the mock. */
#define BADGE_BAT_DEMO 82

/*
 * STATUS1's bits, per the datasheet (§6.13.2.1) and docs/hardware-buttons.md:
 *   bit 5 = VBUS good   (cable present)
 *   bit 3 = battery present
 *
 * This pair is where a real bug lived, so it is worth being explicit about what was
 * wrong. The code used to name bit 5 "battery present" and test USB against bit 3 of
 * *IRS2* -- while the variable it read was filled from AXP_IRS1 (0x48). IRS1 is the
 * interrupt-ENABLE register 1, not the PWRON status register 2, so the USB test was
 * reading the wrong register entirely. Net effect: badge_hw_poll() reported
 * usb = false with the cable in, the desk mode (待机常显... 桌面充电态) could never be
 * entered, and the badge sat in 陪伴态 forever. The register map in
 * docs/hardware-buttons.md is the source of truth for these addresses.
 */
#define AXP_STATUS1_VBUS_GOOD (1u << 5)
#define AXP_STATUS1_BAT_PRESENT (1u << 3)

/* INTSTS2 (0x49) bits. All four are RW1C: reading reports, writing a 1 clears.
 *   3 short press   2 long press   1 negative edge (down)   0 positive edge (up) */
#define AXP_IRS2_PKEY_SHORT (1u << 3)
#define AXP_IRS2_PKEY_LONG (1u << 2)
#define AXP_IRS2_PKEY_EDGES (0x03u)

/* STATUS2 charge state: 000 tri / 001 pre / 010 CC / 011 CV / 100 done / 101 no charge.
 * 0..3 are the states that are actively putting current in; 4 is "full, on a cable" and
 * 5 is "not charging". 6/7 are reserved, and are read as NOT charging rather than
 * assumed -- docs/hardware-buttons.md §4.4 whitens the four real states. */
#define AXP_STATUS2_CHG_ACTIVE_MAX 0x03u

/* How often the slow inputs are polled. The UI calls badge_hw_poll() from its tick;
 * this rate-limits the two I2C reads so a 30 fps mode does not issue 60 reads a
 * second on the touch controller's bus. */
#define POLL_MS 500

/* A lift has to stay lifted for this long before it counts as raise-to-wake, so
 * walking with the badge on a lanyard does not wake it constantly. */
#define RAISE_HOLD_MS 400

typedef struct {
    i2c_master_dev_handle_t qmi;
    i2c_master_dev_handle_t axp;
    bool     qmi_ok;
    bool     axp_ok;
    bool     warned_pmic;
    bool     audio_ok;
    atomic_bool audio_on;
    atomic_uint audio_volume;
    esp_codec_dev_handle_t spk;

    uint32_t last_poll_ms;
    int      bat_pct;
    bool     charging;
    bool     usb;
    bool     flat;
    bool     lifted;
    bool     raise_reported;
    uint32_t lifted_since;

    /* Single-slot overwrite queue: no volatile request/read-clear race. */
    TaskHandle_t audio_task;
    QueueHandle_t audio_queue;
    badge_audio_policy_t audio_policy;

    /* The two physical keys. The crown key is polled (it has no GPIO); the lower key is
     * owned by espressif/button, which debounces it and calls back on its own task. */
    badge_hw_key_cb_t key_cb;
    button_handle_t   key_lower;
    uint32_t          last_key_ms;
} badge_hw_t;

static badge_hw_t s_hw;

/* ---------------------------------------------------------------------- i2c --*/

static esp_err_t i2c_read(i2c_master_dev_handle_t dev, uint8_t reg, uint8_t *buf, size_t len)
{
    return i2c_master_transmit_receive(dev, &reg, 1, buf, len, 100);
}

static esp_err_t i2c_write(i2c_master_dev_handle_t dev, uint8_t reg, uint8_t val)
{
    const uint8_t pair[2] = {reg, val};
    return i2c_master_transmit(dev, pair, 2, 100);
}

static esp_err_t add_device(uint8_t addr, i2c_master_dev_handle_t *out)
{
    i2c_master_bus_handle_t bus = bsp_i2c_get_handle();
    if (!bus) {
        ESP_LOGW(TAG, "no I2C bus from the BSP; %02X not available", addr);
        return ESP_ERR_INVALID_STATE;
    }
    const i2c_device_config_t cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = addr,
        .scl_speed_hz = 400000,
    };
    return i2c_master_bus_add_device(bus, &cfg, out);
}

/* ---------------------------------------------------------------------- imu --*/

static void imu_probe(void)
{
    if (add_device(QMI_ADDR, &s_hw.qmi) != ESP_OK) {
        ESP_LOGW(TAG, "QMI8658 not on the bus; raise-to-wake stays off");
        return;
    }
    uint8_t who = 0;
    if (i2c_read(s_hw.qmi, QMI_WHO_AM_I, &who, 1) != ESP_OK || who != QMI_WHO_VALUE) {
        ESP_LOGW(TAG, "QMI8658 WHO_AM_I says 0x%02X (expected 0x%02X); ignoring the IMU", who,
                 QMI_WHO_VALUE);
        return;
    }

    /* Reset, then the accelerometer at 1 kHz with a +/-4 g range, low-pass on. */
    (void)i2c_write(s_hw.qmi, QMI_RESET, 0xB0);
    vTaskDelay(pdMS_TO_TICKS(20));
    (void)i2c_write(s_hw.qmi, QMI_CTRL1, 0x60); /* CTRL1: auto-increment, little endian */
    (void)i2c_write(s_hw.qmi, QMI_CTRL2, 0x14); /* accel: 4 g, 1 kHz */
    (void)i2c_write(s_hw.qmi, QMI_CTRL3, 0x00); /* gyro off */
    (void)i2c_write(s_hw.qmi, QMI_CTRL5, 0x11); /* low-pass filter on */
    (void)i2c_write(s_hw.qmi, QMI_CTRL7, 0x01); /* enable the accelerometer */
    s_hw.qmi_ok = true;
    ESP_LOGI(TAG, "QMI8658 ready at 0x%02X", QMI_ADDR);
}

/** Read one acceleration sample, in g. Returns false when the IMU is unusable. */
static bool imu_read(float *ax, float *ay, float *az)
{
    if (!s_hw.qmi_ok) return false;
    uint8_t raw[6];
    if (i2c_read(s_hw.qmi, QMI_AX_L, raw, sizeof(raw)) != ESP_OK) return false;
    const int16_t xi = (int16_t)((raw[1] << 8) | raw[0]);
    const int16_t yi = (int16_t)((raw[3] << 8) | raw[2]);
    const int16_t zi = (int16_t)((raw[5] << 8) | raw[4]);
    /* +/-4 g over a signed 16-bit range, so 8192 LSB per g. */
    *ax = (float)xi / 8192.0f;
    *ay = (float)yi / 8192.0f;
    *az = (float)zi / 8192.0f;
    return true;
}

/* -------------------------------------------------------------------- power --*/

static void pmic_probe(void)
{
    if (add_device(AXP_ADDR, &s_hw.axp) != ESP_OK) {
        ESP_LOGW(TAG, "AXP2101 not on the bus; battery shows the demo value %d%%",
                 BADGE_BAT_DEMO);
        return;
    }
    /* Turn on the battery-voltage ADC. The chip powers up with most ADCs off to save
     * current, so reading VBAT without this returns a stale zero. */
    uint8_t ctrl = 0;
    if (i2c_read(s_hw.axp, AXP_ADC_CHANNEL_CTRL, &ctrl, 1) != ESP_OK) {
        ESP_LOGW(TAG, "AXP2101 does not answer; battery shows the demo value");
        return;
    }
    (void)i2c_write(s_hw.axp, AXP_ADC_CHANNEL_CTRL,
                    (uint8_t)(ctrl | AXP_ADC_VBAT_EN | AXP_ADC_TS_EN));
    s_hw.axp_ok = true;
    ESP_LOGI(TAG, "AXP2101 ready at 0x%02X", AXP_ADDR);
}

/* The AXP2101's own percentage helper is a table in the vendor's driver; a linear
 * approximation over 3.0..4.2 V is what the spec's own demo numbers assume and is
 * within a couple of percent of that table across the usable range. */
static int vbat_to_pct(int mv)
{
    if (mv <= 3000) return 0;
    if (mv >= 4200) return 100;
    return (mv - 3000) * 100 / 1200;
}

static void power_poll(void)
{
    s_battery_valid = false;
    if (!s_hw.axp_ok) {
        s_hw.bat_pct = BADGE_BAT_DEMO;
        s_hw.charging = false;
        s_hw.usb = false;
        if (!s_hw.warned_pmic) {
            s_hw.warned_pmic = true;
            ESP_LOGW(TAG, "PMIC unavailable: battery is a placeholder, wake-word gating is off");
        }
        return;
    }

    uint8_t st1 = 0, st2 = 0, adc[2] = {0, 0};
    if (i2c_read(s_hw.axp, AXP_STATUS1, &st1, 1) == ESP_OK &&
        i2c_read(s_hw.axp, AXP_STATUS2, &st2, 1) == ESP_OK &&
        i2c_read(s_hw.axp, AXP_VBAT_H, adc, 2) == ESP_OK) {
        const int mv = ((adc[0] & 0x1F) << 8) | adc[1];
        if (mv > 2500 && mv < 4600) {
            s_hw.bat_pct = vbat_to_pct(mv);
            s_battery_valid = true;
        }
        /* USB present is STATUS1 bit 5 (VBUS good), read from STATUS1 -- not from an
         * interrupt register. See the note on the bit definitions above. */
        s_hw.usb = (st1 & AXP_STATUS1_VBUS_GOOD) != 0;
        /* "Charging" is STATUS2's charge-state field actively charging, not merely "a
         * cable is attached to a battery". A full battery on a cable is plugged in and
         * NOT charging, and the glass should say so. */
        const uint8_t chg = st2 & 0x07u;
        s_hw.charging = (st1 & AXP_STATUS1_BAT_PRESENT) && chg <= AXP_STATUS2_CHG_ACTIVE_MAX;
    }
}

/* -------------------------------------------------------------------- keys ----*/

/*
 * Both physical keys, and why they arrive through two unrelated mechanisms.
 *
 * docs/hardware-buttons.md is the measurement write-up; the short version is that the
 * crown key is wired to the AXP2101's PWRON input and does not occupy a GPIO at all,
 * while the lower key is GPIO0 (the BOOT strapping pin). A probe recording both
 * channels at once showed the two are exclusive, so there is no shared edge to
 * arbitrate.
 *
 * The lower key is debounced by espressif/button rather than by hand. That is not a
 * preference: the probe measured 3 presses producing 6 level changes but ISR counts of
 * x1, x3, x1, x3, x1, x4 -- one to three extra edges per press. Counting edges here
 * would send 抚摸 to the state machine several times per click.
 *
 * The crown key cannot use that component (there is no GPIO), so its short press is
 * read from INTSTS2 bit 3 and cleared by writing the bit back (RW1C). Polling cannot
 * miss it: the bit latches until it is cleared, so a 50 ms poll catches a 60 ms press.
 */
static void button_event_cb(void *handle, void *usr)
{
    (void)handle; /* only the lower key uses this component, so the source is known */
    const badge_btn_evt_t evt = (badge_btn_evt_t)(intptr_t)usr;

    /* The callback runs on the button component's own timer task, so the FSM call is
     * marshalled onto the app tick instead of touching the FSM from two tasks. The
     * firmware is single-threaded on the FSM by design (badge_ui_touch() and every
     * other FSM entry point are called from app_tick_cb(), under the display lock). */
    if (s_hw.key_cb) s_hw.key_cb(BADGE_BTN_LOWER, evt);
}

/** @brief Read the crown key's short press out of the PMIC, if the PMIC is there. */
static void key_poll_crown(void)
{
    if (!s_hw.axp_ok) return;
    uint8_t irs2 = 0;
    if (i2c_read(s_hw.axp, AXP_IRS2, &irs2, 1) != ESP_OK) return;

    /* Clear every PWRON bit we look at, not just the one we act on: a stale long-press
     * or edge latch would otherwise sit there and be re-read forever. */
    if (irs2 & (AXP_IRS2_PKEY_SHORT | AXP_IRS2_PKEY_LONG | AXP_IRS2_PKEY_EDGES)) {
        (void)i2c_write(s_hw.axp, AXP_IRS2,
                        (uint8_t)(AXP_IRS2_PKEY_SHORT | AXP_IRS2_PKEY_LONG | AXP_IRS2_PKEY_EDGES));
    }
    if ((irs2 & AXP_IRS2_PKEY_SHORT) && s_hw.key_cb) {
        s_hw.key_cb(BADGE_BTN_CROWN, BADGE_BTN_EVT_CLICK);
    }
    /* The long-press bit is deliberately not reported: it means the owner is on the way
     * to the PMIC's hardware power-off (OFFLEVEL, 6 s by default), which no firmware
     * can intercept. See docs/hardware-buttons.md §3.2. */
}

esp_err_t badge_hw_button_init(badge_hw_key_cb_t cb)
{
    s_hw.key_cb = cb;

    /* Ask the PMIC to report the crown key's short press. The reset default is already
     * enabled, but relying on a default that this same driver has to trust for a
     * user-facing feature is how a silent bug gets in. */
    if (s_hw.axp_ok) {
        uint8_t inten2 = 0;
        if (i2c_read(s_hw.axp, AXP_INTEN2, &inten2, 1) == ESP_OK) {
            const uint8_t want = (uint8_t)(inten2 | AXP_INTEN2_PKEY_SHORT);
            if (want != inten2) (void)i2c_write(s_hw.axp, AXP_INTEN2, want);
        } else {
            ESP_LOGW(TAG, "cannot read INTEN2; the crown key may not report");
        }
    }

    /* The lower key. release_after_press_time is gone in 4.x; the retrigger interval
     * and the long-press time are what matter. long_press_time is the specification's
     * longPressMs (600 ms), so holding the key starts 按住说话 at the same moment a
     * finger on the glass would.
     */
    const button_config_t cfg = {
        .long_press_time = (uint16_t)badge_numbers.long_press_ms,
        .short_press_time = 0, /* the component's default debounce */
    };
    const button_gpio_config_t gpio = {
        .gpio_num = BADGE_BTN_LOWER_GPIO,
        .active_level = 0,        /* measured: idle 1, pressed 0 */
        .enable_power_save = false,
        .disable_pull = false,    /* the component enables the internal pull-up */
    };
    button_handle_t btn = NULL;
    const esp_err_t err = iot_button_new_gpio_device(&cfg, &gpio, &btn);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "GPIO%d button unavailable (%s); the lower key does nothing",
                 BADGE_BTN_LOWER_GPIO, esp_err_to_name(err));
        return err;
    }
    s_hw.key_lower = btn;

    /* The component's callbacks receive one user pointer and the event is read from the
     * handle, so the event is packed into a second registration per event rather than
     * decoded from the handle (which would need the handle->event mapping the component
     * does not expose). Three registrations, three distinct usr pointers. */
    iot_button_register_cb(btn, BUTTON_SINGLE_CLICK, NULL, button_event_cb,
                           (void *)(intptr_t)BADGE_BTN_EVT_CLICK);
    iot_button_register_cb(btn, BUTTON_LONG_PRESS_START, NULL, button_event_cb,
                           (void *)(intptr_t)BADGE_BTN_EVT_HOLD);
    iot_button_register_cb(btn, BUTTON_LONG_PRESS_UP, NULL, button_event_cb,
                           (void *)(intptr_t)BADGE_BTN_EVT_HOLD_END);

    /* The idle state is logged because a mis-configured pull-up is not a subtle failure:
     * GPIO0 floating low would read as a permanently held key, and the badge would spam
     * 抚摸 (and its prompt sound) until the owner noticed.
     *
     * NOTE the polarity, which cost a boot to get right: iot_button_get_key_level() returns
     * the LOGICAL state -- button_gpio.c:42 is `level == active_level ? 1 : 0` -- so 1 means
     * PRESSED and 0 means idle. It is not the raw pin level, and the button's own event
     * machine reads it the same way (iot_button.c:116). The probe measured the raw pin at
     * idle = 1 with active_level = 0 (docs/hardware-buttons.md §3.1), which is this 0. */
    const int pressed = iot_button_get_key_level(btn);
    ESP_LOGI(TAG, "buttons: crown=AXP2101 PWRON (short press), lower=GPIO%d idle=%s",
             BADGE_BTN_LOWER_GPIO, pressed ? "NO (key held at boot?)" : "yes");
    if (pressed) {
        ESP_LOGW(TAG, "GPIO%d reads pressed at boot: the lower key is stuck or floating low",
                 BADGE_BTN_LOWER_GPIO);
    }
    return ESP_OK;
}

/* -------------------------------------------------------------------- audio --*/

static void audio_task(void *arg)
{
    badge_hw_t *hw = (badge_hw_t *)arg;
    while (true) {
        int which;
        if (xQueueReceive(hw->audio_queue, &which, portMAX_DELAY) != pdTRUE) continue;
        if (!atomic_load(&hw->audio_on)) continue;
        const uint32_t now = (uint32_t)(esp_timer_get_time() / 1000);
        if (!badge_audio_accept(&hw->audio_policy, (unsigned)which, now)) continue;
        size_t n = 0;
        const int16_t *pcm = badge_pcm(which, &n);
        if (!pcm || n == 0) continue;
        esp_codec_dev_sample_info_t fs = {
            .bits_per_sample = 16, .channel = 1, .sample_rate = BADGE_PCM_RATE,
        };
        if (esp_codec_dev_open(hw->spk, &fs) != ESP_OK) continue;
        (void)esp_codec_dev_set_out_vol(hw->spk, (int)atomic_load(&hw->audio_volume));
        /* Bounded chunks let a low-battery mute stop an ongoing prompt. */
        for (size_t offset = 0; offset < n && atomic_load(&hw->audio_on); ) {
            const size_t count = n - offset > 320 ? 320 : n - offset;
            if (esp_codec_dev_write(hw->spk, (void *)(pcm + offset), (int)(count * sizeof(int16_t))) != ESP_OK) break;
            offset += count;
        }
        if (atomic_load(&hw->audio_on)) vTaskDelay(pdMS_TO_TICKS(BADGE_AUDIO_AMP_TAIL_MS));
        (void)esp_codec_dev_close(hw->spk); /* ES8311 driver owns GPIO46 PA disable. */
    }
}

/* ----------------------------------------------------------------- public ----*/

esp_err_t badge_hw_init(void)
{
    memset(&s_hw, 0, sizeof(s_hw));
    s_hw.bat_pct = BADGE_BAT_DEMO;
    atomic_init(&s_hw.audio_on, true);
    atomic_init(&s_hw.audio_volume, 60);
    s_hw.audio_queue = xQueueCreate(1, sizeof(int));

    if (bsp_i2c_init() != ESP_OK) {
        ESP_LOGW(TAG, "the BSP's I2C bus did not start; IMU and PMIC stay unavailable");
    } else {
        imu_probe();
        pmic_probe();
    }

    /* The codec. bsp_audio_init(NULL) brings up I2S in the BSP's default format
     * (16-bit mono 22050 Hz duplex); the prompt sounds are 16 kHz, and the ES8311
     * accepts both, which is why the samples are written through the codec's own
     * sample-info path rather than by reconfiguring I2S. */
    s_hw.spk = bsp_audio_codec_speaker_init();
    if (!s_hw.spk) {
        ESP_LOGW(TAG, "no speaker codec; prompt sounds stay silent");
    } else if (!s_hw.audio_queue || xTaskCreate(audio_task, "badge_audio", 3072, &s_hw, 4, &s_hw.audio_task) != pdPASS) {
        ESP_LOGW(TAG, "could not start the audio task; prompt sounds stay silent");
        s_hw.spk = NULL;
    } else {
        s_hw.audio_ok = true;
    }

    ESP_LOGI(TAG, "hardware: %s", badge_hw_summary());
    return ESP_OK;
}

void badge_hw_set_brightness_pct(int pct)
{
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    const esp_err_t err = bsp_display_brightness_set(pct);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "brightness %d%% rejected: %s", pct, esp_err_to_name(err));
    }
}

bool badge_hw_battery_valid(void) { return s_battery_valid; }
int badge_hw_battery_pct(void) { return s_hw.bat_pct; }
bool badge_hw_charging(void) { return s_hw.charging; }
bool badge_hw_usb_present(void) { return s_hw.usb; }
bool badge_hw_flat(void) { return s_hw.flat; }

void badge_hw_poll(uint32_t now_ms, bool *raise_to_wake)
{
    if (raise_to_wake) *raise_to_wake = false;
    if (now_ms - s_hw.last_poll_ms < POLL_MS) return;
    s_hw.last_poll_ms = now_ms;

    float ax = 0, ay = 0, az = 0;
    if (imu_read(&ax, &ay, &az)) {
        /* Flat means the screen is up: the Z axis carries gravity. 0.85 g leaves room
         * for a badge on a slightly tilted stand. */
        s_hw.flat = az > 0.85f;
        /* A lift is the opposite: the Z axis no longer carries gravity, which covers
         * both a pick-up and a turn-to-look. */
        const bool lifted = az < 0.55f;
        if (lifted && !s_hw.lifted) {
            s_hw.lifted = true;
            s_hw.lifted_since = now_ms;
            s_hw.raise_reported = false;
        } else if (!lifted) {
            s_hw.lifted = false;
        }
        /* One report per lift, and only after the badge has been off its back for
         * RAISE_HOLD_MS: a badge swinging on a lanyard crosses the threshold twice a
         * step, and waking the screen on every step would flatten the battery. */
        if (s_hw.lifted && !s_hw.raise_reported &&
            now_ms - s_hw.lifted_since >= RAISE_HOLD_MS) {
            s_hw.raise_reported = true;
            if (raise_to_wake) *raise_to_wake = true;
        }
    }

    power_poll();
    key_poll_crown();
}

void badge_hw_haptic(badge_haptic_kind_t kind)
{
    if (kind == BADGE_HAPTIC_NONE) return;
#if BADGE_HW_MOTOR
    /* A board with a motor would drive it here. No such board exists yet, so this
     * branch is compiled out and the spec's fallback below is the real behaviour. */
#endif
    /* The fallback is the UI's: flash the outermost ring and play a prompt. The sound
     * is played here because this is where the codec lives; the flash is the UI's
     * because only it knows the ring geometry. */
    if (kind == BADGE_HAPTIC_ERROR) {
        (void)badge_hw_audio_play(SND_ERROR);
    }
}

esp_err_t badge_hw_audio_play(badge_snd_t snd)
{
    if (!s_hw.audio_ok || !atomic_load(&s_hw.audio_on)) return ESP_ERR_INVALID_STATE;
    if (snd < 0 || snd >= SND_COUNT) return ESP_ERR_INVALID_ARG;
    const int which = (int)snd;
    return xQueueOverwrite(s_hw.audio_queue, &which) == pdPASS ? ESP_OK : ESP_FAIL;
}

void badge_hw_audio_set_enabled(bool enabled) { atomic_store(&s_hw.audio_on, enabled); }
bool badge_hw_audio_enabled(void) { return atomic_load(&s_hw.audio_on); }
void badge_hw_audio_set_time(int minute) { atomic_store(&s_hw.audio_volume, badge_audio_volume(minute)); }

const char *badge_hw_summary(void)
{
    static char buf[160];
    snprintf(buf, sizeof(buf),
             "motor=%d nfc=%d imu=%d(%s) pmic=%d(%s) audio=%d bat=%d%% charging=%d",
             BADGE_HW_MOTOR, BADGE_HW_NFC, BADGE_HW_IMU, s_hw.qmi_ok ? "qmi8658" : "absent",
             BADGE_HW_IMU ? s_hw.axp_ok : 0, s_hw.axp_ok ? "axp2101" : "absent",
             s_hw.audio_ok, s_hw.bat_pct, s_hw.charging ? 1 : 0);
    return buf;
}
