#include "badge_appearance.h"
#include "badge_native_cat.h"
#include <string.h>

static int named(const char *value,const char *const *names,unsigned count)
{
 if(!value)return -1;
 for(unsigned i=0;i<count;i++)if(!strcmp(value,names[i]))return (int)i;
 return -1;
}
bool badge_appearance_from_names(badge_appearance_t *out,const char *growth,const char *breed,const char *outfit,const char *body)
{
 static const char *const stages[]={"adult","kitten","young"};
 static const char *const breeds[]={"orange","silver","tuxedo","siamese","ragdoll","blue","calico","golden","starry"};
 static const char *const outfits[]={"none","bandana","bow","cap","raincoat","backpack","scarf","sakura","bell","crown","cape","wings"};
 static const char *const bodies[]={"standard","slim","round"};
 if(!out)return false;
 memset(out,0,sizeof(*out));
 if(growth&&!strcmp(growth,"baby"))growth="kitten";
 int g=named(growth,stages,3),b=named(breed,breeds,9),o=named(outfit,outfits,12),s=named(body?body:"standard",bodies,3);
 if(g<0||b<0||o<0||s<0)return false;
 *out=(badge_appearance_t){.known=true,.growth=(badge_growth_t)g,.breed=(badge_breed_t)b,.outfit=(badge_outfit_t)o,.requested_body=(badge_body_t)s};
 return true;
}
bool badge_appearance_valid(const badge_appearance_t *a)
{
 return a&&a->known&&(unsigned)a->growth<=BADGE_GROWTH_YOUNG&&(unsigned)a->breed<=BADGE_BREED_STARRY&&(unsigned)a->outfit<=BADGE_OUTFIT_WINGS&&(unsigned)a->requested_body<=BADGE_BODY_ROUND;
}
bool badge_appearance_equal(const badge_appearance_t *a,const badge_appearance_t *b)
{
 if(!a||!b)return a==b;
 return a->known==b->known&&(!a->known||(a->growth==b->growth&&a->breed==b->breed&&a->outfit==b->outfit&&a->requested_body==b->requested_body));
}
bool badge_appearance_outfit_supported(badge_outfit_t outfit)
{
 return outfit==BADGE_OUTFIT_NONE||outfit==BADGE_OUTFIT_BOW||outfit==BADGE_OUTFIT_BANDANA||outfit==BADGE_OUTFIT_BACKPACK||outfit==BADGE_OUTFIT_WINGS;
}
/* Alternate breeds retain existing palette semantics; orange native frames
 * use their actual authored stage atlas. These colors also serve the old curl. */
static const uint32_t colors[9][4]={
 {0xdf8a39,0xeba352,0xac572b,0xf8e8d3},
 {12041922,12041922,5858669,16052969},
 {3160389,3160389,2568252,16315624},
 {15062197,15062197,6639690,15062197},
 {15919840,15919840,9078158,16775404},
 {8163751,8163751,7374235,9084337},
 {15106891,16248287,3487029,16774883},
 {14987362,14987362,12091451,16247244},
 {3095397,3095397,2831189,4344717}
};
static uint32_t shade(uint32_t color,int amount)
{
 uint32_t result=0;
 for(unsigned shift=0;shift<24;shift+=8){int c=(int)((color>>shift)&255u);c=amount>=0?c+(255-c)*amount/100:c*(100+amount)/100;result|=(uint32_t)c<<shift;}
 return result;
}
uint32_t badge_appearance_color(const badge_appearance_t *a,unsigned role)
{
 bool known=badge_appearance_valid(a);unsigned breed=known?(unsigned)a->breed:0;
 if(known&&breed==BADGE_BREED_ORANGE){
  static const uint32_t native_palette[3][4]={{0xd37123,0xeb9435,0x7d361c,0xf8e8d3},{0xffc989,0xffdaa5,0xdfa06b,0xf8e8d3},{0xeb9945,0xf7b561,0xae582c,0xf8e8d3}};
  return native_palette[a->growth][role<4?role:0];
 }
 int amount=!known?0:a->growth==BADGE_GROWTH_KITTEN?24:a->growth==BADGE_GROWTH_YOUNG?9:-6;
 if(role>3)role=0;
 if(role==3)amount=amount*30/100;
 return shade(colors[breed][role],amount);
}
unsigned badge_appearance_size(const badge_appearance_t *a)
{
 return !badge_appearance_valid(a)||a->growth==BADGE_GROWTH_ADULT?100u:a->growth==BADGE_GROWTH_KITTEN?78u:90u;
}
bool badge_appearance_render(const lv_image_dsc_t *source,const badge_appearance_t *a,bool compact,unsigned clip,unsigned frame,lv_image_dsc_t *out,uint8_t *buffer,size_t capacity)
{
 if(!out||!buffer||capacity<BADGE_APPEARANCE_BUFFER_BYTES)return false;
 if(badge_appearance_valid(a)){
  if(!badge_native_cat_render(a,clip,frame,buffer,capacity))return false;
 }else if(source&&source->header.cf==LV_COLOR_FORMAT_RAW){
  if(!badge_legacy_cat_render(source,buffer,capacity))return false;
 }else{
  if(!source||source->header.cf!=LV_COLOR_FORMAT_I8||source->header.w!=192||source->header.h!=208||source->header.stride<192||source->data_size<1024u+source->header.stride*208u)return false;
  memcpy(buffer,source->data,1024);
  for(unsigned y=0;y<208;y++)memcpy(buffer+1024u+y*192u,source->data+1024u+y*source->header.stride,192);
 }
 unsigned w=compact?144u:192u,h=compact?156u:208u;
 if(compact)for(unsigned y=0;y<h;y++)for(unsigned x=0;x<w;x++)buffer[1024u+y*w+x]=buffer[1024u+(y*4u/3u)*192u+x*4u/3u];
 *out=(lv_image_dsc_t){.header={.magic=LV_IMAGE_HEADER_MAGIC,.cf=LV_COLOR_FORMAT_I8,.w=w,.h=h,.stride=w},.data_size=1024u+w*h,.data=buffer};
 return true;
}
