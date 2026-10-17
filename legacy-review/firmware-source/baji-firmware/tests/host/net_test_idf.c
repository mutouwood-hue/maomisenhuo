/*
 * Implementations of the ESP-IDF stand-ins declared in idf_stub/.
 *
 * Everything here is small and deterministic. The fact that it is small is the point: the
 * firmware's dependency on ESP-IDF is narrow enough to be substituted, which is what makes
 * the protocol testable on a PC at all. If this file ever grows a large surface, that is a
 * signal the protocol has picked up a dependency it should not have.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_err.h"
#include "esp_random.h"
#include "nvs.h"
#include "freertos/FreeRTOS.h"

/* ------------------------------------------------------------------ */
/* esp_err                                                           */
/* ------------------------------------------------------------------ */

const char *esp_err_to_name(esp_err_t code)
{
    switch (code) {
        case ESP_OK:                return "ESP_OK";
        case ESP_FAIL:              return "ESP_FAIL";
        case ESP_ERR_NO_MEM:        return "ESP_ERR_NO_MEM";
        case ESP_ERR_INVALID_ARG:   return "ESP_ERR_INVALID_ARG";
        case ESP_ERR_INVALID_STATE: return "ESP_ERR_INVALID_STATE";
        case ESP_ERR_INVALID_SIZE:  return "ESP_ERR_INVALID_SIZE";
        case ESP_ERR_NOT_FOUND:     return "ESP_ERR_NOT_FOUND";
        case ESP_ERR_TIMEOUT:       return "ESP_ERR_TIMEOUT";
        case ESP_ERR_NVS_NOT_FOUND: return "ESP_ERR_NVS_NOT_FOUND";
        default:                    return "ESP_ERR_UNKNOWN";
    }
}

/* ------------------------------------------------------------------ */
/* clock                                                             */
/* ------------------------------------------------------------------ */

int64_t net_test_time_us;

void net_test_advance_ms(uint32_t ms)
{
    net_test_time_us += (int64_t)ms * 1000;
}

uint32_t net_test_elapsed_seconds(void)
{
    return (uint32_t)(net_test_time_us / 1000000);
}

/* ------------------------------------------------------------------ */
/* randomness                                                        */
/* ------------------------------------------------------------------ */

/*
 * xorshift32: deterministic, self-contained, and enough to make a failing run replayable.
 * The bias toward speed over quality is deliberate -- this is a test fixture, not a
 * source of session nonces. (On the badge esp_random() is the hardware RNG.)
 */
static uint32_t g_rng = 0x12345678u;
static int      g_force_next;
static uint32_t g_forced_value;

void net_test_seed_random(uint32_t seed)
{
    g_rng = seed ? seed : 0x12345678u;
    g_force_next = 0;
}

void net_test_force_next_random(uint32_t value)
{
    g_force_next = 1;
    g_forced_value = value;
}

uint32_t esp_random(void)
{
    if (g_force_next) {
        g_force_next = 0;
        return g_forced_value;
    }
    g_rng ^= g_rng << 13;
    g_rng ^= g_rng >> 17;
    g_rng ^= g_rng << 5;
    /*
     * Never zero. net_social.c guards against a zero draw and one of those guards is
     * load-bearing, but a test suite should not depend on a 1-in-4-billion event to stay
     * stable; the guard is exercised by forcing a zero explicitly instead.
     */
    return g_rng ? g_rng : 0x9E3779B9u;
}

void esp_fill_random(void *buf, size_t len)
{
    if (!buf) return;
    unsigned char *p = (unsigned char *)buf;
    for (size_t i = 0; i < len; i++) p[i] = (unsigned char)(esp_random() & 0xFF);
}

/* ------------------------------------------------------------------ */
/* mutexes                                                           */
/* ------------------------------------------------------------------ */

#define NET_TEST_MAX_LOCKS 16

typedef struct {
    int used;
    int depth;
    int takes;
} net_test_lock_t;

static net_test_lock_t g_locks[NET_TEST_MAX_LOCKS];
static int             g_locks_created;

SemaphoreHandle_t xSemaphoreCreateMutex(void)
{
    for (int i = 0; i < NET_TEST_MAX_LOCKS; i++) {
        if (!g_locks[i].used) {
            g_locks[i].used = 1;
            g_locks[i].depth = 0;
            g_locks[i].takes = 0;
            g_locks_created++;
            return &g_locks[i];
        }
    }
    return NULL;   /* exhausting the table is itself a finding */
}

BaseType_t xSemaphoreTake(SemaphoreHandle_t sem, uint32_t ticks_to_wait)
{
    (void)ticks_to_wait;
    if (!sem) return pdFALSE;
    net_test_lock_t *l = (net_test_lock_t *)sem;
    l->depth++;
    l->takes++;
    return pdTRUE;
}

BaseType_t xSemaphoreGive(SemaphoreHandle_t sem)
{
    if (!sem) return pdFALSE;
    net_test_lock_t *l = (net_test_lock_t *)sem;
    if (l->depth > 0) l->depth--;
    return pdTRUE;
}

int net_test_lock_depth(SemaphoreHandle_t sem)
{
    if (!sem) return 0;
    return ((net_test_lock_t *)sem)->depth;
}

int net_test_locks_created(void) { return g_locks_created; }

void net_test_locks_reset(void)
{
    memset(g_locks, 0, sizeof(g_locks));
    g_locks_created = 0;
}

/* ------------------------------------------------------------------ */
/* NVS                                                               */
/* ------------------------------------------------------------------ */

#define NET_TEST_NS_COUNT 4          /* one per simulated device, plus spare */
#define NVS_MAX_ENTRIES   24
#define NVS_MAX_BLOB      (16 * 1024)
#define NVS_KEY_MAX       24
#define NVS_NS_MAX        16

typedef struct {
    int     used;
    int     ns_index;
    char    key[NVS_KEY_MAX];
    size_t  len;
    unsigned char data[NVS_MAX_BLOB];
} net_test_nvs_entry_t;

static net_test_nvs_entry_t g_nvs[NVS_MAX_ENTRIES];
static int g_nvs_current_ns;

/*
 * Write bookkeeping and fault injection, for the badge_events save tests.
 *
 * The persistence layer's contract is about WHEN a write happens and what it does when one
 * fails, so a store that always succeeded would leave the interesting half of badge_events.c
 * untested. Counting successes separately from attempts is what lets a test tell "the
 * debounce correctly declined to write" apart from "it tried and the write failed".
 */
static int g_nvs_set_count;
static int g_nvs_commit_count;
static int g_nvs_fail_set;
static int g_nvs_fail_commit;

/* Defined with the store itself, further down. */
static net_test_nvs_entry_t *net_test_nvs_find(const char *key, int create);

void net_test_nvs_reset(void)
{
    memset(g_nvs, 0, sizeof(g_nvs));
    g_nvs_current_ns = 0;
    g_nvs_set_count = 0;
    g_nvs_commit_count = 0;
    g_nvs_fail_set = 0;
    g_nvs_fail_commit = 0;
}

int  net_test_nvs_set_count(void)    { return g_nvs_set_count; }
int  net_test_nvs_commit_count(void) { return g_nvs_commit_count; }
void net_test_nvs_fail_set(int count)    { g_nvs_fail_set = count; }
void net_test_nvs_fail_commit(int count) { g_nvs_fail_commit = count; }

void net_test_nvs_counters_reset(void)
{
    g_nvs_set_count = 0;
    g_nvs_commit_count = 0;
}

int net_test_nvs_blob_size(const char *key)
{
    if (!key) return -1;
    net_test_nvs_entry_t *e = net_test_nvs_find(key, 0);
    return e ? (int)e->len : -1;
}

int net_test_nvs_blob_read(const char *key, void *out, size_t cap)
{
    if (!key || !out) return -1;
    net_test_nvs_entry_t *e = net_test_nvs_find(key, 0);
    if (!e) return -1;
    if (e->len > cap) return -1;
    if (e->len) memcpy(out, e->data, e->len);
    return (int)e->len;
}

void net_test_nvs_poke(const char *key, size_t offset, unsigned char value)
{
    if (!key) return;
    net_test_nvs_entry_t *e = net_test_nvs_find(key, 0);
    if (!e || offset >= e->len) return;
    e->data[offset] = value;
}

void net_test_nvs_select_device(int device_index)
{
    if (device_index < 0) device_index = 0;
    if (device_index >= NET_TEST_NS_COUNT) device_index = NET_TEST_NS_COUNT - 1;
    /*
     * Offset by one so a namespace index is never 0 by accident: an unset/zeroed index
     * should be distinguishable from "device 0".
     */
    g_nvs_current_ns = device_index + 1;
}

esp_err_t nvs_open(const char *name, int open_mode, nvs_handle_t *out_handle)
{
    (void)open_mode;
    if (!name || !out_handle) return ESP_ERR_INVALID_ARG;

    /*
     * The firmware uses one namespace per concern ("catsoc" here, "petgame" in main.c's save).
     * The store is keyed on both that name and the current simulated device, so two devices
     * running the same code genuinely have separate storage -- otherwise a "reloaded
     * instance sees what the first one wrote" assertion would pass without any write having
     * happened at all.
     */
    if (strcmp(name, "catsoc") == 0)       g_nvs_current_ns |= 0x00;   /* device's own */
    else if (strcmp(name, "petgame") == 0) g_nvs_current_ns |= 0x40;   /* separate slot */
    else                                   g_nvs_current_ns |= 0x20;

    *out_handle = 1;
    return ESP_OK;
}

void nvs_close(nvs_handle_t handle) { (void)handle; }

static net_test_nvs_entry_t *net_test_nvs_find(const char *key, int create)
{
    for (int i = 0; i < NVS_MAX_ENTRIES; i++) {
        if (g_nvs[i].used && g_nvs[i].ns_index == g_nvs_current_ns &&
            strcmp(g_nvs[i].key, key) == 0) {
            return &g_nvs[i];
        }
    }
    if (!create) return NULL;
    for (int i = 0; i < NVS_MAX_ENTRIES; i++) {
        if (!g_nvs[i].used) {
            g_nvs[i].used = 1;
            g_nvs[i].ns_index = g_nvs_current_ns;
            snprintf(g_nvs[i].key, sizeof(g_nvs[i].key), "%s", key);
            g_nvs[i].len = 0;
            return &g_nvs[i];
        }
    }
    return NULL;
}

esp_err_t nvs_set_blob(nvs_handle_t handle, const char *key, const void *value, size_t length)
{
    (void)handle;
    if (g_nvs_fail_set > 0) {
        g_nvs_fail_set--;
        return ESP_FAIL;
    }
    if (!key) return ESP_ERR_INVALID_ARG;
    if (length && !value) return ESP_ERR_INVALID_ARG;
    if (length > NVS_MAX_BLOB) return ESP_ERR_INVALID_SIZE;

    net_test_nvs_entry_t *e = net_test_nvs_find(key, 1);
    if (!e) return ESP_ERR_NO_MEM;
    if (length) memcpy(e->data, value, length);
    e->len = length;
    g_nvs_set_count++;
    return ESP_OK;
}

esp_err_t nvs_get_blob(nvs_handle_t handle, const char *key, void *out_value, size_t *length)
{
    (void)handle;
    if (!key || !length) return ESP_ERR_INVALID_ARG;

    net_test_nvs_entry_t *e = net_test_nvs_find(key, 0);
    if (!e) return ESP_ERR_NVS_NOT_FOUND;

    if (out_value == NULL) {
        /* Property 1: size query, no copy. */
        *length = e->len;
        return ESP_OK;
    }
    /*
     * Property 2: fail before copying. The real nvs_get_blob() reports
     * ESP_ERR_NVS_INVALID_LENGTH and leaves the caller's buffer untouched; load_records()
     * relies on the size check happening first, so a stand-in that truncated instead would
     * hide a bug in that validation.
     */
    if (*length < e->len) return ESP_ERR_INVALID_SIZE;

    if (e->len) memcpy(out_value, e->data, e->len);
    *length = e->len;
    return ESP_OK;
}

esp_err_t nvs_erase_key(nvs_handle_t handle, const char *key)
{
    (void)handle;
    if (!key) return ESP_ERR_INVALID_ARG;
    net_test_nvs_entry_t *e = net_test_nvs_find(key, 0);
    if (!e) return ESP_ERR_NVS_NOT_FOUND;
    memset(e, 0, sizeof(*e));
    return ESP_OK;
}

esp_err_t nvs_commit(nvs_handle_t handle)
{
    (void)handle;
    if (g_nvs_fail_commit > 0) {
        g_nvs_fail_commit--;
        return ESP_FAIL;
    }
    g_nvs_commit_count++;
    return ESP_OK;
}
