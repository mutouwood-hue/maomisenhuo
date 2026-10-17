#pragma once
#include "esp_err.h"
esp_err_t nvs_flash_init(void);
/* Deliberately no erase API: linking a destructive call would fail this harness. */
