# Production transport host regression

## Run

From `D:\黑客松`:

```powershell
& .\firmware-v2\tools\test-transport.ps1
```

The independent script follows the C11 / `-O2 -Wall -Wextra -Werror` host compiler approach in `tools/test-core.ps1`, but never changes or invokes that script. Pass `-Compiler <path>` to select another compatible host compiler. Generated executable stays in `tests/transport-build/`.

`transport-regression.c` includes the current `../runtime/baji_ble.c` directly and links the real link/protocol/controller/scene/gesture sources. It does not copy transport logic and does not assert source strings. Only NimBLE/FreeRTOS/ESP SDK APIs are mocked. A wrapper counts calls to the real `bj_link_dispatch`; mutating opcode 3 demonstrates controller mutation happens once despite repeated notify failures. Mocks assert SDK calls are outside the transport guard. Fixtures reset static state only between independent scenarios, never to hide a failure inside a scenario. This also supports the production `start_result` transition to `atomic_int`.

## Covered behavior

- ACK allocation and custom-notify failures retain the exact ACK; successful retry sends it once; pumping/ticking does not redispatch or repeat the controller mutation.
- Continuous admitted ACK traffic plus state changes: at most two consecutive ACK successes, at most one consecutive state success while ACK work is queued. Sixty offered requests exercise admission backpressure; every accepted ACK drains in FIFO sequence with no loss or duplicate.
- RX capacity eight, ATT resource error on overflow; pump dispatch budget two; TX capacity eight stops dispatch without dropping RX; recovery drains accepted requests FIFO.
- Disconnect and same-handle reconnect drop old RX/TX/state, require new CCCD, and do not execute old pending mutation. CCCD disable/re-enable changes generation and clears old work. Unrelated peer/attribute events do not clear active work; extra connection is terminated.
- Injected stale-generation RX never dispatches; stale-generation TX never notifies. A deterministic disconnect/reconnect during notify completion cannot pop a new-generation ACK.
- Host task-create failure returns NO_MEM, stops/deinitializes callout and deinitializes NimBLE exactly once, caches failure, forbids subsequent init/task retries, and disables pump mutation.
- Init/config/callout-init/callout-reset failures cache errors and clean up once; successful repeated start does not initialize again; host exit calls task delete.
- State allocation/send failures retain pending work; changes coalesce to latest state; unchanged state is not repeatedly sent. GATT reads validate connection and available state; writes validate opcode, length and packet decoding.

Final verified output: `transport: 1311 checks, 0 failures (real production C + real core)`.

## Explicitly not covered

- No ESP-IDF target build, BLE hardware/radio, Android/iOS/mobile client, actual NimBLE scheduler, real mbuf ownership/leak instrumentation, or physical flash/boot.
- No true parallel thread stress, memory-order proof or atomic-race sanitizer. The notify-completion interleaving is deterministic, not a scheduler simulation. Fairness bounds successful sends while both lanes have work, not wall-clock progress under indefinite backpressure.
- `runtime/baji_main.c` was read to confirm serialized UI pump and startup ordering, but is not included or exercised: display/LVGL/PMIC/NVS/app-main error paths remain untested here.
- SDK advertisement failures/address inference failures and every individual GATT registration failure are not separately injected.
- No runtime/core/other-tests/Flow/mobile changes; no Git, deletion or flashing.
