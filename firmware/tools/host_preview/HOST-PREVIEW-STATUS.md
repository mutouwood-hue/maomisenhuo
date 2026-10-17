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

## 现状（2026-10-18 00:20）

- 已渲染 **41 个用例**成功（含 boot / guide_1–5 / main_a / main_b / main_c / care_menu / care_* / action_* / status / settings / device / aod / away_rain / returning_snow / gift_* / drag_* 等）。
- 未跑通：`input_test` 用例在本机退出码 `0xC0000409`（栈缓冲越界保护），发生在该用例自身，不影响其它页面；未定位。
- 不是真机证据：不覆盖触摸采样、圆屏真实裁剪、TE/局部刷新、帧率与功耗；空房间画布也不代表真机配色。
