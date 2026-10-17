#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#define BJ_UPDATE_TARGET_SIZE 16u
#define BJ_UPDATE_SIGNATURE_MAX 80u
#define BJ_UPDATE_MANIFEST_BODY 74u
typedef enum { BJ_UPDATE_FIRMWARE=1, BJ_UPDATE_ASSETS=2 } bj_update_kind_t;
typedef struct {uint8_t target[16],sha256[32],transfer_id[16];uint32_t version,size;bj_update_kind_t kind;} bj_update_manifest_t;
typedef struct {
    bool (*verify)(void *,const uint8_t *,size_t,const uint8_t *,size_t);
    bool (*begin)(void *,const bj_update_manifest_t *);
    bool (*write)(void *,uint32_t,const uint8_t *,size_t);
    bool (*matches)(void *,uint32_t,const uint8_t *,size_t);
    bool (*finish)(void *,const bj_update_manifest_t *);
    void (*abort)(void *);
    bool (*recover)(void *,const bj_update_manifest_t *);
    void *context;
} bj_update_adapter_t;
typedef struct {bj_update_adapter_t adapter;bj_update_manifest_t manifest;uint8_t target[16];uint32_t floor_version[2],received;bool active,fault,verified;} bj_update_t;
bool bj_update_init(bj_update_t *,const bj_update_adapter_t *,const uint8_t target[16],uint32_t firmware_version,uint32_t asset_version);
/** verify须校验BAJI-UPDATE-v1域与74B固定body的发布签名；缺可信key不得升级。 */
bool bj_update_begin(bj_update_t *,const uint8_t *,size_t);
bool bj_update_write(bj_update_t *,const uint8_t transfer_id[16],uint32_t,const uint8_t *,size_t);
bool bj_update_finish(bj_update_t *,const uint8_t transfer_id[16]);
void bj_update_abort(bj_update_t *);
