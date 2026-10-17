# UI022 independent delta review

## Decision

**PASS to the sole integrator for the already authorized data-preserving installation and read-only visual/form acceptance. No confirmed new P1/P2 or installation blocker found.** No actual device, purchase, adoption, mating or clothing operation was performed by this review.

Read `INTEGRATION-HANDOFF.md`, `FROZEN.json`, `manifest.json`, `DEVICE-ACCEPTANCE.md` and production delta. No applicable `AGENTS.md` was found in the workspace/ancestor paths checked. All outputs are exclusively under `tests/ui022-review/`; candidate source and previous reviews remain unchanged.

## Package and preservation

| Item | Independent result |
| --- | --- |
| APK | 627719B; SHA256 `e2c0fc3cfafc7231dbb0bac96e69e54f2c3b3b02052cd7da72aa8a5c9a005d0f` |
| Package/version | `com.catforest.htmlcandidate`, code13, `0.2.2-html-local` |
| Signing | Offline apksigner verified; cert SHA256 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`, same021 |
| Alignment | zipalign check succeeds |
| Source archive | 143 files/1200164B; SHA256 `06c373654f2de6f07db954985c8eafd25159c61b085cf7a0c14cec31abd6f856`; every entry matches frozen source hashes |
| Assets | All33 APK assets match candidate source bytes |
| Protected |35 explicit paths: all21 prior web files,8 original game scripts,4 Java files, original HTML and Android manifest equal021 |
| New runtime | Only `offline-family-ui.js/.css`, plus asset copies and index loading tags; generated index equals021 after removal of precisely one new CSS tag and one deferred script tag |
| Boot boundary |20 deferred scripts; original durable boot remains authoritative. No new script bypasses it |
| Compiled Native | `classes.dex` identical021; `classes2.dex` differs in34 bytes only: generated BuildConfig versionName/code, its checksum metadata and DEX header checksums. Normalizing those exact fields reproduces021 byte-for-byte |
| Preservation |020 and021 source inventories/APK/ZIP still match their frozen hashes;022 source stable after tests |

Readback and command evidence: `readonly-report.json`, `evidence-readback.json`, `signature.log`, `alignment.log`, `badging.log`. No build, install, networking or device action.

## Family and wardrobe behavior

`offline-family-ui.js` reads the original `adopt-breed` options, clones only the matching existing SVG, and adds `type=button` preview cards. No clone carries the old `data-breed` handler attribute. The selected card updates only original select.value and dispatches change. The original dropdown remains; its change synchronizes aria-pressed.

Preview does not invoke chooseBreed/adoptCat/buyItem, store/Native/adapter or permissions. The actual12-coin adoption button and original store retain commitment, eligibility, busy, six-cat/reserved-slot and balance gates. Original7 family tests executed the complete production Ef binder and vu store, covering preview without writes, real in-memory original adoption12-coin path with prior cat unchanged, low balance/capacity/reservation rejection, rare/adult identity and original clothing buy/equip/remove. These are synthetic memory transactions, not changes to the user's game.

The old current-cat breed container remains for original renderer use but has hidden, inert, aria-hidden and `display:none!important`. Thus the user-facing wardrobe retains original clothing/accessory controls while removing the current-cat breed-changing entry. Existing rule/handler code remains byte-identical021. Labels change to “小猫衣柜”; the observed sheet title is synchronized after asynchronous original binding.

Five independent checks additionally passed:

1. Begin real store care to make busy; SVG-child preview changes form only, original adoption button remains disabled and store rejects adoption. Save/storage bytes remain unchanged by preview.
2. Every preview SVG's geometry exactly equals its corresponding original artwork; label-child click updates form without a store write. All cards explicitly type=button, no copied breed/outfit/cat handler attributes.
3. An option disabled/hidden immediately before observer refresh cannot be selected through a stale card; disabled select is also guarded in the click handler.
4.20 refresh/pick cycles preserve the complete memory save and cat count; dispose removes the live preview click handler.
5. Generated index delta is exactly the two new loading tags, preserving original HTML and durable bootstrap.

No native/adapter/store/economic rules were reimplemented. Browser focus/hit testing and actual Android form behavior still require device acceptance; jsdom's inert property assertion is not a physical touch proof.

## Executed versus inherited evidence

**Independently executed24/24 Node tests,0fail/0skip:**19 existing targeted tests (family7 + gameplay/bootstrap12), plus5 independent cases. Reproducible commands:

```sh
python3 tests/ui022-review/verify_readonly.py
node --test --test-concurrency=1 artifacts/html-offline-candidate/ui022/source/tests/family-ui.test.cjs artifacts/html-offline-candidate/ui022/source/tests/gameplay.test.cjs artifacts/html-offline-candidate/ui022/source/tests/native-bootstrap.test.cjs
node --test --test-concurrency=1 tests/ui022-review/independent-family.test.cjs
python3 tests/ui022-review/check_evidence.py
```

TAP: `targeted-node.tap` and `independent-node.tap`.

Owner software CSS evidence6 profiles/183 checks was independently read back and all production CSS/module/game hashes associated with frozen source. Reported48px targets/contrast assertions pass. Configurations are family/wardrobe ×360×640,390×844,360×640 explicit1.6 text scale. This review did not rerun WebKit. CSS pixels, simulated enlarged native form font and offscreen macOS layout are not Android dp/system font/3D acceptance.

Owner full248/248 suite, final8/8 targeted follow-up, offline build and SDK lint0errors/6existingwarnings remain owner records; this review did not rerun all248, build or lint. Standard Gradle lint offline dependency limitation remains explicit.

## Integrator acceptance and remaining limits

Use frozen `DEVICE-ACCEPTANCE.md`: preserve data/permissions, verify installed SHA, open wardrobe and family at original screen plus360/390; preview two breeds and change original select; inspect long names, selected state, scroll end and close. Confirm current cat/coins/count remain unchanged. **Do not purchase, adopt, pair or dress/undress on behalf of the user.** Restore physical1200×2670/density520 and Home afterward.

Same certificate supports the upgrade path but does not prove save preservation; compare device pre/post-install storage and installed APK through the integrator's authorized window. No022 device evidence is claimed here.021 bath/recall actual review remains its own scope. Firmware033, CFLOCAL2 diagnostics, physical clock/FIFO/fsync, bilateral completion, natural NPC banner, new town/model and all existing scope gaps remain separate.
