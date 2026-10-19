#include "badge.h"
#include "local2_store.h"
#include "local2_ble.h"
#include "esp_log.h"
#include "badge_diagnostics.h"

void app_main(void)
{
    /* local2_init owns nvs_flash_init and only its independent namespace.
     * A failed read/version/capacity check must never trigger automatic erase. */
    esp_err_t storage = local2_init();
    if (storage != ESP_OK) {
        ESP_LOGE("local2", "Storage unavailable (%s); BLE remains off", esp_err_to_name(storage));
        /* UI handles NULL/!ready/storage_error without an invented pet snapshot. */
        (void)badge_ui_start();
        return;
    }
    if (!badge_ui_start()) {
        ESP_LOGE("local2", "Display/touch initialization failed; BLE remains off");
        return;
    }
    local2_ble_start();
    badge_diagnostics_start_usb();
}
