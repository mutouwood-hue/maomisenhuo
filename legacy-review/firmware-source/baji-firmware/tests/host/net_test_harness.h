/*
 * The two-device harness for the social handshake tests.
 *
 * Only the test-control surface lives here. Everything the *firmware* uses -- net_link.h,
 * net_social.h, net_proto.h, pet_state.h -- is included from main/ unchanged, and the
 * ESP-IDF headers come from idf_stub/. That separation is what keeps this honest: the real
 * protocol sources are compiled and driven, so a change to any production interface breaks
 * this build rather than silently going untested.
 *
 * WHAT THIS PROVES
 *   The protocol's state machine behaves as documented: consent gates subject disclosure,
 *   a forged CONFIRM cannot open a session, a complete meeting reaches both sides, an
 *   abandoned session is torn down, and encounters survive a restart.
 *
 * WHAT THIS DOES NOT PROVE
 *   Anything about the radio. No NimBLE, no GATT, no real MTU negotiation, no timing, no
 *   packet loss, no RSSI. A green run here means the logic is self-consistent, not that two
 *   badges will talk. The remaining hardware questions are listed in
 *   docs/build-and-usage.md section 6.
 */
#pragma once

#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"
#include "esp_random.h"
#include "net_link.h"
#include "nvs.h"

#include "mbedtls/md.h"

#define NET_TEST_MAX_DEVICES 2

/* ------------------------------------------------------------------ */
/* devices                                                            */
/* ------------------------------------------------------------------ */

/** Register a simulated device. Its id must match a peer entry to be connectable. */
void net_test_link_register(int index, const uint8_t device_id[8]);

/** Override the negotiated MTU, to test the frame-size guard. */
void net_test_link_settings(int index, uint16_t mtu);

/** Add a peer to a device's discovery table, with a smoothed RSSI in dBm. */
void net_test_link_add_peer(int index, const uint8_t peer_id[8], int rssi_avg);

/** Drop every peer from a device's table. */
void net_test_link_clear_peers(int index);

/** Whether the two simulated devices can reach each other at all. */
void net_test_link_set_reachable(int a, int b, int reachable);

/**
 * @brief Make `index` the device that the next call drives.
 *
 * The firmware has one radio and one NVS, so neither is passed around; the harness mirrors
 * that with a current-device selector. This also points the storage stand-in at the same
 * device, so the two sides genuinely have separate secrets and logs.
 */
void net_test_link_select(int index);

/** Whether a device currently has a connection. */
int net_test_link_device_connected(int index);

/**
 * @brief Deliver every frame currently in flight, in order.
 *
 * Frames are queued by net_link_send() rather than delivered inside it, because delivering
 * there recurses through the handshake and reorders it (see net_test_link.c). The test calls
 * this after each step it drives -- a request, an accept, a poll -- which is the point at
 * which the peer's task would have run on the badge.
 */
void net_test_link_pump(void);

/**
 * @brief Stop a device answering, without telling the sender.
 *
 * Models a peer that is connected but not processing -- a badge in a pocket, or a host task
 * that is busy. Frames addressed to it still leave the sender's radio, so the sender's own
 * state advances, which is what isolates one side of a handshake for a test.
 */
void net_test_link_mute(int index, int muted);

/**
 * @brief Deliver a hand-built frame straight into a device's receive callback.
 *
 * This is how the negative tests attack the protocol: they need to send a CONFIRM with a
 * chosen nonce, or a frame with a length that runs past its payload, without a peer that
 * would refuse to produce it. It goes through the same receive path the radio uses, so the
 * test exercises the real code rather than poking at internal state.
 */
void net_test_link_inject(int index, const uint8_t *data, size_t len);

/**
 * @brief Whether a device's own link can currently transmit.
 *
 * Models the window between "the GAP connection is up" and "our GATT discovery of the peer
 * has finished", which is when the peer's characteristic handle is still unknown and the
 * real net_link_send() refuses with ESP_ERR_INVALID_STATE. That window is not a corner case:
 * as the central, net_link starts discovery and *then* invokes the state callback in the same
 * BLE_GAP_EVENT_CONNECT, so the very first HELLO is always sent inside it.
 *
 * Without a way to model it the harness could not see the defect where the initiator marked a
 * refused HELLO as sent and then waited out the whole session deadline for a frame that never
 * left the radio -- which is why the flag exists.
 */
void net_test_link_set_sendable(int index, int sendable);

/* ------------------------------------------------------------------ */
/* what a device put on the wire                                      */
/* ------------------------------------------------------------------ */

int            net_test_link_sent_count(int index);
int            net_test_link_sent_type(int index, int frame_index);
size_t         net_test_link_sent_len(int index, int frame_index);
const uint8_t *net_test_link_sent_data(int index, int frame_index);
void           net_test_link_reset_counters(void);

/**
 * @brief How many sends the transport refused for being larger than the MTU allows.
 *
 * Distinguishes "the frame was too big to send" from "nothing was attempted", which are
 * different bugs.
 */
int net_test_link_refused_sends(void);

/* ------------------------------------------------------------------ */
/* clock, randomness, storage                                         */
/* ------------------------------------------------------------------ */

/** Advance the simulated clock. The session deadline is measured against this. */
void net_test_advance_ms(uint32_t ms);

/** Elapsed simulated time in whole seconds, for readability in assertions. */
uint32_t net_test_elapsed_seconds(void);

/** Mutable so the caller can read it directly; esp_timer_get_time() returns it. */
extern int64_t net_test_time_us;
