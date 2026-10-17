/* 主机预览专用胶水，仅用于把生产 UI 渲染成 PNG：
   1) 提供设备上由诊断模块提供的 l2_runtime_core/l2_runtime_release；
   2) 用一张空的 466x466 RGB565 画布代替房间照片，避免依赖 objcopy 嵌入的原始像素。
   不参与固件构建，不代表真机画面。 */
#include <stddef.h>
#include <string.h>
#include "lvgl.h"

static void *g_preview_core;

void *l2_runtime_core(void) { return g_preview_core; }

void l2_runtime_release(void) { g_preview_core = NULL; }

void preview_bind_core(void *core) { g_preview_core = core; }

#define ROOM_W 466
#define ROOM_H 466
static uint8_t g_room_pixels[ROOM_W * ROOM_H * 2];

const lv_image_dsc_t warm_room = {
    .header = {.magic = LV_IMAGE_HEADER_MAGIC, .cf = LV_COLOR_FORMAT_RGB565, .w = ROOM_W, .h = ROOM_H, .stride = ROOM_W * 2},
    .data_size = sizeof(g_room_pixels),
    .data = g_room_pixels,
};
