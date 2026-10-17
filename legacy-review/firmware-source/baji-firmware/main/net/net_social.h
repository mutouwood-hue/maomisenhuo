/*
 * net_social - the near-field social protocol.
 *
 * Layering
 * --------
 * net_link moves bytes; this module decides what they mean. Nothing here touches
 * a radio, which is what makes the handshake and the icebreaker testable on a PC.
 *
 * Frames
 * ------
 * Every frame is  [type:1][len:1][payload:len], len <= NET_FRAME_MAX-2.
 * Payloads are:
 *
 *   HELLO    [id(8)][nonce(4)][tag(8)]              tag = HMAC(key(id), "HELLO"|id|nonce)
 *   ACK      [id(8)][nonce(4)][echoed_nonce(4)][tag(8)]
 *                                                   tag = HMAC(key(id), "ACK"|id|nonce|echoed)
 *   CONFIRM  [echoed_peer_nonce(4)]
 *   SUMMARY  [breed(1)][stage(1)][friendliness(1)][name, UTF-8, NUL]
 *   ICE      [UTF-8 sentence]
 *   BYE      (empty)
 *
 * CONFIRM, SUMMARY, ICE and BYE carry no tag. They are accepted only once
 * `our_nonce` has been seen, i.e. once the peer has demonstrably received a frame
 * from us. See the SECURITY NOTE below for why that is a gate and not a guarantee.
 *
 * The sender scales the ICE sentence to the payload budget, so a frame never exceeds
 * NET_FRAME_MAX; a sentence too long to fit is dropped rather than truncated.
 *
 * What this handshake does and does not give you
 * ----------------------------------------------
 * Being honest about the threat model matters more here than looking impressive:
 * two mutually unknown devices cannot authenticate each other without a
 * pre-shared secret or an out-of-band channel. So this protocol deliberately
 * provides the properties that are actually achievable, and claims nothing more:
 *
 *   * Proximity binding. Nothing is exchanged until the peer is within a few
 *     metres, so consent is physically local rather than remote.
 *   * Explicit consent on both sides. HELLO is only a request; the responder
 *     reveals nothing until its owner accepts. A badge cannot harvest a
 *     passer-by's pet data by walking past. The revealing frames (SUMMARY, ICE)
 *     carry no tag, so they are additionally required to arrive inside a session
 *     whose handshake completed -- see the SECURITY NOTE below.
 *   * Replay defence. The tagged frames (HELLO, ACK) carry a nonce that is
 *     remembered for the session, so a recorded one replayed inside the same session
 *     is dropped. Tags bind both identities and both nonces.
 *   * Frame consistency. A tag covers the identity and both nonces, so a frame whose
 *     fields were not produced together by this protocol does not verify: it catches a
 *     truncated, corrupted or hand-assembled HELLO/ACK before any of it is parsed.
 *   * Personal data minimisation. Only breed, life stage, a friendliness score and
 *     the pet's display name ever leave the device. Stats, coins, inventory and
 *     the save file are never transmitted.
 *
 * SECURITY NOTE -- read this before trusting the section above
 * ------------------------------------------------------------
 * The tags are HMAC-SHA256 under a key derived from the sender's device id, and the
 * device id is broadcast in the clear. So the key is not a secret, and the tag does
 * NOT authenticate the peer: an attacker can compute the same key from the id they
 * claim, produce a perfectly valid tag over their own (or somebody else's) identity,
 * and impersonate anybody to us. Two properties people expect from a handshake with
 * HMAC in it are therefore absent, and are called out plainly:
 *
 *   * It does not prove the peer is a particular device, and it is not
 *     man-in-the-middle resistant. An attacker who relays frames between two badges
 *     can sit in the middle of the session and alter untagged payloads.
 *   * It does not give confidentiality. Everything sent, tagged or not, is readable
 *     by anyone listening on 2.4 GHz.
 *
 * What the tags genuinely buy is replay defence and consistency within a session, which
 * is the honest description of the guarantee.
 *
 * An earlier revision keyed the tags with a random per-device secret drawn on first
 * boot. That looked stronger and was worse: each side then signed with one key and
 * verified with a different one, so every tagged frame was rejected on real hardware.
 * The failure mode was two badges that saw each other and did nothing -- no error, no
 * log that pointed at the cause. A key both ends can derive is the only kind that works
 * without a key exchange, and pretending otherwise in the code does not make the
 * security real. This is why the harness in tests/host plays a whole meeting out on a
 * PC: that class of defect is invisible to a compiler and needs two devices to show up
 * otherwise.
 *
 * The consent gate is enforced separately and does hold: untagged frames are only
 * accepted once the peer has echoed a nonce we generated, which cannot happen before
 * both owners have agreed.
 *
 * A determined attacker with a radio and the protocol in hand can invent an identity
 * and a key of their own. Real mutual authentication would need a key exchange
 * (ECDH) or an out-of-band secret (a QR code or a printed PIN); that is recorded in
 * docs/ as a phase-two item rather than pretended here.
 *
 * The icebreaker line is computed deterministically from *both* summaries, so both
 * screens independently show the same sentence with no extra round trip.
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"
#include "net_link.h"
#include "net_proto.h"
#include "pet_state.h"

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Proximity stages (net_stage_t), the replay window (net_nonce_ring_t) and the
 * icebreaker all come from net_proto.h, which has no ESP-IDF dependency so that the
 * pure parts of the protocol can be tested on a PC. net_stage_name() and
 * net_icebreaker() are declared there too.
 */

/* -- a recorded meeting ---------------------------------------------------- */

typedef struct {
    char     peer_name[24];
    char     pet_name[PET_NAME_MAX + 1];
    uint8_t  breed;
    uint8_t  stage_t;     /* net_stage_t at the time of the meeting */
    int8_t   rssi;
    uint32_t met_at;      /* unix seconds */
    uint16_t friendship;  /* 0..100, accumulated over repeated meetings */
    uint16_t times_met;
} net_encounter_t;

/*
 * The record of a meeting is addressed by the peer's display name, because a
 * prototype has no stable cross-session peer identity: the device id is derived
 * from the MAC and two boards would agree on it, but a stranger met today and
 * again next week cannot be matched without storing that id in the clear. Using
 * the name is a deliberate, documented simplification, and it is why the dex
 * counts "distinct names met" rather than an exact population.
 */

/* -- the friendship dex ---------------------------------------------------- */

#define NET_DEX_BREEDS PET_BREED_COUNT

typedef struct {
    uint8_t  seen_count[NET_DEX_BREEDS];   /* how many distinct peers of each breed */
    uint8_t  breed_known;                  /* bitmask: breeds the player has met */
    uint8_t  peer_count;                   /* distinct peers met, saturating */
    uint16_t encounter_count;              /* total meetings, saturating */
} net_dex_t;

/* -- protocol state -------------------------------------------------------- */

typedef enum {
    SOC_IDLE = 0,
    SOC_SCANNING,     /* stage 1: 发现 */
    SOC_HELLO_SENT,   /* stage 2: 建立联系, awaiting ACK */
    SOC_ACK_SENT,     /* we accepted, awaiting CONFIRM */
    SOC_CONFIRMED,    /* mutually confirmed, session key live */
    SOC_ICE_BROKEN,   /* summaries exchanged */
} net_social_state_t;

const char *net_social_state_name(net_social_state_t s);

typedef struct net_social net_social_t;

/**
 * @brief Create the social layer.
 *
 * @param game  live game state, used to build our own summary
 *
 * The transport is a module-level singleton reached through the net_link_* calls,
 * so the layer does not take a handle to it: there is exactly one radio, and
 * threading a pointer through would only invite a second, inconsistent owner.
 */
net_social_t *net_social_create(pet_game_t *game);

/**
 * @brief Create the social layer in caller-provided storage.
 *
 * Exists so two instances can coexist in one address space, which is what makes the
 * handshake testable without two boards: two instances, wired to each other through a
 * simulated link, play a real session out on a PC.
 *
 * @param storage        aligned storage of at least NET_SOCIAL_STORAGE_BYTES
 * @param storage_bytes  its size; a shortfall is refused rather than overrun
 */
net_social_t *net_social_create_in(void *storage, size_t storage_bytes, pet_game_t *game);

/**
 * @brief Bytes a caller must reserve for net_social_create_in().
 *
 * 2048 is the measured host size plus headroom: 1944 bytes on this x86-64 build, leaving 104
 * bytes spare. The size that matters is the one on the target, where pointers are 4 bytes
 * rather than 8, so the struct is *smaller* there -- but that is reasoning, not proof, so it
 * is not relied on: a compile-time assertion in net_social.c fails the build if the constant
 * is ever smaller than `sizeof(net_social_t)` for whatever it is being built for, and
 * net_social_create_in() additionally refuses at runtime rather than overrunning.
 */
#define NET_SOCIAL_STORAGE_BYTES 2048

void net_social_destroy(net_social_t *s);

/** @brief Begin discovery. */
void net_social_start(net_social_t *s);

/**
 * @brief Send a HELLO to the nearest peer, asking to meet.
 *
 * Nothing is revealed by this call: the peer only sees an identity and a nonce.
 */
esp_err_t net_social_request_meeting(net_social_t *s);

/** @brief Accept an incoming request, producing the ACK. */
esp_err_t net_social_accept_meeting(net_social_t *s);

/** @brief Decline an incoming request and return to discovery. */
void net_social_decline_meeting(net_social_t *s);

/** @brief Pump the protocol. Call regularly from the UI task. */
void net_social_poll(net_social_t *s);

/**
 * @brief True while a request is waiting for the owner's answer.
 *
 * The owner is asked by the UI, so the UI has to know when the question stopped being
 * relevant. If the requester gives up and disconnects while the prompt is on screen, the
 * peer name it shows is stale, and accepting would send an ACK into a link that no longer
 * exists. The UI should hide the prompt when this turns false.
 */
bool net_social_prompt_pending(const net_social_t *s);

/** @brief Current state, for the UI. */
net_social_state_t net_social_state(const net_social_t *s);
net_stage_t        net_social_stage(const net_social_t *s);

/**
 * @brief Called when a stranger's request arrives.
 *
 * The UI is expected to ask its owner, then call net_social_accept_meeting() or
 * net_social_decline_meeting(). Arguments are valid only for the duration of the
 * callback.
 */
typedef void (*net_social_prompt_cb_t)(const net_encounter_t *who, void *user);
void net_social_set_prompt_cb(net_social_t *s, net_social_prompt_cb_t cb, void *user);

/** @brief Called once a meeting is confirmed and the icebreaker is chosen. */
typedef void (*net_social_met_cb_t)(const net_encounter_t *who, const char *icebreaker, void *user);
void net_social_set_met_cb(net_social_t *s, net_social_met_cb_t cb, void *user);

/**
 * @brief Copy the friendship dex, for the collection screen.
 *
 * Returns a snapshot rather than a pointer: the dex is updated on the NimBLE host task
 * as meetings arrive, so a pointer would let the caller read a struct mid-update.
 */
void net_social_dex_copy(const net_social_t *s, net_dex_t *out);

/** @brief How many encounters are cached locally. */
int net_social_encounter_count(const net_social_t *s);
bool net_social_get_encounter(const net_social_t *s, int index, net_encounter_t *out);

/* net_icebreaker() is declared in net_proto.h, next to the table it draws from. */

#ifdef __cplusplus
}
#endif
