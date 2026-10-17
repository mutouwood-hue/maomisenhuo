# 手机雨天反馈闭环：来源核对与最小接入建议

审阅时间：2026-10-15 10:39 UTC。此文为只读源码核对及建议，未修改产品、helper、生成器或资源，未编译或运行 ADB。功能是否完成仍以后续独立验收为准。

**后续技术决定（root 2026-10-15 本轮消息）**：用户要求湿身/去重，已授权 helper 增 presentation-only 根 `wet:Boolean` 与 `observedOutdoorEvents:[id]`（最多128条），以及 `observeOutdoorEvent(candidate,token,event)`。首次已核验事件只记录事实（雨置wet=true），重复返回 `newlyObserved:false`；真实擦拭完成映射原 `rain/care` 成功候选后wet=false；取消/重启保留wet/observed，原pending奖励继续取消不发；真实bath完成清wet由Android owner负责。无新增经济/健康规则。helper及5项纯状态用例已按此决定落盘，**尚未重编/执行新增测试**，旧 `latest-report.json` 的14项结果仅适用其记录的旧源哈希。下文“当前缺口”为10:39只读快照，新字段解决湿身与出现去重基础，不代表完整动作和Native接入已验收。

## 1. 来源与范围

- PRD：[Notion「拓麻歌子」v2.1](https://app.notion.com/p/dabc209ad67f8338af9101d5810f7160)，本次 fetch 时间 `2026-10-15T10:20:54.214Z`，页面最后编辑 `2026-10-15T10:20:43.405Z`；重点核对 3.5、3.2、4.4。
- 原附件：根目录 `小橘电子宠物.html`；SHA-256 `3e1b68b6dcef89ce6003961e0abb41354785443bd0427b83ed70f7589fd8af53`。本地字节来源版本与服务器附件是否逐字节相同仍遵循 `source-manifest.md` 的限制。
- 当前工程：`LocalLifeRules.kt`、`PetStore.kt`、`MainActivity.kt`、`scripts/prepare_life_assets.py`、`scripts/prepare_prototype_assets.py`。以下“当前”指本次读取的工作区；并行开发后需重新核对。
- 用户新增明确体验：真实游戏雨事件发生后，惊觉/缩身/跑到遮蔽处；点击“擦一擦”后可见擦拭/眯眼/抖毛/放松；湿身状态与真实操作结果一致，后台和中断恢复不重播、不重复扣物品。它高于原型的现有表现要求，完整产品其余范围没有因此删除。

## 2. PRD 和原型实际已有的能力

PRD 3.5 规定：小雨使场景变暗变灰、出现雨丝与地面涟漪；猫耳压低、发抖、头顶 💧。选择避雨后雨渐停，温柔照顾后雨变小，玩水则有水花。原型并没有完整“惊觉→跑遮蔽→擦一擦→眯眼→抖毛→放松”的持久状态链；不能把这些新体验宣称为已有代码。

### 精确符号与事件

以下 script 序号从 0 计数；字符偏移基于正则提取出的 inline script 文本，不是 HTML 文件行号。

| 部位 | 精确符号/位置 | 现有职责 |
|---|---|---|
| 户外渲染器 | script 2，`function Mf({container,onEvent,onProgress,profile})`，起始字符 691701 | 实际户外 Three.js 场景；返回 `enter/setAppearance/setStage/setActive/requestSettle/state/dispose` |
| 偶遇产生 | `Mf` 内 `function G()`，约字符 705493 | 对当前 token 的字符码求和，`[butterfly,lost-pouch,rain][sum%3]` 选择一次事件；不是联网天气，也不需要定位权限 |
| 自动触发条件 | `Mf` 帧循环：`De()>7.5 && !ge && Ae.size<ee.length && G()` | 真实活动运行超过7.5秒、还没触发事件、节点尚未集齐时出现；快速集齐节点可能没有偶遇 |
| 原照顾入口 | `G()` 中 rain 选项 `care` | 原按钮“用小毯子擦干 · 健康 +3”；当前没有独立 wipe API、触摸擦拭进度或毛巾库存 |
| 通用上行 | `async function Ve(type,extra={})` | 调用 `onEvent({type,id,token,location,mode,...extra})` 并等待结果 |
| 选择上行 | `Ve('world-choice',{event:'rain',choice:'care'})` | 记录一次故事选择；`safe` 为避雨，`coins` 在雨事件中实际表示玩水，不是收费或收益 |
| 原型领域 | `vu.Le(token,event,choice)`、`vu.he(token)` | Le 暂存效果；he 在活动完成且达到最短时长后统一结算 |
| 独立天气视觉模块 | script 5，`/* 20-world.js */` 至 `/* 30-life-data.js */`，字符区间 `[18221,27102)` | 雨、光照、图标、姿态等不在 Mf 核心函数内；仅提取 Mf 不能得到完整雨表现 |
| 雨视觉启动 | `window.__pgWorldEvt(type)` | `rain` 保存光照/背景，启动视觉事件、💧与演出时钟 |
| 猫姿态 | `window.__pgWorldPose(model,cat,t,walking)` | 使用 `ear_left/ear_right/head/body`；压耳、低头、间歇抖动，care 后短暂身体旋转；walking 时直接返回 |
| 场景访问 | `window.__pgWorld={scene,cam,hemi,sun,cat,model,bf,canvas,proj,ev,...}` | 原FX通过此对象取得模型、灯光和投影；`__pgLife.worldFx.state()` 只读 type/choice/props 数 |
| 当前 Native 映射 | `MainActivity.LifeBridge.worldEvent(id,json)` | 按 type 路由 PetStore 的 collect/choose/settle；token 必须等于原生会话 token |

示意上行（`id` 为 Mf 自动生成的请求标识，不是新增的稳定雨事件ID）：

```json
{"type":"world-choice","id":"<trip-token>:world-choice:<sequence>","token":"<trip-token>","location":"garden","mode":"explore","event":"rain","choice":"care"}
```

当前桥还有独立 request id（`CatNative.worldEvent(id,JSON.stringify(event))`）；Native 通过 `CatWorld.resolve(id,response)` 返回结果。request id、会话 token、持久事件ID是不同概念，不能把 JS 重启后归零的 request id 当持久幂等键。

### 原型数值、成本与结算

| 雨选择 | 结算时的实际效果 | 物品/喵币成本 |
|---|---|---|
| `safe` 避雨 | 无额外数值变化 | 0，无库存消耗 |
| `care` 温柔照顾/用小毯子擦干 | health +3、mood +4，均限制到100 | 0，无库存消耗 |
| `coins` 玩水，穿雨衣 | health −2、mood +6、clean −3 | 0，无库存消耗 |
| `coins` 玩水，无雨衣 | health −18、mood +4、clean −8、`healthIssue='sniffles'` | 0，无库存消耗 |

原型规则中并不存在“使用一次毛巾”或“扣一份擦拭道具”。不要为满足“不重复扣物品”而虚构新消耗。新操作只应复用原 `care` 的同一次效果，不再叠加第二笔 health/mood 奖励。原有活动 XP/喵币/状态结算照旧；取消出游不发放暂存故事数值和收获。

## 3. 当前持久字段和明确缺口

`LocalLifeRules.initialize/validate` 目前包含：

```text
pendingOutdoor = null | {
  token, petId, mode, location, startedAtMs,
  collected: [nodeId...],
  choice: null | { event, choice, raincoat }
}
world = { completed, collected, claimedOrders, choices, lastLocation, nextSession }
healthIssue = null | sniffles | tummy
stats = { food,mood,clean,energy,health }
```

`chooseOutdoor` 只持久一次 choice，未直接修改状态数值；`settleOutdoor` 才应用数值和委托奖励，并清空 pendingOutdoor。PetStore 对候选做统一持久化，成功才更新内存及桥接结果，失败可重试。当前有事务幂等基础，但还没有：

1. **事件出现记录**：未选择前，雨已出现这一事实只有 JS 临时 `ge/ev`；没有 Native 的稳定 rain event id。
2. **湿身状态**：没有 wet/wetness；`healthIssue` 是病况，不能拿“是否感冒”代替“是否湿身”。
3. **反应与擦拭阶段**：没有 startled/sheltering/sheltered/wiping/relaxed、位置与动作进度、已播放阶段记录。
4. **新连续演出**：原FX只做暗场、雨、耳压低和抖动；没有真实寻找/跑向遮蔽物、可见毯子擦拭、眯眼和收尾放松。
5. **完整雨FX集成**：当前 `prepare_life_assets.py` 为原 bundle 前缀 + Mf/Sf 桥；没有追加 script5 的 20-world 模块。Mf 调用的 `__pgWorldEvt?.`、`__pgWorldPose?.` 是可选 hook，未定义也不会报错，因此“场景可打开”不能证明雨FX存在。
6. **后台恢复体验**：当前 `onPause` 调 `closeLife(true)` 取消会话；下次只可收起未完成活动，不会恢复雨的视觉阶段。若继续此策略，必须明确“取消出游”的语义；不能在返回时自动创建新 token 重播同一事件来冒充恢复。

### 原视觉模块不可原样复用的时序

原 `20-world.js` 使用 capture 阶段的 DOM `click` 监听 `.world-event-actions button[data-choice]`：先写 `ev.choice`、播放结果，随后 Mf 的异步选择才请求 Native。Mf 原始 G 也先写 `j`、隐藏选项框后 await。若存储失败，可能出现“看见擦干/放松但 choice 未提交”，还可能无法再次点击。

此外原FX在选项框隐藏但无 choice 的1.5秒后自动设置视觉 `safe`，4.6秒清理；这不是领域选择，也不能自动写成用户已避雨。新的实现应以 Native 保存结果驱动阶段，失败保持湿身并显示可重试状态。JS 的 cleanup、setTimeout、重新 enter 都不能变更权威湿身或发奖励。

## 4. 无冲突最小实现建议（给 root 与 Android owner）

本节是建议 schema/API，不代表已实现，也不改现有 v1 BLE 契约。

1. **从真实事件入口上报出现**：在 Mf.G 真实选中 rain 时通知 Native，生成/核验稳定ID，例如 `(petId,tripToken,'rain')`，保存出现、湿身及阶段后再启动演出。测试可控入口仅用于验收，产品路径仍必须由真实游戏事件触发；不接外部天气/环境采集。
2. **一份 Native 权威状态**：可在 pendingOutdoor 增 `rainEncounter:{eventId,phase,wet,choice,completed,actionId,progress}`；若“离开户外后仍湿身”要保留，需将同一 encounter 移到根级持久字段，避免 pendingOutdoor 清空抹掉真实结果。字段最终由 Android owner 设计，root 消费不可自行维护另一套权威 wet。
3. **事件演出与用户操作分离**：惊觉/缩身/跑到已有遮蔽物为事件反应；到达后显示“擦一擦”。这不是自动完成照料。选择避雨/玩水的原入口保留真实结果，不能把所有按钮都映射到 care。
4. **擦拭与旧 care 合并为同一次操作**：点击“擦一擦”创建/恢复同一个 actionId，进入 wiping；可见擦拭→眯眼→抖毛→放松到完成点后，Native 原子保存 `choice=care,wet=false,phase=relaxed,completed=true`。复用原 care 一次待结算效果，不扣不存在的物品，不再额外调用一遍旧 care 计奖。
5. **明确持久化先后**：状态写入失败时不标完成、不隐藏重试入口、不发送成功同步。完成成功后的重复 callback 必须返回原已完成结果，不再次 mutation。若 choice 早于完整动作提交，应区分 `careRequested` 和 `careCompleted`，不得把“点击按钮”直接当擦拭完成。
6. **按阶段恢复**：后台停止 RAF/timeout，invalidate 旧 bridge generation；回来由 Native 状态重建静态姿态与 wet。已完成的不重播；进行中的按已保存 progress 继续或稳定回到可继续点，不能重新执行惊觉/扣费/数值操作。进程重启不能使用旧单调时钟基准；恢复等待真实新操作，不能靠墙钟认为动作已完成。
7. **一次性动画的现实边界**：保存“已消费阶段”后再播可保证恢复不重播，但极端崩溃可能跳过一段；不能宣称跨崩溃视觉严格 exactly-once。恢复应优先保证状态真实、没有重复计奖与可继续操作。
8. **安全同步**：当前 BLE v1 snapshot 没有 wet/phase/choice，Android 每次成功后发送 snapshot 只能同步数值。若需吧唧展示雨及擦拭结果，必须走产品负责人审核的协议扩展及两端兼容路径；不能把本地 overlay 或日志当作湿身已同步。

## 5. 状态验收矩阵

以下均为待执行验收。独立验收者需同时观察画面、Native 持久状态（含 revision）与真实按钮结果；仅测 callback 或截图不足以通过全链路。

| 场景/初始状态 | 真实操作 | 应见反馈 | 持久状态/经济要求 | 恢复与重复要求 |
|---|---|---|---|---|
| 无雨、无旧事件 | 在真实户外推进至雨事件 | 场景暗、雨丝/涟漪，猫惊觉缩身、前往可见遮蔽物，💧 | 恰好一个eventId，wet=true；不扣物品、不提前加care数值 | 相同出现callback不再建事件/重播 |
| 雨已出现未擦 | 等待，不点按钮 | 猫保持湿身/受雨或遮蔽姿态；擦一擦可用 | wet仍true，choice未完成，不因等待变干 | 后台回来不从惊觉重播，不自动care |
| 遮蔽处wet | 点一次擦一擦并完成实际动画 | 可见擦拭、眯眼、抖毛、放松，雨和湿身变化一致 | 原子记录同一actionId完成、wet=false；原care效果仅一次待结算，无道具成本 | 重复点/重复完成callback不重复revision或奖励 |
| 擦拭中 | 中途退后台/销毁Activity | 当前动画停止；回来显示正确中间/稳定可继续态 | 不假完成；不新增新event/action | 不从惊觉开始，不靠后台时长自动完成 |
| 已擦完 | 退后台、进程结束后再打开 | 干身、放松稳定态；不完整重播擦拭 | completed与wet=false保留，无第二笔care奖励 | 旧generation callback被忽略；相同action返回已完成 |
| 保存失败（出现/擦拭完成任一步） | 模拟写失败后重试 | 明确未保存/可重试；不能伪装最终放松成功 | 权威状态保持上次已提交值，不发成功同步 | 相同ID重试可成功且恰好一次；不丢操作 |
| 雨衣/无雨衣玩水 | 分别选择玩水 | 真水花、相应受雨反馈；不能显示已擦干 | 原雨衣/无雨衣效果准确；无雨衣sniffles走真实诊所恢复 | 不把病况与wet混为一项 |
| 避雨 | 选择safe | 雨渐停、遮蔽动作，不冒用擦拭动画 | 原safe不额外加健康/心情，不扣物品 | 重复回调无第二个选择 |
| 雨care已完成、出游未完成 | 提前回家/取消 | 明确取消本趟、收获未入账 | 原活动/故事数值不结算；wet是否延续按已确认产品语义，不能静默丢失 | 重新出游是新token；旧事件/结算不可复用 |
| 节点+时长已满足、care待结算 | 点击回家结算/重复点击 | 只有一次成功结果 | health+3/mood+4仅一次，并与原活动/委托同事务；库存无额外扣除 | 重复settle拒绝或返回同结果，绝不重复收益 |
| 结算提交后桥响应丢失 | 重载WebView/重复原请求 | 展示已保存结果，不误报仍湿或再发奖 | Native为准，revision/余额/choice不重复变化 | JS根据状态对齐，不靠重放请求修复画面 |

## 6. 需要产品负责人收口的两个语义

1. 原型“提前回家取消本趟，不结算故事数值”继续有效；新湿身体验在取消出游后是否仍延续到小屋，需要明确。推荐保留视觉物理事实、保留原数值取消规则并各自记录，避免退出即可擦干的漏洞，但不能未经决定更改数值规则。
2. 本轮“擦一擦”为原care的真实演出升级，不新增消耗。若产品确实要消耗毛巾/其他库存，需要明确物品来源、初始库存、价格与失败回滚；原附件没有这些规则，不能临时补造。
