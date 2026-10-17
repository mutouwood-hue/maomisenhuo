"""吧唧界面门禁：把关键屏幕批量离线渲染并校验安全圆/字形/标签重叠。

一次跑完固定的一组用例，任何一项不通过就以非零退出：
  - 预期用例必须都产出了 PNG 与 sha256；
  - missing_glyph_count 必须为 0（中文字形不能缺）；
  - hit_safe_radius_212_violations 与 label_safe_radius_212_violations 必须为空。

用法：python firmware/tools/ui_gate.py [--cases a,b,c] [--jobs 2]
只在本机跑 LVGL 软件渲染，不接设备、不联网。
"""
from pathlib import Path
import argparse
import datetime
import json
import os
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / "firmware/tools/host_preview/run_preview.py"
PREVIEW_ROOT = ROOT / "artifacts/firmware-local-v3/preview"

# 覆盖 23 屏里已落地的关键屏，外加新加的三个相遇/睡眠用例。
DEFAULT_CASES = [
    "boot", "guide_1", "guide_5", "main_a", "main_b", "main_c", "main_c_hearts", "aod",
    "care_menu", "care_feed", "care_water", "care_play", "care_sleep", "sleeping",
    "status", "settings", "device", "touch_test", "touch_complete", "voice",
    "meet_confirm", "meet_draw", "meet_beat", "meet_done", "away_rain", "returning_snow", "welcome",
]

TOOLCHAIN = [
    Path("C:/Espressif/tools/cmake/3.30.2/bin"),
    Path("C:/Espressif/tools/ninja/1.12.1"),
]
IDF = Path("D:/Espressif/v5.5.5/esp-idf")


def toolchain_env() -> dict[str, str]:
    env = dict(os.environ)
    extra = [str(p) for p in TOOLCHAIN if p.exists()]
    if shutil.which("gcc") is None:
        for candidate in Path.home().glob("AppData/Local/Microsoft/WinGet/Packages/MartinStorsjo.LLVM-MinGW*/*/bin"):
            if (candidate / "gcc.exe").exists():
                extra.append(str(candidate))
                break
    env["PATH"] = os.pathsep.join(extra + [env.get("PATH", "")])
    env.setdefault("CC", "gcc")
    env.setdefault("CXX", "g++")
    env.setdefault("CMAKE_GENERATOR", "Ninja")
    if IDF.exists():
        env.setdefault("IDF_PATH", str(IDF))
    env.setdefault("PYTHONUTF8", "1")
    return env


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cases", default=",".join(DEFAULT_CASES))
    ap.add_argument("--jobs", type=int, default=2)
    args = ap.parse_args()
    cases = [c.strip() for c in args.cases.split(",") if c.strip()]

    stamp = datetime.datetime.now().strftime("%H%M%S")
    out = PREVIEW_ROOT / f"gate-{datetime.datetime.now().strftime('%Y%m%d')}-{stamp}"
    print(f"== 渲染 {len(cases)} 屏 -> {out.relative_to(ROOT)} ==", flush=True)
    result = subprocess.run(
        [sys.executable, str(RUNNER), "--output", str(out), "--cases", ",".join(cases), "--jobs", str(args.jobs)],
        cwd=str(ROOT), env=toolchain_env(),
    )
    manifest_path = out / "manifest.json"
    if not manifest_path.exists():
        print("FAIL: 渲染未产出 manifest.json（run_preview 退出码 %d）" % result.returncode)
        return 1

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rendered = {row["case"]: row for row in manifest.get("cases", [])}
    problems: list[str] = []
    for case in cases:
        row = rendered.get(case)
        if not row:
            problems.append(f"{case}: 未渲出")
            continue
        if not row.get("png") or not row.get("png_sha256"):
            problems.append(f"{case}: 缺 PNG 或 sha256")
        if row.get("missing_glyph_count"):
            problems.append(f"{case}: 缺字形 {row['missing_glyph_count']} 个")
        for item in row.get("hit_safe_radius_212_violations", []):
            problems.append(f"{case}: 命中区越界 {item.get('name')} r={item.get('radius')}")
        for item in row.get("label_safe_radius_212_violations", []):
            problems.append(f"{case}: 标签越界 {item.get('text')!r} r={item.get('max_corner_radius')}")

    if problems:
        print("FAIL: 吧唧界面门禁未通过")
        for item in problems:
            print(" -", item)
        return 1

    print(f"PASS: 吧唧界面门禁 {len(cases)}/{len(cases)} 屏（字形完整、命中区与标签都在 safeR=212 内）")
    print(f"  产物：{out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
