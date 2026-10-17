"""Extract production drag functions verbatim, compile and run without SDK/LVGL."""
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
compiler = shutil.which("clang") or shutil.which("gcc")
if not compiler:
    raise SystemExit("An existing clang/gcc is required; this runner installs nothing.")
source = (root / "main" / "badge_pages.c").read_text(encoding="utf-8")
start = source.index("/* Different PAGE objects follow the contact;")
end = source.index("static void build_home_care(void)", start)
with tempfile.TemporaryDirectory(prefix="badge-live-drag-") as temp:
    build = Path(temp)
    (build / "production_drag.inc").write_text(source[start:end], encoding="utf-8")
    exe = build / "test_live_drag.exe"
    # Inherit stdio: no named pipes, no device, no performance benchmark.
    subprocess.run([compiler, "-std=c11", "-Wall", "-Wextra", "-Werror", "-I", str(root / "main"),
                    "-I", str(build), str(Path(__file__).with_name("test_live_drag.c")),
                    str(root / "main" / "badge_gesture.c"), "-o", str(exe)], check=True)
    subprocess.run([str(exe)], check=True)
