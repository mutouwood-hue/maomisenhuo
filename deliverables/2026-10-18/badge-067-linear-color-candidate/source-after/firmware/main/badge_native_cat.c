#include "badge_native_cat.h"
#include "assets/native-cat/native_cat_data.h"
#include "assets/native-cat/native_cat_color.h"
#include <string.h>
#include "zlib.h"
#ifdef ESP_PLATFORM
#include "esp_heap_caps.h"
#else
#include <stdlib.h>
#endif

static unsigned read16(const uint8_t *p){return (unsigned)p[0]|(unsigned)p[1]<<8;}
static uint32_t read32(const uint8_t *p){return (uint32_t)p[0]|(uint32_t)p[1]<<8|(uint32_t)p[2]<<16|(uint32_t)p[3]<<24;}
static uint32_t color_for(const badge_appearance_t *a,const uint8_t *entry)
{
 uint32_t color=read32(entry);unsigned role=entry[4],level=entry[5];
 if(a->breed==BADGE_BREED_ORANGE||!role)return color;
 if(role==4&&a->breed!=BADGE_BREED_SIAMESE&&a->breed!=BADGE_BREED_RAGDOLL)return color;
 /* Final sRGB values were lit/tone-mapped by the production profile. No second
  * gamma, exposure or encoded-RGB shadow multiplication at runtime. */
 unsigned palette_role=role==1?0:role==2?1:role==4?3:2;
 return badge_native_breed_colors[a->growth][a->breed][palette_role][level<3?level:2];
}
static bool unpack(const uint8_t *data,size_t total,uint32_t offset,const badge_appearance_t *a,uint8_t *buffer,bool overlay)
{
 if(total<6||offset>total-6)return false;
 const uint8_t *start=data+offset;unsigned count=read16(start);uint32_t bytes=read32(start+2);
 if(!count||count>128||bytes%3||offset+6u+count*6u>total||bytes>total-offset-6u-count*6u)return false;
 const uint8_t *palette=start+6,*runs=palette+count*6;unsigned base=overlay?128:0;
 for(unsigned i=0;i<count;i++){
  uint32_t color=color_for(a,palette+i*6);if(!i)color=0;
  for(unsigned b=0;b<4;b++)buffer[(base+i)*4+b]=(uint8_t)(color>>(b*8));
 }
 unsigned pixel=0;
 for(uint32_t i=0;i<bytes;i+=3){unsigned n=read16(runs+i),index=runs[i+2];if(!n||index>=count||n>192u*208u-pixel)return false;
  if(!overlay||index){memset(buffer+1024u+pixel,(int)(base+index),n);}
  pixel+=n;
 }
 return pixel==192u*208u;
}
/* All appearance composition runs in the existing GUI owner. One bounded
 * shared scratch layer avoids allocating per scene or per animation frame. */
static bool unpack_native(uint32_t offset,const badge_appearance_t *a,uint8_t *buffer,bool overlay)
{
 static uint8_t *scratch;
 if(!scratch){
#ifdef ESP_PLATFORM
  scratch=heap_caps_malloc(BADGE_NATIVE_CAT_MAX_RLE_BYTES,MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
#else
  scratch=malloc(BADGE_NATIVE_CAT_MAX_RLE_BYTES);
#endif
  if(!scratch)return false;
 }
 if(offset>BADGE_NATIVE_CAT_DATA_BYTES-8u)return false;
 const uint8_t *record=badge_native_cat_data+offset;
 uint32_t decoded=read32(record),encoded=read32(record+4);
 if(!decoded||decoded>BADGE_NATIVE_CAT_MAX_RLE_BYTES||encoded>BADGE_NATIVE_CAT_DATA_BYTES-offset-8u)return false;
 uLongf actual=BADGE_NATIVE_CAT_MAX_RLE_BYTES;
 if(uncompress(scratch,&actual,record+8,encoded)!=Z_OK||actual!=decoded)return false;
 return unpack(scratch,(size_t)actual,0,a,buffer,overlay);
}
bool badge_native_cat_render(const badge_appearance_t *a,unsigned clip,unsigned frame,uint8_t *buffer,size_t capacity)
{
 if(!badge_appearance_valid(a)||!buffer||capacity<BADGE_APPEARANCE_BUFFER_BYTES||clip>3)return false;
 unsigned shape=a->growth==BADGE_GROWTH_KITTEN?0:a->growth==BADGE_GROWTH_YOUNG?1:a->requested_body==BADGE_BODY_SLIM?2:a->requested_body==BADGE_BODY_ROUND?4:3;
 unsigned index=clip==0?frame%20:clip==1?20+frame%24:clip==2?44+frame%10:54+frame%12;
 unsigned outfit=a->outfit==BADGE_OUTFIT_BANDANA?1:a->outfit==BADGE_OUTFIT_BOW?2:a->outfit==BADGE_OUTFIT_BACKPACK?3:a->outfit==BADGE_OUTFIT_WINGS?4:0;
 memset(buffer,0,1024);
 if(!unpack_native(badge_native_cat_offsets[shape][0][index],a,buffer,false))return false;
 return !outfit||unpack_native(badge_native_cat_offsets[shape][outfit][index],a,buffer,true);
}
bool badge_legacy_cat_render(const lv_image_dsc_t *source,uint8_t *buffer,size_t capacity)
{
 if(!source||source->header.cf!=LV_COLOR_FORMAT_RAW||!source->data||!buffer||capacity<BADGE_APPEARANCE_BUFFER_BYTES)return false;
 const badge_appearance_t unknown={0};memset(buffer,0,1024);
 return unpack(source->data,source->data_size,0,&unknown,buffer,false);
}
