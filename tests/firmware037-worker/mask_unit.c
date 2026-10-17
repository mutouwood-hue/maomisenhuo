#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include <string.h>
#include <stdint.h>
#include "lvgl.h"
#include "pool_port.h"
#ifdef CF_THREAD_TEST
#include "src/osal/lv_os_private.h"
#include "thread_mutex_port.h"
#endif
#include MASK_SOURCE
static unsigned checks;
#define CHECK(v) do{assert(v);checks++;}while(0)
static uint64_t hash_bytes(uint64_t h,const void*v,size_t n){const uint8_t*p=v;while(n--){h^=*p++;h*=1099511628211ULL;}return h;}
static uint64_t raster(int r,bool inv){
 lv_area_t area={0,0,2*r-1,2*r-1};lv_draw_sw_mask_radius_param_t p;
 lv_draw_sw_mask_radius_init(&p,&area,r,inv);uint64_t h=1469598103934665603ULL;
 for(int y=-2;y<2*r+2;y++){
  lv_opa_t row[610];assert(2*r+4<=610);memset(row,255,sizeof(row));void *m[]={&p,NULL};
  lv_draw_sw_mask_res_t status=lv_draw_sw_mask_apply(m,row,-2,y,2*r+4);h=hash_bytes(h,&status,sizeof(status));h=hash_bytes(h,row,2*r+4);
 }
 lv_draw_sw_mask_free_param(&p);return h;
}
#ifdef CF_THREAD_TEST
static uint64_t thread_expected[234][2];
static void *mask_thread(void *arg){unsigned id=(unsigned)(uintptr_t)arg;for(unsigned i=0;i<500;i++){unsigned r=1+(i*17+id*43)%233;bool inv=(i+id)%2;assert(raster(r,inv)==thread_expected[r][inv]);if(i%17==0)lv_draw_sw_mask_cleanup();}return NULL;}
static void thread_test(void){
 for(unsigned r=1;r<=233;r++)for(unsigned i=0;i<2;i++)thread_expected[r][i]=raster(r,i);
 pthread_t th[4];for(unsigned i=0;i<4;i++)assert(pthread_create(&th[i],NULL,mask_thread,(void*)(uintptr_t)i)==0);for(unsigned i=0;i<4;i++)assert(pthread_join(th[i],NULL)==0);
 CHECK(!cf_mask_any_referenced());cf_test_guards();CHECK(cf_test_live==1);checks+=2000;
}
#endif
static void lifecycle(const char *name){
#ifdef CF_PRIVATE
#ifdef CF_THREAD_TEST
 if(!strcmp(name,"threaded")){thread_test();return;}
#endif
 if(!strcmp(name,"guards")){
  CHECK(cf_mask_block!=NULL);CHECK(cf_test_alloc_calls==1&&cf_test_live==1);
  lv_draw_sw_mask_init();CHECK(cf_test_alloc_calls==1);
  lv_draw_sw_mask_radius_param_t p;lv_area_t a={0,0,465,465};lv_draw_sw_mask_radius_init(&p,&a,233,false);
  CHECK(cf_mask_slot(p.circle)>=0);CHECK(p.circle->used_cnt==1);uint8_t*buf=p.circle->buf;
  lv_draw_sw_mask_cleanup();CHECK(p.circle->buf==buf&&p.circle->used_cnt==1);
  lv_draw_sw_mask_init();CHECK(cf_test_alloc_calls==1&&p.circle->buf==buf);
  lv_draw_sw_mask_deinit();CHECK(cf_mask_deinit_pending&&cf_test_live==1);CHECK(p.circle->buf==buf);
  lv_draw_sw_mask_init();CHECK(cf_mask_deinit_pending&&cf_test_alloc_calls==1);
  lv_draw_sw_mask_free_param(&p);CHECK(p.circle==NULL&&cf_test_live==0&&cf_test_free_calls==1);
  lv_draw_sw_mask_free_param(&p);CHECK(cf_test_free_calls==1);
  lv_draw_sw_mask_init();CHECK(cf_mask_block!=NULL&&!cf_mask_deinit_pending&&cf_test_alloc_calls==2);
  lv_draw_sw_mask_deinit();CHECK(cf_test_live==0&&cf_test_free_calls==2&&!cf_mask_mutex_initialized);
  lv_draw_sw_mask_deinit();CHECK(cf_test_free_calls==2);
  lv_draw_sw_mask_init();CHECK(cf_test_alloc_calls==3&&cf_test_live==1);
 }
 else if(!strcmp(name,"mixed")){
  lv_draw_sw_mask_radius_param_t p[18];
  for(int i=0;i<12;i++){lv_area_t a={0,0,465,465};lv_draw_sw_mask_radius_init(&p[i],&a,100+i,false);CHECK(cf_mask_slot(p[i].circle)>=0);}
  lv_area_t a={0,0,599,599};
  for(int i=12;i<18;i++){lv_draw_sw_mask_radius_init(&p[i],&a,234+i,false);CHECK(cf_mask_slot(p[i].circle)<0);}
  CHECK(cf_mask_legacy_temporary_refs==2);
  lv_draw_sw_mask_cleanup();CHECK(cf_test_live==1);
  lv_draw_sw_mask_deinit();CHECK(cf_mask_deinit_pending&&cf_test_live==1);
  for(int i=0;i<12;i++)lv_draw_sw_mask_free_param(&p[i]);CHECK(cf_test_live==0&&cf_test_free_calls==1);
  for(int i=12;i<18;i++)lv_draw_sw_mask_free_param(&p[i]);CHECK(cf_mask_legacy_temporary_refs==0);CHECK(!cf_mask_any_referenced());
  lv_draw_sw_mask_deinit();CHECK(!cf_mask_mutex_initialized);
  lv_draw_sw_mask_init();CHECK(cf_test_live==1);
 }
 else if(!strcmp(name,"capacity")){
  lv_draw_sw_mask_radius_param_t p[13];lv_area_t a={0,0,465,465};
  for(int i=0;i<13;i++){lv_draw_sw_mask_radius_init(&p[i],&a,50+i,false);CHECK((cf_mask_slot(p[i].circle)>=0)==(i<12));}
  for(int i=12;i>=0;i--)lv_draw_sw_mask_free_param(&p[i]);CHECK(!cf_mask_any_referenced());cf_test_guards();
 }
 else if(!strcmp(name,"no-legacy-alloc")){
  cf_std_calls=0;cf_std_fail_nth=1;for(int r=1;r<=233;r++){raster(r,false);cf_test_guards();}CHECK(cf_std_calls==0);cf_std_fail_nth=0;
 }
 else if(!strcmp(name,"zero-clamp")){
  lv_draw_sw_mask_radius_param_t p;lv_area_t a={0,0,465,465};lv_draw_sw_mask_radius_init(&p,&a,-1,false);CHECK(p.circle==NULL);lv_draw_sw_mask_free_param(&p);
  lv_draw_sw_mask_radius_init(&p,&a,LV_RADIUS_CIRCLE,false);CHECK(p.cfg.radius==233&&cf_mask_slot(p.circle)>=0);lv_draw_sw_mask_free_param(&p);
 }
 else if(!strcmp(name,"budget-exact")){
  CHECK(cf_mask_block!=NULL&&cf_test_live==1);CHECK(cf_test_alloc_calls==1);raster(233,false);cf_test_guards();
 }
 else if(!strcmp(name,"budget-minus-one")){
  CHECK(cf_mask_block==NULL&&cf_test_alloc_calls==0);raster(233,false);
 }
 else if(!strcmp(name,"fallback")){
  CHECK(cf_mask_block==NULL&&!cf_test_live);lv_draw_sw_mask_radius_param_t p;lv_area_t a={0,0,465,465};lv_draw_sw_mask_radius_init(&p,&a,233,false);CHECK(cf_mask_slot(p.circle)<0);lv_draw_sw_mask_free_param(&p);
  unsigned n=cf_test_alloc_calls;lv_draw_sw_mask_init();CHECK(cf_test_alloc_calls==n);CHECK(cf_mask_block==NULL);CHECK(!cf_mask_any_referenced());
  lv_draw_sw_mask_deinit();cf_test_mode="enabled";cf_test_free=cf_test_largest=8*1024*1024;lv_draw_sw_mask_init();CHECK(cf_mask_block!=NULL&&cf_test_live==1);
 }
 else if(!strcmp(name,"legacy-temp-oom")){
  lv_draw_sw_mask_radius_param_t p[5];lv_area_t a={0,0,599,599};for(int i=0;i<4;i++)lv_draw_sw_mask_radius_init(&p[i],&a,240+i,false);cf_std_calls=0;cf_std_fail_nth=1;lv_draw_sw_mask_radius_init(&p[4],&a,250,false);_Exit(77);
 }
 else if(!strncmp(name,"legacy-oom-",11)){
  cf_std_calls=0;cf_std_fail_nth=(unsigned)atoi(name+11);lv_draw_sw_mask_radius_param_t p;lv_area_t a={0,0,599,599};lv_draw_sw_mask_radius_init(&p,&a,300,false);_Exit(77);
 }
 else abort();
#else
 (void)name;abort();
#endif
}
int main(int argc,char **argv){
 CHECK(argc>=2);if(!strcmp(argv[1],"budget-exact")){cf_test_free=2097152+20592;cf_test_largest=20592;}if(!strcmp(argv[1],"budget-minus-one")){cf_test_free=2097152+20592-1;cf_test_largest=20592;}lv_init();
 if(!strcmp(argv[1],"raster")){
  for(int r=1;r<=233;r++)for(int inv=0;inv<2;inv++){printf("HASH %d %d %016llx\n",r,inv,(unsigned long long)raster(r,inv));checks++;cf_test_guards();}
  for(int r=234;r<=300;r+=66)for(int inv=0;inv<2;inv++){printf("HASH %d %d %016llx\n",r,inv,(unsigned long long)raster(r,inv));checks++;}
 }
 else lifecycle(argv[1]);
 lv_draw_sw_mask_cleanup();lv_draw_sw_mask_deinit();cf_test_guards();CHECK(cf_test_live==0);
 printf("CHECKS %u ALLOC %u FREE %u\n",checks,cf_test_alloc_calls,cf_test_free_calls);return 0;
}
