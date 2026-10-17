/*
 * The handshake, played out end to end on a PC.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two independent code reviews found the same class of defect in the social layer: a
 * session that can never complete. Both were only reachable by reading the call graph,
 * because exercising the handshake needs two badges and a radio -- and both were invisible
 * to every other test in this repository.
 *
 * The defects were:
 *
 *   1. The responder never recorded its own nonce. CONFIRM/SUMMARY/ICE are admitted by a
 *      "has the peer echoed our nonce?" gate, and on the responder nothing ever put that
 *      nonce into the ring, so it dropped every frame of every session and both sides sat
 *      until the 15 s deadline.
 *   2. handle_hello() tested net_link_connected(), and a HELLO is only ever sent once the
 *      link is up -- so 100% of incoming HELLOs were dropped and the responder never
 *      prompted its owner.
 *
 * Neither is subtle once stated, and both are exactly what this test now catches: it
 * asserts the frames each side sends and the state each side reaches, so a regression shows
 * up as a failed expectation in milliseconds instead of as two badges that quietly do
 * nothing.
 *
 * The REAL main/net/net_social.c is compiled into this test, against stand-ins for
 * ESP-IDF, FreeRTOS, NVS, mbedTLS and the NimBLE link layer. See net_test_harness.h for
 * what that does and does not prove.
 */

#include <stdio.h>
#include <string.h>

#include "net_test_harness.h"

/* For net_test_locks_reset(): the tests create and destroy social instances, and the lock
 * pool has to be returned to its initial state between them or later instances run unlocked. */
#include "freertos/FreeRTOS.h"
#include "net_proto.h"
#include "net_social.h"
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
/* harness                                                            */
/* ------------------------------------------------------------------ */

#define DEV_A 0
#define DEV_B 1

static const uint8_t ID_A[8] = { 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8 };
static const uint8_t ID_B[8] = { 0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8 };

static pet_game_t    g_game[2];
static net_social_t *g_soc[2];

/*
 * One instance per simulated device, in caller-provided storage.
 *
 * net_social_create() returns a singleton because the badge has one radio. Two instances are
 * needed here, and the harness switches the simulated radio per delivery, so each side must
 * also own its own protocol state -- otherwise the two sides share one struct and every
 * device-to-device assertion compares a value with itself.
 *
 * Static rather than automatic so a test can create a "reloaded" instance that outlives the
 * scenario that made it.
 */
static union {
    max_align_t align;                          /* keep the storage suitably aligned */
    unsigned char bytes[NET_SOCIAL_STORAGE_BYTES];
} g_soc_storage[3];   /* two devices, plus one for the reload-after-restart test */

/* What each side's callbacks published, so the test can assert on it. */
static int  g_prompts[2];
static int  g_meetings[2];
static char g_last_ice[2][128];
static char g_last_pet_name[2][PET_NAME_MAX + 1];

/* Frame types, from net_social.h's wire format. */
#define T_HELLO   0x01
#define T_ACK     0x02
#define T_CONFIRM 0x03
#define T_SUMMARY 0x04
#define T_ICE     0x05
#define T_BYE     0x06

static void prompt_cb(const net_encounter_t *who, void *user)
{
    const int idx = (int)(intptr_t)user;
    if (idx < 0 || idx > 1) return;
    g_prompts[idx]++;
    (void)who;
}

static void met_cb(const net_encounter_t *who, const char *icebreaker, void *user)
{
    const int idx = (int)(intptr_t)user;
    if (idx < 0 || idx > 1 || !who) return;
    g_meetings[idx]++;
    snprintf(g_last_ice[idx], sizeof(g_last_ice[idx]), "%s", icebreaker ? icebreaker : "");
    snprintf(g_last_pet_name[idx], sizeof(g_last_pet_name[idx]), "%s", who->pet_name);
}

/* Advance the simulated clock and let both sides poll. */
static void tick_both(int steps, uint32_t ms_per_step)
{
    for (int i = 0; i < steps; i++) {
        net_test_advance_ms(ms_per_step);
        for (int d = 0; d < 2; d++) {
            net_test_link_select(d);
            if (g_soc[d]) net_social_poll(g_soc[d]);
        }
    }
}

static void setup(void)
{
    net_test_nvs_reset();
    net_test_link_reset_counters();
    net_test_locks_reset();
    net_test_seed_random(0xC0FFEEu);
    net_test_time_us = 0;

    memset(g_game, 0, sizeof(g_game));
    memset(g_soc, 0, sizeof(g_soc));
    g_prompts[0] = g_prompts[1] = 0;
    g_meetings[0] = g_meetings[1] = 0;
    memset(g_last_ice, 0, sizeof(g_last_ice));
    memset(g_last_pet_name, 0, sizeof(g_last_pet_name));

    for (int d = 0; d < 2; d++) {
        for (int i = 0; i < 2; i++) net_test_link_set_reachable(d, i, 0);
    }

    net_test_link_register(DEV_A, ID_A);
    net_test_link_select(DEV_A);
    pet_game_init(&g_game[DEV_A]);   /* a fresh family: one cat, named 小橘, active */
    g_soc[DEV_A] = net_social_create_in(&g_soc_storage[DEV_A], sizeof(g_soc_storage[DEV_A]),
                                        &g_game[DEV_A]);
    net_social_set_prompt_cb(g_soc[DEV_A], prompt_cb, (void *)(intptr_t)DEV_A);
    net_social_set_met_cb(g_soc[DEV_A], met_cb, (void *)(intptr_t)DEV_A);

    net_test_link_register(DEV_B, ID_B);
    net_test_link_select(DEV_B);
    pet_game_init(&g_game[DEV_B]);

    /*
     * Adopt a second cat and make it the active one.
     *
     * pet_game_init() gives every fresh family one cat called 小橘, and pet_game_add_cat()
     * appends rather than replaces. So simply calling add_cat() here would leave B's ACTIVE
     * pet still called 小橘 -- the same name as A's -- and every assertion about "each side
     * learned the other's name" would compare 小橘 with 小橘 and pass for the wrong reason.
     * (It did, briefly: the test failed with "A should have learned B's pet name, got 小橘",
     * which is how this was caught.) Setting `active` is what the UI does when the owner
     * swipes to another cat, so the test uses the same mechanism the product does.
     */
    const int b_cat = pet_game_add_cat(&g_game[DEV_B], "小黑", PET_BREED_TUXEDO);
    CHECK(b_cat > 0, "B should have adopted a second cat, got index %d", b_cat);
    g_game[DEV_B].active = (uint8_t)b_cat;

    /* Guard the guard: the two sides must really be showing different pets, or nothing
     * below proves anything. */
    CHECK(strcmp(pet_active_cat_const(&g_game[DEV_A])->name, "小橘") == 0,
          "A's active pet should be 小橘, got [%s]", pet_active_cat_const(&g_game[DEV_A])->name);
    CHECK(strcmp(pet_active_cat_const(&g_game[DEV_B])->name, "小黑") == 0,
          "B's active pet should be 小黑, got [%s]", pet_active_cat_const(&g_game[DEV_B])->name);

    g_soc[DEV_B] = net_social_create_in(&g_soc_storage[DEV_B], sizeof(g_soc_storage[DEV_B]),
                                        &g_game[DEV_B]);
    net_social_set_prompt_cb(g_soc[DEV_B], prompt_cb, (void *)(intptr_t)DEV_B);
    net_social_set_met_cb(g_soc[DEV_B], met_cb, (void *)(intptr_t)DEV_B);

    net_test_link_select(DEV_A);
    net_social_start(g_soc[DEV_A]);
    net_test_link_select(DEV_B);
    net_social_start(g_soc[DEV_B]);

    /* A sees B at touching range so proximity alone is enough to initiate. */
    net_test_link_add_peer(DEV_A, ID_B, -40);
    net_test_link_add_peer(DEV_B, ID_A, -40);
    net_test_link_set_reachable(DEV_A, DEV_B, 1);

    /*
     * Let the proximity stage settle before anything drives the protocol.
     *
     * The stage is derived from the peer table by net_social_poll(), so it is still
     * NET_STAGE_NONE until the first poll -- and request_meeting() refuses at that range.
     * The real firmware polls continuously from its UI task, so by the time an owner taps
     * or the auto-initiate threshold is reached the stage is current; the test has to tick
     * the same path rather than reach past it.
     *
     * 400 ms is deliberate: the auto-initiate path waits 5 s from boot before it acts on
     * its own, so this updates the stage without racing the test for the decision.
     */
    tick_both(2, 200);
    net_test_link_reset_counters();
}

/* The nonce a device put in its own ACK, which is the value a CONFIRM must echo back. */
static uint32_t ack_nonce(int device)
{
    static const int NONCE_OFFSET_IN_PAYLOAD = 8; /* id(8) then nonce(4), minus the 2-byte header */
    const uint8_t *p = net_test_link_sent_data(device, 0);
    const size_t len = net_test_link_sent_len(device, 0);
    if (!p || len < 2 + 12) return 0;
    const uint8_t *q = p + 2 + NONCE_OFFSET_IN_PAYLOAD;
    return ((uint32_t)q[0] << 24) | ((uint32_t)q[1] << 16) | ((uint32_t)q[2] << 8) | (uint32_t)q[3];
}

/* ------------------------------------------------------------------ */
/* the HMAC the protocol relies on                                    */
/* ------------------------------------------------------------------ */

/*
 * Anchored against published vectors. Without this the stand-in HMAC could be wrong in a
 * way that made every tag comparison succeed, and the handshake tests below would pass
 * while proving nothing about the authentication they depend on.
 */
static void test_hmac_backing(void)
{
    printf("\n== the test's own SHA-256/HMAC (else tag checks pass vacuously) ==\n");

    static const uint8_t abc[3] = { 'a', 'b', 'c' };
    uint8_t d[32];
    net_test_sha256(abc, sizeof(abc), d);
    static const uint8_t expect_abc[32] = {
        0xba,0x78,0x16,0xbf,0x8f,0x01,0xcf,0xea,0x41,0x41,0x40,0xde,0x5d,0xae,0x22,0x23,
        0xb0,0x03,0x61,0xa3,0x96,0x17,0x7a,0x9c,0xb4,0x10,0xff,0x61,0xf2,0x00,0x15,0xad
    };
    CHECK(memcmp(d, expect_abc, 32) == 0, "SHA-256(\"abc\") does not match the FIPS vector");

    net_test_sha256((const uint8_t *)"", 0, d);
    static const uint8_t expect_empty[32] = {
        0xe3,0xb0,0xc4,0x42,0x98,0xfc,0x1c,0x14,0x9a,0xfb,0xf4,0xc8,0x99,0x6f,0xb9,0x24,
        0x27,0xae,0x41,0xe4,0x64,0x9b,0x93,0x4c,0xa4,0x95,0x99,0x1b,0x78,0x52,0xb8,0x55
    };
    CHECK(memcmp(d, expect_empty, 32) == 0, "SHA-256(\"\") does not match the FIPS vector");

    /* RFC 4231 case 1: 20-byte key of 0x0b over "Hi There". */
    uint8_t key[20];
    memset(key, 0x0b, sizeof(key));
    static const uint8_t msg[8] = { 'H','i',' ','T','h','e','r','e' };
    uint8_t mac[32];
    net_test_hmac_sha256(key, sizeof(key), msg, sizeof(msg), mac);
    static const uint8_t expect_mac[32] = {
        0xb0,0x34,0x4c,0x61,0xd8,0xdb,0x38,0x53,0x5c,0xa8,0xaf,0xce,0xaf,0x0b,0xf1,0x2b,
        0x88,0x1d,0xc2,0x00,0xc9,0x83,0x3d,0xa7,0x26,0xe9,0x37,0x6c,0x2e,0x32,0xcf,0xf7
    };
    CHECK(memcmp(mac, expect_mac, 32) == 0, "HMAC-SHA256 does not match RFC 4231 case 1");

    /* And it must discriminate: one flipped bit must change the tag. */
    uint8_t msg2[8];
    memcpy(msg2, msg, sizeof(msg));
    msg2[0] ^= 0x01;
    uint8_t mac2[32];
    net_test_hmac_sha256(key, sizeof(key), msg2, sizeof(msg2), mac2);
    CHECK(memcmp(mac, mac2, 32) != 0, "a one-bit change must change the MAC");
}

/* ------------------------------------------------------------------ */
/* the full handshake                                                 */
/* ------------------------------------------------------------------ */

static void test_full_handshake(void)
{
    printf("\n== a complete meeting, both sides ==\n");
    setup();

    net_test_link_select(DEV_A);
    const esp_err_t err = net_social_request_meeting(g_soc[DEV_A]);
    CHECK(err == ESP_OK, "A should be able to request a meeting, got %s", esp_err_to_name(err));

    /* The HELLO goes out from the link-state callback, so it is on the wire immediately. */
    CHECK(net_test_link_sent_count(DEV_A) == 1, "A should have sent exactly the HELLO, got %d",
          net_test_link_sent_count(DEV_A));
    CHECK(net_test_link_sent_type(DEV_A, 0) == T_HELLO,
          "frame 0 from A should be HELLO (0x01), got 0x%02X", net_test_link_sent_type(DEV_A, 0));

    /* Let the peer's task run. Requests produce no reply, so this is all that happens. */
    net_test_link_pump();

    /*
     * B must have been prompted. This is finding (2): the gate in handle_hello used to
     * include net_link_connected(), which is always true at this point, so B silently
     * dropped the HELLO and this counter stayed at zero.
     */
    CHECK(g_prompts[DEV_B] == 1, "B should have been prompted once, got %d", g_prompts[DEV_B]);
    CHECK(net_social_prompt_pending(g_soc[DEV_B]), "B should have a pending prompt");

    /* Nothing about B's pet has been revealed yet -- that is the point of consent. */
    CHECK(net_test_link_sent_count(DEV_B) == 0,
          "B must not send anything before its owner agrees, got %d",
          net_test_link_sent_count(DEV_B));

    /* B's owner accepts. */
    net_test_link_select(DEV_B);
    const esp_err_t aerr = net_social_accept_meeting(g_soc[DEV_B]);
    CHECK(aerr == ESP_OK, "B should be able to accept, got %s", esp_err_to_name(aerr));
    CHECK(!net_social_prompt_pending(g_soc[DEV_B]), "the prompt must be cleared by accepting");
    CHECK(net_test_link_sent_count(DEV_B) == 1, "B should have sent the ACK, got %d",
          net_test_link_sent_count(DEV_B));
    CHECK(net_test_link_sent_type(DEV_B, 0) == T_ACK,
          "B's frame 0 should be ACK (0x02), got 0x%02X", net_test_link_sent_type(DEV_B, 0));

    /*
     * The ACK is 26 bytes. If the MTU were below 29 the transport would refuse it, and
     * this is where the handshake would die.
     */
    CHECK(net_test_link_sent_len(DEV_B, 0) == 26, "the ACK frame should be 26 bytes, got %u",
          (unsigned)net_test_link_sent_len(DEV_B, 0));

    /*
     * Let the rest of the exchange run out. Each pump delivers the frames produced so far
     * and appends whatever they produce, so the whole session completes here -- which is
     * what the two badges do over the following few milliseconds.
     */
    net_test_link_pump();

    /*
     * Now the responder's half. B must send its own SUMMARY and ICE. This is finding (1):
     * without recording its own nonce in handle_confirm, B dropped A's CONFIRM and SUMMARY
     * and sent nothing further, so these counts stayed at zero and both sides timed out.
     */
    CHECK(net_test_link_sent_count(DEV_B) >= 2,
          "B should have sent its SUMMARY (and ICE) after confirming, got %d frame(s) total",
          net_test_link_sent_count(DEV_B));

    /* A should have completed too: HELLO + CONFIRM + SUMMARY (+ ICE). */
    CHECK(net_test_link_sent_count(DEV_A) >= 3,
          "A should have sent HELLO + CONFIRM + SUMMARY (and ICE), got %d",
          net_test_link_sent_count(DEV_A));

    CHECK(net_social_state(g_soc[DEV_A]) == SOC_ICE_BROKEN,
          "A should be in ICE_BROKEN, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_A])));
    CHECK(net_social_state(g_soc[DEV_B]) == SOC_ICE_BROKEN,
          "B should be in ICE_BROKEN, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_B])));

    CHECK(g_meetings[DEV_A] == 1, "A should have recorded one meeting, got %d", g_meetings[DEV_A]);
    CHECK(g_meetings[DEV_B] == 1, "B should have recorded one meeting, got %d", g_meetings[DEV_B]);

    /* Each side learned the other's pet name, and it is not its own. */
    CHECK(strcmp(g_last_pet_name[DEV_A], "小黑") == 0,
          "A should have learned B's pet name, got [%s]", g_last_pet_name[DEV_A]);
    CHECK(strcmp(g_last_pet_name[DEV_B], "小橘") == 0,
          "B should have learned A's pet name, got [%s]", g_last_pet_name[DEV_B]);

    /*
     * The shared line: both devices must independently choose the same sentence. That is the
     * property net_icebreaker() is built around and the reason its hash sorts the two pets
     * first; if the two disagreed, the "shared moment" would be one-sided.
     */
    CHECK(g_last_ice[DEV_A][0] != '\0', "A should have an icebreaker to show");
    CHECK(strcmp(g_last_ice[DEV_A], g_last_ice[DEV_B]) == 0,
          "both sides must pick the same icebreaker:\n    A=[%s]\n    B=[%s]",
          g_last_ice[DEV_A], g_last_ice[DEV_B]);

    /* Both are in the encounter log. */
    CHECK(net_social_encounter_count(g_soc[DEV_A]) == 1,
          "A should have one cached encounter, got %d", net_social_encounter_count(g_soc[DEV_A]));
    CHECK(net_social_encounter_count(g_soc[DEV_B]) == 1,
          "B should have one cached encounter, got %d", net_social_encounter_count(g_soc[DEV_B]));

    net_dex_t dex;
    net_social_dex_copy(g_soc[DEV_A], &dex);
    CHECK(dex.peer_count == 1, "A's dex should know one peer, got %u", dex.peer_count);
    CHECK(dex.encounter_count == 1, "A's dex should have one encounter, got %u", dex.encounter_count);

    net_encounter_t e;
    CHECK(net_social_get_encounter(g_soc[DEV_A], 0, &e), "A should be able to read encounter 0");
    CHECK(e.times_met == 1, "a first meeting should have times_met 1, got %u", e.times_met);
    CHECK(e.breed == PET_BREED_TUXEDO, "A should have recorded B's breed, got %u", e.breed);
}

static void test_frame_sequence(void)
{
    printf("\n== the frames each side actually sends ==\n");
    setup();

    net_test_link_select(DEV_A);
    (void)net_social_request_meeting(g_soc[DEV_A]);
    net_test_link_select(DEV_B);
    (void)net_social_accept_meeting(g_soc[DEV_B]);
    net_test_link_pump();

    /*
     * The order is part of the protocol, not an implementation detail: the summary follows
     * the CONFIRM on the initiator, and the ACK precedes the summary on the responder. Both
     * sides send their summary exactly once.
     */
    const uint8_t want_a[] = { T_HELLO, T_CONFIRM, T_SUMMARY, T_ICE };
    const int a_n = net_test_link_sent_count(DEV_A);
    CHECK(a_n == 4, "A should have sent 4 frames, got %d", a_n);
    for (int i = 0; i < a_n && i < 4; i++) {
        CHECK(net_test_link_sent_type(DEV_A, i) == want_a[i],
              "A frame %d should be 0x%02X, got 0x%02X",
              i, want_a[i], net_test_link_sent_type(DEV_A, i));
    }

    const uint8_t want_b[] = { T_ACK, T_SUMMARY, T_ICE };
    const int b_n = net_test_link_sent_count(DEV_B);
    CHECK(b_n == 3, "B should have sent 3 frames, got %d", b_n);
    for (int i = 0; i < b_n && i < 3; i++) {
        CHECK(net_test_link_sent_type(DEV_B, i) == want_b[i],
              "B frame %d should be 0x%02X, got 0x%02X",
              i, want_b[i], net_test_link_sent_type(DEV_B, i));
    }

    /* Every frame must fit the protocol's own maximum. */
    for (int d = 0; d < 2; d++) {
        for (int i = 0; i < net_test_link_sent_count(d); i++) {
            const size_t len = net_test_link_sent_len(d, i);
            CHECK(len >= 2 && len <= NET_FRAME_MAX, "device %d frame %d is %u bytes",
                  d, i, (unsigned)len);
        }
    }
}

/* ------------------------------------------------------------------ */
/* the consent gate                                                   */
/* ------------------------------------------------------------------ */

static void test_no_reveal_without_consent(void)
{
    printf("\n== nothing of ours leaves before the owner agrees ==\n");
    setup();

    net_test_link_select(DEV_A);
    (void)net_social_request_meeting(g_soc[DEV_A]);
    CHECK(net_test_link_sent_count(DEV_A) == 1, "A only sends the HELLO, got %d",
          net_test_link_sent_count(DEV_A));

    net_test_link_select(DEV_B);
    CHECK(net_social_prompt_pending(g_soc[DEV_B]), "B is prompted");
    net_social_decline_meeting(g_soc[DEV_B]);
    CHECK(!net_social_prompt_pending(g_soc[DEV_B]), "declining clears the prompt");

    for (int i = 0; i < net_test_link_sent_count(DEV_B); i++) {
        const int t = net_test_link_sent_type(DEV_B, i);
        CHECK(t == T_BYE, "after declining, B must only have sent BYE, got type 0x%02X", t);
    }

    tick_both(20, 100);
    for (int i = 0; i < net_test_link_sent_count(DEV_B); i++) {
        const int t = net_test_link_sent_type(DEV_B, i);
        CHECK(t != T_SUMMARY && t != T_ICE,
              "B must never send SUMMARY/ICE after declining, got 0x%02X", t);
    }
}

/*
 * A forged CONFIRM must not open a session.
 *
 * CONFIRM carries no tag, so before the guard was added a peer could send CONFIRM(0) --
 * which compared equal to the responder's still-unset nonce -- and make it run
 * send_summary() for a session whose owner was never asked.
 */
static void test_forged_confirm_is_rejected(void)
{
    printf("\n== a forged CONFIRM cannot open a session ==\n");
    setup();

    /* Establish the link so B has a peer, then ask B's owner nothing. */
    net_test_link_select(DEV_A);
    (void)net_social_request_meeting(g_soc[DEV_A]);
    net_test_link_pump();
    CHECK(net_social_prompt_pending(g_soc[DEV_B]), "B is prompted and has not answered");

    /* CONFIRM with a zero nonce -- the value that used to match an unset one. */
    const uint8_t forged_zero[6] = { T_CONFIRM, 0x04, 0x00, 0x00, 0x00, 0x00 };
    net_test_link_select(DEV_B);
    net_test_link_inject(DEV_B, forged_zero, sizeof(forged_zero));

    CHECK(net_test_link_sent_count(DEV_B) == 0,
          "B must not answer a CONFIRM it never solicited, got %d frame(s)",
          net_test_link_sent_count(DEV_B));
    CHECK(g_meetings[DEV_B] == 0, "B must not record a meeting it never agreed to");
    CHECK(net_social_state(g_soc[DEV_B]) != SOC_CONFIRMED,
          "a forged CONFIRM must not confirm the session, state=%s",
          net_social_state_name(net_social_state(g_soc[DEV_B])));

    /* A CONFIRM with a nonce that is merely wrong must be rejected too. */
    const uint8_t forged_wrong[6] = { T_CONFIRM, 0x04, 0x11, 0x22, 0x33, 0x44 };
    net_test_link_inject(DEV_B, forged_wrong, sizeof(forged_wrong));
    CHECK(net_test_link_sent_count(DEV_B) == 0,
          "a CONFIRM carrying the wrong nonce must be ignored, got %d frame(s)",
          net_test_link_sent_count(DEV_B));
}

/*
 * The precise regression test for finding (1).
 *
 * After B's owner accepts, B's ACK carries B's own nonce -- the value a genuine CONFIRM
 * echoes. Injecting that CONFIRM must make B record its nonce, confirm, and disclose its
 * summary. Before the fix, B never recorded its own nonce, so the SUMMARY and ICE it sent
 * after confirming were dropped by its own gate and this device could never complete a
 * session -- the bug that made every handshake time out.
 */
static void test_responder_completes_after_confirm(void)
{
    printf("\n== the responder records its own nonce and finishes ==\n");
    setup();

    net_test_link_select(DEV_A);
    (void)net_social_request_meeting(g_soc[DEV_A]);
    net_test_link_select(DEV_B);
    (void)net_social_accept_meeting(g_soc[DEV_B]);

    const uint32_t b_nonce = ack_nonce(DEV_B);
    CHECK(b_nonce != 0, "B's ACK should carry a non-zero nonce");

    /* A's CONFIRM echoes B's nonce; the length is the nonce plus the 2-byte header. */
    uint8_t confirm[6];
    confirm[0] = T_CONFIRM;
    confirm[1] = 0x04;
    confirm[2] = (uint8_t)(b_nonce >> 24);
    confirm[3] = (uint8_t)(b_nonce >> 16);
    confirm[4] = (uint8_t)(b_nonce >> 8);
    confirm[5] = (uint8_t)(b_nonce);

    const int before = net_test_link_sent_count(DEV_B);
    net_test_link_inject(DEV_B, confirm, sizeof(confirm));

    CHECK(net_social_state(g_soc[DEV_B]) == SOC_CONFIRMED ||
          net_social_state(g_soc[DEV_B]) == SOC_ICE_BROKEN,
          "B should have confirmed, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_B])));

    /*
     * This is the assertion that fails when the remember_nonce(s, s->our_nonce) call is
     * removed: B sends a SUMMARY, but its own gate then drops the ICE and the summary it
     * would accept from the peer.
     */
    const int after = net_test_link_sent_count(DEV_B);
    CHECK(after > before, "B must send its SUMMARY after a valid CONFIRM (%d -> %d)", before, after);

    int summary_seen = 0;
    for (int i = 0; i < after; i++) {
        if (net_test_link_sent_type(DEV_B, i) == T_SUMMARY) summary_seen = 1;
    }
    CHECK(summary_seen, "B should have sent a SUMMARY frame");
}

/* ------------------------------------------------------------------ */
/* the stall timeout                                                  */
/* ------------------------------------------------------------------ */

/*
 * A session whose peer stops answering must be abandoned and discovery resumed. Without the
 * deadline, A would sit in HELLO_SENT forever and the auto-initiate path -- which requires
 * SOC_SCANNING -- would never run again.
 */
static void test_abandoned_session_times_out(void)
{
    printf("\n== an abandoned session is torn down and discovery resumes ==\n");
    setup();

    net_test_link_select(DEV_A);
    (void)net_social_request_meeting(g_soc[DEV_A]);
    /*
     * The HELLO was sent from the link-state callback during the connect, so the state is
     * still SOC_SCANNING until the next poll promotes it. Poll once before asserting, which
     * is what the UI task does on its 20 ms tick.
     */
    net_test_advance_ms(200);
    net_social_poll(g_soc[DEV_A]);

    CHECK(net_social_state(g_soc[DEV_A]) == SOC_HELLO_SENT,
          "A is waiting for an ACK, got %s", net_social_state_name(net_social_state(g_soc[DEV_A])));

    /* The peer never answers. Poll to just under the 15 s deadline, then past it. */
    tick_both(48, 200);   /* ~9.6 s more */
    CHECK(net_social_state(g_soc[DEV_A]) == SOC_HELLO_SENT,
          "A must still be waiting before the deadline, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_A])));

    tick_both(40, 200);   /* another 8 s */
    CHECK(net_social_state(g_soc[DEV_A]) == SOC_SCANNING,
          "A must have given up and gone back to scanning, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_A])));

    /*
     * Discovery must have resumed, and this is where the test earns its keep: the sequence is
     * not the obvious one.
     *
     * A times out and disconnects. That disconnect resets B as well (see on_link_state): B's
     * pending prompt is dropped, because a prompt about a peer that has gone away must not
     * survive. B is then idle, still has A in range, and its own auto-initiate fires -- so the
     * second HELLO in this scenario comes from B, not from A, and A ends up showing a fresh
     * prompt. Both directions are correct. What must not happen is either badge sitting on the
     * session that was abandoned.
     *
     * An earlier version asserted "A should have sent a second HELLO" and "request_meeting()
     * succeeds here". The first was wrong about who re-initiates; the second passed only
     * because request_meeting() had no state guard and would restart a live session, so it was
     * encoding the defect. Both are replaced with the observable property.
     */
    const net_social_state_t st = net_social_state(g_soc[DEV_A]);
    CHECK(st == SOC_SCANNING || st == SOC_HELLO_SENT,
          "A must have resumed discovery rather than stalled, got %s",
          net_social_state_name(st));

    /* A fresh session exists on the wire: two HELLOs, from whichever side got there first. */
    int hellos = 0;
    for (int d = 0; d < 2; d++) {
        for (int i = 0; i < net_test_link_sent_count(d); i++) {
            if (net_test_link_sent_type(d, i) == T_HELLO) hellos++;
        }
    }
    CHECK(hellos >= 2, "a fresh session must have begun after the timeout, HELLOs=%d", hellos);

    /* A is either running that session, or being asked about it. Both mean it is not stuck. */
    const bool a_busy = (st == SOC_HELLO_SENT) || net_social_prompt_pending(g_soc[DEV_A]);
    CHECK(a_busy, "A must be in a fresh session or answering a fresh prompt, got state=%s pending=%d",
          net_social_state_name(st), net_social_prompt_pending(g_soc[DEV_A]) ? 1 : 0);

    /* And in the genuinely idle case, a request must still be accepted -- the guard is not a
     * lockout. (Skipped when a session is already running, because refusing there is correct.) */
    if (!a_busy) {
        net_test_link_select(DEV_A);
        const esp_err_t err = net_social_request_meeting(g_soc[DEV_A]);
        CHECK(err == ESP_OK, "an idle A should be able to try again, got %s",
              esp_err_to_name(err));
    }
}

/* ------------------------------------------------------------------ */
/* replay and duplicate suppression                                   */
/* ------------------------------------------------------------------ */

static void test_replay_is_dropped(void)
{
    printf("\n== a repeated frame does not open a second session ==\n");

    /* The ring itself is covered in depth by test_net_proto.c; this checks the wiring. */
    net_nonce_ring_t r;
    net_nonce_reset(&r);
    net_nonce_remember(&r, 0xDEADBEEFu);
    CHECK(net_nonce_seen(&r, 0xDEADBEEFu), "the ring should report the nonce it holds");
    net_nonce_remember(&r, 0xDEADBEEFu);
    CHECK(r.count == 1, "a repeated nonce must not consume a second slot, count=%d", r.count);

    setup();
    net_test_link_select(DEV_A);
    (void)net_social_request_meeting(g_soc[DEV_A]);

    /*
     * A second request while the first is in flight must not produce a second HELLO, or two
     * badges standing together would trade HELLOs indefinitely.
     */
    const int before = net_test_link_sent_count(DEV_A);
    const esp_err_t again = net_social_request_meeting(g_soc[DEV_A]);
    CHECK(again == ESP_ERR_INVALID_STATE,
          "a second request must be refused outright, got %s", esp_err_to_name(again));
    CHECK(net_test_link_sent_count(DEV_A) == before,
          "a second request inside a live session must not send another HELLO (%d -> %d)",
          before, net_test_link_sent_count(DEV_A));
}

/*
 * A pending prompt leaves `state` at SOC_SCANNING, so a naive state check would let our own
 * owner's tap overwrite the nonce the peer is answering. This pins the guard that stops it:
 * while B is being asked about A's HELLO, B must not be able to start its own request.
 */
static void test_pending_prompt_blocks_our_own_request(void)
{
    printf("\n== a pending prompt blocks our own request ==\n");
    setup();

    net_test_link_select(DEV_A);
    (void)net_social_request_meeting(g_soc[DEV_A]);
    net_test_link_pump();

    net_test_link_select(DEV_B);
    CHECK(net_social_prompt_pending(g_soc[DEV_B]), "B should have a pending prompt");
    CHECK(net_social_state(g_soc[DEV_B]) == SOC_SCANNING,
          "the state during a prompt is still SCANNING, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_B])));

    const int before = net_test_link_sent_count(DEV_B);
    const esp_err_t err = net_social_request_meeting(g_soc[DEV_B]);
    CHECK(err == ESP_ERR_INVALID_STATE,
          "B must not be able to request a meeting while answering A, got %s",
          esp_err_to_name(err));
    CHECK(net_test_link_sent_count(DEV_B) == before,
          "B must not have sent a HELLO of its own (%d -> %d)",
          before, net_test_link_sent_count(DEV_B));

    /*
     * ...and the way out must still work: answering the prompt remains possible, which is
     * what makes this a guard rather than a deadlock.
     */
    CHECK(net_social_accept_meeting(g_soc[DEV_B]) == ESP_OK,
          "B must still be able to accept the prompt it was asked about");
}

/* ------------------------------------------------------------------ */
/* persistence                                                        */
/* ------------------------------------------------------------------ */

/*
 * The encounter must reach NVS, and it must do so off the receive callback: the write is
 * deferred to net_social_poll() precisely so flash programming does not stall the radio
 * task that is mid-handshake.
 */
static void test_encounter_is_persisted_on_poll(void)
{
    printf("\n== the meeting reaches NVS, on the poll path ==\n");
    setup();

    net_test_link_select(DEV_A);
    (void)net_social_request_meeting(g_soc[DEV_A]);
    net_test_link_select(DEV_B);
    (void)net_social_accept_meeting(g_soc[DEV_B]);
    net_test_link_pump();   /* the ACK reaches A, which confirms and summarises */

    CHECK(g_meetings[DEV_A] == 1, "A recorded the meeting during the handshake");

    /*
     * net_social_poll() is what flushes: record_encounter() only sets a dirty flag, and the
     * NVS write happens here, on the app task, rather than inside the radio callback.
     *
     * The clock has to move first. poll() starts with a 200 ms rate limit, so on a badge that
     * is ticking at 50 Hz the flush lands within one or two ticks of the meeting -- but a
     * test that polls twice in the same millisecond silently skips it. That is worth knowing:
     * the persistence window is bounded by the poll period, not by the write.
     */
    net_test_link_select(DEV_A);
    net_test_advance_ms(250);
    net_social_poll(g_soc[DEV_A]);
    CHECK(net_social_encounter_count(g_soc[DEV_A]) == 1,
          "the encounter is in memory, got %d", net_social_encounter_count(g_soc[DEV_A]));

    /*
     * A fresh instance must load what was written. This is the round trip that proves the
     * flush happened, rather than the count being an in-memory artefact.
     */
    net_social_t *reloaded = net_social_create_in(&g_soc_storage[2], sizeof(g_soc_storage[2]),
                                                 &g_game[DEV_A]);
    CHECK(reloaded != NULL, "a second create should succeed");
    CHECK(net_social_encounter_count(reloaded) == 1,
          "the reloaded instance should see the stored encounter, got %d",
          net_social_encounter_count(reloaded));

    net_dex_t dex;
    net_social_dex_copy(reloaded, &dex);
    CHECK(dex.peer_count == 1, "the reloaded dex should know one peer, got %u", dex.peer_count);

    net_encounter_t e;
    CHECK(net_social_get_encounter(reloaded, 0, &e), "the stored encounter should be readable");
    CHECK(e.breed == PET_BREED_TUXEDO,
          "the stored breed should survive the round trip, got %u", e.breed);
    CHECK(strcmp(e.pet_name, "小黑") == 0,
          "the stored pet name should survive the round trip, got [%s]", e.pet_name);
}

/* ------------------------------------------------------------------ */
/* out of range, and the MTU bound                                    */
/* ------------------------------------------------------------------ */

static void test_out_of_range_does_not_connect(void)
{
    printf("\n== a peer out of range is not connectable ==\n");
    setup();

    /* Still discoverable, but the radio cannot reach it. */
    net_test_link_set_reachable(DEV_A, DEV_B, 0);

    net_test_link_select(DEV_A);
    const esp_err_t err = net_social_request_meeting(g_soc[DEV_A]);
    CHECK(err != ESP_OK, "connecting out of range must fail, got %s", esp_err_to_name(err));

    /*
     * Nothing may be revealed: the HELLO is sent from the link-state callback, which never
     * fired because no link was established.
     */
    CHECK(net_test_link_sent_count(DEV_A) == 0,
          "an out-of-range attempt must not transmit, got %d frame(s)",
          net_test_link_sent_count(DEV_A));
    CHECK(!net_social_prompt_pending(g_soc[DEV_B]), "B must not be prompted by a failed connect");

    /*
     * And the failed attempt must not leave a deadline armed: the next attempt must be able
     * to proceed immediately rather than waiting for a session that never started.
     */
    net_test_link_set_reachable(DEV_A, DEV_B, 1);
    const esp_err_t again = net_social_request_meeting(g_soc[DEV_A]);
    CHECK(again == ESP_OK, "A should be able to try again once in range, got %s",
          esp_err_to_name(again));
}

static void test_frame_size_respects_mtu(void)
{
    printf("\n== frames must fit one ATT write ==\n");
    setup();

    /*
     * A deliberately small MTU, tied to the actual frame sizes rather than to round
     * numbers.
     *
     * HELLO is 22 bytes: a 2-byte header, the 8-byte id, a 4-byte nonce and an 8-byte tag.
     * The ACK is 26: a 2-byte header, 8-byte id, two 4-byte nonces and the tag. So an MTU of
     * 24 admits the HELLO (payload 22 <= 21? no: mtu-3 = 21) -- which is exactly the point:
     * at 24 the HELLO itself is refused, and at 29 the ACK is. The test picks the boundary
     * that isolates the ACK, because that is the frame the responder must send to make any
     * progress.
     */
    net_test_link_settings(DEV_A, 29);   /* 29 - 3 = 26: the ACK just fits */
    net_test_link_settings(DEV_B, 28);   /* 28 - 3 = 25: the ACK does not */

    net_test_link_select(DEV_A);
    const esp_err_t err = net_social_request_meeting(g_soc[DEV_A]);
    CHECK(err == ESP_OK, "the request itself should still succeed, got %s", esp_err_to_name(err));
    CHECK(net_test_link_sent_count(DEV_A) == 1,
          "A's HELLO is 22 bytes and fits an MTU of 29, got %d frame(s)",
          net_test_link_sent_count(DEV_A));

    net_test_link_select(DEV_B);
    CHECK(g_prompts[DEV_B] == 1, "B was prompted, got %d", g_prompts[DEV_B]);

    const int before = net_test_link_refused_sends();
    const esp_err_t aerr = net_social_accept_meeting(g_soc[DEV_B]);
    CHECK(aerr != ESP_OK, "accepting must fail when the ACK cannot be sent, got %s",
          esp_err_to_name(aerr));
    CHECK(net_test_link_refused_sends() > before,
          "the transport should have refused the oversized ACK");
    CHECK(net_test_link_sent_count(DEV_B) == 0,
          "nothing may be recorded as sent when the transport refused it, got %d",
          net_test_link_sent_count(DEV_B));

    /*
     * The failure must leave B ready to be asked again, not holding an invisible prompt.
     *
     * The caller (main.c) hides the dialog before it learns the accept failed, so a prompt that
     * survived the failure would be one the owner can no longer see or dismiss while it
     * silently blocked every subsequent HELLO from this peer. The honest state is "the owner
     * agreed, the radio did not" -- idle, and immediately reachable.
     */
    CHECK(!net_social_prompt_pending(g_soc[DEV_B]),
          "a failed accept must not leave an invisible pending prompt");
    CHECK(net_social_state(g_soc[DEV_B]) == SOC_SCANNING,
          "B must be idle after a failed accept, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_B])));

    /*
     * And a fresh meeting at an MTU that fits must still work, so the test is not just
     * asserting that everything fails.
     *
     * A is still waiting for the ACK it will never receive, so its own deadline has to tear
     * the first attempt down first. Both sides then reach idle, and a completely fresh
     * handshake has to complete -- which also exercises the recovery path end to end rather
     * than only its first step.
     */
    net_test_link_settings(DEV_B, 29);
    for (int i = 0; i < 100 && net_social_state(g_soc[DEV_A]) != SOC_SCANNING; i++) {
        net_test_advance_ms(200);
        net_test_link_select(DEV_A);
        net_social_poll(g_soc[DEV_A]);
        net_test_link_pump();
    }
    CHECK(net_social_state(g_soc[DEV_A]) == SOC_SCANNING,
          "A's deadline must have torn the failed attempt down, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_A])));

    int refusals = 0;
    for (int i = 0; i < 150 && g_meetings[DEV_A] == 0; i++) {
        net_test_advance_ms(200);
        for (int d = 0; d < 2; d++) {
            net_test_link_select(d);
            net_social_poll(g_soc[d]);
            if (net_social_prompt_pending(g_soc[d]) &&
                net_social_accept_meeting(g_soc[d]) != ESP_OK) {
                refusals++;
            }
        }
        net_test_link_pump();
    }
    CHECK(refusals == 0, "the ACK must fit now, got %d refusal(s)", refusals);
    CHECK(g_meetings[DEV_A] == 1,
          "a meeting at an MTU that fits the ACK must complete, got %d", g_meetings[DEV_A]);
}

/* ------------------------------------------------------------------ */
/* regressions found by review, not by this suite                     */
/* ------------------------------------------------------------------ */

/*
 * Two meetings in a row, on the same instances.
 *
 * The suite had no such test, and that is precisely why it could not see the defect it now
 * guards: `has_active` was cleared in the poll deadline branch and nowhere else, while the
 * link-drop path -- which is how the side that did NOT lose the deadline race learns the
 * session is over -- cleared everything except that flag and zeroed the deadline, making the
 * deadline branch unreachable for it. The result was a badge that could neither initiate
 * (poll requires !has_active) nor accept (handle_hello refuses while it is set) for the rest
 * of the boot: two badges together, and exactly one of them permanently unable to say hello.
 *
 * A second meeting is impossible in that state, which is what makes this a real regression
 * test rather than a restatement of the code.
 */
static void test_two_meetings_in_a_row(void)
{
    printf("\n== a second meeting happens after the first one ends ==\n");
    setup();

    /* ---- meeting #1, played out exactly as test_full_handshake does ---- */
    net_test_link_select(DEV_A);
    CHECK(net_social_request_meeting(g_soc[DEV_A]) == ESP_OK, "the first request should succeed");
    net_test_link_pump();
    CHECK(g_prompts[DEV_B] == 1, "B should be prompted for the first meeting, got %d",
          g_prompts[DEV_B]);

    net_test_link_select(DEV_B);
    CHECK(net_social_accept_meeting(g_soc[DEV_B]) == ESP_OK, "B should accept the first meeting");
    net_test_link_pump();

    CHECK(g_meetings[DEV_A] == 1 && g_meetings[DEV_B] == 1,
          "the first meeting should have been recorded on both sides, got %d and %d",
          g_meetings[DEV_A], g_meetings[DEV_B]);

    /*
     * Let the first session's own deadline tear it down, and stop at the moment it does.
     *
     * Only A polls, deliberately: both badges auto-initiate as soon as they are idle with a
     * peer at touching range, so ticking both for 20 s does not leave them idle -- one of them
     * starts meeting #2 by itself, which is correct product behaviour but makes the rest of
     * this test depend on a race. Even polling A alone will re-initiate 5 s after the timeout,
     * so the loop breaks as soon as the teardown is observed rather than running on.
     *
     * The disconnect reaches B through its own state callback, so B is reset here too -- and
     * that callback is exactly the path that used to leave `has_active` latched.
     */
    for (int i = 0; i < 100; i++) {
        net_test_advance_ms(200);
        net_test_link_select(DEV_A);
        net_social_poll(g_soc[DEV_A]);
        net_test_link_pump();
        if (net_social_state(g_soc[DEV_A]) == SOC_SCANNING) break;
    }

    CHECK(net_social_state(g_soc[DEV_A]) == SOC_SCANNING,
          "A should be back to scanning after meeting #1, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_A])));
    CHECK(net_social_state(g_soc[DEV_B]) == SOC_SCANNING,
          "B should be back to scanning after meeting #1, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_B])));

    /*
     * Neither side may still be holding the first meeting. `has_active` is what made the
     * badge refuse both roles, so asserting the observable form of it -- "I will accept a
     * HELLO" -- is what actually pins the regression.
     */
    CHECK(!net_social_prompt_pending(g_soc[DEV_A]) && !net_social_prompt_pending(g_soc[DEV_B]),
          "no stale prompt may survive the teardown");

    /*
     * Both must still be reachable and in range, or a failed second meeting would say nothing
     * about the flags. (The teardown drops the connection, not the discovery table.)
     */
    net_test_link_select(DEV_A);
    CHECK(net_link_peer_count() > 0, "the peer should still be in range after the teardown");
    CHECK(net_social_stage(g_soc[DEV_A]) >= NET_STAGE_TOUCHING,
          "A should still see a peer at touching range, got %s",
          net_stage_name(net_social_stage(g_soc[DEV_A])));

    /*
     * ---- meeting #2, driven the way the product drives it ----
     *
     * This is the part the old suite could not reach. In the broken build the side that lost
     * the first teardown stayed latched with `has_active`, so it refused the other's HELLO
     * outright and could not initiate either -- and because it was mute in both roles, nothing
     * here noticed.
     *
     * Both sides are polled and every prompt is answered as it appears, which is what the
     * owner does with the "认识一下" button. Whether the second meeting is started by A or by
     * B is a race between their auto-initiate timers and is not the property under test: that
     * a second meeting completes at all is.
     */
    int accept_failures = 0;
    for (int i = 0; i < 150 && g_meetings[DEV_A] < 2; i++) {
        net_test_advance_ms(200);
        for (int d = 0; d < 2; d++) {
            net_test_link_select(d);
            net_social_poll(g_soc[d]);
            if (net_social_prompt_pending(g_soc[d]) &&
                net_social_accept_meeting(g_soc[d]) != ESP_OK) {
                accept_failures++;
            }
        }
        net_test_link_pump();
    }

    CHECK(accept_failures == 0, "every prompt must be acceptable, got %d refusal(s)",
          accept_failures);

    CHECK(g_meetings[DEV_A] == 2, "A must record the second meeting, got %d", g_meetings[DEV_A]);
    CHECK(g_meetings[DEV_B] == 2, "B must record the second meeting, got %d", g_meetings[DEV_B]);

    /* Which is the observable consequence of the fix: neither side is latched any more. */
    CHECK(net_social_state(g_soc[DEV_A]) == SOC_ICE_BROKEN,
          "A should have completed the second meeting, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_A])));
    CHECK(net_social_state(g_soc[DEV_B]) == SOC_ICE_BROKEN,
          "B should have completed the second meeting, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_B])));
}

/*
 * The HELLO must survive being refused by the transport.
 *
 * This is the defect that made the initiator's meeting impossible on hardware: net_link runs
 * the peer's GATT discovery from inside the CONNECT event and calls the state callback right
 * after, so when send_hello() ran, the peer's characteristic handle was still 0 and the real
 * net_link_send() returned ESP_ERR_INVALID_STATE. The old code marked `helloSent` regardless,
 * so nothing retried: the badge sat out the full 15 s deadline waiting for an answer to a
 * frame that never left the radio.
 *
 * Without the retry this test fails at the first prompt assertion -- zero frames are sent and
 * the peer is never told anything.
 */
static void test_hello_survives_a_refused_send(void)
{
    printf("\n== the HELLO is delivered once the link becomes sendable ==\n");
    setup();

    /* Model the discovery window: connected, but our peer's handle is not known yet. */
    net_test_link_set_sendable(DEV_A, 0);

    net_test_link_select(DEV_A);
    const esp_err_t err = net_social_request_meeting(g_soc[DEV_A]);
    CHECK(err == ESP_OK, "the request should arm the session, got %s", esp_err_to_name(err));

    CHECK(net_test_link_sent_count(DEV_A) == 0,
          "nothing may be recorded as sent while the transport refuses, got %d",
          net_test_link_sent_count(DEV_A));

    /* The deadline is armed, so the session is still on: polling must not give up yet. */
    tick_both(5, 200);

    CHECK(net_test_link_sent_count(DEV_A) == 0,
          "the HELLO must not be claimed as sent while it is undeliverable, got %d",
          net_test_link_sent_count(DEV_A));
    CHECK(net_social_state(g_soc[DEV_A]) != SOC_IDLE,
          "the session must still be pending, not abandoned, got %s",
          net_social_state_name(net_social_state(g_soc[DEV_A])));

    /* Discovery finishes. The next poll must deliver the held HELLO by itself. */
    net_test_link_set_sendable(DEV_A, 1);
    tick_both(2, 200);

    CHECK(net_test_link_sent_count(DEV_A) == 1,
          "the held HELLO must be delivered once the link is sendable, got %d frame(s)",
          net_test_link_sent_count(DEV_A));
    CHECK(net_test_link_sent_type(DEV_A, 0) == T_HELLO,
          "the delivered frame should be the HELLO, got 0x%02X",
          net_test_link_sent_type(DEV_A, 0));

    net_test_link_pump();
    CHECK(g_prompts[DEV_B] == 1,
          "B must be prompted by the late HELLO, got %d prompt(s)", g_prompts[DEV_B]);

    /* And the rest of the handshake still completes from there. */
    net_test_link_select(DEV_B);
    CHECK(net_social_accept_meeting(g_soc[DEV_B]) == ESP_OK, "B should accept");
    net_test_link_pump();
    CHECK(g_meetings[DEV_A] == 1, "the meeting should complete despite the late HELLO, got %d",
          g_meetings[DEV_A]);
}

/*
 * The ICE frame must carry the NUL that its receiver requires.
 *
 * The send side omitted the terminator while handle_ice() rejected any payload whose last byte
 * was not NUL, so the frame was dropped every single time. It was invisible because
 * net_icebreaker() is a pure function of the two pets, so both badges already display the same
 * sentence -- what was actually broken was the peer's line ever replacing ours, which is the
 * frame's entire purpose and the documented phase-two hook for an LLM-generated line.
 *
 * Checking the bytes on the wire is what pins the two halves together; a callback-level
 * assertion cannot see it, because the sentences are identical by construction.
 */
static void test_ice_frame_carries_its_terminator(void)
{
    printf("\n== the ICE frame carries the NUL the receiver needs ==\n");
    setup();

    net_test_link_select(DEV_A);
    CHECK(net_social_request_meeting(g_soc[DEV_A]) == ESP_OK, "A should request a meeting");
    net_test_link_pump();
    net_test_link_select(DEV_B);
    CHECK(net_social_accept_meeting(g_soc[DEV_B]) == ESP_OK, "B should accept");
    net_test_link_pump();

    for (int d = 0; d < 2; d++) {
        int ice_index = -1;
        for (int i = 0; i < net_test_link_sent_count(d); i++) {
            if (net_test_link_sent_type(d, i) == T_ICE) { ice_index = i; break; }
        }
        CHECK(ice_index >= 0, "device %d should have sent an ICE frame, found none", d);
        if (ice_index < 0) continue;

        const uint8_t *data = net_test_link_sent_data(d, ice_index);
        const size_t len = net_test_link_sent_len(d, ice_index);

        /* Header is [type][len]; the payload must end with a NUL. */
        CHECK(len >= 3, "the ICE frame should have a payload, got %u bytes", (unsigned)len);
        CHECK(data[len - 1] == '\0',
              "the ICE frame's last payload byte must be NUL or handle_ice() drops it; "
              "got 0x%02X (frame %u bytes)", data[len - 1], (unsigned)len);

        /* And the declared length must cover it, or the receiver's bounds check refuses. */
        CHECK((size_t)data[1] + 2 == len,
              "the ICE frame's declared length %u must match the %u bytes sent",
              (unsigned)data[1], (unsigned)len);
    }
}

/* ------------------------------------------------------------------ */

int main(void)
{
    printf("=== net_social: the handshake, on a PC ===\n");
    printf("(the real main/net/net_social.c, against stand-ins for IDF/FreeRTOS/NVS/mbedTLS/NimBLE)\n");

    test_hmac_backing();
    test_full_handshake();
    test_frame_sequence();
    test_no_reveal_without_consent();
    test_forged_confirm_is_rejected();
    test_responder_completes_after_confirm();
    test_abandoned_session_times_out();
    test_replay_is_dropped();
    test_pending_prompt_blocks_our_own_request();
    test_encounter_is_persisted_on_poll();
    test_out_of_range_does_not_connect();
    test_frame_size_respects_mtu();
    test_two_meetings_in_a_row();
    test_hello_survives_a_refused_send();
    test_ice_frame_carries_its_terminator();

    printf("\n%d checks, %d failure(s)\n", g_checks, g_failures);
    if (g_failures) {
        printf("SOCIAL HANDSHAKE TESTS FAILED\n");
        return 1;
    }
    printf("ALL SOCIAL HANDSHAKE TESTS PASSED\n");
    return 0;
}
