# Offline local2 core and NVS adapter regressions

Run from the project root:

```sh
/opt/homebrew/bin/python3 -u tests/local2-core/run.py
```

This compiles the actual `local2_core.c` and `local2_store.c` with C11, `-Wall -Wextra -Werror -pedantic`, AddressSanitizer and UndefinedBehaviorSanitizer. The store test substitutes SDK I/O headers and a pthread-backed mutex. It does not prove actual NVS power safety, firmware linking, real peer radio, display or hardware acceptance.

## Persisted domain

- One owner UUID and strictly serial command sequence. First successful network mutation uses seq1; each new mutation requires last+1. Same seq/requestId/SHA-256 bytes replays; same seq with different ID/hash conflicts. Older sequence is stale; gaps and owner changes are rejected. Invalid/rejected operations do not consume sequence. The adapter must compute SHA-256 over the canonical complete command: core does not trust a caller-supplied hash as authentication.
- Snapshot pet identity is sticky. Lower revisions fail. Equal revision with different canonical content fails. Equal content can consume a new command sequence, committing the request result without changing authoritative values.
- Device care only creates durable evidence; it never mutates authoritative metrics, coins or revision. Phone settlement belongs to the parent protocol adapter. Events have monotonically committed IDs. ACK accepts the exact FIFO head or an already acknowledged watermark; unknown/future/out-of-order IDs cannot delete records.
- Incoming real peer receipts share a permanent 32-peer first-acquaintance ledger. The first flower creates exactly one gift event for that anonymous peer. Higher counters may durably refresh the incoming watermark but return duplicate without another gift event or reward; equal identical receipt is duplicate, equal different receipt conflicts, lower is stale. No peer slot eviction. Incoming and outgoing use the same peer slots. One wildflower (`L2_GIFT_FLOWER=1`, quantity1) is supported; no invented coin reward.
- Outgoing first gifts have a distinct 32-entry durable FIFO and monotonic reservation counter. The permanent per-peer ledger retains the original outgoing receipt counter and ACK state even after the FIFO entry is deleted. Every reservation for an already known peer returns DUPLICATE plus that same first receipt, even after restart and a new nonce/explicit confirmation. ACK of any previously acknowledged matching peer/counter is idempotent; a new pending ACK requires the exact target peer and counter of its durable pending record, without being blocked by another peer. No volatile counter or receipt is accepted as durability evidence. The policy is one first wildflower per anonymous peer; repeat meetings may animate but do not mint another first-gift event. This is conservative local deduplication, not distributed atomic settlement.
- The display gift state records local receipt/presentation, not verified mutual completion. UI must use the actual peer handshake completion signal before showing a bilateral completion animation. Store read-lock timeout returns `busy=true`, `ready=false`, `storage_error=false`; UI should retain its last known view while waiting. Actual init or persisted I/O failure still returns a storage error. Initial load zeros runtime change counters; it does not replay historical animations. Snapshot `epoch_ms` is historical metadata and must not be treated as a valid running clock after reboot.

## Failure handling and bounded storage

The persistence callback atomically replaces a single byte-defined CRC32-protected blob. Core stages changes separately and only publishes them after callback success. Any failed or indeterminate write latches mutation failure for that boot. The tests cover both failure before durable replacement and failure reported after the new blob actually reached storage: after restart the actual blob determines the next ID and no ID is reused. Corrupt load leaves existing last-good RAM state intact, marks failure and never writes/reset-erases storage.

Production adapter uses **only `cf_local2/state`**, initializes NVS without any erase fallback and allocates the 34,104-byte core on PSRAM (internal heap fallback only). All UI/wire/peer access must share `l2_runtime_core(timeout_ms)` / `l2_runtime_release()`. Never hold that mutex while waiting for radio or acquiring UI locks. UI wrapper calls use the same mutex. Boot init is called once before workers; a failed init is not retried silently.

Current schema2 encoded size:

```
451 + 17*careEvents + 25*giftEvents + 42*peerLedgerSlots + 9*pendingOutgoingGifts
```

At `careEvents+giftEvents <= 200`, `giftEvents <= peerLedgerSlots <= 32`, `pendingOutgoingGifts <= 32`, the reachable and validated worst case is **5,739 bytes** (168 care +32 first gifts +32 ledger slots +32 pending outgoing). The decoder rejects duplicate queued first-gift events for the same peer. ACK state and first outgoing counter add 9 bytes to each 33-byte receipt slot; pending outgoing uses a 1-byte peer-slot reference plus its 8-byte counter. The 8,192-byte scratch bound has headroom; it is not the actual maximum live blob. A peer receipt ID uses 16 raw bytes on disk and canonical lowercase hex32 at the ABI. Schema2 deliberately rejects earlier candidate schema1 rather than silently inventing a first-acquaintance history; the earlier candidate was host-only and not deployed by this agent. CRC and schema are independent of native C struct padding/endian. The original NVS partition is not enlarged and no legacy keys are reclaimed. Actual coexistence/GC headroom must be reviewed against the real original image; a full/fragmented NVS returns a visible failure and stops writes, not an erase.

Each successful mutation replaces one full blob. At maximum reachable pending state this can write about 5.8KB per care, gift receipt, ACK or presentation update; NVS batching/flash endurance remains a deployment measurement, not a host pass. Gift-state writes are limited to actual state transitions and repeated state is a no-op.

## Coverage

`report.json` records exact assertions, scenarios and source SHA-256 values. The pure core includes UTF-8 and safe-integer boundaries, revision/pet/owner conflicts, sequence replay after restart, full event and peer/outgoing queues, gift identity duplicates, old/future ACKs, uncertain commits, every-byte corruption, valid-CRC semantic corruption and a full-capacity load. Production store scenarios cover allocation, mutex, init/open/read/set/commit failures, corrupt/oversize blob refusal, retained blob readback and four concurrent callers generating 80 contiguous event IDs through the actual wrapper.

## Lost-DONE and re-confirm regression

The core test drives two independent real domains/disks through reservation, received durable receipts and precise outgoing ACK, deliberately omits DONE, reloads both domains from their actual saved blobs, then performs new explicit reservations/confirmations. Both sides reuse counter1, both gift-event counts remain1, both next-peer counters remain2, both runtime gift-change counters remain0, and duplicate ACKs remain idempotent even after later peers were acknowledged. The peer owner separately tests its actual nonce/handshake state machine; this core test does not pretend to execute radio or physical consent. Permanent ledgers are finite: after32 anonymous peers, new peers fail visibly; changing/resetting an identity can appear as a new anonymous peer, so this is not account-level anti-abuse or a global social graph.

## Independent peer ACK ordering

Phone event ACK still requires the strict FIFO head. Peer outgoing ACK is independent per peer: A can remain unacknowledged while B completes; ACK(B, counterB) removes only B after durable commit. Crossed identity/counter pairs are rejected. Per-peer ACK flags are authoritative; `last_peer_ack` is only the contiguous prefix frontier, so holes are valid and are checked on load. When A later completes, the prefix advances through already-ACKed B. Restart, repeated B confirmation and an uncertain out-of-order commit are covered without duplicate first gifts or counter minting. Stored layout and maximum encoded size remain unchanged.
