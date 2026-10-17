/*
 * net_link - the Bluetooth transport for the near-field social layer.
 *
 * Shape of the link
 * -----------------
 * Every badge is a peripheral and a central at the same time. It advertises a
 * small payload and simultaneously scans for the same payload, so two badges find
 * each other with no pairing step, and either one can be the one that connects.
 *
 * The payload rides in manufacturer-specific data rather than in a service UUID:
 * a 128-bit UUID would eat 18 of the 31 advertising bytes, and those bytes are
 * better spent on the pet summary. The service UUID goes in the scan response and
 * discovery is filtered in software.
 *
 * Frames are opaque here. This layer moves bytes and estimates distance;
 * net_social decides what they mean.
 */

#include "net_link.h"

#include <string.h>

#include <stdatomic.h>
#include "esp_log.h"
#include "esp_mac.h"
#include "esp_random.h"

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "host/ble_hs.h"
#include "host/ble_att.h"
#include "host/util/util.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"
#include "store/config/ble_store_config.h"
#include "host/ble_store.h"

/*
 * ble_store_config_init() has no header in this NimBLE release: ble_store_config.h
 * declares only the read/write/delete backend, not the installer. Every ESP-IDF
 * example (bleprph, blecent, ble_uart, ...) therefore declares it locally exactly
 * like this. It is the function that binds the NVS-backed store to the host.
 */
void ble_store_config_init(void);

static const char *TAG = "net_link";
static atomic_bool s_discovery_enabled = true;
static atomic_bool s_host_started = false;
static atomic_bool s_host_synced = false;

/* ------------------------------------------------------------------ */
/* identity and payload                                               */
/* ------------------------------------------------------------------ */

/*
 * Manufacturer-specific data layout, after the 2-byte company id:
 *
 *   [0..7]  device id, derived from the factory MAC
 *   [8]     breed
 *   [9]     life stage
 *   [10..]  display name, UTF-8, no NUL, at most ADV_NAME_MAX bytes
 *
 * Three flag bytes plus framing plus two company bytes plus the payload keeps the
 * whole advertisement inside the 31-byte legacy budget.
 */
#define COMPANY_ID      0xFFFFu
#define ADV_NAME_MAX    8
#define ADV_PAYLOAD_MIN (8 + 1 + 1)

static const ble_uuid128_t SVC_UUID = BLE_UUID128_INIT(
    0x00, 0x7a, 0x6f, 0x5e, 0x8c, 0x3b, 0x2f, 0x9d,
    0x7e, 0x4a, 0x9b, 0x1c, 0x00, 0xa0, 0xf1, 0xe7);
static const ble_uuid128_t CHR_RX_UUID = BLE_UUID128_INIT(
    0x01, 0x7a, 0x6f, 0x5e, 0x8c, 0x3b, 0x2f, 0x9d,
    0x7e, 0x4a, 0x9b, 0x1c, 0x00, 0xa0, 0xf1, 0xe7);
static const ble_uuid128_t CHR_TX_UUID = BLE_UUID128_INIT(
    0x02, 0x7a, 0x6f, 0x5e, 0x8c, 0x3b, 0x2f, 0x9d,
    0x7e, 0x4a, 0x9b, 0x1c, 0x00, 0xa0, 0xf1, 0xe7);

/* ------------------------------------------------------------------ */
/* state                                                              */
/* ------------------------------------------------------------------ */

#define MAX_PEERS 16

struct net_link {
    uint8_t device_id[8];
    uint8_t own_addr_type;
    char    gap_name[28];

    pet_game_t *game; /* borrowed, never mutated */

    net_peer_t peers[MAX_PEERS];
    /* Addresses are kept beside the public table because net_peer_t is exposed
     * to the UI and has no business carrying a BLE address around. */
    ble_addr_t peer_addr[MAX_PEERS];
    int        peer_count;

    uint16_t conn_handle;
    bool     connected;
    bool     we_are_central;

    /* Negotiated ATT MTU. Zero until BLE_GAP_EVENT_MTU arrives; net_link_send()
     * treats zero as "not known yet" and skips the size check. */
    uint16_t mtu;

    /* A connect attempt is pending. ble_gap_connect() uses BLE_HS_FOREVER, so an
     * attempt against an unreachable peer never completes on its own; this flag is what
     * lets net_link_disconnect() cancel it. */
    bool connecting;

    uint16_t peer_tx_val_handle; /* their notify characteristic, when we are central */
    uint16_t our_tx_val_handle;  /* ours, when we are peripheral */

    net_link_rx_cb_t    rx_cb;
    void               *rx_user;
    net_link_state_cb_t state_cb;
    void               *state_user;

    bool advertising;
    bool discovering;
};

static struct net_link s_link;

/*
 * The GAP event listener.
 *
 * This is what makes the radio hear its own events, and it is not optional.
 *
 * NimBLE does not deliver GAP events to whoever happens to care. Some go only to listeners
 * registered here (ble_gap_event_listener_call), others only to the callback stored for a
 * connection (ble_gap_call_conn_event_cb), and some to both. This module starts advertising and
 * scanning with a NULL callback -- ble_gap_adv_start(..., NULL, NULL) and ble_gap_disc(...,
 * NULL, NULL) -- and only net_link_connect() named a callback. As a peripheral, which is the
 * ordinary case when two badges meet, every event therefore went to nobody: the incoming
 * connection, the negotiated MTU, the disconnect, and the scan reports that fill the peer table.
 *
 * Measured on the board before this listener existed: the badge was discovered by a phone, the
 * phone connected and read the GATT services, and the badge's serial log contained no line about
 * it at all -- while the same connection through the central path (which did name a callback)
 * logged normally. With the listener registered, the same connection logs "connected as
 * peripheral", "ATT MTU negotiated: 247" and "disconnected (reason 531)".
 *
 * Registered in net_link_init(), which runs on the app task before the host task exists, so no
 * event can arrive before the listener is in place.
 *
 * Note that this listener does NOT deliver BLE_GAP_EVENT_ADV_COMPLETE when a peer connects:
 * NimBLE raises that event only for an explicit adv-stop, an advertisement timeout, or the
 * extended-advertising path. The `advertising` flag is cleared in the CONNECT branch instead,
 * which is where the disconnect path's restart guard gets its answer from.
 */
static struct ble_gap_event_listener s_gap_listener;

/* ------------------------------------------------------------------ */
/* peer table                                                         */
/* ------------------------------------------------------------------ */

/*
 * The peer table has two writers and a reader on different tasks. The NimBLE host
 * task fills it in from discovery reports; the app task walks it to work out what is
 * nearby and to pick the nearest badge to connect to. Nothing else in this module is
 * shared that way -- the connection handles are single 16-bit values, which are atomic
 * on this target -- but the table is not: net_link_get_peer() copies a whole
 * net_peer_t, and peer_note() writes one field at a time (and memsets an entry when it
 * evicts). Without a lock the app task can copy an entry that is halfway through being
 * created, and hand net_social a peer whose device id is still all zeroes.
 *
 * The consequence is bounded -- the connect attempt fails and the session deadline
 * added in net_social reclaims it -- but it is the kind of failure that only shows up
 * when two people happen to walk past each other, which is exactly when it cannot be
 * debugged. A mutex is cheap here: both callers are tasks, neither runs in an ISR, and
 * the critical sections are a few dozen bytes of copy.
 */
static SemaphoreHandle_t s_peer_lock;

static void peer_lock(void)
{
    if (s_peer_lock) (void)xSemaphoreTake(s_peer_lock, portMAX_DELAY);
}

static void peer_unlock(void)
{
    if (s_peer_lock) (void)xSemaphoreGive(s_peer_lock);
}

/* Callers must hold the lock. */
static int peer_find_locked(const uint8_t id[8])
{
    for (int i = 0; i < s_link.peer_count; i++) {
        if (memcmp(s_link.peers[i].device_id, id, 8) == 0) return i;
    }
    return -1;
}

/*
 * RSSI is a noisy estimator: a single reading swings by around 10 dBm while a
 * badge sits still. Smoothing is what makes the proximity stages stable instead
 * of flickering between "near" and "far", so every peer keeps a running average.
 */
static void peer_note(const uint8_t id[8], int8_t rssi, const ble_addr_t *addr,
                      const uint8_t *name, uint8_t name_len)
{
    peer_lock();
    int idx = peer_find_locked(id);
    if (idx < 0) {
        if (s_link.peer_count >= MAX_PEERS) {
            /* Evict the weakest so a crowded room still shows the closest badge. */
            int worst = 0;
            for (int i = 1; i < MAX_PEERS; i++) {
                if (s_link.peers[i].rssi_avg < s_link.peers[worst].rssi_avg) worst = i;
            }
            if (s_link.peers[worst].rssi_avg > rssi) {
                peer_unlock();
                return;
            }
            idx = worst;
        } else {
            idx = s_link.peer_count++;
        }
        memset(&s_link.peers[idx], 0, sizeof(s_link.peers[idx]));
        memcpy(s_link.peers[idx].device_id, id, 8);
        s_link.peers[idx].rssi_avg = rssi;
    }

    net_peer_t *p = &s_link.peers[idx];
    p->rssi = rssi;
    p->rssi_avg = (int8_t)(((int)p->rssi_avg * 3 + (int)rssi) / 4);
    p->connectable = true;
    if (addr) s_link.peer_addr[idx] = *addr;

    if (name && name_len) {
        const uint8_t room = (uint8_t)(sizeof(p->name) - 1);
        const uint8_t n = name_len > room ? room : name_len;
        memcpy(p->name, name, n);
        p->name[n] = '\0';
    }
    peer_unlock();
}

/* ------------------------------------------------------------------ */
/* advertising                                                        */
/* ------------------------------------------------------------------ */

static int start_advertising(void)
{
    if (!atomic_load(&s_discovery_enabled)) return 0;
    const pet_cat_t *c = pet_active_cat_const(s_link.game);

    /*
     * Advertising data is built by hand rather than through ble_gap_adv_set_fields:
     * the fields API has no slot for our manufacturer payload, and the flags,
     * manufacturer data and length framing are simple enough to emit directly.
     */
    uint8_t adv[31];
    uint8_t i = 0;

    adv[i++] = 2;
    adv[i++] = BLE_HS_ADV_TYPE_FLAGS;
    adv[i++] = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;

    uint8_t payload[ADV_PAYLOAD_MIN + ADV_NAME_MAX];
    uint8_t pl = 0;
    memcpy(&payload[pl], s_link.device_id, 8);
    pl = 8;
    payload[pl++] = c ? c->breed : 0;
    payload[pl++] = c ? (uint8_t)pet_stage(c->xp) : 0;
    if (c && c->name[0]) {
        const size_t n = strlen(c->name);
        const uint8_t take = (uint8_t)(n > ADV_NAME_MAX ? ADV_NAME_MAX : n);
        memcpy(&payload[pl], c->name, take);
        pl = (uint8_t)(pl + take);
    }

    adv[i++] = (uint8_t)(2 + pl); /* length = company id + payload */
    adv[i++] = BLE_HS_ADV_TYPE_MFG_DATA;
    adv[i++] = (uint8_t)(COMPANY_ID & 0xFF);
    adv[i++] = (uint8_t)(COMPANY_ID >> 8);
    memcpy(&adv[i], payload, pl);
    i = (uint8_t)(i + pl);

    int rc = ble_gap_adv_set_data(adv, i);
    if (rc != 0) {
        ESP_LOGE(TAG, "adv_set_data failed: %d", rc);
        return rc;
    }

    /*
     * Scan response: the service UUID, so a phone can identify the badge too.
     *
     * The type is COMP_UUIDS128 (0x07), the "complete list of 128-bit service class
     * UUIDs" AD type, not a spelled-out "UUID128": NimBLE follows the Bluetooth
     * assigned-numbers names, in which every UUID AD type is qualified by width and
     * by whether the list is complete or incomplete.
     */
    uint8_t rsp[20];
    uint8_t r = 0;
    rsp[r++] = 17; /* length: type byte + 16-byte UUID */
    rsp[r++] = BLE_HS_ADV_TYPE_COMP_UUIDS128;
    memcpy(&rsp[r], SVC_UUID.value, 16);
    r = (uint8_t)(r + 16);
    rc = ble_gap_adv_rsp_set_data(rsp, r);
    if (rc != 0) ESP_LOGW(TAG, "adv_rsp_set_data failed: %d", rc);

    struct ble_gap_adv_params params = {0};
    params.conn_mode = BLE_GAP_CONN_MODE_UND;
    params.disc_mode = BLE_GAP_DISC_MODE_GEN;
    params.itvl_min = BLE_GAP_ADV_FAST_INTERVAL1_MIN;
    params.itvl_max = BLE_GAP_ADV_FAST_INTERVAL1_MAX;

    rc = ble_gap_adv_start(s_link.own_addr_type, NULL, BLE_HS_FOREVER, &params, NULL, NULL);
    if (rc == 0) {
        s_link.advertising = true;
        if (!atomic_load(&s_discovery_enabled)) {
            ble_gap_adv_stop();
            s_link.advertising = false;
        }
    }
    else ESP_LOGW(TAG, "adv_start failed: %d", rc);
    return rc;
}

static void start_scanning(void)
{
    if (!atomic_load(&s_discovery_enabled)) return;
    struct ble_gap_disc_params disc = {0};
    disc.itvl = BLE_GAP_SCAN_FAST_INTERVAL_MIN;
    disc.window = BLE_GAP_SCAN_FAST_WINDOW;
    /* Duplicate filtering lets the peer table converge; without it a stationary
     * badge would be re-reported on every advertisement interval. */
    disc.filter_duplicates = 1;
    disc.passive = 0; /* active: we want the scan response with the UUID */

    const int rc = ble_gap_disc(s_link.own_addr_type, BLE_HS_FOREVER, &disc, NULL, NULL);
    if (rc != 0) ESP_LOGW(TAG, "ble_gap_disc failed: %d", rc);
    else {
        s_link.discovering = true;
        if (!atomic_load(&s_discovery_enabled)) {
            ble_gap_disc_cancel();
            s_link.discovering = false;
        }
    }
}

/* ------------------------------------------------------------------ */
/* GATT server                                                        */
/* ------------------------------------------------------------------ */

static int gatt_rx_access(uint16_t conn_handle, uint16_t attr_handle,
                          struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    (void)conn_handle;
    (void)attr_handle;
    (void)arg;

    if (ctxt->op != BLE_GATT_ACCESS_OP_WRITE_CHR) return BLE_ATT_ERR_UNLIKELY;

    const uint16_t len = (uint16_t)OS_MBUF_PKTLEN(ctxt->om);
    if (len == 0 || len > NET_FRAME_MAX) return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;

    uint8_t buf[NET_FRAME_MAX];
    uint16_t copied = 0;
    if (ble_hs_mbuf_to_flat(ctxt->om, buf, sizeof(buf), &copied) != 0) {
        return BLE_ATT_ERR_UNLIKELY;
    }
    if (s_link.rx_cb) s_link.rx_cb(buf, copied, s_link.rx_user);
    return 0;
}

/* A read accessor is required for the notify characteristic to be readable in
 * some stacks; returning an empty value is honest and cheap. */
static int gatt_tx_access(uint16_t conn_handle, uint16_t attr_handle,
                          struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    (void)conn_handle;
    (void)attr_handle;
    (void)arg;
    if (ctxt->op != BLE_GATT_ACCESS_OP_READ_CHR) return BLE_ATT_ERR_UNLIKELY;
    uint8_t empty = 0;
    return os_mbuf_append(ctxt->om, &empty, 0) == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
}

static const struct ble_gatt_svc_def GATT_SVCS[] = {
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = &SVC_UUID.u,
        .characteristics = (struct ble_gatt_chr_def[]){
            {
                /* Peers write their frames here. */
                .uuid = &CHR_RX_UUID.u,
                .access_cb = gatt_rx_access,
                .flags = BLE_GATT_CHR_F_WRITE | BLE_GATT_CHR_F_WRITE_NO_RSP,
            },
            {
                /* We push our frames out from here. */
                .uuid = &CHR_TX_UUID.u,
                .access_cb = gatt_tx_access,
                .val_handle = &s_link.our_tx_val_handle,
                .flags = BLE_GATT_CHR_F_READ | BLE_GATT_CHR_F_NOTIFY,
            },
            {0},
        },
    },
    {0},
};

/* ------------------------------------------------------------------ */
/* central-side discovery                                             */
/* ------------------------------------------------------------------ */

static int on_chr_disc(uint16_t conn_handle, const struct ble_gatt_error *error,
                       const struct ble_gatt_chr *chr, void *arg)
{
    (void)arg;
    if (error->status == BLE_HS_EDONE) {
        /*
         * Subscribe so their notifications actually reach us. The CCCD sits
         * immediately after the characteristic value handle in the layout we
         * publish ourselves, and that layout is part of this protocol.
         */
        if (s_link.peer_tx_val_handle != 0) {
            uint8_t cccd[2] = {1, 0};
            const int rc = ble_gattc_write_flat(conn_handle,
                                                (uint16_t)(s_link.peer_tx_val_handle + 1),
                                                cccd, sizeof(cccd), NULL, NULL);
            if (rc != 0) ESP_LOGW(TAG, "CCCD subscribe failed: %d", rc);
        } else {
            /*
             * Discovery finished without finding their TX characteristic, so there is no
             * handle to write to and every frame we send will fail with
             * ESP_ERR_INVALID_STATE. That used to be silent apart from a debug log, and
             * the visible symptom was an initiator that connected, sent nothing, timed
             * out, and retried forever -- failing to distinguish "the peer is not our
             * firmware" from a bug in our own handshake.
             *
             * Dropping the connection is the honest response: this peer cannot speak the
             * protocol, and staying connected only keeps the radio busy and the badge out
             * of discovery. It is logged at warning level because it is the only evidence
             * a developer would get.
             */
            ESP_LOGW(TAG, "peer has no TX characteristic; dropping the connection. "
                          "The peer is probably not running this firmware.");
            ble_gap_terminate(conn_handle, BLE_ERR_REM_USER_CONN_TERM);
        }
        return 0;
    }
    if (error->status != 0) return 0;

    /*
     * The callback's `chr->uuid` is a ble_uuid_any_t, i.e. a union of the 16-, 32- and
     * 128-bit UUID types. ble_uuid_any_t is not declared to the compiler as a union
     * carrying a `u128` member reachable through the stack's `u` -- the 128-bit form
     * is a separate struct (`ble_uuid128_t`) whose first member is the generic
     * ble_uuid_t and whose second is `uint8_t value[16]`. So the bytes are reached
     * through the union member directly, and the type tag is checked first because
     * reading `value` is only meaningful when the UUID really is 128 bits wide.
     */
    if (chr->uuid.u.type == BLE_UUID_TYPE_128 &&
        memcmp(chr->uuid.u128.value, CHR_TX_UUID.value, 16) == 0) {
        s_link.peer_tx_val_handle = chr->val_handle;
    }
    return 0;
}

static void discover_peer(void)
{
    const int rc = ble_gattc_disc_all_chrs(s_link.conn_handle, 0x0001, 0xFFFF, on_chr_disc, NULL);
    if (rc != 0) ESP_LOGW(TAG, "disc_all_chrs failed: %d", rc);
}

/* ------------------------------------------------------------------ */
/* GAP events                                                         */
/* ------------------------------------------------------------------ */

static void parse_peer_payload(const struct ble_gap_disc_desc *d)
{
    struct ble_hs_adv_fields fields;
    if (ble_hs_adv_parse_fields(&fields, d->data, d->length_data) != 0) return;
    if (!fields.mfg_data || fields.mfg_data_len < 2 + ADV_PAYLOAD_MIN) return;

    const uint16_t company = (uint16_t)(fields.mfg_data[0] | (fields.mfg_data[1] << 8));
    if (company != COMPANY_ID) return;

    const uint8_t *p = fields.mfg_data + 2;
    const uint8_t plen = (uint8_t)(fields.mfg_data_len - 2);

    /* Never list ourselves, or two badges running the same build would try to
     * befriend their own reflection. */
    if (memcmp(p, s_link.device_id, 8) == 0) return;

    const uint8_t *name = p + ADV_PAYLOAD_MIN;
    const uint8_t name_len = (uint8_t)(plen - ADV_PAYLOAD_MIN);
    peer_note(p, d->rssi, &d->addr, name_len ? name : NULL, name_len);
}

static int gap_event(struct ble_gap_event *event, void *arg)
{
    (void)arg;

    switch (event->type) {
        case BLE_GAP_EVENT_DISC:
            parse_peer_payload(&event->disc);
            return 0;

        case BLE_GAP_EVENT_DISC_COMPLETE:
            s_link.discovering = false;
            return 0;

        case BLE_GAP_EVENT_CONNECT: {
            s_link.connecting = false;
            if (event->connect.status != 0) {
                ESP_LOGW(TAG, "connect failed: %d", event->connect.status);
                s_link.connected = false;
                start_advertising();
                return 0;
            }
            s_link.conn_handle = event->connect.conn_handle;
            s_link.connected = true;

            /*
             * A successful connection ends advertising, so record that here.
             *
             * This is the correction that makes the disconnect path work, and the reason is worth
             * stating because the obvious assumption is wrong: NimBLE does NOT raise
             * BLE_GAP_EVENT_ADV_COMPLETE when a peer connects. ble_gap_adv_finished() is called
             * only from the explicit adv-stop path, from the advertisement timeout, and from the
             * extended-advertising set. A legacy connectable advertisement that is taken over by a
             * connection simply stops, with no event.
             *
             * So s_link.advertising stayed true across the whole connection, and the disconnect
             * branch's `if (!s_link.advertising) start_advertising();` never fired. The badge was
             * visible before its first meeting and invisible after it, for the rest of the boot.
             * Measured on the board before this line existed: connected at t=28.2s, disconnected at
             * t=37.1s, scanning resumed, and no advertising ever started again.
             */
            s_link.advertising = false;
            if (!atomic_load(&s_discovery_enabled)) {
                ble_gap_terminate(event->connect.conn_handle, BLE_ERR_REM_USER_CONN_TERM);
                return 0;
            }

            struct ble_gap_conn_desc desc;
            if (ble_gap_conn_find(event->connect.conn_handle, &desc) == 0) {
                /*
                 * NimBLE names the GAP roles after the old Bluetooth spec wording:
                 * the connection initiator is BLE_GAP_ROLE_MASTER and the acceptor is
                 * BLE_GAP_ROLE_SLAVE. There is no BLE_GAP_ROLE_CENTRAL in this
                 * version, even though the rest of the API (ble_gap_connect,
                 * ble_gap_disc) uses the newer central/peripheral vocabulary.
                 */
                s_link.we_are_central = (desc.role == BLE_GAP_ROLE_MASTER);
            }
            if (s_link.discovering) {
                ble_gap_disc_cancel();
                s_link.discovering = false;
            }

            ESP_LOGI(TAG, "connected as %s", s_link.we_are_central ? "central" : "peripheral");
            if (s_link.we_are_central) discover_peer();

            if (s_link.state_cb) {
                uint8_t id[8] = {0};
                s_link.state_cb(true, id, s_link.state_user);
            }
            return 0;
        }

        case BLE_GAP_EVENT_MTU:
            /*
             * The MTU is negotiated, not fixed by our own preference, so record what was
             * actually agreed. Logged because it is the single number that decides whether
             * the longer frames (ACK, ICE) can move at all, and a value below ~66 makes
             * the handshake fail in a way that looks like anything but an MTU problem.
             */
            s_link.mtu = event->mtu.value;
            ESP_LOGI(TAG, "ATT MTU negotiated: %u (max frame payload %u)",
                     (unsigned)s_link.mtu,
                     (unsigned)(s_link.mtu > 3 ? s_link.mtu - 3 : 0));
            if (s_link.mtu <= 3 + NET_FRAME_MAX) {
                ESP_LOGW(TAG, "MTU %u cannot carry the largest frame (%u bytes); "
                              "long frames will be refused",
                         (unsigned)s_link.mtu, (unsigned)NET_FRAME_MAX);
            }
            return 0;

        case BLE_GAP_EVENT_DISCONNECT:
            ESP_LOGI(TAG, "disconnected (reason %d)", event->disconnect.reason);
            s_link.connected = false;
            s_link.we_are_central = false;
            s_link.peer_tx_val_handle = 0;
            s_link.mtu = 0;
            if (s_link.state_cb) {
                uint8_t id[8] = {0};
                s_link.state_cb(false, id, s_link.state_user);
            }
            /*
             * Back on the air. This depends on ADV_COMPLETE having cleared s_link.advertising:
             * NimBLE raises that event when the peer connected -- i.e. before this one -- and
             * while the flag stayed true this guard silently did nothing, which is exactly how
             * the badge stopped advertising permanently after its first meeting.
             */
            if (!s_link.advertising) start_advertising();
            if (!s_link.discovering) start_scanning();
            return 0;

        case BLE_GAP_EVENT_NOTIFY_RX: {
            /* Peripheral-to-central frames arrive here. */
            const uint16_t len = (uint16_t)OS_MBUF_PKTLEN(event->notify_rx.om);
            if (len > 0 && len <= NET_FRAME_MAX) {
                uint8_t buf[NET_FRAME_MAX];
                uint16_t copied = 0;
                if (ble_hs_mbuf_to_flat(event->notify_rx.om, buf, sizeof(buf), &copied) == 0) {
                    if (s_link.rx_cb) s_link.rx_cb(buf, copied, s_link.rx_user);
                }
            }
            return 0;
        }

        case BLE_GAP_EVENT_ADV_COMPLETE:
            /*
             * Advertising stopped. Recorded rather than acted on: the disconnect handler is what
             * puts the badge back on the air, and restarting here would race it. The reason this
             * flag matters at all is the DISCONNECT guard below -- see the note on s_gap_listener,
             * where a stale `true` here is what made the badge go permanently silent.
             */
            s_link.advertising = false;
            return 0;

        default:
            return 0;
    }
}

/* ------------------------------------------------------------------ */
/* host plumbing                                                      */
/* ------------------------------------------------------------------ */

static void on_sync(void)
{
    if (ble_hs_util_ensure_addr(0) != 0) {
        ESP_LOGE(TAG, "ble_hs_util_ensure_addr failed");
        return;
    }
    if (ble_hs_id_infer_auto(0, &s_link.own_addr_type) != 0) {
        ESP_LOGE(TAG, "ble_hs_id_infer_auto failed");
        return;
    }

    atomic_store(&s_host_synced, true);
    (void)start_advertising();
    start_scanning();
}

static void on_reset(int reason)
{
    atomic_store(&s_host_synced, false);
    ESP_LOGW(TAG, "host reset, reason %d", reason);
    s_link.connected = false;
    s_link.advertising = false;
    s_link.discovering = false;
}

static void host_task(void *param)
{
    (void)param;
    nimble_port_run(); /* returns only after nimble_port_stop() */
    nimble_port_freertos_deinit();
}

/* ------------------------------------------------------------------ */
/* public API                                                         */
/* ------------------------------------------------------------------ */

esp_err_t net_link_init(pet_game_t *game)
{
    memset(&s_link, 0, sizeof(s_link));
    s_link.game = game;

    /*
     * Guard the peer table before anything can touch it. Created here because this is
     * the only entry point, and after the memset above so the handle itself is not
     * wiped. Failure is not fatal: the rest of the radio still works, and peer_lock()
     * degrades to a no-op rather than dereferencing NULL.
     */
    if (!s_peer_lock) {
        s_peer_lock = xSemaphoreCreateMutex();
        if (!s_peer_lock) {
            ESP_LOGW(TAG, "could not create the peer-table lock; discovery runs unlocked");
        }
    }

    /*
     * Identity comes from the factory MAC, so it is stable across reboots and
     * unique per board with no provisioning step. The last two bytes are derived
     * rather than copied so the advertised id is not simply the BT address, which
     * would let anyone correlate the badge with its radio identity.
     */
    uint8_t mac[6] = {0};
    if (esp_read_mac(mac, ESP_MAC_BT) != ESP_OK) {
        esp_fill_random(mac, sizeof(mac));
    }
    memcpy(s_link.device_id, mac, 6);
    s_link.device_id[6] = (uint8_t)((mac[0] ^ mac[3]) & 0xFF);
    s_link.device_id[7] = (uint8_t)((mac[1] ^ mac[4]) & 0xFF);

    const int rc = nimble_port_init();
    if (rc != 0) {
        ESP_LOGE(TAG, "nimble_port_init failed: %d", rc);
        return ESP_FAIL;
    }

    /*
     * Give the host a persistent store before anything can write to it.
     *
     * NimBLE works without this call, but only until it has to remember a peer:
     * the built-in fallback store is RAM-only and answers every read with "not
     * found". Calling this installs the NVS-backed store, so a peer that is paired
     * once stays known across a reboot. NVS is already up by this point -- main()
     * initialises it before the display, and this runs after that.
     */
    ble_store_config_init();

    ble_hs_cfg.sync_cb = on_sync;
    ble_hs_cfg.reset_cb = on_reset;
    /*
     * When the store is full, drop the oldest bond rather than refusing new ones.
     * This badge has no pairing UI, so silently discarding the least recently used
     * peer is the only policy that cannot leave the user stuck.
     */
    ble_hs_cfg.store_status_cb = ble_store_util_status_rr;

    ble_svc_gap_init();
    ble_svc_gatt_init();

    /*
     * Install the global event listener before anything can start advertising or scanning.
     *
     * Ordering matters and is the reason this sits above the adv/disc start (which happens in
     * on_sync, on the host task, only after nimble_port_run()): events that arrive before the
     * listener is registered are dropped, and the advertising flag would be wrong from the first
     * connection onward. See the note on s_gap_listener for what breaks without this.
     */
    /* The register call initialises the listener structure itself, so the static
     * (zero-initialised) instance declared next to s_link is all that is needed here. */
    if (ble_gap_event_listener_register(&s_gap_listener, gap_event, NULL) != 0) {
        ESP_LOGE(TAG, "could not register the GAP event listener; the badge would stop "
                      "advertising after the first peer connects");
        return ESP_FAIL;
    }

    /*
     * State our preferred ATT MTU explicitly instead of inheriting
     * CONFIG_BT_NIMBLE_ATT_PREFERRED_MTU (256 in this build, but a menuconfig away from
     * something the protocol cannot use). The handshake's longest frames are the ACK at
     * 26 bytes and the icebreaker at roughly 63, and an ATT write only carries mtu - 3
     * bytes, so anything under ~66 silently breaks the handshake.
     *
     * This is a preference: the negotiated value can still come out lower, which is why
     * net_link_send() checks the real MTU and the MTU event logs it.
     */
    ble_att_set_preferred_mtu(247);

    if (ble_gatts_count_cfg(GATT_SVCS) != 0 || ble_gatts_add_svcs(GATT_SVCS) != 0) {
        ESP_LOGE(TAG, "GATT service registration failed");
        return ESP_FAIL;
    }

    snprintf(s_link.gap_name, sizeof(s_link.gap_name), "OrangeCat-%02X%02X",
             s_link.device_id[6], s_link.device_id[7]);
    if (ble_svc_gap_device_name_set(s_link.gap_name) != 0) {
        ESP_LOGW(TAG, "could not set the GAP device name");
    }

    ESP_LOGI(TAG, "identity %s", s_link.gap_name);
    return ESP_OK;
}

esp_err_t net_link_start(void)
{
    if (atomic_exchange(&s_host_started, true)) return ESP_OK;
    /* The host task needs a comfortable stack: NimBLE's event callbacks run here
     * and the GATT access path touches the mbuf pool. */
    if (xTaskCreate(host_task, "ble_host", 4096, NULL, 5, NULL) != pdPASS) {
        atomic_store(&s_host_started, false);
        return ESP_ERR_NO_MEM;
    }
    return ESP_OK;
}

void net_link_stop(void)
{
    if (s_link.advertising) {
        ble_gap_adv_stop();
        s_link.advertising = false;
    }
    if (s_link.discovering) {
        ble_gap_disc_cancel();
        s_link.discovering = false;
    }
}

bool net_link_discovery_enabled(void) { return atomic_load(&s_discovery_enabled); }

void net_link_set_discovery(bool enabled)
{
    const bool before = atomic_exchange(&s_discovery_enabled, enabled);
    if (before == enabled || !atomic_load(&s_host_synced)) return;
    if (!enabled) {
        net_link_stop();
        net_link_disconnect();
        net_link_clear_peers();
    } else {
        (void)start_advertising();
        start_scanning();
    }
}

int net_link_peer_count(void) { return s_link.peer_count; }

bool net_link_get_peer(int index, net_peer_t *out)
{
    if (!out) return false;
    peer_lock();
    bool ok = index >= 0 && index < s_link.peer_count;
    if (ok) *out = s_link.peers[index];
    peer_unlock();
    return ok;
}

void net_link_clear_peers(void)
{
    peer_lock();
    memset(s_link.peers, 0, sizeof(s_link.peers));
    memset(s_link.peer_addr, 0, sizeof(s_link.peer_addr));
    s_link.peer_count = 0;
    peer_unlock();
}

void net_link_set_rx_cb(net_link_rx_cb_t cb, void *user)
{
    s_link.rx_cb = cb;
    s_link.rx_user = user;
}

void net_link_set_state_cb(net_link_state_cb_t cb, void *user)
{
    s_link.state_cb = cb;
    s_link.state_user = user;
}

bool net_link_connected(void) { return s_link.connected; }

uint16_t net_link_mtu(void) { return s_link.mtu; }

const uint8_t *net_link_device_id(void) { return s_link.device_id; }

esp_err_t net_link_send(const uint8_t *data, size_t len)
{
    if (!s_link.connected) return ESP_ERR_INVALID_STATE;
    if (!data || len == 0 || len > NET_FRAME_MAX) return ESP_ERR_INVALID_ARG;

    /*
     * An ATT write carries 3 bytes of header, so the payload that can actually be moved
     * in one operation is mtu - 3. Below the negotiated MTU, a frame that is legal by the
     * protocol's own limit is still undeliverable.
     *
     * This is checked rather than assumed because the failure mode is otherwise silent
     * and badly misleading: the write simply fails, the peer never sees the frame, and --
     * because the missed frame is usually the HELLO or the ACK -- the only symptom is a
     * session that times out and retries forever, with no hint that the MTU was the cause.
     * CONFIG_BT_NIMBLE_ATT_PREFERRED_MTU is 256 in this build, so the largest frame
     * actually sent (the icebreaker) fits with room to spare; the check is what keeps
     * that true if the config is ever tightened, or if a peer negotiates something
     * smaller.
     */
    if (s_link.mtu != 0 && len > (size_t)s_link.mtu - 3) {
        ESP_LOGW(TAG, "frame is %u bytes but the MTU is %u (max payload %u); not sent",
                 (unsigned)len, (unsigned)s_link.mtu, (unsigned)(s_link.mtu - 3));
        return ESP_ERR_INVALID_SIZE;
    }

    if (!s_link.we_are_central) {
        /*
         * As the peripheral we notify on our own characteristic. A failure here
         * usually means the central has not subscribed yet, which is a normal
         * race at the start of a connection rather than a fault.
         */
        if (s_link.our_tx_val_handle == 0) return ESP_ERR_INVALID_STATE;
        struct os_mbuf *om = ble_hs_mbuf_from_flat(data, (uint16_t)len);
        if (!om) return ESP_ERR_NO_MEM;
        const int rc = ble_gatts_notify_custom(s_link.conn_handle, s_link.our_tx_val_handle, om);
        return rc == 0 ? ESP_OK : ESP_FAIL;
    }

    if (s_link.peer_tx_val_handle == 0) return ESP_ERR_INVALID_STATE;
    const int rc = ble_gattc_write_no_rsp_flat(s_link.conn_handle, s_link.peer_tx_val_handle,
                                               data, (uint16_t)len);
    return rc == 0 ? ESP_OK : ESP_FAIL;
}

esp_err_t net_link_connect(const uint8_t device_id[8])
{
    if (!atomic_load(&s_discovery_enabled)) return ESP_ERR_INVALID_STATE;
    /*
     * The index and the address are read under the lock and then used unlocked. That
     * is deliberate: ble_gap_connect() must not be called while holding a mutex that a
     * host-task callback could be waiting on, and the address is copied out by value
     * so the gap_event path can still update the table freely. The worst case is
     * connecting to an address that the table evicted a moment ago, which fails and is
     * retried by the session deadline.
     */
    ble_addr_t addr;
    peer_lock();
    const int idx = peer_find_locked(device_id);
    if (idx < 0) {
        peer_unlock();
        return ESP_ERR_NOT_FOUND;
    }
    addr = s_link.peer_addr[idx];
    peer_unlock();

    if (s_link.connected) return ESP_ERR_INVALID_STATE;

    /*
     * A connect attempt needs the peer's address, which only the scan produced. The
     * timeout is bounded rather than BLE_HS_FOREVER: an unreachable peer would otherwise
     * leave the controller neither connected nor advertising, which takes the badge off
     * the air with no visible cause. net_link_disconnect() also cancels an in-flight
     * attempt, so this is the second of the two guards.
     */
    if (s_link.connecting) return ESP_ERR_INVALID_STATE;

    struct ble_gap_conn_params params = {0};
    params.scan_itvl = BLE_GAP_SCAN_FAST_INTERVAL_MIN;
    params.scan_window = BLE_GAP_SCAN_FAST_WINDOW;
    params.itvl_min = BLE_GAP_INITIAL_CONN_ITVL_MIN;
    params.itvl_max = BLE_GAP_INITIAL_CONN_ITVL_MAX;
    params.latency = 0;
    params.supervision_timeout = 0x0100; /* 2.56 s */

    /*
     * The callback is passed as NULL on purpose: this connection's events arrive through the
     * global listener registered in net_link_init().
     *
     * NimBLE dispatches a connection event to the listener AND to the connection's own callback
     * (ble_gap_event_connect_call calls ble_gap_event_listener_call and then
     * ble_gap_call_conn_event_cb). Naming gap_event here as well would therefore run it twice for
     * every central-side event: on_link_state would fire twice per connection and, worse, the
     * disconnect branch would call start_advertising() twice. One delivery path is correct, and
     * the listener is the one that also covers events this module cannot see otherwise -- the
     * advertising handoff and, as peripheral, the incoming connection itself.
     */
    const int rc = ble_gap_connect(s_link.own_addr_type, &addr,
                                   10000 /* 10 s in ms */, &params, NULL, NULL);
    if (rc != 0) {
        ESP_LOGW(TAG, "ble_gap_connect failed: %d", rc);
        return ESP_FAIL;
    }
    s_link.connecting = true;
    return ESP_OK;
}

void net_link_disconnect(void)
{
    if (s_link.connected) {
        ble_gap_terminate(s_link.conn_handle, BLE_ERR_REM_USER_CONN_TERM);
        s_link.connected = false;
        s_link.mtu = 0;
    }
    /*
     * Cancel a connect attempt that is still in flight.
     *
     * ble_gap_connect() is called with BLE_HS_FOREVER, so an attempt against a peer that
     * has walked away stays pending indefinitely. While it is pending the controller is
     * neither connected nor advertising, so the badge is invisible to everyone else and
     * the session deadline in net_social cannot help -- it is waiting for a connection
     * event that will never arrive. Without this cancel, one unreachable peer could take
     * the badge off the air until it was rebooted.
     *
     * Harmless when no attempt is pending; the return code is deliberately ignored.
     */
    if (s_link.connecting) {
        (void)ble_gap_conn_cancel();
        s_link.connecting = false;
    }
}
