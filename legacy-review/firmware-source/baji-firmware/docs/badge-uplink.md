# The badge's uplink to the App (event queue, wire format, persistence)

The badge reports what the owner did; the **App settles the pet's numbers** (spec 9; the
specification's own rule 5: 吧唧只做 5 种照料 … 结果作为事件上行由 App 结算). This document
states the contract between the two, the queue that carries it and what is deliberately left
out. The code is `main/net/badge_events.c`; the vocabulary is generated into
`main/ui/badge_spec_data.c` (`badge_event_defs[]`, `badge_strings[]`) from
`_ref/baji-spec/吧唧交互规范/badge_spec.json` and must never be restated by hand.

Spec version: **0.3.0**. Section numbers below are the specification's own (its 9 数据同步 /
上行事件 page and its chapter 12 M1 board conclusions).

## 1. Wire format

One event is **8 bytes**, little endian (spec 9: 上行事件 每条 8 字节，小端：u32 时间戳（秒）+
u8 类型 + u8 参数 a + i16 参数 b):

```
 offset  +0       +1       +2       +3       +4       +5       +6       +7
       +--------+--------+--------+--------+--------+--------+--------+--------+
       | ts&FF  | ts>>8  | ts>>16 | ts>>24 | type   | a      | b&FF   | b>>8   |
       +--------+--------+--------+--------+--------+--------+--------+--------+
         <----------- uint32 ts, unix seconds, LE ----------> <u8>   <u8>
                                                                     <-- int16 b, LE -->
```

`ts` occupies +0..+3, `type` is +4, `a` is +5, `b` is +6..+7.

* `ts` is unix seconds (not milliseconds), little endian, unsigned 32-bit.
* `type` is 1..14; `EVT_NONE = 0` is **not** a wire value, and 15 or 255 are rejected.
* `a` is an unsigned byte parameter.
* `b` is **signed** 16-bit, two's complement, little endian. A negative `b` is a legal value,
  which is why the encoder writes `(uint16_t)b` and never clamps or narrows (`int8_t`/`uint8_t`
  would silently truncate "改设置 … = -1" into 255).

Worked example — type 14 (`EVT_SETTING`), `a = 1`, `b = -1`, `ts = 0x0A0B0C0D`:

```
0D 0C 0B 0A 0E 01 FF FF
```

`b = 32767` is `FF 7F`; `b = -32768` is `00 80`.

The fourteen types (spec 9's events table, verbatim from `badge_event_defs[]`):

| # | name | spec label | a | b |
|---|---|---|---|---|
| 1 | `EVT_PET` | 摸摸 | — | — |
| 2 | `EVT_FEED` | 喂食完成 | 口数 | — |
| 3 | `EVT_WATER` | 喝水完成 | 口数 | — |
| 4 | `EVT_PLAY` | 逗猫完成 | 扑的次数 | — |
| 5 | `EVT_SLEEP` | 睡觉完成 | — | — |
| 6 | `EVT_CARE_CANCEL` | 照料中途取消 | 照料编号 | — |
| 7 | `EVT_VOICE_CMD` | 命中离线命令词 | 命令词编号 | — |
| 8 | `EVT_VOICE_FREE` | 自由对话（经手机） | 意图编号 | — |
| 9 | `EVT_QUIRK_CATCH` | 接住怪行为 | 怪行为编号 | — |
| 10 | `EVT_MEET` | 遇见并确认 | 0 碰一碰 / 1 扫码 | 对方短编号 |
| 11 | `EVT_CALL_HOME` | 叫小猫回家 | 地点编号 | — |
| 12 | `EVT_WAKE` | 唤醒 | 0 抬起 / 1 触摸 / 2 唤醒词 | — |
| 13 | `EVT_FACE` | 切换表盘 | 表盘编号 | — |
| 14 | `EVT_SETTING` | 改设置 | 设置项 | 新值 |

### Decoding rules (both ends)

`badge_events_decode()` refuses a record when the type is outside 1..14 **or** when the
record is not exactly 8 bytes long, and leaves its destination untouched on refusal. The
length half is enforced by the only caller that receives bytes with a length attached — the
persistence reader, which also checks that the blob header's record count and the blob's byte
count agree exactly, so a truncated tail or trailing rubbish cannot pass as a queue.

## 2. The queue

* **Depth 200 records = 1,600 bytes** (spec 9: 离线时存在本机环形缓冲（200 条）).
* The ring is a **file-level static array** in `badge_events.c`, not a task-stack local. This
  is not a style preference: an 8 KB buffer of exactly this shape used to live inside a
  function, the compiler allocated the whole frame at entry (`entry a1, 0x2030`) against a
  3,584-byte main-task stack, and the badge rebooted at boot while the error blamed a
  neighbouring task — `docs/m1-hardware-verification.md:28-57`, and the specification's own
  M1 conclusion (chapter 12, 上板教训: 事件缓冲（200 条 × 8 字节）一律用 static 或堆). The host
  test can only pin the depth down (`badge_events_pending() == 200`); the placement itself is
  a board-level property.
* **Full queue: drop the OLDEST record** and count the drops (`badge_events_total()` keeps
  counting every record that was ever appended, so `total - pending` is the number that were
  dropped or already sent). The rule follows from the specification's purpose rather than
  from a spec line: a phone that never connects must not be able to wedge the badge, and the
  newest actions are the ones the owner just performed. There is no "queue full, stop
  reporting" mode.
* Order is **FIFO, oldest first** (spec 9: 连上手机后按顺序补传).
* Records are removed only after `net_link_send()` reports success, one at a time from the
  head. A refused send — the link is up but its GATT discovery has not finished, or the
  connection just dropped — leaves everything pending, and the next attempt resumes at the
  same record instead of skipping it.
* `badge_events_push()` refuses a type outside 1..14 rather than queueing a record the App's
  decoder must reject (which would otherwise be re-sent forever).

## 3. Persistence (NVS)

One blob in the `badge_evt` namespace, key `queue`, following the conventions of the pet's
own save (`main/pet/badge_pet.c`, stored from `main.c`; NVS, not a filesystem: a few hundred
bytes that must survive a power cut atomically):

```
+0  magic  'B','E','Q','1'
+4  version u8 = 1
+5  reserved u8 = 0
+6  count   u16 (0..200)
+8  count × the 8-byte wire records, OLDEST FIRST
```

Maximum size **8 + 200 × 8 = 1,608 bytes**. The records are stored in the App's own wire form
(produced by the same encoder), so there is one encoder rather than two that can drift: what
is in flash is byte-for-byte what the phone will be handed.

* The queue is written **at most once every `BADGE_EVENTS_SAVE_MS = 5000` ms** (the constant is
  defined in `badge_events.c`; flash erase cycles are finite and the queue changes on every
  care action), and immediately on `badge_events_save()`.
* The window is armed on the **first** change and not extended by later ones, so a burst costs
  one erase and a continuous stream still reaches flash every 5 s.
* A failed `nvs_set_blob()` or `nvs_commit()` is **not** treated as "saved": the queue stays
  dirty and is retried after the next window (the same defect `main.c`'s save path is written
  to avoid).
* `badge_events_init()` loads the blob and validates it whole — magic, version, count ≤ 200,
  an exact length match, and every record decodable. Anything malformed leaves the queue
  **empty** rather than partially filled, because a partly applied queue is one the App cannot
  tell apart from a real one.
* `badge_events_clear()` drops everything in RAM and erases the blob. Called before
  `badge_events_init()` it still wins: the request is honoured by the load.

**The App must settle idempotently.** A record that was delivered but not yet removed from
the *stored* blob (inside the 5 s window) reappears after a power cut, so the App can see an
event twice. That is the deliberate trade: at most 5 s of duplicate settlement in exchange for
never losing an event.

## 4. Clock

The board has **no RTC** (`docs/gap-vs-v1.5.md:341-345`; the specification's own M1 conclusion
is 时间面向未有校时来源, and its chapter 12 notes that time comes from the phone). So:

* `badge_events_tick(now_ms)` feeds the module its own monotonic millisecond counter; the
  module owns no timer (it borrows the app tick, exactly as `main.c`'s save does).
* Before any sync, `badge_events_now()` returns the compile-time default — `1791590400`
  (2026-10-10T00:00:00Z, the date the specification was frozen for the M1 board) **plus**
  elapsed uptime. Deliberately not 0: a 1970 timestamp looks like a real time downstream and
  would sort every queued record to the front of the App's timeline.
* `badge_events_set_time(unix_seconds)` adopts the phone's clock, which the downlink snapshot
  carries **每次连接** (spec 9). Afterwards `badge_events_now()` returns that value plus
  elapsed seconds. A sync of `0` is refused: there is no way back from it.
* The sync is not persisted. The phone sends it again on the next connection, and what must
  survive a power cut is the queue, not the clock.

## 5. What the badge does when the phone never connects

Nothing degrades silently, and nothing wedges:

* Events keep being appended to the ring; the depth stays at 200; the oldest fall off and are
  counted (`badge_events_total()` minus `badge_events_pending()`).
* The queue is still persisted, so a power cut does not lose the most recent 200 actions.
* `badge_events_flush()`/`badge_events_tick()` are no-ops for the radio while the link is
  down; the UI's "待同步" wording (`syncWait: {n} 条互动待同步`, spec 9's texts) can be driven
  from `badge_events_pending()`.
* The pet's numbers on the glass keep following whatever the App last sent
  (`badge_pet_sync()`); the badge never invents a number of its own.

## 6. Deliberately NOT implemented here

* **The settlement itself.** Growth, coins, stat deltas, decay and the App's own care rules
  (洗澡 / 出门 / 接小鱼 / 衣柜) live in the App. The badge reports; it does not score
  (spec rule 5, and `main/pet/badge_pet.h`'s header).
* **The cloud.** No HTTP, no MQTT, no pairing service, no account. The uplink is a local BLE
  link to one phone.
* **The QR payload of the 遇见 confirmation.** Without NFC the specification has the badge
  show its own QR (设备短编号 + 一次性口令, 20 秒有效) and the peer's App scan it (spec 12, 没有
  NFC 时的遇见确认). This module only carries the resulting `EVT_MEET` record, with
  `a = 1` for the scanned path; rendering the code and validating the one-time secret are
  other modules' work.
* **Any acknowledgement from the App.** There is no ACK in this direction: a record is
  removed from the queue when the local link accepted the write, not when the App settled it.
  Delivery confirmation would need an App-side reply and is not in spec 9.
* **Multi-frame framing, batching and compression.** One event is one 8-byte write; the
  negotiated MTU is far larger (`net_link_send()` refuses anything over `mtu - 3`).
* **Clock sync in the other direction.** The badge never sends its time.

## 7. What is not verified

* **Nothing about flash.** The host tests drive an in-memory NVS stand-in: "the bytes reached
  `nvs_set_blob()`" is not "they are on flash after a reset". Power-cut atomicity of the blob
  is NVS's claim, not this module's.
* **Nothing about the radio.** `net_link_send()` is stubbed on the host; the real NimBLE path,
  MTU negotiation, packet loss and the timing of a connection's `ESP_ERR_INVALID_STATE` window
  have not been exercised against a phone.
* **The 5 s duplicate window** is reasoned about, not measured against a real App.
* **The compile-time default timestamp** is a chosen constant (`2026-10-10T00:00:00Z`), not
  something the specification states; it is documented in `badge_events.c` as a choice.

## 8. Verification

`tests/host/test_badge_events.c`, run by `tools/suite/06-events.cmd` through
`tools/run-host-tests.cmd`: the phase prints **597 checks, 0 failure(s), 11 boot(s)** in the
last recorded run (`build/host/events-run.txt`, 2026-10-10) — the count moves as the test grows,
so treat 612/597 as snapshots rather than a contract. It covers the exact bytes of a record
(including `b = -1 → FF FF` and the widths of every field), a round trip for all fourteen types
and both
signs of `b`, the decoder's refusals, the ring's drop-the-oldest rule at exactly 200, the flush
contract against a link that refuses writes, the NVS round trip of a partly drained queue
across a reboot, malformed blobs, the save window, `clear()`, the clock and the labels. The
same source is compiled a second time by the firmware's own `xtensa-esp-elf-gcc` with
`-Werror=all`, because clang and GCC do not share every warning.

Measured on that same firmware compiler, the largest stack frame anywhere in `badge_events.c`
is **48 bytes** (`badge_events_init`, `badge_events_flush`, `write_now`); every other function
is 32. The 1,600-byte ring and the 1,608-byte serialisation buffer both land in `.bss`
(`xtensa-esp32s3-elf-nm -S`: `s_queue` 0x640, `s_blob` 0x648), against a 3,584-byte main-task
stack — the exact check that the old 8,240-byte frame failed (`docs/m1-hardware-verification.md:40-55`).

Mutation-checked: fifteen single-line mutations of `badge_events.c` were compiled from a copy
and run against the test. Fourteen fail it or fail to build (`-Wall -Wextra -Werror` catches a
set-but-unused global and an unused helper): `b` or `ts` written big-endian, `b` narrowed to
`int8_t` on the way in or out, the decoder accepting type 15 or `EVT_NONE` or `push()` accepting
`EVT_NONE`, the ring's head never advancing on overflow, keeping the newest instead of the
oldest, ignoring a failed `net_link_send()`, skipping the magic check, a big-endian blob header
count, `clear()` not erasing, clearing the save-dirty flag before the commit, and a stalled
clock. One mutation survives and is listed here rather than hidden: replacing
`badge_event_label()`'s match on `badge_event_defs[i].type` with the row index `i + 1` is
**equivalent** for the current table (whose order and numbering agree, as
`test_round_trip_all_types()` asserts), so no test can distinguish it — it only becomes
observable if the generated table is ever reordered, which is what that assertion exists to
catch.
