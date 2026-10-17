# 事件视觉矩阵审查备注与下一轮顺序

日期：2026-10-15。冻结`artifacts/2026-10-15-v03-candidate`保持只读且未改动。主要台账见[coverage.md](coverage.md)。以下是证据/源码审查，不是本人新执行的视觉测试。

## 明显语义重复与缺动作

本轮从冻结`candidate-source.zip`只读提取`phone_feedback.js`核对，避免将工作区新修改冒充冻结候选行为：

1. **失物care与coins共享完全相同反馈。** 冻结脚本42行两者均为lead，文字均“陪你把小包送还”；原选择分别“帮忙找失主”和“送还小包/4币感谢”。目前没有找人/嗅查与交还/感谢的身体或道具差别。应先实际触发两分支，确认原场景是否补足；若没有，需要在新候选补不同动作/道具/结果，不能仅靠同一小点头宣称区分完成。
2. **非雨故事最终结果共用nod+通用已保存。** 35行只按sniffles区分，其余结算均“这次偶遇和照料结果已保存”。蝴蝶追逐体力下降、失物感谢币、温柔观察的不同后果主要依赖原生文本/数值。需要验收结果是否看得出具体发生什么，不能将通用存档确认替代每个分支结果。
3. **多处复用姿态是检查点，不自动判错。** milestone目标/成长同proud但模型阶段与文字不同；衣服/品种同preen但真实外观不同；safe故事共享look-back但场景不同。只有在完整链条不能辨识选择后果时才记体验缺陷，不要求每个按钮凭空造全新猫动画。
4. **结尾cue不能替代原动作。** climb的proud、tease的paw、play的pounce仅是结果演出；必须取证原跳台两层、5次羽毛、20秒接触。feed已有三口证据，不能推导蓝碗drink/浴盆bath已完成。
5. **rain仍缺最终A完整连续序列。** A主动擦拭布局、取消/重试/持久链有证；B的exact视频可核实旧受惊/移动/擦布/眯眼，但不能替A动画。眼睛可见单帧≠已看见完整眯眼→抖毛→放松。
6. **无障碍取消是已知未合格项。** A坐标触摸取消不遮脸已通过；aria-hidden使取消未进入XML。不得用坐标脚本替代可访问操作验收。
7. **tummy诊疗缺合法前置。** 冻结LocalLifeRules只在裸身rain:coins结算产生sniffles；tummy可读取/诊疗但没有当前自然触发入口。先验sniffles全链，tummy需产品确认真实来源或单列明确的fixture规则测试，不能直接改档后冒称正常玩法视觉全过。

## 验收优先次序

| 顺序 | 下一组实际输入与取证 | 必须记录的结果 |
|---|---|---|
| P0 当前候选补证 | 同A自然雨，录完整反应/安全遮蔽/真实擦拭/取消重试/后台复合状态；先完成已有缺口 | 截图与连续视频标SHA/准确时间；wet与choice/币/health时点一致；可见猫ROI；无障碍取消单列失败 |
| P1 三事件全部选择 | 自然实际会话逐个覆盖9选项；rain coins拆衣/无衣；不用注入/改档制造通过 | encounter→动作→choice提交→settle→持续。当前衣柜真实购买雨衣；裸身着凉与穿衣结果不同；每个分支至少取消一次，再代表性后台 |
| P1 其余六照料 | pet、sleep优先建立A基线，再drink/bath/climb/tease；原互动真实完成 | 动作语义/三次或五次输入、规则拒绝、完成才收费奖励；暂停取消、重开不串旧回调 |
| P1 病态诊所闭环 | 自然rain裸身结算产生sniffles，再8币三工具治疗；tummy需合法真实来源 | health不封顶时验证增量；病/湿独立；低币先接鱼/休息再诊疗，确认无软锁 |
| P2 经济成长 | 实际explore/fish取库存，四品出售、购/穿/脱衣、五愿望；补跨60独立演出证据，继续实际XP160 | 游戏49→60已有A事务证据，不能重复当缺失业务；仍补模型/动作与不重播。币/库存/计数逐项，正向和拒绝不提前播成功 |
| P2 故障视觉与长期 | 经授权在新可回滚测试环境注入保存故障；同事件重复/旧代/连续场景/后台强停；新安装和升级分别 | 具体失败反馈、无假成功、恢复可操作、单次演出不重播；物理BLE/掉电另列，不借模拟器代替 |

主机检查已有门控覆盖，下一轮不重复把unit跑绿当视觉补证。冻结候选不可修改；产品修复需新候选、新SHA及对应证据，A结果继续保留。

## 全部已找到的历史独立复核索引

下面是`tests/android-runtime/artifacts/*/independent-review.json`的完整盘点（23目录）；其中9份相应副本也保存在冻结候选内，不重复算23+9次通过。A/B/E/V2哈希见coverage；“未标”不能按文件夹名字自动归A。

| 目录 | SHA归属 | 准确用途/限制 |
|---|---|---|
| v02-manual | 未标 | 升级盘点，截图/核心UI当时尚未完成；非通过 |
| v02-root-core1 | V2 | pet真实点触/呼噜与数值；取消3路径；游戏载入黑屏不算ready |
| v02-root-core2 | V2 | 5例：游戏5条/奖励、sleep、名字/权限拒绝、重启；不向A继承 |
| v02-root-native | V2 | 12币购bandana/唯一拥有、空库存禁卖、explore取消、诊所初始与取消；未正向出售/出游结算 |
| v03-upgrade | E（reported） | 3例升级/旧字段；元数据baseline错误已披露，不冒作A |
| v03-clinic-complete | E（reported） | 健康体检3工具4币；health满不证+8/治病 |
| v03-rain | 未标 | 明确failed_visual_acceptance；只有业务观察，不能改绿 |
| v03-rain-interrupted | 未标 | 后台业务不奖/保wet、pending清；旧画面未证明视觉恢复，不向A移用 |
| v03-visible-rain | B | 自然第3会话雨，wet/无奖励，旧序列受惊/树下 |
| v03-visible-wipe-start | B | 可见猫/湿身/无选择；起始布局仍有缺陷，不是完整擦拭通过 |
| v03-visible-wipe-complete | B | 短擦动未完成，wet保留/无奖励；是负向边界而非正向完成 |
| v03-visible-wipe-real-scrub | B | 两次1400ms真实scrub、湿→干、coins/XP不变；旧exact视频 |
| v03-visible-walk-settlement-diagnostic | B | 32币/XP34/walk1/首委托一次的诊断；不是新一条独立视觉旅程 |
| v03-visible-walk-complete | B | 实际结果通过且披露首次预期错误；不抹原错误记录 |
| v03-visible-rain-closed-loop | B | 雨care/三节点回家业务链，不向A移用 |
| v03-visible-core | B | 7核心取消/拒绝/重启，非A |
| v03-videos | B | exact/dense帧与hash；旧受惊、移位、擦拭姿态；近似错误取帧被排除 |
| v03-final-acceptance | A | 3通过+1 walk测试同步失败；butterfly:care迟到capture，不改成完整pass |
| v03-final-functional | A | 3通过：rain-care/walk、实际2条game、重启；对应限制与后补证分别保留 |
| v03-final-core | A | 7通过：feed/game取消、game后台、名字/搜索拒绝、重启 |
| v03-final-feed | A | 3次实际吃口/保存/回中央；逐口snapshot非bite counter；未独立解码feed视频 |
| v03-final-wipe-current | A | 主动擦拭布局可见/不遮脸；取消缺无障碍树 |
| v03-final-wipe-actual-cancel | A | 实际触摸取消/再scrub/未完成离开不奖；无障碍仍不合格 |

## 新增证据应填什么

每份记录APK完整SHA、当前宠物与事务前后状态、输入命令/实际触点、事件token/choice、截图及视频准确时间、结果与保留失败。过程图必须来自该会话、该候选；截图/视频出自旧B就保留B标签。无需清档或伪造状态补齐矩阵；合法自然来源未准备好时标前置未满足。

当前不能给出“全事件已完成”结论：同A正向照料仅feed/play有相应实跑，健康体检不等于患病治疗；衣柜购买与sleep等旧版证据不能迁移；全故事只有rain-care有A业务闭环，所有矩阵全轴验收仍未完成。
