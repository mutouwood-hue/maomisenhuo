/*
 * net_link - the Bluetooth transport for the near-field social layer.
 *
 * This module owns the radio and nothing else: it advertises, scans, connects and
 * moves opaque frames. All meaning lives in net_social, which keeps the protocol
 * testable without a radio.
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"
#include "pet_state.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Frames are small: the whole social handshake fits in a couple of round trips. */
#define NET_FRAME_MAX 220

typedef struct net_link net_link_t;

/** @brief A discovered peer, with its smoothed signal estimate. */
typedef struct {
    uint8_t  device_id[8];
    int8_t   rssi;        /* most recent reading, dBm */
    int8_t   rssi_avg;    /* exponentially smoothed, dBm */
    uint8_t  name[24];    /* advertised short name, UTF-8, NUL padded */
    bool     connectable;
} net_peer_t;

/**
 * @brief Start the radio, load the device identity and begin advertising.
 *
 * `game` is borrowed so the advertised payload can carry the pet's breed and
 * stage without a lookup; it must outlive the link.
 */
esp_err_t net_link_init(pet_game_t *game);

/** @brief Start advertising and scanning. Safe to call once. */
esp_err_t net_link_start(void);

void net_link_stop(void);

/** @brief Gate new social advertising/scanning/connections; keep host alive. */
void net_link_set_discovery(bool enabled);
bool net_link_discovery_enabled(void);

/** @brief Number of peers currently in the discovery table. */
int net_link_peer_count(void);

/** @brief Read a peer by index. Returns false when the index is out of range. */
bool net_link_get_peer(int index, net_peer_t *out);

/** @brief Forget every discovered peer. */
void net_link_clear_peers(void);

/**
 * @brief Called with a freshly received frame.
 *
 * The callback runs on the NimBLE host task, so it must not block and must not
 * touch LVGL directly. Post to a queue instead.
 */
typedef void (*net_link_rx_cb_t)(const uint8_t *data, size_t len, void *user);
void net_link_set_rx_cb(net_link_rx_cb_t cb, void *user);

/**
 * @brief Called when the link to a peer goes up or down.
 *
 * `connected` distinguishes the two. `out_id` receives the peer's device id.
 */
typedef void (*net_link_state_cb_t)(bool connected, const uint8_t device_id[8], void *user);
void net_link_set_state_cb(net_link_state_cb_t cb, void *user);

/** @brief Send a frame to the connected peer. Returns ESP_ERR_INVALID_STATE when idle. */
esp_err_t net_link_send(const uint8_t *data, size_t len);

/** @brief true while a peer is connected. */
bool net_link_connected(void);

/**
 * @brief The negotiated ATT MTU, or 0 before it has been negotiated.
 *
 * The number that matters is `mtu - 3`: an ATT write carries a 3-byte header, so that is
 * the largest payload movable in one operation. net_link_send() refuses a larger frame
 * rather than letting the write fail silently.
 */
uint16_t net_link_mtu(void);

/** @brief Connect to a peer previously returned by net_link_get_peer(). */
esp_err_t net_link_connect(const uint8_t device_id[8]);

/** @brief Drop the current connection. */
void net_link_disconnect(void);

/** @brief Our own device id. */
const uint8_t *net_link_device_id(void);

#ifdef __cplusplus
}
#endif
