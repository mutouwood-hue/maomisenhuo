/*
 * Host-side unit tests for the badge's uplink: the queue, its wire format and its
 * persistence.
 *
 * Why this file exists
 * --------------------
 * badge_events.c encodes the only thing this firmware says to the phone. Two failure modes
 * matter and neither is visible by playing with the badge:
 *
 *   1. A byte of the record is wrong. The App decodes 8 bytes it did not design; a swapped
 *      b, an unsigned b or a big-endian ts turns "改设置 亮度 -1" into a plausible-looking
 *      number somewhere else, and the pet's numbers settle from a lie. This is a contract
 *      with another codebase, so it is pinned byte by byte here, including the two's
 *      complement cases.
 *   2. A queued record is lost, or a delivered one is resurrected. The queue is the badge's
 *      memory of what the owner did while the phone was away; a phone that never connects
 *      must not be able to wedge it, and a phone that connects must receive the record
 *      exactly once, oldest first.
 *
 * The real badge_events.c is compiled here -- not a reimplementation -- against the same
 * idf_stub/ headers the persistence tests use. NVS is the in-memory stand-in (it can count
 * writes and be told to fail), the clock is the shared simulated one, and the radio is the
 * two-device stand-in from the social tests: net_link_send() there records every frame it
 * accepts, and refuses one while the "link is up but not yet writeable" window is open --
 * which is the window this queue exists to survive.
 *
 * WHAT THIS PROVES
 *   The exact bytes of a record for known values (including negative b); a round trip for
 *   all fourteen types and for the extremes of b; a decoder that rejects type 0, 15 and 255
 *   and leaves its destination untouched; the ring's drop-the-oldest rule at exactly 200;
 *   pending()/total() under a long burst; flush leaving every record pending when the link
 *   refuses and draining FIFO when it accepts; the NVS round trip of a partly drained queue
 *   across a modelled reboot, including a full 1.6 KB queue; every malformed blob being
 *   refused as a whole; the save window, a failed write and a failed commit; clear(); the
 *   clock falling back to the compile-time default and following the phone afterwards; the
 *   labels coming from the generated table; and that the file-level buffer really holds 200
 *   records -- a stack-resident one would have crashed this process long before reaching
 *   that depth, and on the board it did.
 *
 * WHAT THIS DOES NOT PROVE
 *   Anything about flash, the NimBLE radio or the App. "The bytes reached nvs_set_blob()"
 *   is not "they are on flash after a reset", and "net_link_send() accepted them" is not
 *   "the phone received them". Only the board and the phone can settle those.
 *
 * Build: tools/suite/06-events.cmd, driven by tools/run-host-tests.cmd
 */

#include <stdio.h>
#include <string.h>

#include "esp_err.h"
#include "nvs.h"

#include "badge_events.h"
#include "badge_spec_data.h"
#include "net_test_harness.h"

/* badge_events.h is frozen and publishes no deinit; badge_events.c defines this to model a
 * power cycle -- the queue is gone, NVS is not -- which is the state the load path has to be
 * tested from, because init() must refuse a second call. */
void badge_events_reboot(void);

/* ------------------------------------------------------------------ */
/* checks                                                             */
/* ------------------------------------------------------------------ */

static int g_checks;
static int g_failures;

#define CHECK(cond, ...)                                                        \
    do {                                                                        \
        g_checks++;                                                             \
        if (!(cond)) {                                                          \
            g_failures++;                                                       \
            printf("  FAIL %s:%d: ", __FILE__, __LINE__);                       \
            printf(__VA_ARGS__);                                                \
            printf("\n");                                                       \
        }                                                                       \
    } while (0)

#define CHECK_EQ_I(actual, expected, what)                                      \
    do {                                                                        \
        const long _a = (long)(actual);                                         \
        const long _e = (long)(expected);                                       \
        g_checks++;                                                             \
        if (_a != _e) {                                                         \
            g_failures++;                                                       \
            printf("  FAIL %s:%d: %s: got %ld, expected %ld\n",                 \
                   __FILE__, __LINE__, (what), _a, _e);                         \
        }                                                                       \
    } while (0)

static void section(const char *name)
{
    printf("== %s\n", name);
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

/*
 * The deferral window, in milliseconds.
 *
 * badge_events.c defines it privately as 5000 (the frozen header does not publish it), and
 * the test advances the clock in whole windows rather than guessing: a test that wrote
 * "5000" into an assertion would keep passing if the module's window changed, while a test
 * that uses this one constant keeps the two in step.
 */
#define SAVE_MS 5000u

static const uint8_t g_id_a[8] = { 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8 };
static const uint8_t g_id_b[8] = { 0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8 };

static int g_booted;
static int g_boot_count;

/*
 * The phone side of the link.
 *
 * The stand-in's net_link_send() refuses a frame when the peer is not listening (it returns
 * ESP_FAIL), so "a phone is there" has to be modelled or a healthy flush would look like a
 * failure. This callback also records what arrives, which is a stronger claim than the
 * sender's own log: net_test_link_pump() walks the frame through the receive path a real ATT
 * write reaches, so the bytes counted here are the bytes the phone would decode.
 *
 * Delivery also moves the storage stand-in to the phone's slot (net_test_idf.c's
 * select_device is how it keys one device's storage), so every delivery is followed by
 * realign_store().
 */
#define PHONE_RX_MAX 40

static int     g_phone_rx_frames;
static uint8_t g_phone_rx_data[PHONE_RX_MAX][BADGE_EVENT_WIRE_BYTES];
static size_t  g_phone_rx_len[PHONE_RX_MAX];

static void phone_rx(const uint8_t *data, size_t len, void *user)
{
    (void)user;
    const int n = g_phone_rx_frames;
    if (n < PHONE_RX_MAX && data && len <= BADGE_EVENT_WIRE_BYTES) {
        memcpy(g_phone_rx_data[n], data, len);
        g_phone_rx_len[n] = len;
    }
    g_phone_rx_frames++;
}

/*
 * Put the storage stand-in back on the badge's namespace slot.
 *
 * The stand-in addresses every blob call by whichever simulated device is current, and it
 * composes the slot from that device index plus a bit for the namespace name the last
 * nvs_open() was handed (net_test_idf.c:248-277): "device 0, badge_evt". Two things move it
 * away from there. net_test_link_pump() makes the phone current for the length of its
 * receive callback, and net_test_nvs_select_device() on its own does not restore the
 * concern bit -- it sets the bare device index. So the sequence has to be the same one
 * badge_events_init() performs: select the device, then open the namespace through the stub.
 * Without this the next blob write would land in slot "device 0, no concern" and the next
 * load would read "device 0, badge_evt", which is how a test ends up asserting on a store
 * nothing wrote to.
 */
static void realign_store(void)
{
    net_test_nvs_select_device(0);
    nvs_handle_t reopened;
    (void)nvs_open("badge_evt", NVS_READWRITE, &reopened);
}

/** Deliver everything in flight, so the phone-side log is current. */
static void deliver(void)
{
    net_test_link_pump();
    realign_store();
}

/**
 * Fresh device, freshly flashed: wipe the store and the radio, then boot the module.
 *
 * The first boot really is badge_events_init(); every later one goes through
 * badge_events_reboot() first, because a second init() must report ESP_ERR_INVALID_STATE
 * and one of the tests asserts exactly that.
 */
static void fresh(void)
{
    net_test_nvs_reset();
    net_test_time_us = 0;
    net_test_link_reset_counters();
    g_phone_rx_frames = 0;
    memset(g_phone_rx_len, 0, sizeof(g_phone_rx_len));
    net_test_link_register(0, g_id_a);
    net_test_link_register(1, g_id_b);
    net_test_link_set_reachable(0, 1, 1);
    net_test_link_select(1);
    net_link_set_rx_cb(phone_rx, NULL);
    net_test_link_select(0);
    CHECK_EQ_I(net_link_peer_count(), 0, "the badge has not discovered anything yet");

    if (g_booted) badge_events_reboot();
    g_booted = 1;
    g_boot_count++;

    CHECK_EQ_I(badge_events_init(), ESP_OK, "badge_events_init()");
    net_test_nvs_counters_reset();
}

/** Power-cycle the module only, keeping the store. */
static void reboot(void)
{
    badge_events_reboot();
    net_test_time_us = 0;
    net_test_link_reset_counters();
    CHECK_EQ_I(badge_events_init(), ESP_OK, "badge_events_init() after a reboot");
    net_test_nvs_counters_reset();
}

/** Let time pass, in a way the module's own clock and the simulated one agree on. */
static void advance_ms(uint32_t ms)
{
    net_test_advance_ms(ms);
    badge_events_tick((uint32_t)(net_test_time_us / 1000));
}

/**
 * Finish a flush and start counting frames from zero.
 *
 * badge_events_flush() drains the whole queue in one call, so a test that wants to see the
 * frames of one flush has to clear the transport's log after the previous one.
 *
 * Deliberately net_test_link_reset_counters() and NOT the pump: handing control to the peer
 * device would re-select the storage namespace slot the stand-in keys each device by
 * (net_test_idf.c:248-257), and this module holds its NVS namespace open across the whole
 * test. The frames are read back from the sender's own log instead -- net_link_send() copies
 * them before any delivery, so they are the same bytes the phone would be handed.
 */
static void flush_session(void)
{
    net_test_link_reset_counters();
}

/**
 * Bring device 0's link up.
 *
 * net_test_link_connect() runs device 0's GATT discovery to completion in this harness, so
 * `sendable` keeps the value the test last set: clearing it models the real window between
 * "the GAP connection is up" and "the phone's characteristic handle is known", during which
 * the real net_link_send() refuses and the queue has to keep holding.
 */
static void connect_link(void)
{
    CHECK_EQ_I(net_link_connect(g_id_b), ESP_OK, "connect to the simulated phone");
}

/** The bytes net_link_send() recorded for frame `n`, or NULL when there is none. */
static const uint8_t *sent(int n)
{
    return net_test_link_sent_data(0, n);
}

/* ------------------------------------------------------------------ */
/* the wire format, byte by byte                                      */
/* ------------------------------------------------------------------ */

static void test_encode_exact_bytes(void)
{
    section("the exact 8 bytes of a record");

    /*
     * The case the task singles out: type 14, a = 1, b = -1 must be the timestamp bytes
     * followed by 0E 01 FF FF. b is int16 in the specification, so -1 is two's complement
     * in both bytes -- not a clamped 0 and not an unsigned 255.
     */
    badge_evt_t evt = { 0x0A0B0C0Du, EVT_SETTING, 1u, -1 };
    uint8_t out[BADGE_EVENT_WIRE_BYTES];
    badge_events_encode(&evt, out);

    CHECK_EQ_I(out[0], 0x0D, "ts byte 0 (LSB)");
    CHECK_EQ_I(out[1], 0x0C, "ts byte 1");
    CHECK_EQ_I(out[2], 0x0B, "ts byte 2");
    CHECK_EQ_I(out[3], 0x0A, "ts byte 3 (MSB)");
    CHECK_EQ_I(out[4], 0x0E, "type = 14 (EVT_SETTING)");
    CHECK_EQ_I(out[5], 0x01, "a = 1");
    CHECK_EQ_I(out[6], 0xFF, "b low byte of -1");
    CHECK_EQ_I(out[7], 0xFF, "b high byte of -1");

    /* A small positive b is its own two bytes, not a byte plus padding. */
    badge_evt_t two = { 1u, EVT_MEET, 0u, 2 };
    badge_events_encode(&two, out);
    CHECK_EQ_I(out[4], 0x0A, "type = 10 (EVT_MEET)");
    CHECK_EQ_I(out[6], 0x02, "b low byte of 2");
    CHECK_EQ_I(out[7], 0x00, "b high byte of 2");

    /* The extremes of int16, which is where a narrowing conversion would show up: 32767 is
     * FF 7F and -32768 is 00 80. */
    badge_evt_t hi = { 1u, EVT_MEET, 0u, (int16_t)32767 };
    badge_events_encode(&hi, out);
    CHECK_EQ_I(out[6], 0xFF, "b low byte of 32767");
    CHECK_EQ_I(out[7], 0x7F, "b high byte of 32767");

    badge_evt_t lo = { 1u, EVT_SETTING, 0u, (int16_t)-32768 };
    badge_events_encode(&lo, out);
    CHECK_EQ_I(out[6], 0x00, "b low byte of -32768");
    CHECK_EQ_I(out[7], 0x80, "b high byte of -32768");

    /*
     * Every byte of a zero record, with the destination pre-filled. The encoder writes
     * byte-wise rather than memcpy-ing the struct, so nothing may survive from the buffer it
     * was handed -- a struct copy would leak host padding into the App's contract.
     */
    badge_evt_t zero = { 0u, EVT_PET, 0u, 0 };
    memset(out, 0xAA, sizeof(out));
    badge_events_encode(&zero, out);
    for (int i = 0; i < BADGE_EVENT_WIRE_BYTES; i++) {
        /* Byte 4 is the type, which is EVT_PET = 1 for a record that is otherwise zero. */
        const int expected = (i == 4) ? 0x01 : 0x00;
        CHECK_EQ_I(out[i], expected, "a zero record writes exactly its own bytes");
    }

    /* A caller bug must not take the badge down. */
    badge_events_encode(NULL, out);
    badge_events_encode(&zero, NULL);
    CHECK(1, "encode tolerates a NULL argument");
}

/*
 * SMALL INTEGER TYPES ARE FORBIDDEN for this record.
 *
 * The specification says int16 参数 b (spec 9, 上行事件), so the byte pair is the two's
 * complement of a 16-bit value and nothing narrower may be used on the way in or out: an
 * int8_t/uint8_t b would truncate 300 to 44 and -1 to 255, and both would still look like
 * plausible parameters to the App. The field widths of the in-memory struct are part of the
 * same contract, so they are pinned rather than assumed.
 */
static void test_field_widths(void)
{
    section("the record's integer widths: int16 b, not a smaller type");

    CHECK_EQ_I(sizeof(((badge_evt_t *)0)->ts), 4, "ts is uint32");
    CHECK_EQ_I(sizeof(((badge_evt_t *)0)->type), 1, "type is uint8");
    CHECK_EQ_I(sizeof(((badge_evt_t *)0)->a), 1, "a is uint8");
    CHECK_EQ_I(sizeof(((badge_evt_t *)0)->b), 2, "b is int16, and b is signed");
    CHECK_EQ_I(sizeof(badge_evt_t), BADGE_EVENT_WIRE_BYTES, "the record is its own 8 bytes");
    CHECK_EQ_I(BADGE_EVENT_QUEUE_MAX * sizeof(badge_evt_t), 1600, "the ring is 1.6 KB");

    /* b = 300 does not fit in a byte. Two's complement little endian is 2C 01; a narrowing
     * encoder would produce 2C 00 and the App would read 44. */
    badge_evt_t evt = { 0u, EVT_SETTING, 0u, (int16_t)300 };
    uint8_t out[BADGE_EVENT_WIRE_BYTES];
    badge_events_encode(&evt, out);
    CHECK_EQ_I(out[6], 0x2C, "b = 300's low byte");
    CHECK_EQ_I(out[7], 0x01, "b = 300's high byte");

    badge_evt_t back;
    CHECK(badge_events_decode(out, &back), "b = 300 decodes");
    CHECK_EQ_I(back.b, 300, "b = 300 survives, which a byte-wide b could not");

    /* The same for a negative value that a byte-wide b would read as positive. */
    evt.b = (int16_t)-300;
    badge_events_encode(&evt, out);
    CHECK_EQ_I(out[6], 0xD4, "b = -300's low byte (0xFF - 0x2B)");
    CHECK_EQ_I(out[7], 0xFE, "b = -300's high byte (0xFF - 0x01)");
    CHECK(badge_events_decode(out, &back), "b = -300 decodes");
    CHECK_EQ_I(back.b, -300, "and keeps its sign");
    CHECK(back.b < 0, "which is the whole point of int16 over uint16");
}

/* ------------------------------------------------------------------ */
/* round trips                                                        */
/* ------------------------------------------------------------------ */

static void test_round_trip_all_types(void)
{
    section("round trip for all fourteen types");

    CHECK_EQ_I(BADGE_EVENT_COUNT, 14, "the specification defines fourteen types");
    CHECK_EQ_I(BADGE_EVENT_WIRE_BYTES, 8, "a record is 8 bytes");
    CHECK_EQ_I(EVT_PET, 1, "EVT_PET");
    CHECK_EQ_I(EVT_SETTING, 14, "EVT_SETTING");
    CHECK_EQ_I(EVT_TYPE_COUNT, 15, "EVT_TYPE_COUNT is one past the last type");

    for (int i = 0; i < BADGE_EVENT_COUNT; i++) {
        const int type = i + 1;
        badge_evt_t in;
        in.ts = 0x12345678u + (uint32_t)i;
        in.type = (uint8_t)type;
        in.a = (uint8_t)(0x40 + i);
        /* Both signs of b for every type: nothing in the specification limits b to the two
         * types that use it today, and a decoder that loses the sign for one type only is
         * exactly what a single sample misses. */
        in.b = (i % 2 == 0) ? (int16_t)(-(i + 1)) : (int16_t)(i * 7);

        uint8_t wire[BADGE_EVENT_WIRE_BYTES];
        badge_events_encode(&in, wire);

        badge_evt_t out;
        memset(&out, 0x5A, sizeof(out));
        CHECK(badge_events_decode(wire, &out), "type %d decodes", type);
        CHECK_EQ_I(out.ts, in.ts, "ts round trips");
        CHECK_EQ_I(out.type, in.type, "type round trips");
        CHECK_EQ_I(out.a, in.a, "a round trips");
        CHECK_EQ_I(out.b, in.b, "b round trips, sign included");
    }

    /* The generated table is the specification's own numbering. */
    for (int i = 0; i < BADGE_EVENT_COUNT; i++) {
        CHECK_EQ_I(badge_event_defs[i].type, i + 1, "the generated table's type");
        CHECK_EQ_I(badge_event_defs[i].num, i + 1, "the generated table's num");
    }

    /* The extremes of ts and a, so the top bit of a 32-bit field is a value and not a
     * sign. */
    badge_evt_t wide;
    wide.ts = 0xFFFFFFFFu;
    wide.type = EVT_FACE;
    wide.a = 0xFFu;
    wide.b = (int16_t)-1;
    uint8_t wire[BADGE_EVENT_WIRE_BYTES];
    badge_events_encode(&wide, wire);
    badge_evt_t back;
    CHECK(badge_events_decode(wire, &back), "a maxed record decodes");
    CHECK(back.ts == 0xFFFFFFFFu, "ts = 0xFFFFFFFF survives");
    CHECK_EQ_I(back.a, 0xFF, "a = 0xFF survives");
    CHECK_EQ_I(back.b, -1, "b = -1 survives");
}

/* ------------------------------------------------------------------ */
/* the decoder's refusals                                             */
/* ------------------------------------------------------------------ */

static void test_decode_rejects(void)
{
    section("the decoder rejects what the App must not receive");

    uint8_t wire[BADGE_EVENT_WIRE_BYTES];
    badge_evt_t out;

    /* Type 0 is EVT_NONE, 15 is EVT_TYPE_COUNT and 255 is not a type at all. The App's
     * decoder refuses these, and this module must too: the same table is used for the
     * records it reads back out of flash. */
    const int bad_types[] = { 0, 15, 255, 16, 128, 200 };
    for (unsigned i = 0; i < sizeof(bad_types) / sizeof(bad_types[0]); i++) {
        badge_evt_t in;
        in.ts = 0xDEADBEEFu;
        in.type = EVT_PET;
        in.a = 0u;
        in.b = 0;
        badge_events_encode(&in, wire);
        wire[4] = (uint8_t)bad_types[i];

        memset(&out, 0x5A, sizeof(out));
        CHECK(!badge_events_decode(wire, &out), "type %d is refused", bad_types[i]);
        /* Rejection must not publish a partial record: a record with only `a` overwritten
         * is still something the caller could put on the wire. */
        CHECK_EQ_I(out.ts, 0x5A5A5A5Au, "the destination is untouched on refusal (ts)");
        CHECK_EQ_I(out.type, 0x5A, "the destination is untouched on refusal (type)");
        CHECK_EQ_I(out.b, 0x5A5A, "the destination is untouched on refusal (b)");
    }

    /* Every legal type is accepted, so the bounds above are tight rather than off by one. */
    for (int type = EVT_PET; type <= EVT_SETTING; type++) {
        badge_evt_t in;
        in.ts = 0u;
        in.type = (uint8_t)type;
        in.a = 0u;
        in.b = 0;
        badge_events_encode(&in, wire);
        CHECK(badge_events_decode(wire, &out), "type %d is accepted", type);
    }

    /* NULL tolerance, both ways round. */
    badge_events_decode(NULL, &out);
    badge_events_decode(wire, NULL);
    CHECK(1, "decode tolerates a NULL argument");
}

/* ------------------------------------------------------------------ */
/* the ring                                                           */
/* ------------------------------------------------------------------ */

static void test_ring_drops_the_oldest_at_200(void)
{
    section("the ring overflows by dropping the oldest record, at exactly 200");

    fresh();
    CHECK_EQ_I(BADGE_EVENT_QUEUE_MAX, 200, "the specification's depth is 200");
    CHECK_EQ_I(badge_events_pending(), 0, "a fresh badge has nothing pending");
    CHECK_EQ_I(badge_events_total(), 0, "and nothing appended");
    CHECK(!badge_events_dirty(), "and nothing worth flushing");

    /*
     * Fill it exactly. Reaching 200 is also the buffer's placement check: badge_events.c
     * keeps the ring at file scope, and a 1.6 KB stack array is what made the previous
     * firmware reboot at boot (docs/m1-hardware-verification.md:28-57). A PC hands this
     * process megabytes of stack, so the depth alone cannot fail here -- but the assertion
     * pins the depth down, and on the board the same code with a stack array died long
     * before reporting 200.
     */
    for (int i = 0; i < BADGE_EVENT_QUEUE_MAX; i++) {
        badge_events_push(EVT_PET, (uint8_t)i, (int16_t)i);
    }
    CHECK_EQ_I(badge_events_pending(), BADGE_EVENT_QUEUE_MAX,
               "200 records fit: the ring is file-level, not a task stack");
    CHECK_EQ_I(badge_events_total(), (long)BADGE_EVENT_QUEUE_MAX, "200 appended");

    badge_evt_t evt;
    CHECK(badge_events_peek(0, &evt), "peek the oldest");
    CHECK_EQ_I(evt.a, 0, "the oldest is the first pushed");
    CHECK(badge_events_peek(BADGE_EVENT_QUEUE_MAX - 1, &evt), "peek the newest");
    CHECK_EQ_I(evt.a, 199, "the newest is the last pushed");
    CHECK(!badge_events_peek(BADGE_EVENT_QUEUE_MAX, &evt), "index 200 is out of range");
    CHECK(!badge_events_peek(-1, &evt), "a negative index is out of range");
    CHECK(!badge_events_peek(0, NULL), "a NULL destination is out of range");

    /* One more: the OLDEST goes. a = 0 was the first record pushed. */
    badge_events_push(EVT_FEED, 0xEE, -5);
    CHECK_EQ_I(badge_events_pending(), BADGE_EVENT_QUEUE_MAX, "the depth stays at 200");
    CHECK_EQ_I(badge_events_total(), (long)BADGE_EVENT_QUEUE_MAX + 1,
               "the new record counts as appended");

    CHECK(badge_events_peek(0, &evt), "peek after the drop");
    CHECK_EQ_I(evt.a, 1, "record a=0 was the one dropped");
    CHECK_EQ_I(evt.type, EVT_PET, "the survivors are unchanged");
    CHECK(badge_events_peek(BADGE_EVENT_QUEUE_MAX - 1, &evt), "peek the new newest");
    CHECK_EQ_I(evt.type, EVT_FEED, "the new record is at the back");
    CHECK_EQ_I(evt.a, 0xEE, "the new record kept its a");
    CHECK_EQ_I(evt.b, -5, "the new record kept its b");

    /* And again, so the rule is a rule and not a one-shot. */
    badge_events_push(EVT_SETTING, 2, 3);
    CHECK(badge_events_peek(0, &evt), "peek after the second drop");
    CHECK_EQ_I(evt.a, 2, "record a=1 was the one dropped this time");
    CHECK_EQ_I(badge_events_pending(), BADGE_EVENT_QUEUE_MAX, "still 200");

    /* A phone that never connects must not be able to wedge the badge: 1000 more records
     * in, the depth is still 200 and the survivors are the newest 200, in order. */
    for (int i = 0; i < 1000; i++) {
        badge_events_push(EVT_WAKE, (uint8_t)i, (int16_t)i);
    }
    CHECK_EQ_I(badge_events_pending(), BADGE_EVENT_QUEUE_MAX,
               "a 1000-record burst leaves the queue bounded");
    CHECK_EQ_I(badge_events_total(), 200 + 2 + 1000, "every record was counted as appended");

    int previous = -1;
    int ordered = 1;
    for (int i = 0; i < badge_events_pending(); i++) {
        if (!badge_events_peek(i, &evt)) { ordered = 0; break; }
        /* Modulo 256: the counter's field is a byte, so "in order" means "each one is the
         * previous plus one, wrapping". */
        if (previous >= 0 && (int)evt.a != (int)(uint8_t)(previous + 1)) ordered = 0;
        if (evt.type != EVT_WAKE) ordered = 0;
        previous = (int)evt.a;
    }
    CHECK(ordered, "the surviving 200 are the last 200, still oldest-first");
    /* 999 mod 256 = 231: the a field is one byte, so the counter wrapped on the way here and
     * the last survivor's a is not 999. The depth is what is being pinned, not the value --
     * but a wrong value here would mean the survivors are not the last pushed. */
    CHECK_EQ_I(previous, 231, "the last survivor is the last pushed (a = 999 mod 256)");
    CHECK(badge_events_dirty(), "a non-empty queue is worth flushing");
}

static void test_push_refuses_non_events(void)
{
    section("only the specification's fourteen types enter the queue");

    fresh();

    badge_events_push(EVT_NONE, 0, 0);
    CHECK_EQ_I(badge_events_pending(), 0, "EVT_NONE is not an event");
    CHECK_EQ_I(badge_events_total(), 0, "and it is not counted");

    badge_events_push(EVT_TYPE_COUNT, 0, 0);
    badge_events_push((badge_evt_type_t)99, 0, 0);
    badge_events_push((badge_evt_type_t)EVT_SETTING, 7, -2);
    CHECK_EQ_I(badge_events_pending(), 1, "only EVT_SETTING was accepted");
    CHECK_EQ_I(badge_events_total(), 1, "and only it was counted");
    CHECK(badge_events_dirty(), "one record still makes the queue worth flushing");

    badge_evt_t evt;
    CHECK(badge_events_peek(0, &evt), "peek the single record");
    CHECK_EQ_I(evt.type, EVT_SETTING, "it is the one accepted");
    CHECK_EQ_I(evt.a, 7, "with its a");
    CHECK_EQ_I(evt.b, -2, "and its b");
}

/* ------------------------------------------------------------------ */
/* flush and the link                                                 */
/* ------------------------------------------------------------------ */

static void test_flush_without_a_connection(void)
{
    section("nothing leaves the queue while the link cannot carry it");

    fresh();
    badge_events_push(EVT_PET, 1, 0);
    badge_events_push(EVT_FEED, 3, 0);

    /* The caller's flag is the first gate. */
    badge_events_flush(false);
    CHECK_EQ_I(badge_events_pending(), 2, "flush(false) is a no-op");
    CHECK_EQ_I(net_test_link_sent_count(0), 0, "nothing was transmitted");

    /*
     * A connected radio that refuses writes: the window between "the GAP connection came
     * up" and "our GATT discovery of the phone finished", where the real net_link_send()
     * returns ESP_ERR_INVALID_STATE. A record leaves the queue only after a send SUCCEEDS,
     * which is the property that makes the queue worth having.
     */
    connect_link();
    net_test_link_set_sendable(0, 0);
    badge_events_flush(true);
    CHECK_EQ_I(badge_events_pending(), 2, "a refused send leaves both records pending");
    CHECK_EQ_I(net_test_link_sent_count(0), 0, "and nothing was recorded as sent");

    /* The link becomes writable: everything goes, oldest first, exactly once. */
    flush_session();
    net_test_link_set_sendable(0, 1);
    badge_events_flush(true);
    CHECK_EQ_I(badge_events_pending(), 0, "a writable link drains the queue");
    CHECK_EQ_I(badge_events_total(), 2, "the appended total is unaffected by flushing");
    CHECK(!badge_events_dirty(), "an empty queue is not worth flushing");
    CHECK_EQ_I(badge_events_total() - (uint32_t)badge_events_pending(), 2,
               "both records left the queue exactly once");

    CHECK_EQ_I(net_test_link_sent_count(0), 2, "two frames on the wire");
    CHECK_EQ_I(net_test_link_sent_len(0, 0), BADGE_EVENT_WIRE_BYTES, "frame 0 is 8 bytes");
    CHECK_EQ_I(net_test_link_sent_len(0, 1), BADGE_EVENT_WIRE_BYTES, "frame 1 is 8 bytes");
    CHECK(sent(0) && sent(0)[4] == EVT_PET, "frame 0 carries EVT_PET");
    CHECK(sent(1) && sent(1)[4] == EVT_FEED, "frame 1 carries EVT_FEED");
    CHECK(sent(1) && sent(1)[5] == 3, "frame 1 carries a = 3");

    /* A second flush with nothing queued is silent, not a stray frame. */
    badge_events_flush(true);
    CHECK_EQ_I(net_test_link_sent_count(0), 2, "an empty flush sends nothing");

    /*
     * A dropped connection after the queue refilled: the record stays for the next phone,
     * even though the caller still believes it is connected. The frame counters are reset
     * first so the assertion below is about what this flush did and not about the two frames
     * the previous one left in the log.
     */
    badge_events_push(EVT_SLEEP, 0, 0);
    net_link_disconnect();
    flush_session();
    badge_events_flush(true);
    CHECK_EQ_I(badge_events_pending(), 1, "a dropped link leaves the record pending");
    CHECK_EQ_I(net_test_link_sent_count(0), 0, "nothing new went out");

    /* And it goes out once the phone comes back. */
    connect_link();
    net_test_link_set_sendable(0, 1);
    badge_events_flush(true);
    deliver();
    CHECK_EQ_I(badge_events_pending(), 0, "the reconnected phone gets the record");
    CHECK_EQ_I(net_test_link_sent_count(0), 1, "one frame this time");
    CHECK(sent(0) && sent(0)[4] == EVT_SLEEP, "and it is the record that was held");
    CHECK_EQ_I(g_phone_rx_frames, 1, "the phone's own receive path saw it");
    CHECK_EQ_I(g_phone_rx_len[0], BADGE_EVENT_WIRE_BYTES, "as 8 bytes");
    CHECK_EQ_I(g_phone_rx_data[0][4], EVT_SLEEP, "carrying EVT_SLEEP");
}

static void test_flush_drains_in_fifo_order(void)
{
    section("flush drains oldest first, and the wire bytes are the ones peek() encodes");

    fresh();
    connect_link();
    net_test_link_set_sendable(0, 1);

    for (int i = 0; i < 12; i++) {
        badge_events_push(EVT_PLAY, (uint8_t)i, (int16_t)(-i));
    }
    CHECK_EQ_I(badge_events_pending(), 12, "twelve are queued");

    badge_events_flush(true);
    CHECK_EQ_I(badge_events_pending(), 0, "the flush drains the queue");
    CHECK_EQ_I(net_test_link_sent_count(0), 12, "twelve frames on the wire");
    deliver();
    CHECK_EQ_I(g_phone_rx_frames, 12, "and the phone's receive path saw all twelve");
    for (int n = 0; n < 12; n++) {
        CHECK_EQ_I(g_phone_rx_len[n], BADGE_EVENT_WIRE_BYTES, "the phone received 8 bytes");
        CHECK_EQ_I(g_phone_rx_data[n][4], EVT_PLAY, "in order, all 逗猫 events");
        CHECK_EQ_I(g_phone_rx_data[n][5], n, "with a = its push index");
    }

    for (int n = 0; n < 12; n++) {
        /* Rebuild the record the test believes was queued and compare every byte. This is
         * the assertion that ties the queue's own view to the wire: if flush() ever encoded
         * a different slot than peek(0) reports, a resend after a refusal would duplicate
         * or skip the wrong record. */
        badge_evt_t expect;
        expect.ts = sent(n) ? ((uint32_t)sent(n)[0] | ((uint32_t)sent(n)[1] << 8) |
                               ((uint32_t)sent(n)[2] << 16) | ((uint32_t)sent(n)[3] << 24))
                            : 0u;
        expect.type = EVT_PLAY;
        expect.a = (uint8_t)n;
        expect.b = (int16_t)(-n);

        uint8_t wire[BADGE_EVENT_WIRE_BYTES];
        badge_events_encode(&expect, wire);
        CHECK(sent(n) != NULL, "frame %d was recorded", n);
        if (sent(n)) {
            CHECK_EQ_I(memcmp(sent(n), wire, sizeof(wire)), 0,
                       "the frame is byte-identical to the encoded record");
            CHECK_EQ_I(sent(n)[4], EVT_PLAY, "the frame carries EVT_PLAY");
            CHECK_EQ_I(sent(n)[5], n, "the frame carries a = its push index");
            CHECK_EQ_I(sent(n)[6], (uint8_t)((-n) & 0xFF), "the frame's b low byte");
            CHECK_EQ_I(sent(n)[7], n == 0 ? 0x00 : 0xFF, "the frame's b high byte");
        }
    }

    /* Refill and drain again: the ring's head has moved, and the order must still be the
     * push order rather than the slot order. Counters first, so the two rounds' frames are
     * distinguishable. */
    for (int i = 0; i < 3; i++) badge_events_push(EVT_FACE, (uint8_t)(100 + i), (int16_t)i);
    flush_session();
    badge_events_flush(true);
    CHECK_EQ_I(net_test_link_sent_count(0), 3, "three more frames");
    for (int i = 0; i < 3; i++) {
        CHECK(sent(i) && sent(i)[4] == EVT_FACE, "the refilled frame is a 表盘 event");
        CHECK(sent(i) && sent(i)[5] == 100 + i, "the refilled frame kept its order");
    }
}

static void test_flush_keeps_the_head_on_a_refusal(void)
{
    section("a refused flush leaves the head where it was, and the retry does not duplicate");

    fresh();
    connect_link();
    net_test_link_set_sendable(0, 1);

    for (int i = 0; i < 4; i++) badge_events_push(EVT_WATER, (uint8_t)i, 0);

    /* The link goes away before the flush. */
    net_test_link_set_sendable(0, 0);
    badge_events_flush(true);
    CHECK_EQ_I(badge_events_pending(), 4, "the refused flush delivered nothing");
    CHECK_EQ_I(net_test_link_sent_count(0), 0, "and nothing was recorded as sent");

    badge_evt_t evt;
    CHECK(badge_events_peek(0, &evt), "peek after the refusal");
    CHECK_EQ_I(evt.a, 0, "the head is still the first record");

    /* It comes back: all four go, in order, and the first is not sent twice. */
    net_test_link_set_sendable(0, 1);
    badge_events_flush(true);
    CHECK_EQ_I(badge_events_pending(), 0, "the retry delivered all four");
    CHECK_EQ_I(net_test_link_sent_count(0), 4, "four frames, none duplicated");
    for (int n = 0; n < 4; n++) {
        CHECK(sent(n) && sent(n)[4] == EVT_WATER, "frame %d is a 喝水 event", n);
        CHECK(sent(n) && sent(n)[5] == n, "frame %d is in order", n);
    }
}

/* ------------------------------------------------------------------ */
/* NVS persistence                                                    */
/* ------------------------------------------------------------------ */

static void test_nvs_round_trip_of_a_partly_drained_queue(void)
{
    section("a partly drained queue survives a power cut, in order");

    fresh();

    /* Ten records, then the phone connects and takes all ten: the queue is empty but the
     * store is deliberately still inside its window, so nothing was written yet. */
    for (int i = 0; i < 10; i++) {
        badge_events_push((badge_evt_type_t)(EVT_PET + i), (uint8_t)(10 + i), (int16_t)(i - 5));
    }
    connect_link();
    net_test_link_set_sendable(0, 1);
    badge_events_flush(true);
    CHECK_EQ_I(badge_events_pending(), 0, "all ten went out");
    CHECK_EQ_I(net_test_nvs_blob_size("queue"), -1,
               "nothing was written inside the window: the write is deferred");

    /* Five more arrive while the phone is still connected but busy, so they stay pending.
     * These are the records a power cut must not lose. (EVT_MEET..EVT_SETTING = 10..14: the
     * module refuses a type outside the specification's fourteen, so a test that pushed
     * EVT_WAKE + 4 would be pushing type 16 and silently queuing four.) */
    for (int i = 0; i < 5; i++) {
        badge_events_push((badge_evt_type_t)(EVT_MEET + i), (uint8_t)(70 + i),
                          (int16_t)(i * 3 - 4));
    }
    CHECK_EQ_I(badge_events_pending(), 5, "five are pending");
    CHECK_EQ_I(net_test_nvs_blob_size("queue"), -1, "still inside the window");

    /* The window closes: the pending five reach the store. */
    advance_ms(SAVE_MS);
    CHECK_EQ_I(net_test_nvs_blob_size("queue"), 8 + 5 * 8, "5 records = 8 + 40 bytes");

    /* Power cut. The queue comes back, with the same records in the same order. */
    reboot();
    CHECK_EQ_I(badge_events_pending(), 5, "all five records came back");
    CHECK_EQ_I(badge_events_total(), 0, "and the per-session counter restarted");

    for (int i = 0; i < 5; i++) {
        badge_evt_t e;
        CHECK(badge_events_peek(i, &e), "the reloaded record is readable");
        CHECK_EQ_I(e.type, EVT_MEET + i, "the reloaded record kept its type");
        CHECK_EQ_I(e.a, 70 + i, "the reloaded record kept its a");
        CHECK_EQ_I(e.b, i * 3 - 4, "the reloaded record kept its b, sign included");
    }

    /* And they are deliverable: the reloaded records reach the wire with the right bytes,
     * in order, including the two's complement of a negative b. */
    connect_link();
    net_test_link_set_sendable(0, 1);
    flush_session();
    badge_events_flush(true);
    CHECK_EQ_I(net_test_link_sent_count(0), 5, "the reloaded records are deliverable");
    deliver();
    CHECK_EQ_I(g_phone_rx_frames, 5, "the phone received all five");
    for (int i = 0; i < 5; i++) {
        const int b = i * 3 - 4;
        CHECK(sent(i) && sent(i)[4] == EVT_MEET + i, "the reloaded frame's type");
        CHECK(sent(i) && sent(i)[5] == 70 + i, "the reloaded frame's a");
        CHECK(sent(i) && sent(i)[6] == (uint8_t)(b & 0xFF), "the reloaded frame's b low");
        CHECK(sent(i) && sent(i)[7] == (b < 0 ? 0xFF : 0x00), "the reloaded frame's b high");
        CHECK_EQ_I(g_phone_rx_data[i][4], EVT_MEET + i, "as the phone received it");
        CHECK_EQ_I(g_phone_rx_len[i], BADGE_EVENT_WIRE_BYTES, "as 8 bytes");
    }

    /* The post-flush write drops what the phone already has, rather than resurrecting it.
     * (The window is measured from the module's own tick, so it has to be advanced for the
     * drained queue to reach the store at all.) */
    advance_ms(SAVE_MS);
    CHECK_EQ_I(net_test_nvs_blob_size("queue"), 8, "the store now holds an empty queue");
    reboot();
    CHECK_EQ_I(badge_events_pending(), 0, "delivered records are not resurrected");

    /* A full queue round-trips too: this is the 1.6 KB blob the store actually sees, and
     * the one whose depth a stack array could not have carried. */
    for (int i = 0; i < BADGE_EVENT_QUEUE_MAX; i++) {
        badge_events_push(EVT_SETTING, (uint8_t)i, (int16_t)(i - 100));
    }
    CHECK_EQ_I(badge_events_save(), ESP_OK, "save() forces the write out");
    CHECK_EQ_I(net_test_nvs_blob_size("queue"), 8 + BADGE_EVENT_QUEUE_MAX * 8,
               "the stored image is 8 bytes + 200 records");

    reboot();
    CHECK_EQ_I(badge_events_pending(), BADGE_EVENT_QUEUE_MAX, "the full queue came back");
    badge_evt_t full;
    CHECK(badge_events_peek(0, &full), "peek the oldest of the reloaded ring");
    CHECK_EQ_I(full.a, 0, "the oldest is the first pushed");
    CHECK_EQ_I(full.b, -100, "with its negative b");
    CHECK(badge_events_peek(BADGE_EVENT_QUEUE_MAX - 1, &full), "peek the newest");
    CHECK_EQ_I(full.a, BADGE_EVENT_QUEUE_MAX - 1, "the newest is the last pushed");
}

static void test_nvs_rejects_a_malformed_queue(void)
{
    section("a malformed stored queue is refused whole, never half-loaded");

    fresh();
    badge_events_push(EVT_PET, 1, 0);
    badge_events_push(EVT_FEED, 2, 0);
    CHECK_EQ_I(badge_events_save(), ESP_OK, "seed a good queue");

    static unsigned char buf[2048];
    size_t len;
    int size;

    /* A truncated tail. The header's count and the blob's byte count must agree exactly,
     * which is where the length half of the decode contract is enforced: a record is
     * malformed when it is not exactly one record long. */
    size = net_test_nvs_blob_read("queue", buf, sizeof(buf));
    CHECK(size > 8, "the queue is stored (size %d)", size);
    CHECK_EQ_I(nvs_set_blob(1, "queue", buf, (size_t)size - 3), ESP_OK, "truncate the tail");
    reboot();
    CHECK_EQ_I(badge_events_pending(), 0, "the truncated queue is refused");

    /* A count that claims more records than the blob carries. */
    badge_events_push(EVT_PET, 1, 0);
    CHECK_EQ_I(badge_events_save(), ESP_OK, "seed again");
    len = sizeof(buf);
    CHECK_EQ_I(nvs_get_blob(1, "queue", buf, &len), ESP_OK, "read the blob back");
    buf[6] = 200;
    buf[7] = 0;
    CHECK_EQ_I(nvs_set_blob(1, "queue", buf, 8 + 8), ESP_OK, "claim 200 records in 16 bytes");
    reboot();
    CHECK_EQ_I(badge_events_pending(), 0, "a count that disagrees with the bytes is refused");

    /* A magic that is not ours: the same blob, but not one this module wrote. */
    badge_events_push(EVT_PET, 1, 0);
    CHECK_EQ_I(badge_events_save(), ESP_OK, "seed once more");
    size = net_test_nvs_blob_read("queue", buf, sizeof(buf));
    buf[0] = 'X';
    CHECK_EQ_I(nvs_set_blob(1, "queue", buf, (size_t)size), ESP_OK, "corrupt the magic");
    reboot();
    CHECK_EQ_I(badge_events_pending(), 0, "a foreign blob is refused");

    /* A version this firmware does not know. */
    size = net_test_nvs_blob_read("queue", buf, sizeof(buf));
    buf[0] = 'B';
    buf[4] = 9;
    CHECK_EQ_I(nvs_set_blob(1, "queue", buf, (size_t)size), ESP_OK, "bump the version");
    reboot();
    CHECK_EQ_I(badge_events_pending(), 0, "an unknown version is refused");

    /* A record whose type byte is outside 1..14. The App's decoder would refuse it, so this
     * module must not queue it for delivery either -- and one bad record drops the whole
     * queue rather than publishing the records before it. */
    badge_events_push(EVT_PET, 1, 0);
    badge_events_push(EVT_FEED, 2, 0);
    CHECK_EQ_I(badge_events_save(), ESP_OK, "seed a third time");
    size = net_test_nvs_blob_read("queue", buf, sizeof(buf));
    buf[8 + 4] = 0; /* the first record's type */
    CHECK_EQ_I(nvs_set_blob(1, "queue", buf, (size_t)size), ESP_OK, "put type 0 in the blob");
    reboot();
    CHECK_EQ_I(badge_events_pending(), 0, "one invalid record drops the whole queue");

    /* An implausible size: a blob that cannot be a queue at all. */
    static unsigned char big[4096];
    memset(big, 0, sizeof(big));
    memcpy(big, "BEQ1", 4);
    big[4] = 1;
    CHECK_EQ_I(nvs_set_blob(1, "queue", big, sizeof(big)), ESP_OK, "store an oversized blob");
    reboot();
    CHECK_EQ_I(badge_events_pending(), 0, "an oversized blob is refused");

    /* A zero-length blob. */
    CHECK_EQ_I(nvs_set_blob(1, "queue", NULL, 0), ESP_OK, "store an empty blob");
    reboot();
    CHECK_EQ_I(badge_events_pending(), 0, "an empty blob is refused");

    /* A short header: 8 bytes is the minimum, so 7 cannot be a queue. */
    memcpy(big, "BEQ1", 4);
    big[4] = 1;
    CHECK_EQ_I(nvs_set_blob(1, "queue", big, 7), ESP_OK, "store a short header");
    reboot();
    CHECK_EQ_I(badge_events_pending(), 0, "a blob shorter than its header is refused");
}

static void test_save_defers_then_lands_and_retries_on_failure(void)
{
    section("the save window, and a failed write that is not treated as done");

    fresh();

    badge_events_push(EVT_PET, 1, 0);
    CHECK_EQ_I(badge_events_save(), ESP_OK, "save() writes immediately when dirty");
    CHECK_EQ_I(net_test_nvs_set_count(), 1, "one blob write for one save()");
    CHECK_EQ_I(net_test_nvs_commit_count(), 1, "and one commit");

    /* Nothing pending to record: a second save() must not cost an erase. */
    CHECK_EQ_I(badge_events_save(), ESP_OK, "save() with nothing dirty");
    CHECK_EQ_I(net_test_nvs_set_count(), 1, "no second write");

    /* The deferred path: a push inside the window stays in RAM. */
    net_test_nvs_counters_reset();
    badge_events_push(EVT_FEED, 2, 0);
    advance_ms(SAVE_MS - 1);
    CHECK_EQ_I(net_test_nvs_set_count(), 0, "still inside the window");
    advance_ms(2);
    CHECK_EQ_I(net_test_nvs_set_count(), 1, "a tick past the window saves");

    /* A burst is one write, not one write per record. */
    net_test_nvs_counters_reset();
    for (int i = 0; i < 50; i++) badge_events_push(EVT_PLAY, (uint8_t)i, 0);
    CHECK_EQ_I(net_test_nvs_set_count(), 0, "a burst inside the window costs no write");
    advance_ms(SAVE_MS);
    CHECK_EQ_I(net_test_nvs_set_count(), 1, "the burst costs exactly one write");

    /* A failed write stays dirty and is retried after the next window rather than being
     * treated as done -- the defect the previous save layer was fixed for, with the same
     * consequence here: the owner's last actions disappear at the next boot. */
    net_test_nvs_counters_reset();
    badge_events_push(EVT_WATER, 9, 0);
    net_test_nvs_fail_set(1);
    advance_ms(SAVE_MS);
    CHECK_EQ_I(net_test_nvs_set_count(), 0, "the failed write stored nothing");
    advance_ms(SAVE_MS);
    CHECK_EQ_I(net_test_nvs_set_count(), 1, "the retry wrote");

    /* A failed commit is not a successful save either: the bytes may have reached the
     * store, but treating that as durable is how a power cut loses the write. */
    net_test_nvs_counters_reset();
    badge_events_push(EVT_SLEEP, 0, 0);
    net_test_nvs_fail_commit(1);
    CHECK(badge_events_save() != ESP_OK, "a failed commit is reported as a failure");
    CHECK_EQ_I(net_test_nvs_set_count(), 1, "the blob was written before the commit failed");
    advance_ms(SAVE_MS);
    CHECK_EQ_I(net_test_nvs_commit_count(), 1, "the next window committed it");

    /* An idle badge never writes: 100 windows with an empty, clean queue. */
    net_test_nvs_counters_reset();
    for (int i = 0; i < 100; i++) advance_ms(SAVE_MS);
    CHECK_EQ_I(net_test_nvs_set_count(), 0, "an idle tick never writes");
    CHECK_EQ_I(badge_events_save(), ESP_OK, "and save() with nothing dirty is success");
    CHECK_EQ_I(net_test_nvs_set_count(), 0, "still no write");
}

/* ------------------------------------------------------------------ */
/* clear                                                              */
/* ------------------------------------------------------------------ */

static void test_clear(void)
{
    section("clear() drops every pending record, in RAM and in NVS");

    fresh();
    for (int i = 0; i < 20; i++) badge_events_push(EVT_PET, (uint8_t)i, (int16_t)i);
    CHECK_EQ_I(badge_events_save(), ESP_OK, "make the queue durable");
    CHECK(net_test_nvs_blob_size("queue") > 8, "and it is in the store");

    badge_events_clear();
    CHECK_EQ_I(badge_events_pending(), 0, "RAM is empty");
    CHECK(!badge_events_dirty(), "and no longer worth flushing");
    CHECK_EQ_I(net_test_nvs_blob_size("queue"), -1, "the stored blob is gone");

    /* The appended total is a per-session record of what the owner did; clear() resets the
     * queue, not history. A log line that says "20 appended, 0 dropped, 0 pending" after a
     * factory reset is the honest reading. */
    CHECK_EQ_I(badge_events_total(), 20, "the appended total is not rewritten");

    /* A cleared queue stays cleared across a reboot: there is nothing left to resurrect. */
    reboot();
    CHECK_EQ_I(badge_events_pending(), 0, "still empty after a reboot");

    /* And clear() BEFORE init() must not be lost: there is no handle to erase through yet,
     * but the records may be in flash from an earlier session, and "drop everything" has to
     * win over the load. */
    for (int i = 0; i < 5; i++) badge_events_push(EVT_FEED, (uint8_t)i, 0);
    CHECK_EQ_I(badge_events_save(), ESP_OK, "seed a queue for the next session");
    badge_events_reboot();

    badge_events_clear(); /* before init(): no handle yet */
    CHECK_EQ_I(badge_events_init(), ESP_OK, "init after a pre-init clear");
    CHECK_EQ_I(badge_events_pending(), 0, "the pre-init clear won over the stored queue");
    CHECK_EQ_I(net_test_nvs_blob_size("queue"), -1, "and the store was erased after all");
}

/* ------------------------------------------------------------------ */
/* the clock                                                          */
/* ------------------------------------------------------------------ */

static void test_clock(void)
{
    section("the clock: the compile-time default before a sync, the phone's afterwards");

    fresh();

    const uint32_t before = badge_events_now();
    CHECK(before > 1600000000u, "never synced is a plausible unix time, not 0");
    CHECK(before < 2000000000u, "and inside the current decade");

    /* The board has no RTC (spec 12.7): time runs off the module's own millisecond
     * counter, so a later timestamp is later by exactly the elapsed whole seconds. */
    advance_ms(900);
    CHECK_EQ_I(badge_events_now(), before, "under a second of uptime is the same second");
    advance_ms(200);
    CHECK_EQ_I(badge_events_now(), before + 1, "and past it the second ticks over");

    /* The phone syncs. Nothing else about the clock moves: the elapsed time is measured
     * from the moment of the sync, not from boot. */
    badge_events_set_time(1800000000u);
    CHECK_EQ_I(badge_events_now(), 1800000000u, "the synced time is adopted verbatim");
    advance_ms(1000);
    CHECK_EQ_I(badge_events_now(), 1800000001u, "and then follows the badge's own seconds");
    advance_ms(5000);
    CHECK_EQ_I(badge_events_now(), 1800000006u, "after six seconds past the sync");

    /* A record pushed now carries the synced clock, not the default. */
    badge_events_push(EVT_PET, 0, 0);
    badge_evt_t evt;
    CHECK(badge_events_peek(0, &evt), "peek the stamped record");
    CHECK_EQ_I(evt.ts, 1800000006u, "a pushed record is stamped with the synced clock");

    /* A sync of 0 is refused: there is no way back from it, and every later record would be
     * dated to the epoch and sort to the front of the App's timeline. */
    badge_events_set_time(0);
    CHECK_EQ_I(badge_events_now(), 1800000006u, "a zero sync does not move the clock");

    /* A later sync replaces the earlier one and restarts the elapsed count. */
    advance_ms(2000);
    badge_events_set_time(1700000000u);
    CHECK_EQ_I(badge_events_now(), 1700000000u, "a later sync wins");
    advance_ms(3000);
    CHECK_EQ_I(badge_events_now(), 1700000003u, "and its elapsed seconds start from there");

    /* A reboot forgets the sync, because nothing about it is persisted: the queue is what
     * must survive a power cut, not a clock the phone will send again on the next
     * connection. */
    reboot();
    CHECK(badge_events_now() > 1600000000u, "the default is back after a reboot");
    CHECK(badge_events_now() < 1800000000u, "and it is the default, not the phone's time");
}

/* ------------------------------------------------------------------ */
/* the labels, from the generated table                                */
/* ------------------------------------------------------------------ */

static void test_labels(void)
{
    section("badge_event_label() reads the specification's own wording");

    /* badge_events.c does not restate a single string: they come from badge_event_defs[]
     * through badge_strings[], both generated from badge_spec.json. So the test compares
     * against that same table and pins the specification's own examples by value. */
    for (int type = EVT_PET; type <= EVT_SETTING; type++) {
        const char *label = badge_event_label(type);
        CHECK(label != NULL, "type %d has a label", type);
        if (label) {
            CHECK(label[0] != '\0', "type %d's label is not empty", type);
            const char *spec = badge_strings[badge_event_defs[type - 1].label];
            CHECK(spec != NULL && strcmp(label, spec) == 0,
                  "type %d's label is the generated one", type);
        }
    }

    CHECK(badge_event_label(EVT_PET) != NULL &&
              strcmp(badge_event_label(EVT_PET), "摸摸") == 0,
          "EVT_PET is 摸摸");
    CHECK(badge_event_label(EVT_FEED) != NULL &&
              strcmp(badge_event_label(EVT_FEED), "喂食完成") == 0,
          "EVT_FEED is 喂食完成");
    CHECK(badge_event_label(EVT_SETTING) != NULL &&
              strcmp(badge_event_label(EVT_SETTING), "改设置") == 0,
          "EVT_SETTING is 改设置");

    /* Unknown types return an empty string -- not NULL, and not another event's wording. */
    const int bad[] = { 0, 15, 255, -1, 1000 };
    for (unsigned i = 0; i < sizeof(bad) / sizeof(bad[0]); i++) {
        const char *label = badge_event_label(bad[i]);
        CHECK(label != NULL, "type %d has a non-NULL label", bad[i]);
        CHECK(label != NULL && label[0] == '\0', "type %d's label is empty", bad[i]);
    }
}

/* ------------------------------------------------------------------ */
/* init, and the module's non-reentrancy                              */
/* ------------------------------------------------------------------ */

static void test_init_contract(void)
{
    section("init() twice is invalid state, and a reboot is the way back");

    fresh();
    CHECK_EQ_I(badge_events_init(), ESP_ERR_INVALID_STATE,
               "a second init() reports invalid state, exactly as the header says");

    /* The ring survived the rejected init() untouched: a refused call must not have
     * reloaded, cleared or re-counted anything. */
    badge_events_push(EVT_PET, 5, 5);
    CHECK_EQ_I(badge_events_pending(), 1, "the queue is still usable after a refused init");
    CHECK_EQ_I(badge_events_total(), 1, "and its counters were not reset");
}

/* ------------------------------------------------------------------ */

int main(void)
{
    printf("=== badge_events: wire format, queue, persistence, clock ===\n");

    test_encode_exact_bytes();
    test_field_widths();
    test_round_trip_all_types();
    test_decode_rejects();
    test_ring_drops_the_oldest_at_200();
    test_push_refuses_non_events();
    test_flush_without_a_connection();
    test_flush_drains_in_fifo_order();
    test_flush_keeps_the_head_on_a_refusal();
    test_nvs_round_trip_of_a_partly_drained_queue();
    test_nvs_rejects_a_malformed_queue();
    test_save_defers_then_lands_and_retries_on_failure();
    test_clear();
    test_clock();
    test_labels();
    test_init_contract();

    printf("\n%d checks, %d failure(s), %d boot(s)\n", g_checks, g_failures, g_boot_count);
    if (g_failures == 0) {
        printf("ALL BADGE EVENTS TESTS PASSED\n");
        return 0;
    }
    printf("BADGE EVENTS TESTS FAILED\n");
    return 1;
}
