void local2_peer_confirm(void) {if(commands){peer_command_t cmd={.confirm=true};(void)xQueueSend(commands,&cmd,0);}}

void local2_peer_poll(uint32_t now) {
    if(!commands)return;
    portENTER_CRITICAL(&peer_guard);now_ms=now;portEXIT_CRITICAL(&peer_guard);
    l2_core_t *core=l2_runtime_core(0);if(!core)return;machine.core=core;
    peer_command_t cmd;uint16_t close_handle=BLE_HS_CONN_HANDLE_NONE;bool stop_scan=false;
    while(xQueueReceive(commands,&cmd,0)==pdTRUE){
        if(cmd.confirm){(void)l2_peer_machine_confirm(&machine);continue;}
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
    portENTER_CRITICAL(&peer_guard);public_view=machine.view;portEXIT_CRITICAL(&peer_guard);
    l2_runtime_release();
    if(stop_scan&&scan_owned){(void)ble_gap_disc_cancel();scan_owned=false;}
    if(close_handle!=BLE_HS_CONN_HANDLE_NONE)(void)ble_gap_terminate(close_handle,BLE_ERR_REM_USER_CONN_TERM);
    transport_poll();
}
