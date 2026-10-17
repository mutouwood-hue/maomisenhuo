# UI024 actual-device evidence: independent read-only review

## Limited conclusion

**Actual UI024 installation preservation, one explicit CFLOCAL2 read, one local system-document save/readback, stale return state, and the supplied normal/360/390 layouts are supported by the recorded evidence. No new P1/P2 blocker was confirmed in this scope.** This reviewer read Root's artifacts, inspected original screenshots and XML, and ran offline evidence checks; Root performed the device actions. This reviewer performed no device, ADB, serial, install or network action and did not change the candidate or Root's evidence.

Root directory: `artifacts/device-integration/2026-10-16-ui024/`. Reproducible offline checks: `python3 tests/ui024-review/check_actual_evidence.py`; detailed hashes/summary: `actual-evidence.json`.

## Installation and preservation

- Actual install log records data-preserving `-r -t`, success, no clear or permission grant. Installed APK readback is the released SHA256 `0eb37ca588fefe4858a017400f5cf4e6af46178596d9082956ad00a7bba72022`.
- Independently read both backup tar streams without extracting user files: **12 mapped files** are byte equal before install and after install/before launch. This count is for UI024, not UI022's earlier 13.
- Four captured Native authorities have valid recorded body hashes. Cold-start revision63 → final revision65 changes **only the command journal entry**. Durable game, social, identity and event ledger entries remain byte equal across those captured endpoints. All 9 ledger records and 9 existing social receipts are preserved. Ledger states are **8 applied + 1 quarantined, unchanged**; this is not a claim that all nine rewards were applied.
- Captured durable game stays at 24 coins / XP67 and unchanged action counts. There is no newly recorded award or re-settlement in this captured interval. The live WebView may naturally decay stats independently of its last durable checkpoint; this report does not assert all live state or all storage is invariant at every time.
- Explicit-refresh before/after/final captured Native bodies match exactly at revision65. Their body SHA is `f899da83012264636536c1ed04399af8bd745ec21dcb6e17153076e83898e4c2`; the enclosing evidence-wrapper JSON files have a separate equal SHA `fc1a545ddc3175a1e675e2ff292162eaf86104db6068d299fceaad5e4537d499`. The latter is the comparison log's reported value. This is one sampled real refresh window with the ordinary 500 ms business poll active, not universal no-mutation proof. The causal isolated P1 closure remains the separate mounted software regression in `REVIEW.md`.

## Real read and save

- Root's scan/selection and connected screenshots/XML precede the explicit refresh. The read is recorded at phone UTC `2026-10-16T02:26:24.969Z`, generation2. Actual exported whitelist: lastSeq28, lastAck9, pending0, storageErrorfalse, snapshot revision19, `home/idle/clear`. It matches the later direct USB STATE summary on the same badge.
- HELLO capabilities remain labeled declared capabilities, not full acceptance. Timestamp says phone UTC. BLE clock is explicitly `not_provided_by_ble`; the real USB clock proof is separate and is not projected into this view.
- `native-save-picker.png` visibly shows the Android system document selector, local Downloads destination and Save button. The action log records Save. `actual-local-export.json` is **1464 bytes**, independently hashed to `d28da912d64cd85afc6abba69aa10861a6443deb4d23efd35c16da9c9b174665`, matching the saved-file readback metadata. Schema, generation, exact whitelist and unavailable-clock marker independently validate. No JSON/log/save upload was performed by this reviewer; Root states the file stayed local.
- The export's `same_connection_observation` describes export-start, before the system selector pauses the app. `returned-from-save-stale.png/XML` show no verified connection, old read explicitly expired, refresh disabled, historical export available, and wording that a local save location was requested. No automatic reconnect is shown. Actual successful readback establishes this one save; it does not make the earlier snapshot live after return or prove power-loss durability.

## Actual layout inspected

Original PNGs were visually inspected with corresponding XML: `details-first-read`, `native-save-picker`, `returned-from-save-stale`, `normal-details-fields`, `normal-details-actual-end`, `short-details-state`, `short-details-end`, `mid-details-state`, `mid-details-end`.

- Normal physical 1200×2670/density520: phone UTC, generation, expired validity, HELLO/state separation, long identifiers, summary and final BLE-clock-unavailable text are readable through scrolling. The true end is **normal-details-actual-end**; the earlier `normal-details-end` is not used as proof of the last footer.
- WM-equivalent 360×640 (1080×1920/density480) and 390×844 (1170×2532/density480): the cached, expired actual response remains legible, long IDs do not disappear off the side, and the clock limitation and final device-data footer are fully visible in the supplied end frames. Fixed close control is visually reachable; Root actually tapped it after restoration on the normal size. This is not evidence that every close/control was tapped in all layouts.
- Root's post-readback confirms physical size/density reset, Quickstep Home and disconnected BLE. It does not establish all OS font settings; system1.6 text remains untested.

## Existing scene-mapping gap retained

Cold-start XML contains the original “小橘出门啦 / 叫它回家 / 看看它” overlay, while the device's response says `home/idle/clear`. `offline-scene-map.js` is byte identical through UI022/023/024 and projects `__petGame.state().life.view/world.phase` and `room.currentAction`, not overlay text. The diagnostic faithfully displays the returned state and introduces no new scene mapping. There is no contemporaneous full original life-state dump or newly exercised outing/return transition to determine the cause. **This round does not pass outing/return linkage**, nor does the overlay alone confirm a new UI024 mapping defect.

## Remaining limits

No actual forced BUSY/read-failure, new event/award, bilateral friend/gift, cold power-loss, system-font1.6, all-game or continuous radio-trace test is established here. Those scopes remain distinct from the actual successful read/export and the software 29/29 regressions. The old 9-record status and ACK watermark do not by themselves establish nine successful rewards.
