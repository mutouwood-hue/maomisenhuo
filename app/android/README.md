# 猫咪森活 Android

原生 Kotlin 应用，`minSdk 26 / targetSdk 35`，Build Tools 35.0.0、AGP 8.7.3、Kotlin 2.0.21、Gradle 8.9。构建使用项目内 JDK 21.0.12.1，Java/Kotlin 编译目标仍为 17。Kotlin 使用 `in-process` 策略随 Gradle 编译，避免额外 Kotlin daemon 及用户 Library 下的 daemon 文件。使用 Android 平台 Views 和 `AtomicFile`，当前不依赖 Compose、Room 或第三方 BLE 库，便于先得到可复现构建。

## 原生与原型的边界

- `PetStore.kt` 是本阶段手机本地状态权威：持久 UUID、revision、照料数值、成长、喵币、愿望奖励、手记、已处理吧唧事件；长远云主存策略仍待后续实现。
- 原型 `小橘电子宠物.html` 只读。父集成任务从它提取 `assets/` 中的 Three.js 房间和猫模型；原生 UI 与原生领域存储负责实际操作，渲染器无网络、无 localStorage、无真实设备/传感器权限。
- 通过 `CatNative.ready()` / `CatNative.action(action)` 通知原生。多步骤照料由 `CatRenderer.startInteraction(action)` 启动原型交互，通过 `careFinished(action, completed, score)` 完成后才由原生结算；`progress(action,message,progress)` 更新提示。取消或切后台取消待结算动作，不扣喵币、不加奖励。摸摸/睡觉沿用立即动作；所有照料提交成功后通过 `feedback(object)` 播放结果反馈，旧渲染器仅对摸摸/睡觉降级为 `perform(action)`，绝不再次启动多步骤照料。照料保存成功后才推送 `applyState(object)` 与 BLE 快照。
- 现阶段有 8 种照料、原型同数值结算、5 个愿望、改名、真实手记和导入导出。接鱼使用本地 `minigame.html` 提取的原型 20 秒 Three.js 游戏，`CatMini.start()/stop()`、`CatNative.miniReady()/miniFinished(score)/miniStatus(json)`；原生检查真实会话和分数后按原型规则结算。未使用重写的简化接鱼游戏。原型其他完整功能未迁移完成；界面不放未接通的按钮。
- v0.2 本地衣柜沿用 `kn/Mi`：普通 6 种毛色免费切换并保留成长；稀有 3 种只能保持当前品种或匹配 `lineage.rare`，没有伪解锁入口。普通服饰价格为 bandana12、bow18、cap25、raincoat36、backpack32、scarf28；sakura/bell/crown/cape 是馈赠限定，标价0不代表可以购买。购买、拥有、装备均持久化，重复购买/币不足/未拥有装备失败不改状态。主屋与原接鱼 renderer 接收 breed/outfit；当前冻结 BLE 协议不携带装扮，吧唧仍显示橘猫，管理页与衣柜已说明。
- v0.2 户外使用原 `Mf` 的实际步行/探险/钓鱼交互，`worldEvent(requestId,json)` 等待原生事务结果后由 `CatWorld.resolve` 回执。诊所使用原 `Sf` 的三个实际检查工具，只有完成步骤和原生最短时序满足后才收费治疗。`LocalLifeRules.kt` 提供原型规则；原生持有 UUID 会话、单调时钟、原子提交。收获完成后进入真实背包，可按原价出售；不发伪造库存。切后台会取消未结算活动；重启或存储失败遗留 pending 时通过明确按钮收起，不自动领奖。

## v0.3 提交后的视觉反馈

`CatRenderer.feedback(object)` / `CatWorld.feedback(object)` 是可选的单次视觉接口，不改变领域状态，不再调用照料完成桥。包包含 `version:1,eventId,petId,revision,kind,phase,source,committed,settled,stats,healthIssue,wet,presentation:{wet}`，并在有前态时包含 `beforeStats`。`kind=care` 的 `action` 沿用原型 ID；`kind=world_event` 的 `event/choice/raincoat` 来自实际户外事件与已保存选择，阶段为 `encounter/choice_saved/settled`。真实出游结算后，回到当前小屋播放一次 `kind=outdoor,phase=return`。选择保存阶段不声称数值奖励已结算。

其他真实提交使用 `phase=committed`：诊所 `clinic/recover`；愿望领取 `milestone/goal`；成长实际跨越60或160经验 `milestone/grow`；衣柜或毛色真正变更 `appearance/outfit|breed`；库存成功出售 `inventory/sell`。成长检查覆盖照料、吧唧、出游、出售和诊所的成功路径，导入或恢复不重播。原生 kind 使用上述封闭集合，eventId 区分 kind、phase、action，避免同一 revision 的照料与成长反馈互相去重。低精力仅从真实状态持续投影，不生成额外领域事件。

原生只在事务返回成功后分发；未保存、取消、重复观察或重复吧唧 ACK 不产生成功反馈。`VisualFeedbackGate` 只拦截非前台与有限集合中的完全重复 eventId；连续到达的不同已提交事件全部放行，不按时间间隔吞掉吧唧批次。视觉节流或合并由渲染层处理，不再发奖励；原生不排队。切后台调用 `clearFeedback()` 并清除暂存归家反馈，恢复只投影实际存档，不重播成功动画。开启接鱼或其他 3D 活动时清除小屋反馈并暂停房间。渲染接口异常不改变已提交业务结果。

湿身为本地持久展示事实，根字段 `wet:Boolean`、`observedOutdoorEvents` 最多128项；`world-encounter` 经实际会话与原型故事校验后首次记录，重复观察不推进 revision。实际雨天擦拭完成的 `world-choice` 保存成功后清湿身，健康/心情仍沿用原型在出游结算时生效，不新增毛巾或物品扣除；真正提交的洗澡也清湿身。取消或重启保留已发生的湿身。房间/世界 `applyState` 同时投影 `wet` 与 `presentation:{wet}`、真实健康状态，不自行发奖。

擦拭为两阶段交互：`world-wipe-start` 先校验前台、当前出游 token、实际已观察的雨事件、湿身以及尚未选择，仅记录 RAM 单调时间，不写存档、不清湿身。渲染层真实手势完成后才发 `world-choice rain/care`；原生另检查同 token 开始记录与至少800ms时长，再调用原事务保存。开始擦拭成功不发完成反馈。切后台、关闭场景或开启新出游清除 RAM 记录；取消/中断保留湿身。手势距离及渲染侧900ms门槛由本地 world 渲染器负责，原生不会注入手势或新增经济奖励。

该轮源码与渲染资产由父集成任务统一构建和运行验收；此处接口实现不代表新增视觉体验或真机 BLE 已通过验收。

## 存档与恢复

`files/pet-state.json` 使用 Android `AtomicFile` 写入，保存 schemaVersion、SHA-256 与 JSON payload。写入后显式 `FileDescriptor.sync()`；`finishWrite` 后通过 `openRead` 严格核对完整包字节和校验和，再确认独立有效备份，均成功后才交换内存状态或 ACK。写入/同步阶段失败可重试；finish/读回结果不确定时暂停写入，不对已关闭 stream 调用 `failWrite`。存储失败不发送最终 ACK，吧唧保留待重试事件；无效语义才返回 rejected。

主界面「重新检查本机存档」先读取并验证实际磁盘内容，用该已验证字节修复独立备份后才载入和解除暂停，绝不先用旧 RAM 覆盖主存档。启动已有存档也先确认独立备份；失败会明确暂停。每次提交前保留有效旧包，成功读回后把有效副本推进到新版本。「从本机上一份存档恢复」在用户确认后恢复私有副本，并保留当前原包。副本与主存档仍位于同一设备，不能承诺任意介质损坏下零丢失，建议另行导出备份。

读取失败时保留损坏文件，进入明确可见的恢复模式，暂停照料，不静默创建持久新宠物。用户可通过系统文件选择器导出备份/选择备份，并在确认后恢复。恢复前另外保留本机可读存档；恢复同一只猫会合并已处理事件记录，并把 revision 更新到 `max(当前, 备份)+1`。导入另一只猫不会重绑或清除设备数据，设备应拒绝 pet mismatch。累计 20,000 条设备互动去重记录后会明确阻止新增结算，避免悄悄丢弃旧去重记录；后续需要产品批准归档策略。

前台状态衰减沿用原型每秒系数，每 15 秒保存一次；不实现未确认的离线补扣或云冲突策略。每次照料实时保存。

schemaVersion 仍为1，兼容首版存档：仅整块缺失时迁移外观为 orange/none/['none']，迁移 inventory/world/健康与未完成会话字段；部分损坏对象不静默补齐。原有 petId、去重记录、成长和喵币不会因升级重新生成。

## BLE

遵循 `protocol/v1/README.md`：加密、认证配对；用户选择连接设备，配对码由吧唧显示，用户自己确认系统弹窗。本程序不自动确认系统提示。

Android 12+ 仅点击「蓝牙权限」才申请附近设备授权，点击搜索才做带 service UUID 的 8 秒扫描；未请求定位。Android 8–11 只显示系统已配对设备或手动设备地址，避免为扫描申请定位。应用不自动开启蓝牙，无后台蓝牙服务；离开应用会断开，回到前台可主动点击重连。连接丢失在前台最多重试 3 次；明确断开或离开页面会取消重试。

事件使用 UTF-8 字节流重组 NDJSON，2048 字节包含 LF；发送按协商 MTU 分片，GATT 默认写入串行，操作有超时。真实系统配对、通知、重连、断电恢复仍需手机与真板验收，源代码或 fixture 通过不能替代真机验收。

## 构建

父集成任务准备 `.tools` 内 JDK 21.0.12.1、Android SDK 35、build-tools 35.0.0 和 Gradle 8.9，并设置 `JAVA_HOME`、`ANDROID_HOME` 与 `GRADLE_USER_HOME`。当前 JDK 路径为 `.tools/java/jdk-21.0.12.1+1/Contents/Home`；Java/Kotlin 编译目标均为 17。从本目录执行 Gradle 的 `:app:assembleDebug`。构建应由父集成任务串行协调，避免与 ESP-IDF 同时占用机器。

Debug 签名路径固定为项目 `.tools/signing/catforest-debug.keystore`，构建环境的 `ANDROID_USER_HOME`、Gradle cache 也必须设到项目内。标准 Android 调试口令不是账号凭据，不代表生产发行签名。Debug APK 用于本地安装/验收；正式发行签名、商店上架、后台连接、云同步、双板社交、完整 PRD 和生产 AI 尚未完成。无网络、相机、麦克风或定位权限声明。
