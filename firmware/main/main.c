#include "badge.h"
#include "esp_log.h"
#include "nvs_flash.h"

void app_main(void)
{
    /* Never erase user data automatically on partition/version errors. */
    esp_err_t err = nvs_flash_init();
    if (err == ESP_OK) err = badge_state_init();
    if (err != ESP_OK) {
        ESP_LOGE("badge", "Storage unavailable (%s); refusing writes and BLE", esp_err_to_name(err));
        badge_message("存档不可用，请保留设备并联系支持");
        badge_ui_start();
        return;
    }
    if (badge_ui_start()) badge_ble_start();
}
