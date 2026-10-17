/*
 * Stand-in for ESP-IDF's esp_log.h for the host tests.
 *
 * The firmware logs through these macros on paths the tests exercise heavily (every frame
 * produces a line or two). Printing them by default would bury the assertions, so they are
 * silenced unless NET_TEST_VERBOSE is defined -- at which point they become the most
 * useful thing to read when a handshake test fails.
 *
 * The variadic form matters: the real macros are variadic and the call sites rely on it, so
 * a non-variadic stand-in would fail to compile them.
 */
#pragma once

#include <stdio.h>

#ifdef NET_TEST_VERBOSE
#define ESP_LOGE(tag, fmt, ...) printf("[E] %s: " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGW(tag, fmt, ...) printf("[W] %s: " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGI(tag, fmt, ...) printf("[I] %s: " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGD(tag, fmt, ...) printf("[D] %s: " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGV(tag, fmt, ...) printf("[V] %s: " fmt "\n", tag, ##__VA_ARGS__)
#else
/*
 * `if (0) printf(...)` rather than a bare discard. The arguments stay referenced, which
 * matters: a log call is often the only use of a variable, so a stand-in that dropped them
 * would introduce -Wunused-variable warnings in production code that the real build does
 * not have. Keeping them referenced and type-checked means the host build sees the same
 * diagnostics as the firmware build, while printing nothing.
 */
#define ESP_LOGE(tag, fmt, ...) \
    do { (void)(tag); if (0) { printf("[E] " fmt "\n", ##__VA_ARGS__); } } while (0)
#define ESP_LOGW(tag, fmt, ...) \
    do { (void)(tag); if (0) { printf("[W] " fmt "\n", ##__VA_ARGS__); } } while (0)
#define ESP_LOGI(tag, fmt, ...) \
    do { (void)(tag); if (0) { printf("[I] " fmt "\n", ##__VA_ARGS__); } } while (0)
#define ESP_LOGD(tag, fmt, ...) \
    do { (void)(tag); if (0) { printf("[D] " fmt "\n", ##__VA_ARGS__); } } while (0)
#define ESP_LOGV(tag, fmt, ...) \
    do { (void)(tag); if (0) { printf("[V] " fmt "\n", ##__VA_ARGS__); } } while (0)
#endif
