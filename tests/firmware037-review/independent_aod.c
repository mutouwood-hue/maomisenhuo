/* OFFLINE fixture: actual production pages/timer/input, memory-only ports. */
#define main original_preview_main
#include PREVIEW_SOURCE
#undef main
#ifndef EXPECT_FIXED
#define EXPECT_FIXED 1
#endif
static unsigned checks,negatives;
#define REQUIRE(x) do{assert(x);checks++;}while(0)
static void label_json(FILE*f,lv_obj_t*o){lv_area_t a;lv_obj_get_coords(o,&a);fprintf(f,"{\"bounds\":[%d,%d,%d,%d],\"hidden\":%s,\"fontLine\":%u,\"text\":",a.x1,a.y1,a.x2,a.y2,lv_obj_has_flag(o,LV_OBJ_FLAG_HIDDEN)?"true":"false",lv_obj_get_style_text_font(o,0)->line_height);quote(f,lv_label_get_text(o));fputc('}',f);}
static void verify(unsigned target,bool valid,bool low,ui_mode_t desired){
    REQUIRE(mode==desired);REQUIRE(host_brightness==(desired==MODE_OFF?0:desired==MODE_AOD?35:75));REQUIRE(face==target);REQUIRE(current_page==PAGE_HOME);
    bool standby=desired==MODE_AOD||desired==MODE_OFF;
    REQUIRE(lv_obj_has_flag(home_hint,LV_OBJ_FLAG_HIDDEN)==!standby);
    REQUIRE(lv_obj_get_style_text_font(home_clock,0)==(target&&valid?&badge_n40:&local2_font20));
    REQUIRE(!strcmp(lv_label_get_text(home_clock),valid?"20:34":"需手机校时"));
    REQUIRE(lv_obj_get_y(home_clock)+lv_obj_get_height(home_clock)/2==(target?398:62));
    REQUIRE(lv_obj_has_flag(face_phase,LV_OBJ_FLAG_HIDDEN)==((EXPECT_FIXED&&standby)||(low&&target==0)));
    if(standby){
        REQUIRE(!strcmp(lv_label_get_text(home_hint),"轻点唤醒"));
        REQUIRE(lv_obj_get_style_text_font(home_hint,0)==&local2_font16);
        REQUIRE(lv_obj_get_y(home_hint)+lv_obj_get_height(home_hint)/2==((EXPECT_FIXED&&target)?438:390));
        lv_point_t size;lv_text_get_size(&size,lv_label_get_text(home_hint),lv_obj_get_style_text_font(home_hint,0),0,0,250,LV_TEXT_FLAG_NONE);
        int cx=233,cy=(EXPECT_FIXED&&target)?438:390;int x1=cx-size.x/2,x2=x1+size.x-1,y1=cy-size.y/2,y2=y1+size.y-1;
        for(unsigned i=0;i<4;i++){int x=(i&1?x1:x2)-233,y=(i&2?y1:y2)-233;REQUIRE(x*x+y*y<=233*233);}
        lv_area_t clock;lv_obj_get_coords(home_clock,&clock);bool overlap=!(y2<clock.y1||y1>clock.y2);
        if(EXPECT_FIXED||!target)REQUIRE(!overlap);else {REQUIRE(overlap);negatives++;}
        REQUIRE(lv_obj_has_flag(face_weather,LV_OBJ_FLAG_HIDDEN));REQUIRE(lv_obj_has_flag(face_action,LV_OBJ_FLAG_HIDDEN));
    }
}
int owner_matrix_main(int argc,char**argv){
    REQUIRE(argc==6);bool valid=atoi(argv[1]),low=atoi(argv[4]);unsigned target=atoi(argv[2]);ui_mode_t desired=(ui_mode_t)atoi(argv[3]);
    make_fixture(low?"main_low_stats":"main_a");lv_init();lv_tick_inc(1000);REQUIRE(badge_ui_start());choose("main_a",NULL,0);advance(300);
    REQUIRE(badge_ui_diagnostic_select_face(target));clock_valid=valid;refresh_state();aod_enabled=desired!=MODE_OFF;
    last_input=lv_tick_get()-(desired==MODE_PLAY?0:desired==MODE_COMP?11000:41000);advance(600);lv_obj_update_layout(lv_screen_active());
    for(unsigned i=0;i<5;i++){refresh_state();advance(260);lv_obj_update_layout(lv_screen_active());verify(target,valid,low,desired);}
    lv_obj_invalidate(lv_screen_active());lv_refr_now(host_display);snapshot_checks();
    char path[4096];snprintf(path,sizeof(path),"%s.rgb565",argv[5]);FILE*f=fopen(path,"wb");REQUIRE(f);REQUIRE(fwrite(framebuffer,2,466*466,f)==466*466);fclose(f);
    snprintf(path,sizeof(path),"%s.json",argv[5]);f=fopen(path,"w");REQUIRE(f);fprintf(f,"{\"hardware\":false,\"clockValid\":%s,\"face\":%u,\"mode\":%u,\"low\":%s,\"brightnessStub\":%u,\"clock\":",valid?"true":"false",target,desired,low?"true":"false",host_brightness);label_json(f,home_clock);fputs(",\"hint\":",f);label_json(f,home_hint);fputs(",\"phase\":",f);label_json(f,face_phase);
    /* Live clock validity changes while staying asleep: preserve time source/font. */
    if(desired==MODE_AOD||desired==MODE_OFF){
        clock_valid=!valid;refresh_state();advance(300);lv_obj_update_layout(lv_screen_active());verify(target,!valid,low,desired);
        clock_valid=valid;refresh_state();advance(300);lv_obj_update_layout(lv_screen_active());verify(target,valid,low,desired);
        l2_view_t domain_before=domain_fixture;unsigned pet=mock_pet_calls,bond=mock_bond_calls,present=mock_present_calls,guide=guide_saved;
        /* Actual production input wake route, synthetic host coordinate only. */
        touch(233,262,70);advance(600);lv_obj_update_layout(lv_screen_active());verify(target,valid,low,MODE_PLAY);
        REQUIRE(!memcmp(&domain_before,&domain_fixture,sizeof(domain_before)));REQUIRE(mock_pet_calls==pet);REQUIRE(mock_bond_calls==bond);REQUIRE(mock_present_calls==present);REQUIRE(guide_saved==guide);
        last_input=lv_tick_get()-41000;advance(600);lv_obj_update_layout(lv_screen_active());verify(target,valid,low,desired);
    }
    fprintf(f,",\"checks\":%u,\"negativeOverlapReproductions\":%u,\"allPass\":true}\n",checks,negatives);fclose(f);return 0;
}

/* Independent pixel-domain and hint-center wake cases: no production edits. */
int main(int argc,char**argv){
 REQUIRE(argc==3);unsigned target=atoi(argv[1]);bool valid=atoi(argv[2]);
 make_fixture("main_a");lv_init();lv_tick_inc(1000);REQUIRE(badge_ui_start());choose("main_a",NULL,0);advance(300);REQUIRE(badge_ui_diagnostic_select_face(target));clock_valid=valid;refresh_state();aod_enabled=true;last_input=lv_tick_get()-41000;advance(600);lv_obj_update_layout(lv_screen_active());verify(target,valid,false,MODE_AOD);
 for(unsigned i=0;i<12;i++){refresh_state();advance(260);REQUIRE(lv_obj_has_flag(face_phase,LV_OBJ_FLAG_HIDDEN));}
 lv_obj_invalidate(lv_screen_active());lv_refr_now(host_display);uint16_t before[466*466];memcpy(before,framebuffer,sizeof(before));
 hide(home_hint,true);lv_obj_invalidate(lv_screen_active());lv_refr_now(host_display);unsigned pixels=0;int x1=466,y1=466,x2=-1,y2=-1;lv_area_t clock;lv_obj_get_coords(home_clock,&clock);
 for(int y=0;y<466;y++)for(int x=0;x<466;x++)if(before[y*466+x]!=framebuffer[y*466+x]){int dx=x-233,dy=y-233;REQUIRE(dx*dx+dy*dy<=233*233);REQUIRE(y<clock.y1||y>clock.y2);if(x<x1)x1=x;if(x>x2)x2=x;if(y<y1)y1=y;if(y>y2)y2=y;pixels++;}
 REQUIRE(pixels>100);REQUIRE(y1>=(target?429:381)&&y2<=(target?447:399));hide(home_hint,false);lv_obj_invalidate(lv_screen_active());lv_refr_now(host_display);
 l2_view_t original=domain_fixture;unsigned pet=mock_pet_calls,present=mock_present_calls,bond=mock_bond_calls,guide=guide_saved;
 touch(233,465,70);advance(600);REQUIRE(mode==MODE_AOD);REQUIRE(mock_pet_calls==pet); /* actual outside-safe wake guard */
 touch(233,target?438:390,70);advance(600);verify(target,valid,false,MODE_PLAY);REQUIRE(mock_pet_calls==pet&&mock_present_calls==present&&mock_bond_calls==bond&&guide_saved==guide);REQUIRE(!memcmp(&original,&domain_fixture,sizeof(original)));
 const page_t other[]={PAGE_STATUS,PAGE_CARE,PAGE_SETTINGS};for(unsigned i=0;i<3;i++){navigate(other[i]);advance(600);refresh_state();lv_obj_update_layout(lv_screen_active());REQUIRE(!lv_obj_is_visible(home_hint));REQUIRE(mode==MODE_PLAY);}navigate(PAGE_HOME);advance(600);refresh_state();REQUIRE(lv_obj_has_flag(home_hint,LV_OBJ_FLAG_HIDDEN));REQUIRE(!lv_obj_has_flag(face_phase,LV_OBJ_FLAG_HIDDEN));
 printf("INDEPENDENT face%u valid%u pixels%u bounds%d,%d,%d,%d checks%u domain0\n",target,valid,pixels,x1,y1,x2,y2,checks);return 0;
}
