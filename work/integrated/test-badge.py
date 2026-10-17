"""Run every badge host regression that needs no ESP-IDF device and no hardware.

Usage: python work/integrated/test-badge.py [--skip-ui]
  --skip-ui  跳过离线渲染门禁（较慢，约 1 分钟），只跑纯 C 主机套件
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
UI_GATE = ("界面门禁（27 屏渲染 + 安全圆/字形）", ROOT / "firmware/tools/ui_gate.py")


def main() -> int:
    suites = list(SUITES)
    if "--skip-ui" not in sys.argv:
        suites.append(UI_GATE)
    failed = []
    for name, script in suites:
        print(f"== {name} ==", flush=True)
        result = subprocess.run([sys.executable, str(script)], cwd=str(ROOT / "firmware"))
        if result.returncode:
            failed.append(name)
    if failed:
        print("FAILED: " + ", ".join(failed))
        return 1
    print(f"PASS: {len(suites)} badge host suites")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
