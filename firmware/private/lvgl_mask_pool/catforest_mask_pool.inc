/* CatForest optional geometry workspace for pinned LVGL 9.5.0.
 * Private implementation only: public LVGL/global structs and legacy4 stay intact.
 * A single external allocation is published only after every capability check.
 * Pool slices must NEVER be passed to lv_free. AA math below remains upstream.
 */
#include <stdint.h>
#include "lv_version.h"
#if LVGL_VERSION_MAJOR != 9 || LVGL_VERSION_MINOR != 5 || LVGL_VERSION_PATCH != 0
#error "Re-review CatForest mask pool on LVGL version change"
#endif
#if LV_DRAW_SW_CIRCLE_CACHE_SIZE != 4
#error "CatForest fallback requires the pinned legacy4 configuration"
#endif
#define CF_MASK_SLOTS 12u
#define CF_MASK_MAX_RADIUS 233u
#define CF_MASK_STRIDE (CF_MASK_MAX_RADIUS * 6u + 6u)
#define CF_MASK_DATA_BYTES (CF_MASK_SLOTS * CF_MASK_STRIDE)
#define CF_MASK_SCRATCH_BYTES ((CF_MASK_MAX_RADIUS + 1u) * 16u)
#define CF_MASK_POOL_BYTES (CF_MASK_DATA_BYTES + CF_MASK_SCRATCH_BYTES)
#define CF_MASK_ALIGN 16u
#define CF_MASK_PSRAM_RESERVE (2u * 1024u * 1024u)
_Static_assert(CF_MASK_DATA_BYTES % CF_MASK_ALIGN == 0, "scratch alignment");
_Static_assert(CF_MASK_POOL_BYTES == 20592, "bounded workspace");

#if defined(CATFOREST_MASK_POOL_HOST_TEST)
/* Explicit hardware substitutes, defined only by the standalone host fixture. */
extern bool cf_mask_test_supported(void);
extern size_t cf_mask_test_free_bytes(void);
extern size_t cf_mask_test_largest_bytes(void);
extern void *cf_mask_test_allocate(size_t alignment,size_t bytes);
extern bool cf_mask_test_external(const void *p);
extern size_t cf_mask_test_allocated_bytes(const void *p);
extern void cf_mask_test_release(void *p);
#define cf_port_supported cf_mask_test_supported
#define cf_port_free cf_mask_test_free_bytes
#define cf_port_largest cf_mask_test_largest_bytes
#define cf_port_alloc cf_mask_test_allocate
#define cf_port_external cf_mask_test_external
#define cf_port_size cf_mask_test_allocated_bytes
#define cf_port_release cf_mask_test_release
#elif defined(ESP_PLATFORM)
#include "esp_heap_caps.h"
#include "esp_memory_utils.h"
#include "esp_log.h"
static bool cf_port_supported(void) {
#if defined(CONFIG_SPIRAM) && CONFIG_SPIRAM
    return true;
#else
    return false;
#endif
}
static size_t cf_port_free(void) {return heap_caps_get_free_size(MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);}
static size_t cf_port_largest(void) {return heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);}
static void *cf_port_alloc(size_t a,size_t n) {return heap_caps_aligned_calloc(a,1,n,MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);}
static bool cf_port_external(const void *p) {return esp_ptr_external_ram(p);}
static size_t cf_port_size(void *p) {return heap_caps_get_allocated_size(p);}
static void cf_port_release(void *p) {heap_caps_free(p);}
#else
/* Desktop/default unsupported is deliberately the unchanged native4 path. */
static bool cf_port_supported(void) {return false;}
static size_t cf_port_free(void) {return 0;}
static size_t cf_port_largest(void) {return 0;}
static void *cf_port_alloc(size_t a,size_t n) {(void)a;(void)n;return NULL;}
static bool cf_port_external(const void *p) {(void)p;return false;}
static size_t cf_port_size(void *p) {(void)p;return 0;}
static void cf_port_release(void *p) {(void)p;}
#endif

static lv_draw_sw_mask_radius_circle_dsc_t cf_mask_circles[CF_MASK_SLOTS];
static uint8_t *cf_mask_block;
static unsigned cf_mask_legacy_temporary_refs;
static bool cf_mask_mutex_initialized;
static bool cf_mask_attempted;
static bool cf_mask_deinit_pending;

static int cf_mask_slot(const lv_draw_sw_mask_radius_circle_dsc_t *c)
{
    /* Equality comparisons remain defined for unrelated legacy/temp pointers. */
    for(unsigned i=0;i<CF_MASK_SLOTS;i++)if(c==&cf_mask_circles[i])return (int)i;
    return -1;
}
static bool cf_mask_pool_referenced(void)
{
    for(unsigned i=0;i<CF_MASK_SLOTS;i++)if(cf_mask_circles[i].used_cnt)return true;
    return false;
}
static bool cf_mask_any_referenced(void)
{
    if(cf_mask_pool_referenced() || cf_mask_legacy_temporary_refs)return true;
    for(unsigned i=0;i<LV_DRAW_SW_CIRCLE_CACHE_SIZE;i++)if(_circle_cache[i].used_cnt)return true;
    return false;
}
static void cf_mask_clean_unused(void)
{
    for(unsigned i=0;i<LV_DRAW_SW_CIRCLE_CACHE_SIZE;i++)if(!_circle_cache[i].used_cnt) {
        if(_circle_cache[i].buf)lv_free(_circle_cache[i].buf);
        lv_memzero(&_circle_cache[i],sizeof(_circle_cache[i]));
    }
    for(unsigned i=0;i<CF_MASK_SLOTS;i++)if(!cf_mask_circles[i].used_cnt)
        lv_memzero(&cf_mask_circles[i],sizeof(cf_mask_circles[i]));
}
static void cf_mask_release_pool(void)
{
    /* Caller holds circle_cache_mutex; retain all slices while any owner lives. */
    if(cf_mask_pool_referenced())return;
    if(cf_mask_block)cf_port_release(cf_mask_block);
    cf_mask_block=NULL;
    lv_memzero(cf_mask_circles,sizeof(cf_mask_circles));
    cf_mask_attempted=false;
}
static void cf_mask_log(const char *reason)
{
#ifdef ESP_PLATFORM
    ESP_LOGI("mask_pool","optional12 %s; pool=%u PSRAM bytes; legacy4 retained",reason,(unsigned)CF_MASK_POOL_BYTES);
#else
    (void)reason;
#endif
}
static void cf_mask_try_init(void)
{
    if(cf_mask_attempted)return;
    cf_mask_attempted=true;
    if(!cf_port_supported()){cf_mask_log("unsupported");return;}
    if(cf_port_free()<CF_MASK_PSRAM_RESERVE+CF_MASK_POOL_BYTES || cf_port_largest()<CF_MASK_POOL_BYTES) {
        cf_mask_log("budget denied");return;
    }
    void *block=cf_port_alloc(CF_MASK_ALIGN,CF_MASK_POOL_BYTES);
    if(!block){cf_mask_log("allocation denied");return;}
    if(((uintptr_t)block % CF_MASK_ALIGN)!=0 || !cf_port_external(block) || cf_port_size(block)<CF_MASK_POOL_BYTES) {
        cf_port_release(block);cf_mask_log("capability denied");return;
    }
    /* Allocator overhead/concurrent users can consume the prefetched margin.
     * Recheck actual free PSRAM after allocation, before publishing any state. */
    if(cf_port_free()<CF_MASK_PSRAM_RESERVE) {
        cf_port_release(block);cf_mask_log("post-allocation budget denied");return;
    }
    /* No descriptor or ready pointer has been published on any failed branch. */
    lv_memzero(cf_mask_circles,sizeof(cf_mask_circles));
    cf_mask_block=block;
    cf_mask_log("enabled");
}
static lv_draw_sw_mask_radius_circle_dsc_t *cf_mask_acquire(int32_t radius)
{
    if(!cf_mask_block || cf_mask_deinit_pending || radius<1 || radius>(int32_t)CF_MASK_MAX_RADIUS)return NULL;
    for(unsigned i=0;i<CF_MASK_SLOTS;i++)if(cf_mask_circles[i].radius==radius) {
        cf_mask_circles[i].used_cnt++;
        CIRCLE_CACHE_AGING(cf_mask_circles[i].life,radius);
        return &cf_mask_circles[i];
    }
    lv_draw_sw_mask_radius_circle_dsc_t *entry=NULL;
    for(unsigned i=0;i<CF_MASK_SLOTS;i++)if(!cf_mask_circles[i].used_cnt) {
        if(!entry || cf_mask_circles[i].life<entry->life)entry=&cf_mask_circles[i];
    }
    /* All12 referenced: do not allocate a pool-owned temporary. Legacy4 has
     * separate ownership, including its original temporary descriptor path. */
    if(!entry)return NULL;
    entry->used_cnt++;
    entry->life=0;
    CIRCLE_CACHE_AGING(entry->life,radius);
    circ_calc_aa4(entry,radius);
    return entry;
}
