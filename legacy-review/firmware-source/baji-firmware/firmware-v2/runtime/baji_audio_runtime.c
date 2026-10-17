#include "baji_audio_runtime.h"
#include "baji_env_model.h"
#include "bsp/esp-bsp.h"
#include "driver/i2s_std.h"
#include "esp_codec_dev_defaults.h"
#include <string.h>
#ifdef BJ_ENV_MODEL_HEADER
#include BJ_ENV_MODEL_HEADER
#ifndef BJ_ENV_ALLOW_EXPERIMENTAL
#error External environment model requires explicit experimental build opt-in
#endif
#ifndef BJ_ENV_EXPERIMENTAL_MODEL
#error External model must declare experimental provenance
#endif
#endif
#define BJ_AUDIO_READ_TIMEOUT_MS 40u
static i2s_chan_handle_t receive_channel;
static esp_codec_dev_handle_t microphone;
static bj_env_model_t environment_model;
static bj_audio_classify_fn model=bj_env_model_classify;
static void *model_context=&environment_model;
static const audio_codec_data_if_t *stream_interface;
static const audio_codec_ctrl_if_t *control_interface;
static const audio_codec_if_t *codec_interface;
static bool opened,discard_first;
static void release_audio(void) {
    if(microphone) {esp_codec_dev_delete(microphone);microphone=NULL;}
    if(codec_interface) {audio_codec_delete_codec_if(codec_interface);codec_interface=NULL;}
    if(control_interface) {audio_codec_delete_ctrl_if(control_interface);control_interface=NULL;}
    if(stream_interface) {audio_codec_delete_data_if(stream_interface);stream_interface=NULL;}
    if(receive_channel) {i2s_del_channel(receive_channel);receive_channel=NULL;}
}
static bool open_audio(void *unused) {
    (void)unused;
    if(opened) return true;
    if(!microphone) {
        if(bsp_i2c_init()!=ESP_OK) return false;
        i2s_chan_config_t channel=I2S_CHANNEL_DEFAULT_CONFIG(CONFIG_BSP_I2S_NUM,I2S_ROLE_MASTER);
        channel.dma_desc_num=2;channel.dma_frame_num=BJ_AUDIO_CHUNK_FRAMES;channel.auto_clear=true;
        if(i2s_new_channel(&channel,NULL,&receive_channel)!=ESP_OK) return false;
        i2s_std_config_t config={.clk_cfg=I2S_STD_CLK_DEFAULT_CONFIG(BJ_AUDIO_SAMPLE_RATE),
            .slot_cfg=I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT,I2S_SLOT_MODE_STEREO),
            .gpio_cfg={.mclk=BSP_I2S_MCLK,.bclk=BSP_I2S_SCLK,.ws=BSP_I2S_LCLK,.dout=GPIO_NUM_NC,.din=BSP_I2S_DSIN}};
        if(i2s_channel_init_std_mode(receive_channel,&config)!=ESP_OK) {i2s_del_channel(receive_channel);receive_channel=NULL;return false;}
        audio_codec_i2s_cfg_t stream={.port=CONFIG_BSP_I2S_NUM,.rx_handle=receive_channel};
        stream_interface=audio_codec_new_i2s_data(&stream);
        audio_codec_i2c_cfg_t control={.port=BSP_I2C_NUM,.addr=ES7210_CODEC_DEFAULT_ADDR,.bus_handle=bsp_i2c_get_handle()};
        control_interface=audio_codec_new_i2c_ctrl(&control);
        es7210_codec_cfg_t adc={.ctrl_if=control_interface,.mic_selected=ES7210_SEL_MIC1|ES7210_SEL_MIC2};
        codec_interface=control_interface?es7210_codec_new(&adc):NULL;
        if(!stream_interface || !codec_interface) {release_audio();return false;}
        esp_codec_dev_cfg_t device={.dev_type=ESP_CODEC_DEV_TYPE_IN,.codec_if=codec_interface,.data_if=stream_interface};
        microphone=esp_codec_dev_new(&device);if(!microphone) {release_audio();return false;}
    }
    esp_codec_dev_sample_info_t format={.sample_rate=BJ_AUDIO_SAMPLE_RATE,.channel=BJ_AUDIO_CHANNELS,.bits_per_sample=16};
    if(esp_codec_dev_open(microphone,&format)!=ESP_CODEC_DEV_OK) {release_audio();return false;}
    opened=true;discard_first=true;return true;
}
static bool read_audio(void *unused,int16_t *pcm,size_t count) {
    (void)unused;if(!opened || count!=BJ_AUDIO_PCM_SAMPLES) return false;
    size_t received=0;
    /* codec默认read不能判断partial且超时长；直接使用自己拥有的RX句柄做有界读取。 */
    bool complete=i2s_channel_read(receive_channel,pcm,count*sizeof(*pcm),&received,BJ_AUDIO_READ_TIMEOUT_MS)==ESP_OK && received==count*sizeof(*pcm);
    if(discard_first && complete) {memset(pcm,0,count*sizeof(*pcm));discard_first=false;}
    return complete;
}
static bool close_audio(void *unused) {
    (void)unused;if(!opened) return true;
    int result=esp_codec_dev_close(microphone);
    /* codec close应同时关闭ADC和RX。失败不报告已停止，也不允许重新采集。 */
    if(result!=ESP_CODEC_DEV_OK) { (void)i2s_channel_disable(receive_channel);return false; }
    opened=false;return true;
}
static bool classify_audio(void *unused,const int16_t *pcm,size_t count,bj_environment_result_t *result) {
    (void)unused;return model && model(model_context,pcm,count,result);
}
static void reset_audio(void *unused) {(void)unused;bj_env_model_reset(&environment_model);}
esp_err_t bj_audio_runtime_init(bj_audio_t *audio) {
#ifdef BJ_ENV_MODEL_HEADER
    if(opened || BJ_ENV_EXPERIMENTAL_MODEL!=1 || BJ_ENV_MODEL_VERSION!=bj_env_exported_weights.version || strlen(BJ_ENV_MODEL_SHA256)!=64 || !bj_audio_runtime_weights(&bj_env_exported_weights))return ESP_ERR_INVALID_ARG;
#endif
    bj_audio_provider_t provider={.open=open_audio,.read=read_audio,.close=close_audio,.classify=classify_audio,.reset=reset_audio};
    return bj_audio_init(audio,&provider)?ESP_OK:ESP_ERR_INVALID_ARG;
}
void bj_audio_runtime_model(bj_audio_classify_fn classify,void *context) {if(!opened){model=classify;model_context=context;}}
bool bj_audio_runtime_weights(const bj_env_weights_t *weights) {return !opened && bj_env_model_load(&environment_model,weights);}
bool bj_audio_runtime_window_complete(void) {return model==bj_env_model_classify && environment_model.completed;}
