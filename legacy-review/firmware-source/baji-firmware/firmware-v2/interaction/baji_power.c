#include "baji_power.h"
#include <limits.h>
#include <stddef.h>
#include <string.h>

static bool fresh(const bj_power_t *p, uint32_t now) {
    return p->has_sample && (uint32_t)(now - p->sample.sampled_ms) <= p->freshness_ms;
}
static bool valid_battery(const bj_power_sample_t *s) {
    return s->battery_valid && s->battery_percent >= 0 && s->battery_percent <= 100;
}
bool bj_power_init(bj_power_t *p, uint32_t freshness_ms, bj_power_recovery_t recovery) {
    if (p == NULL) return false;
    memset(p, 0, sizeof(*p));
    if (freshness_ms == 0 || freshness_ms > INT32_MAX ||
        (recovery != BJ_POWER_RECOVER_PERCENT && recovery != BJ_POWER_RECOVER_USB_ONLY)) return false;
    p->freshness_ms = freshness_ms;
    p->recovery = recovery;
    return true;
}
void bj_power_update(bj_power_t *p, const bj_power_sample_t *s, uint32_t now) {
    if (p == NULL || s == NULL || p->freshness_ms == 0) return;
    p->sample = *s;
    p->has_sample = true;
    /* A stale/future sample must neither enter nor clear the safety latch. */
    if (!fresh(p, now)) return;
    const bool usb = s->usb_valid && s->usb_present;
    if (usb || (p->recovery == BJ_POWER_RECOVER_PERCENT && valid_battery(s) && s->battery_percent >= 5)) {
        p->low_latched = false;
    } else if (valid_battery(s) && s->battery_percent < 5 && s->usb_valid && !s->usb_present) {
        p->low_latched = true;
    }
}
bj_power_view_t bj_power_view(const bj_power_t *p, uint32_t now) {
    bj_power_view_t v = {.mode = BJ_POWER_UNKNOWN, .battery_percent = -1, .retain_ble = true};
    if (p == NULL || p->freshness_ms == 0) return v;
    if (fresh(p, now)) {
        v.battery_valid = valid_battery(&p->sample);
        if (v.battery_valid) v.battery_percent = p->sample.battery_percent;
        v.usb_valid = p->sample.usb_valid;
        v.usb_present = v.usb_valid && p->sample.usb_present;
    }
    if (p->low_latched) v.mode = BJ_POWER_LOW;
    else if (v.usb_present || (v.battery_valid && v.battery_percent >= 5)) v.mode = BJ_POWER_NORMAL;
    /* Unknown power pauses high-load work without presenting invented low-battery data. */
    v.allow_autonomous = v.mode == BJ_POWER_NORMAL;
    v.allow_voice = v.mode == BJ_POWER_NORMAL;
    return v;
}
