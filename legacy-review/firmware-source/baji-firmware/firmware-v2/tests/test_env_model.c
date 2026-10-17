#include "baji_env_model.h"
#include <stdio.h>
#include <math.h>
#include <string.h>
static unsigned checks;
#define CHECK(x) do{checks++;if(!(x)){fprintf(stderr,"model line %d\n",__LINE__);return 1;}}while(0)
int main(void) {
    int16_t pcm[640]={0};double feature[12];
    CHECK(bj_env_frame_features(pcm,640,feature));CHECK(fabs(feature[0]+13.815510557964274)<1e-8);
    CHECK(fabs(feature[6]+27.631021115928547)<1e-8);CHECK(feature[1]==0);
    bj_env_model_t model={0};bj_environment_result_t result;
    CHECK(bj_env_model_classify(&model,pcm,640,&result));CHECK(!result.has_model && result.label==BJ_ENV_UNKNOWN);
    bj_env_weights_t weights={.version=1,.min_confidence=.7f,.max_z=1000};
    for(unsigned i=0;i<24;i++) weights.scale[i]=1;
    weights.bias[3]=10;CHECK(bj_env_model_load(&model,&weights));
    for(unsigned i=0;i<49;i++){CHECK(bj_env_model_classify(&model,pcm,640,&result));CHECK(result.label==BJ_ENV_UNKNOWN && !model.completed);}
    CHECK(bj_env_model_classify(&model,pcm,640,&result));CHECK(model.completed && result.label==BJ_ENV_MUSIC && result.has_model);
    CHECK(model.frames==0);CHECK(bj_env_model_classify(&model,pcm,640,&result));bj_env_model_reset(&model);CHECK(model.frames==0);
    weights.scale[0]=0;CHECK(!bj_env_model_load(&model,&weights));CHECK(!model.weights);
    for(unsigned fixture=0;fixture<5;fixture++) {
        for(int i=0;i<320;i++) {
            if(fixture==0) pcm[2*i]=pcm[2*i+1]=0;
            if(fixture==1) pcm[2*i]=pcm[2*i+1]=-32768;
            if(fixture==2) pcm[2*i]=pcm[2*i+1]=(i%2)?-8192:8192;
            if(fixture==3){pcm[2*i]=(int16_t)(i*100-16000);pcm[2*i+1]=(int16_t)(16000-i*80);}
            if(fixture==4){pcm[2*i]=(int16_t)((i*997)%32000-16000);pcm[2*i+1]=(int16_t)((i*431)%28000-14000);}
        }
        CHECK(bj_env_frame_features(pcm,640,feature));printf("FEATURE %u",fixture);for(unsigned i=0;i<12;i++)printf(" %.12g",feature[i]);puts("");
    }
    printf("model numerical checks %u pass; synthetic weights NOT scene accuracy\n",checks);return 0;
}
