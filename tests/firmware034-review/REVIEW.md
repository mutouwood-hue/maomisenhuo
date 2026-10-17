# Firmware 0.3.4 independent minimal delta review

## Conclusion

**No confirmed P1/P2 source or package blocker. The exact frozen candidate is eligible for Root's next minimum app-only device validation**, subject to a fresh current prefix/NVS backup and complete verification of the existing protected regions and actual partition/slot state. This is a source/package and host-test release; 034 hardware, actual memory recovery, clock/FIFO, capture, and optical performance have not passed by this review.

This reviewer opened no device/serial/ADB, performed no install/flash/target build, and changed no candidate. All new output is under `tests/firmware034-review/`.

## Exact package and source verification

- App 6397696 bytes, SHA256 `7f438d6f92f597ae8dd183acadaad177aebe456f43a0791f0fb64e2fc1b13f4e`.
- Source ZIP 2655141 bytes, SHA256 `135f63a13fbeec0816363114de0c4acbaf02e373b14ccd5b9302cb48aa670d37`.
- ZIP contains **114 total entries: 103 source files plus 11 support/handoff files**, each independently read back byte exact. The stated 103 source count is correct.
- FROZEN/manifest/source-hashes/SOURCE-DELTA hashes verify; all 103 current source hashes and the prior 033 source/app/ZIP/manifest remain exact at review end.
- App descriptor reads `0.3.4-local3`, secureVersion 0; the image fits the unchanged 8 MiB app slot. ELF hash matches manifest. Existing signing/security/rollback settings are unchanged; no new cryptographic signature claim is made.
- All **51 `main/**` files** byte equal 033, including diagnostics/parser/STATE/PERF/VIEW/CAPTURE, snapshot buffer/guard, fonts, core, persistence, BLE, wire, peer, facade, scene and gestures.
- sdkconfig, sdkconfig.defaults, dependency lock, partition CSV and compiled partition table are unchanged. Source partition CSV retains NVS `0x9000`/`0x8000`, OTA1 `0x820000`/`0x800000`; this does not replace a fresh on-device partition/slot check.

## Exactly four source deltas

1. `CMakeLists.txt`: only version 0.3.3 → 0.3.4.
2. `cmake/private-bsp-integrity.cmake`: only the expected private BSP hash.
3. `components/waveshare__esp32_s3_touch_amoled_1_75c/esp32_s3_touch_amoled_1_75c.c`: exact bytes restored to the 032 deployed fixed-10 baseline, SHA256 `f3a86ce64f3117fc52b35c646ec652826a62a214a589a133dae3155e1016cc24`. This is the sole runtime delta.
4. `tools/host_preview/preview.c`: only the source-evidence path string.

BSP lines 476–479 use literal 10 rows, internal buffers, no PPA, double-buffer requirement; lines 484–488 retain registration failure → NULL. No 20-row probe/retry remains. It uses the unchanged 40 MHz configuration. Each RGB565 pixel buffer is nominally 466×10×2 = 9320 bytes; total 18640. Compared with the 033 selected 20-row pair, nominal pixel storage decreases by 18640 bytes. Actual runtime heap/free largest block/peak may differ and requires new readback. Fixed 10 rows can increase flush transaction count; it is not evidence of faster rendering or tear-free scanout.

The unchanged `main/badge_diagnostics.c:138` still rejects CAPTURE unless internal DMA free ≥64 KiB, PSRAM free ≥2 MiB and sufficient contiguous allocation. No guard, parser permission, VIEW gate, lock, CRC, cancellation or layer behavior was relaxed.

## Executed offline checks

Reproducible command, workspace root:

```sh
python3 tests/firmware034-review/run_review.py
```

- Independent package/source/delta verification above: pass.
- Existing fixed-10 guard script rerun with only root/output paths relocated into reviewer output: **11/11 pass** (`fixed10-buffer-tests.json`, `fixed10-run.log`). Candidate evidence was not overwritten.
- Actual frozen production diagnostic C independently compiled through the existing USB/heap/domain platform fixture, Clang `-Wall -Wextra -Werror`: **34/34 pass**, compile/run logs retained. This does not simulate actual memory allocation, USB timing or physical devices.
- Owner's 48 software layout/raw files independently hash-associated and all 48 raw SHA values equal 033. Owner 14 decoder-case pass metadata read back. Those two owner suites were not rerun for this minimal BSP delta and are not relabeled independent hardware passes.
- All tested source hashes remained unchanged. Full report, compile command, linked host library hash: `report.json`.

## Root device-validation gate

1. Preserve the currently running 033 and its current data with fresh backup and full protected-region verification; do not substitute the earlier revision16/seq25 backup for later revision18/seq27 or new receipts. Determine actual current app/slot state before the existing app-only procedure. This review authorizes no change to bootloader/table/assets/NVS/owner/FIFO.
2. After the sole-integrator app validation, require PERF to read both real buffers as 9320 bytes and DMA-capable; record DMA free/largest/min separately. If remaining DMA is still below 64 KiB, CAPTURE must refuse. Do not lower its budget to force success.
3. Only a complete actual BEGIN/DATA/END frame with verified offsets/CRC establishes device object-tree capture; it still does not prove optical tearing or touch performance. Capture itself affects timing and heap.
4. New startup requires fresh phone calibration. Independently read clockValid/now/offset, revision/seq and pending/lastAck against Native durable receipts; prior 033's successful 022 calibration and 9 receipts are separate evidence. Do not claim precise synchronization from the earlier approximately 0.98–2.41 s phone-bracket lag.

Root's reported 033 runtime stability, dual-20-buffer budget refusal, and successful later calibration are useful prior-device observations. They are not results for 034 and were not remeasured by this reviewer.
