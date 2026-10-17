/*
 * app_link - the seam between the badge's own vocabulary and the BLE social layer.
 *
 * See app_link.c for why this exists and what it deliberately does not translate.
 */
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "esp_err.h"

#include "badge_fsm.h"

#ifdef __cplusplus
extern "C" {
#endif

/** @brief Hand the link a game to advertise from. Call once, after NVS is up. */
esp_err_t badge_app_link_init(badge_game_t *game);

/** @brief Copy the fields that cross the seam; cheap, called whenever they change. */
void badge_app_link_sync(void);

/** @brief Start advertising (and the social layer's own state machine). */
esp_err_t badge_app_link_start(void);
void badge_app_link_stop(void);

/** @brief Drive social radio state. App event delivery is disabled until authenticated. */
void badge_app_link_poll(uint32_t now_ms);

/** @brief Whether an authenticated App session is available.
 * Currently false until the App authentication adapter is integrated; a social
 * BLE connection must never grant phone privileges or drain the event queue. */
bool badge_app_link_connected(void);

/** @brief True while a peer is waiting for the owner to confirm the meeting (遇见). */
bool badge_app_link_peer_pending(void);

/** @brief Abandon the pending meeting (the owner swiped away from 遇见). */
void badge_app_link_peer_clear(void);

/** @brief The owner confirmed 成为朋友: finish the handshake and report EVT_MEET. */
esp_err_t badge_app_link_confirm_meeting(void);

/** @brief Offer a meeting to a peer the badge has discovered. */
esp_err_t badge_app_link_request_meeting(void);

/** @brief How many distinct peers the local 图鉴 still remembers. */
int badge_app_link_encounters(void);

#ifdef __cplusplus
}
#endif
