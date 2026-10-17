# 旧固件 UI / 教程 / 手势 / 动画只读审查

日期：2026-10-15。审查对象：`firmware-source/baji-firmware/`；交付仅本报告。未修改旧源、主工程、协议或候选，未运行包内脚本、测试或构建，未访问设备/串口。下述缺陷来自源码路径和静态数据读取，不能当作真机复现结果。

## 1. 来源与范围

| 来源 | SHA-256 / 状态 |
|---|---|
| `baji-firmware-src.zip` | `43772d2a5d14eef81988039b193e27721ebab91e9275de9d8ee24b98c8723965` |
| 根 `吧唧渲染参考.html` | `352dff431d90289e278af1d09c089d8cf864ed963966c34f6badf0f60f7cdc64` |
| 根 `吧唧渲染参考V2照抄版.html` | 与上一份逐字节相同，不能当作更新版本 |
| 根 `小橘电子宠物.html` | `3e1b68b6dcef89ce6003961e0abb41354785443bd0427b83ed70f7589fd8af53` |

主负责人已确认用户所说“修正 HTML”指手机端《小橘电子宠物》，没有新的吧唧 HTML 替换证据。因此本报告用实际可读的吧唧 HTML / ZIP 23 屏核对固件表现；旧包 README 所称《触控引导与滑动动效》属于其历史增量依据，包内未找到该 HTML，不能让历史描述自动覆盖当前需求。手机完整玩法以修正手机 HTML 为准；本审查不把云端能力列成基础 BLE 的前置条件。

重点完整读取：V2 `baji_gesture.*`、`baji_scene.*`、`baji_controller.*`、`baji_composition.h`、`baji_render.*`，并追踪 `runtime/baji_main.c`、`baji_link.c` 的入口和输入接线。读取生成资源、经典入口及引导存储只为确认来源/风险，未对整个旧包做安全或业务闭环认证。

### 两个互斥产品入口

- **默认经典入口**：`main/main.c` + `main/ui/*`，有规格驱动的 **23 屏表**，生成头标 `0.3.1`；有独立 `badge_onboard` 存储及 `cat3d` 组件。23 条定义存在，不代表每条已按当前需求接通。
- **V2 入口**：只有 `-DBAJI_V2=ON` 才由 `main/CMakeLists.txt:1–4` 整体切换到 `firmware-v2/component.cmake`。其枚举为 PAIR、GUIDE、MAIN_A/B/C、CARE、STATUS、SETTINGS、VOICE、DONE，共 **10 个**；另有低电、确认、收音指示覆盖层。
- 两个入口共用工程名 `orange_cat_pet`。不能仅凭设备 application name 推断正在运行哪一个；此报告没有建立板上镜像与本包源码的字节等价关系。
- 旧 `docs/firmware-html-audit-2026-10-12.md`、V2 README 的构建/测试数字是历史陈述。本包一些接线已比该旧审计进步，例如经典 `badge_runtime_attach/tick` 当前已接事件 sink/tick；不能把旧报告的所有缺陷照抄为当前事实。

## 2. “连接 App”退出与 START_LOCAL 精确路径

### A. 未绑定首页 `BJ_PAIR`

`baji_scene.c:11` 初始化始终进入 PAIR。`baji_render.c:94–98` 显示“连接 App / 尚未绑定 / 本地体验”。此页没有普通滑动导航出口。

**触摸本地入口**（`runtime/baji_main.c:118–128`）：

1. 源页是 `BJ_PAIR`，controller 仍有一次已按下的触摸。
2. 释放点 `x∈[100,366]`、`y∈[338,410]`；耗时 `≤300ms`；已采样最大位移平方 `<144`。
3. 先执行 `bj_controller_release()` 纳入最后的 release 坐标，再次核对最终 `max_move_sq<144`。
4. `bj_scene_start_local()` 还要求 `screen==BJ_PAIR && !authenticated`，才设置 `local_experience=true`、`tutorial_active=true`、`step=0`、`phase=DO` 并进入 GUIDE。

本地入口不需要云、不制造 authenticated。实际低电时 controller suspend 会取消触摸并拒绝该路径。

**BLE START_LOCAL**（`baji_link.c:40–44`）：20 字节旧 V2 命令的 opcode `3`、空 payload；pressed / transition / suspended / VOICE 返回 busy `3`；authenticated 返回 denied `4`；未处于 local 时调用同一个 scene 入口。已经 local 时成功无副作用，不重开教程。ACK 的状态 `0` 才是应用成功；此命令不是当前主工程的 NDJSON v1，不可混发。

**真实认证入口**（`baji_main.c:54–60` + `baji_scene.c:16–20`）：数据 view 的 authenticated 还要通过当前 generation 检查；只有 `session_valid` 对应的 authenticated 且当前 PAIR，才调用 owner_verified 进入 GUIDE。普通 GAP 连接、订阅或数字码被显示，不等于已认证。

### B. 同样标题的绑定/遇见确认覆盖层

`baji_render.c:138–144,271–280` 的 `confirm_root` 也写“连接 App”，但由 `confirm_pending || meet_pending` 显示，并非 PAIR 页。输入在 `baji_main.c:77–105` 被优先截获：

- 绑定确认：按下和释放都在 `x100..366/y320..410`，challenge ID 匹配时排入真实 confirm 请求。
- 遇见确认：走独立 meet ID / 方法分支。
- pending 没有消失时，点击底部原“本地体验”位置也不会进入 START_LOCAL；不能仅凭截图标题诊断“没有本地出口”。
- UI 没有可见的“取消/返回本地体验”按钮；若底层挑战不自行结束，用户无法用普通页面手势退出覆盖层。这是需要按实际本地绑定契约补齐的恢复入口，不能用自动接受确认绕开。

**接线风险**：覆盖层出现时没有取消底层 controller 的旧 contact/motion。若主屏按住过程中 challenge 到达，后续 RELEASE 被覆盖层截获，controller 可残留 `gesture.pressed`，继续触发 hold 或令命令返回 busy。应在采用该适配层前对覆盖层入/出取消旧触摸建立回归；这里只作静态路径判断。

### C. 默认经典分支也有本地体验，门槛不同

`main/ui/badge_fsm.c:826–845` 要求非低电、PAIR、存在 onboarding 且未 bound；热区 `x133..333/y350..398`，从普通 tap 分支进入。它清空单独的 experience_onboarding，不把真实 bound 改真。经典真实认证由 `badge_fsm_binding_verified():1041` 推进，但在已读的生产 `main/` C 源中未找到该函数的外部调用者，不能称真实所有权闭环已经接通。

## 3. 首次引导：可复用的实际状态机与缺口

V2 五步是：**摸猫 → 上滑照料并下滑返回 → 下滑状态并上滑返回 → 左/右换表盘并按指定反向换回 → 按住并松手**，随后 DONE。源码为 `baji_scene.c:22–86`。

- 只允许当前步骤的正确导航；进入目标页后记录 BACK 和反向方向。
- controller 在提交动画完成时才改变真实场景；预览用副本，不提前兑现成功。
- 返回到 GUIDE 后显示成功 `900ms` 再进下一步；语音末步松手后先等 `240ms`，取消不算成功。
- GUIDE 的跳过中心 `(233,420)`、半径 `<36`；DONE 任意有效 tap 回主屏。
- 渲染有五段进度弧、“做得好”、目标页 BACK 遮罩、250ms 淡入、方向弧与箭头。

**可复用点**：纯 C 状态分层、真实目标页往返、完成/取消分离、只读帧预览、独立动画和 wall clock。这比只点五页更能教会操作，但与当前可读 HTML 的“摸猫/上/下/长按/左右，任意 tap 下一页”有顺序和规则差异；应作为明确批准的增强，不宣称逐字复原。

**不能直接当生产首次引导**：

1. `bj_scene_t` 的 local/auth/tutorial/step/phase 全在 RAM；V2 component 没有链接或调用经典 `badge_onboarding_store`，未找到 V2 教程持久化接口。重启重新 PAIR，新的认证重新 GUIDE；没有完成/跳过的耐久标记。
2. V2 没有 boot 1.5 秒分流页面；初始化直接 PAIR。
3. 电源 UNKNOWN 时 `allow_voice=false`，入口会清 hold_allowed、取消 VOICE 并清 voice_success_pending。最后一个必须 hold+release 的教程步骤无法成功，只能借跳过离开；需提供明确的关闭语音学习分支，不能假装完成真实收音。
4. 渲染没有原像素教学手势图、2.4 秒手指示范、8 秒帮助、按住150→600ms进度、错误方向/过短解释等完整辅助表现。
5. “以后在 App 里可以重看”是当前 DONE 文案；本次未确认真实手机重看入口及持久触发。

经典分支另有 bound/tutorial_done/tutorial_skipped/learned 等持久模型，boot 会按 bound/教程完成分流（FSM:1088–1096）。其 4 秒延迟存储可供设计参考，不能把它认作 V2 已接。

## 4. 手势与合成：适合提取的模块，不应整入口替换

| V2 当前源码行为 | 证据 / 核对 |
|---|---|
| 坐标钳制 0..465；12px 轴锁；全轨迹最大位移，tap `<12px/≤300ms` | `baji_gesture.c:3–45,92`；比原 HTML 只看最终距离更稳健 |
| hold600ms，达到12px取消长按；每次输入只能产生一个结果 | 同文件 tick/release；长按结束优先于普通 tap |
| 快滑 ≥50px 且≤500ms；慢拖≥140px可提交 | release:84–86；慢拖属于包内历史触控增量，当前根 HTML 只有通用快滑规范 |
| 最近80ms反向速度超过0.3px/ms取消 | release:73–86；128采样环形历史 |
| 无目标阻尼 `min(|d|×.25,28)` | offset:54–60 |
| 提交 `max(120,220×剩余距离/466)`ms；取消180ms；阻尼200ms；cubic ease-out | gesture:88–91；controller frame |
| 竖向 cover 固定源页、210px淡出；横向双页 push | `baji_composition.h`；常驻对象，不调用 snapshot |
| 低电 suspend 取消未提交导航，不把取消变成功 | `baji_controller_set_suspended`；只影响纯核心，实际停止音频/BLE仍是运行适配责任 |

**P1 接线缺陷：释放前先发照料事件**。`baji_main.c:122–127` 用尚未包含最终 release 坐标的旧 max_move_sq 判断 tap，然后直接调用 care_tap，最后才 controller_release。静态复现条件：MAIN 上在 `(233,262)` 按下，无 PRESSING 移动采样，200ms 后在 `(330,330)` 释放；旧 max_move_sq 仍为0，先命中 pet 热区排一次摸摸，随后识别器才看到大位移判滑动。若采用，必须从最终分类结果派发业务动作，而不是先猜 tap。START_LOCAL 有 release 后二次复核，不能据它推定其他动作同样安全。

其他未闭合的行为：V2 care 是五行文字热区。feed/water 按次数，play 也是 tap 累计，sleep 单 tap 即算一项；没有原要求的450ms间隔、900px/s扑击、700ms间隔、25秒取消、月亮1500ms按住/移动松手取消。不能把这些计数路径当作原交互完成。

## 5. 对原始23屏逐项盘点（V2）

“部分”仅指源码存在对应层/数据入口，不代表像素一致或已上板。

| 原屏幕 | V2 对应与缺口 |
|---|---|
| main_a | MAIN_A：黑底猫和真实下行文本；缺原五项弧、BT/电量布局、提醒/气泡/摸猫反馈链 |
| main_b | MAIN_B：有真实日期校验后的生活段环；时钟统一y72而原为y398；未完整两层环/现在白点 |
| main_c | MAIN_C：类似B；心动用`*`文字占位，非原心形图标 |
| aod | 无对应页面；power模块只有UNKNOWN/NORMAL/LOW，无10s→comp再30s→AOD/off机制 |
| care_menu | CARE：五行文字；不是原四个圆形按钮轮盘；未体现拒绝原因/完整能力条件 |
| care_feed | 无独立页；共享行计数，不等于3口交互 |
| care_water | 无独立页；共享行计数 |
| care_play | 无独立页；tap计数代替速度扑击 |
| care_sleep | 无独立页；tap代替月亮按住 |
| sleeping | 无独立页、睡眠表现和完成链 |
| status | STATUS：下行五项数值及PMIC电量文本；缺原条形、名字/成长/币/完整布局 |
| settings | SETTINGS：显示认证/队列/丢弃/收音状态；不是亮度/唤醒词/发现/AOD四个设置项，tap没有切换接线 |
| touch_test | 无版本区3秒入口、五靶点或自检页 |
| voice | VOICE：明确“语音未接入/松手结束”；不是ASR。独立环境收音指示不等于语音自由对话 |
| meet | 无原附近猫场景；只有待确认数据覆盖层 |
| meet_tap | 无原两机引导场景；peer input接线不是页面复原 |
| meet_scan | 无原有效扫码页面；不能拿别的确认层冒充 |
| meet_done | 无原结果/朋友呈现页 |
| away | 无真实出发/游玩/返程/回家场景；未从数值猜活动（此边界应保留） |
| lowbat | 独立low_root有原图标及电量不足文本，消费power判定；真实PMIC/恢复/LCD仍需实测 |
| boot | 无原定时boot页面；直接PAIR |
| pair | PAIR本地体验入口 + 真实challenge确认覆盖层；交互/恢复路径与原示意码页面不同 |
| guide | 有实际操作五步与DONE，但规则/顺序不同，且无耐久完成标记 |

10枚举含额外DONE，因此不能说“23屏中已完成10屏”。另外 lowbat 是独立层，既不能漏掉它，也不能把一个覆盖层算成全部低电验收。

### 几何 / 性能尚需验证

- `baji_render.c:22–26` 把几乎所有 label 外框设为440px宽，中心233。仅半宽220就大于 safeR212，严格的“文本外框四角在safe区”不满足；实际短字形未必会裁切，不能把外框计算说成已实测缺字。
- sprite 使用2倍最近邻；应保留共享脚底和原构图核对，不能因为24张不同图就称动作质量合格。
- tick10ms、常驻页、没有显式 snapshot 是源码事实；它不证明LCD 100fps、零分配、无掉帧或低耗电。LVGL解码缓存、翻页、低电恢复及字体仍需候选隔离验证。

## 6. 动画/模型资产可复用性

### V2 现成帧：可用于黑底小循环，有明确限制

| 资源 | 源尺寸/帧 | 静态数据盘点 |
|---|---|---|
| catA | 24×98×113 ARGB8888；2×显示在(150,152) | 1,063,104字节；24个帧hash均不同；265,776个像素的alpha**全为255**；原像素SHA `480bc4217409597eb2523bd04bb123135ad2d50ed3af09409503ebb949e1d38a` |
| catB | 24×87×101 ARGB8888；2×显示在(158,138) | 843,552字节；24个帧hash均不同；210,888个像素的alpha**全为255**；原像素SHA `afc59bad14a1ff0e7aca5edcb897a9016798563415a65bd62f9027bf84e5b33c` |

读取 `cat_frames.c` 的十进制像素数组得到以上数量，没有执行渲染器。旧 README“保留透明”不符合这些实际字节。黑色背景被烘进矩形；不宜直接叠彩色房间，也不能把黑像素一律挖空（会伤眼睛等真实黑色纹理）。

`baji_render.c:177–181` 统一用 `(animation_ms/90)%46` 做24帧来回 ping-pong：索引0..23再22..1，整周期4140ms。GUIDE/MAIN_A用A，MAIN_B/C用B。没有根据摸摸/走路/注意力选择独立动作。帧确实不同，但不能等同为三种真实状态动画。生成注释指向 `tools/pack_cat_frames.py`，该工具和对应原始帧输入在本包未找到；可复用现成数据，但完整再生产溯源未闭合。

生成目录另有6张466×466 RGB565静态背景/页面和2大图集。render并未使用这些静态页面做当前live主屏；不能把生成文件存在当作已还原各屏，它们也可能烘入示意数值。CMake glob收录不证明链接后仍保留。

### 经典 cat3d：更完整的真实动作候选

`components/cat3d/data/cat_model.h` 有14骨骼、56部件、448顶点、336面、460关键帧/24轨道，3段动画：idle3.2秒、walk1.0秒、paw2.4秒；纹理256×256、6个花色RGB565LE。`cat3d_set_anim()` 和以**秒**为单位的 `cat3d_set_time()` 已有接口，生成/CPU渲染工具也存在。

这是一条可以复用实际模型/骨架而非新造猫的路线。尚未证明和当前原HTML PCAT逐字段一致、实时帧预算合格或适配当前候选；原始bbmodel路径在生成器中是外部输入。因此建议先做来源/模型比对，再择优使用；不要直接整入口切换，更不能让模型替换带入旧存档/事件/云逻辑。

## 7. P0：默认经典入口的自动清 NVS，必须隔离

`main/main.c:480–484`：`nvs_flash_init()` 遇 `ESP_ERR_NVS_NO_FREE_PAGES` 或 `ESP_ERR_NVS_NEW_VERSION_FOUND` 时直接 `nvs_flash_erase()` 再初始化。这会擦整个默认NVS分区，并非只删一个坏的UI偏好；同分区里的宠物存档、离线队列、引导以及可能的radio bond/密钥均有损失风险。

V2 `runtime/baji_main.c:146` 仅 `ESP_ERROR_CHECK(nvs_flash_init())`，未见同样的自动erase；出错会失败停机/重启，也未提供可读错误页。不能把经典分支自动擦除风险误报成V2也会擦。

经典 `badge_events_clear()` / init前清除请求另会删除本模块的queue key，属于显式清队列路径；不与NVS初始化错误的全分区擦除混同。V2 update runtime还包含目标分区erase，属于另一条更新写入路径，不属于UI可复用范围；本次没有执行。

**采用前最低要求**：旧包一律只读；从隔离候选导入有用纯模块，不能直接跑默认app_main；遇NVS格式/容量错误先保留原字节并显示恢复状态；不自动清队列、不重置bond、不把旧namespace默默迁入新协议。

## 8. 推荐复用顺序与最小验收

1. **先保留基础BLE闭环**。旧V2 20字节命令和当前NDJSON契约互不兼容。START_LOCAL可作为本地UI语义参考，不能靠替换整个旧 transport 让现有手机“看起来连上”。
2. **从纯核心提取好实现**：gesture的最大轨迹/轴锁/取消、controller双页帧计划、composition与BACK反馈。对与当前HTML不一致的慢拖、反向取消、实操教程逐项标增强，按主负责人确认纳入。
3. **修适配层再接事件**：先纳入最终release坐标再分类；覆盖层出现即取消旧contact/未提交导航；取消、低电、未知电源不产生业务成功。手机真实持久确认与本地视觉反馈继续分开。
4. **教程另设耐久UI状态**：真实认证、local体验、完成/跳过分开；写失败不得假完成；未获得语音权限时提供明确关闭说明和安全退出。经典4秒存储可借鉴，不直接覆盖新存档。
5. **资产择优**：现成A/B仅作为黑底循环候选；真实模型动作/现有原PCAT导出更适合区分idle/paw/walk。不得把24帧ping-pong统一用于所有事件后称完成。
6. **隔离候选后再验收**：只读单元回归最终release误触、触摸取消/反向/12px边界、START_LOCAL重复/忙/认证边界、guide断电与写失败；再构建、真机确认safeR、字体、首次拖动、动画/解码heap、AOD与真实触摸方向。设备写入和权限须按主会话授权执行，本次均未发生。

### 当前结论

有可直接借鉴的纯手势/教学状态机/常驻合成与真实模型资源；V2不是23屏完整实现，也不是整包即可替换的完成版。阻断性问题优先是默认经典入口自动清NVS、运行适配误判tap、确认层/教程恢复，以及协议边界；原文件和历史测试数字不能替代当前候选与真机证据。
