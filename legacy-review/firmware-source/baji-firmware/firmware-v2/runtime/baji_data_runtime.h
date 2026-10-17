#pragma once
#include "esp_err.h"
#include <stdint.h>
#include <stdbool.h>
typedef struct {
    uint32_t generation, challenge_code, unix_seconds;
    int16_t timezone;
    bool provisioned, authenticated, confirm_pending, has_pet, has_life, clock_valid;
    uint8_t pet[27], life[205], challenge_id[16];uint16_t life_length, pending_events;
    uint32_t dropped, storage_errors;
    bool meet_pending, meet_confirmed, environment_allowed, audio_active, audio_fault, environment_has_model;
    uint8_t meet_id[16], meet_peer[6], environment_label,meet_method,social_status[30];
    uint32_t environment_revision;
    uint16_t environment_confidence,active_pending;
    bool active_fault;
} bj_data_view_t;
esp_err_t bj_data_runtime_start(const uint8_t id[6]);
bool bj_data_runtime_view(bj_data_view_t *);
void bj_data_runtime_confirm(uint32_t generation,const uint8_t challenge_id[16]);
void bj_data_runtime_event(uint8_t type,uint8_t a,int16_t b);
void bj_data_runtime_meet_confirm(uint32_t generation,const uint8_t encounter_id[16]);
void bj_data_runtime_environment_stop(void);
void bj_data_runtime_peer_input(uint32_t generation,int point);
void bj_data_runtime_care_visible(bool visible);
