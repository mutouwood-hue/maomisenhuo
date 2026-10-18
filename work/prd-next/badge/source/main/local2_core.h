#pragma once
/* Independent offline domain. No legacy/cloud grants, keys or wire parsing. */
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#define L2_JS_MAX UINT64_C(9007199254740991)
#define L2_EVENT_MAX 200u
#define L2_PEER_MAX 32u
#define L2_STORE_MAX 8192u
#define L2_DEVICE_MAX 32u
#define L2_ID_MAX 64u

typedef enum { L2_OK=0, L2_DUPLICATE, L2_INVALID, L2_NOT_READY, L2_STORAGE_ERROR,
    L2_STALE, L2_REVISION_CONFLICT, L2_PET_MISMATCH, L2_OWNER_CONFLICT,
    L2_REQUEST_CONFLICT, L2_SEQUENCE_GAP, L2_QUEUE_FULL, L2_PEER_FULL,
    L2_ACK_MISMATCH, L2_CORRUPT } l2_status_t;
typedef enum { L2_SCENE_HOME, L2_SCENE_DEPARTING, L2_SCENE_AWAY, L2_SCENE_RETURNING, L2_SCENE_GARDEN, L2_SCENE_TOWN } l2_scene_t;
typedef enum { L2_ACTION_IDLE, L2_ACTION_WALK, L2_ACTION_PET, L2_ACTION_FEED,
    L2_ACTION_WATER, L2_ACTION_BATH, L2_ACTION_PLAY, L2_ACTION_SLEEP } l2_action_t;
typedef enum { L2_WEATHER_CLEAR, L2_WEATHER_RAIN, L2_WEATHER_SNOW } l2_weather_t;
typedef enum { L2_GIFT_NONE, L2_GIFT_PENDING, L2_GIFT_PLAYING, L2_GIFT_SHOWN } l2_gift_state_t;
typedef struct {
    char pet_id[65], name[25], breed[17];
    uint8_t food,mood,clean,energy,health;
    uint64_t coins;
} l2_pet_t;
typedef struct {
    uint64_t revision;
    bool has_epoch_ms;
    uint64_t epoch_ms;
    l2_scene_t scene;
    l2_action_t action;
    l2_weather_t weather;
    l2_pet_t pet;
    l2_gift_state_t gift_state;
} l2_snapshot_t;
typedef struct {
    char client_id[37];
    uint64_t seq;
    char request_id[65];
    uint8_t hash[32]; /* SHA-256 of canonical command, supplied by wire adapter. */
} l2_request_t;
typedef enum { L2_GIFT_FLOWER=1 } l2_gift_kind_t;
typedef struct {
    char peer_id[33]; /* Public peer identity, never a credential. */
    uint64_t counter, epoch_ms;
    uint8_t gift_kind;
    uint32_t quantity;
} l2_receipt_t;
typedef enum { L2_EVENT_CARE=1, L2_EVENT_GIFT=2 } l2_event_kind_t;
typedef struct {
    uint64_t counter, epoch_ms, peer_counter;
    l2_event_kind_t kind;
    l2_action_t action;
    uint8_t peer_slot,gift_kind;
    uint32_t quantity;
} l2_event_t;
typedef struct {
    l2_status_t status;
    uint64_t revision,event_counter;
} l2_result_t;
typedef bool (*l2_persist_fn)(void *,const uint8_t *,size_t);
typedef enum { L2_TERMINAL_NONE, L2_TERMINAL_APPLIED, L2_TERMINAL_REJECTED, L2_TERMINAL_QUARANTINED } l2_terminal_status_t;
typedef struct {
    uint64_t counter;
    l2_terminal_status_t status;
    l2_action_t action;
    char reason[41], save_digest[65];
} l2_terminal_t;
typedef struct {
    char device_id[33];
    bool has_snapshot;
    l2_snapshot_t snapshot;
    bool has_owner;
    l2_request_t last_request;
    l2_result_t last_result;
    uint64_t next_event,last_ack;
    l2_terminal_t terminal;
    uint16_t event_count,peer_count,outgoing_count;
    uint64_t next_peer_counter,last_peer_ack;
    char last_peer_ack_id[33];
    l2_receipt_t outgoing[L2_PEER_MAX];
    l2_event_t events[L2_EVENT_MAX];
    l2_receipt_t peers[L2_PEER_MAX];
    uint64_t peer_first_outgoing[L2_PEER_MAX];
    bool peer_outgoing_acked[L2_PEER_MAX];
    bool has_gift;
    l2_receipt_t last_gift;
    l2_gift_state_t gift_state;
} l2_saved_t;
typedef struct {
    /* Allocate on heap/PSRAM or static storage, NEVER a small task stack. */
    l2_saved_t saved,work;
    uint8_t blob[L2_STORE_MAX];
    l2_persist_fn persist;
    void *persist_ctx;
    bool ready,storage_error;
    uint64_t care_change,gift_change; /* Runtime counters; initialize UI baseline at attach. */
} l2_core_t;
typedef struct {
    bool ready,storage_error,has_snapshot,busy;
    char device_id[33];
    l2_snapshot_t snapshot;
    l2_terminal_t terminal;
    uint16_t pending_events,peer_count;
    uint64_t next_event,last_ack,care_change,gift_change;
    bool has_gift;
    l2_receipt_t last_gift;
    l2_gift_state_t gift_state;
} l2_view_t;

/* Core storage must be zero-initialized (calloc/static) before first use.
 * persist must atomically replace ONE blob. False latches storage_error until load.
 * Neither load failure nor any failure silently resets data or reuses event IDs. */
l2_status_t l2_init_new(l2_core_t *,const char *device_id,l2_persist_fn,void *);
l2_status_t l2_load(l2_core_t *,const uint8_t *,size_t,l2_persist_fn,void *);
size_t l2_encode(const l2_core_t *,uint8_t *,size_t);
l2_status_t l2_set_snapshot(l2_core_t *,const l2_request_t *,const l2_snapshot_t *);
l2_status_t l2_ack_event(l2_core_t *,const l2_request_t *,uint64_t counter);
l2_status_t l2_ack_event_result(l2_core_t *,const l2_request_t *,const l2_terminal_t *);
/* Device UI only, never a phone care opcode. It queues evidence, does not award stats. */
l2_status_t l2_emit_care(l2_core_t *,l2_action_t,uint64_t epoch_ms);
/* Caller must supply a receipt from real peer interaction, never a fabricated grant. */
l2_status_t l2_receive_gift(l2_core_t *,const l2_receipt_t *);
l2_status_t l2_set_gift_state(l2_core_t *,l2_gift_state_t);
/* One lifetime first-flower per peer. DUPLICATE still returns the original receipt. */
l2_status_t l2_peer_reserve_gift(l2_core_t *,const char *peer_id,uint8_t gift_kind,uint32_t quantity,l2_receipt_t *out);
bool l2_peer_peek_outgoing(const l2_core_t *,l2_receipt_t *);
l2_status_t l2_peer_ack_outgoing(l2_core_t *,const char *peer_id,uint64_t counter);
bool l2_get_device_id(const l2_core_t *,uint8_t out[16]);
void l2_get_view(const l2_core_t *,l2_view_t *);
bool l2_peek_event(const l2_core_t *,l2_event_t *);
bool l2_get_peer(const l2_core_t *,uint8_t slot,l2_receipt_t *);
void l2_get_last_result(const l2_core_t *,l2_result_t *);
const char *l2_status_name(l2_status_t);
