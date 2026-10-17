from pathlib import Path
O=Path('artifacts/firmware-local-v3-visual038/source/main');p=O/'badge_scene.c';s=p.read_text().replace('    bool frozen,compact;','    bool frozen,compact;\n    bool world,overlay; int slide_x;')
s=s.replace('    lv_obj_set_pos(s->cat,x,y);','    if(s->world && s->action==L2_ACTION_SLEEP)y+=60;\n    lv_obj_set_pos(s->cat,x+s->slide_x,y);')
mark='badge_scene_t *badge_scene_create(lv_obj_t *parent)'
insert='''/* Static native drawing: no image caches, new LVGL objects, timers or DMA. */
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
        world_rect(layer,&a,0,408,466,58,0x14121c,0);
        world_rect(layer,&a,119,267,228,141,0x4d3b36,12);
        world_rect(layer,&a,128,271,210,125,0x76666e,9);
        world_rect(layer,&a,137,273,192,12,0xa29299,4);
        world_rect(layer,&a,146,307,36,3,0x92808a,1);
        world_rect(layer,&a,278,344,34,3,0x92808a,1);return;
    }
    if(rest){
        world_rect(layer,&a,335,167,25,25,0xb8ae8a,12);
        world_rect(layer,&a,345,163,22,24,0x14121c,12);
        world_rect(layer,&a,148,253,170,30,0xb0a090,10);return;
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
    if(!s||s->world)return;s->world=true;
    lv_obj_add_event_cb(s->root,world_draw,LV_EVENT_DRAW_MAIN,s);
    lv_obj_add_event_cb(s->root,world_draw,LV_EVENT_DRAW_POST,s);
    lv_obj_invalidate(s->root);
}
void badge_scene_set_overlay(badge_scene_t *s,bool overlay)
{
    if(!s||s->overlay==overlay)return;s->overlay=overlay;
    lv_obj_set_style_bg_opa(s->root,overlay?LV_OPA_TRANSP:LV_OPA_COVER,0);
    for(unsigned i=0;i<8;i++)if(overlay)lv_obj_add_flag(s->weather[i],LV_OBJ_FLAG_HIDDEN);
    for(unsigned i=0;i<5;i++)if(overlay)lv_obj_add_flag(s->ground[i],LV_OBJ_FLAG_HIDDEN);
}
void badge_scene_set_slide_offset(badge_scene_t *s,int dx)
{
    if(!s||s->slide_x==dx)return;s->slide_x=dx;set_frame(s,s->frame);
}
'''
s=s.replace(mark,insert+mark)
s=s.replace('    if(s->frozen) {','    if(s->world && s->action==L2_ACTION_SLEEP)return;\n    if(s->frozen) {')
s=s.replace('uint32_t bg=!known || stage==L2_SCENE_HOME ? ZIP_UI_COLOR_BG : stage==L2_SCENE_DEPARTING ? 0x1c1307 : stage==L2_SCENE_AWAY ? 0x071820 : 0x121021;','uint32_t bg= !known || !live ? ZIP_UI_COLOR_BG : stage==L2_SCENE_HOME ? 0x17130f : 0x101b18;\n    if(s->world && known && action==L2_ACTION_SLEEP)bg=0x14121c;')
s=s.replace('bool show=known && weather!=L2_WEATHER_CLEAR;','bool show=known && live && !s->overlay && weather!=L2_WEATHER_CLEAR;')
s=s.replace('if(known && (stage==L2_SCENE_DEPARTING || stage==L2_SCENE_RETURNING))','if(known && live && !s->overlay && (stage==L2_SCENE_DEPARTING || stage==L2_SCENE_RETURNING))')
s=s.replace('lv_obj_set_style_image_opa(s->cat,action==L2_ACTION_SLEEP ? LV_OPA_60 : LV_OPA_COVER,0);','lv_obj_set_style_image_opa(s->cat,LV_OPA_COVER,0);')
p.write_text(s)
p=O/'badge_scene.h';p.write_text(p.read_text()+'\n/* Local presentation only; no domain events, storage or timer changes. */\nvoid badge_scene_enable_world(badge_scene_t *);\nvoid badge_scene_set_overlay(badge_scene_t *,bool);\nvoid badge_scene_set_slide_offset(badge_scene_t *,int);\n')
