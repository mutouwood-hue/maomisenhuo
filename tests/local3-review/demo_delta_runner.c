/* Necessary delta check only; actual current pages + existing LVGL host doubles. */
#define main owner_main_not_called
#include "../../artifacts/firmware-local-v3/source/tools/host_preview/preview.c"
#undef main
int main(void){
 make_fixture("main_a");lv_init();lv_tick_inc(1000);if(!badge_ui_start())return 2;advance(1800);select_page(PAGE_GUIDE);guide_index=3;update_guide();
 unsigned saved=mock_pet_calls,checks=0;advance(80);lv_obj_update_layout(stage_root);int last=lv_obj_get_x(guide_icon),largest=0,max_error=0;
 for(unsigned t=0;t<4800;t+=20){
  advance(20);lv_obj_update_layout(stage_root);unsigned phase=(lv_tick_get()-guide_demo_started)%2400;int expected=157+(int)(phase<1200?phase:2400-phase)*135/1200;
  int x=lv_obj_get_x(guide_icon),step=abs(x-last),error=abs(x-expected);if(step>largest)largest=step;if(error>max_error)max_error=error;
  if(x<157||x>292||step>5||error>5){fprintf(stderr,"delta FAIL phase=%u x=%d expected=%d step=%d\n",phase,x,expected,step);return 11;}checks+=3;last=x;
 }
 if(mock_pet_calls!=saved||guide_index!=3||guide_pass_until||guide_lr_mask){fprintf(stderr,"demo advanced state or emitted care\n");return 12;}checks+=4;
 printf("{\"scope\":\"independent delta actual production UI timer/layout, host doubles not hardware\",\"passed\":true,\"assertions\":%u,\"samples\":240,\"sampleStepMs\":20,\"twoCyclesMs\":4800,\"largestStepPx\":%d,\"maxPhaseErrorPx\":%d}\n",checks,largest,max_error);return 0;
}
