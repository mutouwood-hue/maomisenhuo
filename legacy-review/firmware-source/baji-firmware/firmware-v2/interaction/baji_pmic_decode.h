#pragma once
#include "baji_power.h"
/* AXP2101: STATUS1(0x00), STATUS2(0x01), gauge control(0xA2), SOC(0xA4).
 * Read-only decode; requires identified chip and independently successful reads.
 * Gauge enable is not a claim that the battery model has been calibrated. */
static inline bj_power_sample_t bj_pmic_decode(bool identified, bool status_ok,
    uint8_t status1, uint8_t status2, bool gauge_ok, uint8_t gauge_ctrl,
    uint8_t percent, uint32_t sampled_ms) {
    bj_power_sample_t s = {.battery_percent = -1, .sampled_ms = sampled_ms};
    s.usb_valid = identified && status_ok;
    s.usb_present = s.usb_valid && (status1 & 0x20u) != 0 && (status2 & 0x08u) == 0;
    s.battery_valid = identified && status_ok && (status1 & 0x08u) != 0 &&
        gauge_ok && (gauge_ctrl & 1u) != 0 && percent <= 100;
    if (s.battery_valid) s.battery_percent = percent;
    return s;
}
