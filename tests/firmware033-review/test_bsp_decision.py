from pathlib import Path
import subprocess,json,hashlib
H=Path(__file__).resolve().parent;R=H.parents[1];P=R/'artifacts/firmware-local-v3-perf/source/components/waveshare__esp32_s3_touch_amoled_1_75c/esp32_s3_touch_amoled_1_75c.c'
s=P.read_text();a=s.index('    const uint32_t dma_caps=');b=s.index('    ESP_LOGI(TAG,"Internal display buffer decision',a);decision=s[a:b]
a=s.index('    lv_display_t *disp = esp_lv_adapter_register_display(&disp_cfg);',b);b=s.index('    ESP_LOGI(TAG,"Display draw buffers',a);fallback=s[a:b]
c=r'''
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
DECISION
#undef free
 cfg_t disp_cfg={.profile={.buffer_height=rows}};
FALLBACK
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
'''.replace('DECISION',decision).replace('FALLBACK',fallback)
(H/'bsp-fragments.c').write_text(c);cmd=['clang','-std=c11','-Wall','-Wextra','-Werror',str(H/'bsp-fragments.c'),'-o',str(H/'bsp-fragments')];p=subprocess.run(cmd,capture_output=True,text=True);(H/'bsp-compile.log').write_text(p.stdout+p.stderr);assert p.returncode==0
p=subprocess.run([str(H/'bsp-fragments')],capture_output=True,text=True);(H/'bsp-run.log').write_text(p.stdout+p.stderr);assert p.returncode==0
(H/'bsp-report.json').write_text(json.dumps({'pass':True,'scenarios':10,'sourceSha256':hashlib.sha256(P.read_bytes()).hexdigest(),'productionDecisionAndRetryFragments':True,'limit':'heap/alignment/register substitutes; adapter cleanup verified by static source, not real allocations or device'},indent=2)+'\n');print(p.stdout)
