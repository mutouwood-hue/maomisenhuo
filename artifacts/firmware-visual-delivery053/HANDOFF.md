# 053 startup correction for the052 day expectation slice

052 was physically installed, but a single passive ordinary startup capture
reported one main-task stack overflow and automatic reboot before a later boot
reached BLE advertisement.052 is NOT accepted as stable; its source, package and
capture remain frozen and retained. No repeated serial experiments were run.

Actual source: main stack was3584B; badge_ui_start calls a nested refresh_state
whose compiled entry frame alone is0x6b0 (1712B), inside the GUI/bootstrap path.
The corrupted overflow backtrace cannot uniquely prove a single new callee.
053 explicitly budgets8192B for main startup and defers that initial refresh to
the already existing GUI timer instead of nesting it in app_main. The GUI tick
and its normal33ms cadence already execute the same refresh. No new task/timer,
render pipeline, wire/storage behavior or extra persistent state is introduced.
Main exits after bootstrap as before. Ordinary build and normal protected app-only
installation only; no technical tests, benchmarks or runtime simulations.

All approved052 future/past/now presentation below is retained. Actual status
is recorded separately by the unique device coordinator; user visual acceptance
is pending.052 must not be presented as the final stable candidate.

---

# 052 day expectation / parent install handoff

Version0.5.2-day-expectation, isolated source from frozen051. Ordinary offline
ESP-IDF build and asset generation only; no technical tests, runtime previews,
benchmarks or repeated serial experiments. Hardware installation is authorized
but must use the final FROZEN artifact after the build completes.

## Presentation behavior

- The badge day-ring cursor can browse0..1439, including future/no-history areas.
  Pointer capture, touch-to-settle hold and051 display mechanism remain.
- Existing phone-calibrated monotonic time is authoritative. Compare the received
  day date and timezone with this reliable date/time; never infer now from the
  final segment, day cutoff, demo schedule or the selected cursor.
- A genuinely future selection keeps the original cat in a neutral home/idle
  presentation, with short bubble `接下来，会有什么呢？` and `尚未发生` label.
  It never reads a last history event as fallback. This is anticipation, not an
  emitted action, invented event, reward, future schedule prediction or storage.
- Historical solid arcs stop at min(selected time, reliable now), and still only
  draw actually received history rows. Future now-to-cursor is pale dashed arc.
  Cursor remains at selected minute. No full-screen/high-frequency animation is
  added: drawing follows ordinary invalidation, with bounded <=120 short strokes.
  Drag changes invalidate four rim strips plus the existing label/cat changes.
- Dragging into the past restores exactly the corresponding received row, its
  observed/inferred/demo provenance or an explicit no-record state. The source
  mode/provenance is never promoted. No row is synthesized for a history gap.
- A light inner tap returns to now and the actual accepted current snapshot,
  rather than playing a historical row as current. Follow-now advances with the
  calibrated minute. If no calibrated time exists, show `需手机校时`, keep a
  neutral cat, omit future classification/solid progress/future dashes.
- Future bubble is centered at233/174,270px width with padding; selection label
  stays at233/365. Uses same-size OFL glyph supplements, not size fallbacks.
  Original cat poses and static day presentation reused; no new cat asset/engine.

## Unchanged boundaries

- No wire/receiver schema or day payload change. Phone and badge selected cursors
  remain LOCAL browsing state: the existing day rev1 carries received historical
  data, not a phone cursor. Phone selection mirroring is not claimed.
- Core, events, terminal ACK/reason, FIFO, identity/owner, NVS, billing/rewards,
  BLE/reconnect/keepalive and day receiver remain byte-identical to051. The wire
  source changes only the firmware version string.
- Private BSP/adapter,48-row internal DMA pair and10-row fallback remain051.
  TE remains OFF until the actual board revision is confirmed. No display
  refresh redesign, frequency change or hardware probing.
- Same original app partition0x820000, no NVS/selector/partition-table erase.
  Schema3 from050/051 is retained; no downgrade to049 or old incompatible app.
- Phone038/code29 is now preserve-data installed under parent coordination.
  The existing protocol and local cursor boundary remain the same.

## Deliverables and actual status

`manifest.json`, `FROZEN.json`, `source-hashes.json`, `SOURCE-DELTA.json` and
`source-delta.patch` identify the final ordinary build and exact artifacts.
The candidate source stops changing when sealed. Installation and real usage
are recorded separately under device-backups/device-integration, never inferred
from compilation or the previous051 acceptance. User remains final visual
acceptor for the circular layout, movement and future/past transitions.
