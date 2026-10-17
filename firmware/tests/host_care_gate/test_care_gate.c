/* 清洁照料能力门禁的主机回归：直接链接生产 local2_core.c，不接设备、不接 LVGL。
   验证：RAM 授权只在确认后生效；重启后授权清空但队列保留；无收据不删事件。 */
#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include "local2_core.h"

static int failures;
#define CHECK(cond, msg) do { if (cond) { printf("ok   %s\n", msg); } else { printf("FAIL %s\n", msg); failures++; } } while (0)

static uint8_t g_blob[L2_STORE_MAX];
static size_t g_blob_n;
static int g_persist_calls;

static bool persist(void *ctx, const uint8_t *b, size_t n) {
    (void)ctx;
    if (n > sizeof(g_blob)) return false;
    memcpy(g_blob, b, n);
    g_blob_n = n;
    g_persist_calls++;
    return true;
}

static const char *OWNER = "11111111-1111-4111-8111-111111111111";
static const char *STRANGER = "22222222-2222-4222-8222-222222222222";
static const char *DEVICE = "0123456789abcdef0123456789abcdef";

static l2_request_t request(uint64_t seq, const char *client) {
    l2_request_t r;
    memset(&r, 0, sizeof(r));
    strcpy(r.client_id, client);
    r.seq = seq;
    snprintf(r.request_id, sizeof(r.request_id), "req-%llu", (unsigned long long)seq);
    for (unsigned i = 0; i < sizeof(r.hash); i++) r.hash[i] = (uint8_t)(i + seq);
    return r;
}

static l2_snapshot_t snapshot(uint64_t revision) {
    l2_snapshot_t s;
    memset(&s, 0, sizeof(s));
    s.revision = revision;
    s.has_epoch_ms = true;
    s.epoch_ms = 1792079999000ULL;
    s.scene = L2_SCENE_HOME;
    s.action = L2_ACTION_IDLE;
    s.weather = L2_WEATHER_CLEAR;
    strcpy(s.pet.pet_id, "pet-1");
    strcpy(s.pet.name, "Mikan");
    strcpy(s.pet.breed, "orange");
    s.pet.food = 70; s.pet.mood = 60; s.pet.clean = 80; s.pet.energy = 70; s.pet.health = 100;
    s.pet.coins = 30;
    return s;
}

static l2_terminal_t terminal(uint64_t counter, l2_terminal_status_t status, const char *reason) {
    l2_terminal_t t;
    memset(&t, 0, sizeof(t));
    t.counter = counter;
    t.status = status;
    t.action = L2_ACTION_BATH;
    strcpy(t.reason, reason);
    for (unsigned i = 0; i < 64; i++) t.save_digest[i] = (char)('a' + (i % 6));
    t.save_digest[64] = '\0';
    return t;
}

int main(void) {
    static l2_core_t core;
    memset(&core, 0, sizeof(core));

    CHECK(l2_init_new(&core, DEVICE, persist, NULL) == L2_OK, "新设备初始化并落盘");
    CHECK(g_blob_n > 0, "持久回调收到完整字节");
    l2_request_t first = request(1, OWNER);
    l2_snapshot_t snap = snapshot(1);
    CHECK(l2_set_snapshot(&core, &first, &snap) == L2_OK, "首次同步写入 owner 与快照");
    CHECK(!l2_bath_allowed(&core), "仅建立 owner/快照不等于授权清洁");

    /* 先完成一条普通照料，作为 FIFO 队头，避免把「拒绝 bath」误判成队列问题。 */
    CHECK(l2_emit_care(&core, L2_ACTION_FEED, 1792079999001ULL) == L2_OK, "常规照料无需清洁授权");
    l2_event_t event;
    memset(&event, 0, sizeof(event));
    CHECK(l2_peek_event(&core, &event) && event.action == L2_ACTION_FEED, "队头为普通照料事件");
    const uint64_t feed_counter = event.counter;
    l2_request_t feed_ack = request(2, OWNER);
    l2_terminal_t feed_done = terminal(feed_counter, L2_TERMINAL_APPLIED, "none");
    CHECK(l2_ack_event_result(&core, &feed_ack, &feed_done) == L2_OK, "普通照料按终态收据出队");

    CHECK(l2_emit_care(&core, L2_ACTION_BATH, 1792079999002ULL) == L2_NOT_READY, "未确认时 bath 被领域层拒绝");
    CHECK(l2_confirm_bath(&core, STRANGER, 7) == L2_OWNER_CONFLICT, "非原 owner 确认被拒");
    CHECK(l2_confirm_bath(&core, OWNER, 0) == L2_INVALID, "会话号为 0 的确认无效");
    CHECK(!l2_bath_allowed(&core), "被拒的确认不留下任何授权");

    int before = g_persist_calls;
    CHECK(l2_confirm_bath(&core, OWNER, 7) == L2_OK, "原 owner 的会话确认成功");
    CHECK(l2_bath_allowed(&core), "确认后同次开机允许新增 bath");
    CHECK(g_persist_calls == before, "能力确认不写 NVS、不占 mutation seq");

    CHECK(l2_emit_care(&core, L2_ACTION_BATH, 1792079999003ULL) == L2_OK, "确认后可入队 bath");
    memset(&event, 0, sizeof(event));
    CHECK(l2_peek_event(&core, &event) && event.kind == L2_EVENT_CARE && event.action == L2_ACTION_BATH,
          "队头为待投递的 bath 事件");
    const uint64_t bath_counter = event.counter;

    /* 重启：用同一份持久 blob 载入新内存实例。 */
    uint8_t saved_blob[L2_STORE_MAX];
    size_t saved_n = l2_encode(&core, saved_blob, sizeof(saved_blob));
    CHECK(saved_n > 0, "可导出当前持久形态");

    static l2_core_t rebooted;
    memset(&rebooted, 0, sizeof(rebooted));
    CHECK(l2_load(&rebooted, saved_blob, saved_n, persist, NULL) == L2_OK, "重启后载入原存档");
    CHECK(!l2_bath_allowed(&rebooted), "重启后 RAM 授权清空，需重新确认");
    memset(&event, 0, sizeof(event));
    CHECK(l2_peek_event(&rebooted, &event) && event.action == L2_ACTION_BATH && event.counter == bath_counter,
          "重启后原 bath 事件与 eventId 保留");
    CHECK(l2_emit_care(&rebooted, L2_ACTION_BATH, 1792079999004ULL) == L2_NOT_READY, "重启后未再确认不得新增 bath");

    CHECK(l2_confirm_bath(&rebooted, OWNER, 8) == L2_OK, "重连后重新确认成功");
    l2_request_t ack_req = request(3, OWNER);
    l2_terminal_t applied = terminal(bath_counter, L2_TERMINAL_APPLIED, "none");
    CHECK(l2_ack_event_result(&rebooted, &ack_req, &applied) == L2_OK, "带终态收据的 ACK 生效");
    memset(&event, 0, sizeof(event));
    CHECK(!l2_peek_event(&rebooted, &event), "已结算事件出队");
    l2_view_t view;
    memset(&view, 0, sizeof(view));
    l2_get_view(&rebooted, &view);
    CHECK(view.last_ack == bath_counter && view.pending_events == 0, "FIFO 水位与待办数同步前移");

    l2_request_t dup_req = request(4, OWNER);
    CHECK(l2_ack_event_result(&rebooted, &dup_req, &applied) == L2_DUPLICATE, "重复 ACK 沿原终态返回 duplicate");
    l2_terminal_t conflicting = terminal(bath_counter, L2_TERMINAL_REJECTED, "insufficient_coins");
    l2_request_t conflict_req = request(5, OWNER);
    CHECK(l2_ack_event_result(&rebooted, &conflict_req, &conflicting) == L2_REQUEST_CONFLICT,
          "同一事件的不同终态被拒");

    printf(failures ? "FAIL: care gate regressions\n" : "PASS: production bath capability gate + receipt lifecycle\n");
    return failures ? 1 : 0;
}
