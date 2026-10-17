#include "baji_controller.h"
#include <string.h>
static void finish(bj_controller_t *c,uint32_t now) {
    if(c->motion==BJ_COMMIT) bj_scene_commit(&c->scene,c->direction,now);
    c->motion=BJ_INPUT_NONE;
}
void bj_controller_init(bj_controller_t *c) {
    if(!c) return;
    memset(c,0,sizeof(*c));bj_scene_init(&c->scene);
    bj_gesture_config_t config=bj_gesture_html_config();bj_gesture_init(&c->gesture,&config);
}
void bj_controller_set_suspended(bj_controller_t *c,bool suspended,uint32_t now) {
    if(!c || c->suspended==suspended) return;
    if(suspended) {
        /* Do not finish(): pending COMMIT must never reach its destination. */
        bj_scene_hold_end(&c->scene,now,true);
        c->scene.voice_success_pending=false;
        bj_gesture_config_t config=c->gesture.config;
        bj_gesture_init(&c->gesture,&config);
        c->motion=BJ_INPUT_NONE;c->direction=BJ_DIR_NONE;
        c->start_offset=0;c->duration=0;
        c->suspended_t0=now;
    } else {
        uint32_t elapsed=now-c->suspended_t0;
        if(c->scene.phase==BJ_GUIDE_OK) c->scene.success_t0+=elapsed;
    }
    c->suspended=suspended;
}
void bj_controller_press(bj_controller_t *c,int x,int y,uint32_t now) {
    if(!c || c->suspended || c->gesture.pressed) return;
    /* HTML resolves an existing transition when a fresh finger arrives. */
    finish(c,now);
    bj_gesture_press(&c->gesture,x,y,now,bj_scene_can_hold(&c->scene));
}
void bj_controller_move(bj_controller_t *c,int x,int y,uint32_t now) {
    if(c && !c->suspended) bj_gesture_move(&c->gesture,x,y,now);
}
void bj_controller_release(bj_controller_t *c,int x,int y,uint32_t now,bool cancelled) {
    if(!c || c->suspended || !c->gesture.pressed) return;
    if(!cancelled) bj_gesture_move(&c->gesture,x,y,now);
    bj_direction_t dir=bj_gesture_direction(&c->gesture);
    bool target=bj_scene_target(&c->scene,dir)>=0;
    bj_input_result_t r=bj_gesture_release(&c->gesture,x,y,now,target,cancelled);
    if(r.kind==BJ_TAP) bj_scene_tap(&c->scene,r.x,r.y,now);
    else if(r.kind==BJ_HOLD_END) bj_scene_hold_end(&c->scene,now,cancelled);
    else if(r.kind==BJ_COMMIT || r.kind==BJ_CANCEL || r.kind==BJ_RUBBER) {
        c->motion=r.kind;c->direction=r.direction;c->start_offset=r.offset;
        c->motion_t0=now;c->duration=r.duration_ms;
    }
}
void bj_controller_tick(bj_controller_t *c,uint32_t now) {
    if(!c || c->suspended) return;
    if(c->motion!=BJ_INPUT_NONE && now-c->motion_t0>=c->duration) finish(c,now);
    if(bj_gesture_tick(&c->gesture,now).kind==BJ_HOLD_START) bj_scene_hold_start(&c->scene);
    bj_scene_tick(&c->scene,now);
}
bj_frame_t bj_controller_frame(const bj_controller_t *c,uint32_t now) {
    bj_frame_t f={0};if(!c) return f;
    f.source=c->scene;f.target=c->scene;
    f.autonomous_paused=c->suspended || c->gesture.pressed || c->motion!=BJ_INPUT_NONE;
    if(c->suspended) return f;
    f.sliding=c->motion!=BJ_INPUT_NONE || (c->gesture.pressed && c->gesture.axis!=0);
    bj_direction_t dir=c->motion!=BJ_INPUT_NONE?c->direction:bj_gesture_direction(&c->gesture);
    int target=bj_scene_target(&c->scene,dir);
    int off=c->gesture.pressed?bj_gesture_offset(&c->gesture,target>=0):0;
    if(c->motion!=BJ_INPUT_NONE) {
        uint32_t elapsed=now-c->motion_t0;
        float p=c->duration && elapsed<c->duration?(float)elapsed/c->duration:1.f;
        float q=1.f-p,e=1.f-q*q*q;
        int sign=dir==BJ_UP || dir==BJ_LEFT?-1:1;
        off=(int)(c->start_offset+(c->motion==BJ_COMMIT?sign*c->gesture.config.panel-c->start_offset:-c->start_offset)*e);
    }
    f.target_visible=target>=0 && dir!=BJ_DIR_NONE && c->motion!=BJ_RUBBER;
    if(f.target_visible) {
        /* Preview the destination without changing the real source or running effects. */
        bj_scene_commit(&f.target,dir,now);
        if(f.target.screen==BJ_GUIDE) f.target.phase=BJ_GUIDE_DO;
    }
    int sign=dir==BJ_UP || dir==BJ_LEFT?-1:1;
    if(dir==BJ_UP || dir==BJ_DOWN) {f.source_y=off;f.target_y=off-sign*c->gesture.config.panel;}
    else if(dir==BJ_LEFT || dir==BJ_RIGHT) {f.source_x=off;f.target_x=off-sign*c->gesture.config.panel;}
    return f;
}
