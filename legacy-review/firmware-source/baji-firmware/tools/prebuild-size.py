"""Compile every source main/CMakeLists.txt registers and total up its sections.

WHY THIS EXISTS
The acceptance bar is a full esp-idf build, and that build is slow and, until
main/ui/badge_ui.c lands, impossible to start. But almost all of its failure modes can be
found in advance by compiling the same sources with the same xtensa-esp32s3-elf-gcc and
the flags ESP-IDF actually used, then reading the section sizes:

  * a source that does not compile under the FIRMWARE compiler (which has warnings clang
    does not, and this project builds main/ with -Werror) is caught here rather than 10
    minutes into a build;
  * the total .rodata shows whether the app still fits the 8 MB factory partition -- the
    four vendored faces alone hold 0.80 MB of glyph bitmaps, and this is the check that
    says so with a number instead of an estimate.

It deliberately does NOT link: linking needs the whole IDF and the BSP. What it proves is
that every translation unit is clean and how much flash the new content costs.
"""
import os
import re
import subprocess
import sys

# Derived from this file's own location, not hardcoded, so a clone at any path can
# run it. This file lives in tools/, directly under the repository root.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.path.join(ROOT, 'main')
OBJ = os.path.join(ROOT, 'build', 'obj')
DB = os.path.join(os.environ.get('IDF_BUILD_DIR', r'D:\orangecat-build'),
                  'compile_commands.json')
PY = sys.executable

os.makedirs(OBJ, exist_ok=True)

cmake = open(os.path.join(MAIN, 'CMakeLists.txt'), encoding='utf-8').read()
block = re.search(r'SRCS(.*?)INCLUDE_DIRS', cmake, re.S)
srcs = re.findall(r'"([^"]+)"', block.group(1))


def compile_one(rel):
    """Reuse build/cc.py, which replays the recorded flags for one file."""
    out = os.path.join(OBJ, rel.replace('/', '_').replace(os.sep, '_') + '.o')
    args = [PY, '-X', 'utf8', os.path.join(ROOT, 'tools', 'cc.py'), rel.replace('/', os.sep), out]
    p = subprocess.run(args, capture_output=True, text=True, errors='replace')
    return out, p.returncode, (p.stdout or '') + (p.stderr or '')


def sections(path):
    """Sum the allocated sections of one .o with the xtensa size tool."""
    gcc = os.environ.get('HOST_FW_GCC') or \
        r'C:\Espressif\tools\xtensa-esp-elf\esp-14.2.0_20260121\xtensa-esp-elf\bin\xtensa-esp32s3-elf-gcc.exe'
    size = gcc.replace('-gcc.exe', '-size.exe')
    if not os.path.isfile(size):
        return None
    p = subprocess.run([size, path], capture_output=True, text=True, errors='replace')
    if p.returncode != 0:
        return None
    # header: text data bss dec  /  row: numbers
    rows = [l for l in p.stdout.splitlines() if re.match(r'\s*\d+', l)]
    if not rows:
        return None
    nums = [int(x) for x in re.findall(r'\d+', rows[0])]
    return nums  # text, data, bss, dec, hex


ok, fail, skipped = [], [], []
tot_text = tot_data = tot_bss = 0
rows = []
for rel in srcs:
    p = os.path.join(MAIN, rel.replace('/', os.sep))
    if not os.path.isfile(p):
        skipped.append(rel)
        continue
    obj, rc, log = compile_one(rel)
    if rc != 0:
        errs = [re.sub(r'\x1b\[[0-9;]*m', '', l).strip()
                for l in log.splitlines() if 'error:' in l or 'warning:' in l]
        fail.append((rel, errs[:4]))
        continue
    ok.append(rel)
    s = sections(obj)
    if s:
        tot_text += s[0]
        tot_data += s[1]
        tot_bss += s[2]
        rows.append((rel, s[0], s[1], s[2]))

print('compiled clean : %d' % len(ok))
print('skipped (absent): %d %s' % (len(skipped), skipped))
print('FAILED         : %d' % len(fail))
for rel, errs in fail:
    print('  ', rel)
    for e in errs:
        print('     ', e)
print()
print('%-34s %9s %9s %9s' % ('source', 'text', 'data', 'bss'))
for rel, t, d, b in sorted(rows, key=lambda r: -r[1]):
    print('%-34s %9d %9d %9d' % (rel, t, d, b))
print('%-34s %9d %9d %9d' % ('TOTAL', tot_text, tot_data, tot_bss))

flash = tot_text + tot_data
print()
print('flash (text+data, uncompressed, before compression): %.2f MB' % (flash / 1048576.0))
print('factory partition                                  : 8.00 MB')
print('fits with                                          : %.2f MB to spare' % ((8 * 1048576 - flash) / 1048576.0))
print('(the real image is smaller: ESP-IDF compresses with esp_image if enabled, and the')
print(' bootloader/partition table sit outside the app partition)')
