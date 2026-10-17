# UI021 independent delta review

## Decision

**PASS for the sole device owner to perform the already authorized, data-preserving UI021 upgrade and incremental device acceptance. No new confirmed P1/P2 in the reviewed delta. This is not a UI021 device/3D/FPS acceptance result.**

Frozen candidate: `artifacts/html-offline-candidate/ui021`. Review performed read-only against that candidate; all review outputs are under `tests/ui021-review/`. No candidate edits, build, networking, install, device, ADB or serial actions.

## Package and scope verification

| Item | Independently verified result |
| --- | --- |
| APK | 623895 bytes, SHA256 `5e18946f19a8c44d76db60757dcfe099766cd1ede04c7986603fb34903286697` |
| Package | `com.catforest.htmlcandidate`, code12, `0.2.1-html-local` (`aapt2 dump badging`) |
| Signature | `apksigner verify` succeeds; SHA256 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82` |
| Alignment | `zipalign -c -v 4` succeeds |
| Source ZIP | 1186945 bytes, 135 files; SHA256 `569e72694a142c03abade6c97b2d85a7571c6564abf722f99a015fc10b5a23b9`; every entry matches frozen source hash |
| APK assets | All 31 entries match frozen source bytes |
| Runtime delta | Only `web/offline-page-icons.js` and `web/offline-page-polish.css`, plus their generated asset copies |
| Protection | All other prior web files, 8 game scripts, 4 Java sources, original HTML and Android manifest match020; 33 explicitly protected paths independently compared. Thus Host/store/adapter/019 meet key/bed behavior remain unchanged |
| Inventory | All135 declared source hashes,17 changed/added delta entries and manifest/FROZEN agreement checked; source stable after tests. Prior019/020 APK/ZIP hashes remain unchanged |

Detailed command outputs: `signature.log`, `alignment.log`, `badging.log`, `readonly-report.json`, `evidence-readback.json`.

## Delta review

### Bath instruction and selected Host notice

The021 mobile CSS puts the entire `#pg-think` flow at top inset+112px; `.pg-bub` becomes relative and `.pg-tip` becomes static, separated by8px. It restores the original dark tip backing and removes the020 bottom96px collision. Host notice slot CSS is unchanged. The original game06 `updThink`, `pg-tip2` eligibility,4500ms lifetime, view listener and rest listener remain byte-identical020. The decorator introduces no timer, tutorial key, rules/reward or storage writes. No z-index concealment workaround was added.

Owner WebKit evidence was **read and independently cross-checked**, not rerun:18 profiles/330 checks, including12 fixed configurations and6 old020 negatives. All CSS/module/game/excerpt hashes match the actual frozen files. Fixed reported tip/notice rectangles are disjoint and the tip follows actual measured bubble bottom by at least7.9px. The old CSS reproduces intersection in all6 negatives. Fixtures execute the original `updThink`/button binding, but camera/projection/cancel endpoints, time, insets and text scale are explicit software models. These results cannot close the actual020 finding for an installed021 APK.

### Original periodic world refresh

The original game03 `Mf.N` still replaces button `textContent` on its existing `>250ms` cadence.021 marks roam/return/rod buttons once, retains encoded SVG images as CSS custom properties and renders empty decorative `::before` content. The `.world-roam[aria-pressed=true]` selector chooses recall immediately; neither text replacement nor observer scheduling is needed to restore an icon.

Independent Node fixture executed the **exact original N function100 times**, alternating roam state, and verified all3 persistent button classes/image properties survived without observer repair, no child icon was reinserted, and label/aria-pressed matched state. This establishes DOM persistence, not rendered frame smoothness or live recall correctness.

Owner WebKit evidence:4 profiles/124 checks, actual source hashes and24 refresh rows/profile read back. Both021 profiles retain pseudo-image and exact width immediately after each refresh; both020 negative profiles lose the icon and shrink before observer repair on every refresh. Explicit rAF queue and placeholder world values remain software limitations.

### Semantic icons and event options

Unknown `data-we`, `data-h`, `data-htab` and `data-world-mode` values have no default icon. Independent fixture checks retain labels and click listeners for each unknown family. Nine inserted event options retain original node/text/disabled state/listeners with no SVG/default check; clinic instruments also remain text-only. These nine are synthetic presentation cases, not an execution of nine game outcomes.

The ordinary decorative span backing is transparent. DOM SVG outer stroke follows button `currentColor`; existing icon library is byte-identical020. Persistent world icons have no separate rectangular backing. No original business action, enabled condition, event binding or transaction was modified. Light/dark/disabled rendered readability still needs Android inspection.

## Evidence levels and commands

Independently executed, **14/14 pass,0 fail,0 skip**:

```sh
python3 tests/ui021-review/verify_readonly.py
node --test --test-concurrency=1 tests/ui021-review/independent-delta.test.cjs artifacts/html-offline-candidate/ui021/source/tests/page-icons.test.cjs
python3 tests/ui021-review/check_evidence.py
```

Node comprises4 independent delta tests plus10 existing page-icon tests. It uses the existing explicit memory/graphics fixture; no real save, permissions, BLE or game completion. TAP: `targeted-node.tap`.

Owner evidence only, with independent readback/source association:

- Full serial Node suite240/240,0fail/skip. Initial parallel failures retained by owner; this review did not independently rerun all240.
- Page CSS36 configurations/1284 checks,234 measured controls; evidence hash/source association checked. These are nonpersistent macOS WebKit component fixtures, not Android screenshots or OS font scaling.
- Care18/330 and periodic refresh4/124 as above; no independent WebKit rerun.
- Key engine11 source-associated checks. Build/lint are inherited owner records; no build/lint rerun here.

## Required device acceptance / remaining limits

Follow frozen `DEVICE-ACCEPTANCE.md` through root's sole device window:

1. Normal and short phone: actual bath instruction and selected care notice visible together, natural tip expiry, notice replacement/departure, view and rest cancel; verify both text layers and no residue.
2. Observe natural roam/recall button through multiple250ms periods; matching icon/label, no visible flicker, original touch/recall behavior. Rod/return only when naturally present.
3. Check transparent icons and deep/light/disabled states; natural event choices remain clear pure text. Do not manufacture random event outcomes for this review.
4. Preserve save and return home; record actual021 evidence under its own SHA. Old020 failed bath captures and old report remain historical evidence.

Wardrobe/family022 work, natural NPC daily6/6 reminder, original3D/model integration, physical fsync recovery and bilateral/radio completion remain outside this delta. Same signing certificate permits the intended upgrade path; it does not prove save preservation without device readback.
