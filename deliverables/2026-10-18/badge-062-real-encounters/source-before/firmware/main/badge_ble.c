#include "badge.h"
#include <stdio.h>
#include <string.h>
#include "esp_log.h"
#include "esp_random.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "host/ble_hs.h"
#include "host/ble_gap.h"
#include "host/ble_gatt.h"
#include "host/ble_store.h"
#include "host/util/util.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_npl.h"
#include "nimble/nimble_port_freertos.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"
#include "store/config/ble_store_config.h"

/* ESP-IDF v5.5.5 bleprph declares this sysinit entry explicitly: the pinned
 * NimBLE implementation exports it, but ble_store_config.h omits its prototype.
 * It installs persistent read/write/delete callbacks and reloads NVS bonds. */
void ble_store_config_init(void);

/* UUID byte order is little endian in NimBLE. */
static const ble_uuid128_t svc_uuid=BLE_UUID128_INIT(0x31,0x54,0x41,0x43,0x4d,0x4f,0x45,0x9c,0x8f,0x4d,0x6d,0x6a,0x00,0x10,0x2e,0x7b);
static const ble_uuid128_t rx_uuid=BLE_UUID128_INIT(0x31,0x54,0x41,0x43,0x4d,0x4f,0x45,0x9c,0x8f,0x4d,0x6d,0x6a,0x01,0x10,0x2e,0x7b);
static const ble_uuid128_t tx_uuid=BLE_UUID128_INIT(0x31,0x54,0x41,0x43,0x4d,0x4f,0x45,0x9c,0x8f,0x4d,0x6d,0x6a,0x02,0x10,0x2e,0x7b);
static uint16_t tx_handle;
static volatile uint16_t connection=BLE_HS_CONN_HANDLE_NONE;
static volatile bool subscribed, authenticated;
static volatile uint32_t link_generation;
static uint8_t address_type;
static char rx[BADGE_FRAME_MAX+1];
static size_t rx_length;
static bool discarding;
static bool ble_ready, bonds_reset;
static struct ble_npl_event reset_bonds_event;
static QueueHandle_t statuses;
typedef struct { char text[512]; } status_frame_t;

void badge_ble_status(const char *json)
{
    if (!statuses) return;
    status_frame_t f={0}; strlcpy(f.text,json,sizeof(f.text));
    /* A full queue is explicit; event retry and snapshot retry remain durable. */
    if (xQueueSend(statuses,&f,0)!=pdTRUE) ESP_LOGW("ble","Status queue full; client must retry command");
}
static int access_cb(uint16_t conn,uint16_t attr,struct ble_gatt_access_ctxt *ctxt,void *arg)
{
    (void)conn; (void)attr; (void)arg;
    if (!authenticated) return BLE_ATT_ERR_INSUFFICIENT_AUTHEN;
    if (ctxt->op==BLE_GATT_ACCESS_OP_READ_CHR) {
        badge_view_t v; badge_get_view(&v); char out[260];
        int n=snprintf(out,sizeof(out),"{\"protocolVersion\":1,\"kind\":\"status\",\"status\":\"%s\",\"deviceId\":\"%s\",\"petId\":\"%s\",\"revision\":%llu,\"reason\":\"%s\"}\n",v.bound ? "synced" : "error",v.device_id,v.snapshot.pet_id,(unsigned long long)v.snapshot.revision,v.bound ? "cached_snapshot" : "unbound");
        return os_mbuf_append(ctxt->om,out,n)==0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
    }
    if (ctxt->op!=BLE_GATT_ACCESS_OP_WRITE_CHR) return BLE_ATT_ERR_UNLIKELY;
    uint16_t length=OS_MBUF_PKTLEN(ctxt->om);
    if (length>512) return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    char bytes[512];
    if (os_mbuf_copydata(ctxt->om,0,length,bytes)!=0) return BLE_ATT_ERR_UNLIKELY;
    for (unsigned i=0;i<length;i++) {
        unsigned char b=bytes[i];
        if (b=='\n') {
            if (!discarding && rx_length) { rx[rx_length]='\0'; badge_receive_line(rx); }
            rx_length=0; discarding=false;
        } else if (b==0 || rx_length>=BADGE_FRAME_MAX-1) {
            rx_length=0; discarding=true;
            badge_protocol_error("frame_too_large_or_nul");
        } else if (!discarding) rx[rx_length++]=(char)b;
    }
    return 0;
}
static const struct ble_gatt_svc_def services[]={
    {.type=BLE_GATT_SVC_TYPE_PRIMARY,.uuid=&svc_uuid.u,.characteristics=(struct ble_gatt_chr_def[]){
        {.uuid=&rx_uuid.u,.access_cb=access_cb,.flags=BLE_GATT_CHR_F_WRITE | BLE_GATT_CHR_F_WRITE_ENC | BLE_GATT_CHR_F_WRITE_AUTHEN},
        {.uuid=&tx_uuid.u,.access_cb=access_cb,.val_handle=&tx_handle,.flags=BLE_GATT_CHR_F_READ | BLE_GATT_CHR_F_NOTIFY | BLE_GATT_CHR_F_READ_ENC | BLE_GATT_CHR_F_READ_AUTHEN},
        {0}}}, {0}
};
static void advertise(void);
static void reset_bonds_cb(struct ble_npl_event *event)
{
    (void)event;
    ble_addr_t peers[3]; int count=0;
    int rc=ble_store_util_bonded_peers(peers,&count,3);
    for(int i=0;rc==0 && i<count;i++) rc=ble_store_util_delete_peer(&peers[i]);
    if(rc!=0) { badge_message("配对清除失败，请保留设备并重试"); return; }
    /* Only NimBLE security/CCCD records; never erase application NVS. */
    authenticated=false; subscribed=false; bonds_reset=true;
    badge_message("配对已清除，请在手机忘记旧记录后重连");
    if(connection!=BLE_HS_CONN_HANDLE_NONE) ble_gap_terminate(connection,BLE_ERR_REM_USER_CONN_TERM);
}
bool badge_ble_clear_bonds(void)
{
    if(!ble_ready) { badge_message("蓝牙尚未就绪，请稍后重试"); return false; }
    ble_npl_eventq_put(nimble_port_get_dflt_eventq(),&reset_bonds_event);
    return true;
}
static int gap_cb(struct ble_gap_event *event,void *arg)
{
    (void)arg;
    switch(event->type) {
    case BLE_GAP_EVENT_CONNECT:
        if(event->connect.status!=0) { advertise(); break; }
        link_generation++; connection=event->connect.conn_handle; authenticated=false; subscribed=false; rx_length=0; discarding=false;
        badge_set_link(true,false,false);
        if(ble_gap_security_initiate(connection)!=0) { badge_message("无法开始安全配对，请重试"); ble_gap_terminate(connection,BLE_ERR_REM_USER_CONN_TERM); }
        break;
    case BLE_GAP_EVENT_DISCONNECT:
        link_generation++; connection=BLE_HS_CONN_HANDLE_NONE; authenticated=false; subscribed=false; rx_length=0; discarding=false;
        xQueueReset(statuses); badge_set_link(false,false,false);
        if(bonds_reset) { bonds_reset=false; badge_message("配对已清除，请在手机忘记旧记录后重连"); }
        advertise(); break;
    case BLE_GAP_EVENT_ENC_CHANGE: {
        struct ble_gap_conn_desc desc;
        if(event->enc_change.status==0 && ble_gap_conn_find(event->enc_change.conn_handle,&desc)==0 && desc.sec_state.encrypted && desc.sec_state.authenticated && desc.sec_state.key_size==16) {
            authenticated=true; badge_set_link(true,true,subscribed);
        } else { badge_message("安全配对失败，请在手机重试"); ble_gap_terminate(connection,BLE_ERR_AUTH_FAIL); }
        break;
    }
    case BLE_GAP_EVENT_SUBSCRIBE:
        if(event->subscribe.attr_handle==tx_handle) { subscribed=event->subscribe.cur_notify; badge_set_link(true,authenticated,subscribed); }
        break;
    case BLE_GAP_EVENT_PASSKEY_ACTION: {
        if(event->passkey.params.action!=BLE_SM_IOACT_DISP) return BLE_HS_ENOTSUP;
        struct ble_sm_io io={.action=BLE_SM_IOACT_DISP,.passkey=esp_random()%1000000};
        badge_show_passkey(io.passkey);
        return ble_sm_inject_io(event->passkey.conn_handle,&io);
    }
    case BLE_GAP_EVENT_REPEAT_PAIRING:
        /* Never silently delete an existing bond to accept a replacement. */
        badge_message("已有旧配对记录，请点上方管理配对");
        return BLE_GAP_REPEAT_PAIRING_IGNORE;
    case BLE_GAP_EVENT_ADV_COMPLETE: advertise(); break;
    default: break;
    }
    return 0;
}
static void advertise(void)
{
    struct ble_hs_adv_fields fields={0}, response={0};
    fields.flags=BLE_HS_ADV_F_DISC_GEN|BLE_HS_ADV_F_BREDR_UNSUP;
    fields.uuids128=(ble_uuid128_t *)&svc_uuid; fields.num_uuids128=1; fields.uuids128_is_complete=1;
    const char *name=ble_svc_gap_device_name();
    response.name=(uint8_t *)name; response.name_len=strlen(name); response.name_is_complete=1;
    int rc=ble_gap_adv_set_fields(&fields);
    if(rc==0) rc=ble_gap_adv_rsp_set_fields(&response);
    struct ble_gap_adv_params p={.conn_mode=BLE_GAP_CONN_MODE_UND,.disc_mode=BLE_GAP_DISC_MODE_GEN};
    if(rc==0) rc=ble_gap_adv_start(address_type,NULL,BLE_HS_FOREVER,&p,gap_cb,NULL);
    if(rc!=0) { ESP_LOGE("ble","advertise failed %d",rc); badge_message("蓝牙广播失败，请重启设备"); }
}
static void sync_cb(void)
{ if(ble_hs_id_infer_auto(0,&address_type)==0) advertise(); else badge_message("蓝牙地址初始化失败"); }
static void reset_cb(int reason)
{ link_generation++; connection=BLE_HS_CONN_HANDLE_NONE; authenticated=false; subscribed=false; badge_set_link(false,false,false); ESP_LOGE("ble","Host reset %d",reason); }
static void host_task(void *arg)
{ (void)arg; nimble_port_run(); nimble_port_freertos_deinit(); }
static bool notify_line(const char *line)
{
    char frame[600]; int n=snprintf(frame,sizeof(frame),"%s\n",line);
    if(n<=0 || n>=(int)sizeof(frame)) return false;
    uint16_t handle=connection;
    uint32_t generation=link_generation;
    for(int offset=0;offset<n;) {
        if(generation!=link_generation || handle!=connection) return false;
        if(!authenticated || !subscribed) {
            if(offset>0) ble_gap_terminate(handle,BLE_ERR_REM_USER_CONN_TERM);
            return false;
        }
        unsigned mtu=ble_att_mtu(handle), count=(unsigned)(n-offset);
        if(mtu<23) {
            if(offset>0) ble_gap_terminate(handle,BLE_ERR_REM_USER_CONN_TERM);
            return false;
        }
        if(count>mtu-3) count=mtu-3;
        struct os_mbuf *om=ble_hs_mbuf_from_flat(frame+offset,count);
        if(!om) {
            if(offset>0) ble_gap_terminate(handle,BLE_ERR_REM_USER_CONN_TERM);
            return false;
        }
        int rc=ble_gatts_notify_custom(handle,tx_handle,om);
        if(rc!=0) {
            /* Terminate after a partial frame: don't concatenate a retry into it. */
            if(offset>0) ble_gap_terminate(handle,BLE_ERR_REM_USER_CONN_TERM);
            return false;
        }
        offset+=count; vTaskDelay(pdMS_TO_TICKS(15));
    }
    return true;
}
static void transmit_task(void *arg)
{
    (void)arg; TickType_t last=0; status_frame_t status; char event[512];
    for(;;) {
        if(authenticated && subscribed && connection!=BLE_HS_CONN_HANDLE_NONE) {
            if(xQueueReceive(statuses,&status,0)==pdTRUE) notify_line(status.text);
            if((xTaskGetTickCount()-last)>=pdMS_TO_TICKS(2000)) {
                if(badge_next_event(event,sizeof(event))) notify_line(event);
                last=xTaskGetTickCount();
            }
        }
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}
void badge_ble_start(void)
{
    statuses=xQueueCreate(8,sizeof(status_frame_t)); ESP_ERROR_CHECK(statuses ? ESP_OK : ESP_ERR_NO_MEM);
    ESP_ERROR_CHECK(nimble_port_init());
    ble_hs_cfg.reset_cb=reset_cb; ble_hs_cfg.sync_cb=sync_cb;
    ble_hs_cfg.sm_io_cap=BLE_HS_IO_DISPLAY_ONLY; ble_hs_cfg.sm_bonding=1; ble_hs_cfg.sm_mitm=1; ble_hs_cfg.sm_sc=1;
    ble_hs_cfg.sm_our_key_dist=BLE_SM_PAIR_KEY_DIST_ENC|BLE_SM_PAIR_KEY_DIST_ID;
    ble_hs_cfg.sm_their_key_dist=BLE_SM_PAIR_KEY_DIST_ENC|BLE_SM_PAIR_KEY_DIST_ID;
    ble_svc_gap_init(); ble_svc_gatt_init();
    badge_view_t v; badge_get_view(&v); char name[24]; snprintf(name,sizeof(name),"CatForest-%.4s",v.device_id+14);
    ESP_ERROR_CHECK(ble_svc_gap_device_name_set(name));
    ESP_ERROR_CHECK(ble_gatts_count_cfg(services)); ESP_ERROR_CHECK(ble_gatts_add_svcs(services));
    ble_store_config_init();
    ble_npl_event_init(&reset_bonds_event,reset_bonds_cb,NULL);
    ble_ready=true;
    nimble_port_freertos_init(host_task);
    ESP_ERROR_CHECK(xTaskCreate(transmit_task,"badge_tx",6144,NULL,4,NULL)==pdPASS ? ESP_OK : ESP_ERR_NO_MEM);
}
