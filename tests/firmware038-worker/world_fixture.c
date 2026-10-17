#define main original_preview_main
#include "../../artifacts/firmware-local-v3-visual038/source/tools/host_preview/preview.c"
#undef main
int main(int argc,char**argv){assert(argc>=3);const char *c=argv[1];make_fixture("main_a");lv_init();lv_tick_inc(1000);assert(badge_ui_start());choose("main_a",NULL,0);advance(300);clock_valid=true;
    if(strcmp(c,"neutral")){fixture.connected=fixture.subscribed=true;domain_fixture.snapshot.revision++;if(!strcmp(c,"away"))domain_fixture.snapshot.scene=L2_SCENE_AWAY;refresh_state();advance(2000);}
    if(!strncmp(c,"sleep",5)){domain_fixture.snapshot.action=L2_ACTION_SLEEP;domain_fixture.snapshot.revision++;refresh_state();}
    advance(!strcmp(c,"sleep-settled")?2100:300);refresh_state();lv_obj_update_layout(lv_screen_active());lv_obj_invalidate(lv_screen_active());lv_refr_now(host_display);same_size_font_checks();snapshot_checks();char p[4096];snprintf(p,sizeof(p),"%s.rgb565",argv[2]);FILE*f=fopen(p,"wb");assert(f);fwrite(framebuffer,2,466*466,f);fclose(f);printf("WORLD %s live=%d mode=%d observed=%d petCalls=%u\n",c,live_context,mode,observed_action,mock_pet_calls);return 0;}
