# Waveshare 1.75C 硬件交叉核对

核对日期：2026-10-15。范围：Waveshare 官方当前产品/ESP-IDF 文档、官方工程仓、PRD v2.1 转述和本地吧唧开发包。仅作来源核对与方案准备，不连接、不烧录、不改写设备。

## 用户提供的现状

- 用户有两块吧唧，当前一块可用。
- 当前没有记录两块的准确 SKU、PCB 丝印/revision、芯片 revision、电池状态或扬声器实装情况。
- “一块可用”表示可安排后续真机开发验证，不代表本轮已连上、枚举或复验。

## 官方资料确认

| 项目 | 当前官方资料所列内容 | 实物/实现注意事项 |
|---|---|---|
| 板型 | ESP32-S3-Touch-AMOLED-1.75C；不要与不带 C 的 1.75 混淆 | 用户两块设备实物 SKU 待登记 |
| 可售 SKU | 33691 含电池；33692 / 1.75C-EN 不含电池 | 需确认实物与电池/供电配置 |
| MCU | ESP32-S3R8，240MHz 双核 LX7 | 官方页面未列手中设备芯片 silicon revision；PRD 的 ESP32-S3 QFN56 rev v0.2 仅是历史报告 |
| 存储 | 32MB 外接 NOR Flash，8MB 叠封 PSRAM；另列 512KB SRAM/384KB ROM | 设计预算须看实际镜像、分区、PSRAM 使用和剩余堆，不把标称容量当应用可用容量 |
| 显示 | 1.75 英寸、466×466、16.7M 色 AMOLED；CO5300 控制器，QSPI | 屏幕方向、更新率、亮度/功耗需目标板实测 |
| 触摸 | CST9217 电容控制器，I²C | 坐标映射、边缘命中、旋转/方向和压力手势由真机校验 |
| 音频 | ES8311 codec、ES7210 麦克风 ADC、双麦克风；产品介绍称内置扬声器，资源图标注扬声器焊盘 | 正确口径是“产品规格称内置扬声器”，具体 unit 是否装配/接通需视物检查和单独声学测试；开发阶段不启动麦克风采集 |
| IMU/电源 | QMI8658 六轴 IMU、AXP2101 电源管理、RTC | 具体驱动和省电状态依托官方 BSP/真机验证 |
| 无线 | 2.4GHz Wi-Fi 与 Bluetooth 5 LE，板载天线 | 本期只做 Android 用户发起的前台 BLE；Wi-Fi 不进入首闭环 |
| 板载资源边界 | PRD/板卡资料没有列 NFC 或振动马达 | 首期不依赖这两项，不从模型建议中假定外设存在 |

官方网页没有给出 PCB revision 数字。PRD 的“v0.2”及硬件测试史不能直接绑定用户手上设备，也不是本机验收结论。

## BSP 与 LVGL 兼容性判断

- Waveshare 官方示例仓提供独立的 `waveshare/esp32_s3_touch_amoled_1_75c` managed board component，README 当前描述版本范围 `^3.0.0`，并提到 ESP-IDF 5.5+，CI 构建 ESP-IDF 5.5.5 和 6.0.2。
- 官方 ESP-IDF 页面列出 `02_lvgl_demo_v9`，故 LVGL v9 与该产品型号存在官方示例路径。
- 本地 ZIP 含标注 LVGL v9.5 的生成 C 文件，但仍需核对它引用的 API、配置、字体/图片资源与确切 BSP/ESP-IDF 组合。版本范围声明和文档示例不能代替锁定的 `idf_component.yml`/`dependencies.lock`、真实构建和上板验收。
- 推荐准备路线：先从官方仓已维护的 1.75C LVGL v9 示例及 component manager 配置建立可复现基线；记录官方仓 commit/tag、ESP-IDF 版本、BSP 确切解析版本和 LVGL 确切解析版本，再适配本项目页面代码。不要复制泛化 ESP32 示例的 pin map；板级引脚以官方 schematic/managed BSP 为准。

## 方案和阶段

1. 只读准备：整理官方资料和项目所需 pin/peripheral/API 对照；不下载/运行任何 flash script。
2. 主机会话先以 fake display/BLE fixtures 设计和 review UI/状态逻辑；从官方 1.75C 示例仓选择基线后，仅执行构建检查，不刷写当前硬件。
3. 首个可写入固件或触碰设备配置的真机阶段，应由主会话明确授权/安排；使用当前唯一可用板验证屏幕、触摸、BLE、事件确认及电源指标，保留第二块隔离不动。
4. 第二块恢复可用后，双板发现/互遇/事件去重和距离/断连边界单独验收。单板成功不能声称双板功能通过。

## 来源

- [Waveshare 产品页：ESP32-S3-Touch-AMOLED-1.75C](https://docs.waveshare.net/ESP32-S3-Touch-AMOLED-1.75C/)
- [Waveshare ESP-IDF 开发页](https://docs.waveshare.net/ESP32-S3-Touch-AMOLED-1.75C/ESP-IDF/)
- [Waveshare 官方示例仓](https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.75C)
- [本项目吧唧资产索引](badge-assets-index.md)与[分阶段开发方案](demo-review-and-development-plan.md)
