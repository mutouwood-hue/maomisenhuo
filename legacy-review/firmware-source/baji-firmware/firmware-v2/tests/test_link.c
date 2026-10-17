#include "baji_link.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
static unsigned checks;
#define CHECK(x) do {assert(x);checks++;} while(0)
static bj_packet_t call(bj_link_t *l,bj_controller_t *c,bj_packet_t req) {
    uint8_t in[20],out[20];bj_packet_t ack;
    CHECK(bj_packet_encode(&req,in));CHECK(bj_link_dispatch(l,c,NULL,in,20,out));
    CHECK(bj_packet_decode(out,20,&ack));CHECK(ack.opcode==0x80 && ack.sequence==req.sequence && ack.payload[0]==req.opcode);
    return ack;
}
int main(void) {
    bj_link_t l;bj_controller_t c;uint8_t id[6]={1,2,3,4,5,6},state[10],again[10];
    bj_link_init(&l,id);bj_controller_init(&c);
    bj_packet_t req={.opcode=1,.sequence=17},ack=call(&l,&c,req);
    CHECK(ack.length==10 && ack.payload[1]==0 && ack.payload[2]==1 && ack.payload[3]==15);
    CHECK(memcmp(ack.payload+4,id,6)==0);CHECK(!c.scene.authenticated && !c.scene.local_experience);
    CHECK(bj_link_state(&l,&c,NULL,state));CHECK(state[5]==255 && state[6]==0 && state[7]==255);
    CHECK(bj_link_state(&l,&c,NULL,again));CHECK(memcmp(state,again,10)==0);
    req.opcode=2;ack=call(&l,&c,req);CHECK(ack.length==12 && ack.payload[1]==0 && memcmp(ack.payload+2,state,10)==0);
    req.opcode=3;c.gesture.pressed=true;ack=call(&l,&c,req);CHECK(ack.payload[1]==3 && c.scene.screen==BJ_PAIR);
    c.gesture.pressed=false;ack=call(&l,&c,req);CHECK(ack.payload[1]==0 && c.scene.screen==BJ_GUIDE && c.scene.tutorial_active && !c.scene.authenticated);
    bj_scene_t before=c.scene;ack=call(&l,&c,req);CHECK(ack.payload[1]==0 && memcmp(&before,&c.scene,sizeof(before))==0);
    req.opcode=5;req.length=1;req.payload[0]=2;ack=call(&l,&c,req);CHECK(ack.payload[1]==4 && c.scene.face==0);
    c.scene.tutorial_active=false;c.scene.screen=BJ_MAIN_A;ack=call(&l,&c,req);CHECK(ack.payload[1]==0 && c.scene.face==2 && c.scene.screen==BJ_MAIN_C);
    for(unsigned op=3;op<=5;op+=2) {
        req.opcode=(uint8_t)op;req.length=op==5?1:0;
        c.suspended=true;before=c.scene;ack=call(&l,&c,req);CHECK(ack.payload[1]==3 && memcmp(&before,&c.scene,sizeof(before))==0);c.suspended=false;
        c.motion=BJ_COMMIT;ack=call(&l,&c,req);CHECK(ack.payload[1]==3);c.motion=BJ_INPUT_NONE;
        c.scene.authenticated=true;ack=call(&l,&c,req);CHECK(ack.payload[1]==4);c.scene.authenticated=false;
    }
    req.opcode=4;
    for(unsigned n=0;n<=12;n++) {
        req.length=(uint8_t)n;for(unsigned i=0;i<n;i++)req.payload[i]=(uint8_t)(i+71);
        ack=call(&l,&c,req);CHECK(ack.payload[1]==(n<=10?0:1));
        if(n<=10)CHECK(ack.length==n+2 && memcmp(ack.payload+2,req.payload,n)==0);
    }
    req.opcode=77;req.length=0;ack=call(&l,&c,req);CHECK(ack.payload[1]==2);
    req.sequence=0;ack=call(&l,&c,req);CHECK(ack.payload[1]==1);
    bj_power_view_t p={.mode=BJ_POWER_LOW,.battery_valid=true,.battery_percent=4,.usb_valid=true};
    CHECK(bj_link_state(&l,&c,&p,state));CHECK(state[5]==4 && state[6]==2 && state[7]==0);
    uint16_t rev=l.revision;p.battery_percent=101;CHECK(bj_link_state(&l,&c,&p,state));CHECK(state[5]==255 && l.revision==(uint16_t)(rev+1));
    l.revision=65535;c.scene.step++;CHECK(bj_link_state(&l,&c,&p,state));CHECK(state[8]==0 && state[9]==0);
    uint8_t bad[20]={0},out[20];memset(out,0xaa,20);before=c.scene;
    CHECK(!bj_link_dispatch(&l,&c,NULL,bad,20,out));CHECK(out[0]==0xaa && memcmp(&before,&c.scene,sizeof(before))==0);
    CHECK(!bj_link_dispatch(NULL,&c,NULL,bad,20,out));CHECK(!bj_link_state(&l,NULL,NULL,state));
    c.scene.authenticated=false;
    req.opcode=5;req.length=1;req.sequence=99;req.payload[0]=3;before=c.scene;
    ack=call(&l,&c,req);CHECK(ack.payload[1]==1 && memcmp(&before,&c.scene,sizeof(before))==0);
    req.payload[0]=1;c.scene.screen=BJ_VOICE;before=c.scene;
    ack=call(&l,&c,req);CHECK(ack.payload[1]==3 && memcmp(&before,&c.scene,sizeof(before))==0);
    c.scene.screen=BJ_MAIN_C;CHECK(bj_link_state(&l,&c,NULL,state));rev=l.revision;
    bj_scene_owner_verified(&c.scene);CHECK(bj_link_state(&l,&c,NULL,again));
    CHECK((again[3]&3)==3 && l.revision==(uint16_t)(rev+1));before=c.scene;
    ack=call(&l,&c,req);CHECK(ack.payload[1]==4 && memcmp(&before,&c.scene,sizeof(before))==0);
    printf("link: %u checks, 0 failures\n",checks);return 0;
}
