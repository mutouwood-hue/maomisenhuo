#include "baji_pmic.h"
#include "baji_pmic_decode.h"
#include "bsp/esp-bsp.h"
#include "driver/i2c_master.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include <stddef.h>

#define POLL_MS 500u
#define READ_TIMEOUT_MS 5
#define CYCLE_BUDGET_US 15000u
static QueueHandle_t latest;
static i2c_master_dev_handle_t pmic;
static TaskHandle_t worker;
static bool read_regs(uint8_t reg, uint8_t *buf, size_t n) {
    return i2c_master_transmit_receive(pmic, &reg, 1, buf, n, READ_TIMEOUT_MS) == ESP_OK;
}
static void poll_task(void *unused) {
    (void)unused;
    bj_pmic_snapshot_t snap = {0};
    for (;;) {
        int64_t begin = esp_timer_get_time();
        uint8_t id = 0, status[2] = {0}, gauge[3] = {0};
        bool id_ok = read_regs(0x03, &id, 1);
        bool identified = id_ok && id == 0x4a;
        bool status_ok = false, gauge_ok = false;
        if (identified) {
            status_ok = read_regs(0x00, status, sizeof(status));
            if (status_ok && (status[0] & 0x08u) != 0)
                gauge_ok = read_regs(0xa2, gauge, sizeof(gauge));
        }
        if (!id_ok) ++snap.reads_failed;
        if (identified && !status_ok) ++snap.reads_failed;
        if (status_ok && (status[0] & 0x08u) != 0 && !gauge_ok) ++snap.reads_failed;
        int64_t end = esp_timer_get_time();
        snap.sample = bj_pmic_decode(identified, status_ok, status[0], status[1],
            gauge_ok, gauge[0], gauge[2], (uint32_t)(begin / 1000));
        snap.duration_us = (uint32_t)(end - begin);
        if (snap.duration_us > snap.max_duration_us) snap.max_duration_us = snap.duration_us;
        if (snap.duration_us > CYCLE_BUDGET_US) ++snap.budget_overruns;
        ++snap.cycles;
        xQueueOverwrite(latest, &snap);
        /* No catch-up loop after a slow bus transaction: always yield for a full interval. */
        vTaskDelay(pdMS_TO_TICKS(POLL_MS));
    }
}
esp_err_t bj_pmic_start(void) {
    /* Serialized app_main-only initialization prevents duplicate tasks. */
    if (worker != NULL) return ESP_OK;
    i2c_master_bus_handle_t bus = bsp_i2c_get_handle();
    if (bus == NULL) return ESP_ERR_INVALID_STATE;
    const i2c_device_config_t cfg = {.dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = 0x34, .scl_speed_hz = 400000};
    esp_err_t err = i2c_master_bus_add_device(bus, &cfg, &pmic);
    if (err != ESP_OK) return err;
    latest = xQueueCreate(1, sizeof(bj_pmic_snapshot_t));
    if (latest == NULL) {
        i2c_master_bus_rm_device(pmic); pmic = NULL;
        return ESP_ERR_NO_MEM;
    }
    if (xTaskCreate(poll_task, "bj_pmic", 3072, NULL, 2, &worker) != pdPASS) {
        vQueueDelete(latest); latest = NULL;
        i2c_master_bus_rm_device(pmic); pmic = NULL;
        return ESP_ERR_NO_MEM;
    }
    return ESP_OK;
}
bool bj_pmic_latest(bj_pmic_snapshot_t *out) {
    return out != NULL && latest != NULL && xQueuePeek(latest, out, 0) == pdTRUE;
}
