"""Check that main/CMakeLists.txt lists exactly the sources that exist on disk.

A missing source is a hard CMake error at configure time; an UNLISTED source is worse,
because it compiles in the host suite (which globs its own file list) and then silently
does not exist in the firmware -- which links only if nothing references it, so the
symptom is a missing feature rather than a build failure. So both directions are checked.

Also checks the two generated files' provenance comment, and that the removed UI is not
still listed.
"""
import os
import re

# Derived from this file's own location, not hardcoded, so a clone at any path can
# run it. This file lives in tools/, directly under the repository root.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.path.join(ROOT, 'main')
cmake = open(os.path.join(MAIN, 'CMakeLists.txt'), encoding='utf-8').read()

block = re.search(r'SRCS(.*?)INCLUDE_DIRS', cmake, re.S)
listed = re.findall(r'"([^"]+)"', block.group(1))

missing = [s for s in listed if not os.path.isfile(os.path.join(MAIN, s.replace('/', os.sep)))]

# Every .c under main/, excluding anything already listed, the two superseded files that
# are being deleted, and generated/vendored subtrees that are not registered directly.
listed_norm = {s.replace('/', os.sep) for s in listed}
on_disk = []
for dirpath, dirnames, filenames in os.walk(MAIN):
    for f in filenames:
        if not f.endswith('.c'):
            continue
        rel = os.path.relpath(os.path.join(dirpath, f), MAIN)
        on_disk.append(rel)

SUPERSEDED = {
    os.path.join('ui', 'pet_ui.c'),
    os.path.join('ui', 'circle_fit.c'),
    os.path.join('ui', 'circle_paint.c'),
    os.path.join('pet', 'pet_save.c'),
}
unlisted = sorted(p for p in on_disk if p not in listed_norm and p not in SUPERSEDED)

print('listed sources        :', len(listed))
print('sources on disk       :', len(on_disk))
print()
print('MISSING (listed but not on disk):')
print('   ', missing if missing else 'none')
print()
print('UNLISTED (on disk but not listed, superseded excluded):')
if unlisted:
    for p in unlisted:
        print('   ', p)
else:
    print('    none')
print()

# Include dirs must exist too, or every include in the component breaks.
inc = re.search(r'INCLUDE_DIRS(.*?)\)', cmake, re.S)
dirs = re.findall(r'"([^"]+)"', inc.group(1))
bad = [d for d in dirs if not os.path.isdir(os.path.join(MAIN, d.replace('/', os.sep)))]
print('include dirs          :', dirs)
print('MISSING include dirs  :', bad if bad else 'none')
print()

# The generated files must carry their provenance and must not be hand-edited.
for gen in ('ui/badge_spec_data.c', 'ui/badge_assets_data.c'):
    p = os.path.join(MAIN, gen.replace('/', os.sep))
    if not os.path.isfile(p):
        print('GENERATED MISSING:', gen)
        continue
    head = open(p, encoding='utf-8', errors='replace').read(2000)
    tool = 'gen-badge-ui.mjs' if 'spec_data' in gen else 'gen-badge-assets.mjs'
    print('%-26s provenance names %-24s %s' % (gen, tool, tool in head))

bad = [s for s in listed if os.path.basename(s) in
       ('pet_ui.c', 'circle_fit.c', 'circle_paint.c', 'pet_ring.c', 'pet_save.c')]
print()
print('superseded UI still listed:', bad if bad else 'none')
print('SUPERSEDED still on disk  :', sorted(p for p in SUPERSEDED if os.path.isfile(os.path.join(MAIN, p))))
