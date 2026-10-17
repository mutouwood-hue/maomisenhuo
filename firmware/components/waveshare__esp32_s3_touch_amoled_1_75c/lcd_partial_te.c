/* Private051, optional verified-board TE gate. PARTIAL mode stays PARTIAL.
 * A fresh edge only gates the FIRST stripe of an LVGL rendering cycle.
 * The adapter retains on_color_trans_done and sole flush_ready ownership. */
#include "lcd_partial_te.h"
#include "esp_lv_adapter_display.h"
#include "esp_lcd_panel_ops.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "driver/gpio.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include <stdint.h>
#include <stdlib.h>

typedef struct {
    portMUX_TYPE lock;
    SemaphoreHandle_t edge;
    volatile uint32_t generation;
    volatile bool armed;
    bool enabled, frame_open;
    int gpio_num;
} partial_te_gate_t;
static partial_te_gate_t *attached;
static const char *TAG="bsp_partial_te";

static void IRAM_ATTR edge_isr(void *arg)
{
    partial_te_gate_t *g=arg;
    BaseType_t wake=pdFALSE;
    portENTER_CRITICAL_ISR(&g->lock);
    g->generation++;
    bool signal=g->armed;
    portEXIT_CRITICAL_ISR(&g->lock);
    /* No allocation, drawing, logging or domain/BLE operations in ISR. */
    if(signal)xSemaphoreGiveFromISR(g->edge,&wake);
    if(wake)portYIELD_FROM_ISR();
}

static void wait_new_frame_edge(partial_te_gate_t *g)
{
    /* Consume stale binary tickets BEFORE atomically publishing this request.
     * An old ISR ticket arriving late still cannot satisfy the generation check. */
    (void)xSemaphoreTake(g->edge,0);
    portENTER_CRITICAL(&g->lock);
    uint32_t before=g->generation;g->armed=true;
    portEXIT_CRITICAL(&g->lock);
    TickType_t start=xTaskGetTickCount();
    TickType_t limit=pdMS_TO_TICKS(25);if(!limit)limit=1;
    bool fresh=false;
    for(;;){
        TickType_t used=xTaskGetTickCount()-start;
        if(used>=limit)break;
        (void)xSemaphoreTake(g->edge,limit-used);
        portENTER_CRITICAL(&g->lock);
        fresh=g->generation!=before;
        portEXIT_CRITICAL(&g->lock);
        if(fresh)break;
    }
    portENTER_CRITICAL(&g->lock);g->armed=false;portEXIT_CRITICAL(&g->lock);
    (void)xSemaphoreTake(g->edge,0);
    if(!fresh){
        /* Fail open once, for the rest of this boot. Missing TE cannot cause
         * an infinite wait or impose a timeout on every subsequent stripe. */
        g->enabled=false;(void)gpio_intr_disable(g->gpio_num);
        ESP_LOGW(TAG,"No fresh TE edge within bounded frame wait; using ordinary PARTIAL flush until reboot");
    }
}

static esp_err_t draw_stripe(lv_display_t *disp,esp_lcd_panel_handle_t panel,
                            int x1,int y1,int x2,int y2,
                            const void *pixels,void *ctx)
{
    partial_te_gate_t *g=ctx;
    if(!g->frame_open){
        g->frame_open=true;
        if(g->enabled)wait_new_frame_edge(g);
    }
    bool last=lv_display_flush_is_last(disp);
    /* RGB565 conversion/packing already happened in the adapter. The original
     * async IO completion callback still returns the buffer, not this wrapper. */
    esp_err_t ret=esp_lcd_panel_draw_bitmap(panel,x1,y1,x2,y2,pixels);
    if(last)g->frame_open=false;
    return ret;
}

esp_err_t bsp_lcd_partial_te_attach(lv_display_t *display,int gpio_num)
{
    if(!display||gpio_num<0)return ESP_ERR_INVALID_ARG;
    if(attached)return ESP_ERR_INVALID_STATE;
    partial_te_gate_t *g=heap_caps_calloc(1,sizeof(*g),MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT);
    if(!g)return ESP_ERR_NO_MEM;
    g->lock=(portMUX_TYPE)portMUX_INITIALIZER_UNLOCKED;
    g->gpio_num=gpio_num;
    g->edge=xSemaphoreCreateBinaryWithCaps(MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT);
    if(!g->edge){free(g);return ESP_ERR_NO_MEM;}
    gpio_config_t cfg={.pin_bit_mask=UINT64_C(1)<<gpio_num,.mode=GPIO_MODE_INPUT,
                      .pull_up_en=GPIO_PULLUP_DISABLE,.pull_down_en=GPIO_PULLDOWN_DISABLE,
                      .intr_type=GPIO_INTR_POSEDGE};
    esp_err_t err=gpio_config(&cfg);
    if(err!=ESP_OK)goto fail;
    err=gpio_install_isr_service(ESP_INTR_FLAG_IRAM);
    if(err!=ESP_OK&&err!=ESP_ERR_INVALID_STATE)goto fail;
    err=gpio_isr_handler_add(gpio_num,edge_isr,g);
    if(err!=ESP_OK)goto fail;
    const esp_lv_adapter_draw_bitmap_callbacks_t cbs={.custom_draw_bitmap=draw_stripe};
    err=esp_lv_adapter_set_draw_bitmap_callbacks(display,&cbs,g);
    if(err!=ESP_OK){
        (void)gpio_intr_disable(gpio_num);(void)gpio_isr_handler_remove(gpio_num);
        /* An IRQ can already hold this argument. Retain this single bounded
         * internal object for the boot instead of freeing beneath an ISR.
         * No draw callback was installed; the ordinary adapter path remains. */
        portENTER_CRITICAL(&g->lock);g->armed=false;portEXIT_CRITICAL(&g->lock);
        attached=g;return err;
    }
    g->enabled=true;attached=g;
    ESP_LOGI(TAG,"Verified-board TE gate on GPIO%d; fresh edge once per cycle, bounded timeout, original DMA completion",gpio_num);
    return ESP_OK;
fail:
    vSemaphoreDeleteWithCaps(g->edge);free(g);return err;
}
