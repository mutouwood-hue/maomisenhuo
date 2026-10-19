#pragma once
#include <stdbool.h>
typedef enum { BADGE_KEY_NONE, BADGE_KEY_POWER, BADGE_KEY_DOWN, BADGE_KEY_HOLD, BADGE_KEY_UP } badge_key_event_t;
/* Called after BSP I2C/display startup. PWR long press remains PMIC-owned. */
void badge_keys_init(void);
badge_key_event_t badge_keys_poll(void);
