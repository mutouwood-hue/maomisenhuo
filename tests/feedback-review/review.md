# 手机共享反馈层独立复读

日期：2026-10-15。范围：当前工作区源码、生成器及生成资源；不改产品、不构建、不ADB、不操作设备。以下“确认”指代码路径复读，除明确列出的两项轻量桥接用例外，不代表Android视觉实跑通过。

## 本轮证据

| 文件 | SHA-256 |
|---|---|
| `scripts/phone_feedback.js`及生成`assets/phone-feedback.js` | `23fb7a5e042ba6d95e882bf7676a9b66b5ea1d464381699c8114266c2b01318b` |
| `scripts/phone_feedback.css`及生成`assets/phone-feedback.css` | `baa98c9acd49d938a54cafd7eabc58d0c82b51075c1d2c3e538ca3039861e1b6` |
| `scripts/prepare_phone_feedback.py` | `1bb555bef0559eaa209d96ef27546395465b4db99ae265d81a59a77bed230423` |

Android/规则owner仍在并行修改，最终候选应再记录整包版本并执行[验收矩阵](state-acceptance-matrix.md)。旧APK通过结果不能替代新反馈层验收。

## 已确认接入与本轮修复

- `Gate.accept`检查version=1、committed=true、安全整数且非负revision、有限长度eventId、petId、重复ID与旧revision；`validSemantic`限定kind/phase/action/event/choice合法组合及settled真值。不同kind/phase可在同一revision分别显示；同eventId全局只一次。世界`appearance()`现补petId/revision，初次状态也能hydrate身份及版本。
- Native `VisualFeedbackGate`已去掉会吞独立已提交事件的240毫秒节流，保留暂停与ID去重。JS对同语义真实事件合并并显示实际次数；channel包括事件与choice，不把雨的不同选择混成一个动作。
- 原生只在业务成功后调用committed反馈。原`bf`的completed进度已改为中性“动作完成，正在保存进度…”，不会抢先宣称最终成功。JS反馈没有调用业务奖励或care API，不能二次发奖。
- `NativeMini.miniFinished`先`cancelMini()`清playDialog、销毁旧桥并恢复房间，再`commitCare(play)`；回家反馈不会被playDialog守卫吞掉。照料完成也先清pendingCare再commit/feedback。存储失败走失败出口，不发committed。
- 世界choice生成器用精确单一anchor断言；Native返回成功后才设置j/hide选项，失败保留选择界面；worldChoiceBusy防同界面连点。成功choice即时抢占encounter的瞬时cue，rain逻辑也即时转phase，不等待普通队列播放。
- 首次真实世界偶遇通过Native observe保存wet/已观察ID，再发encounter；duplicate不发初始反应。已观察事件只保存表现事实，不增加币、XP、物品、health或病况。旧token/错事件受当前session和Mf选择器限制；128条淘汰不使旧token重新成为活动会话。
- wet与healthIssue独立；choice擦干和真实bath成功清wet，诊疗不清wet；原雨故事数值依然最终settle才应用。规则owner已修rain:safe“没有淋湿”矛盾，choose阶段无雨衣仅说风险，不提前诊断；失物coins也不提前说4币到账。
- shelter搜索的是原场景高处绿色BoxGeometry，未新造遮蔽物；只移动model.root的表现偏移，不改逻辑cat的位置/碰撞/路径/奖励判断。暂停clear恢复root偏移和原灯光，applyState恢复湿身/病况/外观，不重建首次雨事件。
- CSS reduced-motion禁动画/过渡；JS still分支不移动遮蔽offset、不抖毛/跳跃。此为源码检查，仍需实际系统低动效设置下检查视觉。

## 实际执行的轻量回归

仅给`tests/lifecycle-review/test_world_response.py`新增可选视觉的无副作用stub，未改原迟到/取消断言。执行：

`python3 tests/lifecycle-review/test_world_response.py`

结果：**2 tests通过，0.309秒**。每项同时执行真实generator桥接文本与当前generated桥接文本：

1. 模拟20秒Native延迟，响应前Promise没有被自动替换为失败；真实成功可接收一次，重复resolve拒绝。
2. 显式stop返回取消，之后迟到resolve拒绝。

stub不渲染Three.js、不验证动画、AtomicFile、BLE或Android。共享Gate/队列单测由root负责，避免重复运行；本报告不把它们写作本人已执行。

## 仍需保留的限制与验收

1. **极端过载会丢瞬时演出。** 不同语义队列最多12项；满时按新鲜度淘汰最旧视觉项，记录replacedVisuals。它不丢事务，但不能声称任意过载下每个结果都逐个播放。root已明确接受并将在交付文档披露；普通同语义真实BLE补传按真实次数合并。
2. **擦干目前是点击提交后的结果演出。** 当前按钮先Native choose成功并保存wet=false，再播放约2.1秒wipe；不是手动擦拭完成后提交。`LocalLifeRules`尚有“Native invokes care only at real wipe completion point”的注释，与此接入不一致，已告root。需要明确产品口径：点击即完成照顾、可中断结果动画，或将来真的拆成准备/擦拭完成两阶段；不能宣称后者已实现。health/mood仍仅最终出游结算。
3. **遮蔽位置有条件。** 只在现有几何18单位内找到合适树冠才有视觉移位；不能宣称所有地点/位置都实际跑到树下。无目标时不得借文案声称出现了不存在的遮蔽物；需真实场景验收并呈现适当回退。
4. **新增低精力表现不是原业务规则。** energy≤25的困倦姿态仅表现阈值，没有改变体力/经济；不要称此阈值来自PRD或附件已实现规则。
5. **持久去重与瞬时去重不同。** wet/户外已观察ID及真实业务事件有持久状态；JS/Native视觉seen均是有限内存集合。安全依赖原生当前session/revision和加载只恢复状态，不应新增从历史journal/ACK/导入重建一次性事件的路径。
6. **全量场景尚未视觉验收。** 节点真实接触、小游戏caught/splash/miss、诊所工具及各选择继续复用原渲染器；完整链条要按[C01..S07覆盖清单](event-coverage.md)和M01..M31逐项取证。新共享层源码可读不等于所有动作已清楚可见；触摸、相机遮挡、圆角/小屏、节电低动效、后台重建和真实BLE仍未由本轮确认。

本轮未发现已读取反馈路径新增经济/健康结算规则或二次奖励调用；这不是完整Android运行通过结论。上述限制及原PRD未迁移范围保持显式，不能以雨天演示替代全功能验收。

## 两阶段擦拭追加复读（同日后续版本）

以下覆盖上文第2、3项旧实现限制：现在不是点按钮立刻清wet，shade也已移除18单位距离限制，改取最近的既有树冠。当前读取的SHA-256：

| 文件 | SHA-256 |
|---|---|
| `scripts/phone_feedback.js` | `5a93e919566964e54430727f43934aa49b08734482dbd5f06efeb8413f4552c1` |
| `scripts/phone_feedback.css` | `f3e4892a8a6a97e192a822f656c6219e01732955186e7d53b9d386bc6597a333` |
| `scripts/prepare_phone_feedback.py` | `f70d6291baacbc6ab205cec5167b5e69ba2a13f9cbeb308c12ed23ac72975577` |
| `scripts/prepare_life_assets.py` | `158312fb0147da7b4ea3241fb245f11e7c9a9e5c78ae1631348f6d37b777f365` |

### 确认路径

- 选择雨天care先调用`__catPrepareWorldChoice`，设置wipePending并请求`world-wipe-start`；只有Native确认后才开放实际擦拭。开始本身没有持久选择、去湿或奖励。
- Native `MainActivity.worldEvent` 的start校验存档未blocked、当前pending token、choice尚空、token真实对应rain、已观察ID存在且wet=true；记录当前token及单调时钟。提交care再校验同一前提和至少800毫秒。
- `beginWipe`要求active/world/wet；只有`isTrusted`的pointerdown及同pointerId的pointermove进入猫附近矩形ROI，累计路径≥100像素且首次按下后≥900毫秒，才resolve true并发`world-choice`。出ROI后清last，不能靠出界跳回一次跳距凑进度；每次增量上限45像素。beginWipe本身不改wet，成功保存后由applyState清wet。
- 取消按钮返回false；pause/stop通过clear结束擦拭Promise并保留未提交wet。stop还resolve未决RPC为取消并清Map；迟到RPC不能触发新擦拭/选择。旧generation/不active的Native请求也拒绝。真正已提交后再暂停仍保留已擦干事实，数值仍须最终settle。
- 生成器对原运动frame增加`!__catWipePending`，原猫逻辑运动在擦拭期间暂停。wipe目标层z-index5高于原世界UI4，覆盖目标启用pointer-events与touch-action:none；取消按钮更高，不把擦拭透传给原canvas。真实触屏命中与遮挡仍未验收。
- 未发现取消/失败路径会发送新的成功事件或奖励。保存失败时choice仍未隐藏为成功，wet保持原生旧权威值，后续恢复按原blocked流程处理。

### 实际执行

1. `python3 tests/lifecycle-review/test_world_response.py`：**2通过，0.238秒**。仍是生成器与生成桥的迟到/显式取消验证。
2. 新增`python3 tests/feedback-review/test_wipe_input.py`：**2通过，0.069秒**。执行生产反馈JS且检查generated逐字相同，微型DOM模拟输入：拒绝伪事件与不足时长/路径；足量输入仅返回完成而不自行清wet；暂停取消半途擦拭、迟到输入无效且wet保留。

第二组只模拟事件字段和时钟，**不证明浏览器的真实isTrusted、真实猫投影、触控精度或Android视觉通过**；没有构建/ADB/设备动作。

### 仍待画面核对的输入边界

`frame`投影头部后将屏幕坐标夹到8..92%/12..85%，目前忽略原`proj(point).visible`；nearest shade又可能把表现猫带到更远的树冠。若猫落在视锥外，ROI仍可能位于空白画面边缘并接受擦拭。代码条件已确认，实际相机/地点是否触发须画面取证；已立即报root，建议投影不可见时禁擦并提示召回，或先确保表现猫进入可见区域。不要将Node里的矩形ROI用例描述为“手指确实擦到可见猫”。其余过载、全事件视觉、持久与瞬时去重范围的限制仍有效。

**后续模拟器结果（root提供）：** 自然触发雨后点击擦拭，表现猫确实跑出画面，ROI被夹到左下；存档仍wet=true、choice=null，未发生错误奖励。root正在修shade只选投影可见目标、frame超界回退和catVisible输入强门控，并修原事件panel遮猫。此问题已从风险升级为模拟器确认的交互缺陷；本人等待稳定源码后以真实frame有效投影更新输入测试，修复尚未在本轮独立确认。模拟器证据由root保管，不冒称本人实跑。

## 可见性与初遇延迟修复复读（同日最新追加）

本段更新上一段“待稳定源码”的状态，**源码门控已复读、轻量用例已过，修后Android画面仍待集成方实跑**。

| 当前文件 | SHA-256 |
|---|---|
| `scripts/phone_feedback.js`及generated同名文件 | `e7408c67e38a0adb1317fe881635ad2163dfe8651a4a59614a0fc24971db8328` |
| `scripts/phone_feedback.css` | `a4f99ebaa4e94cd03d3bf6a9d1107d94a2afcc7b2b8abf83d6cd9e8d04e8832c` |
| `scripts/prepare_phone_feedback.py` | `13b3a5507cf51a19d3f2eb4da170502086521830b4566bf17c9580f14c96f915` |
| `scripts/prepare_life_assets.py` | `14f21003ae2e657c4d880f22d33ef13bab0b641ab68144573be329a10f3edbf7` |

- shade只选择目标头部投影可见且在12..88%/16..78%安全区的原树冠；运行中头部出视锥则恢复表现猫原位置，不再夹到屏幕边缘。实际frame更新catVisible；beginWipe及每次ROI命中都要求可见。
- 本次发现并立即报告了筛选顺序缺陷：先写distance再检查投影，会让不可见近树排除可见远树。root已把distance写入移动到投影/安全边距全部通过后（当前191行），已读回；无产品源码由审查方修改。
- 原初遇panel改为底部compact；首次出现先隐藏面板，让真实反应先显示。Native响应后成功等待2200毫秒再显示；失败不播放成功反应。encounterPending期间停止原场景导航。
- stop先增加encounterGeneration、清计时器/导航标记，再取消未决RPC与擦拭。旧RPC的then检查generation，旧timer闭包也再检查generation，两个阶段均不能在停止后重开panel。原生场景generation进一步隔离旧WebView。
- root补充旧APK模拟器后台结果：pendingOutdoor实际取消为null，wet=true、币24、XP22保留；旧自动脚本误假定pending仍存在导致TypeError，不是产品奖励/取消失败。该证据由root保存，未计为本轮本人执行。

### 实际轻量执行（替代前一版默认ROI用例）

1. `test_wipe_input.py`现通过真实生产`frame`与model/head/proj stub建立坐标和可见性，**不直接注入catVisible、不靠默认坐标绕门控**。3项通过，最新执行0.105秒：合法可见输入达到路径/时长后完成且不自行清wet；暂停取消半途擦拭及迟到输入；不可见frame无法开始或完成擦拭。测试同时确认生产JS与generated逐字一致。
2. `test_world_response.py`扩为4项，通过0.356秒。保留原迟到/显式取消断言，新增真实generator/generated桥的初遇迟到后2200毫秒面板延迟，以及stop分别发生在RPC未返/计时器已建立时、强制迟到回调仍不重开panel。

两组共**7项轻量测试通过**；没有构建、ADB或真实触控。本轮读取范围未发现新的事务P1或二次奖励路径。微型DOM不证明真实镜头下猫的位置、事件panel不遮挡、手指命中或低端设备帧率。最终候选仍须执行全事件矩阵及修后模拟器画面验收；极端队列过载丢瞬时演出的已披露限制仍有效。
