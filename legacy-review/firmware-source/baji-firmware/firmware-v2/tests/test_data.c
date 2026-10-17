#include "baji_data.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>
#include <bcrypt.h>
static bj_data_t d,loaded;
static unsigned checks;
#define CHECK(x) do {checks++;if(!(x)){fprintf(stderr,"line %d: %s\n",__LINE__,#x);exit(1);}}while(0)
static uint8_t durable[BJ_DATA_STORE_MAX];static size_t durable_size;static bool fail_save;
static uint8_t challenge[56],grant[69],event[48],ack[60],clock_object[58],proof[32];
static void hex(const char *s,uint8_t *b) {for(size_t i=0;s[2*i];i++){unsigned v;CHECK(sscanf(s+2*i,"%2x",&v)==1);b[i]=(uint8_t)v;}}
static bool save(void *unused,const uint8_t *b,size_t n) {(void)unused;if(fail_save)return false;memcpy(durable,b,n);durable_size=n;return true;}
/* Real Windows CNG HMAC-SHA256 verifies independent Node crypto vectors.
 * Public deterministic key is host-test-only, never provisioned to hardware. */
static bool sign(void *unused,const uint8_t *b,size_t n,uint8_t out[32]) {
    (void)unused;BCRYPT_ALG_HANDLE algorithm=NULL;BCRYPT_HASH_HANDLE hash=NULL;
    uint8_t test_key[32];for(unsigned i=0;i<32;i++) test_key[i]=(uint8_t)i;
    if(BCryptOpenAlgorithmProvider(&algorithm,BCRYPT_SHA256_ALGORITHM,NULL,BCRYPT_ALG_HANDLE_HMAC_FLAG)<0) return false;
    bool ok=BCryptCreateHash(algorithm,&hash,NULL,0,test_key,32,0)>=0;
    if(ok) ok=BCryptHashData(hash,(PUCHAR)b,(ULONG)n,0)>=0 && BCryptFinishHash(hash,out,32,0)>=0;
    if(hash) BCryptDestroyHash(hash);BCryptCloseAlgorithmProvider(algorithm,0);return ok;
}
static uint8_t call(uint8_t op,const uint8_t *p,uint8_t len,bj_packet_t *result) {
    bj_packet_t q={.opcode=op,.sequence=7,.length=len};if(len)memcpy(q.payload,p,len);
    uint8_t request[20],response[20];CHECK(bj_packet_encode(&q,request));CHECK(bj_data_dispatch(&d,request,response));CHECK(bj_packet_decode(response,20,result));CHECK(result->opcode==128 && result->sequence==7 && result->payload[0]==op);return result->payload[1];
}
static void put(uint8_t *p,uint32_t v,unsigned n){for(unsigned i=0;i<n;i++)p[i]=(uint8_t)(v>>(8*i));}
static uint8_t upload(uint8_t kind,const uint8_t *bytes,uint16_t n) {
    uint8_t p[12]={kind,0x34,0x12};put(p+3,n,2);put(p+5,bj_data_crc(bytes,n),4);bj_packet_t r;uint8_t status=call(16,p,9,&r);if(status) return status;
    for(unsigned pos=0;pos<n;pos+=9){unsigned count=n-pos;if(count>9)count=9;p[0]=0x34;p[1]=0x12;p[2]=(uint8_t)(pos/9);memcpy(p+3,bytes+pos,count);CHECK(call(17,p,(uint8_t)(count+3),&r)==0);}
    p[0]=0x34;p[1]=0x12;return call(18,p,2,&r);
}
static uint8_t signed_upload(uint8_t kind,const uint8_t *body,uint16_t length,uint32_t counter) {
    uint8_t object[512],input[532];memcpy(object,d.session,16);put(object+16,counter,4);memcpy(object+20,body,length);
    memcpy(input,"BAJI-SYNC-v1",12);memcpy(input+12,d.id,6);input[18]=kind;memcpy(input+19,object,20+length);
    CHECK(sign(NULL,input,39+length,object+20+length));return upload(kind,object,(uint16_t)(length+52));
}
static void test_signed_lifecycle(void) {
    uint8_t pet[27]={1};put(pet+1,50,4);pet[7]=0;pet[8]=0;pet[9]=0;for(unsigned i=10;i<15;i++)pet[i]=70;
    CHECK(signed_upload(3,pet,27,3)==0 && d.has_pet && d.counter==3);
    CHECK(signed_upload(3,pet,27,4)==0 && d.counter==4);
    CHECK(signed_upload(3,pet,27,3)==4); /* identical old data cannot lower counter */
    uint8_t life[18]={1};put(life+1,9,4);put(life+5,20261013,4);put(life+9,480,2);life[11]=1;put(life+13,60,2);put(life+15,100,2);life[17]=3;
    CHECK(signed_upload(4,life,18,5)==0 && d.has_life);
    put(life+1,1,4);put(life+5,20261014,4);CHECK(signed_upload(4,life,18,6)==0);
    put(life+1,0,4);life[11]=0;CHECK(signed_upload(4,life,13,7)==0 && d.life[11]==0);
    CHECK(signed_upload(4,life,13,8)==0 && d.counter==8);
    life[11]=1;put(life+13,1440,2);CHECK(signed_upload(4,life,18,9)==1 && d.counter==8);
    bj_data_disconnect(&d);CHECK(upload(5,challenge,56)==0);CHECK(bj_data_confirm(&d,d.now));CHECK(upload(7,grant,69)==0);
    CHECK(!d.has_pet && !d.has_life);put(pet+1,1,4);CHECK(signed_upload(3,pet,27,1)==0 && d.has_pet);
    uint8_t bad[69];memcpy(bad,grant,69);bad[37]^=1;CHECK(upload(7,bad,69)==4);
    uint64_t next=d.next_event;uint16_t count=d.event_count;
    for(unsigned i=count;i<BJ_EVENT_MAX;i++) CHECK(bj_data_event(&d,12,1,0));
    CHECK(d.event_count==BJ_EVENT_MAX);CHECK(!bj_data_event(&d,12,1,0));CHECK(d.dropped==1 && d.next_event==next+(BJ_EVENT_MAX-count));
    CHECK(bj_data_load(&loaded,durable,durable_size) && loaded.event_count==200);
}
static uint8_t environment_durable[89];static size_t environment_size;
static bool save_environment(void *unused,const uint8_t *bytes,size_t size) {(void)unused;if(fail_save)return false;CHECK(size==89);memcpy(environment_durable,bytes,size);environment_size=size;return true;}
static void test_m2_environment(void) {
    d.environment_save=save_environment;uint8_t consent[10]={1};put(consent+1,1,4);consent[5]=1;put(consent+6,d.unix_base+100,4);
    uint32_t counter=d.counter+1;CHECK(signed_upload(11,consent,10,counter++)==0);CHECK(d.environment_allowed);
    CHECK(bj_data_environment_event(&d,4,920,1));CHECK(d.environment_pending && d.environment_next==2);
    uint8_t read[2]={14,255};bj_packet_t reply;CHECK(call(19,read,2,&reply)==0);CHECK(d.frozen_length==56);
    uint8_t env_ack[8]={1};CHECK(signed_upload(15,env_ack,8,counter++)==0);CHECK(!d.environment_pending && d.environment_ack==1);
    read[1]=0;CHECK(call(19,read,2,&reply)==3 && !d.frozen_valid);
    CHECK(bj_data_environment_event(&d,3,900,1));read[1]=255;CHECK(call(19,read,2,&reply)==0);
    uint32_t original_now=d.now;d.environment_expiry=d.unix_base+1;
    bj_data_tick(&d,d.now+1000);CHECK(!d.environment_allowed && !d.frozen_valid);
    read[1]=0;CHECK(call(19,read,2,&reply)==3);
    /* Suspension is not revocation; a fresh signed grant resumes this revision. */
    bj_data_tick(&d,original_now);CHECK(signed_upload(11,consent,10,counter++)==0 && d.environment_allowed);
    bj_data_disconnect(&d);CHECK(!d.environment_allowed);d.session_valid=true;memcpy(d.session,grant+1,16);d.session_expiry=d.unix_base+300;d.session_at=d.now;d.counter=0;
    CHECK(signed_upload(11,consent,10,1)==0);CHECK(d.environment_allowed);
    CHECK(call(7,NULL,0,&reply)==0);CHECK(!d.environment_allowed && d.environment_revoked_revision==1);
    CHECK(signed_upload(11,consent,10,2)==4);
    CHECK(bj_data_environment_load(&loaded,environment_durable,environment_size));CHECK(loaded.environment_revoked_revision==1);
    put(consent+1,2,4);CHECK(signed_upload(11,consent,10,2)==0);CHECK(d.environment_allowed);
    fail_save=true;CHECK(call(7,NULL,0,&reply)==3);CHECK(!d.environment_allowed);fail_save=false;
    CHECK(call(7,NULL,0,&reply)==0);CHECK(d.environment_revoked_revision==2);
    environment_durable[10]^=1;CHECK(!bj_data_environment_load(&loaded,environment_durable,environment_size));
}
static void test_active_wire(void) {
    bj_active_t active;bj_active_init(&active,save,NULL);d.active=&active;
    uint32_t counter=d.counter+1,start=d.now;uint8_t session[16];memcpy(session,d.session,16);
    for(unsigned ms=0;ms<=10000;ms+=100)bj_active_tick(&active,true,2,session,d.unix_base+ms/1000,start+ms);
    CHECK(active.count==1);bj_packet_t reply;uint8_t read[2]={24,255};
    CHECK(call(19,read,2,&reply)==0 && d.frozen_length==71);
    uint8_t message[64],digest[32];static const char domain[]="BAJI-ACTIVE-v1";size_t prefix=sizeof(domain)-1;
    memcpy(message,domain,prefix);memcpy(message+prefix,d.id,6);memcpy(message+prefix+6,d.frozen,39);
    CHECK(sign(NULL,message,prefix+45,digest) && !memcmp(digest,d.frozen+39,32));
    uint8_t ack[8]={2};CHECK(signed_upload(25,ack,8,counter)==4 && active.count==1);
    ack[0]=1;CHECK(signed_upload(25,ack,8,counter)==0 && !active.count && !d.frozen_valid);
    CHECK(signed_upload(25,ack,8,counter+1)==0 && active.ack==1);
    CHECK(call(19,read,2,&reply)==0 && d.frozen_length==0);d.active=NULL;
}
static void test_social_owner(void) {
    bj_packet_t reply;uint8_t read[2]={16,255};
    CHECK(call(19,read,2,&reply)==0 && d.frozen_length==30);
    CHECK(d.frozen[0]==1 && d.frozen[1]==1);
    for(unsigned i=2;i<30;i++) CHECK(d.frozen[i]==0);
    read[0]=17;CHECK(call(19,read,2,&reply)==0 && d.frozen_length==0);
    uint8_t role[23]={1};memset(role+1,7,16);memcpy(role+17,d.id,6);
    uint32_t counter=d.counter+1;
    CHECK(signed_upload(18,role,23,counter)==4 && !d.social_role_valid);
    /* Worker state setup only: no fake authenticated capability or peer proof. */
    d.meet_pending=true;d.meet_at=d.now;d.meet_challenge[65]=1;memcpy(d.meet_challenge+1,role+1,16);
    memcpy(d.meet_challenge+17,d.id,6);memset(d.meet_challenge+23,8,6);
    put(d.meet_challenge+61,d.unix_base+100,4);
    CHECK(signed_upload(18,role,22,counter)==1);
    CHECK(signed_upload(18,role,23,counter++)==0 && d.social_role_valid);
    CHECK(signed_upload(18,role,23,counter++)==0);
    memset(role+17,8,6);CHECK(signed_upload(18,role,23,counter)==4);
    role[1]^=1;CHECK(signed_upload(18,role,23,counter)==4);
    /* Freeze through the real READ object path, then expire the encounter. */
    d.meet_confirmed=true;memset(d.meet_proof,0x5a,sizeof(d.meet_proof));
    read[0]=12;read[1]=255;CHECK(call(19,read,2,&reply)==0 && d.frozen_length==64);
    bj_data_tick(&d,d.now+15000);CHECK(!d.social_role_valid && !d.meet_pending);
    read[1]=0;CHECK(call(19,read,2,&reply)==3 && !d.frozen_valid && d.frozen_length==0);
    for(unsigned i=0;i<66;i++) CHECK(d.meet_challenge[i]==0);
    for(unsigned i=0;i<64;i++) CHECK(d.meet_proof[i]==0);
    for(unsigned i=0;i<512;i++) CHECK(d.frozen[i]==0);
    for(unsigned i=0;i<6;i++) CHECK(d.social_role[i]==0);
}
int main(void) {
    hex("00112233445566778899aabbccddeefffffefdfcfbfaf9f8f7f6f5f4f3f2f1f0efeeedecebeae9e8e7e6e5e4e3e2e1e024fcce6a40e20100",challenge);
    hex("b36e8f27c52b3803436d2434f414e9856218363ba301bab2d1301153441d71b0",proof);
    hex("01ffeeddccbbaa998877665544332211006cffce6a00112233445566778899aabbccddeeffe99dcc794aefeb703ab5c6fb3c670b55130bb3a1ec1eea569d1ade12d854c6ee",grant);
    hex("0100000000002000e8fbce6a010000009bd0714ffac8b6ef73d1a183301cf77418182a564d03af6edb0fc9fe41105120",event);
    hex("ffeeddccbbaa9988776655443322110001000000010000000000200036274177917f9c502b3dd033599c0137b6cce341661faaea623525041c3ac54f",ack);
    hex("ffeeddccbbaa9988776655443322110002000000e8fbce6ae00199192fad371743ba8e6149299731997e24189e46adaddf2ecb6ce3f04490dbf8",clock_object);
    uint8_t id[6]={0xaa,0xbb,0xcc,0xdd,0xee,0xff};bj_data_init(&d,id,true,sign,save,NULL);bj_data_tick(&d,1000);
    CHECK(bj_data_crc((const uint8_t *)"123456789",9)==0xcbf43926);
    CHECK(bj_data_crc(challenge,56)==0x8dae2d00);CHECK(bj_data_crc(grant,69)==0xebdcb6d9);
    bj_packet_t r;CHECK(call(6,NULL,0,&r)==0 && r.length==12 && r.payload[2]==1 && r.payload[3]==63);
    uint8_t read_request[2]={2,255};CHECK(call(19,read_request,2,&r)==4);
    CHECK(upload(7,grant,69)==4);CHECK(upload(5,challenge,56)==0);CHECK(!d.session_valid);CHECK(bj_data_confirm(&d,1001));CHECK(!d.session_valid);
    CHECK(!memcmp(d.proof,proof,32));CHECK(upload(7,grant,69)==0 && d.session_valid && !d.clock_valid);
    read_request[0]=2;read_request[1]=255;CHECK(call(19,read_request,2,&r)==0 && r.payload[2]==0 && r.payload[3]==0);
    /* Unknown clock events persist with ts0; an authentic TIME does not rewrite them. */
    CHECK(bj_data_event(&d,12,1,0));CHECK(!memcmp(d.events[0]+8,"\0\0\0\0",4));
    bj_data_init(&loaded,id,true,sign,save,NULL);CHECK(bj_data_load(&loaded,durable,durable_size));CHECK(loaded.event_count==1 && loaded.next_event==2);
    uint16_t old_count=d.event_count;uint64_t old_next=d.next_event;fail_save=true;CHECK(!bj_data_event(&d,1,0,0));CHECK(d.event_count==old_count && d.next_event==old_next);fail_save=false;
    /* Use independently signed >2^53 fixture for exact event and ACK paths. */
    d.event_count=0;d.next_event=UINT64_C(9007199254740993);d.clock_valid=true;d.unix_base=0x6acefbe8u;d.clock_at=d.now;
    CHECK(bj_data_event(&d,1,0,0));CHECK(!memcmp(d.events[0],event,16));
    read_request[0]=2;read_request[1]=255;CHECK(call(19,read_request,2,&r)==0 && r.payload[2]==48);
    CHECK(!memcmp(d.frozen,event,48));CHECK(upload(8,ack,60)==0 && !d.event_count);CHECK(upload(8,ack,60)==0 && !d.event_count);
    CHECK(upload(9,clock_object,58)==0 && d.clock_valid && d.timezone==480);
    ack[25]^=1;CHECK(upload(8,ack,60)==4);ack[25]^=1;
    CHECK(upload(9,clock_object,58)==0); /* exact counter/object replay is idempotent */
    test_signed_lifecycle();
    test_m2_environment();
    test_social_owner();
    test_active_wire();
    bj_data_tick(&d,d.now+10001);read_request[0]=2;read_request[1]=0;CHECK(call(19,read_request,2,&r)==3);
    bj_data_disconnect(&d);CHECK(!d.session_valid && !d.frozen_valid && !d.staging);CHECK(upload(9,clock_object,58)==4);
    bj_data_init(&d,id,false,sign,save,NULL);CHECK(upload(5,challenge,56)==4);
    CHECK(call(20,NULL,0,&r)==2);CHECK(call(21,NULL,0,&r)==2);
    durable[4]^=1;CHECK(!bj_data_load(&loaded,durable,durable_size));
    printf("PASS data core: %u checks including independent canonical vectors, durable FIFO, failclosed and replay\n",checks);return 0;
}
