#define BADGE_BENCH_PARTIAL 1
#define main original_preview_main
#include PREVIEW_SOURCE
#undef main
extern size_t cf_live,cf_peak,cf_allocs;
static void report(const char*n,size_t base){printf("MEM %s %zu %zu %zu\n",n,cf_live,cf_peak,cf_peak>base?cf_peak-base:0);}
static void probe_capture(void){size_t n=LV_DRAW_BUF_SIZE(466,466,LV_COLOR_FORMAT_RGB565);uint8_t*b=calloc(1,n);assert(b);lv_draw_buf_t buf;assert(lv_draw_buf_init(&buf,466,466,LV_COLOR_FORMAT_RGB565,LV_STRIDE_AUTO,b,n)==LV_RESULT_OK);assert(badge_display_capture_rgb565(host_display,&buf));unsigned diff=0;for(unsigned i=0;i<466*466;i++)if(((uint16_t*)buf.data)[i]!=framebuffer[i])diff++;printf("CAPTURE_PARTITION_DIFFERENCE %u\n",diff);free(b);}
static void cap(const char*n){size_t b=cf_live;cf_peak=cf_live;lv_obj_invalidate(lv_screen_active());lv_refr_now(host_display);report(n,b);}
int main(void){make_fixture("main_a");lv_init();lv_tick_inc(1000);assert(badge_ui_start());choose("main_a",NULL,0);advance(300);report("boot-six-scenes",0);fixture.connected=fixture.subscribed=true;domain_fixture.snapshot.revision++;refresh_state();advance(2100);cap("home-draw");size_t b=cf_live;cf_peak=b;probe_capture();report("home-capture",b);
 domain_fixture.snapshot.scene=L2_SCENE_AWAY;domain_fixture.snapshot.weather=L2_WEATHER_RAIN;domain_fixture.snapshot.revision++;refresh_state();advance(2100);cap("rain-draw");b=cf_live;cf_peak=b;probe_capture();report("rain-capture",b);
 domain_fixture.snapshot.action=L2_ACTION_SLEEP;domain_fixture.snapshot.revision++;refresh_state();advance(2100);cap("rest-draw");b=cf_live;cf_peak=b;probe_capture();report("rest-capture",b);
 domain_fixture.snapshot.action=L2_ACTION_IDLE;domain_fixture.snapshot.revision++;refresh_state();advance(2100);b=cf_live;cf_peak=b;point(350,230,LV_INDEV_STATE_PRESSED);advance(40);for(unsigned i=1;i<=8;i++){point(350-i*28,230,LV_INDEV_STATE_PRESSED);advance(40);}point(126,230,LV_INDEV_STATE_RELEASED);advance(260);report("both-cat-drag",b);
 return 0;}
