/* Test-only radio/user/store driver. All domain transitions use production APIs. */
#include "local2_peer.h"
#include <assert.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef struct {uint8_t type,data[64];size_t size;} packet_t;
typedef struct endpoint endpoint_t;
struct endpoint {const char *label;l2_core_t core;l2_peer_machine_t machine;endpoint_t *other;packet_t packets[128];unsigned queued,writes,fail_write,drop_mask;bool drop_done,drop_ack;uint8_t blob[L2_STORE_MAX];size_t size;l2_peer_view_t previous;bool traced;};
static endpoint_t a,b,c;static uint32_t clock_ms;static const char *directory;
static const char *phases[]={"disabled","discovering","hello","confirm","exchanging","wait_done","complete","blocked"};
static void event(const char *kind,const endpoint_t *e,const char *detail){printf("{\"kind\":\"%s\",\"at_ms\":%u,\"endpoint\":\"%s\",\"detail\":\"%s\"}\n",kind,clock_ms,e->label,detail);}
static void state(endpoint_t *e,const char *reason,bool force){
 const l2_peer_view_t *v=&e->machine.view;if(!force&&e->traced&&!memcmp(&e->previous,v,sizeof(*v)))return;e->previous=*v;e->traced=true;
 printf("{\"kind\":\"state\",\"at_ms\":%u,\"endpoint\":\"%s\",\"reason\":\"%s\",\"device_id\":\"%s\",\"peer_id\":\"%s\",\"phase\":\"%s\",\"discoverable\":%s,\"connected\":%s,\"local_confirmed\":%s,\"remote_confirmed\":%s,\"incoming_saved\":%s,\"incoming_new\":%s,\"outgoing_acked\":%s,\"complete\":%s,\"complete_count\":%"PRIu64",\"incoming_counter\":%"PRIu64",\"outgoing_counter\":%"PRIu64",\"pending_phone_events\":%u,\"gift_change\":%"PRIu64",\"storage_status\":\"%s\"}\n",clock_ms,e->label,reason,e->core.saved.device_id,v->peer_id,phases[v->phase],v->discoverable?"true":"false",v->connected?"true":"false",v->local_confirmed?"true":"false",v->remote_confirmed?"true":"false",v->incoming_saved?"true":"false",v->incoming_new?"true":"false",v->outgoing_acked?"true":"false",v->complete?"true":"false",v->complete_count,v->incoming_counter,v->outgoing_counter,e->core.saved.event_count,e->core.gift_change,l2_status_name(v->storage_status));
}
static bool persist(void *ctx,const uint8_t *bytes,size_t size){endpoint_t *e=ctx;e->writes++;bool ok=e->writes!=e->fail_write;printf("{\"kind\":\"store\",\"at_ms\":%u,\"endpoint\":\"%s\",\"attempt\":%u,\"bytes\":%zu,\"durable\":%s}\n",clock_ms,e->label,e->writes,size,ok?"true":"false");if(!ok)return false;assert(size<=sizeof(e->blob));memcpy(e->blob,bytes,size);e->size=size;return true;}
static bool send_packet(void *ctx,uint8_t type,const uint8_t *bytes,size_t size){
 endpoint_t *e=ctx;if(type==L2P_MSG_GIFT){bool reserved=false;for(unsigned i=0;i<e->core.saved.peer_count;i++)if(!strcmp(e->core.saved.peers[i].peer_id,e->machine.view.peer_id)&&e->core.saved.peer_first_outgoing[i]==e->machine.outgoing.counter)reserved=true;assert(reserved);}
 bool drop=(e->drop_mask&(1u<<type))||(e->drop_done&&type==L2P_MSG_DONE)||(e->drop_ack&&type==L2P_MSG_ACK);e->drop_mask&=~(1u<<type);
 printf("{\"kind\":\"radio_send\",\"at_ms\":%u,\"endpoint\":\"%s\",\"to\":\"%s\",\"message_type\":%u,\"bytes\":%zu,\"dropped\":%s}\n",clock_ms,e->label,e->other->label,type,size,drop?"true":"false");
 if(drop)return true;assert(e->other->queued<128);packet_t *p=&e->other->packets[e->other->queued++];p->type=type;p->size=size;memcpy(p->data,bytes,size);return true;
}
static void initialize(endpoint_t *e,const char *label,char digit){memset(e,0,sizeof(*e));e->label=label;char id[33];memset(id,digit,32);id[32]=0;assert(l2_init_new(&e->core,id,persist,e)==L2_OK);assert(l2_peer_machine_init(&e->machine,&e->core,send_packet,e));state(e,"boot",true);}
static void activate(endpoint_t *left,endpoint_t *right,unsigned generation){
 left->other=right;right->other=left;left->queued=right->queued=0;uint8_t ln[16],rn[16];for(unsigned i=0;i<16;i++){ln[i]=(uint8_t)(generation*19+i+left->label[0]);rn[i]=(uint8_t)(generation*23+i+right->label[0]);}
 assert(l2_peer_machine_enable(&left->machine,true,ln));assert(l2_peer_machine_enable(&right->machine,true,rn));state(left,"virtual_user_enable",true);state(right,"virtual_user_enable",true);
 uint8_t la[23],ra[23];assert(l2_peer_machine_advertisement(&left->machine,la,23)==23);assert(l2_peer_machine_advertisement(&right->machine,ra,23)==23);
 event("discovery",left,memcmp(left->machine.own_id,right->machine.own_id,16)<0?"selected central by public ID order":"selected peripheral by public ID order");
 l2_peer_machine_link(&left->machine,true,ra+3,ra+19);l2_peer_machine_link(&right->machine,true,la+3,la+19);state(left,"virtual_radio_link",true);state(right,"virtual_radio_link",true);
}
static void drain(endpoint_t *e){unsigned count=e->queued;e->queued=0;for(unsigned i=0;i<count;i++){packet_t *p=&e->packets[i];bool ok=l2_peer_machine_receive(&e->machine,p->type,p->data,p->size);printf("{\"kind\":\"radio_receive\",\"at_ms\":%u,\"endpoint\":\"%s\",\"message_type\":%u,\"accepted\":%s}\n",clock_ms,e->label,p->type,ok?"true":"false");state(e,"radio_receive",false);}}
static void step(endpoint_t *left,endpoint_t *right,bool lc,bool rc){
 clock_ms+=100;drain(left);drain(right);endpoint_t *ends[]={left,right};bool confirms[]={lc,rc};
 for(unsigned i=0;i<2;i++){endpoint_t *e=ends[i];if(confirms[i]&&e->machine.hello_seen&&!e->machine.view.local_confirmed){assert(l2_peer_machine_confirm(&e->machine));event("virtual_user_confirm",e,"explicit test input");state(e,"virtual_user_confirm",true);}l2_peer_machine_poll(&e->machine,clock_ms);state(e,"poll",false);}
}
static void run(endpoint_t *left,endpoint_t *right,unsigned limit,bool lc,bool rc){for(unsigned i=0;i<limit;i++){step(left,right,lc,rc);if(left->machine.view.complete&&right->machine.view.complete)return;}}
static void save_blob(endpoint_t *e,const char *suffix){char path[1024];int length=snprintf(path,sizeof(path),"%s/%s%s.bin",directory,e->label,suffix);assert(length>0&&(size_t)length<sizeof(path));FILE *f=fopen(path,"wb");assert(f);assert(fwrite(e->blob,1,e->size,f)==e->size);assert(fclose(f)==0);}
static void reboot(endpoint_t *e){save_blob(e,"-before-restart");memset(&e->core,0,sizeof(e->core));assert(l2_load(&e->core,e->blob,e->size,persist,e)==L2_OK);assert(l2_peer_machine_init(&e->machine,&e->core,send_packet,e));e->queued=0;e->traced=false;event("reboot",e,"load actual durable blob; runtime confirmations discarded");state(e,"reboot",true);}
static void summary(endpoint_t *e){save_blob(e,"");state(e,"final",true);printf("{\"kind\":\"events\",\"endpoint\":\"%s\",\"events\":[",e->label);for(unsigned i=0;i<e->core.saved.event_count;i++){l2_event_t *v=&e->core.saved.events[i];if(i)putchar(',');printf("{\"event_counter\":%"PRIu64",\"kind\":%u,\"peer_id\":\"%s\",\"peer_counter\":%"PRIu64",\"gift_kind\":%u,\"quantity\":%u}",v->counter,v->kind,v->peer_slot<L2_PEER_MAX?e->core.saved.peers[v->peer_slot].peer_id:"",v->peer_counter,v->gift_kind,v->quantity);}puts("]}");}
int main(int argc,char **argv){
 assert(argc==3);const char *fault=argv[1];directory=argv[2];initialize(&a,"A",'1');initialize(&b,"B",'2');assert(!a.machine.view.discoverable&&!b.machine.view.discoverable);
 if(!strcmp(fault,"loss"))a.drop_mask=b.drop_mask=0x3e;
 if(!strcmp(fault,"persist-failure"))a.fail_write=3;
 if(!strcmp(fault,"restart-dedup"))a.drop_done=b.drop_done=true;
 if(!strcmp(fault,"pending-peer"))a.drop_ack=true;
 activate(&a,&b,1);
 if(!strcmp(fault,"one-sided")){run(&a,&b,100,true,false);assert(!a.machine.view.complete&&!b.machine.view.complete);assert(!a.core.saved.event_count&&!b.core.saved.event_count);}
 else if(!strcmp(fault,"disconnect")){for(unsigned i=0;i<100;i++){step(&a,&b,true,true);if(a.machine.view.incoming_saved||b.machine.view.incoming_saved)break;}l2_peer_machine_link(&a.machine,false,NULL,NULL);l2_peer_machine_link(&b.machine,false,NULL,NULL);a.queued=b.queued=0;event("disconnect",&a,"virtual link removed; queued radio bytes dropped");run(&a,&b,10,true,true);assert(!a.machine.view.complete&&!b.machine.view.complete);}
 else if(!strcmp(fault,"persist-failure")){run(&a,&b,80,true,true);assert(a.machine.view.storage_status==L2_STORAGE_ERROR&&!a.machine.view.incoming_saved);assert(!a.machine.view.complete&&!b.machine.view.complete);}
 else if(!strcmp(fault,"pending-peer")){run(&a,&b,50,true,true);assert(!b.machine.view.outgoing_acked&&b.core.saved.outgoing_count==1);assert(a.machine.view.incoming_saved&&b.machine.view.incoming_saved);l2_peer_machine_link(&a.machine,false,NULL,NULL);l2_peer_machine_link(&b.machine,false,NULL,NULL);a.queued=b.queued=0;event("disconnect",&b,"first peer A ACK lost; B retains A1 pending");initialize(&c,"C",'3');activate(&c,&b,2);run(&c,&b,300,true,true);assert(c.machine.view.complete&&b.machine.view.complete);assert(b.core.saved.outgoing_count==1&&!strcmp(b.core.saved.outgoing[0].peer_id,a.core.saved.device_id));assert(b.core.saved.event_count==2);event("assertion",&b,"C exchange completed while A1 remained pending");summary(&c);a.drop_ack=false;activate(&a,&b,3);run(&a,&b,300,true,true);assert(a.machine.view.complete&&b.machine.view.complete&&!b.core.saved.outgoing_count);assert(a.core.saved.event_count==1&&b.core.saved.event_count==2);assert(!a.machine.view.incoming_new&&!b.machine.view.incoming_new);}
 else if(!strcmp(fault,"restart-dedup")){run(&a,&b,60,true,true);assert(!a.machine.view.complete&&!b.machine.view.complete);assert(a.core.saved.event_count==1&&b.core.saved.event_count==1);assert(a.machine.view.outgoing_acked&&b.machine.view.outgoing_acked);uint64_t ac=a.core.saved.next_peer_counter,bc=b.core.saved.next_peer_counter;reboot(&a);reboot(&b);a.drop_done=b.drop_done=false;activate(&a,&b,2);run(&a,&b,10,false,false);assert(!a.machine.view.complete&&!b.machine.view.complete);run(&a,&b,300,true,true);assert(a.machine.view.complete&&b.machine.view.complete);assert(a.core.saved.event_count==1&&b.core.saved.event_count==1);assert(!a.machine.view.incoming_new&&!b.machine.view.incoming_new);assert(ac==a.core.saved.next_peer_counter&&bc==b.core.saved.next_peer_counter);}
 else {run(&a,&b,300,true,true);assert(a.machine.view.complete&&b.machine.view.complete);assert(a.core.saved.event_count==1&&b.core.saved.event_count==1);if(!strcmp(fault,"same-counter")){initialize(&c,"C",'3');activate(&c,&b,2);run(&c,&b,300,true,true);assert(c.machine.view.complete&&b.machine.view.complete);assert(b.core.saved.event_count==2);assert(b.core.saved.events[0].peer_counter==1&&b.core.saved.events[1].peer_counter==1);assert(b.core.saved.events[0].peer_slot!=b.core.saved.events[1].peer_slot);summary(&c);}}
 summary(&a);summary(&b);printf("{\"kind\":\"verdict\",\"fault\":\"%s\",\"passed\":true}\n",fault);return 0;
}
