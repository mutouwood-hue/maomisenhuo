"""核对 UI-COVERAGE.md 与渲染产物是否一致，防止改了页面却忘记更新覆盖表。

检查项：
1. 汇总行的 已实现 / 部分 / 未实现 / 已取消 数字必须等于逐屏表格的实际计数；
2. 逐屏表格必须正好覆盖 23 屏，且编号 1..23 不重复不缺失；
3. 标为已实现或部分实现的屏，其"证据"列里提到的每个 *.png 都必须真实存在于
   artifacts/firmware-local-v3/preview/ 下的某个批次里。

用法：python firmware/tools/check_ui_coverage.py
不渲染、不联网、不依赖 LVGL；只读文件。
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
COVERAGE = ROOT / "firmware/UI-COVERAGE.md"
PREVIEW_ROOT = ROOT / "artifacts/firmware-local-v3/preview"
EXPECTED_SCREENS = 23


def load_pngs() -> set[str]:
    if not PREVIEW_ROOT.exists():
        return set()
    return {p.name for p in PREVIEW_ROOT.rglob("*.png")}


def classify(status: str) -> str:
    if "已取消" in status:
        return "cancelled"
    if "未实现" in status:
        return "missing"
    if "部分" in status:
        return "partial"
    if "已实现" in status:
        return "implemented"
    return "unknown"


def main() -> int:
    text = COVERAGE.read_text(encoding="utf-8")
    problems: list[str] = []

    summary = re.search(r"已实现\s*(\d+)\s*屏.*?部分实现\s*(\d+)\s*屏.*?未实现\s*(\d+)\s*屏.*?已取消\s*(\d+)\s*屏", text, re.S)
    if not summary:
        problems.append("找不到汇总行（应包含 已实现/部分实现/未实现/已取消 四个数字）")

    rows = []
    for line in text.splitlines():
        m = re.match(r"^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$", line)
        if m:
            rows.append((int(m.group(1)), m.group(2), m.group(3), m.group(4)))

    numbers = [r[0] for r in rows]
    if sorted(numbers) != list(range(1, EXPECTED_SCREENS + 1)):
        problems.append(f"逐屏表格应恰好覆盖 1..{EXPECTED_SCREENS}，实际编号为 {numbers}")

    counts = {"implemented": 0, "partial": 0, "missing": 0, "cancelled": 0, "unknown": 0}
    pngs = load_pngs()
    for number, name, status, evidence in rows:
        kind = classify(status)
        counts[kind] += 1
        if kind == "unknown":
            problems.append(f"第 {number} 行状态无法归类：{status[:40]}")
        if kind in ("implemented", "partial"):
            for png in re.findall(r"([\w.-]+\.png)", evidence):
                if png not in pngs:
                    problems.append(f"第 {number} 行（{name.strip()}）引用的渲染图不存在：{png}")

    if summary:
        want = (counts["implemented"], counts["partial"], counts["missing"], counts["cancelled"])
        got = tuple(int(x) for x in summary.groups())
        if want != got:
            problems.append(f"汇总数字 {got} 与逐屏计数 {want} 不一致（顺序：已实现/部分/未实现/已取消）")

    if problems:
        print("FAIL: UI-COVERAGE 与产物不一致")
        for item in problems:
            print(" -", item)
        return 1

    print("PASS: UI-COVERAGE 汇总与逐屏计数一致，且所有引用渲染图均存在")
    print(f"  已实现 {counts['implemented']} / 部分 {counts['partial']} / 未实现 {counts['missing']} / 已取消 {counts['cancelled']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
