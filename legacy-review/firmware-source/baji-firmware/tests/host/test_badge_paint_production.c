/* Production non-HOST paint branch, padded rows and guard bytes. */
#include <stdio.h>
#include <string.h>
#include "badge_paint.h"
#include "badge_paint_priv.h"
#include "badge_spec_data.h"
#define STRIDE (BADGE_SCR_W * 4 + 16)
#define GUARD 32
static unsigned char memory[GUARD + STRIDE * BADGE_SCR_H + GUARD];
static uint32_t expected[BADGE_SCR_W * BADGE_SCR_H];
static lv_draw_buf_t buffer;
static int token;
static unsigned accessors, checks, failures;
lv_draw_buf_t *lv_canvas_get_draw_buf(lv_obj_t *obj) { (void)obj; accessors++; return &buffer; }
void *lv_draw_buf_goto_xy(const lv_draw_buf_t *db, uint32_t x, uint32_t y) {
    accessors++;
    if (x >= db->header.w || y >= db->header.h) return NULL;
    return db->data + y * db->header.stride + x * 4;
}
lv_color32_t lv_canvas_get_px(lv_obj_t *obj, int32_t x, int32_t y) {
    (void)obj;
    lv_color32_t zero = {0};
    if (x < 0 || y < 0) return zero;
    lv_color32_t *p = lv_draw_buf_goto_xy(&buffer, (uint32_t)x, (uint32_t)y);
    return p ? *p : zero;
}
#define CHECK(c) do { checks++; if (!(c)) { failures++; printf("FAIL line %d: %s\n", __LINE__, #c); } } while (0)
static bool guards_ok(void) {
    for (int i = 0; i < GUARD; ++i)
        if (memory[i] != 0xa5 || memory[sizeof(memory)-1-i] != 0xa5) return false;
    for (int y = 0; y < BADGE_SCR_H; ++y)
        for (int x = BADGE_SCR_W * 4; x < STRIDE; ++x)
            if (buffer.data[y * STRIDE + x] != 0xa5) return false;
    return true;
}
int main(void) {
    lv_obj_t *canvas = (lv_obj_t *)(void *)&token;
    buffer.header.w = BADGE_SCR_W;
    buffer.header.h = BADGE_SCR_H;
    buffer.header.stride = STRIDE;
    buffer.data = memory + GUARD;
    buffer.data_size = STRIDE * BADGE_SCR_H;
    badge_paint_state_t state = {0};
    state.bat_pct = 63; state.now_min = 780; state.step = 3;
    state.finger_x = 210; state.finger_y = 250;
    state.alert_show = true; state.alert_bright = true;
    state.dots_n = 3; state.dots_value = 1;
    for (int variant = 0; variant < 3; ++variant) {
        state.now_ms = (uint32_t)(variant * 731);
        state.finger_down = variant != 0;
        state.charging = variant == 2;
        state.wave_phase = variant * .37f;
        state.anim_phase = variant * .3f;
        for (int j = 0; j < BADGE_STAT_COUNT; ++j) state.stat[j] = (uint8_t)(17 + variant * 29);
        for (int i = 0; i < BADGE_EL_COUNT; ++i) {
            badge_paint_host_bind(expected, BADGE_SCR_W);
            badge_paint_clear(canvas);
            badge_paint_el(canvas, &badge_els[i], &state);
            badge_paint_host_bind(NULL, 0);
            for (int batch = 0; batch < 2; ++batch) {
                memset(memory, 0xa5, sizeof(memory));
                accessors = 0;
                if (batch) badge_paint_batch_begin(canvas);
                badge_paint_clear(canvas);
                badge_paint_el(canvas, &badge_els[i], &state);
                if (batch) badge_paint_batch_end();
                bool same = true;
                for (int y = 0; y < BADGE_SCR_H; ++y)
                    if (memcmp(buffer.data + y * STRIDE, expected + y * BADGE_SCR_W, BADGE_SCR_W * 4)) same = false;
                CHECK(same); CHECK(guards_ok());
                if (batch) CHECK(accessors <= 2 * BADGE_SCR_H + 2);
            }
        }
    }
    badge_paint_host_bind(NULL, 0);
    memset(memory, 0xa5, sizeof(memory));
    badge_paint_clip(20, 30, 40, 50);
    badge_paint_batch_begin(canvas);
    badge_paint_clear(canvas);
    badge_paint_batch_end();
    CHECK(guards_ok());
    bool cleared = true;
    for (int y = 0; y < BADGE_SCR_H; ++y)
        for (int x = 0; x < BADGE_SCR_W * 4; ++x) if (buffer.data[y * STRIDE + x]) cleared = false;
    CHECK(cleared);
    badge_paint_clip(0, 0, BADGE_SCR_W, BADGE_SCR_H);
    printf("production paint: %u checks, %u failures; padded stride %d\n", checks, failures, STRIDE);
    return failures ? 1 : 0;
}
