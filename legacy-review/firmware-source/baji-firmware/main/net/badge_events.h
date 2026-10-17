/*
 * badge_events - the badge's uplink to the App.
 *
 * The interaction specification defines fourteen event types that travel from the
 * badge to the phone as an 8-byte record (spec 9, and badge_ui_spec.h's
 * `badge_evt_t`):
 *
 *     uint32 ts (unix seconds, little endian) | uint8 type | uint8 a | int16 b
 *
 * They are queued offline (at most BADGE_EVENT_QUEUE_MAX records, in a file-level
 * static buffer -- never on a task stack: an 8 KB stack array is what made the
 * previous firmware reboot on boot, docs/m1-hardware-verification.md:28-57), and
 * flushed over the existing BLE link when a phone is connected. The App settles the
 * pet's numbers; the badge itself only reports what the user did.
 *
 * This module owns the queue, the encoding and the NVS persistence of unsent
 * records. It does not own the radio: it borrows net_link_send().
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

#include "badge_spec.h" /* EVT_*, BADGE_EVENT_QUEUE_MAX, badge_evt_t */

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Load the unsent queue from NVS and start the flush timer.
 *
 * Safe to call before the radio is up: records simply accumulate. Returns
 * ESP_ERR_INVALID_STATE when called twice.
 */
esp_err_t badge_events_init(void);

/**
 * @brief Append an event and arm the flush.
 *
 * `ts` is unix seconds; pass 0 to let the module stamp it from its own clock
 * offset. The queue is a ring: when it is full the OLDEST record is dropped,
 * because a phone that never connects must not be able to wedge the badge.
 */
void badge_events_push(badge_evt_type_t type, uint8_t a, int16_t b);

/** @brief Number of records waiting to be sent. */
int badge_events_pending(void);

/** @brief Total records appended since boot, for the log line. */
uint32_t badge_events_total(void);

/**
 * @brief Try to send everything queued to the connected phone.
 *
 * Called from the app tick; a no-op when nothing is connected. Records leave the
 * queue only after net_link_send() reports success, so a dropped connection
 * leaves them pending for the next one.
 *
 * @param connected  whether a phone is connected; false short-circuits
 */
void badge_events_flush(bool connected);

/** @brief True while a flush is worth attempting (something is queued). */
bool badge_events_dirty(void);

/**
 * @brief Encode one event into the 8-byte wire form, little endian.
 *
 * Exposed for the host tests and the App's own decoder table.
 */
void badge_events_encode(const badge_evt_t *evt, uint8_t out[BADGE_EVENT_WIRE_BYTES]);

/** @brief Decode an 8-byte wire record. Returns false when it is malformed. */
bool badge_events_decode(const uint8_t in[BADGE_EVENT_WIRE_BYTES], badge_evt_t *out);

/**
 * @brief Feed the module a monotonic millisecond clock.
 *
 * The board has no RTC (spec 12.7), so unix seconds are this module's own counter
 * plus whatever the App later syncs through badge_events_set_time().
 */
void badge_events_tick(uint32_t now_ms);

/** @brief Advance event time only; safe on the owner thread's input path.
 * Deferred NVS writes belong to badge_events_tick(), never the finger callback. */
void badge_events_advance_clock(uint32_t now_ms);

/** @brief Adopt the phone's clock: seconds since the epoch. */
void badge_events_set_time(uint32_t unix_seconds);

/** @brief Current badge time in unix seconds, for the event timestamp. */
uint32_t badge_events_now(void);

/** @brief Persist the pending queue to NVS now (used at power-down and in tests). */
esp_err_t badge_events_save(void);

/** @brief Drop every pending record (factory reset, unit tests). */
void badge_events_clear(void);

/**
 * @brief Read one queued record by index, oldest first.
 * @return false when the index is out of range
 */
bool badge_events_peek(int index, badge_evt_t *out);

/** @brief The spec's label for an event type ("摸摸", ...), or "" when unknown. */
const char *badge_event_label(int type);

#ifdef __cplusplus
}
#endif
