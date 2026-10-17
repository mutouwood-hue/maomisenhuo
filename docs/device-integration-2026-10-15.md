# 2026-10-15 设备备份与安装实测记录

## 21:17 双份原固件备份完成

本次只读设备为 `/dev/cu.usbmodem2101`，MAC 与 USB 标识对应 `7c:0c:5f:42:36:84`。实读芯片为 ESP32-S3 QFN56 revision v0.2，内置 PSRAM 8MB AP_3v3；Flash JEDEC `c8:4019`，容量 32MB、quad、3.3V。`get_security_info` flags 为 0，Secure Boot / Flash Encryption 均 Disabled。工具为项目固定 esptool 4.12.0。

按用户明确授权进入下载模式，执行两次独立 `read_flash 0x0 0x02000000`，两次之间保持原应用不运行。每份 **33,554,432 字节**，共同 SHA256：

`75dd900def684d04f55b889e7e667027e62ecc8af417687a38c3a70cab26603e`

长度、SHA256、逐字节比较全部通过。第一轮北京时间 20:49:36–21:03:17；第二轮 21:03:17 起，至 21:17 已完成。精确结束时间以原始报告为准。

完整记录：[双读报告](../artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-15T1247Z/backup-result.json)。两份 raw、识别日志及报告仅留本地 ignored 的备份目录；未上传 Library、Notion 或远端。设备目前仍在 ROM 下载模式，尚未刷写、擦除、修改 eFuse / 安全配置或启动新固件。双份一致证明读取完整且稳定，不等于恢复已实测，也不包含 eFuse。

## 原 orange_cat_pet 固件及兼容性

官方解析器验证原分区表 MD5、对齐、范围和镜像校验成功。原 bootloader 为 ESP-IDF v5.5.5；原 `ota_0` 应用项目 `orange_cat_pet`、版本 `1`、IDF v5.5.5，编译时间 2026-10-14 15:02:29。它不是通用出厂演示。没有解析 OTA 选择数据，因此不凭镜像存在就称该槽位最近运行成功。

原布局：

| 分区 | 起点 | 大小 |
| --- | --- | --- |
| nvs | `0x9000` | `0x8000` |
| phy_init | `0x11000` | `0x1000` |
| otadata | `0x12000` | `0x2000` |
| ota_0 | `0x20000` | `0x800000` |
| ota_1 | `0x820000` | `0x800000` |
| assets_a | `0x1020000` | `0x700000` |
| assets_b | `0x1720000` | `0x700000` |

可保留/继续研究：完整原镜像和两份各 7MiB 的 assets 区域，及与候选相同的芯片/SDK 基线。当前取得的是二进制备份，**不是原工程源代码**；资源内容、格式、存档语义、屏幕与触摸引脚及完整玩法仍未复验，不能直接宣称新固件可以复用。

冻结候选会替换 bootloader `0x0`、分区表 `0x8000`、应用 `0x30000`。应用写入落在原 ota_0 内，破坏原应用中段；新分区表没有声明原 assets 区，即使对应 raw 未被这三段写入覆盖，也不能认定新程序能访问它们。新 NVS `0x9000..0x29000` 扩大后包含原 phy / otadata / 部分旧 app；SDK 可能在初始化恢复或后续需页时维护、擦除其中的异常页。因此不主动清空原 NVS，但也不能承诺新固件启动零改写或旧存档兼容。存储初始化错误应保留日志分析，不能自动 erase。

详见独立 [离线检查](../artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-15T1247Z/offline-inspection.md) 与 [精确交集](../artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-15T1247Z/offline-inspection.json)。具体板卡 SKU 和屏触兼容还需要实物/运行证据，芯片与容量相同不能替代这一项。

## 手机安装与首屏证据

实体 StepX PZ261A，Android 16 / API36，ARM64，ADB serial `ZYPZ261A01M65K0002A`；`emulator-5556` 为独立模拟器。

第一次安装被手机以 `INSTALL_FAILED_USER_RESTRICTED` 拒绝；用户手动允许并明确要求重试后，`install -r -t` 成功。此前没有安装此包；未 uninstall / clear，没有由自动化授予权限。版本 **0.3.0 / versionCode3**，从实际已安装路径读取 APK 后 SHA256 与冻结文件完全一致：

`a73f7872fa9712a57e9a1f55e728067631e2e7d193055dc743d0af5878fa32a9`

真实冷启动成功，原 3D 猫/房间正常显示，首次存档 payload SHA256 正确。首次猫 ID `993053c8-37a8-48e1-8e47-560c92733ea5`；这是新装，不是升级保留存档证明。没有触发 BLE 搜索/配对。证据：[安装结果](../artifacts/device-integration/2026-10-15T1245Z/phone-install-attempt2.json)、[启动与首屏](../artifacts/device-integration/2026-10-15T1245Z/phone-launch/launch-review.json)、[实际截图](../artifacts/device-integration/2026-10-15T1245Z/phone-launch/launch.png)。

用户已明确否定 0.3 的网页式主场景体验。安装/启动及底层校验成功**不代表体验流程通过、比赛可用或成品**。主场景线程 `01a13fb0-0cdc-7687-a6dd-3dd5299cd0fa` 现接管 Android 呈现层；硬件/安装/最终集成由原线程独占。源码底稿与锁见 [交接清单](../artifacts/handoffs/2026-10-15T1312Z/handoff.json)。

## 圆屏游戏的后续验收标准

吧唧同样按游戏体验验收：圆屏内以可辨识的场景和猫为主体，状态采用轻 HUD，触摸/出游/事件应有对应且连贯的动作反馈；浮层避让、关闭区域与文本尺寸需真机验证。冻结固件目前只有四页界面和两帧猫反馈，不满足上述完整游戏标准，不能因为编译/协议测试通过就称已完成。

下一步先保留原固件与备份，核实原资源/实际运行和板卡屏触；再按已披露的准确覆盖范围决定候选刷写与圆屏体验改进。本记录不自动执行写入。


## 21:42–21:50 UTC+8 更新：原应用已启动

普通复位后的 USB 串口启动日志已确认：`orange_cat_pet` version `1`，编译时间 `Oct 14 2026 15:02:29`，ESP-IDF v5.5.5，从原 `ota_0 / 0x20000` 加载。CO5300、CST9217（466×466）、LVGL task 均启动成功；NimBLE 开始广播。用户观察到“连接 App”，原应用镜像也含“连接 App”“尚未绑定”文本，因此此页来自原固件。尚无原源码或协议运行证据证明具体退出条件，不能把“等待绑定”的推断写成已验证分支。此前黑屏回复发生在最后一次普通复位之前，已由新启动证据更新。

证据：`artifacts/device-integration/2026-10-15T1330Z-badge-original-resume/attempt4-original-boot.log` 与 `current-firmware-conclusion.json`。未刷写/擦除 Flash，未改 eFuse/安全设置，未执行 BLE 配对。双份原始 32MiB 备份保持不变。

## 21:48 UTC+8：Android 冻结稿内部技术核验

唯一集成者构建 MainActivity SHA256 `698573f70ff3451bf16c99d55671d9d742f483b439522a7ad140db4eafc175b4`，Gradle assembleDebug 成功。新 APK SHA256 `42286b5d1f87f91cb0e2ad9bfdd4b325a4a0919ab0b38fddd9705b948d6fd1c8`，2,505,116B；已通过 `install -r -t` 安装到 StepX `ZYPZ261A01M65K0002A`，未清数据/卸载/批量授予权限，已读回安装APK确认哈希。安装前后存档逐字节相同，冷启动 Status ok。

本稿有已知原型偏差（底部四入口、三状态HUD等），仅作内部技术核验，**不是完成版、不是忠实还原验收通过**。独立还原副本由呈现线程继续开发。实际截图：`artifacts/device-integration/2026-10-15T1350Z-immersive-phone/home.png`。root在该次安装与截图期间未注入触摸；启动后的存档出现一次摸摸，不能将其归因为root测试，也不能据此声称互动验收通过（可能有人手动操作，尚未建立独占输入窗口）。
