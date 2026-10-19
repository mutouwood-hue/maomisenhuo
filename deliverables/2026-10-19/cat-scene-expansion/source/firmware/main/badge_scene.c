#include "badge_scene.h"
#include "badge_ui_contract.h"
#include "scene_layout.generated.h"
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
    lv_obj_t *root, *cat,*shade,*weather[8],*ground[5];
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
    bool world,overlay; int slide_x,foot_y;
    bool known,live;
    bool context_initialized;
    l2_scene_t stage;
    l2_weather_t weather_kind;
    l2_action_t action;
    l2_interaction_t interaction;
    badge_appearance_t appearance;
    bool appearance_rendered;
    const lv_image_dsc_t *source_frame;
    lv_image_dsc_t small;
    uint8_t *small_pixels;
    struct badge_scene *checkpoint;
    uint32_t checkpoint_ms;
};
bool badge_scene_is_warm(const badge_scene_t *s)
{
 return s&&s->world&&(!s->face||s->day_preview)&&!s->overlay&&!(s->known&&s->stage!=L2_SCENE_HOME);
}
static bool garden_scene(const badge_scene_t *s)
{
 return s&&s->world&&(!s->face||s->day_preview)&&!s->overlay&&s->known&&s->stage!=L2_SCENE_HOME&&s->stage!=L2_SCENE_TOWN;
}
static bool town_scene(const badge_scene_t *s)
{
 return s&&s->world&&(!s->face||s->day_preview)&&!s->overlay&&s->known&&s->stage==L2_SCENE_TOWN;
}
bool badge_scene_light_background(const badge_scene_t *s)
{
 if(s&&s->day_preview)return true;
 return badge_scene_is_warm(s)||garden_scene(s)||town_scene(s)||(s&&s->world&&s->face==1&&!s->overlay&&!s->dimmed);
}
bool badge_scene_thought_visible(const badge_scene_t *s,uint32_t now)
{
 return s&&s->known&&s->live&&badge_scene_light_background(s)&&s->clip==BADGE_SCENE_IDLE&&s->action==L2_ACTION_IDLE&&(now-s->started)%8000>=2000&&(now-s->started)%8000<3800;
}
static badge_scene_clip_id_t base_clip(const badge_scene_t *s)
{
    if(!s->known) return BADGE_SCENE_IDLE;
    if(s->action==L2_ACTION_PLAY&&s->interaction==L2_INTERACTION_FLOWER_SNIFF)return BADGE_SCENE_SNIFF;
    if(s->action==L2_ACTION_PLAY&&(s->interaction==L2_INTERACTION_BUTTERFLY_CHASE||s->interaction==L2_INTERACTION_BALL_POUNCE))return BADGE_SCENE_POUNCE;
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
static bool bed_sleep_anchor(const badge_scene_t *s)
{
    return s&&s->world&&s->known&&s->stage==L2_SCENE_HOME&&s->action==L2_ACTION_SLEEP&&s->interaction==L2_INTERACTION_BED_SLEEP;
}
static bool garden_action_anchor(const badge_scene_t *s)
{
    return s&&garden_scene(s)&&s->action==L2_ACTION_PLAY&&(s->interaction==L2_INTERACTION_FLOWER_SNIFF||s->interaction==L2_INTERACTION_BUTTERFLY_CHASE);
}
static int scene_anchor_x(const badge_scene_t *s)
{
    if(bed_sleep_anchor(s))return SCENE_LAYOUT_ROOM_BADGE_BED_FOOT_X;
    if(s&&s->world&&s->stage==L2_SCENE_HOME&&s->action==L2_ACTION_PLAY&&s->interaction==L2_INTERACTION_BALL_POUNCE)return SCENE_LAYOUT_ROOM_BADGE_CLIMB_FOOT_X;
    if(garden_action_anchor(s))return SCENE_LAYOUT_GARDEN_BADGE_FLOWER_RIGHT_X-52;
    return SCENE_LAYOUT_ROOM_BADGE_HOME_X;
}
static int scene_anchor_y(const badge_scene_t *s)
{
    if(s&&s->foot_y)return s->foot_y;
    if(s&&s->compact)return 260;
    if(bed_sleep_anchor(s))return SCENE_LAYOUT_ROOM_BADGE_BED_FOOT_Y;
    if(s&&s->world&&s->stage==L2_SCENE_HOME&&s->action==L2_ACTION_PLAY&&s->interaction==L2_INTERACTION_BALL_POUNCE)return SCENE_LAYOUT_ROOM_BADGE_CLIMB_FOOT_Y;
    if(garden_scene(s)||town_scene(s))return SCENE_LAYOUT_GARDEN_BADGE_FOOT_Y;
    if(badge_scene_light_background(s))return SCENE_LAYOUT_ROOM_BADGE_HOME_FOOT_Y;
    return 340;
}
static void set_frame(badge_scene_t *s,uint16_t frame)
{
    const badge_scene_clip_t *c=clip_for(s,s->clip);
    const lv_image_dsc_t *image=c ? c->frames[frame<c->count ? frame : 0] : s->clip==BADGE_SCENE_PET ? &cat_paw : &cat_idle;
    if(!image) image=&cat_idle;
    s->source_frame=image;
    s->appearance_rendered=false;
    if(((s->compact||s->appearance.known)&&image->header.cf==LV_COLOR_FORMAT_I8)||image->header.cf==LV_COLOR_FORMAT_RAW) {
        /* One fixed I8 workspace, also reused for compact scenes. Indexed
         * transforms remain CPU composition; LVGL receives an unscaled frame. */
        if(!s->small_pixels) {
#ifdef ESP_PLATFORM
            s->small_pixels=heap_caps_malloc(BADGE_APPEARANCE_BUFFER_BYTES,MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
#else
            s->small_pixels=malloc(BADGE_APPEARANCE_BUFFER_BYTES);
#endif
        }
        if(s->small_pixels) {
            lv_image_cache_drop(&s->small);
            if(badge_appearance_render(image,&s->appearance,s->compact,(unsigned)s->clip,frame,&s->small,s->small_pixels,BADGE_APPEARANCE_BUFFER_BYTES)) {
                image=&s->small;s->appearance_rendered=true;
            }
        }
    }
    if(image->header.cf==LV_COLOR_FORMAT_RAW)image=s->clip==BADGE_SCENE_PET?&cat_paw:&cat_idle;
    lv_image_set_scale(s->cat,256);lv_image_set_antialias(s->cat,false);
    lv_image_set_src(s->cat,image); s->frame=frame;
    /* Shared absolute foot placement. Fallback has its original 200x180 canvas. */
    int x=scene_anchor_x(s)-(int)image->header.w/2;
    int anchor=image->header.h==208 ? 196 : image->header.h==156 ? 147 : image->header.h==104 ? 98 : (int)image->header.h;
    int foot=scene_anchor_y(s);
    int y=foot-anchor;
    if(garden_scene(s)){lv_area_t shadow={70,foot-7,395,foot+8};lv_obj_invalidate_area(s->root,&shadow);}
    /* Rest has its own static curl; locking never selects that action. */
    lv_obj_set_pos(s->cat,x+s->slide_x+s->prop_offset,y);
    bool resting=s->world&&s->known&&s->action==L2_ACTION_SLEEP;
    bool absent=s->day_preview&&!s->day_known&&!s->dimmed;
    if(resting||absent)lv_obj_add_flag(s->cat,LV_OBJ_FLAG_HIDDEN);else lv_obj_remove_flag(s->cat,LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_style_image_opa(s->cat,s->dimmed?220:LV_OPA_COVER,0);
    if(s->shade){if(s->dimmed||resting)lv_obj_remove_flag(s->shade,LV_OBJ_FLAG_HIDDEN);else lv_obj_add_flag(s->shade,LV_OBJ_FLAG_HIDDEN);}
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
 bool eligible=!s->compact&&!s->face&&badge_scene_light_background(s)&&s->known&&s->live&&s->action==L2_ACTION_IDLE&&(s->stage==L2_SCENE_HOME||s->stage==L2_SCENE_AWAY||s->stage==L2_SCENE_GARDEN||s->stage==L2_SCENE_TOWN)&&s->clip==BADGE_SCENE_IDLE;
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
 if(offset!=s->prop_offset||frame!=s->frame||s->source_frame!=c->frames[frame]){badge_scene_clip_id_t original=s->clip;s->prop_offset=offset;s->clip=visual;set_frame(s,frame);s->clip=original;}
 return true;
}
/* Static native drawing: no image caches, new LVGL objects, timers or DMA. */
static void world_rect(lv_layer_t *layer,const lv_area_t *root,int x,int y,int w,int h,uint32_t color,int radius)
{
    lv_draw_rect_dsc_t d;lv_draw_rect_dsc_init(&d);d.bg_color=lv_color_hex(color);d.bg_opa=LV_OPA_COVER;d.radius=radius;
    lv_area_t a={root->x1+x,root->y1+y,root->x1+x+w-1,root->y1+y+h-1};lv_draw_rect(layer,&d,&a);
}
static int room_screen_x(float x)
{
    float value=SCENE_LAYOUT_ROOM_BADGE_HOME_X+(x-SCENE_LAYOUT_ROOM_BADGE_HOME_WORLD_X)*SCENE_LAYOUT_ROOM_BADGE_PX_PER_WORLD_X;
    return (int)(value+(value>=0?.5f:-.5f));
}
static int room_screen_y(float z,float height)
{
    float value=SCENE_LAYOUT_ROOM_BADGE_HOME_FOOT_Y-(z-SCENE_LAYOUT_ROOM_BADGE_HOME_WORLD_Z)*SCENE_LAYOUT_ROOM_BADGE_PX_PER_WORLD_Z-height*SCENE_LAYOUT_ROOM_BADGE_PX_PER_WORLD_Y;
    return (int)(value+(value>=0?.5f:-.5f));
}
static void room_scene(lv_layer_t *layer,const lv_area_t *a)
{
    const float scale=SCENE_LAYOUT_ROOM_XZ_SCALE;
    world_rect(layer,a,0,0,466,315,0xc4dfdb,0);
    world_rect(layer,a,0,315,466,151,0xf0e4ca,0);
    world_rect(layer,a,0,307,466,7,0xfff3d9,0);
    for(unsigned i=0;i<6;i++)world_rect(layer,a,22+(int)i*82,322,2,144,0xddc69d,0);
    for(unsigned i=0;i<3;i++)world_rect(layer,a,0,350+(int)i*42,466,2,0xe2cfaa,0);

    int wx=room_screen_x(-10.5f*scale),wy=room_screen_y(22.48f*scale,14.5f);
    int ww=(int)(13.5f*scale*6.0f+.5f),wh=56;
    world_rect(layer,a,wx-ww/2-8,wy-wh/2-8,ww+16,wh+16,0xfff3d9,4);
    world_rect(layer,a,wx-ww/2,wy-wh/2,ww,wh,0x72b9c3,2);
    world_rect(layer,a,wx-2,wy-wh/2,4,wh,0xfff3d9,0);
    world_rect(layer,a,wx-ww/2,wy-1,ww,3,0xfff3d9,0);
    world_rect(layer,a,wx-ww/2+10,wy-wh/2+13,30,7,0xf9fff2,1);

    int rug_x=room_screen_x(0),rug_y=room_screen_y(-2.0f*scale,.15f);
    world_rect(layer,a,rug_x-93,rug_y-25,186,50,0xe8cfae,4);
    world_rect(layer,a,rug_x-84,rug_y-17,168,34,0xf3e3c8,3);

    int bed_x=SCENE_LAYOUT_ROOM_BADGE_BED_FOOT_X,bed_y=SCENE_LAYOUT_ROOM_BADGE_BED_FOOT_Y;
    int bed_w=(int)(SCENE_LAYOUT_ROOM_BED_WIDTH*SCENE_LAYOUT_ROOM_BADGE_PX_PER_WORLD_X*-1+.5f);
    int bed_d=(int)(SCENE_LAYOUT_ROOM_BED_DEPTH*SCENE_LAYOUT_ROOM_BADGE_PX_PER_WORLD_Z+.5f);
    world_rect(layer,a,bed_x-bed_w/2,bed_y-bed_d/2+9,bed_w,bed_d,0x9a7460,3);
    world_rect(layer,a,bed_x-bed_w/2+5,bed_y-bed_d/2,bed_w-10,bed_d,0x718f98,2);
    world_rect(layer,a,bed_x-bed_w/2+8,bed_y-bed_d/2+4,bed_w-16,bed_d-8,0xefcda9,1);
    int pillow_x=room_screen_x(SCENE_LAYOUT_ROOM_BED_X-5.85f*scale);
    int pillow_y=room_screen_y(SCENE_LAYOUT_ROOM_BED_Z,2.45f);
    world_rect(layer,a,pillow_x-28,pillow_y-14,56,28,0xf0efe0,5);
    int blanket_x=room_screen_x(SCENE_LAYOUT_ROOM_BED_X+3.8f*scale);
    world_rect(layer,a,blanket_x-52,bed_y-19,104,36,0xd5a8a1,2);
    for(unsigned i=0;i<4;i++)world_rect(layer,a,blanket_x-42+(int)i*24,bed_y-18,2,34,0xefd3bb,0);

    int scratch_x=room_screen_x(14.0f*scale),scratch_z=room_screen_y(13.5f*scale,.5f);
    world_rect(layer,a,scratch_x-9,scratch_z-92,18,94,0xb99771,4);
    world_rect(layer,a,scratch_x-47,scratch_z-96,94,14,0x9a7460,3);
    int first_x=room_screen_x(8.8f*scale),first_y=room_screen_y(11.65f*scale,4.48f);
    int second_x=room_screen_x(19.2f*scale),second_y=room_screen_y(11.65f*scale,9.48f);
    int platform_w=(int)(10.5f*scale*6.0f+.5f);
    world_rect(layer,a,first_x-platform_w/2,first_y-8,platform_w,16,0xb9947b,3);
    world_rect(layer,a,second_x-platform_w/2,second_y-8,platform_w,16,0xbd9275,3);
    world_rect(layer,a,second_x-6,second_y+7,12,first_y-second_y+2,0xa98262,2);
    int rope_x=room_screen_x(23.4f*scale),rope_y=room_screen_y(3.0f*scale,16.4f);
    int ball_x=room_screen_x(19.7f*scale),ball_y=room_screen_y(6.2f*scale,13.45f);
    world_rect(layer,a,rope_x-2,rope_y,4,ball_y-rope_y,0xf3dcb5,1);
    world_rect(layer,a,ball_x-13,ball_y-13,26,26,0xd59683,12);
    world_rect(layer,a,ball_x-2,ball_y-22,4,12,0xf3dcb5,1);
}
static void garden_scene_layout(lv_layer_t *layer,const lv_area_t *a,const badge_scene_t *s)
{
    world_rect(layer,a,0,0,466,SCENE_LAYOUT_GARDEN_BADGE_FENCE_Y+15,0xcbe0dc,0);
    world_rect(layer,a,0,SCENE_LAYOUT_GARDEN_BADGE_FENCE_Y+15,466,466-SCENE_LAYOUT_GARDEN_BADGE_FENCE_Y-15,0x85a46c,0);
    int path_x=SCENE_LAYOUT_GARDEN_BADGE_PATH_X,foot=SCENE_LAYOUT_GARDEN_BADGE_FOOT_Y;
    world_rect(layer,a,path_x-66,SCENE_LAYOUT_GARDEN_BADGE_FENCE_Y+14,132,466-SCENE_LAYOUT_GARDEN_BADGE_FENCE_Y-14,0xb69b74,0);
    world_rect(layer,a,path_x-55,SCENE_LAYOUT_GARDEN_BADGE_FENCE_Y+14,110,466-SCENE_LAYOUT_GARDEN_BADGE_FENCE_Y-14,0xd3bd8e,0);
    world_rect(layer,a,0,SCENE_LAYOUT_GARDEN_BADGE_FENCE_Y,466,9,0xdbd3b9,2);
    for(unsigned i=0;i<9;i++)world_rect(layer,a,24+(int)i*52,SCENE_LAYOUT_GARDEN_BADGE_FENCE_Y-2,8,45,0xeee3c8,3);

    const int tx[]={SCENE_LAYOUT_GARDEN_BADGE_TREE_LEFT_X,SCENE_LAYOUT_GARDEN_BADGE_TREE_RIGHT_X};
    const uint32_t canopy[]={0x729981,0x81aa8d,0x93b699,0xa5c3a3};
    for(unsigned i=0;i<2;i++){
        world_rect(layer,a,tx[i]-11,foot-137,22,138,0xb0916b,3);
        world_rect(layer,a,tx[i]-54,foot-206,108,83,canopy[i?2:1],30);
        world_rect(layer,a,tx[i]-38,foot-224,76,52,canopy[i?3:0],25);
    }

    world_rect(layer,a,78,foot-61,106,17,0xbd9271,4);
    world_rect(layer,a,84,foot-81,94,13,0xc49e78,3);
    world_rect(layer,a,90,foot-47,10,47,0x8b6a52,2);
    world_rect(layer,a,164,foot-47,10,47,0x8b6a52,2);

    const int fx[]={SCENE_LAYOUT_GARDEN_BADGE_FLOWER_LEFT_X,SCENE_LAYOUT_GARDEN_BADGE_FLOWER_RIGHT_X};
    for(unsigned i=0;i<2;i++){
        world_rect(layer,a,fx[i]-4,foot-63,8,64,0x73987c,2);
        world_rect(layer,a,fx[i]-18,foot-78,13,8,0x73987c,4);
        world_rect(layer,a,fx[i]+5,foot-59,13,8,0x73987c,4);
        world_rect(layer,a,fx[i]-15,foot-94,14,12,0xdeb598,6);
        world_rect(layer,a,fx[i]+1,foot-101,14,12,0xdeb598,6);
        world_rect(layer,a,fx[i]-7,foot-109,14,12,0xe8d59b,6);
        world_rect(layer,a,fx[i]-3,foot-102,7,7,0xe7bd71,3);
    }
    if(s&&s->interaction==L2_INTERACTION_BUTTERFLY_CHASE&&s->action==L2_ACTION_PLAY){
        int bx=SCENE_LAYOUT_GARDEN_BADGE_FLOWER_RIGHT_X+40,by=foot-136;
        world_rect(layer,a,bx-3,by-9,6,19,0x775e69,3);
        world_rect(layer,a,bx-20,by-12,17,17,0xebbd8a,8);
        world_rect(layer,a,bx+3,by-12,17,17,0xebbd8a,8);
    }
}
/* A compact native voxel curl, only for an actual accepted SLEEP context.
 * Orange/cream blocks, tucked paws and closed eyes retain the existing cat's
 * visual language. This is presentation geometry, never a game-state change. */
static void sleeping_cat(lv_layer_t *layer,const lv_area_t *a,bool compact,int center_x,int foot,const badge_appearance_t *appearance)
{
    int unit=(compact?200:300)*(int)badge_appearance_size(appearance)/100;
    int x=center_x-25*unit/100,y=foot-34*unit/100;
    uint32_t orange=0xd97a2d,light=0xf3a446,stripe=0x98502b,cream=0xf8dfb6;
    if(badge_appearance_valid(appearance)){orange=badge_appearance_color(appearance,0);light=badge_appearance_color(appearance,1);stripe=badge_appearance_color(appearance,2);cream=badge_appearance_color(appearance,3);}
#define B(dx,dy,w,h,c) world_rect(layer,a,x+(dx)*unit/100,y+(dy)*unit/100,(w)*unit/100,(h)*unit/100,c,0)
    B(2,12,30,18,orange);B(7,7,20,8,light);B(0,20,10,10,orange);
    B(5,12,4,7,stripe);B(14,8,4,8,stripe);B(24,12,4,8,stripe);
    B(25,15,24,18,light);B(26,10,6,8,orange);B(41,11,6,8,orange);
    B(28,12,3,4,cream);B(42,13,3,4,cream);B(27,19,6,3,stripe);B(42,19,6,3,stripe);
    B(29,23,6,2,stripe);B(40,24,6,2,stripe);B(34,26,8,5,cream);
    B(37,25,2,2,0xd98d85);B(27,31,9,3,cream);B(40,31,7,3,cream);
    B(0,27,14,6,light);B(9,29,13,4,light);B(17,25,5,6,light);B(18,23,4,4,stripe);
    if(badge_appearance_valid(appearance)){
        if(appearance->outfit==BADGE_OUTFIT_BOW){B(25,11,5,4,14768472);B(30,12,4,3,15360363);B(32,10,4,4,14768472);}
        else if(appearance->outfit==BADGE_OUTFIT_BANDANA){B(28,29,16,2,8221549);B(32,31,6,2,15458777);}
        else if(appearance->outfit==BADGE_OUTFIT_BACKPACK){B(7,4,15,7,7967098);B(6,4,17,2,10138005);B(8,10,2,4,11910816);}
        else if(appearance->outfit==BADGE_OUTFIT_WINGS){B(-3,11,6,4,0xfdf9ee);B(-5,15,7,5,0xfdf9ee);B(-2,20,6,3,0xf1dec4);B(21,8,6,4,0xfdf9ee);}
    }
#undef B
    lv_draw_label_dsc_t d;lv_draw_label_dsc_init(&d);d.font=&lv_font_montserrat_20;
    d.color=lv_color_hex(0xbdb79e);d.text="Z";
    lv_area_t z={a->x1+x+51*unit/100,a->y1+y,a->x1+x+51*unit/100+28,a->y1+y+30};
    lv_draw_label(layer,&d,&z);
}
static void world_draw(lv_event_t *e)
{
    badge_scene_t *s=lv_event_get_user_data(e);if(!s->world||s->overlay)return;
    lv_layer_t *layer=lv_event_get_layer(e);lv_area_t a;lv_obj_get_coords(s->root,&a);
    bool rest=(s->dimmed||!s->face||s->day_preview)&&s->known&&s->action==L2_ACTION_SLEEP;
    if(lv_event_get_code(e)==LV_EVENT_DRAW_POST){
        /* Background shade is below the cat. Sleep stays a real action, while
         * a locked awake cat keeps its original full-size pose and scene. */
        if(rest)sleeping_cat(layer,&a,s->compact,scene_anchor_x(s),scene_anchor_y(s),&s->appearance);
        return;
    }
    if(s->day_preview&&!s->day_known){world_rect(layer,&a,0,0,466,466,0xeadfca,0);return;}
    if(s->face==1&&!s->day_preview&&!s->dimmed){world_rect(layer,&a,0,0,466,466,0xead4b0,0);return;}
    if(badge_scene_is_warm(s)){
        room_scene(layer,&a);return;
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
        int foot=s->foot_y?s->foot_y:s->compact?260:378;
        world_rect(layer,&a,197+s->prop_offset+s->slide_x,foot-2,72,6,0xb4a17e,3);return;
    }
    if(garden_scene(s)){
        garden_scene_layout(layer,&a,s);
        int foot=scene_anchor_y(s),center=scene_anchor_x(s);
        world_rect(layer,&a,center-37+s->prop_offset+s->slide_x,foot-2,74,6,0xb4a17e,3);return;
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
    /* Static scene backdrop and original cat assets share one world root. */
    s->root=shape(parent,0,0,466,466,ZIP_UI_COLOR_BG,0);
    for(unsigned i=0;i<8;i++) {
        s->weather[i]=shape(s->root,75+(i*47)%315,120+(i*31)%180,3,10,0x8FC7E0,2);
        lv_obj_add_flag(s->weather[i],LV_OBJ_FLAG_HIDDEN);
    }
    for(unsigned i=0;i<5;i++) {
        s->ground[i]=shape(s->root,122+i*46,345,25,2,0x443629,1);
        lv_obj_add_flag(s->ground[i],LV_OBJ_FLAG_HIDDEN);
    }
    s->shade=shape(s->root,0,0,466,466,0x000000,0);
    lv_obj_set_style_bg_opa(s->shade,120,0);lv_obj_add_flag(s->shade,LV_OBJ_FLAG_HIDDEN);
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
void badge_scene_set_foot_y(badge_scene_t *s,int foot_y)
{
    if(!s||foot_y<0||foot_y>420)return;
    s->foot_y=foot_y;set_frame(s,s->frame);
}
void badge_scene_set_appearance(badge_scene_t *s,const badge_appearance_t *appearance)
{
    if(!s)return;
    badge_appearance_t next={0};
    if(badge_appearance_valid(appearance))next=*appearance;
    if(badge_appearance_equal(&s->appearance,&next))return;
    s->appearance=next;set_frame(s,s->frame);lv_obj_invalidate(s->root);
}
bool badge_scene_appearance_ready(const badge_scene_t *s)
{
    return s&&s->appearance.known&&s->appearance_rendered&&badge_appearance_outfit_supported(s->appearance.outfit);
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
    /* Preserve scene, pose, position and scale. Background shade is a static
     * child below the cat; the existing 35% BSP level still governs AOD. */
    if(!s||s->dimmed==dimmed)return;
    s->dimmed=dimmed;if(dimmed)s->frozen=true;
    if(dimmed)lv_obj_remove_flag(s->shade,LV_OBJ_FLAG_HIDDEN);else lv_obj_add_flag(s->shade,LV_OBJ_FLAG_HIDDEN);
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
    lv_obj_set_style_image_opa(s->cat,s->dimmed?220:LV_OPA_COVER,0);
    if(changed) {s->prop_ms=0;s->prop_previous=0;s->prop_offset=0;s->prop_look=false;s->pending=BADGE_SCENE_IDLE;s->clip=base_clip(s);s->started=lv_tick_get();set_frame(s,0);}
}

void badge_scene_set_interaction(badge_scene_t *s,l2_interaction_t interaction)
{
    if(!s)return;
    if((unsigned)interaction>(unsigned)L2_INTERACTION_BED_SLEEP)interaction=L2_INTERACTION_NONE;
    if(s->interaction==interaction)return;
    s->interaction=interaction;
    badge_scene_clip_id_t next=base_clip(s);
    if(s->known){
        if(next!=s->clip){s->clip=next;s->pending=BADGE_SCENE_IDLE;s->started=lv_tick_get();set_frame(s,0);}
        else set_frame(s,s->frame);
    }
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
