/* UI geometry and pixel icons from badge_spec v0.3.0 / original Badge V2 HTML.
 * Game state, pairing and durable events remain in their reviewed modules.
 * Unsupported care/voice/day-ring data never becomes simulated game progress. */
#include "badge.h"
#include "badge_gesture.h"
#include "badge_scene.h"
#include "badge_ui_contract.h"
#include "bsp/esp-bsp.h"
#include "bsp/display.h"
#include "esp_log.h"
#include "esp_app_desc.h"
#include "nvs.h"
#include "lvgl.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>

LV_FONT_DECLARE(badge_f16);
LV_FONT_DECLARE(badge_f20);
LV_FONT_DECLARE(badge_f24);
LV_FONT_DECLARE(badge_n40);

typedef enum { PAGE_BOOT, PAGE_PAIR, PAGE_GUIDE, PAGE_HOME, PAGE_CARE,
    PAGE_STATUS, PAGE_SETTINGS, PAGE_DEVICE, PAGE_TOUCH, PAGE_VOICE, PAGE_COUNT } page_t;
typedef enum { MODE_PLAY, MODE_COMP, MODE_AOD, MODE_OFF } ui_mode_t;
typedef enum { ICON_PAW, ICON_TAP, ICON_UP, ICON_DOWN, ICON_HOLD, ICON_LR,
    ICON_BOWL, ICON_WATER, ICON_FEATHER, ICON_MOON, ICON_GEAR, ICON_MIC,
    ICON_BT, ICON_BT_OFF, ICON_COUNT } icon_t;
static const char *const icon_source[ICON_COUNT]={
    /* paw */
    "................"
    "....oo....oo...."
    "...oooo..oooo..."
    "...oooo..oooo..."
    "oo..oo....oo..oo"
    "ooo..........ooo"
    "ooo...oooo...ooo"
    ".o...oooooo...o."
    "....oooooooo...."
    "...oooooooooo..."
    "...oooooooooo..."
    "...oooooooooo..."
    "....oooooooo...."
    ".....oo..oo....."
    "................"
    "................",
    /* hand_tap */
    "................"
    ".....y..y......."
    "......y.y.y....."
    "....y.........y."
    "......ww........"
    ".....wwww......."
    ".....wwww......."
    ".....wwwwww....."
    ".....wwwwwwww..."
    "...wwwwwwwwwww.."
    "...wwwwwwwwwww.."
    "...wwwwwwwwwww.."
    "....wwwwwwwww..."
    ".....wwwwwww...."
    ".....wwwwwww...."
    "................",
    /* swipe_up */
    ".......oo......."
    "......oooo......"
    ".....oooooo....."
    "....oo.oo.oo...."
    ".......oo......."
    ".......oo......."
    "......ww........"
    ".....wwww......."
    ".....wwww......."
    ".....wwwwww....."
    ".....wwwwwwww..."
    "...wwwwwwwwwww.."
    "...wwwwwwwwwww.."
    "....wwwwwwwww..."
    ".....wwwwwww...."
    "................",
    /* swipe_down */
    "......ww........"
    ".....wwww......."
    ".....wwww......."
    ".....wwwwww....."
    ".....wwwwwwww..."
    "...wwwwwwwwwww.."
    "...wwwwwwwwwww.."
    "....wwwwwwwww..."
    ".....wwwwwww...."
    "................"
    ".......oo......."
    ".......oo......."
    "....oo.oo.oo...."
    ".....oooooo....."
    "......oooo......"
    ".......oo.......",
    /* hold */
    "................"
    "....oooooooo...."
    "...o........o..."
    "..o...ww.....o.."
    "..o..wwww....o.."
    "..o..wwww....o.."
    "..o..wwwwww..o.."
    "..o..wwwwwwwwo.."
    "..owwwwwwwwwww.."
    "...wwwwwwwwwww.."
    "...wwwwwwwwwww.."
    "....wwwwwwwww..."
    ".....wwwwwww...."
    ".....wwwwwww...."
    "................"
    "................",
    /* swipe_lr */
    "................"
    "................"
    "..o..........o.."
    ".oo...ww.....oo."
    "oooo.wwww...oooo"
    ".oo..wwww....oo."
    "..o..wwwwww..o.."
    ".....wwwwwwww..."
    "...wwwwwwwwwww.."
    "...wwwwwwwwwww.."
    "...wwwwwwwwwww.."
    "....wwwwwwwww..."
    ".....wwwwwww...."
    ".....wwwwwww...."
    "................"
    "................",
    /* bowl */
    "................"
    "................"
    "................"
    "................"
    "......n..n......"
    "....nnNnnNnn...."
    "...nNnnNnnNnn..."
    ".oooooooooooooo."
    ".OwwwwwwwwwwwwO."
    "..OooooooooooO.."
    "..OoooooooooOO.."
    "...OooooooooO..."
    "....OOOOOOOO...."
    "................"
    "................"
    "................",
    /* water */
    "................"
    ".......b........"
    "......bbb......."
    ".....bbwbb......"
    ".....bwbbb......"
    ".....bbbbb......"
    "......bbb......."
    "................"
    ".gggggggggggggg."
    ".GbbbbbbbbbbbbG."
    "..GbwbbbbbbbbG.."
    "..GbbbbbbbbbbG.."
    "...GbbbbbbbbG..."
    "....GGGGGGGG...."
    "................"
    "................",
    /* feather */
    "...........pp..."
    "..........pppp.."
    ".........ppwppp."
    "........ppwpppp."
    ".......ppwpppp.."
    "......ppwpppp..."
    ".....ppwpppp...."
    ".....pwpppp....."
    "....ppppp......."
    "...n.ppp........"
    "..n............."
    ".n.............."
    "n..............."
    "................"
    "................"
    "................",
    /* moon */
    "................"
    ".....yyyy......."
    "...yyyy.......w."
    "..yyyy.......www"
    "..yyy.........w."
    ".yyyy..........."
    ".yyyy..........."
    ".yyyy......w...."
    ".yyyyy.........."
    ".yyyyy.........y"
    "..yyyyy......yy."
    "..yyyyyyyyyyyy.."
    "...yyyyyyyyyy..."
    ".....yyyyyy....."
    "................"
    "................",
    /* gear */
    "................"
    ".......gg......."
    "...gg..gg..gg..."
    "...ggggggggg...."
    "....gggggggg...."
    "..gggGGGGGggg..."
    "..ggGG...GGgg..."
    "gggggG...Ggggggg"
    "gggggG...Ggggggg"
    "..ggGG...GGgg..."
    "..gggGGGGGggg..."
    "....gggggggg...."
    "...ggggggggg...."
    "...gg..gg..gg..."
    ".......gg......."
    "................",
    /* mic */
    "................"
    "......wwww......"
    ".....wwwwww....."
    ".....wwwwww....."
    ".....wwwwww....."
    ".....wwwwww....."
    "..w..wwwwww..w.."
    "..w..wwwwww..w.."
    "..ww.wwwwww.ww.."
    "...ww.wwww.ww..."
    "....ww....ww...."
    "......wwww......"
    ".......ww......."
    ".......ww......."
    ".....wwwwww....."
    "................",
    /* bt */
    "................"
    ".......kk......."
    ".......kkk......"
    ".......kkkk....."
    "...k...kk.kk...."
    "....k..kk..kk..."
    ".....k.kk.kk...."
    "......kkkkk....."
    "......kkkkk....."
    ".....k.kk.kk...."
    "....k..kk..kk..."
    "...k...kk.kk...."
    ".......kkkk....."
    ".......kkk......"
    ".......kk......."
    "................",
    /* bt_off */
    "................"
    ".......GG......."
    ".......GGG...r.."
    ".......GGGG.r..."
    "...G...GG.Gr...."
    "....G..GG.r.G..."
    ".....G.GGr.G...."
    "......GGrGG....."
    "......GrGGG....."
    ".....GrGG.GG...."
    "....r..GG..GG..."
    "...r...GG.GG...."
    "..r....GGGG....."
    ".......GGG......"
    ".......GG......."
    "................"
};
static LV_ATTRIBUTE_MEM_ALIGN uint8_t icon_pixels[ICON_COUNT][16*16*3];
static lv_image_dsc_t icon_images[ICON_COUNT];
static lv_obj_t *pages[PAGE_COUNT], *toast, *pair_layer, *pair_code, *pair_hint, *reset_layer;
static lv_obj_t *home_clock, *home_link, *home_bt, *home_hint, *home_arcs[5], *day_rings[2], *home_alert;
static lv_obj_t *guide_icon, *guide_title, *guide_sub, *guide_dots[5], *guide_hint;
static lv_obj_t *pair_page_code, *pair_page_hint, *care_coins;
static lv_obj_t *status_values[5], *status_bars[5], *status_heading, *status_coins, *status_sync;
static lv_obj_t *setting_brightness, *setting_aod, *device_link, *device_id, *device_pet, *device_meta, *device_storage;
static lv_obj_t *touch_targets[5], *touch_xy, *touch_result;
static badge_scene_t *home_scene, *care_scene;
static lv_indev_t *touch_indev;
static page_t current_page=PAGE_BOOT;
static ui_mode_t mode=MODE_PLAY;
static badge_view_t previous;
static badge_gesture_t gesture;
static bool has_previous, dirty=true, held_action, ignore_contact, guide_done, guide_review;
static bool aod_enabled=true, toast_active;
static uint8_t brightness=75; /* Original BRIGHT[1]: medium. */
static unsigned face, guide_index, touch_mask;
static uint32_t boot_started, last_input, navigation_started, toast_started, touch_completed;
static uint32_t last_state_poll, last_scene_tick, last_pet_at;
static bool pet_cooldown;
static const uint32_t stat_colors[]={ZIP_UI_COLOR_FOOD,ZIP_UI_COLOR_MOOD,ZIP_UI_COLOR_CLEAN,ZIP_UI_COLOR_ENERGY,ZIP_UI_COLOR_HEALTH};
static const char *stat_names[]={"饱腹","心情","清洁","精力","健康"};
static const int target_x[]={113,353,353,113,233}, target_y[]={113,113,353,353,233};
static const char *guide_titles[]={"轻点小猫","向上滑","向下滑","按住屏幕","左右滑"};
/* The original promises are qualified where v1 has no corresponding event. */
static const char *guide_subs[]={"摸摸会保存，连手机后确认", "打开照料轮盘，当前请用手机照料", "查看真实状态与同步进度", "语音尚未启用，不会录音", "切换表盘，生活环待手机数据"};
static const icon_t guide_icons[]={ICON_TAP,ICON_UP,ICON_DOWN,ICON_HOLD,ICON_LR};

static void navigate(page_t page);
static void refresh_state(void);
static bool transitioning(void) { return lv_tick_elaps(navigation_started)<ZIP_UI_TRANSITIONMS; }
static bool circle(int x,int y,int cx,int cy,int r) { int dx=x-cx,dy=y-cy; return dx*dx+dy*dy<=r*r; }
static bool box(int x,int y,int cx,int cy,int w,int h) { return x>=cx-w/2 && x<=cx+w/2 && y>=cy-h/2 && y<=cy+h/2; }
static void hide(lv_obj_t *o,bool value) { if(value) lv_obj_add_flag(o,LV_OBJ_FLAG_HIDDEN); else lv_obj_remove_flag(o,LV_OBJ_FLAG_HIDDEN); }
static lv_obj_t *shape(lv_obj_t *parent,int x,int y,int w,int h,uint32_t color,int radius)
{
    lv_obj_t *o=lv_obj_create(parent); lv_obj_remove_style_all(o);
    lv_obj_set_pos(o,x,y); lv_obj_set_size(o,w,h); lv_obj_set_style_bg_color(o,lv_color_hex(color),0);
    lv_obj_set_style_bg_opa(o,LV_OPA_COVER,0); lv_obj_set_style_radius(o,radius,0);
    lv_obj_remove_flag(o,LV_OBJ_FLAG_CLICKABLE|LV_OBJ_FLAG_SCROLLABLE); return o;
}
static lv_obj_t *label(lv_obj_t *parent,int cx,int cy,int width,const char *text,bool small,uint32_t color)
{
    lv_obj_t *o=lv_label_create(parent); lv_obj_set_width(o,width);
    lv_obj_set_style_text_font(o,small ? &badge_f16 : &badge_f20,0);
    lv_obj_set_style_text_color(o,lv_color_hex(color),0); lv_obj_set_style_text_align(o,LV_TEXT_ALIGN_CENTER,0);
    lv_label_set_text(o,text); lv_obj_update_layout(o); lv_obj_set_pos(o,cx-width/2,cy-lv_obj_get_height(o)/2);
    lv_obj_remove_flag(o,LV_OBJ_FLAG_CLICKABLE); return o;
}
static void set_label(lv_obj_t *o,const char *text,int cy)
{
    lv_label_set_text(o,text); lv_obj_update_layout(o); lv_obj_set_y(o,cy-lv_obj_get_height(o)/2);
}
static lv_obj_t *title(lv_obj_t *parent,int cy,int width,const char *text)
{
    lv_obj_t *o=label(parent,233,cy,width,text,false,ZIP_UI_COLOR_TEXT);
    lv_obj_set_style_text_font(o,&badge_f24,0); set_label(o,text,cy); return o;
}
static lv_obj_t *pill(lv_obj_t *parent,const char *text,int cx,int cy,int w,int h)
{
    lv_obj_t *o=shape(parent,cx-w/2,cy-h/2,w,h,ZIP_UI_COLOR_CARD,14);
    label(o,w/2,h/2,w-8,text,true,ZIP_UI_COLOR_TEXT); return o;
}
static uint32_t icon_color(char c)
{
    switch(c) {
    case 'o':return 0xF0A35E;case 'O':return 0xC9773A;case 'y':return 0xF6C85F;case 'Y':return 0xC9962E;
    case 'w':return 0xFFF4E0;case 'g':return 0xB9A88F;case 'G':return 0x6E6253;case 'b':return 0x8FC7E0;case 'B':return 0x4F8DB8;
    case 'p':return 0xF29AA8;case 'P':return 0xD86A80;case 'r':return 0xFF6B6B;case 'R':return 0xB84444;case 'l':return 0xA8D88E;
    case 'L':return 0x5E9A50;case 'n':return 0x9A6B43;case 'N':return 0x6B4A2E;case 'k':return 0x7FB6FF;case 'K':return 0x3F73C0;case 'v':return 0xB7A6E8;
    default:return 0;
    }
}
static void init_icons(void)
{
    for(unsigned n=0;n<ICON_COUNT;n++) {
        for(unsigned i=0;i<256;i++) {
            uint32_t rgb=icon_color(icon_source[n][i]); uint16_t p=(uint16_t)(((rgb>>19)<<11)|(((rgb>>10)&63)<<5)|((rgb>>3)&31));
            icon_pixels[n][2*i]=(uint8_t)p; icon_pixels[n][2*i+1]=(uint8_t)(p>>8);
            icon_pixels[n][512+i]=icon_source[n][i]=='.' ? 0 : 255;
        }
        icon_images[n]=(lv_image_dsc_t){.header={.magic=LV_IMAGE_HEADER_MAGIC,.cf=LV_COLOR_FORMAT_RGB565A8,.w=16,.h=16,.stride=32},.data_size=768,.data=icon_pixels[n]};
    }
}
static lv_obj_t *icon(lv_obj_t *parent,icon_t id,int cx,int cy,int scale)
{
    lv_obj_t *o=lv_image_create(parent); lv_image_set_src(o,&icon_images[id]);
    lv_obj_set_pos(o,cx-8,cy-8); lv_image_set_scale(o,(uint32_t)(256*scale));
    lv_obj_remove_flag(o,LV_OBJ_FLAG_CLICKABLE); return o;
}
static void announce(const char *text)
{
    set_label(toast,text,380); toast_started=lv_tick_get(); toast_active=true; hide(toast,false);
}
static void update_guide(void)
{
    lv_image_set_src(guide_icon,&icon_images[guide_icons[guide_index]]);
    set_label(guide_title,guide_titles[guide_index],280); set_label(guide_sub,guide_subs[guide_index],320);
    for(unsigned i=0;i<5;i++) lv_obj_set_style_bg_color(guide_dots[i],lv_color_hex(i==guide_index ? ZIP_UI_COLOR_ACCENT : ZIP_UI_COLOR_LINE),0);
    set_label(guide_hint,guide_index==4 ? "轻点进入小屋" : "轻点继续",400);
}
static void load_preferences(void)
{
    nvs_handle_t handle; uint8_t value=0;
    if(nvs_open("badge_ui",NVS_READONLY,&handle)==ESP_OK) {
        if(nvs_get_u8(handle,"guide_v1",&value)==ESP_OK) guide_done=value==1;
        nvs_close(handle);
    }
}
static bool save_guide(void)
{
    if(guide_done) return true;
    nvs_handle_t handle; esp_err_t result=nvs_open("badge_ui",NVS_READWRITE,&handle);
    if(result==ESP_OK) { result=nvs_set_u8(handle,"guide_v1",1); if(result==ESP_OK) result=nvs_commit(handle); nvs_close(handle); }
    if(result!=ESP_OK) { announce("引导记录未保存，请再试一次"); return false; }
    guide_done=true; return true;
}
static void update_face(void)
{
    badge_scene_set_face(home_scene,face);
    set_label(home_clock,"--:--",face ? 398 : 70);
    set_label(home_link,"--%",face ? 60 : 112);
    lv_obj_set_pos(home_bt,188,(face ? 60 : 112)-8);
    for(unsigned i=0;i<5;i++) hide(home_arcs[i],face!=0);
    for(unsigned i=0;i<2;i++) hide(day_rings[i],face==0);
    lv_obj_set_y(home_alert,face ? 108 : 116);
    set_label(home_hint,face==1 ? "生活时间环待手机同步" : face==2 ? "心动记录待手机同步" : "",face ? 352 : 390);
}
static void navigate(page_t page)
{
    if(page>=PAGE_COUNT || page==current_page) return;
    gesture.active=false; ignore_contact=true; held_action=false;
    hide(reset_layer,true);
    current_page=page; navigation_started=last_input=lv_tick_get(); dirty=true;
    if(page==PAGE_GUIDE) { guide_index=0; update_guide(); }
    if(page==PAGE_TOUCH) {
        touch_mask=0; touch_completed=0; set_label(touch_xy,"x --   y --",176);
        set_label(touch_result,"点五个靶点，核对实物方向",292);
        for(unsigned i=0;i<5;i++) lv_obj_set_style_bg_color(touch_targets[i],lv_color_hex(ZIP_UI_COLOR_CARD),0);
    }
    if(page==PAGE_HOME) update_face();
    lv_screen_load_anim(pages[page],LV_SCR_LOAD_ANIM_FADE_IN,ZIP_UI_TRANSITIONMS,0,false);
}
static void update_pairing(const badge_view_t *v)
{
    bool show=v->pairing;
    hide(pair_layer,!show);
    if(show) {
        char code[16]; snprintf(code,sizeof(code),"%06lu",(unsigned long)v->passkey);
        hide(reset_layer,true);
        set_label(pair_code,code,212); set_label(pair_hint,"请在手机系统配对窗口输入\n验证码只用于本次安全配对",282);
        lv_obj_set_style_text_font(pair_page_code,&badge_n40,0);
        set_label(pair_page_code,code,212);
    } else { lv_obj_set_style_text_font(pair_page_code,&badge_f20,0); set_label(pair_page_code,"------",212); }
    set_label(pair_page_hint,v->storage_error ? "存档错误，请保留设备" : v->secure ? "安全连接已建立\n等待手机发送宠物状态" : "打开手机 App 添加吧唧\n连接后显示本次验证码",282);
}
static void manage_pairing(void)
{
    hide(reset_layer,false); ignore_contact=true;
}
static void show_point(lv_point_t p)
{
    char text[48]; snprintf(text,sizeof(text),"x %d   y %d",zip_ui_clamp(p.x),zip_ui_clamp(p.y)); set_label(touch_xy,text,176);
}
static void pet(void)
{
    if(!previous.bound) { announce("请先用手机同步猫咪"); return; }
    if(previous.storage_error) { announce("存档不可用，未保存这次摸摸"); return; }
    uint32_t now=lv_tick_get();
    if(pet_cooldown && now-last_pet_at<2000) { announce("慢慢来，小猫还在回应你"); return; }
    esp_err_t result=badge_pet();
    if(result==ESP_OK) {
        last_pet_at=now; pet_cooldown=true; badge_scene_play(home_scene,BADGE_SCENE_PET,now);
        announce("摸摸已保存，等手机确认");
    } else { badge_view_t v; badge_get_view(&v); announce(v.message[0] ? v.message : "摸摸未保存，请稍后重试"); }
    dirty=true;
}
static void tap(int x,int y)
{
    if(!lv_obj_has_flag(reset_layer,LV_OBJ_FLAG_HIDDEN)) {
        if(box(x,y,158,312,132,44)) hide(reset_layer,true);
        else if(box(x,y,308,312,132,44)) {
            bool ok=badge_ble_clear_bonds(); hide(reset_layer,true);
            announce(ok ? "配对已清除，存档保留" : "清除失败，请稍后重试");
        }
        return;
    }
    switch(current_page) {
    case PAGE_GUIDE:
        if(guide_index<4) { guide_index++; update_guide(); }
        else if(guide_review || save_guide()) { guide_review=false; navigate(previous.bound ? PAGE_HOME : PAGE_PAIR); }
        break;
    case PAGE_PAIR: if(box(x,y,233,380,180,40)) navigate(PAGE_DEVICE); break;
    case PAGE_HOME:
        if(circle(x,y,233,face ? 132 : 140,24) && previous.bound &&
          (previous.snapshot.food<30 || previous.snapshot.mood<30 || previous.snapshot.clean<30 || previous.snapshot.energy<30 || previous.snapshot.health<30)) navigate(PAGE_CARE);
        else if(circle(x,y,233,face ? 245 : 262,110)) pet();
        break;
    case PAGE_CARE:
        if(circle(x,y,105,322,36)||circle(x,y,190,352,36)||circle(x,y,276,352,36)||circle(x,y,361,322,36)) announce("请用手机完成此项照料");
        break;
    case PAGE_STATUS: if(circle(x,y,233,414,24)) navigate(PAGE_SETTINGS); break;
    case PAGE_SETTINGS:
        if(box(x,y,233,126,310,48)) {
            uint8_t next=brightness==45 ? 75 : brightness==75 ? 100 : 45;
            if(bsp_display_brightness_set(next)==ESP_OK) { brightness=next; dirty=true; }
            else announce("亮度设置失败，已保留原设置");
        } else if(box(x,y,233,178,310,48)) announce("语音默认关闭，未启动录音");
        else if(box(x,y,233,230,310,48)) announce("附近发现尚未启用");
        else if(box(x,y,233,282,310,48)) { aod_enabled=!aod_enabled; dirty=true; }
        else if(box(x,y,173,392,112,36)) navigate(PAGE_DEVICE);
        else if(box(x,y,293,392,112,36)) { guide_review=true; navigate(PAGE_GUIDE); }
        break;
    case PAGE_DEVICE:
        if(box(x,y,233,292,220,40)) manage_pairing();
        else if(box(x,y,173,348,112,40)) {
            if(previous.blocked) { esp_err_t e=badge_retry_blocked(); announce(e==ESP_OK ? "原互动已重新排队" : "重试未保存，请稍后再试"); }
            else announce("没有需要重试的互动");
        } else if(box(x,y,293,348,112,40)) { guide_review=true; navigate(PAGE_GUIDE); }
        else if(box(x,y,233,405,130,36)) navigate(previous.bound ? PAGE_SETTINGS : PAGE_PAIR);
        break;
    case PAGE_TOUCH:
        for(unsigned i=0;i<5;i++) if(box(x,y,target_x[i],target_y[i],52,52)) {
            touch_mask|=1u<<i; lv_obj_set_style_bg_color(touch_targets[i],lv_color_hex(ZIP_UI_COLOR_OK),0);
            unsigned count=0; for(unsigned m=touch_mask;m;m>>=1) count+=m&1;
            char t[80]; snprintf(t,sizeof(t),"已命中 %u / 5 · 右滑返回",count); set_label(touch_result,t,292);
            if(touch_mask==31 && !touch_completed) { touch_completed=lv_tick_get(); set_label(touch_result,"五点已命中，方向需目视确认",292); }
            break;
        }
        break;
    case PAGE_VOICE: navigate(PAGE_HOME); break;
    default: break;
    }
}
static void swipe(badge_gesture_kind_t kind)
{
    if(current_page==PAGE_HOME) {
        if(kind==BADGE_GESTURE_UP) navigate(PAGE_CARE);
        else if(kind==BADGE_GESTURE_DOWN) navigate(PAGE_STATUS);
        else if(kind==BADGE_GESTURE_LEFT || kind==BADGE_GESTURE_RIGHT) {
            face=(face+(kind==BADGE_GESTURE_LEFT ? 1 : 2))%3; update_face();
            badge_scene_play(home_scene,BADGE_SCENE_WALK,lv_tick_get()); navigation_started=lv_tick_get();
        }
    } else if(current_page==PAGE_CARE && kind==BADGE_GESTURE_DOWN) navigate(PAGE_HOME);
    else if(current_page==PAGE_STATUS && kind==BADGE_GESTURE_UP) navigate(PAGE_HOME);
    else if(current_page==PAGE_SETTINGS && kind==BADGE_GESTURE_RIGHT) navigate(PAGE_STATUS);
    else if(current_page==PAGE_DEVICE && kind==BADGE_GESTURE_RIGHT) navigate(previous.bound ? PAGE_SETTINGS : PAGE_PAIR);
    else if(current_page==PAGE_TOUCH && kind==BADGE_GESTURE_RIGHT) navigate(PAGE_SETTINGS);
    else if(current_page==PAGE_VOICE && (kind==BADGE_GESTURE_DOWN || kind==BADGE_GESTURE_RIGHT)) navigate(PAGE_HOME);
}
static void set_mode(ui_mode_t next)
{
    if(next==mode) return;
    uint8_t target=next==MODE_OFF ? 0 : next==MODE_AOD ? 35 : brightness;
    if(bsp_display_brightness_set(target)!=ESP_OK) { announce("显示省电设置失败"); return; }
    mode=next; badge_scene_set_dimmed(home_scene,mode==MODE_AOD || mode==MODE_OFF);
    bool standby=mode==MODE_AOD || mode==MODE_OFF;
    hide(home_link,standby);
    hide(home_bt,standby);
    if(standby) {
        for(unsigned i=0;i<5;i++) hide(home_arcs[i],true);
        for(unsigned i=0;i<2;i++) hide(day_rings[i],true);
        set_label(home_hint,"轻点唤醒",390);
    } else update_face();
    dirty=true;
}
static void input_event(lv_event_t *event)
{
    lv_event_code_t code=lv_event_get_code(event); lv_point_t point; lv_indev_get_point(touch_indev,&point);
    if(code==LV_EVENT_PRESSED) {
        bool waking=mode==MODE_AOD || mode==MODE_OFF;
        ignore_contact=waking || transitioning() || current_page==PAGE_BOOT || previous.pairing;
        held_action=false; last_input=lv_tick_get(); set_mode(MODE_PLAY);
        badge_gesture_begin(&gesture,point.x,point.y,last_input);
        if(current_page==PAGE_TOUCH) show_point(point);
    } else if(code==LV_EVENT_RELEASED) {
        last_input=lv_tick_get(); badge_gesture_kind_t kind=badge_gesture_end(&gesture,point.x,point.y,last_input);
        if(ignore_contact || held_action || previous.pairing || transitioning()) { ignore_contact=false; return; }
        if(kind==BADGE_GESTURE_TAP) tap(zip_ui_clamp(point.x),zip_ui_clamp(point.y));
        else if(lv_obj_has_flag(reset_layer,LV_OBJ_FLAG_HIDDEN)) swipe(kind);
    } else if(code==LV_EVENT_INDEV_RESET) { gesture.active=false; ignore_contact=true; held_action=false; }
}
static void object_pressing(lv_event_t *event)
{
    (void)event; if(!gesture.active) return;
    lv_point_t point; lv_indev_get_point(touch_indev,&point); badge_gesture_move(&gesture,point.x,point.y); last_input=lv_tick_get();
    if(current_page==PAGE_TOUCH) show_point(point);
}
static lv_obj_t *new_screen(void)
{
    lv_obj_t *s=lv_obj_create(NULL); lv_obj_remove_style_all(s);
    lv_obj_set_style_bg_color(s,lv_color_hex(ZIP_UI_COLOR_BG),0); lv_obj_set_style_bg_opa(s,LV_OPA_COVER,0);
    lv_obj_remove_flag(s,LV_OBJ_FLAG_SCROLLABLE); lv_obj_add_event_cb(s,object_pressing,LV_EVENT_PRESSING,NULL); return s;
}
static void build_boot_pair_guide(void)
{
    icon(pages[PAGE_BOOT],ICON_PAW,233,188,6); label(pages[PAGE_BOOT],233,282,240,"猫咪森活",false,ZIP_UI_COLOR_TEXT);
    label(pages[PAGE_BOOT],233,314,220,"正在醒来…",true,ZIP_UI_COLOR_SUB);
    label(pages[PAGE_PAIR],233,120,260,"打开手机 App 配对",false,ZIP_UI_COLOR_TEXT);
    pair_page_code=label(pages[PAGE_PAIR],233,212,230,"------",false,ZIP_UI_COLOR_ACCENT);
    pair_page_hint=label(pages[PAGE_PAIR],233,282,290,"连接后显示本次验证码",true,ZIP_UI_COLOR_SUB);
    pill(pages[PAGE_PAIR],"配对帮助",233,380,180,40);
    guide_icon=icon(pages[PAGE_GUIDE],ICON_TAP,233,184,6);
    guide_title=title(pages[PAGE_GUIDE],280,300,"");
    guide_sub=label(pages[PAGE_GUIDE],233,320,310,"",true,ZIP_UI_COLOR_SUB);
    for(unsigned i=0;i<5;i++) guide_dots[i]=shape(pages[PAGE_GUIDE],193+18*i,356,8,8,ZIP_UI_COLOR_LINE,LV_RADIUS_CIRCLE);
    guide_hint=label(pages[PAGE_GUIDE],233,400,190,"轻点继续",true,ZIP_UI_COLOR_DIM); update_guide();
}
static lv_obj_t *arc(lv_obj_t *parent,int diameter,int start,int end,int width,uint32_t color)
{
    lv_obj_t *a=lv_arc_create(parent); lv_obj_set_size(a,diameter,diameter); lv_obj_center(a);
    lv_arc_set_rotation(a,0); lv_arc_set_bg_angles(a,start,end); lv_arc_set_range(a,0,100); lv_arc_set_value(a,0);
    lv_obj_set_style_arc_width(a,width,LV_PART_MAIN); lv_obj_set_style_arc_width(a,width,LV_PART_INDICATOR);
    lv_obj_set_style_arc_color(a,lv_color_hex(ZIP_UI_COLOR_LINE),LV_PART_MAIN); lv_obj_set_style_arc_color(a,lv_color_hex(color),LV_PART_INDICATOR);
    lv_obj_remove_style(a,NULL,LV_PART_KNOB); lv_obj_remove_flag(a,LV_OBJ_FLAG_CLICKABLE); return a;
}
static void build_home_care(void)
{
    home_scene=badge_scene_create(pages[PAGE_HOME]);
    for(unsigned i=0;i<5;i++) { home_arcs[i]=arc(pages[PAGE_HOME],436,119-18*i,133-18*i,8,stat_colors[i]); lv_arc_set_mode(home_arcs[i],LV_ARC_MODE_REVERSE); }
    /* Empty tracks are intentional: v1 carries no day segments or heart moments. */
    day_rings[0]=arc(pages[PAGE_HOME],454,0,359,18,ZIP_UI_COLOR_LINE);
    day_rings[1]=arc(pages[PAGE_HOME],406,0,359,6,ZIP_UI_COLOR_LINE);
    home_clock=label(pages[PAGE_HOME],233,70,160,"--:--",false,ZIP_UI_COLOR_TEXT);
    home_bt=icon(pages[PAGE_HOME],ICON_BT_OFF,196,112,1);
    home_link=label(pages[PAGE_HOME],258,112,70,"--%",true,ZIP_UI_COLOR_SUB);
    home_alert=shape(pages[PAGE_HOME],209,116,48,48,ZIP_UI_COLOR_WARN,LV_RADIUS_CIRCLE);
    icon(home_alert,ICON_PAW,24,24,2); hide(home_alert,true);
    home_hint=label(pages[PAGE_HOME],233,390,250,"",true,ZIP_UI_COLOR_SUB);
    care_scene=badge_scene_create(pages[PAGE_CARE]); badge_scene_set_compact(care_scene,true);
    title(pages[PAGE_CARE],56,180,"照料");
    care_coins=label(pages[PAGE_CARE],233,88,260,"",true,ZIP_UI_COLOR_SUB);
    label(pages[PAGE_CARE],233,272,280,"当前请在手机完成照料",true,ZIP_UI_COLOR_SUB);
    const int xs[]={105,190,276,361},ys[]={322,352,352,322};
    const icon_t icons[]={ICON_BOWL,ICON_WATER,ICON_FEATHER,ICON_MOON};
    for(unsigned i=0;i<4;i++) {
        lv_obj_t *b=shape(pages[PAGE_CARE],xs[i]-36,ys[i]-36,72,72,ZIP_UI_COLOR_CARD,LV_RADIUS_CIRCLE);
        lv_obj_t *im=icon(b,icons[i],36,36,3); lv_obj_set_style_opa(im,LV_OPA_40,0);
        /* Keep the original safe circular geometry: labels cannot be wide here. */
        label(pages[PAGE_CARE],xs[i],ys[i]+52,36,i==0 ? "喂食" : i==1 ? "喝水" : i==2 ? "逗猫" : "睡觉",true,ZIP_UI_COLOR_DIM);
    }
    update_face();
}
static void build_status(void)
{
    lv_obj_t *s=pages[PAGE_STATUS]; title(s,56,170,"状态");
    status_heading=label(s,233,92,290,"",true,ZIP_UI_COLOR_SUB);
    for(unsigned i=0;i<5;i++) {
        int y=136+36*i; label(s,104,y,64,stat_names[i],false,ZIP_UI_COLOR_TEXT);
        status_bars[i]=lv_bar_create(s); lv_obj_set_pos(status_bars[i],145,y-5); lv_obj_set_size(status_bars[i],180,10);
        lv_bar_set_range(status_bars[i],0,100); lv_bar_set_value(status_bars[i],0,LV_ANIM_OFF);
        lv_obj_set_style_bg_color(status_bars[i],lv_color_hex(ZIP_UI_COLOR_LINE),LV_PART_MAIN);
        lv_obj_set_style_bg_color(status_bars[i],lv_color_hex(stat_colors[i]),LV_PART_INDICATOR); lv_obj_remove_flag(status_bars[i],LV_OBJ_FLAG_CLICKABLE);
        status_values[i]=label(s,355,y,50,"--",false,ZIP_UI_COLOR_TEXT);
    }
    status_coins=label(s,233,322,300,"",false,ZIP_UI_COLOR_COIN);
    status_sync=label(s,233,363,300,"",true,ZIP_UI_COLOR_SUB);
    lv_obj_t *gear=shape(s,209,390,48,48,ZIP_UI_COLOR_CARD,LV_RADIUS_CIRCLE); icon(gear,ICON_GEAR,24,24,2);
}
static void build_settings_device(void)
{
    lv_obj_t *s=pages[PAGE_SETTINGS]; title(s,62,170,"设置");
    const char *names[]={"亮度","语音唤醒","附近可被发现","息屏常显"};
    for(unsigned i=0;i<4;i++) {
        int y=126+52*i; label(s,175,y,180,names[i],false,ZIP_UI_COLOR_TEXT);
        shape(s,90,y+25,286,1,ZIP_UI_COLOR_LINE,0);
    }
    setting_brightness=label(s,349,126,70,"中",false,ZIP_UI_COLOR_ACCENT);
    label(s,349,178,70,"关闭",true,ZIP_UI_COLOR_DIM); label(s,349,230,70,"关闭",true,ZIP_UI_COLOR_DIM);
    setting_aod=label(s,349,282,70,"开启",true,ZIP_UI_COLOR_ACCENT);
    char text[100]; snprintf(text,sizeof(text),"右滑返回 · 固件 %s\n长按此处 3 秒：触摸自检",esp_app_get_description()->version);
    label(s,233,346,270,text,true,ZIP_UI_COLOR_DIM);
    pill(s,"设备与同步",173,392,112,36); pill(s,"重看引导",293,392,112,36);
    s=pages[PAGE_DEVICE]; label(s,233,56,230,"设备与同步",false,ZIP_UI_COLOR_TEXT);
    device_link=label(s,233,92,280,"",true,ZIP_UI_COLOR_BT);
    device_id=label(s,233,124,300,"",true,ZIP_UI_COLOR_SUB);
    device_pet=label(s,233,163,330,"",true,ZIP_UI_COLOR_SUB);
    device_meta=label(s,233,210,310,"",true,ZIP_UI_COLOR_TEXT);
    device_storage=label(s,233,254,310,"",true,ZIP_UI_COLOR_SUB);
    pill(s,"管理手机配对",233,292,220,40); pill(s,"重试互动",173,348,112,40); pill(s,"重看引导",293,348,112,40);
    pill(s,"返回",233,405,130,36);
}
static void build_touch_voice(void)
{
    lv_obj_t *s=pages[PAGE_TOUCH]; title(s,64,180,"触摸自检");
    for(unsigned i=0;i<5;i++) { char t[2]={(char)('1'+i),0}; touch_targets[i]=pill(s,t,target_x[i],target_y[i],52,52); }
    touch_xy=label(s,233,176,260,"x --   y --",true,ZIP_UI_COLOR_SUB);
    touch_result=label(s,233,292,310,"点五个靶点，核对实物方向",true,ZIP_UI_COLOR_SUB);
    label(s,233,410,170,"右滑返回",true,ZIP_UI_COLOR_DIM);
    s=pages[PAGE_VOICE]; icon(s,ICON_MIC,233,176,5);
    label(s,233,266,240,"语音暂未启用",false,ZIP_UI_COLOR_TEXT);
    label(s,233,310,280,"麦克风保持关闭\n当前不会录音或上传声音",true,ZIP_UI_COLOR_SUB);
    label(s,233,384,220,"松手后轻点返回",true,ZIP_UI_COLOR_DIM);
}
static void build_layers(void)
{
    toast=label(lv_layer_top(),233,380,220,"",true,ZIP_UI_COLOR_TEXT);
    lv_obj_set_style_bg_color(toast,lv_color_hex(ZIP_UI_COLOR_CARD),0); lv_obj_set_style_bg_opa(toast,LV_OPA_COVER,0);
    lv_obj_set_style_pad_all(toast,8,0); lv_obj_set_style_radius(toast,16,0);
    lv_obj_set_height(toast,40); lv_label_set_long_mode(toast,LV_LABEL_LONG_MODE_DOTS); hide(toast,true);
    pair_layer=shape(lv_layer_top(),0,0,466,466,ZIP_UI_COLOR_BG,0);
    label(pair_layer,233,120,260,"手机安全配对",false,ZIP_UI_COLOR_TEXT);
    pair_code=label(pair_layer,233,212,230,"------",false,ZIP_UI_COLOR_ACCENT);
    lv_obj_set_style_text_font(pair_code,&badge_n40,0);
    pair_hint=label(pair_layer,233,282,300,"",true,ZIP_UI_COLOR_SUB); hide(pair_layer,true);
    reset_layer=shape(lv_layer_top(),68,108,330,250,ZIP_UI_COLOR_CARD,24);
    label(reset_layer,165,60,300,"清除手机配对记录？",false,ZIP_UI_COLOR_TEXT);
    label(reset_layer,165,113,300,"猫咪存档和待同步互动会保留\n之后需在手机重新配对",true,ZIP_UI_COLOR_SUB);
    pill(reset_layer,"取消",90,204,132,44); pill(reset_layer,"清除配对",240,204,132,44); hide(reset_layer,true);
}
static void refresh_state(void)
{
    badge_view_t v; badge_get_view(&v);
    if(has_previous && v.acknowledged_events!=previous.acknowledged_events) {
        announce("手机已确认摸摸"); badge_scene_play(home_scene,BADGE_SCENE_ATTENTION,lv_tick_get());
    } else if(has_previous && v.snapshots_received!=previous.snapshots_received) {
        announce("最新状态已同步"); badge_scene_play(home_scene,BADGE_SCENE_ATTENTION,lv_tick_get());
    }
    if(current_page!=PAGE_BOOT && v.bound && !previous.bound && has_previous) {
        guide_review=false; navigate(guide_done ? PAGE_HOME : PAGE_GUIDE);
    }
    if(v.pairing && (!has_previous || !previous.pairing)) { ignore_contact=true; gesture.active=false; set_mode(MODE_PLAY); }
    update_pairing(&v);
    if(!dirty && has_previous && memcmp(&previous,&v,sizeof(v))==0) return;
    previous=v; has_previous=true; dirty=false;
    const char *link=v.storage_error ? "存档错误" : v.secure ? (v.subscribed ? "安全连接" : "安全连接 · 待订阅") : v.connected ? "等待安全配对" : "离线陪伴";
    lv_image_set_src(home_bt,&icon_images[v.secure ? ICON_BT : ICON_BT_OFF]);
    bool low=v.bound && (v.snapshot.food<30 || v.snapshot.mood<30 || v.snapshot.clean<30 || v.snapshot.energy<30 || v.snapshot.health<30);
    hide(home_alert,!low || mode==MODE_AOD || mode==MODE_OFF);
    uint8_t stats[]={v.snapshot.food,v.snapshot.mood,v.snapshot.clean,v.snapshot.energy,v.snapshot.health};
    for(unsigned i=0;i<5;i++) {
        lv_bar_set_value(status_bars[i],v.bound ? stats[i] : 0,LV_ANIM_OFF); lv_arc_set_value(home_arcs[i],v.bound ? stats[i] : 0);
        char text[12]; if(v.bound) snprintf(text,sizeof(text),"%u",stats[i]); else strcpy(text,"--"); set_label(status_values[i],text,136+36*i);
    }
    set_label(status_heading,v.bound ? (v.snapshots_received ? "手机确认的最近状态" : "上次手机确认的状态") : "尚未同步宠物",92);
    char text[200];
    if(v.bound) snprintf(text,sizeof(text),"喵币 %llu",(unsigned long long)v.snapshot.coins); else strcpy(text,"喵币 --");
    set_label(status_coins,text,322);
    snprintf(text,sizeof(text),"%s · 待确认 %u\n%s",link,v.pending,v.blocked ? "有拒绝互动，请到设备页处理" : "上滑返回小屋"); set_label(status_sync,text,363);
    if(v.bound) snprintf(text,sizeof(text),"喵币 %llu · 下滑返回",(unsigned long long)v.snapshot.coins); else strcpy(text,"喵币 -- · 下滑返回");
    set_label(care_coins,text,88);
    set_label(device_link,link,92); snprintf(text,sizeof(text),"ID %s",v.device_id); set_label(device_id,text,124);
    snprintf(text,sizeof(text),"PET %s",v.bound ? v.snapshot.pet_id : "--"); set_label(device_pet,text,163);
    if(v.bound) snprintf(text,sizeof(text),"同步版本 %llu\n待确认 %u / 200 · 拒绝 %u",(unsigned long long)v.snapshot.revision,v.pending,v.blocked);
    else snprintf(text,sizeof(text),"同步版本 --\n待确认 %u / 200 · 拒绝 %u",v.pending,v.blocked);
    set_label(device_meta,text,210);
    set_label(device_storage,v.storage_error ? "存档不可用，请保留设备" : v.bound ? "宠物已绑定 · 互动先保存后发送" : "等待首次同步宠物",254);
    set_label(setting_brightness,brightness==45 ? "低" : brightness==75 ? "中" : "高",126);
    set_label(setting_aod,aod_enabled ? "开启" : "关闭",282);
}
static void tick(lv_timer_t *timer)
{
    (void)timer; uint32_t now=lv_tick_get();
    if(gesture.active) {
        lv_point_t point; lv_indev_get_point(touch_indev,&point); badge_gesture_move(&gesture,point.x,point.y);
        if(lv_indev_get_state(touch_indev)==LV_INDEV_STATE_RELEASED) { gesture.active=false; ignore_contact=true; }
        else if(!ignore_contact && !held_action && !previous.pairing && lv_obj_has_flag(reset_layer,LV_OBJ_FLAG_HIDDEN) && !transitioning()) {
            if(current_page==PAGE_HOME && badge_gesture_holding(&gesture,now)) { held_action=true; navigate(PAGE_VOICE); }
            else if(current_page==PAGE_SETTINGS && now-gesture.started_ms>=3000 && gesture.maximum_distance_sq<144 && box(gesture.x,gesture.y,233,346,270,48)) { held_action=true; navigate(PAGE_TOUCH); }
        }
    }
    if(current_page==PAGE_BOOT && now-boot_started>=1500) {
        if(previous.storage_error) navigate(PAGE_DEVICE);
        else if(previous.bound) { guide_review=false; navigate(guide_done ? PAGE_HOME : PAGE_GUIDE); }
        else navigate(PAGE_PAIR);
    }
    if(current_page==PAGE_TOUCH && touch_completed && now-touch_completed>=1000) { touch_completed=0; announce("五点已记录，方向需目视确认"); navigate(PAGE_SETTINGS); }
    if(toast_active && now-toast_started>=1800) { toast_active=false; hide(toast,true); }
    if(current_page==PAGE_HOME && !previous.pairing && lv_obj_has_flag(reset_layer,LV_OBJ_FLAG_HIDDEN)) {
        uint32_t idle=now-last_input;
        set_mode(idle>=40000 ? (aod_enabled ? MODE_AOD : MODE_OFF) : idle>=10000 ? MODE_COMP : MODE_PLAY);
    } else set_mode(MODE_PLAY);
    lv_timer_set_period(timer,(mode==MODE_AOD || mode==MODE_OFF) ? 250 : mode==MODE_COMP ? 83 : 33);
    uint32_t interval=mode==MODE_COMP ? 83 : 33;
    if(now-last_scene_tick>=interval) {
        last_scene_tick=now;
        if(current_page==PAGE_HOME) badge_scene_tick(home_scene,now,mode==MODE_PLAY || mode==MODE_COMP);
        else if(current_page==PAGE_CARE) badge_scene_tick(care_scene,now,true);
    }
    if(now-last_state_poll>=250 || dirty) { last_state_poll=now; refresh_state(); }
}
bool badge_ui_start(void)
{
    lv_display_t *display=bsp_display_start();
    if(!display) { ESP_LOGE("badge_ui","Official BSP display start failed"); return false; }
    if(bsp_display_lock(10000)!=ESP_OK) { ESP_LOGE("badge_ui","LVGL lock timed out"); return false; }
    touch_indev=bsp_display_get_input_dev();
    if(!touch_indev) { bsp_display_unlock(); ESP_LOGE("badge_ui","Official BSP touch unavailable"); return false; }
    init_icons(); load_preferences();
    for(unsigned i=0;i<PAGE_COUNT;i++) pages[i]=new_screen();
    build_boot_pair_guide(); build_home_care(); build_status(); build_settings_device(); build_touch_voice(); build_layers();
    if(!home_scene || !care_scene) { bsp_display_unlock(); ESP_LOGE("badge_ui","Scene allocation failed"); return false; }
    current_page=PAGE_BOOT; boot_started=last_input=navigation_started=lv_tick_get();
    lv_indev_set_long_press_time(touch_indev,ZIP_UI_LONGPRESSMS); lv_indev_add_event_cb(touch_indev,input_event,LV_EVENT_ALL,NULL);
    lv_screen_load(pages[PAGE_BOOT]); bsp_display_brightness_set(brightness); refresh_state(); lv_timer_create(tick,33,NULL);
    ESP_LOGI("badge_ui","Original animation bank: %s",badge_scene_has_animation(home_scene) ? "available" : "RECOVERY FALLBACK ONLY");
    bsp_display_unlock(); return true;
}
