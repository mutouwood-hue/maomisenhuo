#include "badge_renderer_exact.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
vr_t *ref_vr_create(const uint8_t*,size_t,char*,size_t);
void ref_vr_destroy(vr_t*);
bool ref_vr_world_frame(vr_t*,const char*,double,double,double,double,double,double,double,bool,vr_stats_t*);
bool ref_vr_world_tile(vr_t*,const char*,double,double,double,double,double,bool,int,int,vr_stats_t*);
const uint16_t *ref_vr_color(const vr_t*);const uint16_t *ref_vr_depth(const vr_t*);const uint8_t *ref_vr_owner(const vr_t*);
static unsigned checks,cases,negative;
#define CHECK(x) do{checks++;assert(x);}while(0)
static uint8_t *readall(const char *p,size_t *n){FILE*f=fopen(p,"rb");assert(f);fseek(f,0,SEEK_END);*n=(size_t)ftell(f);rewind(f);uint8_t*b=malloc(*n);assert(b&&fread(b,1,*n,f)==*n);fclose(f);return b;}
static void eq(vr_t*a,vr_t*b,vr_stats_t*x,vr_stats_t*y){CHECK(x->x==y->x&&x->y==y->y&&x->w==y->w&&x->h==y->h);CHECK(!memcmp(x->cat_bounds,y->cat_bounds,16));CHECK(!memcmp(ref_vr_color(a),vr_color(b),131072));CHECK(!memcmp(ref_vr_depth(a),vr_depth(b),131072));CHECK(!memcmp(ref_vr_owner(a),vr_owner(b),65536));cases++;}
int main(int argc,char**argv){assert(argc==3);size_t pn,bn;uint8_t*p=readall(argv[1],&pn),*blob=readall(argv[2],&bn);char err[80];vr_t*a=ref_vr_create(p,pn,err,sizeof(err)),*b=vr_create(p,pn,err,sizeof(err));CHECK(a&&b);vr_room_cache_t cache;CHECK(vr_room_cache_open(&cache,blob,bn));CHECK(cache.valid&&cache.color==blob+80&&cache.depth==blob+434392&&cache.owner==blob+868704);
const char *an[]={"idle","walk","paw"};const int tiles[][2]={{0,0},{210,0},{0,210},{210,210},{73,101},{209,1}};
for(unsigned i=0;i<18;i++){vr_stats_t x,y;double t=(i%6)*.13,h=(i*45)%360,wx=(int)(i%3)*7-7,wz=(int)(i%5)*6-12,wy=(i%3)*.5;bool ok=ref_vr_world_frame(a,an[i%3],t,h,0,0,wx,wz,wy,true,&x);CHECK(vr_world_cached_frame(b,&cache,an[i%3],t,h,0,0,wx,wz,wy,&y)==ok);if(ok)eq(a,b,&x,&y);}
for(unsigned i=0;i<6;i++){vr_stats_t x,y;CHECK(ref_vr_world_tile(a,"walk",.37,180,9,-6,0,true,tiles[i][0],tiles[i][1],&x));CHECK(vr_world_cached_tile(b,&cache,"walk",.37,180,9,-6,0,tiles[i][0],tiles[i][1],&y));eq(a,b,&x,&y);}
/* Four static-only corner tiles cover every466x466 cached pixel against frozen uncached042. */
for(unsigned i=0;i<4;i++){vr_stats_t u,v;CHECK(ref_vr_world_tile(a,NULL,0,0,0,0,0,true,tiles[i][0],tiles[i][1],&u));CHECK(vr_world_cached_tile(b,&cache,NULL,0,0,0,0,0,tiles[i][0],tiles[i][1],&v));eq(a,b,&u,&v);}
vr_stats_t x,y;CHECK(!vr_world_cached_tile(b,&cache,"idle",0,0,0,0,0,-1,0,&y));CHECK(!vr_world_cached_tile(b,&cache,"idle",0,0,0,0,0,211,0,&y));CHECK(!vr_world_cached_frame(b,&cache,"idle",NAN,0,0,0,0,0,0,&y));CHECK(!vr_world_cached_frame(b,&cache,"idle",0,0,0,0,17,0,0,&y));
const size_t at[]={0,8,12,16,24,32,40,44,48,80,434392,868704,bn-1};for(unsigned i=0;i<sizeof(at)/sizeof(*at);i++){uint8_t v=blob[at[i]];blob[at[i]]^=1;vr_room_cache_t bad=cache;CHECK(!vr_room_cache_open(&bad,blob,bn));CHECK(!bad.valid&&!bad.color&&!bad.depth&&!bad.owner);blob[at[i]]=v;negative++;}
CHECK(!vr_room_cache_open(&cache,blob,bn-1));CHECK(!cache.valid);CHECK(!vr_room_cache_open(&cache,NULL,bn));CHECK(!vr_room_cache_open(NULL,blob,bn));CHECK(vr_room_cache_open(&cache,blob,bn));
/* Deliberate invalid caller descriptor: wrong source row must break independent exact oracle. */
CHECK(ref_vr_world_frame(a,"idle",0,0,0,0,0,0,0,true,&x));vr_room_cache_t wrong=cache;wrong.color+=932;CHECK(vr_world_cached_frame(b,&wrong,"idle",0,0,0,0,0,0,0,&y));size_t differences=0;for(size_t i=0;i<65536;i++)differences+=ref_vr_color(a)[i]!=vr_color(b)[i];CHECK(differences>0);negative++;
CHECK(vr_world_cached_frame(b,&cache,"idle",0,0,0,0,0,0,0,&y));eq(a,b,&x,&y);printf("{\"checks\":%u,\"threePlaneCases\":%u,\"negativeCases\":%u,\"wrongRowNegativePixels\":%zu,\"allPass\":true}\n",checks,cases,negative,differences);ref_vr_destroy(a);vr_destroy(b);free(blob);free(p);return 0;}
