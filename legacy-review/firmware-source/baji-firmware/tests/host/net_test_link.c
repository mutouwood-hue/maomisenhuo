/*
 * The link layer, replaced with two simulated devices.
 *
 * net_link.c is a NimBLE transport and cannot run on a PC. This file implements the
 * interface declared in the REAL main/net/net_link.h -- it includes that header rather than
 * restating it -- so a change to the transport interface breaks this test at compile time
 * instead of letting the harness drift into testing a signature that no longer exists.
 *
 * What is modelled, and why each part matters:
 *
 *   - Reachability is explicit. net_social.c's connect path is supposed to be the consent
 *     gate ("nothing is transmitted until a peer is in range and the owner asked"), so a
 *     connect that silently succeeded out of range would hide a failure of that property.
 *   - The MTU rule is enforced: one ATT write carries mtu - 3 bytes. The largest fixed frame
 *     the protocol builds is an ACK at 26 bytes, but ICE frames are variable length, so the
 *     check is kept as a real bound rather than a formality.
 *   - Delivery is synchronous into the peer's receive callback. On the badge those
 *     callbacks run on the NimBLE host task; here they run inside the sender's call. That
 *     preserves the ordering that matters (a frame arriving after the state change that
 *     opened the session) and lets a whole handshake be played out without a scheduler.
 */

#include <stdio.h>
#include <string.h>

#include "net_link.h"
#include "net_test_harness.h"

#ifdef NET_TEST_VERBOSE
#define TRACE(...) do { printf("    link: " __VA_ARGS__); printf("\n"); } while (0)
#else
#define TRACE(...) do { } while (0)
#endif

/* ------------------------------------------------------------------ */
/* simulated devices                                                 */
/* ------------------------------------------------------------------ */

#define MAX_SENT_FRAMES 32

typedef struct {
    int      registered;
    uint8_t  device_id[8];

    net_link_rx_cb_t    rx_cb;
    void               *rx_user;
    net_link_state_cb_t state_cb;
    void               *state_user;

    int      connected;
    int      peer_index;   /* which simulated device we are connected to, or -1 */
    uint16_t mtu;

    /*
     * Whether we can transmit yet. Cleared to model the window in which our GATT discovery
     * of the peer has not finished, so the real transport would refuse with
     * ESP_ERR_INVALID_STATE. See net_test_link_set_sendable() in the harness header.
     */
    int      sendable;

    net_peer_t peers[NET_TEST_MAX_DEVICES];
    int        peer_count;

    int      sent_count;
    uint8_t  sent_type[MAX_SENT_FRAMES];
    uint8_t  sent_data[MAX_SENT_FRAMES][NET_FRAME_MAX];
    size_t   sent_len[MAX_SENT_FRAMES];
} sim_device_t;

static sim_device_t g_dev[NET_TEST_MAX_DEVICES];
static int          g_reachable[NET_TEST_MAX_DEVICES][NET_TEST_MAX_DEVICES];
static int          g_current;
static int          g_refused;

/*
 * Frames in flight, delivered by net_test_link_pump() rather than during the send.
 *
 * This queue is not an implementation convenience: delivering synchronously from inside
 * net_link_send() recurses through the whole handshake in the wrong order. A's handle_ack()
 * sends its CONFIRM, which synchronously runs B's reply, which synchronously runs A's next
 * step -- all before A's handle_ack() returns and gets to send its own SUMMARY. The
 * observable result was A's SUMMARY arriving *after* the reply it should have preceded,
 * which is not what the radio does.
 *
 * On the badge, a send returns immediately and the peer processes the frame later on its own
 * task. A FIFO that the test drains reproduces that: every frame a step produces is
 * delivered, in order, after that step returns.
 */
#define MAX_PENDING 64

typedef struct {
    int     to;
    uint8_t data[NET_FRAME_MAX];
    size_t  len;
} pending_frame_t;

static pending_frame_t g_pending[MAX_PENDING];
static int             g_pending_count;
static int             g_muted[NET_TEST_MAX_DEVICES];

#ifdef NET_TEST_VERBOSE
/* Name a device by its id so a trace cannot be misread: two devices sharing a label in a log
 * are worse than no log, because they make a swapped id look correct. */
static const char *name_of(int index)
{
    static char buf[NET_TEST_MAX_DEVICES][32];
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return "?";
    snprintf(buf[index], sizeof(buf[index]), "dev%d(%02X%02X)", index,
             g_dev[index].device_id[0], g_dev[index].device_id[1]);
    return buf[index];
}
#endif

static sim_device_t *cur(void)
{
    if (g_current < 0 || g_current >= NET_TEST_MAX_DEVICES) return &g_dev[0];
    return &g_dev[g_current];
}

/*
 * Switch the simulated radio AND the storage stand-in to one device.
 *
 * Both have to move together. When a frame is delivered, the peer's callbacks run
 * synchronously inside the sender's call -- exactly as if the NimBLE host task had handed
 * over -- and in that window the peer's code calls net_link_send() and nvs_*() as itself.
 * On the badge there is only ever one device, so "which device" is implicit in the call
 * stack; here it has to be pushed and popped explicitly around each delivery.
 *
 * Getting this wrong is not a subtle failure: the two sides silently merge into one device,
 * every device-to-device assertion becomes a comparison of a value with itself, and the
 * tests pass while proving nothing. That is precisely the bug this harness was written to
 * expose, so it does not get to have it.
 */
static void enter_device(int index)
{
    g_current = index;
    net_test_nvs_select_device(index);
}

void net_test_link_register(int index, const uint8_t device_id[8])
{
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return;
    memset(&g_dev[index], 0, sizeof(g_dev[index]));
    g_dev[index].registered = 1;
    memcpy(g_dev[index].device_id, device_id, 8);
    g_dev[index].peer_index = -1;
    /*
     * The value the firmware is expected to negotiate. It requests 247 and logs what it
     * actually gets; using 247 here means the size guard in net_link_send() is exercised
     * against the hardware's expected answer rather than an unrealistic one.
     */
    g_dev[index].mtu = 247;
    g_dev[index].sendable = 1;   /* the normal case: discovery has already finished */
}

void net_test_link_set_sendable(int index, int sendable)
{
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return;
    g_dev[index].sendable = sendable ? 1 : 0;
}

void net_test_link_settings(int index, uint16_t mtu)
{
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return;
    g_dev[index].mtu = mtu;
}

void net_test_link_add_peer(int index, const uint8_t peer_id[8], int rssi_avg)
{
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return;
    if (g_dev[index].peer_count >= NET_TEST_MAX_DEVICES) return;
    net_peer_t *p = &g_dev[index].peers[g_dev[index].peer_count++];
    memset(p, 0, sizeof(*p));
    memcpy(p->device_id, peer_id, 8);
    p->rssi = (int8_t)rssi_avg;
    p->rssi_avg = (int8_t)rssi_avg;
    p->connectable = true;
}

void net_test_link_clear_peers(int index)
{
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return;
    g_dev[index].peer_count = 0;
}

void net_test_link_set_reachable(int a, int b, int reachable)
{
    if (a < 0 || a >= NET_TEST_MAX_DEVICES || b < 0 || b >= NET_TEST_MAX_DEVICES) return;
    g_reachable[a][b] = reachable;
    g_reachable[b][a] = reachable;
}

void net_test_link_select(int index)
{
    /*
     * Handing control to a device implies the radio delivered what was owed to it: on the
     * badge the peer's task runs on its own schedule, and the test's equivalent of "time
     * passed" is switching devices. Pumping here means the tests do not each have to
     * remember to, and a forgotten pump cannot silently turn into a false pass.
     */
    net_test_link_pump();
    enter_device(index);
}

int net_test_link_device_connected(int index)
{
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return 0;
    return g_dev[index].connected;
}

void net_test_link_inject(int index, const uint8_t *data, size_t len)
{
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return;
    sim_device_t *pd = &g_dev[index];
    if (!pd->rx_cb) return;
    /*
     * Straight into the receive callback, which is the same entry point a real ATT write
     * would reach. Bypassing it would let a negative test pass by poking at internal state
     * instead of exercising the validation it claims to test.
     */
    pd->rx_cb(data, len, pd->rx_user);
}

int net_test_link_sent_count(int index)
{
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return 0;
    return g_dev[index].sent_count;
}

int net_test_link_sent_type(int index, int n)
{
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return -1;
    if (n < 0 || n >= g_dev[index].sent_count) return -1;
    return g_dev[index].sent_type[n];
}

size_t net_test_link_sent_len(int index, int n)
{
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return 0;
    if (n < 0 || n >= g_dev[index].sent_count) return 0;
    return g_dev[index].sent_len[n];
}

const uint8_t *net_test_link_sent_data(int index, int n)
{
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return NULL;
    if (n < 0 || n >= g_dev[index].sent_count) return NULL;
    return g_dev[index].sent_data[n];
}

void net_test_link_reset_counters(void)
{
    g_refused = 0;
    g_pending_count = 0;
    g_muted[0] = g_muted[1] = 0;
    for (int i = 0; i < NET_TEST_MAX_DEVICES; i++) {
        g_dev[i].sent_count = 0;
        memset(g_dev[i].sent_data, 0, sizeof(g_dev[i].sent_data));
        memset(g_dev[i].sent_len, 0, sizeof(g_dev[i].sent_len));
    }
}

void net_test_link_mute(int index, int muted)
{
    if (index < 0 || index >= NET_TEST_MAX_DEVICES) return;
    g_muted[index] = muted;
}

int net_test_link_refused_sends(void) { return g_refused; }

/* ------------------------------------------------------------------ */
/* net_link.h, implemented                                           */
/* ------------------------------------------------------------------ */

esp_err_t net_link_init(pet_game_t *game)
{
    (void)game;
    return ESP_OK;
}

esp_err_t net_link_start(void) { return ESP_OK; }
void      net_link_stop(void) { }
static bool g_discovery_enabled = true;
void net_link_set_discovery(bool enabled) { g_discovery_enabled = enabled; }
bool net_link_discovery_enabled(void) { return g_discovery_enabled; }

int net_link_peer_count(void) { return cur()->peer_count; }

bool net_link_get_peer(int index, net_peer_t *out)
{
    sim_device_t *d = cur();
    if (!out || index < 0 || index >= d->peer_count) return false;
    *out = d->peers[index];
    return true;
}

void net_link_clear_peers(void) { cur()->peer_count = 0; }

void net_link_set_rx_cb(net_link_rx_cb_t cb, void *user)
{
    cur()->rx_cb = cb;
    cur()->rx_user = user;
}

void net_link_set_state_cb(net_link_state_cb_t cb, void *user)
{
    cur()->state_cb = cb;
    cur()->state_user = user;
}

bool net_link_connected(void) { return cur()->connected != 0; }

uint16_t net_link_mtu(void) { return cur()->mtu; }

const uint8_t *net_link_device_id(void) { return cur()->device_id; }

esp_err_t net_link_send(const uint8_t *data, size_t len)
{
    sim_device_t *d = cur();
    if (!data || len == 0) return ESP_ERR_INVALID_ARG;
    if (!d->connected) return ESP_ERR_INVALID_STATE;
    if (len > NET_FRAME_MAX) return ESP_ERR_INVALID_SIZE;

    /*
     * Our GATT discovery of the peer has not produced its characteristic handle yet, so
     * there is nothing to write to. The real net_link_send() refuses the same way, and this
     * refusal is what the HELLO-retry path exists to survive.
     */
    if (!d->sendable) {
        TRACE("%s --type 0x%02X refused: not sendable yet", name_of(g_current), data[0]);
        return ESP_ERR_INVALID_STATE;
    }

    /*
     * The same bound the real transport enforces. If the firmware ever builds a frame
     * larger than the negotiated MTU allows, this is where it is caught -- before the
     * board is in hand. Unlike the real one, a refusal here is also counted, so a test can
     * distinguish "the frame was too big" from "nothing was attempted".
     */
    if (d->mtu != 0 && len > (size_t)d->mtu - 3) {
        g_refused++;
        return ESP_ERR_INVALID_SIZE;
    }

    if (d->sent_count < MAX_SENT_FRAMES) {
        d->sent_type[d->sent_count] = data[0];
        memcpy(d->sent_data[d->sent_count], data, len);
        d->sent_len[d->sent_count] = len;
        d->sent_count++;
    }

    const int peer = d->peer_index;
    if (peer < 0 || peer >= NET_TEST_MAX_DEVICES) return ESP_FAIL;
    if (!g_reachable[g_current][peer]) return ESP_FAIL;
    if (!g_dev[peer].rx_cb) return ESP_FAIL;   /* the peer is not listening */
    if (g_muted[peer]) {
        /* The peer exists but is not answering: the frame is dropped on the air, which is
         * what "the owner put the badge in a pocket" looks like to the sender. */
        TRACE("dev%d --type 0x%02X --> dev%d MUTED (dropped)", g_current, data[0], peer);
        return ESP_OK;
    }

    /*
     * Enqueue, do not deliver. See the note on the pending queue: delivering here would
     * recurse through the handshake and reorder it relative to what the radio does.
     */
    if (g_pending_count >= MAX_PENDING) return ESP_FAIL;
    pending_frame_t *f = &g_pending[g_pending_count++];
    f->to = peer;
    f->len = len;
    memcpy(f->data, data, len);

    TRACE("%s --type 0x%02X (%u B)--> %s queued", name_of(g_current), data[0], (unsigned)len,
          name_of(peer));
    return ESP_OK;
}

void net_test_link_pump(void)
{
    /*
     * Drain in FIFO order, one frame at a time. Frames produced by a delivery are appended
     * and picked up by the same loop, so a full round trip completes without recursion and
     * without reordering.
     */
    while (g_pending_count > 0) {
        const pending_frame_t f = g_pending[0];
        g_pending_count--;
        memmove(&g_pending[0], &g_pending[1], (size_t)g_pending_count * sizeof(g_pending[0]));

        sim_device_t *pd = &g_dev[f.to];
        if (!pd->rx_cb) continue;

        const int saved = g_current;
        enter_device(f.to);
#ifdef NET_TEST_VERBOSE
        const char *who = name_of(f.to);
        printf("    link: --> %s type 0x%02X (%u B)\n", who, f.data[0], (unsigned)f.len);
#endif
        pd->rx_cb(f.data, f.len, pd->rx_user);
        enter_device(saved);
    }
}

esp_err_t net_link_connect(const uint8_t device_id[8])
{
    if (!device_id) return ESP_ERR_INVALID_ARG;

    int target = -1;
    for (int i = 0; i < NET_TEST_MAX_DEVICES; i++) {
        if (i == g_current || !g_dev[i].registered) continue;
        if (memcmp(g_dev[i].device_id, device_id, 8) == 0) { target = i; break; }
    }
    if (target < 0) return ESP_ERR_NOT_FOUND;

    /* Out of range: the connection never completes. This is what the retry path sees. */
    if (!g_reachable[g_current][target]) return ESP_FAIL;

    sim_device_t *d = cur();
    d->connected = 1;
    d->peer_index = target;
    g_dev[target].connected = 1;
    g_dev[target].peer_index = g_current;

    if (d->state_cb) d->state_cb(true, g_dev[target].device_id, d->state_user);

    /*
     * The peer is told as well, and as itself: its own state callback may send its own HELLO
     * from inside this call, so the radio and the storage must already be pointing at it.
     */
    if (g_dev[target].state_cb) {
        const int initiator = g_current;
        enter_device(target);
        g_dev[target].state_cb(true, d->device_id, g_dev[target].state_user);
        enter_device(initiator);
    }
    return ESP_OK;
}

void net_link_disconnect(void)
{
    sim_device_t *d = cur();
    const int peer = d->peer_index;
    const int self = g_current;

    d->connected = 0;
    d->peer_index = -1;
    if (d->state_cb) {
        uint8_t id[8] = { 0 };
        d->state_cb(false, id, d->state_user);
    }

    if (peer >= 0 && peer < NET_TEST_MAX_DEVICES) {
        g_dev[peer].connected = 0;
        g_dev[peer].peer_index = -1;
        if (g_dev[peer].state_cb) {
            uint8_t id[8] = { 0 };
            /* The peer resets as itself, not as whoever dropped the link. */
            enter_device(peer);
            g_dev[peer].state_cb(false, id, g_dev[peer].state_user);
            enter_device(self);
        }
    }
}
