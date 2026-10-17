# v3 b4f1 独立host复核结果

**版本限定：** `badge_pages.c` SHA `b4f1cddbc289f6119373fae7ca80696180ba6c06965784cf8e4cd9e0d74fe99d`。本报告保存该版本实际结果；root随后另开单行引导演示周期修复窗口，不能自动将此pass套给新源。

## 实际结果

- 本人新编译/运行10组测试，**1873条断言通过，0失败，clang -Wall -Wextra零警告**。其中1560条是多个face/guide状态下完整几何边界断言，不是1560个用户场景。
- 编译真实pages（由未改owner preview的include引入）、scene、gesture、原字体与猫sprite源。只读复用已有LVGL静态库；BSP/domain/peer/NVS/物理输入替代层及pointer feed helper复用owner夹具，**未调用owner main或424断言套件**。
- 本人只读复核owner76张PNG的SHA，重算2660条逻辑target、71个enabled可见control与424个静态label的R212边界，0异常。它是核查已有产物，不冒称本人重新渲染76张或逐张人工目视。
- 25条实际toast原文均完全显示，真实LVGL字体extent宽高均放入content；无DOTS，原文相等。目视现有toast_10/20 PNG完整呈现“引导未存请重试”“礼物已存待确认”，无省略或半行裁切。
- 测试前后所有记录源码hash一致，结束后再次读回一致。完整命令、源码hash、每组log及替代层边界保留在报告。

## 问题闭环

| 发现 | 本版验证 |
|---|---|
| L3-01 P1 gift modal睡觉/逗猫穿透 | 新按睡觉1.8秒、旧按800ms时弹层再续1100ms、INDEV_RESET取消、逗猫7轮快划均无care；通过 |
| L3-02 P2 modal drag/settling穿透 | 活动drag到达gift立即归零；settling到达gift不切face；弹层内四向划动无page/face/care变化；通过 |
| L3-03 P2 toast盖guide | 新180×40 bounds与guide圆分离；toast起按拖至猫区域仍整程吞接触，无PET/导航；通过 |
| L3-04 P2 toast省略待确认/错误语义 | 25条生产announce literal真实字体尺寸+原文相等全部通过；短句保留未存/失败/待确认差异 |

未在本次独立执行范围发现新P1/P2。对新视觉周期单行变更需后续最小delta复核，当前不编译。

## 交付与复现

- [run_independent.py](run_independent.py)：`python3 tests/local3-review/run_independent.py`；严格要求该b4f1冻结源，源变化会拒绝，不能对未来版本不改哈希就宣称复现。
- [independent_runner.c](independent_runner.c)、[independent-report.json](independent-report.json)：本人10组/1873断言与全hash；各组独立进程、真实LVGL pointer/tick。
- [audit_accepted.py](audit_accepted.py)、[accepted-artifact-audit.json](accepted-artifact-audit.json)：只读已有76帧/source/PNG/全部实际toast/完整geometry复核。
- [accepted-manifest-b4f1.json](accepted-manifest-b4f1.json)：保存本版owner manifest，不依赖后续“latest”指针。
- [matrix-results-b4f1.md](matrix-results-b4f1.md)：38条逐项区分本人执行/owner证据/静态/待验，未谎称全部独立实机通过。

## 仍待验证/缺口

真实屏幕/触摸/帧率、PSRAM/亮度/AOD、音频、SDK NVS失败与掉电、Java/GATT/无线双方均未由本UI夹具验证。B/C缺权威日程和心动时间，保留双空环和明确待数据状态；不是虚构填充。toast接触是独立PRESSED ownership排除区，不在36项控件registry中，不能对外称所有输入共用单一registry。NPC banner daily6/6未触发仍待实际条件；未绕限流/时钟/存档。

本人没有操作设备/ADB/串口/浏览器/GUI，未改产品、UI owner工具或冻结v2。独立编译窗口已通知root释放。
