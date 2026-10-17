/*
 * Stand-in for ESP-IDF's esp_timer.h for the host tests.
 *
 * The value is a variable the test advances. That is not a convenience: the social layer
 * arms a 15-second session deadline, and the whole point of the timeout tests is to walk
 * past it. Against a real clock those tests would take 15 seconds each and the suite would
 * become something people stop running.
 */
#pragma once

#include <stdint.h>

/** Simulated microseconds since boot. The test owns this value. */
extern int64_t net_test_time_us;

static inline int64_t esp_timer_get_time(void) { return net_test_time_us; }
