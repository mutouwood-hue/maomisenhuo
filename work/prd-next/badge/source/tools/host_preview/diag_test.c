/* Compile actual diagnostic C against actual LVGL; platform/USB/heap/domain are
 * deterministic software substitutes. No device or driver is opened. */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include "lvgl.h"
#include "local2_store.h"
#include "driver/usb_serial_jtag.h"
static char output[2*1024*1024];static size_t used;static unsigned checks,write_count,fail_after;
static bool moving,low_memory,alloc_fail,cancel_transfer,domain_locked,ui_locked,domain_busy;
static l2_core_t core_fixture;static bool clock_valid=true;
static void check(bool b){assert(b);checks++;}
static void clear(void){used=0;output[0]=0;write_count=0;fail_after=0;}
int usb_serial_jtag_read_bytes(void*b,uint32_t n,TickType_t t){(void)t;if(cancel_transfer&&n){*(char*)b='X';cancel_transfer=false;return 1;}return 0;}
int usb_serial_jtag_write_bytes(const void*s,size_t n,TickType_t t){(void)t;assert(!domain_locked&&!ui_locked);if(fail_after&&++write_count>=fail_after)return 0;assert(used+n<sizeof(output));memcpy(output+used,s,n);used+=n;output[used]=0;return (int)n;}
bool usb_serial_jtag_is_driver_installed(void){return false;}
esp_err_t usb_serial_jtag_driver_install(usb_serial_jtag_driver_config_t*c){(void)c;return ESP_OK;}
esp_err_t usb_serial_jtag_driver_uninstall(void){return ESP_OK;}
void usb_serial_jtag_vfs_use_driver(void){}
void usb_serial_jtag_vfs_use_nonblocking(void){}
int xTaskCreate(void (*f)(void*),const char*n,unsigned s,void*a,unsigned p,void*h){(void)f;(void)n;(void)s;(void)a;(void)p;(void)h;return 1;}
void vTaskDelay(unsigned t){(void)t;}
size_t heap_caps_get_free_size(uint32_t c){(void)c;return low_memory?0:8*1024*1024;}
size_t heap_caps_get_largest_free_block(uint32_t c){return heap_caps_get_free_size(c);}
size_t heap_caps_get_minimum_free_size(uint32_t c){return heap_caps_get_free_size(c);}
void *heap_caps_aligned_calloc(size_t a,size_t n,size_t s,uint32_t c){(void)a;(void)c;return alloc_fail?NULL:calloc(n,s);}
uint32_t esp_rom_crc32_le(uint32_t crc,const uint8_t*p,uint32_t n){crc=~crc;while(n--){crc^=*p++;for(int b=0;b<8;b++)crc=(crc>>1)^(0xedb88320u&-(crc&1));}return ~crc;}
int mbedtls_base64_encode(unsigned char*out,size_t cap,size_t*olen,const unsigned char*in,size_t n){static const char t[]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";size_t size=(n+2)/3*4;if(cap<=size)return -1;size_t j=0;for(size_t i=0;i<n;i+=3){unsigned v=(unsigned)in[i]<<16;if(i+1<n)v|=in[i+1]<<8;if(i+2<n)v|=in[i+2];out[j++]=t[v>>18];out[j++]=t[(v>>12)&63];out[j++]=i+1<n?t[(v>>6)&63]:'=';out[j++]=i+2<n?t[v&63]:'=';}*olen=j;return 0;}
esp_err_t bsp_display_lock(unsigned timeout){(void)timeout;assert(!ui_locked);ui_locked=true;return ESP_OK;}
void bsp_display_unlock(void){assert(ui_locked);ui_locked=false;}
bool badge_ui_capture_allowed(void){return !moving;}
bool badge_ui_diagnostic_select_face(unsigned f){return !moving&&f<3;}
l2_core_t *l2_runtime_core(uint32_t timeout){(void)timeout;if(domain_busy)return NULL;assert(!domain_locked);domain_locked=true;return &core_fixture;}
void l2_runtime_release(void){assert(domain_locked);domain_locked=false;}
void l2_get_view(const l2_core_t*c,l2_view_t*v){assert(c==&core_fixture&&domain_locked);memset(v,0,sizeof(*v));v->ready=true;v->has_snapshot=true;strcpy(v->device_id,"00112233445566778899aabbccddeeff");strcpy(v->snapshot.pet.pet_id,"id-with-quote-\"-and-slash-\\");v->snapshot.revision=31;v->snapshot.scene=L2_SCENE_AWAY;v->snapshot.action=L2_ACTION_IDLE;v->pending_events=2;v->last_ack=7;v->next_event=10;}
bool local2_clock_now(uint64_t*p){*p=clock_valid?1792118400000ULL:0;return clock_valid;}
int local2_clock_utc_offset_minutes(void){return 480;}
#include "../../main/badge_diagnostics.c"
static void read_point(lv_indev_t*i,lv_indev_data_t*d){(void)i;d->state=LV_INDEV_STATE_RELEASED;}
int main(int argc,char**argv){
    check(argc==2);lv_init();lv_tick_inc(1000);lv_display_t*d=lv_display_create(466,466);lv_display_set_color_format(d,LV_COLOR_FORMAT_RGB565);
    static uint16_t draw[466*20];lv_display_set_buffers(d,draw,NULL,sizeof(draw),LV_DISPLAY_RENDER_MODE_PARTIAL);
    lv_indev_t*i=lv_indev_create();lv_indev_set_read_cb(i,read_point);badge_diagnostics_attach(d,i);
    lv_obj_t*r=lv_display_get_screen_active(d);lv_obj_set_style_bg_color(r,lv_color_hex(0x123456),0);lv_obj_set_style_bg_opa(r,LV_OPA_COVER,0);
    clear();low_memory=true;capture();check(strstr(output,"MEMORY_BUDGET")!=NULL);low_memory=false;
    clear();alloc_fail=true;capture();check(strstr(output,"ERROR ALLOC")!=NULL);alloc_fail=false;
    clear();moving=true;capture();check(strstr(output,"UI_MOVING")!=NULL);select_face(1);check(strstr(output,"VIEW_REQUIRES")!=NULL);moving=false;
    clear();capture();check(strstr(output,"CFDIAG BEGIN ")&&strstr(output,"CFDIAG END 1"));FILE*f=fopen(argv[1],"wb");check(f!=NULL);check(fwrite(output,1,used,f)==used);fclose(f);
    clear();cancel_transfer=true;capture();check(strstr(output,"CFDIAG ABORT 2")!=NULL);check(strstr(output,"CFDIAG END")==NULL);
    clear();fail_after=3;capture();check(strstr(output,"CFDIAG END")==NULL);
    clear();state();check(strstr(output,"id-with-quote-\\\"-and-slash-\\\\")!=NULL);check(strstr(output,"\"clockValid\":true")!=NULL);check(!domain_locked);
    clear();domain_busy=true;state();check(strstr(output,"DOMAIN_BUSY")!=NULL);domain_busy=false;
    clear();clock_valid=false;state();check(strstr(output,"\"clockValid\":false")!=NULL);check(strstr(output,"\"nowMs\":0")!=NULL);
    clear();select_face(2);check(strstr(output,"diagnostic_ui_selection")!=NULL);check(diagnostic_selection&&selection_id==1);
    clear();select_face(3);check(strstr(output,"VIEW_REQUIRES")!=NULL);check(selection_id==1);
    uint64_t before=perf.input_polls;lv_indev_data_t id={0};input_wrapper(i,&id);check(perf.input_polls==before+1);
    clear();stats(true);check(strstr(output,"physicalScanoutMeasured\":false")!=NULL);check(perf.input_polls==0);check(!ui_locked);
    command_parser_t parser={0};const char *cmd="CFDIAG STATE\r\n";clear();for(const char*c=cmd;*c;c++)command_byte(&parser,*c);check(strstr(output,"CFDIAG STATE {")!=NULL);check(parser.len==0&&!parser.invalid);
    clear();cmd="CFDIAG VIEW 9\n";for(const char*c=cmd;*c;c++)command_byte(&parser,*c);check(strstr(output,"UNKNOWN_COMMAND")!=NULL);
    clear();for(unsigned j=0;j<100;j++)command_byte(&parser,'X');command_byte(&parser,'\n');check(strstr(output,"COMMAND_INVALID_OR_TOO_LONG")!=NULL);check(parser.len==0&&!parser.invalid);
    clear();cmd="CFDIAG STATE";for(const char*c=cmd;*c;c++)command_byte(&parser,*c);command_byte(&parser,0);command_byte(&parser,'\n');check(strstr(output,"CFDIAG STATE {")==NULL);check(strstr(output,"COMMAND_INVALID_OR_TOO_LONG")!=NULL);
    clear();cmd="CFDIAG STATE\n";for(const char*c=cmd;*c;c++)command_byte(&parser,*c);check(strstr(output,"CFDIAG STATE {")!=NULL);
    clear();cmd="CFDIAG VIEW 0\n";for(const char*c=cmd;*c;c++)command_byte(&parser,*c);check(strstr(output,"\"face\":0")!=NULL);
    printf("{\"offline\":true,\"actualDiagnosticC\":true,\"platformUsbHeapDomainSubstitutes\":true,\"hardware\":false,\"checksPassed\":%u}\n",checks);
}
