#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#define BJ_ACTIVE_MAX 32u
#define BJ_ACTIVE_STORE_BYTES (26u+BJ_ACTIVE_MAX*39u)
typedef struct {
    uint8_t bodies[BJ_ACTIVE_MAX][39],session[16];uint16_t count;
    uint64_t next,ack;uint32_t alias,from,started,last;bool tracking,fault;
    bool (*save)(void *,const uint8_t *,size_t);void *context;
} bj_active_t;
void bj_active_init(bj_active_t *,bool (*)(void *,const uint8_t *,size_t),void *);
bool bj_active_load(bj_active_t *,const uint8_t *,size_t);
void bj_active_tick(bj_active_t *,bool,uint32_t,const uint8_t[16],uint32_t,uint32_t);
bool bj_active_ack(bj_active_t *,uint64_t);
