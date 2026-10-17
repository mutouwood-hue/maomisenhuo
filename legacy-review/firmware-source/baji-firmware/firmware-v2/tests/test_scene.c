#include "baji_scene.h"
#include <stdio.h>
static int checks, failures;
#define CHECK(c) do {checks++;if(!(c)){failures++;printf("FAIL %d: %s\n",__LINE__,#c);}}while(0)
int main(void) {
    bj_scene_t s; bj_scene_init(&s);
    CHECK(s.screen==BJ_PAIR && !s.authenticated);
    CHECK(bj_scene_target(&s,BJ_LEFT)==-1);
    CHECK(bj_scene_start_local(&s));CHECK(!s.authenticated && s.local_experience);
    CHECK(!bj_scene_start_local(&s));
    bj_scene_tap(&s,20,20,1);CHECK(s.phase==BJ_GUIDE_DO);
    bj_scene_tap(&s,248,262,10);CHECK(s.phase==BJ_GUIDE_OK);
    CHECK(bj_scene_target(&s,BJ_UP)==-1);
    bj_scene_tick(&s,909);CHECK(s.step==0);
    bj_scene_tick(&s,910);CHECK(s.step==1 && s.screen==BJ_GUIDE);
    for(int step=1;step<=3;step++) {
        bj_direction_t forward=step==1?BJ_UP:step==2?BJ_DOWN:BJ_LEFT;
        bj_direction_t back=step==1?BJ_DOWN:step==2?BJ_UP:BJ_RIGHT;
        CHECK(bj_scene_target(&s,forward)>=0);
        CHECK(!bj_scene_commit(&s,step==3?BJ_UP:back,1000));
        CHECK(bj_scene_commit(&s,forward,1000));CHECK(s.phase==BJ_GUIDE_BACK);
        CHECK(!bj_scene_commit(&s,forward,1010));
        CHECK(bj_scene_commit(&s,back,1020));CHECK(s.screen==BJ_GUIDE && s.phase==BJ_GUIDE_OK);
        CHECK(!s.authenticated);
        bj_scene_tick(&s,1920);CHECK(s.step==step+1);
    }
    CHECK(bj_scene_can_hold(&s));
    bj_scene_hold_start(&s);CHECK(s.screen==BJ_VOICE);
    bj_scene_hold_end(&s,2000,true);CHECK(s.screen==BJ_GUIDE && !s.voice_success_pending);
    bj_scene_hold_start(&s);bj_scene_hold_end(&s,2100,false);
    CHECK(!bj_scene_can_hold(&s));
    bj_scene_tick(&s,2339);CHECK(s.phase==BJ_GUIDE_DO);
    bj_scene_tick(&s,2340);CHECK(s.phase==BJ_GUIDE_OK);
    bj_scene_tick(&s,3240);CHECK(s.screen==BJ_DONE);
    bj_scene_tick(&s,5000);CHECK(s.screen==BJ_DONE && s.step==5);
    bj_scene_tap(&s,233,233,5010);CHECK(s.screen==BJ_MAIN_A && !s.tutorial_active);
    CHECK(!s.authenticated && s.local_experience);
    CHECK(bj_scene_commit(&s,BJ_LEFT,5020));CHECK(s.screen==BJ_MAIN_B);
    CHECK(bj_scene_commit(&s,BJ_UP,5030));CHECK(s.screen==BJ_CARE);
    CHECK(bj_scene_commit(&s,BJ_DOWN,5040));CHECK(s.screen==BJ_MAIN_B);
    CHECK(bj_scene_commit(&s,BJ_DOWN,5050));CHECK(s.screen==BJ_STATUS);
    bj_scene_tap(&s,233,414,5060);CHECK(s.screen==BJ_SETTINGS);
    CHECK(bj_scene_commit(&s,BJ_RIGHT,5070));CHECK(s.screen==BJ_STATUS);
    bj_scene_init(&s);CHECK(s.screen==BJ_PAIR && !s.local_experience);
    bj_scene_owner_verified(&s);CHECK(s.authenticated && s.screen==BJ_GUIDE);
    CHECK(!bj_scene_start_local(&s));
    bj_scene_tap(&s,233,420,0);CHECK(s.screen==BJ_MAIN_A && s.authenticated);
    bj_scene_init(&s);CHECK(bj_scene_start_local(&s));
    s.step=3;CHECK(bj_scene_commit(&s,BJ_RIGHT,0));CHECK(s.screen==BJ_MAIN_C && s.back_direction==BJ_LEFT);
    CHECK(bj_scene_commit(&s,BJ_LEFT,1));CHECK(s.screen==BJ_GUIDE);
    CHECK(bj_scene_target(NULL,BJ_UP)==-1);
    /* Feed real recogniser outputs into navigation, not synthetic commits only. */
    bj_gesture_t gesture; bj_gesture_config_t config=bj_gesture_html_config();
    CHECK(bj_gesture_init(&gesture,&config));
    bj_scene_init(&s);CHECK(bj_scene_start_local(&s));
    bj_gesture_press(&gesture,248,262,0,bj_scene_can_hold(&s));
    bj_input_result_t input=bj_gesture_release(&gesture,248,262,100,false,false);
    CHECK(input.kind==BJ_TAP);
    bj_scene_tap(&s,input.x,input.y,100);bj_scene_tick(&s,1000);
    CHECK(s.step==1);
    bj_gesture_press(&gesture,233,404,1100,bj_scene_can_hold(&s));
    bj_gesture_move(&gesture,233,236,1300);
    CHECK(bj_gesture_direction(&gesture)==BJ_UP);
    CHECK(bj_scene_target(&s,BJ_UP)==BJ_CARE);
    input=bj_gesture_release(&gesture,233,236,1400,true,false);
    CHECK(input.kind==BJ_COMMIT);
    /* Renderer calls arrival only after commit animation finishes. */
    CHECK(s.screen==BJ_GUIDE);
    CHECK(bj_scene_commit(&s,input.direction,1400+input.duration_ms));
    CHECK(s.screen==BJ_CARE && s.phase==BJ_GUIDE_BACK);
    bj_gesture_press(&gesture,233,100,1600,false);
    input=bj_gesture_release(&gesture,233,260,1700,true,true);
    CHECK(input.kind==BJ_CANCEL && s.screen==BJ_CARE);
    bj_gesture_press(&gesture,233,100,1800,false);
    input=bj_gesture_release(&gesture,233,260,1900,true,false);
    CHECK(input.kind==BJ_COMMIT);
    CHECK(bj_scene_commit(&s,input.direction,1900+input.duration_ms));
    CHECK(s.screen==BJ_GUIDE && s.phase==BJ_GUIDE_OK);
    printf("v2 scene: %d checks, %d failures\n",checks,failures);return failures?1:0;
}
