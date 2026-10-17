#ifndef BAJI_COMPOSITION_H
#define BAJI_COMPOSITION_H
#include "baji_controller.h"
/* HTML default vertical cover (vertFadePx=210). Renderer-independent plan.
 * Frame remains the interaction geometry; no scene mutation or allocation. */
typedef struct {
    int source_x,source_y,target_x,target_y;
    uint8_t source_opacity;
    bool target_visible,moving;
} bj_composition_t;
static inline bj_composition_t bj_composition_plan(const bj_frame_t *f) {
    bj_composition_t p={0};p.source_opacity=255;
    if(!f) return p;
    p.source_x=f->source_x;p.source_y=f->source_y;
    p.target_x=f->target_x;p.target_y=f->target_y;
    p.target_visible=f->target_visible;
    p.moving=f->sliding || f->target_visible || f->source_x!=0 || f->source_y!=0;
    if(f->target_visible && f->source_y!=0) {
        int64_t distance=f->source_y;
        if(distance<0) distance=-distance;
        p.source_y=0;
        p.source_opacity=distance>=210?0:(uint8_t)((210-distance)*255/210);
    }
    return p;
}
/* Use the monotonic clock supplied at real commit, not the cat clock. */
static inline uint8_t bj_back_opacity(const bj_scene_t *s,uint32_t now) {
    if(!s || !s->tutorial_active || s->phase!=BJ_GUIDE_BACK) return 0;
    uint32_t elapsed=now-s->back_enter_t0;
    if(elapsed>UINT32_MAX/2) return 0;
    return elapsed>=250?255:(uint8_t)(elapsed*255/250);
}
#endif
