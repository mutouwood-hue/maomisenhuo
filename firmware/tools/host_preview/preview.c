/* OFFLINE ONLY. Production implementation is included without copying/repainting
 * any page. This translation unit can select its static UI states for capture.
 * Device/state/NVS are explicitly memory-only fixtures, never hardware access. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "lvgl.h"
#include "badge.h"
#include "esp_app_desc.h"
#include "nvs.h"
#include "bsp/esp-bsp.h"
static badge_view_t fixture;
static lv_display_t *host_display;
static lv_indev_t *host_input;
static unsigned host_brightness=75, guide_saved;
static unsigned mock_pet_calls, mock_bond_calls;
static uint16_t draw_buffer[466*466], framebuffer[466*466];
static void flush(lv_display_t *display,const lv_area_t *area,uint8_t *pixels)
{
    unsigned width=(unsigned)(area->x2-area->x1+1);
    for(int y=area->y1;y<=area->y2;y++)
        memcpy(framebuffer+y*466+area->x1,pixels+(y-area->y1)*width*2,width*2);
    lv_display_flush_ready(display);
}
static void pointer_read(lv_indev_t *input,lv_indev_data_t *data)
{ (void)input; data->state=LV_INDEV_STATE_RELEASED; data->point=(lv_point_t){233,233}; }
lv_display_t *bsp_display_start(void)
{
    host_display=lv_display_create(466,466);
    lv_display_set_color_format(host_display,LV_COLOR_FORMAT_RGB565);
    lv_display_set_buffers(host_display,draw_buffer,NULL,sizeof(draw_buffer),LV_DISPLAY_RENDER_MODE_FULL);
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
{static const esp_app_desc_t a={.version="0.2.0"};return &a;}
void badge_get_view(badge_view_t *out) {*out=fixture;}
void badge_message(const char *message) {snprintf(fixture.message,sizeof(fixture.message),"%s",message);}
esp_err_t badge_pet(void) {mock_pet_calls++;fixture.pending++;return ESP_OK;}
esp_err_t badge_retry_blocked(void) {fixture.blocked=0;return ESP_OK;}
bool badge_ble_clear_bonds(void) {mock_bond_calls++;return true;}
esp_err_t nvs_open(const char *n,int mode,nvs_handle_t *h) {(void)n;(void)mode;*h=1;return ESP_OK;}
esp_err_t nvs_get_u8(nvs_handle_t h,const char *k,uint8_t *v) {(void)h;(void)k;*v=guide_saved;return guide_saved?ESP_OK:ESP_ERR_NVS_NOT_FOUND;}
esp_err_t nvs_set_u8(nvs_handle_t h,const char *k,uint8_t v) {(void)h;(void)k;guide_saved=v;return ESP_OK;}
esp_err_t nvs_commit(nvs_handle_t h) {(void)h;return ESP_OK;}
void nvs_close(nvs_handle_t h) {(void)h;}

/* No production preprocessor overrides or replacements below this line. */
#include "../../main/badge_pages.c"

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
    if(!strcmp(name,"pair_secure"))fixture.connected=fixture.secure=true;
    if(!strcmp(name,"pair_passkey")){fixture.connected=fixture.pairing=true;fixture.passkey=123456;}
    if(!strcmp(name,"storage_error"))fixture.storage_error=true;
    if(!strcmp(name,"main_low_stats"))fixture.snapshot.food=20;
    if(!strcmp(name,"device")){fixture.pending=200;fixture.blocked=3;}
    guide_saved=1;
}
static void choose(const char *name,const char *clip,int frame)
{
    if(!strcmp(name,"boot")){advance(100);return;}
    if(!strncmp(name,"pair",4)&&strcmp(name,"pair_reset")){select_page(PAGE_PAIR);return;}
    if(!strncmp(name,"guide_",6)){select_page(PAGE_GUIDE);guide_index=(unsigned)atoi(name+6)-1;assert(guide_index<5);update_guide();}
    else if(!strcmp(name,"care_menu"))select_page(PAGE_CARE);
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
        if(!strcmp(name,"main_b"))swipe(BADGE_GESTURE_LEFT);
        if(!strcmp(name,"main_c")){swipe(BADGE_GESTURE_LEFT);advance(260);swipe(BADGE_GESTURE_LEFT);}
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
int main(int argc,char **argv)
{
    if(argc<3){fprintf(stderr,"usage: %s CASE OUTPUT_STEM [CLIP FRAME]\n",argv[0]);return 2;}
    make_fixture(argv[1]);lv_init();lv_tick_inc(1000);
    if(!badge_ui_start()){fprintf(stderr,"Host UI initialization failed\n");return 1;}choose(argv[1],argc>3?argv[3]:NULL,argc>4?atoi(argv[4]):0);
    lv_obj_invalidate(lv_screen_active());lv_refr_now(host_display);
    char path[4096];snprintf(path,sizeof(path),"%s.rgb565",argv[2]);FILE *f=fopen(path,"wb");assert(f);
    if(fwrite(framebuffer,2,466*466,f)!=466*466)return 1;fclose(f);
    snprintf(path,sizeof(path),"%s.json",argv[2]);f=fopen(path,"w");assert(f);
    fprintf(f,"{\"offline\":true,\"production_source_included\":\"firmware/main/badge_pages.c\",\"case\":");quote(f,argv[1]);
    fprintf(f,",\"page_index\":%u,\"face\":%u,\"brightness_stub_percent\":%u,\"mock_pet_calls\":%u,\"mock_bond_calls\":%u,\"labels\":[",current_page,face,host_brightness,mock_pet_calls,mock_bond_calls);
    inspect(f,lv_screen_active(),false);inspect(f,lv_layer_top(),false);
    fprintf(f,"],\"missing_glyph_count\":%u,\"animation_bank_available\":%s}\n",missing_glyphs,badge_scene_has_animation(home_scene)?"true":"false");fclose(f);
    return 0;
}
