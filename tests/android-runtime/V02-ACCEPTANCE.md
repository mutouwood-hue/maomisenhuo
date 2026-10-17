# v0.2 actual Android acceptance plan

Prepared against `MainActivity.kt`, `LocalLifeRules.kt`, `AppearanceCatalog.kt` and the supplied prototype on 2026-10-15. This document specifies expected real UI behavior; it does not record unexecuted cases as passed. The original ten cases in `run_runtime.py` are preserved. Additional native cases live in `v02_cases.py`; positive 3D collection and clinic holds require screenshot-guided coordinate calibration on the running emulator before their real touch sequence is recorded.

## Environment, evidence and baseline

Use only API35 ARM64 AVD `CatForest_API35`, explicit `adb -s emulator-5556`. No physical devices, implicit adb targets, permission grants, JavaScript/bridge invocation, mock scores, direct state writes, app-data clearing or uninstalling. `install -r` preserves the existing private data. The harness verifies qemu/AVD/API/ABI and checks the actual save envelope checksum using read-only `run-as` before state assertions. UI actions use actual taps, swipes, key events or sustained touches.

Record each APK SHA-256 and install history, actual UI XML/PNG, before/after state and timing in a separate run directory. Keep failures and diagnosed focused reruns. The first APK **0.1 is only a UI and upgrade baseline**, because the independently discovered SilentAtomicFile write failure excludes it from durable BLE qualification even if a normal restart happens to pass. v0.2 must receive its own platform/recovery results; host tests remain separate.

At the start of an upgrade, force-stop the existing app, read its stable save and preserve its bytes/state evidence. Install the candidate in place. Verify existing UUID, name, creation time, counts, coins, XP, journal, deduplication and prior fields survive; revision may advance but may not fall. Whole absent legacy fields may initialize to defaults, while damaged partial fields must not be silently replaced. After real candidate UI changes, force-stop/start again and verify the persisted candidate values. A failed signature/package upgrade is reported; do not uninstall to bypass it.

Example staged command after the owner confirms the AVD is available:

```sh
python3 tests/android-runtime/run_runtime.py \
  --serial emulator-5556 \
  --apk artifacts/2026-10-15-core-candidate/catforest-android-0.1.0-debug.apk \
  --skip-initial-install \
  --upgrade-apk app/android/app/build/outputs/apk/debug/app-debug.apk \
  --cases upgrade_in_place launch touch_pet cancel_care cancel_game \
    background_game full_twenty_second_game touch_sleep reject_invalid_name \
    reject_search_without_permission force_stop_restart \
  --output tests/android-runtime/artifacts/v02-core
```

`--skip-initial-install` continues only the verified installed baseline and avoids reinstalling it. It never creates application data. The initial 0.1 launch evidence must already exist.

## Additional acceptance matrix

| Case | Actual user operations | Required on-device result |
| --- | --- | --- |
| Wardrobe first purchase | Open “衣柜与毛色”; buy an actually unowned affordable catalog item (prefer 莓莓三角巾, 12 coins) | Coins decrease once by catalog price; exactly one inventory ownership entry; outfit becomes that ID; UUID/care counts/XP retained; screenshot shows the same cat with the selected accessory |
| Repeat purchase prevention | Touch the selected “正在穿着” control; inspect disabled state | No second charge, no duplicate owned entry or reward; selected control is disabled |
| Owned equip/unequip | “换回自然毛毛”, then owned “穿上” | Outfit goes none → owned ID with zero extra cost; force-stop/start retains outfit/ownership/coins; no scene or pet replacement |
| Gift/rare gating | Inspect gift-only outfits and rare breed rows | Unowned gifts and unearned rare breeds cannot be directly purchased/selected; no counterfeit social reward is inserted |
| Empty backpack | Open “小猫背包” with genuine zero stock; touch disabled sale controls | Both “出售1份/全部出售” are disabled for zero stock; wallet/inventory/counts/XP unchanged; no negative inventory |
| Real sale | After a genuine completed explore trip, sell one small fish, then sell all of one nonzero item | One fish decrements by1 and adds3 coins. Flower/shell/star prices are2/4/7 each. All-sale gain is exact real quantity×price, then both controls disable. Restart retains wallet/inventory |
| Outdoor choice cancellation | Open location/activity chooser, cancel before beginning | No pending session, payment, inventory, completed activity or reward |
| Outdoor active cancellation | Start 庭院→自由探险, optionally touch a genuine node, then “回到小屋” before settlement | Native pending session/token exists while active; collected nodes remain temporary; cancel clears pending session and grants no inventory/coins/XP/completion. Session sequence/revision may advance |
| Outdoor background/process interruption | Start a real activity, background/return or force-stop | No automatic settlement. If a pending session survives it is visible and can be explicitly put away through “收起未完成的活动”; no hidden reward, duplicate collection or fresh pet |
| Outdoor actual node collection | With screenshot-guided touches, complete the original scene targets: walk3 in order, explore5 distinct nodes, or fish4 | Read-only pending session shows the actual visited IDs. Duplicate nodes do not count twice; walk order is enforced. Merely waiting or clicking settle does not fill nodes |
| Outdoor actual settlement | After all targets and real native foreground minimum time, touch “回家结算” | Walk: >=12s, XP+6, coins+4, energy−4. Explore: >=15s, XP+8, coins+5, energy−6; inventory flower+2/shell+1/star+1/fish+1. Fish: >=15s, XP+8, coins+4, energy−6; fish+4. Each mode food−3/mood+9; caps and foreground decay apply. Pending session clears; completion increases once |
| Outdoor orders/stories | Resolve an encountered story through real UI; capture selected branch before settling | First-walk order+8 once, >=3 total flowers+10 once, first completed fish trip+12 once. Story reward/effects apply only on settlement, not at choice/cancel. For deterministic healthy-path acceptance choose “safe”; do not inject weather, illness or story events |
| Repeat outdoor settlement | Touch the still-visible return/settle control again after success if the scene keeps it visible | No second activity, inventory, XP or coin increase; no pending session is recreated |
| Clinic open/incomplete payment | Open “小猫诊所” | Real pending clinic exists. Healthy consultation cost4; an actual illness costs8. Opening is free. Payment disabled until three real renderer check steps complete; later tools disabled before their turn |
| Clinic tool cancellation | Select “体温计” and perform a short real hold, then “回到小屋” or background | No fee, XP, health improvement or illness clearance. Pending clinic clears or is visibly recoverable. Selecting tools alone never completes a check |
| Clinic actual three tools | Select 体温计→听诊器→护理棉, each time physically hold the cat body until the renderer visibly completes that step | UI progresses0→1→2→3; only current tool enabled; finish becomes enabled only at3. No arbitrary delay or direct callback is treated as completion |
| Clinic payment once | After three real steps and >=1500ms native elapsed time, press “完成护理” once | Coins−4 healthy or−8 ill; XP+3; mood+3; health+8 healthy or+30 ill clamped100; actual healthIssue becomes null; pending clinic clears. Dialog closes, restart preserves results, no repeat charge |

The healthy clinic4-coin path can be executed from a genuine default save. The8-coin illness path is conditional on a naturally produced illness from a real story; absence of that state is a documented untested branch, never repaired with seeded illness or edited saves.

## 3D touch calibration and assertions

World and clinic targets are canvas geometry rather than native accessibility buttons. First capture the actual scene at720×1280 and identify the visible cat, targets and tool status. Record only real screen taps/swipes/holds derived from those images. Verify each successful node/step against visible native progress and the saved pending session where available; a coordinate recipe is not a proof by itself. Do not use DOM evaluation, CatNative callbacks, renderer commands, source-created event IDs or injected scores.

For a normal positive path, run empty-inventory acceptance before collecting items, explore→settle before sale, and purchases before funds fall below consultation price. Never fill the wallet to make a test easier. If the actual save lacks money/energy, use real available play/sleep/actions or report the precondition as blocked. Use separate evidence for later focused flows so an earlier failure remains visible.

For cancellation, compare business fields (coins/XP/counts/inventory/healthIssue and completed/collected/order/story totals) instead of demanding unchanged revision or foreground-decaying stats. Begin/cancel transactions and the15-second foreground tick legitimately advance revision. No cancellation may grant earned rewards or consume consultation funds. For restart, read the stable state **after force-stop**, start again and compare before the next foreground tick; this isolates actual storage recovery from legitimate live decay.

## Current execution status

0.1 successfully installed and launched on the verified AVD. Its PNG shows the original 3D room, and its saved UUID is `43df3fb2-da03-4950-89f6-949901c1a5b0`; permissions remained ungranted. Evidence: `artifacts/v01-baseline/`.

The first v0.2 run stopped at preflight because `emulator-5556` disappeared. No candidate installation or case began (`cases=[]`). Failure evidence remains in `artifacts/v02-core-and-native/`. Resume only after the environment owner restores the same AVD without wiping data. This document and prepared scripts do not claim the v0.2 UI cases have run.
