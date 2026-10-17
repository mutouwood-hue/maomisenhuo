# 2026-10-15 真机连接识别与候选写入影响

## 本次只读结果

北京时间 20:33 起取得 OS / USB / 现有 ADB 清单，随后仅对明确实体手机查询身份 `getprop`。本地执行通道已恢复。Library 上传按主会话指示暂停。

| 对象 | 实际证据 | 结论 |
| --- | --- | --- |
| 实体手机 | StepX PZ261A，product/device `pandora`；Android 16 / API 36；`arm64-v8a`；现有 ADB 状态 `device`；USB `18d1:4ee2` | 已有可用 ADB 通路，未代为开启调试权限 |
| 模拟器 | `emulator-5556`，`sdk_phone64_arm64` / `Android_SDK_built_for_arm64` | 与实体手机明确分开，不作为本次实体目标 |
| 吧唧 USB | Espressif `USB JTAG_serial debug unit`，USB `303a:1001`，location `0x02100000` | 仅确认 Espressif USB 身份，不能据此认定具体板卡 SKU 或芯片容量 |
| 吧唧串口 | `/dev/cu.usbmodem2101`，对应 `/dev/tty.usbmodem2101`；IOService 子树显示该串口归属上述 Espressif USB 设备 | 端口映射已证；没有打开串口 |

完整序列标识、手机 fingerprint 及 USB 父子关系仅保存在本地 [识别记录](../artifacts/device-identification/2026-10-15T1233Z/identification.json) 和 [USB 元数据](../artifacts/device-identification/2026-10-15T1233Z/usb-registry-metadata.txt)，不上传或放入冻结候选。

`system_profiler SPUSBDataType` 在本机返回空设备集合，因此 USB 证据来自实际 IORegistry 子树；不能把空结果解释为设备未连接。

## 仍未核实的设备信息

- 实物 PCB/SKU 是否确为 **Waveshare ESP32-S3-Touch-AMOLED-1.75C**。
- 实际芯片型号/版本、Flash/PSRAM 容量、Secure Boot、Flash encryption、下载模式限制。
- 当前固件版本、原分区表、存档与配对信息位置。

尚未运行任何 esptool 设备命令、复位/下载模式进入、Flash 读取、写入或擦除，也没有在实体手机安装或启动 App、配对、修改权限或系统设置。

## 备份可行性与下一步

当前没有原固件全量备份。Mac 本次可用空间约 41.4 GB；若实际确为 32 MiB Flash，两份独立 raw 备份合计 64 MiB，宿主磁盘空间足够。设备读取和恢复是否可行仍取决于真实芯片容量与安全状态，尚不能承诺可回退。

建议依次完成：

1. 用户确认实物 SKU，并明确允许对 **`/dev/cu.usbmodem2101`** 做芯片 / Flash / 安全状态只读识别。打开串口及 esptool 连接可能复位板卡、进入 ROM 下载模式或加载 RAM stub；本次元数据读取没有进行这些操作。
2. 容量与安全状态确认后，取得该设备两次独立全量读取授权。保持应用不运行，分别取得完整长度、SHA256，再逐字节比较；之后离线解析原分区表，评估存档与配对数据影响。具体流程见 [备份与恢复准备](device-backup-recovery.md)。
3. 报告结果后，再针对下列明确冻结候选取得独立刷写批准。App-only 更新同样必须先证明旧布局兼容。

## 冻结 0.3 候选的具体影响

拟用目录：`artifacts/2026-10-15-v03-candidate/`。本次仅重新计算哈希，没有改动候选。包标记为 **0.3.0-core-candidate**；固件自身项目版本仍为 **0.1.0**，两者不能混称。

| 内容 | 偏移 | 长度 | SHA256 |
| --- | --- | ---: | --- |
| bootloader | `0x0` | 22,272 B | `41958b79375b440782b478b600846ad4918298cc859f5d87f894b8ffae1cf1b3` |
| partition table | `0x8000` | 3,072 B | `59c9be697bd9b8b8e531d5edee32c2c1da5bd9fe3000791ea89997a4bd5845dc` |
| badge application | **`0x30000`** | 2,005,056 B | `0578681f37a23dd00981bfea6b4183aea4d4d0b3a5107151c72c408b13a82fef` |

写入设置为目标 `esp32s3`、`dio` / `80m` / `32MB`。按 4 KiB 扇区计算，三段写入涉及的擦写范围分别为 `0x000000–0x005fff`、`0x008000–0x008fff`、`0x030000–0x219fff`；这不是整片擦除。实际刷写命令尚未运行。

新布局的 NVS 为 `0x9000` / `0x20000`，phy 为 `0x29000` / `0x1000`，factory App 为 `0x30000` / `0x800000`。旧布局未知，因此即使不显式写 NVS，替换分区表和新固件首次运行仍可能使旧存档不可用、改变重叠数据或影响旧配对。完整 raw 备份不包含 eFuse，安全限制还可能阻止普通读取或恢复。

候选目前只有四页吧唧界面、基础两帧猫咪反馈和单板 BLE 闭环实现；屏幕/触摸/认证配对/掉电恢复/功耗仍需实际设备验收，不能把编译结果或模拟器结果当成通过。

配套 APK 为 0.3.0 / versionCode 3，SHA256 `a73f7872fa9712a57e9a1f55e728067631e2e7d193055dc743d0af5878fa32a9`。本次没有安装它。工作区新增视觉队列源码尚未构建验收，不能混入这个冻结候选。
