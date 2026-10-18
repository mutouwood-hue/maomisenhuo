# PRD 非连接缺口接续结果（2026-10-17）

## 需求与交付边界

- 本轮通过 Notion 官方 CLI 读取[完整 PRD](<https://app.notion.com/p/5c1fbd20cacf42ac9567dcf0b3dc37e0>)：last_edited_time `2026-10-17T03:47:00.000Z`，`truncated=false`，unknown_block_ids 为空，页面未归档。正文证据为[CLI 快照](<../notion-prd-cli-current.md>)。未写回 Notion。
- 准确当前安装基线是手机 038/code29 与吧唧 053。实际实施源为[手机接续源](<phone/source/README.md>)和[吧唧接续源](<badge/source/README.md>)，根目录旧 Kotlin/v1 工程仅作历史，不用于冒充当前版本。
- 排除锁屏断联及自动恢复；并行清洁照料分支亦未改动。不改 BLE、校时协议、事件结算、NVS、升级证书、原始 HTML；不安装、不刷写、不操作 Git。
- 手机目标是原生 JS/WebView，不是 React/Vue：前端规范 §1 按原生事件/生命周期映射，§2 不适用。本批未改样式；既有样式入口与变量真源说明保留于[生活样式](<phone/source/web/life-companion.css#L5-L8>)。

## 接续新修复

### 1. 今日环关闭与离开后不保留手势

[life-navigation.js](<phone/source/web/life-navigation.js>)：原生活页关闭只移除 `on`，SVG 仍 connected。过去的拖动会继续修改隐藏选区、阻断 pointermove 默认行为；pagehide 又只停未来动画，不释放捕获或停止回放。

现在统一清理 pointer capture、drag、future RAF、day replay；观察 overlay class，在事件 guard 中同时处理 MutationObserver 尚未执行的关闭窗口；隐藏态键盘/restore 不改变选区；pagehide 清理并断开观察，pageshow 恢复观察。保留用户本地选择与重新打开后的正常操作，不写实际生活记录。

[定向回归](<phone/source/tests/life-navigation-focused.test.cjs>)新增关闭但 DOM 保留、关闭观察延迟、pagehide/pageshow、未来动画即时取消四项。

### 2. 返回今日环时彩段／游标跟随预览

[badge_day_ui.inc](<badge/source/main/badge_day_ui.inc#L105-L138>)：实际返回滑页预览移动的是已经预建的 HOME 对象，但原自绘条件只允许 `current_page==HOME`，导致照料/状态页拖回 HOME 时彩段、未来虚线与游标要到松手导航后才出现。

现在允许真实 HOME 目标的 active preview 自绘，继续限制 face1、非 AOD/OFF；不会提前 navigate/day_project 或触发业务副作用。旧/新游标失效区域使用 HOME 绝对坐标；绘制中心原本已有 page 偏移，不重复叠加。

[新增主机测试](<badge/source/tests/host_day_draw/README.md>)逐字提取生产 day_project/day_arc/day_draw，验证返回预览、自绘中心、彩段/虚线/游标、取消/无目标/待机拒绝及失效区域，不只是源码 regex。

## 上层吧唧方案取舍

- [上层输入路径](<D:/黑客松/main/ui/badge_ui.c#L2007-L2079>)已将分配、重建、截图移出触摸期；空闲250ms后每轮预热一个目标。
- [上层新控制器](<D:/黑客松/firmware-v2/interaction/baji_controller.c#L57-L82>)构造只读 source/target 预览，[动画结束](<D:/黑客松/firmware-v2/interaction/baji_controller.c#L3-L5>)才提交真实场景；[渲染器](<D:/黑客松/firmware-v2/render/baji_render.c#L40-L60>)常驻预建页面。
- 当前接续沿用预建页移动、跟手/提交/回弹与提交后导航，不搬整套 FSM、快照光栅或显示驱动。上层[帧预算记录](<D:/黑客松/docs/frame-budget.md#L92-L109>)正说明同步 dayring 重绘可吃掉动画窗口，历史性能数据不是053达标证据。
- HOME 横向两表盘仍保留053原 release后120ms方案，没有宣称全部方向跟手或30fps达标。

## 首批已实现并继续保留

此前[首批实施](<IMPLEMENTATION.md>)已含：不同页预建跟手/提交/回弹、今日环轨道与中心滚动区分、真实地点空态与虚构/推测来源区分、无每日回顾推送、主动诚实摘要、游戏关联JPEG毕业纪念备份与防回滚、诊所准确病种恢复反馈、只读毕业相册关闭。此次复验，不把此前工作冒称新实现。

过桥 I05 已在 PRD 用户确认037、038保留；建筑遮挡 I04、年龄外观 I08、家庭卡片 I09已有当前源实现待实机，不重复重写。I10“成年后陪伴”实际为NPC配对/育幼，运行时已有明确标题，不是毕业猫再养。

## 验证与限制

- 手机8组最终定向回归 **79/79**，含生产Java JVM测试14项；结果和当前源哈希见[接续验证报告](<continuation-evidence/report.json>)。JVM Android fsync/NVS/无线均是桩，不能替代实机。
- 本次浏览器打开真实生成预览在domcontentloaded超时，随后只读ariaSnapshot也超时；保留失败记录，没有以强制跳过遮罩/注入进度制造成功。首次既有浏览器验收仍是历史证据，本次未完成浏览器视觉／交互回归。
- Android SDK35/AGP8.7.3 Java编译成功；使用已有JDK21、Gradle8.14.3缓存离线执行，正确命令为 `gradle --offline --no-daemon --console=plain -Dorg.gradle.project.android.overridePathCheck=true :app:compileDebugJavaWithJavac`。任务显示 UP-TO-DATE，证明当前Java产物及依赖解析成功，本轮JS改变不需Java重编；不是新APK全量构建或安装。
- 首次 `-P` 属性在PowerShell传递中未生效，编译因非ASCII路径失败；改用上述完整引用的 `-Dorg.gradle.project...` 后成功，未修改工程规避其他检查。
- badge live-drag 与新增 day-draw 严格C11/Wall/Wextra/Werror主机通过；完整ESP-IDF构建没有通过/没有生成候选bin。
- [依赖核对](<dependency-boundary.json>)明确：053源码ZIP不含managed_components，其占位链接仍指Mac；本机上层17组件中16个marker一致，button不匹配。不能修改marker、放宽完整性门禁或使用错误依赖冒充053构建。需取得原冻结button及完整组件包后，ASCII staging下执行原IDF5.5.5图谱构建。
- 既有全套失败/超时继续保留[原分类](<REGRESSION-CLASSIFICATION.md>)；专项通过不等于全仓绿。

## 明确未交付／受限

| 项 | 当前边界 |
|---|---|
| 实物滑动、局部刷新、TE、帧率、功耗 | 未刷写／未测；完整冻结依赖及硬件窗口后录屏验收。HOME横向还未优化 |
| 清洁入口 I02 | 并行分支负责，需三方合并，不重复实现 |
| 20 GLB I18 | PRD称Mac入库20/20；本机未取得原catalog/许可/hash，接续仍0/20；不造同名几何替代 |
| 双吧唧相遇 I19 | 缺第二台设备，真实双方确认/礼物/好友持久化未验；模拟与NPC不算 |
| 吧唧环境感知 I13／离线在家出行 I17 | 需固件IMU/音频/授权/来源与功耗方案；手机周期录音仍禁用，不将断连当出门 |
| 离线事件合并 I14／clock可观测 I15 | 跨端预算、身份、迁移及可观测契约需共同决定；未动并行连接方协议 |
| USB诊断警告 I16 | 未静默删除警告；需完整构建与实板启动观察 |
| AI文字猫 I20 | 当前入口已有，未调用收费API或使用用户Key |
| 居民/毕业猫重逢、纪念陈列、周/远行回顾、大世界拼接 | 规则/入口/频次/槽位仍待明确；备份保留现有世界记录不等于新增探索世界完成 |
| 吧唧新玩法 I21 | 最低优先只登记，不擅自改变经济规则 |

## 集成交付

本轮增量包沿用038/053冻结原始SHA做基线，包含首批非连接源码补丁＋本次修补与测试；不含生成assets、APK/bin、依赖、local.properties、密钥、完整Notion正文或lock-clean分支。只能人工三方合并，不能整目录覆盖。合并后重新build_assets、复验、固定版本与签名；真正设备交付单独确认。
