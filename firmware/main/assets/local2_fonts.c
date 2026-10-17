#include "local2_fonts.h"
LV_FONT_DECLARE(badge_f16);
LV_FONT_DECLARE(badge_f20);
LV_FONT_DECLARE(badge_f24);
#include "local2_same_size_glyphs.inc"
lv_font_t local2_font16,local2_font20,local2_font24;
void local2_fonts_init(void)
{
    local2_font16=badge_f16; local2_font20=badge_f20; local2_font24=badge_f24;
    /* Every supplement uses its parent's size and metrics; no 16->20 fallback. */
    local2_font16.fallback=&local2_extra16;
    local2_font20.fallback=&local2_extra20;
    local2_font24.fallback=&local2_extra24;
}
