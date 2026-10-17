#include "local2_core.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static unsigned checks;
#define CHECK(x) do{checks++;if(!(x)){fprintf(stderr,"FAIL %s:%d: %s\n",__FILE__,__LINE__,#x);exit(1);}}while(0)
static const char *ID="0123456789abcdef0123456789abcdef";
static const char *CLIENT="11111111-2222-4333-8444-555555555555";
typedef struct{uint8_t bytes[L2_STORE_MAX];size_t n;unsigned calls;int fail;} disk_t;
static disk_t disk;
static l2_core_t core,other;
static bool persist(void *arg,const uint8_t *b,size_t n){disk_t *d=arg;d->calls++;if(d->fail==1)return false;CHECK(n<=sizeof(d->bytes));memcpy(d->bytes,b,n);d->n=n;return d->fail!=2;}
static void fresh(void){memset(&core,0,sizeof(core));memset(&disk,0,sizeof(disk));CHECK(l2_init_new(&core,ID,persist,&disk)==L2_OK);}
static l2_request_t req(uint64_t seq){l2_request_t r={0};strcpy(r.client_id,CLIENT);snprintf(r.request_id,sizeof(r.request_id),"req-%llu",(unsigned long long)seq);r.seq=seq;for(unsigned i=0;i<32;i++)r.hash[i]=(uint8_t)(seq+i);return r;}
static l2_snapshot_t snapshot(uint64_t revision){l2_snapshot_t s={0};s.revision=revision;s.scene=L2_SCENE_HOME;s.action=L2_ACTION_IDLE;s.weather=L2_WEATHER_CLEAR;strcpy(s.pet.pet_id,"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");strcpy(s.pet.name,"小橘");strcpy(s.pet.breed,"orange");s.pet.food=10;s.pet.mood=20;s.pet.clean=30;s.pet.energy=40;s.pet.health=50;s.pet.coins=100;return s;}
static void bind(void){l2_request_t r=req(1);l2_snapshot_t s=snapshot(1);CHECK(l2_set_snapshot(&core,&r,&s)==L2_OK);}
static void restart(void){memset(&other,0,sizeof(other));CHECK(l2_load(&other,disk.bytes,disk.n,persist,&disk)==L2_OK);core=other;}
static l2_receipt_t receipt(unsigned peer,uint64_t count){l2_receipt_t r={0};snprintf(r.peer_id,sizeof(r.peer_id),"%032x",peer+100);r.counter=count;r.gift_kind=L2_GIFT_FLOWER;r.quantity=1;return r;}
static void test_snapshot(void){fresh();bind();l2_request_t q=req(1);l2_snapshot_t s=snapshot(1);unsigned writes=disk.calls;CHECK(l2_set_snapshot(&core,&q,&s)==L2_DUPLICATE);CHECK(disk.calls==writes);q.hash[0]^=1;CHECK(l2_set_snapshot(&core,&q,&s)==L2_REQUEST_CONFLICT);q=req(3);CHECK(l2_set_snapshot(&core,&q,&s)==L2_SEQUENCE_GAP);q=req(2);s.pet.food++;CHECK(l2_set_snapshot(&core,&q,&s)==L2_REVISION_CONFLICT);CHECK(core.saved.last_request.seq==1);s.revision=0;CHECK(l2_set_snapshot(&core,&q,&s)==L2_STALE);s=snapshot(2);s.pet.pet_id[0]='b';CHECK(l2_set_snapshot(&core,&q,&s)==L2_PET_MISMATCH);s=snapshot(2);q.client_id[0]='9';CHECK(l2_set_snapshot(&core,&q,&s)==L2_OWNER_CONFLICT);q=req(2);CHECK(l2_set_snapshot(&core,&q,&s)==L2_OK);q=req(1);CHECK(l2_set_snapshot(&core,&q,&s)==L2_STALE);restart();q=req(2);CHECK(l2_set_snapshot(&core,&q,&s)==L2_DUPLICATE);q=req(3);CHECK(l2_set_snapshot(&core,&q,&s)==L2_OK);CHECK(core.saved.last_request.seq==3);}
static void test_validation(void){fresh();l2_snapshot_t s=snapshot(1);l2_request_t r=req(1);s.pet.food=101;CHECK(l2_set_snapshot(&core,&r,&s)==L2_INVALID);s=snapshot(1);s.revision=L2_JS_MAX+1;CHECK(l2_set_snapshot(&core,&r,&s)==L2_INVALID);s=snapshot(1);s.pet.coins=L2_JS_MAX+1;CHECK(l2_set_snapshot(&core,&r,&s)==L2_INVALID);s=snapshot(1);s.has_epoch_ms=true;s.epoch_ms=L2_JS_MAX+1;CHECK(l2_set_snapshot(&core,&r,&s)==L2_INVALID);s=snapshot(1);s.scene=(l2_scene_t)4;CHECK(l2_set_snapshot(&core,&r,&s)==L2_INVALID);s=snapshot(1);s.weather=(l2_weather_t)3;CHECK(l2_set_snapshot(&core,&r,&s)==L2_INVALID);s=snapshot(1);memset(s.pet.name,'a',25);CHECK(l2_set_snapshot(&core,&r,&s)==L2_INVALID);s=snapshot(1);strcpy(s.pet.name,"\xc0\xaf");CHECK(l2_set_snapshot(&core,&r,&s)==L2_INVALID);strcpy(s.pet.name,"\xed\xa0\x80");CHECK(l2_set_snapshot(&core,&r,&s)==L2_INVALID);strcpy(s.pet.name,"\xf4\x90\x80\x80");CHECK(l2_set_snapshot(&core,&r,&s)==L2_INVALID);s=snapshot(1);memset(s.pet.breed,'x',17);CHECK(l2_set_snapshot(&core,&r,&s)==L2_INVALID);s=snapshot(L2_JS_MAX);s.pet.coins=L2_JS_MAX;s.has_epoch_ms=true;s.epoch_ms=L2_JS_MAX;CHECK(l2_set_snapshot(&core,&r,&s)==L2_OK);restart();CHECK(core.saved.snapshot.pet.coins==L2_JS_MAX);}
static void test_canonical(void){fresh();bind();l2_snapshot_t s=snapshot(1);memset(s.pet.name+strlen(s.pet.name)+1,0x55,sizeof(s.pet.name)-strlen(s.pet.name)-1);memset(s.pet.breed+7,0x66,sizeof(s.pet.breed)-7);s.epoch_ms=999999;/* ignored when has_epoch_ms=false */l2_request_t r=req(2);CHECK(l2_set_snapshot(&core,&r,&s)==L2_OK);}
static void test_care_fifo(void){fresh();bind();l2_snapshot_t before=core.saved.snapshot;for(unsigned i=0;i<L2_EVENT_MAX;i++)CHECK(l2_emit_care(&core,(l2_action_t)(L2_ACTION_PET+i%6),i)==L2_OK);CHECK(core.saved.event_count==200);CHECK(core.saved.next_event==201);CHECK(!memcmp(&before,&core.saved.snapshot,sizeof(before)));unsigned writes=disk.calls;CHECK(l2_emit_care(&core,L2_ACTION_PET,0)==L2_QUEUE_FULL);CHECK(disk.calls==writes);restart();l2_event_t e;CHECK(l2_peek_event(&core,&e));CHECK(e.counter==1);l2_request_t r=req(2);CHECK(l2_ack_event(&core,&r,2)==L2_ACK_MISMATCH);CHECK(l2_ack_event(&core,&r,999)==L2_ACK_MISMATCH);CHECK(l2_ack_event(&core,&r,0)==L2_INVALID);CHECK(l2_ack_event(&core,&r,1)==L2_OK);CHECK(core.saved.event_count==199);restart();CHECK(l2_ack_event(&core,&r,1)==L2_DUPLICATE);r=req(3);CHECK(l2_ack_event(&core,&r,1)==L2_OK);CHECK(core.saved.event_count==199);for(unsigned i=2;i<=200;i++){r=req(i+2);CHECK(l2_ack_event(&core,&r,i)==L2_OK);}CHECK(core.saved.event_count==0);CHECK(core.saved.last_ack==200);CHECK(l2_emit_care(&core,L2_ACTION_PET,0)==L2_OK);CHECK(core.saved.events[0].counter==201);}
static void test_failures(void){for(int fail=1;fail<=2;fail++){fresh();bind();size_t old=disk.n;uint8_t previous[L2_STORE_MAX];memcpy(previous,disk.bytes,old);disk.fail=fail;CHECK(l2_emit_care(&core,L2_ACTION_PET,123)==L2_STORAGE_ERROR);CHECK(core.saved.event_count==0);CHECK(core.saved.next_event==1);CHECK(core.storage_error);CHECK(l2_emit_care(&core,L2_ACTION_PET,123)==L2_STORAGE_ERROR);CHECK(l2_set_gift_state(&core,L2_GIFT_SHOWN)==L2_STORAGE_ERROR);if(fail==1){CHECK(disk.n==old);CHECK(!memcmp(previous,disk.bytes,old));}disk.fail=0;restart();CHECK(core.saved.event_count==(fail==2?1:0));CHECK(l2_emit_care(&core,L2_ACTION_PET,456)==L2_OK);CHECK(core.saved.events[core.saved.event_count-1].counter==(uint64_t)(fail==2?2:1));}
 fresh();bind();CHECK(l2_emit_care(&core,L2_ACTION_PET,0)==L2_OK);disk.fail=1;l2_request_t r=req(2);CHECK(l2_ack_event(&core,&r,1)==L2_STORAGE_ERROR);CHECK(core.saved.event_count==1);CHECK(core.saved.last_request.seq==1);disk.fail=0;restart();CHECK(l2_ack_event(&core,&r,1)==L2_OK);
 fresh();bind();l2_snapshot_t s=snapshot(2);r=req(2);disk.fail=1;CHECK(l2_set_snapshot(&core,&r,&s)==L2_STORAGE_ERROR);CHECK(core.saved.snapshot.revision==1);CHECK(core.saved.last_request.seq==1);disk.fail=0;restart();CHECK(l2_set_snapshot(&core,&r,&s)==L2_OK);}
static void test_gifts(void){fresh();bind();l2_receipt_t g=receipt(0,7);CHECK(l2_receive_gift(&core,&g)==L2_OK);CHECK(core.saved.event_count==1);CHECK(core.saved.snapshot.pet.coins==100);CHECK(core.saved.gift_state==L2_GIFT_PENDING);unsigned writes=disk.calls;CHECK(l2_receive_gift(&core,&g)==L2_DUPLICATE);CHECK(disk.calls==writes);g.epoch_ms=1;CHECK(l2_receive_gift(&core,&g)==L2_REQUEST_CONFLICT);g=receipt(0,6);CHECK(l2_receive_gift(&core,&g)==L2_STALE);g=receipt(0,8);CHECK(l2_receive_gift(&core,&g)==L2_DUPLICATE);CHECK(core.saved.event_count==1);CHECK(l2_set_gift_state(&core,L2_GIFT_PLAYING)==L2_OK);CHECK(l2_set_gift_state(&core,L2_GIFT_PENDING)==L2_STALE);CHECK(l2_set_gift_state(&core,L2_GIFT_SHOWN)==L2_OK);restart();CHECK(core.care_change==0 && core.gift_change==0);CHECK(l2_receive_gift(&core,&g)==L2_DUPLICATE);for(unsigned i=1;i<32;i++){g=receipt(i,1);CHECK(l2_receive_gift(&core,&g)==L2_OK);}g=receipt(99,1);CHECK(l2_receive_gift(&core,&g)==L2_PEER_FULL);l2_request_t r=req(2);l2_snapshot_t s=snapshot(2);CHECK(l2_set_snapshot(&core,&r,&s)==L2_OK);r=req(3);CHECK(l2_ack_event(&core,&r,1)==L2_OK);/* peer-full doesn't wedge phone ops */}
static void test_gift_failure(void){fresh();l2_receipt_t g=receipt(0,1);disk.fail=1;CHECK(l2_receive_gift(&core,&g)==L2_STORAGE_ERROR);CHECK(!core.saved.has_gift);CHECK(core.saved.peer_count==0);disk.fail=0;restart();CHECK(l2_receive_gift(&core,&g)==L2_OK);restart();CHECK(l2_receive_gift(&core,&g)==L2_DUPLICATE);}
static void test_outgoing(void){fresh();l2_receipt_t out,g=receipt(0,1);CHECK(l2_peer_reserve_gift(&core,g.peer_id,1,1,&out)==L2_OK);CHECK(out.counter==1);restart();CHECK(l2_peer_peek_outgoing(&core,&out));CHECK(out.counter==1);CHECK(l2_peer_ack_outgoing(&core,g.peer_id,2)==L2_ACK_MISMATCH);l2_receipt_t wrong=receipt(1,1);CHECK(l2_peer_ack_outgoing(&core,wrong.peer_id,1)==L2_ACK_MISMATCH);disk.fail=1;CHECK(l2_peer_ack_outgoing(&core,g.peer_id,1)==L2_STORAGE_ERROR);CHECK(core.saved.outgoing_count==1);disk.fail=0;restart();CHECK(l2_peer_ack_outgoing(&core,g.peer_id,1)==L2_OK);restart();CHECK(l2_peer_ack_outgoing(&core,g.peer_id,1)==L2_DUPLICATE);unsigned calls=disk.calls;CHECK(l2_peer_reserve_gift(&core,g.peer_id,1,1,&out)==L2_DUPLICATE);CHECK(out.counter==1);CHECK(disk.calls==calls);CHECK(core.saved.next_peer_counter==2);for(unsigned i=1;i<32;i++){g=receipt(i,1);CHECK(l2_peer_reserve_gift(&core,g.peer_id,1,1,&out)==L2_OK);}g=receipt(33,1);CHECK(l2_peer_reserve_gift(&core,g.peer_id,1,1,&out)==L2_PEER_FULL);uint8_t id[16];CHECK(l2_get_device_id(&core,id));CHECK(id[0]==1 && id[15]==0xef);/* Old peer remains reusable after later peers are ACKed. */for(unsigned i=1;i<32;i++){g=receipt(i,1);CHECK(l2_peer_ack_outgoing(&core,g.peer_id,i+1)==L2_OK);}g=receipt(0,1);CHECK(l2_peer_ack_outgoing(&core,g.peer_id,1)==L2_DUPLICATE);restart();CHECK(l2_peer_reserve_gift(&core,g.peer_id,1,1,&out)==L2_DUPLICATE);CHECK(out.counter==1);}
static void test_lost_done_reboot(void){
 static l2_core_t a,b;static disk_t da,db;memset(&a,0,sizeof(a));memset(&b,0,sizeof(b));memset(&da,0,sizeof(da));memset(&db,0,sizeof(db));
 const char *aid="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",*bid="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
 CHECK(l2_init_new(&a,aid,persist,&da)==L2_OK);CHECK(l2_init_new(&b,bid,persist,&db)==L2_OK);
 l2_receipt_t ao,bo,ai,bi;CHECK(l2_peer_reserve_gift(&a,bid,1,1,&ao)==L2_OK);CHECK(l2_peer_reserve_gift(&b,aid,1,1,&bo)==L2_OK);
 ai=bo;strcpy(ai.peer_id,bid);bi=ao;strcpy(bi.peer_id,aid);CHECK(l2_receive_gift(&a,&ai)==L2_OK);CHECK(l2_receive_gift(&b,&bi)==L2_OK);
 CHECK(l2_peer_ack_outgoing(&a,bid,ao.counter)==L2_OK);CHECK(l2_peer_ack_outgoing(&b,aid,bo.counter)==L2_OK);
 /* No DONE delivered: power loss now, then a new nonce and explicit re-confirm. */
 CHECK(l2_load(&a,da.bytes,da.n,persist,&da)==L2_OK);CHECK(l2_load(&b,db.bytes,db.n,persist,&db)==L2_OK);
 CHECK(l2_peer_reserve_gift(&a,bid,1,1,&ao)==L2_DUPLICATE);CHECK(l2_peer_reserve_gift(&b,aid,1,1,&bo)==L2_DUPLICATE);CHECK(ao.counter==1 && bo.counter==1);
 ai=bo;strcpy(ai.peer_id,bid);bi=ao;strcpy(bi.peer_id,aid);CHECK(l2_receive_gift(&a,&ai)==L2_DUPLICATE);CHECK(l2_receive_gift(&b,&bi)==L2_DUPLICATE);
 CHECK(l2_peer_ack_outgoing(&a,bid,1)==L2_DUPLICATE);CHECK(l2_peer_ack_outgoing(&b,aid,1)==L2_DUPLICATE);
 CHECK(a.saved.event_count==1 && b.saved.event_count==1);CHECK(a.saved.next_peer_counter==2 && b.saved.next_peer_counter==2);CHECK(a.gift_change==0 && b.gift_change==0);
 /* Even a buggy older sender with a new counter cannot create a second first-flower. */
 ai.counter=9;CHECK(l2_receive_gift(&a,&ai)==L2_DUPLICATE);CHECK(a.saved.event_count==1 && a.saved.peers[0].counter==9);ai.epoch_ms=5;CHECK(l2_receive_gift(&a,&ai)==L2_REQUEST_CONFLICT);
}

static void test_cross_peer_ack(void){
 fresh();bind();l2_receipt_t peer_a=receipt(0,1),peer_b=receipt(1,1),a,b,again;
 CHECK(l2_peer_reserve_gift(&core,peer_a.peer_id,1,1,&a)==L2_OK);
 CHECK(l2_peer_reserve_gift(&core,peer_b.peer_id,1,1,&b)==L2_OK);
 CHECK(a.counter==1 && b.counter==2);
 /* A disappears before ACK. B's complete receipt is independently durable. */
 CHECK(l2_receive_gift(&core,&peer_b)==L2_OK);
 CHECK(l2_peer_ack_outgoing(&core,peer_a.peer_id,b.counter)==L2_ACK_MISMATCH);
 CHECK(l2_peer_ack_outgoing(&core,peer_b.peer_id,a.counter)==L2_ACK_MISMATCH);
 CHECK(l2_peer_ack_outgoing(&core,peer_b.peer_id,b.counter)==L2_OK);
 CHECK(core.saved.outgoing_count==1 && core.saved.outgoing[0].counter==a.counter);
 CHECK(!core.saved.peer_outgoing_acked[0] && core.saved.peer_outgoing_acked[1]);
 CHECK(core.saved.last_peer_ack==0);
 restart();CHECK(core.saved.event_count==1);CHECK(l2_receive_gift(&core,&peer_b)==L2_DUPLICATE);
 CHECK(l2_peer_ack_outgoing(&core,peer_b.peer_id,b.counter)==L2_DUPLICATE);
 CHECK(l2_peer_reserve_gift(&core,peer_b.peer_id,1,1,&again)==L2_DUPLICATE);CHECK(again.counter==b.counter);
 CHECK(l2_peer_reserve_gift(&core,peer_a.peer_id,1,1,&again)==L2_DUPLICATE);CHECK(again.counter==a.counter);
 CHECK(core.saved.next_peer_counter==3);
 /* A returns; fill the hole, advancing the contiguous frontier across B. */
 CHECK(l2_receive_gift(&core,&peer_a)==L2_OK);
 CHECK(l2_peer_ack_outgoing(&core,peer_a.peer_id,a.counter)==L2_OK);
 CHECK(core.saved.last_peer_ack==2 && core.saved.outgoing_count==0);
 restart();CHECK(core.saved.event_count==2);CHECK(l2_receive_gift(&core,&peer_b)==L2_DUPLICATE);
 CHECK(l2_peer_ack_outgoing(&core,peer_b.peer_id,b.counter)==L2_DUPLICATE);
 CHECK(l2_peer_ack_outgoing(&core,peer_a.peer_id,a.counter)==L2_DUPLICATE);
 /* Uncertain out-of-order ACK commit must preserve ID/peer pairing after reboot. */
 fresh();CHECK(l2_peer_reserve_gift(&core,peer_a.peer_id,1,1,&a)==L2_OK);CHECK(l2_peer_reserve_gift(&core,peer_b.peer_id,1,1,&b)==L2_OK);
 disk.fail=2;CHECK(l2_peer_ack_outgoing(&core,peer_b.peer_id,b.counter)==L2_STORAGE_ERROR);
 CHECK(core.saved.outgoing_count==2);disk.fail=0;restart();CHECK(core.saved.outgoing_count==1);
 CHECK(l2_peer_ack_outgoing(&core,peer_b.peer_id,b.counter)==L2_DUPLICATE);
 CHECK(l2_peer_ack_outgoing(&core,peer_a.peer_id,a.counter)==L2_OK);
}
static uint32_t crc(const uint8_t *p,size_t n){uint32_t c=~0u;for(size_t i=0;i<n;i++){c^=p[i];for(unsigned j=0;j<8;j++)c=(c>>1)^((0u-(c&1u))&0xedb88320u);}return ~c;}
static void re_crc(uint8_t *p,size_t n){uint32_t c=crc(p,n-4);for(unsigned i=0;i<4;i++)p[n-4+i]=(uint8_t)(c>>(8*i));}
static void test_corrupt(void){fresh();bind();CHECK(l2_emit_care(&core,L2_ACTION_PET,0)==L2_OK);uint8_t saved[L2_STORE_MAX];size_t n=disk.n;memcpy(saved,disk.bytes,n);unsigned writes=disk.calls;for(size_t i=0;i<n;i++){memset(&other,0,sizeof(other));disk.bytes[i]^=0x80;CHECK(l2_load(&other,disk.bytes,n,persist,&disk)==L2_CORRUPT);CHECK(!other.ready && other.storage_error);disk.bytes[i]^=0x80;}CHECK(disk.calls==writes);CHECK(l2_load(&core,saved,n-1,persist,&disk)==L2_CORRUPT);CHECK(core.saved.event_count==1);CHECK(l2_init_new(&core,ID,persist,&disk)==L2_NOT_READY);CHECK(l2_load(&core,saved,n,persist,&disk)==L2_OK);/* mutate valid-CRC event ID: semantic validator must reject */saved[n-4-17]=99;re_crc(saved,n);CHECK(l2_load(&other,saved,n,persist,&disk)==L2_CORRUPT);CHECK(disk.calls==writes);}
static size_t test_maximum(void){fresh();bind();for(unsigned i=0;i<32;i++){l2_receipt_t g=receipt(i,1);CHECK(l2_receive_gift(&core,&g)==L2_OK);}for(unsigned i=32;i<200;i++)CHECK(l2_emit_care(&core,L2_ACTION_PET,0)==L2_OK);for(unsigned i=0;i<32;i++){l2_receipt_t g=receipt(i,1),out;CHECK(l2_peer_reserve_gift(&core,g.peer_id,1,1,&out)==L2_OK);}size_t n=disk.n;CHECK(n==5739);restart();CHECK(core.saved.event_count==200 && core.saved.peer_count==32 && core.saved.outgoing_count==32);l2_receipt_t g=receipt(0,100);CHECK(l2_receive_gift(&core,&g)==L2_DUPLICATE);CHECK(core.saved.event_count==200 && core.saved.peers[0].counter==100);g=receipt(33,1);CHECK(l2_receive_gift(&core,&g)==L2_PEER_FULL);return n;}
int main(void){test_snapshot();test_validation();test_canonical();test_care_fifo();test_failures();test_gifts();test_gift_failure();test_outgoing();test_lost_done_reboot();test_cross_peer_ack();test_corrupt();size_t maximum=test_maximum();printf("{\"checks\":%u,\"failures\":0,\"maxEncodedBytes\":%zu,\"coreBytes\":%zu,\"savedBytes\":%zu}\n",checks,maximum,sizeof(l2_core_t),sizeof(l2_saved_t));return 0;}
