# 设备识别、备份与恢复准备

2026-10-15 21:17 更新：经用户明确授权，已读取 `/dev/cu.usbmodem2101` 的实际 ESP32-S3 v0.2 / 32MB Flash / 8MB PSRAM 和安全状态；两次独立完整 32MiB Flash 备份的长度、SHA256 与逐字节比较全部通过。Secure Boot / Flash Encryption 关闭；没有写 Flash、擦除或改 eFuse，设备仍在 ROM 下载模式。手机 0.3 APK 经用户手动允许 USB 安装后原位安装并核验已安装字节一致，真实首屏已显示；体验被用户否定，不能称比赛可用。最新证据、原固件分区冲突与圆屏游戏验收标准见 [设备联调记录](device-integration-2026-10-15.md)。以下为流程与模板说明，不能替代实际恢复或新固件上板验收。

## 连接后先报告什么

由用户确认实物为 Waveshare ESP32-S3-Touch-AMOLED-1.75C，记录可见 PCB/SKU 标记、连接方式和本次使用的唯一设备。官方标称 32 MB Flash/8 MB PSRAM 只是规格基线；USB 描述、串口名和 PRD 历史报告都不能证明当前芯片容量或安全状态。

`scripts/identify-devices-readonly.py` 只输出 OS、`/dev/cu.*` 名称、macOS USB 注册信息及现有 localhost ADB server 的设备清单，不打开串口、不重置芯片、不调用 esptool、不安装/配对/授权、不执行任何设备 shell。输出含 USB/Android 序列标识，保留本地。为避免 `adb devices -l` 在缺少 server 时自启后台进程，脚本直接使用相同的只读 `host:devices-l` 查询；server 不存在就报告跳过，不创建它。`--skip-adb` 可仅列 OS 信息。本任务只做脚本语法检查，不运行其识别逻辑。

主会话先报告端口与 USB 标识的对应关系及仍未知项。需要打开串口取得实际芯片、Flash 容量和安全信息时，另取得该端口的只读识别授权；esptool 的连接可能复位板卡、进入 ROM 下载模式或临时加载 RAM stub，不能把它当作纯 OS 元数据查询。不得在无法确定设备对应关系时尝试任意端口。

实际识别确认 ESP32-S3、32 MiB 容量及允许读取的安全模式后，主会话报告结果并申请**该设备的两次完整读取备份授权**。任何加密、Secure Boot、下载禁用、容量不符或权限失败均先报告，不强制绕过。备份完成后仍需对具体候选及写入范围取得**独立刷写授权**。

## 实际工具与构建偏移

项目 IDF Python 环境当前安装的是 **esptool 4.12.0**，官方 SDK 约束为 `esptool~=4.12`；不是 v5。已仅运行本地顶层 `--help` 并读取已安装源码，确认 `read_flash`、`write_flash`、`flash_id`、`get_security_info` 及下列参数。没有调用这些设备子命令。Python 路径为 `.tools/idf-tools/python_env/idf5.5_py3.13_env/bin/python`。

v5 官方资料改用 `read-flash`/`write-flash` 等连字符拼写，不能把 v5 示例直接用于当前环境；本任务不安装或升级工具。[Espressif 当前命令说明](https://docs.espressif.com/projects/esptool/en/latest/esp32s3/esptool/basic-commands.html)

当前 `firmware/build/flash_args` 和 `flasher_args.json` 的实际布局为：

| 文件 | 偏移 | 字节数 | SHA-256（本次只读快照） |
| --- | --- | ---: | --- |
| `firmware/build/bootloader/bootloader.bin` | `0x0` | 22,272 | `41958b79375b440782b478b600846ad4918298cc859f5d87f894b8ffae1cf1b3` |
| `firmware/build/partition_table/partition-table.bin` | `0x8000` | 3,072 | `59c9be697bd9b8b8e531d5edee32c2c1da5bd9fe3000791ea89997a4bd5845dc` |
| `firmware/build/cat_forest_badge.bin` | **`0x30000`** | 2,005,056 | `0578681f37a23dd00981bfea6b4183aea4d4d0b3a5107151c72c408b13a82fef` |

烧录参数为 `dio`、`80m`、`32MB`，目标 `esp32s3`。本次 `flasher_args.json` SHA-256 为 `9c6acb86a2a5ea57ff84547fb32413c4530b969e6271279b2c794450b7297ffb`。**App 不能套用常见示例的 `0x10000`。**

冻结的 `artifacts/2026-10-15-core-candidate/firmware/` 为早先 0.1 候选：bootloader/partition-table 与上表相同，App 为 1,955,392 字节、SHA-256 `5cbd1764248ba10dd46e365aa3c26c58cf726022013eb49bae1ebe4f28b121d0`。它与当前 build App 不同。本次未修改冻结候选。实际刷写前必须指定完整冻结目录、重新核验三文件及布局清单，禁止把不同候选的 App、分区表和地址混用。

## 两次独立 32 MiB 备份

32 MiB = 33,554,432 字节 = `0x02000000`。仅在实际容量已确认、全量读取已获明确授权且安全模式允许时执行。以下为**不可直接运行的占位模板**，不是自动化入口：

```text
<PROJECT_PYTHON> -m esptool --chip esp32s3 --port <CONFIRMED_PORT> --baud <CONFIRMED_BAUD>
  --before <APPROVED_RESET_MODE> --after no_reset
  read_flash 0x0 0x02000000 <LOCAL_BACKUP_DIR>/fullflash-read1.bin

<PROJECT_PYTHON> -m esptool --chip esp32s3 --port <CONFIRMED_PORT> --baud <CONFIRMED_BAUD>
  --before no_reset --after no_reset
  read_flash 0x0 0x02000000 <LOCAL_BACKUP_DIR>/fullflash-read2.bin
```

实际命令需要合并成正确 argv，不要复制带尖括号的模板。第一轮 reset 模式须按确认的 USB/串口通路选择，不能推定任意 DTR/RTS 行为。当前 4.12 源码中 `--after no_reset` 会从 stub 回 ROM loader；两次之间保持应用不运行，降低 NVS 变化造成不一致的可能。若端口重枚举、芯片复位或应用重启，重新报告状态，不盲目续用端口。

每次必须是对设备的独立全量读取，不是复制第一份文件。分别验证长度、SHA-256，再逐字节比较；两份一致后才能标记“已验证完整读取”。不一致时保留两份、报告差异并停止写入。串口速度先选确认稳定的值，失败再有记录地降速；不要承诺固定完成时间。32 MiB 在 460800 波特的 UART 理论串行时间约每次 12 分钟，115200 约每次 49 分钟，协议和 USB 通路会改变实际时长。

备份目录按单设备和时间隔离，例如 `artifacts/device-backups/<DEVICE_LABEL>/<UTC_TIMESTAMP>/`。记录用户确认的 SKU、端口/USB 标识、工具版本、容量/安全状态、reset/baud、读命令、开始结束时间、两份长度/哈希/比较结果和日志。`.gitignore` 已忽略整个 `artifacts/`。raw、NVS、密钥相关内容及序列标识只留本地，不上传 Library/Notion/GitHub，不放进候选源码包；不要把 raw 内容打印到会话。

## 原分区、NVS 和安全限制

候选 CSV 定义 NVS 在 `0x9000`、大小 `0x20000`，phy 在 `0x29000`，factory App 在 `0x30000`。这些是**新候选**的分区，旧设备的分区/NVS、存档、配对信息或其他数据目前未知。备份后应先离线识别原分区表及有效性，再评估布局是否冲突；不要用候选 CSV 解释旧数据。刷写分区表或首次运行不同固件都可能影响旧数据的可用性。

Flash 备份不包含 eFuse。Flash encryption 的数据/密钥及下载模式限制、Secure Boot 的签名和防回滚状态可能使普通读取失败，或使读出的密文不能按普通明文流程恢复。不能承诺跨芯片恢复，也不能把两个相同 raw 哈希当作解密/启动能力证明。遇到这些状态须另行评估同一芯片、原签名镜像、密钥与下载策略；不修改 eFuse、安全模式或保护位，不使用强制/忽略保护参数。[ESP32-S3 Flash Encryption 官方说明](https://docs.espressif.com/projects/esp-idf/en/v5.5.5/esp32s3/security/flash-encryption.html)

## 独立授权后的候选写入与回退模板

没有独立整片擦除步骤，也不提供 erase 命令。任何 Flash 写入仍会覆盖目标区域并可能擦除对应扇区，须在已验证备份、确认旧数据影响和取得明确写入授权后进行。App-only 更新也须先确认现有分区兼容；不能跳过备份而假定旧设备已经采用此布局。

候选写入仅作范围说明，具体候选目录及每项哈希须在授权时展示：

```text
<PROJECT_PYTHON> -m esptool --chip esp32s3 --port <CONFIRMED_PORT> --baud <CONFIRMED_BAUD>
  --before <APPROVED_RESET_MODE> --after <APPROVED_AFTER_MODE>
  write_flash --flash_mode dio --flash_freq 80m --flash_size 32MB
  0x0 <FROZEN_CANDIDATE>/bootloader/bootloader.bin
  0x8000 <FROZEN_CANDIDATE>/partition_table/partition-table.bin
  0x30000 <FROZEN_CANDIDATE>/cat_forest_badge.bin
```

回退也是独立写入行为，只有同一已确认设备、可普通恢复的安全状态及已核验原始备份才考虑。以下模板**不自动执行**，不表示当前已有恢复文件：

```text
<PROJECT_PYTHON> -m esptool --chip esp32s3 --port <CONFIRMED_PORT> --baud <CONFIRMED_BAUD>
  --before <APPROVED_RESET_MODE> --after <APPROVED_AFTER_MODE>
  write_flash --flash_mode keep --flash_freq keep --flash_size keep
  0x0 <VERIFIED_ORIGINAL_FULLFLASH_32MIB>
```

在无安全限制的适用条件下，写后仍需授权的独立回读/比较与原功能检查；回退不是恢复 eFuse、安全计数、云端状态或 Android 数据的手段。当前没有 fullflash 文件，所以当前不能执行上述回退。
