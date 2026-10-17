"""Compile the production local2_core.c on the host and run the bath-capability regressions.

Needs only an existing clang/gcc: no ESP-IDF, no LVGL, no device, no network.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
compiler = shutil.which("clang") or shutil.which("gcc")
if not compiler:
    raise SystemExit("An existing clang/gcc is required; this runner installs nothing.")

with tempfile.TemporaryDirectory(prefix="badge-care-gate-") as temp:
    exe = Path(temp) / "test_care_gate"
    subprocess.run([compiler, "-std=c11", "-Wall", "-Wextra", "-Werror",
                    "-I", str(root / "main"),
                    str(Path(__file__).with_name("test_care_gate.c")),
                    str(root / "main" / "local2_core.c"), "-o", str(exe)], check=True)
    subprocess.run([str(exe)], check=True)
