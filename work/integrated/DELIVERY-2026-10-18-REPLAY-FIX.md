# 本次交付：041 / 056 hearts 重传修复

手机已覆盖安装成功；吧唧应用镜像已写入成功并由烧录工具重启。本记录只报告实际构建和设备操作，不作为技术测试或交互验收结论。完整机器可读身份见 [MANIFEST](../../deliverables/2026-10-18/hearts-replay-fix/MANIFEST.json)。

## 源码修正

- `firmware/main/local2_day.c`：同一 transfer 的 part 0 重传先比较 `heart_count`，再比较每个分钟值；不同内容沿用原有 `L2_INVALID`，不改 RAM 里已接收的数据。active 和 staging 两条重传路径共用此判定。缺省 `hearts` 与空数组均为零个标记，保持原协议语义。
- 固件构建版本和 HELLO 同步升到 `0.5.6-day-hearts-replay`。手机仅升版到 `0.4.1-day-hearts-replay` / versionCode 32，打包该分支已提交的 Android assets，没有改手机业务规则。
- 修正旧 055 的大小/完整 SHA，并将初次集成、原始 040/055 和本次 041/056 的交付记录分开。

## 实际产物

| 端 | 文件（均在 `deliverables/2026-10-18/hearts-replay-fix/`） | 大小 | 完整 SHA-256 |
|---|---|---:|---|
| 手机（原证书签名的 debug 包） | `catforest-0.4.1-day-hearts-replay-debug.apk` | 809,591 B | `31dda5f0c0baa96dc5bcd019f0be335651a3859edce8d7f369151b9abe69036e` |
| 吧唧（含本次修复） | `cat_forest_badge-0.5.6-day-hearts-replay.bin` | 6,886,272 B（0x691380） | `b8d594224e83754c8d57e959af04c8c461932e43d0176143665c43a71d4fbce1` |

新镜像内应用描述符为 `cat_forest_badge` / `0.5.6-day-hearts-replay`。`0x800000` 是单个应用分区容量（8,388,608 B），新镜像余 1,502,336 B（约 18%）；容量与分区表未改动。

旧 `cat_forest_badge-0.5.5-day-hearts.bin` 保留，仍为 6,886,224 B / `4d6b3fd6365820df309933503c93e506847347e3643276c7f761cbb68d3eadc7`，**不含本次修复**。旧产物纠正身份见 [原始批次记录](DELIVERY-2026-10-18.md)，历史初次集成数字保留在 [DELIVERY-INTEGRATED](DELIVERY-INTEGRATED.md)。

## 实际构建记录

- Android：JDK 21.0.12.1+1、Gradle 8.9、AGP 8.7.3、Android 35，离线 `:app:assembleDebug -x test -x lint`，exit 0。初次选用的工具目录签名与设备不符，未安装；找到已有 ui038 原签名后重新打包成功。新旧 APK 公开证书 SHA-256 均为 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`。没有创建或输出凭据。
- 固件：ESP-IDF 5.5.5 / esptool 4.12.0，使用已有组件和相同依赖锁。首次构建沿用的旧 sdkconfig 关闭 snapshot，与当前源码默认值不符，编译失败；隔离 sdkconfig 按当前 `sdkconfig.defaults` 对齐后构建 exit 0。没有修改主工作目录的源码或配置。
- CMake 数字版本也同步为 `0.5.6`，最终增量构建 exit 0，应用镜像 SHA 与已烧录实物一致，未重复烧录。
- 日志：`phone-build-original-signing.log`、`badge-build-current-defaults.log`、`badge-build-final-version.log`；初次构建日志也保留在同一交付目录。构建内部尺寸检查属于打包步骤，没有运行测试套件、lint 或界面预览。

## 设备操作记录

手机：StepX PZ261A，ADB 序列号 `ZYPZ261A01M65K0002A`。原安装 `0.3.8-little-moments` / code 29，使用原证书 `adb install --no-incremental -r` 升级为 041 / code 32，输出 `Success` / exit 0。包管理器仍为 appId 10191、firstInstallTime `2026-10-15 23:14:25`。没有卸载、清数据、重绑或启动应用验收；没有读取应用存档内容。日志为 `phone-install.log`。

吧唧：ESP32-S3（QFN56 rev 0.2），MAC `7c:0c:5f:42:36:84`，串口 `/dev/cu.usbmodem1101`。只读现有分区表与 OTA 元数据，确认启动选择 `ota_1 @ 0x820000` / 容量 `0x800000`；原应用头为 `0.5.3-day-startup`。本次仅向该应用地址写入上表 056 镜像：esptool exit 0，记录 `Wrote 6886272 bytes ... at 0x00820000`、`Hash of data verified`，随后 `Hard resetting via RTS pin`。这是写入流程的传输校验，未另行运行技术测试或读取运行界面。没有写入 bootloader、分区表、NVS、OTA 元数据或资产分区，也没有整片擦除。日志为 `badge-flash.log`。

## 验收边界

本次没有运行技术测试、BLE/照料/相遇回归、界面预览或交互验收。安装与写入成功不代表运行行为已经验证；原记录中的 79/94/111/142 等通过数均不算本次结果。设备完成后由用户打开手机和吧唧查看版本、存档与绑定并验收。
