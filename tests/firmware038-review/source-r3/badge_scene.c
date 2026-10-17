#include "badge_scene.h"
#include "badge_ui_contract.h"
#include <stdlib.h>
#include <string.h>
#include "src/misc/cache/instance/lv_image_cache.h"
#ifdef ESP_PLATFORM
#include "esp_heap_caps.h"
#endif

LV_IMAGE_DECLARE(cat_idle);
LV_IMAGE_DECLARE(cat_paw);

struct badge_scene {
    lv_obj_t *root, *cat,*weather[8],*ground[5];
    const badge_scene_assets_t *assets;
    badge_scene_clip_id_t clip;
    badge_scene_clip_id_t pending;
    uint32_t started;
    uint16_t frame;
    unsigned face;
    bool frozen,compact;
    bool world,overlay; int slide_x;
    bool known,live;
    bool context_initialized;
    l2_scene_t stage;
    l2_weather_t weather_kind;
    l2_action_t action;
    lv_image_dsc_t small;
    uint8_t *small_pixels;
};
static badge_scene_clip_id_t base_clip(const badge_scene_t *s)
{
    if(!s->known || !s->live) return BADGE_SCENE_IDLE;
    if(s->action==L2_ACTION_PET || s->action==L2_ACTION_FEED || s->action==L2_ACTION_WATER || s->action==L2_ACTION_BATH) return BADGE_SCENE_PET;
    if(s->action==L2_ACTION_WALK || s->action==L2_ACTION_PLAY || s->stage==L2_SCENE_DEPARTING || s->stage==L2_SCENE_RETURNING) return BADGE_SCENE_WALK;
    return BADGE_SCENE_IDLE;
}
static lv_obj_t *shape(lv_obj_t *parent,int x,int y,int w,int h,uint32_t color,int radius)
{
    lv_obj_t *o=lv_obj_create(parent); lv_obj_remove_style_all(o);
    lv_obj_set_pos(o,x,y); lv_obj_set_size(o,w,h);
    lv_obj_set_style_bg_color(o,lv_color_hex(color),0); lv_obj_set_style_bg_opa(o,LV_OPA_COVER,0);
    lv_obj_set_style_radius(o,radius,0);
    lv_obj_remove_flag(o,LV_OBJ_FLAG_CLICKABLE|LV_OBJ_FLAG_SCROLLABLE); return o;
}
static const badge_scene_clip_t *clip_for(const badge_scene_t *s,badge_scene_clip_id_t id)
{
    if(!s->assets || id>=BADGE_SCENE_CLIP_COUNT) return NULL;
    const badge_scene_clip_t *c=&s->assets->clips[id];
    return c->frames && c->count && c->cycle_ms ? c : NULL;
}
static void set_frame(badge_scene_t *s,uint16_t frame)
{
    const badge_scene_clip_t *c=clip_for(s,s->clip);
    const lv_image_dsc_t *image=c ? c->frames[frame<c->count ? frame : 0] : s->clip==BADGE_SCENE_PET ? &cat_paw : &cat_idle;
    if(!image) image=&cat_idle;
    bool reduced=s->compact || s->face;
    if(reduced && image->header.cf==LV_COLOR_FORMAT_I8) {
        /* LVGL's indexed transform path is not portable across draw units. Keep
         * exact source palette/alpha, resample indices once per displayed frame,
         * then draw an ordinary unscaled I8 descriptor. No new character artwork. */
        unsigned w=image->header.w*3/4,h=image->header.h*3/4;
        size_t bytes=1024u+(size_t)w*h;
        if(!s->small_pixels) {
#ifdef ESP_PLATFORM
            s->small_pixels=heap_caps_malloc(bytes,MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
#else
            s->small_pixels=malloc(bytes);
#endif
        }
        if(s->small_pixels) {
            lv_image_cache_drop(&s->small);
            memcpy(s->small_pixels,image->data,1024);
            for(unsigned y=0;y<h;y++)for(unsigned x=0;x<w;x++)s->small_pixels[1024+y*w+x]=image->data[1024+(y*4/3)*image->header.stride+x*4/3];
            s->small=(lv_image_dsc_t){.header={.magic=LV_IMAGE_HEADER_MAGIC,.cf=LV_COLOR_FORMAT_I8,.w=w,.h=h,.stride=w},.data_size=bytes,.data=s->small_pixels};
            image=&s->small;
        }
    }
    lv_image_set_scale(s->cat,256);lv_image_set_antialias(s->cat,false);
    lv_image_set_src(s->cat,image); s->frame=frame;
    /* Shared absolute foot placement. Fallback has its original 200x180 canvas. */
    int x=233-(int)image->header.w/2;
    int anchor=image->header.h==208 ? 196 : image->header.h==156 ? 147 : (int)image->header.h;
    int y=(s->compact ? 260 : s->face ? 320 : 340)-anchor;
    /* Rest is a static tuck-in composition using the original upright head. */
    lv_obj_set_pos(s->cat,x+s->slide_x,y);
}
/* Static native drawing: no image caches, new LVGL objects, timers or DMA. */
static void world_rect(lv_layer_t *layer,const lv_area_t *root,int x,int y,int w,int h,uint32_t color,int radius)
{
    lv_draw_rect_dsc_t d;lv_draw_rect_dsc_init(&d);d.bg_color=lv_color_hex(color);d.bg_opa=LV_OPA_COVER;d.radius=radius;
    lv_area_t a={root->x1+x,root->y1+y,root->x1+x+w-1,root->y1+y+h-1};lv_draw_rect(layer,&d,&a);
}
static void world_draw(lv_event_t *e)
{
    badge_scene_t *s=lv_event_get_user_data(e);if(!s->world||s->overlay)return;
    lv_layer_t *layer=lv_event_get_layer(e);lv_area_t a;lv_obj_get_coords(s->root,&a);
    bool rest=s->known&&s->action==L2_ACTION_SLEEP;
    if(lv_event_get_code(e)==LV_EVENT_DRAW_POST){
        if(!rest)return;
        /* Static tuck-in composition, not a new lying/closed-eye animation. */
        int bottom=s->face?375:408;
        world_rect(layer,&a,0,bottom,466,466-bottom,0x14121c,0);
        world_rect(layer,&a,119,285,228,bottom-285,0x4d3b36,12);
        world_rect(layer,&a,128,289,210,bottom-301,0x76666e,9);
        world_rect(layer,&a,137,291,192,12,0xa29299,4);
        world_rect(layer,&a,146,325,36,3,0x92808a,1);
        world_rect(layer,&a,278,344,34,3,0x92808a,1);return;
    }
    if(rest){
        world_rect(layer,&a,335,167,25,25,0xb8ae8a,12);
        world_rect(layer,&a,345,163,22,24,0x14121c,12);
        world_rect(layer,&a,148,271,170,30,0xb0a090,10);return;
    }
    if(!s->known||!s->live){world_rect(layer,&a,164,345,138,2,0x28272b,1);return;}
    bool away=s->stage!=L2_SCENE_HOME;
    if(away){
        world_rect(layer,&a,87,345,292,2,0x31453b,1);
        for(unsigned i=0;i<4;i++){world_rect(layer,&a,91+(int)i*73,326,3,19,0x415746,1);world_rect(layer,&a,96+(int)i*73,333,3,12,0x415746,1);}
        world_rect(layer,&a,344,167,22,22,0x6f7253,10);
    }else{
        world_rect(layer,&a,80,160,60,75,0x3d3b3b,5);
        world_rect(layer,&a,85,165,50,65,0x354951,2);
        world_rect(layer,&a,108,165,4,65,0x665c50,0);
        world_rect(layer,&a,85,197,50,3,0x665c50,0);
        world_rect(layer,&a,130,343,206,3,0x514339,1);
        world_rect(layer,&a,104,363,72,2,0x302922,0);
        world_rect(layer,&a,290,363,72,2,0x302922,0);
    }
}
void badge_scene_enable_world(badge_scene_t *s)
{
    if(!s||s->world)return;
    s->world=true;
    lv_obj_add_event_cb(s->root,world_draw,LV_EVENT_DRAW_MAIN,s);
    lv_obj_add_event_cb(s->root,world_draw,LV_EVENT_DRAW_POST,s);
    lv_obj_invalidate(s->root);
}
void badge_scene_set_overlay(badge_scene_t *s,bool overlay)
{
    if(!s||s->overlay==overlay)return;
    s->overlay=overlay;
    lv_obj_set_style_bg_opa(s->root,overlay?LV_OPA_TRANSP:LV_OPA_COVER,0);
    for(unsigned i=0;i<8;i++)if(overlay)lv_obj_add_flag(s->weather[i],LV_OBJ_FLAG_HIDDEN);
    for(unsigned i=0;i<5;i++)if(overlay)lv_obj_add_flag(s->ground[i],LV_OBJ_FLAG_HIDDEN);
}
void badge_scene_set_slide_offset(badge_scene_t *s,int dx)
{
    if(!s||s->slide_x==dx)return;
    int delta=dx-s->slide_x;s->slide_x=dx;lv_obj_set_x(s->cat,lv_obj_get_x(s->cat)+delta);
}
badge_scene_t *badge_scene_create(lv_obj_t *parent)
{
    badge_scene_t *s=calloc(1,sizeof(*s)); if(!s) return NULL;
    s->assets=badge_game_assets();
    /* Reference-first: pure black, cat only. A room descriptor may be exported
     * for a separately reviewed enhancement but is deliberately not displayed. */
    s->root=shape(parent,0,0,466,466,ZIP_UI_COLOR_BG,0);
    for(unsigned i=0;i<8;i++) {
        s->weather[i]=shape(s->root,75+(i*47)%315,120+(i*31)%180,3,10,0x8FC7E0,2);
        lv_obj_add_flag(s->weather[i],LV_OBJ_FLAG_HIDDEN);
    }
    for(unsigned i=0;i<5;i++) {
        s->ground[i]=shape(s->root,122+i*46,345,25,2,0x443629,1);
        lv_obj_add_flag(s->ground[i],LV_OBJ_FLAG_HIDDEN);
    }
    s->cat=lv_image_create(s->root); lv_obj_remove_flag(s->cat,LV_OBJ_FLAG_CLICKABLE);
    set_frame(s,0); return s;
}
void badge_scene_set_face(badge_scene_t *s,unsigned face)
{
    if(!s) return;
    s->face=face%3;
    set_frame(s,s->frame);
}
void badge_scene_set_compact(badge_scene_t *s,bool compact)
{
    if(!s) return;
    s->compact=compact; set_frame(s,s->frame);
}
void badge_scene_play(badge_scene_t *s,badge_scene_clip_id_t clip,uint32_t now)
{
    if(!s || clip>=BADGE_SCENE_CLIP_COUNT) return;
    const badge_scene_clip_t *current=clip_for(s,s->clip);
    bool busy=s->clip!=BADGE_SCENE_IDLE && now-s->started<(current ? current->cycle_ms : 650);
    /* A fast real ACK must not replace the first paw frame before it is visible.
     * This is only a bounded visual continuation; no event is generated/replayed. */
    if(busy && s->clip==BADGE_SCENE_PET && clip!=BADGE_SCENE_PET && clip!=BADGE_SCENE_IDLE) {
        if(clip==BADGE_SCENE_ATTENTION) s->pending=clip;
        return;
    }
    if(busy && s->clip==BADGE_SCENE_ATTENTION && clip==BADGE_SCENE_WALK) return;
    s->clip=clip; s->started=now; set_frame(s,0);
}
void badge_scene_tick(badge_scene_t *s,uint32_t now,bool animate)
{
    if(!s) return;
    /* Freeze source time rather than skipping an unseen reaction during AOD. */
    if(!animate) { s->frozen=true; return; }
    if(s->world && s->action==L2_ACTION_SLEEP)return;
    if(s->frozen) { s->frozen=false; s->clip=base_clip(s);s->pending=BADGE_SCENE_IDLE; s->started=now; set_frame(s,0); }
    if(s->known && s->live) {
        if(s->weather_kind!=L2_WEATHER_CLEAR) for(unsigned i=0;i<8;i++) {
            int y=120+(int)((now/(s->weather_kind==L2_WEATHER_SNOW ? 45 : 12)+i*31)%190);
            lv_obj_set_y(s->weather[i],y);
        }
        if(s->stage==L2_SCENE_DEPARTING || s->stage==L2_SCENE_RETURNING) for(unsigned i=0;i<5;i++) {
            int delta=(int)((now/40)%46); if(s->stage==L2_SCENE_RETURNING) delta=-delta;
            lv_obj_set_x(s->ground[i],110+(int)i*46+delta);
        }
    }
    const badge_scene_clip_t *c=clip_for(s,s->clip);
    uint32_t elapsed=now-s->started;
    if(!c) {
        if(s->clip!=BADGE_SCENE_IDLE && elapsed>=650) {
            badge_scene_clip_id_t next=s->pending==BADGE_SCENE_IDLE ? base_clip(s) : s->pending; s->pending=BADGE_SCENE_IDLE; badge_scene_play(s,next,now);
        }
        return;
    }
    if((!c->loop || s->clip!=base_clip(s)) && elapsed>=c->cycle_ms) {
        if(!c->loop && s->clip==base_clip(s) && s->pending==BADGE_SCENE_IDLE) {if(s->frame!=c->count-1)set_frame(s,c->count-1);return;}
        badge_scene_clip_id_t next=s->pending==BADGE_SCENE_IDLE ? base_clip(s) : s->pending; s->pending=BADGE_SCENE_IDLE; badge_scene_play(s,next,now); return;
    }
    uint16_t frame=(uint16_t)(((uint64_t)(elapsed%c->cycle_ms)*c->count)/c->cycle_ms);
    if(frame!=s->frame) set_frame(s,frame);
}
void badge_scene_set_dimmed(badge_scene_t *s,bool dimmed)
{
    /* BSP brightness is the single brightness transform (35% in AOD). */
    if(s && dimmed) s->frozen=true;
}
bool badge_scene_has_animation(const badge_scene_t *s)
{
    if(!s) return false;
    for(unsigned i=0;i<BADGE_SCENE_CLIP_COUNT;i++) { const badge_scene_clip_t *c=clip_for(s,(badge_scene_clip_id_t)i); if(!c || c->count<2) return false; }
    return true;
}
void badge_scene_set_context(badge_scene_t *s,bool known,l2_scene_t stage,l2_weather_t weather,l2_action_t action,bool live)
{
    if(!s) return;
    /* A style write invalidates even an identical LVGL value. The root covers
     * the whole display: avoid repainting it on every 250 ms state poll. First
     * call and every context component (including weather) must still apply. */
    if(s->context_initialized && s->known==known && s->live==live &&
       s->stage==stage && s->weather_kind==weather && s->action==action) return;
    s->context_initialized=true;
    bool changed=s->known!=known || s->live!=live || s->stage!=stage || s->action!=action;
    s->known=known;s->live=live;s->stage=stage;s->weather_kind=weather;s->action=action;
    uint32_t bg= !known || !live ? ZIP_UI_COLOR_BG : stage==L2_SCENE_HOME ? 0x17130f : 0x101b18;
    if(s->world && known && action==L2_ACTION_SLEEP)bg=0x14121c;
    lv_obj_set_style_bg_color(s->root,lv_color_hex(bg),0);
    for(unsigned i=0;i<8;i++) {
        bool show=known && live && !s->overlay && weather!=L2_WEATHER_CLEAR;
        if(show) lv_obj_remove_flag(s->weather[i],LV_OBJ_FLAG_HIDDEN);else lv_obj_add_flag(s->weather[i],LV_OBJ_FLAG_HIDDEN);
        lv_obj_set_size(s->weather[i],weather==L2_WEATHER_SNOW ? 4 : 2,weather==L2_WEATHER_SNOW ? 4 : 10);
        lv_obj_set_style_bg_color(s->weather[i],lv_color_hex(weather==L2_WEATHER_SNOW ? 0xd5e3ea : 0x629ab0),0);
    }
    for(unsigned i=0;i<5;i++) {
        if(known && live && !s->overlay && (stage==L2_SCENE_DEPARTING || stage==L2_SCENE_RETURNING)) lv_obj_remove_flag(s->ground[i],LV_OBJ_FLAG_HIDDEN);
        else lv_obj_add_flag(s->ground[i],LV_OBJ_FLAG_HIDDEN);
    }
    lv_obj_set_style_image_opa(s->cat,LV_OPA_COVER,0);
    if(changed) {s->pending=BADGE_SCENE_IDLE;s->clip=base_clip(s);s->started=lv_tick_get();set_frame(s,0);}
}
