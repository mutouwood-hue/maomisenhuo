#include "badge_scene.h"
#include "badge_ui_contract.h"
#include <stdlib.h>

LV_IMAGE_DECLARE(cat_idle);
LV_IMAGE_DECLARE(cat_paw);

struct badge_scene {
    lv_obj_t *root, *cat;
    const badge_scene_assets_t *assets;
    badge_scene_clip_id_t clip;
    badge_scene_clip_id_t pending;
    uint32_t started;
    uint16_t frame;
    unsigned face;
    bool frozen,compact;
};
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
    lv_image_set_src(s->cat,image); s->frame=frame;
    /* Shared absolute foot placement. Fallback has its original 200x180 canvas. */
    int x=233-(int)image->header.w/2;
    int anchor=image->header.h==208 ? 196 : (int)image->header.h;
    int y=340-anchor;
    if(s->compact) y=260-(int)image->header.h/2-(anchor-(int)image->header.h/2)*3/4;
    else if(s->face) y-=12;
    lv_obj_set_pos(s->cat,x,y);
}
badge_scene_t *badge_scene_create(lv_obj_t *parent)
{
    badge_scene_t *s=calloc(1,sizeof(*s)); if(!s) return NULL;
    s->assets=badge_game_assets();
    /* Reference-first: pure black, cat only. A room descriptor may be exported
     * for a separately reviewed enhancement but is deliberately not displayed. */
    s->root=shape(parent,0,0,466,466,ZIP_UI_COLOR_BG,0);
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
    s->compact=compact; lv_image_set_scale(s->cat,compact ? 192 : 256); set_frame(s,s->frame);
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
    if(s->frozen) { s->frozen=false; s->clip=s->pending=BADGE_SCENE_IDLE; s->started=now; set_frame(s,0); }
    const badge_scene_clip_t *c=clip_for(s,s->clip);
    uint32_t elapsed=now-s->started;
    if(!c) {
        if(s->clip!=BADGE_SCENE_IDLE && elapsed>=650) {
            badge_scene_clip_id_t next=s->pending; s->pending=BADGE_SCENE_IDLE; badge_scene_play(s,next,now);
        }
        return;
    }
    if((!c->loop || s->clip!=BADGE_SCENE_IDLE) && elapsed>=c->cycle_ms) {
        badge_scene_clip_id_t next=s->pending; s->pending=BADGE_SCENE_IDLE; badge_scene_play(s,next,now); return;
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
