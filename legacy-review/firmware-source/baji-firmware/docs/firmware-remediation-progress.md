# 固件整改进度与证据

持续Goal：[完整方案](<firmware-remediation-plan.md>)。本记录区分本地回归、固件编译、实机与App，不把代码完成写成产品已验收。

## Round 1：事件链路与失败关闭（2026-10-12）

### 实际修改

- 新增[生产runtime桥接](<../main/badge_runtime.c>)与[接口](<../main/badge_runtime.h>)，由[主程序](<../main/main.c>)启动注册FSM sink；真实press/move/release与主心跳使用同一桥接。
- [事件队列](<../main/net/badge_events.c>)新增advance_clock，将输入时间推进与延迟NVS写入分离。触摸回调不写flash，主心跳即使无线未启动也执行持久化。
- [App adapter](<../main/net/app_link.c>)不再将任意BLE连接作为手机会话，也不再向social/未知连接flush用户事件。真实App认证协议尚未接入：**当前App同步失败关闭，事件保留离线，不声称联网补传完成**。
- 新增[组合测试](<../tests/host/test_badge_runtime.c>)和[自动发现测试阶段](<../tools/suite/08-runtime.cmd>)，编译真实runtime、FSM、pet、events、app_link、social及模拟NVS/radio。
- [固件CMake](<../main/CMakeLists.txt>)编入runtime，不是只有测试调用。

### 验证

- 新组合测试最终28项、0失败，包含“保存期限到达时触摸输入仍不写flash”。
- 全套主机回归job `pwsh-2527`退出码0：各既有模块与新runtime阶段通过；黄金图仅表示现有引擎自参考一致，不表示HTML视觉一致。
- 全套首次仍出现07-pet注释误执行stderr；检查原始字节确认LF换行后，将该批处理规范为CRLF。单独复跑07-pet：228项、0失败，无该stderr。
- 首次编译组合测试暴露adapter未使用ESP heap头依赖/缺stdio显式声明，已修复；关闭错误手机标志后残留unused变量，已移除并复验。
- 外部接入边界：[App会话与事件传输契约提案](<badge-app-session-contract.md>)。
- 真实固件构建job `pwsh-2530`退出码0，ESP-IDF v5.5.5/ESP32-S3：生产main/runtime/app_link/events均编译链接成功；[固件镜像](<D:/orangecat-build/orange_cat_pet.bin>)为0x2c5850字节，8MiB app分区剩余65%。仅build，无flash。
- IDF/CMake自动尝试版本探测git rev-parse/git describe（镜像不含.git，提示非仓库），未进行任何提交/分支/推送/工作树修改操作。

### 状态矩阵

| 项目 | 状态 | 未完成边界 |
|---|---|---|
| F01 FSM事件出口 | 已接生产、组合测试初版通过 | 所有动作类型/重复遇见唯一生产者仍需扩展验证 |
| F02 clock/save tick | 已接生产、组合持久化初版通过 | 真机断电恢复未验；5秒窗口内断电仍可丢新记录 |
| App/peer隔离 | 失败关闭已实现、真实adapter测试 | 未有App认证与delivery契约，故无App上行能力 |
| FX可见反馈 | 待实施 | 本轮只验证FSM产生FX，不证明UI文字上屏 |
| motion/教学/新手/性能 | 待实施 | 继续按方案推进 |
| 固件编译/实机/App | 编译通过/未验/未联调 | 不宣称整机完成 |

### 下一轮

1. 收集完整回归/固件构建结果并修复任何失败。
2. 完成FX唯一消费与UI文本/生命周期接线，补不续期、重复文案、成功才+9与无马达外圈验证。
3. 继续拆出可测试的overlay更新与脏区策略，再进入motion及首次教学状态。

## Round 2：反馈可见链路与空闲合成层（2026-10-12）

### 实际修改

- [FSM](<../main/ui/badge_fsm.c>)公开只读反馈快照，包含bubble/toast原始时间与触发代次、ring和成功pet飘字时间。重复同文案有新代次；时间0不作无反馈；没有真实haptic时开机不会误亮外圈。
- [UI](<../main/ui/badge_ui.c>)实际读取反馈快照并设置LVGL label文案；两行气泡/单行Toast省略，宽度扣内边距；成功pet触发+9，拒绝/冷却不触发；无马达ring读原始时间，不每次refresh续命。
- 新增[overlay纯策略](<../main/ui/badge_overlay.c>)与[接口](<../main/ui/badge_overlay.h>)，由生产UI和组合测试共用。无活动overlay时不清空/失效整层，结束仍进行最后擦除；初始comp像素显式透明初始化。
- 私有目标预览不消费真实pet代次，不将源屏飘字/外圈复制到目标；恢复源屏强制恢复标签文字但保留真实时间。
- active overlay阶段仍整层清空/失效；局部bbox擦除、top layer固定圆点/方向提示、真实送屏性能留后续阶段，不冒充R01全部完成。

### 验证与失败调查

- [runtime组合测试](<../tests/host/test_badge_runtime.c>)扩展至52项、0失败：真实输入成功pet、只飘一次、拒绝无飘字、t0=0、重复同文案、刷新不续期、过期最后擦除、uint32回绕、真实peer触发320ms外圈。
- 真实固件构建job `pwsh-2558`退出码0，真实FSM/UI/overlay编译链接成功，镜像0x2c5c70字节；本轮后续增加初始透明memset与主程序注释，最终精确源码编译待下轮再验。
- 全套首次job `pwsh-2557`失败：与镜像构建并行导致sdkconfig短暂消失。未删除用户配置，未忽略失败；构建结束后串行复跑job `pwsh-2564`退出码0，全套通过，runtime52项0失败，07-pet不再有注释误执行stderr。后续全套配置门禁与staging构建禁止并行。
- 没有真LVGL截图/真机录屏；label/set_long_mode由固件编译验证，布局效果仍待实机。纯策略测试不能替代真实LVGL像素检验。

### 下一步

1. 收集串行全套结果；再次编译包含透明初始化的最终源码。
2. 实现统一motion参数、反向回拉取消、长按150ms进度及12px取消，补边界用例。
3. 继续身份/绑定与存档架构，避免直接把任意BLE连接变成pair完成。

## Round 3：motion参数、反向取消与长按环（2026-10-12）

### 修改

- 新增[共用motion参数与算法](<../main/ui/badge_motion.h>)和[实现](<../main/ui/badge_motion.c>)，FSM与UI使用同一份常量/算术：fast50/500、slow140、末80ms反向>0.3、阻尼×0.25上限28、提交120–220ms、取消180ms、无目标200ms。
- [FSM](<../main/ui/badge_fsm.c>)保存有界32点时间位置记录，参照HTML的120ms保留与最近80ms速度选点（无样本时fallback）；严格反向速度优先取消，支持时间回绕/相同时间点。返回起点但中途已拖动不再误当tap。
- long press只在未锁轴且移动<12时触发；feedback导出150–600ms进度；[真实UI](<../main/ui/badge_ui.c>)绘制r224/w6，从12点顺时针填充，中途12px即停并擦除。
- UI提交/取消/阻尼时长与位移对齐；正确竖向固定底帧/横向双推不改。
- touch lost最后点也走runtime释放入口，避免绕过时钟更新（该补改发生首次构建staging后，最终精确源码下轮复验）。

### 验证

- [runtime组合测试](<../tests/host/test_badge_runtime.c>)75项0失败，覆盖11/12px、149/150ms、375ms半进度、600msvoice、49/50px、500/501ms、139/140px、>0.3与恰好0.3速度、回绕、拖180px反拉仍取消、140px慢拖提交、返回起点不奖励。
- 全套主机回归job `pwsh-2576`退出码0，包括FSM2213项与runtime75项，未出现既有失败。
- 最新真实固件构建job `pwsh-2577`退出码0，FSM/UI/overlay/motion全部真实编译链接，镜像0x2c61b0字节，8MiB分区剩余65%。包含上轮透明初始化；仅本轮staging后touch lost桥接小补改需下轮精确源码复验。串行安排，不再与配置门禁并行。

### 未完成边界

- 长按环CPU采样绘制与真实视觉/帧率未上板测量，active overlay仍整层刷新。
- motion参数当前集中到代码头/纯算法，后续需补生成/检查门禁与文档同步；不能把当前生成表自检视为HTML增量全覆盖。
- 表盘3点top layer、按钮94%按压、新手提示/首次绑定与真实教学关尚未实施。

## Round 4：固定圆点与猫帧节拍（2026-10-12）

### 完成

- [FSM反馈](<../main/ui/badge_fsm.c>)导出主屏横拖圆点状态、当前/过半目标表盘、松手1200ms驻留+300ms淡出，取消拖动也保留反馈。
- [UI](<../main/ui/badge_ui.c>)将3点创建于`lv_layer_top()`，底部y426、68×24背景栏，当前位置主色；不隶属于随动/快照屏幕，私有preview不更新它；UI销毁显式删除顶层对象。
- 新增[帧时钟](<../main/ui/badge_frame_clock.c>)与[接口](<../main/ui/badge_frame_clock.h>)，由[真实cat_view](<../main/ui/cat_view.c>)和测试共用：相同目标不重置effective FPS；保留小数帧余数；活动dirty也受帧预算；0fps只允许必要dirty静态刷新；降帧floor不会超过低目标。
- 删除cat_view重复调度实现，effective FPS仍明确定义为策略变量，不是LCD送屏测量。

### 验证

- [runtime测试](<../tests/host/test_badge_runtime.c>)87项0失败，包括圆点拖动显示/1200ms驻留/淡出，30fps在100×10ms模拟tick得到30帧而非25或100；降至28后重复设30不重置；低成本恢复29；6fps目标不被12fps floor抬高。
- 全套job `pwsh-2584`退出码0，各既有阶段与runtime87项通过。
- 最新精确源码固件job `pwsh-2588`退出码0，真实cat_view/frame_clock/UI/FSM链接成功，镜像0x2c65c0字节，app分区剩余65%；包含上一轮touch lost/runtime小补改。未烧写。

### 尚未完成

- 按钮按下cardHi/94%缩放尚未实现，因当前按钮绘制在canvas而非原生button，须统一背景/文字/图标变换并保持热区不变，不能只缩文字冒充完成。
- 顶层圆点实际录屏/安全圈视觉与帧率未上板验证；策略30帧不等于实机30fps。
- 真正配对身份、版本化引导存档与五步教学为下一重点；旧点击教学暂未改，生产App认证仍fail-closed。

## Round 5：首次启动与独立引导存档基础（2026-10-12）

### 完成

- 新增[引导领域状态](<../main/ui/badge_onboarding.h>)与[版本化编解码](<../main/ui/badge_onboarding.c>)：bound、教学完成/跳过、绑定Unix时间、五技能计数、当日演示额度与返回计数；40字节布局，校验用于检错而非认证，坏长度/版本/计数/互斥标志原子拒绝。
- 新增[NVS适配](<../main/badge_onboarding_store.c>)，单独`badge_onboard/state`保存，不扩改旧33字节petgame/save；4000ms去抖，set/commit失败保留dirty并重试。
- [生产main](<../main/main.c>)初始化加载、boot前attach、主心跳保存；未知/缺存档默认未绑定，不把旧设备状态假定为已认证。
- [FSM](<../main/ui/badge_fsm.c>)未绑定boot→PAIR，已绑定未完成教学→GUIDE，完成/跳过→主屏。普通phone连接不触发pair完成；新增`binding_verified`仅供经过外部认证的App adapter调用，目前尚无真实业务认证调用者。
- 固定PRNG假配对码替换为`--- ---`等待占位，仅接受认证器显式提供六位PIN；坏PIN不改变现有显示。
- 有onboarding的生产GUIDE禁用旧点击翻页；72px底部实际触摸skip可记录跳过并回主屏。真实五任务尚未接入，故不能宣称完整教学完成。

### 验证

- [runtime组合测试](<../tests/host/test_badge_runtime.c>)110项0失败：真实boot到PAIR、普通连接保持未绑定、明确验证结果到GUIDE、点击五次不通关、真实skip触摸、NVS保存失败重试/回读、已跳过重启回主屏、未结束重启进GUIDE、坏blob不部分更新。
- [FSM既有测试](<../tests/host/test_badge_fsm.c>)更新与旧不安全语义相关case：PIN接口输入而非固定seed、普通连接不等于配对，其他旧模块回归不删减。
- 全套job `pwsh-2596`退出码0；固件job `pwsh-2597`退出码0，新增onboarding/store、main接线、FSM真实编译链接成功，镜像0x2c6bc0字节，app分区剩余65%。未烧写。

### 明确边界

- 生产未绑定设备现在停PAIR，因无App认证契约不能真实完成绑定；占位不是可用PIN。测试注入的binding_verified不代表认证系统实现。
- 已绑定进入GUIDE后仅可skip，任务关仍待下一轮；新手提示记录已预留但业务计数尚未实现。
- 旧宠物数据不改布局，但尚无真实设备升级/恢复出厂验收；身份迁移默认未绑定需要App重新认证。

## Round 6：真实五任务教学路径（2026-10-12）

- [FSM](<../main/ui/badge_fsm.c>)加入生产教学会话：轻点小猫→上滑照料并下滑回→下滑状态并上滑回→左右换表盘并反方向回→600ms按住进入VOICE、松手到完成页、再tap回主屏。进入目标本身不通关，错方向不旁路任务。
- 目标预览查询使用教学去回程目标，错方向返回无目标阻尼，返回目标是GUIDE而非普通home。
- 第五关使用现有150–600ms真实hold反馈；松手退出VOICE完成教学，不制造ASR/云端回复；finish只在完成页最后tap持久标记。
- skip72px热区扩展到会话所有页面；replay API供后续经过验证的App命令接入，不清除已有学习记录。
- [UI](<../main/ui/badge_ui.c>)新增顶层任务指令/返程提示/skip、8秒帮助文字，读取FSM会话而非UI自行推进。
- [runtime组合测试](<../tests/host/test_badge_runtime.c>)127项0失败，新增完整五关真实press/move/release/tick，错方向不推进、目标入场不能通关、必须反向回、599/600ms、完成页tap持久化、重播回第一关。
- 全套job `pwsh-2608`退出码0；固件job `pwsh-2611`退出码0，真实FSM/UI编译链接通过，镜像0x2c7340字节，app分区剩余65%，未烧写。

### 不冒充完整视觉验收

- 目前教学基础路径已实现，但旧GUIDE静态图标背景尚在；真实猫教学展示、r222/w8五段环、2.4秒手指循环、45%黑遮罩随drag淡出、错方向/不够远/短按具体反馈和成功外圈/猫叫尚需补齐。当前8秒帮助文字提到手指，但手指视觉尚未画出，下一轮优先修复。
- 教学换表盘是预览屏往返，当前不计普通换表盘养成事件，避免教学混入真正日常行为；需对照产品确认是否教学也计技能熟练度。
- 没有真实LVGL截图和实机录屏；组合测试证明状态/事件路径，不证明像素布局。

## Round 7：教学视觉和失败反馈（2026-10-12）

- [教学视觉纯策略](<../main/ui/badge_tutorial_visual.c>)由生产UI与主机测试共用：2.4秒周期、1450ms示意移动、真实触摸立即隐藏示意、返回页45%黑遮罩、开始drag移除遮罩；完成段数由真实任务step导出。
- [真实UI](<../main/ui/badge_ui.c>)新增顶层五段r222/w8弧、半透明圆头长指示意、466圆屏黑遮罩、方向/距离/短按错误具体文案。顶层对象不进入滑动快照，销毁时显式释放，触摸透传。
- [FSM](<../main/ui/badge_fsm.c>)错误原始时间保持2秒，不随refresh续期；任务推进产生实际haptic/sfx效果供main消费；教学去回程二级屏也保持play，不被普通空闲梯度切走。
- [runtime测试](<../tests/host/test_badge_runtime.c>)137项0失败：新增周期0/1449/1450/2400边界、touch停止、drag取消遮罩、完成5段、真实错误两秒过期。
- 全套job `pwsh-2620`退出码0；最新固件job `pwsh-2622`退出码0，新增visual/FSM/UI真实编译链接成功，镜像0x2c7890字节，app分区剩余65%，未烧写。

### 仍需完成/待实机

- 手指当前为代码圆头示意而非HTML手形；未实现演示时目标画面自动露出/收回，真实拖动目标预览不受影响。
- 遮罩当前drag锁轴时立即移除，并非渐变淡出；返回提示标签当前在y320而非居中；五段环/手指真实LVGL像素仍待录屏。
- GUIDE旧静态背景尚未替换成真实猫；第一关pet_now已触发事件/float但该页猫跳动仍不可见，不能宣称教学第一关视觉全对齐。
- 第一关pet时再加通关care提示声与原pet声音同时存在，需后续合并反馈避免两个音效竞争。语音录音/真实识别仍为外部依赖。

## Round 8：新手门控、学习计数与方向/返回提示（2026-10-12）

- [onboarding领域](<../main/ui/badge_onboarding.c>)实现绑定后三天AND存在未熟练技能（每项3次饱和）、前3次二级入口计数、每日最多6次演示额度；未知时间/绑定时间0/回拨到绑定前默认不展示新手提示。
- [FSM](<../main/ui/badge_fsm.c>)成功pet/主屏swipe/600ms长按分别学习对应技能；错误/短拖/反向取消不学习。可信Unix时间仅由明确API或已验证绑定事件设置，生产普通clock默认不冒充可信时间。
- 主屏按住180ms出现未学会方向，drag后只保留实际方向，松手/long后隐藏。前3次照料/状态/设置进入，400ms后返回弧两次800ms节拍，任意touch立即停止。持久计数沿用独立onboard存档。
- [UI](<../main/ui/badge_ui.c>)真实顶层r230/w5/22度短弧和带底色方向标签，默认隐藏且不参与快照，不把普通主屏变常驻按钮。
- [runtime](<../tests/host/test_badge_runtime.c>)160项0失败，新增三天边界/AND门控、饱和计数、每日6额度及次日重置、179/180ms、drag方向、399/400ms返回提示、touch停止、第三次入口饱和。
- 首次全套job `pwsh-2635`退出码1：字体缺↑↓←。未缩小门禁，改为已覆盖方向文字“上滑/下滑/左滑/右滑”避免方框；复跑job `pwsh-2636`退出码0，所有阶段通过。与HTML箭头差异登记，后续可用矢量箭头补齐而非扩字体。
- 固件job `pwsh-2637`退出码0，新增新手领域/FSM/UI真实编译链接成功，镜像0x2c7e60字节，app分区剩余65%，未烧写。

### 明确未完成

- 6秒空闲演示及目标自动露出/收回尚未接UI调度，当前仅演示额度策略；不能宣称空闲新手提示已完成。
- App可信时间真实下行缺失，重启后方向新手提示默认不出现，待认证App调用set_unix_time；返回提示不依赖时间仍工作。
- 返程标签暂为“返回”文字，尚非HTML箭头；方向弧目前始终主色未区分拖前弱色，实际像素/布局未上板验收。

## Round 9：低电保护与宠物保存失败路径（2026-10-12）

- 以基础HTML lowbat明确“电量<5%，停止3D/语音，只保留蓝牙；插电退出”为基线。[FSM](<../main/ui/badge_fsm.c>)新增低电锁存，4%进入、5%不进入、读数无效不误触发、插电不进入；触摸/动作/按键/唤醒/普通导航不能绕过；读数回升仍锁存，插电退出。
- [硬件](<../main/hw/badge_hw.c>)新增当前合理电压成功读取有效性，PMIC不可读与演示82%不是有效读数；[main](<../main/main.c>)真实500ms轮询接入保护，LOWBAT已有has_cat=false因此真实猫层隐藏，BLE poll继续运行，保护期间音效请求禁播。
- 修复main宠物存档旧注释与代码不符：以前set/commit失败也清dirty；现在open/set/commit结果返回，只有commit成功清dirty，失败4000ms后重试，不改旧blob布局。
- [runtime测试](<../tests/host/test_badge_runtime.c>)175项0失败，新增无效4/有效5/插电4/有效4、has_cat=false、tap/act不增长、wake/button/go/tick不逃逸、回升仍锁存、插电恢复及放平desk模式。
- 全套job `pwsh-2639`退出码0；固件job `pwsh-2640`退出码0，真实FSM/hw/main/UI编译链接成功，镜像0x2c7e00字节，app分区剩余65%，未烧写。

### 未实测与后续

- 当前百分比仍为既有电压线性估算，不是经过标定SOC，真5%阈值及PMIC故障/电池缺席需实机校准；禁止把主机4%注入视为电池实验。
- 已开始的blocking codec_write不能即时中断；麦克风/ASR未接，无真实语音采集可关闭。功放播完200ms关断、60/30音量、250ms防重仍待下一阶段。
- 宠物main保存路径仅真实固件编译验证，未抽入fake NVS组合注入，后续应补与onboarding_store相同可测适配；不能声称已证明断电持久性。
- LOWBAT页面在play模式保持静态显示，haptic边缘残留与更低背光需进一步低功耗验证；3D停止是屏幕has_cat门控，不代表整机所有资源断电。

## Round 10：音效防重、日夜音量与线程安全（2026-10-12）

- [硬件音效线程](<../main/hw/badge_hw.c>)将volatile req/read-clear共享槽替换为FreeRTOS单元素overwrite队列，codec由音频线程独占；跨任务mute与volume用C11原子变量。
- 新增[音频纯策略](<../main/hw/badge_audio_policy.c>)与[接口](<../main/hw/badge_audio_policy.h>)：同一sound250ms内不重复（0时刻/回绕有效）、23:00–7:00音量30，其余60；[main](<../main/main.c>)真实tick发布FSM分钟时钟。
- 播放以320样本（16kHz约20ms）有界chunk写入，每段检查低电mute；播放结束等待200ms再close。不直接写GPIO46：已读取[BSP](<../managed_components/waveshare__esp32_s3_touch_amoled_1_75c/esp32_s3_touch_amoled_1_75c.c>)配置pa_pin与[ES8311驱动](<../managed_components/espressif__esp_codec_dev/device/es8311/es8311.c>)close/disable实现，PA由驱动唯一控制。
- [runtime策略测试](<../tests/host/test_badge_runtime.c>)188项0失败，新增249/250ms、不同sound、uint32回绕、06:59/07:00/22:59/23:00与跨日音量边界。
- 全套job `pwsh-2641`退出码0；首次固件job `pwsh-2642`退出码1：queue.h先于FreeRTOS.h加载导致类型/宏未定义连锁报错。修复包含顺序后复建job `pwsh-2643`退出码0，真实hw队列/C11原子/main链接成功，镜像0x2c7f40字节，app分区剩余65%，未烧写。

### 未冒充音频实测

- 测试覆盖共用策略，不模拟真正FreeRTOS任务/codec写入/GPIO电平；chunk写阻塞上限由实际codec驱动决定，20ms只是样本时长不是严格中断延迟。
- 200ms是写调用结束后的RTOS等待，不是示波器测得最后声波后200ms；I2S DMA排空和PA时序仍需实机。
- codec_write/volume/close错误目前未产生日志/遥测；防重时间在attempt开始记录，open失败250ms内也抑制retry，需结合真实硬件恢复策略验收。
- 麦克风、ASR、喇叭本体、声压与夜间体验仍未验证；日夜分钟默认仍由原FSM离线时钟驱动，可信时间App接入尚待。

## Round 11：宠物存档生产适配与失败组合回归（2026-10-12）

- 新增[pet_store接口](<../main/badge_pet_store.h>)和[实际NVS实现](<../main/badge_pet_store.c>)，保留`petgame/save`和既有blob格式；[main](<../main/main.c>)移除重复私有NVS/fingerprint/去抖段，实际启动load与tick poll使用新适配。
- 状态比较改为真实序列化字节memcmp，避免32位fingerprint碰撞漏存；保持首次变更起4000ms窗口，失败4000ms重试，dirty显式表示所以due==0与uint32回绕有效。load先解码到临时game，拒绝坏blob不部分更新用户对象。
- [runtime测试](<../tests/host/test_badge_runtime.c>)209项0失败，新增真实适配set失败、commit失败、失败期间又变coins、最终回读growth/coins、稳定状态不重复写、due==0时间回绕写成功、重启face回读。
- 全套job `pwsh-2646`退出码0；固件job `pwsh-2647`退出码0，真实pet_store/main编译链接通过，镜像0x2c7d60字节，app分区剩余65%，未烧写。
- 编辑辅助命令首次因Windows PowerShell不支持utf8NoBOM枚举退出1，无文件变更；随后明确UTF8无BOM写入完成迁移，生产检索确认无app_save/s_saved残留。

### 仍需实机与后续

- fake NVS证明生产代码的错误状态与重试，不证明闪存掉电事务底层；真实断电、坏namespace/版本升级仍待板测。
- main对load/poll返回暂不记录诊断，失败重试可运行但用户不知保存降级，后续加限频错误状态/诊断而非反复打印敏感宠物名称。
- 新手空闲6秒演示、按钮94%视觉、教学真实猫、真实屏幕性能证据仍未完成，Goal保持进行。

## Round 12：6秒空闲演示生产调度（2026-10-12）

- [FSM](<../main/ui/badge_fsm.c>)真实tick在主屏无触摸/非教学/非低电且可信时间有效时，空闲6000ms消费每日额度并选择未学会技能1→4；演示1450ms后结束，同次空闲一次，不重置10秒陪伴梯度；touch/key立即结束并重建空闲机会。
- [UI](<../main/ui/badge_ui.c>)实际复用顶层手指示意与技能标签，不展示教学skip或五段环；演示原始elapsed读自FSM，不refresh续期。
- [runtime](<../tests/host/test_badge_runtime.c>)217项0失败，新增5999/6000、1449/1450、同idle不重复、技能1已学后选择2、touch立即取消、每日6后拒绝。
- 全套job `pwsh-2648`退出码0；真实固件job `pwsh-2649`退出码0，实际FSM/UI演示链路编译链接成功，镜像0x2c7f70字节，app分区剩余65%，未烧写。

### 尚未完整演示验收

- 目标画面自动露出/收回仍未接快照合成；当前是真实空闲手指/标签调度，不等于HTML规定的跟手目标预览演示。
- hold技能示意目前仅静态指尖，无自动外圈填充；需要补demo渲染而不制造真实按住/事件。
- 可用认证App时间下行缺失，当前部署无法真实绑定和恢复可信新手时间，明确API测试注入不表示App端成功。
- 本轮key重建机会但raise/voice等非touch输入统一idle政策尚需检查；学习方向当前固定选首个未学会技能，不轮转已达到的日额度后再次演示。

## Round 13–14：自动目标预览与教学真实猫（2026-10-13）

- [UI](<../main/ui/badge_ui.c>)空闲演示复用私有FSM/game快照和既有cover/double-push合成；新增motion_demo，不调用真实press/release、不进入commit推断，结束/touch时撤销快照并恢复猫层。演示偏移200–700ms露出120px、停250ms、950–1450ms收回；hold纯绘制150→600ms填满，1000ms清除。演示期间保持PLAY但不更新last_input。
- [视觉策略](<../main/ui/badge_tutorial_visual.c>)新增offset/hold纯函数；Round13全套`pwsh-2650`0，runtime227项0失败；实际编译`pwsh-2651`0，镜像0x2c8130字节，65%分区余量。未烧写。
- [FSM视觉映射](<../main/ui/badge_fsm.c>)新增visual_screen：未完成教学的GUIDE显示当前主表盘，逻辑screen仍GUIDE且保留任务/方向限制；[main](<../main/main.c>)按视觉屏幕重建与更新真实猫层，UI绘制采用视觉定义，返程私有快照显示表盘而非旧guideIcon。完成教学仍恢复独立GUIDE完成页。
- Round14全套`pwsh-2658`0，runtime230项0失败，新增GUIDE逻辑/MAIN_A视觉/has_cat=true断言；固件`pwsh-2660`0，实际FSM/UI/main/cat编译链接通过，镜像0x2c8170字节，65%分区余量，未烧写。

### 未实测与视觉差距

- 生产LVGL快照和触摸接管尚无自动像素/端到端模拟器或上板验收，纯offset断言不等同证明没有视觉闪烁或误提交；两张RGB565快照约868KB PSRAM仍存在，分配失败降级仅不演示。
- 教学手指仍为28×46简化形状、标签在320附近且旧主表盘文案未隐藏，未逐像素对齐HTML；教学自动手指仍未驱动目标预览（目前仅空闲nudge驱动合成）。
- visual_screen未改变生成规范表或screen_def API，旧表gate继续通过；这是运行时覆盖，并非宣称原GUIDE定义已满足补充HTML。

## Round 15：局部失效真实传递与hold演示门控（2026-10-13）

- [UI](<../main/ui/badge_ui.c>)发现局部box绘制完仍整face invalidate，修为每个clamp后的实际box使用lv_obj_invalidate_area，移除局部路径全层失效。读取[LVGL实现](<../managed_components/lvgl__lvgl/src/core/lv_obj_pos.c>)确认API接收显示绝对坐标，使用canvas coords偏移。
- [cat_view](<../main/ui/cat_view.c>)猫dirty也加canvas绝对坐标偏移；dirty为空不再反而全canvas invalidation。
- hold空闲演示之前只在真实overlay活跃时才绘制，本轮将演示hold纳入local_active，使纯演示也绘制且结束擦除一次，保留had_pixels门控。
- 全套`pwsh-2664`0，runtime230项0失败，渲染dirty29项0失败、UI计划2932项0失败；本轮未增加host对真实LVGL invalidate调用断言，不能把上述数量说成本轮局部DMA测试。真实固件`pwsh-2666`0，UI/cat_view实际编译链接通过，镜像0x2c81a0字节，65%app余量，未烧写。
- 检查教学commit仍比较逻辑screen与motion_target（GUIDE目标），未被visual_screen替换，不需要修改该判定。

### 仍待显示端证据

- LVGL label/style自动失效、comp活跃全层、transition全屏及QSPI驱动合并仍可能扩脏区；局部调用修复不证明实际DMA像素或LCD fps达标。
- 半分辨率cat仍受原引擎方案限制，本轮未重启2x缩放路径；显示绝对偏移仅针对当前canvas，变换缩放时需要额外映射验收。

## Round 16：教学自动目标预览（2026-10-13）

- [教学视觉策略](<../main/ui/badge_tutorial_visual.c>)新增preview资格：step1–3、未完成、无touch、2.4秒周期前1.45秒。方向按FSM当前任务读取，包含返程；[UI](<../main/ui/badge_ui.c>)共享motion_demo合成与露出收回偏移，不向真实FSM注入手势。
- [组合测试](<../tests/host/test_badge_runtime.c>)238项0失败，新增phase0/1450/2400、touch/complete拒绝、真实tick不推进step1与press立即取消预览资格。
- 全套`pwsh-2678`0；固件`pwsh-2683`0，实际UI/visual编译链接通过，镜像0x2c8220字节，65%app余量，未烧写。

### 待视觉与设备验收

- 教学cycle会每次重新capture两张快照，存在阻塞与PSRAM压力；无真实LVGL测试不能断言捕获速度与动画连续性。
- finger路径仍简化，mask是touch dragging门控而非预览过程渐隐；技能0轻点及技能4按住教学仍缺纯演示外圈/猫姿态自动响应（不影响真实手势任务）。
- 返回快照采用表盘映射，底层真实逻辑target仍GUIDE，以便release判定提交；实际连续手势与循环边缘接管需上板录屏。

## Round 17：教学指尖与居中返程提示（2026-10-13）

- 重新读取[触控补充HTML](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html>)916–950：指尖为r38（press34）的浅色径向光斑，不是手指轮廓。本轮[UI](<../main/ui/badge_ui.c>)改76×76圆、浅色半透明填充、2px浅边并按中心定位，替换28×46长条。
- 返程教学标签移中心附近240px宽卡片，其他教学/nudge恢复原下方320px宽；仍单标签且不是HTML两行240×88精确布局。
- 教学step4无touch时按2.4秒周期纯绘制hold环（150→600ms填满、1000ms清除），与nudge共用hold_demo并纳入overlay门控，真实feedback进度优先，不启动语音或推进任务。
- 全套`pwsh-2693`0，runtime238项0失败；固件`pwsh-2697`0，实际UI编译链接通过，镜像0x2c83c0字节，65%app余量，未烧写。未增加视觉host断言，不能把238数量说成圆/卡片像素验证。

### 剩余偏差

- 光斑未实现径向渐变、press34尺寸变化；提示卡片未拆两行，遮罩仍非250ms渐显/拖动淡出；颜色/布局只代码接线，未图像比较。
- 按钮cardHi与94%整体缩放仍未实现；显示帧率/刷新像素需要更强生产端计数证据。

## Round 18：圆按钮按下cardHi/94%反馈（2026-10-13）

- [画布](<../main/ui/badge_paint.c>)BE_BTN按下统一圆底r×.94、边框r/宽×.94、图标目标边长round(side×.94)，底色CARDHI；原integer图标接口仍以相同nearest-neighbor映射，非按下黄金输出不变。
- [UI](<../main/ui/badge_ui.c>)从真实finger点与badge_el_contains选择BE_BTN，拖动后不选；press目标变更full一次，release恢复。命中区域与FSM动作不改变，private preview不带按下状态。
- 全套首次`pwsh-2704`1，发现已有几何helper重名和颜色宏CARDHI拼写错误；修复后`pwsh-2707`0，runtime238项0失败；固件`pwsh-2709`0，实际UI/paint编译链接通过，镜像0x2c85b0字节，65%app余量，未烧写。

### 范围限制

- 只覆盖BE_BTN圆按钮，不含BE_TILE/BE_PILL/其他卡片；外部说明文字不在BE_BTN自身因此未缩放。不能称所有可点击内容94%已齐。
- 未增加pressed专属像素断言/录屏；禁用care按钮目前仍可视觉按下但FSM拒绝动作，移动回按钮会重新显pressed，是否符合HTML需补原始press目标锁存策略。
- press状态变更暂全face重绘，可进一步只旧/新按钮盒dirty；不把本轮回归数量当作新缩放像素验证。

## Round 19：圆按钮像素回归与首次触点锁定（2026-10-13）

- [像素测试](<../tests/host/test_badge_paint.c>)新增11项实际paint断言：圆底边界缩进、cardHi采样、48px图标缩到45px的源纹素1/14映射、原命中区域保持、释放恢复默认底色/边界。paint884项0失败。
- [UI](<../main/ui/badge_ui.c>)首次touch记录press_x/y，按钮必须同时包含初始点和当前点，不能从其他区域滑入而产生新的pressed目标；drag不显示按下。当前仍可离开后返回原按钮再按下，未锁存永久cancel。
- 全套`pwsh-2726`0，runtime238项0失败；首次三次测试失败如实记录：`pwsh-2718`调用了错误几何签名；`pwsh-2721`未链接badge_geom；`pwsh-2723`把透明stub边纹素误断言为opaque；修正为正确生产接口/链接与opaque1/14采样，不修改实际绘制以迎合断言。
- 固件`pwsh-2728`0，UI真实编译链接通过，镜像0x2c85d0字节，65%app余量，未烧写。

### 范围仍不完整

- 使用synthetic icon源验证生产blit，非真实资产截图与HTML浏览器像素一致性；按下触点锁定仅生产编译，无真实LVGL事件测试。
- BE_TILE/BE_PILL、外置文字、禁用care视觉仍待；整face刷新限于pressed变化的两个边缘，非稳定按下每tick全刷新。

## Round 20：停止伪QR与标签重复更新（2026-10-13）

- [UI](<../main/ui/badge_ui.c>)full/partial实际绘制均跳过BE_QR，二维码位置创建静态“扫码尚未接入”标签；[旧paint图案](<../main/ui/badge_paint.c>)仍保留用于参考绘制黄金测试，不连接生产扫码入口。
- [App契约](<badge-app-session-contract.md>)补token发行、版本/长度/有效期、单次使用、设备绑定、校验/撤销和标准QR编码/真实手机扫码验收，明确装饰模块不等于二维码可解码，更不等于绑定成功。
- 普通标签只有文本实际变化才调用lv_label_set_text，减少稳定页面无意义失效；QR静态标签不会被空text刷新清除。
- 全套`pwsh-2735`0，paint884/ runtime238项0失败；固件`pwsh-2739`0，UI真实编译链接通过，镜像0x2c85e0字节，65%app余量，未烧写。未新增真实LVGL QR层存在性测试，仅编译接线与字库覆盖。

### 当前产品边界

- 扫码不可用是诚实降级，不是修复成功。绑定六位码仍`--- ---`等待真实发行，App认证/ACK/可信时间/云结算尚缺代码。
- 未全部优化教学/hint等顶层标签，仍存在逐tick同文案更新。逐项最终矩阵与上板验收清单需后续统一整理，Goal仍有工作。## Round 21：低电排队FX保护与状态矩阵（2026-10-13）

- [FSM](<../main/ui/badge_fsm.c>)进入低电同时取消nudge、idle_used和fx/pool，防止在保护态后播放之前排队音效；voice_start自身拒绝low_battery；抬腕/词wake也取消演示、重置空闲资格。
- [组合测试](<../tests/host/test_badge_runtime.c>)先真实PET积累FX再进入低电，断言take_fx无音效/马达；全套`pwsh-2744`0，runtime239项0失败，paint884项0失败。该断言不替代实际audio队列/PA测量。
- 保存[逐项状态矩阵](<firmware-remediation-status-matrix.md>)F01–F20/R01–R04，明确本地接入/主机验证/部分/外部/未实现/替代待评审；列出放行条件，不把文档存在当实现完成。
- 固件`pwsh-2749`0，FSM真实编译链接通过，镜像0x2c8540字节，65%app余量，未烧写。

### 明确剩余工作

- F15遇见闭环、F17discover实际无线控制等仍有本地实现空间；教学精确渐变卡片/光斑、真实DMA呈现计数、存储/音频诊断仍未收敛。
- 不因剩余仅3轮而标Goal完成；缺硬件/手机只是待验收，不是当前本地未完成工作可跳过的理由。

## Round22：discover控制真实GAP（2026-10-13）

- [net_link](<../main/net/net_link.c>)原子discovery_enabled与host_synced；关闭时停止scan/adv、断开/取消社交连接、clear peers；重开直接start scan/adv，不重复xTaskCreate。所有回调start与connect入口遵守开关，连接完成晚到会terminate，scan/adv启动后复查处理关闭竞态。
- [adapter](<../main/net/app_link.c>)sync模型discover，关闭清提示并decline pending；回调读取原子策略，不跨线程读game字段。当前全部广播是社交，未来认证App需独立策略，不能直接套用disconnect全部连接。
- 全套`pwsh-2753`1因误用net_social_decline API；修正为decline_meeting后`pwsh-2754`0，runtime241项0失败（+2确认adapter双向策略），paint884项0失败。模拟link不执行真实GAP，因此不会将其算实际无线隐身证据。
- 固件`pwsh-2755`0，实际net_link/NimBLE编译链接通过，镜像0x2c88b0字节，65%app余量，未烧写；已更新[矩阵F17](<firmware-remediation-status-matrix.md>)。

### 待验收/剩余

- 真实无线关闭/打开/连接竞争/host reset需实机；同步GAP调用的rc未返回UI，错误恢复目前依赖已有callback，未来需要host事件队列串行策略更完整地收口状态。
- F15遇见生产闭环仍待接线，App QR不能被旧社交握手伪造；教学视觉/DMA计数等Goal仍未完成。

## Round23：二级教学卡与250ms遮罩（2026-10-13）

- 重新读取触控HTML926–929：mask45%×enterT渐显250ms，卡240×88/r20，标题f24中心y-14、副标题f16中心y+18。 [UI](<../main/ui/badge_ui.c>)创建独立卡与两行，返回阶段替代原单行，motion_on含settling/demo时卡/mask隐藏；普通未锁轴touch仍可显示，符合原HTML。
- [FSM](<../main/ui/badge_fsm.c>)提供screen_elapsed_ms；[共享视觉策略](<../main/ui/badge_tutorial_visual.c>)0/125/249/250ms映射0/57/114/115alpha；主机新增3边界和2真实教学导航断言。
- `pwsh-2759`全套244项runtime0；追加真实导航→视觉后`pwsh-2760`1，发现release后drag_axis保留导致return mask永不显示，修正tutorial_view.dragging须pressing&&axis；`pwsh-2762`0，runtime246项0失败、paint884项0失败。
- 固件`pwsh-2763`0，真实LVGL/FSM编译链接通过，镜像0x2c8c40字节，65%app余量，未烧写。

### 剩余限制

- 两行卡实际LVGL仅编译，不声称截图/字形逐脸已验收；指示arc/chevron动态、径向光斑渐变及r34press仍待。
- F15、真实DMA计数等本地工作仍未完成，Goal保持active，轮数上限不改变完工判断。

## Round24：重看输入隔离与当前交付（2026-10-13）

- [FSM](<../main/ui/badge_fsm.c>)tutorial_replay拒绝低电，并清旧press/finger/axis/nudge/error，重置last_input，旧release不会带入新教学跳步；保留已有done持久状态，重看不撤销完成。
- [组合测试](<../tests/host/test_badge_runtime.c>)新增3项：旧按压清除、旧release不跳步、低电重看保持LOWBAT/inactive；全套`pwsh-2765`0，runtime249项0失败、paint884项0失败。
- 固件`pwsh-2766`0，真实FSM编译链接通过，镜像0x2c8c40字节，65%app余量，未烧写。
- 交付[剩余整改与验收清单](<firmware-remaining-acceptance-checklist.md>)，列明本地7批任务、App/ASR/QR/生活/ACK契约、12条上板与6条联调模板（全部未执行）、每类主机证据边界。
- [状态矩阵](<firmware-remediation-status-matrix.md>)更新截止Round24，已读取Goal：revision2、active、24/24。未调用complete/blocked；F15、全按钮、性能计数等可本地完成事项确实仍未实现，不能以缺设备或轮数上限掩盖。

### 当前结论

完整方案/部分生产实现/真实组合回归/构建/逐项证据与待验收清单已交付，但整项“所有可独立完成整改”目标尚未达成。未来继续需明确后续轮次预算，不烧写/不Git/不换引擎的边界继续有效。









