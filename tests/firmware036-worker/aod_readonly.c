/* Read-only production035 composition reproduction; no source/UI patch. */
#define main original_preview_main
#include "../../artifacts/firmware-local-v3-perf035/source/tools/host_preview/preview.c"
#undef main
static void bounds(const char*n,lv_obj_t*o){lv_area_t a;lv_obj_get_coords(o,&a);printf("%s=[%d,%d,%d,%d] fontLine=%u text=%s hidden=%u\n",n,a.x1,a.y1,a.x2,a.y2,lv_obj_get_style_text_font(o,0)->line_height,lv_label_get_text(o),lv_obj_has_flag(o,LV_OBJ_FLAG_HIDDEN));}
int main(void){make_fixture("main_c_clock");lv_init();lv_tick_inc(1000);assert(badge_ui_start());choose("main_c_clock",NULL,0);last_input=lv_tick_get()-41000;advance(600);lv_obj_update_layout(lv_screen_active());assert(mode==MODE_AOD&&face==2&&clock_valid);bounds("clock",home_clock);bounds("hint",home_hint);bounds("phase",face_phase);lv_point_t size;lv_text_get_size(&size,lv_label_get_text(home_hint),lv_obj_get_style_text_font(home_hint,0),0,0,250,LV_TEXT_FLAG_NONE);printf("hint_text_size=%d,%d; suggested_center438_text_bounds=[%d,%d,%d,%d]\n",size.x,size.y,233-size.x/2,438-size.y/2,233-size.x/2+size.x-1,438-size.y/2+size.y-1);return 0;}
