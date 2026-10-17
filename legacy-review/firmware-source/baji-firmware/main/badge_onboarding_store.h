#pragma once
#include "esp_err.h"
#include "badge_onboarding.h"
esp_err_t badge_onboarding_store_load(badge_onboarding_t *state);
/* Debounced, retries failures; call on the UI owner thread, never the finger callback. */
void badge_onboarding_store_poll(const badge_onboarding_t *state, uint32_t now_ms);
