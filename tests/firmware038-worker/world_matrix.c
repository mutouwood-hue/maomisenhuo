#define main original_preview_main
#include "../../artifacts/firmware-local-v3-visual038/source/tools/host_preview/preview.c"
#undef main
static unsigned checks;
#define REQ(x) do{assert(x);checks++;}while(0)
int main(int argc,char**argv){REQ(argc==7);unsigned world=atoi(argv[1]),fce=atoi(argv[2]),valid=atoi(argv[3]),low=atoi(argv[4]),power=atoi(argv[5]);make_fixture(low?"main_low_stats":"main_a");lv_init();lv_tick_inc(1000);REQ(badge_ui_start());choose("main_a",NULL,0);advance(300);REQ(badge_ui_diagnostic_select_face(fce));clock_valid=valid;
 if(world){fixture.connected=fixture.subscribed=true;domain_fixture.snapshot.scene=world==2?L2_SCENE_AWAY:L2_SCENE_HOME;domain_fixture.snapshot.action=world==3?L2_ACTION_SLEEP:L2_ACTION_IDLE;domain_fixture.snapshot.revision++;}refresh_state();aod_enabled=power!=3;last_input=lv_tick_get()-(power==0?0:power==1?11000:41000);advance(600);
 for(unsigned i=0;i<3;i++){refresh_state();advance(260);REQ(mode==(ui_mode_t)power);REQ(!live_context==!world);REQ(mock_pet_calls==0);REQ(lv_obj_has_flag(face_phase,LV_OBJ_FLAG_HIDDEN)==(power>=2||(low&&!fce)));}
 REQ(lv_obj_get_style_text_font(home_clock,0)==(fce&&valid?&badge_n40:&local2_font20));REQ(!strcmp(lv_label_get_text(home_clock),valid?"20:34":"需手机校时"));REQ(observed_action==(world==3?L2_ACTION_SLEEP:L2_ACTION_IDLE));
 lv_obj_update_layout(lv_screen_active());if(power>=2){REQ(!lv_obj_has_flag(home_hint,LV_OBJ_FLAG_HIDDEN));REQ(lv_obj_get_y(home_hint)+lv_obj_get_height(home_hint)/2==(fce?438:390));}
 lv_obj_invalidate(lv_screen_active());lv_refr_now(host_display);snapshot_checks();char p[4096];snprintf(p,sizeof(p),"%s.rgb565",argv[6]);FILE*out=fopen(p,"wb");REQ(out);fwrite(framebuffer,2,466*466,out);fclose(out);snprintf(p,sizeof(p),"%s.json",argv[6]);out=fopen(p,"w");REQ(out);fputs("{\"labels\":[",out);inspect(out,lv_screen_active(),false);inspect(out,lv_layer_top(),false);fprintf(out,"],\"hardware\":false,\"world\":%u,\"face\":%u,\"clockValid\":%u,\"low\":%u,\"mode\":%u,\"checks\":%u,\"missingGlyphs\":%u,\"allPass\":true}\n",world,fce,valid,low,power,checks,missing_glyphs);fclose(out);REQ(!missing_glyphs);return 0;}
