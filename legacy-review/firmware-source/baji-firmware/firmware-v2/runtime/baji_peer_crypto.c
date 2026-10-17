#include "baji_peer_crypto.h"
#include "mbedtls/pk.h"
#include "mbedtls/ecdh.h"
#include "mbedtls/md.h"
#include "esp_random.h"
#include "nvs.h"
#include <string.h>
static mbedtls_pk_context identity,root;
static mbedtls_ecp_keypair ephemeral;
static bool initialized;
extern const unsigned char bj_peer_root_pem[];
extern const size_t bj_peer_root_pem_size;
static int rng(void *ctx,unsigned char *bytes,size_t n){(void)ctx;esp_fill_random(bytes,n);return 0;}
static bool random_bytes(void *ctx,uint8_t *bytes,size_t n){(void)ctx;return rng(NULL,bytes,n)==0;}
static bool hash(void *ctx,const uint8_t *b,size_t n,uint8_t out[32]){(void)ctx;const mbedtls_md_info_t *md=mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);return md && mbedtls_md(md,b,n,out)==0;}
static bool hmac(void *ctx,const uint8_t key[32],const uint8_t *b,size_t n,uint8_t out[32]){(void)ctx;const mbedtls_md_info_t *md=mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);return md && mbedtls_md_hmac(md,key,32,b,n,out)==0;}
static bool p256(mbedtls_pk_context *key){return mbedtls_pk_can_do(key,MBEDTLS_PK_ECDSA) && mbedtls_ecp_keypair_get_group_id(mbedtls_pk_ec(*key))==MBEDTLS_ECP_DP_SECP256R1;}
/* Strict positive DER r/s, minimal integer representation, no trailing bytes. */
static bool strict_der(const uint8_t *b,size_t n){
    if(n<8 || n>72 || b[0]!=0x30 || b[1]!=n-2)return false;
    size_t p=2;
    for(unsigned i=0;i<2;i++){
        if(p+2>n || b[p++]!=2)return false;
        size_t len=b[p++];if(!len || len>33 || p+len>n || (b[p]&0x80) || (len>1 && b[p]==0 && !(b[p+1]&0x80)))return false;
        uint8_t nonzero=0;for(size_t j=0;j<len;j++)nonzero|=b[p+j];if(!nonzero)return false;p+=len;
    }
    return p==n;
}
static bool sign(void *ctx,const uint8_t *b,size_t n,uint8_t out[72],size_t *length){
    uint8_t digest[32];(void)ctx;
    return hash(NULL,b,n,digest) && mbedtls_pk_sign(&identity,MBEDTLS_MD_SHA256,digest,32,out,72,length,rng,NULL)==0;
}
static bool verify(void *ctx,bool trusted,const uint8_t public_key[65],const uint8_t *b,size_t n,const uint8_t *sig,size_t len){
    (void)ctx;if(!strict_der(sig,len))return false;
    uint8_t digest[32];if(!hash(NULL,b,n,digest))return false;
    if(trusted)return p256(&root) && mbedtls_pk_verify(&root,MBEDTLS_MD_SHA256,digest,32,sig,len)==0;
    mbedtls_pk_context key;mbedtls_pk_init(&key);
    bool ok=public_key[0]==4 && mbedtls_pk_setup(&key,mbedtls_pk_info_from_type(MBEDTLS_PK_ECKEY))==0;
    if(ok){mbedtls_ecp_keypair *ec=mbedtls_pk_ec(key);ok=mbedtls_ecp_group_load(&ec->MBEDTLS_PRIVATE(grp),MBEDTLS_ECP_DP_SECP256R1)==0 && mbedtls_ecp_point_read_binary(&ec->MBEDTLS_PRIVATE(grp),&ec->MBEDTLS_PRIVATE(Q),public_key,65)==0 && mbedtls_ecp_check_pubkey(&ec->MBEDTLS_PRIVATE(grp),&ec->MBEDTLS_PRIVATE(Q))==0 && mbedtls_pk_verify(&key,MBEDTLS_MD_SHA256,digest,32,sig,len)==0;}
    mbedtls_pk_free(&key);return ok;
}
static void erase(void *ctx){(void)ctx;mbedtls_ecp_keypair_free(&ephemeral);mbedtls_ecp_keypair_init(&ephemeral);}
static bool new_ephemeral(void *ctx,uint8_t out[65]){
    (void)ctx;erase(NULL);size_t size=0;
    return mbedtls_ecp_gen_key(MBEDTLS_ECP_DP_SECP256R1,&ephemeral,rng,NULL)==0 && mbedtls_ecp_point_write_binary(&ephemeral.MBEDTLS_PRIVATE(grp),&ephemeral.MBEDTLS_PRIVATE(Q),MBEDTLS_ECP_PF_UNCOMPRESSED,&size,out,65)==0 && size==65;
}
static bool shared(void *ctx,const uint8_t key[65],uint8_t out[32]){
    (void)ctx;mbedtls_ecp_point point;mbedtls_mpi secret;mbedtls_ecp_point_init(&point);mbedtls_mpi_init(&secret);
    bool ok=key[0]==4 && mbedtls_ecp_point_read_binary(&ephemeral.MBEDTLS_PRIVATE(grp),&point,key,65)==0 && mbedtls_ecp_check_pubkey(&ephemeral.MBEDTLS_PRIVATE(grp),&point)==0 && mbedtls_ecdh_compute_shared(&ephemeral.MBEDTLS_PRIVATE(grp),&secret,&point,&ephemeral.MBEDTLS_PRIVATE(d),rng,NULL)==0 && mbedtls_mpi_write_binary(&secret,out,32)==0;
    mbedtls_ecp_point_free(&point);mbedtls_mpi_free(&secret);return ok;
}
esp_err_t bj_peer_crypto_load(bj_peer_auth_t *a,const uint8_t mac[6]){
    if(initialized)return ESP_ERR_INVALID_STATE;
    mbedtls_pk_init(&identity);mbedtls_pk_init(&root);mbedtls_ecp_keypair_init(&ephemeral);
    if(bj_peer_root_pem_size<2)return ESP_ERR_NOT_FOUND;
    nvs_handle_t nvs;uint8_t private_der[256],cert[72];size_t private_size=sizeof(private_der),cert_size=sizeof(cert);
    if(nvs_open("baji_v2",NVS_READONLY,&nvs)!=ESP_OK)return ESP_ERR_NOT_FOUND;
    bool ok=nvs_get_blob(nvs,"peer_private",private_der,&private_size)==ESP_OK && nvs_get_blob(nvs,"peer_cert",cert,&cert_size)==ESP_OK;
    nvs_close(nvs);
    ok=ok && mbedtls_pk_parse_public_key(&root,bj_peer_root_pem,bj_peer_root_pem_size)==0 && p256(&root) && mbedtls_pk_parse_key(&identity,private_der,private_size,NULL,0,rng,NULL)==0 && p256(&identity);
    volatile uint8_t *erase_key=private_der;for(size_t i=0;i<sizeof(private_der);i++)erase_key[i]=0;
    uint8_t public_key[65];size_t size=0;
    ok=ok && mbedtls_ecp_point_write_binary(&mbedtls_pk_ec(identity)->MBEDTLS_PRIVATE(grp),&mbedtls_pk_ec(identity)->MBEDTLS_PRIVATE(Q),MBEDTLS_ECP_PF_UNCOMPRESSED,&size,public_key,65)==0 && size==65;
    const bj_peer_crypto_t crypto={.random=random_bytes,.ephemeral=new_ephemeral,.sign=sign,.verify=verify,.shared=shared,.hash=hash,.hmac=hmac,.erase=erase};
    ok=ok && bj_peer_auth_init(a,&crypto,mac,public_key,cert,cert_size);
    if(!ok){mbedtls_pk_free(&identity);mbedtls_pk_free(&root);erase(NULL);return ESP_FAIL;}
    initialized=true;return ESP_OK;
}
