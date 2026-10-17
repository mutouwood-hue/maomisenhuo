#pragma once
#include <stdlib.h>
#include <stdint.h>
#define MALLOC_CAP_INTERNAL 1
#define MALLOC_CAP_DMA 2
#define MALLOC_CAP_SPIRAM 4
#define MALLOC_CAP_8BIT 8
size_t heap_caps_get_free_size(uint32_t);
size_t heap_caps_get_largest_free_block(uint32_t);
size_t heap_caps_get_minimum_free_size(uint32_t);
void *heap_caps_aligned_calloc(size_t,size_t,size_t,uint32_t);
static inline void *heap_caps_calloc(size_t n,size_t size,uint32_t caps){(void)caps;return calloc(n,size);}
static inline void *heap_caps_malloc(size_t size,uint32_t caps){(void)caps;return malloc(size);}
static inline void heap_caps_free(void *p){free(p);}