/* Actual source snapshot, native/state/ports explicitly host substitutes. */
#define BADGE_BENCH_PARTIAL 1
#define main original_preview_main
#include PREVIEW_SOURCE
#undef main
int main(int argc,char **argv){
 assert(argc==2);make_fixture("main_a");fixture.connected=fixture.subscribed=true;lv_init();lv_tick_inc(1000);assert(badge_ui_start());select_page(PAGE_HOME);advance(300);
 bool local=!strcmp(argv[1],"local-offline-fresh")||!strcmp(argv[1],"remote-override-disconnect");if(local){assert(emit_care(L2_ACTION_PET));assert(observed_local&&observed_action==L2_ACTION_PET);}
 if(strcmp(argv[1],"remote-override-disconnect"))fixture.connected=fixture.subscribed=false;
 domain_fixture.snapshot.revision++;domain_fixture.snapshot.action=L2_ACTION_SLEEP;refresh_state();
 if(!strcmp(argv[1],"remote-override-disconnect")){fixture.connected=fixture.subscribed=false;refresh_state();}
 lv_obj_update_layout(lv_screen_active());lv_refr_now(host_display);
 printf("NEGATIVE {\"case\":\"%s\",\"live\":%s,\"observedLocal\":%s,\"action\":%u,\"expectedLocalPet\":%s,\"phase\":\"%s\",\"syntheticNativeEmits\":%u}\n",argv[1],live_context?"true":"false",observed_local?"true":"false",observed_action,local?"true":"false",lv_label_get_text(face_phase),mock_pet_calls);
 const char *out=getenv("TRUST_RAW");if(out){FILE*f=fopen(out,"wb");assert(f);assert(fwrite(framebuffer,1,sizeof(framebuffer),f)==sizeof(framebuffer));fclose(f);}return 0;
}
