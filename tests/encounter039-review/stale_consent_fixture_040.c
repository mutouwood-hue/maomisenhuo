/* virtual_fixture: actual pure FSM+core and verbatim production API/poll;
 * platform queue/store/link globals and radio scheduler are explicit substitutes. */
#include "local2_core.h"
#include "local2_peer.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include "/Users/zoumutou/coding/猫咪森活/artifacts/firmware-local-v4-encounter040/evidence/wire-window-r1/local2_peer.c"
typedef int QueueHandle_t;
typedef struct {bool enable,confirm;uint8_t nonce[16];l2_peer_confirm_token_t token;} peer_command_t;
static QueueHandle_t commands=1;static peer_command_t queued;static bool has_queued;
static int xQueueSend(QueueHandle_t q,const peer_command_t *p,int wait){(void)q;(void)wait;queued=*p;has_queued=true;return 1;}
static int xQueueReceive(QueueHandle_t q,peer_command_t *p,int wait){(void)q;(void)wait;if(!has_queued)return 0;*p=queued;has_queued=false;return 1;}
#define portENTER_CRITICAL(p) ((void)0)
#define portEXIT_CRITICAL(p) ((void)0)
#define BLE_HS_CONN_HANDLE_NONE 65535
#define BLE_ERR_REM_USER_CONN_TERM 19
#define pdTRUE 1
static l2_core_t core;static l2_peer_machine_t machine;static l2_peer_view_t public_view;
static bool enabled=true,connecting,selected=true,scan_owned,rx_ready;static uint16_t conn=7,rx_size,rx_received;static uint32_t now_ms,link_gen=1,handled_link_gen=1,advert_generation;static uint8_t selected_id[16],selected_token[4],rx[224],rx_type,advert[23],advert_size;
static unsigned persist_count;static unsigned consent_before;static unsigned char disk[L2_STORE_MAX];static size_t disk_size;
static bool store(void *p,const uint8_t *b,size_t n){(void)p;memcpy(disk,b,n);disk_size=n;persist_count++;return true;}
l2_core_t *l2_runtime_core(uint32_t t){(void)t;return &core;}void l2_runtime_release(void){}
static void transport_reset(void){rx_ready=false;rx_size=rx_received=0;}
static void esp_fill_random(void *p,size_t n){memset(p,0x91,n);}
static void local2_clock_now(uint64_t *ms){*ms=0;}
static int ble_gap_disc_cancel(void){return 0;}
static int ble_gap_terminate(uint16_t c,int why){(void)c;(void)why;return 0;}
static void transport_poll(void){}
#include "pinned-platform-functions-040.inc"
static bool send_stub(void *p,uint8_t t,const uint8_t *b,size_t n){(void)p;(void)t;(void)b;(void)n;return true;}
int main(int argc,char **argv){
 assert(argc==2);assert(l2_init_new(&core,"11111111111111111111111111111111",store,NULL)==L2_OK);
 l2_snapshot_t s={0};s.revision=1;strcpy(s.pet.pet_id,"pet-a");strcpy(s.pet.name,"cat");strcpy(s.pet.breed,"orange");l2_request_t r={0};strcpy(r.client_id,"11111111-2222-4333-8444-555555555555");strcpy(r.request_id,"initial");r.seq=1;assert(l2_set_snapshot(&core,&r,&s)==L2_OK);
 uint8_t nonce[16];memset(nonce,0xa1,16);memset(selected_id,0x22,16);memset(selected_token,0xb1,4);assert(l2_peer_machine_init(&machine,&core,send_stub,NULL));assert(l2_peer_machine_enable(&machine,true,nonce));l2_peer_machine_link(&machine,true,selected_id,selected_token);
 uint8_t hello[110]={0};hello[0]=3;memcpy(hello+1,selected_id,16);memset(hello+17,0xb1,16);memcpy(hello+33,nonce,4);hello[37]=5;memcpy(hello+38,"pet-b",5);put64(hello+43,2);assert(l2_peer_machine_receive(&machine,L2P_MSG_HELLO,hello,51));
 l2_encounter_view_t before;assert(l2_encounter_get(&core,"22222222222222222222222222222222",&before));assert(!(before.phases&L2E_LOCAL_CONSENT));unsigned count=persist_count;consent_before=before.phases;uint8_t previous_disk[L2_STORE_MAX];size_t previous_size=disk_size;memcpy(previous_disk,disk,disk_size);
 publish_view();l2_peer_confirm_token_t shown=public_view.confirm_token;assert(shown.valid);local2_peer_confirm(&shown);
 if(!strcmp(argv[1],"disconnect-before-poll")){conn=BLE_HS_CONN_HANDLE_NONE;selected=false;connecting=false;transport_reset();link_gen++;}
 else if(!strcmp(argv[1],"same-peer-new-generation")){conn=9;transport_reset();link_gen++;}
 else if(!strcmp(argv[1],"new-peer-before-poll")){conn=8;memset(selected_id,0x33,16);memset(selected_token,0xc1,4);transport_reset();link_gen++;}
 local2_peer_poll(1000);l2_encounter_view_t after;assert(l2_encounter_get(&core,"22222222222222222222222222222222",&after));l2_core_t *loaded=calloc(1,sizeof(*loaded));assert(loaded);assert(l2_load(loaded,disk,disk_size,store,NULL)==L2_OK);l2_encounter_view_t saved;assert(l2_encounter_get(loaded,"22222222222222222222222222222222",&saved));
 if(!strcmp(argv[1],"still-connected")){assert((saved.phases&L2E_LOCAL_CONSENT)&&persist_count-count==1);}else{assert(!(saved.phases&L2E_LOCAL_CONSENT));assert(persist_count==count);assert(after.phases==consent_before);assert(disk_size==previous_size&&!memcmp(disk,previous_disk,disk_size));assert(core.saved.last_request.seq==1&&core.saved.event_count==0&&core.saved.binding_count==1);}
 printf("{\"case\":\"%s\",\"durableConsent\":%s,\"persistDelta\":%u,\"physicalConnAtPoll\":%u,\"machineConnectedAfterPoll\":%s,\"bindingPeer\":\"%s\",\"generation\":%u}\n",argv[1],(saved.phases&L2E_LOCAL_CONSENT)?"true":"false",persist_count-count,conn,machine.view.connected?"true":"false",after.peer_id,link_gen);free(loaded);return 0;
}
