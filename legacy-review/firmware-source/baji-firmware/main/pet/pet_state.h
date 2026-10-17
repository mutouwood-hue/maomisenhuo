/*
 * pet_state - the board-side nurturing kernel.
 *
 * A pure, dependency-free module: no LVGL, no NVS, no Bluetooth, no FreeRTOS. It
 * takes inputs (a monotonic millisecond clock and care commands) and produces a
 * struct, so the entire game can be unit-tested on a PC and the UI stays a thin
 * projection of this state.
 *
 * Every constant below was read out of the HTML prototype's own tables rather
 * than guessed; docs/porting-notes.md records the source of each one and the few
 * places where the board behaviour deliberately differs.
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* -- limits ---------------------------------------------------------------- */

#define PET_MAX_CATS        6
#define PET_NAME_MAX        12
#define PET_OUTFIT_COUNT    6   /* plus the implicit "none" */
#define PET_ITEM_COUNT      4
#define PET_GOAL_COUNT      5

/* The prototype's own clamps, kept as constants so the intent survives. */
#define PET_XP_MAX          10000000u  /* 1e7 -- its `Si(xp, 0, 1e7)` */
#define PET_COIN_MAX        1000000u   /* 1e6 */
/*
 * The prototype caps a single inventory slot at 1e5. Its slots are JavaScript
 * numbers; the board's are `uint16_t`, so the cap that can actually be represented
 * -- and therefore the one that is enforced -- is 65535. Clamping to 1e5 instead
 * would wrap the value rather than hold it.
 */
#define PET_ITEM_MAX        65535u
#define PET_COIN_START      30
#define PET_ADOPT_COST      12
#define PET_ACTIVITY_MIN_ENERGY 12     /* outdoor trips need energy >= 12 */
#define PET_STAT_MIN         0
#define PET_STAT_MAX         100

/* -- stats ----------------------------------------------------------------- */

typedef enum {
    PET_STAT_FOOD = 0,
    PET_STAT_MOOD,
    PET_STAT_CLEAN,
    PET_STAT_ENERGY,
    PET_STAT_COUNT
} pet_stat_t;

/* -- breeds ---------------------------------------------------------------- */

typedef enum {
    PET_BREED_ORANGE = 0,
    PET_BREED_SILVER,
    PET_BREED_TUXEDO,
    PET_BREED_SIAMESE,
    PET_BREED_RAGDOLL,
    PET_BREED_BLUE,
    PET_BREED_COUNT
} pet_breed_t;

/* -- life stages ----------------------------------------------------------- */

typedef enum {
    PET_STAGE_KITTEN = 0,
    PET_STAGE_YOUNG,
    PET_STAGE_ADULT,
} pet_stage_t;

/* -- actions --------------------------------------------------------------- */

typedef enum {
    PET_ACT_FEED = 0,
    PET_ACT_BATH,
    PET_ACT_PET,
    PET_ACT_PLAY,
    PET_ACT_SLEEP,
    PET_ACT_CLIMB,
    PET_ACT_TEASE,
    PET_ACT_DRINK,
    PET_ACT_CLINIC,
    PET_ACT_COUNT
} pet_action_t;

/* -- outdoors activities --------------------------------------------------- */

typedef enum {
    PET_RUN_NONE = 0,
    PET_RUN_WALK,
    PET_RUN_EXPLORE,
    PET_RUN_FISH,
    PET_RUN_COUNT
} pet_run_t;

/* -- animation ------------------------------------------------------------- */

typedef enum {
    PET_ANIM_IDLE = 0,
    PET_ANIM_WALK,
    PET_ANIM_PAW,
} pet_anim_t;

/* -- health ---------------------------------------------------------------- */

typedef enum {
    PET_ISSUE_NONE = 0,
    PET_ISSUE_SNIFFLES,  /* 小感冒 */
    PET_ISSUE_TUMMY,     /* 肚子不舒服 */
} pet_issue_t;

/* -- tables ---------------------------------------------------------------- */

typedef struct {
    const char *id;
    const char *name_zh;
    uint32_t    color;   /* 0xRRGGBB, the card colour in the HTML prototype */
} pet_breed_info_t;

typedef struct {
    const char *id;
    const char *name_zh;
    uint16_t    sell_price;
} pet_item_info_t;

typedef struct {
    const char *id;
    const char *name_zh;
    uint16_t    price;
} pet_outfit_info_t;

typedef struct {
    const char *id;
    const char *title_zh;
    uint16_t    target;
    uint16_t    reward_coins;
} pet_goal_info_t;

/*
 * Care actions. `pet` and `sleep` are special-cased in the prototype and are
 * described by their own table entries rather than by the generic care table:
 *
 *   pet   -> mood +9, xp 3, cooldown 2000 ms, refused while mood >= 98
 *   sleep -> energy +35, food -4, xp 6, cooldown 4000 ms, refused while energy >= 95
 *
 * `play` is a mini-game: mood +12..25, energy -8, food -5, xp 10..20, coins
 * 3..12, all scaled by the score. The board uses SCORE_MID, the prototype's
 * mid-range result, and records it as such.
 */
typedef struct {
    pet_action_t action;
    const char  *id;
    const char  *label_zh;
    int8_t       d_food;
    int8_t       d_mood;
    int8_t       d_clean;
    int8_t       d_energy;
    int8_t       d_health;      /* bath +1, sleep +2, everything else 0 */
    uint16_t     xp;
    uint16_t     coin_cost;
    uint16_t     coin_gain;     /* only the mini-game earns coins */
    uint16_t     cooldown_ms;
    uint8_t      anim;          /* pet_anim_t to play */
    uint8_t      block_at;      /* refuse when the named stat is >= this; 0 = never */
    uint8_t      block_stat;    /* pet_stat_t the threshold applies to */
    uint8_t      needs_energy;  /* 1 = refused while energy < 10 */
    /* The prototype gives each refusal its own wording; NULL means the caller
     * should fall back to a generic message. */
    const char  *block_reason_zh;
} pet_action_info_t;

/*
 * An outdoor trip.
 *
 * `item_gain` is what the cat brings home when the trip settles, counted per item
 * in PET_ITEMS order. The prototype does not put the haul on the activity itself:
 * it generates one pick-up node per checkpoint (its `Wf(mode)`) and adds the node's
 * item to the basket as the player collects it. The board has no explorable scene --
 * pet_game_update() derives progress from elapsed time instead -- so the haul is
 * stated here per trip, taken from that same node table:
 *
 *   walk    3 nodes, none carry an item      -> nothing
 *   explore flower, flower, shell, star, fish -> 2 flower, 1 shell, 1 star, 1 fish
 *   fish    fish, fish, fish, fish            -> 4 fish
 *
 * Without this the inventory had no source at all outside the demo seed, which made
 * both the backpack and the sell action unreachable in practice.
 */
typedef struct {
    pet_run_t   kind;
    const char *id;
    const char *name_zh;
    uint16_t    target;
    uint16_t    min_seconds;
    uint16_t    xp;
    uint16_t    coins;
    uint8_t     item_gain[PET_ITEM_COUNT];
} pet_activity_info_t;

extern const pet_breed_info_t    PET_BREEDS[PET_BREED_COUNT];
extern const pet_item_info_t     PET_ITEMS[PET_ITEM_COUNT];
extern const pet_outfit_info_t   PET_OUTFITS[PET_OUTFIT_COUNT];
extern const pet_goal_info_t     PET_GOALS[PET_GOAL_COUNT];
extern const pet_action_info_t   PET_ACTIONS[PET_ACT_COUNT];
extern const pet_activity_info_t PET_ACTIVITIES[PET_RUN_COUNT - 1];

/**
 * @brief Look a trip up by its kind, or NULL for PET_RUN_NONE / an unknown kind.
 *
 * The three call sites that need a trip's numbers (progress, settlement, the UI's
 * countdown) would otherwise each carry their own linear search over the table.
 */
const pet_activity_info_t *pet_activity_by_kind(pet_run_t kind);

/* -- one cat --------------------------------------------------------------- */

typedef struct {
    char    name[PET_NAME_MAX + 1];
    uint8_t breed;
    uint8_t outfit;              /* index into PET_OUTFITS, or 0xFF for none */

    uint8_t  stats[PET_STAT_COUNT];   /* 0..100 */
    uint8_t  health;                  /* 0..100 */
    uint8_t  issue;                   /* pet_issue_t */

    uint32_t xp;
    uint32_t born_at;                 /* unix seconds */

    uint32_t counts[PET_ACT_COUNT];
    uint16_t goals_claimed;           /* bitmask over PET_GOAL_COUNT */

    /* outdoor activity in progress */
    uint8_t  running;                 /* pet_run_t */
    uint16_t run_seconds;
    uint8_t  run_target;              /* seconds required */
    uint16_t run_progress;            /* checkpoints reached */
} pet_cat_t;

/*
 * The whole save. Coin purse, wardrobe and inventory are GLOBAL, exactly as in
 * the prototype: buying an outfit benefits every cat in the family.
 */
typedef struct {
    uint8_t  version;
    uint8_t  cat_count;
    uint8_t  active;                  /* index of the cat on screen */
    uint32_t coins;
    uint16_t wardrobe;                /* bitmask over PET_OUTFITS */
    uint16_t inventory[PET_ITEM_COUNT];

    pet_cat_t cats[PET_MAX_CATS];

    /* runtime only -- never serialised */
    uint32_t last_update_ms;
    uint32_t cooldown_until_ms[PET_MAX_CATS][PET_ACT_COUNT];
    uint16_t goals_unlocked;          /* bitmask, for UI badges */

    /*
     * Fractional decay that has not yet amounted to a whole stat point.
     *
     * The stats are stored as 0..100 integers because they are drawn as whole
     * numbers and persisted compactly, but the prototype's decay rates are tiny
     * (0.6% of a point per second for food). Subtracting the fraction directly and
     * rounding to an integer would round straight back up on every tick, so nothing
     * would ever decay on a real device ticking at 20 Hz. The remainder is carried
     * here instead, and a whole point is removed each time it accumulates.
     *
     * Runtime only: this is bookkeeping about elapsed time, not part of the game.
     */
    float    decay_frac[PET_STAT_COUNT];
} pet_game_t;

/* -- lifecycle ------------------------------------------------------------- */

void pet_game_init(pet_game_t *g);
int  pet_game_add_cat(pet_game_t *g, const char *name, pet_breed_t breed);
/** @brief Put the family in a demo-ready state (a cat with coins and an outfit). */
void pet_game_seed_demo(pet_game_t *g);

/* -- simulation ------------------------------------------------------------ */

/**
 * @brief Advance the simulation to `now_ms`.
 *
 * Idempotent for a repeated timestamp, and the elapsed delta is capped the same
 * way the prototype caps it, so a long suspend cannot starve the cat. This is the
 * only place stats decay and activities progress.
 */
void pet_game_update(pet_game_t *g, uint32_t now_ms);

/** @brief The prototype's per-second stat decay rates. */
extern const float PET_DECAY_PER_SEC[PET_STAT_COUNT];

/* -- queries --------------------------------------------------------------- */

pet_cat_t       *pet_active_cat(pet_game_t *g);
const pet_cat_t *pet_active_cat_const(const pet_game_t *g);
pet_stage_t      pet_stage(uint32_t xp);
const char      *pet_stage_name(pet_stage_t s);
const char      *pet_stat_name(pet_stat_t s);
uint8_t          pet_growth_percent(uint32_t xp);

/** @brief Animation the cat should be playing right now. */
pet_anim_t       pet_current_anim(const pet_cat_t *c);

/** @brief Whether an action is allowed right now, with a reason in Chinese. */
typedef enum {
    PET_OK = 0,
    PET_ERR_ROSTER_FULL,
    PET_ERR_COOLDOWN,
    PET_ERR_NO_COINS,
    PET_ERR_NOT_OWNED,
    PET_ERR_ALREADY,
    PET_ERR_BUSY,
    PET_ERR_HEALTHY,
    PET_ERR_SATED,
    PET_ERR_TIRED,
    PET_ERR_UNWELL,
    PET_ERR_IN_PROGRESS,
    PET_ERR_NOT_ENOUGH,
    PET_ERR_INVALID,
} pet_err_t;

/**
 * @brief The verdict on one action, as a code plus the wording to show.
 *
 * The code is part of the verdict because recovering it from the tables afterwards
 * is guesswork: several different refusals can share a cost or a stat, so a caller
 * that reverse-engineers the reason picks the wrong one. Reporting it here means the
 * UI and the command layer always agree on why something was refused.
 */
typedef struct {
    bool        allowed;
    pet_err_t   err;       /* PET_OK when allowed */
    const char *reason_zh; /* NULL when allowed */
} pet_action_status_t;

pet_action_status_t pet_action_check(const pet_game_t *g, pet_action_t a, uint32_t now_ms);

/** @brief Whether a goal's condition is currently met. */
bool pet_goal_progress(const pet_game_t *g, const pet_cat_t *c, int goal_index, uint32_t *out_progress);

/* -- commands -------------------------------------------------------------- */

const char *pet_err_text(pet_err_t e);

pet_err_t pet_do_action(pet_game_t *g, pet_action_t a, uint32_t now_ms);
pet_err_t pet_buy_outfit(pet_game_t *g, uint8_t outfit_index);
pet_err_t pet_equip_outfit(pet_game_t *g, uint8_t outfit_index);
pet_err_t pet_sell_item(pet_game_t *g, uint8_t item_index);
pet_err_t pet_claim_goal(pet_game_t *g, uint8_t goal_index);
pet_err_t pet_start_activity(pet_game_t *g, pet_run_t kind);
pet_err_t pet_finish_activity(pet_game_t *g);
pet_err_t pet_cancel_activity(pet_game_t *g);

/** @brief How much this cat likes a stranger; 0..100, used by the social layer. */
uint8_t pet_friendliness(const pet_cat_t *c);

/* -- persistence ----------------------------------------------------------- */

size_t pet_game_serialize(const pet_game_t *g, uint8_t *out, size_t cap);
bool   pet_game_deserialize(pet_game_t *g, const uint8_t *in, size_t len);

#ifdef __cplusplus
}
#endif
