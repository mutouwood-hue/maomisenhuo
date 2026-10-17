#include "pet_state.h"

#include <math.h>
#include <string.h>

/* ==================================================================== */
/* tables -- transcribed from the HTML prototype's own tables           */
/* ==================================================================== */

const pet_breed_info_t PET_BREEDS[PET_BREED_COUNT] = {
    {"orange",  "小橘",   0xdd8b48},
    {"silver",  "银虎斑", 0xa4abb2},
    {"tuxedo",  "奶牛猫", 0x40494e},
    {"siamese", "暹罗猫", 0xb2967c},
    {"ragdoll", "布偶猫", 0xc9bcb2},
    {"blue",    "蓝猫",   0x798fa0},
};

const pet_item_info_t PET_ITEMS[PET_ITEM_COUNT] = {
    {"fish",   "小鱼",   3},
    {"flower", "野花",   2},
    {"shell",  "贝壳",   4},
    {"star",   "星星石", 7},
};

const pet_outfit_info_t PET_OUTFITS[PET_OUTFIT_COUNT] = {
    {"bandana",  "莓莓三角巾",   12},
    {"bow",      "蝴蝶结",       18},
    {"cap",      "小鸭遮阳帽",   25},
    {"raincoat", "晴黄雨衣",     36},
    {"backpack", "探险小背包",   32},
    {"scarf",    "暖暖针织围巾", 28},
};

/*
 * The prototype computes goal progress as:
 *   first_meal -> counts.feed, sparkle -> counts.bath, explorer -> counts.climb,
 *   playmate   -> (tease>0) + (play>0), grown_up -> xp
 */
const pet_goal_info_t PET_GOALS[PET_GOAL_COUNT] = {
    {"first_meal", "第一顿小鱼干",   1,   5},
    {"sparkle",    "香香小猫",       1,   5},
    {"explorer",   "高处探险家",     1,   6},
    {"playmate",   "最佳玩伴",       2,   8},
    {"grown_up",   "陪你长大",     160,  10},
};

/*
 * Trip table, with the haul each one brings home.
 *
 * `item_gain` is not a column the prototype's activity table has; it comes from its
 * `Wf(mode)` node generator, which is what the player actually collects from. The
 * board derives progress from elapsed time rather than from walking to a node, so the
 * nodes collapse into their total: walk carries no item, explore's five nodes hold
 * flower, flower, shell, star and fish, and fishing's four nodes are all fish.
 */
const pet_activity_info_t PET_ACTIVITIES[PET_RUN_COUNT - 1] = {
    /*                                target min  xp coins  fish flower shell star */
    {PET_RUN_WALK,    "walk",    "牵绳散步", 3, 12, 6, 4, {0, 0, 0, 0}},
    {PET_RUN_EXPLORE, "explore", "自由探险", 5, 15, 8, 5, {1, 2, 1, 1}},
    {PET_RUN_FISH,    "fish",    "河岸钓鱼", 4, 15, 8, 4, {4, 0, 0, 0}},
};

const pet_activity_info_t *pet_activity_by_kind(pet_run_t kind)
{
    for (int k = 0; k < PET_RUN_COUNT - 1; k++) {
        if (PET_ACTIVITIES[k].kind == kind) return &PET_ACTIVITIES[k];
    }
    return NULL;
}

/*
 * Action table.
 *
 * Equations 1-5 (feed/bath/climb/tease/drink) come straight from the prototype's
 * `hc` table; pet and sleep are special-cased in its dispatcher and are
 * transcribed from there. play is the mini-game: the prototype scales its reward
 * by the score, and the board uses the score-8 mid-range outcome, which is the
 * value the prototype itself produces for a middling round.
 *
 *   play: mood +12+round(W*13), energy -8, food -5, xp 10+round(W*10),
 *         coins 3+round(W*9), with W = score/15. At score 8: mood +19, xp +15,
 *         coins +8. The board's mini-game therefore grants a fixed mid-range
 *         reward rather than a score-scaled one.
 *
 * The clinic is priced by the issue being treated, not by this table; its row
 * only carries the animation.
 */
const pet_action_info_t PET_ACTIONS[PET_ACT_COUNT] = {
    /*   action          id        label        food mood clean energy hp  xp  cost gain  cd   anim           blk_at blk_stat        need_e  block_reason */
    {PET_ACT_FEED,   "feed",   "喂小鱼干",      25,   3,  -2,     0,   0,   8,   3,   0, 4000, PET_ANIM_IDLE,  95, PET_STAT_FOOD,   0, "小猫已经吃饱啦，等肚子饿一点再喂。"},
    {PET_ACT_BATH,   "bath",   "泡泡澡",         0,   4,  35,    -3,   1,   8,   2,   0, 4000, PET_ANIM_PAW,   95, PET_STAT_CLEAN,  0, "小猫已经很干净啦，暂时不用洗澡。"},
    {PET_ACT_PET,    "pet",    "挠痒痒",         0,   9,   0,     0,   0,   3,   0,   0, 2000, PET_ANIM_PAW,   98, PET_STAT_MOOD,   0, "小猫现在心情超好，可以陪它做点别的。"},
    /* play also costs food: the prototype's mini-game subtracts 5. Leaving that out
     * made the mini-game strictly better than every other action. */
    {PET_ACT_PLAY,   "play",   "接鱼游戏",      -5,  19,   0,    -8,   0,  15,   0,   8, 4000, PET_ANIM_PAW,    0, 0,               1, NULL},    {PET_ACT_SLEEP,  "sleep",  "睡个小觉",      -4,   0,   0,    35,   2,   6,   0,   0, 4000, PET_ANIM_IDLE,  95, PET_STAT_ENERGY, 0, "小猫精神满满，暂时还不困。"},
    {PET_ACT_CLIMB,  "climb",  "爬猫爬架",      -3,  12,   0,    -6,   0,  10,   0,   0, 4000, PET_ANIM_PAW,    0, 0,               1, NULL},
    {PET_ACT_TEASE,  "tease",  "逗猫棒",        -3,  12,   0,    -5,   0,   8,   0,   0, 4000, PET_ANIM_PAW,    0, 0,               1, NULL},
    {PET_ACT_DRINK,  "drink",  "喝水",           0,   3,   0,     6,   0,   4,   0,   0, 4000, PET_ANIM_IDLE,   0, 0,               0, NULL},
    {PET_ACT_CLINIC, "clinic", "去诊所",         0,   3,   0,     0,   0,   3,   0,   0, 4000, PET_ANIM_IDLE,   0, 0,               0, NULL},
};

/* The prototype's `K = {food:.006, mood:.004, clean:.003, energy:.004}`. */
const float PET_DECAY_PER_SEC[PET_STAT_COUNT] = {0.006f, 0.004f, 0.003f, 0.004f};

/*
 * Clinic fees, from the prototype: 8 喵币 to treat an illness, 4 for a wellness
 * check. Treating illness also restores far more health, which is the reason the
 * fee differs.
 */
static const uint16_t CLINIC_COST[PET_ISSUE_TUMMY + 1] = {4, 8, 8};
static const uint8_t  CLINIC_HEALTH_GAIN[PET_ISSUE_TUMMY + 1] = {8, 30, 30};

/* ==================================================================== */
/* small helpers                                                        */
/* ==================================================================== */

/* The prototype's Si(value, 0, 100). */
static inline uint8_t clamp_stat(float v)
{
    if (v < 0.0f) return 0;
    if (v > 100.0f) return 100;
    return (uint8_t)(v + 0.5f);
}

static void apply_changes(pet_cat_t *c, const pet_action_info_t *a)
{
    c->stats[PET_STAT_FOOD]   = clamp_stat((float)c->stats[PET_STAT_FOOD]   + a->d_food);
    c->stats[PET_STAT_MOOD]   = clamp_stat((float)c->stats[PET_STAT_MOOD]   + a->d_mood);
    c->stats[PET_STAT_CLEAN]  = clamp_stat((float)c->stats[PET_STAT_CLEAN]  + a->d_clean);
    c->stats[PET_STAT_ENERGY] = clamp_stat((float)c->stats[PET_STAT_ENERGY] + a->d_energy);
    if (a->d_health) {
        c->health = clamp_stat((float)c->health + a->d_health);
    }
}

static void add_xp(pet_cat_t *c, uint32_t xp)
{
    const uint32_t v = c->xp + xp;
    c->xp = v > PET_XP_MAX ? PET_XP_MAX : v;
}

static void add_coins(pet_game_t *g, int32_t delta)
{
    const int64_t v = (int64_t)g->coins + delta;
    if (v < 0) g->coins = 0;
    else if (v > (int64_t)PET_COIN_MAX) g->coins = PET_COIN_MAX;
    else g->coins = (uint32_t)v;
}

/* ==================================================================== */
/* lifecycle                                                            */
/* ==================================================================== */

static void cat_init(pet_cat_t *c, const char *name, pet_breed_t breed, uint32_t now_s)
{
    memset(c, 0, sizeof(*c));
    if (name && name[0]) {
        strncpy(c->name, name, PET_NAME_MAX);
        c->name[PET_NAME_MAX] = '\0';
    } else {
        strcpy(c->name, "小橘");
    }
    c->breed = (uint8_t)breed;
    c->outfit = 0xFF; /* none */
    /* The prototype's fresh-cat stats: food 65, mood 72, clean 68, energy 75. */
    c->stats[PET_STAT_FOOD] = 65;
    c->stats[PET_STAT_MOOD] = 72;
    c->stats[PET_STAT_CLEAN] = 68;
    c->stats[PET_STAT_ENERGY] = 75;
    c->health = 100;
    c->issue = PET_ISSUE_NONE;
    c->born_at = now_s;
}

void pet_game_init(pet_game_t *g)
{
    if (!g) return;
    memset(g, 0, sizeof(*g));
    g->version = 2; /* matches the prototype's current save version */
    g->cat_count = 1;
    g->active = 0;
    g->coins = PET_COIN_START; /* the prototype hands out 30 喵币 */
    cat_init(&g->cats[0], "小橘", PET_BREED_ORANGE, 0);
}

void pet_game_seed_demo(pet_game_t *g)
{
    pet_game_init(g);
    g->coins = 120;
    g->wardrobe = 1u << 0; /* bandana owned */
    g->cats[0].outfit = 0;
    g->cats[0].xp = 72; /* young */
    g->cats[0].stats[PET_STAT_MOOD] = 96;
    g->inventory[0] = 3;
    g->inventory[1] = 1;
}

int pet_game_add_cat(pet_game_t *g, const char *name, pet_breed_t breed)
{
    if (!g || g->cat_count >= PET_MAX_CATS) return -1;
    if (breed < 0 || breed >= PET_BREED_COUNT) return -1;
    const int idx = g->cat_count;
    cat_init(&g->cats[idx], name, breed, 0);
    g->cat_count++;
    return idx;
}

/* ==================================================================== */
/* simulation                                                           */
/* ==================================================================== */

void pet_game_update(pet_game_t *g, uint32_t now_ms)
{
    if (!g || g->cat_count == 0) return;

    if (g->last_update_ms == 0) {
        g->last_update_ms = now_ms;
        return;
    }

    const uint32_t delta_ms = now_ms - g->last_update_ms;
    if (delta_ms == 0) return;
    g->last_update_ms = now_ms;

    /*
     * The prototype clamps its step twice: the interval handler passes at most 2 s
     * and the reducer caps at 30 s. Clamping means a device that was asleep for an
     * hour comes back to a hungry cat rather than a dead one, and it stops the
     * simulation from racing through hundreds of transitions in a single call.
     */
    float dt_s = (float)delta_ms / 1000.0f;
    if (dt_s > 30.0f) dt_s = 30.0f;

    pet_cat_t *c = pet_active_cat(g);
    if (!c) return;

    /*
     * Only the cat on screen decays. That is the prototype's behaviour, and it is
     * the reason the household's other cats can be left alone for a long time
     * without punishment.
     *
     * The decay rate is a fraction of a point per second, so it is accumulated in
     * `decay_frac` and only whole points are removed from the stat. Subtracting the
     * fraction straight into the integer stat would round back to the same value on
     * every tick -- at 20 Hz that is 0.0003 of a point per tick -- and the cat would
     * never get hungry at all, which is exactly the bug this carry exists to avoid.
     *
     * Note that health is deliberately NOT touched here: the prototype starts every
     * cat at 100 and never decrements it. Health only moves through care actions
     * (bath +1, sleep +2) and the clinic (+30 when treating an illness, +8 for a
     * wellness check). Making sickness drain health would be a rule this game does
     * not have.
     */
    for (int s = 0; s < PET_STAT_COUNT; s++) {
        float lose = PET_DECAY_PER_SEC[s] * dt_s + g->decay_frac[s];
        const float whole = (float)(int)lose;
        g->decay_frac[s] = lose - whole;
        if (whole > 0.0f) {
            const float left = (float)c->stats[s] - whole;
            c->stats[s] = left > 0.0f ? (uint8_t)left : 0;
            /* At zero there is nothing left to hold back. */
            if (c->stats[s] == 0) g->decay_frac[s] = 0.0f;
        }
    }

    /*
     * An outdoor trip advances while its owner keeps the cat out. Progress is
     * derived from elapsed time rather than from the prototype's per-node pickups,
     * because the board has no explorable scene; the checkpoints are spread evenly
     * across the activity's required duration.
     */
    if (c->running != PET_RUN_NONE && c->issue == PET_ISSUE_NONE) {
        const pet_activity_info_t *ai = pet_activity_by_kind((pet_run_t)c->running);

        uint32_t have = (uint32_t)c->run_seconds + (uint32_t)dt_s;
        const uint32_t want = c->run_target;
        if (have > want) have = want;
        c->run_seconds = (uint16_t)have;

        if (ai && ai->target > 0 && want > 0) {
            uint32_t prog = (have * ai->target) / want;
            if (prog > ai->target) prog = ai->target;
            c->run_progress = (uint16_t)prog;
        }
    }
}

/* ==================================================================== */
/* queries                                                              */
/* ==================================================================== */

pet_cat_t *pet_active_cat(pet_game_t *g)
{
    if (!g || g->cat_count == 0) return NULL;
    if (g->active >= g->cat_count) g->active = 0;
    return &g->cats[g->active];
}

const pet_cat_t *pet_active_cat_const(const pet_game_t *g)
{
    if (!g || g->cat_count == 0) return NULL;
    const uint8_t idx = g->active < g->cat_count ? g->active : 0;
    return &g->cats[idx];
}

pet_stage_t pet_stage(uint32_t xp)
{
    if (xp >= 160u) return PET_STAGE_ADULT;
    if (xp >= 60u) return PET_STAGE_YOUNG;
    return PET_STAGE_KITTEN;
}

const char *pet_stage_name(pet_stage_t s)
{
    switch (s) {
        case PET_STAGE_KITTEN: return "幼猫";
        case PET_STAGE_YOUNG:  return "少年猫";
        case PET_STAGE_ADULT:  return "成年猫";
        default:               return "?";
    }
}

uint8_t pet_growth_percent(uint32_t xp)
{
    /* Mirrors the prototype's growthProgress for each stage. */
    if (xp >= 160u) return 100;
    if (xp >= 60u) return (uint8_t)(xp - 60u);
    return (uint8_t)((xp * 100u) / 60u);
}

const char *pet_stat_name(pet_stat_t s)
{
    switch (s) {
        case PET_STAT_FOOD:   return "饱食";
        case PET_STAT_MOOD:   return "心情";
        case PET_STAT_CLEAN:  return "清洁";
        case PET_STAT_ENERGY: return "精力";
        default:              return "?";
    }
}

const char *pet_err_text(pet_err_t e)
{
    switch (e) {
        case PET_OK:              return "好耶！";
        case PET_ERR_ROSTER_FULL: return "家里已经住满六只小猫啦。";
        case PET_ERR_COOLDOWN:    return "让小猫缓一缓，稍等一下再来吧。";
        case PET_ERR_NO_COINS:    return "喵币不够啦，去户外找些收获吧。";
        case PET_ERR_NOT_OWNED:   return "还没有这件服装。";
        case PET_ERR_ALREADY:     return "已经拥有这件服装啦。";
        case PET_ERR_BUSY:        return "小猫正在忙，先完成当前的事吧。";
        /* Not reachable from the clinic: the prototype lets a healthy cat have a
         * wellness check for 4 喵币. Kept for future issues that a care action
         * might legitimately refuse to treat. */
        case PET_ERR_HEALTHY:     return "小猫现在很健康，不需要看医生。";
        case PET_ERR_SATED:       return "小猫已经吃饱啦，等肚子饿一点再喂。";
        case PET_ERR_TIRED:       return "小猫有点累了，先让它睡个小觉吧。";
        case PET_ERR_UNWELL:      return "小猫有点不舒服，先去诊所检查吧。";
        case PET_ERR_IN_PROGRESS: return "小猫还在户外，先完成活动或一起回家吧。";
        case PET_ERR_NOT_ENOUGH:  return "还没有达到完成条件。";
        default:                  return "现在还不能这么做。";
    }
}

pet_anim_t pet_current_anim(const pet_cat_t *c)
{
    if (!c) return PET_ANIM_IDLE;
    if (c->running != PET_RUN_NONE && c->running != PET_RUN_FISH) {
        return PET_ANIM_WALK; /* walking/exploring reads as motion */
    }
    /* Low energy reads as a slow, settled idle rather than a playful pose. */
    if (c->stats[PET_STAT_ENERGY] < 20) return PET_ANIM_IDLE;
    if (c->stats[PET_STAT_MOOD] > 80) return PET_ANIM_PAW;
    return PET_ANIM_IDLE;
}

/* Build a refusal verdict with its own wording. */
static pet_action_status_t refuse(pet_err_t err)
{
    pet_action_status_t r = {.allowed = false, .err = err, .reason_zh = pet_err_text(err)};
    return r;
}

/* Build a refusal verdict with a rule-specific sentence. */
static pet_action_status_t refuse_custom(pet_err_t err, const char *why)
{
    pet_action_status_t r = {.allowed = false, .err = err, .reason_zh = why};
    return r;
}

pet_action_status_t pet_action_check(const pet_game_t *g, pet_action_t a, uint32_t now_ms)
{
    pet_action_status_t r = {.allowed = true, .err = PET_OK, .reason_zh = NULL};
    if (!g || a < 0 || a >= PET_ACT_COUNT || g->cat_count == 0) {
        return refuse(PET_ERR_INVALID);
    }

    const pet_cat_t *c = pet_active_cat_const(g);
    if (!c) return refuse(PET_ERR_INVALID);
    const pet_action_info_t *info = &PET_ACTIONS[a];

    /* Only one thing at a time, exactly like the prototype's modal guard. */
    if (c->running != PET_RUN_NONE) return refuse(PET_ERR_IN_PROGRESS);

    /*
     * Cooldown first: waiting is the reason the player is most likely to hit, and it
     * is the one refusal that is not the cat's fault, so it takes precedence over a
     * threshold that may also be satisfied.
     */
    const uint32_t idx = (uint32_t)(c - g->cats);
    const uint32_t until = g->cooldown_until_ms[idx][a];
    if (until != 0 && (int32_t)(now_ms - until) < 0) return refuse(PET_ERR_COOLDOWN);

    /*
     * A threshold says "the cat does not need this right now"; the price says "you
     * cannot afford it". The prototype checks the cat first, and its own wording is
     * about the cat, so that is the order used here -- a player with no coins and a
     * full cat is told the cat is full.
     */
    if (info->block_at != 0 && c->stats[info->block_stat] >= info->block_at) {
        return refuse_custom(PET_ERR_SATED,
                             info->block_reason_zh ? info->block_reason_zh
                                                   : pet_err_text(PET_ERR_SATED));
    }

    /*
     * The clinic's price depends on whether the cat is actually ill, so it cannot be
     * read off the table. This is the only gate the clinic has: being healthy is not
     * a refusal, it just changes the fee (4 for a check-up, 8 for treatment).
     */
    const uint16_t cost = (a == PET_ACT_CLINIC) ? CLINIC_COST[c->issue] : info->coin_cost;
    if (g->coins < cost) return refuse(PET_ERR_NO_COINS);

    if (info->needs_energy && c->stats[PET_STAT_ENERGY] < 10) return refuse(PET_ERR_TIRED);

    /* Strenuous play is off the table while the cat is unwell. */
    if ((a == PET_ACT_CLIMB || a == PET_ACT_TEASE) && c->issue != PET_ISSUE_NONE) {
        return refuse_custom(PET_ERR_UNWELL,
                             "小猫有点不舒服，先去诊所检查，再陪小猫剧烈运动吧。");
    }

    return r;
}

bool pet_goal_progress(const pet_game_t *g, const pet_cat_t *c, int goal_index, uint32_t *out_progress)
{
    if (!g || !c || goal_index < 0 || goal_index >= PET_GOAL_COUNT) return false;
    uint32_t p = 0;
    switch (goal_index) {
        case 0: p = c->counts[PET_ACT_FEED]; break;
        case 1: p = c->counts[PET_ACT_BATH]; break;
        case 2: p = c->counts[PET_ACT_CLIMB]; break;
        case 3: p = (c->counts[PET_ACT_TEASE] > 0 ? 1u : 0u) + (c->counts[PET_ACT_PLAY] > 0 ? 1u : 0u); break;
        case 4: p = c->xp; break;
        default: break;
    }
    if (out_progress) *out_progress = p;
    return p >= PET_GOALS[goal_index].target;
}

/* ==================================================================== */
/* commands                                                             */
/* ==================================================================== */

static void set_cooldown(pet_game_t *g, const pet_cat_t *c, pet_action_t a, uint32_t now_ms)
{
    const uint32_t idx = (uint32_t)(c - g->cats);
    g->cooldown_until_ms[idx][a] = now_ms + PET_ACTIONS[a].cooldown_ms;
}

pet_err_t pet_do_action(pet_game_t *g, pet_action_t a, uint32_t now_ms)
{
    if (!g || a < 0 || a >= PET_ACT_COUNT) return PET_ERR_INVALID;

    /* The verdict already carries the reason, so it is not reconstructed here:
     * several refusals share a cost or a stat, and guessing between them produced
     * wrong answers (a cooldown reported as a full stomach, and so on). */
    const pet_action_status_t st = pet_action_check(g, a, now_ms);
    if (!st.allowed) return st.err;

    pet_cat_t *c = pet_active_cat(g);
    const pet_action_info_t *info = &PET_ACTIONS[a];

    if (a == PET_ACT_CLINIC) {
        /* Read the fee and the cure from the issue as it stands: clearing it first
         * would make the cat look healthy to the very lookup that treats it. */
        const uint8_t issue = c->issue;
        const uint16_t fee = CLINIC_COST[issue];
        if (g->coins < fee) return PET_ERR_NO_COINS;

        add_coins(g, -(int32_t)fee);
        c->issue = PET_ISSUE_NONE;
        /* Treating an illness restores much more health than a wellness check. */
        c->health = clamp_stat((float)c->health + CLINIC_HEALTH_GAIN[issue]);
        apply_changes(c, info); /* mood +3 */
        add_xp(c, info->xp);
        set_cooldown(g, c, a, now_ms);
        return PET_OK;
    }

    if (g->coins < info->coin_cost) return PET_ERR_NO_COINS;
    add_coins(g, -(int32_t)info->coin_cost);
    apply_changes(c, info);
    add_xp(c, info->xp);
    if (info->coin_gain) add_coins(g, (int32_t)info->coin_gain);
    c->counts[a]++;
    set_cooldown(g, c, a, now_ms);
    return PET_OK;
}

pet_err_t pet_buy_outfit(pet_game_t *g, uint8_t outfit_index)
{
    if (!g || outfit_index >= PET_OUTFIT_COUNT) return PET_ERR_INVALID;
    const uint16_t bit = (uint16_t)(1u << outfit_index);
    if (g->wardrobe & bit) return PET_ERR_ALREADY;
    if (g->coins < PET_OUTFITS[outfit_index].price) return PET_ERR_NO_COINS;
    add_coins(g, -(int32_t)PET_OUTFITS[outfit_index].price);
    g->wardrobe |= bit;
    return PET_OK;
}

pet_err_t pet_equip_outfit(pet_game_t *g, uint8_t outfit_index)
{
    if (!g) return PET_ERR_INVALID;
    pet_cat_t *c = pet_active_cat(g);
    if (!c) return PET_ERR_INVALID;

    if (outfit_index == 0xFF) {
        c->outfit = 0xFF; /* take everything off */
        return PET_OK;
    }
    if (outfit_index >= PET_OUTFIT_COUNT) return PET_ERR_INVALID;
    if (!(g->wardrobe & (uint16_t)(1u << outfit_index))) return PET_ERR_NOT_OWNED;
    c->outfit = outfit_index;
    return PET_OK;
}

pet_err_t pet_sell_item(pet_game_t *g, uint8_t item_index)
{
    if (!g || item_index >= PET_ITEM_COUNT) return PET_ERR_INVALID;
    if (g->inventory[item_index] == 0) return PET_ERR_NOT_ENOUGH;
    g->inventory[item_index]--;
    add_coins(g, (int32_t)PET_ITEMS[item_index].sell_price);
    return PET_OK;
}

pet_err_t pet_claim_goal(pet_game_t *g, uint8_t goal_index)
{
    if (!g || goal_index >= PET_GOAL_COUNT) return PET_ERR_INVALID;
    pet_cat_t *c = pet_active_cat(g);
    if (!c) return PET_ERR_INVALID;
    const uint16_t bit = (uint16_t)(1u << goal_index);
    if (c->goals_claimed & bit) return PET_ERR_ALREADY;
    if (!pet_goal_progress(g, c, goal_index, NULL)) return PET_ERR_NOT_ENOUGH;
    c->goals_claimed |= bit;
    add_coins(g, (int32_t)PET_GOALS[goal_index].reward_coins);
    return PET_OK;
}

pet_err_t pet_start_activity(pet_game_t *g, pet_run_t kind)
{
    if (!g || kind <= PET_RUN_NONE || kind >= PET_RUN_COUNT) return PET_ERR_INVALID;
    pet_cat_t *c = pet_active_cat(g);
    if (!c) return PET_ERR_INVALID;
    if (c->running != PET_RUN_NONE) return PET_ERR_IN_PROGRESS;
    if (c->issue != PET_ISSUE_NONE) return PET_ERR_UNWELL;
    /* Going outside is the most tiring thing in the game, so it has a higher
     * energy floor than the indoor play actions. */
    if (c->stats[PET_STAT_ENERGY] < PET_ACTIVITY_MIN_ENERGY) return PET_ERR_TIRED;

    const pet_activity_info_t *ai = pet_activity_by_kind(kind);
    if (!ai) return PET_ERR_INVALID;

    c->running = (uint8_t)kind;
    c->run_seconds = 0;
    c->run_progress = 0;
    c->run_target = (uint8_t)ai->min_seconds;
    return PET_OK;
}

pet_err_t pet_finish_activity(pet_game_t *g)
{
    if (!g) return PET_ERR_INVALID;
    pet_cat_t *c = pet_active_cat(g);
    if (!c || c->running == PET_RUN_NONE) return PET_ERR_INVALID;

    const pet_activity_info_t *ai = pet_activity_by_kind((pet_run_t)c->running);
    if (!ai) { c->running = PET_RUN_NONE; return PET_ERR_INVALID; }

    /* Settlement needs both the checkpoints and the minimum time on the clock. */
    if (c->run_progress < ai->target) return PET_ERR_NOT_ENOUGH;
    if (c->run_seconds < ai->min_seconds) return PET_ERR_NOT_ENOUGH;

    add_xp(c, ai->xp);
    add_coins(g, (int32_t)ai->coins);

    /*
     * The haul goes into the backpack.
     *
     * This is the only place the inventory is ever filled outside the demo seed, and
     * it is the missing half of the prototype's settle step: `he()` folds the trip's
     * collected nodes into `o.inventory`, one per item, capped at 1e5. The cap applied
     * here is `PET_ITEM_MAX` (65535) instead, because the board's slot is a uint16_t
     * and 1e5 would wrap rather than clamp -- see pet_state.h. Its node table
     * is folded into `ai->item_gain` (see PET_ACTIVITIES), so the two agree by
     * construction rather than by the player retracing the same walk.
     */
    for (int i = 0; i < PET_ITEM_COUNT; i++) {
        if (ai->item_gain[i] == 0) continue;
        const uint32_t v = (uint32_t)g->inventory[i] + ai->item_gain[i];
        g->inventory[i] = v > PET_ITEM_MAX ? (uint16_t)PET_ITEM_MAX : (uint16_t)v;
    }

    /*
     * Settling a trip always costs energy — more for exploring and fishing than for
     * a walk around the block — and leaves the cat a little hungry but pleased.
     */
    const int8_t energy_cost = (c->running == PET_RUN_WALK) ? -4 : -6;
    c->stats[PET_STAT_ENERGY] = clamp_stat((float)c->stats[PET_STAT_ENERGY] + energy_cost);
    c->stats[PET_STAT_FOOD]   = clamp_stat((float)c->stats[PET_STAT_FOOD] - 3.0f);
    c->stats[PET_STAT_MOOD]   = clamp_stat((float)c->stats[PET_STAT_MOOD] + 9.0f);

    c->running = PET_RUN_NONE;
    c->run_seconds = 0;
    c->run_progress = 0;
    c->run_target = 0;
    return PET_OK;
}

pet_err_t pet_cancel_activity(pet_game_t *g)
{
    if (!g) return PET_ERR_INVALID;
    pet_cat_t *c = pet_active_cat(g);
    if (!c || c->running == PET_RUN_NONE) return PET_ERR_INVALID;
    c->running = PET_RUN_NONE;
    c->run_seconds = 0;
    c->run_progress = 0;
    c->run_target = 0;
    return PET_OK;
}

uint8_t pet_friendliness(const pet_cat_t *c)
{
    if (!c) return 0;
    /* A well-cared-for cat is a good host; an unwell or glum one is not. */
    const int mood = c->stats[PET_STAT_MOOD];
    const int clean = c->stats[PET_STAT_CLEAN];
    int v = (mood * 2 + clean) / 3;
    if (c->issue != PET_ISSUE_NONE) v -= 25;
    v += (int)pet_stage(c->xp) * 5;
    if (v < 0) v = 0;
    if (v > 100) v = 100;
    return (uint8_t)v;
}

/* ==================================================================== */
/* persistence                                                          */
/* ==================================================================== */

/*
 * Compact little-endian format. It is version-stamped and self-describing enough
 * that a future version can migrate: the magic identifies a pet save, the version
 * says how to read the rest. Sizes are explicit, so this is not a struct dump and
 * will not silently change with compiler padding.
 */
#define PET_SAVE_MAGIC   0x53455450u /* "PETS" */
#define PET_SAVE_VERSION 2u

typedef struct {
    uint8_t *p;
    uint8_t *end;
} writer_t;

static bool w_u8(writer_t *w, uint8_t v)
{
    if (w->p + 1 > w->end) return false;
    *w->p++ = v;
    return true;
}

static bool w_u16(writer_t *w, uint16_t v)
{
    if (w->p + 2 > w->end) return false;
    w->p[0] = (uint8_t)(v & 0xFF);
    w->p[1] = (uint8_t)(v >> 8);
    w->p += 2;
    return true;
}

static bool w_u32(writer_t *w, uint32_t v)
{
    if (w->p + 4 > w->end) return false;
    w->p[0] = (uint8_t)(v & 0xFF);
    w->p[1] = (uint8_t)((v >> 8) & 0xFF);
    w->p[2] = (uint8_t)((v >> 16) & 0xFF);
    w->p[3] = (uint8_t)((v >> 24) & 0xFF);
    w->p += 4;
    return true;
}

static bool w_bytes(writer_t *w, const void *src, size_t n)
{
    if (w->p + n > w->end) return false;
    memcpy(w->p, src, n);
    w->p += n;
    return true;
}

typedef struct {
    const uint8_t *p;
    const uint8_t *end;
} reader_t;

static bool r_u8(reader_t *r, uint8_t *out)
{
    if (r->p + 1 > r->end) return false;
    *out = *r->p++;
    return true;
}

static bool r_u16(reader_t *r, uint16_t *out)
{
    if (r->p + 2 > r->end) return false;
    *out = (uint16_t)(r->p[0] | (r->p[1] << 8));
    r->p += 2;
    return true;
}

static bool r_u32(reader_t *r, uint32_t *out)
{
    if (r->p + 4 > r->end) return false;
    *out = (uint32_t)r->p[0] | ((uint32_t)r->p[1] << 8) | ((uint32_t)r->p[2] << 16) | ((uint32_t)r->p[3] << 24);
    r->p += 4;
    return true;
}

static bool r_bytes(reader_t *r, void *dst, size_t n)
{
    if (r->p + n > r->end) return false;
    memcpy(dst, r->p, n);
    r->p += n;
    return true;
}

size_t pet_game_serialize(const pet_game_t *g, uint8_t *out, size_t cap)
{
    if (!g || !out || cap == 0) return 0;
    writer_t w = {.p = out, .end = out + cap};

    if (!w_u32(&w, PET_SAVE_MAGIC)) return 0;
    if (!w_u16(&w, PET_SAVE_VERSION)) return 0;
    if (!w_u8(&w, g->cat_count) || !w_u8(&w, g->active)) return 0;
    if (!w_u32(&w, g->coins)) return 0;
    if (!w_u16(&w, g->wardrobe)) return 0;

    for (int i = 0; i < PET_ITEM_COUNT; i++) {
        if (!w_u16(&w, g->inventory[i])) return 0;
    }

    for (int i = 0; i < g->cat_count && i < PET_MAX_CATS; i++) {
        const pet_cat_t *c = &g->cats[i];
        if (!w_bytes(&w, c->name, PET_NAME_MAX + 1)) return 0;
        if (!w_u8(&w, c->breed) || !w_u8(&w, c->outfit)) return 0;
        for (int s = 0; s < PET_STAT_COUNT; s++) {
            if (!w_u8(&w, c->stats[s])) return 0;
        }
        if (!w_u8(&w, c->health) || !w_u8(&w, c->issue)) return 0;
        if (!w_u32(&w, c->xp)) return 0;
        if (!w_u32(&w, c->born_at)) return 0;
        for (int a = 0; a < PET_ACT_COUNT; a++) {
            if (!w_u32(&w, c->counts[a])) return 0;
        }
        if (!w_u16(&w, c->goals_claimed)) return 0;
        if (!w_u8(&w, c->running) || !w_u16(&w, c->run_seconds) ||
            !w_u8(&w, c->run_target) || !w_u16(&w, c->run_progress)) return 0;
    }

    return (size_t)(w.p - out);
}

bool pet_game_deserialize(pet_game_t *g, const uint8_t *in, size_t len)
{
    if (!g || !in || len < 10) return false;

    /* Preserve the runtime-only fields across a load. */
    const uint32_t keep_last = g->last_update_ms;
    const uint16_t keep_goals = g->goals_unlocked;

    reader_t r = {.p = in, .end = in + len};
    uint32_t magic = 0;
    uint16_t version = 0;

    if (!r_u32(&r, &magic) || magic != PET_SAVE_MAGIC) return false;
    if (!r_u16(&r, &version) || version != PET_SAVE_VERSION) return false;

    pet_game_t tmp;
    memset(&tmp, 0, sizeof(tmp));
    tmp.version = (uint8_t)version;

    if (!r_u8(&r, &tmp.cat_count) || !r_u8(&r, &tmp.active)) return false;
    if (tmp.cat_count == 0 || tmp.cat_count > PET_MAX_CATS) return false;
    if (!r_u32(&r, &tmp.coins)) return false;
    if (!r_u16(&r, &tmp.wardrobe)) return false;
    if (tmp.coins > 1000000u) return false;

    for (int i = 0; i < PET_ITEM_COUNT; i++) {
        if (!r_u16(&r, &tmp.inventory[i])) return false;
    }

    for (int i = 0; i < tmp.cat_count; i++) {
        pet_cat_t *c = &tmp.cats[i];
        if (!r_bytes(&r, c->name, PET_NAME_MAX + 1)) return false;
        c->name[PET_NAME_MAX] = '\0';
        if (!r_u8(&r, &c->breed) || !r_u8(&r, &c->outfit)) return false;
        if (c->breed >= PET_BREED_COUNT) return false;
        if (c->outfit >= PET_OUTFIT_COUNT && c->outfit != 0xFF) return false;
        for (int s = 0; s < PET_STAT_COUNT; s++) {
            if (!r_u8(&r, &c->stats[s])) return false;
            if (c->stats[s] > 100) return false;
        }
        if (!r_u8(&r, &c->health) || !r_u8(&r, &c->issue)) return false;
        if (c->health > 100) return false;
        if (c->issue > PET_ISSUE_TUMMY) return false;
        if (!r_u32(&r, &c->xp)) return false;
        if (!r_u32(&r, &c->born_at)) return false;
        for (int a = 0; a < PET_ACT_COUNT; a++) {
            if (!r_u32(&r, &c->counts[a])) return false;
        }
        if (!r_u16(&r, &c->goals_claimed)) return false;
        if (c->goals_claimed & ~((1u << PET_GOAL_COUNT) - 1u)) return false;
        if (!r_u8(&r, &c->running) || !r_u16(&r, &c->run_seconds) ||
            !r_u8(&r, &c->run_target) || !r_u16(&r, &c->run_progress)) return false;
        if (c->running >= PET_RUN_COUNT) return false;
    }

    if (tmp.active >= tmp.cat_count) tmp.active = 0;
    tmp.last_update_ms = keep_last;
    tmp.goals_unlocked = keep_goals;
    *g = tmp;
    return true;
}
