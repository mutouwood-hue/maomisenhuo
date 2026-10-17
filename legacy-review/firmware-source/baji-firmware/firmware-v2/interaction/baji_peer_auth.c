#include "baji_peer_auth.h"
#include <string.h>
#include <limits.h>
#define HELLO_BYTES 309u
static void wipe(void *p,size_t n){volatile uint8_t *b=p;while(n--)*b++=0;}
static bool equal(const uint8_t *a,const uint8_t *b,size_t n){uint8_t v=0;while(n--)v|=*a++^*b++;return v==0;}
static size_t binding(const bj_peer_auth_t *a,const char *domain,uint8_t *out){
    size_t n=strlen(domain);memcpy(out,domain,n);memcpy(out+n,a->challenge+1,16);n+=16;
    bool first=memcmp(a->self,a->peer,6)<0;
    memcpy(out+n,first?a->self:a->peer,6);memcpy(out+n+6,first?a->peer:a->self,6);n+=12;
    memcpy(out+n,a->challenge+29,37);return n+37;
}
static size_t cert_message(const uint8_t mac[6],const uint8_t key[65],uint8_t out[85]){
    static const char domain[]="BAJI-DEVICE-v1";size_t n=sizeof(domain)-1;
    memcpy(out,domain,n);memcpy(out+n,mac,6);memcpy(out+n+6,key,65);return n+71;
}
void bj_peer_auth_clear(bj_peer_auth_t *a){
    if(!a)return;
    wipe(a->challenge,sizeof(a->challenge));wipe(a->peer,6);wipe(a->hello,sizeof(a->hello));wipe(a->remote,sizeof(a->remote));
    wipe(a->send_key,32);wipe(a->receive_key,32);a->hello_length=a->remote_length=0;
    a->sent=a->received=0;a->started=a->derived=a->authenticated=false;wipe(a->transcript,32);
    if(a->crypto.erase)a->crypto.erase(a->crypto.context);
}
bool bj_peer_auth_init(bj_peer_auth_t *a,const bj_peer_crypto_t *c,const uint8_t mac[6],const uint8_t key[65],const uint8_t *sig,size_t len){
    if(!a || !c || !mac || !key || !sig || len<8 || len>72 || key[0]!=4 || !c->random || !c->ephemeral || !c->sign || !c->verify || !c->shared || !c->hash || !c->hmac || !c->erase)return false;
    memset(a,0,sizeof(*a));a->crypto=*c;memcpy(a->self,mac,6);memcpy(a->public_key,key,65);
    uint8_t message[85];size_t n=cert_message(mac,key,message);
    if(!c->verify(c->context,true,key,message,n,sig,len))return false;
    memcpy(a->cert_signature,sig,len);a->cert_length=len;a->configured=true;return true;
}
bool bj_peer_auth_begin(bj_peer_auth_t *a,const uint8_t challenge[66]){
    if(!a || !a->configured || !challenge)return false;
    bj_peer_auth_clear(a);
    if(challenge[0]!=1 || memcmp(challenge+17,a->self,6) || !memcmp(challenge+23,a->self,6) || challenge[65]<1 || challenge[65]>3)return false;
    memcpy(a->challenge,challenge,66);memcpy(a->peer,challenge+23,6);
    uint8_t *h=a->hello;h[0]=1;memcpy(h+1,a->public_key,65);h[66]=(uint8_t)a->cert_length;memcpy(h+67,a->cert_signature,a->cert_length);
    uint8_t message[340];size_t n=binding(a,"BAJI-PEER-HELLO-v1",message),length=72;
    if(!a->crypto.random(a->crypto.context,h+139,32) || !a->crypto.ephemeral(a->crypto.context,h+171))goto fail;
    memcpy(message+n,h,236);n+=236;
    if(!a->crypto.sign(a->crypto.context,message,n,h+237,&length) || length<8 || length>72)goto fail;
    h[236]=(uint8_t)length;a->hello_length=HELLO_BYTES;a->started=true;return true;
fail:bj_peer_auth_clear(a);return false;
}
bool bj_peer_auth_accept(bj_peer_auth_t *a,const uint8_t *h,size_t size){
    if(!a || !a->started || !h || size!=HELLO_BYTES)return false;
    if(a->derived)return a->remote_length==size && equal(a->remote,h,size);
    if(h[0]!=1 || h[1]!=4 || h[171]!=4 || h[66]<8 || h[66]>72 || h[236]<8 || h[236]>72)return false;
    for(unsigned i=67+h[66];i<139;i++)if(h[i])return false;
    for(unsigned i=237+h[236];i<309;i++)if(h[i])return false;
    /* Reflection and accidental reuse are never a fresh peer handshake. */
    if(equal(h+139,a->hello+139,32) || equal(h+171,a->hello+171,65))return false;
    uint8_t message[340],secret[32]={0},salt[32]={0},prk[32]={0},digest[32]={0};
    size_t n=cert_message(a->peer,h+1,message);bool ok=false;
    if(!a->crypto.verify(a->crypto.context,true,h+1,message,n,h+67,h[66]))goto done;
    n=binding(a,"BAJI-PEER-HELLO-v1",message);memcpy(message+n,h,236);n+=236;
    if(!a->crypto.verify(a->crypto.context,false,h+1,message,n,h+237,h[236]) || !a->crypto.shared(a->crypto.context,h+171,secret))goto done;
    n=binding(a,"BAJI-PEER-SALT-v1",message);
    if(!a->crypto.hash(a->crypto.context,message,n,salt) || !a->crypto.hmac(a->crypto.context,salt,secret,32,prk))goto done;
    /* HKDF expand: hash the two full signed HELLOs in MAC order. */
    uint8_t both[HELLO_BYTES*2];bool first=memcmp(a->self,a->peer,6)<0;
    memcpy(both,first?a->hello:h,HELLO_BYTES);memcpy(both+HELLO_BYTES,first?h:a->hello,HELLO_BYTES);
    if(!a->crypto.hash(a->crypto.context,both,sizeof(both),digest)){wipe(both,sizeof(both));goto done;}
    static const char key_domain[]="BAJI-PEER-KEY-v1";
    const size_t key_prefix=sizeof(key_domain)-1;
    wipe(both,sizeof(both));memcpy(message,key_domain,key_prefix);memcpy(message+key_prefix,digest,32);
    message[key_prefix+32]=first?1:2;message[key_prefix+33]=1;
    if(!a->crypto.hmac(a->crypto.context,prk,message,key_prefix+34,a->send_key))goto done;
    message[key_prefix+32]=first?2:1;
    if(!a->crypto.hmac(a->crypto.context,prk,message,key_prefix+34,a->receive_key))goto done;
    memcpy(a->transcript,digest,32);memcpy(a->remote,h,size);a->remote_length=size;a->derived=true;ok=true;
done: wipe(secret,32);wipe(salt,32);wipe(prk,32);wipe(digest,32);wipe(message,sizeof(message));
    if(!ok){wipe(a->send_key,32);wipe(a->receive_key,32);}return ok;
}
static size_t finish_message(bj_peer_auth_t *a,const uint8_t signer[6],uint8_t out[128]) {
    size_t n=binding(a,"BAJI-PEER-FINISH-v1",out);
    memcpy(out+n,signer,6);memcpy(out+n+6,a->transcript,32);return n+38;
}
bool bj_peer_auth_finish(bj_peer_auth_t *a,uint8_t out[73]) {
    if(!a || !a->derived || !out)return false;
    uint8_t message[128];size_t n=finish_message(a,a->self,message),length=72;memset(out,0,73);
    if(!a->crypto.sign(a->crypto.context,message,n,out+1,&length) || length<8 || length>72)return false;
    out[0]=(uint8_t)length;return true;
}
bool bj_peer_auth_finish_accept(bj_peer_auth_t *a,const uint8_t *bytes,size_t n) {
    if(!a || !a->derived || !bytes || n!=73 || bytes[0]<8 || bytes[0]>72)return false;
    for(unsigned i=1+bytes[0];i<73;i++)if(bytes[i])return false;
    uint8_t message[128];size_t size=finish_message(a,a->peer,message);
    if(!a->crypto.verify(a->crypto.context,false,a->remote+1,message,size,bytes+1,bytes[0]))return false;
    a->authenticated=true;return true;
}
static uint32_t get32(const uint8_t *b){return (uint32_t)b[0]|((uint32_t)b[1]<<8)|((uint32_t)b[2]<<16)|((uint32_t)b[3]<<24);}
static bool tag(bj_peer_auth_t *a,const uint8_t key[32],const uint8_t *b,size_t n,uint8_t out[32]){
    uint8_t message[200];size_t prefix=binding(a,"BAJI-PEER-MSG-v1",message);
    if(prefix+n>sizeof(message))return false;
    memcpy(message+prefix,b,n);return a->crypto.hmac(a->crypto.context,key,message,prefix+n,out);
}
bool bj_peer_auth_seal(bj_peer_auth_t *a,uint8_t type,const uint8_t *payload,size_t n,uint8_t *out,size_t *size){
    if(!a || !a->authenticated || !out || !size || *size<n+37 || n>BJ_PEER_PAYLOAD_MAX || (!payload && n) || !type || a->sent==UINT32_MAX)return false;
    uint32_t sequence=a->sent+1;out[0]=type;for(unsigned i=0;i<4;i++)out[1+i]=(uint8_t)(sequence>>(8*i));
    if(n)memcpy(out+5,payload,n);
    if(!tag(a,a->send_key,out,n+5,out+n+5))return false;
    a->sent=sequence;*size=n+37;return true;
}
bool bj_peer_auth_open(bj_peer_auth_t *a,const uint8_t *bytes,size_t n,uint8_t *type,uint8_t *payload,size_t *size){
    if(!a || !a->authenticated || !bytes || !type || !size || n<37 || n>37+BJ_PEER_PAYLOAD_MAX || *size<n-37 || (!payload && n>37) || !bytes[0])return false;
    uint32_t sequence=get32(bytes+1);uint8_t digest[32];
    if(!sequence || a->received==UINT32_MAX || sequence!=a->received+1 || !tag(a,a->receive_key,bytes,n-32,digest) || !equal(digest,bytes+n-32,32))return false;
    *type=bytes[0];*size=n-37;if(*size)memcpy(payload,bytes+5,*size);a->received=sequence;return true;
}
