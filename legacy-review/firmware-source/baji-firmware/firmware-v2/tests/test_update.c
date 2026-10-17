#include "baji_update.h"
#include <stdio.h>
#include <string.h>
static unsigned checks;static uint8_t flash[64];static unsigned begins,writes,aborts;static bool bad_signature,bad_write,bad_finish;
#define CHECK(x) do{checks++;if(!(x)){fprintf(stderr,"update line %d\n",__LINE__);return 1;}}while(0)
static bool verify(void *c,const uint8_t *b,size_t n,const uint8_t *s,size_t z){(void)c;(void)b;return !bad_signature && n==74 && z==8 && s[0]==0x30;}
static bool begin(void *c,const bj_update_manifest_t *m){(void)c;begins++;return m->size<=64;}
static bool write_bytes(void *c,uint32_t p,const uint8_t *b,size_t n){(void)c;writes++;if(bad_write)return false;memcpy(flash+p,b,n);return true;}
static bool matches(void *c,uint32_t p,const uint8_t *b,size_t n){(void)c;return !memcmp(flash+p,b,n);}
static bool finish(void *c,const bj_update_manifest_t *m){(void)c;(void)m;return !bad_finish;}
static void abort_update(void *c){(void)c;aborts++;}
static void put(uint8_t *p,uint32_t v){for(unsigned i=0;i<4;i++)p[i]=(uint8_t)(v>>(8*i));}
int main(void){
    bj_update_adapter_t adapter={.verify=verify,.begin=begin,.write=write_bytes,.matches=matches,.finish=finish,.abort=abort_update};
    uint8_t target[16]="baji-s3-175c-v1",body[84]={1,1};memcpy(body+2,target,16);put(body+18,2);put(body+22,16);body[26]=body[58]=1;body[74]=8;body[76]=0x30;
    bj_update_t update;CHECK(bj_update_init(&update,&adapter,target,1,0));
    bad_signature=true;CHECK(!bj_update_begin(&update,body,84));CHECK(!begins);bad_signature=false;
    CHECK(bj_update_begin(&update,body,84));CHECK(bj_update_begin(&update,body,84));CHECK(begins==1);
    uint8_t bytes[16]={1,2,3},wrong[16]={2};CHECK(!bj_update_write(&update,wrong,0,bytes,8));CHECK(!bj_update_write(&update,body+58,8,bytes,8));
    CHECK(bj_update_write(&update,body+58,0,bytes,8));CHECK(bj_update_write(&update,body+58,0,bytes,8));CHECK(writes==1);
    CHECK(!bj_update_write(&update,body+58,0,wrong,8));CHECK(!bj_update_finish(&update,body+58));
    CHECK(bj_update_write(&update,body+58,8,bytes+8,8));bad_finish=true;CHECK(!bj_update_finish(&update,body+58));CHECK(aborts==1 && !update.active);
    bad_finish=false;CHECK(bj_update_begin(&update,body,84));bad_write=true;CHECK(!bj_update_write(&update,body+58,0,bytes,16));CHECK(aborts==2);bad_write=false;
    CHECK(bj_update_begin(&update,body,84));CHECK(bj_update_write(&update,body+58,0,bytes,16));CHECK(bj_update_finish(&update,body+58));
    CHECK(update.verified && update.received==16);CHECK(bj_update_finish(&update,body+58));CHECK(bj_update_begin(&update,body,84));CHECK(!update.active);
    bj_update_abort(&update);CHECK(!update.verified && update.received==16);
    CHECK(bj_update_begin(&update,body,84));bj_update_abort(&update);
    put(body+18,1);CHECK(!bj_update_begin(&update,body,84));body[2]^=1;CHECK(!bj_update_begin(&update,body,84));
    printf("update core %u checks pass; adapter signatures/flash are mocks\n",checks);return 0;
}
