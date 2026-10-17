/* Behavioral regression: include the real production transport, not a copy. */
#include "baji_link.h"
#include "sdk.h"
#include <stdio.h>
#include <stdlib.h>
static unsigned checks;
#define CHECK(x) do { checks++; if(!(x)){fprintf(stderr,"FAIL %s:%d: %s\n",__FILE__,__LINE__,#x);exit(1);} } while(0)
static bool counted_dispatch(bj_link_t *l,bj_controller_t *c,const bj_power_view_t *p,const uint8_t *in,size_t n,uint8_t out[20]) {
    CHECK(mock.depth==1);mock.dispatch_calls++;return bj_link_dispatch(l,c,p,in,n,out);
}
#define bj_link_dispatch counted_dispatch
#include "../runtime/baji_ble.c"
#undef bj_link_dispatch
static bj_link_t test_link;
static bj_controller_t test_controller;
static void reset_fixture(void) {
    memset(&mock,0,sizeof(mock));mock.task_result=pdPASS;
    memset(&rx,0,sizeof(rx));memset(&tx,0,sizeof(tx));
    atomic_store(&attempted,false);start_result=ESP_ERR_INVALID_STATE;
    connection=BLE_HS_CONN_HANDLE_NONE;tx_handle=0;generation=0;
    subscribed=synced=state_pending=has_state=false;own_address=ack_burst=0;
    memset(state_wire,0,sizeof(state_wire));memset(&service_timer,0,sizeof(service_timer));
    memset(&ble_hs_cfg,0,sizeof(ble_hs_cfg));
    const uint8_t id[6]={1,2,3,4,5,6};bj_link_init(&test_link,id);bj_controller_init(&test_controller);
}
static void connect_peer(uint16_t handle) {
    struct ble_gap_event e={.type=BLE_GAP_EVENT_CONNECT,.connect={.status=0,.conn_handle=handle}};
    CHECK(gap_event(&e,NULL)==0);
}
static void subscribe_peer(uint16_t handle,uint16_t attr,bool enable) {
    struct ble_gap_event e={.type=BLE_GAP_EVENT_SUBSCRIBE,.subscribe={.conn_handle=handle,.attr_handle=attr,.cur_notify=enable}};
    CHECK(gap_event(&e,NULL)==0);
}
static void disconnect_peer(uint16_t handle) {
    struct ble_gap_event e={.type=BLE_GAP_EVENT_DISCONNECT,.disconnect={.conn={.conn_handle=handle}}};
    CHECK(gap_event(&e,NULL)==0);
}
static void ready(void) {reset_fixture();CHECK(bj_ble_start()==ESP_OK);connect_peer(7);subscribe_peer(7,tx_handle,true);}
static int write_request(uint16_t conn,uint8_t op,uint8_t seq) {
    bj_packet_t p={.opcode=op,.sequence=seq};struct os_mbuf om={.length=20};
    CHECK(bj_packet_encode(&p,om.bytes));
    struct ble_gatt_access_ctxt ctx={.op=BLE_GATT_ACCESS_OP_WRITE_CHR,.om=&om};
    return access_characteristic(conn,0,&ctx,NULL);
}
static void pump(void) {bj_ble_pump(&test_link,&test_controller,NULL);CHECK(mock.depth==0);}
static void tick_once(void) {CHECK(service_timer.callback!=NULL);service_timer.callback(NULL);CHECK(mock.depth==0);}
static bj_packet_t sent_packet(unsigned i) {bj_packet_t p;CHECK(i<mock.sent_count);CHECK(bj_packet_decode(mock.sent[i],20,&p));return p;}
static void test_notify_retention(void) {
    ready();CHECK(write_request(7,3,11)==0);pump();CHECK(mock.dispatch_calls==1);CHECK(test_controller.scene.local_experience);
    uint8_t expected[20];memcpy(expected,tx.items[tx.head].bytes,20);bj_scene_t mutated=test_controller.scene;
    mock.alloc_failures=2;
    for(unsigned i=0;i<2;i++){tick_once();pump();CHECK(tx.count==1);CHECK(mock.notify_calls==0);CHECK(mock.dispatch_calls==1);CHECK(memcmp(&mutated,&test_controller.scene,sizeof(mutated))==0);}
    mock.notify_failures=2;
    for(unsigned i=0;i<2;i++){tick_once();pump();CHECK(tx.count==1);CHECK(mock.sent_count==0);CHECK(mock.dispatch_calls==1);CHECK(memcmp(expected,tx.items[tx.head].bytes,20)==0);}
    tick_once();CHECK(tx.count==0);CHECK(mock.sent_count==1);CHECK(memcmp(mock.sent[0],expected,20)==0);CHECK(sent_packet(0).sequence==11);CHECK(mock.dispatch_calls==1);
    tick_once();CHECK(sent_packet(1).opcode==0x81);CHECK(!state_pending);
    puts("PASS notify allocation/send failures retain ACK and never redispatch mutation");
}
static void test_bounded_fairness(void) {
    ready();unsigned ack_run=0,state_run=0,acks=0,states=0;uint8_t sequence=1;
    /* Continuous incoming ACK work + state changes at every pump. */
    for(unsigned i=0;i<60;i++) {
        int admitted=write_request(7,4,sequence);
        CHECK(admitted==0 || admitted==BLE_ATT_ERR_INSUFFICIENT_RES);
        if(admitted==0)sequence++;
        test_controller.scene.step=(uint8_t)i;pump();
        unsigned before=mock.sent_count;tick_once();CHECK(mock.sent_count==before+1);
        bj_packet_t p=sent_packet(before);
        if(p.opcode==0x80){acks++;ack_run++;state_run=0;CHECK(ack_run<=2);}
        else {CHECK(p.opcode==0x81);states++;state_run++;ack_run=0;CHECK(state_run<=1);}
        /* Admission is bounded by queue backpressure, not a dropped ACK. */
        CHECK(rx.count<=QUEUE_CAP && tx.count<=QUEUE_CAP);
    }
    CHECK(acks==40);CHECK(states==20);CHECK(mock.dispatch_calls+rx.count==(unsigned)(sequence-1));
    /* Stop state changes: all accepted ACKs must drain in sequence exactly once. */
    for(unsigned i=0;i<40 && (rx.count || tx.count || state_pending);i++){pump();tick_once();}
    CHECK(rx.count==0 && tx.count==0);CHECK(mock.dispatch_calls==(unsigned)(sequence-1));
    unsigned expected=1;
    for(unsigned i=0;i<mock.sent_count;i++){bj_packet_t p=sent_packet(i);if(p.opcode==0x80){CHECK(p.sequence==expected);expected++;}}
    CHECK(expected==sequence);
    puts("PASS continuous ACK/state traffic: max two ACKs, max one state, FIFO no loss");
}
static void test_queue_full(void) {
    ready();for(unsigned i=1;i<=8;i++)CHECK(write_request(7,4,(uint8_t)i)==0);
    CHECK(write_request(7,4,9)==BLE_ATT_ERR_INSUFFICIENT_RES);CHECK(rx.count==8);CHECK(mock.dispatch_calls==0);
    for(unsigned i=0;i<4;i++){unsigned before=mock.dispatch_calls;pump();CHECK(mock.dispatch_calls==before+2);}
    CHECK(tx.count==8 && rx.count==0);
    for(unsigned i=9;i<=16;i++)CHECK(write_request(7,4,(uint8_t)i)==0);
    CHECK(write_request(7,4,17)==BLE_ATT_ERR_INSUFFICIENT_RES);pump();CHECK(mock.dispatch_calls==8 && rx.count==8);
    tick_once();CHECK(tx.count==7);pump();CHECK(mock.dispatch_calls==9 && tx.count==8 && rx.count==7);
    for(unsigned i=0;i<40 && (rx.count || tx.count || state_pending);i++){pump();tick_once();}
    CHECK(mock.dispatch_calls==16 && rx.count==0 && tx.count==0);
    unsigned expected=1;for(unsigned i=0;i<mock.sent_count;i++){bj_packet_t p=sent_packet(i);if(p.opcode==0x80)CHECK(p.sequence==expected++);}
    CHECK(expected==17);puts("PASS RX/TX full backpressure, pump budget, accepted ACK FIFO recovery");
}
static void test_generation_isolation(void) {
    ready();CHECK(write_request(8,3,1)==BLE_ATT_ERR_UNLIKELY);
    CHECK(write_request(7,4,2)==0);pump();CHECK(write_request(7,3,3)==0);
    unsigned old_generation=generation,dispatched=mock.dispatch_calls;
    /* Unrelated peer/attribute events must not reset the active generation. */
    subscribe_peer(8,tx_handle,false);subscribe_peer(7,tx_handle+1,false);disconnect_peer(8);
    CHECK(generation==old_generation && rx.count==1 && tx.count==1);
    connect_peer(8);CHECK(mock.terminate_calls==1 && connection==7 && generation==old_generation);
    disconnect_peer(7);CHECK(generation!=old_generation && !has_state && !subscribed && rx.count==0 && tx.count==0);
    connect_peer(7);CHECK(write_request(7,3,4)==BLE_ATT_ERR_UNLIKELY);pump();tick_once();CHECK(mock.sent_count==0 && mock.dispatch_calls==dispatched);CHECK(!test_controller.scene.local_experience);
    subscribe_peer(7,tx_handle,true);pump();tick_once();CHECK(sent_packet(0).opcode==0x81);
    CHECK(write_request(7,4,5)==0);pump();CHECK(write_request(7,3,6)==0);old_generation=generation;
    subscribe_peer(7,tx_handle,false);CHECK(generation!=old_generation && rx.count==0 && tx.count==0);CHECK(write_request(7,3,7)==BLE_ATT_ERR_UNLIKELY);
    tick_once();CHECK(mock.sent_count==1);subscribe_peer(7,tx_handle,true);pump();tick_once();CHECK(sent_packet(1).opcode==0x81);CHECK(!test_controller.scene.local_experience);
    /* A stale generation cannot dispatch or notify even if injected by the fixture. */
    message_t stale={.generation=generation-1};bj_packet_t req={.opcode=3,.sequence=8};CHECK(bj_packet_encode(&req,stale.bytes));CHECK(push(&rx,&stale));dispatched=mock.dispatch_calls;pump();CHECK(mock.dispatch_calls==dispatched);
    CHECK(push(&tx,&stale));tick_once();CHECK(mock.sent_count==2);
    on_reset(1);CHECK(connection==BLE_HS_CONN_HANDLE_NONE && !synced && !has_state && rx.count==0 && tx.count==0);
    puts("PASS disconnect/reconnect handle reuse, CCCD, unrelated events, stale generation isolation");
}
static void switch_generation_during_notify(void) {
    disconnect_peer(7);connect_peer(7);subscribe_peer(7,tx_handle,true);
    CHECK(write_request(7,4,99)==0);pump();
}
static void test_notify_completion_generation(void) {
    ready();CHECK(write_request(7,4,1)==0);pump();mock.notify_hook=switch_generation_during_notify;
    tick_once();CHECK(tx.count==1);CHECK(tx.items[tx.head].generation==generation);
    tick_once();CHECK(sent_packet(1).sequence==99);CHECK(tx.count==0);
    puts("PASS generation change during notify cannot pop new connection ACK");
}
static void test_host_failure(void) {
    reset_fixture();mock.task_result=pdFAIL;CHECK(bj_ble_start()==ESP_ERR_NO_MEM);
    CHECK(mock.init_calls==1 && mock.task_calls==1 && mock.stop_calls==1 && mock.callout_deinit_calls==1 && mock.deinit_calls==1);
    CHECK(mock.run_calls==0 && mock.delete_calls==0);
    mock.task_result=pdPASS;
    for(unsigned i=0;i<5;i++)CHECK(bj_ble_start()==ESP_ERR_NO_MEM);
    CHECK(mock.init_calls==1 && mock.task_calls==1 && mock.stop_calls==1 && mock.callout_deinit_calls==1 && mock.deinit_calls==1);
    connect_peer(7);subscribe_peer(7,tx_handle,true);CHECK(write_request(7,3,1)==0);pump();CHECK(mock.dispatch_calls==0 && !test_controller.scene.local_experience);
    puts("PASS host task-create failure: cleanup once, cached failure, no init retry or pump mutation");
}
static void test_state_retention_and_access(void) {
    ready();struct os_mbuf om={0};struct ble_gatt_access_ctxt ctx={.op=BLE_GATT_ACCESS_OP_READ_CHR,.om=&om};
    CHECK(access_characteristic(7,tx_handle,&ctx,NULL)==BLE_ATT_ERR_UNLIKELY);
    pump();CHECK(access_characteristic(8,tx_handle,&ctx,NULL)==BLE_ATT_ERR_UNLIKELY);
    CHECK(access_characteristic(7,tx_handle,&ctx,NULL)==0);CHECK(om.length==20);CHECK(memcmp(om.bytes,state_wire,20)==0);
    ctx.op=99;CHECK(access_characteristic(7,tx_handle,&ctx,NULL)==BLE_ATT_ERR_WRITE_NOT_PERMITTED);
    ctx.op=BLE_GATT_ACCESS_OP_WRITE_CHR;om.length=19;CHECK(access_characteristic(7,0,&ctx,NULL)==BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN);
    om.length=20;memset(om.bytes,0,20);CHECK(access_characteristic(7,0,&ctx,NULL)==BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN);CHECK(rx.count==0);
    mock.alloc_failures=1;tick_once();CHECK(state_pending && mock.sent_count==0);
    test_controller.scene.step=10;pump();mock.notify_failures=1;tick_once();CHECK(state_pending && mock.sent_count==0);
    test_controller.scene.step=11;pump();uint8_t latest[20];memcpy(latest,state_wire,20);
    tick_once();CHECK(mock.sent_count==1 && !state_pending);CHECK(memcmp(mock.sent[0],latest,20)==0);
    for(unsigned i=0;i<3;i++)tick_once();CHECK(mock.sent_count==1);
    puts("PASS state allocation/send retention, latest-state coalescing, GATT read/write validation");
}
static void test_start_failure_paths(void) {
    reset_fixture();mock.init_result=ESP_FAIL;CHECK(bj_ble_start()==ESP_FAIL);CHECK(bj_ble_start()==ESP_FAIL);CHECK(mock.init_calls==1 && mock.deinit_calls==0 && mock.task_calls==0);
    reset_fixture();mock.config_result=-1;CHECK(bj_ble_start()==ESP_FAIL);CHECK(bj_ble_start()==ESP_FAIL);CHECK(mock.init_calls==1 && mock.deinit_calls==1 && mock.task_calls==0);
    reset_fixture();mock.callout_init_result=-1;CHECK(bj_ble_start()==ESP_ERR_NO_MEM);CHECK(bj_ble_start()==ESP_ERR_NO_MEM);CHECK(mock.deinit_calls==1 && mock.callout_deinit_calls==0 && mock.task_calls==0);
    reset_fixture();mock.callout_reset_result=-1;CHECK(bj_ble_start()==ESP_FAIL);CHECK(bj_ble_start()==ESP_FAIL);CHECK(mock.deinit_calls==1 && mock.callout_deinit_calls==1 && mock.task_calls==0);
    ready();CHECK(bj_ble_start()==ESP_OK && mock.init_calls==1 && mock.task_calls==1);host_task(NULL);CHECK(mock.run_calls==1 && mock.delete_calls==1);
    puts("PASS startup init/config/callout failures, successful start idempotence and host exit");
}
static void test_data_worker_boundary(void) {
    ready();CHECK(write_request(7,6,77)==0);pump();CHECK(mock.dispatch_calls==0 && rx.count==1);
    uint8_t request[20],response[20];uint32_t epoch;
    CHECK(bj_ble_data_take(request,&epoch));CHECK(mock.depth==0 && rx.count==0 && request[3]==6);
    CHECK(bj_ble_data_current(epoch) && epoch==bj_ble_data_generation());
    bj_packet_t ack={.opcode=128,.sequence=77,.length=2,.payload={6,0}};CHECK(bj_packet_encode(&ack,response));
    CHECK(bj_ble_data_reply(response,epoch));tick_once();CHECK(sent_packet(0).sequence==77);
    CHECK(write_request(7,6,78)==0);CHECK(bj_ble_data_take(request,&epoch));disconnect_peer(7);
    CHECK(!bj_ble_data_current(epoch));CHECK(!bj_ble_data_reply(response,epoch));
    connect_peer(7);subscribe_peer(7,tx_handle,true);CHECK(!bj_ble_data_current(epoch));CHECK(!bj_ble_data_reply(response,epoch));
    CHECK(tx.count==0);CHECK(!bj_ble_data_take(request,&epoch));
    puts("PASS data worker dispatch boundary and stale generation ACK rejection");
}
int main(void) {
    test_notify_retention();test_bounded_fairness();test_queue_full();test_generation_isolation();
    test_notify_completion_generation();test_host_failure();test_state_retention_and_access();test_start_failure_paths();test_data_worker_boundary();
    printf("transport: %u checks, 0 failures (real production C + real core)\n",checks);return 0;
}
