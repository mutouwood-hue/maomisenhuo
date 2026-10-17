/*
 * app_link - the seam between the badge's own vocabulary and the BLE social layer.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * net_link.c and net_social.c were written before 《吧唧交互规范》 became the source of
 * truth, and they do their work in that era's vocabulary: a pet_game_t with six
 * cats, xp, levels, an inventory and an outdoor-activity runner. The specification's
 * pet is a plain record -- five stats, growth, coins, a breed -- and the App settles
 * everything else.
 *
 * There are two ways to resolve that. One is to rewrite net_link.c and net_social.c
 * around the new vocabulary, which throws away the parts of them that are expensive
 * and hard to get right (the hand-rolled advertisement layout, the mbedTLS handshake,
 * the encounter table, the NVS schema) and invalidates their host tests. The other is
 * to keep them and translate at the seam. This file is the translation.
 *
 * WHAT CROSSES THE SEAM
 * ---------------------
 * Only three fields are ever read out of the borrowed game: the active cat's breed,
 * its xp (which net_link converts to a stage byte for the advertisement) and its
 * name. So the adapter keeps a small shadow game in step with badge_game_t and hands
 * net_link a pointer to that, rather than reshaping either side. `badge_app_link_sync()`
 * is cheap enough to call every tick and is called whenever the name, breed or growth
 * can have changed.
 *
 * THE HONEST LIMITS
 * -----------------
 *   * `pet_stage()`'s thresholds are the old xp levels (0/300/1500 by PET_XP_*), not
 *     the specification's growth thresholds (0/60/160). The stage that goes over the
 *     air is therefore the old one. Both are monotonic in the same direction, so a
 *     peer's badge shows a plausible stage; making them agree would mean either
 *     rewriting net_link's advertisement or duplicating its stage byte here, and the
 *     advertisement layout is net_link's to own. This is recorded in
 *     docs/badge-uplink.md as a known discrepancy rather than hidden.
 *   * The encounter flow is the specification's (遇见 -> 碰一碰/扫码 -> 成为朋友), and
 *     the badge reports it upstream as EVT_MEET. The App owns the friendship record;
 *     net_social's own dex is kept as a local cache for the 图鉴 screen it already
 *     serves.
 */
#include "app_link.h"

#include <stdio.h>
#include <string.h>

#include "esp_log.h"

#include "badge_events.h"
#include "net_link.h"
#include "net_social.h"
#include "pet_state.h"

static const char *TAG = "app_link";

/* The borrowed state. Static, not heap: it is one per badge, and a 6-cat game struct
 * is too large for a task stack. */
static pet_game_t s_shadow;
static badge_game_t *s_game;
static net_social_t *s_social;

/* The last stage byte we derived, so syncing is a comparison rather than a rebuild. */
static uint8_t s_last_breed = 0xFF;
static uint32_t s_last_xp = 0xFFFFFFFFu;
static char s_last_name[PET_NAME_MAX + 1];

/* ------------------------------------------------------------------ callbacks --*/

/*
 * The old layer's "a peer wants to meet" prompt. The specification's 遇见 screen
 * appears when a peer is discovered, and the confirmation is the owner's tap, so the
 * badge shows the screen and the App is told later; nothing is decided here. The
 * prompt is recorded so badge_app_link_peer_pending() can answer the UI.
 */
static bool s_prompt_pending;

static void on_prompt(const net_encounter_t *who, void *user)
{
    (void)user;
    (void)who;
    if (!net_link_discovery_enabled()) return;
    s_prompt_pending = true;
    ESP_LOGI(TAG, "a peer asked to meet; showing 遇见");
}

static void on_met(const net_encounter_t *who, const char *icebreaker, void *user)
{
    (void)user;
    (void)who;
    (void)icebreaker;
    s_prompt_pending = false;
    /* Becoming friends is an event the App settles (spec 9, EVT_MEET). The badge's
     * only job is to report it and show 成为朋友. */
    badge_events_push(EVT_MEET, 1, 0);
    ESP_LOGI(TAG, "meeting confirmed over the radio");
}

/* --------------------------------------------------------------------- init ----*/

esp_err_t badge_app_link_init(badge_game_t *game)
{
    if (!game) return ESP_ERR_INVALID_ARG;
    if (s_game) return ESP_ERR_INVALID_STATE;
    s_game = game;

    /* The shadow game only needs to answer "what is the active cat", so it is left
     * otherwise empty: nothing else is read across the seam. */
    pet_game_init(&s_shadow);
    s_shadow.cat_count = 1;
    s_shadow.active = 0;

    badge_app_link_sync();

    esp_err_t err = net_link_init(&s_shadow);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "net_link_init failed: %s", esp_err_to_name(err));
        s_game = NULL;
        return err;
    }
    return ESP_OK;
}

void badge_app_link_sync(void)
{
    if (!s_game) return;
    net_link_set_discovery(s_game->discover);
    if (!s_game->discover) {
        s_prompt_pending = false;
        if (s_social && net_social_prompt_pending(s_social)) net_social_decline_meeting(s_social);
    }
    pet_cat_t *c = &s_shadow.cats[0];

    if (s_last_breed != s_game->breed) {
        c->breed = s_game->breed;
        s_last_breed = s_game->breed;
    }
    /* Growth maps onto the old layer's xp. See the note at the top of the file about
     * the thresholds; the number itself is carried through unchanged. */
    const uint32_t xp = (uint32_t)(s_game->growth < 0 ? 0 : s_game->growth);
    if (s_last_xp != xp) {
        c->xp = xp;
        s_last_xp = xp;
    }
    if (strncmp(s_last_name, s_game->name, sizeof(s_last_name)) != 0) {
        snprintf(s_last_name, sizeof(s_last_name), "%s", s_game->name);
        snprintf(c->name, sizeof(c->name), "%s", s_game->name);
    }
}

esp_err_t badge_app_link_start(void)
{
    if (!s_game) return ESP_ERR_INVALID_STATE;

    if (!s_social) {
        /* net_social_create() is the module's own singleton -- there is exactly one
         * radio -- so the storage is its business, not this file's (net_social.h:164).
         * net_social_create_in() exists for the host test that runs two instances. */
        s_social = net_social_create(&s_shadow);
        if (!s_social) return ESP_ERR_NO_MEM;
        net_social_start(s_social);
        net_social_set_prompt_cb(s_social, on_prompt, NULL);
        net_social_set_met_cb(s_social, on_met, NULL);
    }

    return net_link_start();
}

void badge_app_link_stop(void)
{
    net_link_stop();
    if (s_social) {
        net_social_destroy(s_social);
        s_social = NULL;
    }
}

/* -------------------------------------------------------------------- poll ----*/

void badge_app_link_poll(uint32_t now_ms)
{
    (void)now_ms;
    if (!s_social) return;
    net_social_poll(s_social);
    /* A social BLE connection is NOT an authenticated App session. No App
     * authentication contract is integrated yet: fail closed instead of leaking
     * the newly connected interaction queue to whichever peer is on the radio. */
}

bool badge_app_link_connected(void)
{
    /* Until an App authenticator is integrated, no radio connection grants
     * phone privileges (pair completion, free voice or event settlement). */
    return false;
}

bool badge_app_link_peer_pending(void)
{
    return s_prompt_pending || net_social_prompt_pending(s_social);
}

void badge_app_link_peer_clear(void)
{
    s_prompt_pending = false;
    if (s_social) net_social_decline_meeting(s_social);
}

int badge_app_link_encounters(void)
{
    return s_social ? net_social_encounter_count(s_social) : 0;
}

esp_err_t badge_app_link_confirm_meeting(void)
{
    if (!s_social) return ESP_ERR_INVALID_STATE;
    /* The owner tapped 成为朋友: tell the old layer to finish its handshake, and
     * report the event upstream. The event is pushed by the met callback. */
    return net_social_accept_meeting(s_social);
}

esp_err_t badge_app_link_request_meeting(void)
{
    if (!s_social) return ESP_ERR_INVALID_STATE;
    return net_social_request_meeting(s_social);
}
