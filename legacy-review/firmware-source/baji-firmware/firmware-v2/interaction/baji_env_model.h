#pragma once
#include "baji_audio_policy.h"
#define BJ_ENV_FRAME_FEATURES 12u
#define BJ_ENV_WINDOW_FEATURES 24u
#define BJ_ENV_WINDOW_FRAMES 50u
#define BJ_ENV_CLASSES 4u
typedef struct {float mean[24],scale[24],weights[96],bias[4],min_confidence,max_z;uint32_t version;} bj_env_weights_t;
typedef struct {const bj_env_weights_t *weights;double mean[12],m2[12];unsigned frames;bool completed;} bj_env_model_t;
bool bj_env_frame_features(const int16_t *,size_t,double[12]);
bool bj_env_model_load(bj_env_model_t *,const bj_env_weights_t *);
void bj_env_model_reset(bj_env_model_t *);
bool bj_env_model_classify(void *,const int16_t *,size_t,bj_environment_result_t *);
