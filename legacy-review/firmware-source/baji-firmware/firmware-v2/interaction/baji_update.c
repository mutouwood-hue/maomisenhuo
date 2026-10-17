#include "baji_update.h"
#include <string.h>
#define BJ_UPDATE_CHUNK_MAX 440u
#define BJ_UPDATE_ASSET_SIZE 0x700000u
#define BJ_UPDATE_APP_MAX 0x800000u
static uint32_t read32(const uint8_t *p){return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
bool bj_update_init(bj_update_t *update,const bj_update_adapter_t *adapter,const uint8_t target[16],uint32_t firmware,uint32_t asset) {
    if(!update || !adapter || !target || !adapter->verify || !adapter->begin || !adapter->write || !adapter->matches || !adapter->finish || !adapter->abort) return false;
    memset(update,0,sizeof(*update));update->adapter=*adapter;memcpy(update->target,target,16);update->floor_version[0]=firmware;update->floor_version[1]=asset;return true;
}
void bj_update_abort(bj_update_t *update) {
    if(!update) return;
    if(update->active) update->adapter.abort(update->adapter.context);
    update->active=false;update->verified=false;
}
bool bj_update_begin(bj_update_t *update,const uint8_t *body,size_t size) {
    if(!update || !body || size<84 || body[0]!=1 || body[1]<1 || body[1]>2 || memcmp(body+2,update->target,16)) return false;
    unsigned signature_size=body[74]|((unsigned)body[75]<<8);
    if(signature_size<8 || signature_size>BJ_UPDATE_SIGNATURE_MAX || size!=76u+signature_size) return false;
    bj_update_manifest_t manifest={.kind=(bj_update_kind_t)body[1],.version=read32(body+18),.size=read32(body+22)};
    memcpy(manifest.target,body+2,16);memcpy(manifest.sha256,body+26,32);memcpy(manifest.transfer_id,body+58,16);
    if(memcmp(manifest.transfer_id,manifest.sha256,16)) return false;
    if(!manifest.version || !manifest.size ||
       (manifest.kind==BJ_UPDATE_FIRMWARE && manifest.size>BJ_UPDATE_APP_MAX) || (manifest.kind==BJ_UPDATE_ASSETS && manifest.size!=BJ_UPDATE_ASSET_SIZE)) return false;
    if(!update->adapter.verify(update->adapter.context,body,BJ_UPDATE_MANIFEST_BODY,body+76,signature_size)) return false;
    bool same=manifest.kind==update->manifest.kind && manifest.version==update->manifest.version && manifest.size==update->manifest.size && !memcmp(manifest.target,update->manifest.target,16) && !memcmp(manifest.sha256,update->manifest.sha256,32) && !memcmp(manifest.transfer_id,update->manifest.transfer_id,16);
    if(update->active || (update->verified && same)) return same;
    if(manifest.version<=update->floor_version[manifest.kind-1] && !(update->adapter.recover && update->adapter.recover(update->adapter.context,&manifest)))return false;
    if(!update->adapter.begin(update->adapter.context,&manifest)) {update->fault=true;return false;}
    update->manifest=manifest;update->received=0;update->active=true;update->verified=false;update->fault=false;return true;
}
bool bj_update_write(bj_update_t *update,const uint8_t id[16],uint32_t offset,const uint8_t *bytes,size_t size) {
    if(!update || !id || !bytes || !size || size>BJ_UPDATE_CHUNK_MAX || !update->active || memcmp(id,update->manifest.transfer_id,16) ||
       offset>update->manifest.size || size>update->manifest.size-offset) return false;
    if(offset<update->received) return size<=update->received-offset && update->adapter.matches(update->adapter.context,offset,bytes,size);
    if(offset!=update->received) return false;
    if(!update->adapter.write(update->adapter.context,offset,bytes,size)) {update->fault=true;bj_update_abort(update);return false;}
    update->received+=(uint32_t)size;return true;
}
bool bj_update_finish(bj_update_t *update,const uint8_t id[16]) {
    if(update && id && update->verified && !memcmp(id,update->manifest.transfer_id,16))return true;
    if(!update || !id || !update->active || memcmp(id,update->manifest.transfer_id,16) || update->received!=update->manifest.size) return false;
    if(!update->adapter.finish(update->adapter.context,&update->manifest)) {update->fault=true;bj_update_abort(update);return false;}
    update->active=false;update->verified=true;return true;
}
