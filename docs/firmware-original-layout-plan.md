# 原分区布局兼容与可回退方案

基线：2026-10-15 两份完整 Flash 备份，均为 33,554,432 字节，SHA-256 `75dd900def684d04f55b889e7e667027e62ecc8af417687a38c3a70cab26603e`。本任务再次离线核对 SHA 和逐字节一致性；未访问设备、串口、ADB，未构建、改产品文件、生成刷写载荷或执行写入。所有“当前”选槽结论均指**备份时点**；设备若已恢复运行，执行前须由串口唯一持有者重新核对相关状态。

## 推荐结论

保留原 bootloader、分区表、NVS/PHY、原 ota_0、双 assets；新工程按原分区布局构建，只将新 app 写入备份中全空的 ota_1，再独立、精确地切换 OTA 选择记录。这比覆盖 ota_0 更便于撤回。**32 KiB NVS 从现有分配状态和双代 blob 预算看可行，不需要为单个 200 事件存档扩大分区**；连续提交、断电恢复和配对压力仍须完成验收，不能据本预算宣称已通过。

原存档和新协议的语义兼容未知。保持 namespace/key 隔离，不主动清空 NVS；NVS 在原范围内正常垃圾回收仍会写 Flash，复原旧应用二进制不等于恢复旧 NVS 到同一时点。

## 1. 原布局与保留范围

| 名称 | 起点 | 大小 | 末端（不含） |
|---|---|---|---|
| bootloader（非分区表项） | 0x0 | 原镜像及启动扇区保持 | — |
| partition table | 0x8000 | 原表保持 | 0x9000（扇区末端） |
| nvs | 0x9000 | 0x8000 | 0x11000 |
| phy_init | 0x11000 | 0x1000 | 0x12000 |
| otadata | 0x12000 | 0x2000 | 0x14000 |
| ota_0 | 0x20000 | 0x800000 | 0x820000 |
| ota_1 | 0x820000 | 0x800000 | 0x1020000 |
| assets_a | 0x1020000 | 0x700000 | 0x1720000 |
| assets_b | 0x1720000 | 0x700000 | 0x1e20000 |

官方分区解析器已验证 MD5、对齐、不重叠及 32 MiB 范围。原 boot/app 都是 ESP32-S3 / IDF v5.5.5；原 app `orange_cat_pet` 位于 ota_0，镜像 checksum 和 SHA footer 正确。旧启动器具体可选编译配置未从原工程获得；相同 IDF 版本不证明所有 menuconfig 相同。

新工程需包含与原表一致的 app subtype/offset/size；最终新 app 的大小、chip/revision、flash 模式与频率、PSRAM、显示/触摸、电源及引脚仍由 root 检查。构建可生成新 boot/table 供比对，但本方案**不安装它们**。不能把冻结 v0.3 的 0x30000 factory 写入配置直接用于原布局。

## 2. 两份 OTA 记录的实际校验

每份 otadata 有两个 4 KiB 扇区，各开头一个 32 字节 `esp_ota_select_entry_t`。只解析 seq/state/CRC；没有解码 label 内容。

| 备份 | 记录地址 | seq | state | 存储 CRC | 计算 CRC | 结果 |
|---|---|---:|---|---|---|---|
| read1/read2 | 0x12000 | 1 | VALID = 2 | 0x4743989a | 0x4743989a | 有效 |
| read1/read2 | 0x13000 | 0xffffffff | 0xffffffff | 0xffffffff | 0x2144df1c | 全 FF，空/无效 |

依据本地 SDK：`bootloader_common_ota_select_crc` 只对小端 seq 的 4 字节做 CRC32（初值 UINT32_MAX）；有效条件为 seq 非 UINT32_MAX、state 非 INVALID/ABORTED 且 CRC 相等；`bootloader_common_select_otadata(..., true)` 取最高有效 seq，平局取 copy0；`bootloader_utility_get_selected_boot_partition` 用 `(seq-1) % app_count` 映射。此处 app_count=2，因此备份选择 **ota_0 @ 0x20000**。VALID 状态不会受到 NEW/PENDING_VERIFY 的启动回退状态机转换。ota_1 整个 8 MiB 在两份备份中均全 FF。

这证明备份中的逻辑启动目标；实际加载仍须经过镜像、安全版本、硬件启动等检查。旧启动器可能含可选反回退/快速启动配置，不凭离线选槽记录声称某次上电成功。首次验证应采用正常完整启动路径，由 root 掌握复位与日志。

## 3. 优先：写空 ota_1，再单独切换

1. 保留两份已核验备份和原 ota_0、boot/table/PHY/assets。root 完成按原布局生成的新 app 验证，确认大小不超过 8 MiB，并冻结它的长度/SHA/扇区覆盖范围。
2. 获得对新 app 精确地址范围的写入授权后，仅写 0x820000 起的 app 所需扇区并回读核验。此时 otadata 不变，正常启动仍选择旧 ota_0。写空槽本身不能使新应用运行。
3. root 再确认设备当前 otadata 仍等于所评估状态；若不同，重算，不能盲写 seq=2。独立授权只更新 copy1 所在 **0x13000..0x14000** 扇区，保留 copy0 原扇区。
4. 手动试运行的一种确定性描述为：copy1 的 32 字节记录，seq=2，20 字节 label 置 FF，state=UNDEFINED(0xffffffff)，CRC=0x55f63774；其余扇区 FF。标准 SDK 会选 `(2-1)%2=1`。这只是文档描述，没有生成载荷或命令。UNDEFINED 避免将尚未验收的新固件伪称已确认工作，也不依赖未知旧 bootloader 的 NEW/PENDING 回退配置。
5. root 执行获准的正常复位，保存 boot 日志，必须看到实际加载地址 0x820000，再做存储/圆屏/触摸/BLE 验证。不会因写入返回成功就判定运行成功。

**手动回退**：若 copy0 仍为 seq1/VALID 且 ota_0 未变，只将 copy1 的 0x13000 扇区恢复为备份原状（该备份为全 FF）即可重新选 ota_0。恢复操作包含该扇区擦除，需要独立明确授权、当前记录检查和回读；不擦整个 otadata，不改 eFuse，不用全盘 erase。若期间 SDK/应用修改了 copy0 或其它记录，先按新现状重新推导，不能照抄本方案。

另一条由 SDK API 执行的回退会生成更高奇数 seq（此基线通常为3），但会改写另一份记录；回退工具/执行方式必须由 root 冻结后再授权，本文件不代为运行。原启动器若有 anti-rollback 且运行路径会更新 eFuse，应在执行前排除或规避；本方案不授权、也不接受任何 eFuse 修改。

**不承诺自动运行回退**：NEW/PENDING/mark-valid 依赖原 bootloader 编译配置和新 app 确认逻辑。UNDEFINED 是显式手动切换方案，运行时黑屏/挂死不会因此自动回旧版本。镜像不能加载时，官方 `bootloader_utility_load_boot_image` 会按顺序尝试其它 app；这与运行时自动回退不同。

## 4. 次选：只覆盖 ota_0 @ 0x20000

原 seq1 继续选择 ota_0，不必改 boot/table/otadata，app 需按原布局构建。写入会擦除原 app 所覆盖扇区；旧应用在片上不再完整，失去空槽方案的即时切换回退优势。恢复需 root 从已验证备份重写原镜像全部相关扇区并回读，之后复位；NVS 已经被新固件修改时仍未自动恢复旧存档时点。只在有明确理由放弃 ota_1 方案并取得准确覆盖授权后采用，不能把“少改一条选择记录”等同于整体风险更低。

## 5. 32 KiB NVS 的持续写入预算

冻结 v0.3 ELF 的 DWARF 给出：`saved_t=4928`、`badge_snapshot_t=104`、`badge_event_t=24` 字节。源码事件容量200；无论 count=0 还是200，`nvs_set_blob(state_v1, &work, sizeof(work))` 均写4928字节。后续若改持久化结构，重新计量，不能沿用这个数。

SDK 每页4096字节，64字节页头/bitmap，126个32字节 entry；8页共1008 entries。单页 blob 数据最大4000字节。4928字节需154个数据 entries，加2至3个chunk头和1个index，约157至158 entries；为碎片余量按**每代160**预算。更新先写新版本再废弃旧版本，所以峰值至少保留两代，而不是只留一次blob空间。

两份备份只统计 NVS bitmap、不读键值：有效页中 WRITTEN=92、ERASED=654、EMPTY=10；另1页全FF（126槽），1页非有效NVS页头（126槽）。WRITTEN包含索引、元数据和数据，不能据此判断存档语义。654个废弃entry需经GC回收，不能当成当前可直接追加空间。原8页内的异常页会由 SDK 需要时回收；不需要扩大到旧 PHY/otadata。

| 预算项 | entries |
|---|---:|
| 保留旧 WRITTEN 上界（不依赖其可回收） | 92 |
| 两代200事件完整blob（160×2） | 320 |
| 新应用/NimBLE namespace | 2 |
| NimBLE对象及更新余量 | 128 |
| SDK GC必须保留1页 | 126 |
| 额外碎片/搬移1页 | 126 |
| 合计 | 794 |
| 物理1008槽扣除预算后 | 214 |

NimBLE 与应用共享默认 NVS，但使用 `nimble_bond` namespace；当前 MAX_BONDS=3、MAX_CCCDS=8。冻结ELF的 sec=88字节，单记录为3个数据entry+chunk/index=5；our/peer各3条合计30。CCCD=16字节，每条约3 entries，共24；还需CSFC、IRK/隐私记录、namespace及更新时新旧小blob共存。128是为当前配置保留的工程预算，**不是所有未来 NimBLE 功能的硬上限**；新增 EAD/隐私/配对数必须重算，不能占用这份余量却仍称预算有效。SDK 的 `ble_store_nvs.c` 每条记录执行 set_blob + commit，与宠物blob产生独立写入。

由当前占用和预算看，原32KiB具备持续更新余量，不能据“200事件”直接判定必须扩大NVS。SDK全局串行的存储操作及双代blob支持逐键恢复，但不提供跨宠物与bond多键的整体事务。SDK `NVSHandleSimple::commit()` 当前仅检查handle并返回OK，实际写入发生在set时，不能把commit想象为延迟到此才写Flash或一次整包事务。连续更新依赖GC轮转；高频触摸/ACK都会重写4928B，有写放大和Flash磨损。

### 执行前/运行验收（此任务未执行）

- 用原32KiB NVS备份的本地副本做 SDK NVS主机仿真：保留旧entries，首次建新存档，连续至少1000次不同blob更新；同时达到3 bonds、8 CCCDs并轮换/删除重建。覆盖空队列、满200、200条ACK、拒绝/重试、重启恢复。不得用真实全量备份作可写输入。
- 对chunk/index写入与GC各阶段做模拟断电；每次恢复只接受旧完整blob或新完整blob，不接受丢计数/部分事件；验证旧命名空间不被清空。只记录统计和校验摘要，不输出配对材料或旧存档。
- 在root授权的新固件运行时记录 `nvs_get_stats` / used/free统计、全部set/commit错误、GC后余量、实际bond持久化；遇 NOT_ENOUGH_SPACE、NO_FREE_PAGES、NEW_VERSION_FOUND或存档错误停止并保留日志，禁止自动erase。若必须改善，先降低持久化写放大/设计兼容迁移，再讨论分区改变。

## 6. 原 assets 能保留，但尚不能称可直接复用

**实际检查：assets_a 和 assets_b 两个7MiB区域在两份备份中都完全全FF。** 每区 SHA-256 均为 `17a0b2007d7d2b63b065904a3ced14cc1a0c3b104eadfcca65ccf80c8dfac7d9`。它们目前只有分区声明，没有可提取复用的资源数据；不能再按“两份资源包已拿到”描述。原应用资源可能内嵌或来自其它来源，现有证据不能确定。

两区可在原表中原样保留作为兼容布局。保留原 ota_0 才同时保留其原程序和可能内嵌的资产；这不等于取得源码或可直接复用的原始图像/模型。若以后拿到实际外部资源包，新应用仍须确认文件系统、包头、索引、压缩、纹理/动画/字体格式、版本切换与校验。不可调用挂载时自动format，也不写这两个分区。先复用已授权取得的真实原型/模型附件，再根据真实格式做只读适配；不能从空分区推断玩法已实现或素材已取得。

## 7. 证据与剩余限制

机器可读记录：[original-layout-evidence.json](../artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-15T1247Z/original-layout-evidence.json)，包含两份CRC/seq、allocation统计、资源摘要、冻结ELF和本地源码SHA。旧离线报告保持原样；本报告新增了OTA选择证据，修正“尚未解析”的旧时点状态。

依据：本地 ESP-IDF v5.5.5固定提交 `b774170ff46c393eeb5e495ea37936038d3f4f4f`：

- `bootloader_common_loader.c` 的 CRC/valid/select；`bootloader_utility.c` 的选槽、状态转换及镜像fallback；`esp_flash_partitions.h` 的32字节结构。
- `esp_ota_ops.c` 的inactive-copy改写、序号生成和set_boot_partition镜像验证。
- `nvs_storage.cpp` 的writeMultiPageBlob及新旧blob切换、`nvs_pagemanager.cpp` 的保留页/GC；`nvs_handle_simple.cpp` 的commit。
- NimBLE `ble_store_nvs.c` 的默认NVS namespace与逐键blob持久化。

备份/校验通过不保证硬件兼容和恢复成功；raw不包含eFuse。此次没有NVS条目内容/CRC语义校验、主机仿真、任何真实写入或回退实测。root独占设备并负责最终候选、授权、安装、复位和日志。
