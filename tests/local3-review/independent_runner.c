/* Independent host checks. Reuse only the owner's LVGL/BSP/domain doubles and
 * pointer feed helpers, then include actual frozen production pages unchanged. */
#define main owner_preview_main_not_called
#include "../../artifacts/firmware-local-v3/source/tools/host_preview/preview.c"
#undef main
static unsigned independent_checks;
#define REQUIRE(x) do {independent_checks++;if(!(x)){fprintf(stderr,"independent FAIL line %d: %s\n",__LINE__,#x);exit(11);}}while(0)
static void quiet(void){toast_active=false;hide(toast,true);}
static void present(void){peer_fixture.phase=L2P_COMPLETE;peer_fixture.complete=true;peer_fixture.incoming_new=false;peer_fixture.complete_count++;refresh_state();REQUIRE(gift_modal());REQUIRE(!ui_drag.active);}
static void dismiss(void){touch(233,360,80);advance(280);REQUIRE(!gift_modal());quiet();}
static void sleeping_modal(void){
 unsigned saved=mock_pet_calls;begin_care(L2_ACTION_SLEEP);advance(280);present();touch(233,323,1800);REQUIRE(mock_pet_calls==saved);REQUIRE(current_page==PAGE_CARE_ACTION);REQUIRE(care_steps==0);dismiss();
 point(233,323,LV_INDEV_STATE_PRESSED);advance(800);present();advance(1100);point(233,323,LV_INDEV_STATE_RELEASED);advance(100);REQUIRE(mock_pet_calls==saved);REQUIRE(!contact_cancelled);REQUIRE(!gesture.active);dismiss();
 point(233,323,LV_INDEV_STATE_PRESSED);advance(900);lv_indev_reset(host_input,NULL);advance(700);point(233,323,LV_INDEV_STATE_RELEASED);advance(100);REQUIRE(mock_pet_calls==saved);REQUIRE(!ui_drag.active);
}
static void playing_modal(void){
 unsigned saved=mock_pet_calls;begin_care(L2_ACTION_PLAY);advance(280);present();
 for(unsigned i=0;i<7;i++){stroke(160,280,330,280,40);advance(720);}
 REQUIRE(care_steps==0);REQUIRE(mock_pet_calls==saved);REQUIRE(current_page==PAGE_CARE_ACTION);dismiss();
}
static void modal_drag(void){
 unsigned saved=mock_pet_calls;select_page(PAGE_HOME);face=1;update_face();quiet();
 point(300,233,LV_INDEV_STATE_PRESSED);advance(50);point(200,233,LV_INDEV_STATE_PRESSED);REQUIRE(ui_drag.active);present();REQUIRE(lv_obj_get_x(pages[PAGE_HOME])==0);point(200,233,LV_INDEV_STATE_RELEASED);advance(300);REQUIRE(face==1);REQUIRE(current_page==PAGE_HOME);dismiss();
 stroke(320,233,180,233,200);REQUIRE(ui_drag.settling);present();advance(400);REQUIRE(face==1);REQUIRE(current_page==PAGE_HOME);
 for(unsigned i=0;i<4;i++){int x=i<2?233:(i==2?100:360),y=i<2?(i==0?350:150):233;int tx=i<2?233:466-x,ty=i<2?466-y:233;stroke(x,y,tx,ty,180);advance(260);REQUIRE(current_page==PAGE_HOME);REQUIRE(face==1);REQUIRE(!ui_drag.active);}
 REQUIRE(mock_pet_calls==saved);dismiss();
}
static void toast_text_input(void){
 select_page(PAGE_GUIDE);guide_index=0;update_guide();unsigned saved=mock_pet_calls;
 REQUIRE(sizeof(toast_messages)/sizeof(*toast_messages)==25);
 for(unsigned i=0;i<25;i++){
  announce(toast_messages[i]);lv_obj_update_layout(toast);lv_point_t extent;lv_text_get_size(&extent,toast_messages[i],lv_obj_get_style_text_font(toast,0),lv_obj_get_style_text_letter_space(toast,0),lv_obj_get_style_text_line_space(toast,0),LV_COORD_MAX,LV_TEXT_FLAG_NONE);
  REQUIRE(!strcmp(lv_label_get_text(toast),toast_messages[i]));REQUIRE(extent.x<=lv_obj_get_content_width(toast));REQUIRE(extent.y<=lv_obj_get_content_height(toast));REQUIRE(lv_label_get_long_mode(toast)!=LV_LABEL_LONG_MODE_DOTS);
  lv_area_t a;lv_obj_get_coords(toast,&a);REQUIRE(a.y2<ui_target(HIT_GUIDE).cy-ui_target(HIT_GUIDE).w);REQUIRE(toast_covers(a.x1,a.y1));REQUIRE(toast_covers(a.x2,a.y2));
 }
 touch(233,64,800);REQUIRE(guide_index==0);REQUIRE(!guide_pass_until);REQUIRE(mock_pet_calls==saved);advance(1900);quiet();
 select_page(PAGE_HOME);announce(toast_messages[0]);point(143,44,LV_INDEV_STATE_PRESSED);advance(80);point(233,300,LV_INDEV_STATE_PRESSED);advance(60);point(233,300,LV_INDEV_STATE_RELEASED);advance(300);REQUIRE(current_page==PAGE_HOME);REQUIRE(!ui_drag.active);REQUIRE(mock_pet_calls==saved);
}
static void guide_actual(void){
 unsigned saved=mock_pet_calls;guide_saved=0;guide_done=guide_mastered=false;select_page(PAGE_GUIDE);quiet();
 advance(3500);REQUIRE(guide_index==0);REQUIRE(!guide_mastered);touch(80,200,80);advance(600);REQUIRE(guide_index==0);touch(233,200,80);advance(600);REQUIRE(guide_index==1);
 stroke(233,200,233,300,180);advance(600);REQUIRE(guide_index==1);stroke(233,300,233,180,180);advance(600);REQUIRE(guide_index==2);
 stroke(233,300,233,180,180);advance(600);REQUIRE(guide_index==2);stroke(233,180,233,300,180);advance(600);REQUIRE(guide_index==3);
 stroke(300,233,170,233,180);advance(600);REQUIRE(guide_index==3);stroke(300,233,170,233,180);advance(600);REQUIRE(guide_index==3);REQUIRE(guide_lr_mask==1);stroke(170,233,300,233,180);advance(600);REQUIRE(guide_index==4);
 touch(233,200,500);advance(600);REQUIRE(guide_index==4);touch(233,200,680);advance(600);REQUIRE(current_page==PAGE_WELCOME);REQUIRE(guide_mastered);REQUIRE(guide_saved==1);REQUIRE(mock_pet_calls==saved);REQUIRE(legacy_guide_saved==1);
}
static void guide_persistence(void){
 for(unsigned v=0;v<4;v++){guide_saved=v;load_preferences();REQUIRE(guide_done==(v==1||v==2));REQUIRE(guide_mastered==(v==1));REQUIRE(legacy_guide_saved==1);}
 guide_saved=0;load_preferences();select_page(PAGE_GUIDE);guide_store_fail=true;touch(233,411,80);advance(280);REQUIRE(current_page==PAGE_GUIDE);REQUIRE(!guide_done);REQUIRE(guide_saved==0);REQUIRE(toast_active);
 guide_store_fail=false;quiet();touch(233,411,80);advance(280);REQUIRE(guide_saved==2);REQUIRE(!guide_mastered);REQUIRE(!guide_completed_now);
 /* Finishing after an old skip upgrades v3, while re-skip cannot invent mastery. */
 select_page(PAGE_GUIDE);quiet();guide_index=4;update_guide();touch(233,200,680);advance(600);REQUIRE(guide_saved==1);REQUIRE(guide_mastered);REQUIRE(guide_completed_now);
}
static void drag_boundaries(void){
 unsigned saved=mock_pet_calls;select_page(PAGE_HOME);quiet();stroke(233,350,233,211,800);REQUIRE(ui_drag.settling&&!ui_drag.commit);uint32_t start=lv_tick_get();while(ui_drag.active&&lv_tick_get()-start<300)advance(10);REQUIRE(lv_tick_get()-start==180);REQUIRE(current_page==PAGE_HOME);REQUIRE(lv_obj_get_y(pages[PAGE_HOME])==0);
 stroke(233,350,233,210,800);REQUIRE(ui_drag.commit);start=lv_tick_get();while(ui_drag.active&&lv_tick_get()-start<300)advance(10);REQUIRE(lv_tick_get()-start<=220);REQUIRE(lv_tick_get()-start==200);REQUIRE(current_page==PAGE_CARE);
 select_page(PAGE_STATUS);point(233,200,LV_INDEV_STATE_PRESSED);advance(60);point(233,465,LV_INDEV_STATE_PRESSED);REQUIRE(ui_drag.offset==28);point(233,465,LV_INDEV_STATE_RELEASED);advance(200);REQUIRE(current_page==PAGE_STATUS);REQUIRE(lv_obj_get_y(pages[PAGE_STATUS])==0);
 select_page(PAGE_HOME);point(233,262,LV_INDEV_STATE_PRESSED);advance(30);point(250,262,LV_INDEV_STATE_PRESSED);advance(30);point(233,262,LV_INDEV_STATE_PRESSED);point(233,262,LV_INDEV_STATE_RELEASED);advance(250);REQUIRE(mock_pet_calls==saved);REQUIRE(current_page==PAGE_HOME);
 point(233,262,LV_INDEV_STATE_PRESSED);advance(700);point(233,262,LV_INDEV_STATE_RELEASED);advance(280);REQUIRE(current_page==PAGE_VOICE);REQUIRE(mock_pet_calls==saved);
}
static void pure_classifier(void){
 badge_gesture_t g={0};badge_gesture_begin(&g,233,233,UINT32_MAX-100);REQUIRE(badge_gesture_end(&g,233,233,199)==BADGE_GESTURE_TAP);
 g=(badge_gesture_t){0};badge_gesture_begin(&g,233,233,0);REQUIRE(badge_gesture_end(&g,233,233,301)==BADGE_GESTURE_NONE);
 g=(badge_gesture_t){0};badge_gesture_begin(&g,233,233,0);REQUIRE(badge_gesture_end(&g,244,233,600)==BADGE_GESTURE_HOLD);
 g=(badge_gesture_t){0};badge_gesture_begin(&g,233,233,0);REQUIRE(badge_gesture_end(&g,245,233,600)==BADGE_GESTURE_NONE);
 for(unsigned d=49;d<=50;d++){g=(badge_gesture_t){0};badge_gesture_begin(&g,233,300,0);REQUIRE(badge_gesture_end(&g,233,300-d,500)==(d==50?BADGE_GESTURE_UP:BADGE_GESTURE_NONE));}
 for(unsigned t=500;t<=501;t++){g=(badge_gesture_t){0};badge_gesture_begin(&g,233,300,0);REQUIRE(badge_gesture_end(&g,233,250,t)==(t==500?BADGE_GESTURE_UP:BADGE_GESTURE_NONE));}
 g=(badge_gesture_t){0};badge_gesture_begin(&g,-100,900,0);REQUIRE(g.x==0&&g.y==465);badge_gesture_move(&g,900,-100);REQUIRE(g.last_x==465&&g.last_y==0);badge_gesture_end(&g,0,465,200);REQUIRE(!g.active);REQUIRE(badge_gesture_end(&g,0,465,200)==BADGE_GESTURE_NONE);
 g=(badge_gesture_t){0};badge_gesture_begin(&g,200,200,0);badge_gesture_move(&g,213,200);REQUIRE(g.axis==1);REQUIRE(badge_gesture_end(&g,200,350,100)==BADGE_GESTURE_NONE);
}
static void clock_empty(void){
 select_page(PAGE_HOME);for(unsigned f=1;f<=2;f++){face=f;clock_valid=false;update_face();refresh_state();REQUIRE(lv_obj_has_flag(ring_marker,LV_OBJ_FLAG_HIDDEN));REQUIRE(!strcmp(lv_label_get_text(home_clock),"需手机校时"));for(unsigned i=0;i<2;i++)REQUIRE(!lv_obj_has_flag(day_rings[i],LV_OBJ_FLAG_HIDDEN));REQUIRE(strstr(lv_label_get_text(ring_missing),"待手机同步"));REQUIRE(lv_obj_has_flag(heart_legend,LV_OBJ_FLAG_HIDDEN)==(f!=2));clock_valid=true;update_clock();REQUIRE(!lv_obj_has_flag(ring_marker,LV_OBJ_FLAG_HIDDEN));REQUIRE(strstr(lv_label_get_text(home_clock),":")!=NULL);}
}
static void registry_geometry(void){
 for(unsigned face_id=0;face_id<3;face_id++)for(unsigned gi=0;gi<5;gi++){face=face_id;guide_index=gi;for(unsigned i=0;i<HIT_COUNT;i++){ui_hit_target_t t=ui_target(i);if(t.shape==UI_HIT_UNAVAILABLE)continue;int dx=t.cx-233,dy=t.cy-233;if(t.shape==UI_HIT_CIRCLE)REQUIRE(hypot(dx,dy)+t.w<=212);else for(int x=-1;x<=1;x+=2)for(int y=-1;y<=1;y+=2)REQUIRE((dx+x*t.w/2)*(dx+x*t.w/2)+(dy+y*t.h/2)*(dy+y*t.h/2)<=212*212);}}
}
int main(int argc,char **argv){
 if(argc!=2)return 2;make_fixture("main_a");lv_init();lv_tick_inc(1000);if(!badge_ui_start())return 3;advance(1800);quiet();
 if(!strcmp(argv[1],"modal_sleep"))sleeping_modal();else if(!strcmp(argv[1],"modal_play"))playing_modal();else if(!strcmp(argv[1],"modal_drag"))modal_drag();else if(!strcmp(argv[1],"toast_text_input"))toast_text_input();else if(!strcmp(argv[1],"guide_actual"))guide_actual();else if(!strcmp(argv[1],"guide_persistence"))guide_persistence();else if(!strcmp(argv[1],"drag_boundaries"))drag_boundaries();else if(!strcmp(argv[1],"classifier"))pure_classifier();else if(!strcmp(argv[1],"clock_empty"))clock_empty();else if(!strcmp(argv[1],"registry_geometry"))registry_geometry();else return 4;
 printf("{\"case\":\"%s\",\"independentChecks\":%u,\"status\":\"passed\",\"hardware\":false}\n",argv[1],independent_checks);return 0;
}
