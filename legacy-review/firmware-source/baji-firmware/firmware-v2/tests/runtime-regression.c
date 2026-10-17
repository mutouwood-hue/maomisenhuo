/* Compile the unmodified runtime in this translation unit; static callbacks are real. */
#include <assert.h>
#include <setjmp.h>
#include <stdio.h>
#include <string.h>
#include "../runtime/baji_main.c"

struct bj_render { int marker; };
static struct {
    uint32_t now;
    bool snapshot_ready, display_fail, renderer_fail, timer_fail, input_missing;
    esp_err_t nvs_result, pmic_result, mac_result, lock_result, ble_result;
    bj_pmic_snapshot_t snapshot;
    lv_point_t point;
    lv_event_cb_t event_cb;
    lv_timer_cb_t timer_cb;
    bool locked;
    unsigned display_calls, pmic_calls, lock_calls, unlock_calls, render_calls;
    unsigned timer_calls, ble_calls, pump_calls, errors, registrations;
    char order[64];
    size_t order_size;
    bj_frame_t frame;
    bj_power_view_t rendered_power, pumped_power;
    bool pumped_suspended;
    uint8_t ble_state[10];
} mock;
static lv_obj_t root;
static lv_indev_t indev;
static lv_timer_t timer_object;
static struct bj_render render_object;
static jmp_buf error_jump;
static bool expect_error;
static unsigned checks, cases;
#define CHECK(expr) do { ++checks; if (!(expr)) { fprintf(stderr,"FAIL %s:%d: %s\n",__FILE__,__LINE__,#expr); assert(expr); } } while (0)
static void record(char code) { CHECK(mock.order_size+1<sizeof(mock.order)); mock.order[mock.order_size++]=code; }
void runtime_error_check(esp_err_t err) {
    if(err==ESP_OK) return;
    ++mock.errors;
    CHECK(expect_error);
    longjmp(error_jump,1);
}
int64_t esp_timer_get_time(void) { return (int64_t)mock.now*1000; }
esp_err_t nvs_flash_init(void) { record('N'); return mock.nvs_result; }
esp_err_t esp_read_mac(uint8_t *mac,int type) {
    record('M'); CHECK(type==ESP_MAC_BT);
    for(unsigned i=0;i<6;++i) mac[i]=(uint8_t)(0x10+i);
    return mock.mac_result;
}
lv_obj_t *bsp_display_start_with_config(const bsp_display_cfg_t *cfg) {
    record('D'); ++mock.display_calls;
    CHECK(cfg->touch_flags.swap_xy==0 && cfg->touch_flags.mirror_x==1 && cfg->touch_flags.mirror_y==1);
    return mock.display_fail?NULL:&root;
}
esp_err_t bsp_display_lock(uint32_t timeout) {
    record('L'); ++mock.lock_calls; CHECK(timeout==1000);
    if(mock.lock_result==ESP_OK) mock.locked=true;
    return mock.lock_result;
}
void bsp_display_unlock(void) { record('U'); CHECK(mock.locked); mock.locked=false; ++mock.unlock_calls; }
lv_indev_t *bsp_display_get_input_dev(void) { return mock.input_missing?NULL:&indev; }
void lv_indev_get_point(lv_indev_t *dev,lv_point_t *point) { CHECK(dev==&indev); *point=mock.point; }
lv_event_code_t lv_event_get_code(lv_event_t *event) { return event->code; }
lv_obj_t *lv_screen_active(void) { record('S'); CHECK(mock.locked); return &root; }
lv_timer_t *lv_timer_create(lv_timer_cb_t callback,uint32_t period,void *data) {
    record('T'); ++mock.timer_calls; CHECK(mock.locked && period==10 && data==NULL);
    if(mock.timer_fail) return NULL;
    mock.timer_cb=callback; return &timer_object;
}
void lv_obj_add_flag(lv_obj_t *obj,uint32_t flag) { record('F'); CHECK(mock.locked && obj==&root && flag==LV_OBJ_FLAG_CLICKABLE); }
void lv_obj_add_event_cb(lv_obj_t *obj,lv_event_cb_t callback,lv_event_code_t code,void *data) {
    record('E'); CHECK(mock.locked && obj==&root && code==LV_EVENT_ALL && data==NULL);
    mock.event_cb=callback; ++mock.registrations;
}
bj_render_t *bj_render_create(lv_obj_t *parent) { record('R'); CHECK(mock.locked && parent==&root); return mock.renderer_fail?NULL:&render_object; }
void bj_render_apply_power(bj_render_t *r,const bj_frame_t *f,const bj_power_view_t *p,uint32_t now) {
    record('V'); CHECK(r==&render_object && now==mock.now); ++mock.render_calls;
    mock.frame=*f; mock.rendered_power=*p;
}
esp_err_t bj_pmic_start(void) { record('P'); CHECK(mock.display_calls==1); ++mock.pmic_calls; return mock.pmic_result; }
bool bj_pmic_latest(bj_pmic_snapshot_t *out) { if(!mock.snapshot_ready) return false; *out=mock.snapshot; return true; }
esp_err_t bj_ble_start(void) {
    record('B'); ++mock.ble_calls;
    CHECK(!mock.locked && mock.unlock_calls==1 && mock.timer_cb==tick && mock.event_cb==input && mock.render_calls==1);
    CHECK(controller.gesture.config.panel==466 && power.freshness_ms==2000 && renderer==&render_object);
    CHECK(link.identity[0]==0x10 && link.identity[5]==0x15);
    return mock.ble_result;
}
void bj_ble_pump(bj_link_t *l,bj_controller_t *c,const bj_power_view_t *p) {
    record('Q'); CHECK(l==&link && c==&controller); ++mock.pump_calls;
    mock.pumped_power=*p; mock.pumped_suspended=c->suspended;
    CHECK(bj_link_state(l,c,p,mock.ble_state));
}
static bj_data_view_t worker_view;
static bool worker_ready,peer_current;
static unsigned confirms,events_count;
static uint8_t event_types[32],event_args[32],confirmed_id[16];
esp_err_t bj_data_runtime_start(const uint8_t id[6]) {CHECK(!mock.locked && id[0]==0x10);return ESP_OK;}
bool bj_data_runtime_view(bj_data_view_t *out) {if(!worker_ready)return false;*out=worker_view;return true;}
void bj_data_runtime_confirm(uint32_t value,const uint8_t id[16]) {CHECK(value==worker_view.generation);confirms++;memcpy(confirmed_id,id,16);}
void bj_data_runtime_event(uint8_t type,uint8_t a,int16_t b) {(void)b;CHECK(events_count<32);event_types[events_count]=type;event_args[events_count++]=a;}
bool bj_ble_data_current(uint32_t value) {return peer_current && value==worker_view.generation;}
void bj_render_apply_data(bj_render_t *r,const bj_data_view_t *v,const bj_power_view_t *p,uint8_t type,uint8_t count) {(void)r;(void)v;(void)p;(void)type;(void)count;}
static void reset(void) {
    memset(&mock,0,sizeof(mock)); memset(&controller,0,sizeof(controller));
    memset(&link,0,sizeof(link)); memset(&power,0,sizeof(power)); memset(&power_view,0,sizeof(power_view));
    memset(&data_view,0,sizeof(data_view));memset(&worker_view,0,sizeof(worker_view));memset(care_last,0,sizeof(care_last));
    worker_ready=peer_current=confirm_pressed=false;care_type=care_count=0;confirms=events_count=0;
    renderer=NULL; expect_error=false; mock.now=10000; ++cases;
}
static void sample(int percent,bool battery_valid,bool usb_valid,bool usb,uint32_t sampled) {
    mock.snapshot_ready=true;
    mock.snapshot.sample=(bj_power_sample_t){.battery_valid=battery_valid,.battery_percent=percent,.usb_valid=usb_valid,.usb_present=usb,.sampled_ms=sampled};
}
static void boot_normal(void) { reset(); sample(60,true,true,false,mock.now); app_main(); CHECK(mock.ble_calls==1 && !mock.locked); }
static void run_tick(uint32_t now) {
    CHECK(mock.timer_cb!=NULL); mock.now=now; mock.order_size=0; memset(mock.order,0,sizeof(mock.order));
    mock.timer_cb(&timer_object);
    CHECK(strcmp(mock.order,"QV")==0);
}
static void event(lv_event_code_t code,int x,int y,uint32_t now) {
    CHECK(mock.event_cb!=NULL); mock.point=(lv_point_t){x,y}; mock.now=now;
    lv_event_t e={code}; mock.event_cb(&e);
}
static void face(void) { bj_scene_init(&controller.scene); controller.scene.screen=BJ_MAIN_A; }
static void voice_guide(void) {
    bj_scene_init(&controller.scene); CHECK(bj_scene_start_local(&controller.scene));
    controller.scene.step=4;
}
static void test_boot(void) {
    boot_normal(); CHECK(strcmp(mock.order,"NDPMLSRTFEVUB")==0);
    CHECK(mock.registrations==1 && mock.rendered_power.mode==BJ_POWER_NORMAL);
    reset(); mock.display_fail=true; app_main(); CHECK(strcmp(mock.order,"ND")==0 && mock.ble_calls==0);
    reset(); mock.pmic_result=ESP_FAIL; app_main(); CHECK(strcmp(mock.order,"NDP")==0 && mock.ble_calls==0);
    reset(); mock.lock_result=ESP_FAIL; app_main(); CHECK(strcmp(mock.order,"NDPML")==0 && mock.unlock_calls==0 && mock.timer_calls==0 && mock.ble_calls==0);
    reset(); mock.renderer_fail=true; app_main(); CHECK(strcmp(mock.order,"NDPMLSRU")==0 && mock.timer_calls==0 && mock.ble_calls==0 && !mock.locked);
    reset(); mock.timer_fail=true; app_main(); CHECK(strcmp(mock.order,"NDPMLSRTU")==0 && mock.registrations==0 && mock.ble_calls==0 && !mock.locked);
    reset(); mock.nvs_result=ESP_FAIL; expect_error=true;
    if(setjmp(error_jump)==0) { app_main(); CHECK(false); }
    CHECK(mock.errors==1 && mock.display_calls==0 && mock.ble_calls==0);
    reset(); mock.mac_result=ESP_FAIL; expect_error=true;
    if(setjmp(error_jump)==0) { app_main(); CHECK(false); }
    CHECK(mock.errors==1 && mock.lock_calls==0 && mock.ble_calls==0);
    reset(); mock.ble_result=ESP_FAIL; expect_error=true;
    if(setjmp(error_jump)==0) { app_main(); CHECK(false); }
    CHECK(mock.errors==1 && mock.ble_calls==1 && mock.unlock_calls==1);
}
static void test_power_latch(void) {
    reset(); app_main(); CHECK(power_view.mode==BJ_POWER_UNKNOWN && !controller.suspended && !power_view.allow_voice);
    sample(3,true,true,false,mock.now-2001); run_tick(mock.now); CHECK(!power.low_latched && power_view.mode==BJ_POWER_UNKNOWN);
    sample(3,true,false,false,mock.now); run_tick(mock.now); CHECK(!power.low_latched && power_view.mode==BJ_POWER_UNKNOWN);
    sample(3,true,true,false,mock.now); run_tick(mock.now); CHECK(power.low_latched && controller.suspended && power_view.mode==BJ_POWER_LOW);
    mock.snapshot_ready=false; run_tick(mock.now+2001);
    CHECK(power.low_latched && power_view.mode==BJ_POWER_LOW && !power_view.battery_valid && power_view.battery_percent==-1);
    sample(90,true,true,true,mock.now-2001); run_tick(mock.now); CHECK(power.low_latched && controller.suspended);
    sample(-1,false,false,false,mock.now); run_tick(mock.now); CHECK(power.low_latched && power_view.mode==BJ_POWER_LOW);
    sample(80,true,true,false,mock.now+1); run_tick(mock.now); CHECK(power.low_latched);
    sample(5,true,true,false,mock.now); run_tick(mock.now); CHECK(!power.low_latched && power_view.mode==BJ_POWER_NORMAL && !controller.suspended);
    sample(4,true,true,false,mock.now); run_tick(mock.now); CHECK(power.low_latched);
    sample(-1,false,true,true,mock.now); run_tick(mock.now); CHECK(!power.low_latched && power_view.mode==BJ_POWER_NORMAL);
    CHECK(mock.pump_calls==10 && mock.pumped_power.retain_ble);
    boot_normal(); sample(4,true,true,false,mock.now-2000); run_tick(mock.now); CHECK(power.low_latched);
    reset(); sample(4,true,true,false,mock.now); app_main();
    CHECK(controller.suspended && power.low_latched && mock.ble_calls==1 && mock.rendered_power.mode==BJ_POWER_LOW);
}
static void test_unknown_press_and_voice(void) {
    reset(); app_main(); face(); event(LV_EVENT_PRESSED,233,233,mock.now);
    CHECK(controller.gesture.pressed && !controller.gesture.hold_allowed);
    run_tick(mock.now+600); CHECK(controller.scene.screen==BJ_MAIN_A && !controller.gesture.holding);
    event(LV_EVENT_PRESSING,233,233,mock.now); CHECK(!controller.gesture.pressed && controller.scene.screen==BJ_MAIN_A);
    boot_normal(); face(); event(LV_EVENT_PRESSED,233,233,mock.now);
    CHECK(controller.gesture.hold_allowed); run_tick(mock.now+600); CHECK(controller.scene.screen==BJ_VOICE);
    sample(-1,false,false,false,mock.now); run_tick(mock.now);
    CHECK(power_view.mode==BJ_POWER_UNKNOWN && !controller.suspended && controller.scene.screen==BJ_MAIN_A && !controller.gesture.hold_allowed);
    event(LV_EVENT_RELEASED,233,233,mock.now); CHECK(!controller.scene.voice_success_pending);
    boot_normal(); voice_guide(); event(LV_EVENT_PRESSED,233,233,mock.now);
    run_tick(mock.now+600); CHECK(controller.scene.screen==BJ_VOICE);
    event(LV_EVENT_RELEASED,233,233,mock.now); CHECK(controller.scene.voice_success_pending);
    sample(-1,false,false,false,mock.now+240); run_tick(mock.now+240);
    CHECK(!controller.scene.voice_success_pending && controller.scene.phase==BJ_GUIDE_DO && controller.scene.step==4);
    sample(50,true,true,false,mock.now+1000); run_tick(mock.now+1000); CHECK(controller.scene.step==4 && controller.scene.phase==BJ_GUIDE_DO);
}
static void test_low_commit_and_freeze(void) {
    boot_normal(); CHECK(bj_scene_start_local(&controller.scene)); controller.scene.step=1;
    event(LV_EVENT_PRESSED,233,300,mock.now); event(LV_EVENT_PRESSING,233,100,mock.now+100);
    event(LV_EVENT_RELEASED,233,100,mock.now+20); CHECK(controller.motion==BJ_COMMIT && controller.scene.screen==BJ_GUIDE);
    sample(4,true,true,false,mock.now+1); run_tick(mock.now+1);
    CHECK(controller.suspended && controller.motion==BJ_INPUT_NONE && controller.direction==BJ_DIR_NONE && !controller.gesture.pressed);
    CHECK(mock.pumped_suspended && mock.pumped_power.mode==BJ_POWER_LOW && mock.pumped_power.retain_ble);
    CHECK((mock.ble_state[3]&8u)!=0 && mock.ble_state[5]==4 && mock.ble_state[6]==BJ_POWER_LOW);
    CHECK(!mock.frame.sliding && !mock.frame.target_visible && mock.frame.source.screen==BJ_GUIDE);
    run_tick(mock.now+5000); CHECK(controller.scene.screen==BJ_GUIDE && controller.scene.phase==BJ_GUIDE_DO && controller.scene.step==1);
    sample(50,true,true,false,mock.now); run_tick(mock.now); CHECK(controller.scene.screen==BJ_GUIDE && controller.motion==BJ_INPUT_NONE);
    boot_normal(); CHECK(bj_scene_start_local(&controller.scene));
    event(LV_EVENT_PRESSED,248,262,mock.now); event(LV_EVENT_RELEASED,248,262,mock.now+100);
    CHECK(controller.scene.phase==BJ_GUIDE_OK); uint32_t success=controller.scene.success_t0;
    sample(4,true,true,false,mock.now+100); run_tick(mock.now+100); uint32_t suspended=mock.now;
    run_tick(mock.now+5000); CHECK(controller.scene.phase==BJ_GUIDE_OK && controller.scene.step==0 && controller.scene.success_t0==success);
    sample(50,true,true,false,mock.now); run_tick(mock.now);
    CHECK(controller.scene.success_t0==success+mock.now-suspended && controller.scene.step==0);
    uint32_t adjusted=controller.scene.success_t0;
    run_tick(adjusted+899); CHECK(controller.scene.step==0);
    run_tick(adjusted+900); CHECK(controller.scene.step==1 && controller.scene.phase==BJ_GUIDE_DO);
    boot_normal(); voice_guide(); event(LV_EVENT_PRESSED,233,233,mock.now); run_tick(mock.now+600);
    event(LV_EVENT_RELEASED,233,233,mock.now); CHECK(controller.scene.voice_success_pending);
    sample(4,true,true,false,mock.now+240); run_tick(mock.now+240);
    CHECK(controller.suspended && !controller.scene.voice_success_pending && controller.scene.step==4 && controller.scene.phase==BJ_GUIDE_DO);
    boot_normal(); voice_guide(); event(LV_EVENT_PRESSED,233,233,mock.now); run_tick(mock.now+600);
    CHECK(controller.scene.screen==BJ_VOICE);
    sample(4,true,true,false,mock.now+1); run_tick(mock.now+1);
    CHECK(controller.suspended && controller.scene.screen==BJ_GUIDE && !controller.scene.voice_success_pending && !controller.gesture.pressed);
}
static void test_input_edges(void) {
    boot_normal(); unsigned rendered=mock.render_calls;
    mock.input_missing=true; event(LV_EVENT_PRESSED,233,233,mock.now); CHECK(mock.render_calls==rendered && !controller.gesture.pressed);
    mock.input_missing=false; event(LV_EVENT_OTHER,233,233,mock.now); CHECK(mock.render_calls==rendered);
    event(LV_EVENT_PRESSED,200,370,mock.now); event(LV_EVENT_RELEASED,200,370,mock.now+100); CHECK(controller.scene.local_experience && controller.scene.screen==BJ_GUIDE);
    face(); event(LV_EVENT_PRESSED,233,233,mock.now); run_tick(mock.now+600); CHECK(controller.scene.screen==BJ_VOICE);
    event(LV_EVENT_PRESS_LOST,233,233,mock.now); CHECK(controller.scene.screen==BJ_MAIN_A && !controller.gesture.pressed);
}
static void test_data_inputs(void) {
    boot_normal();face();controller.scene.screen=BJ_CARE;
    for(unsigned i=0;i<3;i++) {event(LV_EVENT_PRESSED,233,193,mock.now+100);event(LV_EVENT_RELEASED,233,193,mock.now+100);}
    CHECK(events_count==1 && event_types[0]==2 && event_args[0]==3 && !care_count);
    boot_normal();face();controller.scene.screen=BJ_CARE;
    event(LV_EVENT_PRESSED,233,235,mock.now);event(LV_EVENT_RELEASED,233,235,mock.now+100);
    CHECK(care_type==3 && care_count==1 && events_count==0);controller.scene.screen=BJ_MAIN_A;run_tick(mock.now+100);
    CHECK(events_count==1 && event_types[0]==6 && event_args[0]==3 && !care_count);
    boot_normal();worker_ready=peer_current=true;worker_view.generation=44;worker_view.confirm_pending=true;
    worker_view.challenge_id[0]=7;run_tick(mock.now+1);
    event(LV_EVENT_RELEASED,233,365,mock.now+1);CHECK(confirms==0);
    event(LV_EVENT_PRESSED,233,365,mock.now+1);worker_view.challenge_id[0]=8;run_tick(mock.now+1);
    event(LV_EVENT_RELEASED,233,365,mock.now+1);CHECK(confirms==1 && confirmed_id[0]==7); /* worker rejects old id */
    worker_view.confirm_pending=false;worker_view.authenticated=true;run_tick(mock.now+1);CHECK(controller.scene.authenticated);
    peer_current=false;run_tick(mock.now+1);CHECK(!controller.scene.authenticated);
    boot_normal();face();controller.scene.tutorial_active=true;controller.scene.screen=BJ_GUIDE;
    event(LV_EVENT_PRESSED,248,262,mock.now);event(LV_EVENT_RELEASED,248,262,mock.now+100);CHECK(events_count==0);
}
int main(void) {
    test_boot(); test_power_latch(); test_unknown_press_and_voice(); test_low_commit_and_freeze(); test_input_edges();test_data_inputs();
    printf("runtime regression PASS: %u scenarios, %u assertions (real baji_main/controller/gesture/scene/power/link/protocol)\n",cases,checks);
    return 0;
}
