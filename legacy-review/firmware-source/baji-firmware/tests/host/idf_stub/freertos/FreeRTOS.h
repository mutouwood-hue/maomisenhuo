/*
 * Stand-in for FreeRTOS headers for the host tests.
 *
 * The host build is single-threaded, so a mutex is a nesting counter rather than a
 * synchronisation primitive. It is deliberately NOT a no-op: if a caller takes the lock
 * and never releases it, the depth stays non-zero and the harness reports the leak. A
 * silent no-op would hide exactly the defect the lock exists to prevent.
 *
 * Both headers are covered by this one file, and the test build maps freertos/FreeRTOS.h,
 * freertos/semphr.h and freertos/queue.h here, because between them the firmware uses only
 * three declarations.
 */
#pragma once

#include <stdint.h>

typedef void  *SemaphoreHandle_t;
typedef void  *QueueHandle_t;
typedef void  *TaskHandle_t;
typedef int    BaseType_t;

#define pdTRUE  1
#define pdFALSE 0
#define pdPASS  1
#define pdFAIL  0

#define portMAX_DELAY ((uint32_t)0xFFFFFFFFu)
#define portTICK_PERIOD_MS 1

SemaphoreHandle_t xSemaphoreCreateMutex(void);
BaseType_t        xSemaphoreTake(SemaphoreHandle_t sem, uint32_t ticks_to_wait);
BaseType_t        xSemaphoreGive(SemaphoreHandle_t sem);

/**
 * @brief How many times a mutex is currently held.
 *
 * Used by the tests to prove no path returns while still holding a lock, which on the
 * badge would be a deadlock waiting for the next caller.
 */
int net_test_lock_depth(SemaphoreHandle_t sem);

/** @brief Total mutexes created, so a per-create leak is visible. */
int net_test_locks_created(void);

/**
 * @brief Return the lock pool to its initial state.
 *
 * Tests create and destroy social instances repeatedly; without this the pool runs out and
 * later instances silently run unlocked, so a lock-discipline assertion would pass
 * vacuously in exactly the tests written to check it.
 */
void net_test_locks_reset(void);
