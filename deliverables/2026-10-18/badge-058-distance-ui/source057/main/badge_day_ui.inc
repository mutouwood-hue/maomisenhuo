/* RAM day display only. GUI thread, no writes to events/core/NVS/day payload.
 * 052 permits full-day browsing, but future is classified only from the
 * existing calibrated clock. Received segments never stand in for the future. */
static bool day_records_today;
static char day_now_date[11];
static int day_lo(void){return 0;}
static int day_hi(void){return 1439;}
static int day_clamp(int n){return n<0?0:n>1439?1439:n;}
/* limit: today's minute, 1440 for an older day, 0 for a later day.
 * now_minute is a cursor only, never a modified clock or received event. */
static bool day_reference(int *now_minute,int *limit,bool *future)
{
    uint64_t epoch=0;if(!local2_clock_now(&epoch))return false;
    int zone=day_view.valid?day_view.zone:local2_clock_utc_offset_minutes();
    time_t wall=(time_t)(epoch/1000)+(time_t)zone*60;struct tm local;
    if(!gmtime_r(&wall,&local))return false;
    char date[11];if(!strftime(date,sizeof date,"%Y-%m-%d",&local))return false;
    int minute=local.tm_hour*60+local.tm_min;
    int relation=day_view.valid?strcmp(day_view.date,date):0;
    day_records_today=relation==0;memcpy(day_now_date,date,sizeof date);
    *limit=day_follow_now?minute:relation<0?1440:relation>0?0:minute;
    *now_minute=day_follow_now?minute:relation<0?1439:relation>0?0:minute;
    *future=!day_follow_now&&(relation>0||(relation==0&&day_minute>minute));
    return true;
}
/* The changing ring is invalidated as four rim strips, not a full frame. */
static void day_invalidate_track(void)
{
    lv_area_t a;lv_obj_get_coords(pages[PAGE_HOME],&a);
    lv_area_t strips[]={
        {a.x1,a.y1,a.x1+465,a.y1+92},
        {a.x1,a.y1+373,a.x1+465,a.y1+465},
        {a.x1,a.y1+93,a.x1+92,a.y1+372},
        {a.x1+373,a.y1+93,a.x1+465,a.y1+372}
    };
    for(unsigned i=0;i<4;i++)lv_obj_invalidate_area(pages[PAGE_HOME],strips+i);
}
static void day_return_now(void)
{
    day_follow_now=true;day_pending=true;day_invalidate_track();
    int now=0,limit=0;bool future=false;
    if(day_reference(&now,&limit,&future)){day_minute=day_clamp(now);day_cursor=day_minute;}
    /* Project after the existing release/presentation hold, not from input. */
}
static void day_refresh(void)
{
    bool previous_valid=day_view.valid,previous_old=day_view.old;uint32_t previous_generation=day_view.generation;char previous_date[11];memcpy(previous_date,day_view.date,sizeof previous_date);
    (void)local2_day_get(domain.ready&&domain.has_snapshot&&!domain.storage_error?domain.snapshot.pet.pet_id:NULL,&day_view);
    static uint64_t seen_revision;static bool seen_live;
    if(day_follow_now&&(seen_revision!=domain.snapshot.revision||seen_live!=live_context)){day_pending=true;seen_revision=domain.snapshot.revision;seen_live=live_context;}
    bool changed=previous_valid!=day_view.valid||previous_generation!=day_view.generation||previous_old!=day_view.old;
    if(changed){bool same=previous_valid&&day_view.valid&&!strcmp(previous_date,day_view.date);if(!same)day_follow_now=true;day_minute=day_clamp(day_minute);day_pending=true;}
    int now=0,limit=0;bool future=false;bool calibrated=day_reference(&now,&limit,&future);
    static bool had_clock;static int old_limit=-1;
    if(calibrated!=had_clock||(calibrated&&limit!=old_limit)){day_pending=true;had_clock=calibrated;old_limit=limit;}
    if(calibrated&&day_follow_now&&!day_scrubbing&&day_minute!=now){day_minute=day_clamp(now);day_pending=true;}
    if(!day_scrubbing)day_cursor=day_minute;
    if(day_pending&&current_page==PAGE_HOME&&face==1)day_invalidate_track();
}
static double day_theta(lv_point_t p){double a=atan2((double)p.x-233,233-(double)p.y);return a<0?a+6.283185307179586:a;}
static bool day_begin(lv_point_t p)
{
    int dx=p.x-233,dy=p.y-233,r2=dx*dx+dy*dy;
    if(transitioning()||current_page!=PAGE_HOME||face!=1||mode==MODE_AOD||mode==MODE_OFF||previous.pairing||gift_modal()||!lv_obj_has_flag(reset_layer,LV_OBJ_FLAG_HIDDEN)||r2<185*185||r2>233*233)return false;
    day_follow_now=false;day_scrubbing=true;day_angle=day_theta(p);day_cursor=day_clamp((int)(day_angle*1440/6.283185307179586));day_minute=(int)day_cursor;day_pending=true;day_invalidate_track();return true;
}
static void day_move(lv_point_t p)
{
    last_input=lv_tick_get();int dx=p.x-233,dy=p.y-233;if(dx*dx+dy*dy<80*80)return;
    double a=day_theta(p),d=a-day_angle;while(d>3.141592653589793)d-=6.283185307179586;while(d< -3.141592653589793)d+=6.283185307179586;day_angle=a;
    day_cursor+=d*1440/6.283185307179586;if(day_cursor<day_lo())day_cursor=day_lo();if(day_cursor>day_hi())day_cursor=day_hi();int minute=day_clamp((int)floor(day_cursor));if(minute!=day_minute){day_minute=minute;day_pending=true;day_invalidate_track();}
}
static void day_project(void)
{
    if(current_page!=PAGE_HOME||face!=1||mode==MODE_AOD||mode==MODE_OFF||!day_pending)return;
    day_pending=false;
    set_label(face_heading,"一天进程",94);hide(face_phase,false);hide(ring_missing,false);hide(face_action,true);hide(face_weather,true);hide(home_action_prop,true);hide(day_future_bubble,true);
    int now=0,limit=0;bool future=false;bool calibrated=day_reference(&now,&limit,&future);
    if(day_follow_now&&calibrated&&!day_scrubbing)day_minute=day_clamp(now);
    char text[120];
    if(day_follow_now&&calibrated)snprintf(text,sizeof text,"%s",day_now_date);
    else if(day_view.valid)snprintf(text,sizeof text,"%s%s",day_view.old?"上次 ":"",day_view.date);else snprintf(text,sizeof text,"等待手机同步");
    set_label(face_phase,text,126);
    if(!calibrated){
        set_label(face_phase,"需手机校时",126);
        snprintf(text,sizeof text,"%02d:%02d · 需手机校时",day_minute/60,day_minute%60);set_label(ring_missing,text,365);
        badge_scene_day_expectation(home_scene);
    }else if(future){
        /* Never consult the last historical segment in this branch. */
        snprintf(text,sizeof text,"%02d:%02d · 尚未发生",day_minute/60,day_minute%60);set_label(ring_missing,text,365);
        badge_scene_day_expectation(home_scene);set_label(face_phase,"轻点回到此刻",126);hide(day_future_bubble,false);
    }else{
        const l2_day_segment_t *selected=NULL;
        if(day_view.valid)for(unsigned i=0;i<day_view.count;i++)if(day_minute>=day_view.segments[i].start&&day_minute<day_view.segments[i].end){selected=day_view.segments+i;break;}
        const char *kinds[]={"休息","在家","通勤","工作","外出","走动","未知"};const char *sources[]={"观测","推测","示例"};
        if(day_follow_now){
            snprintf(text,sizeof text,"%02d:%02d · 当前状态",day_minute/60,day_minute%60);set_label(ring_missing,text,365);
            badge_scene_day_current(home_scene,domain.ready&&domain.has_snapshot&&!domain.storage_error,domain.snapshot.scene,domain.snapshot.weather,display_action(),live_context);
        }else{
            if(selected)snprintf(text,sizeof text,"%02d:%02d %s · %s",day_minute/60,day_minute%60,kinds[selected->kind],sources[selected->source]);
            else snprintf(text,sizeof text,"%02d:%02d · %s",day_minute/60,day_minute%60,day_view.valid?"无记录":"待手机同步");
            set_label(ring_missing,text,365);badge_scene_day_preview(home_scene,selected&&selected->kind!=6,selected?selected->kind:6,(unsigned)day_minute);
        }
    }
    static int old_x=233,old_y=14;
    double a=day_minute*6.283185307179586/1440-1.570796326794897;int x=233+(int)(219*cos(a)),y=233+(int)(219*sin(a));
    lv_area_t area;lv_obj_get_coords(pages[PAGE_HOME],&area);
    lv_area_t old={area.x1+old_x-10,area.y1+old_y-10,area.x1+old_x+10,area.y1+old_y+10},next={area.x1+x-10,area.y1+y-10,area.x1+x+10,area.y1+y+10};lv_obj_invalidate_area(pages[PAGE_HOME],&old);lv_obj_invalidate_area(pages[PAGE_HOME],&next);old_x=x;old_y=y;hide(ring_marker,true);
}
static void day_arc(lv_layer_t *layer,lv_draw_arc_dsc_t *d,int start,int end)
{
    if(end<=start)return;
    double a=start*.25+270,b=end*.25+270;
    if(end-start>=1440){d->start_angle=0;d->end_angle=360;}
    else{if(a>=360)a-=360;if(b>=360)b-=360;d->start_angle=(lv_value_precise_t)a;d->end_angle=(lv_value_precise_t)b;if(d->start_angle==d->end_angle)return;}
    lv_draw_arc(layer,d);
}
static void day_draw(lv_event_t *e)
{
    /* 返回预览移动的是真实 HOME 对象；不提前提交导航或投影新事件。 */
    bool visible_home=current_page==PAGE_HOME||(ui_drag.active&&ui_drag.has_target&&ui_drag.target==PAGE_HOME);
    if(!visible_home||face!=1||mode==MODE_AOD||mode==MODE_OFF)return;
    lv_layer_t *layer=lv_event_get_layer(e);lv_area_t area;lv_obj_get_coords(pages[PAGE_HOME],&area);
    int now=0,limit=0;bool future=false;bool calibrated=day_reference(&now,&limit,&future);
    int solid_end=calibrated?(day_minute<limit?day_minute:limit):0;
    static const uint32_t colors[]={0x8577a5,0xc89559,0x6c98a3,0x8b9d64,0x689779,0xd29a67,0xaaa394};
    if(day_view.valid&&calibrated&&(!day_follow_now||day_records_today))for(unsigned i=0;i<day_view.count;i++){
        const l2_day_segment_t *seg=day_view.segments+i;int end=seg->end<solid_end?seg->end:solid_end;if(end<=seg->start)continue;
        lv_draw_arc_dsc_t d;lv_draw_arc_dsc_init(&d);d.center=(lv_point_t){area.x1+233,area.y1+233};d.radius=224;d.width=seg->source==0?11:seg->source==1?8:9;d.color=lv_color_hex(seg->source==2?0xad88b1:colors[seg->kind]);d.opa=seg->source==1?170:255;d.rounded=0;day_arc(layer,&d,seg->start,end);
    }
    if(calibrated&&future){
        lv_draw_arc_dsc_t dash;lv_draw_arc_dsc_init(&dash);dash.center=(lv_point_t){area.x1+233,area.y1+233};dash.radius=224;dash.width=5;dash.color=lv_color_hex(0xb2aa9a);dash.opa=130;dash.rounded=1;
        /* At most120 short strokes, only on a normal invalidation. No timer,
         * continuous full-screen animation, new transfer or high-frequency work. */
        for(int m=limit;m<day_minute;m+=12)day_arc(layer,&dash,m,m+6<day_minute?m+6:day_minute);
    }
    lv_draw_arc_dsc_t cursor;lv_draw_arc_dsc_init(&cursor);cursor.center=(lv_point_t){area.x1+233,area.y1+233};cursor.radius=225;cursor.width=15;cursor.color=lv_color_hex(0x62452e);cursor.opa=255;cursor.rounded=1;
    double a=day_minute*.25+270;if(a>=360)a-=360;cursor.start_angle=(lv_value_precise_t)(a-1<0?a+359:a-1);cursor.end_angle=(lv_value_precise_t)(a+1>=360?a-359:a+1);lv_draw_arc(layer,&cursor);
}
