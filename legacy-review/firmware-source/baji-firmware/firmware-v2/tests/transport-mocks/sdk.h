#pragma once
/* Minimal host-only SDK surface. Production transport is included unchanged. */
#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL -1
#define ESP_ERR_NO_MEM 0x101
#define ESP_ERR_INVALID_STATE 0x103
#define BLE_HS_CONN_HANDLE_NONE 0xffff
#define BLE_ATT_ERR_UNLIKELY 14
#define BLE_ATT_ERR_INSUFFICIENT_RES 17
#define BLE_ATT_ERR_WRITE_NOT_PERMITTED 3
#define BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN 13
#define BLE_GATT_ACCESS_OP_READ_CHR 1
#define BLE_GATT_ACCESS_OP_WRITE_CHR 2
#define BLE_GATT_SVC_TYPE_PRIMARY 1
#define BLE_GATT_CHR_F_WRITE 1
#define BLE_GATT_CHR_F_READ 2
#define BLE_GATT_CHR_F_NOTIFY 4
#define BLE_HS_ADV_F_DISC_GEN 2
#define BLE_HS_ADV_F_BREDR_UNSUP 4
#define BLE_GAP_CONN_MODE_UND 1
#define BLE_GAP_DISC_MODE_GEN 1
#define BLE_HS_FOREVER -1
#define BLE_GAP_EVENT_CONNECT 1
#define BLE_GAP_EVENT_DISCONNECT 2
#define BLE_GAP_EVENT_SUBSCRIBE 3
#define BLE_GAP_EVENT_ADV_COMPLETE 4
#define BLE_ERR_REM_USER_CONN_TERM 19
#define NIMBLE_HS_STACK_SIZE 4096
#define NIMBLE_CORE 0
#define configMAX_PRIORITIES 25
#define pdPASS 1
#define pdFAIL 0
typedef int portMUX_TYPE;
#define portMUX_INITIALIZER_UNLOCKED 0
typedef void *TaskHandle_t;
typedef struct { uint8_t type; } ble_uuid_t;
typedef struct { ble_uuid_t u; uint8_t value[16]; } ble_uuid128_t;
#define BLE_UUID128_INIT(...) { .u={128},.value={__VA_ARGS__} }
struct os_mbuf { uint16_t length; uint8_t bytes[64]; };
#define OS_MBUF_PKTLEN(om) ((om)->length)
struct ble_gatt_access_ctxt { int op; struct os_mbuf *om; };
struct ble_gatt_chr_def { const ble_uuid_t *uuid; int (*access_cb)(uint16_t,uint16_t,struct ble_gatt_access_ctxt *,void *); unsigned flags; uint16_t *val_handle; };
struct ble_gatt_svc_def { int type; const ble_uuid_t *uuid; struct ble_gatt_chr_def *characteristics; };
struct ble_gap_event { int type; struct { int status; uint16_t conn_handle; } connect; struct { struct { uint16_t conn_handle; } conn; } disconnect; struct { uint16_t conn_handle,attr_handle; uint8_t cur_notify; } subscribe; };
struct ble_hs_adv_fields { unsigned flags; ble_uuid128_t *uuids128; uint8_t num_uuids128,uuids128_is_complete; uint8_t *name; size_t name_len; uint8_t name_is_complete; };
struct ble_gap_adv_params { int conn_mode,disc_mode; };
struct ble_npl_event { int unused; };
struct ble_npl_callout { void (*callback)(struct ble_npl_event *); };
static struct { void (*sync_cb)(void); void (*reset_cb)(int); } ble_hs_cfg;
typedef struct {
    int depth,init_result,task_result,callout_init_result,callout_reset_result,config_result;
    unsigned init_calls,deinit_calls,task_calls,stop_calls,callout_deinit_calls,reset_calls,dispatch_calls;
    unsigned alloc_calls,notify_calls,sent_count,terminate_calls,run_calls,delete_calls;
    unsigned alloc_failures,notify_failures;
    uint16_t sent_conn[256]; uint8_t sent[256][20];
    struct os_mbuf buffer; void (*notify_hook)(void);
} transport_mock_t;
static transport_mock_t mock;
static inline void mock_sdk_unlocked(void) { assert(mock.depth==0); }
#define portENTER_CRITICAL(g) do { (void)(g); assert(mock.depth==0); mock.depth++; } while(0)
#define portEXIT_CRITICAL(g) do { (void)(g); assert(mock.depth==1); mock.depth--; } while(0)
static inline int os_mbuf_append(struct os_mbuf *om,const void *p,uint16_t n) { mock_sdk_unlocked(); if(om->length+n>sizeof(om->bytes)) return -1; memcpy(om->bytes+om->length,p,n);om->length+=n;return 0; }
static inline int ble_hs_mbuf_to_flat(struct os_mbuf *om,void *p,uint16_t n,uint16_t *len) { mock_sdk_unlocked(); if(om->length>n)return -1;*len=om->length;memcpy(p,om->bytes,*len);return 0; }
static inline struct os_mbuf *ble_hs_mbuf_from_flat(const void *p,uint16_t n) { mock_sdk_unlocked();mock.alloc_calls++;if(mock.alloc_failures){mock.alloc_failures--;return NULL;} mock.buffer.length=n;memcpy(mock.buffer.bytes,p,n);return &mock.buffer; }
/* NimBLE consumes the custom-notify mbuf on both success and failure. */
static inline int ble_gatts_notify_custom(uint16_t conn,uint16_t attr,struct os_mbuf *om) { mock_sdk_unlocked();(void)attr;mock.notify_calls++;if(mock.notify_hook){void (*hook)(void)=mock.notify_hook;mock.notify_hook=NULL;hook();}if(mock.notify_failures){mock.notify_failures--;return -1;}assert(mock.sent_count<256);mock.sent_conn[mock.sent_count]=conn;memcpy(mock.sent[mock.sent_count++],om->bytes,20);return 0; }
static inline int ble_gap_adv_active(void){mock_sdk_unlocked();return 0;}
static inline int ble_gap_adv_set_fields(const struct ble_hs_adv_fields *f){mock_sdk_unlocked();(void)f;return 0;}
static inline int ble_gap_adv_rsp_set_fields(const struct ble_hs_adv_fields *f){mock_sdk_unlocked();(void)f;return 0;}
static inline int ble_gap_adv_start(uint8_t addr,const void *peer,int duration,const struct ble_gap_adv_params *p,int (*cb)(struct ble_gap_event *,void *),void *arg){mock_sdk_unlocked();(void)addr;(void)peer;(void)duration;(void)p;(void)cb;(void)arg;return 0;}
static inline int ble_gap_terminate(uint16_t conn,int reason){mock_sdk_unlocked();(void)conn;(void)reason;mock.terminate_calls++;return 0;}
static inline int ble_hs_util_ensure_addr(int p){mock_sdk_unlocked();(void)p;return 0;}
static inline int ble_hs_id_infer_auto(int p,uint8_t *addr){mock_sdk_unlocked();(void)p;*addr=0;return 0;}
static inline int nimble_port_init(void){mock_sdk_unlocked();mock.init_calls++;return mock.init_result;}
static inline int nimble_port_deinit(void){mock_sdk_unlocked();mock.deinit_calls++;return 0;}
static inline void nimble_port_run(void){mock_sdk_unlocked();mock.run_calls++;}
static inline void *nimble_port_get_dflt_eventq(void){mock_sdk_unlocked();return NULL;}
static inline void ble_svc_gap_init(void){mock_sdk_unlocked();}
static inline void ble_svc_gatt_init(void){mock_sdk_unlocked();}
static inline int ble_svc_gap_device_name_set(const char *s){mock_sdk_unlocked();(void)s;return mock.config_result;}
static inline int ble_att_set_preferred_mtu(int n){mock_sdk_unlocked();(void)n;return 0;}
static inline int ble_gatts_count_cfg(const struct ble_gatt_svc_def *s){mock_sdk_unlocked();(void)s;return 0;}
static inline int ble_gatts_add_svcs(const struct ble_gatt_svc_def *s){mock_sdk_unlocked();*s[0].characteristics[1].val_handle=42;return 0;}
static inline int ble_npl_callout_init(struct ble_npl_callout *c,void *q,void (*cb)(struct ble_npl_event *),void *arg){mock_sdk_unlocked();(void)q;(void)arg;c->callback=cb;return mock.callout_init_result;}
static inline int ble_npl_callout_reset(struct ble_npl_callout *c,uint32_t ticks){mock_sdk_unlocked();(void)c;(void)ticks;mock.reset_calls++;return mock.callout_reset_result;}
static inline uint32_t ble_npl_time_ms_to_ticks32(uint32_t ms){mock_sdk_unlocked();return ms;}
static inline void ble_npl_callout_stop(struct ble_npl_callout *c){mock_sdk_unlocked();(void)c;mock.stop_calls++;}
static inline void ble_npl_callout_deinit(struct ble_npl_callout *c){mock_sdk_unlocked();(void)c;mock.callout_deinit_calls++;}
static inline int xTaskCreatePinnedToCore(void (*fn)(void *),const char *name,unsigned stack,void *arg,unsigned priority,TaskHandle_t *task,int core){mock_sdk_unlocked();(void)fn;(void)name;(void)stack;(void)arg;(void)priority;(void)core;mock.task_calls++;if(mock.task_result==pdPASS)*task=&mock;return mock.task_result;}
static inline void vTaskDelete(void *task){mock_sdk_unlocked();(void)task;mock.delete_calls++;}
