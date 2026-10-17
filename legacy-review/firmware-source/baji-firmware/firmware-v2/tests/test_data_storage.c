/* Directly include the actual production NVS adapter. All unexecuted worker,
 * sensor and crypto boundaries abort if accidentally called; this is not
 * actual task, HMAC or I2C execution. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../runtime/baji_data_runtime.c"
static uint8_t committed[BJ_DATA_STORE_MAX],pending[BJ_DATA_STORE_MAX];
static size_t committed_size,pending_size;
static bool fail_set,fail_commit,commit_persists;
static unsigned readback_fault;
static unsigned set_calls,commit_calls,checks;
#define CHECK(x) do {checks++;if(!(x)){fprintf(stderr,"storage line %d: %s\n",__LINE__,#x);exit(1);}}while(0)
esp_err_t nvs_set_blob(nvs_handle_t h,const char *name,const void *bytes,size_t n) {
    CHECK(h==storage && (!strcmp(name,"events") || !strcmp(name,"environment") || !strcmp(name,"active")));set_calls++;
    if(fail_set) return ESP_FAIL;
    memcpy(pending,bytes,n);pending_size=n;return ESP_OK;
}
esp_err_t nvs_commit(nvs_handle_t h) {
    CHECK(h==storage);commit_calls++;
    if(!fail_commit || commit_persists) {memcpy(committed,pending,pending_size);committed_size=pending_size;}
    return fail_commit?ESP_FAIL:ESP_OK;
}
static void scenario(bool set_failure,bool indeterminate_persist) {
    uint8_t id[6]={1,2,3,4,5,6};bj_data_init(&data,id,false,NULL,save,NULL);
    storage=12;storage_ok=true;storage_corrupt=false;storage_errors=0;fail_set=fail_commit=false;
    data.next_event=UINT64_C(9007199254740994);data.last_ack=UINT64_C(9007199254740993);
    CHECK(save(NULL,data.store,bj_data_encode_store(&data)));size_t old_size=committed_size;
    fail_set=set_failure;fail_commit=!set_failure;commit_persists=indeterminate_persist;
    unsigned commits_before=commit_calls;
    CHECK(!bj_data_event(&data,12,1,0));CHECK(storage_corrupt && storage_errors==1);CHECK(commit_calls==commits_before+(set_failure?0u:1u));
    CHECK(data.event_count==0 && data.next_event==UINT64_C(9007199254740994));
    unsigned calls=set_calls;CHECK(!bj_data_event(&data,1,0,0));CHECK(set_calls==calls && storage_errors==1);
    /* Reboot recovers the actual committed stream, whether a reported failure
       persisted the transaction or left the old lastACK-only blob intact. */
    bj_data_init(&data,id,false,NULL,save,NULL);CHECK(bj_data_load(&data,committed,committed_size));
    CHECK(data.last_ack==UINT64_C(9007199254740993));CHECK(data.next_event>data.last_ack);
    CHECK(data.event_count==(indeterminate_persist && !set_failure?1:0));
    CHECK(data.next_event==UINT64_C(9007199254740994)+(indeterminate_persist && !set_failure?1:0));
    if(!indeterminate_persist || set_failure) CHECK(committed_size==old_size);
    uint64_t next=data.next_event;storage_corrupt=false;fail_set=fail_commit=false;
    CHECK(bj_data_event(&data,12,1,0));CHECK(data.next_event==next+1 && data.next_event>data.last_ack);
}
static unsigned audio_stops;
static bool stop_reenter;
bool bj_audio_stop(bj_audio_t *a) {
    audio_stops++;a->active=false;
    if(stop_reenter){stop_reenter=false;bj_data_runtime_environment_stop();}
    return true;
}
static void stop_scenario(bool set_failure,bool commit_failure,bool reenter) {
    uint8_t id[6]={1,2,3,4,5,6};bj_data_init(&data,id,false,NULL,save,NULL);
    data.environment_save=environment_save;data.environment_revision=9;
    data.environment_allowed=true;data.environment_pending=true;data.environment_next=2;
    data.environment_event[1]=1;
    data.frozen_kind=14;data.frozen_valid=true;data.frozen_length=56;memset(data.frozen,42,56);
    storage=12;storage_ok=true;storage_corrupt=false;storage_errors=0;
    fail_set=set_failure;fail_commit=commit_failure;commit_persists=false;
    atomic_store(&environment_stop_requested,false);
    unsigned drops=atomic_load(&input_drops),stops=audio_stops;
    /* xQueueSend aborts if reached: STOP never uses the ordinary queue. */
    inputs=(void *)1;bj_data_runtime_environment_stop();bj_data_runtime_environment_stop();
    CHECK(atomic_load(&environment_stop_requested));CHECK(atomic_load(&input_drops)==drops);
    stop_reenter=reenter;CHECK(consume_environment_stop());CHECK(audio_stops==stops+1);
    CHECK(!data.environment_allowed && !data.environment_pending && data.environment_revoked_revision==9);
    CHECK(!data.frozen_valid && !data.frozen_length);
    for(unsigned i=0;i<56;i++)CHECK(!data.environment_event[i] && !data.frozen[i]);
    CHECK(storage_corrupt==(set_failure || commit_failure || readback_fault));
    CHECK(atomic_load(&environment_stop_requested)==reenter);
    if(reenter)CHECK(consume_environment_stop());
    CHECK(!consume_environment_stop());
    if(!set_failure && !commit_failure){bj_data_t restored;bj_data_init(&restored,id,false,NULL,NULL,NULL);CHECK(bj_data_environment_load(&restored,committed,committed_size));CHECK(restored.environment_revoked_revision==9 && !restored.environment_pending);}
}
#define UNUSED_BOUNDARY() do {fprintf(stderr,"unexpected worker boundary\n");abort();}while(0)
int64_t esp_timer_get_time(void){UNUSED_BOUNDARY();return 0;}
QueueHandle_t xQueueCreate(unsigned a,size_t b){(void)a;(void)b;UNUSED_BOUNDARY();return NULL;}
int xQueuePeek(QueueHandle_t a,void *b,unsigned c){(void)a;(void)b;(void)c;UNUSED_BOUNDARY();return 0;}
int xQueueReceive(QueueHandle_t a,void *b,unsigned c){(void)a;(void)b;(void)c;UNUSED_BOUNDARY();return 0;}
int xQueueSend(QueueHandle_t a,const void *b,unsigned c){(void)a;(void)b;(void)c;UNUSED_BOUNDARY();return 0;}
int xQueueOverwrite(QueueHandle_t a,const void *b){(void)a;(void)b;UNUSED_BOUNDARY();return 0;}
int xTaskCreate(void (*a)(void *),const char *b,unsigned c,void *d,unsigned e,TaskHandle_t *f){(void)a;(void)b;(void)c;(void)d;(void)e;(void)f;UNUSED_BOUNDARY();return 0;}
void vTaskDelay(unsigned a){(void)a;UNUSED_BOUNDARY();}
i2c_master_bus_handle_t bsp_i2c_get_handle(void){UNUSED_BOUNDARY();return NULL;}
esp_err_t i2c_master_bus_add_device(i2c_master_bus_handle_t a,const i2c_device_config_t *b,i2c_master_dev_handle_t *c){(void)a;(void)b;(void)c;UNUSED_BOUNDARY();return ESP_FAIL;}
esp_err_t i2c_master_transmit_receive(i2c_master_dev_handle_t a,const uint8_t *b,size_t c,uint8_t *d,size_t e,unsigned f){(void)a;(void)b;(void)c;(void)d;(void)e;(void)f;UNUSED_BOUNDARY();return ESP_FAIL;}
esp_err_t i2c_master_transmit(i2c_master_dev_handle_t a,const uint8_t *b,size_t c,unsigned d){(void)a;(void)b;(void)c;(void)d;UNUSED_BOUNDARY();return ESP_FAIL;}
esp_err_t nvs_open(const char *a,int b,nvs_handle_t *c){(void)a;(void)b;(void)c;UNUSED_BOUNDARY();return ESP_FAIL;}
esp_err_t nvs_get_blob(nvs_handle_t a,const char *b,void *c,size_t *d){CHECK(a==storage && !strcmp(b,"environment"));if(readback_fault==1 || *d<committed_size)return ESP_FAIL;memcpy(c,committed,committed_size);*d=committed_size;if(readback_fault==2)(*d)--;if(readback_fault==3)((uint8_t *)c)[0]^=1;return ESP_OK;}
const mbedtls_md_info_t *mbedtls_md_info_from_type(int a){(void)a;UNUSED_BOUNDARY();return NULL;}
int mbedtls_md(const mbedtls_md_info_t *a,const unsigned char *b,size_t c,unsigned char *d){(void)a;(void)b;(void)c;(void)d;UNUSED_BOUNDARY();return -1;}
esp_err_t bj_audio_runtime_init(bj_audio_t *a){(void)a;UNUSED_BOUNDARY();return ESP_FAIL;}
bool bj_audio_set_gate(bj_audio_t *a,const bj_audio_gate_t *b){(void)a;(void)b;UNUSED_BOUNDARY();return false;}
bool bj_audio_runtime_window_complete(void){UNUSED_BOUNDARY();return false;}
bool bj_audio_process(bj_audio_t *a){(void)a;UNUSED_BOUNDARY();return false;}
int mbedtls_md_hmac(const mbedtls_md_info_t *a,const unsigned char *b,size_t c,const unsigned char *d,size_t e,unsigned char *f){(void)a;(void)b;(void)c;(void)d;(void)e;(void)f;UNUSED_BOUNDARY();return -1;}
bool bj_ble_data_current(uint32_t a){(void)a;UNUSED_BOUNDARY();return false;}
uint32_t bj_ble_data_generation(void){UNUSED_BOUNDARY();return 0;}
bool bj_ble_data_take(uint8_t a[20],uint32_t *b){(void)a;(void)b;UNUSED_BOUNDARY();return false;}
bool bj_ble_data_reply(const uint8_t a[20],uint32_t b){(void)a;(void)b;UNUSED_BOUNDARY();return false;}
bool bj_pmic_latest(bj_pmic_snapshot_t *a){(void)a;UNUSED_BOUNDARY();return false;}
int main(void) {
    stop_scenario(false,false,false);stop_scenario(true,false,false);stop_scenario(false,true,false);stop_scenario(false,false,true);
    for(readback_fault=1;readback_fault<=3;readback_fault++) stop_scenario(false,false,false);
    readback_fault=0;
    for(readback_fault=1;readback_fault<=3;readback_fault++) {
        uint8_t bytes[89]={0};storage_ok=true;storage_corrupt=false;storage_errors=0;fail_set=fail_commit=false;
        CHECK(!environment_save(NULL,bytes,sizeof(bytes)));CHECK(storage_corrupt && storage_errors==1);
        unsigned calls=set_calls;CHECK(!environment_save(NULL,bytes,sizeof(bytes)));CHECK(set_calls==calls);
    }
    readback_fault=0;
    scenario(true,false);scenario(false,false);scenario(false,true);
    epoch=100;input_t care={.epoch=99,.type=1};
    unsigned writes=set_calls;uint64_t before=data.next_event;
    CHECK(!apply_care_input(&care) && set_calls==writes && data.next_event==before);
    care.epoch=epoch;CHECK(apply_care_input(&care) && data.next_event==before+1);
    committed[4]^=1;CHECK(!bj_data_load(&data,committed,committed_size));
    printf("PASS actual NVS adapter: %u checks (set/commit failure latch, indeterminate persisted result, reboot id > lastACK)\n",checks);return 0;
}
