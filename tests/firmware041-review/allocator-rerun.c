#include <stdlib.h>
#include <stdio.h>
#include <stdbool.h>
static bool fail_alloc;static unsigned allocations;
static void *fixture_calloc(size_t n,size_t z){allocations++;return fail_alloc?NULL:calloc(n,z);}
#define calloc fixture_calloc
#include "/Users/zoumutou/coding/猫咪森活/artifacts/firmware-visual-prototype041/source/renderer.c"
#undef calloc
int main(int argc,char **argv){if(argc!=2)return 1;FILE *f=fopen(argv[1],"rb");if(!f)return 2;fseek(f,0,SEEK_END);size_t n=(size_t)ftell(f);rewind(f);uint8_t *p=malloc(n);if(!p||fread(p,1,n,f)!=n)return 3;fclose(f);char err[64];fail_alloc=true;if(vr_create(p,n,err,sizeof(err))||strcmp(err,"allocation_failed"))return 4;fail_alloc=false;vr_t *r=vr_create(p,n,err,sizeof(err));if(!r)return 5;unsigned start=allocations;vr_stats_t s;for(unsigned i=0;i<216;i++)if(!vr_frame(r,"walk",i*.1,(i%4)*45,0,0,&s))return 6;if(allocations!=start)return 7;vr_destroy(r);free(p);printf("{\"createAllocationFailureClosed\":true,\"frameCount\":216,\"frameAllocations\":0,\"actualAllocatorPlacement\":\"host calloc only; target PSRAM allocator not integrated\"}\n");return 0;}
