# 034 → 025 真实喂食路径只读审计

## 结论

当前冻结固件已有本地物理 UI 喂食完成→FIFO→025 原规则结算路径。现有合法远程接口不能代替圆屏触摸：USB 无导航/触摸/领域写命令，BLE 无 emit-care 操作，手机 feed 快照只更新显示状态。实际喂食端到端仍需物理动作及真实证据，不能用主机 fixture、手机动画或诊断 VIEW 代替。

本审计未操作设备、串口、ADB，未写运行源/冻结 manifest/APK、未奖或写实际存档。检查了 /、/Users、用户目录、coding、项目路径的 AGENTS.md，均不存在。只在 tests/feed-path-audit 写审计文件。

## 确切原 UI 步骤（466×466 逻辑坐标）

1. 手机明确选择新本地模式，真实连接 CFLOCAL2 并同步当前猫。吧唧需 ready + hasSnapshot 且无 storageError；已持久旧 snapshot 时无需持续 BLE 连接，也可离线排队。
2. 若圆屏 AOD/熄屏，先轻点安全圆内部并松手：首次接触只唤醒，不计照料。安全圆为圆心233,233半径212。真实礼物弹窗先正常关闭，不修改状态略过。
3. HOME 在安全区上滑，例如 (233,300)→(233,180)，500ms内、位移至少50px；等待过渡至少220ms，看到「照料」。HOME中间猫是 pet 事件，不是喂食。
4. 点左下「喂食」图标，圆心 **105,322、半径36**（视觉72×72）。等至少220ms到动作页，见「轻点碗三次，一口一口来」及0/3。
5. 点碗 **233,323、半径52**（视觉104×104）三次，每次按压≤300ms、移动<12px并松手，两个有效点击间≥450ms，建议600–700ms。长按不是喂食，不要按住不松手。
6. 第三次有效点击调用 finish_care→emit_care(feed)。仅持久成功才显示「动作已存待确认」并回HOME。失败会提示存档未就绪、队列满、保存失败或「尚未保存，轻点重试」，不可声称完成。
7. 手机已明确授权当前真实连接、前台、原存档健康且没有正在进行的原游戏互动时，会读FIFO结算。用显式连接详情及持久收据核状态，不能据动画判定成功。

## 开始/取消/冷启/断连的差别

- 开始及第1、2口仅 care_steps RAM 进度，无事件无奖励。动作页下滑取消并回照料；重进清零。重启也不恢复未完成的步骤。
- 第3口成功：l2_emit_care 分配设备全局 counter，持久 care/feed。encode+state_valid 后 nvs_set_blob+nvs_commit 成功，才替换 saved 并返回L2_OK。写不确定时置 storageError，后续停止，不盲重复写。
- BLE断开不阻止本地完成并排队。重启从 cf_local2/state 校验版本/CRC/队列连续性恢复已完成FIFO，不清队列。本次没有做实际掉电恢复试验。
- 重启 RAM 时钟失效时允许 epoch=0，wire 输出 occurredAtMs:null；不等于拒绝喂食。真实手机新 snapshot 负责校时，不能复用旧 clockValid=true。
- 本地完成不直接增加设备 snapshot 的food/coins，只显示 observed_action约3秒；最后状态来自手机原规则结算后的新快照。

## 逐段生产代码依据

所有固件路径基于 artifacts/firmware-local-v3-perf034/source/main；手机路径基于 artifacts/html-offline-candidate/ui025/source。

- badge_pages.c:444命中区；:635–678 emit/begin/finish/step；:701–710菜单与碗点击；:767–768取消；:793–824输入设备触摸路径。badge_gesture.c及badge_ui_contract.h定义300ms、12px、50px、500ms、220ms。
- local2_store.c:16–20 NVS set_blob+commit；local2_emit_care使用运行mutex。local2_core.c:62提交失败置storage_error，:70持久队头ACK/lastAck，:71持久完成事件/counter。
- local2_wire.c:115–123 events 输出 native_device/CFLOCAL2/deviceId:counter/petId/care/feed；:134–156公开操作仅hello/state/events/snapshot/ack，snapshot只 l2_set_snapshot，**不emit**。
- badge_diagnostics.c:178–183仅STATE/PERF/PERF RESET/CAPTURE/VIEW0..2/HELP；VIEW仅awake idle HOME的表盘选择，没有照料导航或触摸命令。
- preview/offline-device-events.js:11 feed→原hostDeviceCare('feed')；:61–77先核Native存储、存档、当前连接、lastAck历史收据完整、device/pet/存档世代；手机busy则等待。
- 原打包game-03.js（长单行，定位hostDeviceCare/se/Z/be/ae）：feed要求food<95、coins≥3、无其他活动、原4s冷却检查。成功food+25/mood+3/clean−2（钳制）、XP+8、coins−3、counts.feed+1；愿望仅达成，不自动领取。拒绝则明确 quarantined/未获奖，不冒充 applied。
- offline-device-events.js:78–105隔离原规则计划、token/digest，异步后复核身份/原图像/忙状态，Native seal完整game/social/ledger，再投影原store/hydrate，确认durable receipt后才ACK。原存储错误不转quarantine。
- preview/cflocal2-adapter.js:140–153 ACK仅限该连接真实readNext事件，核device/pet/event、persisted receipt/saveDigest；pending ACK先Native checkpoint。未知ACK重放还要匹配原持久收据。ledger同eventId内容变化拒绝；重读已结算event只duplicate ACK不再奖。
- core ACK只移FIFO队头并持久，响应丢可依请求seq/id/hash去重。不把开始或显示feed快照当完成事件。

## 独立潜在语义风险：4秒冷却不是跨事务防刷

原store的 cooldown map p 是闭包RAM，不在JSON中。消费者每条事件在新隔离store计划结果，因而新事件不能继承上条隔离store的冷却map。本轮主机隔离精确复现：两个不同feed counter在完全相同NOW，初始food65/coins30，两条均applied，最终food100/coins24/XP16/count.feed2；相同eventId重放仍正确去重。

这说明原4s检查不能宣称为跨设备事件事务/跨重启的严格冷却。设备本地只有每口450ms，没有额外feed全局冷却。此处是独立潜在语义风险，未擅改原规则；不等于重复同event可刷奖，也不等于实机已复现。

## 本轮最小主机验证

`node --test tests/feed-path-audit/feed-production.test.cjs`：**6/6通过**，输出feed-production.tap。复用冻结025 event-fixture，加载实际打包game-03的原vu store、生产消费者/ledger/sceneMap；Native权威与BLE是明确内存替身。

覆盖：原feed扣3币/XP8/food25/mood3/clean−2/count+1及Native收据先于ACK；相同event不重奖；busy/错误来源/lastAck历史缺口不奖不ACK；同ID内容变化拒绝；吃饱/币不足quarantined且不扣币不涨值；上述独立冷却风险定性复现。

**不是** Android实际fsync、NVS/掉电、真实BLE往返或圆屏物理触摸证据。

## 原ENOSPC证据与剩余门槛

首次试跑冻结025整event-transaction.test.cjs因ENOSPC输出写失败exit7，original-event-transaction.tap为0B并原样保留；environment-failure.json记录错误，不能计通过。报告首次heredoc及apply_patch亦失败。Root腾空间后本次新聚焦测试另存输出，不覆盖旧失败。

实际操作者需物理做完整三口，记录0/3→完成→保存、事前后counter/pending/lastAck、action feed、原规则实际扣币/count增长或明确隔离、Native receipt及ACK后pending归零，断连重连不重复奖。counter依实际事前nextEvent，不能固定10造证据。用户当前不在圆屏旁时无现有合法远程替代，本项应待物理动作；不请求其立即操作，不新增注入后称真实操作。
