#pragma once
#include <stdbool.h>
#include <stdint.h>
#define BADGE_AUDIO_POLICY_SOUNDS 5
#define BADGE_AUDIO_DUPLICATE_MS 250u
#define BADGE_AUDIO_AMP_TAIL_MS 200u
typedef struct {
    uint32_t last[BADGE_AUDIO_POLICY_SOUNDS];
    bool seen[BADGE_AUDIO_POLICY_SOUNDS];
} badge_audio_policy_t;
bool badge_audio_accept(badge_audio_policy_t *policy, unsigned sound, uint32_t now_ms);
unsigned badge_audio_volume(int minute_of_day);
