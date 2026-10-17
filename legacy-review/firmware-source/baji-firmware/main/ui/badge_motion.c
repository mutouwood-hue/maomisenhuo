#include "badge_motion.h"
#include <string.h>

void badge_motion_sample(badge_motion_history_t *h, uint32_t t, int x, int y)
{
    if (!h) return;
    if (h->count && h->samples[h->count - 1].t == t) {
        h->samples[h->count - 1] = (badge_motion_sample_t){t, x, y};
        return;
    }
    /* Keep a fallback sample, as the HTML does when the last 80ms has no move. */
    while (h->count > 2 && (uint32_t)(t - h->samples[0].t) > 120u) {
        memmove(h->samples, h->samples + 1, (--h->count) * sizeof(h->samples[0]));
    }
    if (h->count == BADGE_MOTION_HISTORY) {
        memmove(h->samples, h->samples + 1, (--h->count) * sizeof(h->samples[0]));
    }
    h->samples[h->count++] = (badge_motion_sample_t){t, x, y};
}

bool badge_motion_reverse(const badge_motion_history_t *h, uint32_t t,
                          int x, int y, bool horizontal, int delta)
{
    if (!h || !h->count || !delta) return false;
    const badge_motion_sample_t *base = &h->samples[0];
    for (unsigned i = 0; i < h->count; ++i) {
        if ((uint32_t)(t - h->samples[i].t) <= BADGE_MOTION_REVERSE_MS) {
            base = &h->samples[i];
            break;
        }
    }
    uint32_t dt = t - base->t;
    if (!dt) dt = 1;
    const int moved = horizontal ? x - base->x : y - base->y;
    const int opposite = delta > 0 ? -moved : moved;
    /* Strict >0.3 px/ms, with integer cross multiplication. */
    return opposite > 0 && (uint64_t)opposite * 10u > (uint64_t)dt * 3u;
}

bool badge_motion_commit(int travel, uint32_t duration, bool reverse)
{
    return !reverse && (travel >= BADGE_MOTION_SLOW_PX ||
        (travel >= BADGE_MOTION_FAST_PX && duration <= BADGE_MOTION_FAST_MS));
}

int badge_motion_rubber(int delta)
{
    const int sign = delta < 0 ? -1 : 1;
    int64_t magnitude = delta;
    if (magnitude < 0) magnitude = -magnitude;
    magnitude /= 4;
    return sign * (int)(magnitude > 28 ? 28 : magnitude);
}

uint32_t badge_motion_duration(bool commit, bool rubber, int remaining, int extent)
{
    if (!commit) return rubber ? BADGE_MOTION_RUBBER_MS : BADGE_MOTION_CANCEL_MS;
    if (extent <= 0) return 120u;
    if (remaining < 0) remaining = 0;
    if (remaining > extent) remaining = extent;
    const uint32_t ms = (uint32_t)((uint64_t)220u * (unsigned)remaining / (unsigned)extent);
    return ms < 120u ? 120u : ms;
}
