#pragma once
#include <stdbool.h>
#include <stdint.h>

/* Policy only: no LVGL, I2C, timers, allocation, storage, or BLE host calls. */
typedef enum { BJ_POWER_UNKNOWN, BJ_POWER_NORMAL, BJ_POWER_LOW } bj_power_mode_t;
typedef enum {
    BJ_POWER_RECOVER_PERCENT, /* Reference HTML updateMode: valid percentage >= 5. */
    BJ_POWER_RECOVER_USB_ONLY /* Reference prose / legacy safety latch; pending choice. */
} bj_power_recovery_t;
typedef struct {
    bool battery_valid;
    int battery_percent; /* Actual gauge/adapter input, never a demo fallback. */
    bool usb_valid;
    bool usb_present;
    uint32_t sampled_ms;
} bj_power_sample_t;
typedef struct {
    bj_power_mode_t mode;
    bool battery_valid, usb_valid, usb_present;
    int battery_percent; /* -1 when unavailable or stale. */
    bool allow_autonomous, allow_voice, retain_ble;
} bj_power_view_t;
typedef struct {
    bj_power_sample_t sample;
    bj_power_recovery_t recovery;
    uint32_t freshness_ms;
    bool has_sample, low_latched;
} bj_power_t;

/* Freshness must be 1..INT32_MAX ms; invalid configuration fails initialization. */
bool bj_power_init(bj_power_t *p, uint32_t freshness_ms, bj_power_recovery_t recovery);
void bj_power_update(bj_power_t *p, const bj_power_sample_t *sample, uint32_t now_ms);
bj_power_view_t bj_power_view(const bj_power_t *p, uint32_t now_ms);
