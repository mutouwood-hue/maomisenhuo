#include "baji_link.h"
#include <string.h>
void bj_link_init(bj_link_t *l,const uint8_t id[6]) {
    if(!l) return;
    memset(l,0,sizeof(*l));
    if(id) memcpy(l->identity,id,6);
}
bool bj_link_state(bj_link_t *l,const bj_controller_t *c,const bj_power_view_t *p,uint8_t out[10]) {
    if(!l || !c || !out) return false;
    const bj_scene_t *s=&c->scene;
    uint8_t state[8]={(uint8_t)s->screen,s->step,(uint8_t)s->phase,
        (uint8_t)((s->local_experience?1:0)|(s->authenticated?2:0)|(s->tutorial_active?4:0)|(c->suspended?8:0)),
        s->face,255,0,255};
    if(p) {
        if(p->battery_valid && p->battery_percent>=0 && p->battery_percent<=100) state[5]=(uint8_t)p->battery_percent;
        if(p->mode>=BJ_POWER_UNKNOWN && p->mode<=BJ_POWER_LOW) state[6]=(uint8_t)p->mode;
        if(p->usb_valid) state[7]=p->usb_present?1:0;
    }
    if(!l->has_state || memcmp(l->last_state,state,8)!=0) {
        l->revision++;memcpy(l->last_state,state,8);l->has_state=true;
    }
    memcpy(out,state,8);out[8]=(uint8_t)l->revision;out[9]=(uint8_t)(l->revision>>8);return true;
}
static bool busy(const bj_controller_t *c) {
    return c->suspended || c->gesture.pressed || c->motion!=BJ_INPUT_NONE || c->scene.screen==BJ_VOICE;
}
bool bj_link_dispatch(bj_link_t *l,bj_controller_t *c,const bj_power_view_t *power,
                      const uint8_t *wire,size_t n,uint8_t out[20]) {
    if(!l || !c || !out) return false;
    bj_packet_t req;
    if(!bj_packet_decode(wire,n,&req)) return false;
    bj_packet_t ack={.opcode=0x80,.sequence=req.sequence,.length=2};
    ack.payload[0]=req.opcode;
    if(!bj_packet_request_valid(&req)) ack.payload[1]=1;
    else switch(req.opcode) {
    case 1:
        ack.length=10;ack.payload[2]=1;ack.payload[3]=15;memcpy(ack.payload+4,l->identity,6);break;
    case 2:
        ack.length=12;bj_link_state(l,c,power,ack.payload+2);break;
    case 3:
        if(busy(c)) ack.payload[1]=3;
        else if(c->scene.authenticated) ack.payload[1]=4;
        else if(!c->scene.local_experience && !bj_scene_start_local(&c->scene)) ack.payload[1]=4;
        if(!ack.payload[1]) {ack.length=12;bj_link_state(l,c,power,ack.payload+2);}break;
    case 4:
        ack.length=(uint8_t)(2+req.length);memcpy(ack.payload+2,req.payload,req.length);break;
    case 5:
        if(busy(c)) ack.payload[1]=3;
        else if(c->scene.tutorial_active || !c->scene.local_experience || c->scene.authenticated) ack.payload[1]=4;
        else {
            c->scene.face=req.payload[0];
            if(c->scene.screen>=BJ_MAIN_A && c->scene.screen<=BJ_MAIN_C) c->scene.screen=(bj_screen_t)(BJ_MAIN_A+c->scene.face);
            ack.length=12;bj_link_state(l,c,power,ack.payload+2);
        }break;
    default: ack.payload[1]=2;break;
    }
    return bj_packet_encode(&ack,out);
}
