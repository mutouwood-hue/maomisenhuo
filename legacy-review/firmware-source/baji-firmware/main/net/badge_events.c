/*
 * badge_events - the badge's uplink to the App: the queue, the wire format and its
 * persistence.
 *
 * WHAT THIS MODULE IS
 * -------------------
 * The badge reports what the owner did; the App settles the pet's numbers (spec 9,
 * 吧唧只做 5 种照料 ... 结果作为事件上行由 App 结算, spec 使用说明). This file owns
 * exactly three things and borrows the radio:
 *
 *   1. the 8-byte wire record, little endian, and its strict decoder -- the contract with
 *      the phone, so both directions validate before anything is trusted;
 *   2. an offline ring of 200 records with a drop-the-oldest rule, so a phone that never
 *      connects cannot wedge the badge;
 *   3. NVS persistence of whatever is still pending, written at most once every
 *      BADGE_EVENTS_SAVE_MS (5000 ms), so a power cut does not cost the owner's last
 *      actions.
 *
 * It does NOT own the radio (net_link_send() from main/net/net_link.h is borrowed), the
 * App's settlement, the cloud, or the QR payload -- see docs/badge-uplink.md.
 *
 * THE SPECIFICATION IS THE SOURCE OF TRUTH
 * ----------------------------------------
 * spec 9: 上行事件 每条 8 字节，小端：u32 时间戳（秒）+ u8 类型 + u8 参数 a + i16 参数 b。
 * 离线时存在本机环形缓冲（200 条），连上手机后按顺序补传。
 * The event vocabulary itself is NOT restated here: badge_event_defs[] and badge_strings[]
 * come from the generated tables (main/ui/badge_spec_data.c), and so does every label this
 * module hands back.
 */

#include "badge_events.h"

#include <string.h>

#include "esp_log.h"
#include "nvs.h"

#include "badge_spec_data.h" /* badge_event_defs[], badge_strings[] */
#include "net_link.h"        /* net_link_send() */

static const char *TAG = "badge_events";

/* ------------------------------------------------------------------ */
/* persistence layout                                                 */
/* ------------------------------------------------------------------ */

/* A namespace of its own, next to main.c's "petgame" save: the queue and the pet's numbers
 * have different lifetimes (the queue is drained by the phone, the state is not), and
 * mixing them would make one module's erase a corruption of the other's format. */
#define BADGE_EVENTS_NVS_NAMESPACE "badge_evt"
#define BADGE_EVENTS_NVS_KEY       "queue"

/*
 * Blob layout, all little endian:
 *
 *   +0  magic   'B','E','Q','1'    (4 bytes)
 *   +4  version u8   = 1
 *   +5  reserved u8  = 0
 *   +6  count   u16                 (0..200)
 *   +8  count * the 8-byte wire records, OLDEST FIRST
 *
 * The records are stored in exactly the App's wire form, produced by
 * badge_events_encode(), so there is one encoder rather than two that can drift: what
 * lands in flash is byte-for-byte what the phone will be handed.
 *
 * Size: 8 + 200 * 8 = 1608 bytes, one NVS blob. NVS is the right store here for the same
 * reason main.c's pet save uses it: a few hundred bytes that must survive a power cut
 * without giving the badge a filesystem.
 */
#define BADGE_EVENTS_BLOB_HEADER_BYTES 8u
#define BADGE_EVENTS_BLOB_VERSION      1u
#define BADGE_EVENTS_BLOB_MAX \
    (BADGE_EVENTS_BLOB_HEADER_BYTES + BADGE_EVENT_QUEUE_MAX * BADGE_EVENT_WIRE_BYTES)

_Static_assert(BADGE_EVENTS_BLOB_MAX == 1608u, "the NVS image is 8 B header + 1.6 KB of records");
_Static_assert(sizeof(badge_evt_t) == 8u, "one record is 4 + 1 + 1 + 2 bytes, with no padding");

/* Field offsets inside a record, named so the encoder cannot be read as "byte 6 happens
 * to be b". */
#define BADGE_EVENTS_WIRE_TS   0
#define BADGE_EVENTS_WIRE_TYPE 4
#define BADGE_EVENTS_WIRE_A    5
#define BADGE_EVENTS_WIRE_B    6

/*
 * Shortest gap between two deferred saves, in milliseconds. The value is 5000.
 *
 * It is defined here rather than in badge_events.h because that header is frozen and does
 * not publish it; the host test keys its clock advances off the same 5000 (tests/host/
 * test_badge_events.c, SAVE_MS). Flash erase cycles are finite and the queue changes on
 * every care action, so the write is deferred; the cost of deferring is that up to
 * BADGE_EVENTS_SAVE_MS of *already sent* records can be resurrected by a power cut inside
 * the window, which is why the App must settle idempotently (docs/badge-uplink.md).
 */
#define BADGE_EVENTS_SAVE_MS 5000

/*
 * The compile-time default timestamp, in unix seconds: 2026-10-10T00:00:00Z, the date the
 * interaction specification was frozen for the M1 board (spec 12, README「M1 上板结论」,
 * docs/m1-hardware-verification.md). The board has NO RTC (spec 12.7), so before the phone
 * has told us the time this plus the badge's own uptime is the best available answer -- and
 * it is deliberately NOT 0: a 1970 timestamp looks like a real time to anything downstream
 * and would sort every queued record to the front of the App's timeline, while a value
 * inside the trial window is recognisable as "clock not synced yet".
 */
#define BADGE_EVENTS_DEFAULT_UNIX 1791590400u

/* Serialisation scratch. 1608 bytes at file scope, for the same reason the ring is: the
 * previous firmware put an 8 KB buffer of this shape on a 3584-byte task stack and the
 * badge rebooted at boot (docs/m1-hardware-verification.md:28-57). */
static uint8_t s_blob[BADGE_EVENTS_BLOB_MAX];

/* ------------------------------------------------------------------ */
/* state                                                              */
/* ------------------------------------------------------------------ */

static int      s_head;  /* index of the oldest record */
static int      s_count; /* records currently queued, 0..BADGE_EVENT_QUEUE_MAX */
static uint32_t s_total; /* records that have entered the ring since boot */
static uint32_t s_dropped; /* of those, the ones the full-queue rule evicted */

static nvs_handle_t s_handle;
static bool         s_ready;

/*
 * THE QUEUE. 200 * 8 = 1.6 KB, at file scope, and the placement is load bearing.
 *
 * This is not "a large local", it is a stack overflow: the previous firmware declared an
 * 8 KB buffer of this shape inside a function, the compiler allocated the whole frame at
 * entry (entry a1, 0x2030) against CONFIG_ESP_MAIN_TASK_STACK_SIZE = 3584, and the badge
 * rebooted at boot while blaming a neighbouring task
 * (docs/m1-hardware-verification.md:28-57). The specification says the same about this
 * exact buffer: 离线最多缓存 200 条 = 1.6KB；缓冲区用文件级 static，不要放任务栈上 (spec 9,
 * and 上板教训 in the specification's README). A host test cannot see this class of bug by
 * itself -- a PC hands the test process megabytes of stack -- so
 * tests/host/test_badge_events.c pushes a full 200 and asserts the depth is really
 * reached: a stack-resident ring would have died long before reporting 200.
 *
 * Process-global and deliberately not reentrant, exactly like main.c's pet save: every
 * caller runs on one task, init() refuses a second call, and the only way in from a test is
 * badge_events_reboot().
 */
static badge_evt_t s_queue[BADGE_EVENT_QUEUE_MAX];
_Static_assert(sizeof(s_queue) == 1600u,
               "the ring is 1.6 KB at file scope; it has no business in a task stack");

/* Persistence bookkeeping. `s_save_dirty` means "RAM and the stored blob disagree";
 * `badge_events_dirty()` is a different question (is there anything to send). */
static bool     s_save_dirty;
static bool     s_save_armed;
static uint32_t s_save_due_ms;

/* clock: the module's own monotonic millisecond counter, fed by badge_events_tick() */
static uint32_t s_now_ms;
static uint32_t s_synced_unix; /* nonzero once the phone has told us the time */
static uint32_t s_sync_ms;     /* s_now_ms at the moment of that sync */

/*
 * clear() before init(): there is no open handle to erase through, so the request is
 * remembered and honoured by the load, rather than silently lost -- "drop every pending
 * record" has to mean it even if it is called first.
 */
static bool s_clear_requested;

/* Declared here, defined at the bottom: badge_events.h is frozen and has no deinit. */
void badge_events_reboot(void);

/* ------------------------------------------------------------------ */
/* little-endian helpers                                              */
/* ------------------------------------------------------------------ */

static uint16_t get_u16le(const uint8_t *p)
{
    return (uint16_t)((uint16_t)p[0] | ((uint16_t)p[1] << 8));
}

static void put_u16le(uint8_t *p, uint16_t v)
{
    p[0] = (uint8_t)(v & 0xFFu);
    p[1] = (uint8_t)((v >> 8) & 0xFFu);
}

/* ------------------------------------------------------------------ */
/* the wire format - the App's contract                               */
/* ------------------------------------------------------------------ */

/*
 * Encode one record: uint32 ts LE | uint8 type | uint8 a | int16 b LE.
 *
 * Byte-wise rather than a struct copy, on purpose. A memcpy of badge_evt_t would depend on
 * the host struct's padding and on the target's endianness (the ESP32-S3 is little endian,
 * but "it happens to agree" is not a contract), and it would silently encode whatever
 * garbage a future field added. Every byte written here is specified.
 *
 * SMALL INTEGER TYPES ARE FORBIDDEN for this record. The specification says int16 参数 b
 * (spec 9), and it is signed: a negative b is a legal value (a delta, a short id offset),
 * so b is written as two bytes of two's complement -- (uint16_t) of the int16_t, never a
 * clamp, never an unsigned narrowing. The test encodes b = -1, -32768 and 32767 to pin
 * that down (tests/host/test_badge_events.c).
 */
void badge_events_encode(const badge_evt_t *evt, uint8_t out[BADGE_EVENT_WIRE_BYTES])
{
    if (!out) return;

    const uint32_t ts = evt ? evt->ts : 0u;
    const uint8_t  type = evt ? evt->type : (uint8_t)EVT_NONE;
    const uint8_t  a = evt ? evt->a : 0u;
    const int16_t  b = evt ? evt->b : 0;
    const uint16_t ub = (uint16_t)b; /* two's complement: the sign survives */

    out[BADGE_EVENTS_WIRE_TS + 0] = (uint8_t)(ts & 0xFFu);
    out[BADGE_EVENTS_WIRE_TS + 1] = (uint8_t)((ts >> 8) & 0xFFu);
    out[BADGE_EVENTS_WIRE_TS + 2] = (uint8_t)((ts >> 16) & 0xFFu);
    out[BADGE_EVENTS_WIRE_TS + 3] = (uint8_t)((ts >> 24) & 0xFFu);
    out[BADGE_EVENTS_WIRE_TYPE] = type;
    out[BADGE_EVENTS_WIRE_A] = a;
    out[BADGE_EVENTS_WIRE_B + 0] = (uint8_t)(ub & 0xFFu);
    out[BADGE_EVENTS_WIRE_B + 1] = (uint8_t)((ub >> 8) & 0xFFu);
}

/*
 * Decode an 8-byte wire record. Returns false when it is malformed.
 *
 * A record is malformed when its type is outside 1..14 (spec 9's EVT_PET..EVT_SETTING;
 * EVT_NONE = 0 and 15 and 255 are not events the specification defines) or when it is not
 * exactly one record long. The length half of that check cannot live in this function --
 * the frozen prototype takes exactly BADGE_EVENT_WIRE_BYTES and no length -- so it lives in
 * the persistence reader, which is the only place a record arrives with a length attached
 * (decode_checked() below), and it is what rejects a blob whose header count and byte count
 * disagree.
 *
 * The destination is written only on success, like pet_game_deserialize(): a caller that
 * passes a partially-filled record to the App would be reporting an event that never
 * happened.
 */
bool badge_events_decode(const uint8_t in[BADGE_EVENT_WIRE_BYTES], badge_evt_t *out)
{
    if (!in || !out) return false;

    const uint8_t type = in[BADGE_EVENTS_WIRE_TYPE];
    if (type < (uint8_t)EVT_PET || type > (uint8_t)EVT_SETTING) return false;

    badge_evt_t evt;
    evt.ts = (uint32_t)in[BADGE_EVENTS_WIRE_TS + 0] |
             ((uint32_t)in[BADGE_EVENTS_WIRE_TS + 1] << 8) |
             ((uint32_t)in[BADGE_EVENTS_WIRE_TS + 2] << 16) |
             ((uint32_t)in[BADGE_EVENTS_WIRE_TS + 3] << 24);
    evt.type = type;
    evt.a = in[BADGE_EVENTS_WIRE_A];
    /* Back through uint16_t so the conversion is the inverse of the encoder's and does not
     * depend on the implementation's int promotion rules for a negative 0xFFFF. */
    evt.b = (int16_t)get_u16le(&in[BADGE_EVENTS_WIRE_B]);

    *out = evt;
    return true;
}

/** One record of a known length: the length half of the decode contract. */
static bool decode_checked(const uint8_t *in, size_t len, badge_evt_t *out)
{
    if (!in || !out) return false;
    if (len != (size_t)BADGE_EVENT_WIRE_BYTES) return false;
    return badge_events_decode(in, out);
}

/* ------------------------------------------------------------------ */
/* the queue                                                          */
/* ------------------------------------------------------------------ */

static badge_evt_t *slot_at(int queued_index)
{
    return &s_queue[(s_head + queued_index) % BADGE_EVENT_QUEUE_MAX];
}

void badge_events_push(badge_evt_type_t type, uint8_t a, int16_t b)
{
    /*
     * Only the specification's fourteen types enter the queue. EVT_NONE is not an event,
     * and a record the App's decoder must reject is worse than no record: it would be
     * re-sent forever and count as pending. Note the header's prose about a `ts` argument
     * (「pass 0 to let the module stamp it」) describes an earlier signature -- the frozen
     * prototype takes no timestamp, so every record is stamped from badge_events_now().
     */
    if (type < EVT_PET || type >= EVT_TYPE_COUNT) {
        ESP_LOGW(TAG, "refusing event type %d: not one of the specification's 1..%d",
                 (int)type, (int)EVT_SETTING);
        return;
    }

    /*
     * Full queue: drop the OLDEST record. A phone that never connects must not be able to
     * wedge the badge -- the alternative (refuse the new record) turns a forgotten phone
     * into a badge that silently stops reporting, and the newest actions are the ones the
     * owner just performed. Spec 9 gives the depth as 200 and nothing else, so this policy
     * is ours; it is stated in docs/badge-uplink.md.
     */
    if (s_count == BADGE_EVENT_QUEUE_MAX) {
        s_head = (s_head + 1) % BADGE_EVENT_QUEUE_MAX;
        s_count--;
        s_dropped++;
        /* Powers of two only: a badge left alone for a month drops constantly, and one
         * line per drop would be the only thing in the log. */
        if ((s_dropped & (s_dropped - 1u)) == 0u) {
            ESP_LOGW(TAG, "queue full: dropped the oldest record (%u dropped so far)",
                     (unsigned)s_dropped);
        }
    }

    badge_evt_t *slot = slot_at(s_count);
    slot->ts = badge_events_now();
    slot->type = (uint8_t)type;
    slot->a = a;
    slot->b = b;
    s_count++;
    s_total++;

    /*
     * Arm the save window on the first change and do not extend it on later ones, so a
     * burst of events costs one flash erase and a continuous stream still reaches flash
     * every BADGE_EVENTS_SAVE_MS instead of being deferred forever (main.c's save arms its
     * window the same way, for the same reason).
     */
    s_save_dirty = true;
    if (!s_save_armed) {
        s_save_armed = true;
        s_save_due_ms = s_now_ms + BADGE_EVENTS_SAVE_MS;
    }
}

int badge_events_pending(void)
{
    return s_count;
}

uint32_t badge_events_total(void)
{
    /* Every record that entered the ring, including the ones the full-queue rule later
     * evicted: that is what makes `total` useful in the log line ("appended 205, 5
     * dropped"), and it is why total - pending is not zero on a badge whose phone is
     * away. */
    return s_total;
}

bool badge_events_peek(int index, badge_evt_t *out)
{
    if (!out || index < 0 || index >= s_count) return false;
    *out = *slot_at(index);
    return true;
}

bool badge_events_dirty(void)
{
    /* The header's question: "true while a flush is worth attempting". Unrelated to
     * s_save_dirty, which is about NVS. */
    return s_count > 0;
}

/* ------------------------------------------------------------------ */
/* NVS persistence                                                    */
/* ------------------------------------------------------------------ */

static void drop_all(void)
{
    s_head = 0;
    s_count = 0;
}

/*
 * Write the pending queue. The dirty flag is cleared ONLY when the whole write landed,
 * including the commit: a failed nvs_set_blob() that cleared it would look exactly like a
 * successful one, and the owner's actions would be gone at the next boot with no retry
 * (the previous save layer made the same mistake once and the argument is the same here).
 *
 * Re-arming on failure is deliberate too: if the store is refusing writes, retrying on
 * every tick would hammer it, so the retry waits out the normal window.
 */
static esp_err_t write_now(void)
{
    size_t n = BADGE_EVENTS_BLOB_HEADER_BYTES;
    memcpy(s_blob, "BEQ1", 4);
    s_blob[4] = (uint8_t)BADGE_EVENTS_BLOB_VERSION;
    s_blob[5] = 0;
    put_u16le(&s_blob[6], (uint16_t)s_count);

    for (int i = 0; i < s_count; i++) {
        badge_events_encode(&s_queue[(size_t)(s_head + i) % BADGE_EVENT_QUEUE_MAX],
                            &s_blob[BADGE_EVENTS_BLOB_HEADER_BYTES +
                                    (size_t)i * BADGE_EVENT_WIRE_BYTES]);
    }
    n += (size_t)s_count * BADGE_EVENT_WIRE_BYTES;
    esp_err_t err = nvs_set_blob(s_handle, BADGE_EVENTS_NVS_KEY, s_blob, n);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "nvs_set_blob failed: %s", esp_err_to_name(err));
    } else {
        err = nvs_commit(s_handle);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "nvs_commit failed: %s", esp_err_to_name(err));
        }
    }

    if (err == ESP_OK) {
        s_save_dirty = false;
    }

    s_save_armed = false;
    if (s_save_dirty) {
        s_save_armed = true;
        s_save_due_ms = s_now_ms + BADGE_EVENTS_SAVE_MS;
    }
    return err;
}

esp_err_t badge_events_save(void)
{
    if (!s_ready) return ESP_ERR_INVALID_STATE;
    /* Nothing pending to record: the store already agrees with RAM. This is the common
     * case at shutdown and it must not cost an erase. */
    if (!s_save_dirty) return ESP_OK;
    return write_now();
}

/*
 * Load whatever the last session left behind.
 *
 * Everything here is validation: a blob is data from a previous firmware version, a
 * half-written flash page or a bug, and a queue that loads garbage would hand the App
 * events that never happened. Each rejection is explicit and leaves the queue EMPTY rather
 * than partially filled, because a partially-applied queue is one the App cannot
 * distinguish from a real one.
 */
static void load_queue(void)
{
    drop_all();

    size_t len = 0;
    esp_err_t err = nvs_get_blob(s_handle, BADGE_EVENTS_NVS_KEY, NULL, &len);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "no pending queue in NVS");
        return;
    }
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "cannot size the stored queue: %s", esp_err_to_name(err));
        return;
    }
    /* Check the claimed size BEFORE the copy: the real nvs_get_blob() fails rather than
     * truncating, but only an explicit bound makes the buffer's safety obvious. */
    if (len < BADGE_EVENTS_BLOB_HEADER_BYTES || len > BADGE_EVENTS_BLOB_MAX) {
        ESP_LOGW(TAG, "implausible queue size %u; ignoring", (unsigned)len);
        return;
    }

    len = sizeof(s_blob);
    err = nvs_get_blob(s_handle, BADGE_EVENTS_NVS_KEY, s_blob, &len);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "cannot read the stored queue: %s", esp_err_to_name(err));
        return;
    }

    if (memcmp(s_blob, "BEQ1", 4) != 0) {
        ESP_LOGW(TAG, "stored queue has no magic; ignoring it");
        return;
    }
    if (s_blob[4] != (uint8_t)BADGE_EVENTS_BLOB_VERSION) {
        ESP_LOGW(TAG, "stored queue version %u, expected %u; ignoring it",
                 (unsigned)s_blob[4], (unsigned)BADGE_EVENTS_BLOB_VERSION);
        return;
    }

    const uint16_t count = get_u16le(&s_blob[6]);
    if (count > BADGE_EVENT_QUEUE_MAX) {
        ESP_LOGW(TAG, "stored queue claims %u records, max is %d; ignoring it",
                 (unsigned)count, (int)BADGE_EVENT_QUEUE_MAX);
        return;
    }
    /* The length check the decoder cannot do on its own: the header's record count and the
     * blob's byte count must agree exactly, so neither a truncated tail nor trailing
     * rubbish can pass as a queue. */
    if (len != BADGE_EVENTS_BLOB_HEADER_BYTES + (size_t)count * BADGE_EVENT_WIRE_BYTES) {
        ESP_LOGW(TAG, "stored queue length %u disagrees with its count %u; ignoring it",
                 (unsigned)len, (unsigned)count);
        return;
    }

    for (uint16_t i = 0; i < count; i++) {
        const uint8_t *rec = &s_blob[BADGE_EVENTS_BLOB_HEADER_BYTES +
                                     (size_t)i * BADGE_EVENT_WIRE_BYTES];
        badge_evt_t evt;
        if (!decode_checked(rec, BADGE_EVENT_WIRE_BYTES, &evt)) {
            ESP_LOGW(TAG, "stored record %u is malformed; dropping the whole queue",
                     (unsigned)i);
            drop_all();
            return;
        }
        s_queue[i] = evt;
    }
    s_count = (int)count;
    s_head = 0;
    ESP_LOGI(TAG, "loaded %u pending event(s)", (unsigned)count);
}

/* ------------------------------------------------------------------ */
/* lifecycle                                                          */
/* ------------------------------------------------------------------ */

esp_err_t badge_events_init(void)
{
    /*
     * The contract in the frozen header is that a second init() reports
     * ESP_ERR_INVALID_STATE. That is why the state is process-global and why the host test
     * has a reboot hook instead of re-initialising: "the badge was power-cycled" is the
     * state a load has to be tested from, and a second init() is not it.
     */
    if (s_ready) return ESP_ERR_INVALID_STATE;

    const esp_err_t err = nvs_open(BADGE_EVENTS_NVS_NAMESPACE, NVS_READWRITE, &s_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "nvs_open failed: %s", esp_err_to_name(err));
        return err;
    }

    /* init() is a boot: the counters describe this session. */
    s_total = 0;
    s_dropped = 0;
    s_save_dirty = false;
    s_save_armed = false;
    s_now_ms = 0;
    s_ready = true;

    if (s_clear_requested) {
        /* clear() ran before there was a handle to erase through: the request still has to
         * win, otherwise the next boot resurrects the records it was told to drop. */
        s_clear_requested = false;
        (void)nvs_erase_key(s_handle, BADGE_EVENTS_NVS_KEY);
        (void)nvs_commit(s_handle);
        drop_all();
        ESP_LOGI(TAG, "started empty (clear() was called before init)");
        return ESP_OK;
    }

    load_queue();

    /*
     * "Start the flush timer" in the header's words is this module's use of the caller's
     * tick, not an esp_timer: there is no timer in here, for the same reason main.c's pet
     * save has none -- app_save_poll() is driven from the tick that already exists, because a
     * module-owned timer is a task this firmware does not need, and badge_events_tick() is
     * the one clock this module is given.
     */
    return ESP_OK;
}

void badge_events_advance_clock(uint32_t now_ms)
{
    s_now_ms = now_ms;
}

void badge_events_tick(uint32_t now_ms)
{
    /* Input paths advance the same clock without triggering a flash write. */
    badge_events_advance_clock(now_ms);

    if (!s_ready || !s_save_dirty || !s_save_armed) return;
    /* Signed difference: the 32-bit millisecond counter wraps after ~49.7 days and a badge
     * that has been on a shelf must still save. */
    if ((int32_t)(now_ms - s_save_due_ms) < 0) return;

    (void)write_now();
}

void badge_events_clear(void)
{
    drop_all();
    s_save_dirty = false;
    s_save_armed = false;

    if (!s_ready) {
        /* No handle yet, so there is nothing to erase through; init() honours the flag. */
        s_clear_requested = true;
        return;
    }

    const esp_err_t err = nvs_erase_key(s_handle, BADGE_EVENTS_NVS_KEY);
    /* A missing key is not a failure: the outcome -- "nothing stored" -- is the same. */
    if (err != ESP_OK && err != ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGW(TAG, "erasing the stored queue failed: %s; it stays dirty",
                 esp_err_to_name(err));
        s_save_dirty = true; /* the next window rewrites an empty queue instead */
        if (!s_save_armed) {
            s_save_armed = true;
            s_save_due_ms = s_now_ms + BADGE_EVENTS_SAVE_MS;
        }
        return;
    }
    (void)nvs_commit(s_handle);
    ESP_LOGI(TAG, "queue cleared");
}

void badge_events_flush(bool connected)
{
    /* Nothing to transmit to, in the caller's own words. Checked here as well as in
     * net_link_send() because this is the common case on a badge whose phone is away. */
    if (!connected) return;
    if (s_count == 0) return;

    int sent = 0;
    while (s_count > 0) {
        /* Read the head in place rather than through peek(): the encoder only reads it, and
         * nothing on the path from here to net_link_send() touches the ring. */
        const badge_evt_t *head = &s_queue[(size_t)s_head % BADGE_EVENT_QUEUE_MAX];

        uint8_t wire[BADGE_EVENT_WIRE_BYTES];
        badge_events_encode(head, wire);

        const esp_err_t err = net_link_send(wire, sizeof(wire));
        if (err != ESP_OK) {
            /*
             * The record stays queued. This is the whole reason the queue exists: a link
             * that is up but not yet writable (our GATT discovery of the peer has not
             * finished -- net_link_send() returns ESP_ERR_INVALID_STATE) or a connection
             * that just dropped must cost the owner nothing. Only a successful send
             * removes a record, and then only that one, so the next attempt resumes at the
             * same place instead of skipping it.
             */
            ESP_LOGD(TAG, "link refused event %u (%s); %d still pending",
                     (unsigned)head->type, esp_err_to_name(err), s_count);
            break;
        }

        s_head = (s_head + 1) % BADGE_EVENT_QUEUE_MAX;
        s_count--;
        sent++;

        /*
         * What is in flash is now stale: it still holds records the phone has. Marked
         * dirty so the deferred write drops them -- otherwise a power cut would resurrect
         * already-delivered events and the App would settle them twice (it must be
         * idempotent anyway, see the SAVE_MS note above).
         */
        s_save_dirty = true;
        if (!s_save_armed) {
            s_save_armed = true;
            s_save_due_ms = s_now_ms + BADGE_EVENTS_SAVE_MS;
        }
    }

    if (sent > 0) {
        ESP_LOGI(TAG, "flushed %d event(s), %d pending, %u appended since boot",
                 sent, s_count, (unsigned)s_total);
    }
}

/* ------------------------------------------------------------------ */
/* clock                                                              */
/* ------------------------------------------------------------------ */

void badge_events_set_time(uint32_t unix_seconds)
{
    /*
     * The downlink snapshot carries 当前时间 每次连接 (spec 9), so this is called on every
     * connection with the phone's clock. Zero is not a time: a peer that sends 0 would
     * otherwise reset every subsequent timestamp to the epoch, and there is no way back.
     */
    if (unix_seconds == 0) {
        ESP_LOGW(TAG, "refusing a clock sync of 0");
        return;
    }

    s_synced_unix = unix_seconds;
    s_sync_ms = s_now_ms;
    ESP_LOGI(TAG, "clock synced to %u", (unsigned)unix_seconds);
}

uint32_t badge_events_now(void)
{
    if (s_synced_unix == 0) {
        /* Never synced: the compile-time default plus this module's own uptime. The
         * subtraction is not needed -- the default is the value at tick 0 -- and the badge
         * does not need an RTC to count seconds (spec 12.7). */
        return BADGE_EVENTS_DEFAULT_UNIX + s_now_ms / 1000u;
    }
    /* Elapsed seconds since the sync, wrapping correctly with the millisecond counter. */
    return s_synced_unix + (uint32_t)((s_now_ms - s_sync_ms) / 1000u);
}

/* ------------------------------------------------------------------ */
/* labels                                                             */
/* ------------------------------------------------------------------ */

const char *badge_event_label(int type)
{
    if (type < (int)EVT_PET || type > (int)EVT_SETTING) return "";

    /*
     * The lookup matches the definition's own `type` field rather than assuming the table's
     * row order (`badge_event_defs[type - 1]`). The App numbers events by type, not by row,
     * so the field is the contract; the row order is pinned separately, by
     * tests/host/test_badge_events.c asserting that badge_event_defs[i].type == i + 1. A
     * relabelling here would not crash and would not change a single pixel -- it would put
     * the wrong wording on a queued event, which is the "the UI is fine, the data is not"
     * defect this repo has been burning down (docs/gap-vs-v1.5.md).
     *
     * The wording is NOT restated here: it comes from badge_event_defs[].label through
     * badge_strings[], both generated from badge_spec.json (spec 9's events table).
     */
    for (int i = 0; i < BADGE_EVENT_COUNT; i++) {
        if ((int)badge_event_defs[i].type != type) continue;
        const uint16_t label = badge_event_defs[i].label;
        if (label == 0 || label >= BADGE_STRING_COUNT) return "";
        return badge_strings[label] ? badge_strings[label] : "";
    }
    return "";
}

/* ------------------------------------------------------------------ */
/* host-test support                                                  */
/* ------------------------------------------------------------------ */

/*
 * Model a power cycle: forget the queue and every counter, leave NVS alone.
 *
 * The frozen header declares no deinit and init() must fail on a second call, so a host
 * test that wants to prove "a partly drained queue comes back, in order" needs exactly
 * this: drop what a reboot drops, keep what a reboot keeps. It is compiled
 * unconditionally rather than behind a test-only #ifdef, so the firmware's own compiler
 * (xtensa-esp-elf-gcc, which does not share clang's warnings) type-checks it too -- a hook
 * the firmware compiler never sees is a hook whose breakage the host suite cannot report.
 */
void badge_events_reboot(void)
{
    if (s_ready) nvs_close(s_handle);
    s_ready = false;
    s_handle = 0;
    drop_all();
    s_total = 0;
    s_dropped = 0;
    s_save_dirty = false;
    s_save_armed = false;
    s_save_due_ms = 0;
    s_now_ms = 0;
    s_synced_unix = 0;
    s_sync_ms = 0;
    s_clear_requested = false;
}
