/*
 * net_proto - see net_proto.h.
 *
 * Contains no ESP-IDF, no FreeRTOS and no static state, so it can be linked into a host
 * test binary directly. Keep it that way: the moment something here needs a device, the
 * protocol stops being testable on a PC, which is the whole point of the split.
 */

#include "net_proto.h"

#include <stdio.h>
#include <string.h>

/* ------------------------------------------------------------------ */
/* framing                                                            */
/* ------------------------------------------------------------------ */

bool net_proto_parse(const uint8_t *data, size_t len, net_frame_view_t *out)
{
    if (!data || !out) return false;
    if (len < NET_PROTO_HDR_LEN) return false;

    const uint8_t type = data[0];
    const uint8_t plen = data[1];

    /*
     * The comparison is written so it cannot overflow. `plen` is at most 255 and the
     * buffer is a size_t, so plen + HDR cannot wrap on any real target, but stating it
     * as a subtraction from the known-larger `len` means that stays true if the length
     * field is ever widened.
     */
    if ((size_t)plen > len - NET_PROTO_HDR_LEN) return false;

    out->type = type;
    out->len = plen;
    out->payload = data + NET_PROTO_HDR_LEN;
    return true;
}

size_t net_proto_build(uint8_t *out, size_t cap, uint8_t type,
                       const uint8_t *payload, size_t len)
{
    if (!out) return 0;
    /* Every check happens before the first write, so a failure leaves `out` untouched. */
    if (len > 255) return 0;
    if (payload == NULL && len != 0) return 0;
    if (cap < NET_PROTO_HDR_LEN + len) return 0;

    out[0] = type;
    out[1] = (uint8_t)len;
    if (len) memcpy(out + NET_PROTO_HDR_LEN, payload, len);
    return NET_PROTO_HDR_LEN + len;
}

/* ------------------------------------------------------------------ */
/* replay window                                                      */
/* ------------------------------------------------------------------ */

bool net_nonce_seen(const net_nonce_ring_t *r, uint32_t n)
{
    if (!r) return false;
    const int count = r->count < NET_PROTO_NONCE_RING ? r->count : NET_PROTO_NONCE_RING;
    for (int i = 0; i < count; i++) {
        if (r->ring[i] == n) return true;
    }
    return false;
}

void net_nonce_remember(net_nonce_ring_t *r, uint32_t n)
{
    if (!r) return;

    /*
     * Deduplicate. This is not an optimisation: without it, a peer that repeats a frame
     * consumes a fresh slot every time, so the window fills faster and rotates sooner,
     * which is exactly what a replay wants. The ring exists to make replays fail, so a
     * repeat must be a no-op.
     *
     * (The first extraction of this module from net_social.c dropped the check; the
     * host test caught it.)
     */
    if (net_nonce_seen(r, n)) return;

    if (r->count < NET_PROTO_NONCE_RING) {
        r->ring[r->count++] = n;
        return;
    }
    /*
     * Full: drop the oldest and append. The ring is only ever read as a whole, so the
     * order carries no meaning beyond "oldest first", which this preserves.
     */
    memmove(&r->ring[0], &r->ring[1], sizeof(r->ring[0]) * (NET_PROTO_NONCE_RING - 1));
    r->ring[NET_PROTO_NONCE_RING - 1] = n;
}

void net_nonce_reset(net_nonce_ring_t *r)
{
    if (!r) return;
    memset(r->ring, 0, sizeof(r->ring));
    r->count = 0;
}

/* ------------------------------------------------------------------ */
/* proximity                                                          */
/* ------------------------------------------------------------------ */

net_stage_t net_stage_for_rssi(int rssi, net_stage_t prev)
{
    /*
     * Uniform band rule: each threshold constant is the *first* reading of the stronger
     * band, and all three comparisons are strict.
     *
     *   rssi <  FAR       -> NONE
     *   FAR  <= rssi < NEAR     -> FAR
     *   NEAR <= rssi < TOUCHING -> NEAR
     *   TOUCHING <= rssi        -> TOUCHING
     *
     * The FAR comparison used to be `<=`, which made that one constant mean "the last
     * reading before anything is visible" while the other two meant "the first reading of
     * this band". A 1 dBm difference in behaviour, but an inconsistency that the next
     * person to move a threshold would have to notice. The host test pins the uniform
     * rule down.
     */
    net_stage_t next;
    if (rssi < NET_PROTO_RSSI_FAR) next = NET_STAGE_NONE;
    else if (rssi < NET_PROTO_RSSI_NEAR) next = NET_STAGE_FAR;
    else if (rssi < NET_PROTO_RSSI_TOUCHING) next = NET_STAGE_NEAR;
    else next = NET_STAGE_TOUCHING;

    /*
     * Hysteresis applies only when the stage would go *down*. Coming up is immediate,
     * so a meeting becomes available as soon as the peer is genuinely close, while a
     * peer hovering on a boundary keeps the stage it already earned.
     */
    if (next < prev) {
        if (next == NET_STAGE_NONE && rssi > NET_PROTO_RSSI_FAR - NET_PROTO_STAGE_HYSTERESIS) {
            next = NET_STAGE_FAR;
        } else if (next == NET_STAGE_FAR && rssi > NET_PROTO_RSSI_NEAR - NET_PROTO_STAGE_HYSTERESIS) {
            next = NET_STAGE_NEAR;
        } else if (next == NET_STAGE_NEAR && rssi > NET_PROTO_RSSI_TOUCHING - NET_PROTO_STAGE_HYSTERESIS) {
            next = NET_STAGE_TOUCHING;
        }
    }
    return next;
}

const char *net_stage_name(net_stage_t s)
{
    switch (s) {
        case NET_STAGE_NONE:     return "附近没有小猫";
        case NET_STAGE_FAR:      return "不远处有只小猫";
        case NET_STAGE_NEAR:     return "有只小猫在附近";
        case NET_STAGE_TOUCHING: return "有只小猫挨得很近";
        default:                 return "";
    }
}

/* ------------------------------------------------------------------ */
/* strings off the wire                                               */
/* ------------------------------------------------------------------ */

void net_copy_utf8_truncated(char *dst, size_t dst_size, const char *src, size_t src_len)
{
    if (!dst || dst_size == 0) return;
    if (!src) {
        dst[0] = '\0';
        return;
    }

    size_t n = strnlen(src, src_len);
    if (n > dst_size - 1) {
        n = dst_size - 1;
        /* Step back over continuation bytes (10xxxxxx) that the cut landed inside. */
        while (n > 0 && ((uint8_t)src[n] & 0xC0) == 0x80) n--;
        /*
         * `n` now indexes either a lead byte or an ASCII byte. If it is a lead byte for
         * a multi-byte sequence, that sequence no longer fits, so drop the lead too --
         * otherwise the string would end with a lead and no continuation, which is just
         * as invalid as ending mid-sequence.
         */
        if (n > 0 && (uint8_t)src[n - 1] >= 0xC0) n--;
    }
    if (n) memcpy(dst, src, n);
    dst[n] = '\0';
}

/* ------------------------------------------------------------------ */
/* icebreaker                                                         */
/* ------------------------------------------------------------------ */

static const char *const ICEBREAKERS[] = {
    "两只小猫隔着空气互相闻了闻，尾巴竖了起来。",
    "它们交换了一根胡须，算是正式认识啦。",
    "你家小猫打了个滚，对面那只愣了一下。",
    "两只小猫并排坐下，一起看了会儿天空。",
    "对面那只小猫凑近闻了闻你的味道。",
    "它们对着彼此喵了一声，像是在打招呼。",
    "两只小猫交换了各自的捕鱼战绩。",
    "你的小猫把最喜欢的角落推荐给了新朋友。",
};

#define ICEBREAKER_COUNT ((int)(sizeof(ICEBREAKERS) / sizeof(ICEBREAKERS[0])))

int net_icebreaker_count(void) { return ICEBREAKER_COUNT; }

const char *net_icebreaker_line(int index)
{
    if (index < 0 || index >= ICEBREAKER_COUNT) return NULL;
    return ICEBREAKERS[index];
}

void net_icebreaker(const pet_cat_t *mine, uint8_t peer_breed, uint8_t peer_stage,
                    char *out, size_t out_len)
{
    if (!out || out_len == 0) return;
    if (!mine) {
        snprintf(out, out_len, "一只小猫从远处经过。");
        return;
    }

    /*
     * Canonical order first, then hash. FNV-1a over an ordered byte string is not
     * symmetric, so hashing (mine, theirs) would let the two devices pick different
     * lines for the same pair; sorting the two (breed, stage) pairs removes the
     * asymmetry. Only data both sides possess is hashed -- local mood or counters would
     * reintroduce the same problem from the other direction.
     */
    uint8_t pair[4] = { mine->breed, (uint8_t)pet_stage(mine->xp), peer_breed, peer_stage };
    if (pair[2] < pair[0] || (pair[2] == pair[0] && pair[3] < pair[1])) {
        const uint8_t b = pair[0], s = pair[1];
        pair[0] = pair[2]; pair[1] = pair[3];
        pair[2] = b;       pair[3] = s;
    }

    uint32_t h = 2166136261u; /* FNV-1a offset basis */
    for (int i = 0; i < 4; i++) {
        h ^= pair[i];
        h *= 16777619u;
    }

    snprintf(out, out_len, "%s", ICEBREAKERS[h % (uint32_t)ICEBREAKER_COUNT]);
}
