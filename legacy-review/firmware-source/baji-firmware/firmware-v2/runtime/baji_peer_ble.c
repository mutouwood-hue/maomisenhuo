#include "baji_peer_ble.h"
#include "host/ble_hs.h"
#include "freertos/FreeRTOS.h"
#include <string.h>
#define MAX_OBJECT 316u
static const ble_uuid128_t svc=BLE_UUID128_INIT(0x10,0x7a,0x6f,0x5e,0x8c,0x3b,0x2f,0x9d,0x7e,0x4a,0x9b,0x1c,0x00,0xa0,0xf1,0xe7);
static const ble_uuid128_t rx_uuid=BLE_UUID128_INIT(0x11,0x7a,0x6f,0x5e,0x8c,0x3b,0x2f,0x9d,0x7e,0x4a,0x9b,0x1c,0x00,0xa0,0xf1,0xe7);
static const ble_uuid128_t tx_uuid=BLE_UUID128_INIT(0x12,0x7a,0x6f,0x5e,0x8c,0x3b,0x2f,0x9d,0x7e,0x4a,0x9b,0x1c,0x00,0xa0,0xf1,0xe7);
static portMUX_TYPE guard=portMUX_INITIALIZER_UNLOCKED;
static bool enabled,central,connecting,write_pending,read_pending;
static uint16_t connection=BLE_HS_CONN_HANDLE_NONE,remote_rx,remote_tx;
static uint8_t own[6],peer[6],advertised[8],expected[8],tx[MAX_OBJECT],rx[MAX_OBJECT];
static uint16_t tx_size,tx_offset,rx_size,rx_received;
static uint8_t tx_type,rx_type,tx_sequence,rx_sequence,last_rx_sequence;
static bool rx_ready;
static uint8_t last_rx[MAX_OBJECT],last_rx_type,ack_frame[20];
static uint16_t last_rx_size;
static bool ack_pending,ack_write_pending;
static uint8_t last_ack[20];
static bool last_ack_valid;
static uint32_t disconnect_generation;
static int gap(struct ble_gap_event *,void *);
static bool address_matches(const ble_addr_t *address){for(unsigned i=0;i<6;i++)if(address->val[5-i]!=peer[i])return false;return true;}
static void reset_locked(void){
    connection=BLE_HS_CONN_HANDLE_NONE;remote_rx=remote_tx=0;connecting=write_pending=read_pending=false;
    memset(tx,0,sizeof(tx));memset(rx,0,sizeof(rx));tx_size=tx_offset=rx_size=rx_received=0;rx_ready=false;
    tx_type=rx_type=tx_sequence=rx_sequence=last_rx_sequence=0;
    last_ack_valid=false;memset(last_ack,0,sizeof(last_ack));
    last_rx_type=0;last_rx_size=0;memset(last_rx,0,sizeof(last_rx));memset(ack_frame,0,20);ack_pending=ack_write_pending=false;
}
static bool receive_frame(const uint8_t *b,size_t n){
    /* [schema1,type,sequence,page,sizeLE16,payload14]. Sequential complete objects.
       Repeated pages are accepted only if byte-identical; stale sequence ignored. */
    if(n!=20 || b[0]!=1 || !b[1] || !b[2])return false;
    unsigned size=b[4]|((unsigned)b[5]<<8),offset=b[3]*14u,count;
    if(!size || size>MAX_OBJECT || offset>=size)return false;
    count=size-offset;if(count>14)count=14;
    for(unsigned i=6+count;i<20;i++)if(b[i])return false;
    if(b[2]==last_rx_sequence)return b[1]==last_rx_type && size==last_rx_size && offset+count<=last_rx_size && !memcmp(last_rx+offset,b+6,count);
    if(last_rx_sequence==255 || b[2]!=(uint8_t)(last_rx_sequence+1))return false;
    if(rx_ready)return false;
    if(offset==0 && (rx_sequence!=b[2] || !rx_received)){
        if(rx_received)return false;
        rx_type=b[1];rx_sequence=b[2];rx_size=(uint16_t)size;
    }
    if(rx_sequence!=b[2] || rx_type!=b[1] || rx_size!=size)return false;
    if(offset<rx_received)return offset+count<=rx_received && !memcmp(rx+offset,b+6,count);
    if(offset!=rx_received)return false;
    memcpy(rx+offset,b+6,count);rx_received+=(uint16_t)count;
    if(rx_received==rx_size){rx_ready=true;last_rx_sequence=rx_sequence;last_rx_type=rx_type;last_rx_size=rx_size;memcpy(last_rx,rx,rx_size);}return true;
}
static bool frame(uint8_t out[20]){
    if(!tx_size)return false;
    memset(out,0,20);out[0]=1;out[1]=tx_type;out[2]=tx_sequence;out[3]=(uint8_t)(tx_offset/14);
    out[4]=(uint8_t)tx_size;out[5]=(uint8_t)(tx_size>>8);
    unsigned count=tx_size-tx_offset;if(count>14)count=14;memcpy(out+6,tx+tx_offset,count);return true;
}
static void advance(void){unsigned count=tx_size-tx_offset;if(count>14)count=14;tx_offset+=(uint16_t)count;if(tx_offset==tx_size){tx_size=tx_offset=0;memset(tx,0,sizeof(tx));}}
static int access(uint16_t conn,uint16_t attr,struct ble_gatt_access_ctxt *ctx,void *arg){
    (void)attr;(void)arg;uint8_t b[20];uint16_t length=0;int result=BLE_ATT_ERR_UNLIKELY;
    portENTER_CRITICAL(&guard);
    bool valid=enabled && conn==connection && !central;
    if(valid && ctx->op==BLE_GATT_ACCESS_OP_READ_CHR){
        bool ready=frame(b);portEXIT_CRITICAL(&guard);
        if(!ready)return BLE_ATT_ERR_UNLIKELY;
        result=os_mbuf_append(ctx->om,b,20)==0?0:BLE_ATT_ERR_INSUFFICIENT_RES;
        portENTER_CRITICAL(&guard);
    }else if(valid && ctx->op==BLE_GATT_ACCESS_OP_WRITE_CHR){
        portEXIT_CRITICAL(&guard);
        bool parsed=OS_MBUF_PKTLEN(ctx->om)==20 && ble_hs_mbuf_to_flat(ctx->om,b,20,&length)==0 && length==20;
        portENTER_CRITICAL(&guard);
        if(parsed && enabled && conn==connection){
            if(b[0]==1 && b[1]==0){
                bool zeros=true;for(unsigned i=6;i<20;i++)if(b[i])zeros=false;
                if(zeros && tx_size && b[2]==tx_sequence && b[3]==tx_offset/14 && ((unsigned)b[4]|((unsigned)b[5]<<8))==tx_size){memcpy(last_ack,b,20);last_ack_valid=true;advance();result=0;}
                else if(last_ack_valid && !memcmp(last_ack,b,20))result=0;
            }else result=receive_frame(b,20)?0:BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
        }
    }
    portEXIT_CRITICAL(&guard);return result;
}
static const struct ble_gatt_svc_def services[]={
    {.type=BLE_GATT_SVC_TYPE_PRIMARY,.uuid=&svc.u,.characteristics=(struct ble_gatt_chr_def[]){
        {.uuid=&rx_uuid.u,.access_cb=access,.flags=BLE_GATT_CHR_F_WRITE},
        {.uuid=&tx_uuid.u,.access_cb=access,.flags=BLE_GATT_CHR_F_READ}, {0}}},{0}};
esp_err_t bj_peer_ble_register(void){return ble_gatts_count_cfg(services)==0 && ble_gatts_add_svcs(services)==0?ESP_OK:ESP_FAIL;}
static int characteristic(uint16_t conn,const struct ble_gatt_error *error,const struct ble_gatt_chr *chr,void *arg){
    (void)arg;if(error->status || !chr)return 0;
    portENTER_CRITICAL(&guard);
    if(enabled && conn==connection){if(ble_uuid_cmp(&chr->uuid.u,&rx_uuid.u)==0)remote_rx=chr->val_handle;if(ble_uuid_cmp(&chr->uuid.u,&tx_uuid.u)==0)remote_tx=chr->val_handle;}
    portEXIT_CRITICAL(&guard);return 0;
}
static int service(uint16_t conn,const struct ble_gatt_error *error,const struct ble_gatt_svc *s,void *arg){
    (void)arg;if(!error->status && s)(void)ble_gattc_disc_all_chrs(conn,s->start_handle,s->end_handle,characteristic,NULL);return 0;
}
bool bj_peer_ble_gap_event(struct ble_gap_event *event){
    if(event->type==BLE_GAP_EVENT_CONNECT && !event->connect.status){
        struct ble_gap_conn_desc desc;if(ble_gap_conn_find(event->connect.conn_handle,&desc)!=0)return false;
        portENTER_CRITICAL(&guard);bool ours=enabled && address_matches(&desc.peer_id_addr);
        if(ours && connection==BLE_HS_CONN_HANDLE_NONE){connection=event->connect.conn_handle;connecting=false;}
        else if(ours){portEXIT_CRITICAL(&guard);(void)ble_gap_terminate(event->connect.conn_handle,BLE_ERR_REM_USER_CONN_TERM);return true;}
        bool discover=ours && central;portEXIT_CRITICAL(&guard);
        if(discover)(void)ble_gattc_disc_svc_by_uuid(event->connect.conn_handle,&svc.u,service,NULL);
        return ours;
    }
    if(event->type==BLE_GAP_EVENT_DISCONNECT){
        portENTER_CRITICAL(&guard);bool ours=event->disconnect.conn.conn_handle==connection;
        if(ours){reset_locked();enabled=false;disconnect_generation++;}
        portEXIT_CRITICAL(&guard);return ours;
    }
    return false;
}
static int gap(struct ble_gap_event *event,void *arg){
    (void)arg;if(bj_peer_ble_gap_event(event))return 0;
    if(event->type==BLE_GAP_EVENT_CONNECT && event->connect.status){portENTER_CRITICAL(&guard);connecting=false;portEXIT_CRITICAL(&guard);}
    if(event->type!=BLE_GAP_EVENT_DISC)return 0;
    struct ble_hs_adv_fields fields;if(ble_hs_adv_parse_fields(&fields,event->disc.data,event->disc.length_data)!=0)return 0;
    portENTER_CRITICAL(&guard);
    bool match=enabled && central && connection==BLE_HS_CONN_HANDLE_NONE && !connecting && address_matches(&event->disc.addr) && fields.mfg_data_len==10 && fields.mfg_data[0]==0xff && fields.mfg_data[1]==0xff && !memcmp(fields.mfg_data+2,expected,8);
    if(match)connecting=true;
    portEXIT_CRITICAL(&guard);
    if(match){uint8_t address_type;if(ble_hs_id_infer_auto(0,&address_type)==0){(void)ble_gap_disc_cancel();if(ble_gap_connect(address_type,&event->disc.addr,5000,NULL,gap,NULL)!=0){portENTER_CRITICAL(&guard);connecting=false;portEXIT_CRITICAL(&guard);}}}
    return 0;
}
void bj_peer_ble_start(const uint8_t self[6],const uint8_t other[6],const uint8_t token[8],const uint8_t peer_token[8]){
    bj_peer_ble_stop();portENTER_CRITICAL(&guard);memcpy(own,self,6);memcpy(peer,other,6);memcpy(advertised,token,8);memcpy(expected,peer_token,8);central=memcmp(self,other,6)<0;enabled=true;portEXIT_CRITICAL(&guard);
}
void bj_peer_ble_stop(void){
    portENTER_CRITICAL(&guard);uint16_t old=connection;enabled=false;reset_locked();memset(advertised,0,8);memset(expected,0,8);portEXIT_CRITICAL(&guard);
    (void)ble_gap_disc_cancel();if(old!=BLE_HS_CONN_HANDLE_NONE)(void)ble_gap_terminate(old,BLE_ERR_REM_USER_CONN_TERM);
}
bool bj_peer_ble_enabled(void){portENTER_CRITICAL(&guard);bool v=enabled;portEXIT_CRITICAL(&guard);return v;}
bool bj_peer_ble_advertisement(uint8_t out[8]){portENTER_CRITICAL(&guard);bool v=enabled;if(v)memcpy(out,advertised,8);portEXIT_CRITICAL(&guard);return v;}
uint32_t bj_peer_ble_disconnect_generation(void){portENTER_CRITICAL(&guard);uint32_t v=disconnect_generation;portEXIT_CRITICAL(&guard);return v;}
bool bj_peer_ble_connected(void){portENTER_CRITICAL(&guard);bool v=enabled && connection!=BLE_HS_CONN_HANDLE_NONE && (!central || (remote_rx && remote_tx));portEXIT_CRITICAL(&guard);return v;}
bool bj_peer_ble_send(uint8_t type,const uint8_t *bytes,size_t size){
    if(!bytes || !size || size>MAX_OBJECT || !type)return false;
    portENTER_CRITICAL(&guard);bool ok=enabled && !tx_size && tx_sequence<255;
    if(ok){memcpy(tx,bytes,size);tx_type=type;tx_size=(uint16_t)size;tx_offset=0;tx_sequence++;}portEXIT_CRITICAL(&guard);return ok;
}
bool bj_peer_ble_take(uint8_t *type,uint8_t *bytes,size_t *size){
    if(!type || !bytes || !size)return false;
    portENTER_CRITICAL(&guard);bool ok=rx_ready && *size>=rx_size;
    if(ok){*type=rx_type;*size=rx_size;memcpy(bytes,rx,rx_size);memset(rx,0,sizeof(rx));rx_size=rx_received=0;rx_ready=false;}
    portEXIT_CRITICAL(&guard);return ok;
}
static int write_complete(uint16_t conn,const struct ble_gatt_error *e,struct ble_gatt_attr *attr,void *arg){
    (void)attr;(void)arg;portENTER_CRITICAL(&guard);if(conn==connection && write_pending){write_pending=false;if(!e->status && tx_size)advance();}portEXIT_CRITICAL(&guard);return 0;
}
static int read_complete(uint16_t conn,const struct ble_gatt_error *e,struct ble_gatt_attr *attr,void *arg){
    (void)arg;uint8_t b[20];uint16_t length=0;bool valid=!e->status && attr && OS_MBUF_PKTLEN(attr->om)==20 && ble_hs_mbuf_to_flat(attr->om,b,20,&length)==0 && length==20;
    portENTER_CRITICAL(&guard);if(conn==connection && read_pending){read_pending=false;if(valid && receive_frame(b,20)){memcpy(ack_frame,b,20);ack_frame[1]=0;memset(ack_frame+6,0,14);ack_pending=true;}}portEXIT_CRITICAL(&guard);return 0;
}
static int ack_complete(uint16_t conn,const struct ble_gatt_error *e,struct ble_gatt_attr *attr,void *arg){
    (void)attr;(void)arg;portENTER_CRITICAL(&guard);
    if(conn==connection && ack_write_pending){ack_write_pending=false;if(!e->status)ack_pending=false;}
    portEXIT_CRITICAL(&guard);return 0;
}
void bj_peer_ble_poll(void){
    uint8_t b[20],ack[20],address_type;uint16_t conn,write_handle,read_handle;bool write=false,read=false,scan=false,send_ack=false;
    portENTER_CRITICAL(&guard);conn=connection;write_handle=remote_rx;read_handle=remote_tx;
    if(enabled && central && conn!=BLE_HS_CONN_HANDLE_NONE && write_handle && read_handle){
        if(ack_pending && !write_pending && !ack_write_pending){memcpy(ack,ack_frame,20);ack_write_pending=true;send_ack=true;}
        if(!ack_pending && !ack_write_pending && !write_pending && frame(b)){write_pending=true;write=true;}
        if(!ack_pending && !ack_write_pending && !read_pending && !rx_ready){read_pending=true;read=true;}
    }
    scan=enabled && central && conn==BLE_HS_CONN_HANDLE_NONE && !connecting;portEXIT_CRITICAL(&guard);
    if(send_ack && ble_gattc_write_flat(conn,write_handle,ack,20,ack_complete,NULL)!=0){portENTER_CRITICAL(&guard);ack_write_pending=false;portEXIT_CRITICAL(&guard);}
    if(write && ble_gattc_write_flat(conn,write_handle,b,20,write_complete,NULL)!=0){portENTER_CRITICAL(&guard);write_pending=false;portEXIT_CRITICAL(&guard);}
    if(read && ble_gattc_read(conn,read_handle,read_complete,NULL)!=0){portENTER_CRITICAL(&guard);read_pending=false;portEXIT_CRITICAL(&guard);}
    if(scan && !ble_gap_disc_active() && ble_hs_id_infer_auto(0,&address_type)==0){struct ble_gap_disc_params params={0};params.passive=0;params.filter_duplicates=0;(void)ble_gap_disc(address_type,1000,&params,gap,NULL);}
}
