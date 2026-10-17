/* Host-only extension of existing driver; current 037 peer/core compiled separately. */
#define main legacy_peer_suite_main
#include "../local2-peer/test_peer.c"
#undef main
int main(void) {
    fresh();link_pair();pump(500,true,true);complete();
    assert(a.core.saved.event_count==1 && b.core.saved.event_count==1);
    assert(l2_load(&a.core,a.blob,a.blob_size,persist,&a)==L2_OK);
    assert(l2_load(&b.core,b.blob,b.blob_size,persist,&b)==L2_OK);
    assert(l2_peer_machine_init(&a.machine,&a.core,send_message,&a));
    assert(l2_peer_machine_init(&b.machine,&b.core,send_message,&b));
    assert(!a.machine.view.complete && !b.machine.view.complete);
    assert(!a.machine.view.complete_count && !b.machine.view.complete_count);
    assert(!a.machine.view.local_confirmed && !b.machine.view.remote_confirmed);
    assert(a.core.saved.event_count==1 && b.core.saved.event_count==1);
    assert(a.core.saved.peer_outgoing_acked[0] && b.core.saved.peer_outgoing_acked[0]);
    a.count=b.count=0;link_pair();pump(100,false,false);
    assert(!a.machine.view.complete && !b.machine.view.complete);
    pump(500,true,true);complete();
    assert(!a.machine.view.incoming_new && !b.machine.view.incoming_new);
    puts("PASS reboot after full complete: receipts/ACK survive, runtime completion/consent reset, reconfirm completes without duplicate gift event");
    return 0;
}
