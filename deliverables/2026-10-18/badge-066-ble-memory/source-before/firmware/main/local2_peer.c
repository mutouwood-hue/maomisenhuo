#include "local2_peer.h"
#include <string.h>
#include <math.h>
#include "mbedtls/sha256.h"

static bool nonzero(const uint8_t *p,size_t n){uint8_t v=0;while(n--)v|=*p++;return v!=0;}
static void hex_id(char out[33],const uint8_t in[16]){static const char h[]="0123456789abcdef";for(unsigned i=0;i<16;i++){out[i*2]=h[in[i]>>4];out[i*2+1]=h[in[i]&15];}out[32]=0;}
static bool accepted(l2_status_t s){return s==L2_OK||s==L2_DUPLICATE;}
static void blocked(l2_peer_machine_t *m,l2_status_t s){m->view.storage_status=s;m->view.phase=L2P_BLOCKED;m->view.complete=false;m->view.discoverable=false;}
static bool pair_matches(const l2_peer_machine_t *m,const uint8_t *b){return !memcmp(b,m->remote_nonce,16)&&!memcmp(b+16,m->nonce,16);}
static void pair_bytes(const l2_peer_machine_t *m,uint8_t *b){memcpy(b,m->nonce,16);memcpy(b+16,m->remote_nonce,16);}
static void proof_bytes(const l2_meet_t *p,uint8_t *b){memcpy(b,p->id,16);b[16]=p->method;b[17]=p->count;memcpy(b+18,p->mark,16);}
static void proof_read(l2_meet_t *p,const uint8_t *b){memset(p,0,sizeof(*p));memcpy(p->id,b,16);p->method=b[16];p->count=b[17];memcpy(p->mark,b+18,16);p->stage=1;}
static bool same_proof(const l2_meet_t *a,const l2_meet_t *b){return !memcmp(a->id,b->id,16)&&a->method==b->method&&a->count==b->count&&!memcmp(a->mark,b->mark,16);}
static unsigned gap(const l2_meet_t *p,unsigned i){return p->mark[i*2]|(unsigned)p->mark[i*2+1]<<8;}
static bool match_inputs(const l2_peer_machine_t *m){
 const l2_meet_t *a=m->view.leader?&m->mine:&m->theirs,*b=m->view.leader?&m->theirs:&m->mine;
 if(!m->view.input_ready||!m->remote_input||a->method!=b->method||a->count!=b->count)return false;
 if(a->method==2)return !memcmp(a->mark,b->mark,16);
 unsigned ta=0,tb=0;for(unsigned i=0;i<a->count-1u;i++){ta+=gap(a,i);tb+=gap(b,i);}if(!ta||!tb||fabs((double)tb-ta)/(ta>tb?ta:tb)>.30)return false;
 for(unsigned i=0;i<a->count-1u;i++)if(fabs((double)gap(b,i)/tb-(double)gap(a,i)/ta)>.15)return false;
 return true;
}
static void refresh_match(l2_peer_machine_t *m){
 if(!m->remote_input||!m->view.input_ready)return;
 if(!match_inputs(m)){blocked(m,L2_INVALID);return;}
 const l2_meet_t *lead=m->view.leader?&m->mine:&m->theirs;
 if(m->offered.stage&&!same_proof(lead,&m->offered)){blocked(m,L2_REQUEST_CONFLICT);return;}
 uint8_t stage=m->agreed.stage;m->agreed=*lead;m->agreed.stage=stage;
 m->view.matched=true;m->view.phase=L2P_CONFIRM;m->last_send_ms=0;
}
static void reset_link(l2_peer_machine_t *m){
 bool enabled=m->view.discoverable;uint64_t count=m->view.complete_count;uint8_t method=m->view.method?m->view.method:1;
 memset(&m->view,0,sizeof(m->view));m->view.discoverable=enabled;m->view.complete_count=count;m->view.method=method;m->view.phase=enabled?L2P_DISCOVERING:L2P_DISABLED;
 m->hello_seen=m->hello_sent=m->confirm_sent=m->input_sent=m->remote_input=false;m->remote_stage=0;m->last_send_ms=m->last_tap_ms=m->follow_at=m->completed_at=0;
 memset(&m->mine,0,sizeof(m->mine));memset(&m->theirs,0,sizeof(m->theirs));memset(&m->agreed,0,sizeof(m->agreed));memset(&m->offered,0,sizeof(m->offered));memset(m->remote_id,0,16);memset(m->remote_nonce,0,16);
}
bool l2_peer_machine_init(l2_peer_machine_t *m,l2_core_t *core,l2_peer_send_fn send,void *ctx){if(!m||!core||!send)return false;memset(m,0,sizeof(*m));m->core=core;m->send=send;m->send_ctx=ctx;return l2_get_device_id(core,m->own_id)&&nonzero(m->own_id,16);}
bool l2_peer_machine_enable(l2_peer_machine_t *m,bool enabled,const uint8_t nonce[16]){
 if(!m|| (enabled&&(!nonce||!nonzero(nonce,16))))return false;
 if(m->view.discoverable&&m->agreed.stage&&!m->view.complete)return false; /* committed consent must recover */
 reset_link(m);m->view.discoverable=enabled;m->view.phase=enabled?L2P_DISCOVERING:L2P_DISABLED;m->started_ms=0;
 if(enabled){memcpy(m->nonce,nonce,16);memcpy(m->arm,nonce,16);}else memset(m->nonce,0,16);return true;
}
void l2_peer_machine_link(l2_peer_machine_t *m,bool connected,const uint8_t id[16],const uint8_t token[4]){
 if(!m)return;
 reset_link(m);if(!connected||!m->view.discoverable||!id||!token||!nonzero(id,16)||!memcmp(id,m->own_id,16))return;
 memcpy(m->expected_id,id,16);memcpy(m->expected_token,token,4);m->view.connected=true;m->view.phase=L2P_HELLO;
}
size_t l2_peer_machine_advertisement(const l2_peer_machine_t *m,uint8_t *out,size_t cap){if(!m||!out||cap<L2_PEER_MFG_BYTES||!m->view.discoverable)return 0;out[0]=out[1]=0xff;out[2]=3;memcpy(out+3,m->own_id,16);memcpy(out+19,m->nonce,4);return L2_PEER_MFG_BYTES;}
bool l2_peer_machine_confirm(l2_peer_machine_t *m){if(!m||!m->view.connected||!m->hello_seen||!m->view.matched||m->view.phase==L2P_BLOCKED||m->view.complete)return false;m->view.local_confirmed=true;m->last_send_ms=0;return true;}
static void finalize_input(l2_peer_machine_t *m){
 if(!m->hello_seen||m->view.input_ready||m->view.phase!=L2P_CONFIRM)return;
 m->mine.method=m->view.method;memcpy(m->mine.id,m->agreed.id,16);m->mine.stage=1;
 if(!l2_meet_valid(&m->mine)){blocked(m,L2_INVALID);return;}
 m->view.input_ready=true;m->input_sent=false;m->last_send_ms=0;refresh_match(m);
}
void l2_peer_machine_tap(l2_peer_machine_t *m,uint32_t now){
 if(!m||!m->hello_seen||m->view.method!=1||m->view.remote_method!=1||m->view.input_ready||m->view.phase!=L2P_CONFIRM)return;
 if(!m->view.leader&&!m->remote_input)return;
 if(m->mine.count>=8)return;
 if(m->mine.count){uint32_t dt=now-m->last_tap_ms;if(dt<60)return;if(dt>=1200){finalize_input(m);return;}unsigned i=(m->mine.count-1u)*2;m->mine.mark[i]=(uint8_t)dt;m->mine.mark[i+1]=(uint8_t)(dt>>8);}
 m->mine.count++;m->view.taps=m->mine.count;m->last_tap_ms=now;m->last_send_ms=0;
}
void l2_peer_machine_dots(l2_peer_machine_t *m,const uint8_t *seq,uint8_t n){
 if(!m||!seq||!m->hello_seen||m->view.method!=2||m->view.remote_method!=2||m->view.input_ready||m->view.phase!=L2P_CONFIRM||n>9)return;
 memcpy(m->mine.mark,seq,n);m->mine.count=n;finalize_input(m);
}
bool l2_peer_machine_receive(l2_peer_machine_t *m,uint8_t type,const uint8_t *b,size_t n){
 if(!m||!b||!m->view.discoverable||!m->view.connected||m->view.phase==L2P_BLOCKED)return false;
 if(type==L2P_MSG_HELLO){
  if(n!=131||!memchr(b+89,0,25)||!memchr(b+114,0,17)||!b[89]||!b[114]||b[0]!=3||memcmp(b+1,m->expected_id,16)||memcmp(b+17,m->expected_token,4)||memcmp(b+33,m->nonce,4)||!nonzero(b+17,16)||!memcmp(b+17,m->nonce,16)||!nonzero(b+37,16)||(b[53]!=1&&b[53]!=2)||b[88]>3)return false;
  if(m->hello_seen)return !memcmp(m->remote_nonce,b+17,16);
  memcpy(m->remote_id,b+1,16);memcpy(m->remote_nonce,b+17,16);memcpy(m->remote_arm,b+37,16);hex_id(m->view.peer_id,m->remote_id);memcpy(m->remote_name,b+89,25);memcpy(m->remote_breed,b+114,17);m->view.remote_method=b[53];m->hello_seen=true;m->view.phase=L2P_CONFIRM;m->view.leader=memcmp(m->own_id,m->remote_id,16)<0;
  l2_meet_t local={0},remote={0};(void)l2_get_encounter(m->core,m->view.peer_id,&local);proof_read(&remote,b+54);remote.stage=b[88];
  if(remote.stage&&!l2_meet_valid(&remote)){blocked(m,L2_INVALID);return false;}
  bool lp=local.stage&&local.stage<3,rp=remote.stage&&remote.stage<3;
  if(lp&&rp&&!same_proof(&local,&remote)){blocked(m,L2_REQUEST_CONFLICT);return false;}
  if(lp||rp){
   m->offered=lp?local:remote;m->view.method=m->view.remote_method=m->offered.method;m->agreed=m->offered;m->agreed.stage=0;
   bool have=local.stage&&same_proof(&local,&m->offered),both=have&&remote.stage&&same_proof(&remote,&m->offered);
   if(have){m->agreed=local;m->mine=local;m->view.method=local.method;m->view.input_ready=true;m->view.local_confirmed=true;m->view.leader=true;}
   else m->view.leader=false;
   if(both){m->confirm_sent=true;m->view.matched=m->view.remote_confirmed=true;m->remote_stage=remote.stage;m->view.phase=L2P_EXCHANGING;}
  }else{
   uint8_t seeds[64],digest[32];bool first=memcmp(m->own_id,m->remote_id,16)<0;
   memcpy(seeds,first?m->own_id:m->remote_id,16);memcpy(seeds+16,first?m->arm:m->remote_arm,16);memcpy(seeds+32,first?m->remote_id:m->own_id,16);memcpy(seeds+48,first?m->remote_arm:m->arm,16);
   if(mbedtls_sha256(seeds,sizeof(seeds),digest,0)){blocked(m,L2_INVALID);return false;}memcpy(m->agreed.id,digest,16);
  }
  m->last_send_ms=0;return true;
 }
 if(!m->hello_seen||n<32||!pair_matches(m,b))return false;
 if(type==L2P_MSG_TAPS){if(n!=33||b[32]>8)return false;m->view.remote_taps=b[32];return true;}
 if(type==L2P_MSG_INPUT){
  if(n!=66||m->view.remote_method!=m->view.method)return false;
  l2_meet_t p;proof_read(&p,b+32);
  if(!l2_meet_valid(&p)||memcmp(p.id,m->agreed.id,16)||p.method!=m->view.method)return false;
  if(m->remote_input)return same_proof(&m->theirs,&p);
  m->theirs=p;m->remote_input=true;if(!m->view.leader){m->follow_at=m->now_ms;m->view.follow_ready=true;}refresh_match(m);return true;
 }
 if(type==L2P_MSG_CONFIRM){if(n!=66||!m->view.matched)return false;l2_meet_t p;proof_read(&p,b+32);if(!same_proof(&p,&m->agreed))return false;m->view.remote_confirmed=true;m->last_send_ms=0;return true;}
 if(type==L2P_MSG_DONE){
  if(n!=67||!m->view.local_confirmed||!m->view.remote_confirmed)return false;
  l2_meet_t p;proof_read(&p,b+32);if(!same_proof(&p,&m->agreed)||b[66]<1||b[66]>3)return false;
  if(b[66]>m->remote_stage)m->remote_stage=b[66];
  m->last_send_ms=0;return true;
 }
 return false;
}
void l2_peer_machine_poll(l2_peer_machine_t *m,uint32_t now){
 if(!m)return;
 m->now_ms=now;if(m->view.discoverable&&!m->started_ms)m->started_ms=now?now:1;
 if(!m->view.discoverable||m->view.phase==L2P_BLOCKED)return;
 if(!m->agreed.stage&&(uint32_t)(now-m->started_ms)>=15000){blocked(m,L2_STALE);m->view.discoverable=false;return;}
 if(!m->view.connected)return;
 if(m->last_tap_ms&&!m->view.input_ready&&now-m->last_tap_ms>=1200)finalize_input(m);
 if(m->follow_at&&!m->view.leader&&!m->view.input_ready&&now-m->follow_at>=5000){blocked(m,L2_STALE);return;}
 if(m->view.phase==L2P_BLOCKED)return;
 if(m->view.matched&&m->view.local_confirmed&&m->view.remote_confirmed&&m->confirm_sent){
  l2_status_t s=L2_OK;
  if(!m->agreed.stage){m->agreed.stage=1;memcpy(m->agreed.name,m->remote_name,25);memcpy(m->agreed.breed,m->remote_breed,17);
#ifdef ESP_PLATFORM
   extern bool local2_clock_now(uint64_t *);(void)local2_clock_now(&m->agreed.epoch_ms);
#endif
   s=l2_prepare_encounter(m->core,m->view.peer_id,&m->agreed);if(!accepted(s))m->agreed.stage=0;
  }
  if(accepted(s)&&m->agreed.stage==1&&m->remote_stage>=1){s=l2_commit_encounter(m->core,m->view.peer_id,m->agreed.id);if(accepted(s))m->agreed.stage=2;}
  if(accepted(s)&&m->agreed.stage==2&&m->remote_stage>=2){s=l2_settle_encounter(m->core,m->view.peer_id,m->agreed.id);if(accepted(s))m->agreed.stage=3;}
  if(!accepted(s)){if(s!=L2_QUEUE_FULL)blocked(m,s);else m->view.storage_status=s;return;}
  m->view.phase=m->agreed.stage>=3?(m->remote_stage>=3?L2P_COMPLETE:L2P_WAIT_DONE):L2P_EXCHANGING;
  if(m->agreed.stage>=3&&m->remote_stage>=3&&!m->view.complete){m->view.complete=true;m->view.complete_count++;m->completed_at=now;}
 }
 if(m->view.complete&&now-m->completed_at>=3000){m->view.discoverable=false;return;}
 if(m->last_send_ms&&now-m->last_send_ms<300)return;
 uint8_t b[L2_PEER_MESSAGE_MAX]={0},type;size_t n;
 if(!m->hello_seen||!m->hello_sent){
  type=L2P_MSG_HELLO;n=131;b[0]=3;memcpy(b+1,m->own_id,16);memcpy(b+17,m->nonce,16);memcpy(b+33,m->expected_token,4);memcpy(b+37,m->arm,16);b[53]=m->view.method;if(m->core->saved.has_snapshot){memcpy(b+89,m->core->saved.snapshot.pet.name,25);memcpy(b+114,m->core->saved.snapshot.pet.breed,17);}
  char id[33];hex_id(id,m->expected_id);l2_meet_t p={0};if(l2_get_encounter(m->core,id,&p)){proof_bytes(&p,b+54);b[88]=p.stage;}
 }else if(m->agreed.stage&&m->view.matched&&m->view.local_confirmed&&m->view.remote_confirmed&&m->confirm_sent){type=L2P_MSG_DONE;n=67;pair_bytes(m,b);proof_bytes(&m->agreed,b+32);b[66]=m->agreed.stage;}
 else if(m->view.input_ready&&!m->input_sent){type=L2P_MSG_INPUT;n=66;pair_bytes(m,b);proof_bytes(&m->mine,b+32);}
 else if(m->view.local_confirmed&&m->view.matched){type=L2P_MSG_CONFIRM;n=66;pair_bytes(m,b);proof_bytes(&m->agreed,b+32);}
 else if(m->view.input_ready){type=L2P_MSG_INPUT;n=66;pair_bytes(m,b);proof_bytes(&m->mine,b+32);}
 else {type=L2P_MSG_TAPS;n=33;pair_bytes(m,b);b[32]=m->mine.count;}
 if(m->send(m->send_ctx,type,b,n)){m->last_send_ms=now?now:1;if(type==L2P_MSG_HELLO)m->hello_sent=true;if(type==L2P_MSG_INPUT)m->input_sent=true;if(type==L2P_MSG_CONFIRM)m->confirm_sent=true;}
}

#ifdef ESP_PLATFORM
#include "local2_store.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "host/ble_hs.h"
#include "host/ble_gap.h"
#include "host/ble_gatt.h"
#include "host/util/util.h"

/* New local-only UUIDs, deliberately distinct from phone, legacy peer and cloud. */
static const ble_uuid128_t peer_svc=BLE_UUID128_INIT(0x32,0x43,0x4f,0x4c,0x46,0x43,0xe5,0x9c,0x73,0x4b,0x4d,0x8f,0x00,0x21,0x3d,0x6f);
static const ble_uuid128_t peer_rx=BLE_UUID128_INIT(0x32,0x43,0x4f,0x4c,0x46,0x43,0xe5,0x9c,0x73,0x4b,0x4d,0x8f,0x01,0x21,0x3d,0x6f);
static const ble_uuid128_t peer_tx=BLE_UUID128_INIT(0x32,0x43,0x4f,0x4c,0x46,0x43,0xe5,0x9c,0x73,0x4b,0x4d,0x8f,0x02,0x21,0x3d,0x6f);
static portMUX_TYPE peer_guard=portMUX_INITIALIZER_UNLOCKED;
static l2_peer_machine_t machine;
static l2_peer_view_t public_view;
static QueueHandle_t commands;
typedef struct {bool enable,confirm,tap,dots;uint8_t method,count,seq[9],nonce[16];uint32_t at;} peer_command_t;
static uint8_t advert[23],advert_size;static uint32_t advert_generation;
static bool enabled,central,connecting,read_pending,write_pending,ack_pending,ack_write_pending,scan_owned;
static uint16_t conn=BLE_HS_CONN_HANDLE_NONE,remote_rx,remote_tx;
static ble_addr_t selected_addr;
static bool selected;
static uint8_t selected_id[16],selected_token[4],own_id[16];static uint32_t selected_at,connected_at,now_ms,link_gen,handled_link_gen;
/* 20B framing: schema2,type,sequence,page,sizeLE16,payload14. Inspired by the
 * reviewed legacy reliable framing only; no legacy identity/auth/cloud layer. */
static uint8_t tx[L2_PEER_MESSAGE_MAX],rx[L2_PEER_MESSAGE_MAX],last_rx[L2_PEER_MESSAGE_MAX];
static uint16_t tx_size,tx_offset,rx_size,rx_received,last_rx_size;
static uint8_t tx_type,tx_seq,rx_type,rx_seq,last_rx_seq,last_rx_type;
static bool rx_ready,last_ack_valid;static uint8_t ack_frame[20],last_ack[20];
static int peer_gap(struct ble_gap_event *,void *);
static void transport_reset(void) {
    remote_rx=remote_tx=0;read_pending=write_pending=ack_pending=ack_write_pending=false;
    tx_size=tx_offset=rx_size=rx_received=last_rx_size=0;tx_type=tx_seq=rx_type=rx_seq=last_rx_seq=last_rx_type=0;
    rx_ready=last_ack_valid=false;memset(rx,0,sizeof(rx));memset(tx,0,sizeof(tx));
}
static bool receive_frame(const uint8_t *b,size_t n) {
    if(n!=20||b[0]!=2||!b[1]||!b[2])return false;
    unsigned size=b[4]|(unsigned)b[5]<<8,offset=b[3]*14u;
    if(!size||size>L2_PEER_MESSAGE_MAX||offset>=size)return false;
    unsigned count=size-offset;if(count>14)count=14;
    for(unsigned i=6+count;i<20;i++)if(b[i])return false;
    if(b[2]==last_rx_seq)return b[1]==last_rx_type&&size==last_rx_size&&!memcmp(last_rx+offset,b+6,count);
    if(last_rx_seq==255||b[2]!=(uint8_t)(last_rx_seq+1)||rx_ready)return false;
    if(!offset&&!rx_received){rx_type=b[1];rx_seq=b[2];rx_size=(uint16_t)size;}
    if(rx_type!=b[1]||rx_seq!=b[2]||rx_size!=size)return false;
    if(offset<rx_received)return offset+count<=rx_received&&!memcmp(rx+offset,b+6,count);
    if(offset!=rx_received)return false;
    memcpy(rx+offset,b+6,count);rx_received+=(uint16_t)count;
    if(rx_received==rx_size){rx_ready=true;last_rx_seq=rx_seq;last_rx_type=rx_type;last_rx_size=rx_size;memcpy(last_rx,rx,rx_size);}return true;
}
static bool tx_frame(uint8_t b[20]) {
    if(!tx_size)return false;
    memset(b,0,20);b[0]=2;b[1]=tx_type;b[2]=tx_seq;b[3]=(uint8_t)(tx_offset/14);b[4]=(uint8_t)tx_size;b[5]=(uint8_t)(tx_size>>8);
    unsigned n=tx_size-tx_offset;if(n>14)n=14;memcpy(b+6,tx+tx_offset,n);return true;
}
static void tx_advance(void) {unsigned n=tx_size-tx_offset;if(n>14)n=14;tx_offset+=(uint16_t)n;if(tx_offset==tx_size)tx_offset=tx_size=0;}
static bool queue_message(void *ctx,uint8_t type,const uint8_t *b,size_t n) {
    (void)ctx;bool ok;
    portENTER_CRITICAL(&peer_guard);ok=enabled&&conn!=BLE_HS_CONN_HANDLE_NONE&&!tx_size&&tx_seq<250;
    if(ok){memcpy(tx,b,n);tx_type=type;tx_size=(uint16_t)n;tx_offset=0;tx_seq++;}
    portEXIT_CRITICAL(&peer_guard);return ok;
}
static int peer_access(uint16_t handle,uint16_t attr,struct ble_gatt_access_ctxt *ct,void *ctx) {
    (void)attr;uint8_t b[20];uint16_t length=0;int result=BLE_ATT_ERR_UNLIKELY;
    portENTER_CRITICAL(&peer_guard);bool valid=enabled&&handle==conn&&!central;
    if(valid&&ct->op==BLE_GATT_ACCESS_OP_READ_CHR){bool available=tx_frame(b);portEXIT_CRITICAL(&peer_guard);return available?(os_mbuf_append(ct->om,b,20)?BLE_ATT_ERR_INSUFFICIENT_RES:0):BLE_ATT_ERR_UNLIKELY;}
    portEXIT_CRITICAL(&peer_guard);
    if(!valid||ct->op!=BLE_GATT_ACCESS_OP_WRITE_CHR)return result;
    if(OS_MBUF_PKTLEN(ct->om)!=20||ble_hs_mbuf_to_flat(ct->om,b,20,&length)||length!=20)return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    portENTER_CRITICAL(&peer_guard);
    if(enabled&&handle==conn){
        if(b[0]==2&&b[1]==0){bool zeros=true;for(unsigned i=6;i<20;i++)if(b[i])zeros=false;
            if(zeros&&tx_size&&b[2]==tx_seq&&b[3]==tx_offset/14&&(b[4]|(unsigned)b[5]<<8)==tx_size){memcpy(last_ack,b,20);last_ack_valid=true;tx_advance();result=0;}
            else if(last_ack_valid&&!memcmp(last_ack,b,20))result=0;
        }else result=receive_frame(b,20)?0:BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    }
    portEXIT_CRITICAL(&peer_guard);return result;
}
static const struct ble_gatt_svc_def peer_services[]={
    {.type=BLE_GATT_SVC_TYPE_PRIMARY,.uuid=&peer_svc.u,.characteristics=(struct ble_gatt_chr_def[]){
        {.uuid=&peer_rx.u,.access_cb=peer_access,.flags=BLE_GATT_CHR_F_WRITE},
        {.uuid=&peer_tx.u,.access_cb=peer_access,.flags=BLE_GATT_CHR_F_READ},{0}}},{0}};
static int found_chr(uint16_t h,const struct ble_gatt_error *e,const struct ble_gatt_chr *c,void *ctx) {
    if(e->status||!c)return 0;
    portENTER_CRITICAL(&peer_guard);
    if(h==conn&&(uint32_t)(uintptr_t)ctx==link_gen){if(!ble_uuid_cmp(&c->uuid.u,&peer_rx.u))remote_rx=c->val_handle;if(!ble_uuid_cmp(&c->uuid.u,&peer_tx.u))remote_tx=c->val_handle;}
    portEXIT_CRITICAL(&peer_guard);return 0;
}
static int found_svc(uint16_t h,const struct ble_gatt_error *e,const struct ble_gatt_svc *s,void *ctx) {
    portENTER_CRITICAL(&peer_guard);bool valid=h==conn&&(uint32_t)(uintptr_t)ctx==link_gen;portEXIT_CRITICAL(&peer_guard);if(valid&&!e->status&&s)(void)ble_gattc_disc_all_chrs(h,s->start_handle,s->end_handle,found_chr,ctx);return 0;
}
bool local2_peer_gap_event(struct ble_gap_event *e) {
    if(e->type==BLE_GAP_EVENT_DISC){
        struct ble_hs_adv_fields f;if(e->disc.rssi < -65||ble_hs_adv_parse_fields(&f,e->disc.data,e->disc.length_data)||f.mfg_data_len!=23)return false;
        const uint8_t *b=f.mfg_data;if(b[0]!=0xff||b[1]!=0xff||b[2]!=3||!nonzero(b+3,16)||!memcmp(b+3,own_id,16))return false;
        portENTER_CRITICAL(&peer_guard);
        if(enabled&&conn==BLE_HS_CONN_HANDLE_NONE&&!connecting&&(!selected||!memcmp(selected_id,b+3,16)||memcmp(b+3,selected_id,16)<0)) {
            if(!selected||memcmp(selected_id,b+3,16)||memcmp(selected_token,b+19,4)){selected_at=now_ms;memcpy(selected_id,b+3,16);memcpy(selected_token,b+19,4);}
            selected=true;selected_addr=e->disc.addr;central=memcmp(own_id,selected_id,16)<0;
        }
        portEXIT_CRITICAL(&peer_guard);return true;
    }
    if(e->type==BLE_GAP_EVENT_CONNECT){
        if(e->connect.status){portENTER_CRITICAL(&peer_guard);bool ours=connecting;connecting=false;portEXIT_CRITICAL(&peer_guard);return ours;}
        struct ble_gap_conn_desc d;if(ble_gap_conn_find(e->connect.conn_handle,&d))return false;
        portENTER_CRITICAL(&peer_guard);
        bool ours=enabled&&selected&&!memcmp(selected_addr.val,d.peer_ota_addr.val,6);
        bool duplicate=ours&&conn!=BLE_HS_CONN_HANDLE_NONE;
        if(ours&&!duplicate){conn=e->connect.conn_handle;connected_at=now_ms;connecting=false;transport_reset();link_gen++;}
        uint32_t generation=link_gen;bool discover=ours&&!duplicate&&central;portEXIT_CRITICAL(&peer_guard);
        if(duplicate)(void)ble_gap_terminate(e->connect.conn_handle,BLE_ERR_REM_USER_CONN_TERM);
        if(discover)(void)ble_gattc_disc_svc_by_uuid(e->connect.conn_handle,&peer_svc.u,found_svc,(void *)(uintptr_t)generation);
        return ours;
    }
    if(e->type==BLE_GAP_EVENT_DISCONNECT){portENTER_CRITICAL(&peer_guard);bool ours=e->disconnect.conn.conn_handle==conn;
        if(ours){conn=BLE_HS_CONN_HANDLE_NONE;connecting=false;transport_reset();link_gen++;selected=false;}
        portEXIT_CRITICAL(&peer_guard);return ours;}
    return false;
}
static int peer_gap(struct ble_gap_event *e,void *ctx) {(void)ctx;(void)local2_peer_gap_event(e);return 0;}
static int write_done(uint16_t h,const struct ble_gatt_error *e,struct ble_gatt_attr *a,void *ctx) {
    (void)a;portENTER_CRITICAL(&peer_guard);if(h==conn&&(uint32_t)(uintptr_t)ctx==link_gen&&write_pending){write_pending=false;if(!e->status&&tx_size)tx_advance();}portEXIT_CRITICAL(&peer_guard);return 0;
}
static int read_done(uint16_t h,const struct ble_gatt_error *e,struct ble_gatt_attr *a,void *ctx) {
    uint8_t b[20];uint16_t n=0;bool valid=!e->status&&a&&OS_MBUF_PKTLEN(a->om)==20&&!ble_hs_mbuf_to_flat(a->om,b,20,&n)&&n==20;
    portENTER_CRITICAL(&peer_guard);if(h==conn&&(uint32_t)(uintptr_t)ctx==link_gen&&read_pending){read_pending=false;if(valid&&receive_frame(b,20)){memcpy(ack_frame,b,20);ack_frame[1]=0;memset(ack_frame+6,0,14);ack_pending=true;}}portEXIT_CRITICAL(&peer_guard);return 0;
}
static int ack_done(uint16_t h,const struct ble_gatt_error *e,struct ble_gatt_attr *a,void *ctx) {
    (void)a;portENTER_CRITICAL(&peer_guard);if(h==conn&&(uint32_t)(uintptr_t)ctx==link_gen&&ack_write_pending){ack_write_pending=false;if(!e->status)ack_pending=false;}portEXIT_CRITICAL(&peer_guard);return 0;
}
static void transport_poll(void) {
    uint8_t bytes[20],ack[20],addr_type;uint16_t h,wh,rh;bool write=false,read=false,send_ack=false,scan=false,connect=false,rotate=false;uint32_t generation;ble_addr_t address;
    portENTER_CRITICAL(&peer_guard);h=conn;wh=remote_rx;rh=remote_tx;generation=link_gen;rotate=h!=BLE_HS_CONN_HANDLE_NONE&&((tx_seq>=250&&!tx_size)||(central&&(!wh||!rh)&&(uint32_t)(now_ms-connected_at)>10000));
    if(enabled&&central&&h!=BLE_HS_CONN_HANDLE_NONE&&wh&&rh){
        if(ack_pending&&!write_pending&&!ack_write_pending){memcpy(ack,ack_frame,20);ack_write_pending=send_ack=true;}
        else if(!ack_write_pending&&!write_pending&&tx_frame(bytes))write_pending=write=true;
        if(!ack_pending&&!ack_write_pending&&!read_pending&&!rx_ready)read_pending=read=true;
    }
    connect=enabled&&selected&&central&&h==BLE_HS_CONN_HANDLE_NONE&&!connecting&&(uint32_t)(now_ms-selected_at)>=500;
    if(connect){connecting=true;address=selected_addr;}
    scan=enabled&&h==BLE_HS_CONN_HANDLE_NONE&&!connecting;portEXIT_CRITICAL(&peer_guard);
    if(send_ack&&ble_gattc_write_flat(h,wh,ack,20,ack_done,(void *)(uintptr_t)generation)){portENTER_CRITICAL(&peer_guard);if(generation==link_gen)ack_write_pending=false;portEXIT_CRITICAL(&peer_guard);}
    if(write&&ble_gattc_write_flat(h,wh,bytes,20,write_done,(void *)(uintptr_t)generation)){portENTER_CRITICAL(&peer_guard);if(generation==link_gen)write_pending=false;portEXIT_CRITICAL(&peer_guard);}
    if(read&&ble_gattc_read(h,rh,read_done,(void *)(uintptr_t)generation)){portENTER_CRITICAL(&peer_guard);if(generation==link_gen)read_pending=false;portEXIT_CRITICAL(&peer_guard);}
    if(rotate)(void)ble_gap_terminate(h,BLE_ERR_REM_USER_CONN_TERM);
    if(connect){if(scan_owned){(void)ble_gap_disc_cancel();scan_owned=false;}if(ble_hs_id_infer_auto(0,&addr_type)||ble_gap_connect(addr_type,&address,5000,NULL,peer_gap,NULL)){portENTER_CRITICAL(&peer_guard);connecting=false;selected=false;portEXIT_CRITICAL(&peer_guard);}}
    else if(scan&&!ble_gap_disc_active()&&!ble_hs_id_infer_auto(0,&addr_type)){struct ble_gap_disc_params p={0};p.passive=0;p.filter_duplicates=0;scan_owned=ble_gap_disc(addr_type,1000,&p,peer_gap,NULL)==0;}
}
esp_err_t local2_peer_register(l2_core_t *core) {
    if(!core||commands)return ESP_ERR_INVALID_STATE;
    if(!l2_peer_machine_init(&machine,core,queue_message,NULL))return ESP_ERR_INVALID_STATE;
    memcpy(own_id,machine.own_id,16);commands=xQueueCreate(8,sizeof(peer_command_t));if(!commands)return ESP_ERR_NO_MEM;
    return ble_gatts_count_cfg(peer_services)||ble_gatts_add_svcs(peer_services)?ESP_FAIL:ESP_OK;
}
void local2_peer_set_discoverable(bool on) {if(commands){peer_command_t cmd={.enable=on};if(on)esp_fill_random(cmd.nonce,16);(void)xQueueSend(commands,&cmd,0);}}
void local2_peer_start(uint8_t method){if(commands&&(method==1||method==2)){peer_command_t cmd={.enable=true,.method=method};esp_fill_random(cmd.nonce,16);(void)xQueueSend(commands,&cmd,0);}}
void local2_peer_tap(uint32_t now){if(commands){(void)now;peer_command_t cmd={.tap=true,.at=(uint32_t)(esp_timer_get_time()/1000)};(void)xQueueSend(commands,&cmd,0);}}
void local2_peer_dots(const uint8_t *seq,uint8_t count){if(commands&&seq&&count>=4&&count<=9){peer_command_t cmd={.dots=true,.count=count};memcpy(cmd.seq,seq,count);(void)xQueueSend(commands,&cmd,0);}}
void local2_peer_confirm(void) {if(commands){peer_command_t cmd={.confirm=true};(void)xQueueSend(commands,&cmd,0);}}
void local2_peer_get_view(l2_peer_view_t *view) {if(view){portENTER_CRITICAL(&peer_guard);*view=public_view;portEXIT_CRITICAL(&peer_guard);}}
size_t local2_peer_advertisement(uint8_t out[23]) {portENTER_CRITICAL(&peer_guard);size_t n=advert_size;if(out&&n)memcpy(out,advert,n);portEXIT_CRITICAL(&peer_guard);return n;}
uint32_t local2_peer_advertisement_generation(void) {portENTER_CRITICAL(&peer_guard);uint32_t n=advert_generation;portEXIT_CRITICAL(&peer_guard);return n;}
void local2_peer_poll(uint32_t now) {
    if(!commands)return;
    portENTER_CRITICAL(&peer_guard);now_ms=now;portEXIT_CRITICAL(&peer_guard);
    l2_core_t *core=l2_runtime_core(0);if(!core)return;machine.core=core;
    peer_command_t cmd;uint16_t close_handle=BLE_HS_CONN_HANDLE_NONE;bool stop_scan=false;
    while(xQueueReceive(commands,&cmd,0)==pdTRUE){
        if(cmd.confirm){(void)l2_peer_machine_confirm(&machine);continue;}
        if(cmd.tap){l2_peer_machine_tap(&machine,cmd.at);continue;}
        if(cmd.dots){l2_peer_machine_dots(&machine,cmd.seq,cmd.count);continue;}
        if(!l2_peer_machine_enable(&machine,cmd.enable,cmd.nonce))continue;
        machine.view.method=cmd.method?cmd.method:1;machine.started_ms=now?now:1;
        portENTER_CRITICAL(&peer_guard);uint16_t old=conn;enabled=cmd.enable;connecting=false;selected=false;conn=BLE_HS_CONN_HANDLE_NONE;transport_reset();
        advert_size=(uint8_t)l2_peer_machine_advertisement(&machine,advert,sizeof(advert));advert_generation++;link_gen++;handled_link_gen=link_gen;portEXIT_CRITICAL(&peer_guard);
        stop_scan=true;if(old!=BLE_HS_CONN_HANDLE_NONE)close_handle=old;
    }
    uint8_t id[16],token[4],message[L2_PEER_MESSAGE_MAX],type=0;size_t size=0;bool link_change,link_up;
    portENTER_CRITICAL(&peer_guard);link_change=link_gen!=handled_link_gen;handled_link_gen=link_gen;link_up=enabled&&conn!=BLE_HS_CONN_HANDLE_NONE;
    memcpy(id,selected_id,16);memcpy(token,selected_token,4);
    if(rx_ready){type=rx_type;size=rx_size;memcpy(message,rx,size);rx_ready=false;rx_size=rx_received=0;}
    portEXIT_CRITICAL(&peer_guard);
    if(link_change){
        /* Keep the advertised 32-bit rendezvous token, but replace the full
         * session challenge tail on EVERY connection so prior confirmations
         * cannot be replayed after a disconnect while discovery stays on. */
        if(link_up)esp_fill_random(machine.nonce+4,12);
        l2_peer_machine_link(&machine,link_up,id,token);
    }
    if(size)(void)l2_peer_machine_receive(&machine,type,message,size);
    l2_peer_machine_poll(&machine,now);
    if(!machine.view.discoverable&&enabled){machine.view.connected=false;portENTER_CRITICAL(&peer_guard);enabled=false;advert_size=0;advert_generation++;close_handle=conn;conn=BLE_HS_CONN_HANDLE_NONE;selected=false;link_gen++;handled_link_gen=link_gen;transport_reset();portEXIT_CRITICAL(&peer_guard);stop_scan=true;}
    portENTER_CRITICAL(&peer_guard);public_view=machine.view;portEXIT_CRITICAL(&peer_guard);
    l2_runtime_release();
    if(stop_scan&&scan_owned){(void)ble_gap_disc_cancel();scan_owned=false;}
    if(close_handle!=BLE_HS_CONN_HANDLE_NONE)(void)ble_gap_terminate(close_handle,BLE_ERR_REM_USER_CONN_TERM);
    transport_poll();
}
#endif
