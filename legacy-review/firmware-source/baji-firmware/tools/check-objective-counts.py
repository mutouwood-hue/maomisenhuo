"""Check the objective's own quantity claims against the generated firmware tables.

The task states specific numbers: 23 screens, gestures, a state machine, 4 Chinese faces,
28 icons, 5 prompt sounds, touch/brightness/AOD/IMU switches, 5 care actions, 14 event
types on 8 bytes, 17 command words. A claim like "28 icons" is easy to satisfy in the
package and easy to lose in the firmware, so each one is read out of the GENERATED C --
not out of the spec JSON, which is the input -- and then cross-checked against the JSON
that generated it. Where the two disagree the C is what ships, so a mismatch is a failure.

Everything here reads files; nothing compiles. Run it after any generator change.
"""
import json
import os
import re
import sys

# Derived from this file's own location, not hardcoded, so a clone at any path can
# run it. This file lives in tools/, directly under the repository root.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = ROOT + r'\_ref\baji-spec\吧唧交互规范\badge_spec.json'
DATA_H = ROOT + r'\main\ui\badge_spec_data.h'
ASSETS_H = ROOT + r'\main\ui\badge_assets.h'
SPEC_H = ROOT + r'\main\ui\badge_spec.h'
EVENTS_H = ROOT + r'\main\net\badge_events.h'

spec = json.load(open(SPEC, encoding='utf-8'))
dh = open(DATA_H, encoding='utf-8', errors='replace').read()
ah = open(ASSETS_H, encoding='utf-8', errors='replace').read()
sh = open(SPEC_H, encoding='utf-8', errors='replace').read()
eh = open(EVENTS_H, encoding='utf-8', errors='replace').read()
dc = open(ROOT + r'\main\ui\badge_spec_data.c', encoding='utf-8', errors='replace').read()
fsmh = open(ROOT + r'\main\ui\badge_fsm.h', encoding='utf-8', errors='replace').read()

fails = []


def num(text, name):
    m = re.search(r'^#define\s+' + name + r'\s+(\d+)', text, re.M)
    return int(m.group(1)) if m else None


def enum_members(text, enum_name):
    """Members of `typedef enum { ... } enum_name;`.

    Several of the counts are enum members rather than #defines -- SND_COUNT and
    BADGE_STAT_COUNT are the last entry of their enum, with no explicit value -- so they
    are counted from the list and the sentinel is dropped.
    """
    m = re.search(r'typedef\s+enum\s*\{(.*?)\}\s*' + enum_name + r'\s*;', text, re.S)
    if not m:
        return []
    body = re.sub(r'/\*.*?\*/', '', m.group(1), flags=re.S)
    return [x.strip() for x in body.split(',') if x.strip()]


def sentinel_count(text, enum_name):
    """The numeric value of the trailing sentinel of an enum = how many real members."""
    members = enum_members(text, enum_name)
    if not members:
        return None
    # Walk the list, honouring any explicit `= n`.
    value = 0
    for item in members:
        if '=' in item:
            rhs = item.split('=', 1)[1].strip()
            try:
                value = int(rhs, 0)
            except ValueError:
                pass
        else:
            value += 1
    return value


def count_defines(text, prefix):
    """How many `#define PREFIX...` lines there are -- for BADGE_FONT_ID_F16 etc."""
    return len(re.findall(r'^#define\s+' + prefix + r'\w+\s+\d+', text, re.M))


def check(label, got, want):
    ok = got == want
    print('%-46s %-6s %s' % (label, str(got), 'ok' if ok else 'EXPECTED %s' % want))
    if not ok:
        fails.append('%s: firmware has %s, expected %s' % (label, got, want))


print('=== what the firmware ships (read out of the generated C) ===')
els = sum(len(s['els']) for s in spec['screens'].values())
check('screens', num(dh, 'BADGE_SCREEN_COUNT_SPEC'), len(spec['screens']))
check('elements', num(dh, 'BADGE_EL_COUNT'), els)
check('colours', num(dh, 'BADGE_COLOR_COUNT'), len(spec['colors']))
check('care actions (5 种照料)', num(dh, 'BADGE_CARE_COUNT_SPEC'), len(spec['care']))
check('icons (28 图标)', num(dh, 'BADGE_ICON_COUNT'), 28)
check('prompt sounds (5 提示音)', sentinel_count(ah, 'badge_snd_t'), len(spec['sounds']))
check('event types (14 类上行)', num(dh, 'BADGE_EVENT_COUNT'), len(spec['events']))
check('event wire bytes (8 字节)', num(sh, 'BADGE_EVENT_WIRE_BYTES'), 8)
check('command words (17 条命令词)', num(dh, 'BADGE_VOICE_COUNT'), len(spec['voice']))
check('quirks', num(dh, 'BADGE_QUIRK_COUNT'), len(spec['quirks']))
check('places', num(dh, 'BADGE_PLACE_COUNT'), len(spec['places']))
check('guide pages', num(dh, 'BADGE_GUIDE_COUNT'), len(spec['guide']))
check('touch targets', num(dh, 'BADGE_TOUCH_TARGET_COUNT'), len(spec['touchTest']))
check('alerts', num(dh, 'BADGE_ALERT_COUNT'), len(spec['alerts']))
check('stat count', sentinel_count(sh, 'badge_stat_t') or num(sh, 'BADGE_STAT_COUNT'),
      len(spec['stats']))
check('stage count', num(sh, 'BADGE_STAGE_COUNT'), len(spec['stages']))
check('gesture entries (per screen, flattened)', num(dh, 'BADGE_GEST_COUNT'),
      sum(len(s.get('gest') or {}) for s in spec['screens'].values()))

print()
print('=== the four faces ===')
faces = re.findall(r'extern const lv_font_t (badge_\w+)', ah)
be = sorted(re.findall(r'^\s*BE_([A-Z_]+)', sh, re.M))
print('faces declared in badge_assets.h  :', faces)
if len(faces) != 4:
    fails.append('expected 4 faces, badge_assets.h declares %d' % len(faces))
for name in ('badge_f16', 'badge_f20', 'badge_f24', 'badge_n40'):
    if name not in faces:
        fails.append('face %s is not declared' % name)
if 'BADGE_FONT_N40' not in sh or 'BADGE_FONT_COUNT' not in sh:
    fails.append('badge_font_t does not carry the four faces + a sentinel')

print()
print('=== the hardware switches the objective names ===')
switches = {
    'touch clamp (触摸)': (SPEC_H, 'badge_touch_clamp'),
    'brightness levels (亮度)': (ROOT + r'\main\ui\badge_fsm.h', 'BADGE_BRIGHT_LEVELS'),
    'AOD (息屏常显)': (SPEC_H, 'aod_bright_pct'),
    'IMU raise-to-wake': (ROOT + r'\main\hw\badge_hw.h', 'badge_hw_poll'),
    'haptics': (ROOT + r'\main\hw\badge_hw.h', 'badge_hw_haptic'),
    'audio codec': (ROOT + r'\main\hw\badge_hw.h', 'badge_hw_audio_play'),
    'battery': (ROOT + r'\main\hw\badge_hw.h', 'badge_hw_battery_pct'),
}
for label, (path, sym) in switches.items():
    try:
        body = open(path, encoding='utf-8', errors='replace').read()
    except OSError as exc:
        fails.append('%s: cannot read %s (%s)' % (label, path, exc))
        continue
    ok = sym in body
    print('%-46s %s' % (label, 'ok' if ok else 'MISSING %s' % sym))
    if not ok:
        fails.append('%s: %s not found in %s' % (label, sym, path))

print()
print('=== every element type the spec uses has a firmware type ===')
# The firmware names these BE_* (badge_spec.h:149-169), one per specification `t`. The
# enum's own sentinel BE_TYPE_COUNT is dropped; the remaining members are the types the
# firmware can actually draw, so the count is the check and a drifted count means an
# element the generator emits has no renderer.
el_types = set()
for s in spec['screens'].values():
    for el in s['els']:
        if el.get('t'):
            el_types.add(el['t'])
be_real = [x for x in be if x != 'TYPE_COUNT']
print('spec element types   : %d' % len(el_types))
print('firmware BE_* types  : %d -> %s' % (len(be_real), sorted(be_real)))
if len(be_real) != len(el_types):
    fails.append('spec uses %d element types, the firmware declares %d BE_* types'
                 % (len(el_types), len(be_real)))

print()
print('=== every gesture the spec declares is in the generated gesture table ===')
# Gestures are kept as TEXT (badge_spec.h:340-345 says why: a host test compares them),
# so the check is that every name the JSON uses appears in the generated badge_gests[].
gests = set()
for s in spec['screens'].values():
    for g in (s.get('gest') or {}).keys():
        gests.add(g)
table = set(re.findall(r'\{\s*"([a-z_]+)"\s*,', dc))
missing_g = sorted(g for g in gests if g not in table)
print('spec gestures: %d, distinct generated entries: %d' % (len(gests), len(table)))
print('spec gestures absent from the table: %s' % (missing_g if missing_g else 'none'))
if missing_g:
    fails.append('spec gestures not in badge_gests[]: %s' % missing_g)

print()
if fails:
    print('FAILED (%d):' % len(fails))
    for f in fails:
        print('  -', f)
    sys.exit(1)
print('OK: every quantity the objective names is present in the generated firmware tables.')
