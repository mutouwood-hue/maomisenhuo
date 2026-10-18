/* Host-only adapters: run the actual production day_project/day_draw body.
 * Clock and LVGL are explicit fixtures, never real-device evidence. */
#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <math.h>
typedef struct {int x,y;} lv_point_t;
typedef struct {int x1,y1,x2,y2;} lv_area_t;
typedef struct {int unused;} lv_layer_t;
typedef struct {int unused;} lv_event_t;
typedef double lv_value_precise_t;
typedef struct {lv_point_t center;int radius,width;uint32_t color;unsigned opa,rounded;double start_angle,end_angle;} lv_draw_arc_dsc_t;
typedef struct {int start,end,kind,source;} l2_day_segment_t;
static struct {bool valid,old;char date[11];unsigned count;l2_day_segment_t segments[2];} day_view;
static struct {bool ready,has_snapshot,storage_error;struct {int scene,weather;} snapshot;} domain;
static struct {bool active,has_target;int target;} ui_drag;
enum {PAGE_HOME,PAGE_CARE,PAGE_STATUS};
enum {MODE_PLAY,MODE_AOD,MODE_OFF};
static int current_page,face=1,mode,day_minute,observed_action;
static bool day_pending,day_follow_now,day_scrubbing,day_records_today,live_context;
static char day_now_date[11]="2026-10-17";
static int home,marker,heading,phase,missing,action,weather,prop,bubble;
static int *pages[]={&home};
static int *face_heading=&heading,*face_phase=&phase,*ring_missing=&missing,*face_action=&action,*face_weather=&weather,*home_action_prop=&prop,*day_future_bubble=&bubble,*ring_marker=&marker;
static lv_area_t page_area,invalidated[2];
static unsigned invalidations,draws;
static lv_draw_arc_dsc_t drawn[140];
static bool calibrated;
static int fixture_now=600,fixture_limit=600;
static bool fixture_future;
static int day_clamp(int n){return n<0?0:n>1439?1439:n;}
static bool day_reference(int *now,int *limit,bool *future){*now=fixture_now;*limit=fixture_limit;*future=fixture_future;return calibrated;}
static void set_label(int *object,const char *text,int y){(void)object;(void)text;(void)y;}
static void hide(int *object,bool hidden){(void)object;(void)hidden;}
static void badge_scene_day_expectation(int *scene){(void)scene;}
static void badge_scene_day_current(int *scene,bool ready,int scene_id,int weather_id,int action_id,bool live){(void)scene;(void)ready;(void)scene_id;(void)weather_id;(void)action_id;(void)live;}
static void badge_scene_day_preview(int *scene,bool valid,int kind,unsigned minute){(void)scene;(void)valid;(void)kind;(void)minute;}
static int *home_scene=&home;
static void lv_obj_get_coords(int *object,lv_area_t *area){assert(object==&home);*area=page_area;}
static void lv_obj_invalidate_area(int *object,const lv_area_t *area){assert(object==&home);assert(invalidations<2);invalidated[invalidations++]=*area;}
static lv_layer_t layer;
static lv_layer_t *lv_event_get_layer(lv_event_t *event){(void)event;return &layer;}
static void lv_draw_arc_dsc_init(lv_draw_arc_dsc_t *arc){memset(arc,0,sizeof(*arc));}
static uint32_t lv_color_hex(uint32_t color){return color;}
static void lv_draw_arc(lv_layer_t *target,const lv_draw_arc_dsc_t *arc){assert(target==&layer);assert(draws<140);drawn[draws++]=*arc;}
#include "production_day.inc"
static void check_draw(int page,bool active,bool target,bool expected)
{
    current_page=page;ui_drag.active=active;ui_drag.has_target=target;ui_drag.target=PAGE_HOME;
    draws=0;lv_event_t event={0};day_draw(&event);
    assert(draws==(expected?1u:0u));
    if(expected){assert(drawn[0].center.x==page_area.x1+233);assert(drawn[0].center.y==page_area.y1+233);}
}
int main(void)
{
    page_area=(lv_area_t){30,-50,495,415};
    check_draw(PAGE_HOME,false,false,true);
    check_draw(PAGE_CARE,true,true,true);
    check_draw(PAGE_STATUS,true,true,true);
    check_draw(PAGE_CARE,true,false,false);
    check_draw(PAGE_CARE,false,true,false);
    ui_drag.target=PAGE_STATUS;current_page=PAGE_CARE;ui_drag.active=ui_drag.has_target=true;
    draws=0;lv_event_t event={0};day_draw(&event);assert(draws==0);
    mode=MODE_AOD;check_draw(PAGE_CARE,true,true,false);
    mode=MODE_OFF;check_draw(PAGE_HOME,false,false,false);
    mode=MODE_PLAY;face=0;check_draw(PAGE_CARE,true,true,false);face=1;
    calibrated=true;day_records_today=true;day_view.valid=true;day_view.count=1;
    day_view.segments[0]=(l2_day_segment_t){0,600,1,0};day_minute=720;fixture_future=true;
    current_page=PAGE_CARE;ui_drag.active=ui_drag.has_target=true;ui_drag.target=PAGE_HOME;
    draws=0;day_draw(&event);assert(draws==12); /* history + 10 future dashes + cursor */
    for(unsigned i=0;i<draws;i++){assert(drawn[i].center.x==263);assert(drawn[i].center.y==183);}
    day_pending=true;invalidations=0;day_project();assert(invalidations==0);assert(day_pending); /* preview is read-only */
    current_page=PAGE_HOME;day_minute=0;fixture_future=false;invalidations=0;day_project();assert(invalidations==2);
    assert(invalidated[0].x1==253&&invalidated[0].y1==-46);
    assert(invalidated[1].x1==253&&invalidated[1].y1==-46);
    page_area=(lv_area_t){0,0,465,465};day_minute=360;day_pending=true;invalidations=0;day_project();
    assert(invalidations==2);assert(invalidated[0].x1==223&&invalidated[0].y1==4);
    assert(invalidated[1].x1==442&&invalidated[1].y1==223);
    puts("PASS: production day preview drawing + absolute cursor invalidation (host fixtures)");
    return 0;
}
