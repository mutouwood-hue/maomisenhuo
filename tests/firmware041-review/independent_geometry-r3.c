#include "/Users/zoumutou/coding/猫咪森活/artifacts/firmware-visual-prototype041/source/renderer.c"
#include <assert.h>
#include <float.h>
static unsigned checks;
#define CK(x) do{checks++;if(!(x)){fprintf(stderr,"FAIL line%d: %s\n",__LINE__,#x);exit(1);}}while(0)
static void tri(vr_t*r,float ax,float ay,float bx,float by,float cx,float cy,double za,double zb,double zc,unsigned owner,uint16_t color){
 triangle_t*t=&r->triangles[r->ntri++];memset(t,0,sizeof(*t));float q[]={ax,ay,bx,by,cx,cy};double zz[]={za,zb,zc};for(unsigned i=0;i<3;i++){t->v[i*5]=q[i*2];t->v[i*5+1]=q[i*2+1];t->v[i*5+2]=(float)(1/zz[i]);}t->box[0]=150;t->box[1]=150;t->box[2]=210;t->box[3]=210;t->info[0]=1;t->info[2]=color;t->info[3]=owner;
}
static void square(vr_t*r,double zl,double zr,unsigned owner,uint16_t color){tri(r,150,150,210,150,150,210,zl,zr,zl,owner,color);tri(r,150,210,210,150,210,210,zl,zr,zr,owner,color);}
static void put(uint16_t*dst,const uint16_t*src,int x,int y){for(int j=0;j<256;j++)memcpy(dst+(y+j)*466+x,src+j*256,512);}
static void full(vr_t*r,double x,double z,double sec,unsigned heading,uint16_t*dst,bool roomonly){vr_stats_t st;for(int dy=0;dy<=210;dy+=210)for(int dx=0;dx<=210;dx+=210){bool ok=roomonly?vr_room_tile(r,true,dx,dy,&st):vr_world_tile(r,"walk",sec,heading,x,z,0,true,dx,dy,&st);CK(ok);put(dst,vr_color(r),dx,dy);}}
static unsigned diff(const uint16_t*a,const uint16_t*b){unsigned n=0;for(unsigned i=0;i<466*466;i++)n+=a[i]!=b[i];return n;}
int main(int argc,char**argv){CK(argc==2);FILE*f=fopen(argv[1],"rb");CK(f);fseek(f,0,SEEK_END);size_t n=(size_t)ftell(f);rewind(f);uint8_t*p=malloc(n);CK(p);CK(fread(p,1,n,f)==n);fclose(f);char e[80];vr_t*r=vr_create(p,n,e,sizeof(e));CK(r);vr_stats_t st;
 /* Independent sloped plane analytic oracle: inverse depth linear in x.
  * At pixel centres x150..185 blue is nearer; x186..209 red is nearer. */
 uint16_t*once=malloc(sizeof(r->color));CK(once);unsigned blue=0,red=0;
 for(unsigned order=0;order<2;order++){r->ntri=0;r->roi_x=r->roi_y=128;if(order)square(r,70,140,1,0x001f);square(r,100,100,7,0xf800);if(!order)square(r,70,140,1,0x001f);memset(&st,0,sizeof(st));raster(r,1.0/180,1.0/35,&st);
  for(int y=150;y<210;y++)for(int x=150;x<210;x++){unsigned at=(y-128)*256+x-128;uint16_t expected=x<186?0x001f:0xf800;CK(r->color[at]==expected);CK(r->owner[at]==(x<186?1:7));if(!order){blue+=expected==0x001f;red+=expected==0xf800;}}
  if(order)CK(!memcmp(once,r->color,sizeof(r->color)));else memcpy(once,r->color,sizeof(r->color));}
 CK(blue==2160&&red==1440);
 /* Actual supplied model, API boundary values and invalid-input old-buffer semantics. */
 CK(vr_frame(r,"idle",0,0,0,0,&st));memcpy(once,r->color,sizeof(r->color));CK(!vr_frame(r,"missing",0,0,0,0,&st));CK(!memcmp(once,r->color,sizeof(r->color)));CK(!vr_frame(r,"idle",NAN,0,0,0,&st));CK(!memcmp(once,r->color,sizeof(r->color)));
 const double invalid[]={NAN,INFINITY,-INFINITY};for(unsigned j=0;j<3;j++){CK(!vr_world_frame(r,"idle",0,0,0,0,invalid[j],0,0,true,&st));CK(!vr_world_frame(r,"idle",0,0,0,0,0,invalid[j],0,true,&st));CK(!vr_world_frame(r,"idle",0,0,0,0,0,0,invalid[j],true,&st));}
 CK(!vr_world_frame(r,"idle",0,0,0,0,16.001,0,0,true,&st));CK(!vr_world_frame(r,"idle",0,0,0,0,0,-16.001,0,true,&st));CK(!vr_world_frame(r,"idle",0,0,0,0,0,0,2.001,true,&st));CK(!vr_world_tile(r,"idle",0,0,0,0,0,true,211,0,&st));CK(!vr_room_tile(r,true,0,-1,&st));
 unsigned worldcases=0,worldrejected=0;const double xyz[]={-16,0,16};for(unsigned x=0;x<3;x++)for(unsigned z=0;z<3;z++)for(unsigned h=0;h<4;h++){if(!vr_world_frame(r,"walk",.37,h*90,0,0,xyz[x],xyz[z],2,true,&st)){fprintf(stderr,"ROI_REJECT x%.0f z%.0f h%u support2\n",xyz[x],xyz[z],h*90);worldrejected++;continue;}CK(st.x>=0&&st.y>=0&&st.x<=210&&st.y<=210);if(!(st.cat_bounds[0]>=st.x&&st.cat_bounds[1]>=st.y&&st.cat_bounds[2]<=st.x+256&&st.cat_bounds[3]<=st.y+256)){fprintf(stderr,"BOUNDS_ESCAPE x%.0f z%.0f h%u ROI[%d,%d] bounds[%d,%d,%d,%d]\n",xyz[x],xyz[z],h*90,st.x,st.y,st.cat_bounds[0],st.cat_bounds[1],st.cat_bounds[2],st.cat_bounds[3]);}for(unsigned i=0;i<256*256;i++)CK(r->owner[i]<=7);worldcases++;}
 /* Dirty union independently reconstructed across distant jumps and direction flips. */
 uint16_t *base=calloc(466*466,2),*canvas=calloc(466*466,2),*oracle=calloc(466*466,2),*bad=calloc(466*466,2),*prevframe=calloc(466*466,2);CK(base&&canvas&&oracle&&bad&&prevframe);full(r,0,0,0,0,base,true);memcpy(canvas,base,466*466*2);int previous[4]={0};unsigned negative=0;
 const double paths[][2]={{-2,-3},{7,-6},{-8,6},{9,9},{0,0},{10,9},{-3,1},{2,12}};
 for(unsigned i=0;i<8;i++){double x=paths[i][0],z=paths[i][1],sec=.13*i;unsigned heading=(i%4)*90;CK(vr_world_frame(r,"walk",sec,heading,0,0,x,z,0,true,&st));int b[4];memcpy(b,st.cat_bounds,sizeof(b));int un[4];for(unsigned j=0;j<4;j++)un[j]=i?(j<2?(previous[j]<b[j]?previous[j]:b[j]):(previous[j]>b[j]?previous[j]:b[j])):b[j];for(int yy=un[1];yy<un[3];yy++)memcpy(canvas+yy*466+un[0],base+yy*466+un[0],(un[2]-un[0])*2);for(int yy=b[1];yy<b[3];yy++)memcpy(canvas+yy*466+b[0],r->color+(yy-st.y)*256+b[0]-st.x,(b[2]-b[0])*2);full(r,x,z,sec,heading,oracle,false);CK(diff(canvas,oracle)==0);
  if(i){memcpy(bad,prevframe,466*466*2);for(int yy=b[1];yy<b[3];yy++)memcpy(bad+yy*466+b[0],oracle+yy*466+b[0],(b[2]-b[0])*2);negative+=diff(bad,oracle);}memcpy(previous,b,sizeof(b));memcpy(prevframe,oracle,466*466*2);
 }CK(negative>0);CK(vr_resident_bytes()==sizeof(*r));printf("{\"checks\":%u,\"slopedAnalyticPixelsPerOrder\":3600,\"analyticBlue\":%u,\"analyticRed\":%u,\"actualWorldBoundaryCases\":%u,\"boundedInputsGuardRejected\":%u,\"independentDirtyPathFrames\":8,\"onlyNewBoxNegativePixels\":%u,\"residentHostBytes\":%zu,\"sourcePcatBytesSeparate\":%zu,\"scope\":\"actual C with host ASAN/UBSAN; no S3 runtime\"}\n",checks,blue,red,worldcases,worldrejected,negative,vr_resident_bytes(),n);free(base);free(canvas);free(oracle);free(bad);free(prevframe);free(once);vr_destroy(r);free(p);return 0;}
