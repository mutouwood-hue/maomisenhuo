#pragma once
#include "esp_err.h"
#include "lvgl.h"
#define ESP_LV_ADAPTER_DEFAULT_CONFIG() 0
#define ESP_LV_ADAPTER_ROTATE_0 0
#define ESP_LV_ADAPTER_TEAR_AVOID_MODE_NONE 0
typedef struct {
    int lv_adapter_cfg, rotation, tear_avoid_mode;
    struct { int swap_xy, mirror_x, mirror_y; } touch_flags;
} bsp_display_cfg_t;
lv_obj_t *bsp_display_start_with_config(const bsp_display_cfg_t *cfg);
esp_err_t bsp_display_lock(uint32_t timeout_ms);
void bsp_display_unlock(void);
lv_indev_t *bsp_display_get_input_dev(void);
