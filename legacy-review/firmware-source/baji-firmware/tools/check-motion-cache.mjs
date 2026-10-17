import fs from 'node:fs';
import assert from 'node:assert/strict';
const src = fs.readFileSync('main/ui/badge_ui.c', 'utf8');
const start = src.indexOf('static bool ui_motion_begin(');
assert(start >= 0);
const end = src.indexOf('\nstatic void ui_motion_warm(', start);
assert(end > start);
const begin = src.slice(start, end);
for (const forbidden of ['lv_snapshot_', 'badge_ui_rebuild(', 'badge_ui_refresh(', 'heap_caps_malloc(', 'badge_cat_layer_tick(', 'ui_motion_prepare('])
  assert(!begin.includes(forbidden), `input activation must not call ${forbidden}`);
const warm = src.slice(end, src.indexOf('\nvoid badge_ui_motion_frame(', end));
assert(warm.includes('ui->finger_down || ui->motion_on || ui->trans_on'));
assert(warm.includes('return; /* At most one destination per idle iteration. */'));
assert(begin.includes('ui->motion_live_fallback = !ready'));
assert(src.includes('heap_caps_free(ui->cached_pixels[i])'));
console.log('motion cache source guard: PASS (activation has no snapshot/rebuild/allocation/rasterisation; idle gate and cleanup present)');
console.log('This source guard is NOT an executable LVGL integration or latency test.');
