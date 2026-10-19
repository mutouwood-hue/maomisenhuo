# 猫咪互动动作联动补充交付（052 / 070）

## 本批完成内容

- 吧唧新增原生 `sniff` 与 `pounce` 图层动画，由已有五种体型模型、原四种配饰遮挡层和既定颜色管线生成：192×208 画布，脚锚 `(96,196)`。没有换模型脸或新增随机互动。
- 手机把原有动作状态最小映射为可选展示提示：`flower_sniff`、`butterfly_chase`、`ball_pounce`、`bed_sleep`。手机只对声明 `scene_interaction_v1` 的吧唧发送；旧固件仍收到原始快照格式。
- 吧唧在现有 CFLOCAL2 快照链中按提示映射：闻花→`sniff`，庭院追蝶/房间扑吊球→`pounce`；床睡觉继续沿用现有贴床蜷睡呈现。互动提示仅驻留 RAM，不改 NVS 快照 schema、不新增照料事件或重复结算。
- 房间床、吊球与庭院接近/动作闭环沿用上一交付 051/069；本批不动相遇与镇街。
- 颜色配置保持已验收 068 的原始文件字节：ID `native-linear-aces-soft-v2-candidate`，SHA-256 `3736aa24b8928c3b02aba225b95edb39208a533be7ffb80123401719d9e1eeae`。用户验收状态已记录在[定稿协议](../../../protocol/2026-10-18-native-color-soft-v2-candidate.md)。

## 生产产物

| 端 | 版本 | 文件 | 字节 | SHA-256 |
|---|---|---|---:|---|
| 手机 | `0.5.2-cat-actions` / code 43 | `catforest-0.5.2-cat-actions-debug.apk` | 2,699,863 | `ab796b0d4d7bf5edf159ed499f334f02342030ed5ad3af57439f3aac6df82fee` |
| 吧唧 | `0.7.0-cat-actions` | `cat_forest_badge-0.7.0-cat-actions.bin` | 7,033,920 | `266b8c9c84d684b5c9eb1b47d2c2e298fbfe50182690dc1ebd0219c357dc8b6a` |

- 手机：Gradle 8.9 / JDK 21，`:app:assembleDebug -x test -x lint`，生产构建成功；appID `com.catforest.htmlcandidate`，证书 SHA-256 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`。
- 吧唧：ESP-IDF 5.5，隔离构建目录 `/tmp/catforest-cat-actions-badge-070`，生产构建成功。8 MiB OTA app 槽剩余 1,354,688 B。
- 吧唧帧资产：102 帧/体型；sniff 12 帧/2.4 秒，pounce 24 帧/2.4 秒；五种体型、四类配饰层、192×208、脚锚 `(96,196)`。分层 RLE 为 6,281,919 B，压缩固件数据 2,382,020 B。

构建与设备部署证据见 `BUILD-RECEIPT.json`、`MANIFEST.json`、`phone-install.log`、`phone-package-before.log`、`phone-package-after.log`、`FLASH-PLAN.json`、`FLASH-RECEIPT.json` 和 esptool 日志。手机 StepX PZ261A 从 051/code42 原位覆盖到 052/code43，`firstInstallTime` 保持 `2026-10-15 23:14:25`；吧唧 ESP32-S3 MAC `7c:0c:5f:42:36:84` 仅写入当前选择的 `ota_1 @ 0x820000`。esptool 回报 MAC 相符、数据哈希校验通过、exit 0。未清存档/NVS、不改绑定、引导、分区表、otadata 或素材分区。

## 真机验收步骤（由用户执行）

1. 手机 052 打开原猫存档：房间点吊球，观察猫走上攀架并扑抓；点床垫，观察走到床沿、短跳上床并贴床趴睡；点床外地面不应触发睡觉。
2. 进入庭院现有入口：观察闻花与追蝶各自的目标、动作、短气泡是否一致；不要以气泡文案替代真实动作判断。
3. 吧唧 070 查看房间扑吊球、庭院闻花/追蝶的分别动作与短气泡；睡觉仍显示现有贴床蜷睡。确认界面不遮猫脸，绑定与存档仍在。

本批只记录生产构建、覆盖安装和应用分区写入证据；没有运行单元测试、lint、浏览器自动验收、模拟触摸或蓝牙诊断。构建/部署成功不代表交互已经用户验收。
