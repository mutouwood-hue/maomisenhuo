/*
 * badge_font_stub.c - the four lv_font_t faces, defined for host tests only.
 *
 * main/ui/badge_assets.c returns pointers to badge_f16/f20/f24/n40 (the faces the
 * vendored font files in main/ui/fonts/ define on the device). The host test wants
 * to prove that badge_font() picks four *distinct* faces and that the pairing
 * code's id lands on n40 -- which needs the symbols to exist, but not their
 * contents.
 *
 * lvgl.h declares lv_font_t as an opaque struct, so the payload is completed here
 * with a single unused int: nothing on the host ever dereferences a face, and
 * giving it a body would be inventing an LVGL that tests could accidentally pass
 * against.
 *
 * Included by tools/suite/05-assets.cmd. Never compiled into the firmware.
 */
#include "lvgl.h"

#include "badge_assets.h"

/* Complete the opaque type so the four objects below can be defined. This is the
 * only place in the host build that knows lv_font_t has a body. */
struct _lv_font_t {
    int host_stub_unused;
};

const lv_font_t badge_f16 = { 0 };
const lv_font_t badge_f20 = { 0 };
const lv_font_t badge_f24 = { 0 };
const lv_font_t badge_n40 = { 0 };
