/*
 * net_proto - the pure core of the near-field social protocol.
 *
 * Why this is split out
 * ---------------------
 * Everything here is a function of its arguments only. No radio, no NVS, no ESP-IDF,
 * no FreeRTOS, no clock. That is what makes the parts of the protocol most likely to be
 * wrong -- frame length validation, the replay window, the proximity hysteresis, the
 * UTF-8 copy of a hostile string -- testable on a PC, where they can be driven with
 * adversarial inputs instead of waiting for two badges to meet.
 *
 * net_social.c keeps the parts that genuinely need a device: session state, NVS, the
 * handshake, and the calls into net_link.
 *
 * The wire format is [type:1][len:1][payload:len]; see net_social.h for the payload of
 * each message type and for an honest statement of what the handshake does and does
 * not guarantee.
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "pet_state.h"

#ifdef __cplusplus
extern "C" {
#endif

/* -- framing --------------------------------------------------------------- */

#define NET_PROTO_HDR_LEN 2

/* A parsed, bounds-checked view into a received buffer. */
typedef struct {
    uint8_t        type;
    uint16_t       len;      /* payload length, already checked against the buffer */
    const uint8_t *payload;  /* points into the caller's buffer; never NULL when ok */
} net_frame_view_t;

/**
 * @brief Validate a received buffer as one frame.
 *
 * Returns false when the buffer is shorter than a header, or when the declared
 * payload length runs past the end of it. `len` comes off the wire, so it is
 * attacker-controlled: every caller must go through this rather than trusting
 * data[1], and `out->payload` is only ever a pointer that is known to be in range.
 */
bool net_proto_parse(const uint8_t *data, size_t len, net_frame_view_t *out);

/**
 * @brief Serialise one frame.
 *
 * Returns the frame length, or 0 when the payload does not fit `cap` or would not fit
 * a NET_FRAME_MAX frame. The cap check is done before any write, so a 0 return means
 * nothing was touched.
 */
size_t net_proto_build(uint8_t *out, size_t cap, uint8_t type,
                       const uint8_t *payload, size_t len);

/* -- replay window --------------------------------------------------------- */

#define NET_PROTO_NONCE_RING 8

/*
 * The nonces accepted during one session. A frame whose nonce is already in the ring is
 * a replay and is dropped.
 *
 * This is a window, not a set: once the ring is full the oldest observation is
 * forgotten, so a frame old enough to have been rotated out becomes acceptable again.
 * Eight is enough for a handshake that exchanges at most a handful of frames, and the
 * window is reset when the session ends, so the exposure is limited to a replay inside
 * a session that is still live.
 */
typedef struct {
    uint32_t ring[NET_PROTO_NONCE_RING];
    int      count;   /* how many entries are in use, 0..NET_PROTO_NONCE_RING */
} net_nonce_ring_t;

bool net_nonce_seen(const net_nonce_ring_t *r, uint32_t n);
void net_nonce_remember(net_nonce_ring_t *r, uint32_t n);
void net_nonce_reset(net_nonce_ring_t *r);

/* -- proximity ------------------------------------------------------------- */

/*
 * Proximity stages, driven by smoothed RSSI.
 *
 * RSSI-to-distance is unreliable: hands, bodies and badge orientation move the reading
 * by several dBm. These thresholds are therefore calibrated against the smoothed value
 * and only decide which interaction is offered, never a distance. They need retuning on
 * real hardware; what is structural is the hysteresis, which stops a peer sitting on a
 * boundary from oscillating.
 */
typedef enum {
    NET_STAGE_NONE = 0,   /* nothing nearby */
    NET_STAGE_FAR,        /* a badge is around, roughly > 6 m */
    NET_STAGE_NEAR,       /* within a couple of metres */
    NET_STAGE_TOUCHING,   /* essentially adjacent */
    NET_STAGE_COUNT
} net_stage_t;

#define NET_PROTO_RSSI_TOUCHING (-45)
#define NET_PROTO_RSSI_NEAR     (-62)
#define NET_PROTO_RSSI_FAR      (-82)
#define NET_PROTO_STAGE_HYSTERESIS 4

/**
 * @brief The stage for a signal, given the stage we were already showing.
 *
 * `prev` matters: leaving a stage requires the signal to be clearly worse than the
 * threshold that admitted it, so a peer on a boundary does not make the readout flap.
 */
net_stage_t net_stage_for_rssi(int rssi, net_stage_t prev);

const char *net_stage_name(net_stage_t s);

/* -- strings off the wire -------------------------------------------------- */

/**
 * @brief Copy a UTF-8 string, never splitting a multi-byte character.
 *
 * A plain truncation at the byte limit can land inside a multi-byte sequence and
 * produce bytes that are not valid UTF-8, which a text renderer then decodes as
 * garbage. This backs off to the start of the partial character instead, losing at most
 * one glyph, and always terminates the result.
 */
void net_copy_utf8_truncated(char *dst, size_t dst_size, const char *src, size_t src_len);

/* -- icebreaker ------------------------------------------------------------ */

/** @brief Number of lines the built-in icebreaker table holds. */
int net_icebreaker_count(void);

/** @brief The line at `index`, for tests and for a phase-two replacement to compare. */
const char *net_icebreaker_line(int index);

/**
 * @brief Pick the icebreaker line for a pair of pets.
 *
 * Deliberately a function of the *pair*, not of the viewer: the two (breed, stage)
 * pairs are put in a canonical order and only data both sides know is hashed, so the
 * two devices independently choose the same sentence and the meeting reads as shared
 * rather than one-sided. Mixing in local state (mood, counters) or hashing the two
 * summaries in arrival order would break that, and
 * `tests/host/test_net_proto.c` fails if either creeps back in.
 *
 * `out` must have room for at least 96 bytes.
 */
void net_icebreaker(const pet_cat_t *mine, uint8_t peer_breed, uint8_t peer_stage,
                    char *out, size_t out_len);

#ifdef __cplusplus
}
#endif
