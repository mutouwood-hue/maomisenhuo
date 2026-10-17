# 独立跨端集成审查

日期：2026-10-15。审查范围：`protocol/v1/README.md`、Android Kotlin 原生状态/生命周期/GATT、原型 renderer 和 native bridge、固件状态/通知/配对/UI。此审查只读源码，没有运行构建、下载、自动测试、申请权限或操作设备。自动回归由独立 QA 工作流负责，真机结果须另记。

## 发现及处理

### IR-01 / P1：临时写盘失败使有效互动永久停止重试

原路径：`PetStore.badgeEvent()` 把持久化异常转换成 `rejected` ACK；固件把 rejected 事件持久标为 blocked，后续重连跳过它。

复现条件：吧唧发出合法 pet 事件 → 手机事务因空间不足等原因写盘失败 → 释放空间、重连。修复前该事件仍未结算且不会重新播放。

已向 Android/固件负责人报告。当前源码中 `PetStore.kt:99`、`:125` 把 `StorageFailure` 向上抛出，`MainActivity.kt:259`–`:264` 在失败时不发最终 ACK/快照；固件继续保留、重传原事件。另外 `badge_state.c:119` 提供持久化重新排队，保留事件 ID/counter；`badge_ui.c:106`–`:107` 将正常短点和拒绝事件长按重试分开。**源码层修复已复读；错误注入和真实设备恢复仍需 QA/真机确认。**

### IR-02 / P1：手机忘记配对后无法保留存档重新配对

原路径：`BLE_GAP_EVENT_REPEAT_PAIRING` 永远 IGNORE，同时设备没有本地清除旧安全记录的操作。

复现条件：先成功配对 → Android 设置中忘记设备 → App 再配对。手机没有旧密钥，而设备仍保留旧密钥，所有重试被拒绝。

已向固件负责人报告。当前 `badge_ui.c:41`–`:57` 提供本机配对管理及确认/取消；`badge_ble.c:77`–`:93` 在 NimBLE host event queue 中删除 bond/CCCD 安全记录并断开，应用 NVS 不被擦除；repeat pairing 仍不自动删除安全记录。**源码层存在恢复入口；忘记配对→本机确认→重新配对须真实手机/板卡验收。**

### IR-03 / P1：损坏队列计数会让错误界面越界读取

原路径：初始化发现 `saved.count > 200` 后返回错误，但没有隔离已经装进 RAM 的损坏结构；`main.c` 启动恢复界面，`badge_get_view()` 仍按该 count 遍历 events。

复现条件：NVS 中保存长度匹配但 count 超界的 blob → 重启。预期保留原始数据并显示错误，修复前可能越界/挂起。

已向固件负责人报告。当前 `badge_state.c:26`–`:39` 检查大小、magic、count、UUID、快照数值、counter 和事件顺序；`:70`–`:79` 在错误时只清理 RAM 并标记 storage_error，不改写原始 flash blob。**源码层修复已复读；异常存储回归由 QA 执行。**

### IR-04 / P1：原型互动完成前就扣币/发奖励

原路径：Android 先 `store.care()` 再调用 renderer.perform；原型 feed/drink/bath/climb/tease 是需要实际操作完成的互动，渲染器的取消、busy 或未完成结果被忽略。

复现条件：点喂食后立即获得数值/成长并扣币，尚未完成投喂步骤即离开；或在场景仍 busy 时点击另一原生照料动作。修复前未完成互动也已结算。

已向产品/Android/集成负责人报告。当前 `MainActivity.kt:184`–`:211` 采用 preflight 和 pendingCare，`:240`–`:249` 只在原型完成回调后提交，`:453` 在 onPause 取消；`scripts/prepare_prototype_assets.py:37`–`:46` 用 generation 抑制取消后的旧回调。简化原生接鱼已由原型 `_f` 的独立本地 WebView 替代。**源码层修复已复读；原型手势完成、取消、切后台、游戏结算和画面可用性仍须平台执行验证。**

### IR-05 / P1：房间 ready 通知参数数量不匹配

Android `RendererBridge.ready()` 无参数，但生成器 `scripts/prepare_prototype_assets.py:67` 调用 `callNative('ready','')` 传入一个参数。Android JavascriptInterface 按方法/参数数量解析，方法调用不能成功，native `rendererReady` 保持 false，五种互动被 `act()` 的 ready 检查阻塞，即使房间已经显示。

Android 负责人指出此问题，独立复读确认。集成负责人现已将生成器和 APK 内 `renderer-core.js` 都改为 `callNative('ready')`；独立复读两者一致。**源码层修复已复读；Android JavascriptInterface 实际执行仍须平台验证，不可据桌面 JS mock 判断已通过。**

### IR-06 / P1：接鱼回调把数字分数当作对象读取

原路径：wrapper 使用 `r.score`，但原始 `小橘电子宠物.html` 中 `_f({onFinish:e})` 的结束路径调用的是 `e(S)`；`S` 是数字分数。读取数字的 `.score` 得到 undefined，随后 fallback 为 0，实际接到鱼也按零分结算。

集成负责人发现并修复。独立复读确认：原始 HTML 与生成的 `minigame-core.js` 的 `_f` 都在结束时调用 `e(S)`；生成器 `scripts/prepare_prototype_assets.py:78` 和 APK 内 `app/android/app/src/main/assets/minigame-core.js:4136` 现在均使用 `Math.trunc(Number(r)||0)`，保留 numeric callback 的实际分数。Android `MiniBridge.miniFinished(score: Int)` 再校验范围后将分数传给原生结算。

集成负责人报告 Tabbit 完整 20 秒原型运行得到 `score=1`、wrapper callback 同为 `1`；这是集成工作流提供的桌面浏览器运行证据，本审查没有重复执行。**修复已独立复读，Android WebView、native bridge 和真实持久化的端到端结算仍须平台验证。**

## 其他已检查的边界

- 两端 UUID 的 NimBLE 字节序相符；Android 写入串行、WITH_RESPONSE、按 MTU-3 分片；两端按 UTF-8 字节累积 LF 帧并限制 2048 字节。
- 固件 secure connection/bonding/MITM 和 authenticated encrypted characteristic 配置存在；默认关闭 legacy pairing。配置存在不等于实际配对成功。
- Android 状态事务先保存再交换内存；事件效果及去重记录同一事务落盘；App 发送 ACK 后再发送最新快照。固件事件序号/队列先保存再通知，收到 applied/duplicate 后先持久删除再移除 RAM 条目。
- App 本地存档保留 petId/revision/去重记录，导入同宠物备份时合并已处理事件并增加 revision。不同宠物不会被固件新快照静默覆盖。
- App 是前台 BLE：onStop 主动断开，重新进入当前需要用户点重连。需在使用说明和真机验收中如实体现；本审查没有推定后台长连已经实现。

## 完整 PRD 的可见缺口，提交产品负责人判断

以下是当前源码缺少的能力，不能因为首个本地 BLE 闭环通过就标为完成，也不代表用户批准删除：

- Android 原生存档目前是一只猫的名字/基础状态/成长/喵币/愿望/手记；尚无品种/装扮持久化、衣柜商城、物品库存/户外旅程、诊所疾病、家庭/生蛋/毕业、好友/赠礼/图鉴/相遇世界编辑、云端主存和生产 AI。
- 快照目前没有外观 ID、昼夜/时间及生活同步语义；renderer 默认 orange/none。完整外观跨端一致性尚不能验收。
- 吧唧现为单页状态、同源猫图和短点摸摸反馈及恢复操作；不含交互包的完整 23 页面/滑动导航/触控引导/完整待机关闭状态机，也不等于 PRD 的持续 3D 猫、音效、IMU 和全部离线事件。
- 一块可用板不能完成双板相遇、双方状态与社交流程验收。

## 真机验收闸门

须在用户确认设备连接、Android 授权/配对及具体写板后，记录 APK/固件哈希、手机型号/OS、板卡身份和端口，并验证：首次安全配对、忘记配对恢复、认证读写/订阅、中文 UTF-8 分片、真实触摸事件、ACK 丢失/重复事件、手机进程重启、板卡断电与队列回放、断连重连、拒绝事件重试、存档导出恢复、屏幕/触控方向和资源/功耗基线。构建、host substitutes 或源码审查均不替代此闸门。

六个 P1 均已交给实现者并在当前源码观察到对应修复，复读后在本报告覆盖的路径中未确认新的未修 P0/P1。原型互动使用完成回调结算，取消后的 generation 校验和小游戏旧会话校验存在；该结论限源码。

QA 工作流的 [latest-report.json](protocol/latest-report.json) 在本次查阅时（`2026-10-15T08:14:37.881541+00:00`）记录 **40 项 host 测试通过、0 skipped、0 failures、0 errors**，`status=passed`、`completeProductionHostCoverage=true`；已包含生产 Android 状态和固件状态/协议的主机回归。固件损坏 count 和重试保留事件 ID 的回归已纳入。该测试结果属于 QA 工作流，审查者没有重复运行。host coverage 指该回归套件覆盖的生产源码路径，不代表 Android OS、目标 NVS、真实 GATT/无线电或设备已经验收。本报告不对尚未完成的目标构建或真机验收作通过结论。
