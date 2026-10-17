# 校时后 AOD face2 文字重叠：只读定位

## 亲看及来源核验

已亲看 Root 实际 `actual035-calibrated-face2.png`：12:07 与“轻点唤醒”在下方明显叠印，顶部“正在外面游玩”仍可见。原RGB565复算CRC **5ce64a8e**，SHA **b49bb1ee5e549c6416565502da77de6297805d580fede36aef670432a827e01d**，与JSON一致。它是实际设备运行LVGL对象树合成图，非光学扫出；AOD模式按Root记录，不能以此图判断面板物理亮度或tearing。

位置：`artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T0355Z-perf035/actual035-calibrated-face2.{png,json,rgb565}`。

## 原因与034继承关系

035 `source/main/badge_pages.c`：

- `set_mode` 第791行 standby 固定 `set_label(home_hint,"轻点唤醒",390)`。
- `update_clock` 第1148行 face1/2 固定clock中心398，校时后选 `badge_n40`。
- 两个函数内容与034逐字一致，分别SHA `ebcead42b4a82c753534d71c17466ffe60adc2b187e2635c8d0dde30e07a24c5` / `c7bc5f73197d91b0f70ebcddfaee3ac6a125739aa56abb1bb1dcde0a8afed150`。034对应788/1145行，同一缺口；不是035轮询守卫引入。036所有main逐字035，仍继承。

只读主机fixture运行原035完整pages+fonts+LVGL，用固定软件已校时状态进入AOD/face2（不修改任何生产源，不操作设备）测到：

- clock对象 `[153,382,312,413]`，当前数字font line_height=32，文本20:34。
- hint对象 `[108,381,357,399]`，font line_height=19；实际文字64×19。
- 两者y范围重叠382..399，共18行。这不是抓图时间差，也不依赖某个具体小时分钟。不能拿未校时/非standby的旧图宣布通过。

复现代码与原日志：`aod_readonly.c`、`aod-production035-readonly.log`。主机20:34是固定测试时间，不冒充设备截图12:07。

## 建议最小下一独立UI修订（未实施）

仅face1/2 standby时将hint中心由390改 **438**，face0继续390；clock位置/字号/时间规则/点击命中区域保持。即 `set_mode` 的提示中心参数按 `face ? 438 : 390` 选择。

原字体测量在438的实际文字边界 `[201,429,264,447]`，与clock底413间隔15px；最外文字角距圆心约217<233，留约16px圆内余量。label容器仍250宽、无背景，两端空白容器是否越圆边不等于文字被裁。这里只是源几何建议，尚无修改后软件/真实画面通过证据。

后续应覆盖face0/1/2 × 校时前后 × AOD进入/250ms刷新/恢复PLAY；同时检查16号字的真实字形边界、圆屏裁切、时钟格式与醒来后不残留。OFF状态可做软件布局/恢复检查，但不能称面板关闭时文字可见。

## 同时发现的standby可见性覆盖

`set_mode` 原本把face_phase隐藏；`refresh_state` 第1183行又无条件执行 `hide(face_phase, low && face==0)`，会在AOD时将它重新显示，吻合截图顶部phase仍在。主机原035 AOD也实测 `phase hidden=0`；034有完全同一语句。

如果后续UI目标仍沿用已有standby隐藏设计，可独立加一处 `MODE_AOD/MODE_OFF` 门禁，使phase的hide条件为 standby 或原低状态条件。不要改domain状态、不删实际scene；该条与时间避让分别验证。036未混入任何UI修复。

## 边界

本轮只新增本tests目录报告/只读fixture。034/035/036冻结source/APP/ELF/ZIP重新核验一致；无设备/USB/串口/ADB/刷写/Git/项目删除，无037运行源。
