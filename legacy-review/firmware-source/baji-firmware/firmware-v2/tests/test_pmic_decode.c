#include "baji_pmic_decode.h"
#include <stdio.h>
static int checks, failures;
#define CHECK(x) do { ++checks; if (!(x)) { ++failures; printf("FAIL %d: %s\n", __LINE__, #x); } } while (0)
int main(void) {
    bj_power_sample_t s = bj_pmic_decode(true,true,0x28,0,true,1,4,123);
    CHECK(s.battery_valid && s.battery_percent == 4 && s.sampled_ms == 123);
    CHECK(s.usb_valid && s.usb_present);
    s = bj_pmic_decode(true,true,0x28,8,true,1,4,123);
    CHECK(s.usb_valid && !s.usb_present);
    s = bj_pmic_decode(true,true,8,0,true,1,100,123);
    CHECK(s.battery_valid && s.battery_percent == 100 && !s.usb_present);
    s = bj_pmic_decode(true,true,8,0,true,1,0,123);
    CHECK(s.battery_valid && s.battery_percent == 0);
    s = bj_pmic_decode(true,true,0x20,0,true,1,50,123);
    CHECK(!s.battery_valid && s.battery_percent == -1 && s.usb_present);
    s = bj_pmic_decode(true,true,8,0,true,0,50,123);
    CHECK(!s.battery_valid && s.battery_percent == -1);
    s = bj_pmic_decode(true,true,8,0,false,1,50,123);
    CHECK(!s.battery_valid && s.usb_valid);
    s = bj_pmic_decode(true,false,0x28,0,true,1,50,123);
    CHECK(!s.battery_valid && !s.usb_valid && !s.usb_present);
    s = bj_pmic_decode(false,true,0x28,0,true,1,50,123);
    CHECK(!s.battery_valid && !s.usb_valid);
    for (unsigned i=101;i<=255;i++) {
        s = bj_pmic_decode(true,true,8,0,true,1,(uint8_t)i,123);
        CHECK(!s.battery_valid && s.battery_percent == -1);
    }
    printf("pmic decode: %d checks, %d failures\n", checks, failures);
    return failures ? 1 : 0;
}
