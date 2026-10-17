/* Host harness executes production badge_state.c. ESP clock/mutex/MAC and NVS
 * are controlled substitutes. cJSON must be the actual library, never a shim.
 * No production files or real device storage are written by this test. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include "badge_state.c"

static const char *storage_path;
static void *staged;
static size_t staged_length;
static int fail_commit_once;
static int64_t timer_us = 1000000;

esp_err_t esp_read_mac(uint8_t *mac, int type)
{ (void)type; const uint8_t value[] = {1,2,3,4,5,6}; memcpy(mac,value,6); return ESP_OK; }
int64_t esp_timer_get_time(void) { return timer_us; }
esp_err_t nvs_open(const char *name, int mode, nvs_handle_t *handle)
{ (void)name; (void)mode; *handle=1; return ESP_OK; }
esp_err_t nvs_get_blob(nvs_handle_t handle, const char *key, void *output, size_t *length)
{
    (void)handle; (void)key; FILE *file=fopen(storage_path,"rb");
    if (!file) return ESP_ERR_NVS_NOT_FOUND;
    fseek(file,0,SEEK_END); long size=ftell(file); rewind(file);
    if (size<0 || (size_t)size>*length) { fclose(file); return ESP_ERR_INVALID_STATE; }
    *length=(size_t)size;
    int good=fread(output,1,*length,file)==*length;
    fclose(file); return good ? ESP_OK : ESP_ERR_INVALID_STATE;
}
esp_err_t nvs_set_blob(nvs_handle_t handle, const char *key, const void *input, size_t length)
{
    (void)handle; (void)key;
    free(staged); staged=malloc(length);
    if (!staged) return ESP_ERR_NO_MEM;
    memcpy(staged,input,length); staged_length=length; return ESP_OK;
}
esp_err_t nvs_commit(nvs_handle_t handle)
{
    (void)handle;
    if (fail_commit_once) { fail_commit_once=0; return ESP_ERR_INVALID_STATE; }
    char path[4096]; snprintf(path,sizeof(path),"%s.tmp",storage_path);
    FILE *file=fopen(path,"wb"); if (!file) return ESP_ERR_INVALID_STATE;
    int good=fwrite(staged,1,staged_length,file)==staged_length && fflush(file)==0 && fsync(fileno(file))==0;
    if (fclose(file)!=0) good=0;
    if (!good || rename(path,storage_path)!=0) return ESP_ERR_INVALID_STATE;
    return ESP_OK;
}
void badge_ble_status(const char *json) { printf("STATUS %s\n",json); }

static void show(void)
{
    badge_view_t value; badge_get_view(&value);
    printf("VIEW {\"petId\":\"%s\",\"revision\":%llu,\"mood\":%u,\"food\":%u,\"clean\":%u,\"energy\":%u,\"health\":%u,\"coins\":%llu,\"updatedAtMs\":%llu,\"pending\":%u,\"blocked\":%u,\"storageError\":%s}\n",
           value.snapshot.pet_id,(unsigned long long)value.snapshot.revision,value.snapshot.mood,
           value.snapshot.food,value.snapshot.clean,value.snapshot.energy,value.snapshot.health,
           (unsigned long long)value.snapshot.coins,(unsigned long long)value.snapshot.updated_at_ms,value.pending,value.blocked,value.storage_error ? "true" : "false");
}
static void host_boot(void)
{
    memset(&saved,0,sizeof(saved)); memset(&work,0,sizeof(work)); memset(&view,0,sizeof(view));
    lock=NULL; nvs=0;
    printf("BOOT %d\n",badge_state_init());
}
int main(int argc, char **argv)
{
    if (argc!=2) return 2;
    storage_path=argv[1]; host_boot();
    char input[16384];
    while (fgets(input,sizeof(input),stdin)) {
        input[strcspn(input,"\r\n")]='\0';
        if (!strcmp(input,"!view")) show();
        else if (!strcmp(input,"!pet")) printf("PET %d\n",badge_pet());
        else if (!strcmp(input,"!retry_blocked")) printf("RETRY %d\n",badge_retry_blocked());
        else if (!strcmp(input,"!next")) { char event[512]; if (badge_next_event(event,sizeof(event))) printf("EVENT %s\n",event); else puts("EMPTY"); }
        else if (!strcmp(input,"!fail_commit")) fail_commit_once=1;
        else if (!strcmp(input,"!corrupt_count")) {
            work=saved; work.count=BADGE_QUEUE_CAPACITY+1;
            nvs_set_blob(nvs,"state_v1",&work,sizeof(work)); nvs_commit(nvs);
        }
        else if (!strcmp(input,"!restart")) host_boot();
        else if (!strncmp(input,"!time ",6)) timer_us=strtoll(input+6,NULL,10);
        else badge_receive_line(input);
    }
    free(staged); return 0;
}
