#include "baji_gesture.h"
#include <stdio.h>
#include <limits.h>
static unsigned checks,failed;
#define CHECK(c) do { checks++; if (!(c)) { failed++; printf("FAIL %d: %s\n",__LINE__,#c); } } while(0)
static bj_gesture_t g;
int main(void) {
    bj_gesture_config_t c=bj_gesture_html_config();
    CHECK(bj_gesture_init(&g,&c)); CHECK(!bj_gesture_init(NULL,&c));
    bj_gesture_press(&g,200,200,100,true);
    CHECK(g.pressed); CHECK(bj_gesture_tick(&g,699).kind==BJ_INPUT_NONE);
    CHECK(bj_gesture_tick(&g,700).kind==BJ_HOLD_START);
    CHECK(bj_gesture_tick(&g,701).kind==BJ_INPUT_NONE);
    CHECK(bj_gesture_release(&g,200,200,720,true,false).kind==BJ_HOLD_END);
    CHECK(!g.pressed);
    bj_gesture_press(&g,200,200,100,false);
    CHECK(bj_gesture_release(&g,211,200,400,true,false).kind==BJ_TAP);
    bj_gesture_press(&g,200,200,100,true);
    bj_gesture_move(&g,212,200,120); bj_gesture_move(&g,200,200,130);
    CHECK(bj_gesture_tick(&g,700).kind==BJ_INPUT_NONE);
    CHECK(bj_gesture_release(&g,200,200,710,true,false).kind==BJ_CANCEL);
    for(int direction=0;direction<4;direction++) {
        int dx=direction==2?-50:direction==3?50:0;
        int dy=direction==0?-50:direction==1?50:0;
        bj_gesture_press(&g,233,233,0,false);
        bj_gesture_move(&g,233+dx,233+dy,100);
        CHECK(bj_gesture_direction(&g)==(bj_direction_t)(BJ_UP+direction));
        bj_input_result_t r=bj_gesture_release(&g,233+dx,233+dy,500,true,false);
        CHECK(r.kind==BJ_COMMIT); CHECK(r.duration_ms==196);
    }
    bj_gesture_press(&g,233,233,0,false);
    CHECK(bj_gesture_release(&g,183,233,501,true,false).kind==BJ_CANCEL);
    bj_gesture_press(&g,233,233,0,false);
    CHECK(bj_gesture_release(&g,93,233,2000,true,false).kind==BJ_COMMIT);
    bj_gesture_press(&g,233,233,0,false);
    CHECK(bj_gesture_release(&g,94,233,2000,true,false).kind==BJ_CANCEL);
    bj_gesture_press(&g,233,233,0,false);
    bj_gesture_move(&g,33,233,500);
    bj_input_result_t r=bj_gesture_release(&g,73,233,550,true,false);
    CHECK(r.kind==BJ_CANCEL); CHECK(r.duration_ms==180);
    bj_gesture_press(&g,233,233,0,false);
    bj_gesture_move(&g,33,233,500);
    CHECK(bj_gesture_offset(&g,false)==-28);
    CHECK(bj_gesture_release(&g,33,233,550,false,false).kind==BJ_RUBBER);
    bj_gesture_press(&g,233,233,0,false);
    CHECK(bj_gesture_release(&g,33,233,100,true,true).kind==BJ_CANCEL);
    CHECK(bj_gesture_release(&g,233,233,101,true,false).kind==BJ_INPUT_NONE);
    bj_gesture_press(&g,200,200,UINT_MAX-99,false);
    CHECK(bj_gesture_release(&g,150,200,100,true,false).kind==BJ_COMMIT);
    bj_gesture_press(&g,INT_MIN,INT_MAX,0,false);
    CHECK(g.x==0 && g.y==465);
    for(unsigned t=1;t<1000;t++) bj_gesture_move(&g,(int)(t%466),200,t);
    CHECK(g.count==BJ_HISTORY_CAPACITY);
    CHECK(bj_gesture_release(&g,0,200,1000,true,true).kind==BJ_CANCEL);
    c.rubber_ratio=2; CHECK(!bj_gesture_init(&g,&c));
    printf("v2 gesture: %u checks, %u failures\n",checks,failed);
    return failed?1:0;
}
