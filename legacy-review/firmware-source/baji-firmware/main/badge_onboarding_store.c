#include "badge_onboarding_store.h"
#include "nvs.h"
#include <string.h>
static uint8_t s_observed[BADGE_ONBOARD_SAVE_BYTES];
static bool s_ready, s_dirty;
static uint32_t s_due;

esp_err_t badge_onboarding_store_load(badge_onboarding_t *state)
{
    if (!state) return ESP_ERR_INVALID_ARG;
    badge_onboarding_defaults(state);
    s_ready = false; s_dirty = false;
    nvs_handle_t h;
    esp_err_t err = nvs_open("badge_onboard", NVS_READONLY, &h);
    if (err == ESP_OK) {
        uint8_t data[BADGE_ONBOARD_SAVE_BYTES];
        size_t len = sizeof(data);
        err = nvs_get_blob(h, "state", data, &len);
        nvs_close(h);
        if (err == ESP_OK && !badge_onboarding_decode(state, data, (uint32_t)len))
            err = ESP_ERR_INVALID_STATE;
    }
    badge_onboarding_encode(state, s_observed, sizeof(s_observed));
    s_ready = true;
    return err;
}

void badge_onboarding_store_poll(const badge_onboarding_t *state, uint32_t now_ms)
{
    if (!state) return;
    uint8_t data[BADGE_ONBOARD_SAVE_BYTES];
    if (!badge_onboarding_encode(state, data, sizeof(data))) return;
    if (!s_ready || memcmp(data, s_observed, sizeof(data))) {
        memcpy(s_observed, data, sizeof(data));
        s_ready = true; s_dirty = true; s_due = now_ms + 4000u;
    }
    if (!s_dirty || (int32_t)(now_ms - s_due) < 0) return;
    nvs_handle_t h;
    esp_err_t err = nvs_open("badge_onboard", NVS_READWRITE, &h);
    if (err == ESP_OK) {
        err = nvs_set_blob(h, "state", s_observed, sizeof(s_observed));
        if (err == ESP_OK) err = nvs_commit(h);
        nvs_close(h);
    }
    if (err == ESP_OK) s_dirty = false;
    else s_due = now_ms + 4000u;
}
