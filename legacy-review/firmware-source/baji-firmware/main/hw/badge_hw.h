/*
 * badge_hw - everything on this board that is not the display or the UI.
 *
 * The interaction specification's M1 section (12.2) is blunt about what the
 * prototype board actually has, and this module is where that reality is isolated
 * so the UI can be written as if the hardware were complete:
 *
 *   motor   none            -> BADGE_HW_MOTOR 0; every haptic becomes the spec's
 *                              "edge ring + prompt sound" fallback
 *   speaker ES8311 + GPIO46 -> real playback of the spec's five prompt sounds
 *   NFC     none            -> encounters confirm by QR (meet_scan)
 *   IMU     QMI8658 @0x6B   -> raise-to-wake and "lying flat" for the desk mode
 *   touch   CST9217 @0x5A   -> clamped to 0..465, orientation by BSP touch_flags
 *   power   AXP2101 @0x34, no BSP driver -> battery percentage and charger state
 *           are read directly over the BSP's I2C bus
 *
 * Everything here degrades instead of failing: if the IMU does not answer, raise-to
 * wake is simply never reported; if the PMIC does not answer, the battery reports
 * the spec's demo value (82%) and a warning once. A badge that cannot read its
 * battery must still run.
 */
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

#include "badge_assets.h"
#include "badge_fsm.h"

#ifdef __cplusplus
extern "C" {
#endif

/** @brief Bring up I2C (shared with the BSP), the codec and the IMU. */
esp_err_t badge_hw_init(void);

/** @brief Set the panel brightness, in percent, through the BSP. */
void badge_hw_set_brightness_pct(int pct);

/** @brief Battery percentage 0..100; the spec's demo value when unreadable. */
int badge_hw_battery_pct(void);

/** @brief Whether the charger is attached. */
bool badge_hw_battery_valid(void);
bool badge_hw_charging(void);

/** @brief Whether USB power is present (desk mode's trigger). */
bool badge_hw_usb_present(void);

/** @brief Whether the badge is lying flat and still (desk mode's other trigger). */
bool badge_hw_flat(void);

/**
 * @brief Poll the slow inputs (power, IMU) and report wake causes.
 *
 * Called from the app tick at a low rate. Sets `*raise_to_wake` on the rising edge
 * of a lift, which the app turns into badge_fsm_wake(fsm, EVT_WAKE_RAISE).
 */
void badge_hw_poll(uint32_t now_ms, bool *raise_to_wake);

/** @brief Haptics: motor when the board has one, silence otherwise. */
void badge_hw_haptic(badge_haptic_kind_t kind);

/**
 * @brief Play a prompt sound, in the background.
 *
 * Non-blocking: the samples are handed to a small task that owns the codec, so a
 * 130 ms meow cannot stall the animation. A second call while one is playing
 * replaces it.
 */
esp_err_t badge_hw_audio_play(badge_snd_t snd);

/** @brief Mute/unmute the prompt sounds (the settings screen has no volume knob). */
void badge_hw_audio_set_time(int minute_of_day);
void badge_hw_audio_set_enabled(bool enabled);
bool badge_hw_audio_enabled(void);

/* ------------------------------------------------------------------- keys -----*/

/*
 * The two keys' TYPES (badge_btn_t, badge_btn_evt_t) live in badge_fsm.h, not here:
 * the state machine owns what a key press MEANS, and badge_fsm.h cannot include this
 * header without a cycle. This header is the board's view: which pin, and how it is
 * read.
 */

/** @brief The lower key's pin. GPIO0 is the BOOT strapping pin; see the init note. */
#define BADGE_BTN_LOWER_GPIO 0

/**
 * @brief Called from the button layer's own task when a key does something.
 *
 * NOT the app tick: the lower key is debounced by espressif/button, whose callbacks run
 * on its timer task. The app must not call into the state machine or LVGL from there.
 */
typedef void (*badge_hw_key_cb_t)(badge_btn_t which, badge_btn_evt_t evt);

/**
 * @brief Start reading both keys.
 *
 * Call after badge_hw_init(): the lower key is GPIO0, which is the BOOT strapping pin,
 * so it must be configured only once boot has finished. Never hold that key through a
 * reset -- the ROM samples the pin before this function exists.
 */
esp_err_t badge_hw_button_init(badge_hw_key_cb_t cb);

/** @brief Describe the hardware facts the UI should show, for boot logging. */
const char *badge_hw_summary(void);

#ifdef __cplusplus
}
#endif
