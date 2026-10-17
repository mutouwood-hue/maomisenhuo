/* Persistent onboarding domain; does not authenticate a radio connection. */
#pragma once
#include <stdbool.h>
#include <stdint.h>
#define BADGE_ONBOARD_SAVE_BYTES 40u
#define BADGE_ONBOARD_SKILLS 5

typedef struct {
    bool bound, tutorial_done, tutorial_skipped;
    uint32_t bound_unix, daily_day;
    uint8_t learned[BADGE_ONBOARD_SKILLS];
    uint8_t daily_nudges, returns[3];
} badge_onboarding_t;

void badge_onboarding_defaults(badge_onboarding_t *state);
/* Called ONLY after an external authenticator verifies ownership; not on GAP connect. */
void badge_onboarding_bound(badge_onboarding_t *state, uint32_t unix_seconds);
void badge_onboarding_finish(badge_onboarding_t *state, bool skipped);
bool badge_onboarding_novice(const badge_onboarding_t *state, uint32_t unix_seconds);
void badge_onboarding_learn(badge_onboarding_t *state, unsigned skill);
bool badge_onboarding_return_visit(badge_onboarding_t *state, unsigned page);
bool badge_onboarding_nudge_claim(badge_onboarding_t *state, uint32_t unix_seconds);
uint32_t badge_onboarding_encode(const badge_onboarding_t *state, uint8_t *out, uint32_t cap);
bool badge_onboarding_decode(badge_onboarding_t *state, const uint8_t *data, uint32_t len);
