#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include "esp_err.h"

#define BADGE_QUEUE_CAPACITY 200
#define BADGE_FRAME_MAX 2048
typedef struct {
    char pet_id[65];
    uint64_t revision, updated_at_ms;
    uint64_t coins;
    uint8_t food, mood, clean, energy, health;
} badge_snapshot_t;
typedef struct {
    uint64_t counter, timestamp_ms;
    uint8_t blocked;
} badge_event_t;
typedef struct {
    badge_snapshot_t snapshot;
    char device_id[32];
    unsigned pending, blocked;
    /* Live UI observations only, not wire fields or persisted game state. */
    uint64_t acknowledged_events, snapshots_received;
    bool bound, connected, secure, subscribed, storage_error;
    bool pairing;
    uint32_t passkey;
    char message[120];
} badge_view_t;

esp_err_t badge_state_init(void);
void badge_get_view(badge_view_t *out);
void badge_set_link(bool connected, bool secure, bool subscribed);
void badge_show_passkey(uint32_t passkey);
void badge_message(const char *message);
esp_err_t badge_pet(void);
esp_err_t badge_retry_blocked(void);
void badge_receive_line(const char *line);
void badge_protocol_error(const char *reason);
bool badge_next_event(char *json, size_t capacity);
void badge_ble_start(void);
bool badge_ble_clear_bonds(void);
void badge_ble_status(const char *json);
bool badge_ui_start(void);
