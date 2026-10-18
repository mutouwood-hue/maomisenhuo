#pragma once
#include "local2_core.h"
#include "esp_err.h"
/* Only cf_local2/state. nvs_flash_init without automatic erase. */
esp_err_t local2_init(void);
/* Lock API: returned non-NULL core is protected until release, same task only.
 * Do not wait on radio, UI, or any other lock while holding this mutex. */
l2_core_t *l2_runtime_core(uint32_t timeout_ms);
void l2_runtime_release(void);
/* Thread-safe UI wrappers; no direct cross-thread core mutation. */
void local2_get_view(l2_view_t *);
l2_status_t local2_emit_care(l2_action_t,uint64_t epoch_ms);
l2_status_t local2_present_gift_state(l2_gift_state_t);
