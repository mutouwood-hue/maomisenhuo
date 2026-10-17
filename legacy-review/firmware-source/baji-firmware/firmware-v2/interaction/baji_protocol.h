#pragma once
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#define BJ_BLE_FRAME_SIZE 20
#define BJ_BLE_PAYLOAD_MAX 12
#define BJ_BLE_PING_MAX 10
/* Local transport only; never an ownership credential. */
typedef struct { uint8_t opcode, length, payload[12]; uint16_t sequence; } bj_packet_t;
bool bj_packet_decode(const uint8_t *bytes, size_t length, bj_packet_t *out);
bool bj_packet_encode(const bj_packet_t *packet, uint8_t out[20]);
bool bj_packet_request_valid(const bj_packet_t *packet);
