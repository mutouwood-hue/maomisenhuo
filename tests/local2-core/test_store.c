#include "local2_store.h"
#include "nvs.h"
#include <stdatomic.h>
#include "freertos/semphr.h"
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static atomic_uint checks;
#define CHECK(x) do{checks++;if(!(x)){fprintf(stderr,"store FAIL %s:%d %s\n",__FILE__,__LINE__,#x);exit(1);}}while(0)
static uint8_t durable[L2_STORE_MAX],pending[L2_STORE_MAX];
static size_t durable_size,pending_size;
static int init_fault,open_fault,get_fault,set_fault,commit_fault,alloc_fault,mutex_fault,take_fault;
static unsigned init_calls,open_calls,set_calls,commit_calls,get_calls;
void *heap_caps_calloc(size_t n,size_t z,unsigned caps){(void)caps;return alloc_fault?NULL:calloc(n,z);}
void esp_fill_random(void *out,size_t n){for(size_t i=0;i<n;i++)((uint8_t *)out)[i]=(uint8_t)(i+1);}
SemaphoreHandle_t xSemaphoreCreateMutex(void){if(mutex_fault)return NULL;pthread_mutex_t *p=malloc(sizeof(*p));if(p)pthread_mutex_init(p,NULL);return p;}
int xSemaphoreTake(SemaphoreHandle_t p,TickType_t ms){(void)ms;if(take_fault)return pdFALSE;return pthread_mutex_lock(p)==0?pdTRUE:pdFALSE;}
int xSemaphoreGive(SemaphoreHandle_t p){return pthread_mutex_unlock(p)==0?pdTRUE:pdFALSE;}
esp_err_t nvs_flash_init(void){init_calls++;return init_fault?ESP_ERR_NVS_NO_FREE_PAGES:ESP_OK;}
esp_err_t nvs_open(const char *name,int mode,nvs_handle_t *h){open_calls++;CHECK(!strcmp(name,"cf_local2"));CHECK(mode==NVS_READWRITE);if(open_fault)return ESP_FAIL;*h=42;return ESP_OK;}
esp_err_t nvs_get_blob(nvs_handle_t h,const char *key,void *out,size_t *n){get_calls++;CHECK(h==42 && !strcmp(key,"state"));if(get_fault==1 || (get_fault==2 && out))return ESP_FAIL;if(!durable_size)return ESP_ERR_NVS_NOT_FOUND;if(!out){*n=durable_size;return ESP_OK;}if(*n<durable_size)return ESP_FAIL;memcpy(out,durable,durable_size);*n=durable_size;return ESP_OK;}
esp_err_t nvs_set_blob(nvs_handle_t h,const char *key,const void *p,size_t n){set_calls++;CHECK(h==42 && !strcmp(key,"state"));CHECK(n<=sizeof(pending));if(set_fault)return ESP_FAIL;memcpy(pending,p,n);pending_size=n;return ESP_OK;}
esp_err_t nvs_commit(nvs_handle_t h){commit_calls++;CHECK(h==42);if(commit_fault==1)return ESP_FAIL;memcpy(durable,pending,pending_size);durable_size=pending_size;return commit_fault==2?ESP_FAIL:ESP_OK;}
static bool make_blob(void *ctx,const uint8_t *b,size_t n){(void)ctx;memcpy(durable,b,n);durable_size=n;return true;}
static void fixture(void){l2_core_t *c=calloc(1,sizeof(*c));CHECK(c);CHECK(l2_init_new(c,"1234567890abcdef1234567890abcdef",make_blob,NULL)==L2_OK);free(c);}
static void bind(void){l2_core_t *c=l2_runtime_core(10);CHECK(c);l2_request_t r={0};strcpy(r.client_id,"11111111-2222-4333-8444-555555555555");strcpy(r.request_id,"first");r.seq=1;l2_snapshot_t s={0};strcpy(s.pet.pet_id,"cat-1");strcpy(s.pet.name,"小橘");strcpy(s.pet.breed,"orange");s.revision=1;CHECK(l2_set_snapshot(c,&r,&s)==L2_OK);l2_runtime_release();}
static void *writer(void *arg){(void)arg;for(unsigned i=0;i<20;i++)if(local2_emit_care(L2_ACTION_PET,0)!=L2_OK)abort();return NULL;}
int main(int argc,char **argv){CHECK(argc==2);const char *mode=argv[1];
 if(!strcmp(mode,"alloc"))alloc_fault=1;
 else if(!strcmp(mode,"mutex_alloc"))mutex_fault=1;
 else if(!strcmp(mode,"nvs_init"))init_fault=1;
 else if(!strcmp(mode,"nvs_open"))open_fault=1;
 else if(!strcmp(mode,"get_size")){fixture();get_fault=1;}
 else if(!strcmp(mode,"get_read")){fixture();get_fault=2;}
 else if(!strcmp(mode,"corrupt")){fixture();durable[0]^=0x80;}
 else if(!strcmp(mode,"oversize"))durable_size=L2_STORE_MAX+1;
 else if(!strcmp(mode,"init_set_fail"))set_fault=1;
 else if(!strcmp(mode,"init_commit_fail"))commit_fault=1;
 else if(!strcmp(mode,"load"))fixture();
 bool fails=alloc_fault || mutex_fault || init_fault || open_fault || get_fault || !strcmp(mode,"corrupt") || !strcmp(mode,"oversize") || set_fault || commit_fault;
 esp_err_t result=local2_init();
 if(fails){CHECK(result!=ESP_OK);unsigned before=set_calls;CHECK(local2_init()==result);CHECK(set_calls==before);l2_view_t v;local2_get_view(&v);CHECK(!v.ready);if(init_fault)CHECK(open_calls==0);if(!strcmp(mode,"corrupt") || !strcmp(mode,"oversize") || get_fault)CHECK(set_calls==0);printf("{\"scenario\":\"%s\",\"checks\":%u,\"failures\":0}\n",mode,checks);return 0;}
 CHECK(result==ESP_OK);l2_view_t v;local2_get_view(&v);CHECK(v.ready && !v.storage_error);CHECK(!v.has_snapshot);
 if(!strcmp(mode,"load")){CHECK(!strcmp(v.device_id,"1234567890abcdef1234567890abcdef"));CHECK(set_calls==0);}else CHECK(durable_size>0);
 bind();
 if(!strcmp(mode,"set_fail") || !strcmp(mode,"commit_old") || !strcmp(mode,"commit_new")){
  uint8_t before[L2_STORE_MAX];size_t n=durable_size;memcpy(before,durable,n);
  if(!strcmp(mode,"set_fail"))set_fault=1;else commit_fault=!strcmp(mode,"commit_old")?1:2;
  CHECK(local2_emit_care(L2_ACTION_PET,7)==L2_STORAGE_ERROR);local2_get_view(&v);CHECK(v.storage_error && v.pending_events==0);unsigned calls=set_calls;CHECK(local2_emit_care(L2_ACTION_PET,8)==L2_STORAGE_ERROR);CHECK(set_calls==calls);
  l2_core_t *reboot=calloc(1,sizeof(*reboot));CHECK(reboot);CHECK(l2_load(reboot,durable,durable_size,make_blob,NULL)==L2_OK);CHECK(reboot->saved.event_count==(!strcmp(mode,"commit_new")?1:0));if(strcmp(mode,"commit_new"))CHECK(n==durable_size && !memcmp(before,durable,n));free(reboot);
 }else if(!strcmp(mode,"concurrent")){
  pthread_t t[4];for(unsigned i=0;i<4;i++)CHECK(!pthread_create(t+i,NULL,writer,NULL));for(unsigned i=0;i<4;i++)CHECK(!pthread_join(t[i],NULL));local2_get_view(&v);CHECK(v.pending_events==80 && v.next_event==81);l2_core_t *c=l2_runtime_core(10);CHECK(c);for(unsigned i=0;i<80;i++)CHECK(c->saved.events[i].counter==i+1);l2_runtime_release();
 }else if(!strcmp(mode,"lock_busy")){
  take_fault=1;CHECK(local2_emit_care(L2_ACTION_PET,0)==L2_NOT_READY);CHECK(l2_runtime_core(1)==NULL);local2_get_view(&v);CHECK(v.busy && !v.ready && !v.storage_error);take_fault=0;CHECK(local2_emit_care(L2_ACTION_PET,0)==L2_OK);
 }else{
  CHECK(local2_emit_care(L2_ACTION_BATH,0)==L2_OK);local2_get_view(&v);CHECK(v.pending_events==1);CHECK(local2_present_gift_state(L2_GIFT_SHOWN)==L2_INVALID);
 }
 CHECK(init_calls==1);printf("{\"scenario\":\"%s\",\"checks\":%u,\"failures\":0}\n",mode,checks);return 0;}
