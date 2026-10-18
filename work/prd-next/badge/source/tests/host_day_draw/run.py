"""Compile actual day drawing/project functions with host-only LVGL adapters."""
from pathlib import Path
import subprocess, shutil, tempfile
root = Path(__file__).resolve().parents[2]
compiler = shutil.which('clang') or shutil.which('gcc')
if not compiler:
    raise SystemExit('Existing clang/gcc required; no installation or device access.')
source = (root / 'main/badge_day_ui.inc').read_text(encoding='utf-8')
start = source.index('static void day_project(void)')
with tempfile.TemporaryDirectory(prefix='badge-day-preview-') as temp:
    target = Path(temp)
    (target / 'production_day.inc').write_text(source[start:], encoding='utf-8')
    exe = target / 'day-preview.exe'
    subprocess.run([compiler, '-std=c11', '-Wall', '-Wextra', '-Werror', '-I', str(target),
                    str(Path(__file__).with_name('test_day_draw.c')), '-o', str(exe)], check=True)
    subprocess.run([str(exe)], check=True)
