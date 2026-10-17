#include "baji_power.h"
#include <limits.h>
#include <stdio.h>
static int checks, failures;
#define CHECK(x) do { ++checks; if (!(x)) { ++failures; printf("FAIL line %d: %s\n", __LINE__, #x); } } while (0)
static void sample(bj_power_t *p, int percent, bool bat_valid, bool usb_valid, bool usb, uint32_t stamp, uint32_t now) {
    bj_power_sample_t s = {bat_valid, percent, usb_valid, usb, stamp};
    bj_power_update(p, &s, now);
}
int main(void) {
    bj_power_t p;
    CHECK(!bj_power_init(NULL, 1500, BJ_POWER_RECOVER_PERCENT));
    CHECK(!bj_power_init(&p, 0, BJ_POWER_RECOVER_PERCENT));
    CHECK(!bj_power_init(&p, UINT32_MAX, BJ_POWER_RECOVER_PERCENT));
    CHECK(!bj_power_init(&p, 1500, (bj_power_recovery_t)9));
    CHECK(bj_power_init(&p, 1500, BJ_POWER_RECOVER_PERCENT));
    bj_power_view_t v = bj_power_view(&p, 0);
    CHECK(v.mode == BJ_POWER_UNKNOWN && v.battery_percent == -1);
    CHECK(!v.allow_autonomous && !v.allow_voice && v.retain_ble);
    sample(&p, 5, true, true, false, 100, 100);
    v = bj_power_view(&p, 100);
    CHECK(v.mode == BJ_POWER_NORMAL && v.battery_percent == 5);
    CHECK(v.allow_autonomous && v.allow_voice && v.retain_ble);
    CHECK(bj_power_view(&p, 1600).battery_valid);
    CHECK(bj_power_view(&p, 1601).mode == BJ_POWER_UNKNOWN);
    CHECK(bj_power_view(&p, 1601).battery_percent == -1);
    sample(&p, 4, true, true, false, 1700, 1700);
    v = bj_power_view(&p, 1700);
    CHECK(v.mode == BJ_POWER_LOW && v.battery_percent == 4);
    CHECK(!v.allow_autonomous && !v.allow_voice && v.retain_ble);
    CHECK(bj_power_view(&p, 4000).mode == BJ_POWER_LOW);
    sample(&p, 82, false, false, false, 4000, 4000);
    CHECK(bj_power_view(&p, 4000).mode == BJ_POWER_LOW);
    CHECK(bj_power_view(&p, 4000).battery_percent == -1);
    sample(&p, 101, true, true, false, 4100, 4100);
    CHECK(bj_power_view(&p, 4100).mode == BJ_POWER_LOW);
    sample(&p, -1, true, true, false, 4200, 4200);
    CHECK(!bj_power_view(&p, 4200).battery_valid);
    sample(&p, 5, true, true, false, 4300, 4300);
    CHECK(bj_power_view(&p, 4300).mode == BJ_POWER_NORMAL);
    sample(&p, 0, true, true, true, 4400, 4400);
    CHECK(bj_power_view(&p, 4400).mode == BJ_POWER_NORMAL);
    sample(&p, 0, true, true, false, 4500, 4500);
    CHECK(bj_power_view(&p, 4500).mode == BJ_POWER_LOW);
    sample(&p, 90, true, true, true, 1, 4501);
    CHECK(bj_power_view(&p, 4501).mode == BJ_POWER_LOW);
    sample(&p, 90, true, true, true, 5000, 4502);
    CHECK(bj_power_view(&p, 4502).mode == BJ_POWER_LOW);
    sample(&p, 0, false, true, true, 4600, 4600);
    CHECK(bj_power_view(&p, 4600).mode == BJ_POWER_NORMAL);
    CHECK(bj_power_view(&p, 4600).battery_percent == -1);
    CHECK(bj_power_init(&p, 1500, BJ_POWER_RECOVER_USB_ONLY));
    sample(&p, 4, true, true, false, 1, 1);
    sample(&p, 90, true, true, false, 2, 2);
    CHECK(bj_power_view(&p, 2).mode == BJ_POWER_LOW);
    sample(&p, 90, true, false, true, 3, 3);
    CHECK(bj_power_view(&p, 3).mode == BJ_POWER_LOW);
    sample(&p, 4, true, true, true, 4, 4);
    CHECK(bj_power_view(&p, 4).mode == BJ_POWER_NORMAL);
    CHECK(bj_power_init(&p, 1500, BJ_POWER_RECOVER_PERCENT));
    sample(&p, 4, true, false, false, 1, 1);
    CHECK(bj_power_view(&p, 1).mode == BJ_POWER_UNKNOWN);
    sample(&p, 50, true, true, false, UINT32_MAX - 100, UINT32_MAX - 100);
    CHECK(bj_power_view(&p, 100).mode == BJ_POWER_NORMAL);
    CHECK(bj_power_view(&p, 1500).mode == BJ_POWER_UNKNOWN);
    bj_power_update(NULL, NULL, 0);
    bj_power_update(&p, NULL, 0);
    CHECK(bj_power_view(NULL, 0).mode == BJ_POWER_UNKNOWN);
    printf("power: %d checks, %d failures\n", checks, failures);
    return failures ? 1 : 0;
}
