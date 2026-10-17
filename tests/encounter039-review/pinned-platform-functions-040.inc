void local2_peer_confirm(const l2_peer_confirm_token_t *displayed_token) {
    /* Never substitute public_view here: the caller supplies the shown intent. */
    if(commands&&displayed_token&&displayed_token->valid){peer_command_t cmd={.confirm=true,.token=*displayed_token};(void)xQueueSend(commands,&cmd,0);}
}

static void sync_machine_link(void) {
    uint8_t id[16],token[4];bool changed,up;
    portENTER_CRITICAL(&peer_guard);
    changed=link_gen!=handled_link_gen;handled_link_gen=link_gen;
    up=enabled&&conn!=BLE_HS_CONN_HANDLE_NONE;
    memcpy(id,selected_id,16);memcpy(token,selected_token,4);
    portEXIT_CRITICAL(&peer_guard);
    if(changed){if(up)esp_fill_random(machine.nonce+4,12);l2_peer_machine_link(&machine,up,id,token);}
}

static bool confirm_matches(const l2_peer_confirm_token_t *t) {
    if(!t->valid)return false;
    uint8_t selected_peer[16];bool current;
    portENTER_CRITICAL(&peer_guard);
    current=enabled&&conn!=BLE_HS_CONN_HANDLE_NONE&&conn==t->connection_handle&&link_gen==t->link_generation&&handled_link_gen==link_gen;
    memcpy(selected_peer,selected_id,16);
    portEXIT_CRITICAL(&peer_guard);
    char id[33];hex_id(id,selected_peer);l2_encounter_view_t v;
    return current&&machine.view.connected&&machine.hello_seen&&!strcmp(id,t->peer_id)&&!strcmp(machine.view.peer_id,t->peer_id)
        &&l2_encounter_get(machine.core,t->peer_id,&v)&&v.has_full_binding&&!v.complete&&v.remote_counter
        &&v.local_counter==t->local_counter&&v.remote_counter==t->remote_counter&&!memcmp(v.fingerprint,t->fingerprint,16)
        &&machine.core->saved.has_snapshot&&!strcmp(v.local_pet_id,machine.core->saved.snapshot.pet.pet_id);
}

static void publish_view(void) {
    l2_peer_view_t next=machine.view;memset(&next.confirm_token,0,sizeof(next.confirm_token));
    l2_encounter_view_t v;bool bound=next.phase==L2P_CONFIRM&&!next.local_confirmed
        &&l2_encounter_get(machine.core,next.peer_id,&v)&&v.has_full_binding&&v.remote_counter&&!v.complete;
    portENTER_CRITICAL(&peer_guard);
    char id[33];hex_id(id,selected_id);
    if(bound&&enabled&&conn!=BLE_HS_CONN_HANDLE_NONE&&handled_link_gen==link_gen&&next.connected&&machine.hello_seen&&!strcmp(id,next.peer_id)){
        next.confirm_token.valid=true;next.confirm_token.link_generation=link_gen;next.confirm_token.connection_handle=conn;
        strcpy(next.confirm_token.peer_id,next.peer_id);next.confirm_token.local_counter=v.local_counter;next.confirm_token.remote_counter=v.remote_counter;
        memcpy(next.confirm_token.fingerprint,v.fingerprint,16);
    }
    public_view=next;portEXIT_CRITICAL(&peer_guard);
}

void local2_peer_poll(uint32_t now) {
    if(!commands)return;
    portENTER_CRITICAL(&peer_guard);now_ms=now;portEXIT_CRITICAL(&peer_guard);
    l2_core_t *core=l2_runtime_core(0);if(!core)return;machine.core=core;
    sync_machine_link();
    peer_command_t cmd;uint16_t close_handle=BLE_HS_CONN_HANDLE_NONE;bool stop_scan=false;
    while(xQueueReceive(commands,&cmd,0)==pdTRUE){
        if(cmd.confirm){sync_machine_link();if(confirm_matches(&cmd.token))(void)l2_peer_machine_confirm(&machine);continue;}
        (void)l2_peer_machine_enable(&machine,cmd.enable,cmd.nonce);
        portENTER_CRITICAL(&peer_guard);uint16_t old=conn;enabled=cmd.enable;connecting=false;selected=false;conn=BLE_HS_CONN_HANDLE_NONE;transport_reset();
        advert_size=(uint8_t)l2_peer_machine_advertisement(&machine,advert,sizeof(advert));advert_generation++;link_gen++;handled_link_gen=link_gen;portEXIT_CRITICAL(&peer_guard);
        stop_scan=true;if(old!=BLE_HS_CONN_HANDLE_NONE)close_handle=old;
    }
    uint8_t id[16],token[4],message[L2_PEER_MESSAGE_MAX],type=0;size_t size=0;bool link_change,link_up;
    portENTER_CRITICAL(&peer_guard);link_change=link_gen!=handled_link_gen;handled_link_gen=link_gen;link_up=enabled&&conn!=BLE_HS_CONN_HANDLE_NONE;
    memcpy(id,selected_id,16);memcpy(token,selected_token,4);
    if(rx_ready){type=rx_type;size=rx_size;memcpy(message,rx,size);rx_ready=false;rx_size=rx_received=0;}
    portEXIT_CRITICAL(&peer_guard);
    if(link_change){
        /* Keep the advertised 32-bit rendezvous token, but replace the full
         * session challenge tail on EVERY connection so prior confirmations
         * cannot be replayed after a disconnect while discovery stays on. */
        if(link_up)esp_fill_random(machine.nonce+4,12);
        l2_peer_machine_link(&machine,link_up,id,token);
    }
    if(size)(void)l2_peer_machine_receive(&machine,type,message,size);
    machine.epoch_ms=0;local2_clock_now(&machine.epoch_ms);l2_peer_machine_poll(&machine,now);
    publish_view();
    l2_runtime_release();
    if(stop_scan&&scan_owned){(void)ble_gap_disc_cancel();scan_owned=false;}
    if(close_handle!=BLE_HS_CONN_HANDLE_NONE)(void)ble_gap_terminate(close_handle,BLE_ERR_REM_USER_CONN_TERM);
    transport_poll();
}
