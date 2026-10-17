# 来源与缺失清单

盘点时间：2026-10-15。来源链接均指 PRD 页面或其页面内附件引用。本次重新 fetch 更新时间为 2026-10-15T05:53:13Z（之前为 04:53:37Z），页面仍标为 v2.1 开发版；新增“整理小家”功能范围。当前工作区已有用户下载的手机端与吧唧 Demo 原件，大小/哈希和缺件见 [source-manifest.md](source-manifest.md)。

| 资产/文件 | PRD 声明/用途 | 页面能确认的来源信息 | 本地取得状态 | 下一步缺口 |
|---|---|---|---|---|
| `小橘电子宠物.html` | 手机端小橘原型；PRD引用该附件 | 最新页面附件 block `c9fef3e5-6528-4f90-b796-ec4005315d09`；file segment `cc70f777-86c5-49f1-a4eb-72b7a0710923`；用户确认是更新后下载件 | 已本地落盘并可离线打开；SHA-256见 [source-manifest.md](source-manifest.md)；Notion embed UI当前“正在加载”，未能服务端逐字节复核 | 保留现文件为带哈希开发基线；未来Notion版本再比对 |
| `吧唧渲染参考.html` | 吧唧渲染参考/交互规范；页面称含画面、手势、时间、模式、跳转、导出能力 | 两处同名 embed；v1.6起规范演进；本地根有原件、V2副本，ZIP内还嵌同件 | 已本地打开；3处同 SHA-256；详见 source-manifest | 后续下载触控引导并核实待确认参数差异 |
| `吧唧触控引导与滑动动效.html` | 吧唧首次上手教学和滑动手势参考 | 页面引用；PRD v1.8修订说明 | 未取得 | HTML原件、确切数值、与交互开发包的版本关系 |
| `吧唧交互规范开发包.zip` | 交互/界面开发包 | 页面 file 引用 block `c56e5802-...` | 已落盘并检查 82 项清单；含 LVGL v9.5 screen C、spec、font/icon/sound；无工程/BLE/猫模型 | 固件仓和模型/工具链；详见 Demo review |
| `吧唧渲染工具包.zip` | 渲染实现工具 | 页面 file 引用 | 未取得；Notion 页面可见 block ID `9068f2e6-...` | 正常下载原件并审阅 renderer/license/build |
| `pixel-cat.bbmodel` | Blockbench 源模型 | 页面 block `3f4c209a-d67f-8047-a54f-fa85588deb2d` | 已从手机 HTML 的 `__CAT_PROJECT_BASE64__` 恢复完整源模型，282216 B，SHA `1c5f2352a0249b241acd55c1a8eef92641c66528a6283e58dd73148962ecec60`；与独立 Notion 附件尚未逐字节对照 | 56 元件、1 纹理、idle/walk/paw；许可来源待原附件说明确认 |
| `pixel-cat.glb` | 模型交付/渲染格式 | 页面 block `3f4c209a-d67f-800f-865a-e8fc5c37e3ec` | 页面显示128 KiB，项目/ZIP未找到 | 下载并查导出设置、设备转换 |
| `pixel-cat.png` | 模型预览图 | 页面图片引用 | 未取得 | 用于快速视觉核对的原图 |
| `电子宠物玩法说明.md` | 规则补充说明 | 页面 file 引用 | 未取得 | 原文、与 PRD 规则的差异 |
| `暖爪小镇__小猫生活游戏.md` | 原型/玩法补充材料 | 页面 file 引用 | 未取得 | 原文、版本/日期 |
| `使用说明.md` | 资产使用说明 | 页面 file 引用 | 未取得 | 原文、来源许可/操作步骤 |
| `预览小猫.html` | 预览原型 | 页面 embed 引用 | 已本地取得并打开；SHA见 [manifest](source-manifest.md) | 用途和与源模型一致性仍待确认 |
| `聊天记录_20261005_224831.zip` | 历史上下文 | 页面 file 引用 | 未取得 | 非首闭环必需，确定必要性后再取，注意隐私 |
| 固件仓 `docs/m1-hardware-verification.md` 等 | PRD声称有上板取证与固件实现 | PRD第12章提到固件仓文档；正文给出二手报告细节 | 本地未见固件仓/报告；硬件未连接确认 | 仓库地址/本地路径、提交 SHA、报告原件；须独立复验，不可将报告当作本机实测 |
| 吧唧其他附件 | 交互规范/渲染工具、模型、预览 | block ID/用途详见 [吧唧资产索引](badge-assets-index.md) | 部分已落盘并有哈希，未取得项以本表逐项记录为准 | 取得原附件，检查内部内容/版本/许可/构建 |
| 关联文档 `91a0b354c97245fb8911dc9e567e006f` | 页面关联参考 | PRD关联页引用 | 未盘点 | 确认是否纳入来源基线并读取 |

## PRD 中有用但未经本地复验的硬件记录

PRD叙述 2026-10-10 首次上板曾报告：ESP32-S3 QFN56 rev v0.2、32 MB Flash、8 MB PSRAM、CO5300 466×466 QSPI、CST9217、QMI8658、ES8311/ES7210、AXP2101；LVGL 9.5.0；曾发现并修复存储栈溢出和 BLE 断开后广播不恢复。该历史报告的板 rev v0.2 不绑定当前两块设备。Waveshare 官方当前产品/示例资料另列 ESP32-S3R8、同容量存储、CO5300/CST9217 与官方 LVGL v9 示例；产品页称内置扬声器、资源图标注扬声器焊盘。版本/SKU、扬声器装配及触控方向、双机 BLE、帧率、RSSI等仍需分别实物/代码核验。官方资料不是本会话真机复验；详情见[硬件交叉核对](hardware-cross-check.md)。

## 附件访问方法与限制

本次通过已连接的 Notion `fetch` 读取 2026-10-15T05:53:13Z 页面正文/引用；Tabbit 独立任务随后也确认登录并显示 PRD，但 embed 卡片处于加载占位，未提供可下载文件体。用户确认本地小橘是更新版下载件。已检查本地原型和交互 ZIP，实际缺件以本表和 [source-manifest](source-manifest.md) 为准；本地哈希不可视作服务器端逐字节复核。

## 缺失总表

- [x] 用户下载的手机原型和部分吧唧 HTML/交互包已落盘；记录文件大小、SHA-256、获取时间、Notion 来源 ID。Notion embed未供逐字节对照文件体。
- [x] 新 App 仅复用本地渲染/交互模块，不声明 INTERNET、定位、运动、环境、相机或麦克风权限；未直接嵌入原型全部产品入口。Android 真机仍待核验。
- [ ] 交互 ZIP 已清点；缺渲染工具包；新固件已锁定 ESP-IDF/BSP/LVGL 并生成依赖锁，实际构建结果另记录。
- [x] 从手机 HTML 恢复完整 `.bbmodel`（含纹理与三动画）；详见 `assets/models/README.md`。
- [ ] 独立 `.glb`、渲染导出器/配置、资产许可说明及 Notion 附件逐字节对照。
- [ ] 可用固件仓源代码和指定 commit；另附历史 M1 报告以供证据级别审查。
- [x] 手机 OS 优先级：Android。
- [ ] 用户有两块吧唧、一块当前可用；补录每块的 SKU/PCB 丝印、电池/扬声器装配、Android 测试机与 USB/串口连接方式；本阶段不写入设备。
- [ ] 完整 PRD 仍为目标。当前单猫照料与单板 BLE 是实施顺序，不表示产品负责人或用户已批准删减其他功能；需按开发状态表审阅差距。
- [x] 首切片 v1 协议已冻结，Android 暂作本地权威、设备保存快照并持久回传事件；详情见 `protocol/v1/README.md`。长期云主存与双设备社交冲突策略未实现。

## 决策日志

| 日期 | 决策/状态 | 依据 |
|---|---|---|
| 2026-10-15 | Android 优先；当前源码采用 Kotlin 平台 Views + AtomicFile + 原型 Three.js/WebView + 前台 BLE GATT | 用户明确 Android 优先；早期 Compose/Room 仅为建议，未采用。完整范围及跨端契约审批仍归产品总领 |
| 2026-10-15 | 主会话小点狗为产品总领；Codex 负责获批子任务实现与独立审查 | 用户明确产品体验/范围/跨端契约审批/验收门槛归小点狗 |
| 2026-10-15 | 两块设备一块可用；先单板真机闭环，第二板恢复后再验双机 | 用户设备现状 |
| 2026-10-15 | 用户称小橘新版完成；最新 Notion 页面返回更新后的 block ID `c9fef3e5-...`，但文件体待认证下载 | 用户通知；页面附件引用；Notion CLI/Tabbit认证状态 |
| 2026-10-15 | 真实定位、环境、语音、儿童信息默认关闭，仅模拟规划 | 委托边界；涉及敏感数据，首闭环不需要 |
| 2026-10-15 | 不刷写设备、不擦存档、不购买服务、不启用付费 API、不增凭据/权限、不推送/发布 | 明确授权边界 |
| 2026-10-15 | 不把 PRD“已实现”写成仓库取得或真机复验 | 代码盘点结果为空；需保持证据区分 |

### Notion CLI / 官方 API 复核补充

- 已安装 `/Users/zoumutou/.local/bin/ntn`，本地正式技能为 `/Users/zoumutou/.agents/skills/notion-cli/SKILL.md`。
- `ntn api ls`（live OpenAPI 获取失败，回退到缓存 spec）列出 `GET /v1/blocks/{block_id}`；这是读取既存 file block 的正式候选接口。
- MCP 当前页面对新版小橘 file block `c9fef3e5-6528-4f90-b796-ec4005315d09` / file segment `cc70f777-86c5-49f1-a4eb-72b7a0710923` 返回 `metadata.type=block` 但 `blank-page`，没有文件 URL/正文。页面 Markdown 仍仅有 `notion-file-block://` 引用。
- 本地 `ntn` 未认证：环境变量检查只返回未配置状态；实际 `ntn api v1/blocks/c9fef3e5-6528-4f90-b796-ec4005315d09 -X GET` 返回 `No auth token found for the current workspace`。没有尝试 `ntn login`，也没有读写认证配置。
- `ntn files --help` 显示 `files` 只含 File Uploads API 的 `create/get/list`，不含读取页面已有附件块的下载命令；`ntn pages --help` 的 `get` 是 Markdown 页面读取。MCP 的 `notion_download_attachment` 同样只接受此 integration 自己创建的小文本 `file_upload_id`。
- 所以 API 端点本身可用，但本机授权未接通；MCP 对当前 file block 的能力不足。不能据此构造或猜测签名 URL。阻塞需用户连接正式 CLI 认证或在 Tabbit 页面完成登录后重试。
