/* Existing authorized A room, static asset conversion; not a runtime 3D renderer. */
#include "lvgl.h"
extern const uint8_t warm_room_start[] asm("_binary_warm_room_rgb565_start");
const lv_image_dsc_t warm_room={.header={.magic=LV_IMAGE_HEADER_MAGIC,.cf=LV_COLOR_FORMAT_RGB565,.w=466,.h=466,.stride=932},.data_size=434312,.data=warm_room_start};
