# Shared protocol rev1: firmware050 / next phone

Ownership: device thread owns firmware050 and this document; B owns phone and adapter. Keep CFLOCAL2 v2, UUID, owner/client/pet identity, 2048-byte NDJSON and single mutation journal. No collection or paid services.

## Care and durability

Five actions: `pet/feed/water/play/sleep`. Existing unique ID `deviceId:counter` is allocated with the event queue in one committed NVS blob. Display recorded only after commit. No clock means occurredAtMs:null. Device never deducts coins or grants growth. Full FIFO fails explicitly, never overwrites.

Phone durably commits authoritative game result and eventId receipt before existing op:ack, using the original seq/checkpoint:

```json
{"counter":1,"eventId":"<32hex>:1","receipt":{"status":"rejected","reason":"insufficient_coins","persisted":true,"saveDigest":"<64 lowercase hex SHA256>"}}
```

Terminal status is applied/rejected/quarantined. Transport status duplicate MUST additionally carry originalStatus=applied/rejected/quarantined and the original reason/saveDigest; never recalculate. Applied reason=none; rejected reason must not be none. Reason is 1..40 ASCII [a-z0-9_], including insufficient_coins/ineligible/invalid_action/source_mismatch/unsupported; no personal data.

Device atomically stores last terminal {counter,status,reason,saveDigest,action} and advances lastAck/removes FIFO head. Lost ACK reply: replay exact pending. Same counter with conflicting receipt is rejected; older counter below lastAck is stale, never settled again. State and ACK response include lastCareResult {eventId,counter,action,status,reason,saveDigest}. Phone ledger is full receipt history; device holds FIFO/frontier/last receipt only.

Insufficient coins: animate action, no deduction/growth; phone sends terminal rejected+insufficient_coins; device stops retransmission permanently after ACK. Never charge later. Cooldown waiting is nonterminal and does not ACK.

## Places

Add scene garden/town; home=room. Keep departing/away/returning for transitions/old data. Old away displays garden, never claim it is distinct town. HELLO adds scene_places_v1 and care_receipt_v1. Phone gates new enums on capabilities and uses authoritative same-cat source, not day/DOM labels. Adapter remains sole wire revision/seq allocator. Receipt cannot invent growth/snapshot changes.

## Reconnect

Phone persists explicit selected deviceId/address/consent, restores only that device on foreground/reopen: subscribe, HELLO verify deviceId/clientId, recover pending, fresh snapshot, FIFO. Never rebind or overwrite another cat automatically. Permission/BT errors visible. Firmware keeps connectable advertising and queue/identity across wake/disconnect; lease stale connected sessions without communication so reopen is not blocked. Android need not run permanently while locked; queue survives until foreground.

## Delivery

Source implementation and ordinary compilation/package only; NO technical tests, performance experiments or automated execution validation. User checks disconnect/reopen/lock/wake/reboot loss/duplication, terminal rejection and places. Compilation is not acceptance. Any demo reset requires separate exact-object confirmation; do not clear now.
