/* Explicit host substitute for target FreeRTOS mutex, preserving actual call sites. */
#include <pthread.h>
static pthread_mutex_t cf_thread_mutex;
static _Thread_local unsigned cf_thread_lock_depth;
static lv_result_t cf_thread_mutex_init(void*p){(void)p;assert(pthread_mutex_init(&cf_thread_mutex,NULL)==0);return LV_RESULT_OK;}
static lv_result_t cf_thread_mutex_lock(void*p){(void)p;assert(pthread_mutex_lock(&cf_thread_mutex)==0);assert(cf_thread_lock_depth++==0);return LV_RESULT_OK;}
static lv_result_t cf_thread_mutex_unlock(void*p){(void)p;assert(cf_thread_lock_depth--==1);assert(pthread_mutex_unlock(&cf_thread_mutex)==0);return LV_RESULT_OK;}
static lv_result_t cf_thread_mutex_delete(void*p){(void)p;assert(pthread_mutex_destroy(&cf_thread_mutex)==0);return LV_RESULT_OK;}
#define lv_mutex_init cf_thread_mutex_init
#define lv_mutex_lock cf_thread_mutex_lock
#define lv_mutex_unlock cf_thread_mutex_unlock
#define lv_mutex_delete cf_thread_mutex_delete
