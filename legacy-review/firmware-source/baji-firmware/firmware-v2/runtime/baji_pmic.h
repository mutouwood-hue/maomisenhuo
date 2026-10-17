#pragma once
#include "baji_power.h"
#include "esp_err.h"
typedef struct {
    bj_power_sample_t sample;
    uint32_t duration_us, max_duration_us, reads_failed, cycles, budget_overruns;
} bj_pmic_snapshot_t;
/* Call once from app_main AFTER BSP creates its I2C bus, never from LVGL callbacks.
 * No PMIC writes or calibration changes. No BLE/audio/LVGL calls.
 * App lifetime service; queue/task allocations occur only at start. */
esp_err_t bj_pmic_start(void);
/* Single-slot snapshot; no I2C or waits. False until first publication. */
bool bj_pmic_latest(bj_pmic_snapshot_t *out);
