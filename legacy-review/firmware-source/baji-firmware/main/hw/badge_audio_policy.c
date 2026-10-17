#include "badge_audio_policy.h"
bool badge_audio_accept(badge_audio_policy_t *p, unsigned sound, uint32_t now)
{
    if (!p || sound >= BADGE_AUDIO_POLICY_SOUNDS) return false;
    if (p->seen[sound] && now - p->last[sound] < BADGE_AUDIO_DUPLICATE_MS) return false;
    p->seen[sound] = true; p->last[sound] = now;
    return true;
}
unsigned badge_audio_volume(int minute)
{
    minute %= 1440;
    if (minute < 0) minute += 1440;
    return minute >= 23 * 60 || minute < 7 * 60 ? 30u : 60u;
}
