#include "baji_gesture.h"
#include <string.h>
static int bound(int v, int max) { return v < 0 ? 0 : v >= max ? max - 1 : v; }
static int magnitude(int v) { return v < 0 ? -v : v; }
static uint64_t squared(int x, int y) { return (uint64_t)((int64_t)x*x + (int64_t)y*y); }
bj_gesture_config_t bj_gesture_html_config(void) {
    return (bj_gesture_config_t){466,12,12,50,140,28,300,500,600,80,.3f,.25f,220,120,180,200};
}
bool bj_gesture_init(bj_gesture_t *g, const bj_gesture_config_t *c) {
    if (!g || !c || c->panel < 2 || c->panel > 4096 || c->lock_px <= 0 ||
        c->tap_move_px <= 0 || c->commit_px <= 0 || c->fast_px <= 0 ||
        c->hold_ms == 0 || c->reverse_window_ms > 120 || c->reverse_speed < 0 ||
        !(c->rubber_ratio >= 0 && c->rubber_ratio <= 1) || c->rubber_max_px < 0) return false;
    memset(g,0,sizeof(*g)); g->config=*c; return true;
}
static void record(bj_gesture_t *g, uint32_t now) {
    unsigned last = (g->head + BJ_HISTORY_CAPACITY - 1) % BJ_HISTORY_CAPACITY;
    if (g->count && g->history[last].time == now) {
        g->history[last]=(bj_point_t){now,g->x,g->y}; return;
    }
    g->history[g->head]=(bj_point_t){now,g->x,g->y};
    g->head=(g->head+1)%BJ_HISTORY_CAPACITY;
    if (g->count<BJ_HISTORY_CAPACITY) g->count++;
}
void bj_gesture_press(bj_gesture_t *g,int x,int y,uint32_t now,bool hold_allowed) {
    if (!g) return;
    g->pressed=true; g->holding=false; g->hold_allowed=hold_allowed;
    g->axis=0; g->x0=g->x=bound(x,g->config.panel); g->y0=g->y=bound(y,g->config.panel);
    g->started=now; g->max_move_sq=0; g->head=g->count=0; record(g,now);
}
void bj_gesture_move(bj_gesture_t *g,int x,int y,uint32_t now) {
    if (!g || !g->pressed) return;
    g->x=bound(x,g->config.panel); g->y=bound(y,g->config.panel);
    int dx=g->x-g->x0,dy=g->y-g->y0;
    uint64_t move=squared(dx,dy);
    if (move>g->max_move_sq) g->max_move_sq=move;
    if (!g->axis && !g->holding && move>=(uint64_t)g->config.lock_px*g->config.lock_px)
        g->axis=magnitude(dx)>magnitude(dy)?1:2;
    record(g,now);
}
bj_input_result_t bj_gesture_tick(bj_gesture_t *g,uint32_t now) {
    bj_input_result_t r={0};
    if (g && g->pressed && g->hold_allowed && !g->holding && !g->axis &&
        g->max_move_sq<(uint64_t)g->config.tap_move_px*g->config.tap_move_px &&
        now-g->started>=g->config.hold_ms) {
        g->holding=true; r.kind=BJ_HOLD_START; r.x=g->x; r.y=g->y;
    }
    return r;
}
bj_direction_t bj_gesture_direction(const bj_gesture_t *g) {
    if (!g || !g->pressed || !g->axis) return BJ_DIR_NONE;
    return g->axis==1 ? (g->x<g->x0?BJ_LEFT:BJ_RIGHT) : (g->y<g->y0?BJ_UP:BJ_DOWN);
}
int bj_gesture_offset(const bj_gesture_t *g,bool has_target) {
    if (!g || !g->axis) return 0;
    int d=g->axis==1?g->x-g->x0:g->y-g->y0;
    if (has_target) return d;
    int m=(int)(magnitude(d)*g->config.rubber_ratio);
    if (m>g->config.rubber_max_px) m=g->config.rubber_max_px;
    return d<0?-m:m;
}
bj_input_result_t bj_gesture_release(bj_gesture_t *g,int x,int y,uint32_t now,bool target,bool cancelled) {
    bj_input_result_t r={0};
    if (!g || !g->pressed) return r;
    if (!cancelled) bj_gesture_move(g,x,y,now);
    r.x=g->x; r.y=g->y; r.direction=bj_gesture_direction(g);
    r.offset=bj_gesture_offset(g,target);
    uint32_t age=now-g->started;
    if (g->holding) r.kind=BJ_HOLD_END;
    else if (cancelled) { r.kind=BJ_CANCEL; r.duration_ms=g->config.cancel_ms; }
    else if (g->axis) {
        int d=g->axis==1?g->x-g->x0:g->y-g->y0;
        const bj_point_t *first=NULL;
        for (unsigned i=0;i<g->count;i++) {
            unsigned idx=(g->head+BJ_HISTORY_CAPACITY-g->count+i)%BJ_HISTORY_CAPACITY;
            const bj_point_t *p=&g->history[idx];
            if (now-p->time<=g->config.reverse_window_ms) {first=p;break;}
        }
        float velocity=0;
        if (first) {
            uint32_t ms=now-first->time;
            velocity=(float)(g->axis==1?g->x-first->x:g->y-first->y)/(ms?ms:1);
        }
        bool reverse=velocity*(d<0?-1:1)<-g->config.reverse_speed;
        bool commit=target && !reverse &&
            ((magnitude(d)>=g->config.fast_px && age<=g->config.fast_ms) || magnitude(d)>=g->config.commit_px);
        r.kind=!target?BJ_RUBBER:commit?BJ_COMMIT:BJ_CANCEL;
        if (commit) {
            uint32_t duration=g->config.commit_ms*(uint32_t)(g->config.panel-magnitude(d))/(uint32_t)g->config.panel;
            r.duration_ms=duration<g->config.commit_min_ms?g->config.commit_min_ms:duration;
        } else r.duration_ms=target?g->config.cancel_ms:g->config.rubber_ms;
    } else if (g->max_move_sq<(uint64_t)g->config.tap_move_px*g->config.tap_move_px && age<=g->config.tap_ms)
        r.kind=BJ_TAP;
    g->pressed=false; return r;
}
