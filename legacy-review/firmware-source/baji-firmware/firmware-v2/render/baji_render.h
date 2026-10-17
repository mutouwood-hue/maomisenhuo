#pragma once
#include "lvgl.h"
#include "baji_controller.h"
#include "baji_power.h"
#include "../runtime/baji_data_runtime.h"
typedef struct bj_render bj_render_t;
bj_render_t *bj_render_create(lv_obj_t *parent);
bool bj_render_replace_assets(void *,const lv_image_dsc_t *,const lv_image_dsc_t *);
void bj_render_destroy(bj_render_t *r);
void bj_render_apply(bj_render_t *r,const bj_frame_t *frame,uint32_t animation_ms);
/* Policy supplied by caller: no recovery mode is selected inside rendering.
 * LOW hides all normal pages; denied autonomous animation freezes its clock.
 * Audio/BLE/input safety must be enforced separately by the runtime. */
void bj_render_apply_data(bj_render_t *r,const bj_data_view_t *view,
    const bj_power_view_t *power,uint8_t care_type,uint8_t care_count);
void bj_render_apply_power(bj_render_t *r,const bj_frame_t *frame,
    const bj_power_view_t *power,uint32_t now_ms);
