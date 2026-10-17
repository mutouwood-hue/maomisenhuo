/* PREPARED ONLY. Actual supplied production preview/pages + actual scene linkage.
 * Native/state/clock/brightness/input remain explicit host fixtures. No hardware.
 * Compile/run only after stable source hash and sole host-build window. */
#define BADGE_BENCH_PARTIAL 1
#define main original_preview_main
#include PREVIEW_SOURCE
#undef main
#include <stdint.h>
#include <time.h>
static unsigned review_frames;
static bool review_record;
static unsigned long long start_flush,start_pixels;
static uint64_t hash64(const void *v,size_t n){const uint8_t*p=v;uint64_t h=1469598103934665603ULL;while(n--){h^=*p++;h*=1099511628211ULL;}return h;}
static void frame_review(lv_event_t *e){(void)e;if(!review_record)return;printf("FRAME %u %u %016llx %llu %llu\n",review_frames++,lv_tick_get(),(unsigned long long)hash64(framebuffer,sizeof(framebuffer)),bench_flushes-start_flush,bench_pixels-start_pixels);}
static void start_metric(void){lv_refr_now(host_display);start_flush=bench_flushes;start_pixels=bench_pixels;review_frames=0;review_record=true;}
static void end_metric(const char*name){review_record=false;lv_obj_update_layout(lv_screen_active());lv_refr_now(host_display);printf("METRIC %s ticks%u frames%u flush%llu pixels%llu page%d face%u active%d settling%d emit%u pending%u live%d action%d\n",name,lv_tick_get(),review_frames,bench_flushes-start_flush,bench_pixels-start_pixels,current_page,face,ui_drag.active,ui_drag.settling,mock_pet_calls,domain_fixture.pending_events,live_context,observed_action);}
static void snapshot(const char*name){
 lv_obj_update_layout(lv_screen_active());lv_refr_now(host_display);const char*dir=getenv("REVIEW_RAW_DIR");if(dir){char path[4096];snprintf(path,sizeof(path),"%s/%s.rgb565",dir,name);FILE*f=fopen(path,"wb");assert(f);assert(fwrite(framebuffer,1,sizeof(framebuffer),f)==sizeof(framebuffer));fclose(f);}printf("SNAP %s %u %016llx\n",name,lv_tick_get(),(unsigned long long)hash64(framebuffer,sizeof(framebuffer)));
 /* Deliberately separate from measurement; any full-oracle draw perturbs later
    dirty work. Runner uses a fresh process per case and labels oracle streams. */
 if(getenv("REVIEW_FULL_ORACLE")){uint16_t prior[466*466];memcpy(prior,framebuffer,sizeof(prior));lv_obj_invalidate(lv_screen_active());lv_obj_invalidate(lv_layer_top());lv_refr_now(host_display);unsigned diff=0;for(unsigned i=0;i<466*466;i++)if(prior[i]!=framebuffer[i])diff++;printf("ORACLE %s %u %u %016llx\n",name,lv_tick_get(),diff,(unsigned long long)hash64(framebuffer,sizeof(framebuffer)));}
}
static void no_domain_change(l2_view_t before,unsigned emit,unsigned bond,unsigned present,unsigned guide){assert(!memcmp(&before,&domain_fixture,sizeof(before)));assert(mock_pet_calls==emit&&mock_bond_calls==bond&&mock_present_calls==present&&guide_saved==guide);}
static void horizontal(bool commit){
 select_page(PAGE_HOME);face=0;update_face();advance(300);last_input=lv_tick_get();l2_view_t before=domain_fixture;unsigned emit=mock_pet_calls,bond=mock_bond_calls,present=mock_present_calls,guide=guide_saved;start_metric();point(350,230,LV_INDEV_STATE_PRESSED);advance(40);
 unsigned steps=commit?8:1;for(unsigned i=1;i<=steps;i++){point(350-(int)i*28,230,LV_INDEV_STATE_PRESSED);advance(40);snapshot("horizontal-held");}
 point(commit?126:322,230,LV_INDEV_STATE_RELEASED);advance(260);end_metric(commit?"horizontal-commit":"horizontal-rebound");assert(face==(commit?1u:0u));assert(!ui_drag.active&&!ui_drag.settling);no_domain_change(before,emit,bond,present,guide);snapshot("horizontal-final");
}
static void vertical(bool up){
 select_page(PAGE_HOME);advance(300);l2_view_t before=domain_fixture;unsigned emit=mock_pet_calls,bond=mock_bond_calls,present=mock_present_calls,guide=guide_saved;start_metric();point(233,up?350:170,LV_INDEV_STATE_PRESSED);advance(40);for(unsigned i=1;i<=5;i++){point(233,up?350-(int)i*28:170+(int)i*28,LV_INDEV_STATE_PRESSED);advance(40);}point(233,up?210:310,LV_INDEV_STATE_RELEASED);advance(260);end_metric(up?"vertical-up":"vertical-down");assert(current_page==(up?PAGE_CARE:PAGE_STATUS));assert(!ui_drag.active&&!ui_drag.settling);no_domain_change(before,emit,bond,present,guide);snapshot("vertical-final");
}
static void trust_case(void){
 assert(!live_context);assert(observed_action==L2_ACTION_IDLE);snapshot("cold-old-neutral");fixture.connected=fixture.subscribed=true;refresh_state();assert(!live_context);domain_fixture.snapshot.revision++;domain_fixture.snapshot.action=L2_ACTION_FEED;refresh_state();assert(live_context&&observed_action==L2_ACTION_FEED);uint32_t start=observed_action_started;advance(900);refresh_state();assert(observed_action_started==start);snapshot("current-feed");fixture.connected=fixture.subscribed=false;refresh_state();printf("TRUST disconnectCleared%d\n",!live_context);snapshot("disconnect");fixture.connected=fixture.subscribed=true;refresh_state();printf("TRUST sameRevisionReconnectNeutral%d\n",!live_context);snapshot("same-revision-reconnect");domain_fixture.snapshot.revision++;refresh_state();assert(live_context);advance(3300);refresh_state();assert(observed_action==L2_ACTION_IDLE);snapshot("short-reaction-expired");assert(mock_pet_calls==0);}
static void sleep_cycle(bool fail){
 select_page(PAGE_CARE);begin_care(L2_ACTION_SLEEP);advance(300);if(fail)emit_result=L2_QUEUE_FULL;unsigned emit=mock_pet_calls;point(233,323,LV_INDEV_STATE_PRESSED);advance(1600);point(233,323,LV_INDEV_STATE_RELEASED);advance(300);
 if(fail){assert(mock_pet_calls==emit&&observed_action!=L2_ACTION_SLEEP);snapshot("sleep-failed");return;}
 assert(mock_pet_calls==emit+1&&observed_action==L2_ACTION_SLEEP&&current_page==PAGE_HOME);snapshot("sleep-success-short");advance(3300);assert(observed_action==L2_ACTION_IDLE);last_input=lv_tick_get()-41000;advance(600);assert(mode==MODE_AOD);snapshot("sleep-expired-aod");touch(233,262,70);advance(600);assert(mode==MODE_PLAY&&mock_pet_calls==emit+1&&observed_action==L2_ACTION_IDLE);snapshot("wake-no-sleep-replay");
}
int main(int argc,char**argv){assert(argc==2);make_fixture("main_a");if(!strcmp(argv[1],"trust")){domain_fixture.snapshot.scene=L2_SCENE_AWAY;domain_fixture.snapshot.weather=L2_WEATHER_RAIN;domain_fixture.snapshot.action=L2_ACTION_FEED;}lv_init();lv_tick_inc(1000);assert(badge_ui_start());select_page(PAGE_HOME);advance(300);lv_display_add_event_cb(host_display,frame_review,LV_EVENT_RENDER_READY,NULL);
 if(!strcmp(argv[1],"horizontal-commit"))horizontal(true);else if(!strcmp(argv[1],"horizontal-rebound"))horizontal(false);else if(!strcmp(argv[1],"vertical-up"))vertical(true);else if(!strcmp(argv[1],"vertical-down"))vertical(false);else if(!strcmp(argv[1],"trust"))trust_case();else if(!strcmp(argv[1],"sleep"))sleep_cycle(false);else if(!strcmp(argv[1],"sleep-fail"))sleep_cycle(true);else if(!strcmp(argv[1],"samecontext")){start_metric();for(unsigned i=0;i<64;i++){refresh_state();lv_refr_now(host_display);}end_metric("samecontext-64");snapshot("samecontext");}else abort();printf("REVIEW software_fixture_only case=%s\n",argv[1]);return 0;}
