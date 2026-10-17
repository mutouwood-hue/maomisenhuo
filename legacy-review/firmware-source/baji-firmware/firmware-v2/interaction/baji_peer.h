#pragma once
#include "baji_peer_auth.h"
#include "baji_social_policy.h"
typedef struct {
    bj_peer_auth_t auth;
    uint8_t state,reason,method,reference[64],count;
    bool role_valid,initiator,reference_ready,local_matched,peer_matched;
    bool hello_sent,finish_sent,ready_sent,reference_sent,match_sent;
    bj_rhythm_t taps;
    uint8_t points[9],point_count;
    uint32_t started,follow_started,last_input;
} bj_peer_t;
void bj_peer_clear(bj_peer_t *);
bool bj_peer_begin(bj_peer_t *,const uint8_t[66],uint32_t);
bool bj_peer_role(bj_peer_t *,const uint8_t[6]);
bool bj_peer_receive(bj_peer_t *,uint8_t,const uint8_t *,size_t,uint32_t);
bool bj_peer_next(bj_peer_t *,uint8_t *,uint8_t *,size_t *);
void bj_peer_input(bj_peer_t *,int point,uint32_t);
void bj_peer_tick(bj_peer_t *,uint32_t);
void bj_peer_status(const bj_peer_t *,uint8_t[30]);
size_t bj_peer_reference(const bj_peer_t *,uint8_t[84]);
bool bj_peer_transcript(bj_peer_t *,uint8_t[32]);
