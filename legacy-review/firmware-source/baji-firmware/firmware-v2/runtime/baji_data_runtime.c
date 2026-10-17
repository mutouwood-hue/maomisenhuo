#include "baji_data_runtime.h"
#include "baji_data.h"
#include "baji_ble.h"
#include "baji_pmic.h"
#include "baji_audio_runtime.h"
#include "baji_update_runtime.h"
#include "baji_peer_crypto.h"
#include "baji_peer_ble.h"
#include "bsp/esp-bsp.h"
#include "driver/i2c_master.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "mbedtls/md.h"
#include "nvs.h"
#include <string.h>
#include <stdatomic.h>
/* Sole owner of crypto, NVS, sensors and domain. UI receives immutable snapshots. */
static bj_data_t data;
static bj_audio_t audio;
static bj_peer_t peer_state;
static bj_active_t active;
static atomic_bool care_visible;
static uint8_t peer_out[316],peer_out_type;static size_t peer_out_size;
static bool peer_transport_started;
static QueueHandle_t views,inputs;
static TaskHandle_t worker;
static uint8_t key[32];
static nvs_handle_t storage;
static bool storage_ok, storage_corrupt;
static uint32_t epoch,storage_errors,imu_errors,last_imu;
static atomic_uint input_drops;
static atomic_bool environment_stop_requested;
static i2c_master_dev_handle_t imu;
static bool imu_ok;
typedef struct {uint32_t epoch;uint8_t type,a,id[16];int16_t b;bool confirm,meet_confirm,environment_stop,peer_input;} input_t;
static uint32_t now_ms(void) {return (uint32_t)(esp_timer_get_time()/1000);}
static void put(uint8_t *p,uint32_t v,unsigned n) {for(unsigned i=0;i<n;i++) p[i]=(uint8_t)(v>>(8*i));}
static uint32_t get32(const uint8_t *p) {return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
static bool sign(void *unused,const uint8_t *bytes,size_t n,uint8_t out[32]) {
    (void)unused;
    if(!bj_ble_data_current(epoch)) return false;
    const mbedtls_md_info_t *info=mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    return info && mbedtls_md_hmac(info,key,sizeof(key),bytes,n,out)==0 && bj_ble_data_current(epoch);
}
static bool hash(void *unused,const uint8_t *bytes,size_t n,uint8_t out[32]) {
    (void)unused;const mbedtls_md_info_t *info=mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    return info && mbedtls_md(info,bytes,n,out)==0;
}
static uint8_t update_object(void *unused,uint8_t kind,const uint8_t *body,size_t size) {
    (void)unused;bj_pmic_snapshot_t power;
    if(!bj_pmic_latest(&power) || !power.sample.battery_valid || now_ms()-power.sample.sampled_ms>2000u || power.sample.battery_percent<=10){bj_update_runtime_abort(12);return 6;}
    bool ok=kind==20?bj_update_runtime_begin(body,size):kind==21?bj_update_runtime_chunk(body,size):bj_update_runtime_finish(body,size);
    bj_update_runtime_status(data.update_status);return ok?0:6;
}
static bool save(void *unused,const uint8_t *bytes,size_t n) {
    (void)unused;
    if(!storage_ok || storage_corrupt) return false;
    if(nvs_set_blob(storage,"events",bytes,n)!=ESP_OK || nvs_commit(storage)!=ESP_OK) {storage_errors++;storage_corrupt=true;return false;}
    return true;
}
static bool environment_save(void *unused,const uint8_t *bytes,size_t size) {
    (void)unused;if(!storage_ok || storage_corrupt) return false;
    uint8_t actual[89];size_t actual_size=sizeof(actual);
    if(size!=sizeof(actual) || nvs_set_blob(storage,"environment",bytes,size)!=ESP_OK || nvs_commit(storage)!=ESP_OK ||
       nvs_get_blob(storage,"environment",actual,&actual_size)!=ESP_OK || actual_size!=size || memcmp(actual,bytes,size)) {storage_errors++;storage_corrupt=true;return false;}
    return true;
}
static bool active_save(void *unused,const uint8_t *bytes,size_t size) {
    (void)unused;if(!storage_ok || storage_corrupt || size>BJ_ACTIVE_STORE_BYTES)return false;
    uint8_t check[BJ_ACTIVE_STORE_BYTES];size_t n=sizeof(check);
    if(nvs_set_blob(storage,"active",bytes,size)!=ESP_OK || nvs_commit(storage)!=ESP_OK || nvs_get_blob(storage,"active",check,&n)!=ESP_OK || n!=size || memcmp(bytes,check,size)){storage_errors++;storage_corrupt=true;return false;}
    return true;
}
static bool consume_environment_stop(void) {
    if(!atomic_exchange(&environment_stop_requested,false))return false;
    data.environment_revoked_revision=data.environment_revision;
    (void)bj_audio_stop(&audio);
    (void)bj_data_environment_clear(&data);
    return true;
}
static bool imu_read(uint8_t reg,uint8_t *out,size_t n) {return i2c_master_transmit_receive(imu,&reg,1,out,n,5)==ESP_OK;}
static bool imu_write(uint8_t reg,uint8_t value) {uint8_t bytes[2]={reg,value};return i2c_master_transmit(imu,bytes,2,5)==ESP_OK;}
static void imu_init(void) {
    i2c_master_bus_handle_t bus=bsp_i2c_get_handle();if(!bus) return;
    const i2c_device_config_t cfg={.dev_addr_length=I2C_ADDR_BIT_LEN_7,.device_address=0x6b,.scl_speed_hz=400000};
    if(i2c_master_bus_add_device(bus,&cfg,&imu)!=ESP_OK) return;
    uint8_t who=0;
    if(!imu_read(0,&who,1) || who!=5) {imu_errors++;return;}
    /* Register sequence configures a +/-4g accelerometer, gyro off. No reset
       or PMIC modification, no fictional pedometer or magnetic heading. */
    imu_ok=imu_write(0x02,0x60) && imu_write(0x03,0x17) && imu_write(0x04,0) && imu_write(0x06,0x11) && imu_write(0x08,1);
    if(!imu_ok) imu_errors++;
}
static void sensors(uint32_t now) {
    uint8_t *b=data.sensor;b[0]=1;put(b+1,now,4);b[5]=0;b[6]=b[7]=b[8]=255;
    bj_pmic_snapshot_t p;
    if(bj_pmic_latest(&p)) {
        put(b+15,p.reads_failed,4);
        if(now-p.sample.sampled_ms<=2000u) {
            if(p.sample.battery_valid) b[6]=(uint8_t)p.sample.battery_percent;
            if(p.sample.usb_valid) b[7]=p.sample.usb_present?1:0;
            if(p.sample.battery_valid && p.sample.usb_valid) b[5]|=1;
        }
    }
    /* Charging is not provided by current read-only PMIC decoder; unknown is honest. */
    if(now-last_imu>=200u) {
        last_imu=now;uint8_t raw[6];
        for(unsigned i=9;i<15;i+=2) put(b+i,0x8000,2);
        if(imu_ok && imu_read(0x35,raw,6)) {
            for(unsigned i=0;i<3;i++) {int16_t value=(int16_t)((uint16_t)raw[2*i]|((uint16_t)raw[2*i+1]<<8));int32_t mg=(int32_t)value*1000/8192;put(b+9+2*i,(uint16_t)mg,2);}
        } else if(imu_ok) imu_errors++;
    }
    if((int16_t)((uint16_t)b[9]|((uint16_t)b[10]<<8))!=INT16_MIN) b[5]|=2;
    put(b+19,imu_errors,4);
}
static void publish(void) {
    bj_data_view_t v={.generation=epoch,.provisioned=data.provisioned,.authenticated=data.session_valid,
        .confirm_pending=data.challenge_pending && !data.confirmed,.challenge_code=get32(data.challenge+52),
        .has_pet=data.has_pet,.has_life=data.has_life,.clock_valid=data.clock_valid,.timezone=data.timezone,
        .life_length=data.life_length,.pending_events=data.event_count,.dropped=data.dropped+atomic_load(&input_drops),.storage_errors=storage_errors};
    v.active_pending=active.count;v.active_fault=active.fault;
    v.meet_method=data.meet_pending?data.meet_challenge[65]:0;
    if(data.peer)bj_peer_status(data.peer,v.social_status);
    v.meet_pending=data.meet_pending && !data.meet_confirmed;v.meet_confirmed=data.meet_confirmed;
    memcpy(v.meet_id,data.meet_challenge+1,16);memcpy(v.meet_peer,data.meet_challenge+23,6);
    v.environment_allowed=data.environment_allowed;v.audio_active=audio.active;v.audio_fault=audio.fault;v.environment_revision=data.environment_revision;
    v.environment_label=(uint8_t)audio.result.label;v.environment_confidence=audio.result.confidence_permille;v.environment_has_model=audio.result.has_model;
    if(data.clock_valid) v.unix_seconds=data.unix_base+(data.now-data.clock_at)/1000u;
    memcpy(v.challenge_id,data.challenge,16);memcpy(v.pet,data.pet,27);memcpy(v.life,data.life,205);xQueueOverwrite(views,&v);
}
static void peer_invalidate_disconnected(void) {
    static uint32_t disconnect_generation;
    uint32_t current=bj_peer_ble_disconnect_generation();
    if(current!=disconnect_generation){
        disconnect_generation=current;
        if(peer_transport_started && data.peer){bj_peer_clear(data.peer);data.peer->state=5;data.peer->reason=9;data.meet_confirmed=false;memset(data.meet_proof,0,64);data.frozen_valid=false;memset(data.frozen,0,sizeof(data.frozen));peer_out_size=0;memset(peer_out,0,sizeof(peer_out));peer_transport_started=false;}
    }
}
static void peer_runtime(bool power_allowed) {
    peer_invalidate_disconnected();
    if(data.peer && data.peer->state==5){
        if(peer_transport_started || bj_peer_ble_enabled())bj_peer_ble_stop();
        peer_transport_started=false;peer_out_size=0;peer_out_type=0;memset(peer_out,0,sizeof(peer_out));
        return;
    }
    if(!data.meet_pending || !data.session_valid || !bj_ble_data_current(epoch) || !power_allowed || !data.peer || data.meet_challenge[65]==1) {
        if(peer_transport_started){bj_peer_ble_stop();peer_transport_started=false;peer_out_size=0;memset(peer_out,0,sizeof(peer_out));}
        if(data.peer && !power_allowed)bj_peer_clear(data.peer);
        return;
    }
    if(!peer_transport_started){
        uint8_t message[44],own_token[32],other_token[32];
        memcpy(message,"BAJI-PEER-ADV-v1",16);memcpy(message+16,data.meet_challenge+1,16);
        memcpy(message+32,data.id,6);memcpy(message+38,data.meet_challenge+23,6);
        if(!hash(NULL,message,sizeof(message),own_token))return;
        memcpy(message+32,data.meet_challenge+23,6);memcpy(message+38,data.id,6);
        if(!hash(NULL,message,sizeof(message),other_token))return;
        bj_peer_ble_start(data.id,data.meet_challenge+23,own_token,other_token);peer_transport_started=true;
    }
    uint8_t object[316],type;size_t size=sizeof(object);
    if(bj_peer_ble_take(&type,object,&size))(void)bj_peer_receive(data.peer,type,object,size,data.now);
    bj_peer_tick(data.peer,data.now);
    if(data.peer->state==5){bj_peer_ble_stop();peer_transport_started=false;peer_out_size=0;peer_out_type=0;memset(peer_out,0,sizeof(peer_out));return;}
    if(!peer_out_size){peer_out_size=sizeof(peer_out);if(!bj_peer_next(data.peer,&peer_out_type,peer_out,&peer_out_size))peer_out_size=0;}
    if(peer_out_size && bj_peer_ble_send(peer_out_type,peer_out,peer_out_size)){peer_out_size=0;memset(peer_out,0,sizeof(peer_out));}
    if(data.peer->state==4 && bj_peer_ble_connected() && !data.meet_confirmed)(void)bj_data_meet_confirm(&data,data.now,data.meet_challenge+1);
}
static bool apply_care_input(const input_t *in) {
    return in && in->epoch==epoch && bj_data_event(&data,in->type,in->a,in->b);
}
static void task(void *unused) {
    (void)unused;imu_init();
    bool assets_ok=bj_update_runtime_restore_assets()==ESP_OK;
    (void)bj_update_runtime_confirm_boot(assets_ok && !storage_corrupt && views && inputs);
    uint8_t request[20],response[20];bool reply_pending=false,reply_peer=false;uint32_t reply_epoch=0;
    for(;;) {
        uint32_t current=bj_ble_data_generation();
        if(current!=epoch) {bj_update_runtime_abort(11);epoch=current;bj_data_disconnect(&data);reply_pending=false;}
        (void)consume_environment_stop();
        bj_data_tick(&data,now_ms());sensors(data.now);
        input_t in;
        for(unsigned i=0;i<4 && xQueueReceive(inputs,&in,0)==pdTRUE;i++) {
            peer_invalidate_disconnected();
            if(in.confirm) {if(in.epoch==epoch && bj_ble_data_current(epoch) && !memcmp(in.id,data.challenge,16)) (void)bj_data_confirm(&data,data.now);}
            else if(in.meet_confirm) {if(in.epoch==epoch && bj_ble_data_current(epoch) && (data.meet_challenge[65]==1 || bj_peer_ble_connected())) (void)bj_data_meet_confirm(&data,data.now,in.id);}
            else if(in.environment_stop) {data.environment_revoked_revision=data.environment_revision;(void)bj_data_environment_clear(&data);(void)bj_audio_stop(&audio);}
            else if(in.peer_input) {if(in.epoch==epoch && data.peer && bj_peer_ble_connected())bj_peer_input(data.peer,in.b,data.now);}
            else (void)apply_care_input(&in);
        }
        peer_invalidate_disconnected();
        if(reply_pending && reply_peer && data.peer && data.peer->state==5)reply_pending=false;
        if(reply_pending) {if(bj_ble_data_reply(response,reply_epoch)) reply_pending=false;}
        if(!reply_pending && bj_ble_data_take(request,&reply_epoch)) {
            bj_packet_t packet;reply_peer=bj_packet_decode(request,20,&packet) && packet.opcode==19 && packet.length>=1 && (packet.payload[0]==12 || packet.payload[0]==16 || packet.payload[0]==17);
            peer_invalidate_disconnected();
            if(bj_ble_data_current(reply_epoch) && bj_data_dispatch(&data,request,response)) {
                /* A request authenticated and committed before disconnect remains a
                   durable operation. A stale result never grants a later connection. */
                if(!bj_ble_data_current(reply_epoch)) bj_data_disconnect(&data);
                else if(!bj_ble_data_reply(response,reply_epoch)) reply_pending=true;
            }
        }
        bj_pmic_snapshot_t power;
        bool power_allowed=bj_pmic_latest(&power) && power.sample.battery_valid && data.now-power.sample.sampled_ms<=2000u && power.sample.battery_percent>10;
        bool active_allowed=!storage_corrupt && data.session_valid && bj_ble_data_current(epoch) && data.clock_valid && data.has_pet && atomic_load(&care_visible) && power_allowed;
        bj_active_tick(&active,active_allowed,(uint32_t)data.pet[5]|((uint32_t)data.pet[6]<<8),data.session,data.clock_valid?data.unix_base+(data.now-data.clock_at)/1000u:0,data.now);
        peer_runtime(power_allowed);
        if(!data.session_valid || !bj_ble_data_current(epoch))bj_update_runtime_abort(11);
        else if(!power_allowed)bj_update_runtime_abort(12);
        bj_update_runtime_status(data.update_status);
        (void)consume_environment_stop();
        bj_audio_gate_t gate={.owner_authenticated=!storage_corrupt && data.session_valid && bj_ble_data_current(epoch),
            .environment_allowed=data.environment_allowed,.power_allowed=power_allowed,.epoch=epoch,.consent_revision=data.environment_revision};
        (void)bj_audio_set_gate(&audio,&gate);
        if(audio.active) (void)bj_audio_process(&audio);
        (void)consume_environment_stop();
        data.environment_status[0]=1;
        data.environment_status[1]=(data.environment_allowed?1:0)|(audio.active?2:0)|(audio.result.has_model?4:0)|(audio.fault?8:0);
        put(data.environment_status+2,data.environment_revision,4);data.environment_status[6]=(uint8_t)audio.result.label;
        put(data.environment_status+7,audio.result.confidence_permille,2);data.environment_status[9]=0;
        if(bj_audio_runtime_window_complete() && audio.result.has_model && audio.result.label!=BJ_ENV_UNKNOWN) (void)bj_data_environment_event(&data,(uint8_t)audio.result.label,audio.result.confidence_permille,1);
        publish();vTaskDelay(pdMS_TO_TICKS(10));
    }
}
esp_err_t bj_data_runtime_start(const uint8_t id[6]) {
    if(worker) return ESP_OK;
    storage_ok=nvs_open("baji_v2",NVS_READWRITE,&storage)==ESP_OK;
    size_t n=sizeof(key);bool provisioned=storage_ok && nvs_get_blob(storage,"device_key",key,&n)==ESP_OK && n==32;
    bj_data_init(&data,id,provisioned,sign,save,NULL);data.hash=hash;data.environment_save=environment_save;data.update=update_object;
    bj_active_init(&active,active_save,NULL);data.active=&active;
    if(storage_ok){uint8_t bytes[BJ_ACTIVE_STORE_BYTES];size_t size=sizeof(bytes);esp_err_t result=nvs_get_blob(storage,"active",bytes,&size);if(result==ESP_OK){if(!bj_active_load(&active,bytes,size)){active.fault=true;storage_corrupt=true;storage_errors++;}}else if(result!=ESP_ERR_NVS_NOT_FOUND){active.fault=true;storage_corrupt=true;storage_errors++;}}
    if(bj_peer_crypto_load(&peer_state.auth,id)==ESP_OK)data.peer=&peer_state;
    (void)bj_update_runtime_init();bj_update_runtime_status(data.update_status);
    if(bj_audio_runtime_init(&audio)!=ESP_OK) return ESP_FAIL;
    if(storage_ok) {
        uint8_t environment[89];size_t environment_size=sizeof(environment);
        esp_err_t environment_error=nvs_get_blob(storage,"environment",environment,&environment_size);
        if(environment_error==ESP_OK) {if(!bj_data_environment_load(&data,environment,environment_size)) {storage_corrupt=true;storage_errors++;}}
        else if(environment_error!=ESP_ERR_NVS_NOT_FOUND) {storage_corrupt=true;storage_errors++;}
        size_t size=sizeof(data.store);esp_err_t err=nvs_get_blob(storage,"events",data.store,&size);
        if(err==ESP_OK) {if(!bj_data_load(&data,data.store,size)) {storage_corrupt=true;storage_errors++;}}
        else if(err!=ESP_ERR_NVS_NOT_FOUND) {storage_corrupt=true;storage_errors++;}
    }
    /* A corrupt durable ID stream never silently resets and reuses event ids. */
    views=xQueueCreate(1,sizeof(bj_data_view_t));inputs=xQueueCreate(16,sizeof(input_t));
    if(!views || !inputs) return ESP_ERR_NO_MEM;
    if(xTaskCreate(task,"baji_data",6144,NULL,2,&worker)!=pdPASS) return ESP_ERR_NO_MEM;
    return ESP_OK;
}
bool bj_data_runtime_view(bj_data_view_t *out) {return out && views && xQueuePeek(views,out,0)==pdTRUE;}
void bj_data_runtime_confirm(uint32_t generation,const uint8_t id[16]) {input_t in={.confirm=true,.epoch=generation};memcpy(in.id,id,16);if(inputs && xQueueSend(inputs,&in,0)!=pdTRUE) atomic_fetch_add(&input_drops,1);}
void bj_data_runtime_meet_confirm(uint32_t generation,const uint8_t id[16]) {
    if(!id) return;
    input_t in={.meet_confirm=true,.epoch=generation};memcpy(in.id,id,16);
    if(inputs && xQueueSend(inputs,&in,0)!=pdTRUE) atomic_fetch_add(&input_drops,1);
}
void bj_data_runtime_peer_input(uint32_t generation,int point) {
    input_t in={.peer_input=true,.epoch=generation,.b=(int16_t)point};
    if(inputs && xQueueSend(inputs,&in,0)!=pdTRUE)atomic_fetch_add(&input_drops,1);
}
void bj_data_runtime_care_visible(bool visible){atomic_store(&care_visible,visible);}
void bj_data_runtime_environment_stop(void) {atomic_store(&environment_stop_requested,true);}
void bj_data_runtime_event(uint8_t type,uint8_t a,int16_t b) {input_t in={.type=type,.a=a,.b=b,.epoch=bj_ble_data_generation()};if(inputs && xQueueSend(inputs,&in,0)!=pdTRUE) atomic_fetch_add(&input_drops,1);}
