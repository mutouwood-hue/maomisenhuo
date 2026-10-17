#pragma once
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
#include "freertos/FreeRTOS.h"
#include "esp_err.h"
typedef struct {uint32_t tx_buffer_size,rx_buffer_size;} usb_serial_jtag_driver_config_t;
int usb_serial_jtag_read_bytes(void*,uint32_t,TickType_t);
int usb_serial_jtag_write_bytes(const void*,size_t,TickType_t);
bool usb_serial_jtag_is_driver_installed(void);
esp_err_t usb_serial_jtag_driver_install(usb_serial_jtag_driver_config_t*);
esp_err_t usb_serial_jtag_driver_uninstall(void);
