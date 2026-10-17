# 吧唧 UI 与原始 23 屏的对应（2026-10-18 重写，按渲染证据判定）

输入为用户本地交互开发包 `badge_spec.json` v0.3.0（`main/assets/ui-contract-source.json` 保存 ZIP/spec 哈希、23 屏名字与手势）。
本轮用**主机渲染器**（`tools/host_preview/run_preview.py`）把生产 UI 渲成 PNG 逐屏核对，
产物在 `artifacts/firmware-local-v3/preview/<批次>/`。截图只证明布局/文案/图元，不是真机画面。

## 覆盖结论

23 屏中：**已实现 14 屏**、**部分实现 2 屏**（aod、voice）、**未实现 6 屏**（main_b、main_c、sleeping、meet_tap、meet_done、lowbat）、
**已取消 1 屏**（meet_scan：用户已决定不再开发手机扫码相遇确认）。

判定口径：以渲染结果为准。渲成空白或与另一屏像素一致的，一律按未实现计，不按源码里是否存在同名枚举计。

## 逐屏对照

| # | 原始屏幕 | 状态 | 证据 |
|---|---|---|---|
| 1 | main_a 主表盘 A | 已实现：原猫 idle/paw、五项状态弧、摸摸 | `main_a.png` |
| 2 | main_b 主表盘 B（24 小时时间环） | **未实现为独立表盘**：预览渲成空白；一天环目前只在 HOME 内嵌绘制 | `main_b.png`（空白） |
| 3 | main_c 主表盘 C（时间环 + 心动） | **未实现**：预览与 main_a 像素一致，无心动列表 | `main_c.png` |
| 4 | aod 待机常显 | 部分：降亮度 + 轻点唤醒；无带时钟常显、无抬腕唤醒 | `aod.png` |
| 5 | care_menu 照料轮盘 | 已实现：喂食/喝水/清洁/逗猫/睡觉 | `care_menu.png` |
| 6 | care_feed 喂食中 | 已实现：轻点碗三次 | `care_feed.png` |
| 7 | care_water 喂水中 | 已实现 | `care_water.png` |
| 8 | care_play 逗猫中 | 已实现：划动陪扑 | `care_play.png` |
| 9 | care_sleep 哄睡 | 已实现：按住月亮 1.5 秒 | `care_sleep.png` |
| 10 | sleeping 睡着了 | **未实现**：没有独立睡眠页，完成即回 HOME | — |
| 11 | status 状态 | 已实现：五项数值、喵币、队列与连接 | `status.png` |
| 12 | settings 设置 | 已实现：亮度/语音唤醒/附近可被发现/息屏常显、设备与同步、重看引导 | `settings.png` |
| 13 | touch_test 触摸自检 | 已实现：五靶点 + 完成页 | `touch_test.png`、`touch_complete.png` |
| 14 | voice 按住说话 | 占位：明确显示语音不可用，未启麦克风 | `voice.png` |
| 15 | meet 附近有小猫 | 已实现：双方各自确认 + 确认交换野花 | `meet_confirm.png` |
| 16 | meet_tap 碰一碰确认 | **未实现**：按用户决定改为吧唧画图/按按键，画面未设计 | — |
| 17 | meet_scan 扫码确认 | **已取消**（用户决定） | — |
| 18 | meet_done 成为朋友 | **未实现**：缺少成为好友的结果页 | — |
| 19 | away 小猫在外面 | 已实现（含雨/雪变体） | `away_rain.png`、`returning_snow.png`、`departing.png` |
| 20 | lowbat 电量不足 | **未实现**：无电量采样，无低电关机流程 | — |
| 21 | boot 开机 | 已实现 | `boot.png` |
| 22 | pair 配对 | 已实现：配对中/已连接/就绪 | `pair.png`、`pair_ready.png`、`pair_connected.png` |
| 23 | guide 首次引导 | 已实现：5 步教学关 | `guide_1.png` … `guide_5.png` |

## 渲染器的已知边界

- 触摸采样与边缘手势、圆屏真实裁剪、TE/局部刷新与帧率、功耗、设备字库实际观感，均不由渲染证明。
- 房间背景用空白 466×466 画布代替（`preview_glue.c`），页面图元仍是真实生产代码。
- `input_test` 预览用例在本机以 `0xC0000409` 退出，未定位，不影响其余 41 屏出图。
- 预览里的版本号来自测试桩，不等于当前固件版本。
