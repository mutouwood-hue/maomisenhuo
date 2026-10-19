#include "local2_store.h"
#include "esp_heap_caps.h"
#include "esp_random.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include <string.h>

static l2_core_t *domain;
static nvs_handle_t handle;
static SemaphoreHandle_t mutex;
static bool attempted;
static esp_err_t init_status=ESP_ERR_INVALID_STATE;
static bool persist(void *ctx,const uint8_t *blob,size_t n)
{
    (void)ctx;
    if(n>L2_STORE_MAX || nvs_set_blob(handle,"state",blob,n)!=ESP_OK)return false;
    return nvs_commit(handle)==ESP_OK;
}
esp_err_t local2_init(void)
{
    /* Startup is single-owner, before UI/BLE/tasks. No retry after uncertain I/O. */
    if(attempted)return init_status;
    attempted=true;
    mutex=xSemaphoreCreateMutex();
    if(!mutex)return init_status=ESP_ERR_NO_MEM;
    domain=heap_caps_calloc(1,sizeof(*domain),MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
    if(!domain)domain=heap_caps_calloc(1,sizeof(*domain),MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT);
    if(!domain)return init_status=ESP_ERR_NO_MEM;
    esp_err_t e=nvs_flash_init();
    if(e!=ESP_OK){domain->storage_error=true;return init_status=e;}
    e=nvs_open("cf_local2",NVS_READWRITE,&handle);
    if(e!=ESP_OK){domain->storage_error=true;return init_status=e;}
    size_t n=0;
    e=nvs_get_blob(handle,"state",NULL,&n);
    l2_status_t status;
    if(e==ESP_ERR_NVS_NOT_FOUND){
        uint8_t id[16];char text[33];static const char h[]="0123456789abcdef";
        esp_fill_random(id,sizeof(id));
        for(unsigned i=0;i<16;i++){text[2*i]=h[id[i]>>4];text[2*i+1]=h[id[i]&15];}text[32]=0;
        status=l2_init_new(domain,text,persist,NULL);
    }else if(e==ESP_OK && n>0 && n<=L2_STORE_MAX){
        size_t size=n;e=nvs_get_blob(handle,"state",domain->blob,&size);
        if(e!=ESP_OK || size!=n){domain->storage_error=true;return init_status=e==ESP_OK?ESP_ERR_INVALID_STATE:e;}
        status=l2_load(domain,domain->blob,n,persist,NULL);
    }else{domain->storage_error=true;return init_status=e==ESP_OK?ESP_ERR_INVALID_STATE:e;}
    if(status!=L2_OK)return init_status=ESP_ERR_INVALID_STATE;
    return init_status=ESP_OK;
}
l2_core_t *l2_runtime_core(uint32_t timeout_ms)
{
    if(!domain || !mutex || xSemaphoreTake(mutex,pdMS_TO_TICKS(timeout_ms))!=pdTRUE)return NULL;
    return domain;
}
void l2_runtime_release(void){if(mutex)(void)xSemaphoreGive(mutex);}
void local2_get_view(l2_view_t *view)
{
    if(!view)return;
    l2_core_t *c=l2_runtime_core(20);
    if(!c){memset(view,0,sizeof(*view));view->busy=domain && mutex;view->storage_error=!view->busy;return;}
    l2_get_view(c,view);l2_runtime_release();
}
l2_status_t local2_emit_care(l2_action_t type,uint64_t ms)
{
    l2_core_t *c=l2_runtime_core(20);if(!c)return L2_NOT_READY;
    l2_status_t s=l2_emit_care(c,type,ms);l2_runtime_release();return s;
}
l2_status_t local2_present_gift_state(l2_gift_state_t state)
{
    l2_core_t *c=l2_runtime_core(20);if(!c)return L2_NOT_READY;
    l2_status_t s=l2_set_gift_state(c,state);l2_runtime_release();return s;
}
