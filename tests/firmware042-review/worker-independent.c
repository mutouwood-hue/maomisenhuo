/* Actual target worker+renderer with explicit host ESP/USB/clock/heap substitutes. */
#include "badge_renderer_panel.h"
#include "esp_heap_caps.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
static const char *mode;static unsigned allocs,read_calls,yields;static int64_t clock_us;
void *heap_caps_calloc(size_t n,size_t z,unsigned caps){assert(caps==(MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT));allocs++;return !strcmp(mode,"allocfail")?NULL:calloc(n,z);}
size_t heap_caps_get_free_size(unsigned caps){return caps&MALLOC_CAP_DMA?(!strcmp(mode,"dmafail")?65000:68000):8000000;}
size_t heap_caps_get_minimum_free_size(unsigned caps){(void)caps;return 35000;}
size_t heap_caps_get_largest_free_block(unsigned caps){(void)caps;return 31744;}
bool esp_ptr_in_drom(const void *p){assert(p);return strcmp(mode,"dromfail")!=0;}
bool esp_ptr_external_ram(const void *p){assert(p);return strcmp(mode,"notexternal")!=0;}
int64_t esp_timer_get_time(void){clock_us+=!strcmp(mode,"deadline")?1000000:10;return clock_us;}
void vTaskDelay(unsigned n){assert(n==1);clock_us+=1000;yields++;}
unsigned uxTaskGetStackHighWaterMark(void *p){assert(!p);return 5120;}
int usb_serial_jtag_read_bytes(void *p,size_t n,unsigned timeout){(void)p;assert(n==1&&timeout==0);read_calls++;return !strcmp(mode,"cancel")&&read_calls==5?1:0;}
uint32_t esp_rom_crc32_le(uint32_t crc,const uint8_t *p,size_t n){crc=~crc;for(size_t i=0;i<n;i++){crc^=p[i];for(unsigned j=0;j<8;j++)crc=(crc>>1)^((0u-(crc&1))&0xedb88320u);}return ~crc;}
int main(int argc,char **argv){assert(argc==2);mode=argv[1]; unsigned sample=!strcmp(mode,"normal1")?1:!strcmp(mode,"normal2")?2:0;
if(!strcmp(mode,"recovery")){mode="normal0";assert(badge_renderer_compute(0));assert(allocs==1);mode="cancel";read_calls=0;assert(!badge_renderer_compute(1));assert(!badge_renderer_stats()&&!badge_renderer_pixels());assert(!strcmp(badge_renderer_error(),"CANCELLED"));mode="normal2";assert(badge_renderer_compute(2));assert(allocs==1);sample=2;}
else {bool ok=badge_renderer_compute(sample);assert(ok==(!strncmp(mode,"normal",6)));assert((badge_renderer_pixels()!=NULL)==ok);assert((badge_renderer_stats()!=NULL)==ok);}
if(badge_renderer_pixels()){FILE *f=fopen("tests/firmware042-review/worker-pixels.rgb565","wb");assert(f);assert(fwrite(badge_renderer_pixels(),2,65536,f)==65536);fclose(f);}
char line[1536];badge_renderer_report(line,sizeof(line),false);puts(line);return 0;}
