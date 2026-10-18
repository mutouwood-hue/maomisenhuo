#include "badge.h"
#include "badge_wire.h"
#include <math.h>
#include <ctype.h>
#include <stdio.h>
#include <string.h>
#include "cJSON.h"
#include "esp_mac.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "nvs.h"

#define STATE_MAGIC 0x43415431u
typedef struct {
    uint32_t magic;
    badge_snapshot_t snapshot;
    uint64_t counter;
    uint32_t count;
    badge_event_t events[BADGE_QUEUE_CAPACITY];
} saved_t;
static saved_t saved, work;
static badge_view_t view;
static SemaphoreHandle_t lock;
static nvs_handle_t nvs;
static bool uuid(const char *s);
static bool saved_valid(size_t size)
{
    if(size!=sizeof(saved) || saved.magic!=STATE_MAGIC || saved.count>BADGE_QUEUE_CAPACITY ||
       saved.snapshot.pet_id[64]!='\0' || saved.counter>9007199254740991ULL) return false;
    badge_snapshot_t *s=&saved.snapshot;
    if((s->pet_id[0] && !uuid(s->pet_id)) || (!s->pet_id[0] && saved.count) ||
       s->food>100 || s->mood>100 || s->clean>100 || s->energy>100 || s->health>100 ||
       s->coins>9007199254740991ULL || s->revision>9007199254740991ULL || s->updated_at_ms>9007199254740991ULL) return false;
    uint64_t previous=0;
    for(unsigned i=0;i<saved.count;i++) {
        if(saved.events[i].counter<=previous || saved.events[i].counter>saved.counter || saved.events[i].timestamp_ms>9007199254740991ULL || saved.events[i].blocked>1) return false;
        previous=saved.events[i].counter;
    }
    return true;
}

static void take(void) { if (lock) xSemaphoreTake(lock, portMAX_DELAY); }
static void give(void) { if (lock) xSemaphoreGive(lock); }
static esp_err_t commit(void)
{
    esp_err_t err = nvs_set_blob(nvs, "state_v1", &work, sizeof(work));
    if (err == ESP_OK) err = nvs_commit(nvs);
    if (err == ESP_OK) { saved = work; view.storage_error = false; }
    else {
        view.storage_error = true;
        strlcpy(view.message, "保存失败，操作未完成；请连接手机", sizeof(view.message));
    }
    return err;
}

esp_err_t badge_state_init(void)
{
    lock = xSemaphoreCreateMutex();
    if (!lock) return ESP_ERR_NO_MEM;
    uint8_t mac[6];
    ESP_ERROR_CHECK(esp_read_mac(mac, ESP_MAC_BT));
    snprintf(view.device_id, sizeof(view.device_id), "badge-%02x%02x%02x%02x%02x%02x", mac[0],mac[1],mac[2],mac[3],mac[4],mac[5]);
    esp_err_t err = nvs_open("cat_forest", NVS_READWRITE, &nvs);
    if (err != ESP_OK) return err;
    size_t size = sizeof(saved);
    err = nvs_get_blob(nvs, "state_v1", &saved, &size);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        memset(&work, 0, sizeof(work)); work.magic = STATE_MAGIC;
        err = commit();
    } else if (err == ESP_OK && !saved_valid(size)) {
        err = ESP_ERR_INVALID_STATE;
    }
    if (err == ESP_OK) strlcpy(view.message, saved.snapshot.pet_id[0] ? "上次状态已恢复，等待手机连接" : "在手机中连接吧唧", sizeof(view.message));
    else {
        /* Quarantine corrupt bytes in flash; error UI must never read unsafe RAM. */
        memset(&saved,0,sizeof(saved)); memset(&work,0,sizeof(work));
        view.storage_error=true;
        strlcpy(view.message,"存档不可用，请保留设备并联系支持",sizeof(view.message));
    }
    return err;
}
void badge_get_view(badge_view_t *out)
{
    take(); view.snapshot = saved.snapshot; view.pending = saved.count;
    view.blocked=0; for(unsigned i=0;i<saved.count;i++) if(saved.events[i].blocked) view.blocked++;
    view.bound = saved.snapshot.pet_id[0] != '\0'; *out = view; give();
}
void badge_message(const char *message)
{ take(); strlcpy(view.message, message, sizeof(view.message)); give(); }
void badge_set_link(bool connected, bool secure, bool subscribed)
{
    take(); view.connected = connected; view.secure = secure; view.subscribed = subscribed;
    if (!connected || secure) view.pairing = false;
    if (!connected) strlcpy(view.message, saved.snapshot.pet_id[0] ? "已离线，摸摸会安全保存" : "在手机中连接吧唧", sizeof(view.message));
    else if (secure) strlcpy(view.message, "已安全连接，等待同步", sizeof(view.message));
    give();
}
void badge_show_passkey(uint32_t passkey)
{ take(); view.pairing = true; view.passkey = passkey; give(); }

esp_err_t badge_pet(void)
{
    take();
    if (!saved.snapshot.pet_id[0] || view.pairing || view.storage_error) { give(); return ESP_ERR_INVALID_STATE; }
    if (saved.count >= BADGE_QUEUE_CAPACITY || saved.counter >= 9007199254740990ULL) {
        strlcpy(view.message, "待同步已满，请连接手机后再摸摸", sizeof(view.message));
        give(); return ESP_ERR_NO_MEM;
    }
    work = saved; work.counter++;
    work.events[work.count++] = (badge_event_t) {
        .counter = work.counter,
        /* updatedAtMs is a state version timestamp, not a clock sync packet. */
        .timestamp_ms = 0,
    };
    esp_err_t err = commit();
    if (err == ESP_OK) strlcpy(view.message, "收到摸摸，等待手机确认", sizeof(view.message));
    give(); return err;
}
esp_err_t badge_retry_blocked(void)
{
    take(); work=saved; bool changed=false;
    for(unsigned i=0;i<work.count;i++) if(work.events[i].blocked) { work.events[i].blocked=false; changed=true; }
    if(!changed) { give(); return ESP_ERR_INVALID_STATE; }
    esp_err_t err=commit();
    if(err==ESP_OK) strlcpy(view.message,"原互动已重新排队，等待手机确认",sizeof(view.message));
    give(); return err;
}
static bool number(cJSON *j, const char *key, double max, uint64_t *out)
{
    cJSON *v = cJSON_GetObjectItemCaseSensitive(j, key);
    if (!cJSON_IsNumber(v) || !isfinite(v->valuedouble) || v->valuedouble < 0 ||
        v->valuedouble > max || floor(v->valuedouble) != v->valuedouble) return false;
    *out = (uint64_t)v->valuedouble; return true;
}
static const char *string(cJSON *j, const char *key)
{ cJSON *v = cJSON_GetObjectItemCaseSensitive(j, key); return cJSON_IsString(v) ? v->valuestring : NULL; }
static bool uuid(const char *s)
{
    if(!s || strlen(s)!=36) return false;
    for(int i=0;i<36;i++) {
        if(i==8 || i==13 || i==18 || i==23) { if(s[i]!='-') return false; }
        else if(!isxdigit((unsigned char)s[i])) return false;
    }
    return true;
}
static void status(const char *state, const char *reason)
{
    char buffer[400];
    cJSON *j = cJSON_CreateObject();
    cJSON_AddNumberToObject(j, "protocolVersion", 1); cJSON_AddStringToObject(j, "kind", "status");
    cJSON_AddStringToObject(j, "status", state); cJSON_AddStringToObject(j, "deviceId", view.device_id);
    cJSON_AddStringToObject(j, "petId", saved.snapshot.pet_id); cJSON_AddNumberToObject(j, "revision", saved.snapshot.revision);
    if (reason) cJSON_AddStringToObject(j, "reason", reason);
    if (cJSON_PrintPreallocated(j, buffer, sizeof(buffer), false)) badge_ble_status(buffer);
    cJSON_Delete(j);
}
void badge_protocol_error(const char *reason)
{ take(); status("error",reason); give(); }
void badge_receive_line(const char *line)
{
    if(!badge_wire_valid(line,strlen(line))) { badge_protocol_error("invalid_encoding"); return; }
    cJSON *j = cJSON_ParseWithOpts(line, NULL, true);
    if (!j) { badge_protocol_error("invalid_json"); return; }
    const char *kind = string(j, "kind"); uint64_t v;
    take();
    if (!number(j,"protocolVersion",1,&v) || v != 1 || !kind) { status("error", "protocol_version"); goto done; }
    if (!strcmp(kind,"snapshot")) {
        badge_snapshot_t s = {0}; const char *id = string(j,"petId");
        if (!uuid(id) || !number(j,"revision",9007199254740991.0,&s.revision) ||
            !number(j,"updatedAtMs",9007199254740991.0,&s.updated_at_ms)) { status("error","snapshot_fields"); goto done; }
        strlcpy(s.pet_id,id,sizeof(s.pet_id));
        const char *keys[] = {"food","mood","clean","energy","health"};
        uint8_t *values[] = {&s.food,&s.mood,&s.clean,&s.energy,&s.health};
        for (int i=0;i<5;i++) { if (!number(j,keys[i],100,&v)) { status("error","pet_range"); goto done; } *values[i]=v; }
        if (!number(j,"coins",9007199254740991.0,&v)) { status("error","coins_range"); goto done; } s.coins=v;
        if (saved.snapshot.pet_id[0] && strcmp(saved.snapshot.pet_id,s.pet_id)) { status("pet_mismatch",NULL); goto done; }
        if (saved.snapshot.pet_id[0] && s.revision < saved.snapshot.revision) { status("stale",NULL); goto done; }
        if (saved.snapshot.pet_id[0] && s.revision == saved.snapshot.revision &&
            (s.food!=saved.snapshot.food || s.mood!=saved.snapshot.mood || s.clean!=saved.snapshot.clean ||
             s.energy!=saved.snapshot.energy || s.health!=saved.snapshot.health || s.coins!=saved.snapshot.coins || s.updated_at_ms!=saved.snapshot.updated_at_ms)) {
            status("revision_conflict","same_revision_different_state"); goto done;
        }
        if (!saved.snapshot.pet_id[0] || s.revision!=saved.snapshot.revision) {
            work=saved; work.snapshot=s;
            if (commit()!=ESP_OK) { status("error","storage_error"); goto done; }
        }
        view.snapshots_received++;
        strlcpy(view.message,"状态已同步，轻点摸摸",sizeof(view.message)); status("synced",NULL);
    } else if (!strcmp(kind,"ack")) {
        const char *id=string(j,"eventId"), *ack=string(j,"status");
        if (!id || !ack || !number(j,"revision",9007199254740991.0,&v)) { status("error","ack_fields"); goto done; }
        if (strcmp(ack,"applied") && strcmp(ack,"duplicate") && strcmp(ack,"rejected")) { status("error","ack_status"); goto done; }
        for (unsigned i=0;i<saved.count;i++) {
            char expected[80]; snprintf(expected,sizeof(expected),"%s-%llu",view.device_id,(unsigned long long)saved.events[i].counter);
            if (!strcmp(expected,id)) {
                work=saved;
                if (!strcmp(ack,"rejected")) {
                    work.events[i].blocked=true;
                    if(commit()==ESP_OK) strlcpy(view.message,"互动被拒绝并保留，请检查手机",sizeof(view.message));
                    break;
                }
                memmove(&work.events[i],&work.events[i+1],(work.count-i-1)*sizeof(badge_event_t)); work.count--;
                if (commit()==ESP_OK) {
                    view.acknowledged_events++;
                    strlcpy(view.message,"摸摸已收到，等待最新状态",sizeof(view.message));
                }
                break;
            }
        }
    } else status("error","unknown_kind");
done: give(); cJSON_Delete(j);
}
bool badge_next_event(char *json, size_t capacity)
{
    take(); unsigned index=0;
    while(index<saved.count && saved.events[index].blocked) index++;
    bool found=index<saved.count;
    if (found) {
        snprintf(json,capacity,"{\"protocolVersion\":1,\"kind\":\"event\",\"deviceId\":\"%s\",\"petId\":\"%s\",\"eventId\":\"%s-%llu\",\"type\":\"pet\",\"timestampMs\":%llu}",
            view.device_id,saved.snapshot.pet_id,view.device_id,(unsigned long long)saved.events[index].counter,(unsigned long long)saved.events[index].timestamp_ms);
    }
    give(); return found;
}
