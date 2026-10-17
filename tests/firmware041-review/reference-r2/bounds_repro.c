#include "/Users/zoumutou/coding/猫咪森活/artifacts/firmware-visual-prototype041/reference-r2/source/renderer.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
int main(int argc,char**argv){assert(argc==2);FILE*f=fopen(argv[1],"rb");assert(f);fseek(f,0,SEEK_END);size_t n=ftell(f);rewind(f);uint8_t*p=malloc(n);assert(fread(p,1,n,f)==n);fclose(f);char e[80];vr_t*r=vr_create(p,n,e,sizeof(e));assert(r);vr_stats_t st;assert(vr_world_frame(r,"walk",.37,180,0,0,16,-16,2,true,&st));vr_stats_t original=st;unsigned invalid=0;for(int y=st.cat_bounds[1];y<st.cat_bounds[3];y++)for(int x=st.cat_bounds[0];x<st.cat_bounds[2];x++){long at=(y-st.y)*256+x-st.x;if(at<0||at>=256*256)invalid++;}
uint8_t*owner=calloc(466*466,1);assert(owner);for(int y=0;y<=210;y+=210)for(int x=0;x<=210;x+=210){assert(vr_world_tile(r,"walk",.37,180,16,-16,2,true,x,y,&st));const uint8_t*src=vr_owner(r);for(int j=0;j<256;j++)memcpy(owner+(y+j)*466+x,src+j*256,256);}
unsigned visible=0,outside=0;for(int y=0;y<466;y++)for(int x=0;x<466;x++)if(owner[y*466+x]==1){visible++;if(x<original.x||x>=original.x+256||y<original.y||y>=original.y+256)outside++;}
printf("{\"source\":\"reference_r2_actual_public_API\",\"input\":{\"animation\":\"walk\",\"seconds\":0.37,\"heading\":180,\"worldX\":16,\"worldZ\":-16,\"supportY\":2,\"props\":true},\"returnedSuccess\":true,\"roi\":[%d,%d,256,256],\"catBounds\":[%d,%d,%d,%d],\"bboxSamplesOutsideRoiAllocation\":%u,\"fullTileVisibleCatPixels\":%u,\"fullTileCatPixelsOutsideReturnedROI\":%u,\"virtualFixture\":true}\n",original.x,original.y,original.cat_bounds[0],original.cat_bounds[1],original.cat_bounds[2],original.cat_bounds[3],invalid,visible,outside);assert(invalid==0);free(owner);vr_destroy(r);free(p);return 0;}
