# Actual Android API35 runtime acceptance

This suite is restricted to AVD **CatForest_API35**, serial **emulator-5556**, API35 ARM64. Every adb invocation uses the explicit serial, and preflight rejects a different AVD/API/ABI or non-emulator. It does not create or start an AVD. Wait for the environment owner's ready notification before running.

```sh
python3 tests/android-runtime/run_runtime.py \
  --serial emulator-5556 \
  --apk /absolute/path/to/stable.apk
```

The APK is installed with `install -r -t`, retaining actual application data. No app-data clear or uninstall is used to repair a failure. UI actions are actual `input tap/swipe/keyevent` operations located through UIAutomator nodes; no JavaScript or fake score is injected. `run-as com.catforest.app cat files/pet-state.json` is read-only and verifies the real on-device AtomicFile envelope checksum before assertions. Native 15-second foreground decay is accounted for separately from care/reward changes.

Prepared acceptance cases:

1. Actual install/start, displayed UI and real UUID/revision.
2. Native UI touch “摸摸”: mood +9, XP +3, count +1 and durable revision.
3. Begin then cancel feed: no care count, XP or coin settlement.
4. Begin then cancel the original game: no reward.
5. Background an active game and return: canceled without later settlement.
6. Play the original 20-second game with real horizontal swipe touches; require a positive saved catch count and consistent XP/coin reward. Screen geometry may need adjustment after inspecting the first emulator screenshots; a failed gesture is reported, never patched through JS/state injection.
7. Real sleep touch restores energy and saves its count.
8. Enter a one-character name via the real EditText and verify visible rejection and retained save.
9. Search without nearby-device permission and verify refusal; never press the permission request button or auto-confirm a system prompt.
10. `am force-stop` / actual start: the complete parsed private save, including UUID/revision/stats/counts, remains equal.

Each run produces a timestamped `artifacts/<time>/runtime-report.json`, command log, PNG screenshots, UI XML and private-state snapshots. Failed cases stop the flow and retain evidence. `--cases launch ...` can select a focused rerun after a diagnosed fix; retaining the original failure report is required. New candidate APK upgrade/wardrobe cases will follow stable-APK platform verification. None of these results proves real Bluetooth, hardware badge input, pairing, real-phone compatibility or power behavior.

The v0.2 additional matrix and sequencing are in [V02-ACCEPTANCE.md](V02-ACCEPTANCE.md). Optional `v02_cases.py` cases cover retained-data upgrade, purchase/repeat-purchase prevention/equip, empty inventory, outdoor cancel and clinic cancel. They do not change the original ten-case default. Use `--upgrade-apk` with explicit `upgrade_in_place`; `--skip-initial-install` continues an already verified installation without reinstalling its baseline. **Version0.1 is a UI/upgrade baseline only because its known SilentAtomicFile failure excludes durable BLE qualification.**
