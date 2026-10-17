# 053 live PAGE drag（纯 host 验证）

## 本批实现

- 12px 后 recognizer 锁轴；第一次 PAGE drag 锁定方向和目标，直到释放都不重选目标。
- HOME 上/下分别预览已预建 CARE/STATUS；CARE 下、STATUS 上返回已预建 HOME。
- 既有 SETTINGS/DEVICE/TOUCH/VOICE/MEET 的不同 PAGE 返回手势也使用同一跟手路径。无目标方向使用四分之一位移、最大 28px 回弹。
- 只移动原页面和目标页面对象，不做整页 bitmap、输入 snapshot 或 rebuild；preview 不调用 navigate，不产生保存或场景进入副作用。
- 按既有 053 release 契约提交：500ms 内至少 50px，或任意时长至少 140px；方向必须与首次锁定方向一致。200ms settle 完成后才调用 navigate，180ms rebound 不提交。反向穿过起点时位移回零，不切换预览对象。
- CANCEL / PRESS_LOST / INDEV_RESET、导航/standby/modal 中断与动画分配失败恢复 pos/hidden/press-lock；按下期间取消会吞余 contact。现有 300ms settle watchdog 继续负责异常超时恢复，不做超时补提交。

## 保留的边界

- HOME 横向两个 face **仍为 053 原来的 release 后 120ms 单页滑入**，没有采用旧的三 face/不准确 day peek，不宣称横向跟手优化。
- CARE_ACTION 保留原来 sleep/play/取消语义和 release 路径，不在 preview 启动动作或公告。
- 一天进程初始 DOWN 的 r=185..233 独占和 capture 分支未改；后续拖动不能抢走该 contact。HOME face=1 从中心开始仍可纵向切 PAGE。
- 没有加入上层最近 80ms、严格 >0.3px/ms 的 reverse velocity 新判据；仅遵循当前固件提交契约。反向不足以取消原方向 140px 提交时与原契约一致。
- 返回 HOME 的 preview 展示已建对象/上次投影，fresh face/clock/场景生命周期只在 commit 后正常运行；合入 host_day_draw 配套修补后，day 自定义 DRAW_POST 在已锁定目标 HOME 的 preview 也绘制，中心跟随真实对象绝对坐标，preview 仍不执行新投影。
- 不改 BLE、wire、state、协议、清洁逻辑、显示驱动、DMA/TE、main 启动栈，也不涉及锁屏连接任务。

## 运行

在 source 根目录，使用 Windows 已有 Python 和 clang/gcc：

```powershell
python tests/host_live_drag/run.py
```

runner 在系统临时目录逐字抽取生产 `badge_pages.c` 的 drag 函数，链接生产 `badge_gesture.c`，用内存 LVGL/导航 stub 验证对象生命周期；`-std=c11 -Wall -Wextra -Werror`。不安装工具、不连接设备、不跑性能基准，不修改旧 host_preview fixture。

通过覆盖：轴阈值/锁轴；50px fast 和 139/140px slow 边界；双对象位置/可见性；preview 无导航；延后一次 commit；不足距离 rebound；反向锁target回零；无目标 rubber；HOME↔CARE/STATUS 和 SETTINGS→STATUS；cancel/modal/reset-layer/动画分配失败恢复；HOME 横向 120ms legacy release。

这不是完整 firmware/LVGL 集成编译：stub 不能证明实际 LVGL 事件顺序、触摸采样或屏幕合成效果。旧 tools/host_preview/preview.c 的 318–330 行含陈旧三 face/peek 断言，本批没有运行或声称其通过。

## 真机待验（未执行）

- HOME 两 face 中央 DOWN 的纵向跟手、CARE/STATUS 返回的接缝/层级/圆屏裁剪。
- 拖离 source 后 PRESS_LOCK 的 contact 连续性；快速换向、手指离屏、PRESS_LOST/CANCEL、动画异常和连续 DOWN 的吞 contact 行为。
- day rim 初始 DOWN 独占及从中央开始拖到 rim 不重仲裁。
- release/settle 中与 gift/reset modal、正常状态投影的生命周期，以及 commit 后场景/clock/day 展示刷新。
- 053 横向 release 原行为的回归；未测真机帧率/延迟/撕裂，不作性能结论。
