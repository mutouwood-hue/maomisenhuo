#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <assert.h>
#include "pool_port.h"
const char *cf_test_mode;
size_t cf_test_free=8*1024*1024,cf_test_largest=8*1024*1024;
unsigned cf_test_alloc_calls,cf_test_free_calls,cf_test_live;
static void *raw;static uint8_t *user;static size_t bytes;
static const char *mode(void){return cf_test_mode?cf_test_mode:(getenv("CF_POOL_MODE")?getenv("CF_POOL_MODE"):"enabled");}
bool cf_mask_test_supported(void){return strcmp(mode(),"unsupported")!=0;}
size_t cf_mask_test_free_bytes(void){if(!strcmp(mode(),"low-free"))return 2*1024*1024;if(!strcmp(mode(),"post-budget")&&cf_test_live)return 2*1024*1024-1;return cf_test_free-(cf_test_live?bytes:0);}
size_t cf_mask_test_largest_bytes(void){return !strcmp(mode(),"small-block")?20591:cf_test_largest;}
void *cf_mask_test_allocate(size_t alignment,size_t n){
 cf_test_alloc_calls++;assert(alignment==16&&n==20592);assert(!cf_test_live);
 if(!strcmp(mode(),"alloc-fail"))return NULL;
 assert(posix_memalign(&raw,alignment,n+64)==0);memset(raw,0xa5,n+64);
 user=(uint8_t*)raw+16+(!strcmp(mode(),"misaligned")?1:0);bytes=n;
 memset(user,0,n);memset(user+n,0x5a,16);cf_test_live=1;return user;
}
bool cf_mask_test_external(const void*p){assert(p==user);return strcmp(mode(),"bad-cap")!=0;}
size_t cf_mask_test_allocated_bytes(const void*p){assert(p==user);return bytes-(!strcmp(mode(),"short-size")?1:0);}
void cf_test_guards(void){if(!cf_test_live)return;for(uint8_t*p=raw;p<user;p++)assert(*p==0xa5);for(unsigned i=0;i<16;i++)assert(user[bytes+i]==0x5a);}
void cf_mask_test_release(void*p){assert(p==user&&cf_test_live==1);cf_test_guards();free(raw);raw=NULL;user=NULL;cf_test_live=0;cf_test_free_calls++;}
