#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "esp_partition.h"
#include "lvgl.h"
typedef bool (*bj_asset_apply_fn)(void *,const lv_image_dsc_t *,const lv_image_dsc_t *);
typedef bool (*bj_asset_commit_fn)(void *);
void bj_asset_runtime_bind(bj_asset_apply_fn,void *);
/** inactive资产镜像校验及兼容范围验证；不得格式化失败镜像。 */
bool bj_asset_runtime_validate(const esp_partition_t *,uint32_t firmware_version);
bool bj_asset_runtime_activate(const esp_partition_t *,bj_asset_commit_fn,void *);
