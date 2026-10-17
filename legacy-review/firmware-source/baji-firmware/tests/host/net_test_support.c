/*
 * HMAC-SHA256 for the host tests, over the host's own SHA-256.
 *
 * Implemented here rather than stubbed, and anchored against the published FIPS and
 * RFC 4231 vectors in test_net_social.c. That anchoring is not ceremony: the social
 * protocol's only authentication is an HMAC tag comparison, so a broken or fake HMAC would
 * make every tag "verify" and the handshake tests would pass while proving nothing.
 */

#include <stdlib.h>
#include <string.h>

#include <stdint.h>

#include "mbedtls/md.h"

/* ------------------------------------------------------------------ */
/* SHA-256 (FIPS 180-4)                                              */
/* ------------------------------------------------------------------ */

typedef struct {
    uint32_t state[8];
    uint64_t bitlen;
    unsigned char buffer[64];
    size_t buflen;
} sha256_ctx_t;

static const uint32_t SHA256_K[64] = {
    0x428a2f98u,0x71374491u,0xb5c0fbcfu,0xe9b5dba5u,0x3956c25bu,0x59f111f1u,0x923f82a4u,0xab1c5ed5u,
    0xd807aa98u,0x12835b01u,0x243185beu,0x550c7dc3u,0x72be5d74u,0x80deb1feu,0x9bdc06a7u,0xc19bf174u,
    0xe49b69c1u,0xefbe4786u,0x0fc19dc6u,0x240ca1ccu,0x2de92c6fu,0x4a7484aau,0x5cb0a9dcu,0x76f988dau,
    0x983e5152u,0xa831c66du,0xb00327c8u,0xbf597fc7u,0xc6e00bf3u,0xd5a79147u,0x06ca6351u,0x14292967u,
    0x27b70a85u,0x2e1b2138u,0x4d2c6dfcu,0x53380d13u,0x650a7354u,0x766a0abbu,0x81c2c92eu,0x92722c85u,
    0xa2bfe8a1u,0xa81a664bu,0xc24b8b70u,0xc76c51a3u,0xd192e819u,0xd6990624u,0xf40e3585u,0x106aa070u,
    0x19a4c116u,0x1e376c08u,0x2748774cu,0x34b0bcb5u,0x391c0cb3u,0x4ed8aa4au,0x5b9cca4fu,0x682e6ff3u,
    0x748f82eeu,0x78a5636fu,0x84c87814u,0x8cc70208u,0x90befffau,0xa4506cebu,0xbef9a3f7u,0xc67178f2u
};

#define ROTR32(x, n) (((x) >> (n)) | ((x) << (32 - (n))))

static void sha256_block(sha256_ctx_t *c, const unsigned char *p)
{
    uint32_t w[64];
    for (int i = 0; i < 16; i++) {
        w[i] = ((uint32_t)p[i * 4] << 24) | ((uint32_t)p[i * 4 + 1] << 16) |
               ((uint32_t)p[i * 4 + 2] << 8) | (uint32_t)p[i * 4 + 3];
    }
    for (int i = 16; i < 64; i++) {
        const uint32_t s0 = ROTR32(w[i - 15], 7) ^ ROTR32(w[i - 15], 18) ^ (w[i - 15] >> 3);
        const uint32_t s1 = ROTR32(w[i - 2], 17) ^ ROTR32(w[i - 2], 19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }

    uint32_t a = c->state[0], b = c->state[1], cc = c->state[2], d = c->state[3];
    uint32_t e = c->state[4], f = c->state[5], g = c->state[6], h = c->state[7];

    for (int i = 0; i < 64; i++) {
        const uint32_t S1 = ROTR32(e, 6) ^ ROTR32(e, 11) ^ ROTR32(e, 25);
        const uint32_t ch = (e & f) ^ ((~e) & g);
        const uint32_t t1 = h + S1 + ch + SHA256_K[i] + w[i];
        const uint32_t S0 = ROTR32(a, 2) ^ ROTR32(a, 13) ^ ROTR32(a, 22);
        const uint32_t maj = (a & b) ^ (a & cc) ^ (b & cc);
        const uint32_t t2 = S0 + maj;
        h = g; g = f; f = e; e = d + t1;
        d = cc; cc = b; b = a; a = t1 + t2;
    }

    c->state[0] += a; c->state[1] += b; c->state[2] += cc; c->state[3] += d;
    c->state[4] += e; c->state[5] += f; c->state[6] += g; c->state[7] += h;
}

void net_test_sha256(const unsigned char *data, size_t len, unsigned char out[32])
{
    sha256_ctx_t c;
    c.state[0] = 0x6a09e667u; c.state[1] = 0xbb67ae85u;
    c.state[2] = 0x3c6ef372u; c.state[3] = 0xa54ff53au;
    c.state[4] = 0x510e527fu; c.state[5] = 0x9b05688cu;
    c.state[6] = 0x1f83d9abu; c.state[7] = 0x5be0cd19u;
    c.bitlen = 0;
    c.buflen = 0;

    size_t i = 0;
    while (i < len) {
        c.buffer[c.buflen++] = data[i++];
        if (c.buflen == 64) {
            sha256_block(&c, c.buffer);
            c.bitlen += 512;
            c.buflen = 0;
        }
    }

    c.bitlen += (uint64_t)c.buflen * 8;
    c.buffer[c.buflen++] = 0x80;
    if (c.buflen > 56) {
        while (c.buflen < 64) c.buffer[c.buflen++] = 0;
        sha256_block(&c, c.buffer);
        c.buflen = 0;
    }
    while (c.buflen < 56) c.buffer[c.buflen++] = 0;
    for (int k = 7; k >= 0; k--) c.buffer[c.buflen++] = (unsigned char)(c.bitlen >> (k * 8));
    sha256_block(&c, c.buffer);

    for (int k = 0; k < 8; k++) {
        out[k * 4]     = (unsigned char)(c.state[k] >> 24);
        out[k * 4 + 1] = (unsigned char)(c.state[k] >> 16);
        out[k * 4 + 2] = (unsigned char)(c.state[k] >> 8);
        out[k * 4 + 3] = (unsigned char)(c.state[k]);
    }
}

/* ------------------------------------------------------------------ */
/* HMAC (RFC 2104)                                                   */
/* ------------------------------------------------------------------ */

#define HMAC_MSG_MAX 2048

typedef struct {
    unsigned char key[64];
    size_t        keylen;
    unsigned char msg[HMAC_MSG_MAX];
    size_t        msglen;
    int           overrun;   /* reported rather than silently truncating */
} hmac_state_t;

const mbedtls_md_info_t *mbedtls_md_info_from_type(int md_type)
{
    if (md_type != MBEDTLS_MD_SHA256) return NULL;
    static int marker;
    return (const mbedtls_md_info_t *)&marker;
}

void mbedtls_md_init(mbedtls_md_context_t *ctx)
{
    if (ctx) ctx->ctx = NULL;
}

void mbedtls_md_free(mbedtls_md_context_t *ctx)
{
    if (ctx && ctx->ctx) {
        free(ctx->ctx);
        ctx->ctx = NULL;
    }
}

int mbedtls_md_setup(mbedtls_md_context_t *ctx, const mbedtls_md_info_t *info, int hmac)
{
    (void)hmac;
    if (!ctx || !info) return -1;
    ctx->ctx = calloc(1, sizeof(hmac_state_t));
    return ctx->ctx ? 0 : -1;
}

/*
 * Plain SHA-256 start/update/finish, used by derive_key() in net_social.c. Implemented as a
 * one-shot accumulation over the shared context: the firmware only ever hashes a single
 * short buffer, so a streaming interface is unnecessary here.
 */
int mbedtls_md_starts(mbedtls_md_context_t *ctx)
{
    if (!ctx || !ctx->ctx) return -1;
    hmac_state_t *st = (hmac_state_t *)ctx->ctx;
    st->msglen = 0;
    st->overrun = 0;
    return 0;
}

int mbedtls_md_update(mbedtls_md_context_t *ctx, const unsigned char *input, size_t ilen)
{
    return mbedtls_md_hmac_update(ctx, input, ilen);
}

int mbedtls_md_finish(mbedtls_md_context_t *ctx, unsigned char *output)
{
    if (!ctx || !ctx->ctx || !output) return -1;
    hmac_state_t *st = (hmac_state_t *)ctx->ctx;
    if (st->overrun) return -1;
    /* A plain hash, not an HMAC: no ipad/opad, just the message. */
    net_test_sha256(st->msg, st->msglen, output);
    return 0;
}

int mbedtls_md_hmac_starts(mbedtls_md_context_t *ctx, const unsigned char *key, size_t keylen)
{
    if (!ctx || !ctx->ctx || (!key && keylen)) return -1;
    hmac_state_t *st = (hmac_state_t *)ctx->ctx;
    memset(st, 0, sizeof(*st));

    if (keylen > 64) {
        /* RFC 2104: a key longer than the block size is hashed first. */
        net_test_sha256(key, keylen, st->key);
        st->keylen = 32;
    } else {
        if (keylen) memcpy(st->key, key, keylen);
        st->keylen = keylen;
    }
    return 0;
}

int mbedtls_md_hmac_update(mbedtls_md_context_t *ctx, const unsigned char *input, size_t ilen)
{
    if (!ctx || !ctx->ctx) return -1;
    hmac_state_t *st = (hmac_state_t *)ctx->ctx;
    if (st->msglen + ilen > sizeof(st->msg)) {
        st->overrun = 1;
        return -1;
    }
    if (ilen) memcpy(st->msg + st->msglen, input, ilen);
    st->msglen += ilen;
    return 0;
}

int mbedtls_md_hmac_finish(mbedtls_md_context_t *ctx, unsigned char *output)
{
    if (!ctx || !ctx->ctx || !output) return -1;
    hmac_state_t *st = (hmac_state_t *)ctx->ctx;
    if (st->overrun) return -1;

    unsigned char ipad[64], opad[64];
    for (int i = 0; i < 64; i++) {
        ipad[i] = st->key[i] ^ 0x36;
        opad[i] = st->key[i] ^ 0x5C;
    }

    unsigned char inner[64 + HMAC_MSG_MAX];
    memcpy(inner, ipad, 64);
    memcpy(inner + 64, st->msg, st->msglen);
    unsigned char inner_hash[32];
    net_test_sha256(inner, 64 + st->msglen, inner_hash);

    unsigned char outer[64 + 32];
    memcpy(outer, opad, 64);
    memcpy(outer + 64, inner_hash, 32);
    net_test_sha256(outer, sizeof(outer), output);
    return 0;
}

void net_test_hmac_sha256(const unsigned char *key, size_t keylen,
                          const unsigned char *msg, size_t msglen,
                          unsigned char out[32])
{
    mbedtls_md_context_t c;
    mbedtls_md_init(&c);
    mbedtls_md_setup(&c, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
    mbedtls_md_hmac_starts(&c, key, keylen);
    mbedtls_md_hmac_update(&c, msg, msglen);
    mbedtls_md_hmac_finish(&c, out);
    mbedtls_md_free(&c);
}
