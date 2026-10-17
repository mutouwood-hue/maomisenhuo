#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL (-1)
void runtime_error_check(esp_err_t err);
#define ESP_ERROR_CHECK(expr) runtime_error_check(expr)
