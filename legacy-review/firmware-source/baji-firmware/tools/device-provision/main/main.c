/* Fixed 64-byte local USB frame. No BLE, console, default key or erase fallback. */
#include <stdbool.h>
#include <stdint.h>
#include <string.h>
#include "esp_mac.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "hal/usb_serial_jtag_ll.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#define FRAME 64u
static const uint8_t magic[8]={'B','J','P','R','O','V','1','!'};
enum { OK=0,EXISTS=1,INIT_FAIL=2,OPEN_FAIL=3,QUERY_FAIL=4,SET_FAIL=5,COMMIT_UNCERTAIN=6,READBACK_FAIL=7,PROTOCOL_FAIL=8,TIMEOUT=9 };
static void wipe(void *ptr,size_t n){volatile uint8_t *p=ptr;while(n--)*p++=0;}
static bool equal(const uint8_t *a,const uint8_t *b,size_t n){uint8_t d=0;for(size_t i=0;i<n;i++)d|=a[i]^b[i];return d==0;}
static uint32_t crc(const uint8_t *b,size_t n){uint32_t v=UINT32_MAX;while(n--){v^=*b++;for(unsigned j=0;j<8;j++)v=(v>>1)^((0u-(v&1u))&0xedb88320u);}return v^UINT32_MAX;}
static uint32_t le32(const uint8_t *p){return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
static void checksum(uint8_t b[FRAME]){uint32_t c=crc(b,60);for(unsigned i=0;i<4;i++)b[60+i]=(uint8_t)(c>>(8*i));}
static bool valid(const uint8_t b[FRAME],uint8_t type,uint8_t len){return equal(b,magic,8) && b[8]==type && !b[9] && b[10]==len && !b[11] && !b[58] && !b[59] && crc(b,60)==le32(b+60);}
/* Direct FIFO avoids secret copies in driver RX ring buffers. No USB console driver. */
static bool receive(uint8_t b[FRAME],int seconds){size_t n=0;int64_t end=esp_timer_get_time()+(int64_t)seconds*1000000;while(n<FRAME && esp_timer_get_time()<end){n+=usb_serial_jtag_ll_read_rxfifo(b+n,FRAME-n);vTaskDelay(1);}return n==FRAME;}
static bool send(const uint8_t b[FRAME]){
    size_t n=0;int64_t end=esp_timer_get_time()+2000000;
    while(n<FRAME && esp_timer_get_time()<end){
        n+=usb_serial_jtag_ll_write_txfifo(b+n,FRAME-n);
        vTaskDelay(1);
    }
    if(n!=FRAME)return false;
    /* Full 64-byte FIFO auto-flushes. Wait until it is writable before flushing
       the empty FIFO: this emits the ZLP required to terminate CDC transfer. */
    while(!usb_serial_jtag_ll_txfifo_writable() && esp_timer_get_time()<end)vTaskDelay(1);
    if(!usb_serial_jtag_ll_txfifo_writable())return false;
    usb_serial_jtag_ll_txfifo_flush();
    return true;
}
static bool response(uint8_t b[FRAME],uint8_t type,uint8_t status,const uint8_t mac[6],const uint8_t nonce[8]){memset(b,0,FRAME);memcpy(b,magic,8);b[8]=type;b[9]=status;memcpy(b+12,mac,6);memcpy(b+18,nonce,8);checksum(b);return send(b);}
static void idle(void){for(;;){uint8_t discard[64];usb_serial_jtag_ll_read_rxfifo(discard,sizeof(discard));wipe(discard,sizeof(discard));vTaskDelay(pdMS_TO_TICKS(100));}}
void app_main(void){
    uint8_t request[FRAME]={0},reply[FRAME]={0},mac[6]={0},nonce[8]={0},check[32]={0};
    uint8_t status=OK;nvs_handle_t h=0;bool opened=false;
    if(esp_read_mac(mac,ESP_MAC_BT)!=ESP_OK){wipe(request,FRAME);idle();}
    /* Host must initiate; helper never broadcasts NVS contents. */
    if(!receive(request,60)){status=TIMEOUT;goto done;}
    if(!valid(request,1,0)){status=PROTOCOL_FAIL;goto done;}
    for(unsigned i=12;i<58;i++)if(request[i]){status=PROTOCOL_FAIL;goto done;}
    if(nvs_flash_init()!=ESP_OK){status=INIT_FAIL;goto done;}
    if(nvs_open("baji_v2",NVS_READWRITE,&h)!=ESP_OK){status=OPEN_FAIL;goto done;}
    opened=true;size_t size=0;esp_err_t e=nvs_get_blob(h,"device_key",NULL,&size);
    /* Reject any existing key, including wrong type/size. Only NOT_FOUND permits write. */
    if(e==ESP_OK || e==ESP_ERR_NVS_TYPE_MISMATCH){status=EXISTS;goto done;}
    if(e!=ESP_ERR_NVS_NOT_FOUND){status=QUERY_FAIL;goto done;}
    /* RF is disabled: RNG output is not promised cryptographic entropy. This
       nonce is only local attempt correlation, never an authentication secret. */
    esp_fill_random(nonce,8);
    if(!response(reply,2,OK,mac,nonce)){status=TIMEOUT;goto done;}
    wipe(request,FRAME);
    if(!receive(request,15)){status=TIMEOUT;goto done;}
    if(!valid(request,3,32) || !equal(request+12,mac,6) || !equal(request+18,nonce,8)){status=PROTOCOL_FAIL;goto done;}
    /* Recheck immediately before mutation; this helper has no other NVS writer. */
    size=0;e=nvs_get_blob(h,"device_key",NULL,&size);
    if(e!=ESP_ERR_NVS_NOT_FOUND){status=e==ESP_OK || e==ESP_ERR_NVS_TYPE_MISMATCH?EXISTS:QUERY_FAIL;goto done;}
    if(nvs_set_blob(h,"device_key",request+26,32)!=ESP_OK){status=SET_FAIL;goto done;}
    if(nvs_commit(h)!=ESP_OK){status=COMMIT_UNCERTAIN;goto done;}
    size=32;if(nvs_get_blob(h,"device_key",check,&size)!=ESP_OK || size!=32 || !equal(check,request+26,32)){status=READBACK_FAIL;goto done;}
 done:
    wipe(request,FRAME);wipe(check,sizeof(check));
    if(opened)nvs_close(h);
    response(reply,4,status,mac,nonce);wipe(reply,FRAME);wipe(nonce,sizeof(nonce));
    /* One attempt per boot, including failure. No second key or retry after uncertainty. */
    idle();
}
