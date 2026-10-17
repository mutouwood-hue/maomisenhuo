# Firmware 034 actual evidence: independent read-only review

## Limited conclusion

**Recorded evidence supports actual 0.3.4 boot, protected-region/app readback, fixed-10 DMA buffers, three complete CRC-valid running-LVGL compositions and the final clock/queue observations.** No new P1/P2 blocker is confirmed in this evidence. Physical scanout, optical tearing, true touch/gesture performance, new events and power-loss recovery remain untested. Root alone performed the device operations; this reviewer only read local artifacts and decoded existing logs.

Root evidence: `artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T0205Z-safe10/`. Offline replay: `python3 tests/firmware034-review/check_actual_evidence.py`; full derived results: `actual-evidence.json`.

## Backup/write/readback chain

- This round freshly read the physical first128KiB, then composed a rollback image using prior physically read ranges. It is **not a new full32MiB read**. The four non-overlapping physical ranges cover all32MiB and each has tool `verify OK (digest matched)` before modification; both JSON exit status and original logs were independently checked.
- Fresh prefix equals the before-prefix file. Selector-copy1 backup equals the exact 4KiB prefix slice. Cleared prefix differs only by that copy1 being FF; post-activation prefix returns byte exact to the fresh original, including the NVS byte range. No NVS keys or private save were decoded or printed by this review.
- The original 033 OTA1 full-slot backup is retained. Expected 034 slot equals the exact candidate app, a 256-byte FF aligned-sector tail, then unchanged old remainder. The independent clean-ROM app-sector readback equals that expected range byte for byte; actual app hash is `7f438d6f92f597ae8dd183acadaad177aebe456f43a0791f0fb64e2fc1b13f4e`.
- Final pre-activation protected verification again covers prefix, old OTA0, expected new OTA1 and assets tail with four matching digests. These logs support the recorded minimum app plus temporary selector handling, not a whole-device rewrite.
- Failure history is preserved: the first 921600 read failed on a short/corrupt USB frame; the first 460800 no-reset attempt failed to synchronize the old stub. A separate explicit ROM re-entry/security-MAC recheck preceded the successful 460800 read. The earlier failures are not relabeled successes and do not prove Flash corruption or identify the physical transport cause. No app rewrite was used to manufacture the final readback.

## Actual boot and diagnostics

Boot log reads `App version: 0.3.4-local3` and one specified USB-UART-chip-reset boot. The captured session lasts **574.372s**, ends at `02:31:00.728652Z`, records 13 commands and no session error. Root reports host `QUIT`; the preserved session script closes its port in finally. This is not an invented firmware QUIT opcode.

The complete captured console has **0 ESP E lines / 0 panic matches**; a single startup `CFDIAG ERROR COMMAND_INVALID_OR_TOO_LONG` is retained and is not hidden by that ESP-error count. The host applied a bounded startup LF only when no capture was active; subsequent commands have their recorded terminal responses. No DMA/flush failure was found in the preserved console. This finite window is not a long-term stability guarantee.

| Observable | Initial command02 | Final command13 |
|---|---:|---:|
| Buffer1 / Buffer2 bytes | 9320 / 9320 | 9320 / 9320 |
| Both DMA-capable / double | true / true | true / true |
| DMA free | 72595 | 72347 |
| DMA largest | 31744 | 31744 |
| DMA historical minimum | 33440 | 32944 |
| PSRAM free | 8278980 | 8255424 |
| pressedPolls | 0 | 0 |

These are actual heap and software counters. The 64KiB CAPTURE guard remains unchanged and current DMA free exceeds it in the initial window. Historical minimum is a separate counter; no claim is made that it always stayed above64KiB. Fixed10 nominal buffer savings and successful capture are supported, but not faster sliding or a comparable benchmark against 033. Render/flush timing accumulators are not optical FPS.

## Three real compositions independently decoded

The actual `command-04/06/08-capture.log` files were passed through the frozen strict decoder: full BEGIN/DATA/END framing, exact offsets/chunk count/capture identity and CRC. Each decoded 434312-byte RGB565 frame equals its saved raw file and regenerates the saved PNG exactly.

| Face | Capture ID | CRC32 | LVGL pause |
|---|---:|---|---:|
| A | 1 | `a5038e40` | 69620µs |
| B | 2 | `c1199251` | 45249µs |
| C | 3 | `8831908a` | 46881µs |

All three original PNGs were visually inspected. They show the running cat/UI and the intended uncalibrated/no-schedule empty states; they were captured **before the later phone calibration**. B/C rings are not evidence of filled real daily data. Source is running LVGL object-tree composition including layers, **not panel GRAM or optical photography**. It does not prove physical screen orientation/brightness, tearing, real finger gestures or touch latency. `pressedPolls0` directly prevents calling this a real swipe test.

## Clock and existing queue/receipts

Command01 reads revision18 / seq27 / pending0 / lastAck9 / nextEvent10, clockValidfalse/now0/offset0 after new boot. Following the phone's real connection, command12 reads revision19 / seq28 / pending0 / lastAck9 / nextEvent10, clockValidtrue / offset480 with nonzero nowMs. The UI024 actual read/export separately shows the same revision19/seq28/ack9/pending0 summary while correctly saying BLE lacks direct clock fields.

This establishes a later valid clock observation through USB, not precise synchronization accuracy or a new power-loss test. Existing Native 9 ledger records and 9 social receipts remain byte equal at the phone's captured checkpoints (8 applied +1 quarantined unchanged); no new care/gift or duplicate reward was exercised. The device ACK watermark alone cannot prove each award.

## Remaining scope

Continue to treat optical tearing, real touch routing/performance, fresh event/gift/friend/queue scenarios and power-loss durability as pending. No new device action, source change, reflash, upload or permission operation was performed by this reviewer.
