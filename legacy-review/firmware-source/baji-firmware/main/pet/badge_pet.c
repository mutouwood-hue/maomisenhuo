#include "badge_pet.h"

#include <stdio.h>
#include <string.h>

/* ------------------------------------------------------------------ helpers --*/

static int clamp_stat(int v)
{
    if (v < 0) return 0;
    if (v > 100) return 100;
    return v;
}

static int32_t clamp_growth(int64_t v)
{
    if (v < 0) return 0;
    if (v > 1000000000) return 1000000000;
    return (int32_t)v;
}

static int32_t clamp_coins(int64_t v)
{
    if (v < -1000000) return -1000000;
    if (v > 1000000) return 1000000;
    return (int32_t)v;
}

/* The current value a refusal rule is about. `sick` and `coins` are not stats; the
 * specification's rules use all three kinds. */
static int rule_value(const badge_game_t *g, uint8_t stat)
{
    if (stat == BADGE_STAT_SICK) return g->sick ? 1 : 0;
    if (stat == BADGE_STAT_COINS) return g->coins;
    if (stat < BADGE_STAT_COUNT) return g->stat[stat];
    return 0;
}

static bool rule_holds(const badge_game_t *g, const badge_block_t *b)
{
    const int v = rule_value(g, b->stat);
    switch (b->op) {
    case BADGE_OP_GE: return v >= b->value;
    case BADGE_OP_LT: return v < b->value;
    case BADGE_OP_EQ: return v == b->value;
    default: return false;
    }
}

/* ---------------------------------------------------------------- defaults ----*/

void badge_pet_defaults(badge_game_t *game)
{
    if (!game) return;
    memset(game, 0, sizeof(*game));

    /* The reference's opening state, verbatim (吧唧渲染参考.html line 1319):
     *   stats:{food:65,mood:72,clean:68,energy:75,health:100},sick:0,coins:30,
     *   growth:86,name:'小橘',breed:'orange'
     * The stat order is the specification's own (badge_spec.json `.stats`:
     * food/mood/clean/energy/health), which is also badge_stat_t's order. */
    game->stat[BADGE_STAT_FOOD] = 65;
    game->stat[BADGE_STAT_MOOD] = 72;
    game->stat[BADGE_STAT_CLEAN] = 68;
    game->stat[BADGE_STAT_ENERGY] = 75;
    game->stat[BADGE_STAT_HEALTH] = 100;
    game->sick = false;
    game->coins = 30;
    game->growth = 86;
    game->breed = 0; /* 'orange' is palette entry 0 in cat3d (cat3d_breed_name()) */
    snprintf(game->name, sizeof(game->name), "%s", BADGE_DEFAULT_NAME);

    /* The specification's defaults for the things the settings screen writes:
     *   face        主表盘 A (face 0)
     *   guide_page  the guide opens on its first page
     *   bright      中 (level 1 of 低/中/高) -- the middle level is the one the
     *               reference's BRIGHT table makes the default
     *   wake_word   on, discover on, aod on (12.7 lists all three as enabled)
     */
    game->face = 0;
    game->guide_page = 0;
    game->bright = 1;
    game->wake_word = true;
    game->discover = true;
    game->aod = true;
}

/* ---------------------------------------------------------------- queries -----*/

int badge_pet_stage(const badge_game_t *game)
{
    int stage = 0;
    for (int i = 0; i < BADGE_STAGE_COUNT; i++) {
        if (game->growth >= (int32_t)badge_stage_growth[i]) stage = i;
    }
    return stage;
}

int32_t badge_pet_next_growth(const badge_game_t *game)
{
    const int stage = badge_pet_stage(game);
    if (stage + 1 >= BADGE_STAGE_COUNT) return (int32_t)badge_stage_growth[BADGE_STAGE_COUNT - 1];
    return (int32_t)badge_stage_growth[stage + 1];
}

const char *badge_pet_stage_name(const badge_game_t *game)
{
    const int stage = badge_pet_stage(game);
    if (stage < 0 || stage >= BADGE_STAGE_COUNT) return "";
    return badge_stage_names[stage];
}

bool badge_pet_sick(const badge_game_t *game)
{
    if (game->sick) return true;
    return game->stat[BADGE_STAT_HEALTH] < badge_numbers.low_stat;
}

int badge_pet_lowest_stat(const badge_game_t *game)
{
    int worst = -1;
    int worst_val = badge_numbers.low_stat;
    /* Ties go to the earlier stat, which is the table's order: 饱腹, 心情, 清洁,
     * 精力, 健康. The reference picks the first one it finds walking the same order. */
    for (int i = 0; i < BADGE_STAT_COUNT; i++) {
        if (game->stat[i] < worst_val) {
            worst_val = game->stat[i];
            worst = i;
        }
    }
    return worst;
}

int badge_pet_alert(const badge_game_t *game)
{
    /* The specification's alert list IS the priority order, and the reference states
     * it in a comment above the table: 不舒服 > 饱腹 > 精力 > 心情 > 清洁, each only
     * while below `lowStat`. So this walks the list in order and takes the first hit.
     *
     * It is deliberately not "the lowest stat wins". With 饱腹 at 25 and 精力 at 10 the
     * two rules disagree, and the renderer's own `currentAlert()` picks 饱腹 -- the
     * bowl. Getting this wrong is not cosmetic: the alert is a button, and it takes the
     * owner to the wrong care screen. */
    for (int i = 0; i < BADGE_ALERT_COUNT; i++) {
        const uint8_t stat = badge_alerts[i].stat;
        if (stat == BADGE_STAT_SICK) {
            if (badge_pet_sick(game)) return i;
            continue;
        }
        if (stat == BADGE_STAT_HEALTH) {
            /* The list's 健康 entry carries no wording of its own; it is the illness
             * marker, handled by the SICK branch above. */
            if (badge_pet_sick(game)) return i;
            continue;
        }
        if (stat >= BADGE_STAT_COUNT) continue;
        if (game->stat[stat] < badge_numbers.low_stat) return i;
    }
    return -1;
}

bool badge_pet_care_allowed(const badge_game_t *game, int care, uint16_t *why)
{
    if (why) *why = 0;
    if (care < 0 || care >= BADGE_CARE_COUNT_SPEC) return false;
    const badge_care_def_t *c = &badge_care_defs[care];
    for (int i = 0; i < c->block_count; i++) {
        const badge_block_t *b = &badge_blocks[c->block_first + i];
        if (rule_holds(game, b)) {
            if (why) *why = b->text;
            return false;
        }
    }
    return true;
}

/* ------------------------------------------------------------------ care ------*/

void badge_pet_care_settle(badge_game_t *game, int care)
{
    if (care < 0 || care >= BADGE_CARE_COUNT_SPEC) return;
    const badge_care_def_t *c = &badge_care_defs[care];
    game->growth = clamp_growth((int64_t)game->growth + c->growth);
    game->coins = clamp_coins((int64_t)game->coins + c->coins);
}

badge_care_outcome_t badge_pet_care_step(badge_game_t *game, int care, int step)
{
    badge_care_outcome_t out;
    memset(&out, 0, sizeof(out));
    out.result = BADGE_CARE_INVALID;
    if (care < 0 || care >= BADGE_CARE_COUNT_SPEC) return out;
    if (step < 0) return out;

    const badge_care_def_t *c = &badge_care_defs[care];
    const int steps = c->steps > 0 ? c->steps : 1;
    if (step >= steps) return out;
    out.steps = (uint8_t)steps;
    out.step = (uint8_t)(step + 1);

    uint16_t why = 0;
    if (!badge_pet_care_allowed(game, care, &why)) {
        out.result = BADGE_CARE_BLOCKED;
        out.why = why;
        return out;
    }

    /* The stat deltas land on every step... */
    for (int i = 0; i < BADGE_STAT_COUNT; i++) {
        const int8_t d = c->delta[i];
        out.delta[i] = d;
        if (d) game->stat[i] = (uint8_t)clamp_stat((int)game->stat[i] + d);
    }

    /* ...but growth and coins only on the step that finishes the action. A care
     * abandoned halfway leaves the stats moved and the growth unearned, which is what
     * the reference does and what 照料中途取消 (EVT_CARE_CANCEL) exists to report. */
    if (step + 1 >= steps) {
        badge_pet_care_settle(game, care);
        out.growth = c->growth;
        out.coins = c->coins;
        out.result = BADGE_CARE_DONE;
    } else {
        out.result = BADGE_CARE_OK;
    }
    return out;
}

/* ---------------------------------------------------------------- settings ----*/

int badge_pet_toggle(badge_game_t *game, int setting)
{
    switch (setting) {
    case BADGE_SETTING_BRIGHT:
        game->bright = (uint8_t)((game->bright + 1) % BADGE_BRIGHT_LEVELS);
        return game->bright;
    case BADGE_SETTING_WAKE:
        game->wake_word = !game->wake_word;
        return game->wake_word ? 1 : 0;
    case BADGE_SETTING_DISCOVER:
        game->discover = !game->discover;
        return game->discover ? 1 : 0;
    case BADGE_SETTING_AOD:
        game->aod = !game->aod;
        return game->aod ? 1 : 0;
    default:
        return -1;
    }
}

/* ------------------------------------------------------------------ sync ------*/

void badge_pet_sync(badge_game_t *game, const uint8_t stats[BADGE_STAT_COUNT], int32_t growth,
                    int32_t coins, bool sick)
{
    if (stats) {
        for (int i = 0; i < BADGE_STAT_COUNT; i++) {
            game->stat[i] = (uint8_t)clamp_stat(stats[i]);
        }
    }
    game->growth = clamp_growth(growth);
    game->coins = clamp_coins(coins);
    game->sick = sick;
}

/* ------------------------------------------------------------------ save ------*/

/* BADGE_PET_SAVE_BYTES is the header's, not a second copy here: the caller has to size
 * its buffer before the call, so a local definition that drifted would mean the caller's
 * buffer and this function's idea of the layout disagree -- silently, and only for the
 * fields past the truncated point. */
_Static_assert(BADGE_PET_SAVE_BYTES ==
                   (1u + BADGE_STAT_COUNT + 1u + 1u + 1u + 1u + 1u + 1u + 4u + 4u +
                    sizeof(((badge_game_t *)0)->name)),
               "BADGE_PET_SAVE_BYTES no longer matches the field layout in this file");

/* A fixed layout, written byte by byte so it does not depend on the compiler's
 * struct packing: this blob crosses a flash upgrade. */
uint32_t badge_pet_serialize(const badge_game_t *game, uint8_t *out, uint32_t cap)
{
    if (!out || cap < BADGE_PET_SAVE_BYTES) return 0;
    uint32_t n = 0;
    out[n++] = BADGE_PET_SAVE_VERSION;
    for (int i = 0; i < BADGE_STAT_COUNT; i++) out[n++] = game->stat[i];
    out[n++] = game->sick ? 1 : 0;
    out[n++] = game->face;
    out[n++] = game->guide_page;
    out[n++] = game->bright;
    out[n++] = (uint8_t)((game->wake_word ? 1 : 0) | (game->discover ? 2 : 0) |
                         (game->aod ? 4 : 0));
    out[n++] = game->breed;
    const uint32_t growth = (uint32_t)clamp_growth(game->growth);
    const int32_t coins = clamp_coins(game->coins);
    for (int i = 0; i < 4; i++) out[n++] = (uint8_t)(growth >> (8 * i));
    for (int i = 0; i < 4; i++) out[n++] = (uint8_t)((uint32_t)coins >> (8 * i));
    /* The name is UTF-8; truncating mid-sequence would produce an invalid string, so
     * it is copied byte-wise into a zeroed field and the reader trusts the field's
     * own NUL. The field is fixed, so the blob's length does not depend on the name. */
    for (int i = 0; i < (int)sizeof(game->name); i++) out[n++] = (uint8_t)game->name[i];
    return n;
}

bool badge_pet_deserialize(badge_game_t *game, const uint8_t *in, uint32_t len)
{
    /* Length is checked exactly, not as a minimum: the caller may be reading a blob
     * whose tail is a different version's, and the version byte cannot be trusted
     * until the length that version implies is known. */
    if (!in || len != BADGE_PET_SAVE_BYTES) return false;
    uint32_t n = 0;
    if (in[n++] != BADGE_PET_SAVE_VERSION) return false;
    for (int i = 0; i < BADGE_STAT_COUNT; i++) game->stat[i] = (uint8_t)clamp_stat(in[n++]);
    game->sick = in[n++] != 0;
    game->face = in[n++];
    if (game->face > 2) game->face = 0;
    game->guide_page = in[n++];
    if (game->guide_page >= BADGE_GUIDE_COUNT) game->guide_page = 0;
    game->bright = in[n++];
    if (game->bright >= BADGE_BRIGHT_LEVELS) game->bright = 1;
    const uint8_t flags = in[n++];
    game->wake_word = (flags & 1) != 0;
    game->discover = (flags & 2) != 0;
    game->aod = (flags & 4) != 0;
    game->breed = in[n++];
    if (game->breed > 5) game->breed = 0;
    uint32_t growth = 0, coins = 0;
    for (int i = 0; i < 4; i++) growth |= (uint32_t)in[n++] << (8 * i);
    for (int i = 0; i < 4; i++) coins |= (uint32_t)in[n++] << (8 * i);
    game->growth = clamp_growth((int32_t)growth);
    game->coins = clamp_coins((int32_t)coins);
    for (int i = 0; i < (int)sizeof(game->name); i++) game->name[i] = (char)in[n++];
    /* The name must be NUL-terminated whatever the flash held. */
    game->name[sizeof(game->name) - 1] = '\0';
    return true;
}
