# 035 review preparation: frozen034 baseline

## Scope

Read-only review of frozen034 and the local dependency sources it uses. **No035 source has been reviewed, changed, built or released here.** No device/USB/serial/ADB action or new hardware measurement occurred. Source/sample hashes and independently derived baseline values are in `baseline-evidence.json`. All103 frozen034 sources still match their inventory. Await formal035 hashes before review.

## 1. What the034 counters actually measure

`source/main/badge_diagnostics.c:45–56` measures LVGL events using esp_timer. Each metric tuple is `[count,total_us,max_us]`:

| Field | Exact local boundary / meaning | Must not infer |
|---|---|---|
| refreshRequests | LV_EVENT_REFR_START events | Unique changed frames or physical display FPS |
| rendered / renderFrameId | RENDER_READY count; frame ID persists across PERF RESET | Completed optical frame or DMA completion of final new chunk |
| render | RENDER_START → RENDER_READY | Pure CPU drawing, or a separate disjoint stage to add to flush metrics |
| flushCount / pixelsSubmitted | Every FLUSH_START and sum of its rectangular area | Unique changed pixels; overlapping/repeated submissions are counted again |
| flushSubmit | FLUSH_START → FLUSH_FINISH, around the adapter flush callback | Physical transmission/scanout completion; it can include callback/queue blocking |
| flushWait | FLUSH_WAIT_START → FINISH around LVGL wait_for_flushing | All SPI/DMA time; driver submission/ISR completion or pipeline overlap is not fully isolated |
| inputRead | Wrapper time around the original indev read callback | Touch-to-gesture/reward latency or full adapter-handler time |
| inputInterval | Start-to-start spacing of original indev callback samples | Uniform physical touch sampling or finger latency |
| appUiTick | badge_pages.c:1220 start → diagnostic call1267 | Full LVGL task/paint/flush duration or physical responsiveness |

Critical local dependency references:

- `lv_refr.c:759–833`: RENDER_START encloses all invalid areas, their partial `refr_area()` and `draw_buf_flush()` calls; RENDER_READY follows that loop.
- `lv_refr.c:1390–1392`: double-buffer flushing calls `wait_for_flushing()` before submitting the next chunk. `1431–1439` brackets the callback with FLUSH_START/FINISH. `1444–1462` brackets the LVGL wait.
- Consequently **render contains submission and some wait spans**. These nested totals must not be summed. The final newly submitted chunk can remain in flight after RENDER_READY; subsequent work may absorb its wait. This is not an optical completion signal.
- Actual BSP uses TE_AVOID_NONE (`...1_75c.c:523`), selecting the adapter's default flush branch (`lvgl_bridge_v9.c:1451–1452`), which calls panel draw at2312 and relies on completion routing. TE-SYNC's explicit transmission wait at2370 is a different branch and must not be attributed to this baseline.
- PERF takes the LVGL lock, formats its current sample and then optionally resets (`badge_diagnostics.c:90–99`); source is not logged from event callbacks. `sinceUs` must match across a derived interval. `frame_id` is not reset with the stats. A cumulative maximum cannot be subtracted to obtain the interval maximum.
- Capture suppresses metrics while diagnostic_capture is true; capture/VIEW/reset boundaries must stay outside a claimed steady comparison. It also changes heap/timing. Current boot/old reset markers invalidate cross-session comparisons.

## 2. Existing real034 interval rederived

Same `sinceUs` at safe10 command10→13; elapsed **389.861443s**. Independent differences:

- rendered1559 and refreshRequests1559;
- pixelsSubmitted338546204 = **1559 ×466×466** exactly;
- flushCount73273 = **1559 ×47** exactly (10-row partial buffers at466px);
- pressedPolls delta0;
- render delta mean68203.246µs per LVGL refresh;
- flush callback mean325.211µs per chunk, LVGL wait mean11.539µs per chunk, appUiTick mean20539.818µs per app callback.

This establishes a sustained software refresh/submission pattern: aggregate equivalent to a full screen per refresh at about4 refreshes/s. It does **not** establish optical4FPS, pure CPU cost, real sliding, one sole bottleneck, or proof every pixel changed. Do not compare that mean to a new session without matching page/context/mode/window and preserving reset/capture boundaries.

## 3. Confirmed redundant-setting paths

### Whole-scene background

- `badge_pages.c:1266` refreshes state at250ms or dirty; `1206` calls `badge_scene_set_context` regardless of context equality.
- `badge_scene.c:175–176` unconditionally sets background on its466×466 scene root, even for the same context/color. The background also remains source-correct for unknown/home/departing/away/returning.
- Current LVGL `lv_obj_set_local_style_prop` (`lv_obj_style.c:353–378`) has no same-value early return. It calls refresh_style, which invalidates the object at250/279. Thus repeated same-value scene-root style assignment is a concrete full-area invalidation source when visible. Its250ms cadence is consistent with the aggregate pattern above. Aggregates alone do not prove it is the only source.

### Labels and local styles

- `badge_pages.c:485–487` calls lv_label_set_text, layout and y-position unconditionally; refresh_state invokes many labels at250ms and update_clock repeats a font setter at1144.
- `lv_label.c:981–1020` has no content-equality shortcut: a different string pointer frees/reallocates text and marks text refresh. The eventual label refresh invalidates at1354. Hidden objects may avoid visible invalidation, so not every repeated label explains a full screen.
- A safe local guard may skip equal text assignment, **but cannot skip layout/recentering merely because text is equal**: face/clock font, cy, width or object layout can change with unchanged text. Same text at A face vs B/C has different placement/font. Keep geometry correct, including longer→shorter text and multiline labels.

### Scene image/frame work

- `set_frame` (`badge_scene.c:50–84`) may resample palette indices into its reused small descriptor, drops the LVGL image cache before mutation, applies image/src and foot placement. `set_context` must not reset/restart a clip for unchanged logical state; existing changes do reset deliberately at188.
- A cache must distinguish source image/frame and reduced/full geometry (face/compact changes), preserve palette/alpha, descriptor/data lifetime and cache-drop before changing reused pixels. Numeric frame alone is insufficient: clip/face can change while frame stays0. Allocation failure must leave the cache retryable and preserve the existing fallback safely.
- Weather is absent from034's `changed` animation-reset predicate, **but is still applied on every call** at177–182. A new whole-context early return that omits weather would hide clear↔rain↔snow changes. Include weather/known/live/stage/action and an initial-application sentinel as needed; do not conflate “same animation clip” with “same scene visuals”.

## 4. Minimum guardrails for035

Changes should remain bounded local presentation deduplication/caching. Keep exact original assets/frames, timing, page routing, geometry/hitboxes, modal ownership, guide progress/skip, clock/empty states, AOD freeze/wake semantics, true ACK/event feedback and source provenance. Preserve unchanged fixed10 internal double buffers,40MHz, diagnostics counter meaning/locks/parser/CAPTURE64KiB guard and layers, core/store/BLE/wire/partition/security/credentials. No global LVGL setter patch, new TE/buffer tuning or domain behavior is justified by this evidence.

A skipped redundant setter must not skip a logical state update or a real changed visual. Preserve first-frame and queued ATTENTION/ACK reactions, clip start/expiry, hidden→shown context, AOD freeze and wake restart, stale vs live weather/ground behavior, mode/face geometry, and actual save/error feedback. No synthetic new input or event may be introduced to demonstrate a rendering gain.

## 5. Required positive/negative controls after freeze

| Control | Required assertion |
|---|---|
| **Baseline negative: unchanged visible full-scene context** | Actual034 LVGL path demonstrates redundant invalidation; same035 settled/frozen/time-fixed path has fewer invalidations/flush pixels. “Nothing drawn” alone is not a pass. |
| **Real changed root background** | Known/home/departing/away/returning changes still redraw correct full old/new regions and have identical final pixels to034. Real changes cannot be suppressed to win counters. |
| Equal text but cy/font/width changes | Same label text on face switch/clock calibration is correctly positioned and sized; compare full bounds and PNG, not only text. |
| Different text, zero/empty/long/multiline, return to old text | New text actually appears, old pixels cleared, no persistent stale glyphs; toast/guide/footer remain readable and R212 geometry unchanged. |
| Initial unknown context and unknown↔known/live↔stale | First application occurs; retained “last confirmed”/empty states match034; no fake fresh/clock/schedule/heart data. |
| Clear→rain→snow→clear with same action/stage | Weather appearance and cleanup still work; stale known weather retains original static behavior; real live weather still moves. |
| Same numeric frame across different clip / face / compact | Correct source, palette/alpha, dimensions and foot anchor; no stale cached scaled frame. Full↔small transitions work both directions. |
| Mutable small image descriptor changes frames | LVGL cache coherency preserved, frame content changes on schedule; no dropped first/last/queued reaction or incorrect source lifetime. |
| Cache allocation failure/recovery | No crash/overflow/stale-valid marker; original fallback remains meaningful; later genuine apply can recover. No per-tick allocation growth. |
| AOD/OFF and wake | Same original timing/freeze semantics; wake redraws valid context, no accidental replay/new care. |
| Modal gift arrives during drag/settling/hold | Existing release lock/cancel behavior survives; no PET/care leakage or false success. |
| Actual guide/page/gesture and error states | Existing layout/input/diagnostic/48-scene evidence rerun on exact035 sources; protected file hashes checked, no weakening tests to claim gain. |
| **Domain negative control** | Repeated context/setter/frame/cache calls cause zero l2_emit_care, receipts, NVS/store revision or BLE protocol writes. |
| No-reset device comparison if later authorized | Fresh same-session baseline/delta with command list, mode/context, same buffers and no capture/reset contamination; skip rather than merge intervals across boot markers. Preserve raw errors and worst values. |

Actual feeding remains a separate input/domain acceptance: the original local third food touch must occur before emit. Phone snapshot or USBVIEW cannot stand in for it. No new feeding result has been inspected in this baseline review.

## Current disposition

034 baseline interpretation and optimization guardrails are ready. **No035 approval is issued until its formal freeze, minimal delta and targeted controls are independently reviewed.** No new hardware performance claim is made here.
