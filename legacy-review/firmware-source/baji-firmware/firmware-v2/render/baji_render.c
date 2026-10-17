#include "baji_render.h"
#include "generated/baji_assets.h"
#include "baji_composition.h"
#include "src/misc/cache/instance/lv_image_cache.h"
#include "src/misc/cache/instance/lv_image_header_cache.h"
#include <stdlib.h>
#include <time.h>
#include <stdio.h>
#include <math.h>
#include <string.h>
extern const lv_font_t bj_font16, bj_font24, bj_font44;
typedef struct {
    lv_obj_t *root, *cat, *title, *sub, *skip, *segments[5], *back, *back_title, *back_sub, *fade;
    lv_obj_t *back_arc, *back_chevron, *back_card, *clock, *data_labels[7], *ring[24], *hearts[24];
    lv_point_precise_t chevron_points[3];
    const lv_image_dsc_t *frames;
    unsigned sprite_frame;
} page_t;
struct bj_render {page_t pages[BJ_DONE+1];lv_obj_t *low_root,*confirm_root,*confirm_code,*audio_indicator;uint32_t animation_ms,last_ms;bool clock_started;};
static const char *titles[]={"轻点小猫","向上滑","向下滑","左右滑","按住屏幕"};
static const char *subs[]={"摸摸它","打开照料","看状态和电量","换一个表盘","跟它说句话，松手结束"};
static lv_obj_t *label(lv_obj_t *parent,const char *text,int cy,const lv_font_t *font,uint32_t color) {
    lv_obj_t *o=lv_label_create(parent);lv_label_set_text_static(o,text);
    lv_obj_set_style_text_font(o,font,0);lv_obj_set_style_text_color(o,lv_color_hex(color),0);
    lv_obj_set_width(o,440);lv_obj_set_style_text_align(o,LV_TEXT_ALIGN_CENTER,0);
    lv_obj_set_pos(o,13,cy-font->line_height/2);return o;
}
static void plain(lv_obj_t *o,int w,int h) {
    lv_obj_remove_style_all(o);lv_obj_set_size(o,w,h);
    lv_obj_remove_flag(o,LV_OBJ_FLAG_SCROLLABLE|LV_OBJ_FLAG_CLICKABLE);
}
static void sprite(page_t *p,bool a) {
    p->frames=a?bj_frames_catA:bj_frames_catB;
    p->sprite_frame=0;
    p->cat=lv_image_create(p->root);lv_image_set_src(p->cat,&p->frames[0]);
    lv_image_set_pivot(p->cat,0,0);lv_image_set_scale(p->cat,512);
    lv_image_set_antialias(p->cat,false);lv_obj_set_pos(p->cat,a?150:158,a?152:138);
    lv_obj_remove_flag(p->cat,LV_OBJ_FLAG_CLICKABLE);
}
bj_render_t *bj_render_create(lv_obj_t *parent) {
    bj_render_t *r=calloc(1,sizeof(*r));if(!r) return NULL;
    /* Moving pages expose this stationary canvas, not the theme's screen color.
     * Only the controller owns scrolling; LVGL must not scroll the parent. */
    lv_obj_set_style_bg_color(parent,lv_color_black(),0);
    lv_obj_set_style_bg_opa(parent,LV_OPA_COVER,0);
    lv_obj_set_style_pad_all(parent,0,0);
    lv_obj_remove_flag(parent,LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(parent,LV_SCROLLBAR_MODE_OFF);
    for(int i=0;i<=BJ_DONE;i++) {
        page_t *p=&r->pages[i];p->root=lv_obj_create(parent);plain(p->root,466,466);
        lv_obj_set_style_bg_color(p->root,lv_color_black(),0);lv_obj_set_style_bg_opa(p->root,LV_OPA_COVER,0);
        lv_obj_add_flag(p->root,LV_OBJ_FLAG_HIDDEN);
        if(i>=BJ_MAIN_A && i<=BJ_MAIN_C) {
            p->clock=label(p->root,"--:--",72,&bj_font44,0xFFF4E0);
            p->data_labels[0]=label(p->root,"--",374,&bj_font16,0xB9A88F);
            if(i!=BJ_MAIN_A) for(unsigned j=0;j<24;j++) {
                lv_obj_t *arc=lv_arc_create(p->root);p->ring[j]=arc;plain(arc,452,452);lv_obj_set_pos(arc,7,7);
                lv_obj_remove_style(arc,NULL,LV_PART_KNOB);lv_obj_set_style_arc_width(arc,7,LV_PART_MAIN);
                lv_obj_set_style_arc_opa(arc,LV_OPA_TRANSP,LV_PART_INDICATOR);lv_obj_add_flag(arc,LV_OBJ_FLAG_HIDDEN);
                if(i==BJ_MAIN_C) {p->hearts[j]=label(p->root,"*",233,&bj_font16,0xFF6B6B);lv_obj_set_width(p->hearts[j],20);lv_obj_add_flag(p->hearts[j],LV_OBJ_FLAG_HIDDEN);}
            }
        }
        if(i==BJ_STATUS) {
            label(p->root,"状态",100,&bj_font24,0xFFF4E0);
            for(unsigned j=0;j<5;j++) p->data_labels[j]=label(p->root,"--",150+(int)j*36,&bj_font16,0xB9A88F);
            p->data_labels[5]=label(p->root,"--",350,&bj_font16,0xF0A35E);
            label(p->root,"设置",414,&bj_font16,0xF0A35E);
        }
        if(i==BJ_SETTINGS) {
            label(p->root,"设置",100,&bj_font24,0xFFF4E0);
            for(unsigned j=0;j<4;j++) p->data_labels[j]=label(p->root,"--",170+(int)j*42,&bj_font16,0xB9A88F);
        }
        if(i==BJ_CARE) {
            label(p->root,"照料",90,&bj_font24,0xFFF4E0);
            static const char *cares[]={"摸摸","喂食 0/3","喝水 0/3","逗猫 0/5","睡觉"};
            for(unsigned j=0;j<5;j++) p->data_labels[j]=label(p->root,cares[j],151+(int)j*42,&bj_font24,0xF0A35E);
            p->data_labels[5]=label(p->root,"--",380,&bj_font16,0xB9A88F);
        }
        if(i==BJ_GUIDE || (i>=BJ_MAIN_A && i<=BJ_MAIN_C)) sprite(p,i==BJ_GUIDE||i==BJ_MAIN_A);
        if(i==BJ_GUIDE) {
            p->title=label(p->root,titles[0],62,&bj_font24,0xFFF4E0);
            p->sub=label(p->root,subs[0],94,&bj_font16,0xB9A88F);
            p->skip=label(p->root,"跳过",420,&bj_font16,0x6E6253);
            for(int j=0;j<5;j++) {
                lv_obj_t *arc=lv_arc_create(p->root);p->segments[j]=arc;
                lv_obj_remove_style(arc,NULL,LV_PART_KNOB);
                lv_obj_set_size(arc,452,452);lv_obj_set_pos(arc,7,7);
                lv_obj_set_style_arc_width(arc,8,LV_PART_MAIN);
                lv_obj_set_style_arc_width(arc,8,LV_PART_INDICATOR);
                lv_arc_set_bg_angles(arc,219+j*21,219+j*21+15);
                lv_obj_remove_flag(arc,LV_OBJ_FLAG_CLICKABLE);
            }
        }
        if(i==BJ_PAIR) {
            label(p->root,"连接 App",184,&bj_font24,0xFFF4E0);
            label(p->root,"尚未绑定",220,&bj_font16,0xB9A88F);
            label(p->root,"本地体验",374,&bj_font24,0xF0A35E);
        }
        if(i==BJ_VOICE) {
            label(p->root,"语音未接入",290,&bj_font24,0xFFF4E0);
            label(p->root,"松手结束",322,&bj_font16,0xB9A88F);
        }
        if(i==BJ_DONE) {
            label(p->root,"都学会啦",280,&bj_font24,0xFFF4E0);
            label(p->root,"点一下，开始陪伴小橘",312,&bj_font16,0xB9A88F);
            label(p->root,"以后在 App 里可以重看",344,&bj_font16,0x6E6253);
        }
        if(i==BJ_CARE || i==BJ_STATUS || i==BJ_MAIN_B || i==BJ_MAIN_C) {
            p->back=lv_obj_create(p->root);plain(p->back,466,466);
            lv_obj_set_style_bg_color(p->back,lv_color_black(),0);
            lv_obj_set_style_bg_opa(p->back,115,0);
            p->back_card=lv_obj_create(p->back);plain(p->back_card,240,88);
            lv_obj_set_pos(p->back_card,113,189);lv_obj_set_style_radius(p->back_card,20,0);
            lv_obj_set_style_bg_color(p->back_card,lv_color_hex(0x241D17),0);
            lv_obj_set_style_bg_opa(p->back_card,LV_OPA_COVER,0);
            p->back_title=label(p->back,"向上滑",219,&bj_font24,0xFFF4E0);
            p->back_sub=label(p->back,"回到小猫这里",251,&bj_font16,0xB9A88F);
            p->back_arc=lv_arc_create(p->back);plain(p->back_arc,465,465);
            lv_obj_remove_style(p->back_arc,NULL,LV_PART_KNOB);
            lv_obj_set_style_arc_width(p->back_arc,5,LV_PART_MAIN);
            lv_obj_set_style_arc_color(p->back_arc,lv_color_hex(0xF0A35E),LV_PART_MAIN);
            lv_obj_set_style_arc_rounded(p->back_arc,true,LV_PART_MAIN);
            lv_obj_set_style_arc_opa(p->back_arc,LV_OPA_TRANSP,LV_PART_INDICATOR);
            p->back_chevron=lv_line_create(p->back);plain(p->back_chevron,466,466);
            lv_obj_set_style_line_width(p->back_chevron,3,0);
            lv_obj_set_style_line_color(p->back_chevron,lv_color_hex(0xF0A35E),0);
            lv_obj_set_style_line_rounded(p->back_chevron,true,0);
            lv_obj_set_style_line_opa(p->back_chevron,230,0);
            lv_obj_add_flag(p->back,LV_OBJ_FLAG_HIDDEN);
        }
        /* Black-over-source equals fading into the black canvas, without
         * parent opacity, which can request an off-screen layer. */
        p->fade=lv_obj_create(p->root);plain(p->fade,466,466);
        lv_obj_set_style_bg_color(p->fade,lv_color_black(),0);
        lv_obj_set_style_bg_opa(p->fade,LV_OPA_TRANSP,0);
        lv_obj_add_flag(p->fade,LV_OBJ_FLAG_HIDDEN);
    }
    r->confirm_root=lv_obj_create(parent);plain(r->confirm_root,466,466);
    lv_obj_set_style_bg_color(r->confirm_root,lv_color_black(),0);lv_obj_set_style_bg_opa(r->confirm_root,LV_OPA_COVER,0);
    label(r->confirm_root,"连接 App",130,&bj_font24,0xFFF4E0);
    r->confirm_code=label(r->confirm_root,"000000",220,&bj_font44,0xF0A35E);
    label(r->confirm_root,"App",285,&bj_font16,0xB9A88F);
    label(r->confirm_root,"点一下",365,&bj_font24,0xF0A35E);
    lv_obj_add_flag(r->confirm_root,LV_OBJ_FLAG_HIDDEN);
    r->low_root=lv_obj_create(parent);plain(r->low_root,466,466);
    lv_obj_set_style_bg_color(r->low_root,lv_color_black(),0);
    lv_obj_set_style_bg_opa(r->low_root,LV_OPA_COVER,0);
    lv_obj_add_flag(r->low_root,LV_OBJ_FLAG_HIDDEN);
    label(r->low_root,"电量不足",286,&bj_font24,0xFFF4E0);
    label(r->low_root,"请充电，小橘先睡啦",320,&bj_font16,0xB9A88F);
    /* Reference 16x16 bat_low at centre (233,196), scale 5.
     * Merge each colored row run into one resident rectangle; no pixel accessor. */
    static const char *bat_low[16]={
        "................","................","................","................",
        ".gggggggggggggg.",".g............g.",".g.rr.........gg",".g.rr.........gg",
        ".g.rr.........gg",".g.rr.........gg",".g............g.",".gggggggggggggg.",
        "................","................","................","................"};
    for(int y=0;y<16;y++) for(int x=0;x<16;) {
        char c=bat_low[y][x];int start=x++;
        while(x<16 && bat_low[y][x]==c) ++x;
        if(c=='.') continue;
        lv_obj_t *run=lv_obj_create(r->low_root);plain(run,(x-start)*5,5);
        lv_obj_set_pos(run,193+start*5,156+y*5);
        lv_obj_set_style_bg_color(run,lv_color_hex(c=='g'?0xB9A88F:0xFF6B6B),0);
        lv_obj_set_style_bg_opa(run,LV_OPA_COVER,0);
    }
    r->audio_indicator=label(parent,"收音中 · 点此停止",38,&bj_font16,0xFF6B6B);
    lv_obj_add_flag(r->audio_indicator,LV_OBJ_FLAG_HIDDEN);
    return r;
}
static void apply_page(page_t *p,const bj_scene_t *s,int x,int y,uint32_t wall_ms,
    uint32_t animation_ms,bool moving,uint8_t opacity) {
    lv_obj_remove_flag(p->root,LV_OBJ_FLAG_HIDDEN);lv_obj_set_pos(p->root,x,y);
    lv_obj_set_style_bg_opa(p->fade,255-opacity,0);
    if(opacity==255) lv_obj_add_flag(p->fade,LV_OBJ_FLAG_HIDDEN);
    else lv_obj_remove_flag(p->fade,LV_OBJ_FLAG_HIDDEN);
    if(p->cat) {
        unsigned index=(animation_ms/90)%46,frame=index<24?index:46-index;
        if(frame!=p->sprite_frame) {
            /* Each immutable source has tightly packed rows and valid data bounds. */
            lv_image_set_src(p->cat,&p->frames[frame]);p->sprite_frame=frame;
        }
    }
    if(p->back) {
        bool back=s->tutorial_active && s->phase==BJ_GUIDE_BACK && !moving;
        if(back) {
            /* Fade only these drawing styles; never attenuate child hints via parent opacity. */
            uint8_t alpha=bj_back_opacity(s,wall_ms);
            lv_obj_set_style_bg_opa(p->back,(uint8_t)((115u*alpha)/255u),0);
            lv_obj_set_style_bg_opa(p->back_card,alpha,0);
            lv_obj_set_style_text_opa(p->back_title,alpha,0);
            lv_obj_set_style_text_opa(p->back_sub,alpha,0);
            const char *direction=s->back_direction==BJ_UP?"向上滑":
                s->back_direction==BJ_DOWN?"向下滑":s->back_direction==BJ_LEFT?"向左滑":"向右滑";
            lv_label_set_text_static(p->back_title,direction);
            lv_label_set_text_static(p->back_sub,s->screen==BJ_MAIN_B || s->screen==BJ_MAIN_C?
                "换回刚才的表盘":"回到小猫这里");
            int angle=s->back_direction==BJ_UP?90:s->back_direction==BJ_DOWN?270:
                s->back_direction==BJ_LEFT?0:180;
            lv_arc_set_bg_angles(p->back_arc,(angle+349)%360,(angle+11)%360);
            float pulse=sinf((float)wall_ms/220.f);
            lv_obj_set_style_arc_opa(p->back_arc,(uint8_t)(127.5f+127.5f*pulse*pulse),LV_PART_MAIN);
            int dx=s->back_direction==BJ_LEFT?-1:s->back_direction==BJ_RIGHT?1:0;
            int dy=s->back_direction==BJ_UP?-1:s->back_direction==BJ_DOWN?1:0;
            int cx=233-dx*206,cy=233-dy*206,px=-dy,py=dx;
            /* LVGL precise coordinates may quantize reference half pixels. */
            p->chevron_points[0]=(lv_point_precise_t){cx-px*7-dx*3.5f,cy-py*7-dy*3.5f};
            p->chevron_points[1]=(lv_point_precise_t){cx+dx*3.5f,cy+dy*3.5f};
            p->chevron_points[2]=(lv_point_precise_t){cx+px*7-dx*3.5f,cy+py*7-dy*3.5f};
            lv_line_set_points(p->back_chevron,p->chevron_points,3);
            lv_obj_remove_flag(p->back,LV_OBJ_FLAG_HIDDEN);
        } else lv_obj_add_flag(p->back,LV_OBJ_FLAG_HIDDEN);
    }
    if(s->screen==BJ_GUIDE) {
        unsigned step=s->step<5?s->step:4;
        bool ok=s->phase==BJ_GUIDE_OK;
        lv_label_set_text_static(p->title,ok?"做得好！":titles[step]);
        lv_label_set_text_static(p->sub,subs[step]);
        for(int j=0;j<5;j++) {
            uint32_t color=j<(int)step+(ok?1:0)?0xF0A35E:j==(int)step?0xA66C39:0x372E26;
            lv_obj_set_style_arc_color(p->segments[j],lv_color_hex(color),LV_PART_MAIN);
            lv_obj_set_style_arc_opa(p->segments[j],LV_OPA_TRANSP,LV_PART_INDICATOR);
        }
    }
}
void bj_render_apply(bj_render_t *r,const bj_frame_t *f,uint32_t ms) {
    if(!r || !f || f->source.screen<BJ_PAIR || f->source.screen>BJ_DONE ||
        (f->target_visible && (f->target.screen<BJ_PAIR || f->target.screen>BJ_DONE))) return;
    lv_obj_add_flag(r->low_root,LV_OBJ_FLAG_HIDDEN);
    if(r->clock_started && !f->autonomous_paused) r->animation_ms+=ms-r->last_ms;
    r->last_ms=ms;r->clock_started=true;
    for(int i=0;i<=BJ_DONE;i++) if(i!=(int)f->source.screen && (!f->target_visible || i!=(int)f->target.screen))
        lv_obj_add_flag(r->pages[i].root,LV_OBJ_FLAG_HIDDEN);
    bj_composition_t plan=bj_composition_plan(f);
    page_t *source=&r->pages[f->source.screen];
    apply_page(source,&f->source,plan.source_x,plan.source_y,ms,r->animation_ms,plan.moving,plan.source_opacity);
    lv_obj_move_foreground(source->root);
    if(plan.target_visible) {
        page_t *target=&r->pages[f->target.screen];
        apply_page(target,&f->target,plan.target_x,plan.target_y,ms,r->animation_ms,plan.moving,255);
        lv_obj_move_foreground(target->root);
    }
}
void bj_render_apply_power(bj_render_t *r,const bj_frame_t *f,
    const bj_power_view_t *power,uint32_t ms) {
    if(!r || !f || !power) return;
    if(power->mode==BJ_POWER_LOW) {
        for(int i=0;i<=BJ_DONE;i++) lv_obj_add_flag(r->pages[i].root,LV_OBJ_FLAG_HIDDEN);
        lv_obj_remove_flag(r->low_root,LV_OBJ_FLAG_HIDDEN);
        r->last_ms=ms;r->clock_started=true;
        return;
    }
    bj_frame_t gated=*f;
    gated.autonomous_paused=f->autonomous_paused || !power->allow_autonomous;
    bj_render_apply(r,&gated,ms);
}
static unsigned rd16(const uint8_t *p) {return p[0]|((unsigned)p[1]<<8);}
static uint32_t rd32(const uint8_t *p) {return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
static void text(lv_obj_t *o,const char *s) {if(o && strcmp(lv_label_get_text(o),s)) lv_label_set_text(o,s);}
void bj_render_apply_data(bj_render_t *r,const bj_data_view_t *v,const bj_power_view_t *power,uint8_t care_type,uint8_t care_count) {
    if(!r || !v || !power) return;
    char b[120];
    if(v->confirm_pending || v->meet_pending) {
        if(v->meet_pending) snprintf(b,sizeof(b),"遇见 %02X:%02X",v->meet_peer[4],v->meet_peer[5]);
        else snprintf(b,sizeof(b),"%06lu",(unsigned long)v->challenge_code);
        text(r->confirm_code,b);
        lv_obj_remove_flag(r->confirm_root,LV_OBJ_FLAG_HIDDEN);lv_obj_move_foreground(r->confirm_root);
    } else lv_obj_add_flag(r->confirm_root,LV_OBJ_FLAG_HIDDEN);
    if(v->audio_active) {lv_obj_remove_flag(r->audio_indicator,LV_OBJ_FLAG_HIDDEN);lv_obj_move_foreground(r->audio_indicator);}
    else lv_obj_add_flag(r->audio_indicator,LV_OBJ_FLAG_HIDDEN);
    static const char *names[]={"饱腹","心情","清洁","精力","健康"};
    for(unsigned i=0;i<5;i++) {
        if(v->has_pet && v->authenticated) snprintf(b,sizeof(b),"%s  %u",names[i],v->pet[10+i]);
        else snprintf(b,sizeof(b),"%s  --",names[i]);
        text(r->pages[BJ_STATUS].data_labels[i],b);
    }
    if(power->battery_valid) snprintf(b,sizeof(b),"%d%%",power->battery_percent);else snprintf(b,sizeof(b),"--%%");
    text(r->pages[BJ_STATUS].data_labels[5],b);
    snprintf(b,sizeof(b),"%s",v->authenticated?"App":"--");text(r->pages[BJ_SETTINGS].data_labels[0],b);
    snprintf(b,sizeof(b),"%u / 200",v->pending_events);text(r->pages[BJ_SETTINGS].data_labels[1],b);
    snprintf(b,sizeof(b),"%lu / %lu",(unsigned long)v->dropped,(unsigned long)v->storage_errors);text(r->pages[BJ_SETTINGS].data_labels[2],b);
    snprintf(b,sizeof(b),"%s",v->audio_fault?"收音故障":v->audio_active?(v->environment_has_model?"环境收音中":"收音中/无模型"):"环境收音关闭");text(r->pages[BJ_SETTINGS].data_labels[3],b);
    for(unsigned i=2;i<=4;i++) {snprintf(b,sizeof(b),"%s %u/%u",i==2?"喂食":i==3?"喝水":"逗猫",care_type==i?care_count:0,i==4?5:3);text(r->pages[BJ_CARE].data_labels[i-1],b);}
    snprintf(b,sizeof(b),"%u / 200",v->pending_events);text(r->pages[BJ_CARE].data_labels[5],b);
    for(unsigned page=BJ_MAIN_A;page<=BJ_MAIN_C;page++) {
        if(v->clock_valid) {int64_t local=(int64_t)v->unix_seconds+(int64_t)v->timezone*60;unsigned minute=(unsigned)((local%86400+86400)%86400)/60;snprintf(b,sizeof(b),"%02u:%02u",minute/60,minute%60);}
        else {snprintf(b,sizeof(b),"--:--");}
        text(r->pages[page].clock,b);
        if(v->has_pet && v->authenticated) snprintf(b,sizeof(b),"%u / %u / %u",v->pet[7],v->pet[8],v->pet[9]);else snprintf(b,sizeof(b),"--");text(r->pages[page].data_labels[0],b);
        if(page==BJ_MAIN_A) continue;
        bool today=false;
        if(v->clock_valid && v->has_life && v->authenticated) {time_t local=(time_t)((int64_t)v->unix_seconds+(int64_t)v->timezone*60);struct tm tm;if(gmtime_r(&local,&tm)) today=rd32(v->life+5)==(uint32_t)((tm.tm_year+1900)*10000+(tm.tm_mon+1)*100+tm.tm_mday);}
        for(unsigned i=0;i<24;i++) {
            lv_obj_t *arc=r->pages[page].ring[i];
            if(today && i<v->life[11]) {const uint8_t *segment=v->life+13+i*5;lv_arc_set_bg_angles(arc,270+(int)(rd16(segment)*360/1440),270+(int)(rd16(segment+2)*360/1440));lv_obj_set_style_arc_color(arc,lv_color_hex(segment[4]==2?0x6C91A6:0xF0A35E),LV_PART_MAIN);lv_obj_remove_flag(arc,LV_OBJ_FLAG_HIDDEN);}
            else lv_obj_add_flag(arc,LV_OBJ_FLAG_HIDDEN);
            if(page==BJ_MAIN_C) {lv_obj_t *h=r->pages[page].hearts[i];if(today && i<v->life[12]) {const uint8_t *heart=v->life+13+v->life[11]*5+i*3;double angle=(double)rd16(heart)*6.283185307179586/1440-1.570796326794897;lv_obj_set_pos(h,223+(int)(210*cos(angle)),223+(int)(210*sin(angle)));lv_obj_remove_flag(h,LV_OBJ_FLAG_HIDDEN);}else lv_obj_add_flag(h,LV_OBJ_FLAG_HIDDEN);}
        }
    }
}
bool bj_render_replace_assets(void *context,const lv_image_dsc_t *a,const lv_image_dsc_t *b) {
    bj_render_t *r=context;if(!r)return false;
    for(int i=0;i<=BJ_DONE;i++) {
        page_t *p=&r->pages[i];if(!p->cat)continue;
        for(unsigned frame=0;frame<24;frame++){lv_image_cache_drop(&p->frames[frame]);lv_image_header_cache_drop(&p->frames[frame]);}
        bool type_a=i==BJ_GUIDE || i==BJ_MAIN_A;
        p->frames=type_a?(a?a:bj_frames_catA):(b?b:bj_frames_catB);
        lv_image_set_src(p->cat,&p->frames[p->sprite_frame]);
    }
    return true;
}
void bj_render_destroy(bj_render_t *r) {
    if(!r) return;
    for(int i=0;i<=BJ_DONE;i++) {
        page_t *p=&r->pages[i];
        if(p->cat) {
            for(unsigned frame=0;frame<24;frame++) {
                lv_image_cache_drop(&p->frames[frame]);
                lv_image_header_cache_drop(&p->frames[frame]);
            }
        }
        lv_obj_delete(p->root);
    }
    lv_obj_delete(r->low_root);
    lv_obj_delete(r->confirm_root);
    lv_obj_delete(r->audio_indicator);
    free(r);
}
