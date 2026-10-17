/*
 * Stand-in for ESP-IDF's nvs.h for the host tests.
 *
 * An in-memory key/value store. Two properties are reproduced because load_records()
 * depends on them, and a stand-in that got either wrong would let a real defect through:
 *
 *   1. nvs_get_blob(handle, key, NULL, &len) reports the stored size without copying.
 *   2. nvs_get_blob() with a too-small buffer fails BEFORE copying, rather than
 *      overflowing or truncating.
 *
 * Namespaces are separated by the harness, one per simulated device, so the two sides of
 * the handshake genuinely have their own secrets, encounter logs and dexes. Sharing one
 * store between them would make the two-device test two views of one device.
 */
#pragma once

#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

typedef int32_t nvs_handle_t;


#define NVS_READONLY  0
#define NVS_READWRITE 1

esp_err_t nvs_open(const char *name, int open_mode, nvs_handle_t *out_handle);
void      nvs_close(nvs_handle_t handle);
esp_err_t nvs_set_blob(nvs_handle_t handle, const char *key, const void *value, size_t length);
esp_err_t nvs_get_blob(nvs_handle_t handle, const char *key, void *out_value, size_t *length);
esp_err_t nvs_erase_key(nvs_handle_t handle, const char *key);
esp_err_t nvs_commit(nvs_handle_t handle);

/** Wipe every namespace, so a scenario starts from an unprovisioned device. */
void net_test_nvs_reset(void);

/**
 * @brief Select which simulated device's namespace the following calls use.
 *
 * The real code has one NVS and one radio, so it never passes either around. The harness
 * mirrors that by switching a current-device selector before driving each side.
 */
void net_test_nvs_select_device(int device_index);

/* ------------------------------------------------------------------ */
/* test control for the persistence layer                             */
/* ------------------------------------------------------------------ */

/*
 * The save path is the one module whose whole job is "make sure what the player did
 * survives a power cut", and its failure mode is silence: a dropped write returns an
 * error nobody reads, and the only symptom is that the last meal was forgotten. So the
 * store has to be observable from the outside -- these read what was actually kept and
 * inject the failures the debounce logic is supposed to cope with.
 */

/** Number of nvs_set_blob() calls that stored something (failures not counted). */
int net_test_nvs_set_count(void);

/** Number of nvs_commit() calls that succeeded. */
int net_test_nvs_commit_count(void);

/** Make the next `count` nvs_set_blob() calls fail. 0 restores normal behaviour. */
void net_test_nvs_fail_set(int count);

/** Make the next `count` nvs_commit() calls fail. 0 restores normal behaviour. */
void net_test_nvs_fail_commit(int count);

/** Clear the counters, so a scenario can assert on its own writes only. */
void net_test_nvs_counters_reset(void);

/** Stored blob size in bytes, or -1 when the key is absent from the current namespace. */
int net_test_nvs_blob_size(const char *key);

/**
 * @brief Copy the stored blob out, for comparison against a serialised state.
 *
 * Returns the number of bytes copied, or -1 when the key is absent or `cap` is too small.
 */
int net_test_nvs_blob_read(const char *key, void *out, size_t cap);

/** Overwrite one byte inside a stored blob, to model a save that rotted in flash. */
void net_test_nvs_poke(const char *key, size_t offset, unsigned char value);
