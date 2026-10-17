#pragma once
#include "baji_peer_auth.h"
#include "esp_err.h"
esp_err_t bj_peer_crypto_load(bj_peer_auth_t *,const uint8_t hardware_ble_mac[6]);
