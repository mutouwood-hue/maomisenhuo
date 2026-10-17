# 吧唧原参考覆盖与固件缺口

盘点时间：2026-10-15T13:54:17.714055+00:00。范围：完整本地参考的独立源码审查；本轮不构建、不烧录、不操作设备，不新增采集权限。

## 结论与判定口径

- 原参考有 **23 个 screen、另有 off 模式、30 个 timing、6 个 threshold、14 种上行事件、17 条语音词**。完整原始 SPEC 原样保存在 [机器可读矩阵](../firmware/spec/reference-state-matrix.json) 的 `completeReferenceSpec`，未实现要求也完整保留。
- 新主干包含 boot→pair→guide5→A/B/C、导航与摸摸/自检的源码；多数屏仅部分覆盖，11 屏缺失、语音按本轮授权边界禁用。**完整原参考验收通过数为 0**；页面可创建、图片可播放、历史报告通过，均不能替代本轮整包真机验收。
- 本轮未能重新完整读 PRD，连接器当前不可访问；已完整读 ZIP 与两同字节 HTML。父任务 fresh fetch 返回 `404 object_not_found`；本地没有完整 PRD 快照。旧版本/差异记录不能充当全文，因此跨 PRD 映射保留待补。
- 原参考要求主屏纯黑、小猫直接画黑底且无操作按钮。中间稿房间/渐变已由负责人删除显示，最终冻结scene独立读回为纯黑。源码修正不替代真屏验收。

## 来源、版本与完整阅读范围

| 本地文件 | 字节 | SHA256 |
|---|---:|---|
| `吧唧交互规范开发包.zip` | 2685315 | `e69d4bb8b116c34101fdf2af332c58cbefde4ae7428b5613c4dbc4997124aa24` |
| `吧唧渲染参考.html` | 1560500 | `352dff431d90289e278af1d09c089d8cf864ed963966c34f6badf0f60f7cdc64` |
| `吧唧渲染参考V2照抄版.html` | 1560500 | `352dff431d90289e278af1d09c089d8cf864ed963966c34f6badf0f60f7cdc64` |

ZIP 内 `badge_spec.json`：版本 **0.3.0**，SHA256 `9fc554f8f167cdbf24de9d4fb774cee72619741788c15fb7a4a5a9ccde05482f`。根两份 HTML 与 ZIP 内 HTML 字节相同；隔离读取 HTML 的 SPEC 后与 JSON 深比较相同。HTML 标题“v2 · 照抄用”不是另一份不同 SPEC 版本。

已完整读取 README、完整 SPEC、坐标/时间/事件 header、v9/v8 生成布局、HTML 全部规范文本与运行交互脚本、参考渲染器；字体/图标/音频逐项目录与字节哈希留于矩阵 `zipEntries`。ZIP 共82项（含目录），含4字体、28图标各1×/3×、5占位 WAV/数组、v9/v8模板及许可证。二进制资源盘点不表示逐帧或设备播放已验。
原模板 v9/v8 各有23个 `badge_build_*`，但无 `lv_obj_add_event_cb`，且依赖外部 cat/icon/customshape 实现；它们是布局起点。M1 应用 v9.5.0，v8 只参考。f20含 GB2312 一级字；字体 OFL1.1 及附带许可须随包保留。
HTML 内真实 `PCAT_B64`：205624 字节，SHA256 `82520ca7f00eb28f005795cc970746150d73075083d4032119d795d19c2d0b4e`。独立 `.pcat` 没有落盘不代表嵌入资产缺失。本轮只解码核验哈希，未生成资产。

PRD：标题拓麻歌子，报告版本2026-10-15 v2.1；曾记录修改时间05:53:13.233Z与10:20:43.405Z。需要已授权全文导出或既有完整 fetch 正文后补对照，不新增连接权限、不搜索别的 workspace。

## 源码版本界线

本轮早期四页 HOME/STATUS/DEVICE/TOUCH 源码 `badge_pages.c` SHA256 `9938c48eff5eb6d7a157b5c563ca7ab8137909ad862a941e3e96073d284790a4` 仅作历史基线。固件负责人已交付停止修改的 pages/scene 最终哈希，已独立读回相符；以下是冻结 source-only 快照；不能将其当作当前已烧录固件。

| 文件 | 盘点 SHA256 |
|---|---|
| `firmware/main/badge_pages.c` | `7c261dfb25295dcd519663e2ca7b5ae806d32f116a088b68d4f72f2dd751d2af` |
| `firmware/main/badge_scene.c` | `67caeb0f81ede56ca9f0b2a9119a642adefd73c9ae3b7947adee29378534c9f6` |
| `firmware/main/badge_scene.h` | `5921237a68e8a394a5205a069d7f102fbb2cad10b3d8f2806e6203c4364eb699` |
| `firmware/main/badge_gesture.c` | `a1a6eb0897a774f35886e96e0da7adc6585f6f088ed5243ef3eb34cd5cd725bd` |
| `firmware/main/badge_gesture.h` | `0f167ad1b809af0ca7d48bd10ab7cafa60a0dd5ad8008dcf9fa066a4d513db78` |
| `firmware/main/badge_state.c` | `2213d540323cec507d6532de7e078248b1d104de0998174cfa50a5377ca53481` |
| `firmware/main/badge.h` | `3bef73b259f8854da0599c3a5cbcf2ba881153735df4469e3bf3cdfc6d841998` |
| `firmware/main/badge_ble.c` | `5ec70dda848e45d27139178df315012abb7345d3a47433da903820e553a38d27` |
| `firmware/main/badge_ui_contract.h` | `a8338e96c5cdf62ba183630bdcf3eff04f4394c6c0c87098e47c738242653f8c` |
| `firmware/main/idf_component.yml` | `91b34edb60b90fb0e42be67fa63b32228b777e610d318d34e4bc82009fc4eae6` |
| `firmware/dependencies.lock` | `9784e8828862c06dd8d46bf0ba4706d3040fdbe2c0677e996f0b9d6a4ad6f25a` |

核心映射位置：`badge_pages.c` 的 `build_* / tap / swipe / tick / input_event / load_preferences / save_guide`；`badge_gesture.c` 的 begin/move/holding/end；`badge_scene.c` 的 create/play/tick/set_dimmed；`badge_state.c` 负责宠物与事件耐久，不由画面动画代替结算。若源码 hash 后续改变，需刷新该行和受影响结论。

## 全部23屏覆盖

下表“有”均为源码可见；所有项的真机验收仍待完成。`缺失`与`禁用`不从完整需求中删去。

| screen | 原规范完整流程、条件与返回 | 当前源码有 | 缺失 / 不同 |
|---|---|---|---|
| `main_a` 主表盘 A · 只有小猫 | 默认主表盘；仅猫、时间/真实蓝牙/电量、5条状态弧和条件提醒。点猫摸摸；上照料、下状态、左右循环、600ms长按语音。提醒按怪行为→生病→饱腹→精力→心情→清洁优先。 | PAGE_HOME 默认 face0；真实v1五状态/喵币/安全蓝牙图标；最终scene纯黑；猫热区 (233,262,r110)；2秒摸摸冷却、NVS成功后反应；上/下/左右/长按分流 | 时间为 --:--；无真实电量；提醒只判任意状态<30后去照料，缺优先级及清洁/生病 App 气泡；无怪行为；无完整+9漂字/五爱心/反馈环音；mood>=98本地无仅回应分支；主屏时钟仍用f20，非原n40；boot/pair标题亦非原f24 |
| `main_b` 主表盘 B · 24 小时时间环 | A 左滑进入；外圈主人24小时、内圈猫24小时、白点现在；App今日生活同源。猫 (233,245,r110)，时间底部398；主屏同一组手势。 | face1；左右循环；猫位置与时间位置切换；生活环缺数据明确提示；换表盘播放 WALK clip | 环只有空轨道，无真实日程、当前白点；无时间/电量；未上行 EVT_FACE；face 当前仅 RAM；与原真3D实时渲染不同 |
| `main_c` 主表盘 C · 时间环 + 心动 | B 左滑进入；B全部内容加今日心动时刻小爱心；左右循环。 | face2；换表盘导航；心动记录待同步提示 | 缺主人/猫时间段、当前白点及心动记录；无真实时钟/电量；未上行 EVT_FACE；face 当前仅 RAM |
| `aod` 待机常显 | play10秒空闲→comp，再30秒空闲→AOD；只静猫帧+时间，亮35%，每60000ms重画；关闭常显→off；抬起/触摸/词唤醒，第一触摸只唤醒不摸猫。 | 累计40000ms后 AOD/OFF；250ms轮询但猫动画冻结；固定显示亮度35%；首个接触 ignore_contact 消费；返回 PLAY | 无每分钟真实时钟刷新；无 IMU 唤醒；语音当前关闭；无 desk/USB/夜间模式、真实电量门控；不是参考完整功耗/分辨率实现 |
| `care_menu` 照料轮盘 | 上滑/状态提醒/命令词进入，四圆按钮 (105,322),(190,352),(276,352),(361,322) r36；顶部紧凑猫、钱数。可做→对应过程；不可做灰显具体条件；下滑返回当前表盘。 | PAGE_CARE 四个原始圆形位置和图标；顶部紧凑场景；真实币数；下滑 HOME | 四项均灰显并提示用手机，未接各过程；缺按食量/币/精力/生病/4秒冷却逐项原因；不是完成照料 |
| `care_feed` 喂食中 | feed条件 food<95 且coins>=3，进入3口进度。点碗间隔>=450ms；每口挥爪/颗粒；完成上行FEED(3)，约350ms回表盘并提示；下滑取消，未完成不扣币不加成长。 | 无对应生产状态机 | 无 PAGE_CARE_FEED、三口状态机/进度/取消/真实 FEED 上行与 ACK 结算 |
| `care_water` 喝水中 | 轮盘或命令进入；点水碗3次，间隔>=450ms；与喂食同进度/结束/返回/取消规则，无前置阻止条件。 | 无对应生产状态机 | 无 PAGE_CARE_WATER、三口状态机/取消/真实 WATER 上行与 ACK 结算 |
| `care_play` 逗猫中 | energy>=10且非生病；拖羽毛跟手/猫头跟随；速度>900px/s且间隔>700ms才扑，5扑完成；25秒未完成取消。从顶部y<60起手且dy>50下滑取消。 | 无对应生产状态机 | 无拖动/速度判定/头跟随/五扑/25秒取消/PLAY事件。HTML专用顶部取消分支未施加500ms，见差异清单，不能静默改原条件 |
| `care_sleep` 哄睡 | energy<95；月亮 (233,376,r40) 连续按1500ms进度关灯；移动>12或松手取消按住；下滑可取消照料；完成按住→sleeping。 | 无对应生产状态机 | 无按月亮1500ms状态机、进度环/移动释放取消、过程恢复 |
| `sleeping` 睡着了 | 从哄睡按住完成；画面25%压暗、Zzz；6000ms后醒来发SLEEP并回表盘结算，不把进入界面算完成。 | 无对应生产状态机 | 无 sleeping 屏、六秒过程、SLEEP事件/ACK结算/中断策略 |
| `status` 状态 | 主表盘下滑或命令进入；显示名字、成长阶段/成长、五值、币、设备状态；food/energy/mood行→回home再240ms后打开轮盘并突出对应feed/sleep/play；clean/health行→App洗澡/诊所气泡；齿轮→设置；上滑回当前表盘。 | PAGE_STATUS 真实最近确认的五值、币、离线/安全/待确认数、齿轮 SETTINGS；上滑 HOME | 无名字/成长/阶段/真实电量；行点击与快捷照料/两条 App 气泡缺失；布局字体坐标尚待四角实测 |
| `settings` 设置 | 四项：亮度45/75/100循环、唤醒词、附近发现、常显；更改 EVT_SETTING/双向同步；右滑状态；版本区域 (233,346,200x40) 连按3000ms→触摸自检。 | PAGE_SETTINGS；亮度45/75/100循环、默认75，真实BSP调用失败保留原RAM值；AOD/OFF开关；版本区静止3秒进TOUCH；右滑STATUS；新增设备/重看引导入口 | 当前亮度/常显非NVS持久且无双向SETTING同步；wake默认关且不可开，discover未实现；版本热区270x48比参考大；设置按钮/触摸反馈不同 |
| `touch_test` 触摸自检（开发用） | 版本区3秒进入；52x52 五靶中心 (113,113),(353,113),(353,353),(113,353),(233,233)；显示 clamp0..465 坐标，命中变绿；五点全命中1000ms后回 SETTINGS；右滑 SETTINGS；不得生成 PET。 | 五靶相同坐标和52尺寸；触摸坐标钳位；逐点变绿/mask；全中1000ms返回设置；右滑返回；无 badge_pet 调用 | 尚未真机验证 BSP swap0/mirrorXY1/rotation0 与实际方向；靶点命中不等同物理方向已验；手势阈值仍待真触摸边界验收 |
| `voice` 按住说话 / 唤醒后在听 | 主屏静止长按600ms或唤醒词进入；释放/静音1200ms/最长8000ms结束→thinking600ms→17条离线命令或手机自由意图；没手机仅简单命令。 | 长按进入 PAGE_VOICE；明确语音未启用/不会录音或上传；轻点/下滑/右滑返回 | 无麦克风/识别/静音检测/离线17词/手机语音/声波状态。按本轮隐私边界保持默认关闭，这是能力缺口而不是语音验收通过 |
| `meet` 遇见：附近有小猫 | 双方主动开启发现，BLE近3米；真实对方花色服饰/名字；80-80-80反馈。打招呼→有NFC用meet_tap、M1无NFC用meet_scan；忽略/30000ms回原主屏。 | 无对应生产状态机 | 无双设备发现/距离判据/对方模型/30秒流程；附近开关不可用；仅BLE手机连接不能证明遇见 |
| `meet_tap` 遇见：碰一碰确认 | 有真实外接NFC才进入；扫到不等于朋友；实际碰一碰/双方确认成功→done；取消或20000ms→主屏。M1无NFC不进初版。 | 无对应生产状态机 | 无 NFC 硬件或协议/页面；不可把点击或计时器当真实确认 |
| `meet_scan` 遇见：扫码确认（没有 NFC 时） | M1确认路线；显示设备短号+一次性20秒口令的真实QR156方形/quiet6白底黑块、临时最高亮度；对方App扫码经授权验证双方→done；取消/20秒返回并恢复亮度。 | 无对应生产状态机 | 无页面/真实QR/token验证/双方同步/临时亮度恢复；参考HTML固定图案只是示意，不可当可扫描生产码 |
| `meet_done` 遇见：成为朋友 | 真实验证成功后朋友/礼物；离线显示与补传须防重复；4000ms或任意点返回原表盘；断连后能再次发现并完成第二次。 | 无对应生产状态机 | 无朋友/礼物事件与幂等/双设备重遇见；不能以发现或假ack展示为验收 |
| `away` 生活同步：小猫在外面 | 仅授权生活同步App发来的公司/咖啡/公园粗粒度地点；不显示3D猫；叫回家1800000ms发CALL_HOME；下滑状态；主人到家自动恢复，返回遵守away覆盖。 | 无对应生产状态机 | 无授权生活同步协议/页面/叫回家定时；本轮定位默认关闭，只有模拟规划，不真实采集 |
| `lowbat` 电量不足 | 实际电量<5且无USB时停止3D与语音、保留BLE；插电后按真实条件进入桌面态；<20关唤醒词，HTML恢复>=22或USB。 | 无对应生产状态机 | 无真实电池/USB输入、低电页和优先级；不允许生成假电量或用历史硬件报告代替当前实测 |
| `boot` 开机 | 电源启动→1500ms图标标题→未配对pair/已配对当前主屏。生产需额外处理已绑定但引导未完成及坏存档，不能重建宠物覆盖旧数据。 | PAGE_BOOT 1500ms；storage_error→DEVICE；bound+guide标记→HOME/ GUIDE；否则PAIR；过渡屏接触忽略 | 物理电源/USB启动与原固件启动路径待真机；参考品牌暖爪小镇改猫咪森活，属项目命名变更；上次face没有持久恢复 |
| `pair` 配对 | 未绑定首次使用进入；App我的吧唧→添加；屏幕真实动态6位验证码，安全BLE配对+设备绑定；仅成功后进入guide，失败不可假绑定。 | PAGE_PAIR 与真实安全配对层；v.passkey六位且只在本次pairing出现；secure后明确等待真实宠物首快照；v.bound变化后 GUIDE/HOME；帮助进入DEVICE | App操作文案与原型有差；绑定与首次教学的掉电/重连必须真机测试；历史固定HTML码不可当安全实现 |
| `guide` 首次引导 | 首次配对成功后5页：轻点摸猫+9/上滑4照料/下滑状态电量/按住说话/左右换表盘；每次轻点下一页，最后返回当前主屏；以后App可重看。 | PAGE_GUIDE 五页原图标/标题；不可用能力诚实改副文案；最后一页提交 badge_ui/guide_v1 NVS后退出；保存失败不前进；设置/设备可重看 | 当前只有完成位持久，未完成重启从第1页；App重看命令缺失；参考完整能力尚未到位，副文案有声明差异；首次/重启/写失败/配对切换需真机验证 |

## 手势、互斥与全部时间阈值

| 手势 | 原条件 | 源码覆盖 / 待验边界 |
|---|---|---|
| `tap` | 持续<=300ms；整个接触最大位移<12px，释放才tap；长按/滑动不得透传tap | badge_gesture_end 以 maximum_distance_sq<144 判定；input_event 只派发一种结果；待验：300/301ms、11/12/13px、移出再回、触摸中断/indev reset、uint32 tick回绕 |
| `hold_main` | 主页静止>=600ms、最大位移<12px进入语音；只触发一次，释放不再PET | tick 中 holding + held_action；navigate终止手势；语音仅禁用说明；待验：599/600/601ms、移动12px、hold后release不pet |
| `swipe` | 终点距离>=50px、时长<=500ms；abs(dx)>abs(dy)为横向，平手归纵向；home上/下/左右分别care/status/face循环 | badge_gesture_end；swipe方法；220ms过渡中忽略新接触；待验：49/50/51px、499/500/501ms、斜线轴平手、连续快速切页、左右环绕 |
| `version_hold` | settings版本中心233,346，原热区200x40；连续静止>=3000ms进入touch_test | tick >=3000且maximum_distance_sq<144；当前热区270x48；待验：2999/3000/3001ms、框外开始、按住移动退出、释放不触发设置行 |
| `sleep_hold` | 月亮r40内按住1500ms，进度环；释放或移动>12取消；到时→sleeping，另等6000ms才完成 | 无sleep过程页；待验：1499/1500/1501ms、12/13px、松开/下滑/掉电前无奖励 |
| `bite` | feed/water 每次有效点碗间隔>=450ms；3口才完成；下滑中止无扣币/成长 | 两过程页均缺失；待验：449/450/451ms、2口取消、第3口与取消竞争、重复发送/重启ACK |
| `play_drag` | 羽毛跟手/猫头朝手；>900px/s且扑间隔>700ms，5扑完成；25000ms未完成取消 | 无play过程页；待验：900速度不扑、700间隔不扑、4扑超时、瞬间跳点/坐标钳位 |
| `play_cancel` | 起点y<60且dy>50下滑取消；HTML特判未套通用500ms，请保留歧义再决策 | 无play过程页；待验：y59/60、dy50/51、慢滑>500ms、顶部取消不得变扑 |
| `wake` | AOD/OFF首触只唤醒，不能顺带PET/换页；raise/word规范存在但当前敏感能力默认关闭 | input_event先记录waking，ignore_contact贯穿release；reset清状态；待验：首触pet热区不入队、唤醒后第二触正常、pairing/弹窗/转场时无穿透 |

通用手势按整个接触最大位移判断。长按、滑动、转场、配对遮罩、唤醒首触不得再派发摸摸。`uint32_t` 差值需跨 tick 回绕验证；坐标先钳到0..465。

| timing 原键 | 值 |
|---|---:|
| `tapMaxMs` | 300 |
| `tapMoveMax` | 12 |
| `longPressMs` | 600 |
| `swipeMinPx` | 50 |
| `swipeMaxMs` | 500 |
| `transitionMs` | 220 |
| `toastMs` | 1800 |
| `bubbleMs` | 3500 |
| `playToCompMs` | 10000 |
| `compToAodMs` | 30000 |
| `aodRedrawMs` | 60000 |
| `careCooldownMs` | 4000 |
| `petCooldownMs` | 2000 |
| `biteGapMs` | 450 |
| `voiceMaxMs` | 8000 |
| `voiceSilenceMs` | 1200 |
| `voiceThinkMs` | 600 |
| `meetTimeoutMs` | 30000 |
| `tapConfirmTimeoutMs` | 20000 |
| `meetDoneMs` | 4000 |
| `quirkMinMs` | 35000 |
| `quirkMaxMs` | 80000 |
| `quirkIdleMs` | 9000 |
| `sleepHoldMs` | 1500 |
| `sleepDemoMs` | 6000 |
| `playPounceSpeed` | 900 |
| `playPounceGapMs` | 700 |
| `playTimeoutMs` | 25000 |
| `bootMs` | 1500 |
| `callHomeMs` | 1800000 |

除 `tapMoveMax/swipeMinPx` 是像素、`playPounceSpeed` 是像素/秒，其余 timing 为毫秒。原 HTML 的3口/5扑结果后约350ms回首页、自检完成1000ms回设置、版本长按3000ms也须保留，不被通用600ms替代。

| threshold 原键 | 值 |
|---|---:|
| `lowStat` | 30 |
| `full` | 95 |
| `moodFull` | 98 |
| `minEnergyPlay` | 10 |
| `batNoWake` | 20 |
| `batCritical` | 5 |

## 五种照料与唯一结算

吧唧只做摸摸、喂食、喝水、逗猫、睡觉；洗澡、诊所、衣柜、出门、接小鱼等仍属 App。轮盘4项照料冷却4000ms，摸摸2000ms。状态必须来自真实快照，结果以上行事件交给 App 唯一结算。

| 照料 | 原数值 | 前置/完成条件 |
|---|---|---|
| `pet` 摸摸 | mood+9；成长+3；币+0 | 阻止：mood>=98：已经很开心啦；步数见过程要求 |
| `feed` 喂食 | food+25、mood+3、clean-2；成长+8；币-3 | 阻止：food>=95：吃饱了；coins<3：喵币不够；步数3 |
| `water` 喝水 | mood+3、energy+6；成长+4；币+0 | 阻止：无；步数3 |
| `play` 逗猫 | mood+12、energy-5、food-3；成长+8；币+0 | 阻止：energy<10：没力气了；sick==1：不舒服；步数5 |
| `sleep` 睡觉 | energy+35、food-4、health+2；成长+6；币+0 | 阻止：energy>=95：还不困；步数见过程要求 |

mood>=98的摸摸只回应不奖励；所有数值钳0..100。当前生产协议只有PET，手机App有这些能力不等于吧唧过程已接通。HTML本地立即改值/600ms模拟sent是演示。耐久成功的“已保存”与手机ACK“已确认”必须区分。

## 圆屏、反馈、渲染与模式要求

- 466×466、中心(233,233)、可视r233、**可见文字/按钮外框四角均在safeR212内**；212..233只放环。不可见全屏hit热区不当可见越界。副屏最多4大圆按钮、直径>=64；自检52px为开发专用。长中文、UUID、拒绝原因必须按真实字体换行后验框。
- 原色表/所有元素坐标完整存于JSON。中文界面；f16=16/22行高、f20=20/28、f24=24/32、n40=40/48。16px图标整数倍最近邻。主屏没有照料按钮；纯黑、不画方形视口、不用LVGL默认主题。
- pressed为cardHi且图标下移1px；摸摸挥爪、+9上升40px/900ms、5爱心；bubble最多280px/两行/f20/3500ms；toast y380/h40/w<=220/1800ms；alert r24/1000ms呼吸。最终toast的y380/h40/w220/1800ms已对齐，其余反馈不能以一条toast替代，长文本与截断仍待实屏。
- 提醒优先怪行为，然后sick、food、energy、mood、clean；洗澡/诊所只给App提示。怪行为随机35..80秒且主屏闲>=9秒：追尾720°/2400ms、盯空气3000ms、舔毛2400ms、惊跳两次1000ms；点中每次一次+2。当前缺失。
- 震动序列：meet80-80-80、careDone40、wake30、error20-60-20ms。无马达时边缘r227/w6/accent亮320ms+对应提示音。5音16k/16bit/mono为占位；PA GPIO46播放前开、后200ms关、重复抑制250ms、音量60%夜30%；当前未完成，不凭codec应答称喇叭通过。
- desk：USB且放平静止、466/30fps/常开，23–7时亮35%；play233/30fps/2×，10秒闲→comp466/12fps；再30秒→aod静帧/每分时钟或off。当前scene帧库回放与原实时骨骼3D不同；fallback两张图只供恢复。没有真实FPS/功耗测量，性能估算不能作验收。
- 原ref.js含PCAT骨骼/三角面/背面剔除、32行条带、16bit深度、4bpp调色板、平光LUT、RGB565脏矩形与偶数对齐CO5300通路；240MHz/20MB/s是估算模型。所有这类要求在HTML全文与SPEC矩阵保留，当前未宣称完整移植。

## 开机、重启与错误恢复

原HTML教学/配对为RAM模拟，不含生产NVS恢复方案；以下区分新增耐久设计和原规范。

| 场景 | 必须保证 | 当前源码与剩余验收 |
|---|---|---|
| `fresh` | 首次无宠物存档→boot1500→pair；真实安全配对与首快照后guide→home；不凭配对BLE连接构造宠物 | 有：PAGE_BOOT/PAGE_PAIR/PAGE_GUIDE + v.bound来源于持久首快照；待补：真机首次流程/安全配对/持久读回 |
| `guide_interrupted` | 引导中断重启不能误标已完成；选择重开或续页须明确 | 有：仅完成位 guide_v1；中断从第1页，最后NVS提交失败保留页面；待补：掉电与注入存储失败的正式验收；原HTML没持久算法，不将新增策略说原文已有 |
| `guide_finished` | 完成后重启跳过教学进入已绑定猫；重看不删除猫、不多发事件 | 有：guide_v1==1跳过；guide_review不会重存；待补：NVS读错误与旧版本升级语义；实物连续重启 |
| `face_settings` | 设备偏好/最近表盘重启行为应明确并按App设置同步 | 有：face/brightness/aod目前静态RAM默认值；待补：持久偏好、参考45/75/100与当前不同、EVT_SETTING/EVT_FACE协议 |
| `queue_restart` | 有效互动先耐久保存再回馈；离线200条满则拒绝新条保旧条；事件ID重启不重用，ACK失败不丢 | 有：badge_state保存静态saved/work与事件计数；v1pet-only；不把scene动画当ACK；待补：当前冻结UI整包与实际App/吧唧断连重启联调 |
| `bad_nvs` | 损坏或非法存档保留原数据，不格式化，不循环越界，不伪造正常猫 | 有：state边界校验/错误RAM隔离；boot storage_error→DEVICE；待补：guide偏好读取错误分类、整机恢复显示、人工导出恢复步骤 |
| `bonds` | 忘记配对仅删BLE bond；保留猫、event IDs、排队与完成教学记录 | 有：DEVICE有二次确认并调用badge_ble_clear_bonds，文案保留存档；待补：真实手机忘记设备/重新加密认证/首包与stale回读 |
| `quarantined_retry` | 被拒绝互动重试保留event IDs/原次数，不新建宠物、不双奖 | 有：设备页badge_retry_blocked提交原事件解封；待补：真实App拒绝原因/重试/重复ACK/USB断电验收 |
| `power_priority` | 低电/USB/away/voice/pair/guide/transition/睡眠竞争不误触；省电唤醒消费一次 | 有：新UI转场/配对/唤醒ignore_contact；AOD冻帧；先保存再动画；待补：真实电量/USB/IMU/away/睡眠仍未实现；供电状态优先级不能猜测 |

## 协议、外设与参考差异清单

`EVT_CARE_CANCEL.a` 原编号为feed0/water1/play2/sleep3；时间戳原单位秒，生产v1为毫秒，冷启动未知0不伪造墙钟。

原事件结构8字节小端 `u32秒 + u8 type + u8 a + i16 b`，缓冲200条；14种事件的参数原样保留在JSON。当前NDJSON v1独立契约含petId/deviceId/eventId及applied/duplicate/rejected ACK、每帧<=2048字节含LF，只支持pet。后续扩展需明确版本/兼容与幂等，不能改格式后称对上原8字节。原参考时间戳为秒，当前timestampMs为毫秒；冷启动未知用0遵守v1。
下行原要求名字/成长/阶段/病态/花色服饰/时钟/生活日程/心动/双向设置，现v1只有UUID、revision、五状态、币、更新时间，缺口须显式扩协议；粗地点不发坐标。

- **prd_missing**（blocking_source_gap）：本轮未能重新完整读PRD，连接器当前不可访问；本地无完整快照。source-manifest版本/差异摘要不是全文。
- **generated_not_product**（implementation_gap）：ZIP v9/v8各23个builder但零lv_obj_add_event_cb；外部cat/icon/customshape接口未接，存在构造函数不等于23屏功能实现。
- **wire_format**（integration_gap）：原14事件8字节小端u32秒+u8type+u8a+i16b、200缓存；生产v1为<=2048UTF8含LF的NDJSON、有petId/deviceId/eventId/ACK、只支持pet。原格式与当前协议不兼容，不能伪造其余事件。
- **downlink_gap**（integration_gap）：原型要求名字/成长/阶段/病态/花色衣服/真实时间/电量/日程/心动/设置双向；v1只有UUID/revision/5状态/coins/updatedAtMs。updatedAtMs是状态更新时间，不是可任意假装的实时墙钟。
- **simulator_ack**（test_double）：HTML applyCare立即改演示数值，emit约600ms模拟sent，不是BLE持久ACK；生产不得把播放反馈当结算成功。
- **fake_qr_pair**（test_double）：HTML演示固定配对码与固定伪随机QRM图；生产必须真实安全6码/一次性可扫描QR/验证双方，不能照抄模拟认证。
- **queue_overflow**（reference_simulator_difference）：HTML队列溢出shift最旧；生产200满拒绝新互动并保原事件更安全，保留此明确差异，不能为照抄丢耐久数据。
- **tap_motion**（reference_ambiguity）：HTML up只检查终点距离，移出又返回可tap；规范文字与当前gesture最大位移<12更严格。保留差异，不能镜像错误导致误触。
- **play_cancel_time**（reference_ambiguity）：HTML care_play顶部取消分支只判y<60、dy>50，未判500ms；通用swipe文档有500ms。当前缺play页，需冻结行为前明确。
- **aod_total**（timing_interpretation）：play10秒→comp，再30秒→AOD，即自末次交互累计40秒。off是modes独立态，不是第24个screen。
- **privacy**（authorized_scope_override）：原规范desk语音常开/唤醒词与生活同步；本轮语音、定位、环境感知、儿童信息默认关闭，仅诚实禁用/模拟规划，不采集或开放敏感权限。
- **guide_persistence**（production_extension）：HTML教学与演示配对在RAM；原规范没有耐久完成位/断电事务算法。生产新增guide_v1属于实现设计，须实测写失败/重启。
- **safe_bounds**（visual_acceptance_gap）：safeR212约束可见外框四角，不是仅中心；动态中文/UUID/长拒绝原因需实际字库测量。hit_any为不可见热区r233不构成可见元素越界。52px自检靶为开发专用例外。
- **pcat_present**（inventory_correction）：独立.pcat文件缺失不代表资产全缺；两HTML内有相同PCAT_B64，205624字节，可审计解码哈希，未在本轮生成资产。
- **render_approach**（implementation_difference）：参考为PCAT骨骼/三角形实时3D/233与466分辨率切换；当前scene为来源帧库回放，fallback旧idle/paw仅恢复显示，不等价所有动作或原渲染器实时性能。
- **black_background**（corrected_in_frozen_source_hardware_pending）：原ZIP README及SPEC强制纯黑猫直接叠底/无方形视口。初读中间稿曾有房间/渐变，负责人最终冻结版已删除显示，独立读回scene确认使用ZIP_UI_COLOR_BG；room仅保留预留描述符，不作为可见背景。该项源码修正，仍待实际屏幕验收。
- **brightness_steps**（corrected_steps_remaining_persistence_gap）：参考45/75/100循环；最终源码已修正相同三档、默认75。偏好尚未持久/同步；此项档位源码修正，待真机。
- **transition_feedback**（source_partial）：原型220ms带方向slide/cubic easeout；当前统一FADE_IN。最终toast已对齐y380/h40/w220/1800ms；bubble/pressedcard/icon1px/漂字/触觉替代音仍缺，长文本是否在40px内需实屏验收。
- **hardware_claims**（unverified_hardware）：2026-10-10上板报告/I2C列表/板卡能力仅历史资料；不证明眼前硬件方向、喇叭、IMU、电池、马达、NFC或此次新固件通过。此盘点无烧录/串口/真机测试。

外设资料仅历史：Waveshare ESP32-S3-Touch-AMOLED-1.75C；LVGL9.5.0；CST9217 0x5A、swap0/mirrorX1/mirrorY1/rotation0/clamp465；QMI8658 0x6B需单独依赖（BSP不包装）；ES8311 0x18/GPIO46通路，喇叭本体待确认；无板载马达/NFC。原文不得在大栈上放数组，200事件及渲染缓存用static/heap；遇见断连后须重新广播并连续测试两次。没有本轮电气/音频/方向实测，不将这些历史值写成当前硬件已证。

## 最终源码定位与仍需对齐的细节

- 主表盘时钟 `badge_pages.c:594` 调用 `label(...,false,...)`，实际走f20；参考要求n40。开机/配对标题 `:567/:569` 同样为f20而非f24。未知时钟占位不冒充时钟已完成。
- 设置版本长按 `:729` 当前框270×48，原200×40；3秒条件与静止限制已有。
- 额外DEVICE页顶部标题 `:644` 固定宽230/中心y56，需按真实字体与最终像素核验safeR四角，未判布局通过。
- toast `:668` 最终y380/h40/w220/1800已对齐，但当前card背景/radius16/pad8，原cardHi/radius20；长文案截断、字形和高度仍待实屏。
- `sourceEvidence`记录各screen对应函数行号及冻结pages哈希，防止后续源码变化误套此次结论。

## 后续验收计划（尚未执行）

- `source_freeze` [pending]：冻结pages/scene/gesture/state/BLE/资产SHA；编译/整包来源后再安排授权设备验收，保留原Flash备份与存档。
- `boot_pair_guide` [pending_hardware]：从真实未绑定与已绑定两条路径观察1500ms；真6码失败/成功；五页逐点；教学中/完成后重启；写失败停留；App重看缺口单列。
- `gestures` [pending_hardware]：实指tap/hold/swipe阈值两边、移出返回、快速连续/屏幕切换/唤醒/配对遮罩不穿透；3秒版本进入自检、5点颜色坐标1秒返回。
- `pages_layout` [pending_implementation_and_hardware]：23屏逐一对照原HTML开发标注与字体、色值、可见外框四角safeR212；A/B/C不同真实数据，不将空轨道当完成。
- `care_atomic` [pending_protocol_and_implementation]：五照料各前置/冷却/取消/临界完成/失败/重启；完成事件、幂等ACK和手机唯一结算；缺过程不得以手机结果替代吧唧操作。
- `feedback_animation` [pending_hardware]：原资产idle/pet/walk/attention连续帧，无missing fallback/方框/脚漂；反应与ACK不同步也不吞首爪；音/环/气泡/漂字/按下态分别核验。
- `standby` [pending_sensors_and_hardware]：10秒/再30秒/每分时钟、AOD35%/off0、首次唤醒只唤醒；USB放平desk/夜间/低电优先；测功耗和真实FPS才可下性能结论。
- `meet` [pending_implementation_and_two_devices]：双方授权发现→无NFC扫码→实际token验证/超时/取消/重复确认无重复礼物；断连重广播后连续第二次成功。
- `privacy` [pending_hardware_ui]：语音/定位/生活同步默认关闭，不申请敏感权限、不录音/上传/采集；禁用入口可返回且不生成假成功事件。
- `recovery` [pending_current_binary_hardware]：配对清除不影响存档/排队；200满保旧条；磁盘/NVS失败不ACK；坏存档保留原始数据；不同宠物/旧revision拒绝后恢复。

完成前至少需：补PRD完整正文；冻结新固件源码/资产/构建hash；冻结纯黑基线并验实际屏幕；逐项完成缺失能力或明确阶段范围；获得具体设备操作授权后才进行真机验收。此文不授予刷写、擦除存档、购买外设/服务、上线或采集权限。

机器可读矩阵同时保留完整参考SPEC、README、HTML规范文本、82项ZIP目录哈希与逐屏/手势/恢复/差异/验收记录。每个screen的`hardwareAccepted`均为false，避免把源码覆盖与真机复验混为一谈。

## 冻结与旧源比较边界

父任务另报告0.2.0 internal候选已成功构建、原分区表binary逐字节相同、未刷写；本独立审查不重建，也不将该报告充作真机验收。最终scene读回SHA67caeb0f…相较负责人上一版仅set_face拆行/返回格式调整，已完整读回。

用户正在提供旧Android/吧唧源，称原版基本复刻HTML。本文现在冻结为比较清单；旧源到达后应先逐项比较接口/资源/配对协议再选基线。本盘点不提出全面重写，不覆盖原orange_cat_pet或既有Flash备份，不对未读旧源作缺失结论。
