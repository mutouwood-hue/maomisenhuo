/* Integration test: production bridge, real FSM/pet/events, simulated NVS. */
#include <stdio.h>
#include <string.h>
#include "badge_runtime.h"
#include "badge_onboarding_store.h"
#include "badge_pet_store.h"
#include "badge_overlay.h"
#include "badge_motion.h"
#include "badge_frame_clock.h"
#include "badge_tutorial_visual.h"
#include "badge_assets.h"
#include "badge_audio_policy.h"
#include "badge_pet.h"
#include "badge_events.h"
#include "app_link.h"
#include "net_test_harness.h"

void badge_events_reboot(void);
static int checks, failures;
#define CHECK(x) do { checks++; if (!(x)) { failures++; \
    printf("FAIL line %d: %s\n", __LINE__, #x); } } while (0)

static void tap(badge_fsm_t *fsm, uint32_t now)
{
    badge_runtime_press(fsm, 233, 233, now);
    badge_runtime_release(fsm, 233, 233, now + 100);
}

static void tutorial_swipe(badge_fsm_t *fsm, int dx, int dy, uint32_t t)
{
    badge_runtime_press(fsm, 233, 233, t);
    badge_runtime_move(fsm, 233 + dx, 233 + dy, t + 200);
    badge_runtime_release(fsm, 233 + dx, 233 + dy, t + 250);
}
static void test_idle_nudge(void)
{
    badge_game_t game;
    badge_pet_defaults(&game);
    badge_onboarding_t state = {.bound = true, .tutorial_skipped = true, .bound_unix = 1700000000u};
    badge_fsm_t *fsm = badge_fsm_create(&game, 0);
    badge_fsm_set_onboarding(fsm, &state);
    badge_fsm_set_unix_time(fsm, 1700000000u, 0);
    badge_runtime_attach(fsm, 0);
    badge_runtime_tick(fsm, 2100);
    badge_runtime_tick(fsm, 5999);
    badge_hint_view_t hint;
    badge_fsm_hint_view(fsm, &hint);
    CHECK(!hint.nudge);
    badge_runtime_tick(fsm, 6000);
    badge_fsm_hint_view(fsm, &hint);
    CHECK(hint.nudge && hint.nudge_skill == 1 && state.daily_nudges == 1);
    badge_runtime_tick(fsm, 7449);
    badge_fsm_hint_view(fsm, &hint);
    CHECK(hint.nudge);
    badge_runtime_tick(fsm, 7450);
    badge_fsm_hint_view(fsm, &hint);
    CHECK(!hint.nudge);
    badge_runtime_tick(fsm, 8000);
    CHECK(state.daily_nudges == 1);
    badge_runtime_press(fsm, 20, 233, 8500);
    badge_runtime_release(fsm, 20, 233, 8600);
    state.learned[1] = 3;
    badge_runtime_tick(fsm, 14500);
    badge_fsm_hint_view(fsm, &hint);
    CHECK(hint.nudge && hint.nudge_skill == 2 && state.daily_nudges == 2);
    badge_runtime_press(fsm, 20, 233, 14501);
    badge_fsm_hint_view(fsm, &hint);
    CHECK(!hint.nudge);
    badge_runtime_release(fsm, 20, 233, 14600);
    state.daily_nudges = 6;
    badge_runtime_tick(fsm, 20501);
    badge_fsm_hint_view(fsm, &hint);
    CHECK(!hint.nudge && state.daily_nudges == 6);
    badge_fsm_destroy(fsm);
}

static void test_pet_store(void)
{
    CHECK(badge_demo_offset(199) == 0);
    CHECK(badge_demo_offset(450) == 60);
    CHECK(badge_demo_offset(700) == 120);
    CHECK(badge_demo_offset(950) == 120);
    CHECK(badge_demo_offset(1200) == 60);
    CHECK(badge_demo_offset(1450) == 0);
    CHECK(badge_demo_hold(149) == 0);
    CHECK(badge_demo_hold(375) == 50);
    CHECK(badge_demo_hold(600) == 100);
    CHECK(badge_demo_hold(1000) == 0);
    net_test_nvs_reset();
    net_test_link_select(0);
    badge_game_t game;
    badge_pet_defaults(&game);
    (void)badge_pet_store_load(&game);
    net_test_nvs_counters_reset();
    CHECK(badge_pet_store_poll(&game, 0) == ESP_OK);
    CHECK(net_test_nvs_set_count() == 0);
    game.growth = 123;
    CHECK(badge_pet_store_poll(&game, 0) == ESP_OK);
    CHECK(badge_pet_store_poll(&game, 3999) == ESP_OK);
    CHECK(net_test_nvs_set_count() == 0);
    net_test_nvs_fail_set(1);
    CHECK(badge_pet_store_poll(&game, 4000) != ESP_OK);
    game.coins = 456;
    CHECK(badge_pet_store_poll(&game, 5000) == ESP_OK);
    net_test_nvs_fail_commit(1);
    CHECK(badge_pet_store_poll(&game, 8000) != ESP_OK);
    CHECK(net_test_nvs_commit_count() == 0);
    CHECK(badge_pet_store_poll(&game, 12000) == ESP_OK);
    CHECK(net_test_nvs_commit_count() == 1);
    badge_game_t restored;
    badge_pet_defaults(&restored);
    CHECK(badge_pet_store_load(&restored) == ESP_OK);
    CHECK(restored.growth == 123 && restored.coins == 456);
    net_test_nvs_counters_reset();
    CHECK(badge_pet_store_poll(&restored, 13000) == ESP_OK);
    CHECK(net_test_nvs_set_count() == 0);
    restored.face = 2;
    CHECK(badge_pet_store_poll(&restored, UINT32_MAX - 3999u) == ESP_OK);
    CHECK(badge_pet_store_poll(&restored, UINT32_MAX) == ESP_OK);
    CHECK(net_test_nvs_set_count() == 0);
    CHECK(badge_pet_store_poll(&restored, 0) == ESP_OK); /* due==0 is valid. */
    CHECK(net_test_nvs_commit_count() == 1);
    badge_pet_defaults(&game);
    CHECK(badge_pet_store_load(&game) == ESP_OK && game.face == 2);
}

static void test_audio_policy(void)
{
    badge_audio_policy_t policy = {0};
    CHECK(badge_audio_accept(&policy, 0, 0));
    CHECK(!badge_audio_accept(&policy, 0, 249));
    CHECK(badge_audio_accept(&policy, 0, 250));
    CHECK(badge_audio_accept(&policy, 1, 251));
    CHECK(!badge_audio_accept(&policy, 5, 252));
    CHECK(badge_audio_accept(&policy, 2, UINT32_MAX - 100u));
    CHECK(!badge_audio_accept(&policy, 2, 148));
    CHECK(badge_audio_accept(&policy, 2, 149));
    CHECK(badge_audio_volume(419) == 30);
    CHECK(badge_audio_volume(420) == 60);
    CHECK(badge_audio_volume(1379) == 60);
    CHECK(badge_audio_volume(1380) == 30);
    CHECK(badge_audio_volume(1440) == 30);
}

static void test_low_battery(void)
{
    badge_game_t game;
    badge_pet_defaults(&game);
    badge_fsm_t *fsm = badge_fsm_create(&game, 0);
    badge_runtime_attach(fsm, 0);
    badge_runtime_tick(fsm, 2100);
    badge_fsm_set_battery(fsm, 4, false, false, 2200);
    CHECK(!badge_fsm_low_battery(fsm));
    badge_fsm_set_battery(fsm, 5, true, false, 2300);
    CHECK(!badge_fsm_low_battery(fsm));
    badge_fsm_set_battery(fsm, 4, true, true, 2400);
    CHECK(!badge_fsm_low_battery(fsm));
    badge_fsm_act(fsm, BADGE_ACT_PET, 2450);
    badge_fsm_set_battery(fsm, 4, true, false, 2500);
    badge_fx_t cleared = badge_fsm_take_fx(fsm);
    CHECK(cleared.sfx == 0 && cleared.haptic == BADGE_HAPTIC_NONE);
    CHECK(badge_fsm_low_battery(fsm));
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_LOWBAT);
    CHECK(!badge_fsm_screen_def(fsm)->has_cat);
    const int growth = game.growth;
    tap(fsm, 2600);
    badge_fsm_act(fsm, BADGE_ACT_PET, 2800);
    CHECK(game.growth == growth);
    badge_fsm_wake(fsm, EVT_WAKE_WORD, 2900);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_LOWBAT);
    badge_fsm_button(fsm, BADGE_BTN_CROWN, BADGE_BTN_EVT_CLICK, 3000);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_LOWBAT);
    badge_fsm_go(fsm, BADGE_SCREEN_MAIN_A, BADGE_NAV_FADE);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_LOWBAT);
    badge_runtime_tick(fsm, 300000);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_LOWBAT);
    badge_fsm_set_battery(fsm, 10, true, false, 301000);
    CHECK(badge_fsm_low_battery(fsm));
    badge_fsm_set_battery(fsm, 4, true, true, 302000);
    CHECK(!badge_fsm_low_battery(fsm));
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_MAIN_A);
    badge_fsm_set_power(fsm, true, true);
    CHECK(badge_fsm_mode(fsm) == BADGE_MODE_DESK);
    badge_fsm_destroy(fsm);
}

static void test_novice(void)
{
    badge_onboarding_t state = {.bound = true, .bound_unix = 1700000000u, .tutorial_skipped = true};
    CHECK(badge_onboarding_novice(&state, 1700000000u));
    CHECK(!badge_onboarding_novice(&state, 1699999999u));
    CHECK(!badge_onboarding_novice(&state, 1700000000u + 259200u));
    for (int i = 0; i < 6; ++i) CHECK(badge_onboarding_nudge_claim(&state, 1700000000u));
    CHECK(!badge_onboarding_nudge_claim(&state, 1700000000u));
    CHECK(badge_onboarding_nudge_claim(&state, 1700000000u + 86400u));
    badge_game_t game;
    badge_pet_defaults(&game);
    badge_fsm_t *fsm = badge_fsm_create(&game, 0);
    badge_fsm_set_onboarding(fsm, &state);
    badge_fsm_set_unix_time(fsm, 1700000000u, 0);
    badge_runtime_attach(fsm, 0);
    badge_runtime_tick(fsm, 2100);
    badge_runtime_press(fsm, 233, 233, 2200);
    badge_runtime_tick(fsm, 2379);
    badge_hint_view_t hint;
    badge_fsm_hint_view(fsm, &hint);
    CHECK(hint.directions == 0);
    badge_runtime_tick(fsm, 2380);
    badge_fsm_hint_view(fsm, &hint);
    CHECK(hint.directions == 15);
    badge_runtime_move(fsm, 233, 180, 2400);
    badge_fsm_hint_view(fsm, &hint);
    CHECK(hint.directions == 1);
    badge_runtime_release(fsm, 233, 180, 2450);
    CHECK(state.learned[1] == 1);
    badge_runtime_tick(fsm, 2849);
    badge_fsm_hint_view(fsm, &hint);
    CHECK(!hint.return_hint);
    badge_runtime_tick(fsm, 2850);
    badge_fsm_hint_view(fsm, &hint);
    CHECK(hint.return_hint && hint.return_direction == BADGE_NAV_DOWN);
    badge_runtime_press(fsm, 233, 233, 2900);
    badge_fsm_hint_view(fsm, &hint);
    CHECK(!hint.return_hint);
    badge_runtime_release(fsm, 233, 233, 2950);
    badge_fsm_destroy(fsm);
    for (unsigned skill = 0; skill < 5; ++skill)
        for (int i = 0; i < 5; ++i) badge_onboarding_learn(&state, skill);
    CHECK(state.learned[1] == 3);
    CHECK(!badge_onboarding_novice(&state, 1700000000u));
    CHECK(badge_onboarding_return_visit(&state, 0));
    CHECK(badge_onboarding_return_visit(&state, 0));
    CHECK(!badge_onboarding_return_visit(&state, 0));
}

static void test_tutorial_visual(void)
{
    badge_tutorial_view_t view = { .active = true, .step = 1, .direction = BADGE_NAV_UP };
    badge_tutorial_visual_t visual;
    badge_nav_t direction;
    uint32_t phase;
    CHECK(badge_tutorial_preview(&view, &direction, &phase) && direction == BADGE_NAV_UP && phase == 0);
    view.elapsed_ms = 1450;
    CHECK(!badge_tutorial_preview(&view, &direction, &phase));
    view.elapsed_ms = 2400;
    CHECK(badge_tutorial_preview(&view, &direction, &phase) && phase == 0);
    view.touching = true;
    CHECK(!badge_tutorial_preview(&view, &direction, &phase));
    view.touching = false; view.complete = true;
    CHECK(!badge_tutorial_preview(&view, &direction, &phase));
    view.complete = false; view.elapsed_ms = 0;
    badge_tutorial_visual(&view, &visual);
    CHECK(visual.show && visual.finger && visual.completed == 1);
    CHECK(visual.finger_y == 308);
    view.elapsed_ms = 1449;
    badge_tutorial_visual(&view, &visual);
    CHECK(visual.finger && visual.finger_y < 233);
    view.elapsed_ms = 1450;
    badge_tutorial_visual(&view, &visual);
    CHECK(!visual.finger);
    view.elapsed_ms = 2400;
    badge_tutorial_visual(&view, &visual);
    CHECK(visual.finger && visual.finger_y == 308);
    view.touching = true; view.returning = true;
    view.screen_elapsed_ms = 0;
    badge_tutorial_visual(&view, &visual);
    CHECK(visual.mask_alpha == 0);
    view.screen_elapsed_ms = 125;
    badge_tutorial_visual(&view, &visual);
    CHECK(visual.mask_alpha == 57);
    view.screen_elapsed_ms = 249;
    badge_tutorial_visual(&view, &visual);
    CHECK(visual.mask_alpha == 114);
    view.screen_elapsed_ms = 250;
    badge_tutorial_visual(&view, &visual);
    CHECK(!visual.finger && visual.mask_alpha == 115);
    view.dragging = true;
    badge_tutorial_visual(&view, &visual);
    CHECK(visual.mask_alpha == 0);
    view.complete = true;
    badge_tutorial_visual(&view, &visual);
    CHECK(visual.completed == 5 && !visual.finger);
}

static void test_tutorial(void)
{
    badge_game_t game;
    badge_pet_defaults(&game);
    badge_onboarding_t state = { .bound = true };
    badge_fsm_t *fsm = badge_fsm_create(&game, 0);
    badge_fsm_set_onboarding(fsm, &state);
    badge_runtime_attach(fsm, 0);
    badge_runtime_tick(fsm, 2100);
    badge_tutorial_view_t view;
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.active && view.step == 0);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_GUIDE);
    CHECK(badge_fsm_visual_screen(fsm) == BADGE_SCREEN_MAIN_A);
    CHECK(badge_screens[badge_fsm_visual_screen(fsm)].has_cat);
    tap(fsm, 2200);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.step == 1);
    CHECK(badge_tutorial_preview(&view, NULL, NULL));
    badge_runtime_tick(fsm, 2300);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.step == 1 && badge_fsm_screen(fsm) == BADGE_SCREEN_GUIDE);
    badge_runtime_press(fsm, 20, 233, 2350);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(!badge_tutorial_preview(&view, NULL, NULL));
    badge_runtime_release(fsm, 20, 233, 2360);
    tutorial_swipe(fsm, 0, 160, 2500);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_GUIDE); /* Wrong direction. */
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.error == 1);
    badge_runtime_tick(fsm, 4750);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.error == 0);
    tutorial_swipe(fsm, 0, -160, 3000);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_CARE_MENU);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.step == 1 && view.returning); /* Entry alone cannot pass. */
    CHECK(view.screen_elapsed_ms == 0);
    badge_runtime_tick(fsm, 3375);
    badge_fsm_tutorial_view(fsm, &view);
    badge_tutorial_visual_t back_visual;
    badge_tutorial_visual(&view, &back_visual);
    CHECK(view.screen_elapsed_ms == 125 && back_visual.mask_alpha == 57);
    tutorial_swipe(fsm, 0, 160, 3500);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.step == 2 && !view.returning);
    tutorial_swipe(fsm, 0, 160, 4000);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_STATUS);
    tutorial_swipe(fsm, 0, -160, 4500);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.step == 3);
    tutorial_swipe(fsm, -160, 0, 5000);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_MAIN_B);
    tutorial_swipe(fsm, -160, 0, 5500);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.step == 3 && view.returning); /* Must be opposite. */
    tutorial_swipe(fsm, 160, 0, 6000);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.step == 4);
    badge_runtime_press(fsm, 233, 233, 6500);
    badge_runtime_tick(fsm, 7099);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_GUIDE);
    badge_runtime_tick(fsm, 7100);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_VOICE);
    badge_runtime_release(fsm, 233, 233, 7200);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.complete && !state.tutorial_done);
    tap(fsm, 7500);
    CHECK(state.tutorial_done && !state.tutorial_skipped);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_MAIN_A);
    badge_runtime_press(fsm, 233, 233, 7800);
    badge_fsm_tutorial_replay(fsm, 8000);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.active && view.step == 0 && !view.complete);
    CHECK(!view.touching && !view.dragging);
    badge_runtime_release(fsm, 233, 233, 8100);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.step == 0);
    badge_fsm_set_battery(fsm, 4, true, false, 8200);
    badge_fsm_tutorial_replay(fsm, 8300);
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(!view.active && badge_fsm_screen(fsm) == BADGE_SCREEN_LOWBAT);
    badge_fsm_destroy(fsm);
}

static void test_local_experience(void)
{
    badge_game_t game;
    badge_pet_defaults(&game);
    badge_onboarding_t state = {0}, original = {0};
    badge_fsm_t *fsm = badge_fsm_create(&game, 0);
    badge_fsm_set_onboarding(fsm, &state);
    badge_runtime_attach(fsm, 0);
    badge_runtime_tick(fsm, 2100);
    CHECK(!badge_fsm_local_experience(fsm));
    badge_runtime_press(fsm, 233, 374, 2200);
    badge_runtime_release(fsm, 233, 374, 2250);
    CHECK(badge_fsm_local_experience(fsm));
    badge_tutorial_view_t view;
    badge_fsm_tutorial_view(fsm, &view);
    CHECK(view.active && view.step == 0);
    badge_runtime_press(fsm, 233, 420, 2300);
    badge_runtime_release(fsm, 233, 420, 2350);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_MAIN_A);
    tutorial_swipe(fsm, -160, 0, 2400);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_MAIN_B);
    CHECK(memcmp(&state, &original, sizeof(state)) == 0);
    CHECK(!badge_app_link_connected());
    badge_fsm_destroy(fsm);
    fsm = badge_fsm_create(&game, 3000);
    badge_fsm_set_onboarding(fsm, &state);
    badge_runtime_attach(fsm, 3000);
    badge_runtime_tick(fsm, 5100);
    CHECK(!badge_fsm_local_experience(fsm) && badge_fsm_screen(fsm) == BADGE_SCREEN_PAIR);
    badge_fsm_set_battery(fsm, 4, true, false, 5200);
    CHECK(!badge_fsm_start_local_experience(fsm, 5300));
    badge_fsm_destroy(fsm);
}

static void test_onboarding(void)
{
    badge_onboarding_t state;
    net_test_nvs_reset();
    net_test_link_select(0);
    (void)badge_onboarding_store_load(&state);
    CHECK(!state.bound && !state.tutorial_done);
    badge_game_t game;
    badge_pet_defaults(&game);
    badge_fsm_t *fsm = badge_fsm_create(&game, 0);
    badge_fsm_set_onboarding(fsm, &state);
    badge_runtime_attach(fsm, 0);
    badge_runtime_tick(fsm, 2100);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_PAIR);
    badge_fsm_set_phone(fsm, true);
    badge_runtime_tick(fsm, 2200);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_PAIR);
    CHECK(!state.bound);
    CHECK(!badge_fsm_set_pair_code(fsm, "1234x6"));
    CHECK(badge_fsm_set_pair_code(fsm, "654321"));
    badge_fsm_binding_verified(fsm, 1700000000u, 2300);
    CHECK(state.bound && state.bound_unix == 1700000000u);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_GUIDE);
    for (int i = 0; i < 5; ++i) badge_fsm_act(fsm, BADGE_ACT_GUIDE_NEXT, 2400 + i);
    CHECK(game.guide_page == 0 && !state.tutorial_done);
    badge_runtime_press(fsm, BADGE_CX, 420, 2500);
    badge_runtime_release(fsm, BADGE_CX, 420, 2600);
    CHECK(state.tutorial_skipped && badge_fsm_screen(fsm) == BADGE_SCREEN_MAIN_A);
    badge_fsm_destroy(fsm);
    badge_onboarding_finish(&state, true);
    CHECK(state.tutorial_skipped && !state.tutorial_done);
    net_test_nvs_counters_reset();
    badge_onboarding_store_poll(&state, 3000);
    badge_onboarding_store_poll(&state, 6999);
    CHECK(net_test_nvs_set_count() == 0);
    net_test_nvs_fail_commit(1);
    badge_onboarding_store_poll(&state, 7000);
    CHECK(net_test_nvs_commit_count() == 0);
    badge_onboarding_store_poll(&state, 11000);
    CHECK(net_test_nvs_commit_count() == 1); /* Failed commit retries. */
    badge_onboarding_t restored;
    CHECK(badge_onboarding_store_load(&restored) == ESP_OK);
    CHECK(restored.bound && restored.tutorial_skipped);
    CHECK(restored.bound_unix == state.bound_unix);
    fsm = badge_fsm_create(&game, 12000);
    badge_fsm_set_onboarding(fsm, &restored);
    badge_runtime_tick(fsm, 14100);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_MAIN_A);
    badge_fsm_destroy(fsm);
    uint8_t blob[BADGE_ONBOARD_SAVE_BYTES];
    CHECK(badge_onboarding_encode(&state, blob, sizeof(blob)) == sizeof(blob));
    CHECK(!badge_onboarding_decode(&restored, blob, sizeof(blob) - 1));
    blob[4] ^= 1;
    CHECK(!badge_onboarding_decode(&restored, blob, sizeof(blob)));
    CHECK(restored.bound_unix == state.bound_unix); /* Atomic reject. */
    state.tutorial_skipped = false;
    fsm = badge_fsm_create(&game, 15000);
    badge_fsm_set_onboarding(fsm, &state);
    badge_runtime_tick(fsm, 17100);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_GUIDE);
    badge_fsm_destroy(fsm);
}

static void test_frame_clock(void)
{
    badge_frame_clock_t clock = {0};
    badge_frame_target(&clock, 30);
    int frames = 0;
    for (int i = 0; i < 100; ++i) frames += badge_frame_due(&clock, .01, true);
    CHECK(frames == 30); /* Dirty cannot drive 100fps or quantise down to 25. */
    badge_frame_cost(&clock, 50000);
    CHECK(clock.effective == 28);
    badge_frame_target(&clock, 30);
    CHECK(clock.effective == 28);
    badge_frame_cost(&clock, 1000);
    CHECK(clock.effective == 29);
    badge_frame_target(&clock, 0);
    CHECK(!badge_frame_due(&clock, .5, false));
    CHECK(badge_frame_due(&clock, .01, true));
    badge_frame_target(&clock, 6);
    badge_frame_cost(&clock, 200000);
    CHECK(clock.effective == 6); /* Floor cannot exceed a low target. */
    frames = 0;
    for (int i = 0; i < 100; ++i) frames += badge_frame_due(&clock, .01, true);
    CHECK(frames == 6);
}

static void test_motion(void)
{
    CHECK(!badge_motion_commit(49, 500, false));
    CHECK(badge_motion_commit(50, 500, false));
    CHECK(!badge_motion_commit(50, 501, false));
    CHECK(!badge_motion_commit(139, 2000, false));
    CHECK(badge_motion_commit(140, 2000, false));
    CHECK(!badge_motion_commit(180, 300, true));
    CHECK(badge_motion_rubber(80) == 20);
    CHECK(badge_motion_rubber(-140) == -28);
    CHECK(badge_motion_duration(true, false, 466, 466) == 220);
    CHECK(badge_motion_duration(true, false, 66, 466) == 120);
    CHECK(badge_motion_duration(false, false, 80, 466) == 180);
    CHECK(badge_motion_duration(false, true, 80, 466) == 200);
    badge_motion_history_t history = {0};
    badge_motion_sample(&history, UINT32_MAX - 39u, 220, 233);
    CHECK(!badge_motion_reverse(&history, 60, 190, 233, true, 90)); /* Exactly .3 */
    CHECK(badge_motion_reverse(&history, 60, 189, 233, true, 89));

    badge_game_t game;
    badge_pet_defaults(&game);
    badge_fsm_t *fsm = badge_fsm_create(&game, 0);
    badge_runtime_attach(fsm, 0);
    badge_runtime_tick(fsm, 2100);
    badge_runtime_press(fsm, 233, 233, 2200);
    badge_feedback_t feedback;
    badge_fsm_feedback(fsm, 2349, &feedback);
    CHECK(feedback.hold_progress == 0);
    badge_fsm_feedback(fsm, 2350, &feedback);
    CHECK(feedback.hold_progress > 0);
    badge_fsm_feedback(fsm, 2575, &feedback);
    CHECK(feedback.hold_progress == 500);
    badge_runtime_move(fsm, 245, 233, 2600); /* Exactly 12 cancels. */
    badge_runtime_tick(fsm, 2800);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_MAIN_A);
    badge_fsm_feedback(fsm, 2800, &feedback);
    CHECK(feedback.hold_progress == 0);
    badge_runtime_release(fsm, 245, 233, 2800);

    badge_runtime_press(fsm, 100, 233, 3000);
    badge_runtime_move(fsm, 320, 233, 3500);
    badge_fsm_feedback(fsm, 3500, &feedback);
    CHECK(feedback.face_dots_alpha == 255);
    badge_runtime_move(fsm, 300, 233, 3540);
    badge_runtime_release(fsm, 280, 233, 3580); /* 180px final, -40/80ms. */
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_MAIN_A);
    badge_fsm_feedback(fsm, 4780, &feedback);
    CHECK(feedback.face_dots_alpha == 255);
    badge_fsm_feedback(fsm, 4930, &feedback);
    CHECK(feedback.face_dots_alpha > 0 && feedback.face_dots_alpha < 255);
    badge_fsm_feedback(fsm, 5080, &feedback);
    CHECK(feedback.face_dots_alpha == 0);
    badge_runtime_press(fsm, 100, 233, 4000);
    badge_runtime_move(fsm, 240, 233, 5400);
    badge_runtime_release(fsm, 240, 233, 5500);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_MAIN_C); /* Positive/right. */
    badge_fsm_destroy(fsm);

    fsm = badge_fsm_create(&game, 6000);
    badge_runtime_attach(fsm, 6000);
    badge_runtime_tick(fsm, 8100);
    const int pending = badge_events_pending();
    badge_runtime_press(fsm, 233, 233, 8200);
    badge_runtime_move(fsm, 280, 233, 8250);
    badge_runtime_release(fsm, 233, 233, 8300);
    CHECK(badge_events_pending() == pending); /* A drag back is not a tap. */
    badge_runtime_press(fsm, 233, 233, 9000);
    badge_runtime_move(fsm, 244, 233, 9200); /* 11px still allows hold. */
    badge_runtime_tick(fsm, 9600);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_VOICE);
    badge_runtime_release(fsm, 244, 233, 9700);
    badge_fsm_destroy(fsm);
}

int main(void)
{
    const uint8_t a[8] = {1}, b[8] = {2};
    net_test_nvs_reset();
    net_test_link_register(0, a);
    net_test_link_register(1, b);
    net_test_link_select(0);
    CHECK(badge_events_init() == ESP_OK);
    badge_game_t game;
    badge_pet_defaults(&game);
    badge_fsm_t *fsm = badge_fsm_create(&game, 0);
    CHECK(fsm != NULL);
    badge_runtime_attach(fsm, 0); /* Same call as production, no test-only sink. */
    badge_runtime_tick(fsm, 2100);
    CHECK(badge_fsm_screen(fsm) == BADGE_SCREEN_MAIN_A);
    badge_events_set_time(1700000000u);
    const int initial_mood = game.stat[BADGE_STAT_MOOD];
    tap(fsm, 3200);
    CHECK(game.stat[BADGE_STAT_MOOD] == initial_mood + 9);
    CHECK(badge_events_pending() == 1);
    badge_evt_t evt;
    CHECK(badge_events_peek(0, &evt));
    CHECK(evt.type == EVT_PET);
    CHECK(evt.ts == 1700000001u);
    const badge_fx_t fx = badge_fsm_take_fx(fsm);
    CHECK(fx.bubble != 0 && (fx.sfx & BADGE_SFX_PET));
    CHECK(badge_fsm_take_fx(fsm).sfx == 0);
    badge_feedback_t feedback;
    badge_overlay_t overlay = {0};
    badge_fsm_feedback(fsm, 3300, &feedback);
    CHECK(feedback.bubble == fx.bubble && feedback.bubble_t0 == 3300);
    CHECK(feedback.pet_float && feedback.pet_t0 == 3300);
    CHECK(badge_overlay_update(&overlay, &feedback, false).new_pet);
    badge_fsm_feedback(fsm, 3400, &feedback);
    CHECK(feedback.bubble_t0 == 3300); /* Refresh cannot extend lifetime. */
    CHECK(!badge_overlay_update(&overlay, &feedback, false).new_pet);
    tap(fsm, 3500); /* Cooldown: no second successful event. */
    CHECK(badge_events_pending() == 1);

    /* Saving is driven through the runtime, not manually via events_save(). */
    net_test_nvs_counters_reset();
    badge_runtime_tick(fsm, 8299);
    CHECK(net_test_nvs_set_count() == 0);
    badge_runtime_press(fsm, 233, 233, 8300);
    CHECK(net_test_nvs_set_count() == 0); /* No flash in the finger callback. */
    badge_runtime_tick(fsm, 8300);
    CHECK(net_test_nvs_set_count() == 1);
    CHECK(net_test_nvs_commit_count() == 1);
    badge_fsm_destroy(fsm);
    badge_events_reboot();
    CHECK(badge_events_init() == ESP_OK);
    CHECK(badge_events_pending() == 1);
    CHECK(badge_events_peek(0, &evt) && evt.type == EVT_PET);
    CHECK(evt.ts == 1700000001u);

    /* A real adapter on a simulated BLE connection must NOT grant App access. */
    CHECK(badge_app_link_init(&game) == ESP_OK);
    game.discover = false;
    badge_app_link_sync();
    CHECK(!net_link_discovery_enabled());
    game.discover = true;
    badge_app_link_sync();
    CHECK(net_link_discovery_enabled());
    CHECK(badge_app_link_start() == ESP_OK);
    net_test_link_add_peer(0, b, -40);
    net_test_link_set_reachable(0, 1, 1);
    CHECK(net_link_connect(b) == ESP_OK);
    CHECK(net_link_connected());
    CHECK(!badge_app_link_connected());
    badge_app_link_poll(8400);
    CHECK(badge_events_pending() == 1);
    CHECK(net_test_link_sent_count(0) == 0);
    badge_app_link_stop();

    /* Refused full-mood pet must not emit a successful action. */
    game.stat[BADGE_STAT_MOOD] = 100;
    fsm = badge_fsm_create(&game, 9000);
    badge_runtime_attach(fsm, 9000);
    badge_runtime_tick(fsm, 11100);
    tap(fsm, 11200);
    CHECK(badge_events_pending() == 1);
    CHECK(badge_fsm_take_fx(fsm).bubble != 0);
    badge_fsm_feedback(fsm, 11300, &feedback);
    CHECK(!feedback.pet_float && feedback.pet_rev == 0);
    badge_fsm_destroy(fsm);

    /* Real feedback producers with no test-only FX injection. */
    badge_pet_defaults(&game);
    fsm = badge_fsm_create(&game, 0);
    badge_fsm_feedback(fsm, 0, &feedback);
    CHECK(!feedback.ring && !feedback.bubble && !feedback.toast);
    overlay = (badge_overlay_t){0};
    CHECK(!badge_overlay_update(&overlay, &feedback, false).redraw);
    badge_fsm_show_bubble(fsm, BADGE_TXT_PETGOOD, 0);
    badge_fsm_feedback(fsm, 0, &feedback);
    CHECK(feedback.bubble == BADGE_TXT_PETGOOD && feedback.bubble_t0 == 0);
    CHECK(badge_overlay_update(&overlay, &feedback, false).bubble_changed);
    const uint32_t revision = feedback.bubble_rev;
    badge_fsm_show_bubble(fsm, BADGE_TXT_PETGOOD, 1000);
    badge_fsm_feedback(fsm, 1000, &feedback);
    CHECK(feedback.bubble_rev == revision + 1 && feedback.bubble_t0 == 1000);
    CHECK(badge_overlay_update(&overlay, &feedback, false).bubble_changed);
    badge_fsm_feedback(fsm, 1000 + badge_numbers.bubble_ms - 1, &feedback);
    CHECK(feedback.bubble != 0);
    CHECK(badge_overlay_update(&overlay, &feedback, false).redraw);
    badge_fsm_feedback(fsm, 1000 + badge_numbers.bubble_ms, &feedback);
    CHECK(feedback.bubble == 0);
    CHECK(badge_overlay_update(&overlay, &feedback, false).redraw); /* Last erase. */
    CHECK(!badge_overlay_update(&overlay, &feedback, false).redraw);
    badge_fsm_show_toast(fsm, BADGE_TXT_PETGOOD, UINT32_MAX - 99u);
    badge_fsm_feedback(fsm, 50, &feedback);
    CHECK(feedback.toast == BADGE_TXT_PETGOOD); /* Wrapped age 150ms. */
    CHECK(feedback.toast_t0 == UINT32_MAX - 99u);
    CHECK(badge_overlay_update(&overlay, &feedback, false).toast_changed);
    badge_fsm_feedback(fsm, badge_numbers.toast_ms - 100u, &feedback);
    CHECK(feedback.toast == 0);
    badge_peer_t peer = {0};
    peer.short_id[0] = 1;
    badge_fsm_peer_found(fsm, &peer, 5000);
    badge_fsm_peer_confirmed(fsm, 5000);
    badge_fsm_feedback(fsm, 5100, &feedback);
    CHECK(feedback.ring && feedback.ring_t0 == 5000);
    badge_fsm_feedback(fsm, 5000 + BADGE_HAPTIC_MS - 1, &feedback);
    CHECK(feedback.ring && feedback.ring_t0 == 5000);
    badge_fsm_feedback(fsm, 5000 + BADGE_HAPTIC_MS, &feedback);
    CHECK(!feedback.ring);
    badge_fsm_destroy(fsm);
    test_motion();
    test_frame_clock();
    CHECK(!badge_motion_blocks_input(true, true, false));
    CHECK(!badge_motion_blocks_input(true, true, true));
    CHECK(!badge_motion_blocks_input(true, false, false));
    CHECK(badge_motion_blocks_input(true, false, true));
    CHECK(!badge_motion_blocks_input(false, false, true));
    test_local_experience();
    test_onboarding();
    test_tutorial();
    test_tutorial_visual();
    test_novice();
    test_low_battery();
    test_audio_policy();
    test_pet_store();
    test_idle_nudge();
    printf("runtime integration: %d checks, %d failures\n", checks, failures);
    return failures ? 1 : 0;
}
