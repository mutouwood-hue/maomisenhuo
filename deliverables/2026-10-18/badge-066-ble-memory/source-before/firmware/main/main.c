#include "badge.h"
#include "local2_store.h"
#include "local2_ble.h"
#include "esp_log.h"
#include "badge_diagnostics.h"
#include "esp_heap_caps.h"

static void startup_record(const char *stage)
{
    ESP_LOGI("startup", "%s internal_free=%u internal_largest=%u psram_free=%u",stage,
        (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT),
        (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT),
        (unsigned)heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
}

void app_main(void)
{
    /* local2_init owns nvs_flash_init and only its independent namespace.
     * A failed read/version/capacity check must never trigger automatic erase. */
    startup_record("storage_begin");
    esp_err_t storage = local2_init();
    if (storage != ESP_OK) {
        ESP_LOGE("local2", "Storage unavailable (%s); BLE remains off", esp_err_to_name(storage));
        /* UI handles NULL/!ready/storage_error without an invented pet snapshot. */
        (void)badge_ui_start();
        return;
    }
    startup_record("ui_begin");
    if (!badge_ui_start()) {
        ESP_LOGE("local2", "Display/touch initialization failed; BLE remains off");
        return;
    }
    startup_record("ui_ready_ble_begin");
    local2_ble_start();
    startup_record("ble_start_returned_usb_begin");
    badge_diagnostics_start_usb();
    startup_record("startup_returned");
}
