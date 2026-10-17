#pragma once
#include <stdbool.h>
#include <stddef.h>
extern const char *cf_test_mode;
extern size_t cf_test_free,cf_test_largest;
extern unsigned cf_test_alloc_calls,cf_test_free_calls,cf_test_live;
extern unsigned cf_std_calls,cf_std_fail_nth;
void cf_test_guards(void);
