#pragma once
#include <stdint.h>
#include <stdlib.h>
/* 主机预览用确定性替身：随机数只影响非功能性字段，不参与校验。 */
static inline uint32_t esp_random(void) { return (uint32_t)rand(); }
static inline void esp_fill_random(void *buf, size_t len) {
    unsigned char *p = (unsigned char *)buf;
    for (size_t i = 0; i < len; i++) p[i] = (unsigned char)(rand() & 0xff);
}