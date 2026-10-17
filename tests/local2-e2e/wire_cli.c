/* virtual_fixture only: production wire/core, host file storage, no radio. */
#include "local2_core.h"
#include "local2_store.h"
#include "local2_wire.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <errno.h>
static l2_core_t core;
static const char *path;
static unsigned commits;
static uint64_t epoch;
static int utc_offset;
static bool locked;
static bool persist(void *ctx,const uint8_t *bytes,size_t length){
    (void)ctx;char tmp[4096];if(snprintf(tmp,sizeof(tmp),"%s.tmp",path)>=(int)sizeof(tmp))return false;
    FILE *f=fopen(tmp,"wb");if(!f)return false;
    bool ok=fwrite(bytes,1,length,f)==length&&fflush(f)==0&&fsync(fileno(f))==0;
    if(fclose(f)!=0)ok=false;
    if(!ok){unlink(tmp);return false;}
    if(rename(tmp,path)!=0){unlink(tmp);return false;}
    char directory[4096];snprintf(directory,sizeof(directory),"%s",path);char *slash=strrchr(directory,'/');
    if(slash){*slash=0;int d=open(directory,O_RDONLY);if(d<0)return false;int s=fsync(d);close(d);if(s!=0)return false;}
    commits++;return true;
}
l2_core_t *l2_runtime_core(uint32_t timeout_ms){(void)timeout_ms;if(locked)abort();locked=true;return &core;}
void l2_runtime_release(void){if(!locked)abort();locked=false;}
void local2_clock_calibrate(uint64_t e,int o){epoch=e;utc_offset=o;}
int local2_clock_utc_offset_minutes(void){return utc_offset;}
bool local2_clock_now(uint64_t *out){if(!epoch)return false;*out=epoch;return true;}
static void fixture(const char *line){
    unsigned action;unsigned long long counter;char peer[33];int result=L2_INVALID;
    if(!strcmp(line,"!inspect")){
        struct stat st;memset(&st,0,sizeof(st));stat(path,&st);
        printf("{\"virtual_fixture\":true,\"pending\":%u,\"seq\":%llu,\"revision\":%llu,\"commitsThisProcess\":%u,\"blobBytes\":%lld,\"epoch\":%llu,\"utcOffsetMinutes\":%d}\n",core.saved.event_count,(unsigned long long)core.saved.last_request.seq,(unsigned long long)core.saved.snapshot.revision,commits,(long long)st.st_size,(unsigned long long)epoch,utc_offset);return;
    }
    if(sscanf(line,"!care %u",&action)==1)result=l2_emit_care(&core,(l2_action_t)action,UINT64_C(1800000000000));
    else if(sscanf(line,"!gift %32s %llu",peer,&counter)==2){
        l2_receipt_t r={0};snprintf(r.peer_id,sizeof(r.peer_id),"%s",peer);r.counter=(uint64_t)counter;r.epoch_ms=UINT64_C(1800000000000);r.gift_kind=L2_GIFT_FLOWER;r.quantity=1;
        result=l2_receive_gift(&core,&r);
    }
    printf("{\"virtual_fixture\":true,\"synthetic_source\":true,\"status\":%d}\n",result);
}
int main(int argc,char **argv){
    if(argc!=2)return 2;path=argv[1];FILE *f=fopen(path,"rb");l2_status_t status;
    if(f){static uint8_t bytes[L2_STORE_MAX+1];size_t n=fread(bytes,1,sizeof(bytes),f);bool ok=!ferror(f);fclose(f);status=ok?l2_load(&core,bytes,n,persist,NULL):L2_CORRUPT;}
    else if(errno==ENOENT)status=l2_init_new(&core,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",persist,NULL);
    else return 3;
    if(status!=L2_OK){fprintf(stderr,"virtual_fixture load failed %d\n",status);return 4;}
    char *line=NULL;size_t capacity=0;ssize_t length;
    while((length=getline(&line,&capacity,stdin))>=0){
        if(length&&line[length-1]=='\n')line[--length]=0;
        if(line[0]=='!')fixture(line);
        else{char output[4096];if(!local2_wire_handle(line,(size_t)length,output,sizeof(output))){fprintf(stderr,"wire no response\n");free(line);return 5;}fputs(output,stdout);if(!strchr(output,'\n'))putchar('\n');}
        fflush(stdout);
    }
    free(line);return 0;
}
