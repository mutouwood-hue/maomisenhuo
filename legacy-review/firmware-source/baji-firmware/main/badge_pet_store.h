#pragma once
#include "badge_pet.h"
#include "esp_err.h"
/* Owner-thread only. Same petgame/save and blob format as existing firmware. */
esp_err_t badge_pet_store_load(badge_game_t *game);
esp_err_t badge_pet_store_poll(const badge_game_t *game, uint32_t now_ms);
