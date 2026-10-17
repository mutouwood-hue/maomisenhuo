#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define BJ_RHYTHM_MIN_TAPS 4u
#define BJ_RHYTHM_MAX_TAPS 8u
#define BJ_RHYTHM_FINISH_MS 1200u
#define BJ_SOCIAL_WINDOW_MS 15000u
#define BJ_RHYTHM_FOLLOW_MS 5000u
#define BJ_PATTERN_POINTS 9u
#define BJ_PATTERN_MIN_LENGTH 4u
#define BJ_PATTERN_MAX_LENGTH 32u

typedef enum { BJ_RHYTHM_RELATIVE_INTERVAL, BJ_RHYTHM_ABSOLUTE_SHARE } bj_rhythm_error_t;
typedef struct { uint16_t interval_percent, total_percent; bj_rhythm_error_t error_mode; } bj_rhythm_rules_t;
typedef struct { uint32_t taps[BJ_RHYTHM_MAX_TAPS]; uint8_t count; bool invalid; } bj_rhythm_t;
/** PRD归一间隔误差语义未完全定案；默认保守采用相对参考间隔15%，不当作产品最终规则。 */
bj_rhythm_rules_t bj_rhythm_initial_rules(void);
bool bj_rhythm_tap(bj_rhythm_t *, uint32_t);
bool bj_rhythm_finished(const bj_rhythm_t *, uint32_t);
bool bj_rhythm_match(const bj_rhythm_t *, const bj_rhythm_t *, const bj_rhythm_rules_t *);
bool bj_pattern_match(const uint8_t *, size_t, const uint8_t *, size_t);

typedef struct {
    bool enabled, calibrated, same_time, near, is_friend, pair_already_counted;
    int16_t self_deviation_cdeg, peer_deviation_cdeg;
    uint32_t time_ms;
} bj_fate_sample_t;
typedef struct { uint16_t min_deviation_cdeg, max_difference_cdeg; uint32_t hold_ms, max_gap_ms; } bj_fate_rules_t;
typedef struct { bool tracking, fired; uint32_t started_ms, last_ms; } bj_fate_t;
/** 仅接受已标定、已对时的倾斜差值；不能把加速度mg或RSSI当作倾斜角与可信近场证明。 */
bool bj_fate_update(bj_fate_t *, const bj_fate_sample_t *, const bj_fate_rules_t *);
