# UI023-P1 — Explicit diagnostic read indirectly writes the scene

Status: confirmed on the frozen 0.2.3 candidate; hold installation pending a coordinated product fix and a new frozen package. No product file was edited.

## Scope and source

Actual frozen `source/web/offline-scene-sync.js` SHA256 `632bf1dab23aa8fc72c39534e2c1722ee176921749753a395d64f1e1ca6f9856`. Other loaded production/fixture source hashes are in `finding-source-hashes.json`.

The reproduction mounts the actual Host with its actual adapter and transport. Native/GATT responses and persistence are the candidate's explicit in-memory fixtures. It does not establish radio, Android, disk durability, or real badge behavior.

## Reproduction and observed effect

Run from the workspace root:

```sh
node tests/ui023-review/probe-mounted-observer.cjs
```

1. Connect and complete the initial scene synchronization; wait another 200 ms.
2. Suppress only the normal 500 ms Host polling interval in the isolated fixture.
3. Change the fixture's original game state `pet.stats.food` to 50 in memory without any DOM change.
4. Click the actual diagnostic refresh button once. Wait for the read to finish and a further 200 ms.

Observed twice: commands after that single click are `state`, then `snapshot` with `seq: 2`; both the fixture journal and Native authority change; main synchronization status becomes `sending`. See `mounted-observer-probe.json`. A pure explicit diagnostic read should leave those mutation commands and records unchanged.

## Causal path

- `offline-scene-sync.js:95–103` correctly leases the shared flight for the read and has no direct pump/halt in its `finally`.
- The production state subscriber's direct scheduling path is also guarded at line 74.
- However, read-related Host rendering assigns `hidden` again on Host controls outside the diagnostics details: legacy panel at line 125, scan at 132, retry at 133 (and other controls at 134).
- The actual MutationObserver records identify `offline-legacy-panel`, `offline-v2-scan`, and `offline-v2-retry`, all `hidden` attributes.
- Line 173 ignores only records wholly inside `#offline-device-diagnostics`; the Host control records therefore schedule a frame callback.
- That callback reaches `signal()` at line 30 after the diagnostic lease is released. It starts a normal scene pump and persists/sends the changed scene even though no normal poll or game DOM mutation occurred.

This is a UI023 integration regression in the promised read-only diagnostic boundary. The original eight game modules, Native Java, adapter, and transport are byte protected; that protection does not prevent this new caller path from invoking their existing mutations.

## Required fix / regression acceptance

Root should coordinate a product fix that prevents diagnostic-driven Host/status rendering from signaling a scene write, including callbacks delivered after the read lease is released. Preserve legitimate game scene synchronization. Idempotent Host attribute updates or filtering only Host-owned status/control mutations are possible parts of the solution; suppressing all game changes is not an adequate fix.

Add an actual mounted Host test using the above setup (not only a coordinator stub). Across successful and failed diagnostic reads, require: only the `state` request, no new scene/retry command, unchanged journal and Native authority after queued observer/frame callbacks drain. Retain the existing BUSY, stale-generation, authorization, explicit retry, and real scene-change coverage.

Existing 23 targeted tests pass, so they do not detect this path. Their passing result is not evidence that this finding is resolved.
