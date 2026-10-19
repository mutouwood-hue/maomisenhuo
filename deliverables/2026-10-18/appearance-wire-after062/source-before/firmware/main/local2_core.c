#include "local2_core.h"
#include <string.h>

/* Byte-defined LE schema, no native struct layout/padding on disk. */
typedef struct {uint8_t *p;size_t n,pos;bool ok;} writer_t;
typedef struct {const uint8_t *p;size_t n,pos;bool ok;} reader_t;
static void bytes(writer_t *w,const void *p,size_t n){if(!w->ok || n>w->n-w->pos){w->ok=false;return;}memcpy(w->p+w->pos,p,n);w->pos+=n;}
static void number(writer_t *w,uint64_t v,unsigned n){for(unsigned i=0;i<n;i++){uint8_t b=(uint8_t)(v>>(8*i));bytes(w,&b,1);}}
static void readbytes(reader_t *r,void *p,size_t n){if(!r->ok || n>r->n-r->pos){r->ok=false;return;}memcpy(p,r->p+r->pos,n);r->pos+=n;}
static uint64_t readnumber(reader_t *r,unsigned n){uint64_t v=0;for(unsigned i=0;i<n;i++){uint8_t b=0;readbytes(r,&b,1);v|=(uint64_t)b<<(8*i);}return v;}
static uint32_t crc32(const uint8_t *p,size_t n){uint32_t c=UINT32_MAX;for(size_t i=0;i<n;i++){c^=p[i];for(unsigned j=0;j<8;j++)c=(c>>1)^((0u-(c&1u))&UINT32_C(0xedb88320));}return c^UINT32_MAX;}
static bool ascii(const char *s,size_t cap,bool empty){size_t i=0;for(;i<cap && s[i];i++)if((unsigned char)s[i]<32 || (unsigned char)s[i]>126)return false;return i<cap && (empty || i);}
static int hex(char c){return c>='0' && c<='9'?c-'0':c>='a' && c<='f'?c-'a'+10:-1;}
static bool hexid(const char *s){if(!s)return false;for(unsigned i=0;i<32;i++)if(!s[i] || hex(s[i])<0)return false;return !s[32];}
static bool uuid(const char *s){if(!s)return false;for(unsigned i=0;i<36;i++){char c=s[i];if(!c)return false;if(i==8 || i==13 || i==18 || i==23){if(c!='-')return false;}else if(!((c>='0' && c<='9') || (c>='a' && c<='f') || (c>='A' && c<='F')))return false;}return !s[36];}
static bool utf8_name(const char *s){size_t n=0;while(n<25 && s[n])n++;if(!n || n>24)return false;size_t i=0;while(i<n){uint8_t a=(uint8_t)s[i++];if(a<0x80){if(a<32 || a==127)return false;continue;}unsigned more;uint32_t cp,min;if(a>=0xc2 && a<=0xdf){more=1;cp=a&31u;min=0x80;}else if(a>=0xe0 && a<=0xef){more=2;cp=a&15u;min=0x800;}else if(a>=0xf0 && a<=0xf4){more=3;cp=a&7u;min=0x10000;}else return false;if(more>n-i)return false;while(more--){uint8_t b=(uint8_t)s[i++];if((b&0xc0)!=0x80)return false;cp=(cp<<6)|(b&63);}if(cp<min || cp>0x10ffff || (cp>=0xd800 && cp<=0xdfff))return false;}return true;}
static bool snapshot_valid(const l2_snapshot_t *s){return s && s->revision<=L2_JS_MAX && (!s->has_epoch_ms || s->epoch_ms<=L2_JS_MAX) && s->scene>=L2_SCENE_HOME && s->scene<=L2_SCENE_TOWN && s->action>=L2_ACTION_IDLE && s->action<=L2_ACTION_SLEEP && s->weather>=L2_WEATHER_CLEAR && s->weather<=L2_WEATHER_SNOW && s->gift_state>=L2_GIFT_NONE && s->gift_state<=L2_GIFT_SHOWN && ascii(s->pet.pet_id,sizeof(s->pet.pet_id),false) && utf8_name(s->pet.name) && ascii(s->pet.breed,sizeof(s->pet.breed),false) && s->pet.food<=100 && s->pet.mood<=100 && s->pet.clean<=100 && s->pet.energy<=100 && s->pet.health<=100 && s->pet.coins<=L2_JS_MAX;}
static void canonical_snapshot(l2_snapshot_t *d,const l2_snapshot_t *s){memset(d,0,sizeof(*d));d->revision=s->revision;d->has_epoch_ms=s->has_epoch_ms;d->epoch_ms=s->has_epoch_ms?s->epoch_ms:0;d->scene=s->scene;d->action=s->action;d->weather=s->weather;d->gift_state=s->gift_state;strcpy(d->pet.pet_id,s->pet.pet_id);strcpy(d->pet.name,s->pet.name);strcpy(d->pet.breed,s->pet.breed);d->pet.food=s->pet.food;d->pet.mood=s->pet.mood;d->pet.clean=s->pet.clean;d->pet.energy=s->pet.energy;d->pet.health=s->pet.health;d->pet.coins=s->pet.coins;}
static void write_snapshot(writer_t *w,const l2_snapshot_t *s){number(w,s->revision,8);number(w,s->has_epoch_ms,1);number(w,s->epoch_ms,8);number(w,s->scene,1);number(w,s->action,1);number(w,s->weather,1);number(w,s->gift_state,1);bytes(w,s->pet.pet_id,65);bytes(w,s->pet.name,25);bytes(w,s->pet.breed,17);number(w,s->pet.food,1);number(w,s->pet.mood,1);number(w,s->pet.clean,1);number(w,s->pet.energy,1);number(w,s->pet.health,1);number(w,s->pet.coins,8);}
static bool readbool(reader_t *r){uint64_t n=readnumber(r,1);if(n>1)r->ok=false;return n==1;}
static void read_snapshot(reader_t *r,l2_snapshot_t *s){s->revision=readnumber(r,8);s->has_epoch_ms=readbool(r);s->epoch_ms=readnumber(r,8);s->scene=(l2_scene_t)readnumber(r,1);s->action=(l2_action_t)readnumber(r,1);s->weather=(l2_weather_t)readnumber(r,1);s->gift_state=(l2_gift_state_t)readnumber(r,1);readbytes(r,s->pet.pet_id,65);readbytes(r,s->pet.name,25);readbytes(r,s->pet.breed,17);s->pet.food=(uint8_t)readnumber(r,1);s->pet.mood=(uint8_t)readnumber(r,1);s->pet.clean=(uint8_t)readnumber(r,1);s->pet.energy=(uint8_t)readnumber(r,1);s->pet.health=(uint8_t)readnumber(r,1);s->pet.coins=readnumber(r,8);}
static bool same_snapshot(const l2_snapshot_t *a,const l2_snapshot_t *b){uint8_t x[160],y[160];writer_t wx={x,sizeof(x),0,true},wy={y,sizeof(y),0,true};write_snapshot(&wx,a);write_snapshot(&wy,b);return wx.ok && wy.ok && wx.pos==wy.pos && !memcmp(x,y,wx.pos);}
static bool receipt_valid(const l2_receipt_t *r){return r && hexid(r->peer_id) && r->counter && r->counter<=L2_JS_MAX && r->epoch_ms<=L2_JS_MAX && r->gift_kind==L2_GIFT_FLOWER && r->quantity==1;}
static bool same_receipt(const l2_receipt_t *a,const l2_receipt_t *b){return !strcmp(a->peer_id,b->peer_id) && a->counter==b->counter && a->epoch_ms==b->epoch_ms && a->gift_kind==b->gift_kind && a->quantity==b->quantity;}
static void copy_receipt(l2_receipt_t *d,const l2_receipt_t *s){memset(d,0,sizeof(*d));strcpy(d->peer_id,s->peer_id);d->counter=s->counter;d->epoch_ms=s->epoch_ms;d->gift_kind=s->gift_kind;d->quantity=s->quantity;}
static void write_receipt(writer_t *w,const l2_receipt_t *r){for(unsigned i=0;i<16;i++){uint8_t b=0;if(r->peer_id[0])b=(uint8_t)((hex(r->peer_id[2*i])<<4)|hex(r->peer_id[2*i+1]));number(w,b,1);}number(w,r->counter,8);number(w,r->epoch_ms,8);number(w,r->gift_kind,1);}
static void read_receipt(reader_t *r,l2_receipt_t *s){static const char h[]="0123456789abcdef";for(unsigned i=0;i<16;i++){uint8_t b=(uint8_t)readnumber(r,1);s->peer_id[2*i]=h[b>>4];s->peer_id[2*i+1]=h[b&15];}s->peer_id[32]=0;s->counter=readnumber(r,8);s->epoch_ms=readnumber(r,8);s->gift_kind=(uint8_t)readnumber(r,1);s->quantity=s->gift_kind?1:0;}
bool l2_meet_valid(const l2_meet_t *m){
 if(!m||((m->name[0]||m->breed[0])&&(!utf8_name(m->name)||!ascii(m->breed,17,false)))||m->stage<1||m->stage>3||m->epoch_ms>L2_JS_MAX)return false;
 uint8_t nz=0;for(unsigned i=0;i<16;i++)nz|=m->id[i];if(!nz)return false;
 if(m->method==1){if(m->count<4||m->count>8)return false;for(unsigned i=0;i<m->count-1u;i++){unsigned gap=m->mark[i*2]|(unsigned)m->mark[i*2+1]<<8;if(gap<60||gap>=1200)return false;}for(unsigned i=(m->count-1u)*2;i<16;i++)if(m->mark[i])return false;}
 else if(m->method==2){if(m->count<4||m->count>9)return false;unsigned seen=0;for(unsigned i=0;i<m->count;i++){unsigned d=m->mark[i];if(d>8||(seen&(1u<<d)))return false;seen|=1u<<d;}for(unsigned i=m->count;i<16;i++)if(m->mark[i])return false;}
 else return false;
 return true;
}
static void write_meet(writer_t *w,const l2_meet_t *m){bytes(w,m->id,16);number(w,m->method,1);number(w,m->count,1);bytes(w,m->mark,16);number(w,m->stage,1);number(w,m->epoch_ms,8);bytes(w,m->name,25);bytes(w,m->breed,17);}
static void read_meet(reader_t *r,l2_meet_t *m){readbytes(r,m->id,16);m->method=(uint8_t)readnumber(r,1);m->count=(uint8_t)readnumber(r,1);readbytes(r,m->mark,16);m->stage=(uint8_t)readnumber(r,1);m->epoch_ms=readnumber(r,8);readbytes(r,m->name,25);readbytes(r,m->breed,17);}
static size_t encode_saved(const l2_saved_t *s,uint8_t *out,size_t cap){writer_t w={out,cap,0,true};bytes(&w,"CFL2",4);number(&w,4,2);bytes(&w,s->device_id,33);number(&w,s->has_snapshot,1);write_snapshot(&w,&s->snapshot);number(&w,s->has_owner,1);bytes(&w,s->last_request.client_id,37);number(&w,s->last_request.seq,8);bytes(&w,s->last_request.request_id,65);bytes(&w,s->last_request.hash,32);number(&w,s->last_result.status,1);number(&w,s->last_result.revision,8);number(&w,s->last_result.event_counter,8);number(&w,s->next_event,8);number(&w,s->last_ack,8);number(&w,s->event_count,2);number(&w,s->peer_count,2);number(&w,s->outgoing_count,2);number(&w,s->next_peer_counter,8);number(&w,s->last_peer_ack,8);bytes(&w,s->last_peer_ack_id,33);number(&w,s->has_gift,1);write_receipt(&w,&s->last_gift);number(&w,s->gift_state,1);
 for(unsigned i=0;i<s->event_count;i++){const l2_event_t *e=&s->events[i];number(&w,e->counter,8);number(&w,e->epoch_ms,8);number(&w,e->kind==L2_EVENT_GIFT?(0x80u|e->peer_slot):e->kind==L2_EVENT_MEET?(0x40u|e->peer_slot):(unsigned)e->action,1);if(e->kind==L2_EVENT_GIFT)number(&w,e->peer_counter,8);if(e->kind==L2_EVENT_MEET)write_meet(&w,&e->meet);}
 for(unsigned i=0;i<s->peer_count;i++){write_receipt(&w,&s->peers[i]);number(&w,s->peer_first_outgoing[i],8);number(&w,s->peer_outgoing_acked[i],1);}
 for(unsigned i=0;i<s->outgoing_count;i++){unsigned slot=0;while(slot<s->peer_count && strcmp(s->peers[slot].peer_id,s->outgoing[i].peer_id))slot++;number(&w,slot,1);number(&w,s->outgoing[i].counter,8);}
 number(&w,s->terminal.counter,8);number(&w,s->terminal.status,1);number(&w,s->terminal.action,1);bytes(&w,s->terminal.reason,41);bytes(&w,s->terminal.save_digest,65);
 for(unsigned i=0;i<s->peer_count;i++)write_meet(&w,&s->encounters[i]);
 if(!w.ok || cap-w.pos<4)return 0;
 uint32_t crc=crc32(out,w.pos);
 number(&w,crc,4);
 return w.ok?w.pos:0;
}
/* Legacy-named field is a contiguous ACK frontier, not the last ACK arrival.
 * Per-peer permanent ACK flags are authoritative and may contain holes. */
static uint64_t peer_ack_frontier(const l2_saved_t *s,unsigned *last_slot){
 uint64_t frontier=0;unsigned last=L2_PEER_MAX;
 for(uint64_t want=1;want<s->next_peer_counter && want<=L2_PEER_MAX;want++){
  unsigned slot=0;while(slot<s->peer_count && s->peer_first_outgoing[slot]!=want)slot++;
  if(slot==s->peer_count || !s->peer_outgoing_acked[slot])break;
  frontier=want;last=slot;
 }
 if(last_slot)*last_slot=last;
 return frontier;
}
static bool terminal_valid(const l2_terminal_t *t){
 if(!t || !t->counter || t->counter>L2_JS_MAX || t->status<L2_TERMINAL_APPLIED || t->status>L2_TERMINAL_QUARANTINED || t->action<L2_ACTION_IDLE || t->action>L2_ACTION_SLEEP)return false;
 size_t n=0;for(;n<41&&t->reason[n];n++)if(!((t->reason[n]>='a'&&t->reason[n]<='z')||(t->reason[n]>='0'&&t->reason[n]<='9')||t->reason[n]=='_'))return false;
 if(!n||n>=41)return false;
 if((t->status==L2_TERMINAL_APPLIED&&strcmp(t->reason,"none")) || (t->status==L2_TERMINAL_REJECTED&&!strcmp(t->reason,"none")))return false;
 for(unsigned i=0;i<64;i++)if(hex(t->save_digest[i])<0)return false;
 return !t->save_digest[64];
}
static bool same_terminal(const l2_terminal_t *a,const l2_terminal_t *b){return a->counter==b->counter&&a->status==b->status&&!strcmp(a->reason,b->reason)&&!strcmp(a->save_digest,b->save_digest);}
static bool state_valid(const l2_saved_t *s){if(!hexid(s->device_id) || !s->next_event || s->next_event>L2_JS_MAX || s->last_ack>=s->next_event || !s->next_peer_counter || s->next_peer_counter>L2_JS_MAX || s->last_peer_ack>=s->next_peer_counter || s->event_count>L2_EVENT_MAX || s->peer_count>L2_PEER_MAX || s->outgoing_count>L2_PEER_MAX || s->gift_state>L2_GIFT_SHOWN)return false;
 if(s->has_snapshot && !snapshot_valid(&s->snapshot))return false;
 if(s->terminal.counter && (s->terminal.counter!=s->last_ack || !terminal_valid(&s->terminal)))return false;
 if(!s->terminal.counter && (s->terminal.status || s->terminal.action || s->terminal.reason[0] || s->terminal.save_digest[0]))return false;
 if(s->has_owner && (!uuid(s->last_request.client_id) || !s->last_request.seq || s->last_request.seq>L2_JS_MAX || !ascii(s->last_request.request_id,65,false) || s->last_result.status!=L2_OK))return false;
 if(s->last_result.revision>L2_JS_MAX || s->last_result.event_counter>L2_JS_MAX)return false;
 if(s->last_peer_ack){if(!hexid(s->last_peer_ack_id))return false;bool found=false;for(unsigned i=0;i<s->peer_count;i++)if(s->peer_first_outgoing[i]==s->last_peer_ack && !strcmp(s->peers[i].peer_id,s->last_peer_ack_id))found=true;if(!found)return false;}
 if(s->has_gift && (!receipt_valid(&s->last_gift) || s->gift_state==L2_GIFT_NONE))return false;
 unsigned reserved=0,pending=0;for(unsigned i=0;i<s->peer_count;i++){const l2_receipt_t *p=&s->peers[i];uint64_t out=s->peer_first_outgoing[i];if(!hexid(p->peer_id) || !strcmp(p->peer_id,s->device_id))return false;if(p->counter){if(!receipt_valid(p))return false;}else if((!out&&!s->encounters[i].stage) || p->epoch_ms || p->gift_kind || p->quantity)return false;if(s->encounters[i].stage&&!l2_meet_valid(&s->encounters[i]))return false;if(out){if(out>=s->next_peer_counter)return false;reserved++;if(!s->peer_outgoing_acked[i])pending++;}else if(s->peer_outgoing_acked[i])return false;for(unsigned j=0;j<i;j++)if(!strcmp(p->peer_id,s->peers[j].peer_id) || (out && out==s->peer_first_outgoing[j]))return false;}if(reserved!=s->next_peer_counter-1 || pending!=s->outgoing_count)return false;
 bool gift_slots[L2_PEER_MAX]={0};uint64_t prev=s->last_ack;for(unsigned i=0;i<s->event_count;i++){const l2_event_t *e=&s->events[i];if(e->counter!=prev+1 || e->counter>=s->next_event || e->epoch_ms>L2_JS_MAX)return false;prev=e->counter;if(e->kind==L2_EVENT_CARE){if(e->action<L2_ACTION_PET || e->action>L2_ACTION_SLEEP || e->peer_slot!=255 || e->peer_counter || e->gift_kind || e->quantity)return false;}else if(e->kind==L2_EVENT_GIFT){if(e->peer_slot>=s->peer_count || !e->peer_counter || e->peer_counter>s->peers[e->peer_slot].counter || e->gift_kind!=L2_GIFT_FLOWER || e->quantity!=1 || e->action!=L2_ACTION_IDLE || gift_slots[e->peer_slot])return false;gift_slots[e->peer_slot]=true;}else if(e->kind==L2_EVENT_MEET){if(e->peer_slot>=s->peer_count||!l2_meet_valid(&e->meet)||e->meet.stage!=3||e->action!=L2_ACTION_IDLE||e->peer_counter||e->gift_kind||e->quantity)return false;}else return false;}if(prev!=s->next_event-1)return false;
 prev=0;for(unsigned i=0;i<s->outgoing_count;i++){const l2_receipt_t *o=&s->outgoing[i];if(!receipt_valid(o) || o->counter<=prev || o->counter>=s->next_peer_counter)return false;unsigned slot=0;while(slot<s->peer_count && strcmp(s->peers[slot].peer_id,o->peer_id))slot++;if(slot==s->peer_count || s->peer_first_outgoing[slot]!=o->counter || s->peer_outgoing_acked[slot])return false;prev=o->counter;}unsigned frontier_slot;if(peer_ack_frontier(s,&frontier_slot)!=s->last_peer_ack)return false;if(frontier_slot<L2_PEER_MAX){if(strcmp(s->last_peer_ack_id,s->peers[frontier_slot].peer_id))return false;}else if(s->last_peer_ack_id[0])return false;return true;}
static bool decode_saved(l2_saved_t *s,const uint8_t *b,size_t n){if(!b || n<10 || n>L2_STORE_MAX || memcmp(b,"CFL2",4))return false;uint32_t crc=(uint32_t)b[n-4]|((uint32_t)b[n-3]<<8)|((uint32_t)b[n-2]<<16)|((uint32_t)b[n-1]<<24);if(crc32(b,n-4)!=crc)return false;reader_t r={b,n-4,4,true};uint64_t schema=readnumber(&r,2);if(schema!=2&&schema!=3&&schema!=4)return false;memset(s,0,sizeof(*s));readbytes(&r,s->device_id,33);s->has_snapshot=readbool(&r);read_snapshot(&r,&s->snapshot);s->has_owner=readbool(&r);readbytes(&r,s->last_request.client_id,37);s->last_request.seq=readnumber(&r,8);readbytes(&r,s->last_request.request_id,65);readbytes(&r,s->last_request.hash,32);s->last_result.status=(l2_status_t)readnumber(&r,1);s->last_result.revision=readnumber(&r,8);s->last_result.event_counter=readnumber(&r,8);s->next_event=readnumber(&r,8);s->last_ack=readnumber(&r,8);s->event_count=(uint16_t)readnumber(&r,2);s->peer_count=(uint16_t)readnumber(&r,2);s->outgoing_count=(uint16_t)readnumber(&r,2);s->next_peer_counter=readnumber(&r,8);s->last_peer_ack=readnumber(&r,8);readbytes(&r,s->last_peer_ack_id,33);s->has_gift=readbool(&r);read_receipt(&r,&s->last_gift);s->gift_state=(l2_gift_state_t)readnumber(&r,1);if(!r.ok || s->event_count>L2_EVENT_MAX || s->peer_count>L2_PEER_MAX || s->outgoing_count>L2_PEER_MAX)return false;
 for(unsigned i=0;i<s->event_count;i++){l2_event_t *e=&s->events[i];e->counter=readnumber(&r,8);e->epoch_ms=readnumber(&r,8);uint8_t tag=(uint8_t)readnumber(&r,1);if(tag&0x80){if(tag&0x60)r.ok=false;e->kind=L2_EVENT_GIFT;e->peer_slot=tag&31;e->peer_counter=readnumber(&r,8);e->gift_kind=L2_GIFT_FLOWER;e->quantity=1;}else if((tag&0x40)&&schema>=4){if(tag&0x20)r.ok=false;e->kind=L2_EVENT_MEET;e->peer_slot=tag&31;read_meet(&r,&e->meet);}else{e->kind=L2_EVENT_CARE;e->action=(l2_action_t)tag;e->peer_slot=255;}}
 for(unsigned i=0;i<s->peer_count;i++){read_receipt(&r,&s->peers[i]);s->peer_first_outgoing[i]=readnumber(&r,8);s->peer_outgoing_acked[i]=readbool(&r);}
 for(unsigned i=0;i<s->outgoing_count;i++){unsigned slot=(unsigned)readnumber(&r,1);uint64_t count=readnumber(&r,8);if(slot>=s->peer_count){r.ok=false;break;}l2_receipt_t *o=&s->outgoing[i];strcpy(o->peer_id,s->peers[slot].peer_id);o->counter=count;o->gift_kind=L2_GIFT_FLOWER;o->quantity=1;}if(schema>=3){s->terminal.counter=readnumber(&r,8);s->terminal.status=(l2_terminal_status_t)readnumber(&r,1);s->terminal.action=(l2_action_t)readnumber(&r,1);readbytes(&r,s->terminal.reason,41);readbytes(&r,s->terminal.save_digest,65);}if(schema>=4)for(unsigned i=0;i<s->peer_count;i++)read_meet(&r,&s->encounters[i]);return r.ok && r.pos==r.n && state_valid(s);}
static l2_status_t available(const l2_core_t *c){return !c?L2_NOT_READY:c->storage_error?L2_STORAGE_ERROR:!c->ready?L2_NOT_READY:L2_OK;}
static l2_status_t commit(l2_core_t *c){size_t n=encode_saved(&c->work,c->blob,sizeof(c->blob));if(!n)return L2_QUEUE_FULL;if(!state_valid(&c->work)){c->storage_error=true;return L2_CORRUPT;}if(!c->persist || !c->persist(c->persist_ctx,c->blob,n)){c->storage_error=true;return L2_STORAGE_ERROR;}c->saved=c->work;return L2_OK;}
l2_status_t l2_init_new(l2_core_t *c,const char *id,l2_persist_fn fn,void *ctx){if(!c || !hexid(id) || !fn)return L2_INVALID;if(c->ready || c->storage_error)return L2_NOT_READY;memset(&c->work,0,sizeof(c->work));strcpy(c->work.device_id,id);c->work.next_event=c->work.next_peer_counter=1;c->persist=fn;c->persist_ctx=ctx;l2_status_t r=commit(c);if(r==L2_OK)c->ready=true;return r;}
l2_status_t l2_load(l2_core_t *c,const uint8_t *b,size_t n,l2_persist_fn fn,void *ctx){if(!c || !fn)return L2_INVALID;if(!decode_saved(&c->work,b,n)){c->storage_error=true;return L2_CORRUPT;}c->saved=c->work;c->persist=fn;c->persist_ctx=ctx;c->ready=true;c->storage_error=false;c->care_change=c->gift_change=0;c->bath_allowed_owner[0]=0;c->bath_confirmed_session=0;return L2_OK;}
size_t l2_encode(const l2_core_t *c,uint8_t *out,size_t cap){return c && c->ready && out?encode_saved(&c->saved,out,cap):0;}
static l2_status_t request_check(const l2_core_t *c,const l2_request_t *r){l2_status_t a=available(c);if(a!=L2_OK)return a;if(!r || !uuid(r->client_id) || !r->seq || r->seq>L2_JS_MAX || !ascii(r->request_id,65,false))return L2_INVALID;if(!c->saved.has_owner)return r->seq==1?L2_OK:L2_SEQUENCE_GAP;if(strcmp(r->client_id,c->saved.last_request.client_id))return L2_OWNER_CONFLICT;if(r->seq==c->saved.last_request.seq)return !strcmp(r->request_id,c->saved.last_request.request_id) && !memcmp(r->hash,c->saved.last_request.hash,32)?L2_DUPLICATE:L2_REQUEST_CONFLICT;if(r->seq<c->saved.last_request.seq)return L2_STALE;return r->seq==c->saved.last_request.seq+1?L2_OK:L2_SEQUENCE_GAP;}
static void save_request(l2_core_t *c,const l2_request_t *r){c->work.has_owner=true;memset(&c->work.last_request,0,sizeof(c->work.last_request));strcpy(c->work.last_request.client_id,r->client_id);strcpy(c->work.last_request.request_id,r->request_id);c->work.last_request.seq=r->seq;memcpy(c->work.last_request.hash,r->hash,32);c->work.last_result=(l2_result_t){.status=L2_OK,.revision=c->work.has_snapshot?c->work.snapshot.revision:0,.event_counter=c->work.last_ack};}
l2_status_t l2_set_snapshot(l2_core_t *c,const l2_request_t *r,const l2_snapshot_t *s){l2_status_t a=request_check(c,r);if(a!=L2_OK)return a;if(!snapshot_valid(s))return L2_INVALID;l2_snapshot_t normalized;canonical_snapshot(&normalized,s);s=&normalized;if(c->saved.has_snapshot){if(strcmp(s->pet.pet_id,c->saved.snapshot.pet.pet_id))return L2_PET_MISMATCH;if(s->revision<c->saved.snapshot.revision)return L2_STALE;if(s->revision==c->saved.snapshot.revision && !same_snapshot(s,&c->saved.snapshot))return L2_REVISION_CONFLICT;}c->work=c->saved;canonical_snapshot(&c->work.snapshot,s);c->work.has_snapshot=true;save_request(c,r);return commit(c);}
/* Terminal receipt and FIFO frontier are committed in the same atomic blob. */
l2_status_t l2_ack_event_result(l2_core_t *c,const l2_request_t *r,const l2_terminal_t *receipt){
 l2_status_t a=request_check(c,r);if(a!=L2_OK)return a;
 if(!terminal_valid(receipt))return L2_INVALID;
 uint64_t id=receipt->counter;
 if(id<c->saved.last_ack)return L2_STALE;
 if(id==c->saved.last_ack){
  if(!c->saved.terminal.counter)return L2_STALE;
  if(!same_terminal(receipt,&c->saved.terminal))return L2_REQUEST_CONFLICT;
  c->work=c->saved;save_request(c,r);a=commit(c);return a==L2_OK?L2_DUPLICATE:a;
 }
 if(!c->saved.event_count||c->saved.events[0].counter!=id)return L2_ACK_MISMATCH;
 c->work=c->saved;c->work.terminal=*receipt;c->work.terminal.action=c->work.events[0].action;
 c->work.event_count--;memmove(c->work.events,c->work.events+1,c->work.event_count*sizeof(c->work.events[0]));c->work.last_ack=id;
 save_request(c,r);return commit(c);
}
/* No receipt-less dequeue, including through historical in-process callers. */
l2_status_t l2_ack_event(l2_core_t *c,const l2_request_t *r,uint64_t id){(void)c;(void)r;(void)id;return L2_INVALID;}
bool l2_bath_allowed(const l2_core_t *c){return c&&c->ready&&!c->storage_error&&c->saved.has_owner&&c->bath_allowed_owner[0]&&!strcmp(c->bath_allowed_owner,c->saved.last_request.client_id);}
l2_status_t l2_confirm_bath(l2_core_t *c,const char *client_id,uint32_t session){
 l2_status_t a=available(c);if(a!=L2_OK)return a;
 if(!uuid(client_id)||!session)return L2_INVALID;
 if(!c->saved.has_owner||!c->saved.has_snapshot)return L2_NOT_READY;
 if(strcmp(client_id,c->saved.last_request.client_id))return L2_OWNER_CONFLICT;
 strcpy(c->bath_allowed_owner,client_id);c->bath_confirmed_session=session;return L2_OK;
}
l2_status_t l2_emit_care(l2_core_t *c,l2_action_t type,uint64_t ms){l2_status_t a=available(c);if(a!=L2_OK)return a;if((type!=L2_ACTION_PET&&type!=L2_ACTION_FEED&&type!=L2_ACTION_WATER&&type!=L2_ACTION_BATH&&type!=L2_ACTION_PLAY&&type!=L2_ACTION_SLEEP) || ms>L2_JS_MAX)return L2_INVALID;if(type==L2_ACTION_BATH&&!l2_bath_allowed(c))return L2_NOT_READY;if(!c->saved.has_snapshot)return L2_NOT_READY;if(c->saved.event_count==L2_EVENT_MAX)return L2_QUEUE_FULL;if(c->saved.next_event>=L2_JS_MAX)return L2_INVALID;c->work=c->saved;l2_event_t *e=&c->work.events[c->work.event_count++];memset(e,0,sizeof(*e));e->counter=c->work.next_event++;e->epoch_ms=ms;e->kind=L2_EVENT_CARE;e->action=type;e->peer_slot=255;a=commit(c);if(a==L2_OK)c->care_change++;return a;}
l2_status_t l2_receive_gift(l2_core_t *c,const l2_receipt_t *r){
 l2_status_t a=available(c);if(a!=L2_OK)return a;
 if(!receipt_valid(r) || !strcmp(r->peer_id,c->saved.device_id))return L2_INVALID;
 unsigned slot=0;while(slot<c->saved.peer_count && strcmp(c->saved.peers[slot].peer_id,r->peer_id))slot++;
 if(slot<c->saved.peer_count && c->saved.peers[slot].counter){
  const l2_receipt_t *p=&c->saved.peers[slot];
  if(r->counter<p->counter)return L2_STALE;
  if(r->counter==p->counter)return same_receipt(r,p)?L2_DUPLICATE:L2_REQUEST_CONFLICT;
  /* A later exchange may refresh evidence, never award a second first-flower. */
  c->work=c->saved;copy_receipt(&c->work.peers[slot],r);a=commit(c);
  return a==L2_OK?L2_DUPLICATE:a;
 }
 if(slot==c->saved.peer_count && c->saved.peer_count==L2_PEER_MAX)return L2_PEER_FULL;
 if(c->saved.event_count==L2_EVENT_MAX)return L2_QUEUE_FULL;
 if(c->saved.next_event>=L2_JS_MAX)return L2_INVALID;
 c->work=c->saved;if(slot==c->work.peer_count)c->work.peer_count++;
 copy_receipt(&c->work.peers[slot],r);copy_receipt(&c->work.last_gift,r);
 c->work.has_gift=true;c->work.gift_state=L2_GIFT_PENDING;
 l2_event_t *e=&c->work.events[c->work.event_count++];memset(e,0,sizeof(*e));
 e->counter=c->work.next_event++;e->epoch_ms=r->epoch_ms;e->peer_counter=r->counter;
 e->kind=L2_EVENT_GIFT;e->action=L2_ACTION_IDLE;e->peer_slot=(uint8_t)slot;e->gift_kind=r->gift_kind;e->quantity=r->quantity;
 a=commit(c);if(a==L2_OK)c->gift_change++;return a;
}
l2_status_t l2_set_gift_state(l2_core_t *c,l2_gift_state_t state){l2_status_t a=available(c);if(a!=L2_OK)return a;if(!c->saved.has_gift || state<L2_GIFT_PENDING || state>L2_GIFT_SHOWN)return L2_INVALID;if(state==c->saved.gift_state)return L2_DUPLICATE;if(state<c->saved.gift_state)return L2_STALE;c->work=c->saved;c->work.gift_state=state;return commit(c);}
l2_status_t l2_peer_reserve_gift(l2_core_t *c,const char *id,uint8_t kind,uint32_t qty,l2_receipt_t *out){
 l2_status_t a=available(c);if(a!=L2_OK)return a;
 if(!out || !hexid(id) || !strcmp(id,c->saved.device_id) || kind!=L2_GIFT_FLOWER || qty!=1)return L2_INVALID;
 unsigned slot=0;while(slot<c->saved.peer_count && strcmp(c->saved.peers[slot].peer_id,id))slot++;
 if(slot<c->saved.peer_count && c->saved.peer_first_outgoing[slot]){
  memset(out,0,sizeof(*out));strcpy(out->peer_id,id);out->counter=c->saved.peer_first_outgoing[slot];out->gift_kind=L2_GIFT_FLOWER;out->quantity=1;return L2_DUPLICATE;
 }
 if(slot==c->saved.peer_count && c->saved.peer_count==L2_PEER_MAX)return L2_PEER_FULL;
 if(c->saved.outgoing_count==L2_PEER_MAX)return L2_QUEUE_FULL;
 if(c->saved.next_peer_counter>=L2_JS_MAX)return L2_INVALID;
 c->work=c->saved;
 if(slot==c->work.peer_count){memset(&c->work.peers[slot],0,sizeof(c->work.peers[slot]));strcpy(c->work.peers[slot].peer_id,id);c->work.peer_count++;}
 l2_receipt_t *r=&c->work.outgoing[c->work.outgoing_count++];memset(r,0,sizeof(*r));strcpy(r->peer_id,id);
 r->counter=c->work.next_peer_counter++;r->gift_kind=kind;r->quantity=qty;c->work.peer_first_outgoing[slot]=r->counter;c->work.peer_outgoing_acked[slot]=false;
 a=commit(c);if(a==L2_OK)*out=*r;return a;
}
bool l2_peer_peek_outgoing(const l2_core_t *c,l2_receipt_t *out){if(!c || !c->ready || !out || !c->saved.outgoing_count)return false;*out=c->saved.outgoing[0];return true;}
l2_status_t l2_peer_ack_outgoing(l2_core_t *c,const char *id,uint64_t count){
 l2_status_t a=available(c);if(a!=L2_OK)return a;
 if(!hexid(id) || !count || count>L2_JS_MAX)return L2_INVALID;
 unsigned slot=0;while(slot<c->saved.peer_count && strcmp(c->saved.peers[slot].peer_id,id))slot++;
 if(slot==c->saved.peer_count || c->saved.peer_first_outgoing[slot]!=count)return L2_ACK_MISMATCH;
 if(c->saved.peer_outgoing_acked[slot])return L2_DUPLICATE;
 unsigned pending_slot=0;
 while(pending_slot<c->saved.outgoing_count && (c->saved.outgoing[pending_slot].counter!=count || strcmp(id,c->saved.outgoing[pending_slot].peer_id)))pending_slot++;
 if(pending_slot==c->saved.outgoing_count)return L2_ACK_MISMATCH;
 c->work=c->saved;c->work.outgoing_count--;
 memmove(c->work.outgoing+pending_slot,c->work.outgoing+pending_slot+1,(c->work.outgoing_count-pending_slot)*sizeof(c->work.outgoing[0]));
 c->work.peer_outgoing_acked[slot]=true;
 unsigned frontier_slot;c->work.last_peer_ack=peer_ack_frontier(&c->work,&frontier_slot);
 memset(c->work.last_peer_ack_id,0,sizeof(c->work.last_peer_ack_id));
 if(frontier_slot<L2_PEER_MAX)strcpy(c->work.last_peer_ack_id,c->work.peers[frontier_slot].peer_id);
 return commit(c);
}
bool l2_get_device_id(const l2_core_t *c,uint8_t out[16]){if(!c || !c->ready || !out || !hexid(c->saved.device_id))return false;for(unsigned i=0;i<16;i++)out[i]=(uint8_t)((hex(c->saved.device_id[2*i])<<4)|hex(c->saved.device_id[2*i+1]));return true;}
void l2_get_view(const l2_core_t *c,l2_view_t *v){if(!v)return;memset(v,0,sizeof(*v));if(!c)return;v->ready=c->ready;v->storage_error=c->storage_error;v->bath_allowed=l2_bath_allowed(c);if(!c->ready)return;strcpy(v->device_id,c->saved.device_id);v->has_snapshot=c->saved.has_snapshot;v->snapshot=c->saved.snapshot;v->terminal=c->saved.terminal;v->pending_events=c->saved.event_count;v->peer_count=c->saved.peer_count;v->next_event=c->saved.next_event;v->last_ack=c->saved.last_ack;v->care_change=c->care_change;v->gift_change=c->gift_change;v->has_gift=c->saved.has_gift;v->last_gift=c->saved.last_gift;v->gift_state=c->saved.gift_state;}
bool l2_peek_event(const l2_core_t *c,l2_event_t *e){if(!c || !c->ready || !e || !c->saved.event_count)return false;*e=c->saved.events[0];return true;}
bool l2_get_peer(const l2_core_t *c,uint8_t slot,l2_receipt_t *out){if(!c || !c->ready || !out || slot>=c->saved.peer_count)return false;*out=c->saved.peers[slot];return true;}
void l2_get_last_result(const l2_core_t *c,l2_result_t *out){if(out){memset(out,0,sizeof(*out));if(c && c->ready)*out=c->saved.last_result;}}
const char *l2_status_name(l2_status_t s){static const char *const n[]={"ok","duplicate","invalid","not_ready","storage_error","stale","revision_conflict","pet_mismatch","owner_conflict","request_conflict","sequence_gap","queue_full","peer_full","ack_mismatch","corrupt"};return s>=L2_OK && s<=L2_CORRUPT?n[s]:"invalid";}

static unsigned encounter_slot(const l2_core_t *c,const char *id){unsigned i=0;while(i<c->saved.peer_count&&strcmp(c->saved.peers[i].peer_id,id))i++;return i;}
bool l2_get_encounter(const l2_core_t *c,const char *id,l2_meet_t *m){if(!c||!id||!m)return false;unsigned i=encounter_slot(c,id);if(i==c->saved.peer_count)return false;*m=c->saved.encounters[i];return m->stage!=0;}
l2_status_t l2_prepare_encounter(l2_core_t *c,const char *id,const l2_meet_t *m){
 l2_status_t a=available(c);if(a!=L2_OK)return a;if(!hexid(id)||!strcmp(id,c->saved.device_id)||!l2_meet_valid(m)||m->stage!=1||!c->saved.has_snapshot)return L2_INVALID;
 unsigned i=encounter_slot(c,id);if(i<c->saved.peer_count&&c->saved.encounters[i].stage){const l2_meet_t *old=&c->saved.encounters[i];if(!memcmp(old->id,m->id,16))return old->method==m->method&&old->count==m->count&&!memcmp(old->mark,m->mark,16)?L2_DUPLICATE:L2_REQUEST_CONFLICT;if(old->stage<3)return L2_NOT_READY;}
 if(i==L2_PEER_MAX)return L2_PEER_FULL;
 if(c->saved.event_count==L2_EVENT_MAX)return L2_QUEUE_FULL;
 c->work=c->saved;if(i==c->work.peer_count){memset(&c->work.peers[i],0,sizeof(c->work.peers[i]));strcpy(c->work.peers[i].peer_id,id);c->work.peer_count++;}c->work.encounters[i]=*m;
 /* Reserve byte capacity for the eventual event before entering commit. */
 size_t n=encode_saved(&c->work,c->blob,sizeof(c->blob));if(!n||n+110>L2_STORE_MAX)return L2_QUEUE_FULL;return commit(c);
}
l2_status_t l2_commit_encounter(l2_core_t *c,const char *id,const uint8_t key[16]){
 l2_status_t a=available(c);if(a!=L2_OK)return a;unsigned i=encounter_slot(c,id);if(i==c->saved.peer_count||!c->saved.encounters[i].stage||memcmp(c->saved.encounters[i].id,key,16))return L2_ACK_MISMATCH;
 if(c->saved.encounters[i].stage>=2)return L2_DUPLICATE;
 c->work=c->saved;c->work.encounters[i].stage=2;return commit(c);
}
l2_status_t l2_settle_encounter(l2_core_t *c,const char *id,const uint8_t key[16]){
 l2_status_t a=available(c);if(a!=L2_OK)return a;unsigned i=encounter_slot(c,id);if(i==c->saved.peer_count||c->saved.encounters[i].stage<2||memcmp(c->saved.encounters[i].id,key,16))return L2_ACK_MISMATCH;if(c->saved.encounters[i].stage==3)return L2_DUPLICATE;
 if(c->saved.event_count==L2_EVENT_MAX||c->saved.next_event>=L2_JS_MAX)return L2_QUEUE_FULL;
 c->work=c->saved;c->work.encounters[i].stage=3;l2_event_t *e=&c->work.events[c->work.event_count++];memset(e,0,sizeof(*e));e->counter=c->work.next_event++;e->kind=L2_EVENT_MEET;e->peer_slot=(uint8_t)i;e->meet=c->work.encounters[i];e->epoch_ms=e->meet.epoch_ms;
 if(!encode_saved(&c->work,c->blob,sizeof(c->blob)))return L2_QUEUE_FULL;
 return commit(c);
}
