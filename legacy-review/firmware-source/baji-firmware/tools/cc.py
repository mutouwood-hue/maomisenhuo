"""Recompile one main/ source with the exact flags ESP-IDF used for that file.

Usage: python tools/cc.py <relative/path.c> [<out.o>]

The flags come from D:\\orangecat-build\\compile_commands.json (an ESP-IDF v5.5.5 build
of this project). The build dir is used because the project path is non-ASCII and idf.py
mirrors the tree to D:\\orangecat / D:\\orangecat-build. Falls back to any entry for a
main/ source when the requested file is not in the database (a file new since the last
configure has no entry yet).
"""
import json
import os
import re
import subprocess
import sys

DB = os.path.join(os.environ.get('IDF_BUILD_DIR', r'D:\orangecat-build'),
                  'compile_commands.json')
# The build was configured against the ASCII mirror; this is the tree being compiled.
# Derived from this file's own location (tools/ sits directly under the root) so a clone
# at any path can run it, and overridable for a tree that is not the mirror's source.
MIRROR = os.environ.get('IDF_MIRROR_DIR', r'D:\orangecat')
SOURCE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

entries = json.load(open(DB, encoding='utf-8'))

target = sys.argv[1].replace('/', '\\')
match = None
for e in entries:
    if e['file'].lower().endswith('main\\' + target) or e['file'].lower().endswith('/main/' + target.replace('\\', '/')):
        match = e
        break

if match is None:
    for e in entries:
        if '\\main\\' in e['file'] or '/main/' in e['file']:
            match = e
            break
    if match is None:
        sys.exit('no main/ entry in the compilation database')

cmd = match['command']
if isinstance(match.get('arguments'), list):
    args = list(match['arguments'])
else:
    # The stored command is a Windows command line: paths are unquoted or
    # double-quoted, never backslash-escaped. posix=True would eat the backslashes and
    # turn C:\Espressif\tools into C:Espressiftools, so split without it and strip the
    # quotes by hand.
    import shlex
    args = shlex.split(cmd, posix=False)
    args = [a[1:-1] if len(a) >= 2 and a[0] == '"' and a[-1] == '"' else a for a in args]
# The database stores the defines as -DIDF_VER=\"v5.5.5\"; passed through a list to
# subprocess (no shell) that reaches GCC as the literal backslash-quote and fails with
# "missing terminating character". Undo the extra escaping.
args = [a.replace('\\"', '"') for a in args]
# GCC response files must be @path with no quotes around the path.
args = [('@' + a[2:-1]) if a.startswith('@"') and a.endswith('"') else a for a in args]
# The build was configured against the ASCII mirror D:\orangecat, but the sources being
# checked live in D:\黑客松 (the mirror is stale). Point every project include root at the
# real tree; the IDF and toolchain roots are untouched.
for mirror, real in ((r'D:\orangecat\main', os.path.join(SOURCE, 'main')),
                     (r'D:\orangecat\components', os.path.join(SOURCE, 'components')),
                     (r'D:\orangecat\managed_components', os.path.join(SOURCE, 'managed_components')),
                     (r'D:/orangecat/main', os.path.join(SOURCE, 'main').replace('\\', '/')),
                     (r'D:/orangecat/components', os.path.join(SOURCE, 'components').replace('\\', '/')),
                     (r'D:/orangecat/managed_components',
                      os.path.join(SOURCE, 'managed_components').replace('\\', '/'))):
    for i, a in enumerate(args):
        if mirror in a:
            args[i] = a.replace(mirror, real)

# The compilation database predates the rewritten main/CMakeLists.txt, so its INCLUDE_DIRS
# (".", "pet", "ui", "net", "hw") are not all present. Add the ones the component
# actually registers, from the current CMakeLists.
import re as _re
_cmake = open(os.path.join(SOURCE, 'main', 'CMakeLists.txt'), encoding='utf-8').read()

# ...and its PRIVATE compile definitions. The compilation database predates them, so
# without this the vendored font faces fail with "lvgl/lvgl.h: No such file or directory"
# -- they need LV_LVGL_H_INCLUDE_SIMPLE, which is exactly what main/CMakeLists.txt now
# defines and what the real build will therefore have.
for _defs in _re.findall(
        r'target_compile_definitions\(\$\{COMPONENT_LIB\} PRIVATE(.*?)\)', _cmake, _re.S):
    for _d in _defs.split():
        if not any(a == '-D' + _d for a in args):
            args.append('-D' + _d)

_block = _re.search(r'INCLUDE_DIRS(.*?)\)', _cmake, _re.S)
if _block:
    for _d in _re.findall(r'"([^"]+)"', _block.group(1)):
        _p = os.path.join(SOURCE, 'main', _d)
        if not any(os.path.normcase(a) == os.path.normcase(_p) for a in args):
            args.append('-I')
            args.append(_p)

# Redirect output and swap the translation unit for ours.
out = sys.argv[2] if len(sys.argv) > 2 else 'build\\cc-check.o'
new = []
i = 0
while i < len(args):
    a = args[i]
    if a == '-o':
        new += ['-o', out]
        i += 2
        continue
    if a == '-c':
        new += ['-c']
        i += 1
        continue
    if a.endswith('.c') or a.endswith('.cpp'):
        new += [os.path.join(SOURCE, 'main', target)]
        i += 1
        continue
    new.append(a)
    i += 1

# ESP-IDF passes the app version as -DVERSION="..." , and the compilation database
# stores it either JSON-escaped (so the quotes survive as literal characters) or
# already unquoted. Re-quoting a value that is already balanced is what produced a
# "missing terminating character" error, so drop any argument whose value is not
# balanced -- it only feeds a log string, never a decision this check makes.
def balanced(a):
    return a.count('"') % 2 == 0

new = [a for a in new if balanced(a)]

import sys as _s
if '-v' in _s.argv:
    for a in args:
        if '"' in a:
            print('QUOTED ARG:', repr(a))

print('source entry :', match['file'])
print('compiling    :', os.path.join(SOURCE, 'main', target))
sys.stdout.flush()
if not os.path.isfile(new[0]):
    sys.exit('compiler not found: %s' % new[0])
rc = subprocess.call(new)
print('exit', rc)
sys.exit(rc)
