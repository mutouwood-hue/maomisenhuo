#pragma once
#include <stdint.h>
typedef struct { int marker; } lv_obj_t;
typedef struct { int marker; } lv_indev_t;
typedef struct { int marker; } lv_timer_t;
typedef struct { int x, y; } lv_point_t;
typedef enum { LV_EVENT_ALL, LV_EVENT_PRESSED, LV_EVENT_PRESSING, LV_EVENT_RELEASED, LV_EVENT_PRESS_LOST, LV_EVENT_OTHER } lv_event_code_t;
typedef struct { lv_event_code_t code; } lv_event_t;
typedef void (*lv_timer_cb_t)(lv_timer_t *);
typedef void (*lv_event_cb_t)(lv_event_t *);
#define LV_OBJ_FLAG_CLICKABLE 1u
void lv_indev_get_point(lv_indev_t *dev, lv_point_t *point);
lv_event_code_t lv_event_get_code(lv_event_t *event);
lv_obj_t *lv_screen_active(void);
lv_timer_t *lv_timer_create(lv_timer_cb_t callback, uint32_t period, void *data);
void lv_obj_add_flag(lv_obj_t *obj, uint32_t flag);
void lv_obj_add_event_cb(lv_obj_t *obj, lv_event_cb_t callback, lv_event_code_t code, void *data);
