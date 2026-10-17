# 旧固件构建与实机备份对应检查（只读）

检查对象：`legacy-review/firmware-source/baji-firmware` 工作树快照。只做文本、目录、文件摘要与已有备份元数据的静态核对；未运行包内脚本、CMake、构建、测试或其它旧代码，未联网、访问设备或修改旧源/主工程/候选。本文是新报告，不改变前一批离线证据。

## 结论

旧包具备优先复用的基础：规格驱动UI、原字体、实时3D猫、真实板卡BSP初始化与已携带的托管依赖。**应按用户修正后的HTML基线比较和取用好部分；不因源码到达便整体替换，也不引入云。** 包含的源码比当前新候选更完整，但“文件齐全”不是本机已重建、真机已复验或与现有Flash逐字节对应的证明。

主要障碍/必须隔离点：

1. 默认 `partitions.csv` 是 factory+storage，**不等于实机双OTA表**。`partitions-m2.csv` 的七项名称、type/subtype、offset、size与备份原表逐项相同；这只证明布局相同，不证明应启用M2变体或写入该表。
2. 默认 `main/main.c:480–484` 在 NO_FREE_PAGES / NEW_VERSION 时调用 `nvs_flash_erase()`。复用入口前必须在隔离候选中移除此自动破坏性恢复并明确错误路径，旧源本身保留不改。
3. 有V1/V2两条构建分支、不同协议及存储语义。用户没有要求安全根、rollback/eFuse或制造流程变更；不能将 `BAJI_V2`、`sdkconfig.m2.defaults`、provision工具作为默认启用项。
4. 没有最终 `sdkconfig`、原构建ELF/应用bin、构建manifest或Git提交链。现有证据支持同一工程血缘，**不能证明该快照就是原Flash镜像的精确源码**。

## 1. 来源与镜像对应证据

| 核对项 | 旧源码/包 | 已验证Flash备份 | 能证明的程度 |
|---|---|---|---|
| 项目名 | 根CMake `project(orange_cat_pet)` | app description `orange_cat_pet` | 名称一致，非唯一源码身份 |
| IDF | lock=5.5.5、cat3d manifest >=5.5.5、eim版本5.5.5 | boot/app均v5.5.5 | 版本文本一致，不能证明SDK原工作树无改动 |
| app版本 | 根CMake没有指定VERSION；缺最终构建上下文 | version=1 | 不反推构建分支/提交；默认版本文字不是重现证据 |
| 编译时间 | 没有可对应的构建产物 | app Oct 14 2026 15:02:29；boot 15:26:46 | 无法从解压mtime证明对应 |
| 板卡 | BSP3.0.0，466×466、CO5300 QSPI、CST9217 | 主任务实机确认同屏触；S3、32MB/8MB | 板卡路径吻合，仍需实际驱动运行验收 |
| 分区 | 默认factory表；M2七项双OTA表 | 32KB NVS+双OTA+双assets | 仅M2 CSV与备份范围一致 |
| 原app内容 | 包有V1/V2与模型/字体源码，无对应ELF | ota_0 checksum/SHA footer有效，ota_1全FF | 二进制完整，不等于源码复现 |

备份共同SHA：`75dd900def684d04f55b889e7e667027e62ecc8af417687a38c3a70cab26603e`（每份32MiB）。独立OTA离线证据已确认copy0 seq1/state VALID/CRC正确、copy1空，按SDK规则选择ota_0；不是看到镜像存在就猜选槽。本报告没有重新触碰硬件；后续运行过的设备状态需由root重新核对。

包内 `BUILD.md` 自述快照不是Git提交，并明确没有在打包机重跑完整build；同时另一段称环境曾验证。应保留这个限定，不能把作者历史描述改写成本地验证结果。包内Windows ASCII路径/CMake崩溃经验仅作为平台经验，本机已有项目本地SDK，不照抄外部安装/路径/设备命令。

## 2. 构建入口与静态完整性

- 根CMake先 `FT_DISABLE_PNG=ON` 再include IDF project.cmake；project名为orange_cat_pet。该开关是FreeType可选PNG字体codec，不是禁用整个项目所有PNG图像。
- `main/CMakeLists.txt` 默认编译V1；只有 `BAJI_V2` 为真时转入 `firmware-v2/component.cmake` 并return。两套主入口不应混接。
- V1 CMake列出的**33个.c全部存在**，包含UI/spec/paint/fsm/motion、五个字体、cat_view、硬件、存储、事件、BLE/社交层。此处仅核对引用存在，没有执行其check脚本或编译。
- cat3d组件带cat_model.h及六份128KiB纹理，通过EMBED_FILES链接进app，无需assets文件系统。这给出原app可内嵌模型纹理的源码机制；不能仅据此证明备份每个像素来自这份纹理。
- `components/find-zlib-shim/project_include.cmake` 将自己的FindZLIB加入模块路径，链接IDF zlib；源内容没有运行。现候选已有同类宿主配置处理，隔离复用时应检查重复/冲突，不能修改managed组件掩盖问题。
- main组件仅对自有源码启用Wall/Wextra/Werror；这能作为后续编译约束，不能当作已经无警告。
- M2/V2组件还会生成供给外部公开信任根的C文件；不提供时是空根，外部模型需要显式experimental许可。当前离线HTML复刻不需要启用它们，不添加根、凭据、模型或安全配置。

## 3. sdkconfig与原布局

只有 `sdkconfig.defaults` / `sdkconfig.m2.defaults`；没有最终生成的sdkconfig。默认配置含S3、32MB Flash、QIO、8MB octal PSRAM/80MHz、240MHz CPU、LVGL9.5 FreeRTOS/双绘制单元、NimBLE四角色/最多4连接、默认14px fallback与自带subset字体。

Flash镜像头读到DIO并不能独立证明最终Kconfig也为DIO（启动器/工具可处理QIO启用流程）；不要据这个表面差异擅改硬件模式，最终配置仍要通过隔离构建和真实基线确认。旧文档“8MB/32MB”描述也不能取代主任务已取得的实读信息。

| 项目 | 默认CSV计算布局 | M2 CSV / 已备份实机布局 |
|---|---|---|
| NVS | 0x9000 + 0x8000 | 相同 |
| PHY | 0x11000 + 0x1000 | 相同 |
| OTA选择 | 无 | 0x12000 + 0x2000 |
| 第一个app | factory自动对齐至0x20000 + 8MiB | ota_0 0x20000 + 8MiB |
| 第二个区域 | storage自动紧接0x820000 + 8MiB | ota_1 0x820000 + 8MiB |
| assets | 无 | assets_a 0x1020000 + 7MiB；assets_b 0x1720000 + 7MiB |

本次用静态CSV字段对照已有官方分区解析结果，M2七项完全一致；**没有生成或替换分区二进制，也不声明CSV必然重现原表MD5字节**。`sdkconfig.m2.defaults` 除切表还加 `CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y`，是额外行为改变。M2表注释本身称只用于新制造映像、禁止覆盖legacy存量分区；不能因实机范围碰巧一致便照搬M2构建/安全流程。

root可在隔离候选中保留实机原表/boot、复用原32KiB NVS与空ota_1策略，单独检查app能否按其运行布局构建；具体切换、回退及授权见已有 `docs/firmware-original-layout-plan.md`。本文不授权任何写入。

## 4. BSP与启动链可复用部分

- `main/main.c` 显式 `.lv_adapter_cfg=ESP_LV_ADAPTER_DEFAULT_CONFIG()`，rotation0、tear avoid NONE、touch swap_xy0 / mirror_x1 / mirror_y1；避免未初始化adapter延时导致任务忙转。这里是代码机制，作者曾遇到的黑屏/WDT历史不是本机复验。
- `bsp_display_lock(APP_BOOT_LOCK_MS)==ESP_OK` 检查与当前BSP esp_err_t签名一致，不能改写成bool条件。
- 先显示、再硬件、再UI/猫层，最后radio；亮度在LVGL任务内由tick路径应用，未在app_main重复亮度init。调度/锁/上下文值得复用，原代码仍会初始化硬件与radio，不能作为“纯展示”直接运行。
- BSP真实源调用 `esp_lcd_new_panel_co5300`，QSPI、RGB565/RGB、panel gap(6,0)；触摸 `esp_lcd_touch_new_i2c_cst9217`，坐标上限466、RST2/INT11、I2C SCL14/SDA15。LCD CS12/PCLK38/D0..3=4/5/6/7、RST1。与实机CO5300/CST9217线索吻合；不能从相同芯片名推断所有板卡修订引脚均已验收。
- BSP本身及LVGL/adapter驱动与现候选同版本、相同本地源字节（见下节），无需为复用重新下载或另造屏触驱动。触摸五点、方向、背光/PMIC、传输队列和帧预算仍应在root授权范围内逐项验证。

## 5. 托管依赖可复用性

19个目录全部存在，其`.component_hash`文字均与旧lock一致。摘要标记本身不证明目录未修改；因此又将所有普通文件的相对路径/内容SHA与当前项目本地已安装依赖逐文件比较（忽略.DS_Store）。结果：**15个目录完全相同，3个只多本地Git/构建文件，button为版本差异**。

| 组件 | 旧lock版本 | 与现候选比较 |
|---|---|---|
| espressif/button | 4.2.1 | 现4.2.2；旧4.2.1，5个文件不同（含hash/版本说明/ADC） |
| espressif/cmake_utilities | 0.5.3 | 同版本/注册表hash；目录文件与字节完全相同 |
| espressif/esp_codec_dev | 1.5.11 | 同版本/注册表hash；目录文件与字节完全相同 |
| espressif/esp_io_expander | 1.2.1 | 同版本/注册表hash；目录文件与字节完全相同 |
| espressif/esp_lcd_co5300 | 2.2.0 | 同版本/注册表hash；目录文件与字节完全相同 |
| espressif/esp_lcd_panel_io_additions | 1.0.1~1 | 同版本/注册表hash；目录文件与字节完全相同 |
| espressif/esp_lcd_touch | 1.2.1 | 同版本/注册表hash；目录文件与字节完全相同 |
| espressif/esp_lv_decoder | 0.4.3 | 同版本/注册表hash；目录文件与字节完全相同 |
| espressif/esp_lv_fs | 1.0.1 | 同版本/注册表hash；目录文件与字节完全相同 |
| espressif/esp_lvgl_adapter | 0.6.4 | 同版本/注册表hash；目录文件与字节完全相同 |
| espressif/esp_mmap_assets | 2.0.1 | 同版本/注册表hash；目录文件与字节完全相同 |
| espressif/esp_new_jpeg | 1.0.2 | 同版本/注册表hash；目录文件与字节完全相同 |
| espressif/freetype | 2.14.3~1 | 同版本/注册表hash/共有文件；现多2个.git文件 |
| espressif/knob | 1.1.0 | 同版本/注册表hash；目录文件与字节完全相同 |
| espressif/libpng | 1.6.58~2 | 同版本/注册表hash/共有文件；现多1个.git文件 |
| espressif/zlib | 1.3.2~1 | 同版本/注册表hash/共有文件；现多.git和生成zlib.map |
| lvgl/lvgl | 9.5.0 | 同版本/注册表hash；目录文件与字节完全相同 |
| waveshare/esp32_s3_touch_amoled_1_75c | 3.0.0 | 同版本/注册表hash；目录文件与字节完全相同 |
| waveshare/esp_lcd_touch_cst9217 | 2.0.0 | 同版本/注册表hash；目录文件与字节完全相同 |

旧main manifest新加button作为direct依赖，但旧lock `direct_dependencies` 仅列idf/lvgl/BSP（不含button），说明manifest/lock直接依赖集合已有漂移。button已作为BSP传递依赖存在，不是缺源码；隔离工程由root显式固定所选版本并检查解析变化，不能把^范围/旧lock当作永远不会联网更新的保证。现候选也不能自动降级4.2.2来追旧包。

源码包来源与官方依赖的本地匹配足以支持离线复用评估；本次没有联网核验/重下载，也没有运行CHECKSUMS工具或组件构建。将来构建仍以冻结的具体来源/版本/文件摘要为证据。

## 6. NVS与运行策略：复用前的明确差异

- 原32KiB NVS保留。旧V1 `petgame/save` 序列化33B，`badge_onboard/state` 40B；离线队列 `badge_evt/queue` 最多1608B（8+200×8），社交另用`catsoc`。这与新候选4928B的saved_t完全不同，不能拿同名“200事件”就互认格式。当前没有读取备份NVS键值或迁移旧存档。
- 旧V1 pet/onboarding变更约4秒延迟持久化；app_main忽略load返回结果后可继续defaults。事件队列满时**丢最老记录**。这些是明示旧策略，不等于现协议“不丢未确认事件/先持久化再反馈”的要求；只复用UI/猫或局部逻辑时必须保持边界，不整套照搬旧事件/存档。
- 自动`nvs_flash_erase`是最直接的数据风险；隔离候选应失败停机/显示存储错误，留存数据等待诊断，不把格式或容量错误变成自动恢复擦除。
- V2 `bj_update_runtime_confirm_boot` 在PENDING_VERIFY下要求匹配其更新record/版本/hash，否则可mark invalid并回滚重启。即使它已有OTA代码，也不能把外部侧写app/选择记录与该状态机随意组合。
- 没有发现SDK defaults开启Secure Boot/Flash Encryption/eFuse写入的设置；这不构成整包安全审计。M2显式开rollback、V2更新策略/外部可信根为独立设计，当前不启用、不修改eFuse、不借机添加权限。
- 语音、环境感知、附近发现等需要按本任务默认关闭政策隔离；主入口的硬件/radio初始化不是对真实采集/广播的新授权。HTML复刻与本地闭环不需要云、账号或付费API。

## 7. 推荐给root的隔离构建顺序（仅计划）

1. 固定这份原始快照摘要，保留不改。优先比较V1规格驱动UI/字体/cat3d与用户HTML，而不是以V2或当前缺字候选替代。
2. 在root持有的隔离候选中选择V1/V2及必要组件的明确组合；默认不启用M2安全/制造功能。修正自动擦存储、默认传感/语音/附近发现、旧事件丢弃和存档错误覆盖等策略后再考虑运行。
3. 复用项目本地IDF5.5.5和已冻结managed依赖，核实button选择与manifest/lock差异；保留原分区/boot，只构建需要评估的app。Windows路径说明不作为Mac必须改目录的依据。
4. root执行唯一隔离构建，检查最终sdkconfig、编译源列表、APP description/ELF摘要、大小与原OTA槽余量；构建成功仅证明编译，不证明视觉/协议/真机成功。
5. 用真实旧UI字体/渲染路径做离线布局对照、再分开验收新功能；最终是否写空槽、选槽、复位、存储维护等由root取得具体授权后执行。

## 8. 关键文件SHA-256（此检查时点）

- `CMakeLists.txt`：`56c854d5df63514dd6c2b9e89dfeb8d4a8820ae16550655e27c8ae88313af865`
- `main/CMakeLists.txt`：`00cab64b3d7a65385348163375944d8e94b361371cc5af06e9b65ce0cb0a878e`
- `main/main.c`：`5a88f81bfe41792a7591af3d55daddc8158f2a11f0267db9f513849e118fa777`
- `sdkconfig.defaults`：`f2d392247b84ee2cc0b5eb1fd3801f5c897be1b0e3671d137c341a3ccf1b19c3`
- `sdkconfig.m2.defaults`：`c0b7c32e4bf2bc9bb00a89473436b6de930ef7d9c02c45c4b2d381bd94bd3951`
- `partitions.csv`：`97e4defb167ff6ab93ce6fdd63d2531779abe3fca8c81a0f8991eadd3dc1733d`
- `partitions-m2.csv`：`7f0a634ee636559a6e139d5edf87a3e2f93e18c7965ddc8a78d206d5c36f49a2`
- `dependencies.lock`：`4d30c345ba31257656c718371d2d0d87c295b03597ff62717898fb72c1dc7b84`
- `main/idf_component.yml`：`5922d7af29d4bd95001211bba045a02f1231b7fae8cc019bbf05e33db7c09576`
- `managed_components/waveshare__esp32_s3_touch_amoled_1_75c/esp32_s3_touch_amoled_1_75c.c`：`a2bc2256ffd18beddf6b651cdfc1a9f82350f9c24073feea641e253179bff4c8`

本报告到此为静态审查结论。未实际验证构建可复现、旧源与原ELF同一性、旧UI像素匹配、真实存档迁移、板卡运行或恢复。原报告/备份/旧源码均保持原样。
