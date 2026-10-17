# UI024 independent delta review

## Decision

**The exact UI024 candidate may proceed to the sole integrator's serial, data-preserving installation and actual diagnostic/local-export acceptance. No confirmed P1/P2 blocker remains in this reviewed delta.** The original UI023 mounted-observer P1 is closed for the tested production JS/Host software scope on UI024; UI023 stays blocked and its original failure evidence is preserved. No Android, radio, actual system document selector, physical file durability or 024 device acceptance is implied by this release.

No candidate/runtime files were changed. No network, install, ADB, serial or device operation occurred. All new reviewer files are under `tests/ui024-review/`.

## Frozen identity and boundaries

- APK 633008 bytes, SHA256 `0eb37ca588fefe4858a017400f5cf4e6af46178596d9082956ad00a7bba72022`; package `com.catforest.htmlcandidate`, version `0.2.4-html-local`, code 15.
- Source ZIP 153 entries / 1229601 bytes, SHA256 `0a5cc060618e206405965b52e98fcd571076e2870dc13004c9b0347a50f987e3`. All source entries read back exactly and all source-hash inventory entries verify.
- APK signature independently verified, same certificate SHA256 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`; alignment/package metadata pass. All 34 packaged assets match their frozen source.
- 36 protected files compare byte equal to 023: all other prior web runtime including CSS, Host, adapter, transport, store and original rules integration; all four Java files; all eight original game modules; original HTML and Android manifest. All 151 prior 023 sources plus its original APK/ZIP remain hash exact. All 153 current sources remain hash exact after execution.
- Runtime delta is exactly two JS files plus their derived asset copies. Index/load order, Native bridge/permissions, BLE ABI, journal, durable storage, game rules, sleep behavior and prior 019/021/022 UI remain protected. Version/build/test/document changes are separately inventoried in the frozen delta.

## P1 cause and fix reviewed

Production coordinator `offline-scene-sync.js` SHA256 `4868902efa98566fcf0d18cebedc64735824999b079f90c4520916fa788cdb80` changes only the observer presentation-origin filter. It now ignores batches wholly inside `#offline-device`, plus BODY `class` presentation changes. This is an ownership/subtree filter, not a list of three old control IDs. BODY `data-view`, genuine game DOM and any mixed batch containing those records still signal the existing pump; the ordinary 500 ms polling remains.

Production diagnostic view SHA256 `8fa35d180d0cceb391956fb2af9cdbc391137dcbc945168d63bb11e477ffa704` changes only the browser fallback download anchor parent from BODY to its diagnostic details. The local download no longer creates body child-list records. Native save interface, whitelist, generation/identity/foreground gates, shared flight, read source and stale/export wording remain unchanged.

### Independent original negative/positive comparison

`compare-original-probe.cjs` reuses this reviewer's original UI023 probe, parameterizing only the candidate and output filename and adding result assertions. It loads actual production Host/coordinator/adapter/transport with the unchanged explicit memory Native/GATT authority fixture. It suppresses only normal 500 ms sampling, completes initial sync, waits, changes food to 50 in fixture memory without a game DOM mutation, clicks the real diagnostic refresh button, and drains async/observer callbacks.

| Exact source | Commands after one refresh | Journal / Native authority | Main status |
|---|---|---|---|
| Frozen 023 negative control | `state`, `snapshot(seq2)` | both changed | `sending` |
| Frozen 024 | `state` only | both unchanged | `synced` |

Both were actually run again into this review directory. The old failure JSON/report was not overwritten.

## Directed software execution

Commands, workspace root:

```sh
python3 tests/ui024-review/verify_readonly.py
node tests/ui024-review/compare-original-probe.cjs ui023
node tests/ui024-review/compare-original-probe.cjs ui024
node --test --test-concurrency=1 artifacts/html-offline-candidate/ui024/source/tests/device-diagnostics.test.cjs artifacts/html-offline-candidate/ui024/source/tests/diagnostics-view.test.cjs artifacts/html-offline-candidate/ui024/source/tests/v2-host-integration.test.cjs tests/ui024-review/mounted-isolated.test.cjs
```

The isolated mounted test copy changes only its fixture import/output location so no frozen evidence is rewritten. The 29 actual tests pass with zero skipped; all JSON outputs are retained under `mounted-rerun/`. These are reruns of existing targeted tests, plus this reviewer's separate original-probe comparison, not a claim to have independently authored every test.

| Tested boundary | Actual offline result |
|---|---|
| Three diagnostic refreshes, only in-memory food change, arbitrary future device presentation node + Host presentation class | Exactly three `state`; zero snapshot/events/ACK; unchanged journal, Native authority, full main status |
| Native export and browser Blob export | Two local fixture requests; browser anchor inside device subtree; no additional command/persistence/status change |
| Consumer interval elapsed >1.7 s, real original event consumer enabled | Diagnostic remains state-only; no events/ACK/scene command; persistence/status unchanged |
| Genuine game DOM mixed with device render | Original scene command still dispatched with food50; event-enabled path still dispatches original `events` then `snapshot` |
| Real scene or event mutation lease in flight | Read BUSY, no extra wire/journal/authority change; manual retry wording |
| Three correlated failed state responses and repeated render | Only three `state`; no pump or halt side effect; journal/authority/main status unchanged; cache expired |
| Mounted suspend/resume and disconnect | No command or persistence/status side effect from repeated read/export/render; cache stays expired; refresh disabled |
| Foreground/generation/device change or late response, optional/missing/0/false/null fields, wrong identity/op/write completion | Existing production reader/coordinator/transport checks pass; no stale observation is accepted |

Production and Native fixture boundaries are explicit: GATT fragmentation/response and Native authority are in memory; the tests do not contact a badge or prove fsync. The mounted regression checks zero unintended commands as well as journal/authority/main status, avoiding a false pass obtained merely by hiding a status label.

## Other evidence and remaining device gate

Owner full suite 271/271 is read back and source-associated, not independently rerun in full. The targeted 29 above were rerun. Owner WebKit diagnostic 9 profiles / 237 checks have matching current JS/CSS hashes; inherited page 36 profiles / 1284 checks likewise associate. These software-layout results are not Android visual/system-font acceptance. Offline build/lint evidence retains the distinction between successful standalone lint and incomplete standard Gradle lint due missing offline compiler artifact.

Only the sole integrator should now perform `DEVICE-ACCEPTANCE.md`: compare current stored data and installed APK, explicitly connect/read actual CFLOCAL2, verify returned whitelist and unavailable BLE clock fields, test BUSY/manual refresh and stale behavior, then invoke local JSON save. Unchanged Native onPause disconnects when the system selector takes foreground; returning must leave cached data expired without reconnect. UI must say a save was requested until the real selector action is known, and no upload is authorized.

The normal 500 ms business poll still runs on device. Any legitimate scene/event changes during actual acceptance must be attributed to that business path rather than requiring fictitious total storage immobility. No diagnostic read or export may create extra retries, ACKs or rewards. 033/034 USB clock and device-maintenance evidence remain separate from this BLE view.
