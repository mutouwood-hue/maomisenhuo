#define BADGE_BENCH_PARTIAL 1
#define main original_preview_main
#include PREVIEW_SOURCE
#undef main
static void metric(const char*n,unsigned long long f,unsigned long long p){printf("METRIC %s %llu %llu\n",n,bench_flushes-f,bench_pixels-p);}
int main(void){make_fixture("main_a");lv_init();lv_tick_inc(1000);assert(badge_ui_start());choose("main_a",NULL,0);advance(300);fixture.connected=fixture.subscribed=true;domain_fixture.snapshot.revision++;refresh_state();advance(2100);unsigned calls=mock_pet_calls;
 for(unsigned j=0;j<3;j++){
  face=0;update_face();advance(300);last_input=lv_tick_get();unsigned long long f=bench_flushes,p=bench_pixels;
  point(350,230,LV_INDEV_STATE_PRESSED);advance(40);for(unsigned i=1;i<=8;i++){point(350-i*28,230,LV_INDEV_STATE_PRESSED);advance(40);}point(126,230,LV_INDEV_STATE_RELEASED);advance(260);metric("horizontal-commit",f,p);assert(face==1&&!ui_drag.active&&!ui_drag.settling);
  f=bench_flushes;p=bench_pixels;point(280,230,LV_INDEV_STATE_PRESSED);advance(40);point(254,230,LV_INDEV_STATE_PRESSED);advance(40);point(254,230,LV_INDEV_STATE_RELEASED);advance(260);metric("horizontal-rebound",f,p);assert(face==1&&!ui_drag.active&&!ui_drag.settling);
 }
 assert(mock_pet_calls==calls);puts("DOMAIN_UNCHANGED");return 0;}
