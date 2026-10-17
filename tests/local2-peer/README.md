# Local2 peer candidate

`python3 tests/local2-peer/run.py` compiles the production pure-C state machine together with the production durable core using `-Wall -Wextra -Werror`. No target, radio, device, network or credentials are used. `latest-report.json` binds results to source hashes. The runner also compiles exact production framing helpers extracted from `local2_peer.c`, checking fragmented roundtrip, retries, rejection and backpressure without pretending to execute the NimBLE adapter.

## Integration

- `local2_peer_register(core)` registers the independent service on the existing NimBLE host, before host startup. No second host or NVS initialization.
- Root GAP callback calls `local2_peer_gap_event(event)` first. Root owns all advertisement set/start/stop operations.
- Manufacturer payload is exactly 23 bytes: local experimental company ID `ffff`, schema `02`, persistent random public device ID (16 bytes), rendezvous token (4 bytes). Keep phone service UUID in scan response. This payload carries no pet name, account or credential.
- Root polls `local2_peer_advertisement_generation()` and refreshes manufacturer data. Nearby is disabled at boot and only enabled by an explicit UI command.
- Domain worker calls `local2_peer_poll(monotonic_ms)`. It obtains the runtime core/store mutex for domain operations and releases it before GAP/GATT operations. Never call it on NimBLE host callbacks: durable core writes may block.
- UI uses thread-safe `local2_peer_get_view`, `set_discoverable`, `confirm`. A pending saved gift is not a completed exchange. Only a rising runtime `complete_count` after DONE exchange permits completion feedback. Baseline at UI attach avoids historical playback. `incoming_new` separates first receipt from an already durable duplicate.
- Target dependencies: existing `bt`, `freertos`, `esp_hw_support` (`esp_random`), and QA `local2_core`/`local2_store`. Parent owns CMake and target compilation.

## Wire and safety properties

The service is `6f3d2100-8f4d-4b73-9ce5-43464c4f4332`; write RX ends `2101`, read TX ends `2102`. It is deliberately separate from phone and historical/cloud services. Transport frames are 20 bytes: `[schema,type,sequence,page,sizeLE16,payload14]`; type zero is fragment ACK. Received pages are retained/deduplicated, and peripheral read pages advance only after central fragment ACK. Gift ACK is a separate domain message and occurs only after durable receipt persistence.

ID ordering selects one central. RSSI >= -65 dBm is only a discovery heuristic, not a distance measurement. Both sides scan, and the central waits 500 ms after discovering a candidate. The peripheral must have cached the central's advertisement/address before claiming the connection; otherwise it does not authorize peer GATT and discovery can retry. Unknown inbound connections are handed back to the root GAP handler.

Full per-connection nonce challenges bind HELLO, both physical confirmations, gift, ACK and DONE. The adapter keeps the advertised four-byte rendezvous prefix and replaces the 12-byte challenge tail on each new link. This is anonymous local interaction, **not cryptographic identity, account authentication, relay resistance, or a signed grant**.

Flower is a first-meeting reward once per persistent anonymous peer ID. The permanent 32-peer ledger retains the first outgoing counter even after ACK; subsequent real meetings reuse that receipt and do not create another reward event. When full, new peers are refused rather than evicting deduplication history.

Outgoing receipts must be durably reserved before transmission. A receiver commits its receipt and event before ACK. Storage failure, unknown-peer table capacity (32), or a full event queue block success. Independently pending receipts for other peers do not block reservation/ACK of the current peer’s exact permanent receipt. Disconnect resets transient confirmation/completion, while durable pending receipts remain available for a new explicit confirmation session. A runtime completion is evidence of the observed local handshake; it is not a distributed atomic commit claim.

## Remaining verification

Actual ESP-IDF/NimBLE compilation is coordinated separately. Two-device discovery, radio coexistence with the phone, physical confirmation, lost connections, power cuts, persistent reload, real NVS exhaustion and animation timing require two real badges. No device was connected or flashed for these host results.

## Virtual activation E2E

See [VIRTUAL-ENCOUNTER.md](VIRTUAL-ENCOUNTER.md) for the test-only CLI, eight fault scenarios, replay schema, exact blob/event digests and UI mapping. Product files contain no virtual-success switch.
