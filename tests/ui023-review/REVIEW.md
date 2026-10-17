# UI023 independent delta review

## Decision

**Do not release the current frozen UI023 APK for installation.** One confirmed P1 remains: an explicit read-only diagnostic refresh can indirectly trigger a scene snapshot and journal/authority updates through Host rendering and its body MutationObserver. See [FINDING-P1-OBSERVER.md](FINDING-P1-OBSERVER.md) and [mounted-observer-probe.json](mounted-observer-probe.json). Root was notified immediately; this review changes no runtime or candidate files.

## Package and protected boundaries — independently verified

- APK 639010 bytes, SHA256 `80ae0cce5d021555efccc80aaa0fac6f8b3e7854b592fc9a9fd8dd42c2d3ba00`, version 0.2.3 / code 14.
- Source ZIP 1225088 bytes, SHA256 `e40d0118774508e47d67900937bb2e764107826974e6d4847a2c0f10bed419ba`; all 151 entries exactly match their frozen source files.
- APK signature verified: certificate SHA256 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`; alignment and package metadata verified offline.
- All 34 packaged web assets match frozen source. All 35 protected files compare byte equal to UI022: original eight game scripts, four Java files, other prior web files including adapter/transport/store, original HTML, and Android manifest. The index changes only the diagnostics module load. Source hashes remain stable at read end.
- The runtime delta is diagnostics view JS, Host coordination JS, and scoped diagnostic CSS; details are in [readonly-report.json](readonly-report.json).

## Reviewed behavior

The diagnostic projection accepts only actual readState/HELLO whitelist fields and rejects invalid or mismatched identities. Missing clock data is explicitly unavailable. No inference of rewards, encounter, ledger completeness, or actual clock synchronization is made from ACK watermarks.

Foreground, explicit verified connection, mode, generation and identity gate reads; in-flight mutation returns BUSY for manual retry. Old observations become stale/expired across connection or foreground transitions. The direct shared-flight read path does not pump/halt in its finally. **The indirect mounted DOM path has the P1 above.**

Export is local JSON through the unchanged Native document selector (or local Blob path), with requested-save wording and no network/upload. The unchanged Native onPause disconnect invalidates the connection when the system selector takes foreground; the exported observation must not be presented as live after that transition. No actual Android selector, file write, permission flow, or filesystem durability was exercised by this review.

## Evidence and limits

- Independent offline package/source verification: no errors; see `readonly-report.json`, `signature.log`, `alignment.log`, `badging.log`.
- Reran the candidate's actual three diagnostic/mounted Host test files: **23/23 pass, 0 skipped**, `targeted-node.tap`. These are software fixtures and miss the newly reproduced observer path.
- Independent mounted observer reproduction fails the required read-only invariant; reproducible script, JSON and loaded-source hashes are retained here.
- Read and hash-associated owner evidence: 265/265 complete Node suite; diagnostic CSS 9 profiles / 237 checks; prior page CSS 36 profiles / 1284 checks. The owner WebKit layout evidence is software layout, not Android visual acceptance. It was not rerendered or relabeled as independent device testing.
- No device, ADB, serial, install, network, or production edits occurred. No existing UI021/UI022 actual-device scope or 033 firmware status is inferred from this work.

## Next integration gate

Fix the confirmed observer path, freeze a new hash/package, and rerun this mounted regression plus the existing focused tests. Only then reconsider a sole-integrator, data-preserving update followed by the requested actual diagnostic/save-selector acceptance. The current APK is held.
