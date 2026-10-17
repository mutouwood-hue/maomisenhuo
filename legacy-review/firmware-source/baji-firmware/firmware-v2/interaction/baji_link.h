#pragma once
#include "baji_controller.h"
#include "baji_power.h"
#include "baji_protocol.h"
/* Serialized UI caller only; no BLE host, LVGL, I2C, storage or authentication. */
typedef struct {
    uint8_t identity[6], last_state[8];
    uint16_t revision;
    bool has_state;
} bj_link_t;
void bj_link_init(bj_link_t *link, const uint8_t identity[6]);
bool bj_link_state(bj_link_t *link, const bj_controller_t *controller,
                   const bj_power_view_t *power, uint8_t out[10]);
/* Invalid wire frames return false, without changing controller or output.
 * Valid envelopes get application ACK, including BAD_FRAME/UNSUPPORTED.
 * Mutations fail BUSY while pressed/moving/suspended; no implicit retry. */
bool bj_link_dispatch(bj_link_t *link, bj_controller_t *controller,
                      const bj_power_view_t *power, const uint8_t *request,
                      size_t length, uint8_t response[20]);
