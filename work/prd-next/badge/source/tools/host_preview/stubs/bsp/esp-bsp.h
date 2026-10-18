#pragma once
#include "lvgl.h"
#include "esp_err.h"
lv_display_t *bsp_display_start(void);
lv_indev_t *bsp_display_get_input_dev(void);
esp_err_t bsp_display_lock(unsigned timeout);
void bsp_display_unlock(void);
esp_err_t bsp_display_brightness_set(int percent);
