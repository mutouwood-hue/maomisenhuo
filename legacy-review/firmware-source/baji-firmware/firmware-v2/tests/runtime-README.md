# Runtime fault-injection regression — actual results

## Scope and method

The harness directly includes `../runtime/baji_main.c` without copying or redefining its logic. Registered LVGL callbacks are invoked through the captured callbacks. Real `baji_controller.c`, `baji_gesture.c`, `baji_scene.c`, `baji_power.c`, `baji_link.c`, and `baji_protocol.c` are compiled and linked. SDK/LVGL/render/PMIC/BLE boundaries use isolated `runtime-mocks/` declarations and harness implementations. BLE pump records its runtime invocation and calls the real `bj_link_state` serializer; it does not execute NimBLE transport.

Only new `firmware-v2/tests/runtime-*` and `tools/test-runtime.ps1` files were created/edited. Generated binaries/objects stay in `runtime-build/`. No production source, other tests, shared transport mocks, Git, deletion, flash or Flow operations were performed.

## Executed

From repository root:

```powershell
& .\tools\test-runtime.ps1
& .\tools\test-runtime.ps1 -CompileOnly -Compiler 'C:\Espressif\tools\riscv32-esp-elf\esp-14.2.0_20260121\riscv32-esp-elf\bin\riscv32-esp-elf-gcc.exe'
```

Both use `-std=c11 -Wall -Wextra -Werror -pedantic -O0 -g`.

- Host execution: **PASS, 20 reset scenarios / 766 assertions**. The local `gcc.exe` is actually an LLVM-MinGW **Clang 23.1.1 compatibility wrapper**, not GNU GCC. Runner explicitly warns about this.
- Genuine local GNU GCC: **riscv32-esp-elf-gcc 14.2.0**, strict **compile-only PASS** for runtime harness translation unit plus six real core translation units. Cross-target objects cannot execute on Windows; GNU host execution is **not claimed**.
- Assertion count includes mock contract/order checks, not 766 independent safety scenarios.

## Actual behavior covered

- Fresh valid 4% and explicitly absent USB enter LOW latch, including startup LOW; freshness boundary exactly 2000ms is accepted, 2001ms rejected.
- Stale/future low samples do not establish LOW; invalid/unknown USB does not establish LOW from a low percentage.
- Previously latched LOW survives missing publication, stale high/USB sample, fresh wholly unknown sample, and future recovery sample. Stale battery is exposed as invalid / -1, not invented data.
- Fresh 5% recovery and fresh valid USB recovery unlock; startup LOW still starts BLE after successful consumers initialize.
- UNKNOWN PRESS clears `hold_allowed` after controller PRESS can set it. At 600ms tick it does not enter VOICE; PRESSING cancels the denied stationary long press.
- NORMAL hold enters VOICE; subsequent UNKNOWN tick cancels VOICE back to its actual previous page and does not mark tutorial success.
- A normally completed voice tutorial release first establishes real `voice_success_pending`; UNKNOWN at its 240ms deadline cancels it before scene tick can succeed; recovery later does not resurrect it.
- Real swipe release establishes pending `BJ_COMMIT`; LOW before its completion clears motion/direction/gesture without entering tutorial destination. LOW does not preview/slide the destination and recovery does not revive pending commit.
- GUIDE_OK entered by an actual tap freezes across 5 seconds LOW; recovery shifts `success_t0`; step stays unchanged at adjusted +899ms and advances at +900ms.
- LOW cancels both active VOICE and voice tutorial pending success.
- Every test tick invokes BLE pump before rendering (`QV`) even in suspended LOW. Real BLE state serializer receives LOW, suspended flag and actual 4% while retaining BLE.
- Successful startup order is NVS → display → PMIC → MAC → display lock → active screen → renderer → timer → flag/event registration → first render → unlock → BLE start. Mock BLE start asserts initialized controller/link/power, renderer, registered tick/input and first render, with display unlocked.
- Display creation, PMIC start, display lock, renderer creation, and timer creation injected failures do not start BLE. Renderer/timer failures release display lock; lock failure does not unlock an unowned lock or create consumers. NVS/MAC ESP_ERROR_CHECK injected failures stop subsequent initialization. BLE-start failure is checked only after successful unlocked initialization.
- Missing input device, irrelevant event, pair local-button release and PRESS_LOST cancellation are exercised.

## Not covered / limitations

- Actual LVGL allocation/display/render pixels, panel overlays, animation visual clock or memory reclamation; renderer is mocked. Assertions prove supplied frame/policy, not real renderer visuals.
- PMIC I2C reads/register decoding, worker/queue concurrency, read deadlines, bus failure and recovery; injection begins at `bj_pmic_latest` published snapshot boundary.
- Real NimBLE host, GATT, queue/backpressure/generation handling or physical BLE delivery; the proof is runtime pump invocation and actual pure-C state serialization.
- Full board SDK build/link, hardware execution, timing under real tasks, RF, touch accuracy, ASR/audio/cloud behavior.
- Repeated `app_main` lifecycle, LVGL callback races before BLE starts, renderer cleanup after timer failure, uint32 wrap-around, every coordinate/gesture threshold combination.
- Runtime's `bj_power_init` failure branch is not injected: fixed valid arguments and real power implementation make it unreachable without replacing production behavior.
- Link/protocol sources are linked, and link state is executed, but request dispatch/protocol parsing is not runtime regression coverage here.
- No GNU GCC Windows-host execution available; do not equate the Clang wrapper run with that.

No production defect was discovered by these checks. If additional failing safety assertions are found, report Lead before production changes; this test-only scope does not authorize production fixes.
