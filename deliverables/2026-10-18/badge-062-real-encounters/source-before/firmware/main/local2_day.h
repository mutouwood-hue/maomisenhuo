#pragma once
#include "local2_core.h"
#include "cJSON.h"
#define L2_DAY_MAX 96
#define L2_DAY_PART_ROWS 16
#define L2_DAY_HEART_MAX 12
typedef struct {uint16_t start,end;uint8_t kind,source,place;} l2_day_segment_t;
typedef struct {bool valid,old;uint32_t generation;char date[11];int16_t zone;uint16_t cutoff,count;bool demo;l2_day_segment_t segments[L2_DAY_MAX];uint8_t heart_count;uint16_t hearts[L2_DAY_HEART_MAX];} l2_day_view_t;
/* Caller holds the existing core lock; this module never saves or mutates core. */
l2_status_t local2_day_accept(const l2_core_t *,const cJSON *,cJSON *response_data);
/* Own short RAM guard, no core lock. Pet mismatch never exposes another day. */
bool local2_day_get(const char *pet_id,l2_day_view_t *out);
