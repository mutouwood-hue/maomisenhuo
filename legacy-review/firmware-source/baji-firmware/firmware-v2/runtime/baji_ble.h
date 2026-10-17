#pragma once
#include "baji_link.h"
#include "esp_err.h"
esp_err_t bj_ble_start(void);
/* UI-serialized caller; at most two requests, no waiting or allocation. */
void bj_ble_pump(bj_link_t *link, bj_controller_t *controller, const bj_power_view_t *power);
/* Dedicated data worker: never hold radio guard during storage or crypto. */
bool bj_ble_data_take(uint8_t request[20], uint32_t *generation);
bool bj_ble_data_reply(const uint8_t response[20], uint32_t generation);
bool bj_ble_data_current(uint32_t generation);
uint32_t bj_ble_data_generation(void);
