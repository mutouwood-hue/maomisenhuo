#include "badge_keys.h"
#include <stdint.h>
#include "bsp/esp-bsp.h"
#include "driver/i2c_master.h"
#include "iot_button.h"
#include "button_gpio.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_timer.h"
#include "esp_log.h"

static i2c_master_dev_handle_t pmic;
static QueueHandle_t events;
static void pmic_keys_task(void *);
static bool read_reg(uint8_t reg,uint8_t *value){return pmic&&i2c_master_transmit_receive(pmic,&reg,1,value,1,15)==ESP_OK;}
static bool write_reg(uint8_t reg,uint8_t value){uint8_t b[]={reg,value};return pmic&&i2c_master_transmit(pmic,b,2,15)==ESP_OK;}
static void key_event(void *button,void *arg){(void)button;badge_key_event_t e=(badge_key_event_t)(uintptr_t)arg;(void)xQueueSend(events,&e,0);}
void badge_keys_init(void){
    events=xQueueCreate(16,sizeof(badge_key_event_t));if(!events)return;
    i2c_master_bus_handle_t bus=bsp_i2c_get_handle();
    i2c_device_config_t cfg={.dev_addr_length=I2C_ADDR_BIT_LEN_7,.device_address=0x34,.scl_speed_hz=100000};
    uint8_t id=0,irq=0,mask=0;
    if(bus&&i2c_master_bus_add_device(bus,&cfg,&pmic)==ESP_OK&&read_reg(0x03,&id)&&id==0x4a&&read_reg(0x41,&mask)){
        /* Only enable/read/clear PWRON latches; never change OFFLEVEL, rails,
         * power-off/reset registers, bootloader pins or charger configuration. */
        if(!write_reg(0x41,mask|0x08))ESP_LOGW("keys","PWR short IRQ unavailable");
        if(read_reg(0x49,&irq)&& (irq&0x0f))(void)write_reg(0x49,irq&0x0f);
    }else {pmic=NULL;ESP_LOGW("keys","AXP2101 key unavailable");}
    const button_config_t bc={.long_press_time=1000,.short_press_time=0};
    const button_gpio_config_t gpio={.gpio_num=0,.active_level=0,.enable_power_save=false,.disable_pull=false};
    button_handle_t lower=NULL;
    if(iot_button_new_gpio_device(&bc,&gpio,&lower)==ESP_OK){
        (void)iot_button_register_cb(lower,BUTTON_PRESS_DOWN,NULL,key_event,(void *)(uintptr_t)BADGE_KEY_DOWN);
        (void)iot_button_register_cb(lower,BUTTON_LONG_PRESS_START,NULL,key_event,(void *)(uintptr_t)BADGE_KEY_HOLD);
        (void)iot_button_register_cb(lower,BUTTON_PRESS_UP,NULL,key_event,(void *)(uintptr_t)BADGE_KEY_UP);
    }else ESP_LOGW("keys","GPIO0 key unavailable");
    if(pmic)(void)xTaskCreate(pmic_keys_task,"pwr_key",3072,NULL,2,NULL);
}
static void pmic_keys_task(void *arg){
    (void)arg;
    for(;;){uint8_t irq=0;
        if(read_reg(0x49,&irq)&&(irq&0x0f)){
            /* Failed clear emits no repeatable event; long latch wins. */
            if(write_reg(0x49,irq&0x0f)&&(irq&0x08)&&!(irq&0x04)){
                badge_key_event_t e=BADGE_KEY_POWER;(void)xQueueSend(events,&e,0);
            }
        }
        vTaskDelay(pdMS_TO_TICKS(40));
    }
}
badge_key_event_t badge_keys_poll(void){
    badge_key_event_t e=BADGE_KEY_NONE;if(events)(void)xQueueReceive(events,&e,0);return e;
}
