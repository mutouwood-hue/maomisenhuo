/*
 * Stand-in for ESP-IDF's esp_random.h for the host tests.
 *
 * Deterministic on purpose. The handshake chooses a session nonce at random and the code
 * explicitly guards against a zero draw, so a test that wants to exercise that guard needs
 * to be able to force the draw -- which an OS entropy source would not allow. A seeded
 * generator also makes a failing run replayable.
 *
 * The generator never returns zero on its own, precisely so the seeded sequence cannot
 * wander into the guarded branch by accident and make a run inexplicable. The guard is
 * tested directly instead, with a forced value.
 */
#pragma once

#include <stddef.h>
#include <stdint.h>

/** Reseed, so each scenario is reproducible. */
void net_test_seed_random(uint32_t seed);

/** Force the next esp_random() result, to drive the zero-nonce path. */
void net_test_force_next_random(uint32_t value);

uint32_t esp_random(void);
void     esp_fill_random(void *buf, size_t len);
