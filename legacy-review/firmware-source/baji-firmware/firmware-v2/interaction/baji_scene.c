#include "baji_scene.h"
#include <string.h>
static bool face(bj_screen_t screen) {return screen>=BJ_MAIN_A && screen<=BJ_MAIN_C;}
static bool hit(int x,int y,int cx,int cy,int radius) {
    int64_t dx=(int64_t)x-cx,dy=(int64_t)y-cy;
    /* Reject extreme coordinates before squaring. */
    if (dx<=-radius || dx>=radius || dy<=-radius || dy>=radius) return false;
    return dx*dx+dy*dy<(int64_t)radius*radius;
}
static void success(bj_scene_t *s,uint32_t now) {s->phase=BJ_GUIDE_OK;s->success_t0=now;s->back_direction=BJ_DIR_NONE;}
void bj_scene_init(bj_scene_t *s) {if(s){memset(s,0,sizeof(*s));s->screen=BJ_PAIR;}}
bool bj_scene_start_local(bj_scene_t *s) {
    if(!s || s->screen!=BJ_PAIR || s->authenticated) return false;
    s->local_experience=true;s->tutorial_active=true;s->screen=BJ_GUIDE;s->step=0;s->phase=BJ_GUIDE_DO;return true;
}
void bj_scene_owner_verified(bj_scene_t *s) {
    if(!s) return;
    s->authenticated=true;
    if(s->screen==BJ_PAIR){s->tutorial_active=true;s->screen=BJ_GUIDE;s->step=0;s->phase=BJ_GUIDE_DO;}
    /* Preserve the isolated local session rather than silently merge its learning. */
}
int bj_scene_target(const bj_scene_t *s,bj_direction_t dir) {
    if(!s || dir==BJ_DIR_NONE) return -1;
    if(s->tutorial_active) {
        if(s->phase==BJ_GUIDE_BACK) return dir==s->back_direction?BJ_GUIDE:-1;
        if(s->screen!=BJ_GUIDE || s->phase!=BJ_GUIDE_DO) return -1;
        if(s->step==1 && dir==BJ_UP) return BJ_CARE;
        if(s->step==2 && dir==BJ_DOWN) return BJ_STATUS;
        if(s->step==3 && dir==BJ_LEFT) return BJ_MAIN_B;
        if(s->step==3 && dir==BJ_RIGHT) return BJ_MAIN_C;
        return -1;
    }
    if(face(s->screen)) {
        if(dir==BJ_UP) return BJ_CARE;
        if(dir==BJ_DOWN) return BJ_STATUS;
        if(dir==BJ_LEFT) return BJ_MAIN_A+(s->screen-BJ_MAIN_A+1)%3;
        if(dir==BJ_RIGHT) return BJ_MAIN_A+(s->screen-BJ_MAIN_A+2)%3;
    }
    if(s->screen==BJ_CARE && dir==BJ_DOWN) return BJ_MAIN_A+s->face;
    if(s->screen==BJ_STATUS && dir==BJ_UP) return BJ_MAIN_A+s->face;
    if(s->screen==BJ_SETTINGS && dir==BJ_RIGHT) return BJ_STATUS;
    return -1;
}
bool bj_scene_commit(bj_scene_t *s,bj_direction_t dir,uint32_t now) {
    int target=bj_scene_target(s,dir);if(target<0) return false;
    s->screen=(bj_screen_t)target;
    if(face(s->screen)) s->face=(uint8_t)(s->screen-BJ_MAIN_A);
    if(s->tutorial_active) {
        if(target==BJ_GUIDE) success(s,now);
        else {s->back_enter_t0=now;s->phase=BJ_GUIDE_BACK;s->back_direction=dir==BJ_UP?BJ_DOWN:dir==BJ_DOWN?BJ_UP:dir==BJ_LEFT?BJ_RIGHT:BJ_LEFT;}
    }
    return true;
}
bool bj_scene_can_hold(const bj_scene_t *s) {
    return s && (s->tutorial_active?(s->screen==BJ_GUIDE && s->step==4 && s->phase==BJ_GUIDE_DO && !s->voice_success_pending):face(s->screen));
}
void bj_scene_hold_start(bj_scene_t *s) {
    if(!bj_scene_can_hold(s)) return;
    s->voice_previous=s->screen;s->screen=BJ_VOICE;
}
void bj_scene_hold_end(bj_scene_t *s,uint32_t now,bool cancelled) {
    if(!s || s->screen!=BJ_VOICE) return;
    s->screen=s->voice_previous;
    if(s->tutorial_active && s->step==4 && !cancelled) {
        s->voice_success_pending=true;s->voice_return_t0=now;
    }
}
void bj_scene_tap(bj_scene_t *s,int x,int y,uint32_t now) {
    if(!s) return;
    if(s->screen==BJ_DONE) {s->tutorial_active=false;s->screen=BJ_MAIN_A;s->face=0;return;}
    if(s->screen==BJ_GUIDE && s->tutorial_active) {
        if(hit(x,y,233,420,36)) {s->tutorial_active=false;s->voice_success_pending=false;s->screen=BJ_MAIN_A;s->face=0;return;}
        if(s->step==0 && s->phase==BJ_GUIDE_DO && hit(x,y,248,262,92)) success(s,now);
        return;
    }
    if(!s->tutorial_active && s->screen==BJ_STATUS && hit(x,y,233,414,36)) s->screen=BJ_SETTINGS;
}
void bj_scene_tick(bj_scene_t *s,uint32_t now) {
    if(!s || !s->tutorial_active) return;
    if(s->voice_success_pending && now-s->voice_return_t0>=240) {
        s->voice_success_pending=false;success(s,now);
    }
    if(s->phase==BJ_GUIDE_OK && now-s->success_t0>=900) {
        s->step++;s->phase=BJ_GUIDE_DO;s->back_direction=BJ_DIR_NONE;
        s->screen=s->step>=5?BJ_DONE:BJ_GUIDE;
    }
}
