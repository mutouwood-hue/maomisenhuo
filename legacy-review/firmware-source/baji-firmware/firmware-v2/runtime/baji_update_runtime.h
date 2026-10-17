#pragma once
#include "baji_update.h"
#include "esp_err.h"
/** 全部接口只允许数据worker调用；trusted release公钥必须通过构建外置。 */
esp_err_t bj_update_runtime_init(void);
bool bj_update_runtime_begin(const uint8_t *,size_t);
bool bj_update_runtime_chunk(const uint8_t *,size_t);
bool bj_update_runtime_finish(const uint8_t *,size_t);
void bj_update_runtime_abort(uint8_t reason);
void bj_update_runtime_status(uint8_t out[40]);
/** 新槽启动先完成健康检查，再持久确认版本，最后mark-valid。 */
esp_err_t bj_update_runtime_confirm_boot(bool healthy);
esp_err_t bj_update_runtime_restore_assets(void);
