# V2 real data integration

Production entry remains `BAJI_V2=ON`. The legacy five local BLE operations and 10-byte STATE are unchanged. Extension opcode 6 negotiates capabilities; object BEGIN/PAGE/COMMIT and metadata READ use the frozen contract in `docs/real-data-contract.md`.

## Ownership and privacy

- Manufacturing/USB provisioning must put one independently random **32-byte binary** secret into NVS namespace `baji_v2`, key `device_key`. Backend must receive the same secret through external secure configuration. This implementation does not provision hardware, print the secret, derive it from the MAC, or ship a fallback key.
- No key: local tutorial and ordinary STATE/SENSOR remain available; private EVENT and cloud writes fail closed. MAC is a public stable ID, not an ownership credential.
- Phone relays backend challenge and displays its six-digit code. Device requires a real press/release in its confirmation region; the queued confirmation includes the challenge UUID visible at press time. A replaced challenge or new connection cannot use a stale finger confirmation.
- A proof alone never sets ownership. A valid server-signed grant matching the current confirmed challenge opens only the current connection session. Disconnect, expiry or generation change revokes it.
- Initial confirmation uses a 60-second monotonic deadline; unsigned challenge wall time does not set the clock. Signed TIME follows a signed grant, avoiding a first-boot authentication/clock dependency cycle.
- PET/LIFE/TIME/ACK require HMAC and monotonic signed counters. All crypto, NVS and sensor transactions run on the dedicated worker, outside BLE spinlock and LVGL locks. The UI exchanges bounded queues and immutable snapshots.

## Real inputs and durable output

- Existing read-only PMIC gauge remains authoritative for battery validity. Missing/stale fields retain unknown sentinels. Current PMIC snapshot does not expose charging; SENSOR charging is 255 rather than an invented charging state.
- QMI8658 initialization checks WHO_AM_I and each register write. Samples are acceleration in mg, not steps, magnetic heading or a completed Fate interaction. No valid sample is encoded as signed -32768.
- Actual non-tutorial care taps produce events: feed/water only after 3 inputs, play after 5; changing or leaving an unfinished care emits CARE_CANCEL. Tutorial taps, unsupported microphone/ASR and radio discovery do not invent completed interactions.
- The worker stores a CRC-protected NVS FIFO of at most 200 original 8-byte event bodies, each with a persistent uint64 ID. EVENT read freezes an authenticated signed 48-byte head. Notifications do not remove it. Only an exact signed server-terminal ACK durably removes the head.
- A full FIFO preserves existing unsent records and records a drop counter. Input-queue drops and storage errors are exposed by runtime diagnostics. A corrupt durable stream is never silently reset to reuse IDs. Any NVS write/commit error also locks storage mutation for that boot; an indeterminate commit result cannot silently reuse a rolled-back ID. Restart reopens and validates the actual persistent blob.
- Snapshots display five authoritative metrics or `--`. Daily ring data has no coordinates, is limited to 24 segments/24 heart markers as an explicit display budget, and only displays a matching current local date. Signed empty data clears stale rings. New grants clear previous-session private PET/LIFE caches.

## Verification and limitations

- `firmware-v2/tools/test-data.ps1`: **1605 checks**, including real Windows CNG HMAC-SHA256 against independent Node golden proof/grant/event/ACK/TIME, uint64 > 2^53, queue restart/failure/overflow, signed counter replay, cross-day revision, signed empty LIFE and new-grant version scope.
- Existing pure core: **5296 checks** and Xtensa object compilation.
- Real production transport with SDK mocks: **1340 checks**, including worker handoff and stale-generation replies.
- Actual production runtime with SDK/LVGL/worker mocks: **24 reset scenarios / 987 assertions**. These execute real input callbacks and core policies, not the actual NVS/I2C worker or LCD renderer.
- Expanded local 16/24px fonts and strict production ESP-IDF/LVGL object compilation pass. Actual production NVS save adapter: **62 checks** (set failure, commit failure with old blob retained or new blob persisted, fail-closed latch and reboot ID greater than last ACK); worker/I2C/HMAC boundaries abort if accidentally invoked in that test.
- Lead performed the final full `BAJI_V2=ON` image build after the NVS latch patch: exit 0, ELF and application binary generated, **2,939,168 bytes**, 65% free in the 8MB app partition. No flash.

No flash, Git operation, actual phone ownership handshake, physical IMU calibration, PMIC safety/power or LCD pixel/timing acceptance was performed. Microphone/ASR is not implemented and the voice screen says so. Existing cat sprite assets are still limited; appearance IDs are synchronized/displayed, but six breeds and clothing visuals are not claimed as completed. This document is not a deployment acceptance report.
