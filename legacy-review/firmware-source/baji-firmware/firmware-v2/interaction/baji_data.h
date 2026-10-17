#pragma once
#include "baji_protocol.h"
#include "baji_peer.h"
#include "baji_active.h"
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#define BJ_DATA_MAX 512u
#define BJ_EVENT_MAX 200u
#define BJ_DATA_STORE_MAX (30u + BJ_EVENT_MAX * 16u)
/* Worker-owned state. Callbacks never run under BLE, I2C or LVGL locks. */
typedef bool (*bj_data_mac_fn)(void *, const uint8_t *, size_t, uint8_t[32]);
typedef bool (*bj_data_hash_fn)(void *, const uint8_t *, size_t, uint8_t[32]);
typedef bool (*bj_data_save_fn)(void *, const uint8_t *, size_t);
typedef uint8_t (*bj_data_update_fn)(void *,uint8_t,const uint8_t *,size_t);
typedef struct {
    bj_peer_t *peer;
    bj_active_t *active;
    uint8_t id[6], sensor[29], pet[27], life[205];
    uint16_t life_length;
    bool provisioned, has_pet, has_life, clock_valid, session_valid;
    uint32_t unix_base, clock_at, now, session_at, session_expiry, counter;
    int16_t timezone;
    uint8_t session[16], challenge[56], proof[32];
    bool challenge_pending, confirmed;
    uint32_t challenge_at;
    uint64_t next_event, last_ack;
    uint16_t event_count;
    uint32_t dropped;
    uint8_t events[BJ_EVENT_MAX][16];
    uint8_t stage[BJ_DATA_MAX], frozen[BJ_DATA_MAX], last_signed[BJ_DATA_MAX];
    uint16_t stage_length, stage_received, transfer, frozen_length, last_signed_length;
    uint32_t stage_crc, stage_at, frozen_at;
    uint8_t stage_kind, frozen_kind, last_signed_kind;
    bool staging, frozen_valid;
    bj_data_mac_fn mac;
    bj_data_hash_fn hash;
    bj_data_update_fn update;
    uint8_t update_status[40];
    uint8_t meet_challenge[66], meet_proof[64], environment_status[10], environment_event[56];
    uint8_t social_role[6];
    bool social_role_valid;
    uint64_t environment_next, environment_ack;
    bool environment_pending;
    bj_data_save_fn environment_save;
    uint32_t meet_at, environment_revision, environment_expiry, environment_revoked_revision;
    bool meet_pending, meet_confirmed, environment_allowed;
    bj_data_save_fn save;
    void *adapter;
    uint8_t store[BJ_DATA_STORE_MAX];
} bj_data_t;
uint32_t bj_data_crc(const uint8_t *, size_t);
void bj_data_init(bj_data_t *, const uint8_t[6], bool, bj_data_mac_fn, bj_data_save_fn, void *);
void bj_data_disconnect(bj_data_t *);
void bj_data_tick(bj_data_t *, uint32_t);
bool bj_data_confirm(bj_data_t *, uint32_t);
/** 只接受真正本机UI批准，QR摘要由设备构造；未接peer的暗号模式失败关闭。 */
bool bj_data_meet_confirm(bj_data_t *, uint32_t, const uint8_t[16]);
bool bj_data_environment_event(bj_data_t *, uint8_t label, uint16_t confidence, uint16_t seconds);
bool bj_data_environment_load(bj_data_t *, const uint8_t *, size_t);
bool bj_data_environment_clear(bj_data_t *);
bool bj_data_event(bj_data_t *, uint8_t, uint8_t, int16_t);
bool bj_data_load(bj_data_t *, const uint8_t *, size_t);
size_t bj_data_encode_store(bj_data_t *);
bool bj_data_dispatch(bj_data_t *, const uint8_t[20], uint8_t[20]);
