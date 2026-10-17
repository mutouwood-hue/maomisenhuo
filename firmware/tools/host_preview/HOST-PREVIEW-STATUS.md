# 吧唧主机渲染器（离线出图）

用途：把**生产 UI 代码**（badge_pages.c / badge_day_ui.inc / badge_scene.c）用本地 LVGL 9.5 软件渲染成 PNG，
不接设备、不接面板、不需要 ESP-IDF 目标板。用于 PRD 9.3「吧唧界面」逐屏核对与改版前后对比。

## 怎么跑

```powershell
$env:Path = 'C:\Espressif\tools\cmake\3.30.2\bin;C:\Espressif\tools\ninja\1.12.1;<llvm-mingw>\bin;' + $env:Path
$env:CC='gcc'; $env:CXX='g++'; $env:CMAKE_GENERATOR='Ninja'
$env:IDF_PATH='D:/Espressif/v5.5.5/esp-idf'      # 只为取 cJSON
python firmware/tools/host_preview/run_preview.py --output artifacts/firmware-local-v3/preview/<名字> --jobs 2
```

输出目录含每屏 `<case>.png` / `.rgb565` / `.json`（字形缺失数、安全圆命中与标签越界统计）。

## 本轮为跑通所做的改动

- LVGL 路径改为优先用本仓 `firmware/managed_components/lvgl__lvgl`（原写法假定更深的旧目录布局）。
- cJSON：从 `IDF_PATH` 取头文件与 `cJSON.c` 一起编译（原来缺符号）。
- MinGW 缺 POSIX `strlcpy` / `gmtime_r` / `localtime_r`：`stubs/host_compat.h` 用 `-include` 补齐，仅主机预览生效。
- FreeRTOS 桩补 `portMUX_TYPE`、临界区宏；`esp_heap_caps.h` 补 `heap_caps_calloc/malloc/free`；新增 `esp_random.h`。
- 新增 `preview_glue.c`：提供设备上由诊断模块给的 `l2_runtime_core/l2_runtime_release`，
  并用一张空白 466×466 RGB565 画布代替 `warm-room.rgb565`（objcopy 嵌入在 MinGW/lld 组合下不可用）。
  **因此房间背景是空的，页面布局与文字/图元仍是真实生产代码绘制。**
- `run_preview.py`：`ROOT` 改为本仓根；Windows 下可执行文件加 `.exe`。

## 现状（2026-10-18 01:35）

- 已渲染 **41 个用例**成功（含 boot / guide_1–5 / main_a / main_b / main_c / care_menu / care_* / action_* / status / settings / device / aod / away_rain / returning_snow / gift_* / drag_* 等）。
- **已接门禁**：`python firmware/tools/ui_gate.py` 固定渲染 27 屏并校验「全部出图 + 字形不缺 + 命中区与标签都在 safeR=212 内」，已并入 `work/integrated/test-badge.py` 作为第 4 个套件（可用 `--skip-ui` 跳过）。
- 门禁上线当天抓到一个真实越界：care_menu 的「清洁需兼容手机确认」标签最大角半径 212.05，已上移 6px 修正。
- 未跑通：`input_test` 用例在本机退出码 `0xC0000409`。**它不是栈溢出，而是 harness 里的断言失败**（断言 → `__fastfail`）。2026-10-18 定位到三处陈旧断言并已修正：
  1. 睡觉完成后断言回 HOME —— 现在按设计进 `PAGE_SLEEPING`，已改成断言睡眠页 + 轻点回 HOME；
  2. 断言 HOME 横向拖动会进跟手预览（`ui_drag.to_face`）—— 053 起 HOME 横向是「松手切表盘」，不再有跟手预览；
  3. 回弹结束断言页面 y 严格为 0 —— 主机缓动末帧取整会留 1px（实测 -1），按 ±1 容忍。
- 仍剩两处，都在 `modal_and_route_checks()`，属该函数整体落后于 053+ 的设计，暂不再逐个修：
  1. **弹窗在拖动中到达后页面停在旧偏移**（实测 -80）。已确认 `stage_root` 非空、`drag_cancel()` 确实执行（`ui_drag` 归零），但 `lv_obj_set_pos(...,0,0)` 之后读到的 y 仍是 -80，怀疑是 LVGL 布局/滚动语义在宿主上的差异；去掉 `drag_cancel()` 里 `stage_root` 保护后现象不变，已回滚该改动。
  2. **横向扫动后断言 `face==0`** —— 现在 HOME 横向按设计是松手切表盘，扫完应为 `face==1`。
  结论：`input_test` 暂不纳入门禁；要跑通它得先按现行设计整体重写 `modal_and_route_checks()`，这是一件独立工作。
- 不是真机证据：不覆盖触摸采样、圆屏真实裁剪、TE/局部刷新、帧率与功耗；空房间画布也不代表真机配色。
