#pragma once
/* Pinned LVGL 9.5 snapshot integration. The active screen is fully opaque;
 * overlays are redrawn into the SAME RGB565 target, preserving their normal
 * blend order/rounding. This includes top-layer toasts, gifts and feedback.
 * Caller holds BSP lock; no timers, input, flush or domain action is invoked. */
#include "lvgl.h"
#include "src/core/lv_refr_private.h"
#include "src/display/lv_display_private.h"
#if LVGL_VERSION_MAJOR != 9 || LVGL_VERSION_MINOR != 5 || LVGL_VERSION_PATCH != 0
#error "Re-review badge display capture for a changed LVGL renderer"
#endif
static inline bool badge_display_capture_rgb565(lv_display_t *disp,lv_draw_buf_t *buf)
{
    lv_obj_t *screen=lv_display_get_screen_active(disp);
    if(lv_obj_get_style_bg_opa(screen,0)!=LV_OPA_COVER)return false;
    if(lv_snapshot_take_to_draw_buf(screen,LV_COLOR_FORMAT_RGB565,buf)!=LV_RESULT_OK)return false;
    if(buf->header.w!=466||buf->header.h!=466||buf->header.stride!=932)return false;
    lv_obj_t *objects[]={lv_display_get_layer_top(disp),lv_display_get_layer_sys(disp)};
    for(unsigned i=0;i<2;i++)lv_obj_update_layout(objects[i]);
    lv_layer_t layer;lv_layer_init(&layer);layer.draw_buf=buf;
    layer.buf_area=(lv_area_t){0,0,465,465};layer._clip_area=layer.buf_area;
    layer.phy_clip_area=layer.buf_area;layer.color_format=LV_COLOR_FORMAT_RGB565;
    lv_draw_unit_send_event(NULL,LV_EVENT_CHILD_CREATED,&layer);
    lv_display_t *previous=lv_refr_get_disp_refreshing();lv_layer_t *saved=disp->layer_head;
    disp->layer_head=&layer;lv_refr_set_disp_refreshing(disp);
    for(unsigned i=0;i<2;i++)lv_obj_refr(&layer,objects[i]);
    layer.all_tasks_added=true;
    while(layer.draw_task_head){lv_draw_dispatch_wait_for_request();lv_draw_dispatch();}
    disp->layer_head=saved;lv_refr_set_disp_refreshing(previous);
    lv_draw_unit_send_event(NULL,LV_EVENT_SCREEN_LOAD_START,&layer);
    lv_draw_unit_send_event(NULL,LV_EVENT_CHILD_DELETED,&layer);
    return true;
}
