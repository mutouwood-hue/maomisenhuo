#include "baji_peer.h"
#include <string.h>
static void fail(bj_peer_t *p,uint8_t reason){p->state=5;p->reason=reason;p->local_matched=p->peer_matched=false;memset(p->reference,0,64);p->count=0;p->reference_ready=false;bj_peer_auth_clear(&p->auth);}
void bj_peer_clear(bj_peer_t *p){if(!p)return;bj_peer_auth_t auth=p->auth;bj_peer_auth_clear(&auth);memset(p,0,sizeof(*p));p->auth=auth;}
bool bj_peer_begin(bj_peer_t *p,const uint8_t challenge[66],uint32_t now){
    if(!p)return false;
    bj_peer_clear(p);if(!bj_peer_auth_begin(&p->auth,challenge))return false;
    p->state=1;p->method=challenge[65];p->started=now;return true;
}
bool bj_peer_role(bj_peer_t *p,const uint8_t mac[6]){
    if(!p || !p->auth.started || (memcmp(mac,p->auth.self,6)!=0 && memcmp(mac,p->auth.peer,6)!=0))return false;
    bool own=memcmp(mac,p->auth.self,6)==0;if(p->role_valid)return p->initiator==own;
    p->role_valid=true;p->initiator=own;return true;
}
static void ready(bj_peer_t *p){if(p->auth.authenticated && p->finish_sent && p->role_valid && p->state==1)p->state=p->initiator?2:3;}
static bool reference_valid(uint8_t method,uint8_t count,const uint8_t *b){
    if(count<4 || count>(method==2?8:9))return false;
    unsigned used=method==2?2u*(count-1):count;
    if(method==2){for(unsigned i=0;i<count-1;i++){unsigned v=b[2*i]|((unsigned)b[2*i+1]<<8);if(!v || v>=1200)return false;}}
    else if(method==3){unsigned bits=0;for(unsigned i=0;i<count;i++){if(b[i]>8 || (bits&(1u<<b[i])))return false;bits|=1u<<b[i];}}
    else return false;
    for(unsigned i=used;i<64;i++)if(b[i])return false;
    return true;
}
bool bj_peer_receive(bj_peer_t *p,uint8_t type,const uint8_t *b,size_t n,uint32_t now){
    if(!p || p->state==0 || p->state==5)return false;
    if(type==1){if(!bj_peer_auth_accept(&p->auth,b,n)){fail(p,7);return false;}return true;}
    if(type==2){if(!bj_peer_auth_finish_accept(&p->auth,b,n)){fail(p,7);return false;}ready(p);return true;}
    uint8_t payload[72],kind=0;size_t size=sizeof(payload);
    if(type!=3 || !bj_peer_auth_open(&p->auth,b,n,&kind,payload,&size)){fail(p,7);return false;}
    if(kind==1){if(size!=0){fail(p,6);return false;}ready(p);return true;}
    if(!p->role_valid){fail(p,8);return false;}
    if(kind==2){
        if(p->initiator || size!=66 || payload[0]!=p->method || !reference_valid(payload[0],payload[1],payload+2)){fail(p,3);return false;}
        if(p->reference_ready){
            if(p->count!=payload[1] || memcmp(p->reference,payload+2,64)){fail(p,3);return false;}
            return true;
        }
        p->count=payload[1];memcpy(p->reference,payload+2,64);p->reference_ready=true;p->follow_started=now;return true;
    }
    if(kind==3){uint8_t digest[32];if(size!=32 || !p->reference_ready || !bj_peer_transcript(p,digest) || memcmp(payload,digest,32)){fail(p,3);return false;}p->peer_matched=true;return true;}
    fail(p,6);return false;
}
bool bj_peer_next(bj_peer_t *p,uint8_t *type,uint8_t *b,size_t *n){
    if(!p || !type || !b || !n || p->state==0 || p->state==5)return false;
    if(!p->hello_sent){if(*n<p->auth.hello_length)return false;memcpy(b,p->auth.hello,p->auth.hello_length);*n=p->auth.hello_length;*type=1;p->hello_sent=true;return true;}
    if(p->auth.derived && !p->finish_sent){if(*n<73 || !bj_peer_auth_finish(&p->auth,b))return false;*n=73;*type=2;p->finish_sent=true;return true;}
    if(!p->auth.authenticated)return false;
    uint8_t payload[66]={0};size_t size=0;uint8_t kind=0;
    if(!p->ready_sent){kind=1;}
    else if(p->initiator && p->reference_ready && !p->reference_sent){kind=2;payload[0]=p->method;payload[1]=p->count;memcpy(payload+2,p->reference,64);size=66;}
    else if(p->local_matched && !p->match_sent){kind=3;if(!bj_peer_transcript(p,payload))return false;size=32;}
    else return false;
    *type=3;if(!bj_peer_auth_seal(&p->auth,kind,payload,size,b,n))return false;
    if(kind==1)p->ready_sent=true;else if(kind==2)p->reference_sent=true;else p->match_sent=true;
    return true;
}
void bj_peer_input(bj_peer_t *p,int point,uint32_t now){
    if(!p || !p->auth.authenticated || !p->role_valid || (p->state!=2 && p->state!=3) || p->local_matched || (!p->initiator && !p->reference_ready))return;
    if(p->last_input && now-p->last_input<50)return;
    p->last_input=now;
    if(p->method==2){if(!bj_rhythm_tap(&p->taps,now))fail(p,3);}
    else if(p->method==3){
        if(point<0 || point>8)return;
        for(unsigned i=0;i<p->point_count;i++)if(p->points[i]==point)return;
        if(p->point_count==9){fail(p,3);return;}p->points[p->point_count++]=(uint8_t)point;
    }
}
void bj_peer_tick(bj_peer_t *p,uint32_t now){
    if(!p || !p->state || p->state==5)return;
    if(now-p->started>=15000){fail(p,1);return;}ready(p);
    if(p->local_matched && p->peer_matched){p->state=4;return;}
    if(!p->auth.authenticated || !p->role_valid)return;
    if(!p->initiator && !p->local_matched && p->reference_ready && now-p->follow_started>5000u && (p->last_input<p->follow_started || p->last_input-p->follow_started>5000u || now-p->follow_started>6200u)){fail(p,1);return;}
    bool finished=p->method==2?bj_rhythm_finished(&p->taps,now):p->point_count>=4 && now-p->last_input>=1200;
    if(!finished || p->local_matched)return;
    if(p->initiator){
        p->count=p->method==2?p->taps.count:p->point_count;
        if(p->method==2)for(unsigned i=1;i<p->count;i++){uint32_t v=p->taps.taps[i]-p->taps.taps[i-1];p->reference[2*(i-1)]=(uint8_t)v;p->reference[2*(i-1)+1]=(uint8_t)(v>>8);}
        else memcpy(p->reference,p->points,p->count);
        p->reference_ready=p->local_matched=true;
    }else{
        bool match=false;
        if(p->method==2){bj_rhythm_t ref={.count=p->count};for(unsigned i=1;i<p->count;i++)ref.taps[i]=ref.taps[i-1]+p->reference[2*(i-1)]+((uint32_t)p->reference[2*(i-1)+1]<<8);bj_rhythm_rules_t rules=bj_rhythm_initial_rules();match=bj_rhythm_match(&ref,&p->taps,&rules);}
        else match=bj_pattern_match(p->reference,p->count,p->points,p->point_count);
        if(!match){fail(p,3);return;}p->local_matched=true;
    }
}
void bj_peer_status(const bj_peer_t *p,uint8_t out[30]){
    memset(out,0,30);out[0]=1;out[1]=p->auth.configured?15:1;out[2]=p->state;
    if(!p->state)return;
    out[3]=p->method;out[4]=(p->auth.authenticated && p->finish_sent && p->state>=2 && p->state<=4?1:0)|(p->reference_ready?2:0)|(p->local_matched?4:0)|(p->peer_matched?8:0);out[5]=p->reason;
    memcpy(out+6,p->auth.challenge+1,16);memcpy(out+22,p->auth.peer,6);out[28]=p->count;
}
size_t bj_peer_reference(const bj_peer_t *p,uint8_t out[84]){
    if(!p->reference_ready || !p->auth.authenticated)return 0;
    memset(out,0,84);out[0]=1;out[1]=p->method;out[2]=p->count;memcpy(out+4,p->auth.challenge+1,16);memcpy(out+20,p->reference,64);return 84;
}
bool bj_peer_transcript(bj_peer_t *p,uint8_t out[32]){
    if(!p || !p->reference_ready || !p->auth.authenticated)return false;
    static const char domain[]="BAJI-TRANSCRIPT-v1";
    uint8_t b[100];size_t n=sizeof(domain)-1;memcpy(b,domain,n);memcpy(b+n,p->auth.challenge+1,16);n+=16;
    bool first=memcmp(p->auth.self,p->auth.peer,6)<0;memcpy(b+n,first?p->auth.self:p->auth.peer,6);memcpy(b+n+6,first?p->auth.peer:p->auth.self,6);n+=12;
    memcpy(b+n,p->auth.challenge+29,32);n+=32;b[n++]=p->method;b[n++]=p->count;
    unsigned size=p->method==2?2u*(p->count-1):p->count;memcpy(b+n,p->reference,size);n+=size;
    return p->auth.crypto.hash(p->auth.crypto.context,b,n,out);
}
