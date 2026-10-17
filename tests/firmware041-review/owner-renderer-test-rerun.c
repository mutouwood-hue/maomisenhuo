/* Test TU includes unmodified production algorithm to reach analytic primitives.
 * All inputs host fixtures; no firmware/domain transport. */
#include "/Users/zoumutou/coding/猫咪森活/artifacts/firmware-visual-prototype041/source/renderer.c"
#include <assert.h>
static unsigned checks;
#define CHECK(x) do{checks++;if(!(x)){fprintf(stderr,"failed %s:%d %s\n",__FILE__,__LINE__,#x);exit(1);}}while(0)
static void screen_triangle(vr_t *r,float ax,float ay,float bx,float by,float cx,float cy,double z,uint16_t color){triangle_t *t=r->triangles+r->ntri++;memset(t,0,sizeof(*t));float xy[6]={ax,ay,bx,by,cx,cy};for(unsigned i=0;i<3;i++){t->v[i*5]=xy[i*2];t->v[i*5+1]=xy[i*2+1];t->v[i*5+2]=(float)(1/z);}t->box[0]=150;t->box[1]=150;t->box[2]=210;t->box[3]=210;t->info[0]=1;t->info[2]=color;t->info[3]=color==0x001f?1:7;}
static void square(vr_t *r,double z,uint16_t color){screen_triangle(r,150,150,210,150,150,210,z,color);screen_triangle(r,150,210,210,150,210,210,z,color);}
int main(int argc,char **argv){CHECK(argc==2);FILE *f=fopen(argv[1],"rb");CHECK(f);fseek(f,0,SEEK_END);long n=ftell(f);rewind(f);uint8_t *p=malloc((size_t)n);CHECK(p);CHECK(fread(p,1,(size_t)n,f)==(size_t)n);fclose(f);char err[100];CHECK(!vr_create(NULL,n,err,sizeof(err)));CHECK(!vr_create(p,7,err,sizeof(err)));
 for(size_t size=0;size<(size_t)n;size+=187){vr_t *bad=vr_create(p,size,err,sizeof(err));CHECK(!bad);}uint8_t save=p[0];p[0]='X';CHECK(!vr_create(p,n,err,sizeof(err)));p[0]=save;
 vr_t *r=vr_create(p,n,err,sizeof(err));CHECK(r);vr_stats_t s;CHECK(!vr_frame(r,"missing",0,0,0,0,&s));CHECK(!vr_frame(r,"idle",NAN,0,0,0,&s));CHECK(!vr_world_frame(r,"idle",0,NAN,0,0,0,0,0,true,&s));CHECK(!vr_world_frame(r,"idle",0,0,0,0,99,0,0,true,&s));CHECK(!vr_world_tile(r,"idle",0,0,0,0,0,true,-1,0,&s));
 /* Independent analytical oracle: common camera z80 must cover z120 regardless
  * of submission order, with exact 60x60 quad coverage and no diagonal crack. */
 r->roi_x=r->roi_y=128;r->ntri=0;square(r,120,0xf800);square(r,80,0x001f);memset(&s,0,sizeof(s));raster(r,1.0/180,1.0/35,&s);uint16_t *first=malloc(sizeof(r->color));CHECK(first);memcpy(first,r->color,sizeof(r->color));unsigned blue=0;for(int y=150;y<210;y++)for(int x=150;x<210;x++){CHECK(r->color[(y-128)*256+x-128]==0x001f);blue++;}CHECK(blue==3600);r->ntri=0;square(r,80,0x001f);square(r,120,0xf800);raster(r,1.0/180,1.0/35,&s);CHECK(!memcmp(first,r->color,sizeof(r->color)));
 /* Deliberately wrong per-object normalized Z: assign distant object a near
  * endpoint, reproducing why separate cat normalization cannot share room Z. */
 r->ntri=0;square(r,80,0x001f);square(r,40,0xf800);raster(r,1.0/180,1.0/35,&s);unsigned wrong=0;for(unsigned i=0;i<256*256;i++)wrong+=first[i]!=r->color[i];CHECK(wrong==3600);
 /* Real scene negative: independent per-cat normalization in same prepared
  * production room/cat geometry produces different actual occlusion owners. */
 CHECK(vr_world_frame(r,"walk",.5,180,0,0,9.777777,9,0,true,&s));memcpy(first,r->color,sizeof(r->color));uint8_t *owners=malloc(sizeof(r->owner));CHECK(owners);memcpy(owners,r->owner,sizeof(r->owner));double lo=1,hi=0;for(unsigned i=0;i<r->ntri;i++)if(!r->triangles[i].info[0])for(unsigned k=0;k<3;k++){lo=fmin(lo,r->triangles[i].v[k*5+2]);hi=fmax(hi,r->triangles[i].v[k*5+2]);}
 /* Remap only cat inverse-Z and its perspective numerators. This is an
  * intentionally invalid old object-local depth convention; preserve UV. */
 for(unsigned i=0;i<r->ntri;i++)if(!r->triangles[i].info[0])for(unsigned k=0;k<3;k++){float *v=r->triangles[i].v+k*5;double old=v[2],mapped=1.0/180+(old-lo)/(hi-lo)*(1.0/35-1.0/180);v[2]=(float)mapped;v[3]=(float)(v[3]*mapped/old);v[4]=(float)(v[4]*mapped/old);}raster(r,1.0/180,1.0/35,&s);unsigned ownerdiff=0,rgberror=0;for(unsigned i=0;i<256*256;i++){ownerdiff+=owners[i]!=r->owner[i];rgberror+=first[i]!=r->color[i];}CHECK(ownerdiff>0);CHECK(rgberror>0);
 free(owners);free(first);vr_destroy(r);for(unsigned i=0;i<12;i++){r=vr_create(p,n,err,sizeof(err));CHECK(r);CHECK(vr_frame(r,"idle",i*.1,0,0,0,&s));vr_destroy(r);}free(p);
 printf("{\"checks\":%u,\"analyticalNearFarOrderExact\":true,\"diagonalCrackPixels\":0,\"wrongObjectLocalDepthKnownPlanePixels\":%u,\"actualSceneOldLocalDepthOwnerDiff\":%u,\"actualSceneOldLocalDepthRgbDiff\":%u,\"scope\":\"host synthetic test; not S3 or real care\"}\n",checks,wrong,ownerdiff,rgberror);return 0;}
