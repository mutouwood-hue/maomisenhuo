#include "baji_social_policy.h"
#include "baji_audio_policy.h"
#include <stdio.h>
#include <string.h>
static unsigned checks,failures;
#define CHECK(value) do {checks++;if(!(value)){failures++;printf("FAIL line %u: %s\n",__LINE__,#value);}} while(0)
static bj_rhythm_t rhythm(uint32_t first,uint32_t interval) {
    bj_rhythm_t result={0};for(unsigned i=0;i<4;i++) CHECK(bj_rhythm_tap(&result,first+i*interval));return result;
}
static void social_tests(void) {
    bj_rhythm_rules_t rules=bj_rhythm_initial_rules();
    bj_rhythm_t first=rhythm(0,100),second=rhythm(200,130);
    CHECK(bj_rhythm_match(&first,&second,&rules));second.taps[3]++;
    CHECK(!bj_rhythm_match(&first,&second,&rules));
    second=rhythm(UINT32_MAX-200,100);CHECK(bj_rhythm_match(&first,&second,&rules));
    CHECK(!bj_rhythm_finished(&first,1499));CHECK(bj_rhythm_finished(&first,1500));
    CHECK(!bj_rhythm_tap(&first,1500));CHECK(first.invalid);
    first=rhythm(0,100);second=(bj_rhythm_t){.taps={0,115,200,300},.count=4};
    CHECK(bj_rhythm_match(&first,&second,&rules));second.taps[1]=116;
    CHECK(!bj_rhythm_match(&first,&second,&rules));rules.error_mode=BJ_RHYTHM_ABSOLUTE_SHARE;
    CHECK(bj_rhythm_match(&first,&second,&rules));rules.interval_percent=101;
    CHECK(!bj_rhythm_match(&first,&second,&rules));
    bj_rhythm_t too_many={0};for(unsigned i=0;i<8;i++) CHECK(bj_rhythm_tap(&too_many,i*100));
    CHECK(!bj_rhythm_tap(&too_many,800));CHECK(too_many.invalid);
    uint8_t pattern[]={0,1,8,3};CHECK(bj_pattern_match(pattern,4,pattern,4));
    CHECK(!bj_pattern_match(pattern,3,pattern,3));uint8_t wrong[]={0,1,3,8};CHECK(!bj_pattern_match(pattern,4,wrong,4));
    wrong[2]=9;CHECK(!bj_pattern_match(wrong,4,wrong,4));
    bj_fate_rules_t fate_rules={.min_deviation_cdeg=800,.max_difference_cdeg=300,.hold_ms=300,.max_gap_ms=200};
    bj_fate_sample_t sample={.enabled=true,.calibrated=true,.same_time=true,.near=true,.self_deviation_cdeg=800,.peer_deviation_cdeg=1100};
    bj_fate_t fate={0};CHECK(!bj_fate_update(&fate,&sample,&fate_rules));sample.time_ms=200;CHECK(!bj_fate_update(&fate,&sample,&fate_rules));
    sample.time_ms=300;CHECK(bj_fate_update(&fate,&sample,&fate_rules));sample.time_ms=400;CHECK(!bj_fate_update(&fate,&sample,&fate_rules));
    fate=(bj_fate_t){0};sample.peer_deviation_cdeg=-800;CHECK(!bj_fate_update(&fate,&sample,&fate_rules));CHECK(!fate.tracking);
    sample.peer_deviation_cdeg=800;sample.time_ms=UINT32_MAX-100;CHECK(!bj_fate_update(&fate,&sample,&fate_rules));
    sample.time_ms=99;CHECK(!bj_fate_update(&fate,&sample,&fate_rules));sample.time_ms=199;CHECK(bj_fate_update(&fate,&sample,&fate_rules));
    fate=(bj_fate_t){0};sample.time_ms=0;CHECK(!bj_fate_update(&fate,&sample,&fate_rules));sample.time_ms=301;
    CHECK(!bj_fate_update(&fate,&sample,&fate_rules));CHECK(fate.started_ms==301);
    sample.is_friend=true;CHECK(!bj_fate_update(&fate,&sample,&fate_rules));CHECK(!fate.tracking);
}
typedef struct {unsigned opens,reads,closes,resets;bool fail_open,fail_read,fail_close,model;bj_environment_result_t result;} mock_t;
static bool open_audio(void *ctx) {mock_t *mock=ctx;mock->opens++;return !mock->fail_open;}
static bool read_audio(void *ctx,int16_t *pcm,size_t size) {mock_t *mock=ctx;mock->reads++;for(size_t i=0;i<size;i++)pcm[i]=123;return !mock->fail_read;}
static bool close_audio(void *ctx) {mock_t *mock=ctx;mock->closes++;return !mock->fail_close;}
static bool classify(void *ctx,const int16_t *pcm,size_t size,bj_environment_result_t *result) {
    mock_t *mock=ctx;CHECK(size==BJ_AUDIO_PCM_SAMPLES);CHECK(pcm[0]==123);*result=mock->result;return mock->model;
}
static void reset_audio(void *ctx) {mock_t *mock=ctx;mock->resets++;}
static bool pcm_erased(const bj_audio_t *audio) {for(size_t i=0;i<BJ_AUDIO_PCM_SAMPLES;i++)if(audio->pcm[i])return false;return true;}
static void audio_tests(void) {
    mock_t mock={0};bj_audio_provider_t provider={.open=open_audio,.read=read_audio,.close=close_audio,.classify=classify,.reset=reset_audio,.context=&mock};bj_audio_t audio;
    CHECK(bj_audio_init(&audio,&provider));CHECK(!bj_audio_process(&audio));CHECK(mock.reads==0);
    bj_audio_gate_t gate={.owner_authenticated=true,.power_allowed=true,.epoch=1};CHECK(bj_audio_set_gate(&audio,&gate));CHECK(mock.opens==0);
    gate.environment_allowed=true;CHECK(bj_audio_set_gate(&audio,&gate));CHECK(audio.active);CHECK(mock.opens==1);
    CHECK(bj_audio_process(&audio));CHECK(audio.result.label==BJ_ENV_UNKNOWN);CHECK(!audio.result.has_model);CHECK(pcm_erased(&audio));
    mock.model=true;mock.result=(bj_environment_result_t){.label=BJ_ENV_MUSIC,.confidence_permille=920,.has_model=true};
    CHECK(bj_audio_process(&audio));CHECK(audio.result.label==BJ_ENV_MUSIC);CHECK(pcm_erased(&audio));
    mock.result.confidence_permille=1001;CHECK(bj_audio_process(&audio));CHECK(audio.result.label==BJ_ENV_UNKNOWN);
    mock.result.label=(bj_environment_label_t)-1;mock.result.confidence_permille=900;
    CHECK(bj_audio_process(&audio));CHECK(audio.result.label==BJ_ENV_UNKNOWN);CHECK(!audio.result.has_model);CHECK(pcm_erased(&audio));
    gate.power_allowed=false;CHECK(bj_audio_set_gate(&audio,&gate));CHECK(!audio.active);CHECK(mock.closes==1);CHECK(pcm_erased(&audio));
    gate.power_allowed=true;CHECK(bj_audio_set_gate(&audio,&gate));gate.epoch++;
    CHECK(bj_audio_set_gate(&audio,&gate));CHECK(mock.closes==2);CHECK(mock.opens==3);
    /* New consent in the same BLE epoch must discard the old aggregation. */
    unsigned old_closes=mock.closes,old_opens=mock.opens,old_resets=mock.resets;
    gate.consent_revision++;CHECK(bj_audio_set_gate(&audio,&gate));
    CHECK(mock.resets==old_resets+1);
    CHECK(mock.closes==old_closes+1 && mock.opens==old_opens+1);CHECK(pcm_erased(&audio));
    CHECK(audio.result.label==BJ_ENV_UNKNOWN && !audio.result.has_model);
    CHECK(bj_audio_set_gate(&audio,&gate));CHECK(mock.opens==old_opens+1);
    gate.environment_allowed=false;CHECK(bj_audio_set_gate(&audio,&gate));CHECK(!audio.active);CHECK(!bj_audio_process(&audio));
    gate.environment_allowed=true;CHECK(bj_audio_set_gate(&audio,&gate));mock.fail_read=true;
    CHECK(!bj_audio_process(&audio));CHECK(audio.fault);CHECK(!audio.active);CHECK(pcm_erased(&audio));
    CHECK(bj_audio_init(&audio,&provider));mock.fail_read=false;mock.fail_close=true;CHECK(bj_audio_set_gate(&audio,&gate));
    gate.owner_authenticated=false;CHECK(!bj_audio_set_gate(&audio,&gate));CHECK(audio.fault);CHECK(pcm_erased(&audio));
    mock.fail_close=false;CHECK(bj_audio_stop(&audio));CHECK(!audio.active);
}
int main(void) {social_tests();audio_tests();printf("M2 policy: %u checks %u failures\n",checks,failures);return failures?1:0;}
