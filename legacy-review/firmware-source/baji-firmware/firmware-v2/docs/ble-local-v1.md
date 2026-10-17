# BLE local v1 — implementation status

This contract supports local device testing only. Connection, HELLO, or MAC identity does not authenticate cloud ownership.

## Wire format

Service: `e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a00`; RX suffix `01` (write with response); TX suffix `02` (read/notify). Ready requires successful notification subscription.

Exactly 20 bytes: `42 4A 01 opcode seqLo seqHi length 00 payload[12]`. Length <= 12, all unused payload bytes zero. Requests require sequence 1..65535. Default ATT MTU 23 is sufficient.

Requests: 1 HELLO, 2 GET_STATE, 3 START_LOCAL (empty); 4 PING (0..10 bytes, exact echo); 5 SET_FACE (one byte 0..2).

ACK opcode 0x80 uses the request sequence and payload `[requestOpcode,status,data<=10]`. Status: 0 OK, 1 bad frame, 2 unsupported, 3 busy, 4 denied. GATT write completion is not an application ACK. Match both sequence and original opcode; PING must match echoed bytes.

HELLO data: version=1, capability bits (state/local/ping/face), MAC[6]. State data: screen, step, phase, flags (local/auth/tutorial/suspended), face, battery (255 unknown), power (0 unknown/1 normal/2 low), USB (255 unknown/0 absent/1 present), revision LE16. State notification opcode 0x81 has sequence 0. Reconnect uses GET_STATE to repair missed updates.

## Verified implementation

Round23: pure-C frame codec and request validation; 676 protocol checks passed under strict host compilation. Unified core gate: 5111 checks, zero failures, including Xtensa codec object compilation. Codec is listed in the V2 component source list.

Round24: independent pure-C application dispatcher and state serialization added. HELLO, GET_STATE, START_LOCAL, PING and SET_FACE return sequence/opcode-correlated ACKs. Pressed, transitioning, suspended or VOICE scenes reject mutations; tutorial/authentication boundaries deny SET_FACE. Repeated local start is a no-op. State revisions change only with serialized state and wrap at uint16. This is candidate behavior under test, not confirmed hardware policy. New dispatcher regression: 185 checks, zero failures, including invalid-request nonmutation, VOICE rejection and verified-authentication arrival during local experience. Unified gate: 5296 checks, zero failures, including Xtensa dispatcher object compilation.

## Current integration and remaining verification

Independent NimBLE GATT transport and the runtime dispatcher are integrated: 8-slot generation-tagged RX/TX queues, at most two dispatches per UI tick, notification backpressure retention and 2 ACK : 1 STATE fairness. Transport SDK-mock regression passed 1311 checks; real runtime with SDK/LVGL/PMIC/BLE mocks passed 20 scenarios / 766 assertions. These do not exercise real radio concurrency or hardware safety.

Android BleLocal native bridge and local test panel are implemented. CCCD success establishes transport-ready without an initial READ dependency. Reconnect gate/device loss clears the current intent; stale epochs cannot cancel newer reconnect work. JS notify/handshake/GET_STATE share uint16 revision acceptance and reset on epoch changes. Mobile tests passed 24/24, including three revision/race tests and two native **source-only** gates; the latter are not native callback execution tests. Web resources were rebuilt and synced; assembleDebug and lintDebug succeeded. APK SHA256: `ADD5EC3AF2045B07CAC4BBF1307A7409ECBDC6ADCE3882526A3D61EB2FF1AA8A`.

Firmware image is 0x4e7830 bytes (39% free in 8 MB application partition), SHA256 `4E87D84A1E2F797388614BA786C31DEA535A2EEA113A3FB573B0F3F9D21E4365`. Application-only write at 0x20000 to COM3 / ESP32-S3 MAC 7c:0c:5f:42:36:84 succeeded and esptool verified the data hash. No whole-chip erase, bootloader/partition-table/NVS/storage write or Git operation. Boot log confirms the original partition table, PSRAM memory test, display/touch initialization and NimBLE advertising; no panic appeared during the 10-second capture. Hardware Bluetooth MAC is 7c:0c:5f:42:36:86 (distinct from the base chip MAC).

Real phone scanning, CCCD, HELLO, application ACK, state sync and reconnect remain to be tested: adb currently has no attached phone. Display pixels, timing, allocation failures and PMIC physical safety are not accepted by this smoke test. Cloud ownership/authentication and real audio/ASR remain unimplemented; local identity must never be presented as binding. Pointer-cancel difference remains pending confirmation.
