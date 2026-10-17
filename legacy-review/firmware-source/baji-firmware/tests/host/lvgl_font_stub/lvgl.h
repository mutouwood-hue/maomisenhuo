/*
 * lvgl.h - the smallest stand-in that lets main/ui/badge_assets.{c,h} compile on a
 * host with no LVGL.
 *
 * badge_assets.h includes "lvgl.h" only for the lv_font_t type: it declares the
 * four faces (badge_f16/f20/f24/n40) and hands out pointers to them, and never
 * looks inside one. The real lvgl.h -- managed_components/lvgl__lvgl/lvgl.h plus
 * lv_conf.h and the ESP-IDF display stack behind it -- is not available off the
 * device, and pulling it in for a typedef would make this test depend on the
 * panel, the codec and the sdkconfig.
 *
 * So this is deliberately one line wide. Anything more would be a second, fake
 * LVGL that tests could accidentally pass against.
 *
 * Used by: tools/suite/05-assets.cmd (via -I tests/host/lvgl_font_stub), together
 * with tests/host/badge_font_stub.c, which defines the four faces so the test
 * links. Never compiled into the firmware.
 *
 * lv_font_t is an incomplete type on purpose: the only thing the host build can do
 * with it is compare pointers, which is exactly what test_badge_assets.c checks.
 */
#pragma once

typedef struct _lv_font_t lv_font_t;
