#pragma once
#include "esp_err.h"
#include "lvgl.h"
/* Called under the existing display initialization owner. No runtime probing. */
esp_err_t bsp_lcd_partial_te_attach(lv_display_t *display, int gpio_num);
