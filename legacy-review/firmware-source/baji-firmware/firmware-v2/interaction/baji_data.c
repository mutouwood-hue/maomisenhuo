#include "baji_data.h"
#include <string.h>
static uint16_t u16(const uint8_t *p) { return (uint16_t)(p[0]|((uint16_t)p[1]<<8)); }
static uint32_t u32(const uint8_t *p) { return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24); }
static uint64_t u64(const uint8_t *p) { return (uint64_t)u32(p)|((uint64_t)u32(p+4)<<32); }
static void put(uint8_t *p,uint64_t v,size_t n) { for(size_t i=0;i<n;i++) p[i]=(uint8_t)(v>>(i*8)); }
uint32_t bj_data_crc(const uint8_t *p,size_t n) {
    uint32_t c=UINT32_MAX;
    for(size_t i=0;i<n;i++) { c^=p[i];for(unsigned j=0;j<8;j++) c=(c>>1)^((0u-(c&1u))&0xedb88320u); }
    return c^UINT32_MAX;
}
void bj_data_init(bj_data_t *d,const uint8_t id[6],bool ready,bj_data_mac_fn mac,bj_data_save_fn save,void *adapter) {
    memset(d,0,sizeof(*d));memcpy(d->id,id,6);d->provisioned=ready && mac!=NULL;
    d->mac=mac;d->save=save;d->adapter=adapter;d->next_event=1;d->environment_next=1;
    d->sensor[0]=1;d->sensor[6]=d->sensor[7]=d->sensor[8]=255;
    for(unsigned i=9;i<15;i+=2) put(d->sensor+i,0x8000,2);
}
static void clear_meet(bj_data_t *d) {
    if(d->peer)bj_peer_clear(d->peer);
    d->meet_pending=d->meet_confirmed=d->social_role_valid=false;
    memset(d->meet_challenge,0,sizeof(d->meet_challenge));
    memset(d->meet_proof,0,sizeof(d->meet_proof));memset(d->social_role,0,sizeof(d->social_role));
    if(d->frozen_kind==12 || d->frozen_kind==16 || d->frozen_kind==17) {
        d->frozen_valid=false;d->frozen_length=0;memset(d->frozen,0,sizeof(d->frozen));
    }
}
void bj_data_disconnect(bj_data_t *d) {
    d->staging=d->frozen_valid=d->session_valid=d->challenge_pending=d->confirmed=false;
    d->counter=0;d->last_signed_length=0;memset(d->session,0,16);memset(d->proof,0,32);
    d->environment_allowed=false;clear_meet(d);
}
static void clear_environment_frozen(bj_data_t *d) {
    if(d->frozen_kind==13 || d->frozen_kind==14) {
        d->frozen_valid=false;d->frozen_length=0;memset(d->frozen,0,sizeof(d->frozen));
    }
}
static uint32_t unix_now(const bj_data_t *d) { return d->unix_base+(uint32_t)(d->now-d->clock_at)/1000u; }
void bj_data_tick(bj_data_t *d,uint32_t now) {
    d->now=now;
    if(d->staging && now-d->stage_at>10000u) d->staging=false;
    if(d->frozen_valid && now-d->frozen_at>10000u) d->frozen_valid=false;
    if(d->challenge_pending && now-d->challenge_at>60000u) {d->challenge_pending=d->confirmed=false;memset(d->proof,0,32);}
    if(d->meet_pending && (now-d->meet_at>=15000u || !d->clock_valid || unix_now(d)>=u32(d->meet_challenge+61))) {
        clear_meet(d);
    }
    if(d->environment_allowed && (!d->session_valid || !d->clock_valid || unix_now(d)>=d->environment_expiry)) {
        d->environment_allowed=false;clear_environment_frozen(d);
    }
    if(d->session_valid && (now-d->session_at>900000u || (d->clock_valid && unix_now(d)>=d->session_expiry))) bj_data_disconnect(d);
}
static bool mac(bj_data_t *d,const char *domain,const uint8_t *p,size_t n,uint8_t out[32]) {
    /* Buffer is worker stack bounded at 531B; crypto allocation lives in adapter. */
    uint8_t input[BJ_DATA_MAX+20];size_t prefix=strlen(domain);
    if(!d->provisioned || prefix+6+n>sizeof(input)) return false;
    memcpy(input,domain,prefix);memcpy(input+prefix,d->id,6);memcpy(input+prefix+6,p,n);
    return d->mac(d->adapter,input,prefix+6+n,out);
}
static bool equal(const uint8_t *a,const uint8_t *b,size_t n) { uint8_t diff=0;for(size_t i=0;i<n;i++) diff|=a[i]^b[i];return diff==0; }
bool bj_data_confirm(bj_data_t *d,uint32_t now) {
    bj_data_tick(d,now);
    if(!d->challenge_pending || d->confirmed) return false;
    if(!mac(d,"BAJI-BIND-v1",d->challenge,56,d->proof)) return false;
    d->confirmed=true;return true;
}
bool bj_data_meet_confirm(bj_data_t *d,uint32_t now,const uint8_t id[16]) {
    if(!d || !id) return false;
    bj_data_tick(d,now);
    if(!d->session_valid || !d->meet_pending || d->meet_confirmed || !d->hash ||
       !equal(id,d->meet_challenge+1,16)) return false;
    if(d->meet_challenge[65]!=1) {
        uint8_t signed_bytes[98],proof[64];
        if(!d->peer || d->peer->state!=4 || !d->peer->local_matched || !d->peer->peer_matched || !bj_peer_transcript(d->peer,proof))return false;
        memcpy(signed_bytes,d->meet_challenge,66);memcpy(signed_bytes+66,proof,32);
        if(!mac(d,"BAJI-MEET-v1",signed_bytes,sizeof(signed_bytes),proof+32))return false;
        memcpy(d->meet_proof,proof,64);d->meet_confirmed=true;return true;
    }
    static const char domain[]="BAJI-TRANSCRIPT-v1";
    uint8_t transcript[sizeof(domain)-1+16+12+32+1];size_t pos=sizeof(domain)-1;
    memcpy(transcript,domain,pos);memcpy(transcript+pos,d->meet_challenge+1,16);pos+=16;
    const uint8_t *self=d->meet_challenge+17,*peer=d->meet_challenge+23;
    bool self_first=memcmp(self,peer,6)<0;
    memcpy(transcript+pos,self_first?self:peer,6);memcpy(transcript+pos+6,self_first?peer:self,6);pos+=12;
    memcpy(transcript+pos,d->meet_challenge+29,32);pos+=32;transcript[pos]=1;
    uint8_t proof[64],signed_bytes[98];
    if(!d->hash(d->adapter,transcript,sizeof(transcript),proof)) return false;
    memcpy(signed_bytes,d->meet_challenge,66);memcpy(signed_bytes+66,proof,32);
    if(!mac(d,"BAJI-MEET-v1",signed_bytes,sizeof(signed_bytes),proof+32)) return false;
    memcpy(d->meet_proof,proof,64);d->meet_confirmed=true;return true;
}
static bool environment_store(bj_data_t *d,bool pending,uint64_t next,uint64_t ack,const uint8_t event[56]) {
    uint8_t bytes[89]={0};memcpy(bytes,"BJE2",4);put(bytes+4,next,8);put(bytes+12,ack,8);bytes[20]=pending?1:0;
    if(pending) memcpy(bytes+21,event,56);
    put(bytes+77,d->environment_revision,4);put(bytes+81,d->environment_revoked_revision,4);
    put(bytes+85,bj_data_crc(bytes,85),4);
    return d->environment_save && d->environment_save(d->adapter,bytes,sizeof(bytes));
}
bool bj_data_environment_load(bj_data_t *d,const uint8_t *bytes,size_t size) {
    if(!d || !bytes || (size!=81 && size!=89) || bytes[20]>1 ||
        (size==81?memcmp(bytes,"BJE1",4):memcmp(bytes,"BJE2",4)) ||
        bj_data_crc(bytes,size-4)!=u32(bytes+size-4) || !u64(bytes+4) || u64(bytes+12)>=u64(bytes+4)) return false;
    if(size==89 && u32(bytes+81)>u32(bytes+77)) return false;
    if(bytes[20] && (bytes[21]!=1 || !u64(bytes+22) || u64(bytes+22)>=u64(bytes+4) || u64(bytes+22)<=u64(bytes+12))) return false;
    d->environment_next=u64(bytes+4);d->environment_ack=u64(bytes+12);d->environment_pending=bytes[20]!=0;
    if(size==89) {d->environment_revision=u32(bytes+77);d->environment_revoked_revision=u32(bytes+81);}
    memcpy(d->environment_event,bytes+21,56);return true;
}
bool bj_data_environment_clear(bj_data_t *d) {
    if(!d) return false;
    d->environment_allowed=false;
    uint64_t ack=d->environment_pending?u64(d->environment_event+1):d->environment_ack;
    bool saved=environment_store(d,false,d->environment_next,ack,NULL);
    d->environment_ack=ack;d->environment_pending=false;memset(d->environment_event,0,56);
    clear_environment_frozen(d);
    return saved;
}
bool bj_data_environment_event(bj_data_t *d,uint8_t label,uint16_t confidence,uint16_t seconds) {
    if(!d || !d->environment_allowed || !d->session_valid || !d->clock_valid || d->environment_pending ||
       !d->environment_next || d->environment_next==UINT64_MAX || label<1 || label>4 || confidence>1000 || !seconds || unix_now(d)<seconds) return false;
    uint8_t event[56]={1};put(event+1,d->environment_next,8);put(event+9,unix_now(d),4);put(event+13,d->environment_revision,4);
    event[17]=label;put(event+18,confidence,2);put(event+20,seconds,2);
    if(!mac(d,"BAJI-ENV-v1",event,24,event+24) || !environment_store(d,true,d->environment_next+1,d->environment_ack,event)) return false;
    d->environment_next++;d->environment_pending=true;memcpy(d->environment_event,event,56);return true;
}
size_t bj_data_encode_store(bj_data_t *d) {
    uint8_t *b=d->store;memcpy(b,"BJD1",4);put(b+4,d->next_event,8);put(b+12,d->event_count,2);
    put(b+14,d->dropped,4);put(b+18,d->last_ack,8);
    size_t n=26u+16u*d->event_count;memcpy(b+26,d->events,16u*d->event_count);put(b+n,bj_data_crc(b,n),4);return n+4;
}
static bool persist(bj_data_t *d) { size_t n=bj_data_encode_store(d);return d->save && d->save(d->adapter,d->store,n); }
bool bj_data_load(bj_data_t *d,const uint8_t *b,size_t n) {
    if(!b || n<30 || memcmp(b,"BJD1",4) || u16(b+12)>BJ_EVENT_MAX || n!=30u+16u*u16(b+12) || bj_data_crc(b,n-4)!=u32(b+n-4) || !u64(b+4)) return false;
    uint64_t prev=u64(b+18);
    for(unsigned i=0;i<u16(b+12);i++) {const uint8_t *e=b+26+i*16u;uint64_t id=u64(e);if(!id || id<=prev || id>=u64(b+4) || e[12]<1 || e[12]>14) return false;prev=id;}
    if(u64(b+18)>=u64(b+4)) return false;
    d->next_event=u64(b+4);d->event_count=u16(b+12);d->dropped=u32(b+14);d->last_ack=u64(b+18);
    memcpy(d->events,b+26,16u*d->event_count);return true;
}
bool bj_data_event(bj_data_t *d,uint8_t type,uint8_t a,int16_t b) {
    if(type<1 || type>14 || !d->next_event || d->next_event==UINT64_MAX) return false;
    /* No loss-on-overflow: preserve existing FIFO; expose a durable drop count. */
    if(d->event_count==BJ_EVENT_MAX) {uint32_t old=d->dropped;d->dropped++;if(!persist(d)){d->dropped=old;return false;}return false;}
    uint8_t *e=d->events[d->event_count];memset(e,0,16);put(e,d->next_event,8);
    put(e+8,d->clock_valid?unix_now(d):0,4);e[12]=type;e[13]=a;put(e+14,(uint16_t)b,2);
    d->next_event++;d->event_count++;
    if(!persist(d)) {d->next_event--;d->event_count--;return false;}return true;
}
static uint8_t ack_event(bj_data_t *d,uint64_t id) {
    if(id && id==d->last_ack) return 0;
    if(!d->event_count || u64(d->events[0])!=id) return 4;
    /* Persist the new representation before mutating the in-memory queue. */
    size_t n=26u+16u*(d->event_count-1u);uint8_t *b=d->store;
    memcpy(b,"BJD1",4);put(b+4,d->next_event,8);put(b+12,d->event_count-1u,2);put(b+14,d->dropped,4);put(b+18,id,8);
    memcpy(b+26,d->events+1,16u*(d->event_count-1u));put(b+n,bj_data_crc(b,n),4);
    if(!d->save || !d->save(d->adapter,b,n+4)) return 3;
    d->event_count--;memmove(d->events,d->events+1,16u*d->event_count);d->last_ack=id;return 0;
}
static bool valid_life(const uint8_t *b,size_t n) {
    if(n<13 || b[0]!=1 || b[11]>24 || b[12]>24 || n!=13u+5u*b[11]+3u*b[12] || (int16_t)u16(b+9)<-840 || (int16_t)u16(b+9)>840) return false;
    uint32_t date=u32(b+5);if(date<20000101u || date>20991231u) return false;
    uint16_t previous=0;
    for(unsigned i=0;i<b[11];i++){const uint8_t *p=b+13+i*5;uint16_t start=u16(p),end=u16(p+2);if(start>=1440 || end>1440 || end<=start || start<previous || p[4]>9) return false;previous=end;}
    for(unsigned i=0;i<b[12];i++){const uint8_t *p=b+13+b[11]*5+i*3;if(u16(p)>=1440 || p[2]<1 || p[2]>7) return false;}
    return true;
}
static uint8_t commit(bj_data_t *d) {
    uint8_t *b=d->stage;size_t n=d->stage_length;uint8_t kind=d->stage_kind,digest[32];
    if(kind==5) {
        if(n!=56 || u32(b+52)>999999u || !d->provisioned || d->session_valid) return 4;
        memcpy(d->challenge,b,56);d->challenge_at=d->now;d->challenge_pending=true;d->confirmed=false;memset(d->proof,0,32);return 0;
    }
    if(kind==7) {
        if(n!=69 || b[0]!=1 || !d->confirmed || !d->challenge_pending || d->now-d->challenge_at>60000u || !equal(b+21,d->challenge,16) || !mac(d,"BAJI-GRANT-v1",b,37,digest) || !equal(digest,b+37,32)) return 4;
        uint32_t expiry=u32(b+17),challenge_expiry=u32(d->challenge+48);
        if(expiry<challenge_expiry || expiry-challenge_expiry>900u || (d->clock_valid && expiry<=unix_now(d))) return 4;
        memcpy(d->session,b+1,16);d->session_expiry=expiry;d->session_at=d->now;d->session_valid=true;d->counter=0;d->last_signed_length=0;
        d->challenge_pending=false;d->has_pet=d->has_life=false;d->life_length=0;memset(d->pet,0,27);memset(d->life,0,205);return 0;
    }
    if(kind!=3 && kind!=4 && kind!=8 && kind!=9 && kind!=10 && kind!=11 && kind!=15 && kind!=18 && kind!=20 && kind!=21 && kind!=22 && kind!=25) return 2;
    if(!d->session_valid || n<52 || !equal(b,d->session,16)) return 4;
    uint8_t input[BJ_DATA_MAX];input[0]=kind;memcpy(input+1,b,n-32);
    if(!mac(d,"BAJI-SYNC-v1",input,n-31,digest) || !equal(digest,b+n-32,32)) return 4;
    uint32_t counter=u32(b+16);if(!counter) return 4;
    if(counter==d->counter) return d->last_signed_kind==kind && d->last_signed_length==n && equal(d->last_signed,b,n)?0:4;
    if(counter<d->counter) return 4;
    const uint8_t *body=b+20;size_t len=n-52;uint8_t status=0;
    if(kind>=20 && kind<=22) {
        if(!d->update) return 2;
        status=d->update(d->adapter,kind,body,len);if(status)return status;
    } else if(kind==3) {
        if(len!=27 || body[0]!=1 || body[7]>5 || body[8]>6 || body[9]>2) return 1;
        for(unsigned i=10;i<15;i++) if(body[i]>100) return 1;
        if(d->has_pet && u32(body+1)<=u32(d->pet+1) && !equal(body,d->pet,27)) return 4;
        memcpy(d->pet,body,27);d->has_pet=true;
    } else if(kind==4) {
        if(!valid_life(body,len)) return 1;
        if(d->has_life) {
            uint32_t date=u32(body+5),old_date=u32(d->life+5);
            if(date<old_date && (body[11] || body[12])) return 4;
            if(date==old_date && (body[11] || body[12]) && u32(body+1)<=u32(d->life+1) && !(d->life_length==len && equal(body,d->life,len))) return 4;
        }
        memcpy(d->life,body,len);d->life_length=(uint16_t)len;d->has_life=true;
    } else if(kind==8) {
        if(len!=8) return 1;
        status=ack_event(d,u64(body));if(status) return status;
    } else if(kind==15) {
        if(len!=8 || !u64(body)) return 1;
        uint64_t id=u64(body);
        if(id!=d->environment_ack) {
            if(!d->environment_pending || u64(d->environment_event+1)!=id) return 4;
            if(!environment_store(d,false,d->environment_next,id,NULL)) return 3;
            d->environment_ack=id;d->environment_pending=false;memset(d->environment_event,0,56);
            clear_environment_frozen(d);
        }
    } else if(kind==25) {
        if(len!=8 || !u64(body))return 1;
        if(!d->active || !bj_active_ack(d->active,u64(body)))return 4;
        if(d->frozen_kind==24){d->frozen_valid=false;d->frozen_length=0;memset(d->frozen,0,sizeof(d->frozen));}
    } else if(kind==10) {
        if(len!=66 || body[0]!=1 || !equal(body+17,d->id,6) || equal(body+23,d->id,6) || body[65]<1 || body[65]>3 || !d->clock_valid) return 1;
        uint32_t expiry=u32(body+61),current=unix_now(d);
        if(expiry<=current || expiry-current>15u || expiry>d->session_expiry || d->meet_pending) return 4;
        /* 未接真正peer协商前，暗号模式不退化为按钮确认。 */
        if(body[65]!=1 && (!d->peer || !d->peer->auth.configured || !bj_peer_begin(d->peer,body,d->now))) return 2;
        d->social_role_valid=false;memset(d->social_role,0,sizeof(d->social_role));
        memcpy(d->meet_challenge,body,66);d->meet_at=d->now;d->meet_pending=true;d->meet_confirmed=false;memset(d->meet_proof,0,64);
    } else if(kind==18) {
        if(len!=23 || body[0]!=1) return 1;
        if(!d->meet_pending || !equal(body+1,d->meet_challenge+1,16)) return 4;
        if(!equal(body+17,d->id,6) && !equal(body+17,d->meet_challenge+23,6)) return 4;
        if(d->social_role_valid && !equal(body+17,d->social_role,6)) return 4;
        if(d->meet_challenge[65]!=1 && (!d->peer || !bj_peer_role(d->peer,body+17)))return 4;
        memcpy(d->social_role,body+17,6);d->social_role_valid=true;
    } else if(kind==11) {
        if(len!=10 || body[0]!=1 || body[5]>1 || !u32(body+1)) return 1;
        uint32_t revision=u32(body+1),expiry=u32(body+6);
        if(revision<d->environment_revision || (body[5] && revision<=d->environment_revoked_revision)) return 4;
        if(body[5] && (!d->clock_valid || expiry<=unix_now(d) || expiry>d->session_expiry)) return 4;
        bool clear_needed=!body[5] || revision!=d->environment_revision;
        d->environment_revision=revision;
        if(!body[5]) d->environment_revoked_revision=revision;
        if(clear_needed && !bj_data_environment_clear(d)) return 3;
        d->environment_expiry=expiry;d->environment_allowed=body[5]!=0;
    } else {
        if(len!=6 || !u32(body) || (int16_t)u16(body+4)<-840 || (int16_t)u16(body+4)>840 || u32(body)>=d->session_expiry) return 1;
        d->unix_base=u32(body);d->timezone=(int16_t)u16(body+4);d->clock_at=d->now;d->clock_valid=true;
    }
    d->counter=counter;d->last_signed_kind=kind;d->last_signed_length=(uint16_t)n;memcpy(d->last_signed,b,n);return 0;
}
static uint8_t freeze(bj_data_t *d,uint8_t kind) {
    d->frozen_length=0;
    if(kind==1) {put(d->sensor+23,d->event_count,2);put(d->sensor+25,d->dropped,4);memcpy(d->frozen,d->sensor,29);d->frozen_length=29;}
    else if(kind==2) {
        if(!d->session_valid) return 4;
        if(d->event_count) {memcpy(d->frozen,d->events[0],16);if(!mac(d,"BAJI-EVENT-v1",d->frozen,16,d->frozen+16)) return 4;d->frozen_length=48;}
    } else if(kind==6) {
        if(!d->confirmed || !d->challenge_pending) return 4;
        memcpy(d->frozen,d->proof,32);d->frozen_length=32;
    } else if(kind==12) {
        if(!d->session_valid || !d->meet_pending || !d->meet_confirmed) return 4;
        memcpy(d->frozen,d->meet_proof,64);d->frozen_length=64;
    } else if(kind==13) {
        if(!d->session_valid) return 4;
        memcpy(d->frozen,d->environment_status,10);d->frozen_length=10;
    } else if(kind==14) {
        if(!d->session_valid || !d->environment_allowed) return 4;
        if(d->environment_pending) {memcpy(d->frozen,d->environment_event,56);d->frozen_length=56;}
    } else if(kind==16) {
        if(!d->session_valid) return 4;
        if(d->peer)bj_peer_status(d->peer,d->frozen);
        else {memset(d->frozen,0,30);d->frozen[0]=1;d->frozen[1]=1;}
        /* QR is the only production capability until trusted peer + real input exist. */
        d->frozen_length=30;
    } else if(kind==17) {
        if(!d->session_valid) return 4;
        if(d->peer)d->frozen_length=(uint16_t)bj_peer_reference(d->peer,d->frozen);
    } else if(kind==23) {
        if(!d->session_valid) return 4;
        memcpy(d->frozen,d->update_status,40);d->frozen_length=40;
    } else if(kind==24) {
        if(!d->session_valid || !d->active)return 4;
        if(d->active->count){memcpy(d->frozen,d->active->bodies[0],39);if(!mac(d,"BAJI-ACTIVE-v1",d->frozen,39,d->frozen+39))return 4;d->frozen_length=71;}
    } else return 2;
    d->frozen_kind=kind;d->frozen_at=d->now;d->frozen_valid=true;return 0;
}
bool bj_data_dispatch(bj_data_t *d,const uint8_t wire[20],uint8_t out[20]) {
    bj_packet_t q;if(!d || !bj_packet_decode(wire,20,&q) || !q.sequence) return false;
    bj_packet_t a={.opcode=0x80,.sequence=q.sequence,.length=2};a.payload[0]=q.opcode;
    uint8_t *r=a.payload+2;
    switch(q.opcode) {
    case 6:
        if(q.length) {a.payload[1]=1;break;}
        a.length=12;r[0]=1;put(r+1,31u|(d->provisioned?32u:0u),2);r[3]=r[4]=24;put(r+5,512,2);r[7]=8;r[8]=9;break;
    case 7:
        if(q.length) {a.payload[1]=1;break;}
        if(!d->session_valid) {a.payload[1]=4;break;}
        d->environment_revoked_revision=d->environment_revision;
        a.payload[1]=bj_data_environment_clear(d)?0:3;break;
    case 0x10:
        if(q.length!=9 || !u16(q.payload+1) || !u16(q.payload+3) || u16(q.payload+3)>512) {a.payload[1]=1;break;}
        if(!d->provisioned) {a.payload[1]=4;break;}
        d->stage_kind=q.payload[0];d->transfer=u16(q.payload+1);d->stage_length=u16(q.payload+3);d->stage_crc=u32(q.payload+5);
        d->stage_received=0;d->stage_at=d->now;d->staging=true;break;
    case 0x11: {
        if(q.length<4 || q.length>12) {a.payload[1]=1;break;}
        if(!d->staging || u16(q.payload)!=d->transfer) {a.payload[1]=3;break;}
        size_t pos=(size_t)q.payload[2]*9,count=q.length-3;
        if(pos>=d->stage_length || count!=(d->stage_length-pos<9?d->stage_length-pos:9)) {a.payload[1]=1;break;}
        if(pos<d->stage_received) {if(pos+count>d->stage_received || !equal(d->stage+pos,q.payload+3,count)) a.payload[1]=4;break;}
        if(pos!=d->stage_received) {a.payload[1]=3;break;}
        memcpy(d->stage+pos,q.payload+3,count);d->stage_received+=(uint16_t)count;break;
    }
    case 0x12:
        if(q.length!=2) {a.payload[1]=1;break;}
        if(!d->staging || u16(q.payload)!=d->transfer) {a.payload[1]=3;break;}
        if(d->stage_received!=d->stage_length || bj_data_crc(d->stage,d->stage_length)!=d->stage_crc) {a.payload[1]=1;break;}
        a.payload[1]=commit(d);if(!a.payload[1]) {d->staging=false;a.length=8;put(r,d->transfer,2);put(r+2,d->has_pet?u32(d->pet+1):0,4);}break;
    case 0x13: {
        if(q.length!=2) {a.payload[1]=1;break;}
        uint8_t kind=q.payload[0],page=q.payload[1];
        if(page==255) {a.payload[1]=freeze(d,kind);if(!a.payload[1]) {a.length=8;put(r,d->frozen_length,2);put(r+2,bj_data_crc(d->frozen,d->frozen_length),4);}break;}
        if(!d->frozen_valid || kind!=d->frozen_kind) {a.payload[1]=3;break;}
        size_t pos=page*9u;if(pos>=d->frozen_length) {a.payload[1]=1;break;}
        size_t count=d->frozen_length-pos;if(count>9) count=9;
        r[0]=page;memcpy(r+1,d->frozen+pos,count);a.length=(uint8_t)(3+count);break;
    }
    default: a.payload[1]=2;break;
    }
    return bj_packet_encode(&a,out);
}
