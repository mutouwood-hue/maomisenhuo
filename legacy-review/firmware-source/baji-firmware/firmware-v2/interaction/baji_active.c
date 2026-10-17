#include "baji_active.h"
#include <string.h>
static void put(uint8_t *b,uint64_t n,unsigned size){for(unsigned i=0;i<size;i++)b[i]=(uint8_t)(n>>(8*i));}
static uint64_t get(const uint8_t *b,unsigned n){uint64_t v=0;for(unsigned i=0;i<n;i++)v|=(uint64_t)b[i]<<(8*i);return v;}
static uint32_t crc(const uint8_t *b,size_t n){uint32_t c=UINT32_MAX;while(n--){c^=*b++;for(unsigned j=0;j<8;j++)c=(c>>1)^((0u-(c&1u))&0xedb88320u);}return c^UINT32_MAX;}
static bool persist(bj_active_t *a,uint16_t count,uint64_t next,uint64_t ack,const uint8_t *bodies){
    uint8_t bytes[BJ_ACTIVE_STORE_BYTES];memcpy(bytes,"BJA2",4);put(bytes+4,next,8);put(bytes+12,ack,8);put(bytes+20,count,2);
    size_t n=22u+39u*count;memcpy(bytes+22,bodies,39u*count);put(bytes+n,crc(bytes,n),4);
    return a->save && a->save(a->context,bytes,n+4);
}
void bj_active_init(bj_active_t *a,bool (*save)(void *,const uint8_t *,size_t),void *ctx){memset(a,0,sizeof(*a));a->next=1;a->save=save;a->context=ctx;}
bool bj_active_load(bj_active_t *a,const uint8_t *b,size_t n){
    if(!a || !b || n<26 || memcmp(b,"BJA2",4) || get(b+20,2)>32 || n!=26u+39u*get(b+20,2) || get(b+n-4,4)!=crc(b,n-4) || !get(b+4,8) || get(b+12,8)>=get(b+4,8))return false;
    uint64_t previous=get(b+12,8);unsigned count=(unsigned)get(b+20,2);
    for(unsigned i=0;i<count;i++){const uint8_t *v=b+22+39*i;uint64_t id=get(v+1,8);unsigned seconds=(unsigned)get(v+21,2);if(v[0]!=1 || id<=previous || id>=get(b+4,8) || !get(v+9,4) || !seconds || seconds>10 || get(v+17,4)-get(v+13,4)!=seconds)return false;previous=id;}
    a->next=get(b+4,8);a->ack=get(b+12,8);a->count=(uint16_t)count;memcpy(a->bodies,b+22,39u*count);return true;
}
void bj_active_tick(bj_active_t *a,bool eligible,uint32_t alias,const uint8_t session[16],uint32_t unix_time,uint32_t now){
    if(!a)return;
    bool identity=session && a->tracking && a->alias==alias && !memcmp(a->session,session,16);
    if(!eligible || !alias || !session || !unix_time || a->fault || a->count>=32 || (a->tracking && (!identity || now-a->last>250u || unix_time<a->from || unix_time-a->from>(now-a->started)/1000u+1u))){
        a->tracking=false;a->alias=a->from=a->started=a->last=0;memset(a->session,0,16);if(a->count>=32)a->fault=true;return;
    }
    if(!a->tracking){a->tracking=true;a->alias=alias;memcpy(a->session,session,16);a->from=unix_time;a->started=a->last=now;return;}
    a->last=now;if(now-a->started<10000u)return;
    if(unix_time-a->from!=10u || !a->next || a->next==UINT64_MAX){a->tracking=false;return;}
    uint8_t *body=a->bodies[a->count];memset(body,0,39);body[0]=1;put(body+1,a->next,8);put(body+9,alias,4);put(body+13,a->from,4);put(body+17,unix_time,4);put(body+21,10,2);memcpy(body+23,session,16);
    if(!persist(a,a->count+1,a->next+1,a->ack,a->bodies[0])){a->fault=true;a->tracking=false;memset(body,0,39);return;}
    a->count++;a->next++;a->from=unix_time;a->started=now;
}
bool bj_active_ack(bj_active_t *a,uint64_t id){
    if(!a || !id)return false;
    if(id==a->ack)return true;
    if(!a->count || id!=get(a->bodies[0]+1,8))return false;
    if(!persist(a,a->count-1,a->next,id,a->bodies[1])){a->fault=true;return false;}
    a->count--;memmove(a->bodies,a->bodies+1,39u*a->count);memset(a->bodies[a->count],0,39);a->ack=id;a->fault=false;return true;
}
