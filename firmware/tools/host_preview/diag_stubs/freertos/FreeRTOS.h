#pragma once
#include <stdint.h>
typedef uint32_t TickType_t;
#define pdMS_TO_TICKS(x) (x)
#define pdPASS 1
/* 主机预览用临界区替身：单线程渲染，锁退化为空操作。 */
typedef struct { int lock; } portMUX_TYPE;
#define portMUX_INITIALIZER_UNLOCKED { 0 }
#define portENTER_CRITICAL(mux) ((void)(mux))
#define portEXIT_CRITICAL(mux) ((void)(mux))
#define portENTER_CRITICAL_ISR(mux) ((void)(mux))
#define portEXIT_CRITICAL_ISR(mux) ((void)(mux))