/* Local physical USB diagnostics. No BLE/WiFi/network, persistence, or domain mutations.
 * Capture is an LVGL object-tree composition, NOT a panel readback or tear-free proof.
 */
#include "badge_diagnostics.h"
#include "badge_display_capture.h"
#include "local2_store.h"
extern bool local2_clock_now(uint64_t *out_ms);
extern int local2_clock_utc_offset_minutes(void);
#include "bsp/esp-bsp.h"
#include "bsp/display.h"
#include "driver/usb_serial_jtag.h"
#include "driver/usb_serial_jtag_vfs.h"
#include "esp_heap_caps.h"
#include "esp_memory_utils.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_rom_crc.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "mbedtls/base64.h"
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define SNAP_W 466u
#define SNAP_H 466u
#define SNAP_BYTES (SNAP_W*SNAP_H*2u)
#define CHUNK 384u
#define MAX_CAPTURE_US 15000000LL
static const char *TAG="badge_diag";
static lv_display_t *display;
static lv_indev_read_cb_t input_read;
static uint64_t frame_id,capture_id;
static bool diagnostic_capture,diagnostic_selection;
static uint64_t selection_id;
/* All metrics are updated/read under the LVGL BSP lock. No callback logging. */
typedef struct {uint64_t count,total_us,max_us;} metric_t;
static struct {
    uint64_t since_us,refr_requests,rendered,flush_count,flush_pixels,input_polls,pressed_polls;
    uint64_t render_start,flush_start,wait_start,input_previous;
    metric_t render,submit,wait,input_interval,input_read,ui_tick;
} perf;
static void add(metric_t *m,uint64_t us){m->count++;m->total_us+=us;if(us>m->max_us)m->max_us=us;}
static void display_event(lv_event_t *e)
{
    if(diagnostic_capture)return;
    uint64_t now=esp_timer_get_time();
    switch(lv_event_get_code(e)) {
    case LV_EVENT_REFR_START:perf.refr_requests++;break;
    case LV_EVENT_RENDER_START:perf.render_start=now;break;
    case LV_EVENT_RENDER_READY:if(perf.render_start)add(&perf.render,now-perf.render_start);perf.render_start=0;perf.rendered++;frame_id++;break;
    case LV_EVENT_FLUSH_START:{const lv_area_t *a=lv_event_get_param(e);perf.flush_start=now;perf.flush_count++;if(a)perf.flush_pixels+=(uint64_t)(a->x2-a->x1+1)*(a->y2-a->y1+1);break;}
    case LV_EVENT_FLUSH_FINISH:if(perf.flush_start)add(&perf.submit,now-perf.flush_start);perf.flush_start=0;break;
    case LV_EVENT_FLUSH_WAIT_START:perf.wait_start=now;break;
    case LV_EVENT_FLUSH_WAIT_FINISH:if(perf.wait_start)add(&perf.wait,now-perf.wait_start);perf.wait_start=0;break;
    default:break;
    }
}
static void input_wrapper(lv_indev_t *indev,lv_indev_data_t *data)
{
    uint64_t now=esp_timer_get_time();input_read(indev,data);
    if(diagnostic_capture)return;
    perf.input_polls++;if(data->state==LV_INDEV_STATE_PRESSED){perf.pressed_polls++;diagnostic_selection=false;}
    if(perf.input_previous)add(&perf.input_interval,now-perf.input_previous);
    perf.input_previous=now;add(&perf.input_read,esp_timer_get_time()-now);
}
void badge_diagnostics_ui_tick(uint64_t start_us)
{
    if(!diagnostic_capture)add(&perf.ui_tick,esp_timer_get_time()-start_us);
}
void badge_diagnostics_attach(lv_display_t *disp,lv_indev_t *input)
{
    display=disp;perf.since_us=esp_timer_get_time();
    lv_display_add_event_cb(display,display_event,LV_EVENT_ALL,NULL);
    input_read=lv_indev_get_read_cb(input);
    if(input_read)lv_indev_set_read_cb(input,input_wrapper);
}
/* Single USB task writes bounded complete lines. Console logs can interleave between
 * lines. A capture parser must reject any missing/duplicated offset or bad CRC. */
static bool send_line(const char *line)
{
    size_t len=strlen(line);
    return usb_serial_jtag_write_bytes(line,len,pdMS_TO_TICKS(100))==(int)len;
}
static void error(const char *reason)
{
    char line[160];snprintf(line,sizeof(line),"\nCFDIAG ERROR %s\n",reason);(void)send_line(line);
}
static void stats(bool reset)
{
    if(bsp_display_lock(1000)!=ESP_OK){error("UI_BUSY");return;}
    char line[1536];
#define MARGS(m) perf.m.count,perf.m.total_us,perf.m.max_us
    snprintf(line,sizeof(line),"\nCFDIAG PERF {\"schema\":1,\"sinceUs\":%"PRIu64",\"nowUs\":%"PRIi64",\"renderFrameId\":%"PRIu64",\"refreshRequests\":%"PRIu64",\"rendered\":%"PRIu64",\"flushCount\":%"PRIu64",\"pixelsSubmitted\":%"PRIu64",\"inputPolls\":%"PRIu64",\"pressedPolls\":%"PRIu64",\"render\":[%"PRIu64",%"PRIu64",%"PRIu64"],\"flushSubmit\":[%"PRIu64",%"PRIu64",%"PRIu64"],\"flushWait\":[%"PRIu64",%"PRIu64",%"PRIu64"],\"inputInterval\":[%"PRIu64",%"PRIu64",%"PRIu64"],\"inputRead\":[%"PRIu64",%"PRIu64",%"PRIu64"],\"appUiTick\":[%"PRIu64",%"PRIu64",%"PRIu64"],\"dmaFree\":%u,\"dmaLargest\":%u,\"dmaMinimum\":%u,\"psramFree\":%u,\"drawBufferBytes\":%u,\"drawDouble\":%s,\"buffer1Bytes\":%u,\"buffer2Bytes\":%u,\"buffer1DmaCapable\":%s,\"buffer2DmaCapable\":%s,\"physicalScanoutMeasured\":false}\n",
      perf.since_us,esp_timer_get_time(),frame_id,perf.refr_requests,perf.rendered,perf.flush_count,perf.flush_pixels,perf.input_polls,perf.pressed_polls,MARGS(render),MARGS(submit),MARGS(wait),MARGS(input_interval),MARGS(input_read),MARGS(ui_tick),
      (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL|MALLOC_CAP_DMA),(unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL|MALLOC_CAP_DMA),(unsigned)heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL|MALLOC_CAP_DMA),(unsigned)heap_caps_get_free_size(MALLOC_CAP_SPIRAM),(unsigned)lv_display_get_draw_buf_size(display),lv_display_is_double_buffered(display)?"true":"false",display->buf_1?(unsigned)display->buf_1->data_size:0,display->buf_2?(unsigned)display->buf_2->data_size:0,display->buf_1&&esp_ptr_dma_capable(display->buf_1->data)?"true":"false",display->buf_2&&esp_ptr_dma_capable(display->buf_2->data)?"true":"false");
    if(reset){memset(&perf,0,sizeof(perf));perf.since_us=esp_timer_get_time();}
    bsp_display_unlock();(void)send_line(line);
#undef MARGS
}
static void quote_ascii(const char *in,char *out)
{
    while(*in){if(*in=='"'||*in=='\\')*out++='\\';*out++=*in++;}*out=0;
}
static void state(void)
{
    /* Copy under domain mutex then release before any USB/UI wait. No secrets. */
    l2_core_t *core=l2_runtime_core(100);
    if(!core){error("DOMAIN_BUSY");return;}
    l2_view_t v;l2_get_view(core,&v);
    uint64_t seq=core->saved.has_owner?core->saved.last_request.seq:0;
    l2_runtime_release();
    uint64_t epoch=0;bool valid=local2_clock_now(&epoch);char line[850],pet_id[131],device_id[67];
    quote_ascii(v.has_snapshot?v.snapshot.pet.pet_id:"",pet_id);quote_ascii(v.device_id,device_id);
    snprintf(line,sizeof(line),"\nCFDIAG STATE {\"schema\":1,\"ready\":%s,\"storageError\":%s,\"hasSnapshot\":%s,\"deviceId\":\"%s\",\"petId\":\"%s\",\"revision\":%"PRIu64",\"scene\":%u,\"action\":%u,\"pending\":%u,\"lastAck\":%"PRIu64",\"nextEvent\":%"PRIu64",\"lastSeq\":%"PRIu64",\"clockValid\":%s,\"nowMs\":%"PRIu64",\"utcOffsetMinutes\":%d}\n",v.ready?"true":"false",v.storage_error?"true":"false",v.has_snapshot?"true":"false",device_id,pet_id,v.snapshot.revision,(unsigned)v.snapshot.scene,(unsigned)v.snapshot.action,(unsigned)v.pending_events,v.last_ack,v.next_event,seq,valid?"true":"false",epoch,local2_clock_utc_offset_minutes());
    (void)send_line(line);
}
static void select_face(unsigned target)
{
    if(bsp_display_lock(1000)!=ESP_OK){error("UI_BUSY");return;}
    bool ok=badge_ui_diagnostic_select_face(target);
    if(ok){diagnostic_selection=true;selection_id++;}
    bsp_display_unlock();
    if(!ok){error("VIEW_REQUIRES_AWAKE_IDLE_HOME_NO_MODAL");return;}
    char line[160];snprintf(line,sizeof(line),"\nCFDIAG VIEW {\"source\":\"diagnostic_ui_selection\",\"face\":%u,\"selectionId\":%"PRIu64"}\n",target,selection_id);(void)send_line(line);
}
static bool cancelled(void)
{
    char b[64];int n=usb_serial_jtag_read_bytes(b,sizeof(b),0);
    /* Any host input during transfer cancels. No queued state-changing commands. */
    return n>0;
}
static void capture(void)
{
    /* Refuse under pressure. RGB565 output lives only in PSRAM; no DMA bounce.
     * Layer scratch still follows LVGL allocator, hence substantial reserves. */
    if(heap_caps_get_free_size(MALLOC_CAP_SPIRAM)<2u*1024u*1024u||heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM)<SNAP_BYTES+64u||heap_caps_get_free_size(MALLOC_CAP_INTERNAL|MALLOC_CAP_DMA)<64u*1024u){error("MEMORY_BUDGET");return;}
    size_t cap=LV_DRAW_BUF_SIZE(SNAP_W,SNAP_H,LV_COLOR_FORMAT_RGB565);
    uint8_t *raw=heap_caps_aligned_calloc(64,1,cap,MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
    if(!raw){error("ALLOC");return;}
    if(bsp_display_lock(1000)!=ESP_OK){free(raw);error("UI_BUSY");return;}
    if(!badge_ui_capture_allowed()){bsp_display_unlock();free(raw);error("UI_MOVING");return;}
    lv_draw_buf_t buf;bool ok=lv_draw_buf_init(&buf,SNAP_W,SNAP_H,LV_COLOR_FORMAT_RGB565,LV_STRIDE_AUTO,raw,cap)==LV_RESULT_OK;
    uint64_t start=esp_timer_get_time(),id=++capture_id,frame=frame_id,selected=diagnostic_selection?selection_id:0;
    diagnostic_capture=true;
    if(ok)ok=badge_display_capture_rgb565(display,&buf);
    diagnostic_capture=false;
    uint64_t pause=esp_timer_get_time()-start;
    /* Exclude the diagnostic pause from subsequent input interval telemetry. */
    perf.input_previous=0;
    bsp_display_unlock();
    if(!ok||buf.header.w!=SNAP_W||buf.header.h!=SNAP_H||buf.header.stride!=SNAP_W*2u){free(raw);error("SNAPSHOT_FORMAT");return;}
    uint32_t crc=esp_rom_crc32_le(0,buf.data,SNAP_BYTES);char line[720];
    snprintf(line,sizeof(line),"\nCFDIAG BEGIN {\"schema\":1,\"captureId\":%"PRIu64",\"renderFrameId\":%"PRIu64",\"width\":466,\"height\":466,\"stride\":932,\"bytes\":434312,\"format\":\"RGB565_LE\",\"crc32\":\"%08"PRIx32"\",\"uiPauseUs\":%"PRIu64",\"diagnosticSelectionId\":%"PRIu64",\"source\":\"lvgl-object-tree-composition\",\"physicalScanout\":false}\n",id,frame,crc,pause,selected);
    ok=send_line(line);int64_t deadline=esp_timer_get_time()+MAX_CAPTURE_US;
    for(size_t offset=0;ok&&offset<SNAP_BYTES;offset+=CHUNK){
        if(esp_timer_get_time()>deadline||cancelled()){ok=false;break;}
        size_t n=SNAP_BYTES-offset;if(n>CHUNK)n=CHUNK;unsigned char b64[CHUNK*4/3+1];size_t encoded=0;
        if(mbedtls_base64_encode(b64,sizeof(b64),&encoded,buf.data+offset,n)!=0){ok=false;break;}b64[encoded]=0;
        snprintf(line,sizeof(line),"CFDIAG DATA %"PRIu64" %u %s\n",id,(unsigned)offset,b64);ok=send_line(line);
        if((offset/CHUNK)%8==0)vTaskDelay(1);
    }
    free(raw);snprintf(line,sizeof(line),"CFDIAG %s %"PRIu64"\n",ok?"END":"ABORT",id);(void)send_line(line);
}
typedef struct {char text[40];size_t len;bool invalid;} command_parser_t;
static void command_byte(command_parser_t *p,char ch)
{
    if(ch=='\r')return;
    if(ch!='\n'){
        if((unsigned char)ch<32||(unsigned char)ch>126)p->invalid=true;
        if(p->len+1<sizeof(p->text))p->text[p->len++]=ch;else p->invalid=true;
        return;
    }
    p->text[p->len]=0;
    const char *command=p->text;
    if(p->invalid)error("COMMAND_INVALID_OR_TOO_LONG");
    else if(!strcmp(command,"CFDIAG STATE"))state();
    else if(!strcmp(command,"CFDIAG PERF"))stats(false);
    else if(!strcmp(command,"CFDIAG PERF RESET"))stats(true);
    else if(!strcmp(command,"CFDIAG CAPTURE"))capture();
    else if(!strcmp(command,"CFDIAG VIEW 0")||!strcmp(command,"CFDIAG VIEW 1")||!strcmp(command,"CFDIAG VIEW 2"))select_face((unsigned)(command[12]-'0'));
    else if(!strcmp(command,"CFDIAG HELP"))(void)send_line("\nCFDIAG HELP STATE | PERF | PERF RESET | CAPTURE | VIEW 0/1/2 (awake idle HOME only); any input cancels capture; no navigation/domain/storage commands\n");
    else if(p->len)error("UNKNOWN_COMMAND");
    memset(p,0,sizeof(*p));
}
static void usb_task(void *unused)
{
    (void)unused;command_parser_t parser={0};
    for(;;){char ch;if(usb_serial_jtag_read_bytes(&ch,1,pdMS_TO_TICKS(200))==1)command_byte(&parser,ch);}
}
void badge_diagnostics_start_usb(void)
{
    /* Primary UART stdin stays untouched. This sole RX consumer owns only the
     * existing physical USB Serial/JTAG endpoint. Secondary console output uses
     * the same driver (not a competing low-level FIFO writer). */
    if(usb_serial_jtag_is_driver_installed()){ESP_LOGW(TAG,"USB driver already owned; diagnostics remain off");return;}
    usb_serial_jtag_driver_config_t cfg={.tx_buffer_size=2048,.rx_buffer_size=128};
    if(usb_serial_jtag_driver_install(&cfg)!=ESP_OK){ESP_LOGW(TAG,"USB diagnostic driver unavailable");return;}
    usb_serial_jtag_vfs_use_driver();
    if(xTaskCreate(usb_task,"badge_usb_diag",6144,NULL,2,NULL)!=pdPASS){usb_serial_jtag_vfs_use_nonblocking();(void)usb_serial_jtag_driver_uninstall();ESP_LOGW(TAG,"USB diagnostic task unavailable");return;}
    ESP_LOGI(TAG,"Local USB diagnostic commands enabled; captures are software composition, not panel readback");
}
