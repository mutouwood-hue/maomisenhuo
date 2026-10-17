/*
 * check-badge-spec.mjs - validate the interaction specification itself.
 *
 * gen-badge-ui.mjs already refuses to generate when it meets something it does not
 * model. This script answers the question that comes before that one: is the
 * specification package internally consistent, and does the rendering reference agree
 * with it?
 *
 * Two failure modes it exists to catch:
 *
 *  1. The specification and the reference renderer can drift apart. `badge_spec.json`
 *     and the `S` object inside 吧唧渲染参考.html both claim version 0.3.0, and the
 *     renderer is what the designers actually looked at. If a number changed in one
 *     and not the other, whichever the firmware chose would be wrong for somebody, so
 *     this script compares them field by field.
 *
 *  2. The generator models a fixed vocabulary. A new element type, screen or icon in
 *     a revised spec must fail here loudly rather than be dropped on the floor, which
 *     would put a blank spot on the glass that no test could see.
 *
 * Usage: node tools/check-badge-spec.mjs [--spec <path>] [--html <path>] [--quiet]
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const QUIET = argv.includes('--quiet');

const SPEC = resolve(argOf('--spec', join(ROOT, '_ref', 'baji-spec', '吧唧交互规范', 'badge_spec.json')));
const HTML = resolve(argOf('--html', join(ROOT, '_ref', 'baji-spec', '吧唧交互规范', '吧唧渲染参考.html')));
const ICON_DIR = join(dirname(SPEC), 'icons');
const SOUND_DIR = join(dirname(SPEC), 'sounds');

let problems = 0;
let checks = 0;
const bad = (msg) => {
  problems++;
  if (problems <= 40) console.error(`  FAIL ${msg}`);
};
const ok = (cond, msg) => {
  checks++;
  if (!cond) bad(msg);
  return cond;
};

if (!existsSync(SPEC)) {
  console.error(`check-badge-spec: spec not found at ${SPEC}`);
  process.exit(1);
}
const S = JSON.parse(readFileSync(SPEC, 'utf8'));
const log = (m) => {
  if (!QUIET) console.log(m);
};

/* ------------------------------------------------- the vocabulary the firmware has */

const SCREENS = [
  'main_a', 'main_b', 'main_c', 'aod', 'care_menu', 'care_feed', 'care_water', 'care_play',
  'care_sleep', 'sleeping', 'status', 'settings', 'touch_test', 'voice', 'meet', 'meet_tap',
  'meet_scan', 'meet_done', 'away', 'lowbat', 'boot', 'pair', 'guide',
];
const TYPES = new Set(['label', 'icon', 'battery', 'arc', 'alert', 'hit', 'dayring', 'btn',
  'segs', 'feather', 'zzz', 'bar', 'toggle', 'pill', 'wave', 'qr', 'hearts', 'dots']);
const FONTS = new Set(['f16', 'f20', 'f24', 'n40']);
const WHEN = new Set([undefined, 'phone', '!phone', 'alert']);

/* The acts the firmware implements (badge_spec.h's badge_act_t). A new act in the spec
 * means the gesture table has an action nothing handles. */
const ACTS = new Set([
  'pet', 'wake', 'bite', 'hold', 'settings', 'ver', 'meet_hi', 'meet_skip', 'meet_cancel',
  'home', 'call_home', 'guide_next', 'alert',
  'care:feed', 'care:water', 'care:play', 'care:sleep',
  'stat:food', 'stat:mood', 'stat:clean', 'stat:energy', 'stat:health',
  'set:bright', 'set:wake', 'set:discover', 'set:aod',
  'tt:1', 'tt:2', 'tt:3', 'tt:4', 'tt:5',
]);

/* ------------------------------------------------------------------ how to run --*/

log(`check-badge-spec: spec version ${S.version}`);

/* --- screens ----------------------------------------------------------------*/

const specScreens = Object.keys(S.screens || {});
for (const id of specScreens) {
  ok(SCREENS.includes(id), `screen "${id}" is in the spec but not in the firmware's list of 23`);
}
for (const id of SCREENS) {
  ok(specScreens.includes(id), `the firmware expects screen "${id}" but the spec does not define it`);
}
ok(specScreens.length === 23, `expected 23 screens, found ${specScreens.length}`);

let elements = 0;
const iconNames = new Set();
const actsSeen = new Set();
for (const id of specScreens) {
  const sc = S.screens[id];
  if (!ok(sc && typeof sc === 'object', `screen "${id}" is not an object`)) continue;
  ok(typeof sc.name === 'string' && sc.name.length > 0, `screen "${id}" has no name`);
  ok(typeof sc.doc === 'string' && sc.doc.length > 0, `screen "${id}" has no doc`);
  for (const [gesture, effect] of Object.entries(sc.gest || {})) {
    ok(typeof effect === 'string' && effect.length > 0,
       `screen "${id}" gesture "${gesture}" has no effect text`);
  }
  for (const el of sc.els || []) {
    elements++;
    ok(typeof el.id === 'string' && el.id, `screen "${id}" has an element with no id`);
    ok(TYPES.has(el.t), `screen "${id}" element "${el.id}" has unknown type "${el.t}"`);
    if (el.font !== undefined) {
      ok(FONTS.has(el.font), `screen "${id}" element "${el.id}" has unknown font "${el.font}"`);
    }
    ok(WHEN.has(el.when), `screen "${id}" element "${el.id}" has unknown when "${el.when}"`);
    if (el.act !== undefined) {
      ok(ACTS.has(el.act), `screen "${id}" element "${el.id}" has unhandled act "${el.act}"`);
      actsSeen.add(el.act);
    }
    if (el.icon !== undefined && !el.icon.startsWith('{')) iconNames.add(el.icon);
    if (el.color !== undefined) ok(S.colors[el.color] !== undefined, `unknown colour "${el.color}"`);
    if (el.bg !== undefined) ok(S.colors[el.bg] !== undefined, `unknown colour "${el.bg}"`);
    if (el.fg !== undefined) ok(S.colors[el.fg] !== undefined, `unknown colour "${el.fg}"`);
    if (el.ring !== undefined) ok(S.colors[el.ring] !== undefined, `unknown colour "${el.ring}"`);
    if (el.track !== undefined) ok(S.colors[el.track] !== undefined, `unknown colour "${el.track}"`);
    if (el.value !== undefined && typeof el.value === 'string' && el.t !== 'dots') {
      const known = ['food', 'mood', 'clean', 'energy', 'health', 'bright', 'wake', 'discover', 'aod'];
      ok(known.includes(el.value), `element "${el.id}" has unknown value "${el.value}"`);
    }
  }
}
log(`  ${specScreens.length} screens, ${elements} elements, ${iconNames.size} distinct icons`);

/* --- colours, fonts, timing, thresholds -------------------------------------*/

for (const [name, hex] of Object.entries(S.colors || {})) {
  ok(/^#[0-9a-fA-F]{6}$/.test(hex), `colour "${name}" is not #rrggbb: ${hex}`);
}
for (const key of Object.keys(S.fonts || {})) {
  ok(FONTS.has(key), `font "${key}" is not one of the four the firmware ships`);
}
ok(Object.keys(S.fonts || {}).length === 4, 'the spec must define exactly four fonts');

const T = S.timing || {};
const REQUIRED_TIMING = [
  'tapMaxMs', 'tapMoveMax', 'longPressMs', 'swipeMinPx', 'swipeMaxMs', 'transitionMs', 'toastMs',
  'bubbleMs', 'playToCompMs', 'compToAodMs', 'aodRedrawMs', 'careCooldownMs', 'petCooldownMs',
  'biteGapMs', 'voiceMaxMs', 'voiceSilenceMs', 'voiceThinkMs', 'meetTimeoutMs',
  'tapConfirmTimeoutMs', 'meetDoneMs', 'quirkMinMs', 'quirkMaxMs', 'quirkIdleMs', 'sleepHoldMs',
  'sleepDemoMs', 'playPounceSpeed', 'playPounceGapMs', 'playTimeoutMs', 'bootMs', 'callHomeMs',
];
for (const k of REQUIRED_TIMING) {
  ok(typeof T[k] === 'number' && T[k] > 0, `timing.${k} is missing or not a positive number`);
}
ok(T.quirkMinMs < T.quirkMaxMs, 'timing.quirkMinMs must be below quirkMaxMs');
ok((S.modes?.play?.res ?? 0) < (S.modes?.comp?.res ?? 0),
   'the interactive mode must render at the lower resolution');

const TH = S.thresholds || {};
for (const k of ['lowStat', 'full', 'moodFull', 'minEnergyPlay', 'batNoWake', 'batCritical']) {
  ok(typeof TH[k] === 'number', `thresholds.${k} is missing`);
}
ok(TH.batCritical < TH.batNoWake, 'the critical battery level must be below the wake-word cutoff');

/* --- the five care actions ---------------------------------------------------*/

const CARE = ['pet', 'feed', 'water', 'play', 'sleep'];
ok(Object.keys(S.care || {}).length === 5, 'the spec must define exactly five care actions');
for (const k of CARE) {
  const c = S.care?.[k];
  if (!ok(c, `care "${k}" is missing`)) continue;
  ok(typeof c.label === 'string' && c.label.length > 0, `care "${k}" has no label`);
  ok(typeof c.growth === 'number', `care "${k}" has no growth`);
  for (const stat of Object.keys(c.delta || {})) {
    ok(['food', 'mood', 'clean', 'energy', 'health'].includes(stat),
       `care "${k}" changes unknown stat "${stat}"`);
  }
  for (const rule of c.block || []) {
    ok(rule.length === 4, `care "${k}" has a malformed block rule`);
    const [stat, op, value, msg] = rule;
    ok(['food', 'mood', 'clean', 'energy', 'health', 'sick', 'coins'].includes(stat),
       `care "${k}" blocks on unknown stat "${stat}"`);
    ok(['>=', '<', '=='].includes(op), `care "${k}" uses unknown operator "${op}"`);
    ok(typeof value === 'number', `care "${k}" block value is not a number`);
    ok(typeof msg === 'string' && msg.length > 0, `care "${k}" block rule has no message`);
  }
}

/* --- events, voice, guide, quirks ------------------------------------------*/

ok((S.events || []).length === 14, `expected 14 event types, found ${(S.events || []).length}`);
(S.events || []).forEach(([num], i) => ok(num === i + 1, `event ${i + 1} is numbered ${num}`));
ok((S.voice || []).length === 17, `expected 17 voice commands, found ${(S.voice || []).length}`);
ok((S.guide || []).length === 5, `expected 5 guide pages, found ${(S.guide || []).length}`);
ok((S.quirks || []).length === 4, `expected 4 quirks, found ${(S.quirks || []).length}`);
ok((S.stages || []).length === 3, `expected 3 life stages, found ${(S.stages || []).length}`);
ok((S.stats || []).length === 5, `expected 5 stats, found ${(S.stats || []).length}`);
ok((S.touchTest || []).length === 5, `expected 5 touch targets, found ${(S.touchTest || []).length}`);
ok((S.alerts || []).length === 5, `expected 5 alerts, found ${(S.alerts || []).length}`);
/* The alert list is the priority order, and the reference says so in a comment. If
 * someone reorders it, the badge would send the owner to the wrong care screen. */
ok(S.alerts?.[0]?.[0] === 'sick', 'the first alert must be the illness alert');
const alertOrder = (S.alerts || []).slice(1).map((a) => a[0]);
ok(JSON.stringify(alertOrder) === JSON.stringify(['food', 'energy', 'mood', 'clean']),
   `alert priority changed: ${alertOrder.join(' > ')}`);

/* --- the hardware facts -----------------------------------------------------*/

for (const k of ['motor', 'speaker', 'nfc', 'imu']) {
  ok(typeof S.hw?.[k] === 'boolean', `hw.${k} is missing`);
}
ok(typeof S.hw?.touchAddr === 'number', 'hw.touchAddr is missing');
ok(typeof S.hw?.touchMax === 'number', 'hw.touchMax is missing');
ok(typeof S.hapticFallback?.ms === 'number', 'hapticFallback.ms is missing');

/* --- the icons the firmware must ship --------------------------------------*/

if (existsSync(ICON_DIR)) {
  const files = readdirSync(ICON_DIR);
  const present = new Set();
  for (const f of files) {
    const base = f.replace(/\.png$/i, '').replace(/@3x$/i, '');
    present.add(base);
  }
  for (const name of iconNames) {
    ok(present.has(name), `icon "${name}" is referenced by a screen but no PNG provides it`);
  }
  log(`  ${iconNames.size} referenced icons, ${present.size} PNG names available`);
} else {
  log(`  (icons directory not found at ${ICON_DIR}; skipping the icon-name check)`);
}

if (existsSync(SOUND_DIR)) {
  const files = readdirSync(SOUND_DIR);
  for (const want of ['blip', 'bonk', 'chime', 'meow_happy', 'meow_short']) {
    ok(files.some((f) => f.startsWith(want) && f.endsWith('.wav')),
       `prompt sound "${want}.wav" is missing from the package`);
  }
} else {
  log(`  (sounds directory not found at ${SOUND_DIR}; skipping the sound check)`);
}

/* ------------------------------------------ the reference renderer's own copy --*/

/*
 * The renderer embeds the same data as a JS expression: `const SPEC=(()=>{ const C=233;
 * const S={...}; return S; })();`. It is extracted whole -- the inner object literal
 * on its own does not survive evaluation, because it refers to `C` -- and evaluated so
 * the two copies can be compared field by field. JSON.parse cannot be used: the
 * literal's keys are unquoted.
 *
 * The expression is project data that ships with the specification, and it is guarded
 * below: anything that could reach outside the expression is refused rather than run.
 */
function sliceStatement(text, from) {
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let seen = false;
  let inString = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === inString) inString = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '(') {
      paren++;
      seen = true;
    } else if (ch === ')') paren--;
    else if (ch === '{') {
      brace++;
      seen = true;
    } else if (ch === '}') brace--;
    else if (ch === '[') {
      bracket++;
      seen = true;
    } else if (ch === ']') bracket--;
    else if (ch === ';' && seen && paren === 0 && brace === 0 && bracket === 0) {
      return text.slice(from, i);
    }
    if (paren < 0 || brace < 0 || bracket < 0) return null;
  }
  return null;
}

if (existsSync(HTML)) {
  const html = readFileSync(HTML, 'utf8');
  const marker = html.indexOf('const SPEC=');
  const stmt = marker >= 0 ? sliceStatement(html, html.indexOf('=', marker) + 1) : null;
  const literal = stmt;
  if (!literal) {
    log("  (the reference renderer's data expression was not found; skipping the comparison)");
  } else {
    /* The expression must be a self-contained IIFE over its own literals. These are the
     * tokens that would let it reach the page, the process or the network; none of them
     * belongs in a data expression, so their presence means the file is not the data
     * file this script believes it is. */
    const forbidden = ['require(', 'process.', 'globalThis', 'window.', 'document.',
                       'import ', 'eval(', 'constructor', 'fetch(', 'XMLHttpRequest',
                       'localStorage', 'Function('];
    const hit = forbidden.find((f) => literal.includes(f));
    if (hit) {
      bad(`the reference renderer's data expression contains "${hit}"; refusing to evaluate it`);
    } else {
      let ref;
      try {
        ref = new Function(`"use strict";return (${literal});`)();
      } catch (err) {
        bad(`the reference renderer's data expression did not evaluate: ${err.message}`);
      }
      if (ref) {
        const compare = (path, a, b) => {
          const ja = JSON.stringify(a);
          const jb = JSON.stringify(b);
          if (ja !== jb) {
            const short = (s) => (s && s.length > 240 ? `${s.slice(0, 240)}...` : s);
            bad(`${path} differs:\n      spec: ${short(ja)}\n      html: ${short(jb)}`);
          } else checks++;
        };
        for (const key of ['version', 'screen', 'colors', 'fonts', 'modes', 'timing', 'thresholds',
                           'care', 'stats', 'stages', 'alerts', 'quirks', 'places', 'voice',
                           'texts', 'events', 'touchTest', 'components', 'hw', 'hapticFallback']) {
          if (ref[key] === undefined) {
            /* The renderer need not mirror every section; say so rather than pass. */
            log(`  (the reference renderer does not define "${key}")`);
            continue;
          }
          compare(key, S[key], ref[key]);
        }
        /* Screens: compare element ids, types and coordinates exactly, so a button moved
         * in one copy cannot silently disagree with the other. */
        let compared = 0;
        for (const id of specScreens) {
          if (!ref.screens || !ref.screens[id]) {
            bad(`the reference renderer has no screen "${id}"`);
            continue;
          }
          const pick = (e) => [e.id, e.t, e.x, e.y, e.w, e.h, e.r, e.a0, e.a1];
          compare(`screens.${id}.els`, (S.screens[id].els || []).map(pick),
                  (ref.screens[id].els || []).map(pick));
          compared++;
        }
        log(`  compared ${compared} screens against the reference renderer`);
        ok(compared === specScreens.length,
           `only ${compared} of ${specScreens.length} screens could be compared with the renderer`);
      }
    }
  }
} else {
  log(`  (reference renderer not found at ${HTML}; skipping the comparison)`);
}

/* --- the generated header's own constants ----------------------------------*/

const HEADER = join(ROOT, 'main', 'ui', 'badge_spec_data.h');
if (existsSync(HEADER)) {
  const h = readFileSync(HEADER, 'utf8');
  ok(h.includes(`#define BADGE_SPEC_VERSION "${S.version}"`),
     `the generated header does not carry spec version ${S.version}; run the generator`);
  ok(h.includes(`#define BADGE_HW_MOTOR ${S.hw.motor ? 1 : 0}`),
     'the generated header disagrees with hw.motor');
} else {
  bad(`${HEADER} does not exist; run node tools/gen-badge-ui.mjs`);
}

/* ------------------------------------------------------------------- verdict ---*/

if (problems) {
  console.error(`check-badge-spec: ${problems} problem(s) in ${checks} checks`);
  process.exit(1);
}
console.log(`check-badge-spec: OK (${checks} checks)`);
