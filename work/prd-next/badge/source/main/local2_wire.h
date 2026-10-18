#pragma once
#include <stddef.h>
#include <stdbool.h>
#include <stdint.h>
/* Caller supplies one complete UTF-8 JSON object, without LF. */
bool local2_wire_handle(const char *line,size_t length,char *out,size_t capacity);
void local2_clock_calibrate(uint64_t epoch_ms,int utc_offset_minutes);
int local2_clock_utc_offset_minutes(void);
bool local2_clock_now(uint64_t *out_ms);
