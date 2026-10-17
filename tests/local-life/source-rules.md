# 本地物品、出游与成长规则来源

来源原件：项目根 `小橘电子宠物.html`，SHA-256 `3e1b68b6dcef89ce6003961e0abb41354785443bd0427b83ed70f7589fd8af53`。本文件记录已读本地附件的实际代码；不把原型能力当作 Android、固件或真机完成证据。

## 原型到 Kotlin 的映射

原件第三段 inline script（从 0 计数为 script 2）的函数/常量：

| 原型 | 实际规则 | `LocalLifeRules` |
|---|---|---|
| `ei`、`ko` | 小鱼售 3、野花售 2、贝壳售 4、星星石售 7；初始四种库存均 0 | `items`、`initialize` |
| `vu.Te` | 只出售；数量 1～100000；库存足够；出售后喵币不可超 1000000；失败无变化 | `sell` |
| `ts`、`Wf` | 牵绳散步：顺序 3 路标，至少 12 秒，XP6/币4，无物品；探险：5 节点固定野花×2/贝壳/星石/鱼，至少 15 秒，XP8/币5；河岸钓鱼：4 鱼节点，至少 15 秒，XP8/币4 | `activities`、`nodes` |
| `vu.we/Re/Le/he/Me` | 起始健康且 energy≥12；同猫/同 token；节点不可重复；散步依序；故事一次选择；目标与时间都满足才统一结算；取消不扣费不发奖 | `begin/collect/choose/settle/cancelOutdoor` |
| `vu.he` | 结算时 energy−4（散步）/−6（其他）、food−3、mood+9；库存上限100000、累计收集/完成上限1000000、XP上限10000000 | `settleOutdoor` |
| `Xs`、`vu.E/q` | 首散步奖励8；累计野花3朵奖励10；完成钓鱼次数×4≥4奖励12；每委托仅一次 | `settleOutdoor` |
| `vu.Le` | 雨天 safe 无损；care mood+4 health+3；coins 无雨衣 mood+4 clean−8 health−18且sniffles，有雨衣 mood+6 clean−3 health−2；失物care mood+6/coins币+4；蝴蝶care mood+6/coins energy−4 mood+5；其他safe无损 | `choose/settleOutdoor`，保持原文反馈 |
| `vu.Ae/Be/ke` | 无病体检4币/有病诊疗8币；原3D检查台3步且至少1500毫秒才扣费；mood+3、XP+3、health+8/+30；清除病况；取消不扣费 | `begin/finish/cancelClinic` |
| `Vn` | 0～59幼猫、60～159少年猫、160+成年猫 | `stage` |
| `__pgTR/__pgT` | 最多互动对应性格；平手按 feed/bath/pet/play/sleep/climb/tease/drink 顺序；无记录为温柔 | `trait` |

**没有库存购买或食用 API。** 喂食直接花3币，并不消耗背包小鱼；接鱼小游戏的分数不是背包收鱼数量。不得将这两项改成虚构库存来源。原型衣柜购买/装备另由 `AppearanceCatalog` 和 PetStore 迁移，本 helper 不重复实现。

## 事务与时间边界

Helper 只修改调用方传入的候选 `JSONObject`，先克隆、验证、运算，再在成功时更新候选；不写磁盘、不读时钟、不修改 revision、不创建 journal。`Result` 给出 `ok/message/payload`。PetStore 必须持久化成功后再更新权威内存、应答渲染器并返回结果；写失败应允许相同 token 重试。

向后兼容字段：根 `inventory`、`world`、`healthIssue`、`pendingOutdoor`、`pendingClinic`。只在整块缺失时初始化，损坏的部分对象不会补零。出游和诊所不能同时存在。候选快照中的永久 `petId`、存档 revision 保持原样。

原型 session 是运行时临时对象。本次工程将 pending session 保存到候选中，以防写失败时提前消费奖励；`startedAtMs` 只供展示。`settleOutdoor(...,elapsedMs)` 和 `finishClinic(...,elapsedMs)` 必须使用原生前台会话的单调计时，不接受 JS 自报时长或系统墙钟差值。进程重启后不能凭旧时间自动领奖；Android owner 负责安全恢复交互，或用户取消后重开。onPause 结束交互，不能后台虚增进度。

`pendingOutdoor`：`token/petId/mode/location/startedAtMs/collected:[nodeId]/choice:null|{event,choice,raincoat}`。`pendingClinic`：`token/petId/startedAtMs/issue:null|sniffles|tummy/cost:4|8`。没有真实渲染器会话与步骤确认时，不应直接挂结算按钮。

## 成长毕业与家庭仍需的迁移及决策

原型自然毕业为成年时间 `adultAt` 后 **7 天**（开发全局变量可覆盖）；毕业邀请也可手动试演，幼猫默认不能邀请。育幼进行中阻止毕业；允许一次延后1天。毕业会移除原猫并加入同品种下一代、不同猫ID，继承最多互动的性格；原猫存纪念册，字数有限制的信与继承者名字保存。最多200条毕业记录。原型家庭上限6猫，NPC配对30币、健康≥65且成年、3次实际照料+60秒活跃陪伴孵化；取消退30币；联机蛋不收费且稀有后代受来源限制。

当前手机/吧唧协议绑定永久 `petId`，不同猫会安全拒绝覆盖。毕业、家庭切换、继承者新UUID、离线旧吧唧队列该如何迁移和重新绑定尚需产品及协议方案；本 helper **不会重置猫、切换UUID、伪造家庭/后代或直接调用毕业**。现有存档还需记录真实成年时点才能启动7天周期，不能从当前XP猜出历史成年时间。

## 证据

`python3 tests/local-life/run.py` 仅轻编译生产纯 Kotlin helper 与主机用例；报告保存为 `latest-report.json` 并记录生产文件 SHA-256。它不证明 Android UI、WebView、AtomicFile、BLE 或真机通过；还需要独立QA和完整应用构建。

### 雨天 presentation-only 增补（待统一重编）

用户新增真实雨天/擦拭/湿身与恢复要求后，root明确授权加入根 `wet:Boolean`（老存档整字段缺失默认false）、`observedOutdoorEvents:[id]`（整字段缺失默认空，严格唯一最多128条）。`observeOutdoorEvent(candidate,token,event)` 依照 Mf.G 的 token 字符和 `%3` 检查实际当前活动的故事，仅首次记录并对雨置wet=true；不改stats/XP/币/库存。重复ok且newlyObserved=false，不能重播cue。记录ID为petId/token/event组成的JSON元组文本，避免分隔符碰撞。

原 `rain/care` 实际操作完成并成功保存后wet=false，但health+3/mood+4仍等原活动结算；取消保留wet与观察记录，不发pending奖励。真实bath完成清wet在PetStore owner接入。所有新增值损坏（null、字符串bool、重复/过长/超量ID等）严格拒绝而非补零。未另造毛巾或消耗规则。

新增5项状态测试已落盘但按root要求未重新编译执行；旧报告14通过只适用报告所载源哈希。完整视觉阶段、后台恢复、桥响应和独立验收仍需Android/JS/QA共同完成。
