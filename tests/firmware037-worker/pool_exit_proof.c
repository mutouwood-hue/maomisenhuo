#include <assert.h>
#include <stdio.h>
#include "lvgl.h"
#include "src/draw/sw/lv_draw_sw_mask_private.h"
#include "pool_port.h"
__attribute__((destructor)) static void pool_exit_proof(void){
 unsigned alloc=cf_test_alloc_calls;assert(alloc==1&&cf_test_live==1);cf_test_guards();lv_draw_sw_mask_cleanup();lv_draw_sw_mask_deinit();assert(cf_test_live==0&&cf_test_free_calls==1);fprintf(stderr,"POOL_PROOF explicit-capability alloc=%u release=%u bytes=20592\n",alloc,cf_test_free_calls);
}
