#include "badge_pet_store.h"
#include "nvs.h"
#include <string.h>
#define PET_STORE_DELAY_MS 4000u
static uint8_t s_observed[BADGE_PET_SAVE_BYTES];
static bool s_ready, s_dirty;
static uint32_t s_due;
esp_err_t badge_pet_store_load(badge_game_t *game)
{
    if (!game) return ESP_ERR_INVALID_ARG;
    s_ready = s_dirty = false;
    nvs_handle_t h;
    esp_err_t err = nvs_open("petgame", NVS_READONLY, &h);
    if (err == ESP_OK) {
        uint8_t blob[BADGE_PET_SAVE_BYTES];
        size_t len = sizeof(blob);
        err = nvs_get_blob(h, "save", blob, &len);
        nvs_close(h);
        if (err == ESP_OK) {
            badge_game_t next = *game;
            if (!badge_pet_deserialize(&next, blob, (uint32_t)len)) err = ESP_ERR_INVALID_STATE;
            else *game = next;
        }
    }
    if (badge_pet_serialize(game, s_observed, sizeof(s_observed)) != sizeof(s_observed))
        return ESP_ERR_INVALID_STATE;
    s_ready = true;
    return err;
}
esp_err_t badge_pet_store_poll(const badge_game_t *game, uint32_t now)
{
    if (!game) return ESP_ERR_INVALID_ARG;
    uint8_t blob[BADGE_PET_SAVE_BYTES];
    if (badge_pet_serialize(game, blob, sizeof(blob)) != sizeof(blob)) return ESP_ERR_INVALID_STATE;
    if (!s_ready || memcmp(blob, s_observed, sizeof(blob))) {
        memcpy(s_observed, blob, sizeof(blob));
        s_ready = true;
        if (!s_dirty) { s_dirty = true; s_due = now + PET_STORE_DELAY_MS; }
    }
    if (!s_dirty || (int32_t)(now - s_due) < 0) return ESP_OK;
    nvs_handle_t h;
    esp_err_t err = nvs_open("petgame", NVS_READWRITE, &h);
    if (err == ESP_OK) {
        err = nvs_set_blob(h, "save", s_observed, sizeof(s_observed));
        if (err == ESP_OK) err = nvs_commit(h);
        nvs_close(h);
    }
    if (err == ESP_OK) s_dirty = false;
    else s_due = now + PET_STORE_DELAY_MS;
    return err;
}
