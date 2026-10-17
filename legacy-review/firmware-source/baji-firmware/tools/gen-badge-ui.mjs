/*
 * gen-badge-ui.mjs - turn 吧唧交互规范/badge_spec.json into the firmware's tables.
 *
 * The interaction specification is the only source of truth for the badge UI: 23
 * screens, 151 elements, the colours, the four fonts, the timings, the care
 * numbers, the 14 uplink events and every Chinese string. This script reads that
 * JSON and writes main/ui/badge_spec_data.{h,c}, so the firmware never carries a
 * second, hand-typed copy of a coordinate.
 *
 * It is deliberately strict. An element key the firmware does not model is an
 * error, not a warning: silently dropping a property the reference renders is how
 * a screen ends up subtly wrong on the glass while every test still passes. The
 * same goes for a screen order the enum does not match, an unknown element type,
 * or an icon name the assets script does not provide.
 *
 * Usage:  node tools/gen-badge-ui.mjs [--spec <path>] [--out-dir <dir>] [--check]
 *         --check  verify the generated files are current, write nothing
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const CHECK_ONLY = argv.includes('--check');
const SPEC_PATH = resolve(
  argOf('--spec', join(ROOT, '_ref', 'baji-spec', '吧唧交互规范', 'badge_spec.json')),
);
const OUT_DIR = resolve(argOf('--out-dir', join(ROOT, 'main', 'ui')));

/* --------------------------------------------------------------- helpers ----*/

const fail = (msg) => {
  console.error(`gen-badge-ui: ERROR: ${msg}`);
  process.exit(1);
};

const cString = (s) =>
  '"' +
  String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    // Keep the source ASCII-safe for any compiler locale, the same way the rest
    // of this firmware writes Chinese as UTF-8 escapes in generated data.
    .replace(/[^\x20-\x7e]/gu, (ch) => {
      const cp = ch.codePointAt(0);
      return cp > 0xffff
        ? `\\U${cp.toString(16).padStart(8, '0')}`
        : `\\u${cp.toString(16).padStart(4, '0')}`;
    }) +
  '"';

/* One pool for every string in the generated tables, so the .c file has no string
 * literal duplicated between an element and a text entry. */
class Pool {
  constructor() {
    this.items = [];
    this.index = new Map();
  }
  add(s) {
    if (s === undefined || s === null || s === '') return 0;
    const key = String(s);
    if (this.index.has(key)) return this.index.get(key);
    const i = this.items.length + 1; // 0 is reserved for "none"
    this.items.push(key);
    this.index.set(key, i);
    return i;
  }
}

const to565 = (rgb888) => {
  const r = (rgb888 >> 16) & 0xff;
  const g = (rgb888 >> 8) & 0xff;
  const b = rgb888 & 0xff;
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
};

const ident = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/* ---------------------------------------------------------------- the spec --*/

if (!existsSync(SPEC_PATH)) {
  fail(
    `spec not found at ${SPEC_PATH}\n` +
      '  The interaction specification ships as a zip; extract it to _ref/baji-spec/ ' +
      '(see docs/badge-spec.md) or pass --spec <path>.',
  );
}
const S = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));

/* --- vocabulary the firmware models ----------------------------------------*/

const TYPE_MAP = {
  label: 'BE_LABEL',
  icon: 'BE_ICON',
  battery: 'BE_BATTERY',
  arc: 'BE_ARC',
  alert: 'BE_ALERT',
  hit: 'BE_HIT',
  dayring: 'BE_DAYRING',
  btn: 'BE_BTN',
  segs: 'BE_SEGS',
  feather: 'BE_FEATHER',
  zzz: 'BE_ZZZ',
  bar: 'BE_BAR',
  toggle: 'BE_TOGGLE',
  pill: 'BE_PILL',
  wave: 'BE_WAVE',
  qr: 'BE_QR',
  hearts: 'BE_HEARTS',
  dots: 'BE_DOTS',
};

const FONT_MAP = { f16: 'BADGE_FONT_F16', f20: 'BADGE_FONT_F20', f24: 'BADGE_FONT_F24', n40: 'BADGE_FONT_N40' };
const ALIGN_MAP = { center: 'BADGE_ALIGN_CENTER', left: 'BADGE_ALIGN_LEFT', right: 'BADGE_ALIGN_RIGHT' };
const WHEN_MAP = { phone: 'BADGE_WHEN_PHONE', '!phone': 'BADGE_WHEN_NO_PHONE', alert: 'BADGE_WHEN_ALERT' };
const SCREEN_NAMES = [
  'main_a', 'main_b', 'main_c', 'aod', 'care_menu', 'care_feed', 'care_water', 'care_play',
  'care_sleep', 'sleeping', 'status', 'settings', 'touch_test', 'voice', 'meet', 'meet_tap',
  'meet_scan', 'meet_done', 'away', 'lowbat', 'boot', 'pair', 'guide',
];
const STAT_NAMES = (S.stats || []).map(([k]) => k);
const STAT_ENUM = { food: 'BADGE_VALUE_FOOD', mood: 'BADGE_VALUE_MOOD', clean: 'BADGE_VALUE_CLEAN', energy: 'BADGE_VALUE_ENERGY', health: 'BADGE_VALUE_HEALTH' };
const SETTING_NAMES = ['bright', 'wake', 'discover', 'aod'];
const SETTING_ENUM = { bright: 'BADGE_VALUE_BRIGHT', wake: 'BADGE_VALUE_WAKE', discover: 'BADGE_VALUE_DISCOVER', aod: 'BADGE_VALUE_AOD' };
const CARE_NAMES = Object.keys(S.care || {});
const CARE_ENUM = { pet: 'BADGE_CARE_PET', feed: 'BADGE_CARE_FEED', water: 'BADGE_CARE_WATER', play: 'BADGE_CARE_PLAY', sleep: 'BADGE_CARE_SLEEP' };

const ACT_MAP = {
  pet: 'BADGE_ACT_PET',
  wake: 'BADGE_ACT_WAKE',
  bite: 'BADGE_ACT_BITE',
  hold: 'BADGE_ACT_HOLD',
  settings: 'BADGE_ACT_SETTINGS',
  ver: 'BADGE_ACT_VER',
  meet_hi: 'BADGE_ACT_MEET_HI',
  meet_skip: 'BADGE_ACT_MEET_SKIP',
  meet_cancel: 'BADGE_ACT_MEET_CANCEL',
  home: 'BADGE_ACT_HOME',
  call_home: 'BADGE_ACT_CALL_HOME',
  guide_next: 'BADGE_ACT_GUIDE_NEXT',
  alert: 'BADGE_ACT_ALERT',
  'care:feed': 'BADGE_ACT_CARE_FEED',
  'care:water': 'BADGE_ACT_CARE_WATER',
  'care:play': 'BADGE_ACT_CARE_PLAY',
  'care:sleep': 'BADGE_ACT_CARE_SLEEP',
  'stat:food': 'BADGE_ACT_STAT_FOOD',
  'stat:mood': 'BADGE_ACT_STAT_MOOD',
  'stat:clean': 'BADGE_ACT_STAT_CLEAN',
  'stat:energy': 'BADGE_ACT_STAT_ENERGY',
  'stat:health': 'BADGE_ACT_STAT_HEALTH',
  'set:bright': 'BADGE_ACT_SET_BRIGHT',
  'set:wake': 'BADGE_ACT_SET_WAKE',
  'set:discover': 'BADGE_ACT_SET_DISCOVER',
  'set:aod': 'BADGE_ACT_SET_AOD',
};
for (let i = 1; i <= 5; i++) ACT_MAP[`tt:${i}`] = `BADGE_ACT_TT_${i}`;

/* Element keys this generator understands. `id` and `t` are always present. */
const KNOWN_KEYS = new Set([
  'id', 't', 'x', 'y', 'w', 'h', 'r', 'r2', 'w2', 'a0', 'a1', 'n', 'gap', 'quiet',
  'font', 'color', 'bg', 'fg', 'ring', 'track', 'align', 'text', 'icon', 'scale',
  'act', 'when', 'value', 'care', 'hold', 'pulse', 'rev', 'hearts', 'anim', 'long', 'tt',
]);

const els = [];
const screens = [];
const gests = [];
const strings = new Pool();
const iconNames = []; // in emitted order; dynamic icons are not in here
const iconIndex = new Map();
const iconOf = (name) => {
  if (!iconIndex.has(name)) {
    iconIndex.set(name, iconNames.length);
    iconNames.push(name);
  }
  return iconIndex.get(name);
};

/* --- the icon list -------------------------------------------------------- */

const NUM_KEYS = ['x', 'y', 'w', 'h', 'r', 'r2', 'w2', 'a0', 'a1', 'n', 'gap', 'quiet'];

let elementCount = 0;
const colorNames = Object.keys(S.colors);

for (const screenId of SCREEN_NAMES) {
  const sc = S.screens[screenId];
  if (!sc) fail(`screen "${screenId}" is missing from the spec`);
  if (sc.name === undefined) fail(`screen "${screenId}" has no name`);

  let hasCat = 0;
  let cat = { dist: 0, ox: 0, oy: 0, dim_pct: 100, flags: 0 };
  if (sc.cat) {
    hasCat = 1;
    const f = [];
    if (sc.cat.still) f.push('BADGE_CATF_STILL');
    if (sc.cat.peer) f.push('BADGE_CATF_PEER');
    cat = {
      dist: sc.cat.dist ?? 0,
      ox: sc.cat.ox ?? 0,
      oy: sc.cat.oy ?? 0,
      dim_pct: Math.round((sc.cat.dim ?? 1) * 100),
      flags: f.length ? f.join(' | ') : '0',
    };
  }

  let gestFirst = gests.length;
  let gestCount = 0;
  for (const [gesture, effect] of Object.entries(sc.gest || {})) {
    gests.push({ screenId, gesture, effect: strings.add(effect) });
    gestCount++;
    void gesture;
  }

  const elFirst = els.length;
  for (const raw of sc.els || []) {
    for (const k of Object.keys(raw)) {
      if (!KNOWN_KEYS.has(k)) {
        fail(`screen "${screenId}" element "${raw.id}" has unmodelled key "${k}"`);
      }
    }
    const type = TYPE_MAP[raw.t];
    if (!type) fail(`screen "${screenId}" element "${raw.id}" has unknown type "${raw.t}"`);

    let iconVal = 'BADGE_ICON_NONE';
    if (raw.icon !== undefined) {
      if (raw.icon === '{placeIcon}') iconVal = 'BADGE_ICON_DYN_PLACE';
      else if (raw.icon === '{guideIcon}') iconVal = 'BADGE_ICON_DYN_GUIDE';
      else if (raw.icon.startsWith('{')) fail(`element "${raw.id}" uses unmodelled dynamic icon ${raw.icon}`);
      else iconVal = String(iconOf(raw.icon));
    }

    let value = 'BADGE_VALUE_NONE';
    if (raw.value !== undefined) {
      if (raw.t === 'dots') value = 'BADGE_VALUE_GUIDE';
      else if (STAT_ENUM[raw.value]) value = STAT_ENUM[raw.value];
      else if (SETTING_ENUM[raw.value]) value = SETTING_ENUM[raw.value];
      else fail(`element "${raw.id}" has unmodelled value "${raw.value}"`);
    }

    let act = 'BADGE_ACT_NONE';
    if (raw.act !== undefined) {
      act = ACT_MAP[raw.act];
      if (!act) fail(`element "${raw.id}" has unmodelled act "${raw.act}"`);
    } else if (raw.t === 'alert') {
      act = 'BADGE_ACT_ALERT';
    }

    let care = 'BADGE_CARE_NONE';
    if (raw.care !== undefined) {
      care = CARE_ENUM[raw.care];
      if (!care) fail(`element "${raw.id}" has unmodelled care "${raw.care}"`);
    }

    let flags = 0;
    if (raw.rev) flags |= 1 << 0;
    if (raw.hearts) flags |= 1 << 1;
    if (raw.pulse) flags |= 1 << 2;
    if (raw.anim) flags |= 1 << 3;

    /* BE_BTN with hold=1 is the sleep button: the spec times it with sleepHoldMs.
     * BE_HIT with long=<ms> is the hidden developer entry (three seconds on the
     * firmware version), which carries its own value. */
    let holdMs = 0;
    if (raw.t === 'btn' && raw.hold) {
      act = 'BADGE_ACT_HOLD';
      holdMs = S.timing.sleepHoldMs;
    }
    if (raw.t === 'hit' && raw.long) holdMs = raw.long;

    // Screen-level "still" flag propagates to the cat, and any element may carry
    // it in the spec's own words; both are handled where they appear.
    const e = {
      type,
      font: FONT_MAP[raw.font] ?? 'BADGE_FONT_F16',
      align: ALIGN_MAP[raw.align] ?? 'BADGE_ALIGN_CENTER',
      color: raw.color ? colorNames.indexOf(raw.color) : -1,
      bg: raw.bg ? colorNames.indexOf(raw.bg) : -1,
      fg: raw.fg ? colorNames.indexOf(raw.fg) : -1,
      ring: raw.ring ? colorNames.indexOf(raw.ring) : -1,
      track: raw.track ? colorNames.indexOf(raw.track) : -1,
      when: raw.when ? WHEN_MAP[raw.when] : 'BADGE_WHEN_ALWAYS',
      act,
      value,
      flags,
      scale_x2: raw.scale !== undefined ? Math.round(raw.scale * 2) : 2,
      care,
      text: strings.add(raw.text),
      id: strings.add(raw.id),
      icon: iconVal,
      hold_ms: holdMs,
    };
    for (const name of ['color', 'bg', 'fg', 'ring', 'track']) {
      if (raw[name] && colorNames.indexOf(raw[name]) < 0) fail(`element "${raw.id}" uses unknown colour "${raw[name]}"`);
    }
    const n = {};
    for (const k of NUM_KEYS) n[k] = raw[k] ?? 0;
    Object.assign(e, n);
    els.push(e);
    elementCount++;
  }

  screens.push({
    id: screenId,
    name: strings.add(sc.name),
    doc: strings.add(sc.doc),
    enter: strings.add(sc.enter),
    exit: strings.add(sc.exit),
    el_first: elFirst,
    el_count: els.length - elFirst,
    gest_first: gestFirst,
    gest_count: gestCount,
    has_cat: hasCat,
    cat,
  });
  void gestFirst;
}

/* --- the icon list ---------------------------------------------------------*/

/* `iconOf()` registers a name the first time the spec's element table mentions it, so
 * the emitted order is the order the spec uses them -- and every element's index is
 * the spec's own order, with nothing shifted.
 *
 * One icon is registered here, after that loop, because no element names it: `bolt`.
 * The package's own badge_ui_spec.h declares BADGE_ICON_BOLT, icons/bolt.png ships
 * with it, and the reference renderer draws it INSIDE the battery element while
 * charging (`g.fillStyle=col(ST.usb?'ok':ST.bat<TH.batNoWake?'warn':'text');
 * g.fillRect(...); if(ST.usb)icon('bolt',el.x-1,el.y+2,.75)`), but badge_spec.json has
 * no element for it -- it is a decoration of the battery primitive, not an element.
 * Appending it makes BADGE_ICON_COUNT 28, the count badge_spec.h documents and the
 * count of icons the package ships; it lets badge_paint_battery() draw the real bolt
 * instead of the bat_low stand-in it used while the index was missing; and it makes
 * the assets generator's "the emitted set is exactly icons/*.png" assertion complete.
 * Appending rather than prepending matters: the dynamic-icon sentinels and every
 * element's stored index must not move. */
iconOf('bolt');

/* --- colours ---------------------------------------------------------------*/

const colors = colorNames.map((n) => {
  const hex = S.colors[n];
  const v = parseInt(hex.replace('#', ''), 16);
  return { name: n, rgb888: v, rgb565: to565(v) };
});

/* --- care, blocks ----------------------------------------------------------*/

const blocks = [];
const careDefs = [];
for (const name of CARE_NAMES) {
  const c = S.care[name];
  const first = blocks.length;
  for (const [statName, op, value, msg] of c.block || []) {
    let stat;
    if (statName === 'sick') stat = 'BADGE_STAT_SICK';
    else if (statName === 'coins') stat = 'BADGE_STAT_COINS';
    else if (STAT_NAMES.includes(statName)) stat = `BADGE_STAT_${statName.toUpperCase()}`;
    else fail(`care "${name}" blocks on unknown stat "${statName}"`);
    const opEnum = { '>=': 'BADGE_OP_GE', '<': 'BADGE_OP_LT', '==': 'BADGE_OP_EQ' }[op];
    if (!opEnum) fail(`care "${name}" uses unknown operator "${op}"`);
    blocks.push({ stat, op: opEnum, value, text: strings.add(msg) });
  }
  const delta = [0, 0, 0, 0, 0];
  for (const [k, v] of Object.entries(c.delta || {})) {
    const i = STAT_NAMES.indexOf(k);
    if (i < 0) fail(`care "${name}" changes unknown stat "${k}"`);
    delta[i] = v;
  }
  careDefs.push({
    name,
    label: strings.add(c.label),
    delta,
    growth: c.growth ?? 0,
    coins: c.coins ?? 0,
    steps: c.steps ?? 0,
    block_first: first,
    block_count: blocks.length - first,
  });
}

/* --- alerts ----------------------------------------------------------------*/

const alerts = (S.alerts || []).map(([stat, icon, text]) => {
  if (stat === 'sick') {
    return { stat: 'BADGE_STAT_SICK', icon: String(iconOf(icon)), text: strings.add(text), action: 'BADGE_ACT_ALERT' };
  }
  if (!STAT_NAMES.includes(stat)) fail(`alert for unknown stat "${stat}"`);
  const action =
    { food: 'BADGE_ACT_CARE_FEED', energy: 'BADGE_ACT_CARE_SLEEP', mood: 'BADGE_ACT_CARE_PLAY' }[stat] ||
    'BADGE_ACT_ALERT';
  return { stat: `BADGE_STAT_${stat.toUpperCase()}`, icon: String(iconOf(icon)), text: strings.add(text), action };
});

/* --- quirks, places, voice, guide, touch test ------------------------------*/

/* The animation clip the reference plays for each quirk, from its drawCat():
 * spin -> walk, lick -> paw, jump -> a hop (drawn as paw, since cat3d has no hop
 * track), stare -> no clip at all (the reference turns the head, not the body). */
const QUIRK_ANIM = { idle: 0, walk: 1, paw: 2 };
const quirks = (S.quirks || []).map((q) => ({
  id: strings.add(q.id),
  name: strings.add(q.name),
  icon: String(iconOf(q.icon)),
  ms: q.ms,
  anim: QUIRK_ANIM[q.id === 'spin' ? 'walk' : q.id === 'lick' || q.id === 'jump' ? 'paw' : 'idle'],
}));
const places = Object.entries(S.places || {}).map(([, p]) => ({
  icon: String(iconOf(p.icon)),
  text: strings.add(p.text),
  sub: strings.add(p.sub),
}));
const voice = (S.voice || []).map(([num, word, action, reply]) => ({
  num,
  word: strings.add(word),
  action: strings.add(action),
  reply: strings.add(reply),
}));
const guide = (S.guide || []).map(([icon, title, sub]) => ({
  icon: String(iconOf(icon)),
  title: strings.add(title),
  sub: strings.add(sub),
}));
const touchTest = (S.touchTest || []).map(([, label, x, y]) => ({ label: strings.add(label), x, y }));

/* --- texts -----------------------------------------------------------------*/

const textKeys = [];
const TEXT_ALIAS = {
  freeReply: (v, i) => textKeys.push([`FREE_REPLY_${i}`, strings.add(v)]),
};
for (const [k, v] of Object.entries(S.texts || {})) {
  if (Array.isArray(v)) {
    v.forEach((item, i) => TEXT_ALIAS[k](item, i));
  } else {
    textKeys.push([ident(k), strings.add(v)]);
  }
}

/* --- events ----------------------------------------------------------------*/

const events = (S.events || []).map(([num, id, desc, a, b]) => ({
  num,
  id,
  label: strings.add(desc),
  a_desc: strings.add(a),
  b_desc: strings.add(b),
}));

/* --- numbers ---------------------------------------------------------------*/

const T = S.timing;
const TH = S.thresholds;
const M = S.modes;
const numbers = {
  tap_max_ms: T.tapMaxMs,
  tap_move_max: T.tapMoveMax,
  long_press_ms: T.longPressMs,
  swipe_min_px: T.swipeMinPx,
  swipe_max_ms: T.swipeMaxMs,
  transition_ms: T.transitionMs,
  toast_ms: T.toastMs,
  bubble_ms: T.bubbleMs,
  play_to_comp_ms: T.playToCompMs,
  comp_to_aod_ms: T.compToAodMs,
  aod_redraw_ms: T.aodRedrawMs,
  care_cooldown_ms: T.careCooldownMs,
  pet_cooldown_ms: T.petCooldownMs,
  bite_gap_ms: T.biteGapMs,
  voice_max_ms: T.voiceMaxMs,
  voice_silence_ms: T.voiceSilenceMs,
  voice_think_ms: T.voiceThinkMs,
  meet_timeout_ms: T.meetTimeoutMs,
  tap_confirm_timeout_ms: T.tapConfirmTimeoutMs,
  meet_done_ms: T.meetDoneMs,
  quirk_min_ms: T.quirkMinMs,
  quirk_max_ms: T.quirkMaxMs,
  quirk_idle_ms: T.quirkIdleMs,
  sleep_hold_ms: T.sleepHoldMs,
  sleep_demo_ms: T.sleepDemoMs,
  play_pounce_speed: T.playPounceSpeed,
  play_pounce_gap_ms: T.playPounceGapMs,
  play_timeout_ms: T.playTimeoutMs,
  boot_ms: T.bootMs,
  call_home_ms: T.callHomeMs,
  low_stat: TH.lowStat,
  full: TH.full,
  mood_full: TH.moodFull,
  min_energy_play: TH.minEnergyPlay,
  bat_no_wake: TH.batNoWake,
  bat_critical: TH.batCritical,
  desk_fps: M.desk.fps,
  desk_res: M.desk.res,
  play_fps: M.play.fps,
  play_res: M.play.res,
  comp_fps: M.comp.fps,
  comp_res: M.comp.res,
  aod_fps: M.aod.fps,
  aod_res: M.aod.res,
  aod_bright_pct: Math.round(M.aod.bright * 100),
  play_to_sleep_ms: T.playToCompMs + T.compToAodMs,
};

/* --- output ----------------------------------------------------------------*/

const outH = [];
const outC = [];
const w = (l) => outH.push(l);
const b = (l) => outC.push(l);

w('/* GENERATED by tools/gen-badge-ui.mjs from badge_spec.json - do not edit.');
w(` * spec version ${S.version}. Regenerate: node tools/gen-badge-ui.mjs */`);
w('#pragma once');
w('');
w('#include "badge_spec.h"');
w('');
w(`#define BADGE_SPEC_VERSION ${cString(S.version)}`);
w('');
w('/* Colour indices, in badge_colors[] order. */');
colors.forEach((c, i) => w(`#define BADGE_COLOR_${ident(c.name)} ${i}`));
w(`#define BADGE_COLOR_COUNT ${colors.length}`);
w('/* BADGE_COLOR_NONE is defined in badge_spec.h as 0xFF. */');
w('');
w('/* Fonts, in badge_fonts[] order. */');
Object.keys(S.fonts).forEach((k) => w(`#define BADGE_FONT_ID_${ident(k)} ${Object.keys(S.fonts).indexOf(k)}`));
w('');
w('/* Named strings the code addresses directly. */');
for (const [k, idx] of textKeys) w(`#define BADGE_TXT_${k} ${idx}`);
w('');
w('/* Icon indices, in badge_icons[] order (main/ui/badge_assets_data.c). */');
iconNames.forEach((n, i) => w(`#define BADGE_ICON_${ident(n)} ${i}`));
w(`#define BADGE_ICON_COUNT ${iconNames.length}`);
w('');
w('/* Value/setting identifiers for BADGE_ELF_* and the toggles. */');
SETTING_NAMES.forEach((n, i) => w(`#define BADGE_SETTING_${ident(n)} ${i}`));
w('');
w('/* Hardware facts from the spec (M1 打样板实测，见规格 12.2）：1 = on the board. */');
w(`#define BADGE_HW_MOTOR ${S.hw.motor ? 1 : 0}`);
w(`#define BADGE_HW_SPEAKER ${S.hw.speaker ? 1 : 0}`);
w(`#define BADGE_HW_NFC ${S.hw.nfc ? 1 : 0}`);
w(`#define BADGE_HW_IMU ${S.hw.imu ? 1 : 0}`);
w(`#define BADGE_HW_TOUCH_SWAP_XY ${S.hw.touchSwapXY}`);
w(`#define BADGE_HW_TOUCH_MIRROR_X ${S.hw.touchMirrorX}`);
w(`#define BADGE_HW_TOUCH_MIRROR_Y ${S.hw.touchMirrorY}`);
w(`#define BADGE_HW_TOUCH_ROTATION ${S.hw.touchRotation}`);
w(`#define BADGE_HW_TOUCH_ADDR ${S.hw.touchAddr}`);
w(`#define BADGE_HW_IMU_ADDR ${S.hw.imuAddr}`);
w(`#define BADGE_HW_CODEC_ADDR ${S.hw.codecAddr}`);
w(`#define BADGE_HW_PA_GPIO ${S.hw.paGpio}`);
w(`#define BADGE_TOUCH_MAX_SPEC ${S.hw.touchMax}`);
w(`#define BADGE_HAPTIC_RING_R ${S.hapticFallback.ringR}`);
w(`#define BADGE_HAPTIC_RING_W ${S.hapticFallback.ringW}`);
w(`#define BADGE_HAPTIC_MS ${S.hapticFallback.ms}`);
w('');
w('/* Composite components (bubble / toast / alert / float). */');
const C = S.components;
w(`#define BADGE_BUBBLE_Y ${C.bubble.y}`);
w(`#define BADGE_BUBBLE_MAX_W ${C.bubble.maxW}`);
w(`#define BADGE_BUBBLE_PAD_X ${C.bubble.padX}`);
w(`#define BADGE_BUBBLE_PAD_Y ${C.bubble.padY}`);
w(`#define BADGE_BUBBLE_FONT ${FONT_MAP[C.bubble.font]}`);
w(`#define BADGE_BUBBLE_BG ${colorNames.indexOf(C.bubble.bg)}`);
w(`#define BADGE_BUBBLE_FG ${colorNames.indexOf(C.bubble.fg)}`);
w(`#define BADGE_BUBBLE_RADIUS ${C.bubble.radius}`);
w(`#define BADGE_BUBBLE_TAIL ${C.bubble.tail}`);
w(`#define BADGE_BUBBLE_MAX_LINES ${C.bubble.maxLines}`);
w(`#define BADGE_TOAST_Y ${C.toast.y}`);
w(`#define BADGE_TOAST_H ${C.toast.h}`);
w(`#define BADGE_TOAST_MAX_W ${C.toast.maxW}`);
w(`#define BADGE_TOAST_FONT ${FONT_MAP[C.toast.font]}`);
w(`#define BADGE_TOAST_BG ${colorNames.indexOf(C.toast.bg)}`);
w(`#define BADGE_TOAST_FG ${colorNames.indexOf(C.toast.fg)}`);
w(`#define BADGE_TOAST_RADIUS ${C.toast.radius}`);
w(`#define BADGE_ALERT_R ${C.alert.r}`);
w(`#define BADGE_ALERT_BG ${colorNames.indexOf(C.alert.bg)}`);
w(`#define BADGE_ALERT_RING ${colorNames.indexOf(C.alert.ring)}`);
w(`#define BADGE_ALERT_ICON_SCALE_X2 ${Math.round(C.alert.iconScale * 2)}`);
w(`#define BADGE_ALERT_PULSE_MS ${C.alert.pulseMs}`);
w(`#define BADGE_FLOAT_FONT ${FONT_MAP[C.float.font]}`);
w(`#define BADGE_FLOAT_COLOR ${colorNames.indexOf(C.float.color)}`);
w(`#define BADGE_FLOAT_RISE_MS ${C.float.riseMs}`);
w(`#define BADGE_FLOAT_RISE ${C.float.rise}`);
w('');
w('/* Tables. */');
w(`#define BADGE_SCREEN_COUNT_SPEC ${screens.length}`);
w(`#define BADGE_EL_COUNT ${els.length}`);
w(`#define BADGE_GEST_COUNT ${gests.length}`);
w(`#define BADGE_CARE_COUNT_SPEC ${careDefs.length}`);
w(`#define BADGE_EVENT_COUNT ${events.length}`);
w(`#define BADGE_ALERT_COUNT ${alerts.length}`);
w(`#define BADGE_QUIRK_COUNT ${quirks.length}`);
w(`#define BADGE_PLACE_COUNT ${places.length}`);
w(`#define BADGE_VOICE_COUNT ${voice.length}`);
w(`#define BADGE_GUIDE_COUNT ${guide.length}`);
w(`#define BADGE_TOUCH_TARGET_COUNT ${touchTest.length}`);
w(`#define BADGE_STRING_COUNT ${strings.items.length + 1}`);
w(`#define BADGE_BLOCK_COUNT ${blocks.length}`);
w('');
w('extern const badge_color_t          badge_colors[BADGE_COLOR_COUNT];');
w('extern const badge_font_desc_t      badge_fonts[BADGE_FONT_COUNT];');
w('extern const char *const            badge_strings[BADGE_STRING_COUNT];');
w('extern const badge_screen_def_t     badge_screens[BADGE_SCREEN_COUNT_SPEC];');
w('extern const badge_el_t             badge_els[BADGE_EL_COUNT];');
w('extern const badge_gest_t           badge_gests[BADGE_GEST_COUNT];');
w(`extern const char *const            badge_icon_names[BADGE_ICON_COUNT];`);
w('extern const badge_numbers_t        badge_numbers;');
w('extern const badge_care_def_t       badge_care_defs[BADGE_CARE_COUNT_SPEC];');
w('extern const badge_block_t          badge_blocks[BADGE_BLOCK_COUNT];');
w('extern const badge_evt_def_t        badge_event_defs[BADGE_EVENT_COUNT];');
w('extern const badge_alert_def_t      badge_alerts[BADGE_ALERT_COUNT];');
w('extern const badge_quirk_def_t      badge_quirk_defs[BADGE_QUIRK_COUNT];');
w('extern const badge_place_def_t      badge_place_defs[BADGE_PLACE_COUNT];');
w('extern const badge_voice_def_t      badge_voice_defs[BADGE_VOICE_COUNT];');
w('extern const badge_guide_def_t      badge_guide_defs[BADGE_GUIDE_COUNT];');
w('extern const badge_touch_target_t   badge_touch_targets[BADGE_TOUCH_TARGET_COUNT];');
w('extern const char *const            badge_stat_names[BADGE_STAT_COUNT];');
w('extern const uint16_t               badge_stat_low_color[BADGE_STAT_COUNT];');
w('/* The specification\'s own keys for the five care actions (pet/feed/water/play/sleep),');
w(' * needed by the "{careLabel:<key>}" template and by the event arguments. */');
w('extern const char *const            badge_care_keys[BADGE_CARE_COUNT_SPEC];');
w('extern const uint32_t               badge_stage_growth[BADGE_STAGE_COUNT];');
w('extern const char *const            badge_stage_names[BADGE_STAGE_COUNT];');
w('');
w('/* Convenience lookups. */');
w('const badge_screen_def_t *badge_screen_def(int screen);');
w('const badge_care_def_t   *badge_care_def(int care);');
w('const badge_place_def_t  *badge_place_def(int place);');

b('/* GENERATED by tools/gen-badge-ui.mjs from badge_spec.json - do not edit. */');
b('#include "badge_spec_data.h"');
b('');
b('const badge_color_t badge_colors[BADGE_COLOR_COUNT] = {');
colors.forEach((c) => b(`    { 0x${c.rgb888.toString(16).padStart(6, '0')}u, 0x${c.rgb565.toString(16).padStart(4, '0')}u }, /* ${c.name} */`));
b('};');
b('');
b('const badge_font_desc_t badge_fonts[BADGE_FONT_COUNT] = {');
Object.entries(S.fonts).forEach(([k, f]) => b(`    { ${f.size}, ${f.lineH}, ${f.weight} }, /* badge_${k} */`));
b('};');
b('');
b('const char *const badge_strings[BADGE_STRING_COUNT] = {');
b('    "", /* 0: none */');
strings.items.forEach((s) => b(`    ${cString(s)},`));
b('};');
b('');
b('const char *const badge_icon_names[BADGE_ICON_COUNT] = {');
iconNames.forEach((n) => b(`    ${cString(n)},`));
b('};');
b('');
b('const badge_screen_def_t badge_screens[BADGE_SCREEN_COUNT_SPEC] = {');
screens.forEach((s, i) => {
  b(`    { /* ${i} ${s.id} */`);
  b(`      ${cString(strings.items[s.name - 1])}, ${cString(strings.items[s.doc - 1])},`);
  b(`      ${cString(strings.items[s.enter - 1])}, ${cString(strings.items[s.exit - 1])},`);
  b(`      ${s.el_first}, ${s.el_count}, ${s.gest_first}, ${s.gest_count}, ${s.has_cat},`);
  b(`      { ${s.cat.dist}, ${s.cat.ox}, ${s.cat.oy}, ${s.cat.dim_pct}, ${s.cat.flags} } },`);
});
b('};');
b('');
b('const badge_el_t badge_els[BADGE_EL_COUNT] = {');
const ci = (v) => (v < 0 ? 'BADGE_COLOR_NONE' : String(v));
els.forEach((e, i) => {
  b(`    { ${e.type}, ${e.font}, ${e.align}, ${ci(e.color)}, ${ci(e.bg)}, ${ci(e.fg)}, ${ci(e.ring)}, ${ci(e.track)},`);
  b(`      ${e.when}, ${e.act}, ${e.value}, ${e.flags}, ${e.scale_x2}, ${e.care}, ${e.text}, ${e.id}, ${e.icon},`);
  b(`      ${e.x}, ${e.y}, ${e.w}, ${e.h}, ${e.r}, ${e.r2}, ${e.w2}, ${e.a0}, ${e.a1}, ${e.n}, ${e.gap}, ${e.quiet}, ${e.hold_ms} }, /* ${i} */`);
});
b('};');
b('');
b('const badge_gest_t badge_gests[BADGE_GEST_COUNT] = {');
gests.forEach((g) => b(`    { ${cString(g.gesture)}, ${cString(strings.items[g.effect - 1])} }, /* ${g.screenId} */`));
b('};');
b('');
b(`const badge_numbers_t badge_numbers = {`);
b(`    ${numbers.tap_max_ms}, ${numbers.tap_move_max}, ${numbers.long_press_ms}, ${numbers.swipe_min_px}, ${numbers.swipe_max_ms},`);
b(`    ${numbers.transition_ms}, ${numbers.toast_ms}, ${numbers.bubble_ms}, ${numbers.play_to_comp_ms}, ${numbers.comp_to_aod_ms},`);
b(`    ${numbers.aod_redraw_ms}, ${numbers.care_cooldown_ms}, ${numbers.pet_cooldown_ms}, ${numbers.bite_gap_ms}, ${numbers.voice_max_ms},`);
b(`    ${numbers.voice_silence_ms}, ${numbers.voice_think_ms}, ${numbers.meet_timeout_ms}, ${numbers.tap_confirm_timeout_ms}, ${numbers.meet_done_ms},`);
b(`    ${numbers.quirk_min_ms}, ${numbers.quirk_max_ms}, ${numbers.quirk_idle_ms}, ${numbers.sleep_hold_ms}, ${numbers.sleep_demo_ms},`);
b(`    ${numbers.play_pounce_speed}, ${numbers.play_pounce_gap_ms}, ${numbers.play_timeout_ms}, ${numbers.boot_ms}, ${numbers.call_home_ms},`);
b(`    ${numbers.low_stat}, ${numbers.full}, ${numbers.mood_full}, ${numbers.min_energy_play}, ${numbers.bat_no_wake}, ${numbers.bat_critical},`);
b(`    ${numbers.desk_fps}, ${numbers.desk_res}, ${numbers.play_fps}, ${numbers.play_res}, ${numbers.comp_fps}, ${numbers.comp_res},`);
b(`    ${numbers.aod_fps}, ${numbers.aod_res}, ${numbers.aod_bright_pct}, ${numbers.play_to_sleep_ms},`);
b('};');
b('');
b('const badge_care_def_t badge_care_defs[BADGE_CARE_COUNT_SPEC] = {');
careDefs.forEach((c) => {
  b(`    { ${c.label}, { ${c.delta.join(', ')} }, ${c.growth}, ${c.coins}, ${c.steps}, ${c.block_first}, ${c.block_count} }, /* ${c.name} */`);
});
b('};');
b('');
b('const badge_block_t badge_blocks[BADGE_BLOCK_COUNT] = {');
blocks.forEach((x) => b(`    { ${x.stat}, ${x.op}, ${x.value}, ${x.text} },`));
b('};');
b('');
b('const badge_evt_def_t badge_event_defs[BADGE_EVENT_COUNT] = {');
events.forEach((e) => b(`    { ${e.num}, ${e.num}, ${e.label}, ${e.a_desc}, ${e.b_desc} },`));
b('};');
b('');
b('const badge_alert_def_t badge_alerts[BADGE_ALERT_COUNT] = {');
alerts.forEach((a) => b(`    { ${a.stat}, ${a.icon}, ${a.text}, ${a.action} },`));
b('};');
b('');
b('const badge_quirk_def_t badge_quirk_defs[BADGE_QUIRK_COUNT] = {');
quirks.forEach((q) => b(`    { ${q.id}, ${q.name}, ${q.icon}, ${q.ms}, ${q.anim} },`));
b('};');
b('');
b('const badge_place_def_t badge_place_defs[BADGE_PLACE_COUNT] = {');
places.forEach((p) => b(`    { ${p.icon}, ${p.text}, ${p.sub} },`));
b('};');
b('');
b('const badge_voice_def_t badge_voice_defs[BADGE_VOICE_COUNT] = {');
voice.forEach((v) => b(`    { ${v.num}, ${v.word}, ${v.action}, ${v.reply} },`));
b('};');
b('');
b('const badge_guide_def_t badge_guide_defs[BADGE_GUIDE_COUNT] = {');
guide.forEach((g) => b(`    { ${g.icon}, ${g.title}, ${g.sub} },`));
b('};');
b('');
b('const badge_touch_target_t badge_touch_targets[BADGE_TOUCH_TARGET_COUNT] = {');
touchTest.forEach((t) => b(`    { ${t.label}, ${t.x}, ${t.y} },`));
b('};');
b('');
b('const char *const badge_stat_names[BADGE_STAT_COUNT] = {');
STAT_NAMES.forEach((n, i) => {
  const pair = S.stats[i];
  b(`    ${cString(pair[1])}, /* ${n} */`);
});
b('};');
b('');
b('/* Colour of a stat bar / arc when the value is under the threshold. */');
b('const uint16_t badge_stat_low_color[BADGE_STAT_COUNT] = {');
STAT_NAMES.forEach(() => b(`    0x${to565(parseInt(S.colors.warn.replace('#', ''), 16)).toString(16)}u,`));
b('};');
b('');
b('const char *const badge_care_keys[BADGE_CARE_COUNT_SPEC] = {');
CARE_NAMES.forEach((n) => b(`    ${cString(n)},`));
b('};');
b('');
b('const uint32_t badge_stage_growth[BADGE_STAGE_COUNT] = {');
(S.stages || []).forEach(([g]) => b(`    ${g},`));
b('};');
b('');
b('const char *const badge_stage_names[BADGE_STAGE_COUNT] = {');
(S.stages || []).forEach(([, n]) => b(`    ${cString(n)},`));
b('};');
b('');
b('const badge_screen_def_t *badge_screen_def(int screen)');
b('{');
b('    if (screen < 0 || screen >= BADGE_SCREEN_COUNT_SPEC) return 0;');
b('    return &badge_screens[screen];');
b('}');
b('');
b('const badge_care_def_t *badge_care_def(int care)');
b('{');
b('    if (care < 0 || care >= BADGE_CARE_COUNT_SPEC) return 0;');
b('    return &badge_care_defs[care];');
b('}');
b('');
b('const badge_place_def_t *badge_place_def(int place)');
b('{');
b('    if (place < 0 || place >= BADGE_PLACE_COUNT) return 0;');
b('    return &badge_place_defs[place];');
b('}');

/* --------------------------------------------------------------- write out --*/

const headerPath = join(OUT_DIR, 'badge_spec_data.h');
const sourcePath = join(OUT_DIR, 'badge_spec_data.c');
const headerText = outH.join('\n') + '\n';
const sourceText = outC.join('\n') + '\n';

const same = (path, text) => existsSync(path) && readFileSync(path, 'utf8') === text;

if (CHECK_ONLY) {
  const stale = [];
  if (!same(headerPath, headerText)) stale.push(headerPath);
  if (!same(sourcePath, sourceText)) stale.push(sourcePath);
  if (stale.length) {
    console.error('gen-badge-ui: generated files are stale:\n  ' + stale.join('\n  '));
    process.exit(1);
  }
  console.log(
    `gen-badge-ui: up to date (${screens.length} screens, ${elementCount} elements, ` +
      `${colors.length} colours, ${strings.items.length} strings)`,
  );
} else {
  writeFileSync(headerPath, headerText);
  writeFileSync(sourcePath, sourceText);
  console.log(
    `gen-badge-ui: wrote ${screens.length} screens, ${elementCount} elements, ${colors.length} colours, ` +
      `${strings.items.length} strings, ${iconNames.length} icons`,
  );
  console.log(`  ${headerPath}`);
  console.log(`  ${sourcePath}`);
}
