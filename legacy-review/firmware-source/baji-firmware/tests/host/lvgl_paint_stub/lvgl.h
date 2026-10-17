/*
 * A minimal lvgl.h for compiling badge_paint.c on the host.
 *
 * This stub exists so tools/suite/03-paint.cmd can build and run
 * tests/host/test_badge_paint.c with no board, no ESP-IDF and no LVGL. It carries
 * only what badge_paint.h / badge_paint.c / badge_paint_priv.h actually name, and it
 * carries it at the same shapes the vendored LVGL 9.5 uses, so a mismatch shows up
 * as a compile error here rather than as a silently different pixel on the glass:
 *
 *   lv_color_t          three bytes, blue/green/red, in that order
 *                       (managed_components/lvgl__lvgl/src/misc/lv_color.h)
 *   lv_color32_t        four bytes, blue/green/red/alpha, in that order
 *   lv_color_make()     the RGB888 constructor
 *   lv_opa_t            uint8_t; LV_OPA_TRANSP / LV_OPA_COVER
 *   lv_obj_t            opaque; the canvas is never dereferenced by badge_paint
 *   lv_canvas_set_px()  LVGL 9.5's FOUR-argument pixel store
 *   lv_canvas_get_px()  the ARGB8888 pixel reader
 *
 * The two canvas functions are never called in the host build: badge_paint_host_bind()
 * replaces them with a plain uint32_t buffer, and the -DBADGE_PAINT_HOST defaults are
 * no-ops. They are declared so badge_paint.c's non-host branch would still compile if
 * someone flipped the switch, and so a stray call fails at link time instead of
 * quietly doing nothing.
 *
 * NOT the real LVGL: do not add anything to this file that badge_paint does not use.
 * Fonts, widgets, draw units and the rest of LVGL are intentionally absent -- text is
 * an LVGL widget owned by badge_ui.c, which never runs on the host.
 *
 * tests/host/lvgl_font_stub/lvgl.h is a different, separately owned stub for the
 * font/asset test; this one is not a replacement for it.
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

typedef struct {
    uint8_t blue;
    uint8_t green;
    uint8_t red;
    uint8_t alpha;
} lv_color32_t;

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

void lv_canvas_set_px(lv_obj_t *obj, int32_t x, int32_t y, lv_color_t color, lv_opa_t opa);
lv_color32_t lv_canvas_get_px(lv_obj_t *obj, int32_t x, int32_t y);

/*
 * The canvas's backing store, at the shapes LVGL 9.5 declares them
 * (lvgl/src/draw/lv_image_dsc.h:98-107 for the bitfield order and lv_draw_buf.h:91-97
 * for the buffer).
 *
 * This phase compiles badge_paint.c a second time with the FIRMWARE's compiler and
 * WITHOUT -DBADGE_PAINT_HOST (03-paint.cmd, pass 2), which is exactly the
 * configuration where bp_default_set() writes straight into the draw buffer instead
 * of calling lv_canvas_set_px(). That pass is what makes "host tests green" mean "the
 * firmware compiles", so the stub has to carry these names even though the pixel test
 * itself never dereferences them. Real bitfields, not plain uint32_t fields: a
 * mismatch would otherwise hide a break in the stride the firmware reads.
 */
typedef struct {
    uint32_t magic : 8;
    uint32_t cf : 8;
    uint32_t flags : 16;
    uint32_t w : 16;
    uint32_t h : 16;
    uint32_t stride : 16; /* bytes per row */
    uint32_t reserved_2 : 16;
} lv_image_header_t;

typedef struct {
    lv_image_header_t header;
    uint32_t data_size;
    uint8_t *data;
} lv_draw_buf_t;

lv_draw_buf_t *lv_canvas_get_draw_buf(lv_obj_t *obj);
void *lv_draw_buf_goto_xy(const lv_draw_buf_t *buf, uint32_t x, uint32_t y);

#ifdef __cplusplus
}
#endif
