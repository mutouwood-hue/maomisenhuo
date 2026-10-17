# 完整事件视觉验收覆盖台账

盘点日期：2026-10-15。只读冻结候选和实际artifact/independent-review，未ADB、构建、改产品或改候选。本文记录已有证据，不将本次文档盘点说成新的视觉实跑。

## 版本与判定方式

- **A：冻结最终候选** `artifacts/2026-10-15-v03-candidate`，APK SHA-256 `a73f7872fa9712a57e9a1f55e728067631e2e7d193055dc743d0af5878fa32a9`。本次只读计算APK哈希，与manifest一致。
- **B：旧可见性候选** `b54c05e437314cdb7a3611c99e4f8076f58bdf67cbf909b1fd7e69e39d1d99b9`。连续rain/wipe录像及exact帧可支持B的动画结论，不能换成A通过。
- **E：更早0.3** `8e3d763d792d25b1c6ed058d20688669cd042a884edd9e460fb46ad5c731b99c`；**V2：旧0.2** `a7cead045cd729ec6fcab8d76a932f17ffa1a3bb8a3ea7f8de4ca492bda1ffb8`。不向A继承通过。
- 表格单元格填证据ID，只表示该证据明确验证的子项。**帧**=实际PNG可见姿态/布局，**序**=相应版本连续或多帧动作证据，**存**=实际状态/输入及事务，**待**=无相应A证据。某项业务通过不等于完整动作通过。
- `初始→动作→结果→持续`与`取消/失败/后台`是独立轴；没有证据的轴不以源码或unit补绿。没有一行被宣称覆盖所有轴。

### 当前同SHA证据索引

路径前缀均为冻结候选的`evidence/`，链接直达独立复核；其结论已限制于该SHA和实际截图/状态，不需要重写历史报告。

| ID | 实际证据 | 已证实范围及关键限制 |
|---|---|---|
| A-FEED | [三口喂食](../../artifacts/2026-10-15-v03-candidate/evidence/supporting/v03-final-feed/independent-review.json) | 三次真实点碗/逐口PNG，无提前奖励，回中央/吃好反馈；币40→37，XP60→68，feed+1。未独立解码该feed.mp4；不能据此声称每个过渡帧都验收。 |
| A-FUNC | [最终功能组](../../artifacts/2026-10-15-v03-candidate/evidence/android-runtime/v03-final-functional/independent-review.json) | 自然雨截图可见猫与3选择；真实擦拭wet清除、三有序节点、散步币+4/XP+6/不重复首委托；20秒接鱼实际2条、币+4/XP+11；完整state重启一致。未含全部游戏接触类型。 |
| A-CLINIC | [初次最终验收组](../../artifacts/2026-10-15-v03-candidate/evidence/android-runtime/v03-final-acceptance/independent-review.json) | 升级/启动与健康体检3工具实际1800ms按住、币−4、XP+3、清pending；health=100不证明未封顶+8或患病治疗。walk原报告失败保留，不能将其改成通过。 |
| A-BFLY | 同A-CLINIC的失败capture | butterfly:care选择在稍后截图已保存；原walk同步断言失败，无完整蝴蝶动作/结算链通过。 |
| A-CORE | [最终核心组](../../artifacts/2026-10-15-v03-candidate/evidence/android-runtime/v03-final-core/independent-review.json) | feed取消、game取消及game后台不发奖/扣费；非法名拒绝、未授权BLE搜索拒绝、强停重启完整状态一致。只按对应事件算，不外推其他照料/诊所。 |
| A-WIPE | [主动擦拭布局](../../artifacts/2026-10-15-v03-candidate/evidence/supporting/v03-final-wipe-current/independent-review.json) | 主动擦拭PNG猫眼可见、取消在右下不遮脸；wet=true/choice=null。实际布局帧，不是连续动画。 |
| A-WCANCEL | [真实取消/重试](../../artifacts/2026-10-15-v03-candidate/evidence/supporting/v03-final-wipe-actual-cancel/independent-review.json) | 真实坐标触摸取消保留wet/choice空；再次真实擦拭后wet=false/rain:care；未完成出游退出pending=null，币37/XP68及背包/衣柜/计数等不变。取消未进入无障碍树，P2未合格。 |
| B-SEQ | [旧B录像exact帧](../../artifacts/2026-10-15-v03-candidate/evidence/supporting/v03-videos/independent-review.json) | 受惊→现有树下、擦布随输入、眯眼/姿态变化只归B；B其他业务见对应旧目录，不当A通过。 |

## 1. 三事件九选择与雨衣分支

九个原选项中rain:coins按有/无雨衣拆为两个结果，故10行。结果数值保持原规则；wet是新增表现事实，健康效果到活动结算。来源详见[源规则](../local-life/source-rules.md)及[事件清单](../feedback-review/event-coverage.md)。

| 分支 | 初始反应 | 选择/动作 | 结果与持续 | 取消 | 失败/后台 | 下一项必须取证 |
|---|---|---|---|---|---|---|
| butterfly:care 陪观察 | 待A动态证据 | A-BFLY仅choice存；动作待 | 待A结算/持久 | 待 | 待 | 真实watch和观察后神态、mood+6仅settle、完成返回 |
| butterfly:safe 安静绕过 | 待 | 待 | 待 | 待 | 待 | 绕开与care/追蝶能区分；无故事加减 |
| butterfly:coins 追蝶 | 待 | 待 | 待 | 待 | 待 | 实际扑追、energy−4/mood+5，不能冒金币 |
| lost-pouch:care 帮找失主 | 待 | 待 | 待 | 待 | 待 | 嗅看/引导/找人语义与直接交还区分，mood+6 |
| lost-pouch:safe 留原处 | 待 | 待 | 待 | 待 | 待 | 原处留物/继续，无交还/感谢币 |
| lost-pouch:coins 送还感谢 | 待 | 待 | 待 | 待 | 待 | 真实送还与感谢，4币只结算到账 |
| rain:safe 避雨 | A-FUNC仅初遇布局；B-SEQ动态 | 待 | 待 | 待 | 待 | 避雨保持湿身事实、无健康故事加减；原树遮蔽与雨势变化 |
| rain:care 擦干 | A-FUNC帧；B-SEQ动态 | A-WIPE帧/A-WCANCEL真实输入和存；连续动作仅B-SEQ | A-FUNC/A-WCANCEL存与回家；health封顶未证+3 | A-WCANCEL已证相应路径 | 故障/本SHA该动作后台视觉待；A-CORE不外推 | 补A受惊→移动→真实擦布→眯眼抖毛放松连续序列；低于100health后settle+3 |
| rain:coins 无雨衣玩水 | A初遇布局；后续待 | 待 | 待 | 待 | 待 | 水花兴奋后不适；结算mood+4/clean−8/health−18/sniffles；取消不生病 |
| rain:coins 有雨衣踩水 | A初遇布局；后续待 | 待 | 待 | 待 | 待 | 当前真实已购雨衣；踩水与无雨衣区别；mood+6/clean−3/health−2，不新造sniffles |

**不能汇总为“九选择视觉通过”。** 当前A仅rain:care有正向业务闭环和相应活动帧/取消重试；butterfly:care只有选择保存的局部证据；其余8个结果行无A正向闭环。A全轴完整视觉完成数仍为0/10，且这不是将已有子项通过抹掉。

## 2. 八照料与小游戏接触

| 照料 | 初始/实际动作 | 提交结果与持续 | 取消/失败/后台 | 覆盖判断及下一项 |
|---|---|---|---|---|
| feed | A-FEED三次点碗及碗边进食帧/返回；完整走近过渡待序列 | A-FEED币−3/XP+8/count+1；未提前奖励 | A-CORE feed取消；失败/后台待 | A正向子项通过；补保存故障、后台中断和恢复不重播 |
| play | A-FUNC实际接鱼、活跃计时及2条结果；所有caught/splash/miss类型未逐证 | A-FUNC币+4/XP+11、重启全state | A-CORE取消与后台通过；保存故障待 | A正向与取消/后台有证；补三接触语义和0/15分边界 |
| pet | V2 core1真实点猫呼噜；A新反馈动作待 | V2 mood+9/XP+3；A计数保留不是新pet通过 | A未测试真实BLE applied/duplicate；拒绝/失败待 | 不把V2转成A；先补手机pet，再真实设备另验 |
| sleep | V2 core2真实sleep；A新curl/醒来待 | V2 energy+35/XP+6；A未正向 | A待 | 先验证语义“休息/醒来”与持续精力，不能睡下画面却只显示已醒文案 |
| drink | 待A走近蓝碗/3次舔水/抬头 | 待 | 待 | 全链待；复用原交互，不以feed动作和改文案替代 |
| bath | 待A进盆/搓泡泡/冲水/出盆 | 待；wet=false与病况不变也待 | 待 | 全链待；不要将rain:wipe当洗澡通过 |
| climb | 待A两层跳台/悬球/返回 | 待 | 待；病/低精力预检待 | 全链待，不能只proud结尾当爬跳动作 |
| tease | 待A羽毛移动5次/扑抓 | 待 | 待；病/低精力预检待 | 全链待；与climb/play的运动语义区分 |

## 3. 诊所、衣柜、交易、成长与持续状态

| 事件/选项 | 对应A实跑已证 | 仍待验证（静态/unit不计视觉） |
|---|---|---|
| 健康体检4币 | A-CLINIC三工具实际按住/顺序、币−4/XP+3、pending清空 | 三工具身体接触过程与完成放松完整序列；未封顶health+8；失败/取消/后台/旧回调 |
| sniffles/tummy诊疗8币 | 无；健康体检不能替代 | sniffles可自然裸身雨coins结算产生，待8币治疗/health+30/清病；tummy只有读取与诊疗支持，冻结规则无当前自然产生入口，合法前置未具备。湿身独立、低币不软锁也待 |
| 普通品种6种/稀有3种 | A保留已有橘猫外观与UUID | 全部真实切换/来源拒绝、预览与提交、失败不变猫、重启不回放 |
| 普通服装6件/穿脱 | A已有bandana及衣柜升级/重启保留；V2实际购买12币不转A | 每件购买/再次装备不扣费/脱下；raincoat影响雨分支；不足币拒绝 |
| gift4件与稀有来源 | 无实际新获取/来源切换 | 来源不具备时拒绝且无成功动作；合法来源另有前置，不编造免费取得 |
| 四库存物品正向出售/数量选项 | 无A正向出售；V2仅空库存8按钮禁用 | 鱼/花/壳/石价格及余额/库存、每种数量选项、库存不足/币上限拒绝、重启一致 |
| 三户外模式/节点 | A-FUNC散步3有序节点及回家结算 | explore5节点真实拾取/入包；fish4节点真提竿；各自取消/失败/后台；场景选择不是真定位 |
| 委托3项 | A-FUNC first_walk不重复发奖；B首次walk奖励一次 | A首次奖励/花3朵/鱼4条各自满足时的反馈与一次性结算，持久去重 |
| 五愿望ready/claim | 无A实际达标领取 | 达标提示与领取分开；重复领取拒绝/存储失败无币动画；每目标具体文案 |
| XP60/160阶段变化 | A-FUNC游戏XP49→60真实跨第一阈值；A-FEED60→68不是另一次跨越 | 跨60事务有证，但独立成长动作/模型阶段变化序列未定位；159→160仍无实跑。重启/重复state不庆祝 |
| 性格/改名 | A-CORE单字符Q拒绝且原名保留 | 合法改名回应与持久；性格真实累计及平手；查看不造奖励 |
| 备份/恢复/旧档 | A-CLINIC升级完整state一致；A-FUNC/A-CORE强停重启一致 | 真正导出/恢复/损坏/verified恢复UI；湿病服装复合状态；所有一次性反馈不重播 |
| BLE/系统权限 | A-CORE未授权搜索明确拒绝/权限保持false | 真授权/配对/断线重连/applied/duplicate/reject/noACK硬件联调；不能算Android模拟器通过 |

## 4. 故障与中断跨轴总结

- 当前A真实取消只明确覆盖feed、game、雨擦拭/未完成出游退出；game有实际后台和强停恢复。不能由这些用例推出全部8照料、诊所、其他故事均已取消/后台通过。
- 存储失败/noACK/半帧/迟到/指针阈值已有host或轻量JS证据，只记在[审查报告](../feedback-review/review.md)，**不记为故障视觉通过**。故障面板、猫不能提前成功、恢复后不重播还需相同候选的真实运行取证。
- 取消按钮A真实坐标触摸通过，但无障碍XML缺失；屏幕阅读器取消未合格。极端>12种语义排队会丢弃最旧演出，真实事务保留；不得写成全负载逐事件视觉覆盖。
- PRD家庭/育幼/毕业/多猫、社交礼物、云同步与传感器等未迁移范围保持显式；本矩阵不以“当前已实现”名义删除需求。

全部历史独立复核目录清单、语义缺口和下一轮顺序见[review-notes.md](review-notes.md)。
