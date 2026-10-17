#include "baji_active.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static unsigned checks;static uint8_t durable[BJ_ACTIVE_STORE_BYTES];static size_t durable_size;static bool failure;
#define CHECK(x) do{checks++;if(!(x)){fprintf(stderr,"active line %d\n",__LINE__);exit(1);}}while(0)
static bool save(void *ctx,const uint8_t *b,size_t n){(void)ctx;if(failure)return false;memcpy(durable,b,n);durable_size=n;return true;}
static void seconds(bj_active_t *a,const uint8_t session[16],uint32_t start,uint32_t duration){for(uint32_t ms=0;ms<=duration;ms+=100)bj_active_tick(a,true,2,session,1000+(start+ms)/1000,start+ms);}
int main(void){
    bj_active_t a,restored;uint8_t session[16]={1};bj_active_init(&a,save,NULL);
    seconds(&a,session,0,9900);CHECK(a.count==0);bj_active_tick(&a,true,2,session,1010,10000);CHECK(a.count==1 && a.next==2);
    CHECK(a.bodies[0][0]==1 && a.bodies[0][21]==10 && !memcmp(a.bodies[0]+23,session,16));
    bj_active_init(&restored,save,NULL);CHECK(bj_active_load(&restored,durable,durable_size));CHECK(restored.count==1 && restored.next==2);
    CHECK(!bj_active_ack(&a,2));CHECK(bj_active_ack(&a,1));CHECK(bj_active_ack(&a,1));CHECK(!a.count && a.ack==1);
    bj_active_tick(&a,false,2,session,1011,11000);CHECK(!a.tracking);
    seconds(&a,session,12000,5000);session[0]=2;bj_active_tick(&a,true,2,session,1017,17000);CHECK(!a.tracking && a.count==0);
    seconds(&a,session,20000,5000);bj_active_tick(&a,true,3,session,1025,25000);CHECK(!a.tracking);
    bj_active_tick(&a,true,2,session,1030,30000);bj_active_tick(&a,true,2,session,1040,40000);CHECK(!a.count && !a.tracking);
    for(unsigned i=0;i<32;i++)seconds(&a,session,50000+i*10000,10000);
    CHECK(a.count==32);bj_active_tick(&a,true,2,session,1380,380000);CHECK(a.fault && !a.tracking);
    CHECK(bj_active_ack(&a,2) && !a.fault && a.count==31);
    failure=true;CHECK(!bj_active_ack(&a,3) && a.fault && a.count==31);failure=false;
    durable[0]^=1;CHECK(!bj_active_load(&restored,durable,durable_size));
    printf("ACTIVE %u checks pass; host clock/gate fixtures not physical foreground evidence\n",checks);return 0;
}
