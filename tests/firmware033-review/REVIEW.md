# Firmware033 independent delta review

## Decision and exact candidate

**PASS for root's next authorized minimal app validation after a fresh backup and live partition/active-slot check. No confirmed new P1/P2 source blocker found.** This does not confirm physical performance, absence of tearing, actual USB capture, clock or FIFO recovery. This review performed no device/USB/serial/ADB/reset/flash, target build or candidate edits.

Reviewed formal freeze `artifacts/firmware-local-v3-perf/FROZEN.json`, not the earlier packaging under `revisions/`.

| Artifact | Independently verified |
| --- | --- |
| App |6398304B; SHA256 `70f07fb0dd638e53ae44554dd15dcec7feb4dba06a9e7caf07bc8c7275760f95` |
| Final ZIP |2661503B; SHA256 `0226760dce646f071636a5bccd9330701dda658774873cf9b1d34477912989a6` |
| ZIP inventory |103 source files plus11 tools/handoff files =114 total entries; all read back against actual frozen files, no extraction into candidate |
| Manifest / source map |FROZEN-linked hashes exact;103 source hashes verified before and after execution |
| Baseline |0.3.2 candidate `artifacts/firmware-local-v3-dmafix/source`; runtime/build delta base hashes checked |
| Protected |43 existing main files byte-identical baseline, including core/store/peer/BLE/wire/facade/gesture/scene, sprites and4 original fonts.14 shared vendor BSP files match declared untouched hashes |
| Partitions |CSV identical baseline, SHA `09fc932049fe06c1eb696b49af5ea7c1f50866ba6212433ca2e7d16be779a648`; compiled table SHA `a83d5badd3817619dc7dbd12fda088c39004b91e14413b24d20f2dd0b9097be4` matches manifest. These are different artifacts |
| Config |Independent assigned-value comparison finds only `CONFIG_LV_USE_SNAPSHOT: absent→y`; UART0 remains primary, USB Serial/JTAG secondary output |
| Image |App descriptor magic/version/project/IDF read directly:0.3.3-local3/cat_forest_badge/5.5.5, secureVersion0; image fits8MiB app slot. ELF hash matches manifest |

This validates candidate identity and preservation boundaries. It is not authorization to write a partition or proof that the live device uses the presumed OTA slot. No bootloader/table/assets/NVS/owner/queue write is part of the release scope.

## Source findings

### Internal display buffers

Private BSP lines468–507 uses two simultaneous64-aligned18640B probes with INTERNAL|DMA|8BIT caps, keeps20 rows only if free/largest preconditions and remaining probe-time DMA≥96KiB hold, then frees both probes on every branch. Registration requests internal memory, double buffering, no PSRAM/PPA, and retries10 rows once if20-row registration fails. Total failure returns NULL.

Independent production-fragment harness tested10 branches: adequate reserve; free/largest just below thresholds; first/second probe failure; remaining free one byte below and exactly at threshold;20→10 registration retry; both registrations fail;10-only registration failure. Allocation/registration are explicit host substitutes.

Actual pinned adapter cleanup was read: `display_manager_register` calls destroy_node after init failure (`display_manager.c:207` onward); destroy_node frees primary/secondary draw buffers (`:483–504`,`:728–732`). Thus fallback depends on existing adapter cleanup rather than new ad hoc buffer ownership. Internal allocator uses INTERNAL|8BIT; true DMA capability is independently reported by diagnostics and must be checked on the ESP. Probe reserve is a decision-time condition, not a runtime or post-registration minimum guarantee.

QSPI40MHz and TEAR_AVOID_MODE_NONE remain.47→24 full-screen chunks is a capacity calculation only; no physical speed or tear-free result follows.

### Diagnostic commands, locks and resources

`badge_diagnostics.c` is the only main source reading USB Serial/JTAG; its single task and cancellation helper execute synchronously in that task. Primary UART stdin is unchanged. Existing-driver and task-creation failures leave diagnostics disabled or uninstall its own driver. No new radio, network, credentials or OS permissions.

Parser has40-byte storage, flags nonprintable/NUL/overflow until LF, dispatches exact whitelisted commands and resets after each line. No domain mutation command exists. PERF RESET clears volatile metrics only. STATE copies view/seq under domain mutex and releases before clock read/format/USB output. IDs are bounded printable ASCII in unchanged core validation; quote/backslash escaping fits doubled buffers. STATE clock and view are separate reads, not an atomic multi-source transaction.

CAPTURE refuses under PSRAM/internal-memory pressure; allocated PSRAM is released on lock failure, movement refusal, bad format, success, cancellation and write failure. Composition occurs under the BSP LVGL lock; USB output begins after unlocking. Active opaque screen, top then system layers are composed into the same RGB565 target using pinned LVGL9.5.0 API. No GRAM readback or panel flush is performed. CRC covers434312 bytes; chunks have exact offsets/IDs. Partial write, new RX or deadline aborts without a successful END; decoder rejects incomplete/corrupted captures. Output/console interleaving can invalidate a capture; it must not be patched together.

The34 production-C harness assertions ran with real LVGL and platform USB/heap/domain/clock substitutes. Output stub asserts no domain/UI mutex is held at USB write. The freshly generated diagnostic capture decoded using production Python decoder and matched CRC `c9c7d172` and raw SHA `2d4d0280e06d4dfdd29d46f56400a4beddd18a9730aa36984cc198c8ff2dabd0`. This is synthetic evidence only.

VIEW accepts0/1/2 only at existing awake HOME, rejects pairing/modal/reset/gesture/active drag/settling/transition. It changes face and marks UI dirty without navigation, input timestamp extension, preferences/domain writes, guide completion or care. The diagnostic_view host case exercised these gates with actual production pages. A selection ID records software selection provenance, not an optical frame identity; allow the original state-refresh tick before capture.

PERF measures render-ready/software timings, driver submission and flush-wait, application input callback and UI tick. It does not measure touch-controller sample rate, ISR DMA completion, optical FPS or tear boundaries. Capture/USB consumes resources and must be separated from later performance windows, with a fresh PERF RESET.

### Fonts

Original badge_f16/f20/f24/n40 and OFL are byte-protected.16/20/24 point to matching-size supplements only; no16→20 fallback. Source OTF/license and generation input hashes checked. Known coverage3868 codepoints, not arbitrary future Unicode.

Metrics from generated data:16 line19/baseline4 with extent15 above+4 below;20 line23/baseline5 with18+4;24 line30/baseline7 with21+5. The existing production host harness checks resolution and matching metrics for3868×3×4=46416 unique assertions, repeated in each layout process; do not multiply repeated runs into unique coverage. Physical readability/brightness/colour remains untested.

## Executed evidence

All outputs are exclusively `tests/firmware033-review/**`.

- Recompiled actual `badge_diagnostics.c` through unmodified owner's harness with `clang -Wall -Wextra -Werror`, linking existing host LVGL library:34/34 pass. Compile command/library/binary hashes in `report.json`.
- Reran unmodified frozen owner host UI executable for48 scenarios into reviewer-owned paths: all pass, no missing glyphs, every raw RGB565 SHA equals formal48-case evidence. Includes actual UI routing/input424, guide timer and diagnostic VIEW gates. This reruns owner's harness; it is not an independent reimplementation or full recompile of UI/LVGL.
- Copied exact14-case decoder test to isolated directory;14 pass, including missing/duplicate/reordered chunks, wrong ID/CRC/format, abort/no END and DATA after END.
- Added10 production BSP decision/retry fragment cases;10 pass. This tests control flow under substitutes, not real heap allocation or adapter fault injection.
- Independently checked source freeze, package, app descriptor, assigned config, actual fresh synthetic production diagnostic capture decode and baseline protection.

Reproducible:

```sh
python3 tests/firmware033-review/run_review.py
python3 tests/firmware033-review/test_bsp_decision.py
python3 tests/firmware033-review/check_static_contracts.py
```

See `report.json`, `bsp-report.json`, `static-contracts.json`, compile/run logs, `layout-rerun/**` and `evidence/capture-decoder-tests.json`.

## Root validation boundary

Root can now consider the exact app above for its authorized minimum OTA1 app-only validation after capturing a **fresh** backup that contains the latest phone receipts/ACK state and reconfirming live layout/active slot. Keep rollback material current; an older NVS backup must not silently replace newer receipts.

Still pending on hardware: actual20 versus10 row choice, both actual internal/DMA-capable buffers and heap minimum/fragmentation, USB initialization/output/CRC, reboot invalid clock then real new phone snapshot calibration, existing FIFO durable consumption/ACK, and comparable input/render/wait windows. Optical tearing requires optical evidence. USB opening itself may reset this board; no such action was performed here. If a diagnostic command refuses due to state/memory/timeout, retain the refusal rather than forcing wake/navigation or fabricating data.
