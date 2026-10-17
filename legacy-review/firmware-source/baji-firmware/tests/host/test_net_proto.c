/*
 * Host tests for the pure core of the near-field social protocol (net_proto.c).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * net_proto.c holds the parts of the BLE social layer that are most likely to be wrong
 * and least likely to be noticed: frame length validation against an attacker-supplied
 * length, the replay window, the proximity hysteresis, a UTF-8 copy of a hostile string,
 * and the icebreaker's "both devices pick the same line" property.
 *
 * None of it was covered before. The module cannot be exercised through net_social.c
 * on a PC, because that file pulls in NimBLE, NVS and the FreeRTOS timer, and the
 * hardware is not available -- so a defect here would first show up when two badges
 * meet, which is exactly the situation that cannot be debugged. Extracting the pure
 * functions into their own translation unit is what makes them reachable, and this is
 * the payoff.
 *
 * Build and run through tools/run-host-tests.cmd.
 */

#include <stdio.h>
#include <string.h>

#include "net_proto.h"
#include "pet_state.h"

static int g_checks;
static int g_failures;

#define CHECK(cond, ...)                                            \
    do {                                                            \
        g_checks++;                                                 \
        if (!(cond)) {                                              \
            g_failures++;                                           \
            printf("  FAIL %s:%d: ", __FILE__, __LINE__);           \
            printf(__VA_ARGS__);                                    \
            printf("\n");                                           \
        }                                                           \
    } while (0)

/* ------------------------------------------------------------------ */
/* framing                                                            */
/* ------------------------------------------------------------------ */

static void test_framing(void)
{
    printf("\n== frame parse/build ==\n");

    const uint8_t good[] = { 0x01, 0x03, 0xAA, 0xBB, 0xCC };
    net_frame_view_t v;
    CHECK(net_proto_parse(good, sizeof(good), &v), "a well-formed frame must parse");
    CHECK(v.type == 0x01, "type, got %u", v.type);
    CHECK(v.len == 3, "len, got %u", v.len);
    CHECK(v.payload != NULL && v.payload[0] == 0xAA && v.payload[2] == 0xCC,
          "payload must point at the bytes after the header");

    /* A zero-length payload is legal: BYE uses it. */
    const uint8_t empty[] = { 0x06, 0x00 };
    CHECK(net_proto_parse(empty, sizeof(empty), &v), "an empty payload is legal");
    CHECK(v.len == 0, "empty len, got %u", v.len);

    /*
     * The important direction: the length field claims more than the buffer holds.
     * This is the case an attacker controls, and accepting it is a buffer overrun in
     * whichever handler trusts `len`.
     */
    const uint8_t lies[] = { 0x04, 0xFF, 0x01, 0x02 };
    CHECK(!net_proto_parse(lies, sizeof(lies), &v),
          "a length past the end of the buffer must be rejected");

    /* Off by one in the other direction: exactly one byte short of the claim. */
    const uint8_t one_short[] = { 0x04, 0x02, 0x01 };
    CHECK(!net_proto_parse(one_short, sizeof(one_short), &v),
          "a payload one byte short of its claim must be rejected");

    /* Exactly enough must be accepted. */
    const uint8_t exact[] = { 0x04, 0x02, 0x01, 0x02 };
    CHECK(net_proto_parse(exact, sizeof(exact), &v), "exactly enough must parse");

    /* Trailing bytes beyond the declared frame are tolerated (a larger read buffer). */
    const uint8_t trailing[] = { 0x04, 0x01, 0x99, 0x11, 0x22, 0x33 };
    CHECK(net_proto_parse(trailing, sizeof(trailing), &v), "extra trailing bytes are fine");
    CHECK(v.len == 1, "only the declared payload counts, got %u", v.len);

    /* Too short to even hold a header. */
    CHECK(!net_proto_parse(good, 0, &v), "an empty buffer must be rejected");
    CHECK(!net_proto_parse(good, 1, &v), "one byte is not a frame");
    CHECK(!net_proto_parse(NULL, 5, &v), "NULL data must be rejected");
    CHECK(!net_proto_parse(good, sizeof(good), NULL), "NULL out must be rejected");

    /* build/parse round trip, including each boundary the builder enforces. */
    uint8_t buf[NET_PROTO_HDR_LEN + 255];
    uint8_t payload[255];
    for (int i = 0; i < 255; i++) payload[i] = (uint8_t)i;

    size_t n = net_proto_build(buf, sizeof(buf), 0x42, payload, 0);
    CHECK(n == 2, "an empty payload builds a 2-byte frame, got %u", (unsigned)n);

    n = net_proto_build(buf, sizeof(buf), 0x42, payload, 255);
    CHECK(n == 257, "a 255-byte payload builds a 257-byte frame, got %u", (unsigned)n);
    CHECK(net_proto_parse(buf, n, &v) && v.len == 255 && v.type == 0x42,
          "the largest frame must round trip");
    CHECK(memcmp(v.payload, payload, 255) == 0, "the payload must survive the round trip");

    /* A payload that cannot fit the wire format at all. */
    CHECK(net_proto_build(buf, sizeof(buf), 0x42, payload, 256) == 0,
          "a payload over 255 bytes cannot be framed");

    /* Not enough room in the caller's buffer: nothing may be written. */
    uint8_t tiny[4];
    memset(tiny, 0x5A, sizeof(tiny));
    CHECK(net_proto_build(tiny, sizeof(tiny), 0x42, payload, 3) == 0,
          "a frame that does not fit cap must fail");
    CHECK(tiny[0] == 0x5A && tiny[1] == 0x5A,
          "a failed build must not touch the output buffer");

    CHECK(net_proto_build(NULL, 64, 0x42, payload, 1) == 0, "NULL out must fail");
    CHECK(net_proto_build(buf, sizeof(buf), 0x42, NULL, 3) == 0,
          "NULL payload with a non-zero length must fail");
    CHECK(net_proto_build(buf, sizeof(buf), 0x42, NULL, 0) == 2,
          "NULL payload with length 0 is fine");
}

/* ------------------------------------------------------------------ */
/* replay window                                                      */
/* ------------------------------------------------------------------ */

static void test_nonce_ring(void)
{
    printf("\n== replay window ==\n");

    net_nonce_ring_t r;
    net_nonce_reset(&r);
    CHECK(r.count == 0, "a reset ring is empty");
    CHECK(!net_nonce_seen(&r, 1234), "an empty ring has seen nothing");

    net_nonce_remember(&r, 1234);
    CHECK(net_nonce_seen(&r, 1234), "a remembered nonce must be seen");
    CHECK(!net_nonce_seen(&r, 1235), "an unrelated nonce must not be seen");

    /* Remembering the same value twice must not consume two slots. */
    net_nonce_remember(&r, 1234);
    CHECK(r.count == 1, "a duplicate must not grow the ring, count=%d", r.count);

    /* Fill it exactly. */
    net_nonce_reset(&r);
    for (int i = 0; i < NET_PROTO_NONCE_RING; i++) net_nonce_remember(&r, (uint32_t)(100 + i));
    CHECK(r.count == NET_PROTO_NONCE_RING, "the ring fills to its capacity, count=%d", r.count);
    for (int i = 0; i < NET_PROTO_NONCE_RING; i++) {
        CHECK(net_nonce_seen(&r, (uint32_t)(100 + i)), "nonce %d must be in the full ring", 100 + i);
    }

    /*
     * One past capacity: the oldest is forgotten. This is a deliberate property, not a
     * bug -- it is what makes the ring a window -- so it is asserted rather than left
     * implicit. The doc comment in net_proto.h states the same limit.
     */
    net_nonce_remember(&r, 999);
    CHECK(r.count == NET_PROTO_NONCE_RING, "the ring stays at capacity");
    CHECK(!net_nonce_seen(&r, 100), "the oldest nonce is evicted");
    CHECK(net_nonce_seen(&r, 999), "the newest nonce is present");
    for (int i = 1; i < NET_PROTO_NONCE_RING; i++) {
        CHECK(net_nonce_seen(&r, (uint32_t)(100 + i)), "nonce %d must survive", 100 + i);
    }

    /* Zero is a legal nonce value for the ring itself; the "unset" sentinel is the
     * caller's business (net_social uses its own non-zero check). */
    net_nonce_reset(&r);
    net_nonce_remember(&r, 0);
    CHECK(net_nonce_seen(&r, 0), "zero must be storable and findable");

    net_nonce_reset(&r);
    CHECK(r.count == 0 && !net_nonce_seen(&r, 0), "reset must clear the zero entry too");

    /* NULL tolerance: these are called with a struct pointer, but a defect that
     * passes NULL must not fault. */
    CHECK(!net_nonce_seen(NULL, 1), "NULL ring is not seen");
    net_nonce_remember(NULL, 1);
    net_nonce_reset(NULL);
}

/* ------------------------------------------------------------------ */
/* proximity                                                          */
/* ------------------------------------------------------------------ */

static void test_proximity(void)
{
    printf("\n== proximity stages ==\n");

    /*
     * Bands: `<= FAR` is NONE and `>= TOUCHING` is TOUCHING, so the named threshold
     * constants are the first reading of the stronger band, not the last of the weaker.
     * Asserting that here documents which side each boundary falls on, which is the
     * detail an off-by-one would silently change.
     */
    CHECK(net_stage_for_rssi(-127, NET_STAGE_NONE) == NET_STAGE_NONE, "very weak is nothing");
    CHECK(net_stage_for_rssi(NET_PROTO_RSSI_FAR - 1, NET_STAGE_NONE) == NET_STAGE_NONE,
          "one below the far threshold is still nothing");
    CHECK(net_stage_for_rssi(NET_PROTO_RSSI_FAR, NET_STAGE_NONE) == NET_STAGE_FAR,
          "the far threshold itself is FAR");
    CHECK(net_stage_for_rssi(NET_PROTO_RSSI_NEAR - 1, NET_STAGE_NONE) == NET_STAGE_FAR,
          "one below the near threshold is still FAR");
    CHECK(net_stage_for_rssi(NET_PROTO_RSSI_NEAR, NET_STAGE_NONE) == NET_STAGE_NEAR,
          "the near threshold itself is NEAR");
    CHECK(net_stage_for_rssi(NET_PROTO_RSSI_TOUCHING - 1, NET_STAGE_NONE) == NET_STAGE_NEAR,
          "one below the touching threshold is still NEAR");
    CHECK(net_stage_for_rssi(NET_PROTO_RSSI_TOUCHING, NET_STAGE_NONE) == NET_STAGE_TOUCHING,
          "the touching threshold itself is TOUCHING");
    CHECK(net_stage_for_rssi(-10, NET_STAGE_NONE) == NET_STAGE_TOUCHING, "very strong is touching");

    /* Going up is immediate: a meeting must become available as soon as it is close. */
    CHECK(net_stage_for_rssi(NET_PROTO_RSSI_TOUCHING, NET_STAGE_NONE) == NET_STAGE_TOUCHING,
          "climbing several stages at once must be immediate");
    CHECK(net_stage_for_rssi(NET_PROTO_RSSI_NEAR, NET_STAGE_NONE) == NET_STAGE_NEAR,
          "a jump straight to NEAR must be immediate");

    /*
     * Hysteresis: dropping out of a stage needs the signal to be clearly worse than the
     * threshold that admitted it. The boundary test is strict (`>`), so a reading exactly
     * HYSTERESIS below the threshold has already dropped. Tier by tier.
     */
    const int far_hold = NET_PROTO_RSSI_FAR - NET_PROTO_STAGE_HYSTERESIS + 1;  /* last held */
    const int far_drop = NET_PROTO_RSSI_FAR - NET_PROTO_STAGE_HYSTERESIS;      /* first dropped */
    CHECK(net_stage_for_rssi(far_hold, NET_STAGE_FAR) == NET_STAGE_FAR,
          "a small dip must not drop the FAR stage");
    CHECK(net_stage_for_rssi(far_drop, NET_STAGE_FAR) == NET_STAGE_NONE,
          "a dip past the hysteresis edge must drop FAR to nothing");
    CHECK(net_stage_for_rssi(far_drop - 1, NET_STAGE_FAR) == NET_STAGE_NONE,
          "a deeper dip must also drop");

    const int near_hold = NET_PROTO_RSSI_NEAR - NET_PROTO_STAGE_HYSTERESIS + 1;
    const int near_drop = NET_PROTO_RSSI_NEAR - NET_PROTO_STAGE_HYSTERESIS;
    CHECK(net_stage_for_rssi(near_hold, NET_STAGE_NEAR) == NET_STAGE_NEAR,
          "a small dip must not drop the NEAR stage");
    CHECK(net_stage_for_rssi(near_drop, NET_STAGE_NEAR) == NET_STAGE_FAR,
          "a dip past the edge drops NEAR to FAR, not to nothing");

    const int touch_hold = NET_PROTO_RSSI_TOUCHING - NET_PROTO_STAGE_HYSTERESIS + 1;
    const int touch_drop = NET_PROTO_RSSI_TOUCHING - NET_PROTO_STAGE_HYSTERESIS;
    CHECK(net_stage_for_rssi(touch_hold, NET_STAGE_TOUCHING) == NET_STAGE_TOUCHING,
          "a small dip must not drop the TOUCHING stage");
    CHECK(net_stage_for_rssi(touch_drop, NET_STAGE_TOUCHING) == NET_STAGE_NEAR,
          "a dip past the edge drops TOUCHING to NEAR");

    /* A boundary reading held while already showing the higher stage must stay put,
     * which is the whole point: no oscillation. */
    net_stage_t held = NET_STAGE_TOUCHING;
    for (int i = 0; i < 20; i++) {
        const int wobble = NET_PROTO_RSSI_TOUCHING + ((i % 2) ? -1 : -2);
        held = net_stage_for_rssi(wobble, held);
        CHECK(held == NET_STAGE_TOUCHING, "a wobbling boundary reading must not flap, iter %d", i);
    }

    /* And it must eventually drop when the peer really leaves. */
    held = net_stage_for_rssi(-100, held);
    CHECK(held == NET_STAGE_NONE, "a peer that leaves must fall out of TOUCHING, got %d", (int)held);

    /* Every stage has a non-empty name; a NULL or empty label would render as nothing. */
    for (int i = 0; i < NET_STAGE_COUNT; i++) {
        const char *n = net_stage_name((net_stage_t)i);
        CHECK(n != NULL && n[0] != '\0', "stage %d must have a name", i);
    }
    CHECK(net_stage_name((net_stage_t)99) != NULL, "an out-of-range stage must not return NULL");
}

/* ------------------------------------------------------------------ */
/* UTF-8 truncation                                                   */
/* ------------------------------------------------------------------ */

static void test_utf8_copy(void)
{
    printf("\n== UTF-8 copy ==\n");

    char out[64];

    /* Plain ASCII within the limit: copied whole. */
    net_copy_utf8_truncated(out, sizeof(out), "hello", 5);
    CHECK(strcmp(out, "hello") == 0, "ASCII must copy verbatim, got [%s]", out);

    /* src_len shorter than the NUL-terminated string: only src_len bytes count. */
    net_copy_utf8_truncated(out, sizeof(out), "hello world", 5);
    CHECK(strcmp(out, "hello") == 0, "src_len must bound the copy, got [%s]", out);

    /*
     * The case this function exists for: cut a 3-byte character in half and the result
     * must not contain the partial sequence. "猫" is E7 8C AB.
     */
    const char *cat = "\xE7\x8C\xAB";  /* U+732B 猫 */
    net_copy_utf8_truncated(out, 3, cat, 3);   /* room for 2 bytes + NUL */
    CHECK(strcmp(out, "") == 0, "a 3-byte character that cannot fit must be dropped whole, got len %u",
          (unsigned)strlen(out));
    CHECK(out[0] == '\0', "the result must be terminated");

    /* Room for the whole character: kept. */
    net_copy_utf8_truncated(out, 4, cat, 3);
    CHECK(strcmp(out, cat) == 0, "a character that fits must be kept");

    /* One character plus a partial second: the partial one is dropped. */
    net_copy_utf8_truncated(out, 5, "\xE7\x8C\xAB\xE7\x8C\xAB", 6);
    CHECK(strcmp(out, cat) == 0, "the second partial character must be dropped, got len %u",
          (unsigned)strlen(out));

    /* ASCII then a partial multi-byte: the ASCII survives. */
    net_copy_utf8_truncated(out, 4, "ab\xE7\x8C\xAB", 5);
    CHECK(strcmp(out, "ab") == 0, "ASCII before a dropped character must survive, got [%s]", out);

    /* Every byte of the output must be valid: no lead byte left without continuation. */
    for (size_t cap = 1; cap <= 12; cap++) {
        net_copy_utf8_truncated(out, cap, "\xE7\x8C\xAB\xE7\x8C\xAB\xE7\x8C\xAB", 9);
        const size_t n = strlen(out);
        CHECK(n < cap, "cap %u must leave room for the terminator, got %u", (unsigned)cap, (unsigned)n);
        /* Validate UTF-8 shape: every lead byte must be followed by its full
         * complement of continuation bytes, inside the string. */
        size_t i = 0;
        int ok = 1;
        while (i < n) {
            const unsigned char c = (unsigned char)out[i];
            size_t need;
            if (c < 0x80) need = 0;
            else if ((c & 0xE0) == 0xC0) need = 1;
            else if ((c & 0xF0) == 0xE0) need = 2;
            else if ((c & 0xF8) == 0xF0) need = 3;
            else { ok = 0; break; }
            if (i + need >= n) { ok = 0; break; }  /* continuation runs past the end */
            for (size_t k = 1; k <= need; k++) {
                if (((unsigned char)out[i + k] & 0xC0) != 0x80) { ok = 0; break; }
            }
            if (!ok) break;
            i += need + 1;
        }
        CHECK(ok, "cap %u produced invalid UTF-8: [%s]", (unsigned)cap, out);
    }

    /* Degenerate arguments must not fault. */
    net_copy_utf8_truncated(out, 0, "x", 1);
    net_copy_utf8_truncated(NULL, 8, "x", 1);
    net_copy_utf8_truncated(out, sizeof(out), NULL, 0);
    CHECK(out[0] == '\0', "a NULL src must produce an empty string");
    CHECK(1, "degenerate arguments did not fault");
}

/* ------------------------------------------------------------------ */
/* icebreaker                                                         */
/* ------------------------------------------------------------------ */

/* A cat with the given breed and enough xp to land in the given stage. */
static pet_cat_t cat_with(uint8_t breed, pet_stage_t stage)
{
    pet_cat_t c;
    memset(&c, 0, sizeof(c));
    c.breed = breed;
    switch (stage) {
        case PET_STAGE_KITTEN: c.xp = 0;   break;
        case PET_STAGE_YOUNG:  c.xp = 80;  break;  /* >= 60 */
        default:               c.xp = 200; break;  /* >= 160 */
    }
    return c;
}

static void test_icebreaker(void)
{
    printf("\n== icebreaker ==\n");

    CHECK(net_icebreaker_count() > 1, "there must be more than one line to choose from");
    for (int i = 0; i < net_icebreaker_count(); i++) {
        const char *l = net_icebreaker_line(i);
        CHECK(l != NULL && l[0] != '\0', "line %d must be non-empty", i);
        CHECK(strlen(l) < 96, "line %d must fit the documented 96-byte buffer", i);
    }
    CHECK(net_icebreaker_line(-1) == NULL, "a negative index must return NULL");
    CHECK(net_icebreaker_line(net_icebreaker_count()) == NULL, "an index past the end must return NULL");

    /*
     * THE PROPERTY THAT MATTERS: the line is a function of the pair, not of the viewer.
     * The two devices must independently choose the same sentence, or the shared moment
     * is one-sided.
     *
     * This is not hypothetical. The first implementation hashed the two summaries in
     * arrival order and mixed in the local mood, so the two badges picked different
     * lines; this sweep is what pins the fix down.
     */
    int asymmetric = 0;
    int identical_pairs = 0;
    for (int ba = 0; ba < PET_BREED_COUNT; ba++) {
        for (int sa = 0; sa < 3; sa++) {
            for (int bb = 0; bb < PET_BREED_COUNT; bb++) {
                for (int sb = 0; sb < 3; sb++) {
                    pet_cat_t a = cat_with((uint8_t)ba, (pet_stage_t)sa);
                    pet_cat_t b = cat_with((uint8_t)bb, (pet_stage_t)sb);

                    /* Device A knows its own cat and B's summary. */
                    char from_a[96];
                    net_icebreaker(&a, b.breed, (uint8_t)pet_stage(b.xp), from_a, sizeof(from_a));

                    /* Device B knows its own cat and A's summary. */
                    char from_b[96];
                    net_icebreaker(&b, a.breed, (uint8_t)pet_stage(a.xp), from_b, sizeof(from_b));

                    if (strcmp(from_a, from_b) != 0) {
                        asymmetric++;
                        if (asymmetric <= 3) {
                            printf("  MISMATCH breeds %d/%d stages %d/%d:\n    A=[%s]\n    B=[%s]\n",
                                   ba, bb, sa, sb, from_a, from_b);
                        }
                    }
                    if (ba == bb && sa == sb) identical_pairs++;
                }
            }
        }
    }
    CHECK(asymmetric == 0, "%d of %d breed/stage pairs disagreed between the two devices",
          asymmetric, PET_BREED_COUNT * 3 * PET_BREED_COUNT * 3);

    /*
     * Assert the sweep was actually complete.
     *
     * This counter was previously computed and never checked, which is worse than not having
     * it: it looked like coverage. If the inner loops were ever cut short, the sweep above
     * would still pass while testing fewer pairs than it claims, and the "every pair agrees"
     * result would be an artefact of the shortened range.
     */
    CHECK(identical_pairs == PET_BREED_COUNT * 3,
          "the sweep should cover each self-pair exactly once, got %d of %d",
          identical_pairs, PET_BREED_COUNT * 3);

    /*
     * ...and it must not depend on the viewer's LOCAL state either, because that state
     * is never transmitted. Two cats with identical breed and xp but different moods,
     * names and stats must still produce the same line for the same peer.
     */
    pet_cat_t quiet = cat_with(PET_BREED_ORANGE, PET_STAGE_ADULT);
    pet_cat_t happy = cat_with(PET_BREED_ORANGE, PET_STAGE_ADULT);
    happy.stats[PET_STAT_MOOD] = 100;
    happy.stats[PET_STAT_FOOD] = 1;
    happy.health = 12;
    happy.outfit = 3;
    happy.counts[PET_ACT_FEED] = 7;
    happy.goals_claimed = 0x1F;
    snprintf(happy.name, sizeof(happy.name), "%s", "別的名字");

    char l1[96], l2[96];
    net_icebreaker(&quiet, PET_BREED_BLUE, PET_STAGE_KITTEN, l1, sizeof(l1));
    net_icebreaker(&happy, PET_BREED_BLUE, PET_STAGE_KITTEN, l2, sizeof(l2));
    CHECK(strcmp(l1, l2) == 0,
          "the line must not depend on local mood/name/coins: [%s] vs [%s]", l1, l2);

    /* Deterministic: the same inputs always give the same line. */
    char again[96];
    net_icebreaker(&quiet, PET_BREED_BLUE, PET_STAGE_KITTEN, again, sizeof(again));
    CHECK(strcmp(l1, again) == 0, "the function must be deterministic");

    /* A NULL cat still produces something displayable rather than nothing. */
    char fallback[96];
    net_icebreaker(NULL, 0, 0, fallback, sizeof(fallback));
    CHECK(fallback[0] != '\0', "a NULL cat must still yield a line");

    /* An out-of-range peer breed/stage must not index outside the table. */
    for (int b = 200; b < 256; b += 7) {
        char oob[96];
        net_icebreaker(&quiet, (uint8_t)b, (uint8_t)b, oob, sizeof(oob));
        CHECK(oob[0] != '\0', "an out-of-range breed %d must still pick a valid line", b);
    }

    /* Every possible hash outcome must map to a real line: sweep a wide input space and
     * confirm the output is always one of the table's entries. */
    int unknown = 0;
    for (int breed = 0; breed < PET_BREED_COUNT; breed++) {
        for (int xp = 0; xp <= 400; xp += 40) {
            pet_cat_t c = cat_with((uint8_t)breed, PET_STAGE_KITTEN);
            c.xp = (uint32_t)xp;
            char out[96];
            net_icebreaker(&c, (uint8_t)(breed % PET_BREED_COUNT), 1, out, sizeof(out));
            int found = 0;
            for (int i = 0; i < net_icebreaker_count(); i++) {
                if (strcmp(out, net_icebreaker_line(i)) == 0) { found = 1; break; }
            }
            if (!found) unknown++;
        }
    }
    CHECK(unknown == 0, "%d outputs were not one of the table's lines", unknown);

    /* A too-small buffer must not overrun; snprintf is the guard. */
    char small[8];
    net_icebreaker(&quiet, PET_BREED_BLUE, PET_STAGE_KITTEN, small, sizeof(small));
    CHECK(strlen(small) < sizeof(small), "a small buffer must stay terminated");
}

int main(void)
{
    printf("=== net_proto: the pure core of the BLE social protocol ===\n");

    test_framing();
    test_nonce_ring();
    test_proximity();
    test_utf8_copy();
    test_icebreaker();

    printf("\n%d checks, %d failure(s)\n", g_checks, g_failures);
    if (g_failures) {
        printf("NET PROTO TESTS FAILED\n");
        return 1;
    }
    printf("ALL NET PROTO TESTS PASSED\n");
    return 0;
}
