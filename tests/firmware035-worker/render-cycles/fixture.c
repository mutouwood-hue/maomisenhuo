#define BADGE_BENCH_PARTIAL 1
#define main preview_original_main
#include "/Users/zoumutou/coding/猫咪森活/artifacts/firmware-local-v3-perf035/source/tools/host_preview/preview.c"
#undef main
#include <time.h>
#include <stdint.h>
static uint64_t wall_us(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return (uint64_t)t.tv_sec*1000000+t.tv_nsec/1000;}
static uint64_t pixel_hash(const void *v,size_t n){const unsigned char*p=v;uint64_t h=1469598103934665603ULL;while(n--){h^=*p++;h*=1099511628211ULL;}return h;}
static unsigned checks,samples;
static void sample(const char *tag) {
    lv_obj_update_layout(lv_screen_active());lv_refr_now(host_display);
    uint64_t h=pixel_hash(framebuffer,sizeof(framebuffer));
#ifdef BENCH_CONTINUOUS
    const char *dir=getenv("BENCH_RAW_DIR");assert(dir);char path[4096];snprintf(path,sizeof(path),"%s/%s.rgb565",dir,tag);FILE *f=fopen(path,"wb");assert(f);assert(fwrite(framebuffer,1,sizeof(framebuffer),f)==sizeof(framebuffer));fclose(f);
    printf("SAMPLE %s %016llx\n",tag,(unsigned long long)h);samples++;return;
#endif
    size_t n=LV_DRAW_BUF_SIZE(466,466,LV_COLOR_FORMAT_RGB565);uint8_t *b=calloc(1,n);assert(b);lv_draw_buf_t buf;
    assert(lv_draw_buf_init(&buf,466,466,LV_COLOR_FORMAT_RGB565,LV_STRIDE_AUTO,b,n)==LV_RESULT_OK);
    assert(badge_display_capture_rgb565(host_display,&buf));
    bool exact_snapshot=!memcmp(buf.data,framebuffer,sizeof(framebuffer));
    uint16_t saved[466*466];memcpy(saved,framebuffer,sizeof(framebuffer));
    lv_obj_invalidate(lv_screen_active());lv_obj_invalidate(lv_layer_top());lv_obj_invalidate(lv_layer_sys());lv_refr_now(host_display);
    unsigned diff=0;for(unsigned i=0;i<466*466;i++)if(saved[i]!=framebuffer[i]){
        diff++;printf("DEVIATION %s %u %u %u\n",tag,i,saved[i],framebuffer[i]);
    }
    printf("FULL %s %016llx\n",tag,(unsigned long long)pixel_hash(framebuffer,sizeof(framebuffer)));
    if(!exact_snapshot)printf("SNAPSHOT_PARTITION_DIFFERENCE %s\n",tag);
    checks++;free(b);samples++;
    printf("SAMPLE %s %016llx\n",tag,(unsigned long long)h);
}
static void measure_refresh(const char *tag) {
    lv_refr_now(host_display);unsigned long long f=bench_flushes,p=bench_pixels;uint64_t t=wall_us();
    for(unsigned i=0;i<64;i++){refresh_state();lv_refr_now(host_display);}
    t=wall_us()-t;
    printf("METRIC %s 64 %llu %llu %llu\n",tag,(unsigned long long)t,bench_flushes-f,bench_pixels-p);
    sample(tag);
}
static void measure_drag(void) {
    select_page(PAGE_HOME);advance(400);face=0;update_face();advance(200);last_input=lv_tick_get();
    unsigned saved_calls=mock_pet_calls;
    unsigned long long f=bench_flushes,p=bench_pixels;uint64_t t=wall_us();
    point(350,230,LV_INDEV_STATE_PRESSED);advance(40);
    for(unsigned i=1;i<=8;i++){point(350-(int)i*28,230,LV_INDEV_STATE_PRESSED);advance(40);}
    point(126,230,LV_INDEV_STATE_RELEASED);advance(260);
    t=wall_us()-t;
    printf("METRIC horizontal-drag-commit-easeout 1 %llu %llu %llu\n",(unsigned long long)t,bench_flushes-f,bench_pixels-p);
    assert(face==1);assert(!ui_drag.active&&!ui_drag.settling);assert(mock_pet_calls==saved_calls);checks+=3;
    sample("horizontal-drag-final");
    f=bench_flushes;p=bench_pixels;t=wall_us();
    point(280,230,LV_INDEV_STATE_PRESSED);advance(40);point(254,230,LV_INDEV_STATE_PRESSED);advance(40);
    point(254,230,LV_INDEV_STATE_RELEASED);advance(260);t=wall_us()-t;
    printf("METRIC horizontal-drag-rebound 1 %llu %llu %llu\n",(unsigned long long)t,bench_flushes-f,bench_pixels-p);
    assert(face==1);assert(!ui_drag.active&&!ui_drag.settling);assert(mock_pet_calls==saved_calls);checks+=3;sample("horizontal-rebound-final");
}
int unused_fixture_main(void){
    make_fixture("main_a");fixture.connected=fixture.subscribed=true;lv_init();lv_tick_inc(1000);assert(badge_ui_start());select_page(PAGE_HOME);advance(300);sample("initial");
    measure_refresh("unchanged-home-face0");
    for(unsigned i=0;i<3;i++){assert(badge_ui_diagnostic_select_face(i));advance(100);char tag[80];snprintf(tag,sizeof(tag),"unchanged-home-face%u",i);measure_refresh(tag);}
    /* Real scene / refresh / source frame paths; deterministic logical time, no device. */
    const l2_scene_t scenes[]={L2_SCENE_HOME,L2_SCENE_DEPARTING,L2_SCENE_AWAY,L2_SCENE_RETURNING,L2_SCENE_HOME};
    const l2_weather_t weather[]={L2_WEATHER_CLEAR,L2_WEATHER_RAIN,L2_WEATHER_RAIN,L2_WEATHER_SNOW,L2_WEATHER_CLEAR};
    for(unsigned i=0;i<5;i++){
        domain_fixture.snapshot.revision++;domain_fixture.snapshot.scene=scenes[i];domain_fixture.snapshot.weather=weather[i];refresh_state();
        for(unsigned j=0;j<6;j++){advance(100);char tag[80];snprintf(tag,sizeof(tag),"scene-%u-time%u",i,j);sample(tag);}
    }
    for(unsigned i=0;i<4;i++){clock_valid=!clock_valid;face=i%3;update_face();refresh_state();advance(60);char t[64];snprintf(t,sizeof(t),"clock-font-%u",i);sample(t);}
    badge_scene_play(home_scene,BADGE_SCENE_PET,lv_tick_get());
    for(unsigned i=0;i<15;i++){advance(100);char t[64];snprintf(t,sizeof(t),"pet-frame-%u",i);sample(t);}
    for(unsigned id=0;id<BADGE_SCENE_CLIP_COUNT;id++){
        badge_scene_play(home_scene,(badge_scene_clip_id_t)id,lv_tick_get());
        for(unsigned i=0;i<12;i++){advance(100);char t[64];snprintf(t,sizeof(t),"clip-%u-%u",id,i);sample(t);}
    }
    set_mode(MODE_AOD);advance(300);sample("frozen-aod");set_mode(MODE_PLAY);last_input=lv_tick_get();advance(100);sample("thawed-play");
    domain_fixture.snapshot.weather=L2_WEATHER_SNOW;refresh_state();advance(100);sample("weather-only-snow");
    domain_fixture.snapshot.weather=L2_WEATHER_RAIN;refresh_state();advance(100);sample("weather-only-rain");
    select_page(PAGE_STATUS);advance(100);sample("status");fixture.snapshot.food=20;domain_fixture.snapshot.pet.food=20;refresh_state();sample("status-changed");
    select_page(PAGE_HOME);advance(300);sample("return-home");
    /* Production drag machinery with synthetic host input, not touch hardware. */
    choose("drag_up_mid",NULL,0);sample("drag-up-mid");point(233,220,LV_INDEV_STATE_RELEASED);advance(300);sample("drag-released");
    choose("drag_rebound",NULL,0);advance(300);sample("drag-rebound");
    select_page(PAGE_HOME);advance(300);announce("离线中文描边完整性：天气与状态待手机确认");sample("toast-font");advance(1900);sample("toast-gone");
    measure_drag();
    /* First context must initialize its actual root and weather styling even all zero. */
    lv_obj_t *parent=lv_obj_create(lv_screen_active());badge_scene_t *fresh=badge_scene_create(parent);assert(fresh);badge_scene_set_context(fresh,false,L2_SCENE_HOME,L2_WEATHER_CLEAR,L2_ACTION_IDLE,false);lv_obj_t *scene_root=lv_obj_get_child(parent,0);lv_obj_t *rain=lv_obj_get_child(scene_root,0);lv_obj_update_layout(scene_root);assert(lv_obj_get_width(rain)==2);checks++;
    badge_scene_set_context(fresh,true,L2_SCENE_AWAY,L2_WEATHER_SNOW,L2_ACTION_IDLE,true);lv_obj_update_layout(scene_root);assert(lv_obj_get_width(rain)==4);assert(!lv_obj_has_flag(rain,LV_OBJ_FLAG_HIDDEN));checks+=2;
    badge_scene_set_context(fresh,true,L2_SCENE_AWAY,L2_WEATHER_RAIN,L2_ACTION_IDLE,true);lv_obj_update_layout(scene_root);assert(lv_obj_get_width(rain)==2);checks++;
    lv_obj_t *l=label(parent,100,100,200,"同字测试",true,ZIP_UI_COLOR_TEXT);set_label(l,"同字测试",100);lv_obj_set_style_text_font(l,&local2_font24,0);set_label(l,"同字测试",160);lv_obj_update_layout(l);assert(lv_obj_get_y(l)==160-lv_obj_get_height(l)/2);assert(lv_obj_get_style_text_font(l,0)==&local2_font24);checks+=2;
    printf("CHECKS %u SAMPLES %u\n",checks,samples);return 0;
}

static unsigned long long render_cycles,full47_cycles,full_pixels_cycles,partial_cycles,start_flush,start_pixels;
static void cycle_event(lv_event_t*e){
 if(lv_event_get_code(e)==LV_EVENT_RENDER_START){start_flush=bench_flushes;start_pixels=bench_pixels;}
 if(lv_event_get_code(e)==LV_EVENT_RENDER_READY){unsigned long long f=bench_flushes-start_flush,p=bench_pixels-start_pixels;render_cycles++;if(p==466*466)full_pixels_cycles++;else partial_cycles++;if(f==47&&p==466*466)full47_cycles++;}
}
int main(void) {
 make_fixture("main_a");fixture.connected=fixture.subscribed=true;lv_init();lv_tick_inc(1000);assert(badge_ui_start());select_page(PAGE_HOME);advance(300);
 uint64_t start=wall_us();unsigned iterations=0;unsigned long long f=bench_flushes,p=bench_pixels;
 lv_display_add_event_cb(host_display,cycle_event,LV_EVENT_ALL,NULL);
 for(unsigned j=0;j<40;j++){
  last_input=lv_tick_get();point(350,230,LV_INDEV_STATE_PRESSED);advance(40);
  for(unsigned i=1;i<=8;i++){point(350-(int)i*28,230,LV_INDEV_STATE_PRESSED);advance(40);}
  point(126,230,LV_INDEV_STATE_RELEASED);advance(260);assert(!ui_drag.active&&!ui_drag.settling);iterations++;
 }
 assert(mock_pet_calls==0);printf("CYCLES render=%llu full47=%llu fullPixels=%llu partial=%llu\n",render_cycles,full47_cycles,full_pixels_cycles,partial_cycles);printf("PROFILE iterations=%u wallUs=%llu flushes=%llu pixels=%llu\n",iterations,(unsigned long long)(wall_us()-start),bench_flushes-f,bench_pixels-p);return 0;
}
