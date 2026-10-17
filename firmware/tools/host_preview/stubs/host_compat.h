#ifndef CATFOREST_HOST_COMPAT_H
#define CATFOREST_HOST_COMPAT_H
/* 仅用于 Windows 主机预览：MinGW 缺少 POSIX 的 strlcpy / gmtime_r / localtime_r，
   这里给出等价实现。只在主机预览目标里通过 -include 生效，不进入固件构建。 */
#include <stddef.h>
#include <string.h>
#include <time.h>

static inline size_t cf_host_strlcpy(char *dst, const char *src, size_t size) {
    size_t n = src ? strlen(src) : 0;
    if (size) {
        size_t copy = n >= size ? size - 1 : n;
        if (copy) memcpy(dst, src, copy);
        dst[copy] = '\0';
    }
    return n;
}

static inline struct tm *cf_host_gmtime_r(const time_t *t, struct tm *out) {
    if (!t || !out) return NULL;
    return gmtime_s(out, t) == 0 ? out : NULL;
}

static inline struct tm *cf_host_localtime_r(const time_t *t, struct tm *out) {
    if (!t || !out) return NULL;
    return localtime_s(out, t) == 0 ? out : NULL;
}

#define strlcpy cf_host_strlcpy
#define gmtime_r(t, r) cf_host_gmtime_r((t), (r))
#define localtime_r(t, r) cf_host_localtime_r((t), (r))

#endif