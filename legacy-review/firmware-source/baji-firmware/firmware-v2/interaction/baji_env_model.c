#include "baji_env_model.h"
#include <math.h>
#include <string.h>
#define BJ_ENV_PCM_SCALE 32768.0
#define BJ_ENV_RMS_FLOOR 1e-6
#define BJ_ENV_POWER_FLOOR 1e-12
#define BJ_ENV_CREST_LIMIT 20.0
#define BJ_ENV_CLIP_LIMIT 32760
static const double frequencies[6]={250,500,1000,2000,4000,6000};
bool bj_env_frame_features(const int16_t *pcm,size_t count,double out[12]) {
    if(!pcm || !out || count!=BJ_AUDIO_PCM_SAMPLES) return false;
    double square=0,left_square=0,right_square=0,sum=0,peak=0,s1[6]={0},s2[6]={0},coefficients[6];
    unsigned crossing=0,clipped=0;bool previous_sign=true;
    for(unsigned i=0;i<6;i++) coefficients[i]=2.0*cos(2.0*3.14159265358979323846*frequencies[i]/BJ_AUDIO_SAMPLE_RATE);
    for(unsigned i=0;i<BJ_AUDIO_CHUNK_FRAMES;i++) {
        int32_t left=pcm[2*i],right=pcm[2*i+1];
        double mono=((left+right)/2)/BJ_ENV_PCM_SCALE,l=left/BJ_ENV_PCM_SCALE,r=right/BJ_ENV_PCM_SCALE;
        square+=mono*mono;left_square+=l*l;right_square+=r*r;sum+=mono;if(fabs(mono)>peak) peak=fabs(mono);
        bool sign=mono>=0;if(i && sign!=previous_sign) crossing++;previous_sign=sign;
        if(left>=BJ_ENV_CLIP_LIMIT || left<=-BJ_ENV_CLIP_LIMIT) clipped++;
        if(right>=BJ_ENV_CLIP_LIMIT || right<=-BJ_ENV_CLIP_LIMIT) clipped++;
        for(unsigned j=0;j<6;j++) {double current=mono+coefficients[j]*s1[j]-s2[j];s2[j]=s1[j];s1[j]=current;}
    }
    double rms=sqrt(square/BJ_AUDIO_CHUNK_FRAMES);
    out[0]=log(fmax(rms,BJ_ENV_RMS_FLOOR));out[1]=(double)crossing/(BJ_AUDIO_CHUNK_FRAMES-1);
    out[2]=fmin(peak/fmax(rms,BJ_ENV_RMS_FLOOR),BJ_ENV_CREST_LIMIT);out[3]=fabs(sum/BJ_AUDIO_CHUNK_FRAMES);
    out[4]=log(fmax(sqrt(left_square/BJ_AUDIO_CHUNK_FRAMES),BJ_ENV_RMS_FLOOR))-log(fmax(sqrt(right_square/BJ_AUDIO_CHUNK_FRAMES),BJ_ENV_RMS_FLOOR));
    out[5]=(double)clipped/BJ_AUDIO_PCM_SAMPLES;
    for(unsigned j=0;j<6;j++) {
        double power=fmax(s1[j]*s1[j]+s2[j]*s2[j]-coefficients[j]*s1[j]*s2[j],0)/(BJ_AUDIO_CHUNK_FRAMES*BJ_AUDIO_CHUNK_FRAMES);
        out[6+j]=log(fmax(power,BJ_ENV_POWER_FLOOR));
    }
    return true;
}
void bj_env_model_reset(bj_env_model_t *model) {
    if(!model) return;
    memset(model->mean,0,sizeof(model->mean));memset(model->m2,0,sizeof(model->m2));model->frames=0;model->completed=false;
}
bool bj_env_model_load(bj_env_model_t *model,const bj_env_weights_t *weights) {
    if(!model) return false;
    model->weights=NULL;bj_env_model_reset(model);
    if(!weights || !weights->version || !isfinite(weights->min_confidence) || weights->min_confidence<0 || weights->min_confidence>1 || !isfinite(weights->max_z) || weights->max_z<=0) return false;
    for(unsigned i=0;i<24;i++) if(!isfinite(weights->mean[i]) || !isfinite(weights->scale[i]) || weights->scale[i]<=0) return false;
    for(unsigned i=0;i<96;i++) if(!isfinite(weights->weights[i])) return false;
    for(unsigned i=0;i<4;i++) if(!isfinite(weights->bias[i])) return false;
    model->weights=weights;return true;
}
bool bj_env_model_classify(void *context,const int16_t *pcm,size_t count,bj_environment_result_t *result) {
    bj_env_model_t *model=context;if(!model || !result) return false;
    model->completed=false;*result=(bj_environment_result_t){.has_model=model->weights!=NULL};
    if(!model->weights) return true;
    double frame[12];if(!bj_env_frame_features(pcm,count,frame)) {bj_env_model_reset(model);return false;}
    model->frames++;
    for(unsigned i=0;i<12;i++) {double delta=frame[i]-model->mean[i];model->mean[i]+=delta/model->frames;model->m2[i]+=delta*(frame[i]-model->mean[i]);}
    if(model->frames<BJ_ENV_WINDOW_FRAMES) return true;
    double normalized[24],logits[4],max_logit=-INFINITY,max_z=0;
    for(unsigned i=0;i<24;i++) {
        double feature=i<12?model->mean[i]:sqrt(fmax(model->m2[i-12]/BJ_ENV_WINDOW_FRAMES,0));
        normalized[i]=(feature-model->weights->mean[i])/model->weights->scale[i];max_z=fmax(max_z,fabs(normalized[i]));
    }
    for(unsigned i=0;i<4;i++) {logits[i]=model->weights->bias[i];for(unsigned j=0;j<24;j++) logits[i]+=model->weights->weights[i*24+j]*normalized[j];max_logit=fmax(max_logit,logits[i]);}
    double total=0;unsigned best=0;for(unsigned i=0;i<4;i++) {logits[i]=exp(logits[i]-max_logit);total+=logits[i];if(logits[i]>logits[best])best=i;}
    double confidence=logits[best]/total;
    if(isfinite(confidence)) {
        result->confidence_permille=(uint16_t)lround(fmin(fmax(confidence,0),1)*1000);
        if(confidence>=model->weights->min_confidence && max_z<=model->weights->max_z) result->label=(bj_environment_label_t)(best+1);
    }
    bj_env_model_reset(model);model->completed=true;return true;
}
