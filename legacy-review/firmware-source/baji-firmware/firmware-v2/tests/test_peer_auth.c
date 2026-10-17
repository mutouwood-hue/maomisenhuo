/* Windows CNG oracle: real P256/SHA256/HMAC, never a fake authentication mock.
 * Tests the portable core; ESP mbedTLS adapter and physical BLE remain separate gates.
 * No private keys, shared secrets, challenge tokens or traffic keys are logged. */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <bcrypt.h>
#ifndef BCRYPT_KDF_RAW_SECRET
#define BCRYPT_KDF_RAW_SECRET L"TRUNCATE"
#endif
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include "baji_peer_auth.h"
#ifdef near
#undef near
#endif
#include "baji_data.h"

static unsigned checks;
#define CHECK(x) do { checks++; if (!(x)) { fprintf(stderr,"FAIL peer-cng line=%d check=%s\n",__LINE__,#x); exit(1); } } while (0)
#define OK(s) ((NTSTATUS)(s)>=0)
typedef struct { BCRYPT_KEY_HANDLE identity,root,ephemeral; unsigned erased; } oracle_t;
static BCRYPT_ALG_HANDLE ecdsa,ecdh,sha,mac;
static BCRYPT_KEY_HANDLE root;
static void wipe(void *p,size_t n) { SecureZeroMemory(p,n); }
static BCRYPT_KEY_HANDLE generate(BCRYPT_ALG_HANDLE alg) {
    BCRYPT_KEY_HANDLE key=NULL;
    CHECK(OK(BCryptGenerateKeyPair(alg,&key,256,0)));
    CHECK(OK(BCryptFinalizeKeyPair(key,0))); return key;
}
static void public_bytes(BCRYPT_KEY_HANDLE key,uint8_t out[65]) {
    uint8_t blob[sizeof(BCRYPT_ECCKEY_BLOB)+64]; ULONG n=0;
    CHECK(OK(BCryptExportKey(key,NULL,BCRYPT_ECCPUBLIC_BLOB,blob,sizeof(blob),&n,0)));
    CHECK(n==sizeof(blob)); out[0]=4;memcpy(out+1,blob+sizeof(BCRYPT_ECCKEY_BLOB),64);
}
static BCRYPT_KEY_HANDLE import_public(BCRYPT_ALG_HANDLE alg,const uint8_t p[65],ULONG magic) {
    uint8_t blob[sizeof(BCRYPT_ECCKEY_BLOB)+64]; BCRYPT_ECCKEY_BLOB hdr={magic,32};
    BCRYPT_KEY_HANDLE key=NULL; if(p[0]!=4)return NULL;
    memcpy(blob,&hdr,sizeof(hdr));memcpy(blob+sizeof(hdr),p+1,64);
    if(!OK(BCryptImportKeyPair(alg,NULL,BCRYPT_ECCPUBLIC_BLOB,&key,blob,sizeof(blob),0)))return NULL;
    return key;
}
static bool digest(BCRYPT_ALG_HANDLE alg,const uint8_t *key,size_t kl,const uint8_t *data,size_t n,uint8_t out[32]) {
    BCRYPT_HASH_HANDLE h=NULL;
    if(kl>ULONG_MAX || n>ULONG_MAX || !OK(BCryptCreateHash(alg,&h,NULL,0,(PUCHAR)key,(ULONG)kl,0)))return false;
    bool ok=OK(BCryptHashData(h,(PUCHAR)data,(ULONG)n,0)) && OK(BCryptFinishHash(h,out,32,0));
    BCryptDestroyHash(h);return ok;
}
static bool hash_cb(void *ctx,const uint8_t *p,size_t n,uint8_t out[32]) { (void)ctx;return digest(sha,NULL,0,p,n,out); }
static bool hmac_cb(void *ctx,const uint8_t k[32],const uint8_t *p,size_t n,uint8_t out[32]) { (void)ctx;return digest(mac,k,32,p,n,out); }
/* Independent DER decoder converting to CNG's fixed-width big-endian r||s. */
static bool der_raw(const uint8_t *der,size_t n,uint8_t raw[64]) {
    if(!der || n<8 || n>72 || der[0]!=0x30 || der[1]!=n-2)return false;
    size_t pos=2;memset(raw,0,64);
    for(unsigned i=0;i<2;i++) {
        if(pos+2>n || der[pos++]!=2)return false;
        size_t len=der[pos++];
        if(!len || len>33 || pos+len>n || (der[pos]&0x80) || (len>1 && der[pos]==0 && !(der[pos+1]&0x80)))return false;
        unsigned nonzero=0;for(size_t j=0;j<len;j++)nonzero|=der[pos+j];if(!nonzero)return false;
        size_t skip=der[pos]==0?1:0;if(len-skip>32)return false;
        memcpy(raw+i*32+32-(len-skip),der+pos+skip,len-skip);pos+=len;
    }
    return pos==n;
}
static size_t raw_der(const uint8_t raw[64],uint8_t der[72]) {
    size_t pos=2;der[0]=0x30;
    for(unsigned i=0;i<2;i++) {
        size_t start=0;while(start<31 && !raw[i*32+start])start++;
        size_t len=32-start;bool pad=(raw[i*32+start]&0x80)!=0;
        der[pos++]=2;der[pos++]=(uint8_t)(len+pad);if(pad)der[pos++]=0;
        memcpy(der+pos,raw+i*32+start,len);pos+=len;
    }
    der[1]=(uint8_t)(pos-2);return pos;
}
static bool sign_key(BCRYPT_KEY_HANDLE key,const uint8_t *p,size_t n,uint8_t out[72],size_t *len) {
    uint8_t d[32],raw[64];ULONG size=0;
    bool ok=hash_cb(NULL,p,n,d) && OK(BCryptSignHash(key,NULL,d,32,raw,64,&size,0)) && size==64;
    if(ok)*len=raw_der(raw,out);wipe(d,sizeof(d));wipe(raw,sizeof(raw));return ok;
}
static bool sign_cb(void *ctx,const uint8_t *p,size_t n,uint8_t out[72],size_t *len) {return sign_key(((oracle_t *)ctx)->identity,p,n,out,len);}
static bool verify_cb(void *ctx,bool trusted,const uint8_t p[65],const uint8_t *data,size_t n,const uint8_t *sig,size_t len) {
    oracle_t *o=ctx;uint8_t d[32],raw[64];
    if(!der_raw(sig,len,raw) || !hash_cb(NULL,data,n,d))return false;
    BCRYPT_KEY_HANDLE key=trusted?o->root:import_public(ecdsa,p,BCRYPT_ECDSA_PUBLIC_P256_MAGIC);
    bool ok=key && OK(BCryptVerifySignature(key,NULL,d,32,raw,64,0));
    if(!trusted && key)BCryptDestroyKey(key);wipe(d,32);wipe(raw,64);return ok;
}
static bool random_cb(void *ctx,uint8_t *p,size_t n) {(void)ctx;return n<=ULONG_MAX && OK(BCryptGenRandom(NULL,p,(ULONG)n,BCRYPT_USE_SYSTEM_PREFERRED_RNG));}
static void erase_cb(void *ctx) {oracle_t *o=ctx;if(o->ephemeral)BCryptDestroyKey(o->ephemeral);o->ephemeral=NULL;o->erased++;}
static bool ephemeral_cb(void *ctx,uint8_t out[65]) {oracle_t *o=ctx;erase_cb(o);o->ephemeral=generate(ecdh);public_bytes(o->ephemeral,out);return true;}
static bool shared_cb(void *ctx,const uint8_t p[65],uint8_t out[32]) {
    oracle_t *o=ctx; BCRYPT_KEY_HANDLE peer=import_public(ecdh,p,BCRYPT_ECDH_PUBLIC_P256_MAGIC);
    BCRYPT_SECRET_HANDLE secret=NULL;uint8_t raw[32];ULONG size=0;
    bool ok=peer && o->ephemeral && OK(BCryptSecretAgreement(o->ephemeral,peer,&secret,0)) &&
        OK(BCryptDeriveKey(secret,BCRYPT_KDF_RAW_SECRET,NULL,raw,32,&size,0)) && size==32;
    /* CNG RAW_SECRET is little endian; protocol IKM is the 32-byte big-endian X. */
    if(ok)for(unsigned i=0;i<32;i++)out[i]=raw[31-i];
    wipe(raw,32);if(secret)BCryptDestroySecret(secret);if(peer)BCryptDestroyKey(peer);return ok;
}
static void known_answers(void) {
    const uint8_t hmac_expected[32]={0xb0,0x34,0x4c,0x61,0xd8,0xdb,0x38,0x53,0x5c,0xa8,0xaf,0xce,0xaf,0x0b,0xf1,0x2b,0x88,0x1d,0xc2,0x00,0xc9,0x83,0x3d,0xa7,0x26,0xe9,0x37,0x6c,0x2e,0x32,0xcf,0xf7};
    uint8_t k[20],d[32];memset(k,0x0b,20);
    CHECK(digest(mac,k,20,(const uint8_t *)"Hi There",8,d));CHECK(!memcmp(d,hmac_expected,32));
    /* P256 private d=1 and peer Q=2G: raw ECDH must equal x(2G). */
    const uint8_t g[64]={
        0x6b,0x17,0xd1,0xf2,0xe1,0x2c,0x42,0x47,0xf8,0xbc,0xe6,0xe5,0x63,0xa4,0x40,0xf2,0x77,0x03,0x7d,0x81,0x2d,0xeb,0x33,0xa0,0xf4,0xa1,0x39,0x45,0xd8,0x98,0xc2,0x96,
        0x4f,0xe3,0x42,0xe2,0xfe,0x1a,0x7f,0x9b,0x8e,0xe7,0xeb,0x4a,0x7c,0x0f,0x9e,0x16,0x2b,0xce,0x33,0x57,0x6b,0x31,0x5e,0xce,0xcb,0xb6,0x40,0x68,0x37,0xbf,0x51,0xf5};
    const uint8_t twice_g[65]={4,
        0x7c,0xf2,0x7b,0x18,0x8d,0x03,0x4f,0x7e,0x8a,0x52,0x38,0x03,0x04,0xb5,0x1a,0xc3,0xc0,0x89,0x69,0xe2,0x77,0xf2,0x1b,0x35,0xa6,0x0b,0x48,0xfc,0x47,0x66,0x99,0x78,
        0x07,0x77,0x55,0x10,0xdb,0x8e,0xd0,0x40,0x29,0x3d,0x9a,0xc6,0x9f,0x74,0x30,0xdb,0xba,0x7d,0xad,0xe6,0x3c,0xe9,0x82,0x29,0x9e,0x04,0xb7,0x9d,0x22,0x78,0x73,0xd1};
    uint8_t blob[sizeof(BCRYPT_ECCKEY_BLOB)+96]={0};BCRYPT_ECCKEY_BLOB hdr={BCRYPT_ECDH_PRIVATE_P256_MAGIC,32};
    memcpy(blob,&hdr,sizeof(hdr));memcpy(blob+sizeof(hdr),g,64);blob[sizeof(blob)-1]=1;
    oracle_t o={0};CHECK(OK(BCryptImportKeyPair(ecdh,NULL,BCRYPT_ECCPRIVATE_BLOB,&o.ephemeral,blob,sizeof(blob),0)));
    CHECK(shared_cb(&o,twice_g,d));CHECK(!memcmp(d,twice_g+1,32));erase_cb(&o);wipe(blob,sizeof(blob));wipe(d,32);
}
static bj_peer_crypto_t adapter(oracle_t *o) {
    bj_peer_crypto_t c={random_cb,ephemeral_cb,sign_cb,verify_cb,shared_cb,hash_cb,hmac_cb,erase_cb,o};return c;
}
static const uint8_t ma[6]={2,0,0,0,0,1},mb[6]={2,0,0,0,0,2},mc[6]={2,0,0,0,0,3};
static void initialize(bj_peer_auth_t *a,oracle_t *o,const uint8_t id[6]) {
    memset(o,0,sizeof(*o));o->root=root;o->identity=generate(ecdsa);
    uint8_t p[65],cert[72]={0},message[85];size_t n=72;public_bytes(o->identity,p);
    static const char cert_domain[]="BAJI-DEVICE-v1";size_t prefix=sizeof(cert_domain)-1;
    memcpy(message,cert_domain,prefix);memcpy(message+prefix,id,6);memcpy(message+prefix+6,p,65);
    CHECK(sign_key(root,message,sizeof(message),cert,&n));bj_peer_crypto_t c=adapter(o);
    CHECK(bj_peer_auth_init(a,&c,id,p,cert,n));
}
static void challenge(uint8_t c[66],const uint8_t self[6],const uint8_t peer[6],unsigned epoch) {
    memset(c,0,66);c[0]=1;for(unsigned i=1;i<17;i++)c[i]=(uint8_t)(i+epoch);
    memcpy(c+17,self,6);memcpy(c+23,peer,6);for(unsigned i=29;i<61;i++)c[i]=(uint8_t)(i+epoch);
    c[61]=0x00;c[62]=0xf1;c[63]=0x53;c[64]=0x65;c[65]=1;
}
static void begin_pair(bj_peer_auth_t *a,bj_peer_auth_t *b,unsigned epoch) {
    uint8_t ca[66],cb[66];challenge(ca,a->self,b->self,epoch);challenge(cb,b->self,a->self,epoch);
    CHECK(bj_peer_auth_begin(a,ca));CHECK(bj_peer_auth_begin(b,cb));
}
static void finish_pair(bj_peer_auth_t *a,bj_peer_auth_t *b) {
    uint8_t fa[73],fb[73];CHECK(bj_peer_auth_accept(a,b->hello,b->hello_length));
    CHECK(bj_peer_auth_accept(b,a->hello,a->hello_length));CHECK(!a->authenticated && !b->authenticated);
    CHECK(bj_peer_auth_finish(a,fa));CHECK(bj_peer_auth_finish(b,fb));
    CHECK(!bj_peer_auth_finish_accept(a,fa,73));CHECK(!bj_peer_auth_finish_accept(b,fb,73));
    CHECK(bj_peer_auth_finish_accept(a,fb,73));CHECK(bj_peer_auth_finish_accept(b,fa,73));
}
/* Reconstruct the protocol independently, without production binding/hash helpers. */
static void check_kdf(bj_peer_auth_t *a,bj_peer_auth_t *b,oracle_t *oa,oracle_t *ob) {
    uint8_t sa[32],sb[32],buf[618],salt[32],prk[32],transcript[32],k1[32],k2[32];
    CHECK(shared_cb(oa,b->hello+171,sa));CHECK(shared_cb(ob,a->hello+171,sb));CHECK(!memcmp(sa,sb,32));
    static const char salt_domain[]="BAJI-PEER-SALT-v1";
    size_t n=sizeof(salt_domain)-1;memcpy(buf,salt_domain,n);
    memcpy(buf+n,a->challenge+1,16);n+=16;memcpy(buf+n,ma,6);n+=6;memcpy(buf+n,mb,6);n+=6;
    memcpy(buf+n,a->challenge+29,37);n+=37;
    CHECK(hash_cb(NULL,buf,n,salt));CHECK(hmac_cb(NULL,salt,sa,32,prk));
    memcpy(buf,a->hello,309);memcpy(buf+309,b->hello,309);CHECK(hash_cb(NULL,buf,618,transcript));
    /* Wire domains are ASCII without NUL; HKDF expand has direction + block 1. */
    static const char key_domain[]="BAJI-PEER-KEY-v1";
    const size_t domain_size=sizeof(key_domain)-1;CHECK(domain_size==16);
    memcpy(buf,key_domain,domain_size);memcpy(buf+domain_size,transcript,32);buf[48]=1;buf[49]=1;
    CHECK(hmac_cb(NULL,prk,buf,50,k1));buf[48]=2;CHECK(hmac_cb(NULL,prk,buf,50,k2));
    CHECK(!memcmp(k1,a->send_key,32));CHECK(!memcmp(k1,b->receive_key,32));
    CHECK(!memcmp(k2,a->receive_key,32));CHECK(!memcmp(k2,b->send_key,32));CHECK(memcmp(k1,k2,32)!=0);
    CHECK(!memcmp(transcript,a->transcript,32));wipe(sa,32);wipe(sb,32);wipe(prk,32);wipe(k1,32);wipe(k2,32);
}
static bool all_zero(const uint8_t *p,size_t n) {while(n--)if(*p++)return false;return true;}
static void resign_hello(bj_peer_auth_t *sender,oracle_t *o,uint8_t h[309]) {
    uint8_t m[340];size_t n=0,length=72;
    const uint8_t *lo=memcmp(sender->self,sender->peer,6)<0?sender->self:sender->peer;
    const uint8_t *hi=lo==sender->self?sender->peer:sender->self;
    static const char hello_domain[]="BAJI-PEER-HELLO-v1";
    n=sizeof(hello_domain)-1;memcpy(m,hello_domain,n);memcpy(m+n,sender->challenge+1,16);n+=16;
    memcpy(m+n,lo,6);n+=6;memcpy(m+n,hi,6);n+=6;memcpy(m+n,sender->challenge+29,37);n+=37;
    memcpy(m+n,h,236);n+=236;memset(h+237,0,72);CHECK(sign_cb(o,m,n,h+237,&length));h[236]=(uint8_t)length;
}
static void expiry_integration(void) {
    bj_peer_t p={0},q={0};oracle_t op,oq;initialize(&p.auth,&op,ma);initialize(&q.auth,&oq,mb);
    for(unsigned mode=0;mode<5;mode++) {
        begin_pair(&p.auth,&q.auth,10+mode);finish_pair(&p.auth,&q.auth);
        p.state=2;p.reference_ready=p.local_matched=p.peer_matched=true;memset(p.reference,0x55,64);
        bj_data_t data;bj_data_init(&data,ma,false,NULL,NULL,NULL);data.peer=&p;
        data.meet_pending=data.meet_confirmed=data.social_role_valid=data.clock_valid=data.session_valid=true;
        data.meet_at=data.session_at=data.clock_at=0;memcpy(data.meet_challenge,p.auth.challenge,66);
        uint32_t expiry=(uint32_t)data.meet_challenge[61]|((uint32_t)data.meet_challenge[62]<<8)|((uint32_t)data.meet_challenge[63]<<16)|((uint32_t)data.meet_challenge[64]<<24);
        data.unix_base=expiry-100;data.session_expiry=expiry+100;
        data.frozen_valid=true;data.frozen_kind=17;data.frozen_length=84;memset(data.frozen,0x55,84);
        memset(data.meet_proof,0x55,64);uint8_t old_finish[73];CHECK(bj_peer_auth_finish(&q.auth,old_finish));
        unsigned erases=op.erased;
        if(mode==0) { data.unix_base=expiry-1;bj_data_tick(&data,999);CHECK(p.auth.authenticated);bj_data_tick(&data,1000); }
        else if(mode==1) {data.clock_valid=false;bj_data_tick(&data,1);}
        else if(mode==2) {bj_data_tick(&data,14999);CHECK(p.auth.authenticated);bj_data_tick(&data,15000);}
        else if(mode==3) {data.session_expiry=data.unix_base+1;bj_data_tick(&data,1000);CHECK(!data.session_valid);}
        else {bj_data_disconnect(&data);CHECK(!data.session_valid);}
        CHECK(op.erased==erases+1 && !op.ephemeral);CHECK(!p.auth.authenticated && !p.auth.derived && !p.state);
        CHECK(all_zero(p.auth.send_key,32) && all_zero(p.auth.receive_key,32) && all_zero(p.reference,64));
        CHECK(!data.meet_pending && !data.meet_confirmed && !data.social_role_valid && !data.frozen_valid);
        CHECK(all_zero(data.meet_proof,64) && all_zero(data.meet_challenge,66));
        CHECK(!bj_peer_auth_finish_accept(&p.auth,old_finish,73));CHECK(!bj_peer_auth_accept(&p.auth,q.auth.hello,309));
    }
    bj_peer_auth_clear(&p.auth);bj_peer_auth_clear(&q.auth);BCryptDestroyKey(op.identity);BCryptDestroyKey(oq.identity);
}
int main(void) {
    CHECK(OK(BCryptOpenAlgorithmProvider(&ecdsa,BCRYPT_ECDSA_P256_ALGORITHM,NULL,0)));
    CHECK(OK(BCryptOpenAlgorithmProvider(&ecdh,BCRYPT_ECDH_P256_ALGORITHM,NULL,0)));
    CHECK(OK(BCryptOpenAlgorithmProvider(&sha,BCRYPT_SHA256_ALGORITHM,NULL,0)));
    CHECK(OK(BCryptOpenAlgorithmProvider(&mac,BCRYPT_SHA256_ALGORITHM,NULL,BCRYPT_ALG_HANDLE_HMAC_FLAG)));
    known_answers();root=generate(ecdsa);
    const uint8_t sha_abc[32]={0xba,0x78,0x16,0xbf,0x8f,0x01,0xcf,0xea,0x41,0x41,0x40,0xde,0x5d,0xae,0x22,0x23,0xb0,0x03,0x61,0xa3,0x96,0x17,0x7a,0x9c,0xb4,0x10,0xff,0x61,0xf2,0x00,0x15,0xad};
    uint8_t d[32];CHECK(hash_cb(NULL,(const uint8_t *)"abc",3,d));CHECK(!memcmp(d,sha_abc,32));
    bj_peer_auth_t a,b,c;oracle_t oa,ob,oc;initialize(&a,&oa,ma);initialize(&b,&ob,mb);initialize(&c,&oc,mc);
    uint8_t ca[66];challenge(ca,ma,mb,0);ca[0]=0;CHECK(!bj_peer_auth_begin(&a,ca));
    challenge(ca,mb,ma,0);CHECK(!bj_peer_auth_begin(&a,ca));challenge(ca,ma,ma,0);CHECK(!bj_peer_auth_begin(&a,ca));
    challenge(ca,ma,mb,0);ca[65]=4;CHECK(!bj_peer_auth_begin(&a,ca));begin_pair(&a,&b,0);
    uint8_t bad[309],old[309],fa[73],fb[73],wire[112],payload[72],type=0;size_t wn=sizeof(wire),pn=sizeof(payload);
    CHECK(!bj_peer_auth_seal(&a,1,NULL,0,wire,&wn));CHECK(!bj_peer_auth_finish(&a,fa));
    CHECK(!bj_peer_auth_accept(&a,a.hello,a.hello_length));
    for(size_t n=0;n<309;n++)CHECK(!bj_peer_auth_accept(&a,b.hello,n));CHECK(!bj_peer_auth_accept(&a,b.hello,310));
    memcpy(bad,b.hello,309);bad[0]=2;CHECK(!bj_peer_auth_accept(&a,bad,309));
    memcpy(bad,b.hello,309);bad[67]^=1;CHECK(!bj_peer_auth_accept(&a,bad,309));
    memcpy(bad,b.hello,309);bad[237]^=1;CHECK(!bj_peer_auth_accept(&a,bad,309));
    memcpy(bad,b.hello,309);bad[66]=73;CHECK(!bj_peer_auth_accept(&a,bad,309));
    memcpy(bad,b.hello,309);bad[236]=7;CHECK(!bj_peer_auth_accept(&a,bad,309));
    if(b.hello[66]<72){memcpy(bad,b.hello,309);bad[67+bad[66]]=1;CHECK(!bj_peer_auth_accept(&a,bad,309));}
    if(b.hello[236]<72){memcpy(bad,b.hello,309);bad[237+bad[236]]=1;CHECK(!bj_peer_auth_accept(&a,bad,309));}
    /* Fully signed invalid ECDH point: cannot be rejected solely by signature corruption. */
    memcpy(bad,b.hello,309);memset(bad+172,0,64);resign_hello(&b,&ob,bad);CHECK(!bj_peer_auth_accept(&a,bad,309));
    memcpy(bad,b.hello,309);bad[171]=3;resign_hello(&b,&ob,bad);CHECK(!bj_peer_auth_accept(&a,bad,309));
    /* Trusted C cert with the same public nonce but the wrong designated peer. */
    challenge(ca,mc,ma,0);CHECK(bj_peer_auth_begin(&c,ca));CHECK(!bj_peer_auth_accept(&a,c.hello,c.hello_length));
    memcpy(bad,b.hello,309);memcpy(bad+139,a.hello+139,32);resign_hello(&b,&ob,bad);CHECK(!bj_peer_auth_accept(&a,bad,309));
    memcpy(bad,b.hello,309);memcpy(bad+171,a.hello+171,65);resign_hello(&b,&ob,bad);CHECK(!bj_peer_auth_accept(&a,bad,309));
    memcpy(old,b.hello,309);finish_pair(&a,&b);check_kdf(&a,&b,&oa,&ob);
    CHECK(bj_peer_auth_accept(&a,b.hello,309));memcpy(bad,b.hello,309);bad[139]^=1;CHECK(!bj_peer_auth_accept(&a,bad,309));
    CHECK(bj_peer_auth_finish(&a,fa));CHECK(bj_peer_auth_finish(&b,fb));
    for(size_t n=0;n<73;n++)CHECK(!bj_peer_auth_finish_accept(&a,fb,n));CHECK(!bj_peer_auth_finish_accept(&a,fb,74));
    uint8_t malformed[73];memcpy(malformed,fb,73);malformed[1]=0x31;CHECK(!bj_peer_auth_finish_accept(&a,malformed,73));
    if(fb[0]<72){memcpy(malformed,fb,73);malformed[fb[0]+1]=1;CHECK(!bj_peer_auth_finish_accept(&a,malformed,73));}
    memset(payload,0x5a,72);wn=sizeof(wire);CHECK(bj_peer_auth_seal(&a,1,payload,72,wire,&wn));CHECK(wn==109);
    uint8_t received[72];pn=72;CHECK(!bj_peer_auth_open(&a,wire,wn,&type,received,&pn));
    uint8_t corrupted[112];memcpy(corrupted,wire,wn);corrupted[5]^=1;CHECK(!bj_peer_auth_open(&b,corrupted,wn,&type,received,&pn));CHECK(b.received==0);
    pn=71;CHECK(!bj_peer_auth_open(&b,wire,wn,&type,received,&pn));pn=72;
    CHECK(bj_peer_auth_open(&b,wire,wn,&type,received,&pn));CHECK(type==1 && pn==72 && !memcmp(payload,received,72));
    CHECK(!bj_peer_auth_open(&b,wire,wn,&type,received,&pn));
    wn=sizeof(wire);CHECK(bj_peer_auth_seal(&b,2,NULL,0,wire,&wn));pn=72;CHECK(bj_peer_auth_open(&a,wire,wn,&type,received,&pn));CHECK(pn==0 && type==2);
    for(size_t n=0;n<37;n++)CHECK(!bj_peer_auth_open(&a,wire,n,&type,received,&pn));
    wn=sizeof(wire);CHECK(!bj_peer_auth_seal(&a,0,NULL,0,wire,&wn));CHECK(!bj_peer_auth_seal(&a,1,payload,73,wire,&wn));
    wn=36;CHECK(!bj_peer_auth_seal(&a,1,NULL,0,wire,&wn));
    a.sent=UINT32_MAX-1;b.received=UINT32_MAX-1;wn=112;CHECK(bj_peer_auth_seal(&a,1,NULL,0,wire,&wn));pn=72;
    CHECK(bj_peer_auth_open(&b,wire,wn,&type,received,&pn));wn=112;CHECK(!bj_peer_auth_seal(&a,1,NULL,0,wire,&wn));CHECK(!bj_peer_auth_open(&b,wire,37,&type,received,&pn));
    begin_pair(&a,&b,1);CHECK(!bj_peer_auth_accept(&a,old,309));CHECK(!bj_peer_auth_finish_accept(&a,fb,73));
    finish_pair(&a,&b);CHECK(!bj_peer_auth_finish_accept(&a,fb,73));
    unsigned erased=oa.erased;bj_peer_auth_clear(&a);CHECK(oa.erased==erased+1 && !oa.ephemeral);
    CHECK(!a.started && !a.derived && !a.authenticated && a.sent==0 && a.received==0 && a.hello_length==0 && a.remote_length==0);
    CHECK(all_zero(a.challenge,66) && all_zero(a.peer,6) && all_zero(a.hello,sizeof(a.hello)) && all_zero(a.remote,sizeof(a.remote)));
    CHECK(all_zero(a.send_key,32) && all_zero(a.receive_key,32) && all_zero(a.transcript,32));
    wn=112;pn=72;CHECK(!bj_peer_auth_seal(&a,1,NULL,0,wire,&wn));CHECK(!bj_peer_auth_open(&a,wire,37,&type,received,&pn));CHECK(!bj_peer_auth_accept(&a,b.hello,309));CHECK(!bj_peer_auth_finish_accept(&a,fb,73));
    /* Strict DER corpus: malformed framing, integers, sign, zero, trailing data. */
    const uint8_t ders[][10]={{0x30,6,2,1,1,2,1,1,0,0},{0x30,6,2,1,0,2,1,1,0,0},{0x30,6,2,1,0x80,2,1,1,0,0},{0x30,7,2,2,0,1,2,1,1,0},{0x30,6,2,0,1,2,1,1,0,0},{0x30,0x80,2,1,1,2,1,1,0,0}};
    uint8_t raw[64];CHECK(der_raw(ders[0],8,raw));for(unsigned i=1;i<6;i++)CHECK(!der_raw(ders[i],i==3?9:8,raw));CHECK(!der_raw(ders[0],9,raw));
    bj_peer_auth_t invalid;bj_peer_crypto_t ac=adapter(&oa);uint8_t cert[72];memcpy(cert,a.cert_signature,a.cert_length);cert[2]^=1;
    CHECK(!bj_peer_auth_init(&invalid,&ac,ma,a.public_key,cert,a.cert_length));CHECK(!bj_peer_auth_init(&invalid,&ac,mb,a.public_key,a.cert_signature,a.cert_length));
    expiry_integration();bj_peer_auth_clear(&b);bj_peer_auth_clear(&c);BCryptDestroyKey(oa.identity);BCryptDestroyKey(ob.identity);BCryptDestroyKey(oc.identity);BCryptDestroyKey(root);
    BCryptCloseAlgorithmProvider(ecdsa,0);BCryptCloseAlgorithmProvider(ecdh,0);BCryptCloseAlgorithmProvider(sha,0);BCryptCloseAlgorithmProvider(mac,0);
    printf("PASS peer-cng checks=%u real-P256-ECDSA ECDH SHA256 HMAC directional-HKDF replay reflection invalid-point DER lengths padding seq-wrap clear\n",checks);
    puts("SCOPE portable core + data expiry/disconnect gates + independent Windows CNG oracle; NOT ESP-mbedTLS binary, trusted clock bootstrap, BLE or physical two-board acceptance");
    puts("WIRE NOTE KEY-v1 HKDF domain is 16 ASCII bytes without NUL; stale challenge and actual expiry/unknown-clock/15s/session/disconnect clear tested");return 0;
}
