#include "local2_day.h"
#include "freertos/FreeRTOS.h"
#include <math.h>
#include "esp_heap_caps.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
typedef struct {l2_day_view_t view;
char transfer[37],owner[37],pet[65];
uint8_t parts,next,counts[6];
} day_slot_t;

typedef struct {char transfer[37],date[11],owner[37],pet[65];
int zone;
unsigned cutoff,part,parts,count;
bool demo;
l2_day_segment_t rows[16];
/* Optional heartfelt moments (minutes of day), only on part 0. */
unsigned heart_count;
uint16_t hearts[L2_DAY_HEART_MAX];
} day_part_t;

static day_slot_t *slots;
static unsigned active=0,staging=1;
static bool receiving;
static uint32_t generation;

static portMUX_TYPE guard=portMUX_INITIALIZER_UNLOCKED;

static const cJSON *get(const cJSON*d,const char*k){return cJSON_GetObjectItemCaseSensitive(d,k);
}
static bool number(const cJSON*v,int lo,int hi,int*out){if(!cJSON_IsNumber(v)||!isfinite(v->valuedouble)||floor(v->valuedouble)!=v->valuedouble||v->valuedouble<lo||v->valuedouble>hi)return false;
*out=(int)v->valuedouble;
return true;
}
static bool text(const cJSON*d,const char*k,char*out,size_t cap){const cJSON*v=get(d,k);
if(!cJSON_IsString(v)||!v->valuestring[0]||strlen(v->valuestring)>=cap)return false;
for(const char*p=v->valuestring;
*p;
p++)if((unsigned char)*p<33||(unsigned char)*p>126)return false;
strcpy(out,v->valuestring);
return true;
}
static bool uuid(const char*s){if(strlen(s)!=36)return false;
for(unsigned i=0;
i<36;
i++){if(i==8||i==13||i==18||i==23){if(s[i]!='-')return false;
}else if(!((s[i]>='0'&&s[i]<='9')||(s[i]>='a'&&s[i]<='f')||(s[i]>='A'&&s[i]<='F')))return false;
}return true;
}
static bool date_ok(const char*s){if(strlen(s)!=10||s[4]!='-'||s[7]!='-')return false;
for(unsigned i=0;
i<10;
i++)if(i!=4&&i!=7&&(s[i]<'0'||s[i]>'9'))return false;
int y=(s[0]-'0')*1000+(s[1]-'0')*100+(s[2]-'0')*10+s[3]-'0',m=(s[5]-'0')*10+s[6]-'0',d=(s[8]-'0')*10+s[9]-'0';
static const unsigned days[]={31,28,31,30,31,30,31,31,30,31,30,31};
if(y<1||m<1||m>12)return false;
unsigned max=days[m-1]+(m==2&&y%4==0&&(y%100!=0||y%400==0));
return d>=1&&(unsigned)d<=max;
}
static bool parse(const cJSON*d,day_part_t*p){
 static const char*keys[]={"schema","transfer","date","zone","cutoff","mode","clientId","petId","part","parts","segments","hearts"};

 if(!cJSON_IsObject(d))return false;
unsigned fields=0;
for(const cJSON*x=d->child;
x;
x=x->next){bool found=false;
for(unsigned i=0;
i<12;
i++)if(!strcmp(x->string,keys[i]))found=true;
if(!found)return false;
fields++;
}if(fields!=11&&fields!=12)return false;

 memset(p,0,sizeof(*p));
int n;
char mode[10];

 if(!number(get(d,"schema"),1,1,&n)||!text(d,"transfer",p->transfer,sizeof p->transfer)||!uuid(p->transfer)||!text(d,"date",p->date,sizeof p->date)||!date_ok(p->date)||!text(d,"clientId",p->owner,sizeof p->owner)||!text(d,"petId",p->pet,sizeof p->pet)||!text(d,"mode",mode,sizeof mode))return false;

 if(strcmp(mode,"demo")&&strcmp(mode,"automatic"))return false;
p->demo=!strcmp(mode,"demo");

 if(!number(get(d,"zone"),-840,840,&p->zone)||!number(get(d,"cutoff"),0,1440,&n))return false;
p->cutoff=(unsigned)n;

 if(!number(get(d,"part"),0,5,&n))return false;
p->part=(unsigned)n;
if(!number(get(d,"parts"),1,6,&n))return false;
p->parts=(unsigned)n;
if(p->part>=p->parts)return false;

 const cJSON*a=get(d,"segments");
if(!cJSON_IsArray(a)||cJSON_GetArraySize(a)>16)return false;
p->count=(unsigned)cJSON_GetArraySize(a);

 if((p->part+1<p->parts&&p->count!=16)||(!p->count&&p->parts!=1))return false;

 unsigned end=0;
for(unsigned i=0;
i<p->count;
i++){
  const cJSON*r=cJSON_GetArrayItem(a,(int)i);
if(!cJSON_IsArray(r)||cJSON_GetArraySize(r)!=5)return false;
int v[5];
const int max[]={1440,1440,6,2,7};
for(unsigned j=0;
j<5;
j++)if(!number(cJSON_GetArrayItem(r,(int)j),0,max[j],v+j))return false;

  if(v[0]>=v[1]||(unsigned)v[1]>p->cutoff||(unsigned)v[0]<end||(p->demo?v[3]!=2:v[3]==2))return false;

  p->rows[i]=(l2_day_segment_t){(uint16_t)v[0],(uint16_t)v[1],(uint8_t)v[2],(uint8_t)v[3],(uint8_t)v[4]};
end=(unsigned)v[1];

 }
/* hearts 为可选字段：仅在 part 0 携带，按分钟升序、不得晚于真实截止点。 */
 const cJSON*h=get(d,"hearts");
 if(h){
   if(p->part!=0||!cJSON_IsArray(h)||cJSON_GetArraySize(h)>(int)L2_DAY_HEART_MAX)return false;
   int prev=-1;
   for(int i=0;i<cJSON_GetArraySize(h);i++){
     if(!number(cJSON_GetArrayItem(h,i),0,1440,&n))return false;
     if(n<prev||(unsigned)n>p->cutoff)return false;
     p->hearts[p->heart_count++]=(uint16_t)n;prev=n;
   }
 }
 return true;

}
static bool metadata(const day_slot_t*s,const day_part_t*p){return !strcmp(s->transfer,p->transfer)&&!strcmp(s->owner,p->owner)&&!strcmp(s->pet,p->pet)&&!strcmp(s->view.date,p->date)&&s->view.zone==p->zone&&s->view.cutoff==p->cutoff&&s->view.demo==p->demo&&s->parts==p->parts;
}
static bool duplicate(const day_slot_t*s,const day_part_t*p){if(!metadata(s,p)||p->part>=s->next||s->counts[p->part]!=p->count)return false;
for(unsigned i=0;
i<p->count;
i++){const l2_day_segment_t*a=s->view.segments+p->part*16+i,*b=p->rows+i;
if(a->start!=b->start||a->end!=b->end||a->kind!=b->kind||a->source!=b->source||a->place!=b->place)return false;
}return true;
}
l2_status_t local2_day_accept(const l2_core_t*core,const cJSON*d,cJSON*response){
 day_part_t p;
if(!core||!response||!parse(d,&p))return L2_INVALID;

 if(!core->ready||core->storage_error||!core->saved.has_owner||!core->saved.has_snapshot)return L2_NOT_READY;

 if(strcmp(core->saved.last_request.client_id,p.owner))return L2_OWNER_CONFLICT;

 if(strcmp(core->saved.snapshot.pet.pet_id,p.pet))return L2_PET_MISMATCH;

 if(!slots){day_slot_t*allocated=heap_caps_calloc(2,sizeof(day_slot_t),MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
if(!allocated)return L2_NOT_READY;
portENTER_CRITICAL(&guard);
slots=allocated;
portEXIT_CRITICAL(&guard);
}
 l2_status_t result=L2_OK;
unsigned count=0;
bool complete=false;

 portENTER_CRITICAL(&guard);

 if(slots[active].view.valid&&!strcmp(slots[active].transfer,p.transfer)){
  if(!duplicate(slots+active,&p))result=L2_INVALID;
else{count=(p.part+1==p.parts)?slots[active].view.count:(p.part+1)*16;
complete=p.part+1==p.parts;
}
 }else if(receiving&&!strcmp(slots[staging].transfer,p.transfer)&&p.part<slots[staging].next){
  if(!duplicate(slots+staging,&p))result=L2_INVALID;
else count=slots[staging].view.count;

 }else{
  if(p.part==0){day_slot_t*s=slots+staging;
memset(s,0,sizeof(*s));
strcpy(s->transfer,p.transfer);
strcpy(s->owner,p.owner);
strcpy(s->pet,p.pet);
strcpy(s->view.date,p.date);
s->view.zone=p.zone;
s->view.cutoff=p.cutoff;
s->view.demo=p.demo;
s->view.heart_count=(uint8_t)p.heart_count;
if(p.heart_count)memcpy(s->view.hearts,p.hearts,p.heart_count*sizeof p.hearts[0]);
s->parts=(uint8_t)p.parts;
receiving=true;
}
  day_slot_t*s=slots+staging;

  if(!receiving||!metadata(s,&p)||p.part!=s->next||(s->view.count&&p.count&&p.rows[0].start<s->view.segments[s->view.count-1].end))result=L2_INVALID;

  else{
   memcpy(s->view.segments+s->view.count,p.rows,p.count*sizeof p.rows[0]);
s->view.count+=(uint16_t)p.count;
s->counts[p.part]=(uint8_t)p.count;
s->next++;
count=s->view.count;

   if(s->next==s->parts){s->view.valid=true;
s->view.generation=++generation;
unsigned old=active;
active=staging;
staging=old;
receiving=false;
complete=true;
}
  }
 }
 portEXIT_CRITICAL(&guard);

 if(result==L2_OK){cJSON_AddBoolToObject(response,"accepted",true);
cJSON_AddBoolToObject(response,"complete",complete);
cJSON_AddNumberToObject(response,"part",p.part);
cJSON_AddStringToObject(response,"date",p.date);
cJSON_AddNumberToObject(response,"count",count);
cJSON_AddBoolToObject(response,"volatile",true);
}return result;

}
bool local2_day_get(const char*pet,l2_day_view_t*out){if(!out)return false;
portENTER_CRITICAL(&guard);
bool valid=slots&&pet&&slots[active].view.valid&&!strcmp(pet,slots[active].pet);
if(valid){*out=slots[active].view;
out->old=receiving;
}else memset(out,0,sizeof(*out));
portEXIT_CRITICAL(&guard);
return valid;
}
