#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL -1
#define ESP_ERR_NO_MEM 0x101
#define ESP_ERR_NVS_NOT_FOUND 0x1102
#define NVS_READWRITE 1
#define I2C_ADDR_BIT_LEN_7 7
#define pdTRUE 1
#define pdPASS 1
#define pdMS_TO_TICKS(x) (x)
typedef unsigned nvs_handle_t;
typedef void *QueueHandle_t;
typedef void *TaskHandle_t;
typedef void *i2c_master_dev_handle_t;
typedef void *i2c_master_bus_handle_t;
typedef struct {int dev_addr_length;unsigned device_address,scl_speed_hz;} i2c_device_config_t;
int64_t esp_timer_get_time(void);
QueueHandle_t xQueueCreate(unsigned,size_t);
int xQueuePeek(QueueHandle_t,void *,unsigned);
int xQueueReceive(QueueHandle_t,void *,unsigned);
int xQueueSend(QueueHandle_t,const void *,unsigned);
int xQueueOverwrite(QueueHandle_t,const void *);
int xTaskCreate(void (*)(void *),const char *,unsigned,void *,unsigned,TaskHandle_t *);
void vTaskDelay(unsigned);
i2c_master_bus_handle_t bsp_i2c_get_handle(void);
esp_err_t i2c_master_bus_add_device(i2c_master_bus_handle_t,const i2c_device_config_t *,i2c_master_dev_handle_t *);
esp_err_t i2c_master_transmit_receive(i2c_master_dev_handle_t,const uint8_t *,size_t,uint8_t *,size_t,unsigned);
esp_err_t i2c_master_transmit(i2c_master_dev_handle_t,const uint8_t *,size_t,unsigned);
esp_err_t nvs_open(const char *,int,nvs_handle_t *);
esp_err_t nvs_get_blob(nvs_handle_t,const char *,void *,size_t *);
esp_err_t nvs_set_blob(nvs_handle_t,const char *,const void *,size_t);
esp_err_t nvs_commit(nvs_handle_t);
typedef struct {int unused;} mbedtls_md_info_t;
#define MBEDTLS_MD_SHA256 1
const mbedtls_md_info_t *mbedtls_md_info_from_type(int);
int mbedtls_md(const mbedtls_md_info_t *,const unsigned char *,size_t,unsigned char *);
int mbedtls_md_hmac(const mbedtls_md_info_t *,const unsigned char *,size_t,const unsigned char *,size_t,unsigned char *);
