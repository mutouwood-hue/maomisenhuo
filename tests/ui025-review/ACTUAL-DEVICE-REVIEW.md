# UI025 actual-device evidence: independent review

## Limited conclusion

**The recorded natural work-companion → original recall → fresh persisted device-home loop passes in the reviewed actual scope.** Installation preservation, limited read-only wardrobe/family demonstration, finite foreground process observation and device release are supported. No new P1/P2 blocker was confirmed. This is not complete gameplay, graphics, physical badge animation or long-term stability acceptance.

Root performed the actual phone/badge operations. This reviewer only read local artifacts, visually inspected 12 original PNGs with XML, and independently checked hashes, tar streams, authoritative snapshots, raw process/memory/log records and MP4 metadata. No device, ADB, serial, install, network, source or candidate modification was performed here.

Evidence root: `artifacts/device-integration/2026-10-16-ui025/`. Recheck with `python3 tests/ui025-review/check_actual_evidence.py`; final derivation is `actual-evidence.json`. Original intermediate observations remain in `actual-evidence-interim.json`.

## Installation and actual loop

- Installed/read-back APK matches the frozen release SHA256 `ea08d990f5210f5e8cf831b77cea60f39b2826270604148f84a38432be786c88` (0.2.5/code16). Independent tar-member hashing confirms **13 mapped files** byte equal before update and after update/before launch, matching install evidence. No clear-data or permission grant is recorded.
- `cold-start` and `before-original-recall` show the pre-existing original work overlay, “小橘出门啦 / 叫它回家 / 看看它”, and 24 coins. This is the original currently applied schedule/companion mode, not evidence of actual geolocation or a newly measured workplace.
- Recorded manual mode/scan/selection/handshake precede the successful persisted scene and explicit diagnostic read. The away and home records below are taken from both read-complete and state-fields XML, with corresponding original images inspected. They are not inferred from a journal or renamed screenshot.

| Actual read | Generation | Snapshot revision | Sequence | Scene/action/weather | ACK / pending |
|---|---:|---:|---:|---|---|
| Away before recall | 2 | 20 | 29 | away / idle / clear | 9 / 0 |
| Fresh home after original recall | 2 | 22 | 31 | home / idle / clear | 9 / 0 |
| Final fresh read 03:13:04.569Z | 2 | 27 | 36 | home / idle / clear | 9 / 0 |

- The action log records exactly one original **“叫它回家”** at03:02:16Z. `after-original-recall` visibly shows the 3D cat back in its original room and the large away overlay removed. The subsequent fresh read displays revision22/home. The final fresh read still displays home at revision27. Revisions/sequences progressed through normal business snapshots; the evidence does not require or prove exactly one command per click.
- No cfg/day/time/cat edit is recorded to manufacture the work condition. The actual loop checks the original private recall behavior at this time; it does not replace the independent software boundary tests or prove actual30-minute expiry.
- BLE explicitly still lacks direct clockValid/now data. This round establishes persisted scene-state linkage through the real connection, **not a fresh direct clock-validity/precision measurement** and not optical proof of the badge's corresponding animation. A previously reported034 reset prevents reusing an old clocktrue as current proof.

## Data and existing receipts

Independent Native-body hash validation and entry comparison show baseline authority revision65 → after-loop72 → final81; **only `cat-cflocal2-journal-v1` changed**. Game, social, source-identity and ledger bytes remain equal at all captured checkpoints, including the foreground-room samples. Final journal pending is null.

The same9 ledger records remain **8 applied +1 quarantined**, with9 social receipts. Durable checkpoint coins24 / XP67 and original action counts are unchanged (feed2, pet11, sleep3, other listed actions0). This supports no newly recorded reward/re-settlement in these samples, not a claim that all nine rewards were applied or that every live state byte stayed still.

The real room endpoint images show natural live change: mood92→90 and energy68→67, with24 coins. The captured Native checkpoint is a separate persistence layer; its byte equality must not be generalized to continuous live WebView invariance or to physical fsync/power-loss safety.

## Core demonstration and recordings

The original room/cat, wardrobe opening/scrolling/closing, and family silver-tabby pending-adoption form preview/closing were visually cross-checked with actions/XML. They are read-only demonstration steps. The supplied wardrobe-scroll image is an intermediate section, not an asserted full-end/all-item pass; the family preview does not establish adoption/pairing or a changed active breed. No purchase, wardrobe change, adoption, reward claim or new care was validated in this round.

The two raw MP4s have independently parsed movie-header durations **179.9837s** (`core-raw`) and **99.986s** (`pages-raw`). These are separate recordings. The core recording ends before the last home read; the screenshot/XML chain is the primary full-loop evidence. This reviewer did not decode every video frame or repeat Root's13 exact-time samples. No continuous one-take whole-loop, real FPS or touch-latency pass is claimed. Private media upload/permission verification is Root's separate evidence; no remote Drive operation was performed here.

## Finite stability window and retained diagnostics

The corrected `room-observation.json` spans03:06:26.416586–03:11:30.036686Z, **303.684s**, with five60/120/180/240/300s checkpoints. Raw meta/activity/memory records confirm the same main PID10921 and expected foreground package at all points. The first host date-format quoting attempt failed before sampling and remains recorded; it is not an APK failure. Both actual room endpoint PNGs still show the cat and original room.

| Checkpoint | PSS KiB | Native private-dirty KiB | Graphics private-dirty KiB |
|---|---:|---:|---:|
| room-start | 236311 | 46396 | 97270 |
| 60 | 255022 | 45536 | 94828 |
| 120 | 247062 | 46480 | 94860 |
| 180 | 243132 | 46496 | 94948 |
| 240 | 248384 | 46788 | 94824 |
| 300 | 242652 | 45568 | 94824 |

The room-start memory capture is03:05:31.069530Z, approximately55s before the corrected timed window; the final is03:11:26.510344Z. The table includes that preceding baseline rather than presenting it as an exact0s sample. PSS changes by6341KiB and fluctuates; no leak threshold or leak-free conclusion is invented.

The preserved main-process log has40 lines and no selected fatal/uncaught/ANR matches. **It also contains2 I-level Adreno “Shader compilation failed” and2 “Pipeline create failed” messages**, retained at11:06:36/38. No user-visible rendering failure or025-specific cause was established by this evidence, but the log is not “all graphics clean”. Same main PID and endpoint pictures do not cover every renderer/OS process or every instant.

`gfxinfo` reports **Total frames rendered0** at the checked start/end outputs. Therefore its zero-janky count and4950ms percentile are not usable frame-performance measurements. No zero-jank, optical FPS, continuous animation or general rendering-stability guarantee is made.

## Inherited presentation mismatch

After recall the large overlay is gone, the cat is home, and real device state is home, but the original bottom work pill still says “小橘跟去了…”. The source pill uses the scheduled `cd.t` while private callBack controls effective out/home. It predates this minimal projection hook and remains a **known presentation mismatch**; it is not used as protocol truth or silently described as fixed. This round did not alter025 to repair it.

## Release state and remaining scope

Final action/post records show explicit BLE disconnect, closing the dialog, restored physical1200×2670/density520, Quickstep Home, disconnected BLE and an empty screenrecord PID. Root reports the USB port released; this reviewer did not reopen it or perform a new USB clock read.

Limited actual pass: installation/data preservation, this natural original recall/scene-state loop, read-only page demonstration and this finite foreground observation. Still unverified: precise fresh device clock, optical badge animation/sliding/tearing, full graphically error-free operation, real new care/gift/bilateral completion, all gameplay/PRD features, system-font1.6, long-term memory behavior and fsync/power-loss recovery. No rollback or automatic publishing was executed by this reviewer.
