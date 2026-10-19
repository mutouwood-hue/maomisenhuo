#pragma once
#include "badge_appearance.h"
bool badge_native_cat_render(const badge_appearance_t *,unsigned clip,unsigned frame,uint8_t *,size_t);
bool badge_legacy_cat_render(const lv_image_dsc_t *,uint8_t *,size_t);
