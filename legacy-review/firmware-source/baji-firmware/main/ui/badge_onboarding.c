#include "badge_onboarding.h"
#include <string.h>

static void put32(uint8_t *p, uint32_t n)
{
    for (int i = 0; i < 4; ++i) p[i] = (uint8_t)(n >> (8 * i));
}
static uint32_t get32(const uint8_t *p)
{
    uint32_t n = 0;
    for (int i = 0; i < 4; ++i) n |= (uint32_t)p[i] << (8 * i);
    return n;
}
static uint32_t checksum(const uint8_t *p, unsigned len)
{
    uint32_t n = 2166136261u;
    for (unsigned i = 0; i < len; ++i) n = (n ^ p[i]) * 16777619u;
    return n; /* Corruption detection, NOT authentication. */
}
void badge_onboarding_defaults(badge_onboarding_t *s)
{
    if (s) memset(s, 0, sizeof(*s));
}
void badge_onboarding_bound(badge_onboarding_t *s, uint32_t unix_seconds)
{
    if (!s || s->bound) return;
    s->bound = true;
    s->bound_unix = unix_seconds;
}
void badge_onboarding_finish(badge_onboarding_t *s, bool skipped)
{
    if (!s || !s->bound) return;
    s->tutorial_done = !skipped;
    s->tutorial_skipped = skipped;
}
bool badge_onboarding_novice(const badge_onboarding_t *s, uint32_t now)
{
    if (!s || !s->bound || !s->bound_unix || now < s->bound_unix ||
        now - s->bound_unix >= 3u * 86400u) return false;
    for (unsigned i = 0; i < BADGE_ONBOARD_SKILLS; ++i) if (s->learned[i] < 3) return true;
    return false;
}
void badge_onboarding_learn(badge_onboarding_t *s, unsigned skill)
{
    if (s && s->bound && skill < BADGE_ONBOARD_SKILLS && s->learned[skill] < 3) ++s->learned[skill];
}
bool badge_onboarding_return_visit(badge_onboarding_t *s, unsigned page)
{
    if (!s || !s->bound || page >= 3 || s->returns[page] >= 3) return false;
    ++s->returns[page];
    return true;
}
bool badge_onboarding_nudge_claim(badge_onboarding_t *s, uint32_t now)
{
    if (!badge_onboarding_novice(s, now)) return false;
    const uint32_t day = now / 86400u;
    if (day != s->daily_day) { s->daily_day = day; s->daily_nudges = 0; }
    if (s->daily_nudges >= 6) return false;
    ++s->daily_nudges;
    return true;
}

uint32_t badge_onboarding_encode(const badge_onboarding_t *s, uint8_t *out, uint32_t cap)
{
    if (!s || !out || cap < BADGE_ONBOARD_SAVE_BYTES) return 0;
    memset(out, 0, BADGE_ONBOARD_SAVE_BYTES);
    out[0] = 'B'; out[1] = 'O'; out[2] = 1;
    out[3] = (uint8_t)((s->bound ? 1 : 0) | (s->tutorial_done ? 2 : 0) |
                      (s->tutorial_skipped ? 4 : 0));
    put32(out + 4, s->bound_unix);
    put32(out + 8, s->daily_day);
    memcpy(out + 12, s->learned, BADGE_ONBOARD_SKILLS);
    out[17] = s->daily_nudges;
    memcpy(out + 18, s->returns, 3);
    put32(out + 36, checksum(out, 36));
    return BADGE_ONBOARD_SAVE_BYTES;
}
bool badge_onboarding_decode(badge_onboarding_t *s, const uint8_t *p, uint32_t len)
{
    if (!s || !p || len != BADGE_ONBOARD_SAVE_BYTES || p[0] != 'B' ||
        p[1] != 'O' || p[2] != 1 || (p[3] & ~7u) ||
        get32(p + 36) != checksum(p, 36)) return false;
    const bool bound = (p[3] & 1) != 0, done = (p[3] & 2) != 0, skip = (p[3] & 4) != 0;
    if ((done && skip) || (!bound && (done || skip || get32(p + 4)))) return false;
    for (int i = 0; i < BADGE_ONBOARD_SKILLS; ++i) if (p[12 + i] > 3) return false;
    if (p[17] > 6) return false;
    for (int i = 0; i < 3; ++i) if (p[18 + i] > 3) return false;
    for (int i = 21; i < 36; ++i) if (p[i]) return false;
    badge_onboarding_t next = {0};
    next.bound = bound; next.tutorial_done = done; next.tutorial_skipped = skip;
    next.bound_unix = get32(p + 4); next.daily_day = get32(p + 8);
    memcpy(next.learned, p + 12, BADGE_ONBOARD_SKILLS);
    next.daily_nudges = p[17]; memcpy(next.returns, p + 18, 3);
    *s = next; /* Reject malformed state atomically. */
    return true;
}
