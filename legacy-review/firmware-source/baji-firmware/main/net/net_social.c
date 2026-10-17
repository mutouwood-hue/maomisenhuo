/*
 * net_social - the near-field social protocol.
 *
 * See net_social.h for the wire format and, importantly, for what this handshake
 * does and does not guarantee. The short version: consent is explicit on both
 * sides, replays are rejected, and only a few public fields ever leave the device.
 *
 * This module never touches a radio, which is what lets the same code be exercised
 * on a PC against a loopback transport.
 */

#include "net_social.h"
#include "net_proto.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_log.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "nvs.h"

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "mbedtls/md.h"

static const char *TAG = "net_social";

/* ------------------------------------------------------------------ */
/* framing                                                            */
/* ------------------------------------------------------------------ */

typedef enum {
    MSG_HELLO = 0x01,
    MSG_ACK = 0x02,
    MSG_CONFIRM = 0x03,
    MSG_SUMMARY = 0x04,
    MSG_ICE = 0x05,
    MSG_BYE = 0x06,
} msg_type_t;

#define TYPE_LEN    1
#define LEN_LEN     1
#define FRAME_HDR   (TYPE_LEN + LEN_LEN)
#define TAG_LEN     8
#define ID_LEN      8
#define NONCE_LEN   4

/* ------------------------------------------------------------------ */
/* proximity thresholds                                               */
/* ------------------------------------------------------------------ */

/*
 * The thresholds, the hysteresis and the stage mapping live in net_proto.c so they can
 * be tested against a sweep of noisy readings without a radio. See net_proto.h for why
 * RSSI is never translated into a distance.
 */

/* ------------------------------------------------------------------ */
/* persistence                                                        */
/* ------------------------------------------------------------------ */

#define MAX_ENCOUNTERS 32
#define NET_NVS_NS     "catsoc"
#define NET_NVS_DEX    "dex"
#define NET_NVS_LOG    "log"

/* ------------------------------------------------------------------ */
/* state                                                              */
/* ------------------------------------------------------------------ */

struct net_social {
    pet_game_t *game;  /* borrowed */

    uint32_t our_nonce;
    uint32_t peer_nonce;
    uint8_t  peer_id_bytes[8];
    bool     peer_known;

    /* Replay defence: nonces accepted during this session. A replayed frame
     * carries a nonce already in this ring and is dropped. The window logic is in
     * net_proto.c, where the ring's behaviour is tested directly. */
    net_nonce_ring_t nonces;

    net_social_state_t state;
    net_stage_t        stage;
    int8_t             stage_rssi;  /* signal behind `stage`, for the records */

    net_encounter_t pending;
    bool            has_pending;

    net_encounter_t active;
    bool            has_active;
    char            icebreaker[128];

    net_dex_t       dex;
    net_encounter_t log[MAX_ENCOUNTERS];
    int             log_count;
    bool            records_dirty;  /* set on the NimBLE task, written on the app task */

    /*
     * Guards `dex`, `log`, `log_count` and `records_dirty`, which are the only fields
     * written from both tasks: the NimBLE host task appends a meeting in
     * record_encounter(), the app task reads them in flush_records() and in the
     * encounter/dex accessors.
     *
     * `records_dirty` alone is not enough. The flag says "something changed", not
     * "the array is in a consistent state", so the flush could still copy the log while
     * record_encounter() was halfway through a memmove of 31 entries and a write to the
     * last one, and persist a row that was never a real meeting. Snapshotting under
     * this lock, and appending under it, removes the interleaving entirely.
     */
    SemaphoreHandle_t log_lock;

    net_social_prompt_cb_t prompt_cb;
    void                  *prompt_user;
    net_social_met_cb_t    met_cb;
    void                  *met_user;

    uint32_t last_poll_ms;
    uint32_t last_request_ms;   /* rate-limits proximity-triggered HELLOs */
    uint32_t session_ends_at_ms; /* when to tear the link down after a meeting */
    bool     helloSent;
    bool     summarySent;

    /*
     * A HELLO that is ready but which the transport could not carry yet.
     *
     * As the central we send the HELLO from the link-state callback, but our GATT
     * discovery of the peer is started in that same callback and has not finished, so
     * our peer's characteristic handle is still unknown and net_link_send() refuses with
     * ESP_ERR_INVALID_STATE. Without this the badge marked the HELLO as sent, sat out the
     * full 15 s deadline waiting for an answer to a frame that never left, and the meeting
     * could only happen if the other badge happened to initiate instead.
     *
     * So the frame is held here and retried from the poll path once the handle is known.
     */
    uint8_t  hello_payload[ID_LEN + NONCE_LEN + TAG_LEN];
    bool     helloPending;
};

/* ------------------------------------------------------------------ */
/* small helpers                                                      */
/* ------------------------------------------------------------------ */

/*
 * Wrapper so the call sites below read as before. The UTF-8-safe truncation itself
 * lives in net_proto.c, where it is tested against strings cut mid-character.
 */
static void copy_utf8_truncated(char *dst, size_t dst_size, const char *src, size_t src_len)
{
    net_copy_utf8_truncated(dst, dst_size, src, src_len);
}

const char *net_social_state_name(net_social_state_t s)
{
    switch (s) {
        case SOC_SCANNING:   return "搜索中";
        case SOC_HELLO_SENT: return "已发送问候";
        case SOC_ACK_SENT:   return "等待确认";
        case SOC_CONFIRMED:  return "已建立联系";
        case SOC_ICE_BROKEN: return "已互动";
        default:             return "空闲";
    }
}

/*
 * Nonce bookkeeping, framing, proximity and the icebreaker all live in net_proto.c,
 * which has no ESP-IDF dependency and is therefore covered by tests/host/test_net_proto.c.
 * These thin wrappers keep the call sites below readable.
 *
 * net_stage_name(), net_icebreaker() and net_copy_utf8_truncated() are implemented
 * there; this file only calls them.
 */
static bool nonce_seen(const net_social_t *s, uint32_t n)
{
    return net_nonce_seen(&s->nonces, n);
}

static void remember_nonce(net_social_t *s, uint32_t n)
{
    net_nonce_remember(&s->nonces, n);
}

/*
 * HMAC-SHA256 truncated to the tag length, under the DEVICE secret.
 *
 * The secret is derived deterministically from the device id rather than drawn at random.
 * That is the difference between a protocol that works and one that cannot:
 *
 *   With a random per-device secret, A signs its HELLO with A's secret and B verifies it
 *   with B's -- which is a different value. Every tagged frame is rejected, the responder
 *   never prompts its owner, and the entire social layer is dead on arrival on real
 *   hardware. Nothing in the code said so, and the only way to find out was to hold two
 *   boards next to each other, where the symptom is "nothing happens".
 *
 *   Deriving the key from the device id makes both ends compute the same value. It is NOT a
 *   secret in any meaningful sense -- the device id is broadcast in the clear -- so the tag
 *   is an integrity and consistency check, not authentication. That is what the SECURITY
 *   NOTE in net_social.h now says, and it is the honest description: without a key exchange
 *   there is no authentication to be had, so the protocol does not pretend to have one.
 *
 * Real mutual authentication needs ECDH or an out-of-band secret, both of which are phase
 * two. Until then this tag still does useful work: it binds a frame to a specific nonce, so
 * a frame replayed under a different nonce does not verify, and it catches a truncated or
 * corrupted frame before it is parsed.
 */
static void derive_key(const uint8_t device_id[8], uint8_t out[32])
{
    static const char domain[] = "orangecat-social-v1";
    uint8_t material[sizeof(domain) - 1 + 8];
    memcpy(material, domain, sizeof(domain) - 1);
    memcpy(material + sizeof(domain) - 1, device_id, 8);

    /* SHA-256 of the domain separator and the id: no key material to leak, and stable
     * across reboots, which is what matters for both ends agreeing. */
    mbedtls_md_context_t ctx;
    const mbedtls_md_info_t *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    mbedtls_md_init(&ctx);
    if (info == NULL || mbedtls_md_setup(&ctx, info, 0) != 0) {
        memset(out, 0, 32);
        mbedtls_md_free(&ctx);
        return;
    }
    mbedtls_md_starts(&ctx);
    mbedtls_md_update(&ctx, material, sizeof(material));
    mbedtls_md_finish(&ctx, out);
    mbedtls_md_free(&ctx);
}

static void hmac_tag(const uint8_t *secret, size_t secret_len,
                     const uint8_t *data, size_t data_len, uint8_t out[TAG_LEN])
{
    uint8_t full[32];
    const mbedtls_md_info_t *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    mbedtls_md_context_t ctx;

    mbedtls_md_init(&ctx);
    if (info == NULL || mbedtls_md_setup(&ctx, info, 1) != 0) {
        memset(out, 0, TAG_LEN);
        mbedtls_md_free(&ctx);
        return;
    }
    mbedtls_md_hmac_starts(&ctx, secret, secret_len);
    mbedtls_md_hmac_update(&ctx, data, data_len);
    mbedtls_md_hmac_finish(&ctx, full);
    mbedtls_md_free(&ctx);
    memcpy(out, full, TAG_LEN);
}

/*
 * Constant-time comparison, so the tag check cannot be used as an oracle.
 *
 * Declared before verify_tag() because that is where it is used; the definition follows the
 * helpers that compute the expected tag.
 */
static bool tag_equal(const uint8_t *a, const uint8_t *b);

/*
 * Verify a tag computed by `signer_id` over `data`.
 *
 * The key is derived from the SIGNER's id, not ours, which is the whole point: we must
 * recompute what the sender used. Deriving from our own id is exactly the defect described
 * above, and this signature makes it hard to reintroduce by accident.
 */
static bool verify_tag(const uint8_t signer_id[8], const uint8_t *data, size_t data_len,
                       const uint8_t *tag)
{
    uint8_t key[32];
    uint8_t expect[TAG_LEN];
    derive_key(signer_id, key);
    hmac_tag(key, sizeof(key), data, data_len, expect);
    return tag_equal(expect, tag);
}

static bool tag_equal(const uint8_t *a, const uint8_t *b)
{
    uint8_t diff = 0;
    for (int i = 0; i < TAG_LEN; i++) diff |= (uint8_t)(a[i] ^ b[i]);
    return diff == 0;
}

static void put32(uint8_t *p, uint32_t v)
{
    p[0] = (uint8_t)(v & 0xFF);
    p[1] = (uint8_t)((v >> 8) & 0xFF);
    p[2] = (uint8_t)((v >> 16) & 0xFF);
    p[3] = (uint8_t)((v >> 24) & 0xFF);
}

static uint32_t get32(const uint8_t *p)
{
    return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}

static uint32_t now_seconds(void)
{
    return (uint32_t)(esp_timer_get_time() / 1000000);
}

/* ------------------------------------------------------------------ */
/* frame handling                                                     */

/* ------------------------------------------------------------------ */
/* dex and encounter log                                              */
/* ------------------------------------------------------------------ */

static void load_records(net_social_t *s)
{
    nvs_handle_t h;
    if (nvs_open(NET_NVS_NS, NVS_READONLY, &h) != ESP_OK) return;

    size_t len = sizeof(s->dex);
    if (nvs_get_blob(h, NET_NVS_DEX, &s->dex, &len) != ESP_OK) {
        memset(&s->dex, 0, sizeof(s->dex));
    }

    /*
     * Read into a temporary and validate before touching s->log. The length is read
     * back from NVS and is not inherently trustworthy: a blob written by an older or
     * newer firmware, or a partly written one, can be longer than the buffer, and
     * nvs_get_blob() checks the size only *after* copying. Asking for the length
     * first and rejecting anything too big keeps a bad blob from overrunning the
     * array; the old code passed sizeof(s->log) and then computed log_count from
     * whatever length came back.
     */
    len = 0;
    if (nvs_get_blob(h, NET_NVS_LOG, NULL, &len) == ESP_OK && len > 0) {
        if (len > sizeof(s->log) || len % sizeof(net_encounter_t) != 0) {
            ESP_LOGW(TAG, "encounter log blob is %u bytes; expected a multiple of %u "
                          "below %u. Ignoring it.",
                     (unsigned)len, (unsigned)sizeof(net_encounter_t),
                     (unsigned)sizeof(s->log));
        } else {
            size_t read = len;
            if (nvs_get_blob(h, NET_NVS_LOG, s->log, &read) == ESP_OK) {
                s->log_count = (int)(read / sizeof(net_encounter_t));
            }
        }
    }
    nvs_close(h);
}

static void save_records(const net_dex_t *dex, const net_encounter_t *log, int log_count)
{
    nvs_handle_t h;
    if (nvs_open(NET_NVS_NS, NVS_READWRITE, &h) != ESP_OK) return;
    const esp_err_t derr = nvs_set_blob(h, NET_NVS_DEX, dex, sizeof(*dex));
    const esp_err_t lerr = nvs_set_blob(h, NET_NVS_LOG, log,
                                        (size_t)log_count * sizeof(net_encounter_t));
    const esp_err_t cerr = nvs_commit(h);
    if (derr != ESP_OK || lerr != ESP_OK || cerr != ESP_OK) {
        /*
         * Say so rather than assuming it worked. This is the only place a meeting becomes
         * durable, and a silent failure here looks exactly like success until the badge
         * reboots and the dex is empty.
         */
        ESP_LOGW(TAG, "could not store the encounter log (dex=%s log=%s commit=%s)",
                 esp_err_to_name(derr), esp_err_to_name(lerr), esp_err_to_name(cerr));
    }
    nvs_close(h);
}

static void record_encounter(net_social_t *s, const net_encounter_t *e)
{
    /*
     * Runs on the NimBLE host task. The lock is taken for the whole update so the dex
     * and the log move as one consistent set, and it is released before returning to the
     * radio. NVS is not touched here -- see flush_records() for why.
     */
    if (s->log_lock) (void)xSemaphoreTake(s->log_lock, portMAX_DELAY);

    /* A repeat visitor is recognised by name and their friendship grows. */
    for (int i = 0; i < s->log_count; i++) {
        if (strncmp(s->log[i].peer_name, e->peer_name, sizeof(s->log[i].peer_name)) == 0) {
            net_encounter_t *prev = &s->log[i];
            if (prev->times_met < 0xFFFF) prev->times_met++;
            prev->rssi = e->rssi;
            prev->stage_t = e->stage_t;
            prev->met_at = e->met_at;
            snprintf(prev->pet_name, sizeof(prev->pet_name), "%s", e->pet_name);
            uint32_t f = prev->friendship + 6;
            if (f > 100) f = 100;
            prev->friendship = (uint16_t)f;
            s->records_dirty = true;
            if (s->log_lock) (void)xSemaphoreGive(s->log_lock);
            return;
        }
    }

    if (s->log_count < MAX_ENCOUNTERS) {
        s->log[s->log_count++] = *e;
    } else {
        memmove(&s->log[0], &s->log[1], sizeof(net_encounter_t) * (MAX_ENCOUNTERS - 1));
        s->log[MAX_ENCOUNTERS - 1] = *e;
    }

    /* The dex only counts a breed the first time it is seen and a peer the first
     * time we meet them, so its totals stay meaningful. */
    if (e->breed < NET_DEX_BREEDS) {
        s->dex.breed_known |= (uint8_t)(1u << e->breed);
        if (s->dex.seen_count[e->breed] < 255) s->dex.seen_count[e->breed]++;
    }
    if (s->dex.peer_count < 255) s->dex.peer_count++;
    if (s->dex.encounter_count < 0xFFFF) s->dex.encounter_count++;
    s->records_dirty = true;

    if (s->log_lock) (void)xSemaphoreGive(s->log_lock);
}

/*
 * Flush a meeting to NVS, from the app task.
 *
 * record_encounter() runs on the NimBLE host task, because it is reached from the
 * receive callback. Writing NVS there would block that task for tens of milliseconds
 * while flash is erased and programmed -- long enough for the controller to exhaust
 * its buffers and drop the connection carrying the very session being recorded --
 * and it would do so from inside a receive callback.
 *
 * So the receive path only updates the in-memory copy and sets a flag; this flush runs
 * from net_social_poll() on the app task. A meeting is lost only if the badge dies in
 * the window between the two, which is an acceptable trade for not stalling the radio.
 */
static void flush_records(net_social_t *s)
{
    if (!s->records_dirty) return;

    /* Heap, not stack: the snapshot is about 4 KB, and the app task's stack also has
     * the LVGL draw path on it. */
    net_encounter_t *snapshot = malloc(sizeof(s->log));
    if (!snapshot) {
        ESP_LOGW(TAG, "no room for the encounter snapshot; retrying on the next poll");
        return;
    }
    net_dex_t dex_snapshot;

    /*
     * Snapshot the record set under the lock so the copy cannot interleave with an
     * append on the NimBLE task. An earlier version of this function asserted that a
     * plain memcpy was safe because the callback "only ever appends or rewrites in
     * place" -- that is exactly what makes it unsafe: the memcpy can run while 31 of the
     * 32 rows are being shifted and the last one has not been written yet, persisting a
     * row that was never a meeting. The flag alone cannot express "the array is
     * consistent"; only the lock can.
     *
     * The lock is held for a few microseconds of memcpy and never across the NVS write
     * below, which is the part that would stall the radio. A meeting that lands after
     * the lock is released sets the flag again and is picked up by the next poll.
     */
    if (s->log_lock) (void)xSemaphoreTake(s->log_lock, portMAX_DELAY);
    /* Re-check under the lock: a meeting may have arrived between the early return
     * above and taking it, and that meeting must not be missed. */
    const bool dirty = s->records_dirty;
    memcpy(snapshot, s->log, sizeof(s->log));
    const int count = s->log_count;
    dex_snapshot = s->dex;
    s->records_dirty = false;
    if (s->log_lock) (void)xSemaphoreGive(s->log_lock);

    if (!dirty) {
        /* Nothing changed after all; the snapshot was pure cost. */
        free(snapshot);
        return;
    }

    save_records(&dex_snapshot, snapshot, count);
    free(snapshot);
}

/* ------------------------------------------------------------------ */
/* proximity stage                                                    */
/* ------------------------------------------------------------------ */

static void update_stage(net_social_t *s)
{
    int best = -127;
    const int n = net_link_peer_count();
    for (int i = 0; i < n; i++) {
        net_peer_t p;
        if (net_link_get_peer(i, &p) && p.rssi_avg > best) best = p.rssi_avg;
    }
    s->stage_rssi = (int8_t)best;

    /* Thresholds and hysteresis are in net_proto.c; see net_proto.h for why the
     * previous stage is an input. */
    s->stage = net_stage_for_rssi(best, s->stage);
}

/* ------------------------------------------------------------------ */
/* icebreaker                                                         */
/* ------------------------------------------------------------------ */

/* net_icebreaker() lives in net_proto.c, where its symmetry is covered by tests. */

/* ------------------------------------------------------------------ */
/* frame senders                                                      */
/* ------------------------------------------------------------------ */

/*
 * Framing is delegated to net_proto.c, which enforces the same rules plus the
 * relationship between the declared length and the actual byte count in both
 * directions. Keeping one implementation means the parser tested on the host is the
 * parser that runs here.
 */
static size_t frame_build(uint8_t *out, size_t cap, msg_type_t type,
                          const uint8_t *payload, size_t len)
{
    if (len > NET_FRAME_MAX - FRAME_HDR) return 0;
    if (len > 255) return 0;
    return net_proto_build(out, cap, (uint8_t)type, payload, len);
}

static esp_err_t send_frame(net_social_t *s, msg_type_t type, const uint8_t *payload, size_t len)
{
    (void)s;
    uint8_t frame[NET_FRAME_MAX];
    const size_t n = frame_build(frame, sizeof(frame), type, payload, len);
    if (n == 0) {
        ESP_LOGW(TAG, "frame too large (type %d, %u bytes)", (int)type, (unsigned)len);
        return ESP_ERR_INVALID_SIZE;
    }
    const esp_err_t err = net_link_send(frame, n);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "send type %d failed: %s", (int)type, esp_err_to_name(err));
    }
    return err;
}

static void send_hello(net_social_t *s)
{
    /* Sized from the literal so every byte hashed is a byte that was written. */
    uint8_t mac_input[ID_LEN + NONCE_LEN + sizeof("HELLO")];
    uint8_t payload[ID_LEN + NONCE_LEN + TAG_LEN];
    uint8_t key[32];
    const uint8_t *id = net_link_device_id();

    /*
     * The nonce must not be zero: on_link_state() uses `our_nonce != 0` as "this
     * connection came from our own connect request", so a zero draw would leave a
     * legitimately initiated session never sending its HELLO. The same value is
     * also used as "no session" when a link drops.
     */
    if (s->our_nonce == 0) s->our_nonce = esp_random();
    if (s->our_nonce == 0) s->our_nonce = 0xA5A5A5A5u;

    memcpy(payload, id, ID_LEN);
    put32(payload + ID_LEN, s->our_nonce);

    memcpy(mac_input, id, ID_LEN);
    put32(mac_input + ID_LEN, s->our_nonce);
    memcpy(mac_input + ID_LEN + NONCE_LEN, "HELLO", sizeof("HELLO"));

    /* Keyed by our own id, because the receiver recomputes it from the id we claim. */
    derive_key(id, key);
    hmac_tag(key, sizeof(key), mac_input, sizeof(mac_input), payload + ID_LEN + NONCE_LEN);

    memcpy(s->hello_payload, payload, sizeof(payload));

    if (send_frame(s, MSG_HELLO, payload, sizeof(payload)) != ESP_OK) {
        /*
         * The transport refused it, so it was never transmitted. Do NOT mark it sent: as
         * the central this refusal is the normal case, because our GATT discovery of the
         * peer is still running when this runs (see the helloPending comment). Remember
         * the frame and let the poll path deliver it once the peer's handle is known;
         * marking it sent here is what turned "slightly early" into "the meeting never
         * happens".
         */
        ESP_LOGI(TAG, "HELLO not deliverable yet; will retry once the peer is ready");
        s->helloPending = true;
        return;
    }

    s->helloPending = false;
    s->helloSent = true;
}

/*
 * Deliver a HELLO that send_hello() could not. Returns true when there is nothing left
 * pending, so a caller can tell "delivered" from "still waiting".
 */
static bool deliver_hello(net_social_t *s)
{
    if (!s->helloPending) return true;
    if (send_frame(s, MSG_HELLO, s->hello_payload, sizeof(s->hello_payload)) != ESP_OK) {
        return false;   /* still not possible; the session deadline bounds the wait */
    }
    s->helloPending = false;
    s->helloSent = true;
    ESP_LOGI(TAG, "HELLO delivered late, once the peer's characteristic was known");
    return true;
}

static void send_summary(net_social_t *s)
{
    const pet_cat_t *c = pet_active_cat_const(s->game);
    if (!c) return;

    uint8_t p[3 + PET_NAME_MAX + 1];
    size_t n = 0;
    p[n++] = c->breed;
    p[n++] = (uint8_t)pet_stage(c->xp);
    p[n++] = pet_friendliness(c);

    /*
     * Truncate to PET_NAME_MAX the same way the receiver will, and never past the
     * frame. The name is ours, but the action that sets it validates 2..12 characters
     * and the model is the only thing standing between a long name and a frame that
     * overruns `p`; a size check here is cheaper than trusting that chain.
     */
    const size_t name_len = strnlen(c->name, PET_NAME_MAX);
    const size_t room = sizeof(p) - 3 - 1; /* payload, minus the NUL */
    const size_t take = name_len < room ? name_len : room;
    memcpy(&p[n], c->name, take);
    n += take;
    p[n++] = 0;

    send_frame(s, MSG_SUMMARY, p, n);
    s->summarySent = true;
}

static void send_bye(net_social_t *s)
{
    send_frame(s, MSG_BYE, NULL, 0);
}

/* ------------------------------------------------------------------ */
/* frame handling                                                     */
/* ------------------------------------------------------------------ */

/*
 * True when our own nonce has been seen, i.e. the peer demonstrably received it.
 * Only the peer can echo a value that was never transmitted, so this is what gates
 * acting on a frame that carries no tag of its own.
 */
static bool peer_echoed_our_nonce(const net_social_t *s)
{
    return s->our_nonce != 0 && nonce_seen(s, s->our_nonce);
}

static void handle_hello(net_social_t *s, const uint8_t *p, size_t len)
{
    if (len != ID_LEN + NONCE_LEN + TAG_LEN) return;

    /*
     * Do not let a stranger reset a session that is already in progress, and do not
     * prompt the owner again while a prompt is already on screen.
     *
     * This is a consent gate, not a tidiness rule. `net_social_accept_meeting`
     * answers whatever is in `s->pending`, so a peer that kept sending HELLOs while
     * the owner was deciding could swap `pending.peer_nonce` out from under the
     * prompt: the owner would press "认识一下" for the request they were shown, and
     * the ACK would go to the newest nonce instead. The same reset would also wipe
     * `helloSent`, which the link-state callback keys off to send our own HELLO --
     * so a pair of peers could also be pushed into HELLOing each other again.
     *
     * Dropping the frame is enough; there is nothing useful a second HELLO can add
     * to a session that already exists. The peer retries on its own schedule and
     * will be answered once this session finishes.
     *
     * The test deliberately does NOT include `net_link_connected()`, which it used to.
     * A HELLO is only ever sent once the link is already up -- on_link_state() sends it
     * from the CONNECT event, and net_social_request_meeting()'s "already connected"
     * branch sends it after connecting. So every device that can receive a HELLO is
     * connected by construction, and testing for it dropped 100% of incoming HELLOs:
     * the responder never prompted its owner, never sent an ACK, and the initiator's
     * session deadline expired and retried forever. The states tested here already cover
     * the in-progress cases the connected check was meant to cover.
     */
    if (s->has_pending || s->has_active || s->helloSent ||
        s->state == SOC_HELLO_SENT || s->state == SOC_ACK_SENT ||
        s->state == SOC_CONFIRMED || s->state == SOC_ICE_BROKEN) {
        ESP_LOGD(TAG, "HELLO ignored: a session is already in progress");
        return;
    }

    const uint32_t nonce = get32(p + ID_LEN);
    if (nonce_seen(s, nonce)) {
        ESP_LOGW(TAG, "replayed HELLO ignored");
        return;
    }

    /* Verify the tag before trusting the claimed identity at all.
     *
     * The key is derived from the id the frame CLAIMS, because that is what the sender used.
     * The tag therefore proves the frame was built by someone who computed a key from that
     * id -- which anyone can do, since the id is broadcast. It is a consistency check, not
     * authentication; see the SECURITY NOTE in net_social.h. What it does catch is a frame
     * whose id, nonce and tag were not produced together by this protocol. */
    uint8_t mac_input[ID_LEN + NONCE_LEN + sizeof("HELLO")];
    memcpy(mac_input, p, ID_LEN);
    put32(mac_input + ID_LEN, nonce);
    memcpy(mac_input + ID_LEN + NONCE_LEN, "HELLO", sizeof("HELLO"));
    if (!verify_tag(p, mac_input, sizeof(mac_input), p + ID_LEN + NONCE_LEN)) {
        ESP_LOGW(TAG, "HELLO tag mismatch, dropping");
        return;
    }

    memcpy(s->peer_id_bytes, p, ID_LEN);
    s->peer_nonce = nonce;
    s->peer_known = true;

    /*
     * Ask the owner before revealing anything. The peer is identified by a short
     * form of their device id here; it is replaced by their pet's name once the
     * summary arrives, so the prompt is never anonymous for long.
     */
    net_encounter_t who = {0};
    snprintf(who.peer_name, sizeof(who.peer_name), "%02X%02X%02X%02X",
             p[0], p[1], p[2], p[3]);
    /* rssi carries dBm and stage_t carries the proximity stage: filling rssi with
     * the stage enum put a 0..3 in a field the UI prints as a signal level. */
    who.rssi = s->stage_rssi;
    who.stage_t = (uint8_t)s->stage;
    who.met_at = now_seconds();

    s->pending = who;
    s->has_pending = true;
    s->state = SOC_SCANNING;

    if (s->prompt_cb) s->prompt_cb(&s->pending, s->prompt_user);
}

static void handle_ack(net_social_t *s, const uint8_t *p, size_t len)
{
    if (len != ID_LEN + NONCE_LEN + NONCE_LEN + TAG_LEN) return;

    const uint32_t their_nonce = get32(p + ID_LEN);
    const uint32_t echoed = get32(p + ID_LEN + NONCE_LEN);

    /* Our own nonce must come back, or this ACK belongs to a different meeting. */
    if (echoed != s->our_nonce) {
        ESP_LOGW(TAG, "ACK does not reference our nonce");
        return;
    }
    if (nonce_seen(s, their_nonce)) {
        ESP_LOGW(TAG, "replayed ACK ignored");
        return;
    }

    /* Keyed by the signer's claimed id, matching what send_ack() used. */
    /*
     * The buffer size is derived from the label literal rather than written out, and the
     * whole buffer is hashed.
     *
     * This is not style. An earlier version declared this as ID_LEN + NONCE_LEN*2 + 6 and
     * wrote only 20 of those 22 bytes, then hashed sizeof(mac_input) -- so both ends fed two
     * bytes of uninitialised stack into the HMAC, produced different tags, and rejected each
     * other's ACK. The handshake could never complete, and the only symptom on hardware was
     * two badges that saw each other and did nothing. Sizing from the literal makes the
     * written and the hashed length the same number by construction.
     */
    uint8_t mac_input[ID_LEN + NONCE_LEN + NONCE_LEN + sizeof("ACK")];
    memcpy(mac_input, p, ID_LEN);
    put32(mac_input + ID_LEN, their_nonce);
    put32(mac_input + ID_LEN + NONCE_LEN, s->our_nonce);
    memcpy(mac_input + ID_LEN + NONCE_LEN * 2, "ACK", sizeof("ACK"));
    if (!verify_tag(p, mac_input, sizeof(mac_input), p + ID_LEN + NONCE_LEN * 2)) {
        ESP_LOGW(TAG, "ACK tag mismatch, dropping");
        return;
    }

    memcpy(s->peer_id_bytes, p, ID_LEN);
    s->peer_nonce = their_nonce;
    s->peer_known = true;

    remember_nonce(s, their_nonce);
    remember_nonce(s, s->our_nonce);

    s->state = SOC_CONFIRMED;

    /*
     * Close the loop: our confirmation lets the responder know we accepted too.
     *
     * The result is checked rather than ignored. If this CONFIRM never leaves -- the same
     * discovery race that can refuse the HELLO also applies here, and this runs on the
     * receive path where the peer's handle is set but our own notify subscription may not be
     * -- the responder never learns our nonce, so it drops our SUMMARY, never sends its own,
     * and the meeting dies on its deadline with no visible cause. Bailing out leaves the
     * session to the deadline instead of advancing to SUMMARY/ICE on a conversation that
     * cannot complete.
     */
    uint8_t confirm[NONCE_LEN];
    put32(confirm, their_nonce);
    if (send_frame(s, MSG_CONFIRM, confirm, sizeof(confirm)) != ESP_OK) {
        ESP_LOGW(TAG, "could not send the CONFIRM; waiting for the session deadline");
        return;
    }

    send_summary(s);
}

static void handle_confirm(net_social_t *s, const uint8_t *p, size_t len)
{
    if (len != NONCE_LEN) return;

    /*
     * The CONFIRM frame carries no tag, so the nonce inside it is the only evidence it
     * carries at all. Two things have to be true for it to mean anything:
     *
     *   1. `our_nonce` is set. It is zero until a session starts -- we generate it when
     *      we initiate, and the responder generates it while handling a HELLO -- so
     *      without this a peer could send CONFIRM(0), have it compare equal, and make the
     *      responder run send_summary(): disclosing the pet's name, breed and stage to
     *      somebody who never asked and was never accepted.
     *   2. The value matches. Only a peer that actually received a frame from us can
     *      echo a nonce we generated, so the echo is the proof of receipt, and it is
     *      this match -- not a prior ring entry -- that admits the session.
     *
     * Recording it here is REQUIRED, not bookkeeping. The gated frames that follow
     * (SUMMARY, ICE) are admitted by peer_echoed_our_nonce(), which looks for our nonce
     * in the ring. On the initiator the ring gets it in handle_ack, because the ACK
     * echoes it. On the responder nothing else ever records it: net_social_accept_meeting
     * only records the peer's nonce, and CONFIRM is the first frame that echoes ours.
     * Without this line the responder drops the CONFIRM, the SUMMARY and the ICE of every
     * session -- it never sends its own summary, never breaks the ice, never records the
     * meeting -- and both badges sit until the 15 s deadline expires. Verified by the
     * reviewer and reproduced from the call graph; there is no host test that could have
     * caught it, because the handshake needs a peer.
     */
    if (s->our_nonce == 0) {
        ESP_LOGD(TAG, "CONFIRM before any session exists; dropping");
        return;
    }
    if (get32(p) != s->our_nonce) return;

    remember_nonce(s, s->our_nonce);

    s->state = SOC_CONFIRMED;
    if (!s->summarySent) send_summary(s);
}

static void handle_summary(net_social_t *s, const uint8_t *p, size_t len)
{
    /* [breed][stage][friendliness][name, UTF-8, NUL] */
    if (len < 4) return;

    /*
     * Personal data arrives untagged, so it is only accepted inside a session the
     * owner accepted. This check must come first: without it a peer could disclose
     * nothing at all and still push somebody else's pet into our dex and encounter
     * log by forging a SUMMARY. SUMMARY is only ever sent after CONFIRM, which is
     * itself gated on the peer echoing our nonce.
     */
    if (!peer_echoed_our_nonce(s)) {
        ESP_LOGD(TAG, "SUMMARY outside an established session; dropping");
        return;
    }

    const uint8_t peer_breed = p[0];
    const pet_stage_t peer_stage = (pet_stage_t)p[1];
    const uint8_t peer_friendliness = p[2];

    if (peer_breed >= PET_BREED_COUNT) return;
    if (peer_stage > PET_STAGE_ADULT) return;

    const char *pet_name = (const char *)(p + 3);
    const size_t avail = len - 3;
    if (strnlen(pet_name, avail) >= avail) return; /* no terminator in the frame */

    const pet_cat_t *mine = pet_active_cat_const(s->game);

    net_encounter_t e = {0};
    e.breed = peer_breed;
    e.stage_t = (uint8_t)s->stage;  /* the proximity stage, for the UI */
    e.rssi = s->stage_rssi;         /* dBm, not the stage enum */
    e.met_at = now_seconds();
    e.times_met = 1;
    copy_utf8_truncated(e.pet_name, sizeof(e.pet_name), pet_name, avail);

    if (s->has_pending && s->pending.peer_name[0]) {
        snprintf(e.peer_name, sizeof(e.peer_name), "%s", s->pending.peer_name);
    } else {
        snprintf(e.peer_name, sizeof(e.peer_name), "%02X%02X%02X%02X",
                 s->peer_id_bytes[0], s->peer_id_bytes[1],
                 s->peer_id_bytes[2], s->peer_id_bytes[3]);
    }

    s->active = e;
    s->has_active = true;

    /*
     * The line depends on both pets, so the peer arrives at the same sentence
     * independently and the meeting reads as shared rather than one-sided.
     */
    net_icebreaker(mine, peer_breed, (uint8_t)peer_stage, s->icebreaker, sizeof(s->icebreaker));
    s->state = SOC_ICE_BROKEN;

    /* Publish our own line so both screens agree rather than merely agreeing by
     * construction.
     *
     * The version rule drops rather than truncates: cutting a multi-byte character in
     * half would send invalid UTF-8, and the peer's screen would render it as garbage.
     * Every line in the icebreaker table fits well inside the budget, so this only fires if a
     * phase-two icebreaker grows past it -- in which case silently losing the sentence
     * is better than showing a broken one on the other badge. */
    const size_t ice_len = strlen(s->icebreaker);
    if (ice_len >= NET_FRAME_MAX - FRAME_HDR) {
        ESP_LOGW(TAG, "icebreaker is %u bytes and does not fit a frame; not sent",
                 (unsigned)ice_len);
    } else {
        /*
         * Sent WITH the terminating NUL, which the frame's declared length covers.
         *
         * This used to send `ice_len` bytes while handle_ice() required the last byte to be
         * NUL -- so the two halves disagreed and the frame was dropped every single time.
         * It was invisible because net_icebreaker() is a pure function of the pair, so both
         * sides already show the same sentence and nothing looked wrong; what was actually
         * broken was the ability of the peer's text to replace ours, which is the whole
         * point of the frame and the phase-two hook for an LLM-generated line.
         *
         * The NUL is kept rather than dropped from the receiver's check because it lets the
         * receiver use the payload directly as a C string, with no bounded-copy dance and no
         * way to read past the frame.
         */
        send_frame(s, MSG_ICE, (const uint8_t *)s->icebreaker, ice_len + 1);
    }

    const uint8_t *self_id = net_link_device_id();
    ESP_LOGI(TAG, "[%02X%02X] met %s (breed %u, stage %u, friendliness %u)",
             self_id ? self_id[0] : 0, self_id ? self_id[1] : 0,
             e.pet_name, peer_breed, (unsigned)peer_stage, peer_friendliness);

    record_encounter(s, &e);
    if (s->met_cb) s->met_cb(&s->active, s->icebreaker, s->met_user);

    /* Keep the link up just long enough for the owner to read the card, then let
     * the radio go back to looking for the next stranger. */
    s->session_ends_at_ms = (uint32_t)(esp_timer_get_time() / 1000) + 15000;
}

static void handle_ice(net_social_t *s, const uint8_t *p, size_t len)
{
    if (len == 0 || len >= sizeof(s->icebreaker)) return;
    /* Same gate as SUMMARY: untagged, so only inside an accepted session. */
    if (!peer_echoed_our_nonce(s)) {
        ESP_LOGD(TAG, "ICE outside an established session; dropping");
        return;
    }

    /*
     * Take the peer's line as authoritative, but only notify the caller if it differs from
     * the one we already published.
     *
     * The two sides compute the same sentence by construction -- net_icebreaker() sorts the
     * breed/stage pairs before hashing precisely so they cannot disagree -- so this frame
     * normally carries exactly the text we already showed. Firing the callback again put the
     * meeting card on screen twice for one meeting and made the encounter counter report two
     * meetings where one happened. Comparing first keeps the frame useful (if a phase-two
     * icebreaker ever does depend on something local, the peer's text still replaces ours and
     * the UI still updates) without the duplicate.
     */
    const char *peer_line = (const char *)p;
    if (peer_line[len - 1] != '\0') return;          /* not terminated inside the frame */
    const bool changed = strcmp(s->icebreaker, peer_line) != 0;

    memcpy(s->icebreaker, p, len);
    s->icebreaker[len] = '\0';

    if (changed && s->met_cb && s->has_active) {
        s->met_cb(&s->active, s->icebreaker, s->met_user);
    }
}

/*
 * The one place a session ends.
 *
 * This list previously existed in three copies -- the BYE handler, the link-drop callback
 * and the poll deadline branch -- and they had drifted apart. Only the deadline branch
 * cleared `has_active`. That mattered because of the order the teardown happens in: the side
 * whose deadline fires first clears its own `has_active` and disconnects, and the *other*
 * side learns about it from the link-drop callback -- which cleared everything except
 * `has_active` and zeroed the deadline. With `has_active` stuck true and no deadline left to
 * clear it, that badge neither initiated a meeting (poll requires !has_active) nor accepted
 * one (handle_hello refuses while it is set) for the rest of the boot. Two badges standing
 * together, and exactly one of them permanently unable to say hello.
 *
 * Sharing one function is the fix; keeping three copies in step by hand is what failed.
 */
static void end_session(net_social_t *s)
{
    s->state = SOC_SCANNING;
    s->has_active = false;
    s->has_pending = false;
    s->peer_known = false;
    s->helloSent = false;
    s->summarySent = false;
    s->helloPending = false;
    s->session_ends_at_ms = 0;
    s->our_nonce = 0;
    s->peer_nonce = 0;
    net_nonce_reset(&s->nonces);
}

static void on_frame(const uint8_t *data, size_t len, void *user)
{
    net_social_t *s = (net_social_t *)user;
    if (!s || len < FRAME_HDR) return;

    /*
     * Validate through the same parser the host tests exercise. The declared length
     * comes off the wire, so this must reject a frame whose length runs past the
     * buffer before any handler looks at the payload.
     */
    net_frame_view_t view;
    if (!net_proto_parse(data, len, &view)) return;

    const msg_type_t type = (msg_type_t)view.type;
    const uint8_t plen = (uint8_t)view.len;
    const uint8_t *p = view.payload;

    /*
     * A frame the conversation understands means the peer is alive, so the session
     * deadline is pushed out -- it is the only thing that ends a session the peer
     * abandons, and a healthy exchange must not be cut off after fifteen seconds.
     *
     * This deliberately happens only for known types. The test used to run before the
     * switch, which let a peer hold a session open indefinitely by dribbling frames the
     * switch ignores (any unknown type hits the default branch): the badge stayed out of
     * SOC_SCANNING, stopped discovering anyone else, and showed no reason for it. An
     * unrecognised type is not evidence of a live conversation.
     */
    if (type >= MSG_HELLO && type <= MSG_BYE && s->session_ends_at_ms != 0) {
        s->session_ends_at_ms = (uint32_t)(esp_timer_get_time() / 1000) + 15000;
    }

    switch (type) {
        case MSG_HELLO:   handle_hello(s, p, plen); break;
        case MSG_ACK:     handle_ack(s, p, plen); break;
        case MSG_CONFIRM: handle_confirm(s, p, plen); break;
        case MSG_SUMMARY: handle_summary(s, p, plen); break;
        case MSG_ICE:     handle_ice(s, p, plen); break;
        case MSG_BYE:
            end_session(s);
            net_link_disconnect();
            break;
        default:
            ESP_LOGD(TAG, "unknown frame type %u ignored", (unsigned)view.type);
            break;
    }
}

static void on_link_state(bool connected, const uint8_t device_id[8], void *user)
{
    net_social_t *s = (net_social_t *)user;
    (void)device_id;
    if (!s) return;

    if (!connected) {
        /*
         * A dropped link resets the session but keeps the dex and the log.
         *
         * The deadline is cleared too. Leaving it armed would make poll() report a
         * "session timed out" for a session that no longer exists and return early, which
         * delays the next discovery attempt for no reason -- the link that the deadline
         * was guarding is already gone.
         *
         * This is the path that reaches the side which did NOT lose the deadline race, so
         * it is the one that has to clear every session flag -- `has_active` in particular.
         * See end_session().
         */
        end_session(s);
    } else if (s->our_nonce != 0 && !s->helloSent) {
        /*
         * We initiated: the HELLO goes out as soon as the link is up -- but "up" is not the
         * same as "deliverable". As the central our GATT discovery of the peer is started in
         * this very callback, so the peer's characteristic handle is not known yet and the
         * send is refused (net_link.c returns ESP_ERR_INVALID_STATE). The frame is held by
         * send_hello() and delivered by deliver_hello() from the poll path once discovery
         * has finished.
         *
         * The state advances regardless, and deliberately: SOC_HELLO_SENT correctly describes
         * "a session has begun and we are waiting to hear back", and it is what stops the
         * auto-initiate path from starting a *second* session on top of the pending HELLO and
         * replacing the nonce the peer is about to answer. The session deadline bounds the
         * wait if the frame never becomes deliverable.
         */
        s->state = SOC_HELLO_SENT;
        send_hello(s);
    }
}

/* ------------------------------------------------------------------ */
/* public API                                                         */
/* ------------------------------------------------------------------ */

/*
 * The header publishes the number a caller must reserve for net_social_create_in(). Checking
 * it here means the macro cannot drift out of date: if the struct grows past it, this fails
 * to compile rather than letting a caller hand over a buffer that is silently too small.
 */
_Static_assert(NET_SOCIAL_STORAGE_BYTES >= sizeof(net_social_t),
               "NET_SOCIAL_STORAGE_BYTES is smaller than net_social_t");

net_social_t *net_social_create_in(void *storage, size_t storage_bytes, pet_game_t *game)
{
    if (!storage) return NULL;
    if (storage_bytes < sizeof(net_social_t)) {
        ESP_LOGE(TAG, "storage is %u bytes but %u are needed; not creating",
                 (unsigned)storage_bytes, (unsigned)sizeof(net_social_t));
        return NULL;
    }

    memset(storage, 0, sizeof(net_social_t));
    net_social_t *s = (net_social_t *)storage;
    s->game = game;
    s->state = SOC_SCANNING;

    /*
     * Guard the record set before anything can touch it. Created here rather than at the
     * declaration so a second create() does not leak the previous handle, and after the
     * memset so the handle itself is not wiped. If it cannot be created the record paths
     * fall back to the unlocked behaviour they had before, which is degraded but not
     * broken -- they check for NULL rather than dereferencing it.
     */
    s->log_lock = xSemaphoreCreateMutex();
    if (!s->log_lock) {
        ESP_LOGW(TAG, "could not create the record lock; encounter records run unlocked");
    }

    load_records(s);
    net_nonce_reset(&s->nonces);
    net_link_set_rx_cb(on_frame, s);
    net_link_set_state_cb(on_link_state, s);

    ESP_LOGI(TAG, "social layer ready: %d encounters cached, %d breeds known",
             s->log_count, __builtin_popcount(s->dex.breed_known));
    return s;
}

net_social_t *net_social_create(pet_game_t *game)
{
    /*
     * The badge has exactly one radio, so it gets exactly one protocol instance, held in
     * .bss and never on the heap.
     *
     * The storage is passed in rather than being baked in here so that a second instance can
     * exist in one address space. That is not a hypothetical: it is the only way to play a
     * handshake out on a PC, and without it the protocol's central behaviour -- two devices
     * completing a meeting -- cannot be tested at all except with two boards in hand. Two
     * "session can never complete" defects were found that way, by reading rather than by
     * testing, and this is the change that removes the excuse.
     */
    static net_social_t instance;
    return net_social_create_in(&instance, sizeof(instance), game);
}

void net_social_destroy(net_social_t *s)
{
    if (!s) return;
    net_link_set_rx_cb(NULL, NULL);
    net_link_set_state_cb(NULL, NULL);
}

void net_social_start(net_social_t *s)
{
    if (!s) return;
    s->state = SOC_SCANNING;
    (void)net_link_start();
}

esp_err_t net_social_request_meeting(net_social_t *s)
{
    if (!s) return ESP_ERR_INVALID_ARG;

    /*
     * Refuse if a session is already under way, or if we are waiting on our own owner's
     * answer to somebody else's HELLO.
     *
     * Without this, a second request -- a double tap, or the UI offering the action while
     * the auto-initiate path is already running -- regenerates our nonce and sends another
     * HELLO. That replaces the nonce the owner is being asked about while the peer is
     * answering the first one, so the two ends disagree about the session and it collapses
     * into the 15 s timeout.
     *
     * The `has_pending` term matters because the state does not cover it: a pending prompt
     * leaves `state` at SOC_SCANNING, so checking the state alone would let a request
     * through while the owner is mid-answer. The auto-initiate path in net_social_poll()
     * checks `!has_pending` itself, and this is the same condition stated where it is
     * enforced.
     */
    if (s->state != SOC_SCANNING && s->state != SOC_IDLE) return ESP_ERR_INVALID_STATE;
    if (s->has_pending) return ESP_ERR_INVALID_STATE;

    if (s->stage < NET_STAGE_NEAR) return ESP_ERR_INVALID_STATE; /* too far to meet */

    /* Pick the closest peer: that is the one the owner is standing next to. */
    net_peer_t nearest;
    int best = -1;
    int best_rssi = -127;
    const int n = net_link_peer_count();
    for (int i = 0; i < n; i++) {
        net_peer_t p;
        if (net_link_get_peer(i, &p) && p.rssi_avg > best_rssi) {
            best_rssi = p.rssi_avg;
            best = i;
            nearest = p;
        }
    }
    if (best < 0) return ESP_ERR_NOT_FOUND;

    s->our_nonce = esp_random();
    if (s->our_nonce == 0) s->our_nonce = 0xA5A5A5A5u;
    s->helloSent = false;
    s->summarySent = false;

    /*
     * Arm the session deadline before the first byte leaves. If the peer never
     * answers, net_social_poll() tears the session down and we go back to scanning;
     * without this the badge would sit in SOC_HELLO_SENT/SOC_ACK_SENT forever.
     */
    s->session_ends_at_ms = (uint32_t)(esp_timer_get_time() / 1000) + 15000;

    if (!net_link_connected()) {
        /*
         * Connecting is itself the consent gate: nothing is transmitted until a
         * peer is in range and the owner has asked to meet. The HELLO follows
         * from the link-state callback once the connection is up.
         */
        s->state = SOC_SCANNING;
        const esp_err_t err = net_link_connect(nearest.device_id);
        if (err != ESP_OK) {
            /*
             * Disarm the deadline. No byte was sent, so there is no session for it to
             * guard, and leaving it armed would make poll() later report a timeout and
             * skip a discovery round for a connection that never existed.
             */
            s->session_ends_at_ms = 0;
            s->our_nonce = 0;
        }
        return err;
    }

    /*
     * Already connected (the auto-initiate path usually got there first). Same ordering
     * problem as the link-state path: this can run before our discovery of the peer has
     * finished, so the send may be refused and held for the poll path to retry. Returning
     * ESP_OK is still right -- a session has begun and the deadline bounds it -- but the
     * frame is not claimed as sent.
     */
    s->state = SOC_HELLO_SENT;
    send_hello(s);
    return ESP_OK;
}

esp_err_t net_social_accept_meeting(net_social_t *s)
{
    if (!s || !s->has_pending) return ESP_ERR_INVALID_STATE;

    uint8_t payload[ID_LEN + NONCE_LEN + NONCE_LEN + TAG_LEN];
    /* Sized from the label literal so the hashed length cannot differ from the written one;
     * see the note in handle_ack() for the defect that came from getting this wrong. */
    uint8_t mac_input[ID_LEN + NONCE_LEN + NONCE_LEN + sizeof("ACK")];
    uint8_t key[32];
    const uint8_t *id = net_link_device_id();

    s->our_nonce = esp_random();
    /*
     * The same zero guard the initiator uses. It is not cosmetic here: our_nonce == 0 is
     * what handle_confirm() rejects, so a zero draw would make this side drop the peer's
     * confirmation and stall the session until the 15 s deadline -- the exact failure
     * described in handle_confirm, reintroduced by a 1-in-4-billion coincidence. Keeping
     * the two call sites consistent is cheaper than reasoning about which one can afford
     * to skip the check.
     */
    if (s->our_nonce == 0) s->our_nonce = 0xA5A5A5A5u;

    memcpy(payload, id, ID_LEN);
    put32(payload + ID_LEN, s->our_nonce);
    put32(payload + ID_LEN + NONCE_LEN, s->peer_nonce);

    memcpy(mac_input, id, ID_LEN);
    put32(mac_input + ID_LEN, s->our_nonce);
    put32(mac_input + ID_LEN + NONCE_LEN, s->peer_nonce);
    memcpy(mac_input + ID_LEN + NONCE_LEN * 2, "ACK", sizeof("ACK"));

    /* Keyed by our own id, because handle_ack() recomputes it from the id the frame claims. */
    derive_key(id, key);
    hmac_tag(key, sizeof(key), mac_input, sizeof(mac_input),
             payload + ID_LEN + NONCE_LEN * 2);

    remember_nonce(s, s->peer_nonce);

    /*
     * The ACK must actually reach the peer before this side claims it accepted.
     *
     * An earlier version ignored the return value and set SOC_ACK_SENT regardless, which on
     * a link whose MTU is too small for a 26-byte ACK meant the badge believed a session was
     * underway while nothing had been transmitted -- and it would wait out the full 15 s
     * deadline for a reply to a frame the peer never saw. Returning the failure lets the UI
     * tell the owner, and leaves the state untouched so the next attempt is a clean one.
     */
    const esp_err_t err = send_frame(s, MSG_ACK, payload, sizeof(payload));
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "could not send the ACK: %s", esp_err_to_name(err));
        /*
         * Drop the prompt as well, and arm nothing.
         *
         * The caller (main.c) has already hidden the dialog by the time we get here, so
         * leaving `has_pending` set would make this badge deaf to every HELLO from this peer
         * while still accepting the owner's taps: a prompt that is not on screen, cannot be
         * withdrawn by the UI, and silently blocks the next meeting until the initiator's own
         * 15 s deadline drops the link.
         *
         * There is no session to protect -- no byte was sent -- so the honest state is the
         * idle one. That also lets the peer's next attempt reach us immediately instead of
         * after a 15 s stall, which is the behaviour that matters here: the failure was in
         * the radio, not in the owner's intent, and the owner already said yes.
         */
        s->has_pending = false;
        s->session_ends_at_ms = 0;
        s->our_nonce = 0;
        s->state = SOC_SCANNING;
        return err;
    }

    /* Same deadline as the initiator side: if the peer never confirms, the session
     * is torn down by net_social_poll() instead of sitting in SOC_ACK_SENT. */
    s->session_ends_at_ms = (uint32_t)(esp_timer_get_time() / 1000) + 15000;

    s->state = SOC_ACK_SENT;
    s->has_pending = false;
    return ESP_OK;
}

void net_social_decline_meeting(net_social_t *s)
{
    if (!s) return;
    s->has_pending = false;
    s->state = SOC_SCANNING;
    /* Clear the deadline: this link is being closed deliberately, and a stale
     * deadline would otherwise tear down whatever session comes next. */
    s->session_ends_at_ms = 0;
    send_bye(s);
}

void net_social_poll(net_social_t *s)
{
    if (!s) return;

    const uint32_t now_ms = (uint32_t)(esp_timer_get_time() / 1000);
    if (now_ms - s->last_poll_ms < 200) return;
    s->last_poll_ms = now_ms;

    update_stage(s);

    /* Persist any meeting the receive callback recorded since the last poll. */
    flush_records(s);

    /*
     * A session that has done its job is closed so the radio is free for the next
     * stranger. Without this the link would stay up and the badge would stop
     * discovering anyone new.
     *
     * The test deliberately does not require SOC_ICE_BROKEN: a session can reach
     * SOC_HELLO_SENT or SOC_ACK_SENT and then stall forever if the peer stops
     * answering (or answers with a frame this side rejects). Since the auto-initiate
     * path below needs SOC_SCANNING, a stalled session would leave the badge unable
     * to discover anybody, permanently and with no visible cause. The deadline is
     * therefore armed whenever a request goes out and cleared when the session is
     * torn down, whatever state it is in.
     */
    if (s->session_ends_at_ms != 0 &&
        (int32_t)(now_ms - s->session_ends_at_ms) >= 0) {
        ESP_LOGI(TAG, "session timed out in state %s", net_social_state_name(s->state));
        net_link_disconnect();
        end_session(s);
        return;
    }

    /*
     * Deliver a HELLO the transport refused earlier.
     *
     * This is the fix for the central's born-broken first HELLO: the connection came up,
     * our GATT discovery of the peer had not finished, so net_link_send() returned
     * ESP_ERR_INVALID_STATE and no byte was transmitted. This runs on every poll (20 ms) and
     * succeeds as soon as the peer's characteristic handle is known, which is a few
     * milliseconds after the connection in practice.
     *
     * Bounded by the session deadline consulted above, so a HELLO that never becomes
     * deliverable ends the session rather than retrying forever.
     */
    if (s->helloPending && s->session_ends_at_ms != 0) {
        (void)deliver_hello(s);
    }

    /*
     * When to initiate.
     *
     * Sending a HELLO reveals nothing but an opaque device id and a random nonce,
     * so it is safe to do on proximity alone -- that is what makes a meeting feel
     * automatic. Revealing the pet is a separate step, and that one is gated on the
     * owner answering the prompt (see handle_hello / net_social_accept_meeting).
     *
     * The request is only made when the peer is essentially adjacent, when no
     * session or prompt is already in flight, and no more than once every few
     * seconds, so two badges standing near each other do not trade HELLOs forever.
     */
    if (s->state == SOC_SCANNING && !s->has_pending && !s->has_active &&
        net_link_peer_count() > 0 && s->stage >= NET_STAGE_TOUCHING &&
        (int32_t)(now_ms - s->last_request_ms) >= 5000) {
        s->last_request_ms = now_ms;
        const esp_err_t err = net_social_request_meeting(s);
        if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
            ESP_LOGD(TAG, "meeting request not sent: %s", esp_err_to_name(err));
        }
    }
}

net_social_state_t net_social_state(const net_social_t *s) { return s ? s->state : SOC_IDLE; }
net_stage_t net_social_stage(const net_social_t *s) { return s ? s->stage : NET_STAGE_NONE; }
bool net_social_prompt_pending(const net_social_t *s) { return s ? s->has_pending : false; }

void net_social_set_prompt_cb(net_social_t *s, net_social_prompt_cb_t cb, void *user)
{
    if (!s) return;
    s->prompt_cb = cb;
    s->prompt_user = user;
}

void net_social_set_met_cb(net_social_t *s, net_social_met_cb_t cb, void *user)
{
    if (!s) return;
    s->met_cb = cb;
    s->met_user = user;
}

/*
 * A copy rather than a pointer: the dex is written on the NimBLE host task as meetings
 * arrive, so handing out &s->dex invites the caller to read a struct that is being
 * updated. The dex is small, so returning a copy costs nothing and removes the footgun
 * entirely. (The previous accessor returned the pointer, which is how a log line in
 * main.c came to read a shared field directly.)
 */
void net_social_dex_copy(const net_social_t *s, net_dex_t *out)
{
    if (!s || !out) return;
    if (s->log_lock) (void)xSemaphoreTake(s->log_lock, portMAX_DELAY);
    *out = s->dex;
    if (s->log_lock) (void)xSemaphoreGive(s->log_lock);
}

int net_social_encounter_count(const net_social_t *s)
{
    if (!s) return 0;
    /*
     * Read under the lock: an append on the NimBLE task can move log_count between this
     * call and the net_social_get_encounter() that follows it, so a caller that loops
     * `for (i = 0; i < count; i++)` must not see a count that indexes past what the lock
     * protected. The accessor re-checks its index, so the worst case is one skipped row
     * rather than a bad read.
     */
    if (s->log_lock) (void)xSemaphoreTake(s->log_lock, portMAX_DELAY);
    const int n = s->log_count;
    if (s->log_lock) (void)xSemaphoreGive(s->log_lock);
    return n;
}

bool net_social_get_encounter(const net_social_t *s, int index, net_encounter_t *out)
{
    if (!s || !out || index < 0) return false;

    if (s->log_lock) (void)xSemaphoreTake(s->log_lock, portMAX_DELAY);
    const bool ok = index < s->log_count;
    if (ok) *out = s->log[index];
    if (s->log_lock) (void)xSemaphoreGive(s->log_lock);
    return ok;
}
