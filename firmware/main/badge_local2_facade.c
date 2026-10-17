#include "badge.h"
#include "local2_store.h"
#include "local2_wire.h"
#include "freertos/FreeRTOS.h"
#include "esp_timer.h"
#include <stdio.h>
#include <string.h>
static portMUX_TYPE guard=portMUX_INITIALIZER_UNLOCKED;
static bool linked,subscribed,clock_valid;
static uint64_t clock_epoch,clock_mono;
static int clock_offset;
static char message[120];
void local2_ble_link_state(bool connected,bool receive_ready){
    portENTER_CRITICAL(&guard);linked=connected;subscribed=receive_ready;portEXIT_CRITICAL(&guard);
}
void badge_get_view(badge_view_t *out){
    memset(out,0,sizeof(*out));l2_view_t v;local2_get_view(&v);
    out->bound=v.has_snapshot;out->storage_error=v.storage_error||!v.ready;out->pending=v.pending_events;
    snprintf(out->device_id,sizeof(out->device_id),"%.31s",v.device_id);
    if(v.has_snapshot){
        snprintf(out->snapshot.pet_id,sizeof(out->snapshot.pet_id),"%s",v.snapshot.pet.pet_id);
        out->snapshot.revision=v.snapshot.revision;out->snapshot.coins=v.snapshot.pet.coins;
        out->snapshot.food=v.snapshot.pet.food;out->snapshot.mood=v.snapshot.pet.mood;out->snapshot.clean=v.snapshot.pet.clean;out->snapshot.energy=v.snapshot.pet.energy;out->snapshot.health=v.snapshot.pet.health;
    }
    portENTER_CRITICAL(&guard);out->connected=linked;out->subscribed=subscribed;snprintf(out->message,sizeof(out->message),"%s",message);portEXIT_CRITICAL(&guard);
    /* This local channel is not the old authenticated/cloud session. */
    out->secure=false;
}
void badge_message(const char *value){portENTER_CRITICAL(&guard);snprintf(message,sizeof(message),"%s",value?value:"");portEXIT_CRITICAL(&guard);}
void badge_set_link(bool connected,bool secure,bool receive_ready){(void)secure;local2_ble_link_state(connected,receive_ready);}
void badge_show_passkey(uint32_t passkey){(void)passkey;}
bool badge_ble_clear_bonds(void){badge_message("本地协议保留旧配对记录");return false;}
esp_err_t badge_pet(void){return local2_emit_care(L2_ACTION_PET,0)<=L2_DUPLICATE?ESP_OK:ESP_FAIL;}
esp_err_t badge_retry_blocked(void){return ESP_ERR_NOT_SUPPORTED;}
void local2_clock_calibrate(uint64_t epoch_ms,int utc_offset_minutes){
    if(utc_offset_minutes < -840 || utc_offset_minutes > 840)return;
    if(epoch_ms<UINT64_C(1577836800000)||epoch_ms>UINT64_C(4102444800000))return;
    uint64_t now=(uint64_t)esp_timer_get_time()/1000;
    portENTER_CRITICAL(&guard);clock_epoch=epoch_ms;clock_mono=now;clock_offset=utc_offset_minutes;clock_valid=true;portEXIT_CRITICAL(&guard);
}
bool local2_clock_now(uint64_t *out_ms){
    if(!out_ms)return false;
    uint64_t now=(uint64_t)esp_timer_get_time()/1000;
    portENTER_CRITICAL(&guard);bool valid=clock_valid;if(valid)*out_ms=clock_epoch+now-clock_mono;portEXIT_CRITICAL(&guard);return valid;
}

int local2_clock_utc_offset_minutes(void){portENTER_CRITICAL(&guard);int value=clock_offset;portEXIT_CRITICAL(&guard);return value;}
