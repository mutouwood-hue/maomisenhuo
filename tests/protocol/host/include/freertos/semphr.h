#pragma once
typedef void *SemaphoreHandle_t;
static inline SemaphoreHandle_t xSemaphoreCreateMutex(void) { return (void *)1; }
static inline int xSemaphoreTake(SemaphoreHandle_t value, unsigned ticks) { (void)value; (void)ticks; return 1; }
static inline int xSemaphoreGive(SemaphoreHandle_t value) { (void)value; return 1; }
