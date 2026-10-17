/*
 * badge_pet - the badge's local copy of the pet's numbers, and the five care actions.
 *
 * WHAT THIS MODULE IS NOT
 * ----------------------
 * The badge is not authoritative about anything except what the owner did. The
 * interaction specification settles the pet's numbers in the App: the badge reports
 * events (main/net/badge_events.c) and renders whatever the App last sent. There is
 * therefore NO decay here -- the specification defines no decay rate for the badge
 * to apply, and inventing one would mean the numbers on the glass disagree with the
 * numbers the App shows, which is exactly the class of bug this rewrite exists to
 * remove. The badge's stats change on exactly two occasions: the owner finishes a
 * care action, or the App syncs.
 *
 * Consequently this module is small and pure: given a care action, do the
 * specification's arithmetic -- its deltas, its growth, its coins, its refusal rules
 * and its permutation counts -- and say whether it was allowed. It owns no timers,
 * no LVGL, no I2C and no NVS, so tests/host/test_badge_pet.c can walk every rule.
 *
 * The numbers come from the generated tables (badge_care_defs[], badge_blocks[],
 * badge_stage_growth[], badge_numbers), never from constants written here.
 */
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "badge_fsm.h"
#include "badge_spec_data.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Where a care action stands. Distinct from a bare bool because three different
 * outcomes need three different bubbles: refused with the spec's own wording, or a
 * permutation completed, or the whole action finished. */
typedef enum {
    BADGE_CARE_OK = 0,        /* one step completed (or the single-step action done) */
    BADGE_CARE_DONE,          /* the last step completed: settle growth and coins */
    BADGE_CARE_BLOCKED,       /* refused; `why` carries the spec's wording */
    BADGE_CARE_INVALID,       /* no such care action */
} badge_care_result_t;

/** @brief One care action's outcome. */
typedef struct {
    badge_care_result_t result;
    uint16_t why;      /* index into badge_strings[] when blocked, else 0 */
    uint8_t  step;     /* steps completed after this call */
    uint8_t  steps;    /* steps the action needs */
    int8_t   delta[BADGE_STAT_COUNT]; /* what was actually applied */
    int8_t   growth;
    int8_t   coins;
} badge_care_outcome_t;

/**
 * @brief Check a care action without applying it.
 *
 * @param why  receives the specification's own refusal wording
 * @return true when the action may start
 */
bool badge_pet_care_allowed(const badge_game_t *game, int care, uint16_t *why);

/**
 * @brief Advance a care action by one step and apply the specification's numbers.
 *
 * A care action with `steps` (喂食 3, 喝水 3, 逗猫 5) is applied once per step: the
 * stat deltas land on every step, while growth and coins are settled on the step that
 * finishes the action -- that is what the reference's `applyCare()` does, and it is
 * why a care cancelled halfway leaves the stats moved but the growth unearned.
 *
 * @param step  which step this is, 0-based
 */
badge_care_outcome_t badge_pet_care_step(badge_game_t *game, int care, int step);

/**
 * @brief Apply a care action's final settlement after its last step.
 *
 * Separate from badge_pet_care_step() so a cancelled action can be abandoned without
 * ever earning its growth: the caller simply never calls this.
 */
void badge_pet_care_settle(badge_game_t *game, int care);

/**
 * @brief Clamp and copy the App's numbers into the local model.
 *
 * Called when the App syncs. Every field is clamped to its legal range: a phone that
 * sends 120 for a stat or 99999999 for growth must not be able to make the badge draw
 * outside its own table.
 */
void badge_pet_sync(badge_game_t *game, const uint8_t stats[BADGE_STAT_COUNT], int32_t growth,
                    int32_t coins, bool sick);

/** @brief The life stage for the current growth, as an index into badge_stage_growth[]. */
int badge_pet_stage(const badge_game_t *game);

/** @brief Growth at which the next stage begins, or the last threshold when adult. */
int32_t badge_pet_next_growth(const badge_game_t *game);

/** @brief The stage's name ("幼猫" / "少年猫" / "成年猫"). */
const char *badge_pet_stage_name(const badge_game_t *game);

/** @brief Whether the pet is ill: health under the threshold, or the App said so. */
bool badge_pet_sick(const badge_game_t *game);

/** @brief The lowest stat below the specification's `lowStat`, or -1. */
int badge_pet_lowest_stat(const badge_game_t *game);

/**
 * @brief The alert index for the current numbers, or -1. See badge_alerts[].
 *
 * The order is the specification's own list, quoted from the reference renderer's
 * source comment: 不舒服 > 饱腹 > 精力 > 心情 > 清洁. So a hungry cat with even less
 * energy still shows 饱腹, because that is the priority the specification chose --
 * this is not "the lowest stat wins", and the two differ as soon as two stats are
 * below the threshold at once.
 */
int badge_pet_alert(const badge_game_t *game);

/** @brief Set one setting (亮度/唤醒词/可被发现/息屏常显) and return its new value. */
int badge_pet_toggle(badge_game_t *game, int setting);

/**
 * @brief Serialise the local model for the save file.
 *
 * Only the fields that survive a reboot: the stats, growth, coins, illness, the
 * chosen face and the four settings, the name and the breed. Returns the bytes
 * written, or 0 when the buffer is too small.
 */
uint32_t badge_pet_serialize(const badge_game_t *game, uint8_t *out, uint32_t cap);

/** @brief Restore what badge_pet_serialize() wrote. Returns false when malformed. */
bool badge_pet_deserialize(badge_game_t *game, const uint8_t *in, uint32_t len);

/** @brief Current save format version. Bump on any layout change. */
#define BADGE_PET_SAVE_VERSION 1u

/**
 * @brief Bytes badge_pet_serialize() always writes.
 *
 * Published here because the caller has to size its buffer BEFORE the call, and a
 * caller that guesses short gets a silent 0 back and no save at all. It is a #define
 * rather than a function so the buffer can live on the stack without a VLA.
 * tests/host/test_badge_pet.c asserts this equals the layout's own size and that
 * serialize() writes exactly this many bytes, so the two cannot drift apart.
 */
#define BADGE_PET_SAVE_BYTES 33u

/**
 * @brief The name a badge starts with ("小橘").
 *
 * From the reference's own opening state (吧唧渲染参考.html line 1319, `name:'小橘'`).
 * badge_spec.json has no initial-name field -- it carries the pet's *wording*
 * (`texts.*`, the screens) but not its demo state -- so this is a literal here rather
 * than an index into badge_strings[]. It is a literal in a file the font-coverage check
 * scans, so a missing glyph for either character fails that check instead of reaching
 * the glass as a blank box.
 */
#define BADGE_DEFAULT_NAME "小橘"

/**
 * @brief Fill `game` with the specification's starting state.
 *
 * The reference's own opening state (`吧唧渲染参考.html`: `stats:{food:65,mood:72,
 * clean:68,energy:75,health:100},sick:0,coins:30,growth:86,name:'小橘',breed:'orange'`,
 * the last of which is breed 0 in the cat3d palette), plus the specification's defaults
 * for the four settings (12.7: the demo clock starts at 18:40, brightness 中, 唤醒词 on,
 * 可被发现 on, 息屏常显 on).
 *
 * This exists because a badge whose save is missing, unreadable or from a different
 * firmware has to start somewhere, and "somewhere" must not be the zeroed struct: zero
 * stats means the cat is sick and starving on first boot, `bright` 0 is the dimmest
 * setting, and a zeroed name is an empty bubble.
 */
void badge_pet_defaults(badge_game_t *game);

#ifdef __cplusplus
}
#endif
