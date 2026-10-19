# 外观展示字段接线（062相遇源码之后，尚未重新打包）

本批仅完成资产无关的协议/存储/GUI预接线。按父任务明确安排，不合入尚未完成的外观候选，不运行技术测试、模拟或自行验收，不重新统一打包、不安装、不烧录。之前062/手机048生产包保持原始字节，**不包含本文件所述的新展示字段**；最终版本号、统一构建和部署由父任务协调。

## 手机来源与身份

`offline-scene-map.js::project()` 只读原游戏当前 `pet.stage`、`pet.outfit`、已有 `pet.bodyShape`；阶段只允许kitten/young/adult，旧baby归一kitten。bodyShape仅保留standard/slim/round请求，无字段或未知值使用standard，不读取照料值推算胖瘦。阶段/装扮未知时整组省略，不能借默认成年或上一个外观补齐。

外观加在原snapshot.pet内，没有新建身份/账号/同步通道。`read(context)`仍经原 `identities.resolve(state.pet,context)` 得到持久wire petId，然后原coordinator发送；不使用候选 `CatPetAppearance.project()` 返回的本地cat-1。外观字段存在时适配器和固件都要求已使用该cat-UUID形式，仍受原owner、pet_id、revision、session核对；原身份registry函数与绑定/恢复逻辑未改。

## JSON与能力协商

继续使用现有CFLOCAL2 v2 snapshot命令，只扩展 `pet` 三项：

|字段|值|处理|
|---|---|---|
|growthStage|kitten / young / adult|直接来自原游戏，baby已在手机投影归一|
|outfit|既有ID，1..64个 `[A-Za-z0-9_-]` 字符|不改变物品解锁、售价或获得规则；未知渲染ID交由渲染器拒绝|
|bodyShape|可选standard / slim / round|缺省standard；本批不制定或执行胖瘦算法|

出现任一外观字段时，growthStage和outfit必须同时有效；不能只给bodyShape、null、任意stage或超长装扮，不能将 `meet.stage` 强转为growthStage。手机 `validateScene` 明确根字段/宠物字段白名单；固件 `snapshot()`的白名单、枚举、ID和长度也严格验证。

新固件声明 `pet_appearance_v1`，表示可接受和持久保存这些展示字段，**不是“原生外观已接入/视觉已验收”**。手机 `petView()/semantic()/pushScene()` 按该能力统一选择字段：有能力时阶段、装扮、体型进入发送数据和语义去重签名；只有这些字段变化也会产生新的wire revision。没有能力的旧固件只收到原字段，其去重签名也不夹带未发送字段，保持基本场景兼容。

原pending指令不补字段、不重编码、不改hash/seq；恢复仍原字节重发。完成原pending后才发送当前新快照，继续使用原native journal checkpoint、当前connection generation和既有revision递增逻辑。

新固件state返回已保存的growthStage/outfit/bodyShape；旧/未知外观省略三项，不返回虚构成年。没有新增独立appearance命令或隐式写游戏存档。

## 固件持久格式与旧数据

`l2_pet_t` 内部使用独立的 appearance_known、growth_stage、body_shape、outfit。growth enum为unknown0/kitten1/young2/adult3；body enum为standard0/slim1/round2，只做显示请求。相遇结构 `l2_meet_t.stage` 与其序列、证明、消息均未改。

CFL2 blob写入版本5，仍逐字段LE编码和原CRC，兼容读取2/3/4。旧快照主区及062相遇事件/证明的读写顺序保留；只在已有内容末尾、CRC之前追加68字节：known1、growth1、body1、outfit65。L2_STORE_MAX仅为这68字节展示元数据从8192增加到8260，避免完整有效schema4在迁移时因新增字段挤占原预算；FIFO仍200、peer仍32，NVS分区和持久事务方式不改。旧版本读取后这组保持未知/空；不推断年龄、不发奖励、不修改原事件或ACK水位。下次正常事务提交才写新格式，不擦NVS、不重建owner或身份。

`canonical_snapshot`复制新字段，`snapshot_valid/state_valid`校验，`same_snapshot`在比较原字节区后显式比较外观语义。同revision换外观仍是revision_conflict，不能悄悄覆盖；相同原请求仍走原请求去重。不改变现有pet_mismatch阻止自动覆盖旧猫的规则。schema5写入后旧062/061无法读取5，不可直接降级。

## GUI预接线与未合入边界

`badge_pages.c::refresh_state()`调用 `project_snapshot_appearance()`，与原延迟状态投影同行。手指接触、手势、滑动/回弹、末帧交接、页面过渡期间直接延后，下次原refresh_state安全更新；BLE线程只更新原持久domain，不调用LVGL。

主目录目前没有 `badge_appearance.h` 和候选renderer实现，因此通过 `__has_include` 让本预接线保持资产无关；当前原scene/模型/帧资源完全不动。父任务完整合入候选的header、scene API及实现后，预接线自动可用：

`badge_appearance_from_names(growthStage, breed, outfit, bodyShape) → badge_scene_set_appearance(scene, &appearance)`。

投影只读取当前domain快照和wire pet ID，以身份/revision缓存。新身份先向原场景传NULL清旧外观，再应用新外观；清空、存档不可用、外观未知或映射不支持时传NULL。应用对象为原home/care/care-action/welcome/guide五个scene，没有新建显示层或直接改背景布局。原66帧、动画/滑页接口、圆环和小镇不改。

仅header单独复制不是完整集成；必须将候选scene接口和实现一起协调合入并统一生产构建。原生资产包、五体型/40配饰完成度、具体显示及资源表现仍归外观线，不能从协议接线推出已完成。

## 交接

增量源码和补丁在 `deliverables/2026-10-18/appearance-wire-after062/`，基于062相遇批次完成后的实际主目录快照生成。source-before/after和哈希记录用于合并时核对；受保护文件静态比较单列。preview/Android资产镜像没有更新，现有APK/BIN没有重打或替换。

下一步由父任务决定资产/候选合入安排，再统一生成必要资产、分配新版本并生产构建；部署前重新确认实际分区及OTA选择，手机原签名原位安装、吧唧只写实际应用分区。没有第二台吧唧时，原相遇双机验收仍不能关闭。
