/*
 * A minimal lvgl.h for compiling badge_ui_plan.c (and its test) on the host.
 *
 * WHY THIS STUB EXISTS AT ALL
 * badge_ui_plan.h is the LVGL-free half of the screen system: it never calls LVGL,
 * never allocates and never includes a widget header. It does, however, hold the
 * previous frame's badge_paint_state_t so it can diff it, and that struct lives in
 * badge_paint.h -- which includes lvgl.h for its own prototypes.
 *
 * The alternative was to copy badge_paint_state_t into badge_ui_plan.h. That would be
 * a second definition of the state layout, which is exactly the class of bug this
 * repository keeps having to fix (badge_paint.c and badge_geom.c both used to define
 * `badge_el_box`; see the note in badge_paint_priv.h). So the real header is used, and
 * this stub supplies the four types it names:
 *
 *   lv_obj_t      opaque; badge_paint.h only ever passes it through
 *   lv_color_t    three bytes, blue/green/red, in that order
 *                 (managed_components/lvgl__lvgl/src/misc/lv_color.h)
 *   lv_opa_t      uint8_t
 *   lv_color_make()  the RGB888 constructor badge_rgb() calls
 *
 * It is deliberately smaller than tests/host/lvgl_paint_stub/lvgl.h, which exists for
 * a different test: badge_paint.c's host build needs no canvas functions (the
 * -DBADGE_PAINT_HOST defaults are no-ops and badge_paint_host_bind() replaces the
 * pixel store with a plain buffer), so nothing here declares lv_canvas_set_px().
 *
 * NOT the real LVGL. badge_ui_plan.c must keep compiling against this file: if it
 * starts needing a widget, a font or a draw buffer, it has stopped being the half of
 * the system a host test can drive, and this file failing to compile is the warning.
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef uint8_t lv_opa_t;

enum {
    LV_OPA_TRANSP = 0,
    LV_OPA_0 = 0,
    LV_OPA_10 = 25,
    LV_OPA_20 = 51,
    LV_OPA_30 = 76,
    LV_OPA_40 = 102,
    LV_OPA_50 = 127,
    LV_OPA_60 = 153,
    LV_OPA_70 = 178,
    LV_OPA_80 = 204,
    LV_OPA_90 = 229,
    LV_OPA_100 = 255,
    LV_OPA_COVER = 255
};

typedef struct {
    uint8_t blue;
    uint8_t green;
    uint8_t red;
} lv_color_t;

typedef struct _lv_obj_t lv_obj_t;

typedef struct _lv_font_t lv_font_t;

static inline lv_color_t lv_color_make(uint8_t r, uint8_t g, uint8_t b)
{
    lv_color_t c;
    c.red = r;
    c.green = g;
    c.blue = b;
    return c;
}

#ifdef __cplusplus
}
#endif
