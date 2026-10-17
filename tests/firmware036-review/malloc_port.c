/* Exact CLIB LVGL backend, with explicit host-only fault injector. */
#include <stdlib.h>
#include <stddef.h>
unsigned cf_std_calls,cf_std_fail_nth;
static void *cf_std_malloc(size_t n){cf_std_calls++;if(cf_std_fail_nth&&cf_std_calls==cf_std_fail_nth)return NULL;return malloc(n);}
#define malloc cf_std_malloc
#include "../../firmware/managed_components/lvgl__lvgl/src/stdlib/clib/lv_mem_core_clib.c"
