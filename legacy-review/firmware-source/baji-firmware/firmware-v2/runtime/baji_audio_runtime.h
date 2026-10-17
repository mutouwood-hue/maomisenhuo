#pragma once
#include "baji_audio_policy.h"
#include "baji_env_model.h"
#include "esp_err.h"
/** 单worker调用；本模块独占I2S，不能与BSP audio init并用。 */
esp_err_t bj_audio_runtime_init(bj_audio_t *);
/** 真实模型可注册，不提供默认音量分类；模型实现与验证证据另交付。 */
void bj_audio_runtime_model(bj_audio_classify_fn,void *);
bool bj_audio_runtime_weights(const bj_env_weights_t *);
bool bj_audio_runtime_window_complete(void);
