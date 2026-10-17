#include "baji_ble.h"
#include "baji_peer_ble.h"
#include <string.h>
#include <stdatomic.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nimble/nimble_port.h"
#include "host/ble_hs.h"
#include "host/util/util.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"

#define QUEUE_CAP 8
static const ble_uuid128_t service_uuid=BLE_UUID128_INIT(0x00,0x7a,0x6f,0x5e,0x8c,0x3b,0x2f,0x9d,0x7e,0x4a,0x9b,0x1c,0x00,0xa0,0xf1,0xe7);
static const ble_uuid128_t rx_uuid=BLE_UUID128_INIT(0x01,0x7a,0x6f,0x5e,0x8c,0x3b,0x2f,0x9d,0x7e,0x4a,0x9b,0x1c,0x00,0xa0,0xf1,0xe7);
static const ble_uuid128_t tx_uuid=BLE_UUID128_INIT(0x02,0x7a,0x6f,0x5e,0x8c,0x3b,0x2f,0x9d,0x7e,0x4a,0x9b,0x1c,0x00,0xa0,0xf1,0xe7);
typedef struct { uint32_t generation; uint8_t bytes[20]; } message_t;
typedef struct { message_t items[QUEUE_CAP]; unsigned head,count; } ring_t;
static ring_t rx,tx;
static portMUX_TYPE guard=portMUX_INITIALIZER_UNLOCKED;
static atomic_bool attempted;
static atomic_int start_result=ESP_ERR_INVALID_STATE;
static uint16_t connection=BLE_HS_CONN_HANDLE_NONE,tx_handle;
static uint32_t generation;
static bool subscribed,synced,state_pending,has_state;
static uint8_t own_address,state_wire[20],ack_burst;
static struct ble_npl_callout service_timer;
static int gap_event(struct ble_gap_event *event,void *arg);
static void invalidate(void) {
    /* Caller owns guard; queues cannot escape into a later connection. */
    generation++;connection=BLE_HS_CONN_HANDLE_NONE;subscribed=false;
    rx.head=rx.count=tx.head=tx.count=0;ack_burst=0;state_pending=false;has_state=false;
}
static bool push(ring_t *r,const message_t *m) {
    if(r->count==QUEUE_CAP) return false;
    r->items[(r->head+r->count)%QUEUE_CAP]=*m;r->count++;return true;
}
static bool pop(ring_t *r,message_t *m) {
    if(!r->count) return false;
    *m=r->items[r->head];r->head=(r->head+1)%QUEUE_CAP;r->count--;return true;
}
static int access_characteristic(uint16_t conn,uint16_t attr,struct ble_gatt_access_ctxt *ctx,void *arg) {
    (void)attr;(void)arg;
    if(ctx->op==BLE_GATT_ACCESS_OP_READ_CHR) {
        uint8_t bytes[20];bool valid;
        portENTER_CRITICAL(&guard);valid=conn==connection && has_state;
        memcpy(bytes,state_wire,20);portEXIT_CRITICAL(&guard);
        if(!valid) return BLE_ATT_ERR_UNLIKELY;
        return os_mbuf_append(ctx->om,bytes,20)==0?0:BLE_ATT_ERR_INSUFFICIENT_RES;
    }
    if(ctx->op!=BLE_GATT_ACCESS_OP_WRITE_CHR) return BLE_ATT_ERR_WRITE_NOT_PERMITTED;
    if(OS_MBUF_PKTLEN(ctx->om)!=20) return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    message_t m;uint16_t length=0;
    if(ble_hs_mbuf_to_flat(ctx->om,m.bytes,20,&length)!=0 || length!=20) return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    bj_packet_t packet;
    if(!bj_packet_decode(m.bytes,20,&packet)) return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    portENTER_CRITICAL(&guard);
    int result=BLE_ATT_ERR_UNLIKELY;
    if(conn==connection && subscribed) {m.generation=generation;result=push(&rx,&m)?0:BLE_ATT_ERR_INSUFFICIENT_RES;}
    portEXIT_CRITICAL(&guard);return result;
}
static const struct ble_gatt_svc_def services[]={
    {.type=BLE_GATT_SVC_TYPE_PRIMARY,.uuid=&service_uuid.u,.characteristics=(struct ble_gatt_chr_def[]){
        {.uuid=&rx_uuid.u,.access_cb=access_characteristic,.flags=BLE_GATT_CHR_F_WRITE},
        {.uuid=&tx_uuid.u,.access_cb=access_characteristic,.flags=BLE_GATT_CHR_F_READ|BLE_GATT_CHR_F_NOTIFY,.val_handle=&tx_handle},
        {0}}}, {0}};
static void advertise(void) {
    static uint8_t last_token[8];static bool last_peer;
    uint8_t token[10]={0xff,0xff};bool peer_active=bj_peer_ble_advertisement(token+2);
    if(ble_gap_adv_active() && (peer_active!=last_peer || (peer_active && memcmp(last_token,token+2,8))))(void)ble_gap_adv_stop();
    if(!synced || (connection!=BLE_HS_CONN_HANDLE_NONE && !peer_active) || ble_gap_adv_active()) return;
    struct ble_hs_adv_fields fields={0};fields.flags=BLE_HS_ADV_F_DISC_GEN|BLE_HS_ADV_F_BREDR_UNSUP;
    if(peer_active){fields.mfg_data=token;fields.mfg_data_len=sizeof(token);}
    else {fields.uuids128=(ble_uuid128_t *)&service_uuid;fields.num_uuids128=1;fields.uuids128_is_complete=1;}
    if(ble_gap_adv_set_fields(&fields)!=0) return;
    last_peer=peer_active;memcpy(last_token,token+2,8);
    struct ble_hs_adv_fields response={0};const char *name="Baji-V2";
    response.name=(uint8_t *)name;response.name_len=strlen(name);response.name_is_complete=1;
    if(peer_active){response.uuids128=(ble_uuid128_t *)&service_uuid;response.num_uuids128=1;response.uuids128_is_complete=1;}
    if(ble_gap_adv_rsp_set_fields(&response)!=0) return;
    struct ble_gap_adv_params params={0};params.conn_mode=BLE_GAP_CONN_MODE_UND;params.disc_mode=BLE_GAP_DISC_MODE_GEN;
    (void)ble_gap_adv_start(own_address,NULL,BLE_HS_FOREVER,&params,gap_event,NULL);
}
static int gap_event(struct ble_gap_event *event,void *arg) {
    (void)arg;
    if(bj_peer_ble_gap_event(event))return 0;
    switch(event->type) {
    case BLE_GAP_EVENT_CONNECT:
        if(event->connect.status==0) {
            bool extra;
            portENTER_CRITICAL(&guard);extra=connection!=BLE_HS_CONN_HANDLE_NONE;
            if(!extra) {invalidate();connection=event->connect.conn_handle;}
            portEXIT_CRITICAL(&guard);
            if(extra) (void)ble_gap_terminate(event->connect.conn_handle,BLE_ERR_REM_USER_CONN_TERM);
        } else advertise();
        break;
    case BLE_GAP_EVENT_DISCONNECT:
        portENTER_CRITICAL(&guard);
        if(event->disconnect.conn.conn_handle==connection) invalidate();
        portEXIT_CRITICAL(&guard);advertise();break;
    case BLE_GAP_EVENT_SUBSCRIBE:
        portENTER_CRITICAL(&guard);
        if(event->subscribe.conn_handle==connection && event->subscribe.attr_handle==tx_handle) {
            subscribed=event->subscribe.cur_notify!=0;generation++;
            rx.head=rx.count=tx.head=tx.count=0;ack_burst=0;state_pending=has_state;
        }
        portEXIT_CRITICAL(&guard);break;
    case BLE_GAP_EVENT_ADV_COMPLETE: advertise();break;
    default: break;
    }
    return 0;
}
static void on_sync(void) {
    if(ble_hs_util_ensure_addr(0)!=0 || ble_hs_id_infer_auto(0,&own_address)!=0) return;
    synced=true;advertise();
}
static void on_reset(int reason) {
    (void)reason;synced=false;portENTER_CRITICAL(&guard);invalidate();portEXIT_CRITICAL(&guard);
}
static void service_tick(struct ble_npl_event *event) {
    (void)event;message_t m;bool send=false,is_ack=false;uint16_t conn;
    portENTER_CRITICAL(&guard);conn=connection;
    if(subscribed && conn!=BLE_HS_CONN_HANDLE_NONE) {
        is_ack=tx.count!=0 && !(state_pending && has_state && ack_burst>=2);
        if(is_ack) {m=tx.items[tx.head];send=true;}
        else if(state_pending && has_state) {m.generation=generation;memcpy(m.bytes,state_wire,20);send=true;}
        if(send && m.generation!=generation) send=false;
    }
    portEXIT_CRITICAL(&guard);
    /* Keep unsent frames on allocation/backpressure failure; never repeat dispatch. */
    if(send) {
        struct os_mbuf *buffer=ble_hs_mbuf_from_flat(m.bytes,20);
        if(buffer && ble_gatts_notify_custom(conn,tx_handle,buffer)==0) {
            portENTER_CRITICAL(&guard);
            if(subscribed && connection==conn && generation==m.generation) {
                if(is_ack) {message_t sent;(void)pop(&tx,&sent);if(ack_burst<2) ack_burst++;}
                else {ack_burst=0;if(memcmp(m.bytes,state_wire,20)==0) state_pending=false;}
            }
            portEXIT_CRITICAL(&guard);
        }
    }
    bj_peer_ble_poll();
    advertise();
    (void)ble_npl_callout_reset(&service_timer,ble_npl_time_ms_to_ticks32(10));
}
static void host_task(void *arg) {
    (void)arg;nimble_port_run();vTaskDelete(NULL);
}
esp_err_t bj_ble_start(void) {
    /* Serial app_main startup; never retry init or restart host after a partial failure. */
    if(atomic_exchange(&attempted,true)) return start_result;
    if(nimble_port_init()!=ESP_OK) return start_result=ESP_FAIL;
    ble_hs_cfg.sync_cb=on_sync;ble_hs_cfg.reset_cb=on_reset;
    ble_svc_gap_init();ble_svc_gatt_init();
    if(ble_svc_gap_device_name_set("Baji-V2")!=0 || ble_att_set_preferred_mtu(23)!=0 ||
       ble_gatts_count_cfg(services)!=0 || ble_gatts_add_svcs(services)!=0 || bj_peer_ble_register()!=ESP_OK) {
        (void)nimble_port_deinit();return start_result=ESP_FAIL;
    }
    if(ble_npl_callout_init(&service_timer,nimble_port_get_dflt_eventq(),service_tick,NULL)!=0) {
        (void)nimble_port_deinit();return start_result=ESP_ERR_NO_MEM;
    }
    if(ble_npl_callout_reset(&service_timer,ble_npl_time_ms_to_ticks32(10))!=0) {
        ble_npl_callout_deinit(&service_timer);
        (void)nimble_port_deinit();return start_result=ESP_FAIL;
    }
    TaskHandle_t task=NULL;
    if(xTaskCreatePinnedToCore(host_task,"baji_ble_host",NIMBLE_HS_STACK_SIZE,NULL,
                              configMAX_PRIORITIES-4,&task,NIMBLE_CORE)!=pdPASS) {
        ble_npl_callout_stop(&service_timer);ble_npl_callout_deinit(&service_timer);
        (void)nimble_port_deinit();return start_result=ESP_ERR_NO_MEM;
    }
    return start_result=ESP_OK;
}
void bj_ble_pump(bj_link_t *link,bj_controller_t *controller,const bj_power_view_t *power) {
    if(!link || !controller || start_result!=ESP_OK) return;
    portENTER_CRITICAL(&guard);
    /* Fixed bounded pure-C dispatch under guard prevents disconnect crossing a mutation.
       No host, LVGL, storage, I2C or allocation is called while this guard is held. */
    for(unsigned i=0;i<2 && tx.count<QUEUE_CAP;i++) {
        message_t request,response;
        if(rx.count && rx.items[rx.head].bytes[3]>=6) break;
        if(!pop(&rx,&request)) break;
        if(!subscribed || request.generation!=generation) continue;
        response.generation=generation;
        if(bj_link_dispatch(link,controller,power,request.bytes,20,response.bytes)) (void)push(&tx,&response);
    }
    uint8_t state[10];
    if(bj_link_state(link,controller,power,state)) {
        bj_packet_t packet={.opcode=0x81,.length=10};uint8_t bytes[20];memcpy(packet.payload,state,10);
        if(bj_packet_encode(&packet,bytes) && (!has_state || memcmp(bytes,state_wire,20)!=0)) {
            memcpy(state_wire,bytes,20);has_state=true;state_pending=true;
        }
    }
    portEXIT_CRITICAL(&guard);
}
bool bj_ble_data_current(uint32_t epoch) {
    portENTER_CRITICAL(&guard);
    bool valid=start_result==ESP_OK && subscribed && connection!=BLE_HS_CONN_HANDLE_NONE && generation==epoch;
    portEXIT_CRITICAL(&guard);return valid;
}
uint32_t bj_ble_data_generation(void) {
    portENTER_CRITICAL(&guard);uint32_t value=generation;portEXIT_CRITICAL(&guard);return value;
}
bool bj_ble_data_take(uint8_t request[20],uint32_t *epoch) {
    if(!request || !epoch) return false;
    portENTER_CRITICAL(&guard);message_t m;bool taken=false;
    if(start_result==ESP_OK && subscribed && tx.count<QUEUE_CAP && rx.count && rx.items[rx.head].bytes[3]>=6) {
        if(pop(&rx,&m) && m.generation==generation) {memcpy(request,m.bytes,20);*epoch=generation;taken=true;}
    }
    portEXIT_CRITICAL(&guard);return taken;
}
bool bj_ble_data_reply(const uint8_t response[20],uint32_t epoch) {
    if(!response) return false;
    message_t m={.generation=epoch};memcpy(m.bytes,response,20);
    portENTER_CRITICAL(&guard);
    bool accepted=subscribed && connection!=BLE_HS_CONN_HANDLE_NONE && generation==epoch && push(&tx,&m);
    portEXIT_CRITICAL(&guard);return accepted;
}
