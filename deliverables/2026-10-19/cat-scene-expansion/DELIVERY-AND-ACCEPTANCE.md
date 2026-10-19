# 猫咪森活场景扩展交付（053 / 071）

## 本批实现

- 房间与庭院共用 `protocol/scene-layout-v1.json`。生成器输出手机侧 `CatSceneLayout` 和吧唧侧常量；房间 X/Z 环境与家具扩为 1.35 倍，庭院场景几何与走位锚点同步扩为 1.35 倍。
- 猫模型、帧尺寸、成长阶段比例、外观与配饰不缩放；房间相机参数不变。床与爬架/吊球、庭院花/蝶的布局和关键动作锚点按同一场景数据投影到吧唧圆屏。
- 保留当前 052/070 已有的床、吊球、闻花与追蝶交互；本批只调整空间尺寸与场景呈现，不改相遇或镇街，不新增随机互动、照料结算或存档字段。
- 吧唧沿用现有颜色配置 `native-linear-aces-soft-v2-candidate`，SHA-256 `3736aa24b8928c3b02aba225b95edb39208a533be7ffb80123401719d9e1eeae`；本批没有改模型脸或曝光配色。

## 生产产物与部署

| 设备 | 构建版本 | 文件 | SHA-256 |
|---|---|---|---|
| 手机 | `0.5.3-scene-expansion` / code 44 | `catforest-0.5.3-scene-expansion-debug.apk` | `9f0b0429ea1303d7d7a2387beb5d67a8382a5a13326f76f14a9e10b67b43683e` |
| 吧唧 | `0.7.1-scene-expansion` | `cat_forest_badge-0.7.1-scene-expansion.bin` | `b4faf3e57e741288aa856010b891658e525ba956442b5b4a4a26f33d410d6084` |

- 手机以 Gradle 8.9/JDK 21 完成生产构建；appID `com.catforest.htmlcandidate`，签名证书 SHA-256 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`。StepX PZ261A（`ZYPZ261A01M65K0002A`）从 052/code 43 原位升级到 053/code 44。安装前后 `appId=10191`、数据目录和 `firstInstallTime=2026-10-15 23:14:25` 保持不变；没有卸载、清数据或启动应用。
- 吧唧以 ESP-IDF 5.5 完成构建，镜像 6,602,336 B，8 MiB 应用槽余 1,786,272 B。部署前读取分区表、OTA 选择和应用头，确认设备 MAC `7c:0c:5f:42:36:84`、原版 070、目标 `ota_1 @ 0x820000`。写入仅涉及该应用槽；esptool 退出码 0、MAC 匹配且 `Hash of data verified`。没有写入 NVS、OTA 元数据、bootloader、分区表或素材分区，也没有执行 erase-all。
- 证据见 `BUILD-RECEIPT.json`、`FLASH-PLAN.json`、`FLASH-RECEIPT.json`、`badge-flash.log`、`phone-package-before.log`、`phone-package-after.log`、`phone-signing.log` 与 `phone-install.log`。

## 用户真机验收步骤

1. 在手机房间观察猫的显示尺寸与原来一致，房间和现有家具空间更舒展；点床垫与吊球，确认原有走位/动作仍落在床和爬架附近。
2. 通过原庭院入口进入小花园，观察小花、蝴蝶与猫的距离关系及可活动空间。
3. 查看吧唧房间与庭院画面，确认猫没有缩小、动作位置与场景语义一致，圆屏裁切下关键物件仍易辨认。

没有运行单元测试、lint、浏览器自动验收、模拟触摸或主动蓝牙诊断。生产构建、覆盖安装和应用分区写入已完成；**交互和视觉验收仍待用户真机确认**。
