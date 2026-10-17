#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"
/* Independent 20B peer transport, not the owner local-v1 characteristic. */
struct ble_gap_event;
bool bj_peer_ble_gap_event(struct ble_gap_event *);
esp_err_t bj_peer_ble_register(void);
void bj_peer_ble_start(const uint8_t self_mac[6],const uint8_t peer_mac[6],const uint8_t own_token[8],const uint8_t expected_token[8]);
void bj_peer_ble_stop(void);
bool bj_peer_ble_enabled(void);
bool bj_peer_ble_advertisement(uint8_t token[8]);
bool bj_peer_ble_send(uint8_t type,const uint8_t *,size_t);
bool bj_peer_ble_take(uint8_t *type,uint8_t *,size_t *);
bool bj_peer_ble_connected(void);
uint32_t bj_peer_ble_disconnect_generation(void);
void bj_peer_ble_poll(void);
