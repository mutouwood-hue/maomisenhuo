/* OFFLINE ONLY. Production implementation is included without copying/repainting
 * any page. This translation unit can select its static UI states for capture.
 * Device/state/NVS are explicitly memory-only fixtures, never hardware access. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "lvgl.h"
#include "badge.h"
#include "local2_store.h"
#include "local2_peer.h"
#include "esp_app_desc.h"
#include "nvs.h"
#include "bsp/esp-bsp.h"
static badge_view_t fixture;
static l2_view_t domain_fixture;
static l2_peer_view_t peer_fixture;
static bool clock_valid;
static l2_status_t emit_result=L2_OK;
static l2_action_t last_emitted=L2_ACTION_IDLE;
static lv_display_t *host_display;
static lv_indev_t *host_input;
static unsigned host_brightness=75, guide_saved;
static const unsigned legacy_guide_saved=1;
static unsigned mock_pet_calls, mock_bond_calls,mock_present_calls;
static bool guide_store_fail;static unsigned guide_pending;
static lv_point_t pointer_point={233,233};
static lv_indev_state_t pointer_state=LV_INDEV_STATE_RELEASED;
#ifdef BADGE_BENCH_PARTIAL
static uint16_t draw_buffer[466*10], draw_buffer2[466*10];
#else
static uint16_t draw_buffer[466*466];
#endif
static uint16_t framebuffer[466*466];
static unsigned long long bench_flushes,bench_pixels;
static void round_native(lv_event_t *e) {
    lv_area_t *a=lv_event_get_param(e);
    a->x1=(a->x1>>1)<<1;a->y1=(a->y1>>1)<<1;
    a->x2=((a->x2>>1)<<1)+1;a->y2=((a->y2>>1)<<1)+1;
}
static void flush(lv_display_t *display,const lv_area_t *area,uint8_t *pixels)
{
    unsigned width=(unsigned)(area->x2-area->x1+1);
    bench_flushes++;bench_pixels+=(unsigned long long)width*(area->y2-area->y1+1);
    for(int y=area->y1;y<=area->y2;y++)
        memcpy(framebuffer+y*466+area->x1,pixels+(y-area->y1)*width*2,width*2);
    lv_display_flush_ready(display);
}
static void pointer_read(lv_indev_t *input,lv_indev_data_t *data)
{ (void)input; data->state=pointer_state; data->point=pointer_point; }
lv_display_t *bsp_display_start(void)
{
    host_display=lv_display_create(466,466);
    lv_display_set_color_format(host_display,LV_COLOR_FORMAT_RGB565);
    #ifdef BADGE_BENCH_PARTIAL
    lv_display_set_buffers(host_display,draw_buffer,draw_buffer2,sizeof(draw_buffer),LV_DISPLAY_RENDER_MODE_PARTIAL);
    lv_display_add_event_cb(host_display,round_native,LV_EVENT_INVALIDATE_AREA,NULL);
#else
    lv_display_set_buffers(host_display,draw_buffer,NULL,sizeof(draw_buffer),LV_DISPLAY_RENDER_MODE_FULL);
#endif
    lv_display_set_flush_cb(host_display,flush);
    host_input=lv_indev_create(); lv_indev_set_type(host_input,LV_INDEV_TYPE_POINTER);
    lv_indev_set_read_cb(host_input,pointer_read); lv_indev_set_display(host_input,host_display);
    return host_display;
}
lv_indev_t *bsp_display_get_input_dev(void) {return host_input;}
esp_err_t bsp_display_lock(unsigned t) {(void)t;return ESP_OK;}
void bsp_display_unlock(void) {}
esp_err_t bsp_display_brightness_set(int p) {host_brightness=(unsigned)p;return ESP_OK;}
const esp_app_desc_t *esp_app_get_description(void)
{static const esp_app_desc_t a={.version="0.3.1-local3"};return &a;}
void badge_get_view(badge_view_t *out) {*out=fixture;}
void badge_message(const char *message) {snprintf(fixture.message,sizeof(fixture.message),"%s",message);}
esp_err_t badge_pet(void) {mock_pet_calls++;fixture.pending++;return ESP_OK;}
esp_err_t badge_retry_blocked(void) {fixture.blocked=0;return ESP_OK;}
bool badge_ble_clear_bonds(void) {mock_bond_calls++;return true;}
void local2_get_view(l2_view_t *out) {*out=domain_fixture;}
l2_status_t local2_emit_care(l2_action_t action,uint64_t epoch) {(void)epoch;if(emit_result!=L2_OK)return emit_result;mock_pet_calls++;last_emitted=action;domain_fixture.pending_events++;domain_fixture.care_change++;return L2_OK;}
l2_status_t local2_present_gift_state(l2_gift_state_t state) {mock_present_calls++;domain_fixture.gift_state=state;return L2_OK;}
bool local2_clock_now(uint64_t *out) {if(out)*out=clock_valid?UINT64_C(1792067640000):0;return clock_valid;}
int local2_clock_utc_offset_minutes(void) {return 480;}
void local2_peer_get_view(l2_peer_view_t *out) {*out=peer_fixture;}
void local2_peer_set_discoverable(bool enabled) {peer_fixture.discoverable=enabled;peer_fixture.phase=enabled?L2P_DISCOVERING:L2P_DISABLED;}
static unsigned confirm_calls; static l2_peer_confirm_token_t sent_intent;
void local2_peer_confirm(const l2_peer_confirm_token_t *token) {if(token&&token->valid){confirm_calls++;sent_intent=*token;peer_fixture.local_confirmed=true;}}
esp_err_t nvs_open(const char *n,int mode,nvs_handle_t *h) {(void)n;(void)mode;*h=1;return ESP_OK;}
esp_err_t nvs_get_u8(nvs_handle_t h,const char *k,uint8_t *v) {(void)h;assert(!strcmp(k,"guide_v3"));*v=guide_saved;return guide_saved?ESP_OK:ESP_ERR_NVS_NOT_FOUND;}
esp_err_t nvs_set_u8(nvs_handle_t h,const char *k,uint8_t v) {(void)h;assert(!strcmp(k,"guide_v3"));guide_pending=v;return ESP_OK;}
esp_err_t nvs_commit(nvs_handle_t h) {(void)h;if(guide_store_fail)return ESP_FAIL;guide_saved=guide_pending;return ESP_OK;}
void nvs_close(nvs_handle_t h) {(void)h;}

/* No production preprocessor overrides or replacements below this line. */
#ifndef BADGE_PAGES_SOURCE
#define BADGE_PAGES_SOURCE "../../main/badge_pages.c"
#endif
#include BADGE_PAGES_SOURCE
#include "toast_cases.inc"

static void advance(unsigned milliseconds)
{for(unsigned i=0;i<milliseconds;i+=10){lv_tick_inc(10);lv_timer_handler();}}
static void quote(FILE *f,const char *s)
{
    fputc('"',f);for(const unsigned char *p=(const unsigned char *)s;*p;p++) {
        if(*p=='"'||*p=='\\'){fputc('\\',f);fputc(*p,f);}
        else if(*p<32)fprintf(f,"\\u%04x",*p);else fputc(*p,f);
    }fputc('"',f);
}
static unsigned labels_written, missing_glyphs;
static void inspect(FILE *f,lv_obj_t *o,bool hidden)
{
    hidden=hidden||lv_obj_has_flag(o,LV_OBJ_FLAG_HIDDEN);
    if(!hidden&&lv_obj_check_type(o,&lv_label_class)) {
        if(labels_written++)fputc(',',f);
        lv_area_t a;lv_obj_get_coords(o,&a);const char *text=lv_label_get_text(o);
        fprintf(f,"{\"bounds\":[%d,%d,%d,%d],\"text\":",a.x1,a.y1,a.x2,a.y2);quote(f,text);
        const lv_font_t *font=lv_obj_get_style_text_font(o,LV_PART_MAIN);
        fprintf(f,",\"font_line_height\":%u,\"missing_glyphs\":[",font->line_height);
        unsigned n=0;const unsigned char *p=(const unsigned char *)text;
        while(*p) {
            uint32_t c=*p++;if(c>=0xf0){c&=7;for(int j=0;j<3&&*p;j++)c=(c<<6)|(*p++&63);}
            else if(c>=0xe0){c&=15;for(int j=0;j<2&&*p;j++)c=(c<<6)|(*p++&63);}
            else if(c>=0xc0){c=(c&31)<<6;if(*p)c|=*p++&63;}
            lv_font_glyph_dsc_t d;
            if(c>32&&!lv_font_get_glyph_dsc(font,&d,c,0)){if(n++)fputc(',',f);fprintf(f,"%u",c);missing_glyphs++;}
        }
        fputs("]}",f);
    }
    for(unsigned i=0;i<lv_obj_get_child_count(o);i++)inspect(f,lv_obj_get_child(o,i),hidden);
}
static unsigned visuals_written;
static void inspect_controls(FILE *f,lv_obj_t *o,bool hidden)
{
    hidden=hidden||lv_obj_has_flag(o,LV_OBJ_FLAG_HIDDEN);
    if(!hidden&&lv_obj_has_flag(o,LV_OBJ_FLAG_USER_1)){
        if(visuals_written++)fputc(',',f);lv_area_t a;lv_obj_get_coords(o,&a);
        bool overlay=gift_popup&&!lv_obj_has_flag(gift_popup,LV_OBJ_FLAG_HIDDEN),in_gift=false;
        for(lv_obj_t *parent=o;parent;parent=lv_obj_get_parent(parent))if(parent==gift_popup)in_gift=true;
        bool enabled=!ui_drag.active&&!transitioning()&&mode!=MODE_AOD&&mode!=MODE_OFF&&(!overlay||in_gift);
        fprintf(f,"{\"bounds\":[%d,%d,%d,%d],\"enabled\":%s}",a.x1,a.y1,a.x2,a.y2,enabled?"true":"false");
    }
    for(unsigned i=0;i<lv_obj_get_child_count(o);i++)inspect_controls(f,lv_obj_get_child(o,i),hidden);
}
static void inspect_targets(FILE *f)
{
    for(unsigned i=0;i<HIT_COUNT;i++){
        ui_hit_target_t t=ui_target((ui_hit_id_t)i);if(i)fputc(',',f);
        fprintf(f,"{\"name\":");quote(f,t.name);fprintf(f,",\"page\":%d,\"shape\":%u,\"center\":[%d,%d],\"size\":[%d,%d],\"enabled\":%s}",t.page,t.shape,t.cx,t.cy,t.w,t.h,t.enabled?"true":"false");
    }
}
static void select_page(page_t p)
{navigate(p);advance(260);lv_obj_update_layout(lv_screen_active());}
static void make_fixture(const char *name)
{
    memset(&fixture,0,sizeof(fixture));
    strcpy(fixture.device_id,"badge-OFFLINE-FIXTURE");
    fixture.bound=strncmp(name,"pair",4)!=0&&strcmp(name,"boot")!=0;
    if(fixture.bound) {
        strcpy(fixture.snapshot.pet_id,"00000000-0000-4000-8000-000000000000");
        fixture.snapshot.food=70;fixture.snapshot.mood=65;fixture.snapshot.clean=80;
        fixture.snapshot.energy=75;fixture.snapshot.health=90;fixture.snapshot.revision=1;
    }
    if(!strcmp(name,"pair_connected"))fixture.connected=true;
    if(!strcmp(name,"pair_ready"))fixture.connected=fixture.subscribed=true;
    if(!strcmp(name,"storage_error"))fixture.storage_error=true;
    if(!strcmp(name,"main_low_stats"))fixture.snapshot.food=20;
    if(!strcmp(name,"device")){fixture.pending=200;fixture.blocked=3;}
    guide_saved=1;
    domain_fixture.ready=true;domain_fixture.has_snapshot=fixture.bound;
    strcpy(domain_fixture.device_id,"badge-OFFLINE-FIXTURE");
    strcpy(domain_fixture.snapshot.pet.pet_id,"00000000-0000-4000-8000-000000000000");
    strcpy(domain_fixture.snapshot.pet.name,"小橘");strcpy(domain_fixture.snapshot.pet.breed,"orange");
    domain_fixture.snapshot.pet.food=70;domain_fixture.snapshot.pet.mood=65;domain_fixture.snapshot.pet.clean=80;domain_fixture.snapshot.pet.energy=75;domain_fixture.snapshot.pet.health=90;
    domain_fixture.snapshot.revision=1;
    if(!strcmp(name,"storage_error")){domain_fixture.ready=false;domain_fixture.storage_error=true;domain_fixture.has_snapshot=false;}
    if(!strcmp(name,"main_low_stats"))domain_fixture.snapshot.pet.food=20;
    if(!strcmp(name,"historical_departing"))domain_fixture.snapshot.scene=L2_SCENE_DEPARTING;
    if(!strcmp(name,"device"))domain_fixture.pending_events=200;
}
static void point(int x,int y,lv_indev_state_t state);
static void touch(int x,int y,unsigned ms);
static void stroke(int x1,int y1,int x2,int y2,unsigned ms);
static void choose(const char *name,const char *clip,int frame)
{
    if(!strcmp(name,"boot")){advance(100);return;}
    if(!strcmp(name,"guide_demo_test")){select_page(PAGE_GUIDE);return;}
    if(!strncmp(name,"toast_",6)){unsigned i=(unsigned)strtoul(name+6,NULL,10);assert(i<sizeof(toast_messages)/sizeof(toast_messages[0]));select_page(PAGE_GUIDE);announce(toast_messages[i]);lv_refr_now(host_display);return;}
    if(!strcmp(name,"guide_wrong")||!strcmp(name,"guide_success")||!strcmp(name,"guide_skip")||!strcmp(name,"guide_hold")){
        select_page(PAGE_GUIDE);
        if(!strcmp(name,"guide_wrong"))touch(80,230,70);
        if(!strcmp(name,"guide_success"))touch(233,200,70);
        if(!strcmp(name,"guide_skip")){guide_done=false;guide_saved=0;touch(233,411,70);advance(260);}
        if(!strcmp(name,"guide_hold")){guide_index=4;update_guide();point(233,200,LV_INDEV_STATE_PRESSED);advance(650);}
        advance(60);lv_obj_update_layout(lv_screen_active());return;
    }
    if(!strncmp(name,"drag_",5)){
        select_page(!strcmp(name,"drag_no_target")?PAGE_STATUS:PAGE_HOME);
        if(!strcmp(name,"drag_up_mid")){point(233,320,LV_INDEV_STATE_PRESSED);advance(60);point(233,220,LV_INDEV_STATE_PRESSED);}
        else if(!strcmp(name,"drag_commit"))stroke(233,350,233,210,800);
        else if(!strcmp(name,"drag_rebound"))stroke(233,300,233,260,120);
        else {point(233,200,LV_INDEV_STATE_PRESSED);advance(60);point(233,400,LV_INDEV_STATE_PRESSED);}
        lv_obj_update_layout(lv_screen_active());return;
    }
    if(!strncmp(name,"pair",4)&&strcmp(name,"pair_reset")){select_page(PAGE_PAIR);return;}
    if(!strncmp(name,"guide_",6)){select_page(PAGE_GUIDE);guide_index=(unsigned)atoi(name+6)-1;assert(guide_index<5);update_guide();}
    else if(!strcmp(name,"care_menu"))select_page(PAGE_CARE);
    else if(!strcmp(name,"welcome"))select_page(PAGE_WELCOME);
    else if(!strncmp(name,"care_",5)) {
        select_page(PAGE_CARE);begin_care(!strcmp(name,"care_water")?L2_ACTION_WATER:!strcmp(name,"care_play")?L2_ACTION_PLAY:!strcmp(name,"care_sleep")?L2_ACTION_SLEEP:L2_ACTION_FEED);advance(260);
        if(care_action==L2_ACTION_FEED || care_action==L2_ACTION_WATER) {care_step();advance(500);care_step();}
        if(care_action==L2_ACTION_PLAY) {care_step();advance(710);care_step();advance(710);care_step();}
    }
    else if(!strcmp(name,"meet_confirm")) {peer_fixture.phase=L2P_CONFIRM;peer_fixture.discoverable=peer_fixture.connected=true;strcpy(peer_fixture.peer_id,"00000000000000000000000000000001");select_page(PAGE_MEET);refresh_state();}
    else if(!strcmp(name,"status"))select_page(PAGE_STATUS);
    else if(!strcmp(name,"settings"))select_page(PAGE_SETTINGS);
    else if(!strcmp(name,"device")||!strcmp(name,"storage_error"))select_page(PAGE_DEVICE);
    else if(!strcmp(name,"pair_reset")){select_page(PAGE_DEVICE);manage_pairing();}
    else if(!strncmp(name,"touch_",6)) {
        select_page(PAGE_TOUCH);
        if(!strcmp(name,"touch_complete"))for(unsigned i=0;i<5;i++)tap(target_x[i],target_y[i]);
    }
    else if(!strcmp(name,"voice"))select_page(PAGE_VOICE);
    else {
        select_page(PAGE_HOME);
        if(!strcmp(name,"main_b") || !strcmp(name,"main_b_clock")) {swipe(BADGE_GESTURE_LEFT);clock_valid=!strcmp(name,"main_b_clock");refresh_state();}
        if(!strcmp(name,"main_c")||!strcmp(name,"main_c_clock")){swipe(BADGE_GESTURE_LEFT);advance(260);swipe(BADGE_GESTURE_LEFT);clock_valid=!strcmp(name,"main_c_clock");advance(260);refresh_state();}
        if(!strcmp(name,"departing") || !strcmp(name,"away_rain") || !strcmp(name,"returning_snow")) {
            domain_fixture.snapshot.scene=!strcmp(name,"departing")?L2_SCENE_DEPARTING:!strcmp(name,"away_rain")?L2_SCENE_AWAY:L2_SCENE_RETURNING;
            domain_fixture.snapshot.weather=!strcmp(name,"away_rain")?L2_WEATHER_RAIN:!strcmp(name,"returning_snow")?L2_WEATHER_SNOW:L2_WEATHER_CLEAR;
            domain_fixture.snapshot.action=!strcmp(name,"away_rain")?L2_ACTION_IDLE:L2_ACTION_WALK;domain_fixture.snapshot.revision++;refresh_state();advance(600);
        }
        if(!strncmp(name,"action_",7)) {
            domain_fixture.snapshot.action=!strcmp(name,"action_feed")?L2_ACTION_FEED:!strcmp(name,"action_water")?L2_ACTION_WATER:!strcmp(name,"action_bath")?L2_ACTION_BATH:!strcmp(name,"action_play")?L2_ACTION_PLAY:!strcmp(name,"action_sleep")?L2_ACTION_SLEEP:L2_ACTION_PET;
            domain_fixture.snapshot.revision++;refresh_state();advance(500);
        }
        if(!strncmp(name,"gift_",5)) {
            face=2;update_face();domain_fixture.has_gift=true;domain_fixture.last_gift.gift_kind=1;domain_fixture.last_gift.quantity=1;domain_fixture.gift_change++;
            peer_fixture.phase=!strcmp(name,"gift_complete")?L2P_COMPLETE:L2P_WAIT_DONE;
            if(!strcmp(name,"gift_complete")){peer_fixture.incoming_new=true;peer_fixture.complete=true;peer_fixture.complete_count++;peer_fixture.local_confirmed=peer_fixture.remote_confirmed=peer_fixture.incoming_saved=peer_fixture.outgoing_acked=true;}
            refresh_state();
        }
        if(!strcmp(name,"aod")){last_input=lv_tick_get()-41000;advance(40);}
    }
    if(clip) {
        const badge_scene_assets_t *bank=badge_game_assets();
        badge_scene_clip_id_t id=!strcmp(clip,"pet")?BADGE_SCENE_PET:!strcmp(clip,"walk")?BADGE_SCENE_WALK:!strcmp(clip,"attention")?BADGE_SCENE_ATTENTION:BADGE_SCENE_IDLE;
        const badge_scene_clip_t *c=&bank->clips[id];assert(frame>=0&&frame<c->count);
        /* Exact asset index through the production scene timeline, no surrogate images. */
        uint32_t start=lv_tick_get();badge_scene_play(home_scene,id,start);
        unsigned elapsed=((unsigned)frame*c->cycle_ms+c->count-1)/c->count;
        badge_scene_tick(home_scene,start+elapsed,true);
    }
    lv_obj_update_layout(lv_screen_active());lv_refr_now(host_display);
}

static unsigned assertions, measured_rebound_ms, measured_commit_ms;
/* Test-only adapter: rows are strictly derived from the actual peer/core trace.
 * This code is not part of the ESP application and cannot complete a real peer. */
static void replay_peer_trace(const char *path)
{
    FILE *f=fopen(path,"r");assert(f);char line[1024];unsigned previous_ms=0;
    select_page(PAGE_MEET);
    while(fgets(line,sizeof(line),f)) {
        unsigned ms,phase,discoverable,connected,local_confirmed,remote_confirmed,saved,incoming_new,acked,complete,pending,status,kind,quantity;
        unsigned long long completed,incoming,outgoing,gifts;char peer_id[33],device_id[33];
        int fields=sscanf(line,"%u %u %u %u %u %u %u %u %u %u %llu %llu %llu %u %llu %u %32s %32s %u %u",&ms,&phase,&discoverable,&connected,&local_confirmed,&remote_confirmed,&saved,&incoming_new,&acked,&complete,&completed,&incoming,&outgoing,&pending,&gifts,&status,peer_id,device_id,&kind,&quantity);
        assert(fields==20&&phase<=L2P_BLOCKED&&ms>=previous_ms&&ms<=120000);
        if(ms>previous_ms)advance(ms-previous_ms);
        previous_ms=ms;
        peer_fixture=(l2_peer_view_t){.phase=phase,.discoverable=discoverable,.connected=connected,.local_confirmed=local_confirmed,.remote_confirmed=remote_confirmed,.incoming_saved=saved,.incoming_new=incoming_new,.outgoing_acked=acked,.complete=complete,.complete_count=completed,.incoming_counter=incoming,.outgoing_counter=outgoing,.storage_status=status};
        if(strcmp(peer_id,"-"))snprintf(peer_fixture.peer_id,sizeof(peer_fixture.peer_id),"%s",peer_id);
        snprintf(domain_fixture.device_id,sizeof(domain_fixture.device_id),"%s",device_id);
        domain_fixture.pending_events=pending;domain_fixture.gift_change=gifts;
        if(saved&&!domain_fixture.has_gift)domain_fixture.gift_state=L2_GIFT_PENDING;
        domain_fixture.has_gift=saved;
        if(saved) {
            assert(kind==1&&quantity==1);
            snprintf(domain_fixture.last_gift.peer_id,sizeof(domain_fixture.last_gift.peer_id),"%s",peer_id);
            domain_fixture.last_gift.counter=incoming;domain_fixture.last_gift.gift_kind=kind;domain_fixture.last_gift.quantity=quantity;
        }
        refresh_state();lv_obj_update_layout(lv_screen_active());
    }
    assert(!ferror(f));fclose(f);
}
#define CHECK(condition) do {assert(condition);assertions++;} while(0)
static void point(int x,int y,lv_indev_state_t state)
{pointer_point=(lv_point_t){x,y};pointer_state=state;lv_indev_read(host_input);lv_timer_handler();}
static void touch(int x,int y,unsigned ms)
{point(x,y,LV_INDEV_STATE_PRESSED);advance(ms);point(x,y,LV_INDEV_STATE_RELEASED);advance(40);}
static void input_checks(void)
{
    select_page(PAGE_HOME);mock_pet_calls=0;
    point(233,262,LV_INDEV_STATE_PRESSED);advance(60);point(233,180,LV_INDEV_STATE_PRESSED);advance(60);point(233,180,LV_INDEV_STATE_RELEASED);advance(280);
    CHECK(current_page==PAGE_CARE);CHECK(mock_pet_calls==0);
    touch(105,322,70);advance(260);CHECK(current_page==PAGE_CARE_ACTION);CHECK(care_action==L2_ACTION_FEED);
    touch(233,323,70);CHECK(care_steps==1);touch(233,323,70);CHECK(care_steps==1);advance(500);
    touch(233,323,70);CHECK(care_steps==2);advance(500);touch(233,323,70);advance(280);
    CHECK(mock_pet_calls==1);CHECK(last_emitted==L2_ACTION_FEED);CHECK(current_page==PAGE_HOME);CHECK(domain_fixture.snapshot.pet.food==70);
    unsigned saved=mock_pet_calls;begin_care(L2_ACTION_WATER);advance(280);touch(233,323,70);CHECK(care_steps==1);
    swipe(BADGE_GESTURE_DOWN);advance(280);CHECK(current_page==PAGE_CARE);CHECK(mock_pet_calls==saved);
    begin_care(L2_ACTION_SLEEP);advance(280);point(233,323,LV_INDEV_STATE_PRESSED);advance(1400);point(233,323,LV_INDEV_STATE_RELEASED);advance(80);CHECK(mock_pet_calls==saved);
    point(233,323,LV_INDEV_STATE_PRESSED);advance(1600);point(233,323,LV_INDEV_STATE_RELEASED);advance(280);CHECK(mock_pet_calls==saved+1);CHECK(last_emitted==L2_ACTION_SLEEP);CHECK(current_page==PAGE_HOME);
    saved=mock_pet_calls;begin_care(L2_ACTION_FEED);advance(280);emit_result=L2_STORAGE_ERROR;
    for(unsigned i=0;i<3;i++){touch(233,323,70);advance(500);}CHECK(mock_pet_calls==saved);CHECK(current_page==PAGE_CARE_ACTION);emit_result=L2_OK;
    navigate(PAGE_HOME);advance(280);saved=mock_pet_calls;point(233,262,LV_INDEV_STATE_PRESSED);advance(700);point(233,262,LV_INDEV_STATE_RELEASED);advance(280);CHECK(current_page==PAGE_VOICE);CHECK(mock_pet_calls==saved);
    navigate(PAGE_HOME);advance(280);saved=mock_pet_calls;set_mode(MODE_AOD);touch(233,262,70);CHECK(mock_pet_calls==saved);CHECK(mode==MODE_PLAY);
    begin_care(L2_ACTION_PLAY);advance(280);saved=mock_pet_calls;point(180,250,LV_INDEV_STATE_PRESSED);
    for(unsigned i=0;i<5;i++){advance(i ? 710 : 50);point(i%2 ? 180 : 300,250,LV_INDEV_STATE_PRESSED);advance(40);}
    point(300,250,LV_INDEV_STATE_RELEASED);advance(280);CHECK(mock_pet_calls==saved+1);CHECK(last_emitted==L2_ACTION_PLAY);CHECK(current_page==PAGE_HOME);
    l2_view_t before=domain;domain_fixture.busy=true;domain_fixture.ready=false;refresh_state();CHECK(domain.ready==before.ready);CHECK(current_page!=PAGE_DEVICE);domain_fixture.busy=false;domain_fixture.ready=true;
    domain_fixture.has_gift=true;domain_fixture.last_gift.gift_kind=1;domain_fixture.last_gift.quantity=1;domain_fixture.gift_change++;
    peer_fixture.phase=L2P_WAIT_DONE;peer_fixture.incoming_saved=true;refresh_state();CHECK(lv_obj_has_flag(gift_popup,LV_OBJ_FLAG_HIDDEN));CHECK(mock_present_calls==0);
    peer_fixture.phase=L2P_COMPLETE;peer_fixture.complete=true;peer_fixture.incoming_new=true;peer_fixture.complete_count++;refresh_state();CHECK(!lv_obj_has_flag(gift_popup,LV_OBJ_FLAG_HIDDEN));CHECK(mock_present_calls==1);
    touch(233,360,70);CHECK(lv_obj_has_flag(gift_popup,LV_OBJ_FLAG_HIDDEN));CHECK(mock_present_calls==2);
    peer_fixture.incoming_new=false;peer_fixture.complete_count++;refresh_state();CHECK(!gift_popup_new);CHECK(mock_present_calls==2);CHECK(strstr(lv_label_get_text(gift_popup_title),"双方已确认")!=NULL);tap(233,360);CHECK(mock_present_calls==2);
    fprintf(stderr,"UI input assertions passed: %u (production handlers, memory-only domain/peer/BSP)\n",assertions);
}
static void stroke(int x1,int y1,int x2,int y2,unsigned ms)
{point(x1,y1,LV_INDEV_STATE_PRESSED);for(unsigned t=20;t<=ms;t+=20){advance(20);point(x1+(x2-x1)*(int)t/(int)ms,y1+(y2-y1)*(int)t/(int)ms,LV_INDEV_STATE_PRESSED);}point(x2,y2,LV_INDEV_STATE_PRESSED);point(x2,y2,LV_INDEV_STATE_RELEASED);}
static void v3_input_checks(void)
{
    unsigned before=assertions,saved=mock_pet_calls;
    navigate(PAGE_HOME);advance(280);face=0;update_face();advance(40);
    point(233,300,LV_INDEV_STATE_PRESSED);advance(80);point(233,260,LV_INDEV_STATE_PRESSED);
    CHECK(ui_drag.active);CHECK(ui_drag.offset==-40);CHECK(lv_obj_get_y(pages[PAGE_HOME])==-40);CHECK(lv_obj_get_y(pages[PAGE_CARE])==426);
    point(233,260,LV_INDEV_STATE_RELEASED);CHECK(ui_drag.settling);advance(160);CHECK(ui_drag.settling);advance(40);CHECK(!ui_drag.active);CHECK(current_page==PAGE_HOME);CHECK(lv_obj_get_y(pages[PAGE_HOME])==0);CHECK(mock_pet_calls==saved);
    stroke(233,350,233,211,800);advance(220);CHECK(current_page==PAGE_HOME);CHECK(!ui_drag.active);CHECK(mock_pet_calls==saved);
    stroke(233,350,233,210,800);CHECK(ui_drag.commit);advance(180);CHECK(ui_drag.settling);advance(40);CHECK(current_page==PAGE_CARE);CHECK(!ui_drag.active);CHECK(mock_pet_calls==saved);
    navigate(PAGE_STATUS);advance(280);point(233,200,LV_INDEV_STATE_PRESSED);advance(60);point(233,400,LV_INDEV_STATE_PRESSED);
    CHECK(ui_drag.active);CHECK(!ui_drag.has_target);CHECK(ui_drag.offset==28);point(233,400,LV_INDEV_STATE_RELEASED);advance(200);CHECK(current_page==PAGE_STATUS);CHECK(lv_obj_get_y(pages[PAGE_STATUS])==0);
    navigate(PAGE_HOME);advance(280);face=0;update_face();advance(40);stroke(320,233,180,233,800);CHECK(ui_drag.to_face);advance(220);CHECK(face==1);CHECK(current_page==PAGE_HOME);CHECK(mock_pet_calls==saved);
    point(233,300,LV_INDEV_STATE_PRESSED);advance(40);point(233,220,LV_INDEV_STATE_PRESSED);CHECK(ui_drag.active);lv_indev_reset(host_input,NULL);advance(80);point(233,220,LV_INDEV_STATE_RELEASED);advance(220);CHECK(!ui_drag.active);CHECK(lv_obj_get_y(pages[PAGE_HOME])==0);CHECK(mock_pet_calls==saved);
    for(unsigned i=0;i<HIT_COUNT;i++){
        ui_hit_target_t t=ui_target((ui_hit_id_t)i);if(t.shape==UI_HIT_UNAVAILABLE){CHECK(!t.enabled);continue;}
        int dx=t.cx-233,dy=t.cy-233;
        if(t.shape==UI_HIT_CIRCLE){CHECK(sqrt((double)dx*dx+(double)dy*dy)+t.w<=212.0001);}
        else for(int x=-1;x<=1;x+=2)for(int y=-1;y<=1;y+=2){int px=dx+x*t.w/2,py=dy+y*t.h/2;CHECK(px*px+py*py<=212*212);}
    }
    /* Same geometry as actual footer handler: exact corner works, adjacent pixel does not. */
    peer_fixture=(l2_peer_view_t){.phase=L2P_DISCOVERING,.discoverable=true};select_page(PAGE_MEET);refresh_state();
    touch(116,374,70);CHECK(current_page==PAGE_MEET);CHECK(peer_fixture.discoverable);
    touch(117,374,70);advance(260);CHECK(current_page==PAGE_SETTINGS);CHECK(!peer_fixture.discoverable);
    /* Old guide_v1=1 must never qualify as v3 mastery. */
    guide_saved=0;guide_done=false;guide_mastered=false;load_preferences();CHECK(!guide_done);CHECK(legacy_guide_saved==1);
    select_page(PAGE_GUIDE);saved=mock_pet_calls;touch(80,230,60);advance(600);CHECK(guide_index==0);CHECK(mock_pet_calls==saved);
    touch(233,200,70);advance(600);CHECK(guide_index==1);touch(233,200,70);advance(600);CHECK(guide_index==1);
    stroke(233,280,233,180,120);advance(600);CHECK(guide_index==2);stroke(233,180,233,280,120);advance(600);CHECK(guide_index==3);
    stroke(300,233,170,233,120);advance(600);CHECK(guide_index==3);CHECK(guide_lr_mask==1);
    stroke(170,233,300,233,120);advance(600);CHECK(guide_index==4);
    touch(233,200,500);advance(600);CHECK(guide_index==4);CHECK(current_page==PAGE_GUIDE);
    touch(233,200,650);advance(600);CHECK(current_page==PAGE_WELCOME);CHECK(guide_mastered);CHECK(guide_saved==1);CHECK(mock_pet_calls==saved);CHECK(legacy_guide_saved==1);
    guide_saved=0;guide_done=guide_mastered=false;guide_store_fail=true;select_page(PAGE_GUIDE);touch(233,411,70);advance(280);CHECK(current_page==PAGE_GUIDE);CHECK(!guide_done);CHECK(guide_saved==0);
    guide_store_fail=false;touch(233,411,70);advance(280);CHECK(current_page==PAGE_WELCOME);CHECK(guide_saved==2);CHECK(!guide_mastered);CHECK(!guide_completed_now);CHECK(mock_pet_calls==saved);
    navigate(PAGE_HOME);advance(280);saved=mock_pet_calls;last_input=lv_tick_get()-41000;set_mode(MODE_AOD);touch(20,233,70);CHECK(mode==MODE_AOD);CHECK(mock_pet_calls==saved);touch(233,262,70);CHECK(mode==MODE_PLAY);CHECK(mock_pet_calls==saved);
    fprintf(stderr,"V3 pointer/guide/geometry assertions passed: %u; total %u (actual LVGL pointer+tick; offline stores)\n",assertions-before,assertions);
}

/* Modal arrival is driven by a synthetic receipt; contacts below use the actual
 * LVGL pointer reader, timers and unmodified production handlers. */
static void show_test_gift(void)
{
    peer_fixture.phase=L2P_COMPLETE;peer_fixture.complete=true;peer_fixture.incoming_new=false;
    peer_fixture.complete_count++;refresh_state();
    CHECK(!lv_obj_has_flag(gift_popup,LV_OBJ_FLAG_HIDDEN));CHECK(!ui_drag.active);
}
static void close_test_gift(void)
{
    touch(162,340,70);CHECK(!lv_obj_has_flag(gift_popup,LV_OBJ_FLAG_HIDDEN));
    touch(163,340,70);CHECK(lv_obj_has_flag(gift_popup,LV_OBJ_FLAG_HIDDEN));advance(280);
}
static void modal_and_route_checks(void)
{
    unsigned start=assertions,saved=mock_pet_calls;toast_active=false;hide(toast,true);
    begin_care(L2_ACTION_SLEEP);advance(280);show_test_gift();touch(233,323,1650);
    CHECK(current_page==PAGE_CARE_ACTION);CHECK(mock_pet_calls==saved);CHECK(!care_steps);close_test_gift();
    /* A modal arriving during a previously held moon consumes its later release. */
    point(233,323,LV_INDEV_STATE_PRESSED);advance(700);show_test_gift();advance(1000);point(233,323,LV_INDEV_STATE_RELEASED);advance(80);
    CHECK(mock_pet_calls==saved);CHECK(current_page==PAGE_CARE_ACTION);CHECK(!contact_cancelled);close_test_gift();
    begin_care(L2_ACTION_PLAY);advance(280);show_test_gift();
    for(unsigned i=0;i<6;i++){stroke(160,250,330,250,40);advance(720);}
    CHECK(care_steps==0);CHECK(mock_pet_calls==saved);CHECK(current_page==PAGE_CARE_ACTION);close_test_gift();
    /* Overlay arrival during an active drag and during a committed animation. */
    select_page(PAGE_HOME);face=0;update_face();point(233,300,LV_INDEV_STATE_PRESSED);advance(40);point(233,220,LV_INDEV_STATE_PRESSED);CHECK(ui_drag.active);
    show_test_gift();CHECK(lv_obj_get_y(pages[PAGE_HOME])==0);point(233,220,LV_INDEV_STATE_RELEASED);advance(300);CHECK(current_page==PAGE_HOME);CHECK(mock_pet_calls==saved);close_test_gift();
    stroke(320,233,180,233,200);CHECK(ui_drag.settling);show_test_gift();advance(300);CHECK(face==0);CHECK(current_page==PAGE_HOME);CHECK(mock_pet_calls==saved);
    stroke(233,330,233,170,200);advance(300);CHECK(current_page==PAGE_HOME);CHECK(!ui_drag.active);CHECK(face==0);close_test_gift();
    /* Toast's full rectangle has a six-pixel gap above the guide cat disk.
     * Full-screen gesture domains exclude the toast area at actual contact entry. */
    select_page(PAGE_GUIDE);guide_index=0;update_guide();announce("引导未存请重试");
    CHECK(84<ui_target(HIT_GUIDE).cy-ui_target(HIT_GUIDE).w);CHECK(!target_hit(HIT_GUIDE,233,80));
    saved=mock_pet_calls;touch(233,64,700);CHECK(guide_index==0);CHECK(!guide_pass_until);CHECK(mock_pet_calls==saved);advance(1900);
    select_page(PAGE_HOME);announce("手机状态已同步");point(233,64,LV_INDEV_STATE_PRESSED);advance(100);point(233,264,LV_INDEV_STATE_PRESSED);advance(50);point(233,264,LV_INDEV_STATE_RELEASED);advance(260);CHECK(current_page==PAGE_HOME);CHECK(!ui_drag.active);CHECK(mock_pet_calls==saved);advance(1900);
    /* All care buttons use their exact circle boundary. */
    const ui_hit_id_t ids[]={HIT_FEED,HIT_WATER,HIT_PLAY,HIT_SLEEP};const l2_action_t actions[]={L2_ACTION_FEED,L2_ACTION_WATER,L2_ACTION_PLAY,L2_ACTION_SLEEP};
    for(unsigned i=0;i<4;i++){select_page(PAGE_CARE);ui_hit_target_t t=ui_target(ids[i]);touch(t.cx+t.w+1,t.cy,70);CHECK(current_page==PAGE_CARE);touch(t.cx+t.w,t.cy,70);advance(280);CHECK(current_page==PAGE_CARE_ACTION);CHECK(care_action==actions[i]);CHECK(mock_pet_calls==saved);}
    select_page(PAGE_STATUS);touch(258,414,70);CHECK(current_page==PAGE_STATUS);touch(257,414,70);advance(280);CHECK(current_page==PAGE_SETTINGS);
    unsigned level=brightness;touch(77,102,70);CHECK(brightness==level);touch(78,102,70);CHECK(brightness!=level);
    bool aod=aod_enabled;touch(78,258,70);CHECK(aod_enabled!=aod);aod_enabled=true;
    touch(78,154,70);CHECK(toast_active);CHECK(current_page==PAGE_SETTINGS);advance(1900);
    peer_fixture=(l2_peer_view_t){0};refresh_state();touch(78,206,70);advance(280);CHECK(current_page==PAGE_MEET);CHECK(peer_fixture.discoverable);
    peer_fixture.phase=L2P_CONFIRM;peer_fixture.local_confirmed=false;memset(&peer_fixture.confirm_token,0,sizeof(peer_fixture.confirm_token));peer_fixture.confirm_token.valid=true;peer_fixture.confirm_token.link_generation=1;peer_fixture.confirm_token.connection_handle=7;strcpy(peer_fixture.confirm_token.peer_id,"22222222222222222222222222222222");peer_fixture.confirm_token.local_counter=1;peer_fixture.confirm_token.remote_counter=2;peer_fixture.confirm_token.fingerprint[0]=1;refresh_state();touch(123,308,70);CHECK(peer_fixture.local_confirmed);CHECK(!peer_fixture.remote_confirmed);CHECK(!peer_fixture.complete);CHECK(mock_pet_calls==saved);
    /* Shown intent is captured at press-down; a new rendered peer or link cannot inherit it. */
    peer_fixture.local_confirmed=false;refresh_state();point(123,308,LV_INDEV_STATE_PRESSED);advance(70);
    strcpy(peer_fixture.confirm_token.peer_id,"33333333333333333333333333333333");peer_fixture.confirm_token.link_generation++;refresh_state();
    point(123,308,LV_INDEV_STATE_RELEASED);advance(70);CHECK(!peer_fixture.local_confirmed);
    point(123,308,LV_INDEV_STATE_PRESSED);advance(70);peer_fixture.confirm_token.link_generation++;refresh_state();
    point(123,308,LV_INDEV_STATE_RELEASED);advance(70);CHECK(!peer_fixture.local_confirmed);
    touch(123,308,70);CHECK(peer_fixture.local_confirmed);
    touch(237,374,70);advance(280);CHECK(current_page==PAGE_SETTINGS);CHECK(peer_fixture.discoverable);
    touch(117,374,70);advance(280);CHECK(current_page==PAGE_DEVICE);
    touch(123,272,70);CHECK(toast_active);CHECK(mock_bond_calls==0);advance(1900);
    touch(117,328,70);CHECK(toast_active);CHECK(mock_pet_calls==saved);advance(1900);
    touch(237,328,70);advance(280);CHECK(current_page==PAGE_GUIDE);CHECK(guide_review);touch(233,411,70);advance(280);
    select_page(PAGE_DEVICE);touch(168,387,70);advance(280);CHECK(current_page==PAGE_SETTINGS);
    touch(237,374,70);advance(280);CHECK(current_page==PAGE_GUIDE);touch(233,411,70);advance(280);
    /* Actual 3s version hold then all five rectangle corner contacts. */
    select_page(PAGE_SETTINGS);touch(98,322,3050);advance(280);CHECK(current_page==PAGE_TOUCH);CHECK(touch_mask==0);
    for(unsigned i=0;i<5;i++){ui_hit_target_t t=ui_target((ui_hit_id_t)(HIT_TOUCH0+i));touch(t.cx-t.w/2,t.cy-t.h/2,70);CHECK(touch_mask&(1u<<i));}
    advance(1100);CHECK(current_page==PAGE_SETTINGS);CHECK(mock_pet_calls==saved);advance(1900);
    select_page(PAGE_VOICE);touch(20,233,70);CHECK(current_page==PAGE_VOICE);touch(21,233,70);advance(280);CHECK(current_page==PAGE_HOME);
    /* Pet circle edge vs adjacent outside pixel, without authoritative stat changes. */
    face=0;update_face();pet_cooldown=false;touch(344,262,70);CHECK(mock_pet_calls==saved);touch(343,262,70);CHECK(mock_pet_calls==saved+1);CHECK(last_emitted==L2_ACTION_PET);CHECK(domain_fixture.snapshot.pet.food==70);advance(2100);saved=mock_pet_calls;
    domain_fixture.snapshot.pet.food=20;refresh_state();face=0;update_face();touch(233,108,70);advance(280);CHECK(current_page==PAGE_CARE);CHECK(mock_pet_calls==saved);
    domain_fixture.snapshot.pet.food=70;refresh_state();select_page(PAGE_HOME);face=1;update_face();touch(233,108,70);CHECK(current_page==PAGE_HOME);CHECK(mock_pet_calls==saved);
    /* Every production toast literal must remain fully visible, not ellipsized
     * or silently clipped. Measure with the actual selected LVGL font/style. */
    select_page(PAGE_GUIDE);guide_index=0;update_guide();
    CHECK(sizeof(toast_messages)/sizeof(toast_messages[0])>=20);
    for(unsigned i=0;i<sizeof(toast_messages)/sizeof(toast_messages[0]);i++){
        announce(toast_messages[i]);lv_obj_update_layout(toast);lv_point_t extent;
        lv_text_get_size(&extent,toast_messages[i],lv_obj_get_style_text_font(toast,0),lv_obj_get_style_text_letter_space(toast,0),lv_obj_get_style_text_line_space(toast,0),LV_COORD_MAX,LV_TEXT_FLAG_NONE);
        CHECK(lv_label_get_long_mode(toast)!=LV_LABEL_LONG_MODE_DOTS);CHECK(!strcmp(lv_label_get_text(toast),toast_messages[i]));
        fprintf(stderr,"Toast extent: %s width=%d/%d height=%d/%d\n",toast_messages[i],(int)extent.x,(int)lv_obj_get_content_width(toast),(int)extent.y,(int)lv_obj_get_content_height(toast));
        CHECK(extent.x<=lv_obj_get_content_width(toast));CHECK(extent.y<=lv_obj_get_content_height(toast));
    }
    toast_active=false;hide(toast,true);
    /* Observe the first completed animation tick rather than inferring time
     * from constants. Host LVGL is advanced at 10 ms resolution. */
    select_page(PAGE_HOME);face=0;update_face();stroke(233,300,233,260,120);
    uint32_t started=lv_tick_get();while(ui_drag.active&&lv_tick_get()-started<300)advance(10);
    measured_rebound_ms=lv_tick_get()-started;CHECK(measured_rebound_ms>=180);CHECK(measured_rebound_ms<=200);CHECK(current_page==PAGE_HOME);
    stroke(233,350,233,210,800);started=lv_tick_get();while(ui_drag.active&&lv_tick_get()-started<300)advance(10);
    measured_commit_ms=lv_tick_get()-started;CHECK(measured_commit_ms>=200);CHECK(measured_commit_ms<=220);CHECK(current_page==PAGE_CARE);CHECK(mock_pet_calls==saved);
    fprintf(stderr,"Observed settle: rebound %u ms (nominal 180), commit %u ms (nominal 200); host LVGL ticks 10 ms\n",measured_rebound_ms,measured_commit_ms);
    fprintf(stderr,"V3 modal/routes assertions passed: %u; total %u (actual LVGL pointer; memory-only fixtures)\n",assertions-start,assertions);
}

static void guide_demo_checks(void)
{
    select_page(PAGE_GUIDE);guide_index=3;update_guide();advance(80);lv_obj_update_layout(stage_root);
    int last=lv_obj_get_x(guide_icon),largest=0;unsigned before=mock_pet_calls;
    /* Two full cycles sampled through the actual UI timer, including 1600 and
     * 2400 ms seams. A 40 ms sample moves at most 5 px at135px/1200ms. */
    for(unsigned t=0;t<4800;t+=40){advance(40);lv_obj_update_layout(stage_root);int x=lv_obj_get_x(guide_icon),delta=abs(x-last);if(delta>largest)largest=delta;CHECK(x>=157&&x<=292);CHECK(delta<=5);last=x;}
    CHECK(mock_pet_calls==before);CHECK(guide_index==3);CHECK(!guide_pass_until);
    fprintf(stderr,"V3 guide LR demo: %u assertions passed; largest step %dpx/40ms, two2400ms cycles; actual C/LVGL timers\\n",assertions,largest);
}

#include "font_codepoints.h"
#include "badge_display_capture.h"
static void same_size_font_checks(void)
{
    const lv_font_t *fonts[]={&local2_font16,&local2_font20,&local2_font24};
    for(unsigned f=0;f<3;f++)for(unsigned i=0;i<sizeof(known_codepoints)/sizeof(known_codepoints[0]);i++){
        lv_font_glyph_dsc_t d={0};
        CHECK(lv_font_get_glyph_dsc(fonts[f],&d,known_codepoints[i],0));
        CHECK(d.resolved_font==fonts[f]||d.resolved_font==fonts[f]->fallback);
        CHECK(d.resolved_font->line_height==fonts[f]->line_height);
        CHECK(d.resolved_font->base_line==fonts[f]->base_line);
    }
}
static void diagnostic_view_checks(void)
{
    select_page(PAGE_HOME);advance(300);face=0;update_face();advance(300);
    unsigned saved_calls=mock_pet_calls,saved_guide=guide_saved;uint32_t saved_input=last_input;
    CHECK(badge_ui_diagnostic_select_face(1));CHECK(face==1);CHECK(last_input==saved_input);
    CHECK(badge_ui_diagnostic_select_face(2));CHECK(face==2);CHECK(last_input==saved_input);
    CHECK(!badge_ui_diagnostic_select_face(3));CHECK(face==2);
    mode=MODE_AOD;CHECK(!badge_ui_diagnostic_select_face(0));CHECK(face==2);
    mode=MODE_OFF;CHECK(!badge_ui_diagnostic_select_face(0));CHECK(face==2);mode=MODE_PLAY;
    gesture.active=true;CHECK(!badge_ui_diagnostic_select_face(0));CHECK(!badge_ui_capture_allowed());gesture.active=false;
    ui_drag.active=true;CHECK(!badge_ui_diagnostic_select_face(0));CHECK(!badge_ui_capture_allowed());ui_drag.active=false;
    ui_drag.settling=true;CHECK(!badge_ui_diagnostic_select_face(0));CHECK(!badge_ui_capture_allowed());ui_drag.settling=false;
    hide(gift_popup,false);CHECK(!badge_ui_diagnostic_select_face(0));hide(gift_popup,true);
    hide(reset_layer,false);CHECK(!badge_ui_diagnostic_select_face(0));hide(reset_layer,true);
    previous.pairing=true;CHECK(!badge_ui_diagnostic_select_face(0));previous.pairing=false;
    select_page(PAGE_CARE);advance(300);CHECK(!badge_ui_diagnostic_select_face(0));CHECK(current_page==PAGE_CARE);
    select_page(PAGE_HOME);navigation_started=lv_tick_get();CHECK(!badge_ui_diagnostic_select_face(0));advance(300);
    CHECK(badge_ui_diagnostic_select_face(0));CHECK(face==0);CHECK(badge_ui_capture_allowed());
    CHECK(mock_pet_calls==saved_calls);CHECK(guide_saved==saved_guide);advance(300);
}
static void snapshot_checks(void)
{
    size_t cap=LV_DRAW_BUF_SIZE(466,466,LV_COLOR_FORMAT_RGB565);
    uint8_t *bytes=calloc(1,cap);CHECK(bytes!=NULL);lv_draw_buf_t buf;
    CHECK(lv_draw_buf_init(&buf,466,466,LV_COLOR_FORMAT_RGB565,LV_STRIDE_AUTO,bytes,cap)==LV_RESULT_OK);
    CHECK(badge_display_capture_rgb565(host_display,&buf));
    CHECK(buf.header.w==466&&buf.header.h==466&&buf.header.stride==932);
    CHECK(memcmp(buf.data,framebuffer,sizeof(framebuffer))==0);
    free(bytes);
}

static void independent_intent_checks(void) {
 select_page(PAGE_MEET);peer_fixture.phase=L2P_CONFIRM;peer_fixture.discoverable=peer_fixture.connected=true;
 memset(&peer_fixture.confirm_token,0,sizeof(peer_fixture.confirm_token));
 l2_peer_confirm_token_t *t=&peer_fixture.confirm_token;t->valid=true;t->link_generation=1;t->connection_handle=7;
 strcpy(t->peer_id,"22222222222222222222222222222222");t->local_counter=1;t->remote_counter=2;t->fingerprint[0]=1;
 unsigned original_care=mock_pet_calls;
 for(unsigned field=0;field<6;field++) {
   peer_fixture.local_confirmed=false;refresh_state();unsigned n=confirm_calls;
   point(123,308,LV_INDEV_STATE_PRESSED);advance(70);
   if(field==0)t->peer_id[0]='3';
   if(field==1)t->link_generation++;
   if(field==2)t->connection_handle++;
   if(field==3)t->local_counter++;
   if(field==4)t->remote_counter++;
   if(field==5)t->fingerprint[0]++;
   refresh_state();point(123,308,LV_INDEV_STATE_RELEASED);advance(70);
   CHECK(confirm_calls==n);CHECK(!peer_fixture.local_confirmed);CHECK(mock_pet_calls==original_care);
   touch(123,308,70);CHECK(confirm_calls==n+1);CHECK(peer_fixture.local_confirmed);CHECK(!memcmp(&sent_intent,t,sizeof(*t)));CHECK(mock_pet_calls==original_care);
 }
 peer_fixture.local_confirmed=false;refresh_state();unsigned n=confirm_calls;
 point(123,308,LV_INDEV_STATE_PRESSED);advance(70);t->valid=false;refresh_state();
 point(123,308,LV_INDEV_STATE_RELEASED);advance(70);CHECK(confirm_calls==n);CHECK(!peer_fixture.local_confirmed);
}

int main(int argc,char **argv)
{
    if(argc<3){fprintf(stderr,"usage: %s CASE OUTPUT_STEM [CLIP FRAME]\n",argv[0]);return 2;}
    make_fixture(argv[1]);lv_init();lv_tick_inc(1000);
    bool timed=argc>4&&!strcmp(argv[3],"--elapsed-ms");
    bool replay=argc>4&&!strcmp(argv[3],"--peer-trace");
    unsigned elapsed=timed?(unsigned)strtoul(argv[4],NULL,10):(replay&&argc>5?(unsigned)strtoul(argv[5],NULL,10):0);
    if(elapsed>5000){fprintf(stderr,"Host capture time exceeds 5000 ms\n");return 2;}
    if(!badge_ui_start()){fprintf(stderr,"Host UI initialization failed\n");return 1;}choose(argv[1],!timed&&!replay&&argc>3?argv[3]:NULL,!timed&&!replay&&argc>4?atoi(argv[4]):0);
    if(replay)replay_peer_trace(argv[4]);
    same_size_font_checks();
    if(!strcmp(argv[1],"independent_intent"))independent_intent_checks();
    if(!strcmp(argv[1],"input_test")){input_checks();v3_input_checks();modal_and_route_checks();}
    if(!strcmp(argv[1],"guide_demo_test"))guide_demo_checks();
    if(!strcmp(argv[1],"diagnostic_view_test"))diagnostic_view_checks();
    if(elapsed)advance(elapsed);
    lv_obj_invalidate(lv_screen_active());lv_refr_now(host_display);
    char path[4096];snprintf(path,sizeof(path),"%s.rgb565",argv[2]);FILE *f=fopen(path,"wb");assert(f);
    snapshot_checks();
    if(fwrite(framebuffer,2,466*466,f)!=466*466)return 1;fclose(f);
    snprintf(path,sizeof(path),"%s.json",argv[2]);f=fopen(path,"w");assert(f);
    fprintf(f,"{\"offline\":true,\"hardware_capture\":false,\"production_source_included\":\"artifacts/firmware-local-v3-visual038/source/main/badge_pages.c\",\"case\":");quote(f,argv[1]);
    fprintf(f,",\"page_index\":%u,\"face\":%u,\"brightness_stub_percent\":%u,\"mock_pet_calls\":%u,\"mock_bond_calls\":%u,\"input_assertions_passed\":%u,\"capture_elapsed_ms\":%u,\"motion_in_progress\":%s,\"labels\":[",current_page,face,host_brightness,mock_pet_calls,mock_bond_calls,assertions,elapsed,ui_drag.active?"true":"false");
    inspect(f,lv_screen_active(),false);inspect(f,lv_layer_top(),false);
    fprintf(f,"],\"hit_targets\":[");inspect_targets(f);fprintf(f,"],\"visual_controls\":[");inspect_controls(f,lv_screen_active(),false);inspect_controls(f,lv_layer_top(),false);
    fprintf(f,"],\"measured_rebound_ms\":%u,\"measured_commit_ms\":%u,\"missing_glyph_count\":%u,\"animation_bank_available\":%s,\"peer_trace_replay\":%s,\"peer_phase\":%u,\"peer_complete_count\":%llu,\"gift_popup_visible\":%s}\n",measured_rebound_ms,measured_commit_ms,missing_glyphs,badge_scene_has_animation(home_scene)?"true":"false",replay?"true":"false",peer_fixture.phase,(unsigned long long)peer_fixture.complete_count,lv_obj_has_flag(gift_popup,LV_OBJ_FLAG_HIDDEN)?"false":"true");fclose(f);
    return 0;
}
