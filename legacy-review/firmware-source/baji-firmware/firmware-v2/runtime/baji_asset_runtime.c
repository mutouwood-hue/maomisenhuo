#include "baji_asset_runtime.h"
#include "esp_spiffs.h"
#include "esp_heap_caps.h"
#include "bsp/esp-bsp.h"
#include "mbedtls/md.h"
#include "lvgl.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#define BJ_ASSET_FRAMES 24u
#define BJ_ASSET_A_FRAME_BYTES 44296u
#define BJ_ASSET_B_FRAME_BYTES 35148u
typedef struct {uint8_t *pixels[2];lv_image_dsc_t frames[2][24];const esp_partition_t *partition;} asset_bank_t;
static asset_bank_t banks[2];
static asset_bank_t *active=&banks[0],*candidate=&banks[1];
static bool poisoned;
static bool allowed_files(void) {
    DIR *directory=opendir("/bj_asset_check");if(!directory)return false;
    unsigned found=0;bool valid=true;struct dirent *entry;
    while((entry=readdir(directory))!=NULL) {
        unsigned bit=!strcmp(entry->d_name,"manifest.bin")?1u:!strcmp(entry->d_name,"cat_a.bgra")?2u:!strcmp(entry->d_name,"cat_b.bgra")?4u:0u;
        if(!bit || (found&bit)){valid=false;break;}found|=bit;
    }
    closedir(directory);return valid && found==7u;
}
static bj_asset_apply_fn apply_callback;
static void *apply_context;
static uint32_t read32(const uint8_t *p){return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
static void release_bank(asset_bank_t *bank){for(unsigned i=0;i<2;i++){free(bank->pixels[i]);bank->pixels[i]=NULL;}bank->partition=NULL;}
void bj_asset_runtime_bind(bj_asset_apply_fn callback,void *context){apply_callback=callback;apply_context=context;}
bool bj_asset_runtime_validate(const esp_partition_t *partition,uint32_t firmware) {
    if(!partition || poisoned)return false;
    release_bank(candidate);
    esp_vfs_spiffs_conf_t config={.base_path="/bj_asset_check",.partition_label=partition->label,.max_files=2,.format_if_mount_failed=false};
    if(esp_vfs_spiffs_register(&config)!=ESP_OK)return false;
    /* 固定80B BJA1 manifest：min/max firmware、24 frames、两组原始BGRA文件SHA256。 */
    uint8_t manifest[80];FILE *file=fopen("/bj_asset_check/manifest.bin","rb");
    bool valid=file && fread(manifest,1,80,file)==80 && fgetc(file)==EOF;
    if(file)fclose(file);
    valid=valid && allowed_files() && !memcmp(manifest,"BJA1",4) && read32(manifest+4)>0 && read32(manifest+4)<=read32(manifest+8) && read32(manifest+4)<=firmware && read32(manifest+8)>=firmware && read32(manifest+12)==24;
    static const char *paths[]={"/bj_asset_check/cat_a.bgra","/bj_asset_check/cat_b.bgra"};
    for(unsigned type=0;valid && type<2;type++) {
        size_t frame_size=type?BJ_ASSET_B_FRAME_BYTES:BJ_ASSET_A_FRAME_BYTES,size=frame_size*24;
        candidate->pixels[type]=heap_caps_malloc(size,MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
        file=candidate->pixels[type]?fopen(paths[type],"rb"):NULL;
        valid=file && fread(candidate->pixels[type],1,size,file)==size && fgetc(file)==EOF;
        if(file)fclose(file);
        uint8_t hash[32];const mbedtls_md_info_t *sha=mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
        valid=valid && sha && mbedtls_md(sha,candidate->pixels[type],size,hash)==0 && !memcmp(hash,manifest+16+type*32,32);
        if(valid)for(unsigned frame=0;frame<24;frame++)candidate->frames[type][frame]=(lv_image_dsc_t){
            .header={.magic=LV_IMAGE_HEADER_MAGIC,.cf=LV_COLOR_FORMAT_ARGB8888,.w=type?87:98,.h=type?101:113,.stride=type?348:392},
            .data_size=frame_size,.data=candidate->pixels[type]+frame*frame_size};
    }
    esp_err_t unmount=esp_vfs_spiffs_unregister(partition->label);
    if(!valid || unmount!=ESP_OK){release_bank(candidate);return false;}
    candidate->partition=partition;return true;
}
bool bj_asset_runtime_activate(const esp_partition_t *partition,bj_asset_commit_fn commit,void *context) {
    if(poisoned)return false;
    if(!partition || candidate->partition!=partition || !apply_callback)return false;
    if(bsp_display_lock(1000)!=ESP_OK){release_bank(candidate);return false;}
    /* 候选描述符地址固定；显示锁内提交失败可恢复旧源，释放前先清所有缓存。 */
    bool applied=apply_callback(apply_context,candidate->frames[0],candidate->frames[1]);
    bool ok=applied && (!commit || commit(context));
    if(!ok) {
        bool restored=apply_callback(apply_context,active->partition?active->frames[0]:NULL,active->partition?active->frames[1]:NULL);
        if(!restored)poisoned=true;else release_bank(candidate);
    }
    if(ok){asset_bank_t *previous=active;active=candidate;candidate=previous;release_bank(candidate);}
    bsp_display_unlock();return ok;
}
