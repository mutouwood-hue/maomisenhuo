# 猫咪互动首批交付（051 / 069）

## 本批功能

- 房间吊球：可直接点粉色吊球，复用现有攀架、跳跃、抓球和收尾动作，整段只进入原照料结算一次；互动阶段使用短气泡提示。
- 房间猫床：只点床垫才开始睡觉；猫先走到床沿，再短跳上床，身体贴合床垫趴睡；醒来从床沿跳下再回到原位置。原有床上支撑姿势保留。
- 庭院：沿用已有庭院事件入口与花/蝶目标。闻花与追蝶有接近、面向目标、闻嗅/扑蝶动作阶段；头顶短气泡分别提示“闻花香”“扑蝴蝶”。没有新增自动随机连锁触发。
- 吧唧：房间攀爬和庭院互动沿用现有 `PLAY` 状态链；场景同步为 garden 时显示短小的“庭院互动”气泡。没有新增长期离线实时同步声明或额外结算字段。
- 原 068 颜色配置保持：`native-linear-aces-soft-v2-candidate`，SHA-256 `3736aa24b8928c3b02aba225b95edb39208a533be7ffb80123401719d9e1eeae`。滑页、BLE 内存修复、外观/配饰和相遇实现均未在本批改动。

## 产物与构建

| 端 | 交付版本 | 文件 | 字节 | SHA-256 |
|---|---|---|---:|---|
| 手机 | `0.5.1-cat-interaction` / code 42 | `catforest-0.5.1-cat-interaction-debug.apk` | 2,699,447 | `7f08c991d03d2cabf721af8b7ccd3138ab37b8abb07106a50c239813c3dc7bc2` |
| 吧唧 | `0.6.9-cat-interaction` | `cat_forest_badge-0.6.9-cat-interaction.bin` | 6,179,600 | `c325c25ac91e2470ed001cc120cb5c14c6a8d6d8281099550aab889e32e761a8` |

- 手机：Gradle 8.9 / JDK 21，离线 `:app:assembleDebug -x test -x lint`，构建成功。APK appID `com.catforest.htmlcandidate`；原证书 SHA-256 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`。
- 吧唧：ESP-IDF 5.5.5，隔离构建目录 `/tmp/catforest-cat-interaction-badge-069`，生产构建成功。8 MiB 应用槽剩余 2,209,008 B。
- Android 生成资源与 `app/web` 源文件静态比对一致；相关 JS 语法检查通过。未运行单元测试、lint、浏览器自动验收或模拟触摸。

## 部署证据

- 手机 StepX PZ261A，ADB 序列号 `ZYPZ261A01M65K0002A`：`adb install --no-incremental -r` 返回 `Success`。版本从 050/code41 升为 051/code42，appID 保持不变，`firstInstallTime` 仍是 `2026-10-15 23:14:25`。未卸载、清数据、重绑或启动应用做交互验收。
- 吧唧 ESP32-S3，MAC `7c:0c:5f:42:36:84`：写入前只读校验分区表 MD5，设备布局与构建布局一致，OTA 记录选择 `ota_1`；当前 app 为 `0.6.8-soft-color`。仅向 `ota_1 @ 0x820000` 写入 069 app 镜像。esptool 返回设备 MAC、`Wrote 6179600 bytes`、`Hash of data verified`、exit 0，并执行普通硬复位。
- 未写入 bootloader、分区表、otadata、assets 分区；未执行整片擦除、NVS 清理或绑定重置。没有读取存档内容或做运行状态诊断。

构建、安装与烧录日志及机器可读快照在本目录：`phone-build.log`、`phone-install.log`、`phone-package-before.log`、`phone-package-after.log`、`FLASH-PLAN.json`、`FLASH-RECEIPT.json`、`badge-build.log`、`badge-flash.log`。

## 真机验收（待用户）

1. 打开手机 051 原存档，直接点房间吊球，确认猫走攀架、扑抓吊球并正常结束；再点床垫，确认走到床沿后短跳上床，身体/脚贴床，醒来跳下并走回；点床外地面不应触发睡觉。
2. 按已有入口进入庭院，观察闻花/追蝶时猫的目标、朝向、动作和短气泡是否一致；气泡不应挡住可点物件。
3. 查看吧唧 069 的房间/庭院状态和小气泡，检查连接状态、绑定与存档仍在。

本次只证明构建、覆盖安装与 app 分区写入完成，不代表上面任何交互已通过验收。吧唧目前的动画资源是 192×208 透明帧（脚锚点 96,196），现有 native clip 为 idle / walk / attention / pet，没有专用闻花和扑蝶动作；本批保留兼容的 `PLAY`/walk 表现与“庭院互动”短气泡。后续如要吧唧逐帧对应手机动作，需要两套按现有 5 种成长体型 × 5 种配饰图层产出的 `sniff` 与 `pounce` 透明帧动画，并给出循环/单次时长与关键帧节奏。
