#include <stdlib.h>
#include <stddef.h>
#include <stdio.h>
#include <stdint.h>
size_t cf_live,cf_peak,cf_allocs;
typedef union {max_align_t align;struct {size_t bytes;} info;} header;
static void*tmalloc(size_t n){header*h=malloc(sizeof(*h)+n);if(!h)return NULL;h->info.bytes=n;cf_live+=n;if(cf_live>cf_peak)cf_peak=cf_live;cf_allocs++;return h+1;}
static void tfree(void*p){if(!p)return;header*h=(header*)p-1;cf_live-=h->info.bytes;free(h);}
static void*trealloc(void*p,size_t n){if(!p)return tmalloc(n);header*h=(header*)p-1;size_t old=h->info.bytes;header*q=realloc(h,sizeof(*h)+n);if(!q)return NULL;q->info.bytes=n;cf_live=cf_live-old+n;if(cf_live>cf_peak)cf_peak=cf_live;return q+1;}
#define malloc tmalloc
#define free tfree
#define realloc trealloc
#include "../../firmware/managed_components/lvgl__lvgl/src/stdlib/clib/lv_mem_core_clib.c"
