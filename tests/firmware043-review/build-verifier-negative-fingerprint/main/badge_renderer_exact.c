/* Host C prototype port of user-provided BadgeRenderer, not device firmware.
 * Original source/provenance pinned in reference/. No domain/protocol effects. */
#include "badge_renderer_exact.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "room_cache_fingerprint.h"
#ifdef ESP_PLATFORM
#include "esp_heap_caps.h"
#include "esp_timer.h"
#include "esp_rom_crc.h"
extern bool badge_renderer_checkpoint(void);
extern void badge_renderer_mark_phase(unsigned phase);
#define VR_PHASE(n) badge_renderer_mark_phase(n)
#else
#define VR_PHASE(n) ((void)0)

#endif
#define NB 14
#define NC 56
#define NT 24
#define NA 3
#define PI 3.14159265358979323846
#define D2R (PI/180.0)
typedef struct{const uint8_t *p,*end;
bool ok;
}
 reader_t;

typedef struct{int parent;
float pivot[3],rot[3];
char name[32];
}
 bone_t;

typedef struct{uint8_t u0,v0,u1,v1,fl;
}
 face_t;

typedef struct{unsigned bone;
float local[12],corner[24];
face_t faces[6];
}
 cube_t;

typedef struct{unsigned bone,channel,count;
const uint8_t *keys;
}
 track_t;

typedef struct{char name[16];
double duration;
bool loop;
unsigned count;
track_t tracks[NT];
}
 anim_t;

typedef struct{float v[15];
int32_t info[4];
int16_t box[4];
uint8_t clamp[4];
}
 triangle_t;

_Static_assert(sizeof(triangle_t)==88,"budget triangle layout");

struct vr{uint16_t color[VR_ROI*VR_ROI],depth[VR_ROI*VR_ROI];
uint8_t owner[VR_ROI*VR_ROI];
triangle_t triangles[VR_MAX_TRI];
bone_t bones[NB];
cube_t cubes[NC];
anim_t animations[NA];
float bonew[NB][12],view[12];
uint16_t palette[16],lut[256];
const uint8_t *texture;
unsigned tw,th,bone_count,cube_count,anim_count;
double position_scale,rotation_scale,scale_scale,animation_position_scale;
unsigned ntri;
int roi_x,roi_y;
}
;

_Static_assert(sizeof(struct vr)<=VR_PSRAM_LIMIT,"prototype PSRAM-equivalent budget");

static double now_us(void){
#ifdef ESP_PLATFORM
return (double)esp_timer_get_time();

#else
struct timespec ts;
clock_gettime(CLOCK_MONOTONIC,&ts);
return ts.tv_sec*1e6+ts.tv_nsec/1e3;

#endif
}

static uint8_t u8(reader_t *r){if(r->p==r->end){r->ok=false;
return 0;
}
return *r->p++;
}

static uint16_t u16(reader_t *r){uint16_t a=u8(r);
return a|((uint16_t)u8(r)<<8);
}

static int16_t i16(reader_t *r){return (int16_t)u16(r);
}

static uint32_t u32(reader_t *r){uint32_t a=u16(r);
return a|((uint32_t)u16(r)<<16);
}

static bool text(reader_t *r,char *s,size_t cap){unsigned n=u8(r);
if(!r->ok||n>=cap||(size_t)(r->end-r->p)<n){r->ok=false;
return false;
}
memcpy(s,r->p,n);
s[n]=0;
r->p+=n;
return true;
}

static bool chunk(const uint8_t *p,size_t n,const char *tag,reader_t *out){if(n<8||memcmp(p,"PCAT",4))return false;
reader_t r={p+4,p+n,true}
;
unsigned count=u32(&r);
bool found=false;
if(count>32)return false;
for(unsigned i=0;i<count;i++){if(r.end-r.p<8)return false;
const uint8_t *id=r.p;
r.p+=4;
uint32_t size=u32(&r);
if(size>(size_t)(r.end-r.p))return false;
if(!memcmp(id,tag,4)){if(found)return false;
*out=(reader_t){r.p,r.p+size,true}
;
found=true;
}
size_t padded=(size_t)size+(size&1u);
if(padded>(size_t)(r.end-r.p))return false;
r.p+=padded;
}
return r.ok&&r.p==r.end&&found;
}

static void mul(const float *a,const float *b,float *out){float r[12];
for(unsigned i=0;i<3;i++){double a0=a[i*4],a1=a[i*4+1],a2=a[i*4+2],a3=a[i*4+3];
r[i*4]=(float)(a0*b[0]+a1*b[4]+a2*b[8]);
r[i*4+1]=(float)(a0*b[1]+a1*b[5]+a2*b[9]);
r[i*4+2]=(float)(a0*b[2]+a1*b[6]+a2*b[10]);
r[i*4+3]=(float)(a0*b[3]+a1*b[7]+a2*b[11]+a3);
}
memcpy(out,r,48);
}

static void trs(float *o,const double *t,const double *r,const double *s){double x=r[0]*D2R,y=r[1]*D2R,z=r[2]*D2R,cx=cos(x),sx=sin(x),cy=cos(y),sy=sin(y),cz=cos(z),sz=sin(z);
o[0]=(float)(cz*cy*s[0]);
o[1]=(float)((cz*sy*sx-sz*cx)*s[1]);
o[2]=(float)((cz*sy*cx+sz*sx)*s[2]);
o[3]=(float)t[0];
o[4]=(float)(sz*cy*s[0]);
o[5]=(float)((sz*sy*sx+cz*cx)*s[1]);
o[6]=(float)((sz*sy*cx-cz*sx)*s[2]);
o[7]=(float)t[1];
o[8]=(float)(-sy*s[0]);
o[9]=(float)(cy*sx*s[1]);
o[10]=(float)(cy*cx*s[2]);
o[11]=(float)t[2];
}

static uint16_t shade(uint16_t c,double k){unsigned r=(c>>11)<<3,g=((c>>5)&63)<<2,b=(c&31)<<3;
r|=r>>5;
g|=g>>6;
b|=b>>5;
r=(unsigned)fmin(255,r*k);
g=(unsigned)fmin(255,g*k);
b=(unsigned)fmin(255,b*k);
return (uint16_t)(((r>>3)<<11)|((g>>2)<<5)|(b>>3));
}

static void camera(vr_t *r,double yaw,double pitch,double distance){double target[3]={0,8.6,2.2}
,cy=cos(yaw*D2R),sy=sin(yaw*D2R),cp=cos(pitch*D2R),sp=sin(pitch*D2R);
double e[3]={target[0]+distance*sy*cp,target[1]+distance*sp,target[2]-distance*cy*cp}
,f[3],right[3],up[3];
for(unsigned i=0;i<3;i++)f[i]=target[i]-e[i];
double fl=sqrt(f[0]*f[0]+f[1]*f[1]+f[2]*f[2]);
for(unsigned i=0;i<3;i++)f[i]/=fl;
right[0]=f[2];
right[1]=0;
right[2]=-f[0];
double rl=hypot(right[0],right[2]);
for(unsigned i=0;i<3;i++)right[i]/=rl;
up[0]=f[1]*right[2]-f[2]*right[1];
up[1]=f[2]*right[0]-f[0]*right[2];
up[2]=f[0]*right[1]-f[1]*right[0];
for(unsigned i=0;i<3;i++){r->view[i]=(float)right[i];
r->view[4+i]=(float)up[i];
r->view[8+i]=(float)f[i];
}
r->view[3]=(float)(-(right[0]*e[0]+right[1]*e[1]+right[2]*e[2]));
r->view[7]=(float)(-(up[0]*e[0]+up[1]*e[1]+up[2]*e[2]));
r->view[11]=(float)(-(f[0]*e[0]+f[1]*e[1]+f[2]*e[2]));
}

static bool load(vr_t *r,const uint8_t *p,size_t n){reader_t q;
if(!chunk(p,n,"HEAD",&q)||u16(&q)!=1)return false;
r->tw=u16(&q);
r->th=u16(&q);
r->position_scale=u16(&q);
r->rotation_scale=u16(&q);
r->scale_scale=u16(&q);
r->animation_position_scale=u16(&q);
if(!q.ok||r->tw!=256||r->th!=256||!r->position_scale||!r->rotation_scale||!r->scale_scale||!r->animation_position_scale)return false;

 if(!chunk(p,n,"BONE",&q)||(r->bone_count=u16(&q))!=NB)return false;
for(unsigned i=0;i<NB;i++){bone_t *b=r->bones+i;
b->parent=i16(&q);
for(unsigned j=0;j<3;j++)b->pivot[j]=(float)(i16(&q)/r->position_scale);
for(unsigned j=0;j<3;j++)b->rot[j]=(float)(i16(&q)/r->rotation_scale);
if(b->parent>= (int)i||b->parent< -1||!text(&q,b->name,sizeof(b->name)))return false;
}
if(!q.ok||q.p!=q.end)return false;

 if(!chunk(p,n,"CUBE",&q)||(r->cube_count=u16(&q))!=NC)return false;
for(unsigned i=0;i<NC;i++){cube_t *c=r->cubes+i;
c->bone=u8(&q);
u8(&q);
if(c->bone>=NB)return false;
double from[3],to[3],origin[3],rot[3],t[3],scale[3]={1,1,1}
;
for(unsigned j=0;j<3;j++)from[j]=i16(&q)/r->position_scale;
for(unsigned j=0;j<3;j++)to[j]=i16(&q)/r->position_scale;
for(unsigned j=0;j<3;j++)origin[j]=i16(&q)/r->position_scale;
for(unsigned j=0;j<3;j++)rot[j]=i16(&q)/r->rotation_scale;
for(unsigned j=0;j<3;j++)t[j]=origin[j]-r->bones[c->bone].pivot[j];
trs(c->local,t,rot,scale);
for(unsigned k=0;k<8;k++)for(unsigned j=0;j<3;j++)c->corner[k*3+j]=(float)((from[j]+to[j])/2-origin[j]+((k&(4u>>j))?.5:-.5)*(to[j]-from[j]));
for(unsigned f=0;f<6;f++){c->faces[f]=(face_t){u8(&q),u8(&q),u8(&q),u8(&q),u8(&q)}
;
}
}
if(!q.ok||q.p!=q.end)return false;

 if(!chunk(p,n,"ANIM",&q)||(r->anim_count=u16(&q))!=NA)return false;
for(unsigned a=0;a<NA;a++){anim_t *an=r->animations+a;
if(!text(&q,an->name,sizeof(an->name)))return false;
an->duration=u16(&q)/1000.0;
an->loop=u8(&q)!=0;
an->count=u16(&q);
if(an->count>NT||an->duration<=0)return false;
for(unsigned j=0;j<an->count;j++){track_t *t=an->tracks+j;
t->bone=u8(&q);
t->channel=u8(&q);
t->count=u16(&q);
t->keys=q.p;
if(t->bone>=NB||t->channel>2||!t->count||t->count>128||(size_t)(q.end-q.p)<t->count*10u)return false;
q.p+=t->count*10u;
}
}
if(!q.ok||q.p!=q.end)return false;

 if(!chunk(p,n,"TEX4",&q)||u16(&q)!=256||u16(&q)!=256)return false;
unsigned textures=u16(&q);
if(textures>8)return false;
for(unsigned i=0;i<textures;i++){char name[32];
if(!text(&q,name,sizeof(name)))return false;
unsigned colors=u8(&q);
uint16_t pal[16];
for(unsigned j=0;j<16;j++)pal[j]=u16(&q);
if(colors>16||q.end-q.p<32768)return false;
if(!strcmp(name,"orange")){memcpy(r->palette,pal,sizeof(pal));
r->texture=q.p;
}
q.p+=32768;
}
if(!q.ok||q.p!=q.end||!r->texture)return false;
for(unsigned l=0;l<16;l++)for(unsigned c=0;c<16;c++)r->lut[l*16+c]=shade(r->palette[c],.45+l*(.65/15));
camera(r,-28,14,90);
return true;
}

vr_t *vr_create(const uint8_t *p,size_t n,char *error,size_t cap){if(!p||n<8){if(error&&cap)snprintf(error,cap,"invalid_input");
return NULL;
}
vr_t *r=
#ifdef ESP_PLATFORM
heap_caps_calloc(1,sizeof(*r),MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);

#else
calloc(1,sizeof(*r));

#endif
if(!r){if(error&&cap)snprintf(error,cap,"allocation_failed");
return NULL;
}
if(!load(r,p,n)){free(r);
if(error&&cap)snprintf(error,cap,"invalid_or_unsupported_pcat");
return NULL;
}
return r;
}

void vr_destroy(vr_t *r){free(r);
}
size_t vr_resident_bytes(void){return sizeof(vr_t);
}
const uint8_t *vr_owner(const vr_t *r){return r?r->owner:NULL;
}
const uint16_t *vr_color(const vr_t *r){return r?r->color:NULL;
}
const uint16_t *vr_depth(const vr_t *r){return r?r->depth:NULL;
}

static double keytime(const uint8_t *p){return (p[0]|(unsigned)p[1]<<8)/1000.0;
}

static double keyvec(const uint8_t *p,unsigned j,double scale){return (int16_t)(p[4+j*2]|(unsigned)p[5+j*2]<<8)/scale;
}

static void sample(const track_t *tr,double t,double scale,double *v){const uint8_t *a=tr->keys,*b=a+(tr->count-1)*10;
if(t<=keytime(a))b=a;
else if(t>=keytime(b))a=b;
else{unsigned i=1;
while(i<tr->count&&t>keytime(tr->keys+i*10))i++;
a=tr->keys+(i-1)*10;
b=tr->keys+i*10;
}
double k=(a==b||a[2])?0:(t-keytime(a))/(keytime(b)-keytime(a));
for(unsigned j=0;j<3;j++)v[j]=keyvec(a,j,scale)+(keyvec(b,j,scale)-keyvec(a,j,scale))*k;
}

static bool pose(vr_t *r,const char *name,double seconds,double heading,double ly,double lp,double wx,double wz,double wy){const anim_t *an=NULL;
for(unsigned i=0;i<NA;i++)if(!strcmp(r->animations[i].name,name))an=r->animations+i;
if(!an||!isfinite(seconds)||seconds<0)return false;
double pos[NB][3]={{0}
}
,rot[NB][3],scale[NB][3];
for(unsigned i=0;i<NB;i++)for(unsigned j=0;j<3;j++){rot[i][j]=r->bones[i].rot[j];
scale[i][j]=1;
}
double t=an->loop?fmod(seconds,an->duration):fmin(seconds,an->duration);
for(unsigned i=0;i<an->count;i++){const track_t *tr=an->tracks+i;
double v[3],sc=tr->channel==0?r->animation_position_scale:tr->channel==1?r->rotation_scale:r->scale_scale;
sample(tr,t,sc,v);
for(unsigned j=0;j<3;j++){if(tr->channel==0)pos[tr->bone][j]=v[j];
else if(tr->channel==1)rot[tr->bone][j]+=v[j];
else scale[tr->bone][j]=v[j];
}
}
pos[0][0]+=wx;
pos[0][2]+=wz;
pos[0][1]+=wy;
rot[0][1]+=heading;
for(unsigned i=0;i<NB;i++)if(!strcmp(r->bones[i].name,"head")){rot[i][0]+=lp;
rot[i][1]+=ly;
}
for(unsigned i=0;i<NB;i++){double tr[3];
bone_t *b=r->bones+i;
for(unsigned j=0;j<3;j++)tr[j]=b->pivot[j]-(b->parent>=0?r->bones[b->parent].pivot[j]:0)+pos[i][j];
float local[12];
trs(local,tr,rot[i],scale[i]);
if(b->parent>=0)mul(r->bonew[b->parent],local,r->bonew[i]);
else memcpy(r->bonew[i],local,48);
}
return true;
}

static const int fc[6][4]={{7,6,5,4}
,{2,3,0,1}
,{2,6,3,7}
,{1,5,0,4}
,{3,7,1,5}
,{6,2,4,0}
}
;

static const int normals[6][3]={{1,0,0}
,{-1,0,0}
,{0,1,0}
,{0,-1,0}
,{0,0,1}
,{0,0,-1}
}
;

static const int uvrot[4][4]={{0,1,2,3}
,{2,0,3,1}
,{3,2,1,0}
,{1,3,0,2}
}
;

static int jsround(double n){return (int)floor(n+.5);
}

static bool geometry(vr_t *r,vr_stats_t *st,double *inv_min,double *inv_max){double minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;
*inv_min=1e9;
*inv_max=-1e9;
double F=(VR_SCREEN/2.0)/tan(13.5*D2R),light[3]={-.35,.8,-.6}
,ln=sqrt(.35*.35+.8*.8+.6*.6);
for(unsigned j=0;j<3;j++)light[j]/=ln;

 for(unsigned pi=0;pi<NC;pi++){cube_t *c=r->cubes+pi;
float m[12],mv[12],sv[32];
mul(r->bonew[c->bone],c->local,m);
mul(r->view,m,mv);
for(unsigned k=0;k<8;k++){double x=c->corner[k*3],y=c->corner[k*3+1],z=c->corner[k*3+2],X=mv[0]*x+mv[1]*y+mv[2]*z+mv[3],Y=mv[4]*x+mv[5]*y+mv[6]*z+mv[7],Z=mv[8]*x+mv[9]*y+mv[10]*z+mv[11],iw=1/Z;
sv[k*4]=(float)(233+F*X*iw);
sv[k*4+1]=(float)(257-F*Y*iw);
sv[k*4+2]=(float)iw;
sv[k*4+3]=(float)Z;
}

  for(unsigned fi=0;fi<6;fi++){face_t *f=c->faces+fi;
if(!(f->fl&128))continue;
double n[3];
for(unsigned j=0;j<3;j++)n[j]=(double)m[j*4]*normals[fi][0]+(double)m[j*4+1]*normals[fi][1]+(double)m[j*4+2]*normals[fi][2];
double norm=sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]);
if(!norm)norm=1;
double d=fmax(0,(n[0]*light[0]+n[1]*light[1]+n[2]*light[2])/norm);
int level=jsround((.62+.45*d-.45)/(.65/15));
if(level>15)level=15;
int uv[4][2]={{f->u0,f->v0}
,{f->u1,f->v0}
,{f->u0,f->v1}
,{f->u1,f->v1}
}
;
const int tris[2][3]={{0,2,1}
,{2,3,1}
}
;

   for(unsigned ti=0;ti<2;ti++){int k[3]={fc[fi][tris[ti][0]],fc[fi][tris[ti][1]],fc[fi][tris[ti][2]]}
;
if(sv[k[0]*4+3]<1||sv[k[1]*4+3]<1||sv[k[2]*4+3]<1){st->culled++;
continue;
}
double area=(double)(sv[k[1]*4]-sv[k[0]*4])*(sv[k[2]*4+1]-sv[k[0]*4+1])-(double)(sv[k[2]*4]-sv[k[0]*4])*(sv[k[1]*4+1]-sv[k[0]*4+1]);
if(area>=0){st->culled++;
continue;
}
if(r->ntri==VR_MAX_TRI)return false;
triangle_t *t=r->triangles+r->ntri;
const unsigned ord[3]={0,2,1}
;
for(unsigned q=0;q<3;q++){int source=ord[q],s=k[source]*4,ui=uvrot[f->fl&3][tris[ti][source]];
double iw=sv[s+2];
t->v[q*5]=sv[s];
t->v[q*5+1]=sv[s+1];
t->v[q*5+2]=(float)iw;
t->v[q*5+3]=(float)(uv[ui][0]*iw);
t->v[q*5+4]=(float)(uv[ui][1]*iw);
*inv_min=fmin(*inv_min,iw);
*inv_max=fmax(*inv_max,iw);
}

    double x0=floor(fmin(t->v[0],fmin(t->v[5],t->v[10]))),x1=ceil(fmax(t->v[0],fmax(t->v[5],t->v[10]))),y0=floor(fmin(t->v[1],fmin(t->v[6],t->v[11]))),y1=ceil(fmax(t->v[1],fmax(t->v[6],t->v[11])));
if(!isfinite(x0)||!isfinite(y0)||x0< -4096||x1>4096||y0< -4096||y1>4096)return false;
t->box[0]=(int16_t)fmax(0,x0);
t->box[1]=(int16_t)fmax(0,y0);
t->box[2]=(int16_t)fmin(466,x1);
t->box[3]=(int16_t)fmin(466,y1);
t->info[0]=0;
t->info[1]=level;
t->clamp[0]=fmin(f->u0,f->u1);
t->clamp[1]=fmin(f->v0,f->v1);
t->clamp[2]=fmax(f->u0,f->u1)-1;
t->clamp[3]=fmax(f->v0,f->v1)-1;
minx=fmin(minx,x0);
miny=fmin(miny,y0);
maxx=fmax(maxx,x1);
maxy=fmax(maxy,y1);
r->ntri++;
}

  }

 }

 if(!r->ntri||maxx-minx>252||maxy-miny>252)return false;
st->cat_bounds[0]=((int)fmax(0,floor(minx)-2))&~1;
st->cat_bounds[1]=((int)fmax(0,floor(miny)-2))&~1;
st->cat_bounds[2]=(int)fmin(466,((int)ceil(maxx)+3)&~1);
st->cat_bounds[3]=(int)fmin(466,((int)ceil(maxy)+3)&~1);
r->roi_x=((int)floor((minx+maxx-256)/2))&~1;
r->roi_y=((int)floor((miny+maxy-256)/2))&~1;
if(r->roi_x<0)r->roi_x=0;
if(r->roi_y<0)r->roi_y=0;
if(r->roi_x+256>466)r->roi_x=210;
if(r->roi_y+256>466)r->roi_y=210;

 /* Expanded, screen-clipped cat bounds are the public copy contract. Raw
  * extent alone is insufficient after margins, even rounding and ROI clamp. */
 if(st->cat_bounds[0]>=st->cat_bounds[2]||st->cat_bounds[1]>=st->cat_bounds[3]||st->cat_bounds[2]-st->cat_bounds[0]>256||st->cat_bounds[3]-st->cat_bounds[1]>256)return false;

 if(st->cat_bounds[0]<r->roi_x)r->roi_x=st->cat_bounds[0];
if(st->cat_bounds[1]<r->roi_y)r->roi_y=st->cat_bounds[1];

 if(st->cat_bounds[2]>r->roi_x+256)r->roi_x=st->cat_bounds[2]-256;
if(st->cat_bounds[3]>r->roi_y+256)r->roi_y=st->cat_bounds[3]-256;

 if(r->roi_x<0||r->roi_y<0||r->roi_x>210||r->roi_y>210||st->cat_bounds[0]<r->roi_x||st->cat_bounds[1]<r->roi_y||st->cat_bounds[2]>r->roi_x+256||st->cat_bounds[3]>r->roi_y+256)return false;
st->x=r->roi_x;
st->y=r->roi_y;
st->w=st->h=256;
st->triangles=(int)r->ntri;
return true;
}

static bool raster(vr_t *r,double imin,double imax,vr_stats_t *st,const vr_room_cache_t *cache){
if(cache){
for(unsigned y=0;y<256;y++){
#ifdef ESP_PLATFORM
if((y&7)==0&&!badge_renderer_checkpoint())return false;
#endif
size_t from=(size_t)(r->roi_y+(int)y)*466+r->roi_x;
memcpy(r->color+y*256,cache->color+from*2,512);
memcpy(r->depth+y*256,cache->depth+from*2,512);
memcpy(r->owner+y*256,cache->owner+from,256);
}
}else{
memset(r->color,0,sizeof(r->color));
memset(r->depth,0,sizeof(r->depth));
memset(r->owner,0,sizeof(r->owner));
}
double zs=65000/fmax(1e-6,imax-imin);
for(unsigned ti=0;ti<r->ntri;ti++){
#ifdef ESP_PLATFORM
if(!badge_renderer_checkpoint())return false;

#endif
const triangle_t *t=r->triangles+ti;
int x0=jsround(t->v[0]*16.0),y0=jsround(t->v[1]*16.0),x1=jsround(t->v[5]*16.0),y1=jsround(t->v[6]*16.0),x2=jsround(t->v[10]*16.0),y2=jsround(t->v[11]*16.0);
int64_t area=(int64_t)(x1-x0)*(y2-y0)-(int64_t)(x2-x0)*(y1-y0);
if(area<=0)continue;
int a01=y0-y1,b01=x1-x0,a12=y1-y2,b12=x2-x1,a20=y2-y0,b20=x0-x2;
int bias0=(a12>0||(a12==0&&b12<0))?0:-1,bias1=(a20>0||(a20==0&&b20<0))?0:-1,bias2=(a01>0||(a01==0&&b01<0))?0:-1;
int bx0=fmax(t->box[0],r->roi_x),by0=fmax(t->box[1],r->roi_y),bx1=fmin(t->box[2],r->roi_x+256),by1=fmin(t->box[3],r->roi_y+256);
double inv=1.0/area;
int64_t px=bx0*16+8,py=by0*16+8,w0r=a12*(px-x1)+b12*(py-y1),w1r=a20*(px-x2)+b20*(py-y2),w2r=a01*(px-x0)+b01*(py-y0);
for(int y=by0;y<by1;y++){
#ifdef ESP_PLATFORM
if((y&7)==0&&!badge_renderer_checkpoint())return false;

#endif
int64_t w0=w0r,w1=w1r,w2=w2r;
for(int x=bx0;x<bx1;x++){st->tested++;
if(w0+bias0>=0&&w1+bias1>=0&&w2+bias2>=0){st->inside++;
double b0=w0*inv,b1=w1*inv,b2=w2*inv,iw=b0*t->v[2]+b1*t->v[7]+b2*t->v[12];
unsigned z=(unsigned)((int)((iw-imin)*zs)+1);
size_t at=(size_t)(y-r->roi_y)*256+x-r->roi_x;
if(z>=r->depth[at]){unsigned col=0,owner=1;
bool opaque=true;
if(t->info[0]){col=(unsigned)t->info[2];
owner=(unsigned)t->info[3];
}
else{double rec=1/iw;
int tx=(int)((b0*t->v[3]+b1*t->v[8]+b2*t->v[13])*rec),ty=(int)((b0*t->v[4]+b1*t->v[9]+b2*t->v[14])*rec);
if(tx<t->clamp[0])tx=t->clamp[0];
if(tx>t->clamp[2])tx=t->clamp[2];
if(ty<t->clamp[1])ty=t->clamp[1];
if(ty>t->clamp[3])ty=t->clamp[3];
unsigned by=r->texture[(ty*r->tw+tx)>>1],ix=(tx&1)?by&15:by>>4;
opaque=ix!=0;
if(opaque)col=r->lut[t->info[1]*16+ix];
}
if(opaque){r->color[at]=(uint16_t)col;
r->depth[at]=(uint16_t)z;
r->owner[at]=(uint8_t)owner;
st->written++;
}
}
else if(!t->info[0]&&r->owner[at]<8){st->scene_rejected[r->owner[at]]++;
}
}
w0+=a12*16;
w1+=a20*16;
w2+=a01*16;
}
w0r+=b12*16;
w1r+=b20*16;
w2r+=b01*16;
}
}
return true;
}

bool vr_frame(vr_t *r,const char *name,double seconds,double heading,double ly,double lp,vr_stats_t *st){if(!r||!name||!st||!isfinite(heading)||!isfinite(ly)||!isfinite(lp))return false;
memset(st,0,sizeof(*st));
VR_PHASE(2);
double a=now_us();
if(!pose(r,name,seconds,heading,ly,lp,0,0,0))return false;
double b=now_us(),imin,imax;
st->pose_us=b-a;
VR_PHASE(3);
r->ntri=0;
if(!geometry(r,st,&imin,&imax))return false;
double c=now_us();
st->geometry_us=c-b;
VR_PHASE(4);
bool completed=raster(r,imin,imax,st,NULL);
double d=now_us();
st->raster_us=d-c;
if(!completed)return false;
VR_PHASE(5);
st->pose_us=b-a;
st->geometry_us=c-b;
st->raster_us=d-c;
st->resident_bytes=sizeof(*r);
return true;
}


/* Minimal original technical room: flat/baked colors, no PBR or ray tracing.
 * Object owners:1 cat,2 floor/rug,3 wall,4 window,5 bowl,6 mat,7 post. */
static uint16_t rgb565(unsigned c){return (uint16_t)(((c>>19&31)<<11)|((c>>10&63)<<5)|(c>>3&31));
}

static bool world_tri(vr_t *r,const double p[3][3],uint16_t color,unsigned owner){
 float v[3][3];
double F=233/tan(13.5*D2R);
for(unsigned i=0;i<3;i++){double x=p[i][0],y=p[i][1],z=p[i][2],X=r->view[0]*x+r->view[1]*y+r->view[2]*z+r->view[3],Y=r->view[4]*x+r->view[5]*y+r->view[6]*z+r->view[7],Z=r->view[8]*x+r->view[9]*y+r->view[10]*z+r->view[11];
if(Z<35||Z>180)return false;
v[i][0]=(float)(233+F*X/Z);
v[i][1]=(float)(257-F*Y/Z);
v[i][2]=(float)(1/Z);
}

 double a=((double)v[1][0]-v[0][0])*(v[2][1]-v[0][1])-((double)v[2][0]-v[0][0])*(v[1][1]-v[0][1]);
if(fabs(a)<1e-8)return true;
unsigned order[3]={0,1,2}
;
if(a<0){order[1]=2;
order[2]=1;
}

 int x0=(int)floor(fmin(v[0][0],fmin(v[1][0],v[2][0]))),x1=(int)ceil(fmax(v[0][0],fmax(v[1][0],v[2][0]))),y0=(int)floor(fmin(v[0][1],fmin(v[1][1],v[2][1]))),y1=(int)ceil(fmax(v[0][1],fmax(v[1][1],v[2][1])));
if(x1<=0||y1<=0||x0>=466||y0>=466)return true;
if(r->ntri==VR_MAX_TRI)return false;
triangle_t *t=r->triangles+r->ntri++;
memset(t,0,sizeof(*t));
for(unsigned i=0;i<3;i++){t->v[i*5]=v[order[i]][0];
t->v[i*5+1]=v[order[i]][1];
t->v[i*5+2]=v[order[i]][2];
}
t->box[0]=(int16_t)fmax(0,x0);
t->box[1]=(int16_t)fmax(0,y0);
t->box[2]=(int16_t)fmin(466,x1);
t->box[3]=(int16_t)fmin(466,y1);
t->info[0]=1;
t->info[2]=color;
t->info[3]=(int)owner;
return true;

}

static bool quad(vr_t *r,const double a[3],const double b[3],const double c[3],const double d[3],unsigned color,unsigned owner){double p[3][3];
memcpy(p[0],a,24);
memcpy(p[1],b,24);
memcpy(p[2],c,24);
if(!world_tri(r,p,rgb565(color),owner))return false;
memcpy(p[0],c,24);
memcpy(p[1],b,24);
memcpy(p[2],d,24);
return world_tri(r,p,rgb565(color),owner);
}

static bool plane_y(vr_t *r,double x0,double x1,double z0,double z1,double y,unsigned color,unsigned owner){double a[3]={x0,y,z0}
,b[3]={x1,y,z0}
,c[3]={x0,y,z1}
,d[3]={x1,y,z1}
;
return quad(r,a,b,c,d,color,owner);
}

static bool plane_z(vr_t *r,double x0,double x1,double y0,double y1,double z,unsigned color,unsigned owner){double a[3]={x0,y0,z}
,b[3]={x1,y0,z}
,c[3]={x0,y1,z}
,d[3]={x1,y1,z}
;
return quad(r,a,b,c,d,color,owner);
}

static bool cube(vr_t *r,double x0,double x1,double y0,double y1,double z0,double z1,unsigned color,unsigned owner){double corners[8][3];
for(unsigned i=0;i<8;i++){corners[i][0]=(i&4)?x1:x0;
corners[i][1]=(i&2)?y1:y0;
corners[i][2]=(i&1)?z1:z0;
}
const double light[6]={.88,.75,1.08,.64,.97,.81}
;
for(unsigned f=0;f<6;f++){uint16_t c=shade(rgb565(color),light[f]);
unsigned expanded=((c>>11&31)*255/31<<16)|((c>>5&63)*255/63<<8)|(c&31)*255/31;
if(!quad(r,corners[fc[f][0]],corners[fc[f][1]],corners[fc[f][2]],corners[fc[f][3]],expanded,owner))return false;
}
return true;
}

static bool room(vr_t *r,bool props){unsigned initial=r->ntri;

 if(!plane_y(r,-22,22,-24,18,0,0x936344,2)||!plane_z(r,-22,22,0,28,18,0xc6a579,3))return false;

 double a[3]={-22,0,-24}
,b[3]={-22,0,18}
,c[3]={-22,28,-24}
,d[3]={-22,28,18}
;
if(!quad(r,a,b,c,d,0xad8b68,3))return false;

 if(!plane_y(r,-18,1,-17,7,.01,0xb67e4c,2)||!plane_y(r,-9,7,-8,6,.02,0xa77856,2))return false;

 if(!plane_z(r,-17,-4,10,24,17.95,0xaec6a0,4)||!plane_z(r,-17,-16.2,9.5,24.5,17.9,0x73503a,4)||!plane_z(r,-4.8,-4,9.5,24.5,17.9,0x73503a,4)||!plane_z(r,-17,-4,10,10.7,17.9,0x73503a,4)||!plane_z(r,-17,-4,23.3,24,17.9,0x73503a,4))return false;

 if(props){
  if(!cube(r,8,8.7,0,1.8,-9,-3,0xd0c9b4,5)||!cube(r,13.3,14,0,1.8,-9,-3,0xd0c9b4,5)||!cube(r,8.7,13.3,0,1.8,-9,-8.3,0xd0c9b4,5)||!cube(r,8.7,13.3,0,1.8,-3.7,-3,0xd0c9b4,5)||!plane_y(r,8.7,13.3,-8.3,-3.7,.15,0x786247,5)||!plane_y(r,9,13,-8,-4,.3,0x9a5f32,5))return false;

  if(!cube(r,-13,-4,0,1.1,4,12,0xb06b42,6)||!plane_y(r,-12.5,-4.5,4.5,11.5,1.12,0xc78e5b,6))return false;

  if(!cube(r,7,14,0,1,6,13,0x775638,7)||!cube(r,9.5,11.5,1,15,8.5,10.5,0xc5a873,7)||!cube(r,8,13,15,16,7,12,0x98724b,7))return false;

 }

 return r->ntri-initial<=160;

}

static bool world_render(vr_t *r,const char *name,double seconds,double heading,double ly,double lp,double wx,double wz,double wy,bool props,int tx,int ty,bool tile,vr_stats_t *st,const vr_room_cache_t *cache){
 if(!r||!st||!isfinite(seconds)||!isfinite(heading)||!isfinite(ly)||!isfinite(lp)||!isfinite(wx)||!isfinite(wz)||!isfinite(wy)||fabs(wx)>16||fabs(wz)>16||wy<0||wy>2)return false;
memset(st,0,sizeof(*st));
VR_PHASE(2);
double a=now_us();
if(name&&!pose(r,name,seconds,heading,ly,lp,wx,wz,wy))return false;
double b=now_us(),imin,imax;
st->pose_us=b-a;
VR_PHASE(3);
r->ntri=0;
if(!cache&&!room(r,props))return false;
if(name){if(!geometry(r,st,&imin,&imax))return false;
}
else{r->roi_x=tx;
r->roi_y=ty;
}

 if(tile){if(tx<0||ty<0||tx>210||ty>210)return false;
r->roi_x=tx;
r->roi_y=ty;
}
st->x=r->roi_x;
st->y=r->roi_y;
st->w=st->h=256;
unsigned cats=r->ntri;

 /* Geometry may be drawn in either order; shared fixed camera near/far Z is authoritative. */
 double c=now_us();
st->geometry_us=c-b;
VR_PHASE(4);
bool completed=raster(r,1.0/180,1.0/35,st,cache);
double d=now_us();
st->raster_us=d-c;
if(!completed)return false;
VR_PHASE(5);
st->pose_us=b-a;
st->geometry_us=c-b;
st->raster_us=d-c;
st->triangles=(int)r->ntri;
st->fixed_depth=true;
st->resident_bytes=sizeof(*r);
for(unsigned i=0;i<256*256;i++)st->cat_visible+=r->owner[i]==1;
(void)cats;
return true;

}

bool vr_world_frame(vr_t *r,const char *name,double seconds,double heading,double ly,double lp,double wx,double wz,double wy,bool props,vr_stats_t *st){return world_render(r,name,seconds,heading,ly,lp,wx,wz,wy,props,0,0,false,st,NULL);
}

bool vr_world_tile(vr_t *r,const char *name,double seconds,double heading,double wx,double wz,double wy,bool props,int tx,int ty,vr_stats_t *st){return world_render(r,name,seconds,heading,0,0,wx,wz,wy,props,tx,ty,true,st,NULL);
}

bool vr_room_tile(vr_t *r,bool props,int tx,int ty,vr_stats_t *st){return world_render(r,NULL,0,0,0,0,0,0,0,props,tx,ty,true,st,NULL);
}


/* Static room cache is caller-owned immutable Flash. All three planes must
 * pass one joint header+fingerprint+CRC validation before any frame uses it. */
static uint32_t cache_u32(const uint8_t *p){return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
bool vr_room_cache_open(vr_room_cache_t *out,const uint8_t *blob,size_t bytes){
if(!out)return false;
memset(out,0,sizeof(*out));
static const uint8_t fp[32]=ROOM_CACHE_FINGERPRINT;
if(!blob||bytes!=1085860u||memcmp(blob,"CFRMC01\0",8)||cache_u32(blob+8)!=1||cache_u32(blob+12)!=80||cache_u32(blob+16)!=466||cache_u32(blob+20)!=466||cache_u32(blob+24)!=35||cache_u32(blob+28)!=180||cache_u32(blob+32)!=434312||cache_u32(blob+36)!=434312||cache_u32(blob+40)!=217156||memcmp(blob+48,fp,32))return false;
uint32_t crc;
#ifdef ESP_PLATFORM
crc=0;
for(size_t i=80;i<bytes;i+=4096){
if(!badge_renderer_checkpoint())return false;
size_t count=bytes-i<4096?bytes-i:4096;
crc=esp_rom_crc32_le(crc,blob+i,(uint32_t)count);
}
#else
crc=0xffffffffu;
for(size_t i=80;i<bytes;i++){
#ifdef ESP_PLATFORM
if((i&4095u)==0&&!badge_renderer_checkpoint())return false;
#endif
crc^=blob[i];for(unsigned k=0;k<8;k++)crc=(crc>>1)^(0xedb88320u&(0u-(crc&1u)));
}
crc^=0xffffffffu;
#endif
if(crc!=cache_u32(blob+44))return false;
out->color=blob+80;out->depth=blob+80+434312;out->owner=blob+80+868624;out->valid=0x43414348u;
return true;
}
bool vr_world_cached_frame(vr_t *r,const vr_room_cache_t *cache,const char *name,double seconds,double heading,double ly,double lp,double wx,double wz,double wy,vr_stats_t *st){
if(!cache||cache->valid!=0x43414348u||!cache->color||!cache->depth||!cache->owner)return false;
return world_render(r,name,seconds,heading,ly,lp,wx,wz,wy,true,0,0,false,st,cache);
}
bool vr_world_cached_tile(vr_t *r,const vr_room_cache_t *cache,const char *name,double seconds,double heading,double wx,double wz,double wy,int tx,int ty,vr_stats_t *st){
if(!cache||cache->valid!=0x43414348u||!cache->color||!cache->depth||!cache->owner)return false;
return world_render(r,name,seconds,heading,0,0,wx,wz,wy,true,tx,ty,true,st,cache);
}
