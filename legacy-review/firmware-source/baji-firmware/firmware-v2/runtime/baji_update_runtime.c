#include "baji_update_runtime.h"
#include "baji_asset_runtime.h"
#include "esp_ota_ops.h"
#include "mbedtls/md.h"
#include "mbedtls/pk.h"
#include "nvs.h"
#include <string.h>
#include <stdio.h>
extern const unsigned char bj_update_root_pem[];
extern const size_t bj_update_root_pem_size;
#ifndef BJ_FIRMWARE_RELEASE_VERSION
#define BJ_FIRMWARE_RELEASE_VERSION 1u
#endif
static bj_update_t update;
static const esp_partition_t *destination;
static esp_ota_handle_t ota_handle;
static nvs_handle_t storage;
static bool ready,ota_open,storage_fault;
static uint8_t state,reason;
/* BJU2：confirmed floors、asset slot、pending app version/slot/hash、CRC由NVS提供。 */
static uint8_t record[60];
static uint32_t read32(const uint8_t *p){return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
static void put32(uint8_t *p,uint32_t value){for(unsigned i=0;i<4;i++)p[i]=(uint8_t)(value>>(8*i));}
static bool persist(const uint8_t bytes[60]) {
    if(storage_fault) {reason=10;return false;}
    uint8_t check[60];size_t size=sizeof(check);
    if(nvs_set_blob(storage,"upgrade",bytes,60)!=ESP_OK || nvs_commit(storage)!=ESP_OK || nvs_get_blob(storage,"upgrade",check,&size)!=ESP_OK || size!=60 || memcmp(bytes,check,60)) {storage_fault=true;reason=10;state=3;return false;}
    memcpy(record,bytes,60);return true;
}
static bool verify(void *unused,const uint8_t *body,size_t size,const uint8_t *signature,size_t length) {
    (void)unused;static const char domain[]="BAJI-UPDATE-v1";
    const char *pem=(const char *)bj_update_root_pem;
    if(!*pem || size!=74) {reason=2;return false;}
    uint8_t message[sizeof(domain)-1+74],digest[32];memcpy(message,domain,sizeof(domain)-1);memcpy(message+sizeof(domain)-1,body,74);
    const mbedtls_md_info_t *sha=mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    mbedtls_pk_context key;mbedtls_pk_init(&key);
    bool valid=sha && mbedtls_md(sha,message,sizeof(message),digest)==0 && mbedtls_pk_parse_public_key(&key,(const unsigned char *)pem,bj_update_root_pem_size)==0 &&
        mbedtls_pk_can_do(&key,MBEDTLS_PK_ECDSA) && mbedtls_ecp_keypair_get_group_id(mbedtls_pk_ec(key))==MBEDTLS_ECP_DP_SECP256R1 &&
        mbedtls_pk_verify(&key,MBEDTLS_MD_SHA256,digest,32,signature,length)==0;
    mbedtls_pk_free(&key);if(!valid)reason=2;return valid;
}
static void abort_flash(void *unused) {
    (void)unused;if(ota_open){(void)esp_ota_abort(ota_handle);ota_open=false;}destination=NULL;
}
static bool recovery(void *unused,const bj_update_manifest_t *manifest) {
    (void)unused;
    return manifest->kind==BJ_UPDATE_FIRMWARE && read32(record+16)==read32(record+4) && manifest->version==read32(record+16) && manifest->size==read32(record+56) && !memcmp(manifest->sha256,record+24,32);
}
static bool begin_flash(void *unused,const bj_update_manifest_t *manifest) {
    (void)unused;
    if(manifest->kind==BJ_UPDATE_FIRMWARE) {
        if(read32(record+16) && !recovery(NULL,manifest)) {reason=4;return false;}
        destination=recovery(NULL,manifest)?esp_partition_find_first(ESP_PARTITION_TYPE_APP,record[20],NULL):esp_ota_get_next_update_partition(NULL);
        if(!destination || destination==esp_ota_get_running_partition() || manifest->size>destination->size || esp_ota_begin(destination,manifest->size,&ota_handle)!=ESP_OK) {reason=6;return false;}
        ota_open=true;
    } else {
        const char *label=record[12]==1?"assets_b":"assets_a";
        destination=esp_partition_find_first(ESP_PARTITION_TYPE_DATA,ESP_PARTITION_SUBTYPE_DATA_SPIFFS,label);
        if(!destination || destination->size!=manifest->size || esp_partition_erase_range(destination,0,destination->size)!=ESP_OK) {reason=6;return false;}
    }
    return true;
}
static bool write_flash(void *unused,uint32_t offset,const uint8_t *bytes,size_t size) {
    (void)unused;if(!destination)return false;
    bool ok=ota_open?esp_ota_write(ota_handle,bytes,size)==ESP_OK:esp_partition_write(destination,offset,bytes,size)==ESP_OK;
    if(!ok)reason=6;
    return ok;
}
static bool matches_flash(void *unused,uint32_t offset,const uint8_t *bytes,size_t size) {
    (void)unused;uint8_t check[440];return destination && size<=sizeof(check) && esp_partition_read(destination,offset,check,size)==ESP_OK && !memcmp(check,bytes,size);
}
static bool hash_partition(const esp_partition_t *partition,const bj_update_manifest_t *manifest) {
    uint8_t block[1024],digest[32];mbedtls_md_context_t context;mbedtls_md_init(&context);
    const mbedtls_md_info_t *sha=mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    bool ok=sha && mbedtls_md_setup(&context,sha,0)==0 && mbedtls_md_starts(&context)==0;
    for(uint32_t offset=0;ok && offset<manifest->size;offset+=sizeof(block)) {
        size_t size=manifest->size-offset;if(size>sizeof(block))size=sizeof(block);
        ok=esp_partition_read(partition,offset,block,size)==ESP_OK && mbedtls_md_update(&context,block,size)==0;
    }
    ok=ok && mbedtls_md_finish(&context,digest)==0 && !memcmp(digest,manifest->sha256,32);mbedtls_md_free(&context);
    if(!ok)reason=7;
    return ok;
}
static bool commit_asset(void *bytes) {return persist((const uint8_t *)bytes);}
static bool finish_flash(void *unused,const bj_update_manifest_t *manifest) {
    (void)unused;if(!hash_partition(destination,manifest))return false;
    uint8_t next[60];memcpy(next,record,60);
    if(manifest->kind==BJ_UPDATE_FIRMWARE) {
        if(esp_ota_end(ota_handle)!=ESP_OK) {ota_open=false;reason=8;return false;}ota_open=false;
        esp_app_desc_t description;
        if(esp_ota_get_partition_description(destination,&description)!=ESP_OK) {reason=8;return false;}
        /* 镜像app版本字段必须与签名release整数一致，不能只信上传的版本。 */
        char expected[16];snprintf(expected,sizeof(expected),"%lu",(unsigned long)manifest->version);
        if(strcmp(description.version,expected)) {reason=8;return false;}
        put32(next+16,manifest->version);next[20]=(uint8_t)destination->subtype;memcpy(next+24,manifest->sha256,32);put32(next+56,manifest->size);
        if(!persist(next))return false;
        if(esp_ota_set_boot_partition(destination)!=ESP_OK){reason=8;return false;}
    } else {
        if(!bj_asset_runtime_validate(destination,BJ_FIRMWARE_RELEASE_VERSION)) {reason=9;return false;}
        next[12]=strcmp(destination->label,"assets_a")?2:1;put32(next+8,manifest->version);
        if(!bj_asset_runtime_activate(destination,commit_asset,next)) {if(reason!=10)reason=8;return false;}
        update.floor_version[1]=manifest->version;
    }
    return true;
}
esp_err_t bj_update_runtime_init(void) {
    if(storage_fault)return ESP_FAIL;
    if(ready)return ESP_OK;
    if(nvs_open("baji_v2",NVS_READWRITE,&storage)!=ESP_OK)return ESP_FAIL;
    size_t size=sizeof(record);esp_err_t result=nvs_get_blob(storage,"upgrade",record,&size);
    if(result==ESP_ERR_NVS_NOT_FOUND){memset(record,0,60);memcpy(record,"BJU2",4);put32(record+4,BJ_FIRMWARE_RELEASE_VERSION);if(!persist(record))return ESP_FAIL;}
    else if(result!=ESP_OK || size!=60 || memcmp(record,"BJU2",4) || record[12]>2)return ESP_FAIL;
    const bj_update_adapter_t adapter={.verify=verify,.begin=begin_flash,.write=write_flash,.matches=matches_flash,.finish=finish_flash,.abort=abort_flash,.recover=recovery};
    static const uint8_t target[16]="baji-s3-175c-v1";
    ready=bj_update_init(&update,&adapter,target,read32(record+4),read32(record+8));return ready?ESP_OK:ESP_FAIL;
}
bool bj_update_runtime_begin(const uint8_t *body,size_t size) {
    if(storage_fault){state=3;reason=10;return false;}
    if(!ready)return false;
    reason=1;bool result=bj_update_begin(&update,body,size);state=result?(update.verified?2:1):3;if(result)reason=0;return result;
}
bool bj_update_runtime_chunk(const uint8_t *body,size_t size) {
    if(storage_fault){state=3;reason=10;return false;}
    if(!ready || !body || size<21 || size>460)return false;
    reason=5;bool result=bj_update_write(&update,body,read32(body+16),body+20,size-20);if(result)reason=0;else if(!update.active)state=3;return result;
}
bool bj_update_runtime_finish(const uint8_t *body,size_t size) {
    if(storage_fault){state=3;reason=10;return false;}
    if(!ready || !body || size!=16)return false;
    if(state==2 && !memcmp(body,update.manifest.transfer_id,16))return true;
    reason=5;bool result=bj_update_finish(&update,body);state=result?2:3;if(result)reason=0;return result;
}
void bj_update_runtime_abort(uint8_t why) {if(ready && (update.active || update.verified)){bj_update_abort(&update);state=3;reason=why;}}
void bj_update_runtime_status(uint8_t out[40]) {
    memset(out,0,40);out[0]=1;out[1]=state;out[3]=reason;
    if(ready){out[2]=(uint8_t)update.manifest.kind;memcpy(out+4,update.manifest.transfer_id,16);put32(out+20,update.received);put32(out+24,update.manifest.size);put32(out+28,update.manifest.version);put32(out+32,update.floor_version[0]);put32(out+36,update.floor_version[1]);}
}
esp_err_t bj_update_runtime_restore_assets(void) {
    if(!ready)return ESP_FAIL;
    if(!record[12])return ESP_OK;
    const esp_partition_t *partition=esp_partition_find_first(ESP_PARTITION_TYPE_DATA,ESP_PARTITION_SUBTYPE_DATA_SPIFFS,record[12]==1?"assets_a":"assets_b");
    if(!bj_asset_runtime_validate(partition,BJ_FIRMWARE_RELEASE_VERSION) || !bj_asset_runtime_activate(partition,NULL,NULL)){reason=9;return ESP_FAIL;}
    return ESP_OK;
}
esp_err_t bj_update_runtime_confirm_boot(bool healthy) {
    if(!ready)return ESP_FAIL;
    const esp_partition_t *running=esp_ota_get_running_partition();esp_ota_img_states_t image_state;
    if(esp_ota_get_state_partition(running,&image_state)!=ESP_OK)return ESP_FAIL;
    if(image_state!=ESP_OTA_IMG_PENDING_VERIFY) {
        /* set_boot失败或回滚后不得永久锁死；已提升floor不降低，仅保留同包恢复例外。 */
        if(read32(record+16) && read32(record+16)>read32(record+4)) {uint8_t cleared[60];memcpy(cleared,record,60);memset(cleared+16,0,44);if(!persist(cleared))return ESP_FAIL;}
        return ESP_OK;
    }
    uint32_t pending=read32(record+16),floor=read32(record+4),size=read32(record+56);
    if(!healthy || !pending || pending<floor || record[20]!=running->subtype || pending!=BJ_FIRMWARE_RELEASE_VERSION || !size || size>running->size)return esp_ota_mark_app_invalid_rollback_and_reboot();
    bj_update_manifest_t manifest={.size=size};memcpy(manifest.sha256,record+24,32);
    if(!hash_partition(running,&manifest))return esp_ota_mark_app_invalid_rollback_and_reboot();
    uint8_t next[60];memcpy(next,record,60);put32(next+4,pending>floor?pending:floor);
    if(!persist(next))return esp_ota_mark_app_invalid_rollback_and_reboot();
    esp_err_t result=esp_ota_mark_app_valid_cancel_rollback();if(result!=ESP_OK)return esp_ota_mark_app_invalid_rollback_and_reboot();
    update.floor_version[0]=read32(next+4);memset(next+16,0,44);return persist(next)?ESP_OK:ESP_FAIL;
}
