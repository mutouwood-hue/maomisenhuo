#include "local2_wire.h"
#include "local2_store.h"
#include "local2_day.h"
#ifdef ESP_PLATFORM
#include "local2_peer.h"
#include "esp_timer.h"
#endif
#include "cJSON.h"
#include "mbedtls/sha256.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdatomic.h>
#ifdef ESP_PLATFORM
#include "freertos/FreeRTOS.h"
static portMUX_TYPE session_guard=portMUX_INITIALIZER_UNLOCKED;
static void session_lock(void){portENTER_CRITICAL(&session_guard);}
static void session_unlock(void){portEXIT_CRITICAL(&session_guard);}
#else
static atomic_flag session_guard=ATOMIC_FLAG_INIT;
static void session_lock(void){while(atomic_flag_test_and_set(&session_guard)) {}}
static void session_unlock(void){atomic_flag_clear(&session_guard);}
#endif

static atomic_uint_least32_t active_session;
static uint32_t context_session;
static uint64_t context_counter,context_next_ms,context_deadline_ms;
static char context_pending[64];
static l2_mobile_context_t mobile_context;
static uint64_t mono_now(void){
#ifdef ESP_PLATFORM
    return (uint64_t)esp_timer_get_time()/1000;
#else
    return 0;
#endif
}
void local2_wire_reset_session(uint32_t session){session_lock();atomic_store(&active_session,session);context_session=0;context_pending[0]=0;context_next_ms=0;context_deadline_ms=0;memset(&mobile_context,0,sizeof(mobile_context));session_unlock();}
/* Caller holds the domain mutex. Only bounded RAM validation/publication runs
 * inside this short lock; reset never waits for NVS, JSON, radio or the UI. */
static l2_status_t confirm_bath_session(l2_core_t *core,const char *client,uint32_t session){
    session_lock();
    l2_status_t result=session&&atomic_load(&active_session)==session?l2_confirm_bath(core,client,session):L2_NOT_READY;
    session_unlock();return result;
}
static bool bath_delivery_confirmed(const l2_core_t *core,uint32_t session){return session&&atomic_load(&active_session)==session&&core->bath_confirmed_session==session&&l2_bath_allowed(core);}

static cJSON *field(const cJSON *o,const char *key){return cJSON_GetObjectItemCaseSensitive(o,key);}
static bool integer(const cJSON *o,uint64_t *out){
    if(!cJSON_IsNumber(o)||!isfinite(o->valuedouble)||o->valuedouble<0||o->valuedouble>(double)L2_JS_MAX||floor(o->valuedouble)!=o->valuedouble)return false;
    *out=(uint64_t)o->valuedouble;return true;
}
static bool ascii(const char *s,size_t max){if(!s||!s[0]||strlen(s)>max)return false;for(;*s;s++)if((unsigned char)*s<33||(unsigned char)*s>126)return false;return true;}
static bool utf8(const unsigned char *p,size_t n){
    for(size_t i=0;i<n;){uint32_t c=p[i++];unsigned k=0;if(c<0x80){if(!c)return false;continue;}
        if(c>=0xc2&&c<=0xdf){k=1;c&=31;}else if(c>=0xe0&&c<=0xef){k=2;c&=15;}else if(c>=0xf0&&c<=0xf4){k=3;c&=7;}else return false;
        if(i+k>n)return false;
        unsigned count=k;while(k--){uint8_t b=p[i++];if((b&0xc0)!=0x80)return false;c=c*64+(b&63);}
        if((count==1&&c<128)||(count==2&&c<2048)||(count==3&&c<65536)||c>0x10ffff||(c>=0xd800&&c<=0xdfff))return false;
    }return true;
}
typedef struct {const unsigned char *p,*end;} json_cursor_t;
static void space(json_cursor_t *c){while(c->p<c->end&&(*c->p==' '||*c->p=='\t'||*c->p=='\r'||*c->p=='\n'))c->p++;}
static bool json_string(json_cursor_t *c){
    if(c->p==c->end||*c->p++!='"')return false;
    while(c->p<c->end){unsigned char b=*c->p++;if(b=='"')return true;if(b<32)return false;
        if(b=='\\'){if(c->p==c->end)return false;b=*c->p++;
            if(b=='u'){if(c->end-c->p<4)return false;unsigned value=0;for(unsigned i=0;i<4;i++){unsigned char h=*c->p++;unsigned d;if(h>='0'&&h<='9')d=h-'0';else if(h>='a'&&h<='f')d=h-'a'+10;else if(h>='A'&&h<='F')d=h-'A'+10;else return false;value=value*16+d;}if(!value)return false;}
            else if(!strchr("\"\\/bfnrt",b))return false;
        }
    }return false;
}
static bool digit(unsigned char b){return b>='0'&&b<='9';}
static bool json_value(json_cursor_t *c,unsigned depth){
    if(depth>6)return false;
    space(c);if(c->p==c->end)return false;
    if(*c->p=='"')return json_string(c);
    if(*c->p=='{'||*c->p=='['){bool object=*c->p++=='{';unsigned char close=object?'}':']';space(c);if(c->p<c->end&&*c->p==close){c->p++;return true;}
        for(;;){space(c);if(object){if(!json_string(c))return false;space(c);if(c->p==c->end||*c->p++!=':')return false;}
            if(!json_value(c,depth+1))return false;
            space(c);if(c->p==c->end)return false;unsigned char b=*c->p++;if(b==close)return true;if(b!=',')return false;
        }
    }
    const char *words[]={"true","false","null"};for(unsigned i=0;i<3;i++){size_t n=strlen(words[i]);if((size_t)(c->end-c->p)>=n&&!memcmp(c->p,words[i],n)){c->p+=n;return true;}}
    const unsigned char *start=c->p;if(*c->p=='-')c->p++;if(c->p==c->end)return false;
    if(*c->p=='0')c->p++;else{if(*c->p<'1'||*c->p>'9')return false;while(c->p<c->end&&digit(*c->p))c->p++;}
    if(c->p<c->end&&*c->p=='.'){c->p++;if(c->p==c->end||!digit(*c->p))return false;while(c->p<c->end&&digit(*c->p))c->p++;}
    if(c->p<c->end&&(*c->p=='e'||*c->p=='E')){c->p++;if(c->p<c->end&&(*c->p=='+'||*c->p=='-'))c->p++;if(c->p==c->end||!digit(*c->p))return false;while(c->p<c->end&&digit(*c->p))c->p++;}
    return c->p>start;
}
static bool strict_json(const char *s,size_t n){json_cursor_t c={(const unsigned char *)s,(const unsigned char *)s+n};if(!json_value(&c,0))return false;space(&c);return c.p==c.end;}
static bool unique_tree(const cJSON *o,unsigned depth){
    if(depth>6)return false;
    for(const cJSON *a=o->child;a;a=a->next){
        if(cJSON_IsObject(o)){if(!a->string)return false;for(const cJSON *b=a->next;b;b=b->next)if(b->string&&!strcmp(a->string,b->string))return false;}
        if((cJSON_IsArray(a)||cJSON_IsObject(a))&&!unique_tree(a,depth+1))return false;
    }return true;
}
static bool only(const cJSON *o,const char *const *keys,size_t count){
    if(!cJSON_IsObject(o))return false;
    for(const cJSON *p=o->child;p;p=p->next){bool found=false;for(size_t i=0;i<count;i++)if(!strcmp(p->string,keys[i]))found=true;if(!found)return false;}
    return true;
}
static int enumeration(const cJSON *o,const char *const *v,size_t n){if(!cJSON_IsString(o))return -1;for(size_t i=0;i<n;i++)if(!strcmp(o->valuestring,v[i]))return (int)i;return -1;}
static bool string_field(const cJSON *o,const char *key,char *dest,size_t capacity,bool ascii_only){
    cJSON *x=field(o,key);if(!cJSON_IsString(x)||!x->valuestring[0]||strlen(x->valuestring)>=capacity)return false;
    if(ascii_only&&!ascii(x->valuestring,capacity-1))return false;
    if(!utf8((const unsigned char *)x->valuestring,strlen(x->valuestring)))return false;
    memcpy(dest,x->valuestring,strlen(x->valuestring)+1);return true;
}
static const char *const scenes[]={"home","departing","away","returning","garden","town"};
static const char *const actions[]={"idle","walk","pet","feed","water","bath","play","sleep"};
static const char *const weather[]={"clear","rain","snow"};
static bool snapshot(const cJSON *d,l2_snapshot_t *s){
    static const char *const keys[]={"petId","revision","scene","action","weather","pet","epochMs","utcOffsetMinutes"};
    static const char *const pk[]={"name","breed","food","mood","clean","energy","health","coins"};
    memset(s,0,sizeof(*s));if(!only(d,keys,8)||!string_field(d,"petId",s->pet.pet_id,sizeof(s->pet.pet_id),true)||!integer(field(d,"revision"),&s->revision))return false;
    int a=enumeration(field(d,"scene"),scenes,6),b=enumeration(field(d,"action"),actions,8),c=enumeration(field(d,"weather"),weather,3);if(a<0||b<0||c<0)return false;
    s->scene=(l2_scene_t)a;s->action=(l2_action_t)b;s->weather=(l2_weather_t)c;
    cJSON *p=field(d,"pet");if(!only(p,pk,8)||!string_field(p,"name",s->pet.name,sizeof(s->pet.name),false)||!string_field(p,"breed",s->pet.breed,sizeof(s->pet.breed),true)||!integer(field(p,"coins"),&s->pet.coins))return false;
    const char *names[]={"food","mood","clean","energy","health"};uint8_t *values[]={&s->pet.food,&s->pet.mood,&s->pet.clean,&s->pet.energy,&s->pet.health};
    for(unsigned i=0;i<5;i++){uint64_t n;if(!integer(field(p,names[i]),&n)||n>100)return false;*values[i]=(uint8_t)n;}
    cJSON *offset=field(d,"utcOffsetMinutes");if(offset&&(!cJSON_IsNumber(offset)||!isfinite(offset->valuedouble)||floor(offset->valuedouble)!=offset->valuedouble||offset->valuedouble < -840||offset->valuedouble>840))return false;
    cJSON *t=field(d,"epochMs");if(t){if(!integer(t,&s->epoch_ms))return false;s->has_epoch_ms=true;}return true;
}
static void num(cJSON *o,const char *k,uint64_t n){cJSON_AddNumberToObject(o,k,(double)n);}
bool local2_wire_context_poll(uint32_t session,uint64_t now,char *out,size_t capacity){
    char id[64];session_lock();
    bool ready=session&&atomic_load(&active_session)==session&&context_session==session;
    if(context_pending[0]&&now>=context_deadline_ms)context_pending[0]=0;
    if(!ready||context_pending[0]||now<context_next_ms){session_unlock();return false;}
    if(context_counter>=L2_JS_MAX){session_unlock();return false;}
    context_counter++;
    snprintf(id,sizeof(id),"badge-context-%lu-%llu",(unsigned long)session,(unsigned long long)context_counter);
    snprintf(context_pending,sizeof(context_pending),"%s",id);context_deadline_ms=now+10000;context_next_ms=now+60000;
    session_unlock();
    int n=snprintf(out,capacity,"{\"v\":2,\"id\":\"%s\",\"op\":\"host_context\",\"request\":true,\"data\":{\"time\":true,\"location\":true}}\n",id);
    if(n<0||(size_t)n>=capacity){local2_wire_context_send_failed(session);return false;}return true;
}
void local2_wire_context_send_failed(uint32_t session){session_lock();if(context_session==session)context_pending[0]=0;session_unlock();}
void local2_wire_get_mobile_context(uint64_t now,l2_mobile_context_t *out){
    if(!out)return;
    session_lock();*out=mobile_context;session_unlock();
    if(out->status==L2_LOCATION_AVAILABLE&&(now<out->received_mono_ms||now>out->expires_mono_ms)){memset(out,0,sizeof(*out));out->status=L2_LOCATION_STALE;}
}
static bool finite_number(const cJSON *o,double min,double max){return cJSON_IsNumber(o)&&isfinite(o->valuedouble)&&o->valuedouble>=min&&o->valuedouble<=max;}
static void accept_context_reply(const cJSON *q,uint32_t session){
    static const char *const rk[]={"v","id","op","ok","data"};
    static const char *const dk[]={"epochMs","utcOffsetMinutes","foreground","location"};
    static const char *const lk[]={"status","capturedAtMs","accuracyMeters","latitude","longitude"};
    cJSON *d=field(q,"data"),*location=field(d,"location"),*offset=field(d,"utcOffsetMinutes");uint64_t epoch=0;
    if(!only(q,rk,5)||!cJSON_IsTrue(field(q,"ok"))||!only(d,dk,4)||!integer(field(d,"epochMs"),&epoch)||epoch<1577836800000ULL||epoch>4102444800000ULL||!finite_number(offset,-840,840)||floor(offset->valuedouble)!=offset->valuedouble||!cJSON_IsBool(field(d,"foreground"))||!only(location,lk,5))return;
    const char *const statuses[]={"unavailable","available","not_authorized","stale"};int status=enumeration(field(location,"status"),statuses,4);if(status<0)return;
    l2_mobile_context_t next={.status=(l2_location_status_t)status,.foreground=cJSON_IsTrue(field(d,"foreground")),.received_mono_ms=mono_now()};
    if(status==L2_LOCATION_AVAILABLE){
        if(!integer(field(location,"capturedAtMs"),&next.captured_at_ms)||next.captured_at_ms>epoch||epoch-next.captured_at_ms>120000||!finite_number(field(location,"accuracyMeters"),0,100000)||!finite_number(field(location,"latitude"),-90,90)||!finite_number(field(location,"longitude"),-180,180))return;
        next.expires_mono_ms=next.received_mono_ms+120000-(epoch-next.captured_at_ms);
        next.accuracy_meters=field(location,"accuracyMeters")->valuedouble;next.latitude=field(location,"latitude")->valuedouble;next.longitude=field(location,"longitude")->valuedouble;
    }else if(field(location,"capturedAtMs")||field(location,"accuracyMeters")||field(location,"latitude")||field(location,"longitude"))return;
    const char *id=field(q,"id")->valuestring;
    session_lock();
    if(session&&atomic_load(&active_session)==session&&context_session==session&&context_pending[0]&&!strcmp(id,context_pending)&&next.received_mono_ms<context_deadline_ms){
        /* 校时仅有界RAM发布；session_guard -> facade guard，无反向取锁。 */
        local2_clock_calibrate(epoch,(int)offset->valuedouble);
        mobile_context=next;context_pending[0]=0;
    }
    session_unlock();
}
static cJSON *terminal_json(const l2_core_t *core){
 const l2_terminal_t *t=&core->saved.terminal;if(!t->counter)return cJSON_CreateNull();
 static const char *const status[]={"none","applied","rejected","quarantined"};
 cJSON *o=cJSON_CreateObject();char id[64];snprintf(id,sizeof(id),"%s:%llu",core->saved.device_id,(unsigned long long)t->counter);
 cJSON_AddStringToObject(o,"eventId",id);num(o,"counter",t->counter);cJSON_AddStringToObject(o,"action",actions[t->action]);
 cJSON_AddStringToObject(o,"status",status[t->status]);cJSON_AddStringToObject(o,"reason",t->reason);cJSON_AddStringToObject(o,"saveDigest",t->save_digest);cJSON_AddBoolToObject(o,"persisted",true);return o;
}
static cJSON *state_json(const l2_core_t *core){
    l2_view_t v;l2_get_view(core,&v);cJSON *o=cJSON_CreateObject();
    cJSON_AddStringToObject(o,"deviceId",v.device_id);cJSON_AddBoolToObject(o,"hasSnapshot",v.has_snapshot);cJSON_AddBoolToObject(o,"storageError",v.storage_error);
    cJSON_AddItemToObject(o,"lastCareResult",terminal_json(core));num(o,"pending",v.pending_events);num(o,"lastAck",v.last_ack);num(o,"lastSeq",core->saved.has_owner?core->saved.last_request.seq:0);
    if(core->saved.has_owner)cJSON_AddStringToObject(o,"clientId",core->saved.last_request.client_id);else cJSON_AddNullToObject(o,"clientId");
    if(v.has_snapshot){
        const l2_snapshot_t *s=&v.snapshot;cJSON *d=cJSON_AddObjectToObject(o,"snapshot");cJSON_AddStringToObject(d,"petId",s->pet.pet_id);num(d,"revision",s->revision);
        cJSON_AddStringToObject(d,"scene",scenes[s->scene]);cJSON_AddStringToObject(d,"action",actions[s->action]);cJSON_AddStringToObject(d,"weather",weather[s->weather]);
        cJSON *p=cJSON_AddObjectToObject(d,"pet");cJSON_AddStringToObject(p,"name",s->pet.name);cJSON_AddStringToObject(p,"breed",s->pet.breed);num(p,"coins",s->pet.coins);
        num(p,"food",s->pet.food);num(p,"mood",s->pet.mood);num(p,"clean",s->pet.clean);num(p,"energy",s->pet.energy);num(p,"health",s->pet.health);
    }
#ifdef ESP_PLATFORM
    l2_peer_view_t pv;local2_peer_get_view(&pv);cJSON *peer=cJSON_AddObjectToObject(o,"peer");
    static const char *const phases[]={"disabled","discovering","hello","confirm","exchanging","wait_done","complete","blocked"};
    cJSON_AddStringToObject(peer,"phase",pv.phase<=L2P_BLOCKED?phases[pv.phase]:"blocked");
    cJSON_AddBoolToObject(peer,"discoverable",pv.discoverable);cJSON_AddBoolToObject(peer,"connected",pv.connected);
    cJSON_AddBoolToObject(peer,"localConfirmed",pv.local_confirmed);cJSON_AddBoolToObject(peer,"remoteConfirmed",pv.remote_confirmed);
    cJSON_AddBoolToObject(peer,"incomingSaved",pv.incoming_saved);cJSON_AddBoolToObject(peer,"outgoingAcked",pv.outgoing_acked);
    cJSON_AddBoolToObject(peer,"complete",pv.complete);cJSON_AddBoolToObject(peer,"incomingNew",pv.incoming_new);
    cJSON_AddStringToObject(peer,"peerId",pv.peer_id);num(peer,"completeCount",pv.complete_count);
#endif
    return o;
}
static cJSON *next_event(const l2_core_t *core){
    l2_event_t e;if(!core->saved.has_snapshot||!l2_peek_event(core,&e))return cJSON_CreateNull();cJSON *o=cJSON_CreateObject();char id[64];snprintf(id,sizeof(id),"%s:%llu",core->saved.device_id,(unsigned long long)e.counter);
    cJSON_AddStringToObject(o,"eventId",id);num(o,"counter",e.counter);cJSON_AddStringToObject(o,"deviceId",core->saved.device_id);cJSON_AddStringToObject(o,"petId",core->saved.snapshot.pet.pet_id);
    cJSON_AddStringToObject(o,"source","native_device");cJSON_AddStringToObject(o,"protocol","CFLOCAL2");
    if(e.epoch_ms)num(o,"occurredAtMs",e.epoch_ms);else cJSON_AddNullToObject(o,"occurredAtMs");
    if(e.kind==L2_EVENT_CARE){cJSON_AddStringToObject(o,"kind","care");cJSON_AddStringToObject(o,"action",actions[e.action]);}
    else {l2_receipt_t r;if(!l2_get_peer(core,e.peer_slot,&r)){cJSON_Delete(o);return NULL;}cJSON_AddStringToObject(o,"kind","gift");cJSON_AddStringToObject(o,"peerId",r.peer_id);num(o,"peerCounter",e.peer_counter);cJSON_AddStringToObject(o,"giftId","flower");num(o,"quantity",1);cJSON_AddBoolToObject(o,"peerComplete",false);}
    return o;
}
bool local2_wire_handle(const char *line,size_t length,char *out,size_t capacity,uint32_t session){
    bool valid=line&&length&&length<2048&&utf8((const unsigned char *)line,length);cJSON *q=NULL,*r=cJSON_CreateObject();const char *id="",*op="";l2_status_t result=L2_INVALID;
    if(!r)return false;
    if(valid)valid=strict_json(line,length);
    if(valid){const char *end=NULL;q=cJSON_ParseWithLengthOpts(line,length,&end,false);if(end){while(end<line+length&&(*end==' '||*end=='\t'||*end=='\r'||*end=='\n'))end++;}valid=q&&end==line+length&&cJSON_IsObject(q)&&unique_tree(q,0);}
    if(valid){cJSON *i=field(q,"id"),*o=field(q,"op");uint64_t version;valid=cJSON_IsString(i)&&ascii(i->valuestring,64)&&cJSON_IsString(o)&&ascii(o->valuestring,20)&&integer(field(q,"v"),&version)&&version==2;if(valid){id=i->valuestring;op=o->valuestring;}}
    if(valid&&!strcmp(op,"host_context")){accept_context_reply(q,session);cJSON_Delete(q);cJSON_Delete(r);return false;}
    cJSON_AddNumberToObject(r,"v",2);cJSON_AddStringToObject(r,"id",id);cJSON_AddStringToObject(r,"op",op);
    l2_core_t *core=valid?l2_runtime_core(1000):NULL;
    if(valid&&!core)result=L2_NOT_READY;
    if(core){
        static const char *const keys[]={"v","id","op","data","clientId","seq"};valid=only(q,keys,6)&&session&&atomic_load(&active_session)==session;
        if(valid&&!strcmp(op,"hello")){
            session_lock();
            if(atomic_load(&active_session)==session){core->bath_confirmed_session=0;context_session=0;context_pending[0]=0;context_deadline_ms=0;memset(&mobile_context,0,sizeof(mobile_context));}
            session_unlock();
            cJSON *d=cJSON_AddObjectToObject(r,"data");cJSON_AddStringToObject(d,"protocol","CFLOCAL2");cJSON_AddStringToObject(d,"deviceId",core->saved.device_id);num(d,"maxLine",2048);num(d,"lastSeq",core->saved.has_owner?core->saved.last_request.seq:0);
            if(core->saved.has_owner)cJSON_AddStringToObject(d,"clientId",core->saved.last_request.client_id);else cJSON_AddNullToObject(d,"clientId");
            cJSON *a=cJSON_AddArrayToObject(d,"capabilities");cJSON_AddItemToArray(a,cJSON_CreateString("scene"));cJSON_AddItemToArray(a,cJSON_CreateString("snapshot"));cJSON_AddItemToArray(a,cJSON_CreateString("events"));cJSON_AddItemToArray(a,cJSON_CreateString("peer"));cJSON_AddItemToArray(a,cJSON_CreateString("day_view"));cJSON_AddItemToArray(a,cJSON_CreateString("care_receipt_v1"));cJSON_AddItemToArray(a,cJSON_CreateString("scene_places_v1"));cJSON_AddItemToArray(a,cJSON_CreateString("resume_v1"));cJSON_AddItemToArray(a,cJSON_CreateString("care_bath_v1"));cJSON_AddItemToArray(a,cJSON_CreateString("mobile_context_v1"));cJSON_AddItemToArray(a,cJSON_CreateString("day_hearts_v1"));cJSON_AddStringToObject(d,"firmware","0.5.7-scene-swipe-lock");result=L2_OK;
        }else if(valid&&!strcmp(op,"care_capabilities")){
            static const char *const ck[]={"v","id","op","clientId","data"};
            static const char *const dk[]={"careBathV1","mobileContextV1"};char client[37];cJSON *mobile=field(field(q,"data"),"mobileContextV1");
            if(only(q,ck,5)&&only(field(q,"data"),dk,2)&&(!mobile||cJSON_IsTrue(mobile))&&cJSON_IsTrue(field(field(q,"data"),"careBathV1"))&&string_field(q,"clientId",client,sizeof(client),true)){
                result=confirm_bath_session(core,client,session);
                if(result==L2_OK){
                    session_lock();bool current=atomic_load(&active_session)==session;
                    if(current&&mobile&&context_session!=session){context_session=session;context_pending[0]=0;context_deadline_ms=0;}
                    session_unlock();
                    if(!current)result=L2_NOT_READY;
                    else{cJSON *d=cJSON_AddObjectToObject(r,"data");cJSON_AddBoolToObject(d,"careBathV1",true);cJSON_AddBoolToObject(d,"confirmed",true);cJSON_AddBoolToObject(d,"mobileContextV1",mobile!=NULL);cJSON_AddStringToObject(d,"deviceId",core->saved.device_id);cJSON_AddStringToObject(d,"clientId",client);}
                }
            }
        }else if(valid&&!strcmp(op,"state")){cJSON_AddItemToObject(r,"data",state_json(core));result=L2_OK;
        }else if(valid&&!strcmp(op,"events")){
            cJSON *d=cJSON_AddObjectToObject(r,"data");l2_event_t head;
            if(l2_peek_event(core,&head)&&head.kind==L2_EVENT_CARE&&head.action==L2_ACTION_BATH&&!bath_delivery_confirmed(core,session)){
                cJSON_AddNullToObject(d,"event");cJSON *blocked=cJSON_AddObjectToObject(d,"blocked");char event_id[64];
                snprintf(event_id,sizeof(event_id),"%s:%llu",core->saved.device_id,(unsigned long long)head.counter);
                cJSON_AddStringToObject(blocked,"reason","care_bath_confirmation_required");cJSON_AddStringToObject(blocked,"eventId",event_id);num(blocked,"counter",head.counter);cJSON_AddStringToObject(blocked,"action","bath");result=L2_OK;
            }else{cJSON *e=next_event(core);if(e){cJSON_AddItemToObject(d,"event",e);result=L2_OK;}}
        }else if(valid&&!strcmp(op,"day")){
            static const char *const dk[]={"v","id","op","data"};
            if(length<=1900&&only(q,dk,4)){cJSON *d=cJSON_CreateObject();result=local2_day_accept(core,field(q,"data"),d);if(result==L2_OK)cJSON_AddItemToObject(r,"data",d);else cJSON_Delete(d);}
        }else if(valid&&(!strcmp(op,"snapshot")||!strcmp(op,"ack"))){
            l2_request_t req={0};valid=string_field(q,"clientId",req.client_id,sizeof(req.client_id),true)&&integer(field(q,"seq"),&req.seq);snprintf(req.request_id,sizeof(req.request_id),"%s",id);
            if(valid&&mbedtls_sha256((const unsigned char *)line,length,req.hash,0)==0){
                if(!strcmp(op,"snapshot")){l2_snapshot_t s;if(snapshot(field(q,"data"),&s)){result=l2_set_snapshot(core,&req,&s);if(result==L2_OK&&s.has_epoch_ms)local2_clock_calibrate(s.epoch_ms,field(field(q,"data"),"utcOffsetMinutes")?field(field(q,"data"),"utcOffsetMinutes")->valueint:0);}}
                else {
                    cJSON *d=field(q,"data"),*receipt=field(d,"receipt");l2_terminal_t terminal={0};char expected[64];
                    static const char *const ak[]={"counter","eventId","receipt"};static const char *const rk[]={"status","originalStatus","reason","persisted","saveDigest"};
                    if(only(d,ak,3)&&only(receipt,rk,5)&&integer(field(d,"counter"),&terminal.counter)&&cJSON_IsString(field(d,"eventId"))&&cJSON_IsTrue(field(receipt,"persisted"))&&cJSON_IsString(field(receipt,"status"))&&string_field(receipt,"reason",terminal.reason,sizeof(terminal.reason),true)&&string_field(receipt,"saveDigest",terminal.save_digest,sizeof(terminal.save_digest),true)){
                        const char *status=field(receipt,"status")->valuestring;
                        if(!strcmp(status,"duplicate")){cJSON *original=field(receipt,"originalStatus");status=cJSON_IsString(original)?original->valuestring:"";}
                        else if(field(receipt,"originalStatus"))status="";
                        terminal.status=!strcmp(status,"applied")?L2_TERMINAL_APPLIED:!strcmp(status,"rejected")?L2_TERMINAL_REJECTED:!strcmp(status,"quarantined")?L2_TERMINAL_QUARANTINED:L2_TERMINAL_NONE;
                        snprintf(expected,sizeof(expected),"%s:%llu",core->saved.device_id,(unsigned long long)terminal.counter);
                        if(!strcmp(field(d,"eventId")->valuestring,expected))result=l2_ack_event_result(core,&req,&terminal);
                    }
                }
                if(result==L2_OK||result==L2_DUPLICATE){l2_result_t x;l2_get_last_result(core,&x);cJSON *d=cJSON_AddObjectToObject(r,"data");cJSON_AddBoolToObject(d,"persisted",true);cJSON_AddBoolToObject(d,"duplicate",result==L2_DUPLICATE);num(d,"revision",core->saved.snapshot.revision);num(d,"counter",x.event_counter);num(d,"seq",req.seq);if(!strcmp(op,"ack"))cJSON_AddItemToObject(d,"lastCareResult",terminal_json(core));}
            }
        }
        l2_runtime_release();
    }
    bool ok=result==L2_OK||result==L2_DUPLICATE;cJSON_AddBoolToObject(r,"ok",ok);
    if(!ok){cJSON *e=cJSON_AddObjectToObject(r,"error");cJSON_AddStringToObject(e,"code",l2_status_name(result));cJSON_AddStringToObject(e,"outcome",result==L2_STORAGE_ERROR?"unknown":"no_change");}
    char *encoded=cJSON_PrintUnformatted(r);bool done=encoded&&strlen(encoded)+2<=capacity;
    if(done)snprintf(out,capacity,"%s\n",encoded);
    free(encoded);cJSON_Delete(q);cJSON_Delete(r);return done;
}
