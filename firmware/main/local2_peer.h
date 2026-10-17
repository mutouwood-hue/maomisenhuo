#pragma once
#include "local2_core.h"

/* Local anonymous proximity exchange. Nonces bind this session; they are not
 * account authentication, signatures, precise distance, or cloud credentials. */
#define L2_PEER_ID_BYTES 16u
#define L2_PEER_NONCE_BYTES 16u
#define L2_PEER_MESSAGE_MAX 64u
#define L2_PEER_MFG_BYTES 23u
typedef enum { L2P_DISABLED, L2P_DISCOVERING, L2P_HELLO, L2P_CONFIRM,
    L2P_EXCHANGING, L2P_WAIT_DONE, L2P_COMPLETE, L2P_BLOCKED } l2_peer_phase_t;
typedef struct {
    l2_peer_phase_t phase;
    bool discoverable,connected,local_confirmed,remote_confirmed;
    bool incoming_saved,incoming_new,outgoing_acked,complete;
    char peer_id[33];
    l2_status_t storage_status;
    uint64_t incoming_counter,outgoing_counter,complete_count;
} l2_peer_view_t;
typedef bool (*l2_peer_send_fn)(void *,uint8_t,const uint8_t *,size_t);
enum { L2P_MSG_HELLO=1, L2P_MSG_CONFIRM=2, L2P_MSG_GIFT=3,
    L2P_MSG_ACK=4, L2P_MSG_DONE=5 };
typedef struct {
    l2_core_t *core;
    l2_peer_send_fn send;
    void *send_ctx;
    l2_peer_view_t view;
    uint8_t own_id[16],nonce[16],remote_id[16],remote_nonce[16],expected_id[16],expected_token[4];
    bool hello_seen,hello_sent,confirm_sent,has_outgoing,ack_pending,done_seen,done_sent;
    l2_receipt_t outgoing,incoming;
    uint32_t last_send_ms;
} l2_peer_machine_t;

/* Pure C state machine. Caller serializes core access for the entire call.
 * send() only queues bytes, never blocks or calls back into the machine. */
bool l2_peer_machine_init(l2_peer_machine_t *,l2_core_t *,l2_peer_send_fn,void *);
bool l2_peer_machine_enable(l2_peer_machine_t *,bool,const uint8_t nonce[16]);
void l2_peer_machine_link(l2_peer_machine_t *,bool,const uint8_t expected_id[16],const uint8_t token[4]);
bool l2_peer_machine_confirm(l2_peer_machine_t *);
bool l2_peer_machine_receive(l2_peer_machine_t *,uint8_t,const uint8_t *,size_t);
void l2_peer_machine_poll(l2_peer_machine_t *,uint32_t now_ms);
size_t l2_peer_machine_advertisement(const l2_peer_machine_t *,uint8_t *,size_t);
/* Platform implementation or host UI test stubs provide these thread-safe APIs. */
void local2_peer_set_discoverable(bool);
void local2_peer_confirm(void);
void local2_peer_get_view(l2_peer_view_t *);

#ifdef ESP_PLATFORM
#include "esp_err.h"
struct ble_gap_event;
/* Register on the single root NimBLE host before it starts. No host/NVS init. */
esp_err_t local2_peer_register(l2_core_t *);
bool local2_peer_gap_event(struct ble_gap_event *); /* Root GAP calls first. */
void local2_peer_poll(uint32_t now_ms); /* Main domain loop; acquires store mutex. */
size_t local2_peer_advertisement(uint8_t out[L2_PEER_MFG_BYTES]);
uint32_t local2_peer_advertisement_generation(void); /* Root refreshes mfg advert. */
#endif
