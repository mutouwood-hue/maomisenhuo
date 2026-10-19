#pragma once
#include <stddef.h>
#include <stdbool.h>
#include <stdint.h>
/* Caller supplies one complete UTF-8 JSON object, without LF. */
bool local2_wire_handle(const char *line,size_t length,char *out,size_t capacity,uint32_t session);
/* BLE resets the token without taking the domain mutex; never touches NVS. */
void local2_wire_reset_session(uint32_t session);
/* 仅domain任务调用：最多一个待答复请求，与原outgoing串行队列共享。 */
bool local2_wire_context_poll(uint32_t session,uint64_t mono_ms,char *out,size_t capacity);
void local2_wire_context_send_failed(uint32_t session);
typedef enum { L2_LOCATION_UNAVAILABLE,L2_LOCATION_AVAILABLE,L2_LOCATION_NOT_AUTHORIZED,L2_LOCATION_STALE } l2_location_status_t;
typedef struct {
    l2_location_status_t status;
    bool foreground;
    uint64_t captured_at_ms,received_mono_ms,expires_mono_ms;
    double accuracy_meters,latitude,longitude;
} l2_mobile_context_t;
/* 观测只保留RAM，不用于改写游戏场景或持久化原始位置。 */
void local2_wire_get_mobile_context(uint64_t mono_ms,l2_mobile_context_t *out);
void local2_clock_calibrate(uint64_t epoch_ms,int utc_offset_minutes);
int local2_clock_utc_offset_minutes(void);
bool local2_clock_now(uint64_t *out_ms);
