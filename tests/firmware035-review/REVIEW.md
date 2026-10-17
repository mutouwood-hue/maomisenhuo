# Firmware035 independent frozen delta review

## Decision

**Release the exact frozen035 app for Root's controlled, app-only device validation**, after Root's current partition/slot and fresh-data/protected-region gates. No newly confirmed P1/P2 blocker was found in these two rendering guards. This is not final graphics acceptance: **a known8-pixel continuous-PARTIAL cosmetic residual remains**, and physical sliding/tear-free operation is unproved.

This release is solely035's presentation delta. It does not release or fix phone025's separately discovered care/cooldown issue, approve026, prove real feeding/reward completion, or reuse historical clocktrue after a reset. No source/device/Git change or deletion/cleanup was performed by this reviewer. Initial available space was3.7GiB; reviewer output is approximately30MB, retaining binaries/logs and selected raw frames rather than115×2 raw-frame copies. No frozen evidence was overwritten.

## Exact frozen identity

- App6396432B SHA256 `b5f06e3140b13162fa0baa4bed68bc5cf1ae4312b8fcced644ce44d8c2b9918f`.
- ELF SHA256 `bdec36570128e679ef5c204e4b32964e5c28a3e17b58c93b95a66665b14620b4`.
- Source ZIP2660465B SHA256 `3b4968665cce22ad8813385b297045052e6008ddbf9f917dc098aa727320bddf`; **118 total entries =103 source+15 support/test files**. All entries read back exact, including the four separately rooted worker-test support files.
- FROZEN/manifest/source inventory/test-evidence hashes verify; all103 current and prior034 source entries plus prior034 App/ELF/ZIP are reverified. Source remains stable after host execution.
- Image descriptor0.3.5-local3/secureVersion0 fits the unchanged8MiB slot. No new cryptographic-signature claim or security setting change is made.

## Runtime and protection review

Exactly four source paths differ from034: two runtime C files, CMake version, host-preview fixture. All other source files, including **49 main files**, remain byte exact. Public headers/ABI, domain/core/store/peer/BLE/wire/partition, font/image assets, diagnostics/CAPTURE/parser and safety gates are unchanged. BSP remains fixed10, internal double9320B/40MHz with unchanged integrity guard/config/locked dependencies; compiled partition table is byte equal.

1. **Scene context** (`badge_scene.c`): private `context_initialized` starts false from calloc. First call always applies, even all-zero unknown context. Early return requires equality of **known/live/stage/weather/action**. The existing animation-reset predicate remains unchanged, so weather-only changes still update visual weather without introducing a new clip-reset rule. No additional sprite cache, allocation, asset conversion or playback timing change was added.
2. **Label** (`badge_pages.c:set_label`): only lv_label_set_text is conditional on string content. Layout and cy-based recentering always execute, including same text after font/geometry change. All current static helper calls supply text; the build retains LVGL malloc assertions. No font, timer, hitbox, feedback, guide, gesture or ownership rule was changed.
3. **Host fixture**: new optional PARTIAL10 double buffers/native rounder/counters and compile-time production-pages selection permit the baseline/candidate comparison. Normal FULL layout path remains. Synthetic input/flush memcpy/domain substitutes are explicitly not device DMA or physical touch.

The source guards implement the baseline review's first-call/weather/label-geometry requirements. They remove redundant setters, not logical/domain operations. Existing capture budget and data locks are unchanged; none of this authorizes a synthetic feed event.

## Independently executed evidence

Command from workspace root:

```sh
python3 tests/firmware035-review/run_frozen_review.py
```

This script contains no Git, filesystem deletion or cleanup calls. It does not invoke worker scripts that remove raw directories. It independently compiles **actual034 and actual035 pages/scene** against hash-verified read-only034 LVGL/font/asset objects into this review directory. The copied benchmark changes only raw-output volume (retains4 selected frames per continuous variant); all sample computation, real production timer/scene/drag/release/ease-out paths and assertions remain. Host benchmark compilation uses `-Wall -Wextra`; separate production diagnostic compilation uses `-Wall -Wextra -Werror`.

| Actual offline result | Independent outcome |
|---|---|
| Same PARTIAL renderer forced-whole-tree oracle | **115/115 unique tags pixel exact** between034/035;128 harness checks each |
| Continuous chain, no forced redraw/snapshot between samples | **113/115 unique tags exact**;12 harness checks each; two residual tags below |
| Same-context64 polls (baseline negative) | Original0343008flush /13897984pixels =64 full screens |
| Same-context64 polls (035) |192flush /386304pixels, approximately97.22% fewer submitted pixels in this fixture |
| Actual synthetic horizontal commit/release/ease-out |0343196508pixels →0353087072pixels: only approximately3.42% reduction |
| Actual synthetic rebound | Both1715072pixels, no benefit |
| First context/weather-only, same text changed font/cy, clip/frame, AOD/wake samples | Existing benchmark assertions/oracle pass on the actual production sources |
| Actual unchanged production diagnostics C with explicit platform substitutes | Independently compiled with Clang-Werror and34/34 checks pass |

Owner four-way ablation,48 FULL layouts/46416 glyph assertions,55 immutability/buffer checks and14 decoder cases are hash-associated existing evidence, not all independently rerun. Own two-variant reproduction confirms the essential negative/positive behavior and residual; owner extra fixtures are not relabeled real hardware. Host wall times are Mac software values, not comparable ESP render durations, FPS or a proof sliding became faster.

See `frozen-review.json`, compile/run logs, `bench-isolated.c` and retained raw frames. Read-only objects and all compile commands/hashes are recorded.

## Independent judgement of the8-pixel residual

Both `toast-font` and `toast-gone` reproduce the **same8 positions** atx227..238,y144. Baseline continuous value49834 vs03564333 corresponds to RGB565(24,21,10) vs(31,26,13), maximum channel delta **7/5/3**. It is not1LSB and is not silently tolerated as exact.

The same partial-vs-full values already occur in034's return-home/rebound frames. In035, suppressing redundant full invalidation leaves that edge difference visible in two later sampled states where034's repeated full redraw clears it. Full-raster oracles match; continuous partial outputs therefore do not.

The entire candidate toast-gone frame and a6× crop were generated from retained raw output and visually inspected: `candidate-toast-gone.png`, `residual-crop-6x.png` (left034, middle035, right absolute RGB difference×10). The coordinates lie inside the small **home_alert paw warning icon/antialiased edge**, not diagnostic text, an altered cat asset, missing label or changed alert meaning. No changed input target, false ACK/success or domain result is established.

**Judgement:** this is a real, disclosed cosmetic raster limitation, acceptable for the next controlled load/heap experiment; it is not a confirmed P1/P2 blocker for that limited experiment. It remains an unresolved visual-quality item and prevents a claim of pixel-perfect continuous rendering. Physical visibility and persistence must be assessed honestly later. An object-tree CAPTURE alone cannot validate away a PARTIAL framebuffer residual because it recomposes the scene through a different path; do not claim optical clearance from CRC-valid composition.

## Root's controlled device gate

Use the current actual slot/address and fresh NVS/otadata/prefix/protected-region evidence; do not mechanically reuse a historical address or overwrite current025/026-era receipts with earlier backups. Retain034 rollback evidence. Reviewers performed no flash/selector/device operation here.

In the authorized sole-integrator window: verify035 boot/image, both9320B DMA buffers and heap/free/largest/min, then compare same-context/mode/face/clock/connection counters within a valid fresh same-epoch window. Keep CAPTURE/VIEW/RESET/boot transitions out of timing. Record raw errors and leftovers; render overlaps flush/wait and is not pure CPU/optical FPS. Do not change buffers/guard/TE to force a result.

Any later real feeding acceptance needs the actual local third-food touch and original event semantics. Phone snapshots or USBVIEW cannot replace it; this035 review does not pass that action, a new reward or the separate phone cooldown issue. Keep fresh calibration/STATE/receipt observations separate and do not infer direct clock validity from the BLE view.

**Remaining:**8-pixel residual, real optical sliding/tearing, device load/heap gain, fresh clock accuracy, new physical care/receipt loop, power-loss durability and whole-PRD acceptance. No general performance or visual-completeness release is issued.
