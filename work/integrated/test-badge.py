"""Run every badge host regression that needs no ESP-IDF, no LVGL device and no hardware.

Usage: python work/integrated/test-badge.py [--coverage none]
"""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
SUITES = [
    ("跟手拖动生命周期", ROOT / "firmware/tests/host_live_drag/run.py"),
    ("今日环返回预览绘制", ROOT / "firmware/tests/host_day_draw/run.py"),
    ("清洁能力门禁与终态收据", ROOT / "firmware/tests/host_care_gate/run.py"),
]


def main() -> int:
    failed = []
    for name, script in SUITES:
        print(f"== {name} ==", flush=True)
        result = subprocess.run([sys.executable, str(script)], cwd=str(ROOT / "firmware"))
        if result.returncode:
            failed.append(name)
    if failed:
        print("FAILED: " + ", ".join(failed))
        return 1
    print(f"PASS: {len(SUITES)} badge host suites")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
