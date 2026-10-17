# Cat Forest BLE protocol v1

冻结日期：2026-10-15。用于真实 Android ↔ 1.75C 单板核心闭环。测试 fixtures 是开发工具，真实设备验收另行记录。

## GATT and security

- Service: `7b2e1000-6a6d-4d8f-9c45-4f4d43415431`
- RX command write with response: `7b2e1001-6a6d-4d8f-9c45-4f4d43415431`
- TX event/status read + notify: `7b2e1002-6a6d-4d8f-9c45-4f4d43415431`
- Android central/client; badge peripheral/server. Pairing is user initiated, bonded LE Secure Connections with displayed passkey and encrypted/authenticated characteristics. No automatic OS prompt confirmation.
- GATT writes are serialized WITH_RESPONSE, chunks <= negotiated MTU-3. Both streams reassemble UTF-8 **bytes**, not individually decoded chunks. Each JSON object ends with LF. Maximum frame size **2048 bytes including LF**. Support fragmented/coalesced messages. Oversize/invalid frames are rejected, then discard through LF and resume next message. Unknown fields may be ignored; unknown kind/version is rejected without mutation.

## Messages

All messages include integer `protocolVersion:1` and `kind`. IDs are nonempty UTF-8 strings: petId/deviceId <=64 characters; eventId <=128. Numbers must be finite integers (booleans are not integers).

**snapshot (Android → badge):** `petId`, `revision >=0`, `food/mood/clean/energy/health` each0..100, `coins >=0`, `updatedAtMs >=0`. `petId` is persistent UUID generated once, never regenerated at restart. The badge accepts its first pet binding and persists it, then rejects a different petId as `pet_mismatch` without overwriting. Lower revision rejected `stale`; equal revision with same content is idempotent; equal revision with different content is rejected `revision_conflict`. Accepted snapshot is persisted before status `synced` is sent. `updatedAtMs` is app epoch milliseconds; not used as state authority.

**event (badge → Android):** `petId`, persistent `deviceId`, `eventId`, `type:"pet"`, `timestampMs >=0`. Event ID is deviceId + monotonically persisted sequence; it must not repeat after reboot. The event and sequence are persisted before notification. A timestamp0 means device clock unknown, and Android records receive time separately. Native app rejects a different petId, validates the type, applies the approved +9 mood clamped100 once, increments revision, and atomically persists state plus event deduplication before ACK. Retransmitted event has no second effect. Durable event deduplication survives process/device restart and is preserved in backup.

**ack (Android → badge):** `eventId`, `status:"applied"|"duplicate"|"rejected"`, `revision >=0`, optional `reason`. Remove a queued event only after applied/duplicate ACK is durably committed. Rejected event is preserved and visibly blocked/quarantined, not silently discarded. Android follows applied/duplicate ACK with its latest snapshot. Badge queue max200; when full do not pretend an interaction was accepted or discard oldest events.

Transient App storage/write failures produce **no final ACK** and a visible local error, so the same event remains eligible for retransmission after storage recovers. `rejected` is reserved for semantic validation failure. Badge may offer an explicit physical/user retry of quarantined event preserving its original eventId; never auto-delete or invent a new ID to bypass deduplication.

**status (badge → Android):** `status:"synced"|"stale"|"revision_conflict"|"pet_mismatch"|"error"`, `revision`, `petId`, optional `reason`/`deviceId`. Android displays actual connection/sync/error state. A stale response may trigger same-pet resync using a revision greater than both cached values only after the local state/revision transaction is durably saved. It must not silently bind a different pet or reset device data.

## Recovery and ownership

Android is the temporary local rule executor; long-term PRD cloud primary storage remains a future contract with conflict/merge rules still open. No cloud/API key involved in v1. Both endpoints persist before acknowledging. Reconnect sends latest snapshot and replays unacknowledged events. Android backup import preserves petId and deduplication and advances revision; damaged state is reported and a valid backup is used instead of an invisible reset.

BLE bonding, Android permission grant and hardware flashing require the user's actual action/approval; fixtures, compilation or successful serialization never count as hardware acceptance.
