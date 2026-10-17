# 今晚视觉/滑动工程评估（只读证据，未做新测试）

## 建议给Root的决策

**横向仅猫/有界内容跟手、静态底/环/HUD固定，可作为今晚唯一滑动优化路线。纵向及短sleep构图保留037全页回退，单列未优化。** 先交付原猫与真实动作来源的视觉完整性，不同时改SPI/TE/渲染模式/协议。若dirty量化无明显收益或残影边界不稳，不把slide改动合入；037保留为基线。

### 为什么

- 037 `badge_pages.c:907–908`每帧移动466×466 page/peek；`badge_scene.c:92`场景root也是整屏。移动满屏透明parent仍会扩大无效区，不是只换透明度即可修好。
- 035同trace横向提交像素仅3196508→3087072（约-3.42%），回弹1715072不变；poll负载的大幅减少未解决拖动面积。036池host改善CPU，flush/pixels精确不变。
- 037实际静置98.962734s/396render/8544px，mean4.210548ms、pressed0，已独审。但它不是满屏drag，也非035严格A/B，不可据此承诺swipe FPS。
- 确认QSPI4线40MHz/RGB565：全屏434312B，仅理想payload就约21.72ms；还没算命令/CPU/调度。满屏60FPS不是本路线能保证的目标。该值是接口下界推算，不是实测传输性能。

## 路线比较

| 路线 | 今晚结论 | 反例/成本 |
|---|---|---|
| 固定scene root/背景/环/HUD，仅home/peek猫与有界内容移动 | 首选，范围仅横向 | parent仍466²会失效；每帧set_frame会覆盖绝对cat坐标，必须独立offset；固定HUD直到commit属有意新过渡语义，需人眼验 |
| 拖动时冻结展示动画 | 本轮不做，worker已同意保留tick | 现有tick(false)恢复会清pending回base_clip，可能吞掉刚发生feed/pet反应；另造暂停时基扩scope |
| 双全屏RGB565缓存 | 不做 | 868624B超过新增PSRAM512KiB，且仍全屏SPI；更不可能放进internalDMA |
| 单全屏PSRAM缓存 | 备选后续，不作为今晚主线 | 434312B几乎吃完预算，仍不减传输；只知PSRAM总free，未测这么大的连续block；截图生命周期/cancel/新状态作废与模态抢占复杂 |
| 增大internal draw buffer /改DMA或globalallocator | 禁止本轮 | 现仅6423B capture余量；034/033历史说明buffer更大不自动等于整体更快 |
| instant cut/缩短动画冒充优化 | 不作为原跟手合同完成 | 改掉跟手与200/180ms而不是优化；若用作演示降级必须显式标注 |
| TE枚举/刷新率配置/升SPI时钟 | 不做 | 未建立物理TE/面板扫出链，设置名字不等于无撕裂；需要独立硬件验证 |

## 内存硬门

既有037实际DMAfree71959，距64KiB仅6423；largest31744/min35700。6个常驻scene（guide/peek/home/care/welcome/care_action），每个原有root+8weather+5ground+cat=15对象。小于16KiB普通malloc优先internal。不能按一个scene估算或用8MB PSRAM总free担保小对象安全。

Root给定新增Flash/PSRAM各<=512KiB、零新internalDMA、存活internal目标<=4KiB。优先home原root少数draw callbacks/静态描述，不新增一组装饰objects到每scene。**零新增对象仍可能增加draw task/descriptor内部峰值**，需看主/peek同绘、雨/夜/sleep/modal/capture期间峰值。实际free至少64KiB且保留约2KiB余量才值得尝试capture；capture必须真通过，守卫不能降低。两9320、可选mask及原能力回退保持。

## 软件候选入门（拟定，不是已通过）

1. 源/预算保护：协议、core/store/BLE/wire/分区/业务逐字037；原I8猫/动作成功门保留；显示可信门有意变化逐条单列，不能暗改奖励/状态。
2. 原手势/时长：12px轴锁，50px/500ms快滑，140px慢拖，28px无目标阻尼，200ms提交/180ms回弹、deadline、modal抢占、AOD首次contact与release/cancel不透PET保持。必须动画换帧同时拖动，防offset被原foot anchor写回。
3. 每个中间帧与同tick新设计全构图oracle查新增脏影/缺字/错误clip，不能只看终帧或拿新增容差盖掉问题。旧8px单独保留，不扩大。
4. 同一logicalticks/trace：横向提交总pixels推荐至少降20%、回弹不增才称本轮性能优化；启动/终帧强制全刷单列。仅hostwall快或静态少刷新不够。若未纳入slide或未达门，可以视觉候选交付但不得称滑动修复。
5. 当前/旧数据：cold旧snapshot中性，只有本轮connected+subscribed新fresh才live；同rev不重复短反应，断连/失订阅清RAM显示可信门，重连同rev保持中性。原core拒旧rev不重测成可绕过；不向UI硬塞不可能的持久回退来编造协议失败。
6. 原本地emit失败/queuefull/cancel不播成功；真实成功feed/pet/sleep只触原短窗口，不把待ACK当手机奖励；sleep→AOD→wake不重放或多emit。

预备代码/计划已在本目录，**未编译/执行**。等稳定038源hash与Root唯一host窗口，才做必要独立复验；不与worker在途源抢构建。

## 物理后置与诚实降级

用户/Root实际触屏窗口应覆盖：醒屏首触、tap/hold、左右切face、上下care/status、慢拖/反向/无target、回弹、模态到达打断、连续换猫帧。计时窗口要有真实pressedPolls，CAPTURE/VIEW/RESET不能夹在其中。用同镜头记录手指+屏幕，观察第一次跟手、停顿、释放落点和光学撕裂；UI逻辑200/180ms与实体端到端延迟分别记。未测前不承诺FPS/无撕裂。

若无人手触屏：只能演示真实静置/新校时、明确VIEW选页、运行LVGL合成以及标明host合成输入的动画；保留“物理滑动与三口喂食待验”。不能远程伪注入触摸、假emit/奖励，或把VIEW当swipe。已授权20:30候选目标/21:00功能止后，只做阻断修复与证据补齐；打包完整1h另留，不靠临近冻结再换底层路线。
