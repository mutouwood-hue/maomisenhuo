/*
 * Stand-in for mbedtls/md.h for the host tests.
 *
 * The host toolchain has no mbedTLS, so HMAC-SHA256 is implemented on top of the host's own
 * SHA-256 in net_test_support.c.
 *
 * This must be a REAL HMAC. A stand-in that returned a fixed tag, or zeros, would make
 * every tag comparison in net_social.c succeed -- so the handshake tests would pass while
 * the authentication they depend on did nothing whatsoever, and a frame forged by a third
 * party would be indistinguishable from a genuine one. The test therefore also anchors the
 * implementation against the FIPS and RFC 4231 test vectors, because a wrong HMAC would let
 * tag checking pass or fail vacuously in either direction.
 *
 * Only the surface net_social.c uses is declared. Keep it that way: a wider stand-in invites
 * production code to grow dependencies the host build cannot satisfy.
 */
#pragma once

#include <stddef.h>

#define MBEDTLS_MD_SHA256 6

typedef struct {
    void *ctx;   /* opaque; owned by the implementation */
} mbedtls_md_context_t;

typedef void mbedtls_md_info_t;

const mbedtls_md_info_t *mbedtls_md_info_from_type(int md_type);
void mbedtls_md_init(mbedtls_md_context_t *ctx);
void mbedtls_md_free(mbedtls_md_context_t *ctx);
int  mbedtls_md_setup(mbedtls_md_context_t *ctx, const mbedtls_md_info_t *info, int hmac);
int  mbedtls_md_starts(mbedtls_md_context_t *ctx);
int  mbedtls_md_update(mbedtls_md_context_t *ctx, const unsigned char *input, size_t ilen);
int  mbedtls_md_finish(mbedtls_md_context_t *ctx, unsigned char *output);
int  mbedtls_md_hmac_starts(mbedtls_md_context_t *ctx, const unsigned char *key, size_t keylen);
int  mbedtls_md_hmac_update(mbedtls_md_context_t *ctx, const unsigned char *input, size_t ilen);
int  mbedtls_md_hmac_finish(mbedtls_md_context_t *ctx, unsigned char *output);

/** @brief SHA-256, exposed so the tests can anchor it against published vectors. */
void net_test_sha256(const unsigned char *data, size_t len, unsigned char out[32]);

/** @brief One-shot HMAC-SHA256, for the test vectors and for expected values. */
void net_test_hmac_sha256(const unsigned char *key, size_t keylen,
                          const unsigned char *msg, size_t msglen,
                          unsigned char out[32]);
