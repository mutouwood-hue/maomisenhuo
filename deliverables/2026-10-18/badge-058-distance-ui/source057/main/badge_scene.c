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
LV_IMAGE_DECLARE(warm_room);

struct badge_scene {
    lv_obj_t *root, *cat,*weather[8],*ground[5];
    const badge_scene_assets_t *assets;
    badge_scene_clip_id_t clip;
    badge_scene_clip_id_t pending;
    uint32_t started;
    uint16_t frame;
    unsigned face;
    bool frozen,compact,dimmed;
    bool interacting,prop_look;
    bool day_preview,day_known;unsigned day_kind,day_token;
    uint32_t prop_ms,prop_previous;
    int prop_offset;
    bool world,overlay; int slide_x;
    bool known,live;
    bool context_initialized;
    l2_scene_t stage;
    l2_weather_t weather_kind;
    l2_action_t action;
    lv_image_dsc_t small;
    uint8_t *small_pixels;
    struct badge_scene *checkpoint;
    uint32_t checkpoint_ms;
};
bool badge_scene_is_warm(const badge_scene_t *s)
{
 return s&&s->world&&(!s->face||s->day_preview)&&!s->overlay&&!s->dimmed&&!(s->known&&s->action==L2_ACTION_SLEEP)&&!(s->known&&s->stage!=L2_SCENE_HOME);
}
static bool garden_scene(const badge_scene_t *s)
{
 return s&&s->world&&(!s->face||s->day_preview)&&!s->overlay&&!s->dimmed&&s->known&&s->stage!=L2_SCENE_HOME&&s->stage!=L2_SCENE_TOWN&&s->action!=L2_ACTION_SLEEP;
}
static bool town_scene(const badge_scene_t *s)
{
 return s&&s->world&&(!s->face||s->day_preview)&&!s->overlay&&!s->dimmed&&s->known&&s->stage==L2_SCENE_TOWN&&s->action!=L2_ACTION_SLEEP;
}
bool badge_scene_light_background(const badge_scene_t *s)
{
 if(s&&s->day_preview)return !s->dimmed&&s->action!=L2_ACTION_SLEEP;
 return badge_scene_is_warm(s)||garden_scene(s)||town_scene(s)||(s&&s->world&&s->face==1&&!s->overlay&&!s->dimmed);
}
bool badge_scene_thought_visible(const badge_scene_t *s,uint32_t now)
{
 return s&&s->known&&s->live&&badge_scene_light_background(s)&&s->clip==BADGE_SCENE_IDLE&&s->action==L2_ACTION_IDLE&&(now-s->started)%8000>=2000&&(now-s->started)%8000<3800;
}
static badge_scene_clip_id_t base_clip(const badge_scene_t *s)
{
    if(!s->known) return BADGE_SCENE_IDLE;
    if(s->action==L2_ACTION_PET || s->action==L2_ACTION_BATH) return BADGE_SCENE_PET;
    if(s->action==L2_ACTION_FEED || s->action==L2_ACTION_WATER) return BADGE_SCENE_ATTENTION;
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
    bool reduced=s->compact || s->face || s->dimmed;
    unsigned num=s->dimmed?1:3,den=s->dimmed?2:4;
    if(reduced && image->header.cf==LV_COLOR_FORMAT_I8) {
        /* LVGL's indexed transform path is not portable across draw units. Keep
         * exact source palette/alpha, resample indices once per displayed frame,
         * then draw an ordinary unscaled I8 descriptor. No new character artwork. */
        unsigned w=image->header.w*num/den,h=image->header.h*num/den;
        size_t bytes=1024u+(size_t)w*h;
        if(!s->small_pixels) {
#ifdef ESP_PLATFORM
            s->small_pixels=heap_caps_malloc(1024u+192u*208u*9u/16u,MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
#else
            s->small_pixels=malloc(1024u+192u*208u*9u/16u);
#endif
        }
        if(s->small_pixels) {
            lv_image_cache_drop(&s->small);
            memcpy(s->small_pixels,image->data,1024);
            for(unsigned y=0;y<h;y++)for(unsigned x=0;x<w;x++)s->small_pixels[1024+y*w+x]=image->data[1024+(y*den/num)*image->header.stride+x*den/num];
            s->small=(lv_image_dsc_t){.header={.magic=LV_IMAGE_HEADER_MAGIC,.cf=LV_COLOR_FORMAT_I8,.w=w,.h=h,.stride=w},.data_size=bytes,.data=s->small_pixels};
            image=&s->small;
        }
    }
    lv_image_set_scale(s->cat,256);lv_image_set_antialias(s->cat,false);
    lv_image_set_src(s->cat,image); s->frame=frame;
    /* Shared absolute foot placement. Fallback has its original 200x180 canvas. */
    int x=233-(int)image->header.w/2;
    int anchor=image->header.h==208 ? 196 : image->header.h==156 ? 147 : image->header.h==104 ? 98 : (int)image->header.h;
    int foot=s->dimmed?318:s->compact?260:(garden_scene(s)||town_scene(s))?(s->face?345:378):s->face?320:badge_scene_light_background(s)?350:340;
    int y=foot-anchor;
    if(garden_scene(s)){lv_area_t shadow={70,foot-7,395,foot+8};lv_obj_invalidate_area(s->root,&shadow);}
    /* Rest is a static tuck-in composition using the original upright head. */
    lv_obj_set_pos(s->cat,x+s->slide_x+s->prop_offset,y);
    bool resting=s->world&&s->known&&s->action==L2_ACTION_SLEEP;
    bool absent=s->day_preview&&!s->day_known&&!s->dimmed;
    if(resting||absent)lv_obj_add_flag(s->cat,LV_OBJ_FLAG_HIDDEN);else lv_obj_remove_flag(s->cat,LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_style_image_opa(s->cat,s->dimmed?110:LV_OPA_COVER,0);
}
void badge_scene_set_interacting(badge_scene_t *s,bool active)
{
 if(!s)return;
 s->interacting=active;s->prop_previous=0;
}
bool badge_scene_save_pose(badge_scene_t *s)
{
 if(!s)return false;
 if(!s->checkpoint)s->checkpoint=malloc(sizeof(*s));
 if(!s->checkpoint)return false;
 *s->checkpoint=*s;s->checkpoint_ms=lv_tick_get();return true;
}
void badge_scene_restore_pose(badge_scene_t *s)
{
 if(!s||!s->checkpoint)return;
 badge_scene_t *saved=s->checkpoint;uint8_t *pixels=s->small_pixels;
 uint32_t paused=lv_tick_get()-s->checkpoint_ms;
 *s=*saved;s->checkpoint=saved;s->small_pixels=pixels;s->started+=paused;
 s->prop_previous=0;set_frame(s,s->frame);lv_obj_invalidate(s->root);
}
int badge_scene_prop_offset(const badge_scene_t *s){return s?s->prop_offset:0;}
void badge_scene_cancel_prop(badge_scene_t *s)
{
 if(!s)return;
 s->prop_ms=0;s->prop_previous=0;s->prop_offset=0;s->prop_look=false;set_frame(s,s->frame);
}
static bool prop_interaction(badge_scene_t *s,uint32_t now)
{
 bool eligible=!s->face&&badge_scene_light_background(s)&&s->known&&s->live&&s->action==L2_ACTION_IDLE&&(s->stage==L2_SCENE_HOME||s->stage==L2_SCENE_AWAY||s->stage==L2_SCENE_GARDEN||s->stage==L2_SCENE_TOWN)&&s->clip==BADGE_SCENE_IDLE;
 if(!eligible){s->prop_ms=0;s->prop_previous=0;s->prop_look=false;if(s->prop_offset){s->prop_offset=0;set_frame(s,s->frame);}return false;}
 if(s->interacting){s->prop_previous=0;return true;}
 uint32_t dt=s->prop_previous?now-s->prop_previous:0;s->prop_previous=now;if(dt>100)dt=100;
 const badge_scene_clip_t *attention=clip_for(s,BADGE_SCENE_ATTENTION);uint32_t look=attention?attention->cycle_ms:650;
 const uint32_t walk=1500,pause=2000,rest=4000,total=pause+walk+look+walk+rest;
 s->prop_ms=(s->prop_ms+dt)%total;uint32_t t=s->prop_ms;int target=s->stage==L2_SCENE_TOWN?24:s->stage==L2_SCENE_AWAY||s->stage==L2_SCENE_GARDEN?68:-58;badge_scene_clip_id_t visual=BADGE_SCENE_IDLE;uint32_t elapsed=t;s->prop_look=false;int offset=0;
 if(t>=pause&&t<pause+walk){visual=BADGE_SCENE_WALK;elapsed=t-pause;offset=(int)((int64_t)target*elapsed/walk);}
 else if(t>=pause+walk&&t<pause+walk+look){visual=BADGE_SCENE_ATTENTION;elapsed=t-pause-walk;offset=target;s->prop_look=true;}
 else if(t>=pause+walk+look&&t<pause+2*walk+look){visual=BADGE_SCENE_WALK;elapsed=t-pause-walk-look;s->prop_look=elapsed<500;offset=(int)((int64_t)target*(walk-elapsed)/walk);}
 const badge_scene_clip_t *c=clip_for(s,visual);if(!c)return false;
 uint16_t frame=(uint16_t)(((uint64_t)(elapsed%c->cycle_ms)*c->count)/c->cycle_ms);
 if(offset!=s->prop_offset||frame!=s->frame||lv_image_get_src(s->cat)!=c->frames[frame]){badge_scene_clip_id_t original=s->clip;s->prop_offset=offset;s->clip=visual;set_frame(s,frame);s->clip=original;}
 return true;
}
/* Static native drawing: no image caches, new LVGL objects, timers or DMA. */
static void world_rect(lv_layer_t *layer,const lv_area_t *root,int x,int y,int w,int h,uint32_t color,int radius)
{
    lv_draw_rect_dsc_t d;lv_draw_rect_dsc_init(&d);d.bg_color=lv_color_hex(color);d.bg_opa=LV_OPA_COVER;d.radius=radius;
    lv_area_t a={root->x1+x,root->y1+y,root->x1+x+w-1,root->y1+y+h-1};lv_draw_rect(layer,&d,&a);
}
/* A compact native voxel curl, only for an actual accepted SLEEP context.
 * Orange/cream blocks, tucked paws and closed eyes retain the existing cat's
 * visual language. This is presentation geometry, never a game-state change. */
static void sleeping_cat(lv_layer_t *layer,const lv_area_t *a,bool dimmed)
{
    int x=dimmed?183:155,y=dimmed?250:247,k=dimmed?2:3;
    uint32_t orange=dimmed?0x57321c:0xd97a2d,light=dimmed?0x6c4226:0xf3a446;
    uint32_t stripe=dimmed?0x35251b:0x98502b,cream=dimmed?0x716453:0xf8dfb6;
#define B(dx,dy,w,h,c) world_rect(layer,a,x+(dx)*k,y+(dy)*k,(w)*k,(h)*k,c,0)
    B(2,12,30,18,orange);B(7,7,20,8,light);B(0,20,10,10,orange);
    B(5,12,4,7,stripe);B(14,8,4,8,stripe);B(24,12,4,8,stripe);
    B(25,15,24,18,light);B(26,10,6,8,orange);B(41,11,6,8,orange);
    B(28,12,3,4,cream);B(42,13,3,4,cream);B(27,19,6,3,stripe);B(42,19,6,3,stripe);
    B(29,23,6,2,stripe);B(40,24,6,2,stripe);B(34,26,8,5,cream);
    B(37,25,2,2,dimmed?0x71504a:0xd98d85);B(27,31,9,3,cream);B(40,31,7,3,cream);
    B(0,27,14,6,light);B(9,29,13,4,light);B(17,25,5,6,light);B(18,23,4,4,stripe);
#undef B
    lv_draw_label_dsc_t d;lv_draw_label_dsc_init(&d);d.font=&lv_font_montserrat_20;
    d.color=lv_color_hex(dimmed?0x655d50:0xbdb79e);d.text="Z";
    lv_area_t z={a->x1+(dimmed?281:309),a->y1+(dimmed?257:248),a->x1+340,a->y1+280};
    lv_draw_label(layer,&d,&z);
}
static void world_draw(lv_event_t *e)
{
    badge_scene_t *s=lv_event_get_user_data(e);if(!s->world||s->overlay)return;
    lv_layer_t *layer=lv_event_get_layer(e);lv_area_t a;lv_obj_get_coords(s->root,&a);
    bool rest=(s->dimmed||!s->face||s->day_preview)&&s->known&&s->action==L2_ACTION_SLEEP;
    if(s->day_preview&&!s->day_known&&!s->dimmed){if(lv_event_get_code(e)==LV_EVENT_DRAW_MAIN)world_rect(layer,&a,0,0,466,466,0xeadfca,0);return;}
    if(lv_event_get_code(e)==LV_EVENT_DRAW_POST)return;
    if(s->dimmed){
        /* Device standby is independent of cat sleep. No leftover window,
         * timeline title, floor stripe, weather animation or fake night sky. */
        world_rect(layer,&a,0,0,466,466,0x000000,0);
        if(rest)sleeping_cat(layer,&a,true);
        else world_rect(layer,&a,197,316,72,5,0x15110e,3);
        return;
    }
    if(s->face==1&&!s->day_preview&&!s->dimmed){world_rect(layer,&a,0,0,466,466,0xead4b0,0);return;}
    if(badge_scene_is_warm(s)){
        lv_draw_image_dsc_t d;lv_draw_image_dsc_init(&d);d.src=&warm_room;lv_draw_image(layer,&d,&a);return;
    }
    if(town_scene(s)){
        /* Reuse the same native rectangle drawing and cat bank; no new assets
         * or live renderer. Distinct street fronts and river/bridge composition. */
        world_rect(layer,&a,0,0,466,466,0xc9dfdf,0);
        world_rect(layer,&a,0,252,466,214,0xb8b79b,0);
        const int bx[]={32,168,326},by[]={170,151,180},bw[]={108,124,106};
        for(unsigned i=0;i<3;i++){
            world_rect(layer,&a,bx[i],by[i],bw[i],118,0xe8d5b2,5);
            world_rect(layer,&a,bx[i]-5,by[i]-12,bw[i]+10,23,i==1?0x749592:0x9e7462,6);
            world_rect(layer,&a,bx[i]+15,by[i]+24,25,32,0x8eafb6,3);
            world_rect(layer,&a,bx[i]+62,by[i]+24,25,32,0x8eafb6,3);
            world_rect(layer,&a,bx[i]+42,by[i]+73,28,45,0x907a61,4);
        }
        world_rect(layer,&a,0,287,466,126,0xd9c7a7,0);
        for(unsigned i=0;i<6;i++)world_rect(layer,&a,31+74*i,316+(i%2)*24,44,3,0xc2af92,1);
        world_rect(layer,&a,0,413,466,53,0x84b6b8,0);
        world_rect(layer,&a,182,407,102,59,0xb79874,3);
        world_rect(layer,&a,177,406,8,60,0x977858,3);world_rect(layer,&a,281,406,8,60,0x977858,3);
        world_rect(layer,&a,384,246,5,89,0x756b56,2);world_rect(layer,&a,373,235,27,24,0xf2da9d,5);
        int foot=s->compact?260:s->face?345:378;
        world_rect(layer,&a,184+s->prop_offset+s->slide_x,foot-3,98,10,0xb4a17e,5);return;
    }
    if(garden_scene(s)){
        /* Static B garden silhouettes, original live scene gate; no new objects,
         * timers, domain state or realtime renderer. Cat remains original I8. */
        world_rect(layer,&a,0,0,466,466,0xcbe0dc,0);
        world_rect(layer,&a,48,165,82,23,0xf5f1df,12);
        world_rect(layer,&a,338,173,40,40,0xf4d49a,20);
        world_rect(layer,&a,0,249,466,217,0x85a46c,0);
        world_rect(layer,&a,0,227,114,84,0x66885b,38);
        world_rect(layer,&a,349,222,117,92,0x648359,40);
        world_rect(layer,&a,25,293,416,8,0xb69b74,2);
        for(unsigned i=0;i<7;i++)world_rect(layer,&a,44+(int)i*59,272,9,62,0xc8ad84,4);
        world_rect(layer,&a,94,326,280,101,0xc5b28b,42);
        world_rect(layer,&a,118,343,234,58,0xdaccaa,28);
        world_rect(layer,&a,65,208,7,114,0x8d7858,2);
        world_rect(layer,&a,48,211,41,48,0x6f5b43,5);
        world_rect(layer,&a,55,217,27,34,0xf3dca4,3);
        world_rect(layer,&a,67,217,3,34,0x9b7545,0);
        world_rect(layer,&a,47,205,43,7,0x756047,3);
        const int fx[]={89,109,335,385};const int fy[]={319,341,270,309};
        for(unsigned i=0;i<4;i++){
            world_rect(layer,&a,fx[i]+5,fy[i]+7,3,354-fy[i]-7,0x4d754e,1);
            world_rect(layer,&a,fx[i]-1,fy[i]+12,10,5,0x547f51,3);
            world_rect(layer,&a,fx[i],fy[i],13,13,0xf9f2dd,6);
            world_rect(layer,&a,fx[i]+4,fy[i]+4,5,5,0xe7bd71,2);
        }
        int foot=s->compact?260:s->face?345:378;
        world_rect(layer,&a,184+s->prop_offset+s->slide_x,foot-3,98,10,0xb4a17e,5);
        return;
    }
    if(rest){
        world_rect(layer,&a,0,0,466,466,0x1b202c,0);
        world_rect(layer,&a,0,324,466,142,0x222531,0);
        world_rect(layer,&a,73,142,86,117,0x343947,14);
        world_rect(layer,&a,80,150,72,101,0x252c3c,10);
        world_rect(layer,&a,113,151,5,99,0x464450,0);
        world_rect(layer,&a,81,197,69,5,0x464450,0);
        world_rect(layer,&a,138,344,200,26,0x35313c,13);
        world_rect(layer,&a,149,347,178,16,0x46404b,8);
        sleeping_cat(layer,&a,false);return;
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
    if(face%2==0){s->day_preview=false;lv_obj_remove_flag(s->cat,LV_OBJ_FLAG_HIDDEN);}
    if(s->face!=face%2)badge_scene_cancel_prop(s);
    s->face=face%2;
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
    if(s->world && (s->action==L2_ACTION_SLEEP||s->face))return;
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
    if(prop_interaction(s,now))return;
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
    if(!s||s->dimmed==dimmed)return;
    s->dimmed=dimmed;
    if(dimmed){s->frozen=true;s->prop_ms=0;s->prop_previous=0;s->prop_offset=0;s->prop_look=false;}
    for(unsigned i=0;i<8;i++){bool show=!dimmed&&s->known&&s->live&&!s->overlay&&s->weather_kind!=L2_WEATHER_CLEAR;if(show)lv_obj_remove_flag(s->weather[i],LV_OBJ_FLAG_HIDDEN);else lv_obj_add_flag(s->weather[i],LV_OBJ_FLAG_HIDDEN);}
    for(unsigned i=0;i<5;i++){bool show=!dimmed&&s->known&&s->live&&!s->overlay&&(s->stage==L2_SCENE_DEPARTING||s->stage==L2_SCENE_RETURNING);if(show)lv_obj_remove_flag(s->ground[i],LV_OBJ_FLAG_HIDDEN);else lv_obj_add_flag(s->ground[i],LV_OBJ_FLAG_HIDDEN);}
    set_frame(s,s->frame);lv_obj_invalidate(s->root);
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
        bool show=known && live && !s->overlay && !s->dimmed && weather!=L2_WEATHER_CLEAR;
        if(show) lv_obj_remove_flag(s->weather[i],LV_OBJ_FLAG_HIDDEN);else lv_obj_add_flag(s->weather[i],LV_OBJ_FLAG_HIDDEN);
        lv_obj_set_size(s->weather[i],weather==L2_WEATHER_SNOW ? 4 : 2,weather==L2_WEATHER_SNOW ? 4 : 10);
        lv_obj_set_style_bg_color(s->weather[i],lv_color_hex(weather==L2_WEATHER_SNOW ? 0xd5e3ea : 0x629ab0),0);
    }
    for(unsigned i=0;i<5;i++) {
        if(known && live && !s->overlay && !s->dimmed && (stage==L2_SCENE_DEPARTING || stage==L2_SCENE_RETURNING)) lv_obj_remove_flag(s->ground[i],LV_OBJ_FLAG_HIDDEN);
        else lv_obj_add_flag(s->ground[i],LV_OBJ_FLAG_HIDDEN);
    }
    lv_obj_set_style_image_opa(s->cat,s->dimmed?110:LV_OPA_COVER,0);
    if(changed) {s->prop_ms=0;s->prop_previous=0;s->prop_offset=0;s->prop_look=false;s->pending=BADGE_SCENE_IDLE;s->clip=base_clip(s);s->started=lv_tick_get();set_frame(s,0);}
}

/* Historical presentation only; never calls core/care/peer/wire. */
void badge_scene_day_preview(badge_scene_t *s,bool known,unsigned kind,unsigned minute)
{
 if(!s||s->face!=1)return;
 unsigned token=kind==5?minute%10:0;
 if(s->day_preview&&s->day_known==known&&s->day_kind==kind&&s->day_token==token)return;
 s->day_preview=true;s->day_known=known;s->day_kind=kind;s->day_token=token;
 s->prop_ms=0;s->prop_previous=0;s->prop_offset=0;s->prop_look=false;
 if(!known){badge_scene_set_context(s,false,L2_SCENE_HOME,L2_WEATHER_CLEAR,L2_ACTION_IDLE,false);lv_obj_add_flag(s->cat,LV_OBJ_FLAG_HIDDEN);lv_obj_invalidate(s->root);return;}
 lv_obj_remove_flag(s->cat,LV_OBJ_FLAG_HIDDEN);
 l2_scene_t stage=kind==3||kind==4||kind==5?L2_SCENE_AWAY:L2_SCENE_HOME;
 /* A human day segment labelled rest is not a pet SLEEP action. */
 l2_action_t action=kind==5?L2_ACTION_WALK:L2_ACTION_IDLE;
 badge_scene_set_context(s,true,stage,L2_WEATHER_CLEAR,action,true);
 s->clip=kind==2?BADGE_SCENE_ATTENTION:kind==5?BADGE_SCENE_WALK:BADGE_SCENE_IDLE;s->pending=BADGE_SCENE_IDLE;
 const badge_scene_clip_t*c=clip_for(s,s->clip);unsigned frame=kind==2&&c?c->count/2:kind==5&&c?minute%c->count:0;set_frame(s,(uint16_t)frame);lv_obj_invalidate(s->root);
}

void badge_scene_day_expectation(badge_scene_t *s)
{
 /* Presentation-only kind7 is neutral home/idle. It is not a wire day kind,
  * guessed event, reward, scene mutation or continuation of a history action. */
 badge_scene_day_preview(s,true,7,0);
}

void badge_scene_day_current(badge_scene_t *s,bool known,l2_scene_t stage,l2_weather_t weather,l2_action_t action,bool live)
{
 if(!s||s->face!=1)return;
 s->day_preview=true;s->day_known=known;s->day_kind=action==L2_ACTION_SLEEP?0:1;s->day_token=0;
 badge_scene_set_context(s,known,stage,weather,action,live);
 if(known&&action!=L2_ACTION_SLEEP)lv_obj_remove_flag(s->cat,LV_OBJ_FLAG_HIDDEN);else lv_obj_add_flag(s->cat,LV_OBJ_FLAG_HIDDEN);
}
