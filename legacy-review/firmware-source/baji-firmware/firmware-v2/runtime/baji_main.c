#include "baji_controller.h"
#include "baji_render.h"
#include "baji_pmic.h"
#include "baji_ble.h"
#include "baji_data_runtime.h"
#include "baji_asset_runtime.h"
#include "esp_mac.h"
#include "bsp/display.h"
#include "bsp/esp-bsp.h"
#include "esp_timer.h"
#include "nvs_flash.h"
#include <string.h>
static bj_controller_t controller;
static bj_render_t *renderer;
static bj_link_t link;
static bj_power_t power;
static bj_power_view_t power_view;
static bj_data_view_t data_view;
static uint8_t care_type, care_count;
static bool confirm_pressed;
static uint8_t confirm_id[16];
static uint32_t care_last[6],care_generation;
static void reset_care_generation(void) {
    uint32_t current=bj_ble_data_generation();
    if(current!=care_generation) {
        care_generation=current;care_type=care_count=0;confirm_pressed=false;
        memset(care_last,0,sizeof(care_last));
    }
}
static void care_tap(uint8_t type,uint32_t now) {
    if(type<1 || type>5 || now-care_last[type]<(type==1?2000u:4000u)) return;
    if(care_type && care_type!=type) {bj_data_runtime_event(6,care_type,0);care_count=0;}
    care_type=type;care_count++;
    unsigned required=type==2 || type==3?3u:type==4?5u:1u;
    if(care_count>=required) {
        bj_data_runtime_event(type,(uint8_t)(type==2 || type==3?3:type==4?5:0),0);care_last[type]=now;care_type=care_count=0;
    }
}
static uint32_t now_ms(void) {return (uint32_t)(esp_timer_get_time()/1000);}
static void refresh_power(uint32_t now) {
    bj_pmic_snapshot_t snapshot;
    if(bj_pmic_latest(&snapshot)) bj_power_update(&power,&snapshot.sample,now);
    power_view=bj_power_view(&power,now);
    bj_controller_set_suspended(&controller,power_view.mode==BJ_POWER_LOW,now);
    if(!power_view.allow_voice) {
        controller.gesture.hold_allowed=false;
        bj_scene_hold_end(&controller.scene,now,true);
        controller.scene.voice_success_pending=false;
    }
}
static void present(void) {
    reset_care_generation();
    uint32_t now=now_ms();bj_frame_t f=bj_controller_frame(&controller,now);
    if(bj_data_runtime_view(&data_view)) {
        bool current=bj_ble_data_current(data_view.generation);
        data_view.authenticated=data_view.authenticated && current;
        data_view.confirm_pending=data_view.confirm_pending && current;
        data_view.meet_pending=data_view.meet_pending && current;
        controller.scene.authenticated=data_view.authenticated;
        if(data_view.authenticated && controller.scene.screen==BJ_PAIR) bj_scene_owner_verified(&controller.scene);
    }
    if(care_type && (controller.scene.screen!=BJ_CARE || power_view.mode==BJ_POWER_LOW)) {
        bj_data_runtime_event(6,care_type,0);care_type=care_count=0;
    }
    bj_data_runtime_care_visible(controller.scene.screen==BJ_CARE && data_view.authenticated && !data_view.meet_pending && !data_view.confirm_pending && power_view.allow_autonomous);
    bj_render_apply_power(renderer,&f,&power_view,now);
    bj_render_apply_data(renderer,&data_view,&power_view,care_type,care_count);
}
static void input(lv_event_t *e) {
    reset_care_generation();
    lv_indev_t *dev=bsp_display_get_input_dev();if(!dev) return;
    lv_point_t p;lv_indev_get_point(dev,&p);uint32_t now=now_ms();refresh_power(now);
    if(data_view.audio_active && p.y<=65 && p.x>=75 && p.x<=391) {
        if(lv_event_get_code(e)==LV_EVENT_RELEASED) bj_data_runtime_environment_stop();
        confirm_pressed=false;return;
    }
    if(data_view.confirm_pending && bj_ble_data_current(data_view.generation)) {
        lv_event_code_t code=lv_event_get_code(e);
        if(code==LV_EVENT_PRESSED) {confirm_pressed=p.x>=100 && p.x<=366 && p.y>=320 && p.y<=410;memcpy(confirm_id,data_view.challenge_id,16);}
        if(code==LV_EVENT_PRESS_LOST) confirm_pressed=false;
        if(code==LV_EVENT_RELEASED) {
            if(confirm_pressed && p.x>=100 && p.x<=366 && p.y>=320 && p.y<=410) bj_data_runtime_confirm(data_view.generation,confirm_id);
            confirm_pressed=false;
        }
        return;
    }
    if(data_view.meet_pending && bj_ble_data_current(data_view.generation)) {
        if(!power_view.allow_autonomous) {confirm_pressed=false;return;}
        if(data_view.meet_method==2 || data_view.meet_method==3) {
            if(lv_event_get_code(e)==LV_EVENT_RELEASED) {
                static const int points[9][2]={{233,108},{321,145},{358,233},{321,321},{233,358},{145,321},{108,233},{145,145},{233,233}};
                int selected=-1;
                for(int i=0;i<9;i++){int x=p.x-points[i][0],y=p.y-points[i][1];if(x*x+y*y<=30*30){selected=i;break;}}
                if(data_view.meet_method==2 || selected>=0)bj_data_runtime_peer_input(data_view.generation,selected);
            }
            confirm_pressed=false;return;
        }
        lv_event_code_t code=lv_event_get_code(e);
        if(code==LV_EVENT_PRESSED) {confirm_pressed=p.x>=100 && p.x<=366 && p.y>=320 && p.y<=410;memcpy(confirm_id,data_view.meet_id,16);}
        if(code==LV_EVENT_PRESS_LOST) confirm_pressed=false;
        if(code==LV_EVENT_RELEASED) {
            if(confirm_pressed && p.x>=100 && p.x<=366 && p.y>=320 && p.y<=410) bj_data_runtime_meet_confirm(data_view.generation,confirm_id);
            confirm_pressed=false;
        }
        return;
    }
    switch(lv_event_get_code(e)) {
    case LV_EVENT_PRESSED:
        bj_controller_press(&controller,p.x,p.y,now);
        if(!power_view.allow_voice) controller.gesture.hold_allowed=false;
        break;
    case LV_EVENT_PRESSING:
        if(!power_view.allow_voice && controller.gesture.pressed && now-controller.gesture.started>=600 && controller.gesture.max_move_sq<144)
            bj_controller_release(&controller,p.x,p.y,now,true);
        else bj_controller_move(&controller,p.x,p.y,now);
        break;
    case LV_EVENT_RELEASED: {
        bool local=controller.scene.screen==BJ_PAIR && controller.gesture.pressed &&
            p.x>=100 && p.x<=366 && p.y>=338 && p.y<=410 &&
            controller.gesture.max_move_sq<144 && now-controller.gesture.started<=300;
        bj_screen_t before=controller.scene.screen;
        bool tap=controller.gesture.pressed && controller.gesture.max_move_sq<144 && now-controller.gesture.started<=300;
        if(tap && !controller.scene.tutorial_active && power_view.mode!=BJ_POWER_LOW) {
            if(before>=BJ_MAIN_A && before<=BJ_MAIN_C && p.x>=150 && p.x<=335 && p.y>=150 && p.y<=340) care_tap(1,now);
            if(before==BJ_CARE && p.x>=100 && p.x<=366 && p.y>=130 && p.y<340) care_tap((uint8_t)(1+(p.y-130)/42),now);
        }
        bj_controller_release(&controller,p.x,p.y,now,false);
        if(local && controller.gesture.max_move_sq<144) bj_scene_start_local(&controller.scene);
        break;
    }
    case LV_EVENT_PRESS_LOST: bj_controller_release(&controller,p.x,p.y,now,true);break;
    default: return;
    }
    present();
}
static void tick(lv_timer_t *t) {
    (void)t;uint32_t now=now_ms();refresh_power(now);
    if(!power_view.allow_voice && controller.gesture.pressed) {
        controller.gesture.hold_allowed=false;
        if(controller.scene.screen==BJ_VOICE) bj_scene_hold_end(&controller.scene,now,true);
    }
    bj_controller_tick(&controller,now);bj_ble_pump(&link,&controller,&power_view);present();
}
/* Local BLE integration; audio/ASR and cloud ownership are intentionally absent. */
void app_main(void) {
    ESP_ERROR_CHECK(nvs_flash_init());
    bsp_display_cfg_t cfg={.lv_adapter_cfg=ESP_LV_ADAPTER_DEFAULT_CONFIG(),
        .rotation=ESP_LV_ADAPTER_ROTATE_0,.tear_avoid_mode=ESP_LV_ADAPTER_TEAR_AVOID_MODE_NONE,
        .touch_flags={.swap_xy=0,.mirror_x=1,.mirror_y=1}};
    if(!bsp_display_start_with_config(&cfg)) return;
    if(bj_pmic_start()!=ESP_OK) return;
    uint8_t identity[6];ESP_ERROR_CHECK(esp_read_mac(identity,ESP_MAC_BT));
    bj_link_init(&link,identity);
    if(!bj_power_init(&power,2000,BJ_POWER_RECOVER_PERCENT)) return;
    if(bsp_display_lock(1000)!=ESP_OK) return;
    bj_controller_init(&controller);refresh_power(now_ms());
    lv_obj_t *root=lv_screen_active();renderer=bj_render_create(root);
    bj_asset_runtime_bind(bj_render_replace_assets,renderer);
    lv_timer_t *timer=renderer?lv_timer_create(tick,10,NULL):NULL;
    if(!timer) {
        bsp_display_unlock();return;
    }
    lv_obj_add_flag(root,LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(root,input,LV_EVENT_ALL,NULL);
    present();
    bsp_display_unlock();
    ESP_ERROR_CHECK(bj_data_runtime_start(identity));
    ESP_ERROR_CHECK(bj_ble_start());
}
