#pragma once
#include <stdbool.h>
#include <stddef.h>

/* Reject invalid UTF-8 and JSON U+0000 escapes before cJSON can truncate them. */
bool badge_wire_valid(const char *data, size_t length);
