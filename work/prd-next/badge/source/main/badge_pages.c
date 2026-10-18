/* UI geometry and pixel icons from badge_spec v0.3.0 / original Badge V2 HTML.
 * Game state, pairing and durable events remain in their reviewed modules.
 * Unsupported care/voice/day-ring data never becomes simulated game progress. */
#include "badge.h"
#include "badge_gesture.h"
#include "badge_scene.h"
#include "badge_diagnostics.h"
#include "esp_timer.h"
#include "badge_ui_contract.h"
#include "assets/local2_fonts.h"
#include <math.h>
#include "badge_ui_targets.h"
#include "local2_store.h"
#include "local2_day.h"
#include "local2_peer.h"
extern bool local2_clock_now(uint64_t *out_ms);
extern int local2_clock_utc_offset_minutes(void);
#include "bsp/esp-bsp.h"
#include "bsp/display.h"
#include "esp_log.h"
#include "esp_app_desc.h"
#include "nvs.h"
#include "lvgl.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

LV_FONT_DECLARE(badge_f16);
LV_FONT_DECLARE(badge_f20);
LV_FONT_DECLARE(badge_f24);
LV_FONT_DECLARE(badge_n40);

typedef enum { PAGE_BOOT, PAGE_PAIR, PAGE_GUIDE, PAGE_HOME, PAGE_CARE, PAGE_CARE_ACTION,
    PAGE_STATUS, PAGE_SETTINGS, PAGE_DEVICE, PAGE_TOUCH, PAGE_VOICE, PAGE_WELCOME, PAGE_MEET, PAGE_COUNT } page_t;
typedef enum { MODE_PLAY, MODE_COMP, MODE_AOD, MODE_OFF } ui_mode_t;
typedef enum { ICON_PAW, ICON_TAP, ICON_UP, ICON_DOWN, ICON_HOLD, ICON_LR,
    ICON_BOWL, ICON_WATER, ICON_FEATHER, ICON_MOON, ICON_GEAR, ICON_MIC,
    ICON_BT, ICON_BT_OFF, ICON_GIFT, ICON_FLOWER, ICON_SOAP, ICON_HEALTH, ICON_HEART, ICON_COUNT } icon_t;
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
    "................",
    /* gift */
    "................"
    "....rr....rr...."
    "...r..r..r..r..."
    "...r...rr...r..."
    "....rrrrrrrr...."
    ".oooooorroooooo."
    ".oooooorroooooo."
    ".OOOOOOrrOOOOOO."
    "..oooooorroooo.."
    "..oooooorroooo.."
    "..oooooorroooo.."
    "..oooooorroooo.."
    "..oooooorroooo.."
    "..OOOOOOrrOOOO.."
    "................"
    "................",
    /* flower */
    "................"
    "......pp........"
    ".....pppp......."
    "....pp..pp......"
    "....p.yy.p......"
    "....pp..pp......"
    ".....pppp......."
    "......lp...v...."
    "......l...vvv..."
    "...ll.l....v...."
    "....lll....l...."
    "......l..lll...."
    "......l....l...."
    "..LLLLLLLLLLLL.."
    "................"
    "................",
    /* soap */
    "................"
    "..........ww...."
    ".........w..w..."
    "....ww...w..w..."
    "...w..w...ww...."
    "...w..w........."
    "....ww..ww......"
    ".......w..w....."
    ".......w..w....."
    "..bbbbbbwwbbbb.."
    ".bbbbbbbbbbbbbb."
    ".bwwbbbbbbbbbbb."
    ".bbbbbbbbbbbbbb."
    ".BBBBBBBBBBBBBB."
    "................"
    "................",
    /* health */
    "................"
    "................"
    "......rrrr......"
    "......rrrr......"
    "......rrrr......"
    "......rrrr......"
    "..rrrrrrrrrrrr.."
    "..rrrrrrrrrrrr.."
    "..rrrrrrrrrrrr.."
    "..rrrrrrrrrrrr.."
    "......rrrr......"
    "......rrrr......"
    "......rrrr......"
    "......rrrr......"
    "................"
    "................",
    /* heart */
    "................"
    "................"
    "...ppp....ppp..."
    "..ppppp..ppppp.."
    ".pwwppppppppppp."
    ".pwpppppppppppp."
    ".pppppppppppppp."
    ".pppppppppppppp."
    "..pppppppppppp.."
    "...pppppppppp..."
    "....pppppppp...."
    ".....pppppp....."
    "......pppp......"
    ".......pp......."
    "................"
    "................"
};
static LV_ATTRIBUTE_MEM_ALIGN uint8_t icon_pixels[ICON_COUNT][16*16*3];
static lv_image_dsc_t icon_images[ICON_COUNT];
static lv_obj_t *pages[PAGE_COUNT], *toast, *reset_layer;
static lv_obj_t *home_clock, *home_link, *home_bt, *home_hint, *home_arcs[5], *day_rings[2], *home_alert;
static lv_obj_t *guide_icon, *guide_title, *guide_sub, *guide_dots[5], *guide_hint;
static lv_obj_t *pair_page_code, *pair_page_hint, *care_coins;
static lv_obj_t *status_values[5], *status_bars[5], *status_heading, *status_coins, *status_sync;
static lv_obj_t *setting_brightness, *setting_aod, *device_link, *device_id, *device_pet, *device_meta, *device_storage;
static lv_obj_t *touch_targets[5], *touch_xy, *touch_result;
static badge_scene_t *home_scene, *care_scene, *welcome_scene,*care_action_scene;
static lv_obj_t *face_heading,*face_phase,*face_weather,*face_action,*face_gift,*face_c_values[5],*face_c_icons[5];
static lv_obj_t *care_icons[4];
static lv_obj_t *home_action_prop,*gift_popup,*gift_popup_title,*gift_popup_icon,*gift_popup_sub;
static lv_obj_t *setting_discover,*meet_state,*meet_id,*meet_confirm_label;
static lv_obj_t *ring_missing,*ring_marker,*ring_hours[4],*guide_progress,*feedback_ring,*heart_legend;
static badge_scene_t *guide_scene;
static lv_obj_t *stage_root,*peek_root,*peek_rings[2],*peek_arcs[5],*peek_clock,*peek_phase,*peek_missing,*peek_heading,*peek_weather,*peek_action,*peek_marker,*peek_heart,*peek_hours[4];
static badge_scene_t *peek_scene;
typedef struct {bool active,settling,has_target,to_face,commit,bounded_face;int axis,offset;page_t from,target;unsigned face;badge_gesture_kind_t direction;} ui_drag_t;
static ui_drag_t ui_drag;
static bool drag_completing,contact_cancelled;
/* GUI presentation hold only; BLE tasks and persistent core remain independent. */
static bool presentation_contact,presentation_deferred;
static bool decoration_hold;
static bool held_snapshot_seen;
static uint64_t held_snapshot_revision;
static uint32_t held_snapshot_seen_ms,held_snapshot_poll_ms;
static uint32_t guide_pass_until,guide_demo_started,feedback_started;
static unsigned guide_lr_mask;
static bool feedback_active;
static l2_peer_view_t peer,peer_previous;
static bool peer_attached;
static uint32_t welcome_started;
static lv_indev_t *touch_indev;
static page_t current_page=PAGE_BOOT;
static ui_mode_t mode=MODE_PLAY;
static badge_view_t previous;
static l2_view_t domain,domain_previous;
static lv_obj_t *care_result_bubble;
static const char *care_result_text;
static uint32_t care_result_started;
static bool domain_attached,live_context,observed_local;
static l2_day_view_t day_view;
static bool day_scrubbing,day_pending=true;
/* Capture survives object changes/cancel; only a fresh DOWN after UP re-arbitrates. */
static bool day_capture,day_release_seen;
static double day_angle,day_cursor;
static int day_minute;
static bool day_follow_now=true;
static lv_obj_t *day_future_bubble;
static void day_return_now(void);
static void day_refresh(void);
static void day_project(void);
static bool day_begin(lv_point_t);
static void day_move(lv_point_t);
static void day_draw(lv_event_t *);

static bool domain_waiting,gift_popup_new;
static l2_action_t observed_action=L2_ACTION_IDLE;
static uint32_t observed_action_started;
static l2_action_t care_action=L2_ACTION_IDLE;
static unsigned care_steps;
static uint32_t care_started,care_last_step,care_sample_ms;
static lv_point_t care_sample;
static bool care_save_attempted;
static lv_obj_t *care_action_icon,*care_action_title,*care_action_hint,*care_action_count;
static badge_gesture_t gesture;
static bool has_previous, dirty=true, held_action, ignore_contact, guide_done, guide_review;
static bool aod_enabled=true, toast_active,guide_mastered,guide_completed_now;
static lv_obj_t *welcome_title,*welcome_sub;
static uint8_t brightness=75; /* Original BRIGHT[1]: medium. */
static unsigned face, guide_index, touch_mask;
static uint32_t boot_started, last_input, navigation_started, toast_started, touch_completed;
static uint32_t last_state_poll, last_scene_tick, last_pet_at;
static bool pet_cooldown;
static const uint32_t stat_colors[]={ZIP_UI_COLOR_FOOD,ZIP_UI_COLOR_MOOD,ZIP_UI_COLOR_CLEAN,ZIP_UI_COLOR_ENERGY,ZIP_UI_COLOR_HEALTH};
static const char *stat_names[]={"饱腹","心情","清洁","精力","健康"};
static const int target_x[]={113,353,353,113,233}, target_y[]={113,113,353,353,233};
static const char *guide_titles[]={"轻点小猫","向上滑","向下滑","左右滑","按住小猫"};
static const char *guide_subs[]={"试着轻点中间的小猫", "实际向上滑，打开照料", "实际向下滑，查看状态", "向左、向右各滑一次", "轻轻按住小猫 600 毫秒"};


static void navigate(page_t page);
static void refresh_state(void);
static void update_clock(void);
static void object_pressing(lv_event_t *event);
static const char *stage_name(l2_scene_t stage);
static const char *weather_name(l2_weather_t weather);
static void drag_cancel(void);
static void drag_update(void);
static bool drag_release(badge_gesture_kind_t kind);
static void release_transition(badge_gesture_kind_t direction);
static void gift_bob(void *object,int32_t value) {lv_obj_set_style_translate_y(object,value,0);}
static void set_decoration_hold(bool held)
{
    if(held==decoration_hold)return;
    decoration_hold=held;
    /* Page translation is deliberately excluded: only the independent gift
     * decoration pauses. Scene/UI ticks already defer until touch+settle end. */
    lv_anim_t *a=gift_popup_icon?lv_anim_get(gift_popup_icon,gift_bob):NULL;
    if(a){if(held)lv_anim_pause(a);else lv_anim_resume(a);}
}
static bool transitioning(void) { return ui_drag.settling || lv_tick_elaps(navigation_started)<ZIP_UI_TRANSITIONMS; }
static bool circle(int x,int y,int cx,int cy,int r) { int dx=x-cx,dy=y-cy; return dx*dx+dy*dy<=r*r; }
static bool gift_modal(void) {return gift_popup&&!lv_obj_has_flag(gift_popup,LV_OBJ_FLAG_HIDDEN);}
static bool toast_covers(int x,int y) {return toast_active&&x>=143&&x<=323&&y>=44&&y<=84;}
static bool box(int x,int y,int cx,int cy,int w,int h) { return x>=cx-w/2 && x<=cx+w/2 && y>=cy-h/2 && y<=cy+h/2; }
static ui_hit_target_t ui_target(ui_hit_id_t id)
{
    static const ui_hit_target_t targets[HIT_COUNT]={
#define R(n,p,x,y,w,h) {n,p,x,y,w,h,UI_HIT_RECT,false}
#define C(n,p,x,y,r) {n,p,x,y,r,r,UI_HIT_CIRCLE,false}
        C("guide-practice",PAGE_GUIDE,233,200,110),R("skip-guide",PAGE_GUIDE,233,411,140,32),R("connection-help",PAGE_PAIR,233,380,180,40),
        C("home-alert",PAGE_HOME,233,132,24),C("pet-cat",PAGE_HOME,233,262,110),C("home-hold",PAGE_HOME,233,233,212),
        C("feed",PAGE_CARE,105,322,36),C("water",PAGE_CARE,190,352,36),C("play",PAGE_CARE,276,352,36),C("sleep",PAGE_CARE,361,322,36),C("care-action",PAGE_CARE_ACTION,233,323,52),C("status-settings",PAGE_STATUS,233,414,24),
        R("brightness",PAGE_SETTINGS,233,126,310,48),R("voice-off",PAGE_SETTINGS,233,178,310,48),R("nearby-discovery",PAGE_SETTINGS,233,230,310,48),R("aod-setting",PAGE_SETTINGS,233,282,310,48),R("version-hold",PAGE_SETTINGS,233,346,270,48),R("device-sync",PAGE_SETTINGS,173,392,112,36),R("review-guide",PAGE_SETTINGS,293,392,112,36),
        R("sync-help",PAGE_DEVICE,233,292,220,40),R("pending-events",PAGE_DEVICE,173,348,112,40),R("device-guide",PAGE_DEVICE,293,348,112,40),R("device-back",PAGE_DEVICE,233,405,130,36),
        R("touch-0",PAGE_TOUCH,113,113,52,52),R("touch-1",PAGE_TOUCH,353,113,52,52),R("touch-2",PAGE_TOUCH,353,353,52,52),R("touch-3",PAGE_TOUCH,113,353,52,52),R("touch-4",PAGE_TOUCH,233,233,52,52),
        C("voice-explanation-back",PAGE_VOICE,233,233,212),R("welcome-enter",PAGE_WELCOME,233,402,130,36),R("peer-confirm",PAGE_MEET,233,332,220,48),R("peer-close",PAGE_MEET,173,392,112,36),R("peer-back",PAGE_MEET,293,392,112,36),R("gift-close",-1,233,360,140,40),C("aod-first-contact",PAGE_HOME,233,233,212),
        {"legacy-reset-unavailable",-1,0,0,0,0,UI_HIT_UNAVAILABLE,false}
#undef R
#undef C
    };
    ui_hit_target_t t=targets[id];
    bool overlay=gift_popup&&!lv_obj_has_flag(gift_popup,LV_OBJ_FLAG_HIDDEN),sleeping=mode==MODE_AOD||mode==MODE_OFF;
    if(id==HIT_CAT)t.cy=face?245:262;
    if(id==HIT_GUIDE&&guide_index!=0&&guide_index!=4){t.cy=233;t.w=t.h=212;}
    t.enabled=t.shape!=UI_HIT_UNAVAILABLE&&(t.page<0||t.page==(int)current_page)&&!transitioning()&&!ui_drag.active;
    if(id==HIT_WAKE)t.enabled=current_page==PAGE_HOME&&sleeping&&!overlay;
    else t.enabled=t.enabled&&!sleeping&&(!overlay||id==HIT_GIFT_CLOSE);
    if(id==HIT_GIFT_CLOSE)t.enabled=t.enabled&&overlay;
    if(id==HIT_GUIDE)t.enabled=t.enabled&&!guide_pass_until;
    if(id==HIT_HOME_ALERT)t.enabled=t.enabled&&face==0&&previous.bound&&(previous.snapshot.food<30||previous.snapshot.mood<30||previous.snapshot.clean<30||previous.snapshot.energy<30||previous.snapshot.health<30);
    return t;
}
static bool target_hit(ui_hit_id_t id,int x,int y)
{
    ui_hit_target_t t=ui_target(id);return !toast_covers(x,y)&&t.enabled&&(t.shape==UI_HIT_CIRCLE?circle(x,y,t.cx,t.cy,t.w):box(x,y,t.cx,t.cy,t.w,t.h));
}
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
    lv_obj_set_style_text_font(o,small ? &local2_font16 : &local2_font20,0);
    lv_obj_set_style_text_color(o,lv_color_hex(color),0); lv_obj_set_style_text_align(o,LV_TEXT_ALIGN_CENTER,0);
    lv_label_set_text(o,text); lv_obj_update_layout(o); lv_obj_set_pos(o,cx-width/2,cy-lv_obj_get_height(o)/2);
    lv_obj_remove_flag(o,LV_OBJ_FLAG_CLICKABLE); return o;
}
static void set_label(lv_obj_t *o,const char *text,int cy)
{
    /* Equal text needs no allocation/invalidation. Font/cy changes still need
     * layout and centering, so they deliberately remain outside the guard. */
    if(strcmp(lv_label_get_text(o),text)!=0) lv_label_set_text(o,text);
    lv_obj_update_layout(o); lv_obj_set_y(o,cy-lv_obj_get_height(o)/2);
}
static lv_obj_t *title(lv_obj_t *parent,int cy,int width,const char *text)
{
    lv_obj_t *o=label(parent,233,cy,width,text,false,ZIP_UI_COLOR_TEXT);
    lv_obj_set_style_text_font(o,&local2_font24,0); set_label(o,text,cy); return o;
}
static lv_obj_t *pill(lv_obj_t *parent,const char *text,int cx,int cy,int w,int h)
{
    lv_obj_t *o=shape(parent,cx-w/2,cy-h/2,w,h,ZIP_UI_COLOR_CARD,14);
    label(o,w/2,h/2,w-8,text,true,ZIP_UI_COLOR_TEXT);lv_obj_add_flag(o,LV_OBJ_FLAG_USER_1);return o;
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
    set_label(toast,text,64); toast_started=lv_tick_get(); toast_active=true; hide(toast,false);
}
static void care_result(const char *text)
{
    care_result_text=text;care_result_started=lv_tick_get();announce(text);
}
static void feedback(uint32_t color)
{
    if(!feedback_ring)return;
    lv_obj_set_style_arc_color(feedback_ring,lv_color_hex(color),LV_PART_MAIN);
    lv_obj_set_style_opa(feedback_ring,LV_OPA_COVER,0);hide(feedback_ring,false);
    feedback_started=lv_tick_get();feedback_active=true;
}
static void update_guide(void)
{
    guide_pass_until=0;guide_lr_mask=0;guide_demo_started=lv_tick_get();
    lv_image_set_src(guide_icon,&icon_images[ICON_TAP]);
    set_label(guide_title,guide_titles[guide_index],280);set_label(guide_sub,guide_subs[guide_index],318);
    char text[16];snprintf(text,sizeof(text),"%u / 5",guide_index+1);set_label(guide_progress,text,66);
    for(unsigned i=0;i<5;i++)lv_obj_set_style_bg_color(guide_dots[i],lv_color_hex(i==guide_index?ZIP_UI_COLOR_ACCENT:ZIP_UI_COLOR_LINE),0);
    set_label(guide_hint,"跟着手指试一试",375);
}
static void guide_accept(badge_gesture_kind_t kind)
{
    if(guide_pass_until)return;
    bool correct=(guide_index==0&&kind==BADGE_GESTURE_TAP&&target_hit(HIT_GUIDE,gesture.x,gesture.y)) ||
        (guide_index==1&&kind==BADGE_GESTURE_UP) ||(guide_index==2&&kind==BADGE_GESTURE_DOWN) ||
        (guide_index==4&&kind==BADGE_GESTURE_HOLD&&target_hit(HIT_GUIDE,gesture.x,gesture.y));
    if(!target_hit(HIT_GUIDE,gesture.x,gesture.y)){set_label(guide_hint,guide_index==0?"请轻点中间的小猫":guide_index==4?"请按住中间的小猫":"请在圆屏安全区内练习",375);feedback(ZIP_UI_COLOR_WARN);return;}
    if(guide_index==3&&(kind==BADGE_GESTURE_LEFT||kind==BADGE_GESTURE_RIGHT)) {
        guide_lr_mask|=kind==BADGE_GESTURE_LEFT?1:2;correct=guide_lr_mask==3;
        if(!correct){set_label(guide_hint,guide_lr_mask==1?"再试向右滑":"再试向左滑",375);feedback(ZIP_UI_COLOR_ACCENT);return;}
    }
    if(correct){set_label(guide_hint,"做对啦",375);feedback(ZIP_UI_COLOR_OK);guide_pass_until=lv_tick_get()+550;}
    else {set_label(guide_hint,guide_index==4?"请按住小猫，不要移动":"再按上面的提示试一试",375);feedback(ZIP_UI_COLOR_WARN);}
}

static void load_preferences(void)
{
    nvs_handle_t handle; uint8_t value=0;guide_done=false;guide_mastered=false;
    if(nvs_open("badge_ui",NVS_READONLY,&handle)==ESP_OK) {
        if(nvs_get_u8(handle,"guide_v3",&value)==ESP_OK){guide_done=value==1||value==2;guide_mastered=value==1;}
        nvs_close(handle);
    }
}
static bool save_guide(bool skipped)
{
    if(guide_done&&(skipped||guide_mastered))return true;
    nvs_handle_t handle; esp_err_t result=nvs_open("badge_ui",NVS_READWRITE,&handle);
    if(result==ESP_OK) { result=nvs_set_u8(handle,"guide_v3",skipped?2:1); if(result==ESP_OK) result=nvs_commit(handle); nvs_close(handle); }
    if(result!=ESP_OK) { announce("引导未存请重试"); return false; }
    guide_done=true;guide_mastered=!skipped;return true;
}
static void update_face(void)
{
    day_pending=true;
    hide(day_future_bubble,true);
    badge_scene_set_face(home_scene,face);
    lv_obj_set_style_text_font(home_clock,face?&badge_n40:&local2_font20,0);
    set_label(home_clock,face?"  :  ":"需手机校时",face?398:62);
    set_label(home_link,"",415);lv_obj_set_pos(home_bt,188,407);
    for(unsigned i=0;i<5;i++)hide(home_arcs[i],face!=0);
    for(unsigned i=0;i<2;i++){hide(day_rings[i],face!=1||i!=0);lv_obj_set_style_arc_color(day_rings[i],lv_color_hex(0xd4bc94),LV_PART_MAIN);lv_obj_set_style_arc_color(day_rings[i],lv_color_hex(0xab8055),LV_PART_INDICATOR);}
    for(unsigned i=0;i<4;i++)hide(ring_hours[i],!face);
    for(unsigned i=0;i<5;i++){hide(face_c_values[i],true);hide(face_c_icons[i],true);}
    hide(face_heading,false);set_label(face_heading,face==1?"一天进程":"小猫",94);
    hide(heart_legend,true);hide(ring_missing,face!=1);set_label(ring_missing,"一天进程待手机同步",365);
    hide(face_gift,true);hide(home_hint,true);hide(face_weather,false);hide(face_action,face!=0);
    lv_obj_set_y(home_alert,108);hide(face_phase,false);
    set_label(face_phase,"等待手机状态",126);set_label(face_weather,"天气待同步",face?342:363);
    dirty=true;update_clock();
}

static void navigate(page_t page)
{
    if(page>=PAGE_COUNT || page==current_page) return;
    if(current_page==PAGE_HOME&&page!=PAGE_HOME)badge_scene_cancel_prop(home_scene);
    if(!drag_completing)drag_cancel();
    gesture.active=false; ignore_contact=true; held_action=false;
    hide(reset_layer,true);
    current_page=page; navigation_started=last_input=lv_tick_get(); dirty=true;
    if(page==PAGE_GUIDE) { guide_index=0;guide_completed_now=false;update_guide(); }
    if(page==PAGE_TOUCH) {
        touch_mask=0; touch_completed=0; set_label(touch_xy,"x --   y --",176);
        set_label(touch_result,"点五个靶点，核对实物方向",292);
        for(unsigned i=0;i<5;i++) lv_obj_set_style_bg_color(touch_targets[i],lv_color_hex(ZIP_UI_COLOR_CARD),0);
    }
    if(page==PAGE_HOME) update_face();
    if(page==PAGE_WELCOME) { set_label(welcome_title,guide_completed_now?"学会啦":"欢迎回家",64);set_label(welcome_sub,guide_completed_now?"小猫向你打招呼":"随时可在设置中重学",108);welcome_started=lv_tick_get(); badge_scene_play(welcome_scene,BADGE_SCENE_PET,welcome_started); }
    for(unsigned i=0;i<PAGE_COUNT;i++){hide(pages[i],i!=(unsigned)page);lv_obj_set_pos(pages[i],0,0);}
    hide(peek_root,true);lv_obj_move_foreground(pages[page]);
    if(drag_completing)navigation_started=lv_tick_get()-ZIP_UI_TRANSITIONMS;
}
static void update_connection(const badge_view_t *v)
{
    /* CFLOCAL2 is a separate local channel. It does not use legacy system PINs. */
    set_label(pair_page_code,v->storage_error ? "存档不可用" : !v->connected ? "等待手机连接" : v->subscribed ? "等待首次同步" : "手机已连接",212);
    set_label(pair_page_hint,v->storage_error ? "存档错误，请保留设备" : v->connected ? "请在手机 App 发送\n首次猫咪状态" : "打开手机 App 连接吧唧\n发送首次猫咪状态",282);
}
static void manage_pairing(void)
{
    announce("本地同步无云");
}
static void show_point(lv_point_t p)
{
    char text[48]; snprintf(text,sizeof(text),"x %d   y %d",zip_ui_clamp(p.x),zip_ui_clamp(p.y)); set_label(touch_xy,text,176);
}
static const char *action_name(l2_action_t action)
{
    switch(action) {
    case L2_ACTION_PET:return "摸摸";case L2_ACTION_FEED:return "喂食";case L2_ACTION_WATER:return "喝水";
    case L2_ACTION_BATH:return "洗澡";case L2_ACTION_PLAY:return "玩耍";case L2_ACTION_SLEEP:return "休息";
    case L2_ACTION_WALK:return "走路";default:return "陪伴";
    }
}
static bool emit_care(l2_action_t action)
{
    if(!domain.ready || !domain.has_snapshot || domain.storage_error) {announce("存档未就绪未保存");return false;}
    uint64_t epoch=0;(void)local2_clock_now(&epoch);
    l2_status_t result=local2_emit_care(action,epoch);
    if(result!=L2_OK) {announce(result==L2_QUEUE_FULL ? "待同步已满连手机" : "保存失败未完成");return false;}
    observed_local=true;observed_action=action;observed_action_started=lv_tick_get();
    if(face==0){badge_scene_set_context(home_scene,true,domain.snapshot.scene,domain.snapshot.weather,observed_action,live_context);
    badge_scene_play(home_scene,action==L2_ACTION_PLAY ? BADGE_SCENE_WALK : BADGE_SCENE_PET,lv_tick_get());}
    care_result("动作已记录待手机确认");dirty=true;return true;
}
static void pet(void)
{
    uint32_t now=lv_tick_get();
    if(pet_cooldown && now-last_pet_at<2000) {announce("慢慢来小猫在回应");return;}
    if(emit_care(L2_ACTION_PET)) {last_pet_at=now;pet_cooldown=true;}
}
static void begin_care(l2_action_t action)
{
    if(!domain.ready || !domain.has_snapshot || domain.storage_error) {announce("请先用手机同步");return;}
    care_action=action;care_steps=0;care_save_attempted=false;
    care_started=lv_tick_get();care_last_step=care_started-700;
    icon_t id=action==L2_ACTION_FEED ? ICON_BOWL : action==L2_ACTION_WATER ? ICON_WATER : action==L2_ACTION_PLAY ? ICON_FEATHER : ICON_MOON;
    lv_image_set_src(care_action_icon,&icon_images[id]);
    set_label(care_action_title,action_name(action),58);
    set_label(care_action_hint,action==L2_ACTION_PLAY ? "快速划动，陪小猫扑五次" : action==L2_ACTION_SLEEP ? "按住月亮 1.5 秒" : "轻点碗三次，一口一口来",106);
    set_label(care_action_count,action==L2_ACTION_PLAY ? "0 / 5" : action==L2_ACTION_SLEEP ? "松手可取消" : "0 / 3",387);
    navigate(PAGE_CARE_ACTION);
}
static void finish_care(void)
{
    if(emit_care(care_action)) navigate(PAGE_HOME);
    else set_label(care_action_hint,"尚未保存，轻点重试",106);
}
static void care_step(void)
{
    unsigned needed=care_action==L2_ACTION_PLAY ? 5 : 3;
    if(care_steps>=needed) {finish_care();return;}
    uint32_t now=lv_tick_get();if(now-care_last_step<(care_action==L2_ACTION_PLAY ? 700u : 450u))return;
    care_last_step=now;care_steps++;
    badge_scene_play(care_action_scene,care_action==L2_ACTION_PLAY ? BADGE_SCENE_WALK : BADGE_SCENE_PET,now);
    char text[32];snprintf(text,sizeof(text),"%u / %u",care_steps,needed);set_label(care_action_count,text,387);
    if(care_steps>=needed)finish_care();
}
static void tap(int x,int y)
{
    if(!lv_obj_has_flag(gift_popup,LV_OBJ_FLAG_HIDDEN)) {
        if(target_hit(HIT_GIFT_CLOSE,x,y)) {
            if(!gift_popup_new || local2_present_gift_state(L2_GIFT_SHOWN)==L2_OK){hide(gift_popup,true);lv_anim_delete(gift_popup_icon,gift_bob);}
            else announce("展示未存请重试");
        }
        return;
    }
    if(!circle(x,y,233,233,ZIP_UI_SAFE_R))return;
    switch(current_page) {
    case PAGE_GUIDE:
        if(target_hit(HIT_SKIP,x,y)){if(save_guide(true)){guide_completed_now=false;guide_review=false;navigate(previous.bound?PAGE_WELCOME:PAGE_PAIR);}}
        else guide_accept(BADGE_GESTURE_TAP);
        break;
    case PAGE_PAIR: if(target_hit(HIT_CONNECT_HELP,x,y)) navigate(PAGE_DEVICE); break;
    case PAGE_HOME:
        if(face==1){day_return_now();break;}
        if(target_hit(HIT_HOME_ALERT,x,y) && previous.bound &&
          (previous.snapshot.food<30 || previous.snapshot.mood<30 || previous.snapshot.clean<30 || previous.snapshot.energy<30 || previous.snapshot.health<30)) navigate(PAGE_CARE);
        else if(face==0&&target_hit(HIT_CAT,x,y)) pet();
        break;
    case PAGE_CARE:
        if(target_hit(HIT_FEED,x,y))begin_care(L2_ACTION_FEED);
        else if(target_hit(HIT_WATER,x,y))begin_care(L2_ACTION_WATER);
        else if(target_hit(HIT_PLAY,x,y))begin_care(L2_ACTION_PLAY);
        else if(target_hit(HIT_SLEEP,x,y))begin_care(L2_ACTION_SLEEP);
        break;
    case PAGE_CARE_ACTION:
        if(target_hit(HIT_CARE_ACTION,x,y)) {
            if(care_action==L2_ACTION_FEED || care_action==L2_ACTION_WATER)care_step();
            else if(care_action==L2_ACTION_SLEEP)announce("按住月亮1.5秒");
            else if(care_steps>=5)finish_care();
        }
        break;
    case PAGE_STATUS: if(target_hit(HIT_STATUS_GEAR,x,y)) navigate(PAGE_SETTINGS); break;
    case PAGE_SETTINGS:
        if(target_hit(HIT_BRIGHTNESS,x,y)) {
            uint8_t next=brightness==45 ? 75 : brightness==75 ? 100 : 45;
            if(bsp_display_brightness_set(next)==ESP_OK) { brightness=next; dirty=true; }
            else announce("亮度未改请重试");
        } else if(target_hit(HIT_VOICE_SETTING,x,y)) announce("语音关闭未录音");
        else if(target_hit(HIT_DISCOVERY,x,y)) {if(!peer.discoverable)local2_peer_set_discoverable(true);navigate(PAGE_MEET);}
        else if(target_hit(HIT_AOD_SETTING,x,y)) { aod_enabled=!aod_enabled; dirty=true; }
        else if(target_hit(current_page==PAGE_MEET?HIT_MEET_CLOSE:HIT_DEVICE,x,y)) navigate(PAGE_DEVICE);
        else if(target_hit(current_page==PAGE_MEET?HIT_MEET_BACK:HIT_GUIDE_REVIEW,x,y)) { guide_review=true; navigate(PAGE_GUIDE); }
        break;
    case PAGE_DEVICE:
        if(target_hit(HIT_SYNC_HELP,x,y)) manage_pairing();
        else if(target_hit(HIT_PENDING,x,y)) {
            announce(domain.pending_events ? "重连手机后补传" : "没有待同步互动");
        } else if(target_hit(HIT_DEVICE_GUIDE,x,y)) { guide_review=true; navigate(PAGE_GUIDE); }
        else if(target_hit(HIT_DEVICE_BACK,x,y)) navigate(previous.bound ? PAGE_SETTINGS : PAGE_PAIR);
        break;
    case PAGE_TOUCH:
        for(unsigned i=0;i<5;i++) if(target_hit((ui_hit_id_t)(HIT_TOUCH0+i),x,y)) {
            touch_mask|=1u<<i; lv_obj_set_style_bg_color(touch_targets[i],lv_color_hex(ZIP_UI_COLOR_OK),0);
            unsigned count=0; for(unsigned m=touch_mask;m;m>>=1) count+=m&1;
            char t[80]; snprintf(t,sizeof(t),"已命中 %u / 5 · 右滑返回",count); set_label(touch_result,t,292);
            if(touch_mask==31 && !touch_completed) { touch_completed=lv_tick_get(); set_label(touch_result,"五点已命中，方向需目视确认",292); }
            break;
        }
        break;
    case PAGE_VOICE: if(target_hit(HIT_VOICE_BACK,x,y))navigate(PAGE_HOME); break;
    case PAGE_WELCOME: if(target_hit(HIT_WELCOME,x,y))navigate(PAGE_HOME); break;
    case PAGE_MEET:
        if(target_hit(HIT_MEET_CONFIRM,x,y)) {
            if(peer.phase==L2P_CONFIRM && !peer.local_confirmed)local2_peer_confirm();
            else if(peer.phase==L2P_DISABLED) {local2_peer_set_discoverable(true);announce("已请求附近发现");}
            else if(peer.phase==L2P_BLOCKED) {local2_peer_set_discoverable(false);announce("请重开附近发现");navigate(PAGE_SETTINGS);}
            else if(peer.phase==L2P_COMPLETE)navigate(PAGE_HOME);
        }
        else if(target_hit(current_page==PAGE_MEET?HIT_MEET_CLOSE:HIT_DEVICE,x,y)) {local2_peer_set_discoverable(false);navigate(PAGE_SETTINGS);}
        else if(target_hit(current_page==PAGE_MEET?HIT_MEET_BACK:HIT_GUIDE_REVIEW,x,y))navigate(PAGE_SETTINGS);
        break;
    default: break;
    }
}
static void swipe(badge_gesture_kind_t kind)
{
    if(current_page==PAGE_GUIDE){guide_accept(kind);return;}
    page_t before=current_page;unsigned old_face=face;
    if(current_page==PAGE_HOME) {
        if(kind==BADGE_GESTURE_UP) navigate(PAGE_CARE);
        else if(kind==BADGE_GESTURE_DOWN) navigate(PAGE_STATUS);
        else if(kind==BADGE_GESTURE_LEFT || kind==BADGE_GESTURE_RIGHT) {
            face=(face+1)%2; update_face();refresh_state();
            if(face==0)badge_scene_play(home_scene,BADGE_SCENE_WALK,lv_tick_get());
            navigation_started=lv_tick_get();
        }
    } else if(current_page==PAGE_CARE && kind==BADGE_GESTURE_DOWN) navigate(PAGE_HOME);
    else if(current_page==PAGE_CARE_ACTION && kind==BADGE_GESTURE_DOWN && care_action!=L2_ACTION_PLAY) {announce("已取消未保存");navigate(PAGE_CARE);}
    else if(current_page==PAGE_STATUS && kind==BADGE_GESTURE_UP) navigate(PAGE_HOME);
    else if(current_page==PAGE_SETTINGS && kind==BADGE_GESTURE_RIGHT) navigate(PAGE_STATUS);
    else if(current_page==PAGE_DEVICE && kind==BADGE_GESTURE_RIGHT) navigate(previous.bound ? PAGE_SETTINGS : PAGE_PAIR);
    else if(current_page==PAGE_TOUCH && kind==BADGE_GESTURE_RIGHT) navigate(PAGE_SETTINGS);
    else if(current_page==PAGE_VOICE && (kind==BADGE_GESTURE_DOWN || kind==BADGE_GESTURE_RIGHT)) navigate(PAGE_HOME);
    else if(current_page==PAGE_MEET && kind==BADGE_GESTURE_RIGHT)navigate(PAGE_SETTINGS);
    if(current_page!=before||face!=old_face)release_transition(kind);
}
static void set_mode(ui_mode_t next)
{
    if(next==mode) return;
    bool was_standby=mode==MODE_AOD||mode==MODE_OFF;
    uint8_t target=next==MODE_OFF ? 0 : next==MODE_AOD ? 35 : brightness;
    if(bsp_display_brightness_set(target)!=ESP_OK) { announce("省电设置失败"); return; }
    mode=next; badge_scene_set_dimmed(home_scene,mode==MODE_AOD || mode==MODE_OFF);
    bool standby=mode==MODE_AOD || mode==MODE_OFF;
    hide(home_link,standby);
    hide(home_bt,standby);
    if(standby) {
        drag_cancel();hide(day_future_bubble,true);
        for(unsigned i=0;i<5;i++) hide(home_arcs[i],true);
        for(unsigned i=0;i<2;i++) hide(day_rings[i],true);
        set_label(home_hint,"轻点唤醒",face ? 438 : 390);hide(home_hint,false);hide(face_phase,true);hide(face_weather,true);hide(face_action,true);hide(ring_missing,true);hide(heart_legend,true);hide(ring_marker,true);for(unsigned i=0;i<4;i++)hide(ring_hours[i],true);
    } else if(!presentation_contact||was_standby)update_face();
    dirty=true;
}
static void input_event(lv_event_t *event)
{
    lv_event_code_t code=lv_event_get_code(event); lv_point_t point; lv_indev_get_point(touch_indev,&point);
    if(code==LV_EVENT_PRESSED)set_decoration_hold(true);
    if(code==LV_EVENT_PRESSED&&day_capture&&day_release_seen){
        day_capture=false;day_scrubbing=false;day_release_seen=false;
        lv_obj_remove_flag(pages[PAGE_HOME],LV_OBJ_FLAG_PRESS_LOCK);
    }
    if(code==LV_EVENT_PRESSED&&!day_capture&&!contact_cancelled&&day_begin(point)){
        day_capture=true;day_release_seen=false;
        lv_obj_add_flag(pages[PAGE_HOME],LV_OBJ_FLAG_PRESS_LOCK);
        presentation_contact=true;last_input=lv_tick_get();set_mode(MODE_PLAY);
        badge_scene_set_interacting(home_scene,true);gesture.active=false;held_action=false;ignore_contact=true;
    }
    if(day_capture){
        /* Consume object dispatch plus all recognizer/click follow-ups. No
         * radius/direction re-arbitration happens after the initial DOWN. */
        lv_indev_stop_processing(touch_indev);lv_event_stop_bubbling(event);lv_event_stop_processing(event);
        gesture.active=false;held_action=false;ignore_contact=true;
        if(code==LV_EVENT_PRESSING&&day_scrubbing&&!day_release_seen)day_move(point);
        if(code==LV_EVENT_RELEASED){
            if(day_scrubbing&&!day_release_seen)day_move(point);
            day_release_seen=true;day_scrubbing=false;day_pending=true;
            lv_obj_remove_flag(pages[PAGE_HOME],LV_OBJ_FLAG_PRESS_LOCK);
            presentation_contact=false;badge_scene_set_interacting(home_scene,false);last_input=lv_tick_get();
        }else if(code==LV_EVENT_INDEV_RESET||code==LV_EVENT_PRESS_LOST||code==LV_EVENT_CANCEL){
            day_scrubbing=false;day_pending=true;
            day_release_seen=lv_indev_get_state(touch_indev)==LV_INDEV_STATE_RELEASED;
            presentation_contact=!day_release_seen;badge_scene_set_interacting(home_scene,presentation_contact);
        }
        return;
    }
    if(code==LV_EVENT_PRESSED) {
        if(!presentation_contact&&!presentation_deferred)held_snapshot_seen=false;
        presentation_contact=true;badge_scene_set_interacting(home_scene,true);
        if(contact_cancelled||toast_covers(point.x,point.y)){contact_cancelled=true;ignore_contact=true;gesture.active=false;return;}
        bool waking=mode==MODE_AOD || mode==MODE_OFF;
        if(waking&&!target_hit(HIT_WAKE,point.x,point.y)){contact_cancelled=true;ignore_contact=true;gesture.active=false;return;}
        ignore_contact=waking || transitioning() || current_page==PAGE_BOOT || previous.pairing;
        held_action=false; last_input=lv_tick_get(); set_mode(MODE_PLAY);
        badge_gesture_begin(&gesture,point.x,point.y,last_input);
        if(current_page==PAGE_CARE_ACTION) {care_sample=point;care_sample_ms=last_input;care_save_attempted=false;}
        if(current_page==PAGE_TOUCH) show_point(point);
    } else if(code==LV_EVENT_PRESSING) {
        /* Screen objects can be non-clickable; the input-device path always
         * owns the contact. Sampling here also covers actual fast-play strokes. */
        object_pressing(event);
    } else if(code==LV_EVENT_RELEASED) {
        presentation_contact=false;badge_scene_set_interacting(home_scene,false);
        if(contact_cancelled){contact_cancelled=false;gesture.active=false;ignore_contact=false;drag_cancel();return;}
        last_input=lv_tick_get(); badge_gesture_kind_t kind=badge_gesture_end(&gesture,point.x,point.y,last_input);
        if(gift_modal()){drag_cancel();if(!ignore_contact&&!held_action&&kind==BADGE_GESTURE_TAP)tap(point.x,point.y);ignore_contact=false;return;}
        if(ignore_contact || held_action || previous.pairing || transitioning()) { if(!ui_drag.settling)drag_cancel();ignore_contact=false; return; }
        if(current_page==PAGE_CARE_ACTION && care_action==L2_ACTION_SLEEP) {
            if(last_input-gesture.started_ms>=1500 && gesture.maximum_distance_sq<144 && target_hit(HIT_CARE_ACTION,gesture.x,gesture.y))finish_care();
            else announce("已取消未保存");
            return;
        }
        if(current_page==PAGE_CARE_ACTION && care_action==L2_ACTION_PLAY && gesture.y<60 && point.y-gesture.y>50) {announce("已取消未保存");navigate(PAGE_CARE);return;}
        if(drag_release(kind))return;
        if(kind==BADGE_GESTURE_TAP) tap(zip_ui_clamp(point.x),zip_ui_clamp(point.y));
        else if(lv_obj_has_flag(reset_layer,LV_OBJ_FLAG_HIDDEN)) swipe(kind);
    } else if(code==LV_EVENT_INDEV_RESET || code==LV_EVENT_PRESS_LOST || code==LV_EVENT_CANCEL) {presentation_contact=false;badge_scene_set_interacting(home_scene,false);contact_cancelled=contact_cancelled||lv_indev_get_state(touch_indev)==LV_INDEV_STATE_PRESSED;gesture.active=false;ignore_contact=true;held_action=false;drag_cancel();}
}
static void object_pressing(lv_event_t *event)
{
    if(day_capture){
        if(event){lv_event_stop_bubbling(event);lv_event_stop_processing(event);}
        if(day_scrubbing&&!day_release_seen){lv_point_t p;lv_indev_get_point(touch_indev,&p);day_move(p);}
        return;
    }
    (void)event; if(!gesture.active) return;
    lv_point_t point; lv_indev_get_point(touch_indev,&point); badge_gesture_move(&gesture,point.x,point.y); last_input=lv_tick_get();
    if(gift_modal()){if(ui_drag.active)drag_cancel();return;}
    drag_update();
    if(current_page==PAGE_CARE_ACTION && care_action==L2_ACTION_PLAY && !ignore_contact && !transitioning()) {
        uint32_t dt=last_input-care_sample_ms;if(!dt)dt=1;int dx=point.x-care_sample.x,dy=point.y-care_sample.y;
        if(dt && (uint64_t)(dx*dx+dy*dy)*1000000u>(uint64_t)900*900*dt*dt)care_step();
        care_sample=point;care_sample_ms=last_input;
    }
    if(current_page==PAGE_TOUCH) show_point(point);
    if(current_page==PAGE_GUIDE&&!ignore_contact)lv_obj_set_pos(guide_icon,point.x-8,point.y-8);
}
static lv_obj_t *new_screen(void)
{
    lv_obj_t *s=lv_obj_create(stage_root); lv_obj_remove_style_all(s);lv_obj_set_size(s,466,466);
    lv_obj_set_style_bg_color(s,lv_color_hex(ZIP_UI_COLOR_BG),0); lv_obj_set_style_bg_opa(s,LV_OPA_COVER,0);
    lv_obj_remove_flag(s,LV_OBJ_FLAG_SCROLLABLE); lv_obj_add_event_cb(s,object_pressing,LV_EVENT_PRESSING,NULL); return s;
}
static void build_boot_pair_guide(void)
{
    icon(pages[PAGE_BOOT],ICON_PAW,233,188,6); label(pages[PAGE_BOOT],233,282,240,"猫咪森活",false,ZIP_UI_COLOR_TEXT);
    label(pages[PAGE_BOOT],233,314,220,"正在醒来…",true,ZIP_UI_COLOR_SUB);
    label(pages[PAGE_PAIR],233,120,260,"连接手机 App",false,ZIP_UI_COLOR_TEXT);
    pair_page_code=label(pages[PAGE_PAIR],233,212,230,"------",false,ZIP_UI_COLOR_ACCENT);
    pair_page_hint=label(pages[PAGE_PAIR],233,282,290,"等待手机首次同步",true,ZIP_UI_COLOR_SUB);
    pill(pages[PAGE_PAIR],"连接帮助",233,380,180,40);
    guide_scene=badge_scene_create(pages[PAGE_GUIDE]);badge_scene_set_compact(guide_scene,true);
    guide_icon=icon(pages[PAGE_GUIDE],ICON_TAP,282,223,3);
    guide_progress=label(pages[PAGE_GUIDE],233,66,90,"1 / 5",true,ZIP_UI_COLOR_SUB);
    guide_title=title(pages[PAGE_GUIDE],280,300,"");
    guide_sub=label(pages[PAGE_GUIDE],233,320,310,"",true,ZIP_UI_COLOR_SUB);
    for(unsigned i=0;i<5;i++) guide_dots[i]=shape(pages[PAGE_GUIDE],193+18*i,346,8,8,ZIP_UI_COLOR_LINE,LV_RADIUS_CIRCLE);
    guide_hint=label(pages[PAGE_GUIDE],233,375,280,"跟着手指试一试",true,ZIP_UI_COLOR_SUB);
    pill(pages[PAGE_GUIDE],"跳过引导",233,411,140,32);update_guide();
}
static lv_obj_t *arc(lv_obj_t *parent,int diameter,int start,int end,int width,uint32_t color)
{
    lv_obj_t *a=lv_arc_create(parent); lv_obj_set_size(a,diameter,diameter); lv_obj_center(a);
    lv_arc_set_rotation(a,0); lv_arc_set_bg_angles(a,start,end); lv_arc_set_range(a,0,100); lv_arc_set_value(a,0);
    lv_obj_set_style_arc_width(a,width,LV_PART_MAIN); lv_obj_set_style_arc_width(a,width,LV_PART_INDICATOR);
    lv_obj_set_style_arc_color(a,lv_color_hex(ZIP_UI_COLOR_LINE),LV_PART_MAIN); lv_obj_set_style_arc_color(a,lv_color_hex(color),LV_PART_INDICATOR);
    lv_obj_remove_style(a,NULL,LV_PART_KNOB); lv_obj_remove_flag(a,LV_OBJ_FLAG_CLICKABLE); return a;
}
static void build_home_peek(void)
{
    peek_root=shape(stage_root,0,0,466,466,ZIP_UI_COLOR_BG,0);peek_scene=badge_scene_create(peek_root);
    for(unsigned i=0;i<5;i++){peek_arcs[i]=arc(peek_root,436,119-18*i,133-18*i,8,stat_colors[i]);lv_arc_set_mode(peek_arcs[i],LV_ARC_MODE_REVERSE);}
    peek_rings[0]=arc(peek_root,454,0,359,18,ZIP_UI_COLOR_RINGTRACK);peek_rings[1]=arc(peek_root,406,0,359,6,ZIP_UI_COLOR_RINGTRACK);
    for(unsigned i=0;i<2;i++)lv_obj_set_style_arc_color(peek_rings[i],lv_color_hex(ZIP_UI_COLOR_RINGTRACK),LV_PART_MAIN);
    peek_heading=label(peek_root,233,94,240,"",false,ZIP_UI_COLOR_TEXT);
    peek_weather=label(peek_root,233,342,250,"",true,ZIP_UI_COLOR_SUB);peek_action=label(peek_root,233,389,220,"",true,ZIP_UI_COLOR_TEXT);
    peek_marker=shape(peek_root,0,0,10,10,ZIP_UI_COLOR_TEXT,LV_RADIUS_CIRCLE);peek_heart=icon(peek_root,ICON_HEART,100,365,1);lv_obj_set_style_image_opa(peek_heart,LV_OPA_40,0);
    const int xs[]={233,409,233,57},ys[]={57,233,409,233};const char *hours[]={"0","6","12","18"};for(unsigned i=0;i<4;i++)peek_hours[i]=label(peek_root,xs[i],ys[i],28,hours[i],true,ZIP_UI_COLOR_DIM);
    peek_clock=label(peek_root,233,62,180,"需手机校时",false,ZIP_UI_COLOR_TEXT);
    peek_phase=label(peek_root,233,126,260,"",true,ZIP_UI_COLOR_ACCENT);
    peek_missing=label(peek_root,233,365,270,"",true,ZIP_UI_COLOR_SUB);hide(peek_root,true);
}
/* Different PAGE objects follow the contact; HOME faces retain 053 release-only. */
static void settle_apply(void *unused,int32_t offset)
{
    (void)unused;ui_drag.offset=offset;
    lv_obj_t *source=pages[ui_drag.active?ui_drag.from:current_page];
    if(source)lv_obj_set_pos(source,ui_drag.axis==BADGE_GESTURE_AXIS_HORIZONTAL?offset:0,
        ui_drag.axis==BADGE_GESTURE_AXIS_VERTICAL?offset:0);
    if(ui_drag.active&&ui_drag.has_target&&pages[ui_drag.target]) {
        int sign=ui_drag.direction==BADGE_GESTURE_RIGHT||ui_drag.direction==BADGE_GESTURE_DOWN?1:-1;
        int target_offset=offset-sign*BADGE_DRAG_PAGE_EXTENT_PX;
        lv_obj_set_pos(pages[ui_drag.target],ui_drag.axis==BADGE_GESTURE_AXIS_HORIZONTAL?target_offset:0,
            ui_drag.axis==BADGE_GESTURE_AXIS_VERTICAL?target_offset:0);
    }
}
static void drag_cancel(void)
{
    if(ui_drag.active&&presentation_contact){contact_cancelled=true;gesture.active=false;ignore_contact=true;}
    lv_anim_delete(&ui_drag,settle_apply);
    if(stage_root)for(unsigned i=0;i<PAGE_COUNT;i++)if(pages[i]) {
        lv_obj_set_pos(pages[i],0,0);hide(pages[i],i!=(unsigned)current_page);
        lv_obj_remove_flag(pages[i],LV_OBJ_FLAG_PRESS_LOCK);
    }
    ui_drag=(ui_drag_t){0};if(peek_root)hide(peek_root,true);
}
static void settle_done(lv_anim_t *animation)
{
    (void)animation;
    bool commit=ui_drag.active&&ui_drag.commit;page_t target=ui_drag.target;
    drag_cancel();
    /* Never navigate during preview: HOME/guide/action lifecycle runs once here. */
    if(commit){drag_completing=true;navigate(target);drag_completing=false;}
    navigation_started=lv_tick_get()-ZIP_UI_TRANSITIONMS;
}
static void drag_update(void)
{
    if(!gesture.active||ignore_contact||held_action||transitioning()||previous.pairing)return;
    if(gift_modal()||!lv_obj_has_flag(reset_layer,LV_OBJ_FLAG_HIDDEN)){drag_cancel();return;}
    if(current_page==PAGE_GUIDE||current_page==PAGE_BOOT||current_page==PAGE_CARE_ACTION)return;
    if(!gesture.axis)return;
    if(!ui_drag.active) {
        badge_gesture_kind_t direction=badge_gesture_direction(&gesture);
        /* No inaccurate day-ring peek and no change to the two-face release path. */
        if(current_page==PAGE_HOME&&gesture.axis==BADGE_GESTURE_AXIS_HORIZONTAL)return;
        page_t target=current_page;
        if(current_page==PAGE_HOME)target=direction==BADGE_GESTURE_UP?PAGE_CARE:PAGE_STATUS;
        else if(current_page==PAGE_CARE&&direction==BADGE_GESTURE_DOWN)target=PAGE_HOME;
        else if(current_page==PAGE_STATUS&&direction==BADGE_GESTURE_UP)target=PAGE_HOME;
        else if(current_page==PAGE_SETTINGS&&direction==BADGE_GESTURE_RIGHT)target=PAGE_STATUS;
        else if(current_page==PAGE_DEVICE&&direction==BADGE_GESTURE_RIGHT)target=previous.bound?PAGE_SETTINGS:PAGE_PAIR;
        else if(current_page==PAGE_TOUCH&&direction==BADGE_GESTURE_RIGHT)target=PAGE_SETTINGS;
        else if(current_page==PAGE_VOICE&&(direction==BADGE_GESTURE_RIGHT||direction==BADGE_GESTURE_DOWN))target=PAGE_HOME;
        else if(current_page==PAGE_MEET&&direction==BADGE_GESTURE_RIGHT)target=PAGE_SETTINGS;
        ui_drag=(ui_drag_t){.active=true,.from=current_page,.target=target,
            .has_target=target!=current_page,.axis=gesture.axis,.direction=direction};
        if(ui_drag.has_target){hide(pages[target],false);lv_obj_move_foreground(pages[current_page]);}
        /* The original page stays the LVGL contact owner as it moves away. */
        lv_obj_add_flag(pages[ui_drag.from],LV_OBJ_FLAG_PRESS_LOCK);
    }
    int raw=ui_drag.axis==BADGE_GESTURE_AXIS_HORIZONTAL?gesture.last_x-gesture.x:gesture.last_y-gesture.y;
    settle_apply(NULL,badge_gesture_drag_offset(raw,ui_drag.direction,ui_drag.has_target));
}
static bool drag_release(badge_gesture_kind_t kind)
{
    if(!ui_drag.active)return false;
    int raw=ui_drag.axis==BADGE_GESTURE_AXIS_HORIZONTAL?gesture.last_x-gesture.x:gesture.last_y-gesture.y;
    settle_apply(NULL,badge_gesture_drag_offset(raw,ui_drag.direction,ui_drag.has_target));
    ui_drag.commit=ui_drag.has_target&&kind==ui_drag.direction;
    ui_drag.settling=true;navigation_started=lv_tick_get();
    int sign=ui_drag.direction==BADGE_GESTURE_RIGHT||ui_drag.direction==BADGE_GESTURE_DOWN?1:-1;
    lv_anim_t a;lv_anim_init(&a);lv_anim_set_var(&a,&ui_drag);lv_anim_set_exec_cb(&a,settle_apply);
    lv_anim_set_values(&a,ui_drag.offset,ui_drag.commit?sign*BADGE_DRAG_PAGE_EXTENT_PX:0);
    lv_anim_set_duration(&a,ui_drag.commit?BADGE_DRAG_COMMIT_MS:BADGE_DRAG_REBOUND_MS);
    lv_anim_set_path_cb(&a,lv_anim_path_ease_out);lv_anim_set_completed_cb(&a,settle_done);
    if(!lv_anim_start(&a))drag_cancel();
    return true;
}
static void release_transition(badge_gesture_kind_t direction)
{
    drag_cancel();ui_drag.settling=true;ui_drag.axis=direction==BADGE_GESTURE_LEFT||direction==BADGE_GESTURE_RIGHT?BADGE_GESTURE_AXIS_HORIZONTAL:BADGE_GESTURE_AXIS_VERTICAL;
    int start=direction==BADGE_GESTURE_LEFT||direction==BADGE_GESTURE_UP?BADGE_DRAG_PAGE_EXTENT_PX:-BADGE_DRAG_PAGE_EXTENT_PX;
    settle_apply(NULL,start);navigation_started=lv_tick_get();
    lv_anim_t a;lv_anim_init(&a);lv_anim_set_var(&a,&ui_drag);lv_anim_set_exec_cb(&a,settle_apply);
    lv_anim_set_values(&a,start,0);lv_anim_set_duration(&a,BADGE_DRAG_LEGACY_RELEASE_MS);lv_anim_set_path_cb(&a,lv_anim_path_ease_out);lv_anim_set_completed_cb(&a,settle_done);
    if(!lv_anim_start(&a))drag_cancel();
}
static void build_home_care(void)
{
    lv_obj_add_event_cb(pages[PAGE_HOME],day_draw,LV_EVENT_DRAW_POST,NULL);
    home_scene=badge_scene_create(pages[PAGE_HOME]);badge_scene_enable_world(home_scene);
    for(unsigned i=0;i<5;i++) { home_arcs[i]=arc(pages[PAGE_HOME],436,119-18*i,133-18*i,8,stat_colors[i]); lv_arc_set_mode(home_arcs[i],LV_ARC_MODE_REVERSE); }
    /* RAM day segments are drawn on the outer daily track; never infer from clock. */
    day_rings[0]=arc(pages[PAGE_HOME],454,0,359,18,ZIP_UI_COLOR_RINGTRACK);
    day_rings[1]=arc(pages[PAGE_HOME],406,0,359,6,ZIP_UI_COLOR_RINGTRACK);
    for(unsigned i=0;i<2;i++)lv_obj_set_style_arc_color(day_rings[i],lv_color_hex(ZIP_UI_COLOR_RINGTRACK),LV_PART_MAIN);
    ring_missing=label(pages[PAGE_HOME],233,365,270,"日程待手机同步",true,ZIP_UI_COLOR_SUB);
    heart_legend=icon(pages[PAGE_HOME],ICON_HEART,100,365,1);lv_obj_set_style_image_opa(heart_legend,LV_OPA_40,0);hide(heart_legend,true);
    ring_marker=shape(pages[PAGE_HOME],0,0,10,10,ZIP_UI_COLOR_TEXT,LV_RADIUS_CIRCLE);hide(ring_marker,true);
    const int hx[]={233,409,233,57},hy[]={57,233,409,233};const char *hours[]={"0","6","12","18"};
    for(unsigned i=0;i<4;i++)ring_hours[i]=label(pages[PAGE_HOME],hx[i],hy[i],28,hours[i],true,ZIP_UI_COLOR_DIM);
    home_clock=label(pages[PAGE_HOME],233,70,160,"--:--",false,ZIP_UI_COLOR_TEXT);
    home_bt=icon(pages[PAGE_HOME],ICON_BT_OFF,196,112,1);
    home_link=label(pages[PAGE_HOME],258,112,70,"--%",true,ZIP_UI_COLOR_SUB);
    home_alert=shape(pages[PAGE_HOME],209,116,48,48,ZIP_UI_COLOR_WARN,LV_RADIUS_CIRCLE);
    icon(home_alert,ICON_PAW,24,24,2); hide(home_alert,true);
    home_hint=label(pages[PAGE_HOME],233,390,250,"",true,ZIP_UI_COLOR_SUB);
    face_heading=title(pages[PAGE_HOME],94,190,"小猫");lv_label_set_long_mode(face_heading,LV_LABEL_LONG_MODE_DOTS);
    face_phase=label(pages[PAGE_HOME],233,126,260,"等待手机状态",true,ZIP_UI_COLOR_ACCENT);
    face_weather=label(pages[PAGE_HOME],233,363,250,"天气待同步",true,ZIP_UI_COLOR_SUB);
    face_action=label(pages[PAGE_HOME],233,389,220,"",true,ZIP_UI_COLOR_TEXT);
    home_action_prop=icon(pages[PAGE_HOME],ICON_PAW,300,282,3);hide(home_action_prop,true);
    care_result_bubble=label(pages[PAGE_HOME],233,174,226,"",true,0x35261c);
    lv_obj_set_style_bg_color(care_result_bubble,lv_color_hex(0xfff9ec),0);
    lv_obj_set_style_bg_opa(care_result_bubble,LV_OPA_COVER,0);
    lv_obj_set_style_radius(care_result_bubble,12,0);
    lv_obj_set_style_pad_all(care_result_bubble,7,0);hide(care_result_bubble,true);
    day_future_bubble=label(pages[PAGE_HOME],233,174,270,"接下来，会有什么呢？",true,0x5a6658);
    lv_obj_set_style_bg_color(day_future_bubble,lv_color_hex(0xfffbef),0);
    lv_obj_set_style_bg_opa(day_future_bubble,LV_OPA_COVER,0);
    lv_obj_set_style_radius(day_future_bubble,12,0);
    lv_obj_set_style_pad_all(day_future_bubble,7,0);hide(day_future_bubble,true);
    face_gift=label(pages[PAGE_HOME],233,402,200,"礼物待同步",true,ZIP_UI_COLOR_COIN);
    const icon_t stat_icons[]={ICON_BOWL,ICON_HEART,ICON_SOAP,ICON_MOON,ICON_HEALTH};
    for(unsigned i=0;i<5;i++) {
        face_c_icons[i]=icon(pages[PAGE_HOME],stat_icons[i],307,166+31*i,1);
        face_c_values[i]=label(pages[PAGE_HOME],345,166+31*i,48,"--",true,stat_colors[i]);
    }
    care_scene=badge_scene_create(pages[PAGE_CARE]); badge_scene_set_compact(care_scene,true);
    title(pages[PAGE_CARE],56,170,"照料");
    care_coins=label(pages[PAGE_CARE],233,88,260,"",true,ZIP_UI_COLOR_SUB);
    label(pages[PAGE_CARE],233,272,280,"完成动作后保存，等手机确认",true,ZIP_UI_COLOR_SUB);
    const int xs[]={105,190,276,361},ys[]={322,352,352,322};
    const icon_t icons[]={ICON_BOWL,ICON_WATER,ICON_FEATHER,ICON_MOON};
    for(unsigned i=0;i<4;i++) {
        lv_obj_t *b=shape(pages[PAGE_CARE],xs[i]-36,ys[i]-36,72,72,ZIP_UI_COLOR_CARD,LV_RADIUS_CIRCLE);
        lv_obj_add_flag(b,LV_OBJ_FLAG_USER_1);lv_obj_t *im=icon(b,icons[i],36,36,3); care_icons[i]=im;
        /* Keep the original safe circular geometry: labels cannot be wide here. */
        label(pages[PAGE_CARE],xs[i],ys[i]+48,44,i==0 ? "喂食" : i==1 ? "喝水" : i==2 ? "逗猫" : "睡觉",true,ZIP_UI_COLOR_TEXT);
    }
    welcome_scene=badge_scene_create(pages[PAGE_WELCOME]);
    welcome_title=title(pages[PAGE_WELCOME],64,200,"欢迎回家");
    welcome_sub=label(pages[PAGE_WELCOME],233,108,280,"随时可在设置中重学",false,ZIP_UI_COLOR_TEXT);
    pill(pages[PAGE_WELCOME],"进入小屋",233,402,130,36);
    care_action_scene=badge_scene_create(pages[PAGE_CARE_ACTION]);badge_scene_set_compact(care_action_scene,true);
    care_action_title=title(pages[PAGE_CARE_ACTION],58,180,"照料");
    care_action_hint=label(pages[PAGE_CARE_ACTION],233,106,310,"",true,ZIP_UI_COLOR_SUB);
    shape(pages[PAGE_CARE_ACTION],181,271,104,104,ZIP_UI_COLOR_CARD,LV_RADIUS_CIRCLE);
    care_action_icon=icon(pages[PAGE_CARE_ACTION],ICON_BOWL,233,323,5);
    care_action_count=label(pages[PAGE_CARE_ACTION],233,387,200,"",true,ZIP_UI_COLOR_ACCENT);
    label(pages[PAGE_CARE_ACTION],233,417,150,"下滑取消",true,ZIP_UI_COLOR_DIM);
    update_face();
}
static void build_status(void)
{
    lv_obj_t *s=pages[PAGE_STATUS]; title(s,56,170,"状态");
    status_heading=label(s,233,92,290,"",true,ZIP_UI_COLOR_SUB);
    for(unsigned i=0;i<5;i++) {
        int y=136+36*i;
        const icon_t ids[]={ICON_BOWL,ICON_HEART,ICON_SOAP,ICON_MOON,ICON_HEALTH};icon(s,ids[i],76,y,1);
        label(s,112,y,56,stat_names[i],false,ZIP_UI_COLOR_TEXT);
        status_bars[i]=lv_bar_create(s); lv_obj_set_pos(status_bars[i],145,y-5); lv_obj_set_size(status_bars[i],180,10);
        lv_bar_set_range(status_bars[i],0,100); lv_bar_set_value(status_bars[i],0,LV_ANIM_OFF);
        lv_obj_set_style_bg_color(status_bars[i],lv_color_hex(ZIP_UI_COLOR_LINE),LV_PART_MAIN);
        lv_obj_set_style_bg_color(status_bars[i],lv_color_hex(stat_colors[i]),LV_PART_INDICATOR); lv_obj_remove_flag(status_bars[i],LV_OBJ_FLAG_CLICKABLE);
        status_values[i]=label(s,355,y,50,"--",false,ZIP_UI_COLOR_TEXT);
    }
    status_coins=label(s,233,322,300,"",false,ZIP_UI_COLOR_COIN);
    status_sync=label(s,233,363,290,"",true,ZIP_UI_COLOR_SUB);
    lv_obj_t *gear=shape(s,209,390,48,48,ZIP_UI_COLOR_CARD,LV_RADIUS_CIRCLE); icon(gear,ICON_GEAR,24,24,2);lv_obj_add_flag(gear,LV_OBJ_FLAG_USER_1);
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
    label(s,349,178,70,"关闭",true,ZIP_UI_COLOR_DIM); setting_discover=label(s,349,230,70,"关闭",true,ZIP_UI_COLOR_DIM);
    setting_aod=label(s,349,282,70,"开启",true,ZIP_UI_COLOR_ACCENT);
    char text[100]; snprintf(text,sizeof(text),"右滑返回 · 固件 %s\n长按此处 3 秒：触摸自检",esp_app_get_description()->version);
    label(s,233,346,270,text,true,ZIP_UI_COLOR_DIM);
    pill(s,"设备与同步",173,392,112,36); pill(s,"重看引导",293,392,112,36);
    s=pages[PAGE_DEVICE]; label(s,233,56,190,"设备与同步",false,ZIP_UI_COLOR_TEXT);
    device_link=label(s,233,92,280,"",true,ZIP_UI_COLOR_BT);
    device_id=label(s,233,124,300,"",true,ZIP_UI_COLOR_SUB);
    device_pet=label(s,233,163,330,"",true,ZIP_UI_COLOR_SUB);
    device_meta=label(s,233,210,310,"",true,ZIP_UI_COLOR_TEXT);
    device_storage=label(s,233,254,310,"",true,ZIP_UI_COLOR_SUB);
    pill(s,"同步说明",233,292,220,40); pill(s,"待同步",173,348,112,40); pill(s,"重看引导",293,348,112,40);
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
    label(s,233,318,280,"麦克风保持关闭\n当前不会录音或上传声音\n提示音硬件尚未验证",true,ZIP_UI_COLOR_SUB);
    label(s,233,384,220,"松手后轻点返回",true,ZIP_UI_COLOR_DIM);
    s=pages[PAGE_MEET];title(s,64,200,"附近的小猫");icon(s,ICON_FLOWER,233,166,5);
    meet_state=label(s,233,248,300,"附近发现已关闭",false,ZIP_UI_COLOR_TEXT);
    meet_id=label(s,233,285,280,"",true,ZIP_UI_COLOR_SUB);
    lv_obj_t *confirm=shape(s,123,308,220,48,ZIP_UI_COLOR_CARD,18);
    lv_obj_add_flag(confirm,LV_OBJ_FLAG_USER_1);meet_confirm_label=label(confirm,110,24,210,"等待连接",true,ZIP_UI_COLOR_ACCENT);
    pill(s,"关闭发现",173,392,112,36);pill(s,"返回",293,392,112,36);
}
static void build_layers(void)
{
    toast=label(lv_layer_top(),233,64,180,"",true,ZIP_UI_COLOR_TEXT);
    lv_obj_set_style_bg_color(toast,lv_color_hex(ZIP_UI_COLOR_CARD),0); lv_obj_set_style_bg_opa(toast,LV_OPA_COVER,0);
    lv_obj_set_style_pad_all(toast,8,0); lv_obj_set_style_radius(toast,16,0);
    lv_obj_set_height(toast,40); lv_label_set_long_mode(toast,LV_LABEL_LONG_MODE_CLIP); hide(toast,true);
    reset_layer=shape(lv_layer_top(),0,0,1,1,ZIP_UI_COLOR_BG,0);hide(reset_layer,true);
    feedback_ring=arc(lv_layer_top(),454,0,359,4,ZIP_UI_COLOR_ACCENT);lv_arc_set_value(feedback_ring,0);hide(feedback_ring,true);
    gift_popup=shape(lv_layer_top(),83,103,300,278,ZIP_UI_COLOR_CARD,28);
    gift_popup_icon=icon(gift_popup,ICON_FLOWER,150,84,5);
    gift_popup_title=label(gift_popup,150,167,270,"收到野花",false,ZIP_UI_COLOR_COIN);
    gift_popup_sub=label(gift_popup,150,208,260,"双方已确认，礼物已保存",true,ZIP_UI_COLOR_SUB);
    pill(gift_popup,"知道啦",150,257,140,40);hide(gift_popup,true);
}
static void update_peer(void)
{
    local2_peer_get_view(&peer);
    const char *status=peer.phase==L2P_DISABLED ? "附近发现已关闭" : peer.phase==L2P_DISCOVERING ? "正在寻找附近吧唧" : peer.phase==L2P_HELLO ? "已连接，正在交换信息" : peer.phase==L2P_CONFIRM ? "请双方在各自吧唧上确认" : peer.phase==L2P_EXCHANGING ? "正在保存礼物" : peer.phase==L2P_WAIT_DONE ? "已保存，等待对方确认" : peer.phase==L2P_COMPLETE ? "双方已确认" : "会面未完成，请重试";
    set_label(meet_state,status,248);
    char text[100];size_t id_len=strlen(peer.peer_id);snprintf(text,sizeof(text),"%s%s",id_len ? "对方：" : "",id_len>12 ? peer.peer_id+id_len-12 : peer.peer_id);set_label(meet_id,text,285);
    const char *button=peer.phase==L2P_DISABLED ? "开启附近发现" : peer.phase==L2P_DISCOVERING ? "正在寻找" : peer.phase==L2P_HELLO ? "正在交换信息" : peer.phase==L2P_CONFIRM ? (peer.local_confirmed ? "已确认，等待对方" : "确认交换野花") : peer.phase==L2P_EXCHANGING ? "交换中" : peer.phase==L2P_WAIT_DONE ? "等待确认" : peer.phase==L2P_COMPLETE ? "完成，回小屋" : "关闭后重试";
    set_label(meet_confirm_label,button,24);
    set_label(setting_discover,peer.discoverable ? "开启" : "关闭",230);
    if(peer_attached && peer.complete && peer.complete_count>peer_previous.complete_count) {
        l2_view_t actual;local2_get_view(&actual);if(actual.busy)return;
        gift_popup_new=peer.incoming_new;
        if(!gift_popup_new || local2_present_gift_state(L2_GIFT_PLAYING)==L2_OK) {
            if(gift_popup_new)snprintf(text,sizeof(text),"收到%s ×%lu",actual.last_gift.gift_kind==1 ? "野花" : "礼物",(unsigned long)actual.last_gift.quantity);else strcpy(text,"又见到朋友啦");
            set_label(gift_popup_title,text,167);
            set_label(gift_popup_sub,gift_popup_new ? "双方已确认，礼物已保存" : "双方已确认，没有重复奖励",208);
            lv_image_set_src(gift_popup_icon,&icon_images[gift_popup_new ? ICON_FLOWER : ICON_PAW]);
            lv_anim_delete(gift_popup_icon,gift_bob);lv_anim_t animation;lv_anim_init(&animation);
            lv_anim_set_var(&animation,gift_popup_icon);lv_anim_set_exec_cb(&animation,gift_bob);lv_anim_set_values(&animation,0,-8);
            lv_anim_set_duration(&animation,250);lv_anim_set_reverse_duration(&animation,250);lv_anim_set_repeat_count(&animation,3);lv_anim_set_path_cb(&animation,lv_anim_path_ease_in_out);lv_anim_start(&animation);
            drag_cancel();contact_cancelled=contact_cancelled||lv_indev_get_state(touch_indev)==LV_INDEV_STATE_PRESSED;
            hide(gift_popup,false);toast_active=false;hide(toast,true);
            gesture.active=false;ignore_contact=true;held_action=false;care_save_attempted=true;
            if(face==0)badge_scene_play(home_scene,BADGE_SCENE_ATTENTION,lv_tick_get());
        } else announce("礼物已存待展示");
    }
    peer_previous=peer;peer_attached=true;
}
static const char *stage_name(l2_scene_t stage)
{
    switch(stage) {case L2_SCENE_HOME:return "在家陪伴";case L2_SCENE_DEPARTING:return "正在出发";case L2_SCENE_AWAY:return "正在外面游玩";case L2_SCENE_RETURNING:return "正在返程";case L2_SCENE_GARDEN:return "庭院玩耍";case L2_SCENE_TOWN:return "镇街散步";default:return "状态待同步";}
}
static const char *weather_name(l2_weather_t weather)
{ return weather==L2_WEATHER_RAIN ? "雨天" : weather==L2_WEATHER_SNOW ? "雪天" : "晴天"; }
static void update_clock(void)
{
    uint64_t epoch=0;bool valid=local2_clock_now(&epoch);char text[48];unsigned minute=0;
    if(valid){int64_t m=(int64_t)(epoch/60000)+local2_clock_utc_offset_minutes();minute=(unsigned)((m%1440+1440)%1440);snprintf(text,sizeof(text),"%02u:%02u",minute/60,minute%60);}
    else strcpy(text,face?"  :  ":"需手机校时");
    lv_obj_set_style_text_font(home_clock,face&&valid?&badge_n40:&local2_font20,0);
    set_label(home_clock,valid?text:"需手机校时",face?398:62);
    hide(ring_hours[2],true); /* Bottom numeral would collide with the real clock. */
    /* Current time and the RAM history scrub cursor remain separate. */
    hide(ring_marker,true);
}

static bool safe_pet_name(const char *text)
{
    if(!text || !text[0])return false;
    const unsigned char *p=(const unsigned char*)text;unsigned chars=0;
    while(*p){uint32_t cp;unsigned n;if(*p<128){cp=*p;n=1;}else if((*p&0xe0)==0xc0){cp=*p&31;n=2;}else if((*p&0xf0)==0xe0){cp=*p&15;n=3;}else if((*p&0xf8)==0xf0){cp=*p&7;n=4;}else return false;
        for(unsigned i=1;i<n;i++){if(!p[i]||(p[i]&0xc0)!=0x80)return false;cp=(cp<<6)|(p[i]&63);}if(cp<32||cp==127)return false;
        lv_font_glyph_dsc_t d;if(!lv_font_get_glyph_dsc(&local2_font24,&d,cp,0)||d.is_placeholder)return false;p+=n;if(++chars>16)return false;
    }return true;
}
static void refresh_state(void)
{
    badge_view_t v;badge_get_view(&v);l2_view_t next;local2_get_view(&next);
    if(next.busy){if(!domain_waiting)announce("存档忙正在等待");domain_waiting=true;return;}
    domain_waiting=false;domain=next;
    bool available=domain.ready && domain.has_snapshot && !domain.storage_error;
    v.bound=available;v.storage_error=!domain.ready || domain.storage_error;v.pending=domain.pending_events;v.blocked=0;
    if(domain.device_id[0]) strlcpy(v.device_id,domain.device_id,sizeof(v.device_id));
    if(available) {
        strlcpy(v.snapshot.pet_id,domain.snapshot.pet.pet_id,sizeof(v.snapshot.pet_id));
        v.snapshot.revision=domain.snapshot.revision;v.snapshot.coins=domain.snapshot.pet.coins;
        v.snapshot.food=domain.snapshot.pet.food;v.snapshot.mood=domain.snapshot.pet.mood;v.snapshot.clean=domain.snapshot.pet.clean;
        v.snapshot.energy=domain.snapshot.pet.energy;v.snapshot.health=domain.snapshot.pet.health;
    }
    bool fresh=domain_attached && available && (!domain_previous.has_snapshot || domain_previous.snapshot.revision!=domain.snapshot.revision);
    /* Visual trust is RAM-only: disconnect unsubscribes immediately. Reconnect
     * alone never replays persisted context; require a new accepted revision. */
    if(!v.connected || !v.subscribed){live_context=false;if(!observed_local)observed_action=L2_ACTION_IDLE;}
    if(fresh) {
        live_context=v.connected && v.subscribed;
        if(live_context){
            observed_local=false;observed_action=domain.snapshot.action;
            observed_action_started=held_snapshot_seen&&held_snapshot_revision==domain.snapshot.revision?held_snapshot_seen_ms:lv_tick_get();
            if(lv_tick_get()-observed_action_started>=3000)observed_action=L2_ACTION_IDLE;
        }
        announce("手机状态已同步");
    }
    if(domain_attached && domain.last_ack!=domain_previous.last_ack) {
        if(domain.terminal.status==L2_TERMINAL_REJECTED)
            care_result(!strcmp(domain.terminal.reason,"insufficient_coins")?"喵币不足未扣钱未成长":"手机拒绝未结算");
        else if(domain.terminal.status==L2_TERMINAL_QUARANTINED)care_result("手机未结算请查看");
        else care_result("手机已确认互动");
    }
    if(domain_attached && domain.gift_change!=domain_previous.gift_change) announce("礼物已存待确认");
    if(current_page!=PAGE_BOOT && available && !previous.bound && has_previous) {guide_review=false;navigate(guide_done ? PAGE_HOME : PAGE_GUIDE);}
    if(v.storage_error) {hide(gift_popup,true);if(current_page!=PAGE_DEVICE) navigate(PAGE_DEVICE);}
    if(v.pairing && (!has_previous || !previous.pairing)) {ignore_contact=true;gesture.active=false;set_mode(MODE_PLAY);}
    update_connection(&v);
    previous=v;has_previous=true;domain_previous=domain;domain_attached=true;dirty=false;
    const char *link=v.storage_error ? "存档错误" : v.connected ? (v.subscribed ? "手机本地连接" : "手机已连接") : "离线保留";
    lv_image_set_src(home_bt,&icon_images[v.connected ? ICON_BT : ICON_BT_OFF]);
    bool low=available && (v.snapshot.food<30 || v.snapshot.mood<30 || v.snapshot.clean<30 || v.snapshot.energy<30 || v.snapshot.health<30);
    hide(home_alert,!low || face!=0 || mode==MODE_AOD || mode==MODE_OFF);hide(face_phase,mode==MODE_AOD || mode==MODE_OFF || (low && face==0));
    uint8_t stats[]={v.snapshot.food,v.snapshot.mood,v.snapshot.clean,v.snapshot.energy,v.snapshot.health};
    for(unsigned i=0;i<5;i++) {
        lv_bar_set_value(status_bars[i],available ? stats[i] : 0,LV_ANIM_OFF);lv_arc_set_value(home_arcs[i],available ? stats[i] : 0);
        char value[12];if(available) snprintf(value,sizeof(value),"%u",stats[i]);else strcpy(value,"--");
        set_label(status_values[i],value,136+36*i);set_label(face_c_values[i],value,166+31*i);
    }
    set_label(status_heading,available ? (live_context ? "手机确认的最新状态" : "上次手机确认的状态") : "请先同步猫咪",92);
    char text[200];
    if(available) snprintf(text,sizeof(text),"喵币 %llu",(unsigned long long)v.snapshot.coins);else strcpy(text,"喵币 --");set_label(status_coins,text,322);
    snprintf(text,sizeof(text),"%s · 待确认 %u\n上滑返回小屋",link,domain.pending_events);set_label(status_sync,text,363);
    if(available) snprintf(text,sizeof(text),"喵币 %llu · 下滑返回",(unsigned long long)v.snapshot.coins);else strcpy(text,"喵币 -- · 下滑返回");set_label(care_coins,text,88);
    for(unsigned i=0;i<4;i++)lv_obj_set_style_opa(care_icons[i],available ? LV_OPA_COVER : LV_OPA_40,0);
    const char *short_state=!available ? "等你连手机" : !live_context ? "上次状态" : domain.snapshot.scene==L2_SCENE_HOME ? "在家陪你" : domain.snapshot.scene==L2_SCENE_TOWN ? "镇街散步" : domain.snapshot.scene==L2_SCENE_GARDEN ? "庭院玩耍" : domain.snapshot.scene==L2_SCENE_DEPARTING ? "准备出门" : domain.snapshot.scene==L2_SCENE_RETURNING ? "正在回家" : "在外面玩";
    if(available && observed_action==L2_ACTION_SLEEP)short_state="窝里休息";
    if(face==0)set_label(face_phase,short_state,126);
    set_label(face_weather,live_context ? weather_name(domain.snapshot.weather) : "",face?354:363);
    set_label(face_action,observed_action==L2_ACTION_IDLE ? "" : action_name(observed_action),389);
    hide(face_heading,false);set_label(face_heading,face==1?"一天进程":available && safe_pet_name(domain.snapshot.pet.name) ? domain.snapshot.pet.name : "小猫",94);
    const char *small_mark=!domain.ready || domain.storage_error ? "存档异常" : domain.pending_events ? "待确认" : !v.connected || !v.subscribed ? "离线" : "";
    set_label(home_link,small_mark,415);hide(home_link,mode==MODE_AOD || mode==MODE_OFF || !small_mark[0]);
    hide(home_bt,mode==MODE_AOD || mode==MODE_OFF || !small_mark[0]);
    if(domain.has_gift) snprintf(text,sizeof(text),"%s ×%lu · %s",domain.last_gift.gift_kind==1 ? "野花" : "礼物",(unsigned long)domain.last_gift.quantity,domain.gift_state==L2_GIFT_SHOWN ? "已展示" : "待确认");else strcpy(text,"礼物日记 · 附近遇见");
    set_label(face_gift,text,402);
    if(face==0)badge_scene_set_context(home_scene,available,domain.snapshot.scene,domain.snapshot.weather,observed_action,live_context);
    hide(home_action_prop,face!=0 || observed_action==L2_ACTION_IDLE || observed_action==L2_ACTION_WALK || observed_action==L2_ACTION_SLEEP || !available || mode==MODE_AOD || mode==MODE_OFF);
    hide(face_weather,face!=0 || !live_context || observed_action==L2_ACTION_SLEEP || mode==MODE_AOD || mode==MODE_OFF);
    hide(face_action,face!=0 || observed_action==L2_ACTION_IDLE || observed_action==L2_ACTION_SLEEP || mode==MODE_AOD || mode==MODE_OFF);
    if(observed_action!=L2_ACTION_IDLE) {
        icon_t id=observed_action==L2_ACTION_FEED ? ICON_BOWL : observed_action==L2_ACTION_WATER ? ICON_WATER : observed_action==L2_ACTION_BATH ? ICON_SOAP : observed_action==L2_ACTION_PLAY ? ICON_FEATHER : observed_action==L2_ACTION_SLEEP ? ICON_MOON : ICON_HEART;
        lv_image_set_src(home_action_prop,&icon_images[id]);lv_obj_set_pos(home_action_prop,300-8,(observed_action==L2_ACTION_PLAY || observed_action==L2_ACTION_SLEEP || observed_action==L2_ACTION_PET ? 215 : 312)-8);
    }
    set_label(device_link,link,92);snprintf(text,sizeof(text),"ID %s",v.device_id[0] ? v.device_id : "--");set_label(device_id,text,124);
    snprintf(text,sizeof(text),"PET %s",available ? v.snapshot.pet_id : "--");set_label(device_pet,text,163);
    if(available)snprintf(text,sizeof(text),"同步版本 %llu\n待确认 %u / 200",(unsigned long long)v.snapshot.revision,domain.pending_events);else strcpy(text,"请用手机发送首次宠物状态");set_label(device_meta,text,210);
    set_label(device_storage,v.storage_error ? "存档不可用，请保留设备" : domain.terminal.status==L2_TERMINAL_REJECTED ? (!strcmp(domain.terminal.reason,"insufficient_coins")?"上次互动：喵币不足未扣钱":"上次互动：手机拒绝") : domain.terminal.status==L2_TERMINAL_QUARANTINED ? "上次互动：手机未结算" : available ? "本地存档可用 · 无云服务" : "等待手机首次同步",254);
    set_label(setting_brightness,brightness==45 ? "低" : brightness==75 ? "中" : "高",126);set_label(setting_aod,aod_enabled ? "开启" : "关闭",282);update_clock();update_peer();day_refresh();day_project();
}
/* Presentation only: reuse existing prop and original action success/3s gates. */
static void warm_home_presentation(uint32_t now)
{
 static bool initialized,was_warm;
 bool warm=current_page==PAGE_HOME&&badge_scene_light_background(home_scene)&&mode!=MODE_AOD&&mode!=MODE_OFF;
 if(!initialized||was_warm!=warm){
  initialized=true;was_warm=warm;
  lv_obj_t *labels[]={home_clock,face_heading,face_phase,face_weather,face_action,home_link,home_hint,face_gift};
  const uint32_t original[]={ZIP_UI_COLOR_TEXT,ZIP_UI_COLOR_TEXT,ZIP_UI_COLOR_ACCENT,ZIP_UI_COLOR_SUB,ZIP_UI_COLOR_TEXT,ZIP_UI_COLOR_SUB,ZIP_UI_COLOR_SUB,ZIP_UI_COLOR_COIN};
  for(unsigned i=0;i<8;i++)lv_obj_set_style_text_color(labels[i],lv_color_hex(warm?0x35261c:original[i]),0);
  lv_obj_set_style_text_color(ring_missing,lv_color_hex(warm?0x654d35:ZIP_UI_COLOR_SUB),0);for(unsigned i=0;i<4;i++)lv_obj_set_style_text_color(ring_hours[i],lv_color_hex(warm?0x654d35:ZIP_UI_COLOR_DIM),0);
  const uint32_t ink[]={0xa66b27,0xa34d63,0x397c98,0x5f8336,0x8b6875};
  for(unsigned i=0;i<5;i++)lv_obj_set_style_arc_color(home_arcs[i],lv_color_hex(warm?ink[i]:stat_colors[i]),LV_PART_INDICATOR);
  lv_image_set_inner_align(home_action_prop,LV_IMAGE_ALIGN_CENTER);lv_obj_set_size(home_action_prop,warm?34:16,warm?34:16);lv_image_set_scale(home_action_prop,warm?256:768);
  lv_obj_set_style_bg_color(home_action_prop,lv_color_hex(0xfffdf8),0);lv_obj_set_style_bg_opa(home_action_prop,warm?LV_OPA_COVER:LV_OPA_TRANSP,0);lv_obj_set_style_radius(home_action_prop,17,0);
  lv_obj_set_style_border_width(home_action_prop,warm?2:0,0);lv_obj_set_style_border_color(home_action_prop,lv_color_hex(0xf0dcc0),0);
 }
 if(!warm){hide(care_result_bubble,true);return;}
 bool result_visible=face==0&&care_result_text&&now-care_result_started<4000&&!gesture.active&&!ui_drag.settling&&!gift_modal();
 hide(care_result_bubble,!result_visible);
 if(result_visible){set_label(care_result_bubble,care_result_text,174);hide(home_action_prop,true);return;}
 bool thought=badge_scene_thought_visible(home_scene,now);
 bool actual=observed_action!=L2_ACTION_IDLE&&observed_action!=L2_ACTION_WALK&&observed_action!=L2_ACTION_SLEEP&&now-observed_action_started<3000;
 bool show=face==0&&(thought||actual)&&!previous.pairing&&!gift_modal()&&lv_obj_has_flag(reset_layer,LV_OBJ_FLAG_HIDDEN)&&!gesture.active&&!ui_drag.active&&!ui_drag.settling;
 if(!show){hide(home_action_prop,true);return;}
 icon_t id=thought?(live_context&&domain.snapshot.scene==L2_SCENE_AWAY?ICON_FEATHER:ICON_HEART):observed_action==L2_ACTION_FEED?ICON_BOWL:observed_action==L2_ACTION_WATER?ICON_WATER:observed_action==L2_ACTION_BATH?ICON_SOAP:observed_action==L2_ACTION_PLAY?ICON_FEATHER:ICON_HEART;
 lv_image_set_src(home_action_prop,&icon_images[id]);int bob=(int)((now%1600<800?now%800:800-now%800)*4/800)-2;
 lv_obj_set_pos(home_action_prop,321+badge_scene_prop_offset(home_scene),163+bob);hide(home_action_prop,false);
}
#include "badge_day_ui.inc"
static void tick(lv_timer_t *timer)
{
    (void)timer; uint64_t diag_tick_started=esp_timer_get_time(); uint32_t now=lv_tick_get();
    if(day_capture&&!day_release_seen){
        if(lv_indev_get_state(touch_indev)==LV_INDEV_STATE_RELEASED){
            day_release_seen=true;day_scrubbing=false;day_pending=true;presentation_contact=false;
            lv_obj_remove_flag(pages[PAGE_HOME],LV_OBJ_FLAG_PRESS_LOCK);
            badge_scene_set_interacting(home_scene,false);gesture.active=false;ignore_contact=true;
        }else if(day_scrubbing){lv_point_t p;lv_indev_get_point(touch_indev,&p);day_move(p);}
    }
    if((ui_drag.active||ui_drag.settling)&&(gift_modal()||!lv_obj_has_flag(reset_layer,LV_OBJ_FLAG_HIDDEN)))drag_cancel();
    if(gesture.active) {
        lv_point_t point; lv_indev_get_point(touch_indev,&point); badge_gesture_move(&gesture,point.x,point.y);
        if(lv_indev_get_state(touch_indev)==LV_INDEV_STATE_PRESSED)drag_update();
        if(lv_indev_get_state(touch_indev)==LV_INDEV_STATE_RELEASED) { presentation_contact=false;badge_scene_set_interacting(home_scene,false);gesture.active=false;ignore_contact=true;if(!ui_drag.settling)drag_cancel(); }
        else if(current_page==PAGE_CARE_ACTION && care_action==L2_ACTION_PLAY) {
            /* Pointer devices need not deliver object PRESSING on an otherwise
             * passive scene. Sample the actual read point on the UI clock too. */
            object_pressing(NULL);
        }
        else if(!ignore_contact && !held_action && !previous.pairing && lv_obj_has_flag(reset_layer,LV_OBJ_FLAG_HIDDEN) && lv_obj_has_flag(gift_popup,LV_OBJ_FLAG_HIDDEN) && !transitioning()) {
            if(current_page==PAGE_GUIDE && guide_index==4 && badge_gesture_holding(&gesture,now)){held_action=true;guide_accept(BADGE_GESTURE_HOLD);}
            else if(current_page==PAGE_HOME && target_hit(HIT_HOME_HOLD,gesture.x,gesture.y) && badge_gesture_holding(&gesture,now)) { held_action=true; navigate(PAGE_VOICE); }
            else if(current_page==PAGE_CARE_ACTION && care_action==L2_ACTION_SLEEP && !care_save_attempted && now-gesture.started_ms>=1500 && gesture.maximum_distance_sq<144 && circle(gesture.x,gesture.y,233,323,52)) {care_save_attempted=true;finish_care();}
            else if(current_page==PAGE_SETTINGS && now-gesture.started_ms>=3000 && gesture.maximum_distance_sq<144 && target_hit(HIT_VERSION,gesture.x,gesture.y)) { held_action=true; navigate(PAGE_TOUCH); }
        }
    }
    if(current_page==PAGE_CARE_ACTION && care_action==L2_ACTION_PLAY && now-care_started>=25000) {announce("已超时未保存");navigate(PAGE_CARE);}
    /* LVGL animation still advances the drag/rebound. Defer unrelated object
     * writes from touchdown until release AND navigation/settling completion.
     * Do not call scene_tick(false): that API changes clip/pending on resume. */
    if(!day_capture&&presentation_contact&&lv_indev_get_state(touch_indev)==LV_INDEV_STATE_RELEASED){presentation_contact=false;badge_scene_set_interacting(home_scene,false);}
    if(ui_drag.settling&&lv_tick_elaps(navigation_started)>300){drag_cancel();navigation_started=now-ZIP_UI_TRANSITIONMS;}
    bool interaction=presentation_contact||gesture.active||ui_drag.active||ui_drag.settling||transitioning();
    set_decoration_hold(interaction);
    if(interaction){
        presentation_deferred=true;
        /* Read a snapshot only to retain its first-observed action age; commit
         * no UI. BLE receive/persistence continues in its existing tasks. */
        if(now-held_snapshot_poll_ms>=250){
            held_snapshot_poll_ms=now;l2_view_t pending={0};l2_core_t *held_core=l2_runtime_core(0);
            if(held_core){l2_get_view(held_core,&pending);l2_runtime_release();}
            if(held_core&&!pending.busy&&pending.ready&&pending.has_snapshot&&!pending.storage_error&&(!held_snapshot_seen||held_snapshot_revision!=pending.snapshot.revision)){
                held_snapshot_seen=true;held_snapshot_revision=pending.snapshot.revision;held_snapshot_seen_ms=now;
            }
        }
        if(day_scrubbing)day_project();
        badge_diagnostics_ui_tick(diag_tick_started);return;
    }
    if(presentation_deferred){
        presentation_deferred=false;dirty=true;last_scene_tick=now;
        if(observed_action!=L2_ACTION_IDLE&&now-observed_action_started>=3000){observed_action=L2_ACTION_IDLE;observed_local=false;}
        last_state_poll=now;refresh_state();held_snapshot_seen=false;
    }
    if(current_page==PAGE_BOOT && !domain_waiting && now-boot_started>=1500) {
        if(previous.storage_error) navigate(PAGE_DEVICE);
        else if(previous.bound) { guide_review=false; navigate(guide_done ? PAGE_HOME : PAGE_GUIDE); }
        else navigate(PAGE_PAIR);
    }
    if(feedback_active){uint32_t t=now-feedback_started;if(t>=360){feedback_active=false;hide(feedback_ring,true);}else lv_obj_set_style_opa(feedback_ring,(uint8_t)(255*(360-t)/360),0);}
    if(current_page==PAGE_GUIDE){
        if(guide_pass_until && (int32_t)(now-guide_pass_until)>=0){if(guide_index<4){guide_index++;update_guide();}else if(save_guide(false)){guide_completed_now=true;guide_review=false;navigate(previous.bound?PAGE_WELCOME:PAGE_PAIR);}else {guide_pass_until=0;set_label(guide_hint,"引导未保存，请重试或跳过",375);}}
        if(!gesture.active){unsigned t=(now-guide_demo_started)%1600;int x=282,y=224;int p=(int)(t<1000?t:1000);if(guide_index==1)y=256-p*110/1000;else if(guide_index==2)y=156+p*110/1000;else if(guide_index==3){unsigned phase=(now-guide_demo_started)%2400;x=165+(int)(phase<1200?phase:2400-phase)*135/1200;}lv_obj_set_pos(guide_icon,x-8,y-8);lv_obj_set_style_image_opa(guide_icon,t>1200?LV_OPA_40:LV_OPA_COVER,0);}
        badge_scene_tick(guide_scene,now,true);
    }
    if(current_page==PAGE_WELCOME && now-welcome_started>=3000) navigate(PAGE_HOME);
    if(current_page==PAGE_TOUCH && touch_completed && now-touch_completed>=1000) { touch_completed=0; announce("五点命中方向待验"); navigate(PAGE_SETTINGS); }
    if(observed_action!=L2_ACTION_IDLE && now-observed_action_started>=3000) {observed_action=L2_ACTION_IDLE;observed_local=false;dirty=true;}
    if(toast_active && now-toast_started>=1800) { toast_active=false; hide(toast,true); }
    if(current_page==PAGE_HOME && !previous.pairing && lv_obj_has_flag(reset_layer,LV_OBJ_FLAG_HIDDEN)) {
        uint32_t idle=now-last_input;
        set_mode(idle>=40000 ? (aod_enabled ? MODE_AOD : MODE_OFF) : idle>=10000 ? MODE_COMP : MODE_PLAY);
    } else set_mode(MODE_PLAY);
    lv_timer_set_period(timer,(mode==MODE_AOD || mode==MODE_OFF) ? 250 : mode==MODE_COMP ? 83 : 33);
    uint32_t interval=mode==MODE_COMP ? 83 : 33;
    if(now-last_scene_tick>=interval) {
        last_scene_tick=now;
        if(ui_drag.active&&ui_drag.to_face)badge_scene_tick(peek_scene,now,true);
        if(current_page==PAGE_HOME) badge_scene_tick(home_scene,now,mode==MODE_PLAY || mode==MODE_COMP);
        else if(current_page==PAGE_CARE) badge_scene_tick(care_scene,now,true);
        else if(current_page==PAGE_WELCOME) badge_scene_tick(welcome_scene,now,true);
        else if(current_page==PAGE_CARE_ACTION)badge_scene_tick(care_action_scene,now,true);
    }
    if(now-last_state_poll>=250 || dirty) { last_state_poll=now; refresh_state(); }
    day_project();
    warm_home_presentation(now);
    badge_diagnostics_ui_tick(diag_tick_started);
}
bool badge_ui_diagnostic_select_face(unsigned target)
{
    if(target>1||current_page!=PAGE_HOME||mode==MODE_AOD||mode==MODE_OFF||previous.pairing||gift_modal()||!lv_obj_has_flag(reset_layer,LV_OBJ_FLAG_HIDDEN)||gesture.active||ui_drag.active||ui_drag.settling||transitioning())return false;
    face=target;update_face();refresh_state();lv_obj_update_layout(stage_root);return true;
}
bool badge_ui_capture_allowed(void)
{
    return !gesture.active&&!ui_drag.active&&!ui_drag.settling&&!transitioning();
}
bool badge_ui_start(void)
{
    lv_display_t *display=bsp_display_start();
    if(!display) { ESP_LOGE("badge_ui","Official BSP display start failed"); return false; }
    if(bsp_display_lock(10000)!=ESP_OK) { ESP_LOGE("badge_ui","LVGL lock timed out"); return false; }
    touch_indev=bsp_display_get_input_dev();
    if(!touch_indev) { bsp_display_unlock(); ESP_LOGE("badge_ui","Official BSP touch unavailable"); return false; }
    badge_diagnostics_attach(display,touch_indev);
    local2_fonts_init(); init_icons(); load_preferences();
    stage_root=lv_obj_create(NULL);lv_obj_remove_style_all(stage_root);lv_obj_set_size(stage_root,466,466);
    lv_obj_set_style_bg_color(stage_root,lv_color_hex(0),0);lv_obj_set_style_bg_opa(stage_root,LV_OPA_COVER,0);lv_obj_remove_flag(stage_root,LV_OBJ_FLAG_SCROLLABLE);
    for(unsigned i=0;i<PAGE_COUNT;i++) pages[i]=new_screen();
    build_boot_pair_guide(); build_home_care(); build_status(); build_settings_device(); build_touch_voice(); build_layers();build_home_peek();
    if(!home_scene || !care_scene || !welcome_scene || !care_action_scene) { bsp_display_unlock(); ESP_LOGE("badge_ui","Scene allocation failed"); return false; }
    current_page=PAGE_BOOT; boot_started=last_input=navigation_started=lv_tick_get();
    lv_indev_set_long_press_time(touch_indev,ZIP_UI_LONGPRESSMS); lv_indev_add_event_cb(touch_indev,input_event,LV_EVENT_ALL,NULL);
    for(unsigned i=0;i<PAGE_COUNT;i++)hide(pages[i],i!=PAGE_BOOT);
    hide(peek_root,true);lv_screen_load(stage_root); bsp_display_brightness_set(brightness);
    /* The existing GUI timer owns the first domain/time projection. Do not nest
     * refresh_state (large domain views + text/layout) inside main bootstrap. */
    dirty=true;lv_timer_create(tick,33,NULL);
    ESP_LOGI("badge_ui","Original animation bank: %s",badge_scene_has_animation(home_scene) ? "available" : "RECOVERY FALLBACK ONLY");
    bsp_display_unlock(); return true;
}
