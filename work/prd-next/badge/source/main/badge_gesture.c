#include "badge_gesture.h"
#include "badge_ui_contract.h"
#include <stdlib.h>

void badge_gesture_begin(badge_gesture_t *g, int16_t x, int16_t y, uint32_t now)
{
    if(g->active) return;
    *g=(badge_gesture_t){.x=zip_ui_clamp(x),.y=zip_ui_clamp(y),.started_ms=now,.active=true};
    g->last_x=g->x; g->last_y=g->y;
}
void badge_gesture_move(badge_gesture_t *g, int16_t x, int16_t y)
{
    if(!g->active) return;
    g->last_x=zip_ui_clamp(x); g->last_y=zip_ui_clamp(y);
    int dx=g->last_x-g->x, dy=g->last_y-g->y;
    uint32_t distance=(uint32_t)(dx*dx+dy*dy);
    if(distance>g->maximum_distance_sq) g->maximum_distance_sq=distance;
    if(!g->axis && distance>=BADGE_GESTURE_AXIS_LOCK_PX*BADGE_GESTURE_AXIS_LOCK_PX)
        g->axis=abs(dx)>abs(dy)?BADGE_GESTURE_AXIS_HORIZONTAL:BADGE_GESTURE_AXIS_VERTICAL;
}
badge_gesture_kind_t badge_gesture_direction(const badge_gesture_t *g)
{
    if(!g->active || !g->axis)return BADGE_GESTURE_NONE;
    return g->axis==1 ? (g->last_x>=g->x?BADGE_GESTURE_RIGHT:BADGE_GESTURE_LEFT) : (g->last_y>=g->y?BADGE_GESTURE_DOWN:BADGE_GESTURE_UP);
}
bool badge_gesture_holding(const badge_gesture_t *g, uint32_t now)
{
    return g->active && (uint32_t)(now-g->started_ms)>=ZIP_UI_LONGPRESSMS &&
        g->maximum_distance_sq<ZIP_UI_TAPMOVEMAX*ZIP_UI_TAPMOVEMAX;
}
badge_gesture_kind_t badge_gesture_end(badge_gesture_t *g, int16_t x, int16_t y, uint32_t now)
{
    if(!g->active) return BADGE_GESTURE_NONE;
    badge_gesture_move(g,x,y);
    uint32_t elapsed=now-g->started_ms;
    badge_gesture_kind_t result=BADGE_GESTURE_NONE;
    if(elapsed<=ZIP_UI_TAPMAXMS && g->maximum_distance_sq<ZIP_UI_TAPMOVEMAX*ZIP_UI_TAPMOVEMAX) result=BADGE_GESTURE_TAP;
    else if(badge_gesture_holding(g,now)) result=BADGE_GESTURE_HOLD;
    else {
        int dx=g->last_x-g->x, dy=g->last_y-g->y;
        unsigned dominant=(unsigned)(g->axis==1 ? abs(dx) : abs(dy));
        if((elapsed<=ZIP_UI_SWIPEMAXMS && dominant>=ZIP_UI_SWIPEMINPX) || dominant>=BADGE_DRAG_SLOW_COMMIT_PX)
            result=badge_gesture_direction(g);
    }
    g->active=false; return result;
}

int badge_gesture_drag_offset(int raw, badge_gesture_kind_t locked_direction, bool has_target)
{
    int sign=locked_direction==BADGE_GESTURE_RIGHT||locked_direction==BADGE_GESTURE_DOWN?1:-1;
    int travel=raw*sign;
    if(travel<0)travel=0;
    if(has_target) {
        if(travel>BADGE_DRAG_PAGE_EXTENT_PX)travel=BADGE_DRAG_PAGE_EXTENT_PX;
    } else {
        travel/=4;
        if(travel>BADGE_DRAG_NO_TARGET_PX)travel=BADGE_DRAG_NO_TARGET_PX;
    }
    return sign*travel;
}
