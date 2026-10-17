#include "baji_audio_policy.h"
#include <string.h>
static void erase_pcm(bj_audio_t *audio) {
    volatile int16_t *samples=audio->pcm;
    for(size_t i=0;i<BJ_AUDIO_PCM_SAMPLES;i++) samples[i]=0;
}
static bool gate_allows(const bj_audio_gate_t *gate) {
    return gate->owner_authenticated && gate->environment_allowed && gate->power_allowed;
}
bool bj_audio_init(bj_audio_t *audio,const bj_audio_provider_t *provider) {
    if(!audio || !provider || !provider->open || !provider->read || !provider->close) return false;
    memset(audio,0,sizeof(*audio));audio->provider=*provider;return true;
}
bool bj_audio_stop(bj_audio_t *audio) {
    if(!audio) return false;
    bool closed=!audio->active || audio->provider.close(audio->provider.context);
    if(closed) audio->active=false;
    else audio->fault=true;
    erase_pcm(audio);audio->result=(bj_environment_result_t){0};
    if(audio->provider.reset) audio->provider.reset(audio->provider.context);
    return closed;
}
bool bj_audio_set_gate(bj_audio_t *audio,const bj_audio_gate_t *gate) {
    if(!audio || !gate) return false;
    bool changed_epoch=gate->epoch!=audio->gate.epoch || gate->consent_revision!=audio->gate.consent_revision;
    audio->gate=*gate;
    if(changed_epoch || !gate_allows(gate)) {
        if(!bj_audio_stop(audio)) return false;
    }
    if(!gate_allows(gate) || audio->fault) return !audio->fault;
    if(audio->active) return true;
    audio->active=audio->provider.open(audio->provider.context);
    if(!audio->active) {audio->fault=true;erase_pcm(audio);return false;}
    return true;
}
bool bj_audio_process(bj_audio_t *audio) {
    if(!audio || audio->fault || !audio->active || !gate_allows(&audio->gate)) return false;
    audio->result=(bj_environment_result_t){0};
    if(!audio->provider.read(audio->provider.context,audio->pcm,BJ_AUDIO_PCM_SAMPLES)) {
        audio->read_errors++;audio->fault=true;(void)bj_audio_stop(audio);return false;
    }
    audio->reads++;
    bj_environment_result_t result={0};
    bool classified=audio->provider.classify && audio->provider.classify(audio->provider.context,audio->pcm,BJ_AUDIO_PCM_SAMPLES,&result);
    if(classified && result.has_model && (unsigned)result.label<=BJ_ENV_MUSIC && result.confidence_permille<=1000u) audio->result=result;
    erase_pcm(audio);return true;
}
