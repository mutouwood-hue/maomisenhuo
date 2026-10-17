
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>
#define BSP_LCD_H_RES 466
#define MALLOC_CAP_INTERNAL 1
#define MALLOC_CAP_DMA 2
#define MALLOC_CAP_8BIT 4
#define ESP_LOGW(...) ((void)0)
static size_t available,largest,freeAfterProbe;static int allocCalls,freeCalls,failAt,regs,failRegs,heights[3];
static size_t heap_caps_get_free_size(uint32_t c){assert(c==7);return allocCalls?freeAfterProbe:available;}
static size_t heap_caps_get_largest_free_block(uint32_t c){assert(c==7);return largest;}
static void* heap_caps_aligned_alloc(size_t alignment,size_t bytes,uint32_t caps){assert(alignment==64&&bytes==18640&&caps==7);allocCalls++;return allocCalls==failAt?NULL:malloc(1);}
static void tracking_free(void *p){if(p)freeCalls++;free(p);}
typedef struct{int dummy;}lv_display_t;
static lv_display_t result;
typedef struct{struct{unsigned buffer_height;}profile;}cfg_t;
static lv_display_t* esp_lv_adapter_register_display(cfg_t *cfg){heights[regs++]=cfg->profile.buffer_height;return regs<=failRegs?NULL:&result;}
static lv_display_t *run(void){
#define free tracking_free
    const uint32_t dma_caps=MALLOC_CAP_INTERNAL|MALLOC_CAP_DMA|MALLOC_CAP_8BIT;
    const size_t double20=BSP_LCD_H_RES*20u*2u*2u;
    uint16_t rows=10;
    size_t free_before=heap_caps_get_free_size(dma_caps);
    size_t largest_before=heap_caps_get_largest_free_block(dma_caps);
    if(free_before>=double20+96u*1024u && largest_before>=BSP_LCD_H_RES*20u*2u+4096u){
        void *probe1=heap_caps_aligned_alloc(64,BSP_LCD_H_RES*20u*2u,dma_caps);
        void *probe2=probe1?heap_caps_aligned_alloc(64,BSP_LCD_H_RES*20u*2u,dma_caps):NULL;
        if(probe1&&probe2&&heap_caps_get_free_size(dma_caps)>=96u*1024u)rows=20;
        free(probe1);free(probe2);
    }

#undef free
 cfg_t disp_cfg={.profile={.buffer_height=rows}};
    lv_display_t *disp = esp_lv_adapter_register_display(&disp_cfg);
    if(!disp && rows==20){
        ESP_LOGW(TAG,"20-row registration failed; retry deployed 10 internal rows");
        disp_cfg.profile.buffer_height=10;
        disp=esp_lv_adapter_register_display(&disp_cfg);
    }
    if(!disp)return NULL;

 return disp;
}
static void reset(void){available=200000;largest=100000;freeAfterProbe=110000;allocCalls=freeCalls=failAt=regs=failRegs=0;}
int main(void){
 reset();assert(run()==&result);assert(allocCalls==2&&freeCalls==2&&regs==1&&heights[0]==20);
 reset();available=37280+98304-1;assert(run()==&result);assert(!allocCalls&&!freeCalls&&heights[0]==10);
 reset();largest=18640+4096-1;assert(run()==&result);assert(!allocCalls&&heights[0]==10);
 reset();failAt=1;assert(run()==&result);assert(allocCalls==1&&!freeCalls&&heights[0]==10);
 reset();failAt=2;assert(run()==&result);assert(allocCalls==2&&freeCalls==1&&heights[0]==10);
 reset();freeAfterProbe=98303;assert(run()==&result);assert(freeCalls==2&&heights[0]==10);
 reset();freeAfterProbe=98304;available=37280+98304;largest=22736;assert(run()==&result);assert(allocCalls==2&&freeCalls==2&&heights[0]==20);
 reset();failRegs=1;assert(run()==&result);assert(regs==2&&heights[0]==20&&heights[1]==10&&freeCalls==2);
 reset();failRegs=2;assert(run()==NULL);assert(regs==2&&freeCalls==2);
 reset();available=0;failRegs=1;assert(run()==NULL);assert(regs==1&&heights[0]==10);
 puts("10 production-fragment BSP scenarios passed (heap/registration substitutes)");
}
