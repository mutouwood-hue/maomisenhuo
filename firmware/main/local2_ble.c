#include "local2_ble.h"
#include "local2_store.h"
#include "local2_wire.h"
#include "local2_peer.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_heap_caps.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "host/ble_hs.h"
#include "host/ble_gap.h"
#include "host/ble_gatt.h"
#include "host/util/util.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"
#include <string.h>

#define L2_LINE_MAX 2048u
#define QMAX 4u
static const ble_uuid128_t svc=BLE_UUID128_INIT(0x32,0x43,0x4f,0x4c,0x46,0x43,0xe5,0x9c,0x73,0x4b,0x4d,0x8f,0x00,0x20,0x3d,0x6f);
static const ble_uuid128_t rx_uuid=BLE_UUID128_INIT(0x32,0x43,0x4f,0x4c,0x46,0x43,0xe5,0x9c,0x73,0x4b,0x4d,0x8f,0x01,0x20,0x3d,0x6f);
static const ble_uuid128_t tx_uuid=BLE_UUID128_INIT(0x32,0x43,0x4f,0x4c,0x46,0x43,0xe5,0x9c,0x73,0x4b,0x4d,0x8f,0x02,0x20,0x3d,0x6f);
typedef struct {uint32_t generation;uint16_t length;char line[L2_LINE_MAX];} line_t;
static portMUX_TYPE guard=portMUX_INITIALIZER_UNLOCKED;
static QueueHandle_t incoming,outgoing;
/* Payload copies are used by tasks, never an ISR or a DMA peripheral. Keep
 * queue control blocks internal; reserve scarce internal RAM for task stacks
 * and the radio controller rather than sixteen KiB of NDJSON storage. */
static StaticQueue_t incoming_control,outgoing_control;
static uint8_t *incoming_payload,*outgoing_payload;
static uint16_t phone=BLE_HS_CONN_HANDLE_NONE,tx_handle;
static uint32_t generation,advert_generation;
static uint8_t own_address;
static bool subscribed,synced,started,discarding;
static char partial[L2_LINE_MAX];static unsigned partial_length;
static line_t rx_work,tx_work;static unsigned tx_offset;
static struct ble_npl_callout timer;
static void advertise(void);
static void advance_generation(void){
    generation++;if(!generation)generation=1;
    local2_wire_reset_session(generation);
}
static void invalidate(void){
    advance_generation();phone=BLE_HS_CONN_HANDLE_NONE;subscribed=false;partial_length=0;discarding=false;
    if(incoming)xQueueReset(incoming);
    if(outgoing)xQueueReset(outgoing);
    tx_offset=0;tx_work.length=0;
}
static int access_characteristic(uint16_t conn,uint16_t attr,struct ble_gatt_access_ctxt *ctx,void *arg){
    (void)attr;(void)arg;
    if(ctx->op==BLE_GATT_ACCESS_OP_READ_CHR){static const char hint[]="CFLOCAL2\n";return os_mbuf_append(ctx->om,hint,sizeof(hint)-1)==0?0:BLE_ATT_ERR_INSUFFICIENT_RES;}
    if(ctx->op!=BLE_GATT_ACCESS_OP_WRITE_CHR)return BLE_ATT_ERR_WRITE_NOT_PERMITTED;
    uint8_t bytes[20];uint16_t n=0;if(!OS_MBUF_PKTLEN(ctx->om)||OS_MBUF_PKTLEN(ctx->om)>20||ble_hs_mbuf_to_flat(ctx->om,bytes,20,&n)!=0)return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    /* NimBLE owns this assembler. Queue copies whole lines; NVS never runs here. */
    if(conn!=phone||!subscribed)return BLE_ATT_ERR_UNLIKELY;
    for(unsigned i=0;i<n;i++){
        if(bytes[i]=='\n'){
            if(discarding||!partial_length){partial_length=0;discarding=false;return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;}
            line_t frame={.generation=generation,.length=(uint16_t)partial_length};memcpy(frame.line,partial,partial_length);frame.line[partial_length]='\0';partial_length=0;
            if(xQueueSend(incoming,&frame,0)!=pdTRUE)return BLE_ATT_ERR_INSUFFICIENT_RES;
        }else if(!bytes[i]||partial_length>=L2_LINE_MAX-1){discarding=true;partial_length=0;}
        else if(!discarding)partial[partial_length++]=(char)bytes[i];
    }return 0;
}
static const struct ble_gatt_svc_def services[]={
    {.type=BLE_GATT_SVC_TYPE_PRIMARY,.uuid=&svc.u,.characteristics=(struct ble_gatt_chr_def[]){
        {.uuid=&rx_uuid.u,.access_cb=access_characteristic,.flags=BLE_GATT_CHR_F_WRITE},
        {.uuid=&tx_uuid.u,.access_cb=access_characteristic,.flags=BLE_GATT_CHR_F_READ|BLE_GATT_CHR_F_NOTIFY,.val_handle=&tx_handle},{0}}},{0}};
static int gap_event(struct ble_gap_event *e,void *arg){
    (void)arg;if(local2_peer_gap_event(e))return 0;
    switch(e->type){
    case BLE_GAP_EVENT_CONNECT:
        if(e->connect.status==0){
            if(phone!=BLE_HS_CONN_HANDLE_NONE){ble_gap_terminate(e->connect.conn_handle,BLE_ERR_REM_USER_CONN_TERM);break;}
            portENTER_CRITICAL(&guard);invalidate();phone=e->connect.conn_handle;portEXIT_CRITICAL(&guard);local2_ble_link_state(true,false);
        }else advertise();break;
    case BLE_GAP_EVENT_DISCONNECT:
        if(e->disconnect.conn.conn_handle==phone){portENTER_CRITICAL(&guard);invalidate();portEXIT_CRITICAL(&guard);local2_ble_link_state(false,false);}advertise();break;
    case BLE_GAP_EVENT_SUBSCRIBE:
        if(e->subscribe.conn_handle==phone&&e->subscribe.attr_handle==tx_handle){portENTER_CRITICAL(&guard);advance_generation();subscribed=e->subscribe.cur_notify!=0;partial_length=0;discarding=false;xQueueReset(incoming);xQueueReset(outgoing);tx_work.length=0;tx_offset=0;portEXIT_CRITICAL(&guard);local2_ble_link_state(true,subscribed);}break;
    case BLE_GAP_EVENT_ADV_COMPLETE:advertise();break;
    default:break;
    }return 0;
}
static void advertise(void){
    if(!synced)return;
    uint8_t mfg[L2_PEER_MFG_BYTES];size_t n=local2_peer_advertisement(mfg);
    uint32_t g=local2_peer_advertisement_generation();
    if(ble_gap_adv_active()&&g!=advert_generation)(void)ble_gap_adv_stop();
    if(ble_gap_adv_active()||(phone!=BLE_HS_CONN_HANDLE_NONE&&!n))return;
    struct ble_hs_adv_fields fields={0},rsp={0};fields.flags=BLE_HS_ADV_F_DISC_GEN|BLE_HS_ADV_F_BREDR_UNSUP;
    /* The phone's existing hardware service filter must keep seeing the UUID
     * in the primary advertisement, including while peer discovery is armed.
     * Active peer scans read the unchanged manufacturer proof in scan response. */
    fields.uuids128=(ble_uuid128_t *)&svc;fields.num_uuids128=1;fields.uuids128_is_complete=1;
    const char *name="CatForest-Local2";rsp.name=(const uint8_t *)name;rsp.name_len=(uint8_t)strlen(name);rsp.name_is_complete=1;
    /* 23-byte peer proof + AD header + 3-byte short name + AD header = 30. */
    if(n){rsp.mfg_data=mfg;rsp.mfg_data_len=(uint8_t)n;rsp.name=(const uint8_t *)"CF2";rsp.name_len=3;rsp.name_is_complete=0;}
    int rc=ble_gap_adv_set_fields(&fields);if(rc==0)rc=ble_gap_adv_rsp_set_fields(&rsp);
    struct ble_gap_adv_params p={.conn_mode=BLE_GAP_CONN_MODE_UND,.disc_mode=BLE_GAP_DISC_MODE_GEN};
    if(rc==0)rc=ble_gap_adv_start(own_address,NULL,BLE_HS_FOREVER,&p,gap_event,NULL);
    if(rc==0){advert_generation=g;ESP_LOGI("local2_ble","advertising_started peer=%u",n?1u:0u);}else ESP_LOGW("local2_ble","advertise rc=%d",rc);
}
static void service_tick(struct ble_npl_event *e){
    (void)e;
    /* 应用静默不代表BLE链路失效；锁屏时由控制器维持连接事件。
     * 真正丢链仍走GAP断连回调，不删除身份、存档或FIFO。 */
    advertise();
    if(subscribed&&phone!=BLE_HS_CONN_HANDLE_NONE){
        if(!tx_work.length&&xQueueReceive(outgoing,&tx_work,0)==pdTRUE)tx_offset=0;
        if(tx_work.length&&tx_work.generation!=generation){tx_work.length=0;tx_offset=0;}
        if(tx_work.length){unsigned count=tx_work.length-tx_offset;if(count>20)count=20;struct os_mbuf *b=ble_hs_mbuf_from_flat(tx_work.line+tx_offset,count);
            if(b&&ble_gatts_notify_custom(phone,tx_handle,b)==0){tx_offset+=count;if(tx_offset==tx_work.length){tx_work.length=0;tx_offset=0;}}}
    }
    ble_npl_callout_reset(&timer,ble_npl_time_ms_to_ticks32(10));
}
static void on_sync(void){int rc=ble_hs_util_ensure_addr(0);if(!rc)rc=ble_hs_id_infer_auto(0,&own_address);ESP_LOGI("local2_ble","host_sync rc=%d",rc);if(!rc){synced=true;advertise();}}
static void on_reset(int reason){ESP_LOGW("local2_ble","host reset %d",reason);synced=false;local2_peer_set_discoverable(false);portENTER_CRITICAL(&guard);invalidate();portEXIT_CRITICAL(&guard);local2_ble_link_state(false,false);}
static void host_task(void *arg){(void)arg;ESP_LOGI("local2_ble","host_task_entered");nimble_port_run();ESP_LOGW("local2_ble","host_task_exited");nimble_port_freertos_deinit();}
static void domain_task(void *arg){
    (void)arg;line_t reply;
    for(;;){
        local2_peer_poll((uint32_t)((uint64_t)esp_timer_get_time()/1000));
        if(xQueueReceive(incoming,&rx_work,pdMS_TO_TICKS(10))==pdTRUE){
            portENTER_CRITICAL(&guard);uint32_t token=generation;bool current=subscribed&&rx_work.generation==token;portEXIT_CRITICAL(&guard);
            if(!current)continue;
            memset(&reply,0,sizeof(reply));reply.generation=token;
            if(local2_wire_handle(rx_work.line,rx_work.length,reply.line,sizeof(reply.line),token)){
                reply.length=(uint16_t)strlen(reply.line);
                portENTER_CRITICAL(&guard);current=subscribed&&generation==token;portEXIT_CRITICAL(&guard);
                if(current&&xQueueSend(outgoing,&reply,pdMS_TO_TICKS(30))!=pdTRUE)ESP_LOGW("local2_ble","response backpressure; durable state retained");
            }
        }
        portENTER_CRITICAL(&guard);uint32_t context_token=generation;bool connected=subscribed&&phone!=BLE_HS_CONN_HANDLE_NONE;portEXIT_CRITICAL(&guard);
        if(connected&&uxQueueSpacesAvailable(outgoing)>0){
            memset(&reply,0,sizeof(reply));reply.generation=context_token;
            if(local2_wire_context_poll(context_token,(uint64_t)esp_timer_get_time()/1000,reply.line,sizeof(reply.line))){
                reply.length=(uint16_t)strlen(reply.line);
                portENTER_CRITICAL(&guard);bool current=subscribed&&generation==context_token;portEXIT_CRITICAL(&guard);
                if(!current||xQueueSend(outgoing,&reply,0)!=pdTRUE)local2_wire_context_send_failed(context_token);
            }
        }
    }
}
void local2_ble_start(void){
    if(started)return;
    incoming_payload=heap_caps_malloc(QMAX*sizeof(line_t),MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
    outgoing_payload=heap_caps_malloc(QMAX*sizeof(line_t),MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
    if(incoming_payload&&outgoing_payload){
        incoming=xQueueCreateStatic(QMAX,sizeof(line_t),incoming_payload,&incoming_control);
        outgoing=xQueueCreateStatic(QMAX,sizeof(line_t),outgoing_payload,&outgoing_control);
    }
    if(!incoming||!outgoing){
        if(incoming)vQueueDelete(incoming);
        if(outgoing)vQueueDelete(outgoing);
        heap_caps_free(incoming_payload);heap_caps_free(outgoing_payload);
        incoming=outgoing=NULL;incoming_payload=outgoing_payload=NULL;
        ESP_LOGE("local2_ble","PSRAM queue allocation failed");return;
    }
    ESP_LOGI("local2_ble","nimble_init_begin internal_free=%u internal_largest=%u",(unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT),(unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT));
    esp_err_t init_rc=nimble_port_init();
    if(init_rc!=ESP_OK){ESP_LOGE("local2_ble","nimble_init_failed rc=%d",(int)init_rc);return;}
    ESP_LOGI("local2_ble","nimble_init_ready");
    ble_svc_gap_init();ble_svc_gatt_init();ble_svc_gap_device_name_set("CatForest-Local2");
    ble_hs_cfg.sync_cb=on_sync;ble_hs_cfg.reset_cb=on_reset;
    int svc_rc=ble_gatts_count_cfg(services);if(!svc_rc)svc_rc=ble_gatts_add_svcs(services);
    if(svc_rc){ESP_LOGE("local2_ble","phone_service_failed rc=%d",svc_rc);return;}
    l2_core_t *core=l2_runtime_core(1000);if(!core){ESP_LOGE("local2_ble","peer_core_unavailable");return;}esp_err_t rc=local2_peer_register(core);l2_runtime_release();if(rc!=ESP_OK){ESP_LOGE("local2_ble","peer_register_failed rc=%d",(int)rc);return;}
    ble_npl_callout_init(&timer,nimble_port_get_dflt_eventq(),service_tick,NULL);ble_npl_callout_reset(&timer,ble_npl_time_ms_to_ticks32(10));
    if(xTaskCreate(domain_task,"local2_domain",8192,NULL,5,NULL)!=pdPASS){ESP_LOGE("local2_ble","domain_task_failed");return;}
    ESP_LOGI("local2_ble","host_task_requested");
    started=true;nimble_port_freertos_init(host_task);
}
