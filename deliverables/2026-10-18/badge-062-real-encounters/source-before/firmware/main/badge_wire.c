#include "badge_wire.h"
#include <stdint.h>

bool badge_wire_valid(const char *data, size_t length)
{
    if (!data || !length) return false;
    const uint8_t *p=(const uint8_t *)data;
    for(size_t i=0;i<length;) {
        uint8_t c=p[i++]; unsigned continuation=0;
        if(c==0) return false;
        if(c<0x80) continue;
        if(c>=0xc2 && c<=0xdf) continuation=1;
        else if(c>=0xe0 && c<=0xef) continuation=2;
        else if(c>=0xf0 && c<=0xf4) continuation=3;
        else return false;
        if(length-i<continuation) return false;
        if((c==0xe0 && p[i]<0xa0) || (c==0xed && p[i]>=0xa0) ||
           (c==0xf0 && p[i]<0x90) || (c==0xf4 && p[i]>=0x90)) return false;
        for(unsigned n=0;n<continuation;n++) if(p[i+n]<0x80 || p[i+n]>0xbf) return false;
        i+=continuation;
    }
    bool quoted=false;
    for(size_t i=0;i<length;i++) {
        if(data[i]=='"') quoted=!quoted;
        else if(quoted && data[i]=='\\' && i+1<length) {
            i++;
            if(data[i]=='u' && i+4<length && data[i+1]=='0' && data[i+2]=='0' && data[i+3]=='0' && data[i+4]=='0') return false;
            /* Skips escaped quotes and backslashes without treating them as syntax. */
        }
    }
    return true;
}
