# 吧唧固件对照两份 HTML 的功能审计

审计日期：2026-10-12。范围：`D:\黑客松` 当前源码、现有主机测试、启动与运行接线；未烧写、未连接真机、未验证 App 或云端。未修改固件源码。主机回归会更新既有构建目录中的测试产物。

## 1. 验收基线与结论

- 基线：[吧唧渲染参考](<C:/Users/admin/Downloads/吧唧渲染参考.html>)。
- 增量：[吧唧触控引导与滑动动效](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html>)；冲突时以增量要求优先，例如教学顺序、2 秒开机、照料轮盘不显示猫、慢拖提交。
- **当前是“部分 UI/算法完成，但产品闭环未接通”，不是完整实现两个 HTML。**
- **不能再笼统说没有滑动动画**：自定义 press/move/release、快滑/慢拖、快照合成、竖向盖入和横向双推已进入主循环。真正问题是验收参数不一致、反馈与教学缺失，以及同步/事件/语音/遇见没有闭环。
- 优先级：P0＝阻断核心体验、数据或安全；P1＝明确验收偏差/重要功能缺失；P2＝增强、协议待确认。优先级是本次审计建议，不代表原 HTML 已确认所有扩展需求。

## 2. P0：应先修的产品与运行时断链

### F01 交互事件没有进入真实上行队列

**分类：已实现模块，但运行时未接入。** 摸猫、照料完成/取消、切表盘、改设置、唤醒等事件仅进入 FSM 的内存日志。FSM 的事件出口要求注册 sink；主程序没有调用注册接口，实际队列 push 的业务调用只有旧社交层的遇见回调。

- 证据：[事件出口与 emit](<../main/ui/badge_fsm.c#L1849-L1899>)、[主程序初始化](<../main/main.c#L619-L663>)、[社交回调 push](<../main/net/app_link.c#L85-L95>)。
- 要求：[8 字节上行、离线 200 条、连接后补传](<C:/Users/admin/Downloads/吧唧渲染参考.html#L133-L134>)。
- 影响：本地数值变了，App 却收不到对应动作，无法权威结算；队列待同步数字也不能代表用户真实互动。
- 验收：从真正 LVGL 输入完成每类动作，核对队列及手机收到的 8 字节，而不是只检查 FSM 日志。

### F02 离线队列的定时持久化和时间推进无人调用

**分类：已实现模块，但运行时未接入。** `badge_events_tick()` 推进时间并执行延迟 NVS 写入；全工程业务代码没有调用。App link poll 只 flush，不 tick。

- 证据：[队列 tick](<../main/net/badge_events.c#L552-L564>)、[poll 只 flush](<../main/net/app_link.c#L182-L190>)、[主循环](<../main/main.c#L386-L491>)。
- 影响：即使修复 F01，离线新事件仍不会按 5 秒窗口落盘；事件默认时间也不会随 uptime 正确推进。重启会丢失未保存记录，或复活之前已发送但未更新落盘的记录。
- 验收：离线操作→超过保存窗口→断电→启动→原顺序补传；发送成功后再次重启不重复。

### F03 首次配对与引导入口被开机直达主屏绕过

**分类：缺失闭环。** 开机超时无条件 home；没有已绑定/未绑定状态决定 PAIR 或主屏。PAIR 页即使人工进入，也将“任何 BLE 连接”当成配对完成；固定种子的六位码没有接入 PIN 校验和设备绑定。

- 证据：[固定配对码](<../main/ui/badge_fsm.c#L820-L853>)、[开机与配对判断](<../main/ui/badge_fsm.c#L890-L895>)、[游戏状态没有绑定字段](<../main/ui/badge_fsm.h#L37-L50>)。
- 要求：[未配对进入配对，六位码与一机一密绑定](<C:/Users/admin/Downloads/吧唧渲染参考.html#L642-L645>)、[首次配对后教学关](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html#L88-L92>)。
- 影响：新用户绕过配对和教学；BLE 连接成功不能作为设备归属认证。旧社交 HMAC 由公开设备 ID 派生，不是“一机一密”的替代，见[安全边界](<../main/net/net_social.h#L53-L88>)。
- 验收：恢复出厂→配对码→正确 App 绑定→教学；错误码/普通连接不能完成；重启保留绑定与教学完成状态。

### F04 教学关仍是五页点击翻页，不是必须操作的教学

**分类：实现落后于增量规范。** GUIDE_NEXT 只增加页码；没有轻点命中、上滑进入并返回、下滑进入并返回、换表盘并换回、按住并松手的逐步状态。

- 证据：[点击翻页逻辑](<../main/ui/badge_fsm.c#L1351-L1358>)。
- 要求：[五步教学、错误提示、循环手指、返回遮罩、跳过与重看](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html#L138-L151>)。
- 缺失：动作门禁、正确反馈、错误方向/距离/按住太短文案、5 段进度、2.4 秒手指循环、8 秒帮助、二级页遮罩、72 像素跳过热区、完成页、App 重看入口。
- 影响：用户仍可以不学会任何操作就点完引导；F03 又使该旧引导正常启动不可达。

### F05 气泡、结果 toast、+9 飘字、无马达外圈没有显示接线

**分类：已实现绘制/状态函数，但运行时不显示。** FSM 会设置 bubble/toast/ring，主程序只消费 sfx 和 haptic；UI 的 bubble_text/toast_text 只初始化和清零，没有从 FSM 赋值。float/edge 的公开触发函数也没有业务调用。

- 证据：[主循环只转发声效与 haptic](<../main/main.c#L447-L458>)、[气泡和 toast 的零值门禁](<../main/ui/badge_ui.c#L961-L1043>)、[refresh 只调用绘制](<../main/ui/badge_ui.c#L1363-L1370>)、[未接入的 float/edge 接口](<../main/ui/badge_ui.c#L1623-L1647>)。
- 要求：[摸猫小跳+2 秒心情气泡](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html#L183-L192>)、[无马达外圈+提示音](<C:/Users/admin/Downloads/吧唧渲染参考.html#L122-L125>)。
- 影响：摸猫 hop 能执行，但没有心情气泡和 +9；吃饱/币不足/玩累/取消等缺少可见原因；无马达板缺少规定的视觉反馈。
- 修复注意：不仅赋值 text ID，还需设置 label 文案、起始时间、生命周期；避免每次 refresh 重启消失计时。

### F06 主屏长按没有 150→600ms 外圈进度，移动边界不一致

**分类：缺失视觉，存在识别边界偏差。** 600ms 语音启动有实现，但无主屏进度环。现有 tick 使用 `pmoved <= 12`，移动取消使用 `>12`；新规范要求移动达到 12 即取消。

- 证据：[长按触发](<../main/ui/badge_fsm.c#L930-L942>)、[移动取消条件](<../main/ui/badge_fsm.c#L1139-L1143>)。
- 要求：[150ms 起画、r224/w6、600ms 满、移动≥12取消](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html#L125-L127>)。
- 验收：150ms 前无环；150–600 连续填充；恰好移动 12 像素时取消；手指遮挡时仍可见。

### F07 真实语音输入与自由对话没有实现

**分类：状态机演示，不是实际识别。** 硬件层仅初始化 speaker；没有麦克风采集、离线 ASR/唤醒词结果接入，`badge_fsm_voice_word()` 无业务调用。未命中且已连接时只随机取预置回复、emit EVT_VOICE_FREE，没有录音经手机上传或真实回应下行。

- 证据：[音频初始化仅播放任务](<../main/hw/badge_hw.c#L426-L480>)、[命令匹配与随机自由回复](<../main/ui/badge_fsm.c#L669-L754>)、[语音结果入口](<../main/ui/badge_fsm.c#L1826-L1839>)。
- 要求：[本机唤醒/17 个命令词，非命中经手机自由对话](<C:/Users/admin/Downloads/吧唧渲染参考.html#L121-L121>)、[语音时序](<C:/Users/admin/Downloads/吧唧渲染参考.html#L615-L617>)。
- 影响：按住可以进入“在听”页面，但说话不会驱动真实命令。1.2 秒 silence 也没有真实 VAD 活动来续期。

### F08 低电量保护只有表格/图标，没有状态控制

**分类：缺失接入。** 电量由硬件读取用于绘制；FSM 没有接收电量以控制语音或进入 lowbat。正常输入无法由 `<5%` 触发 lowbat。

- 证据：[硬件电量出口](<../main/hw/badge_hw.c#L496-L499>)、[电量只传绘制状态](<../main/ui/badge_ui.c#L645-L660>)、[主循环硬件仅传 USB/flat](<../main/main.c#L402-L408>)。
- 要求：[20% 低电门限](<C:/Users/admin/Downloads/吧唧渲染参考.html#L494-L494>)、[5% 停 3D 与语音、插电恢复的 lowbat 页面](<C:/Users/admin/Downloads/吧唧渲染参考.html#L640-L641>)。20% 阈值名为 batNoWake，是否关闭唤醒词需与产品最终确认，不把阈值名称直接等同为已明确的独立行为条款。
- 验收：模拟并实测跨 20%/5% 门限、插电恢复；PMIC 失败要明确降级，不能以显示值代替保护测试。

## 3. P1：已实现但不达标、缺少的重要能力

| 编号 | 项目/分类 | 当前偏差及影响 | 证据 |
|---|---|---|---|
| F09 | 跟手释放时长、阻尼曲线不达标 | 提交 `230+剩余px×0.35`，约230–393ms，而要求 `max(120,220×剩余距离/466)`；回弹统一170ms，不是普通180/阻尼200ms；阻尼 `28*a/(a+90)` 不是 `min(a×0.25,28)`，触感不同。 | [合成逻辑](<../main/ui/badge_ui.c#L1491-L1508>)；[要求](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html#L122-L124>) |
| F10 | 新手期完整体系缺失 | 无配对起始日、五类成功计数、3次学会/3天截止、180ms方向提示、6s空闲演示/每天6次、各二级页前3次返回闪烁。持久化模型也无这些字段。 | [状态模型](<../main/ui/badge_fsm.h#L37-L50>)、[存档](<../main/pet/badge_pet.c#L279-L300>)；[完整要求](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html#L130-L151>) |
| F11 | 表盘圆点与按钮按压缺失 | 左右拖动没有固定顶层3圆点/松手1.2s淡出；按钮触摸未将 pressed 状态传入绘制，实现不了 cardHi+缩到94%。 | [触摸只更新手指/自检](<../main/ui/badge_ui.c#L1221-L1247>)；[要求](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html#L125-L127>) |
| F12 | App下行快照无处理 | RX注册给旧 `net_social.on_frame`，只处理社交消息，未接入五项状态/成长/币/病情/名字/花色/设置/时间的下行。`badge_pet_sync` 与时间 setter 存在，但无真实同步调用。 | [RX注册](<../main/net/net_social.c#L1124-L1124>)、[社交解析](<../main/net/net_social.c#L996-L1040>)、[同步接口](<../main/pet/badge_pet.h#L84-L92>)；[要求](<C:/Users/admin/Downloads/吧唧渲染参考.html#L133-L134>) |
| F13 | 时间能走但不是当前时间 | 每次开机18:40起算；FSM时间setter无App接入，事件Unix时间setter同样没有接入。夜间亮度判断也会按演示时间执行。 | [初始化时钟](<../main/ui/badge_fsm.c#L829-L833>)、[推进](<../main/ui/badge_fsm.c#L866-L874>)、[时间setter](<../main/ui/badge_fsm.c#L979-L986>)；[每次连接同步时间](<C:/Users/admin/Downloads/吧唧渲染参考.html#L134-L134>) |
| F14 | B/C生活环、心动与离家/回家缺失 | 全天行程和6个心动时刻为硬编码演示；地点固定work；无真实App生活状态触发away，回家无30分钟窗口、地点编号固定0。 | [固定行程/心动](<../main/ui/badge_ui.c#L169-L188>)、[固定地点](<../main/main.c#L92-L105>)、[回家逻辑](<../main/ui/badge_fsm.c#L1340-L1347>)；[生活同步要求](<C:/Users/admin/Downloads/吧唧渲染参考.html#L635-L639>) |
| F15 | 遇见UI与BLE社交断开 | peer_pending仅写标志，无主循环消费；真实peer没有转换进FSM，确认接口也无UI调用。即使旧社交握手能测试，不能证明附近猫→打招呼→扫码→两机朋友页面走通。 | [回调丢弃who](<../main/net/app_link.c#L77-L95>)、[暴露但未接入的接口](<../main/net/app_link.c#L197-L224>)、[主循环](<../main/main.c#L423-L430>)；[要求](<C:/Users/admin/Downloads/吧唧渲染参考.html#L618-L634>) |
| F16 | 扫码是装饰图案不是有效QR | 固定xorshift随机矩阵+定位图形，不编码设备编号/一次性口令，不含标准QR纠错等。没有云校验结果下行，扫描页也没有最高亮度覆盖。HTML本身的绘图同样是演示，必须按文字规范补真实能力，不能照抄随机图案。 | [QR生成](<../main/ui/badge_paint.c#L1323-L1385>)、[亮度模式](<../main/ui/badge_fsm.c#L1559-L1570>)；[要求](<C:/Users/admin/Downloads/吧唧渲染参考.html#L627-L631>) |
| F17 | 可被发现设置没有控制真实无线行为 | game.discover会变，但adapter只同步breed/growth/name，不把开关传给BLE扫描/广播/近场提示。关闭后不能据此认定不可发现。 | [adapter同步](<../main/net/app_link.c#L129-L149>)；[双边discover要求](<C:/Users/admin/Downloads/吧唧渲染参考.html#L618-L619>) |
| F18 | 服饰同步与渲染缺失 | 新badge_game没有outfit字段；真实cat3d层没有对应服饰接线。旧pet_state的服饰库存并非当前UI数据模型。peer结构也没有outfit。 | [当前游戏/peer模型](<../main/ui/badge_fsm.h#L37-L50>)、[peer](<../main/ui/badge_fsm.h#L112-L118>)；[服饰选择](<C:/Users/admin/Downloads/吧唧渲染参考.html#L90-L92>)、[PCAT服饰实现](<C:/Users/admin/Downloads/吧唧渲染参考.html#L253-L256>) |
| F19 | 名字长度不一致 | HTML最多12字符；新模型只有13字节UTF-8（最多4个常见汉字），且姓名在status用f24绘制，f24不是常用3755字全集。当前固定字库测试通过不能保证任意用户名字不变方框。 | [13字节名字](<../main/ui/badge_fsm.h#L48-L48>)；[maxlength](<C:/Users/admin/Downloads/吧唧渲染参考.html#L92-L92>)、[20号扩展字库](<C:/Users/admin/Downloads/吧唧渲染参考.html#L135-L136>) |
| F20 | 音频播放规范不一致 | 每次播放固定80%，不是日间60%/夜间30%；没有同音250ms去重，播放API可连续请求。功放尾延迟需结合BSP/真机另验，不能只凭codec初始化判定。 | [播放固定音量](<../main/hw/badge_hw.c#L426-L447>)、[无去重request](<../main/hw/badge_hw.c#L551-L558>)；[要求](<C:/Users/admin/Downloads/吧唧渲染参考.html#L125-L125>) |

## 4. 性能/渲染：确定实现偏差与实测边界

### R01 UI每10ms全屏清理并失效，破坏脏矩形预算（P1）

主程序无条件每tick refresh；refresh即便没有气泡/toast，也memset整块466×466×4＝868,624字节comp缓冲并invalidate整屏。以100Hz调用预算相当于约86.9MB/s的清理写入请求；实际调用速率可能因负载下降，**不是实测吞吐**。局部face重画完成也invalidate整个canvas。

- 证据：[10ms tick](<../main/main.c#L74-L79>)、[每tick refresh](<../main/main.c#L469-L482>)、[全屏失效](<../main/ui/badge_ui.c#L1352-L1370>)。
- 影响：cat3d自己的dirty rect优化可能被UI全屏失效抵消；AOD静止也持续UI刷新。需要只在内容变化/动画活动时更新，并invalidate真实区域。

### R02 跟手首帧同步构建双屏，可能造成拖动开始停顿（P1风险）

方向确定后，同步快照source、创建preview FSM、rebuild/refresh目标、tick猫、拍目标、恢复rebuild/refresh source、再tick猫，全部在同一LVGL循环。

- 证据：[跟手begin](<../main/ui/badge_ui.c#L1407-L1457>)。
- 确定事实：没有提前缓存目标，且竖向也取source+target两张RGB565；缓存只在UI销毁释放，不是每次结束释放，见[内存生命周期](<../main/ui/badge_ui.c#L1196-L1210>)。
- 相对要求：[竖向1张/横向2张、PSRAM用完释放、拖动暂停3D](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html#L158-L173>)。
- 不直接断言FPS或卡顿幅度；需测首次滑、第二次滑、反向换目标的耗时与高水位。2张常驻也不自动意味着OOM，但偏离预算。

### R03 自适应FPS每tick被重置，PERF不是实际送屏帧率（P1）

cat layer每tick调用set_target_fps；setter同时把effective_fps重置为target；刚计算的降速下一个tick又恢复。PERF读取该变量，不计实际绘制完成帧数，也未覆盖跟手快照合成/flush/DMA。

- 证据：[每tick重设](<../main/ui/badge_cat.c#L533-L541>)、[setter和降速](<../main/ui/cat_view.c#L234-L268>)、[fps读取](<../main/ui/badge_cat.c#L558-L560>)、[PERF日志](<../main/main.c#L330-L359>)。
- 验收：[拖动/切换≥30fps](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html#L183-L189>)必须用帧完成计数、flush计时或录屏测量，不可用target=30证明。

### R04 实际渲染器不是HTML PCAT/条带方案；互动态半分辨率关闭（P1规格偏差）

真实路线：main→badge_cat→cat_view→components/cat3d。互动态want_half_res恒false，是因内存/尺寸问题主动降级，当前全466渲染。现有golden的对照是仓库自身firmware-ref，不是用户这份HTML的BadgeRenderer。

- 证据：[真实创建](<../main/main.c#L636-L654>)、[明确禁用233](<../main/ui/badge_cat.c#L185-L208>)、[实际正交投影](<../components/cat3d/src/cat3d.c#L665-L681>)、[按面平均深度排序](<../components/cat3d/src/cat3d.c#L729-L747>)、[golden对照导入自身参考](<../tools/compare-render.mjs#L1-L14>)。
- 除半分辨率外，真实实现采用正交投影和画家排序，不是参考的透视投影/条带深度缓冲；地面柔光与独立头部看向手指也未按参考实现。没有实机/逐帧证据时，不把平均深度排序风险直接写成已观察到的穿帮。
- 后续品种与对方猫也未接线：目前仅开机调用set_breed，逐帧update不读game.breed；set_peer只设置标志且无业务调用。即使未来补下行同步，画面不会自动换贴图，遇见页也不会自动使用对方花色。[开机设置](<../main/main.c#L652-L655>)、[breed/peer setter](<../main/ui/badge_cat.c#L330-L341>)、[逐帧调用](<../main/main.c#L476-L481>)。应在F12/F15修复时一起补上。
- 要求：[模式30/12fps、互动态233×2](<C:/Users/admin/Downloads/吧唧渲染参考.html#L477-L482>)、[PCAT/32行条带/16位深度/4bpp/脏矩形](<C:/Users/admin/Downloads/吧唧渲染参考.html#L168-L175>)。
- 结论：不同实现并非天然错误；若像素、延迟、内存、功耗达标，可评审批准替代。但不能把“自身参考像素一致”说成“与这份HTML一致”。需六花色/动作/相机逐帧对照，并校准性能与功耗。

## 5. P2 与协议待确认

- **反向回拉取消缺失**：release只看最终位移/总用时，不看最近80ms反向速度>0.3px/ms；拖过140后往回带但仍超门限会提交。[代码](<../main/ui/badge_fsm.c#L1182-L1191>)；[要求](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html#L101-L107>)。
- **第15种引导结束事件缺失**：当前事件解码上界EVT_SETTING；新增结束事件的类型/参数/重传契约需要与App确认。[解码](<../main/net/badge_events.c#L236-L249>)；[建议事件](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html#L175-L179>)。这项在HTML标待确认，不应直接说破坏已确认协议。
- **IMU只用z轴判断flat/lift**：抬起接入已有，但未证明“放平且静止”；倾斜视差/摇一摇没有接入。[IMU poll](<../main/hw/badge_hw.c#L501-L529>)；[参考说明](<C:/Users/admin/Downloads/吧唧渲染参考.html#L129-L129>)。摇动的具体动作门限仍需产品定义。
- **广播成长阶段沿用旧阈值**：增长86在当前UI是少年，旧广告xp阈值可能仍显示幼猫；adapter自己记录了该差异。[已知偏差](<../main/net/app_link.c#L27-L35>)。

## 6. 已有实现：不要重复重写

以下是代码路径与单测层面的已有能力，不代表实机全面通过：

- 自定义触控事件→FSM，不依赖LVGL单个GESTURE事件；坐标0–465钳位、明确镜像配置。[输入](<../main/main.c#L263-L310>)、[BSP配置](<../main/main.c#L552-L558>)。
- 主表盘四向导航、A/B/C循环；50px/500ms快滑与140px不限时慢拖。[识别](<../main/ui/badge_fsm.c#L1182-L1191>)。
- 跟手快照、竖向固定底帧淡出/目标盖入、横向双推；切换期暂停常规cat tick。[真实主循环接入](<../main/main.c#L469-L482>)。
- 纯黑开机爪印/暖爪小镇/2000ms；主A代码时间与五状态弧；摸猫420ms小跳。
- 照料轮盘/状态/设置已配置无猫，照料按钮已调整至中部；不能因为旧HTML仍带cat配置就退回旧效果。
- 五种照料的算术、门限、成长/金币、分步过程，提醒优先级；已有触摸自检入口。
- 6花色的真实渲染、脏矩形算法、中文UI字体子集和常用字f20资源；喇叭播放任务、IMU和PMIC读取已有。
- 8字节事件编解码、200条环形队列、NVS模块、旧社交协议二机模拟测试已有；先接线，不需全盘重写这些模块。

## 7. 本次测试与为什么“全绿”仍不合格

执行：[现有主机套件](<../tools/run-host-tests.cmd>)，退出码0，输出`ALL HOST TESTS PASSED`。

| 覆盖模块 | 实际结果 |
|---|---|
| cat3d固定姿态golden | 10帧、自身参考总像素差0 |
| cat3d dirty | 29 checks / 0 failures |
| net proto / social | 162 / 175 checks，0 failures；social为模拟链路 |
| spec / geometry | 3328 / 1058 checks，0 failures |
| FSM | 2213 checks，0 failures |
| painter / UI plan | 873 / 2932 checks，0 failures |
| assets / events / pet | 736 / 612 / 228 checks，0 failures |
| font | 规定UI与固件字面量覆盖检查通过；24项informational，不是任意名字覆盖保证 |

附带异常：stderr有6条`'Phase'/'badge'/... is not recognized`，对应[07-pet脚本注释行](<../tools/suite/07-pet.cmd#L2-L9>)的批处理解析/换行问题，未阻断编译与228项测试。建议修复脚本编码/换行并保证unexpected stderr不能被总体退出0掩盖。本次不因此伪称整个套件失败。

关键盲区：

1. [“23页可达”测试](<../tests/host/test_badge_fsm.c#L344-L363>)通过`badge_fsm_go`直接进入，不验证生产启动/配对/传感器是否能到达。
2. [事件sink测试](<../tests/host/test_badge_fsm.c#L1394-L1406>)自行注册sink，生产main没有注册。
3. 模块NVS测试自行调用tick，不能证明生产main会保存。
4. UI plan/painter测试不执行真实LVGL `badge_ui_refresh`/snapshot合成和主程序调度；不能覆盖F05与R01。
5. 生成表当前一致基于仓库_ref包，不等价于补充HTML完整验收；没有5步教学、提醒生命周期、反向取消等门禁。

## 8. 推荐修复顺序与实机验收

### 第一批：接通闭环

F01/F02事件sink、tick、真实App会话与ACK/重传边界；F03绑定与首次启动；F05可见反馈；F12/F13时间/快照下行；F08低电保护。加入真正组合main+adapter+FSM+events的integration测试。

### 第二批：对齐触控体验

F04教学关、F06长按环、F09释放/阻尼、F10新手记录、F11圆点/按钮；反向回拉取消；统一把参数纳入一份可生成的motion规范，避免UI与FSM硬编码分叉。

### 第三批：补全外部能力

F07真实语音、F14行程/回家、F15/F16扫码两机确认、F17discover、F18服饰、F19名字、F20声音。没有NFC/马达本身不判缺陷，先实现HTML明确的无外设替代路径。

### 第四批：实机性能与视觉门禁

- 首次/缓存后的主屏四方向：快滑、慢拖、半程松手、反拉取消，录屏逐帧比较。
- 竖向不拖猫、二级无猫、主屏时间与弧、按钮位置/热区/安全圆、气泡和字库。
- 30fps需实际flush完成、拖动首帧耗时、P95/P99帧间隔、PSRAM/内部DMA高水位；连续滑动与换轴/回拉/输入中断。
- 恢复出厂教学故意做错、跳过、重看；前三次返回提示与第四次停止；6s演示触摸立即中断、跨日上限、第三天结束、断电保留。
- 两块板+App：第一次确认→断开→再次发现与确认；有效QR20s过期、错误口令拒绝、双方页面一致。
- 断网200事件/断电/重连补传；App数值一致；电量5%/20%、夜间亮度与音量、常显停止3D、设备真实续航。

**本报告不提供完成率百分比：HTML含演示、待确认参数与跨App/云端要求，强行按页面数折算会掩盖上述核心断链。**
