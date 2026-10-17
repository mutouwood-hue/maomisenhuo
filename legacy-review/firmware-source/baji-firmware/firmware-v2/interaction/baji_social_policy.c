#include "baji_social_policy.h"
#include <limits.h>

bj_rhythm_rules_t bj_rhythm_initial_rules(void) {
    return (bj_rhythm_rules_t){.interval_percent=15,.total_percent=30,.error_mode=BJ_RHYTHM_RELATIVE_INTERVAL};
}
bool bj_rhythm_tap(bj_rhythm_t *rhythm,uint32_t now) {
    if(!rhythm || rhythm->invalid) return false;
    if(rhythm->count>=BJ_RHYTHM_MAX_TAPS) {rhythm->invalid=true;return false;}
    if(rhythm->count && (now-rhythm->taps[rhythm->count-1]==0 || now-rhythm->taps[rhythm->count-1]>=BJ_RHYTHM_FINISH_MS)) {
        rhythm->invalid=true;return false;
    }
    rhythm->taps[rhythm->count++]=now;return true;
}
bool bj_rhythm_finished(const bj_rhythm_t *rhythm,uint32_t now) {
    return rhythm && !rhythm->invalid && rhythm->count>=BJ_RHYTHM_MIN_TAPS &&
        now-rhythm->taps[rhythm->count-1]>=BJ_RHYTHM_FINISH_MS;
}
static uint64_t difference(uint64_t first,uint64_t second) {return first>second?first-second:second-first;}
bool bj_rhythm_match(const bj_rhythm_t *reference,const bj_rhythm_t *follow,const bj_rhythm_rules_t *rules) {
    if(!reference || !follow || !rules || reference->invalid || follow->invalid || reference->count!=follow->count ||
       reference->count<BJ_RHYTHM_MIN_TAPS || reference->count>BJ_RHYTHM_MAX_TAPS ||
       rules->interval_percent>100 || rules->total_percent>100 || rules->error_mode>BJ_RHYTHM_ABSOLUTE_SHARE) return false;
    uint32_t reference_total=reference->taps[reference->count-1]-reference->taps[0];
    uint32_t follow_total=follow->taps[follow->count-1]-follow->taps[0];
    if(!reference_total || !follow_total || reference_total>=BJ_SOCIAL_WINDOW_MS || follow_total>BJ_RHYTHM_FOLLOW_MS) return false;
    if(difference(reference_total,follow_total)*100u>(uint64_t)reference_total*rules->total_percent) return false;
    for(unsigned i=1;i<reference->count;i++) {
        uint32_t a=reference->taps[i]-reference->taps[i-1],b=follow->taps[i]-follow->taps[i-1];
        if(!a || !b || a>=BJ_RHYTHM_FINISH_MS || b>=BJ_RHYTHM_FINISH_MS) return false;
        uint64_t numerator=difference((uint64_t)a*follow_total,(uint64_t)b*reference_total);
        uint64_t denominator=rules->error_mode==BJ_RHYTHM_RELATIVE_INTERVAL?(uint64_t)a*follow_total:(uint64_t)reference_total*follow_total;
        if(numerator*100u>denominator*rules->interval_percent) return false;
    }
    return true;
}
bool bj_pattern_match(const uint8_t *first,size_t first_length,const uint8_t *second,size_t second_length) {
    if(!first || !second || first_length!=second_length || first_length<BJ_PATTERN_MIN_LENGTH || first_length>BJ_PATTERN_MAX_LENGTH) return false;
    for(size_t i=0;i<first_length;i++) if(first[i]>=BJ_PATTERN_POINTS || second[i]>=BJ_PATTERN_POINTS || first[i]!=second[i]) return false;
    return true;
}
bool bj_fate_update(bj_fate_t *state,const bj_fate_sample_t *sample,const bj_fate_rules_t *rules) {
    if(!state || !sample || !rules || !rules->hold_ms || !rules->max_gap_ms || rules->hold_ms>=INT32_MAX || rules->max_gap_ms>=INT32_MAX) return false;
    int32_t self=sample->self_deviation_cdeg,peer=sample->peer_deviation_cdeg;
    int32_t self_abs=self<0?-self:self,peer_abs=peer<0?-peer:peer;
    int32_t angle_difference=self-peer;
    if(angle_difference<0) angle_difference=-angle_difference;
    bool eligible=sample->enabled && sample->calibrated && sample->same_time && sample->near && !sample->is_friend && !sample->pair_already_counted &&
        self_abs>=rules->min_deviation_cdeg && peer_abs>=rules->min_deviation_cdeg &&
        angle_difference<=rules->max_difference_cdeg;
    if(!eligible) {state->tracking=false;return false;}
    if(state->fired) return false;
    if(!state->tracking || sample->time_ms-state->last_ms>rules->max_gap_ms) {
        state->tracking=true;state->started_ms=sample->time_ms;
    }
    state->last_ms=sample->time_ms;
    if(sample->time_ms-state->started_ms<rules->hold_ms) return false;
    state->fired=true;return true;
}
