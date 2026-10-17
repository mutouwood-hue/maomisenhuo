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
    else if(elapsed<=ZIP_UI_SWIPEMAXMS) {
        int dx=g->last_x-g->x, dy=g->last_y-g->y;
        if(dx*dx+dy*dy>=ZIP_UI_SWIPEMINPX*ZIP_UI_SWIPEMINPX)
            result=abs(dx)>abs(dy) ? (dx>0 ? BADGE_GESTURE_RIGHT : BADGE_GESTURE_LEFT) : (dy>0 ? BADGE_GESTURE_DOWN : BADGE_GESTURE_UP);
    }
    g->active=false; return result;
}
