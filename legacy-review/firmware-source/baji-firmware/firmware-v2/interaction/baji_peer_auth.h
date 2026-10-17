#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#define BJ_PEER_HELLO_MAX 316u
#define BJ_PEER_MESSAGE_MAX 112u
#define BJ_PEER_PAYLOAD_MAX 72u
/* Cryptographic adapter owns private keys. Verify(root=true) uses the locally
 * manufactured trust root, never a key supplied by the remote peer. */
typedef struct {
    bool (*random)(void *,uint8_t *,size_t);
    bool (*ephemeral)(void *,uint8_t[65]);
    bool (*sign)(void *,const uint8_t *,size_t,uint8_t[72],size_t *);
    bool (*verify)(void *,bool,const uint8_t[65],const uint8_t *,size_t,const uint8_t *,size_t);
    bool (*shared)(void *,const uint8_t[65],uint8_t[32]);
    bool (*hash)(void *,const uint8_t *,size_t,uint8_t[32]);
    bool (*hmac)(void *,const uint8_t[32],const uint8_t *,size_t,uint8_t[32]);
    void (*erase)(void *);
    void *context;
} bj_peer_crypto_t;
typedef struct {
    bj_peer_crypto_t crypto;
    uint8_t self[6],peer[6],challenge[66],public_key[65],cert_signature[72];
    size_t cert_length;
    uint8_t hello[BJ_PEER_HELLO_MAX],remote[BJ_PEER_HELLO_MAX];
    size_t hello_length,remote_length;
    uint8_t send_key[32],receive_key[32];
    uint32_t sent,received;
    uint8_t transcript[32];
    bool configured,started,derived,authenticated;
} bj_peer_auth_t;
bool bj_peer_auth_finish(bj_peer_auth_t *,uint8_t out[73]);
bool bj_peer_auth_finish_accept(bj_peer_auth_t *,const uint8_t *,size_t);
bool bj_peer_auth_init(bj_peer_auth_t *,const bj_peer_crypto_t *,const uint8_t[6],const uint8_t[65],const uint8_t *,size_t);
void bj_peer_auth_clear(bj_peer_auth_t *);
bool bj_peer_auth_begin(bj_peer_auth_t *,const uint8_t challenge[66]);
bool bj_peer_auth_accept(bj_peer_auth_t *,const uint8_t *,size_t);
bool bj_peer_auth_seal(bj_peer_auth_t *,uint8_t type,const uint8_t *,size_t,uint8_t *,size_t *);
bool bj_peer_auth_open(bj_peer_auth_t *,const uint8_t *,size_t,uint8_t *type,uint8_t *,size_t *);
