#pragma once
#include "lvgl.h"
#include <stdbool.h>
#include <stdint.h>
/* Volatile diagnostics and read-only domain observation; no persistence/wire mutations. */
void badge_diagnostics_attach(lv_display_t *display,lv_indev_t *input);
void badge_diagnostics_start_usb(void);
void badge_diagnostics_ui_tick(uint64_t start_us);
bool badge_ui_capture_allowed(void); /* Caller holds BSP display lock. */
bool badge_ui_diagnostic_select_face(unsigned face); /* locked, HOME-only, transient */
