#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#define BJ_AUDIO_SAMPLE_RATE 16000u
#define BJ_AUDIO_CHANNELS 2u
#define BJ_AUDIO_CHUNK_FRAMES 320u
#define BJ_AUDIO_PCM_SAMPLES (BJ_AUDIO_CHUNK_FRAMES * BJ_AUDIO_CHANNELS)
typedef enum { BJ_ENV_UNKNOWN, BJ_ENV_QUIET, BJ_ENV_CONVERSATION, BJ_ENV_NOISY, BJ_ENV_MUSIC } bj_environment_label_t;
typedef struct { bj_environment_label_t label; uint16_t confidence_permille; bool has_model; } bj_environment_result_t;
typedef struct { bool owner_authenticated, environment_allowed, power_allowed; uint32_t epoch, consent_revision; } bj_audio_gate_t;
typedef bool (*bj_audio_open_fn)(void *);
typedef bool (*bj_audio_read_fn)(void *,int16_t *,size_t);
typedef bool (*bj_audio_close_fn)(void *);
typedef bool (*bj_audio_classify_fn)(void *,const int16_t *,size_t,bj_environment_result_t *);
typedef void (*bj_audio_reset_fn)(void *);
typedef struct { bj_audio_open_fn open; bj_audio_read_fn read; bj_audio_close_fn close; bj_audio_classify_fn classify; bj_audio_reset_fn reset; void *context; } bj_audio_provider_t;
typedef struct {
    bj_audio_provider_t provider; bj_audio_gate_t gate;
    int16_t pcm[BJ_AUDIO_PCM_SAMPLES]; bj_environment_result_t result;
    bool active, fault; uint32_t reads, read_errors;
} bj_audio_t;
/** 环境授权独立于主动语音；所有回调串行且有界，撤回必须关闭硬件并清零PCM。 */
bool bj_audio_init(bj_audio_t *,const bj_audio_provider_t *);
bool bj_audio_set_gate(bj_audio_t *,const bj_audio_gate_t *);
/** 仅采集与模型适配器；无真实模型返回UNKNOWN，绝不靠音量阈值冒称场景识别。 */
bool bj_audio_process(bj_audio_t *);
bool bj_audio_stop(bj_audio_t *);
