# 固件整改状态矩阵（截至 Round 24）

基线：[渲染参考](<C:/Users/admin/Downloads/吧唧渲染参考.html>)与[触控补充](<C:/Users/admin/Downloads/吧唧触控引导与滑动动效.html>)，冲突以触控补充优先。初始发现编号来自[原审计](<firmware-html-audit-2026-10-12.md>)；实施路径见[完整方案](<firmware-remediation-plan.md>)，逐轮证据见[进度记录](<firmware-remediation-progress.md>)。这是当前状态，不是整体验收通过声明。

## 状态含义

- **本地接入/主机验证**：生产模块或共用策略已有可执行回归，仍不代表真实LVGL、设备或手机验收。
- **部分接入**：部分代码可运行，仍有明确未实现项。
- **外部待接入**：缺App/云契约或实现，保持失败关闭，不虚构联调成功。
- **未实现/替代待评审**：仍有可本地完成工作或必须决定的架构偏差；不因有契约文档而算完成。

## 逐项矩阵

|编号|要求|现状|证据与剩余验收|
|---|---|---|---|
|F01|真实动作进入离线8B事件队列|本地接入/主机验证|[runtime](<../main/badge_runtime.c>)真实event sink与输入时钟；[组合测试](<../tests/host/test_badge_runtime.c>)。手机收到/ACK尚无实现。|
|F02|事件时间推进与5秒NVS保存|本地接入/主机验证|[events](<../main/net/badge_events.c>)advance_clock与tick分开；612项events回归。真实断电/补传仍待。|
|F03|未绑定→PAIR→教学；可信绑定持久化|部分接入/外部待接入|[FSM](<../main/ui/badge_fsm.c>)与[onboarding store](<../main/badge_onboarding_store.c>)；普通BLE连接不能绑定，PIN占位；真实一机一密/发行者未知。|
|F04|五项必须操作教学、回程、错误、重看|部分接入|实际task FSM、5段环、2.4秒演示、帮助/skip/完成页；[visual](<../main/ui/badge_tutorial_visual.c>)与UI快照。App重看入口未接；Round23二级mask250ms渐显与240×88两行卡已接，release残留drag误隐藏已由真实组合断言修正；光斑/方向装饰仍非精确HTML，实机录屏待。|
|F05|气泡/toast/+9/无马达边缘提示|本地接入/主机验证|[overlay](<../main/ui/badge_overlay.c>)原始时间/revision、[UI](<../main/ui/badge_ui.c>)显示；不重复消费。布局/声光同步待实机。|
|F06|150→600ms hold环、移动≥12取消|本地接入/主机验证|[motion](<../main/ui/badge_motion.c>)和真实FSM边界、r224/w6绘制。触摸硬件误差/手指遮挡待验。|
|F07|麦克风/离线ASR/自由对话|外部待接入、未实现|仅词注入API与预置FSM命令；无采集/ASR/上传/回复。生产phone=false；不得称可语音聊天。|
|F08|<5%停3D/语音保留BLE、USB退出|本地接入/主机验证|真实PMIC有效性→FSM锁存、所有主要输入拦截、音频原子mute/chunk；线性电压SOC非标定、真机电流/阈值待。|
|F09|快慢滑/回拉/提交与回弹参数|本地接入/主机验证|[motion](<../main/ui/badge_motion.c>)80ms反向速度strict边界、120/220/180/200、rubber；真实快照动画仍仅编译非显示验收。|
|F10|3天/3成功、新手方向/返回/6秒6次|部分接入|独立40B存储、180ms、400ms与两周期提示、6秒实际nudge及非提交快照。无可信App时间恢复；UTC日额度未引入时区契约；微调渐隐/箭头待。|
|F11|顶层表盘点、所有按钮cardHi/94%|部分接入|圆点已接；BE_BTN圆底/边/图标94%，paint专属11项像素断言。BE_TILE/BE_PILL/外置文字未做，不能说全按钮完成。|
|F12|App下行权威快照|外部待接入|[App契约](<badge-app-session-contract.md>)；无真实RX分流/认证字段更新；现有pet_sync只是模型API。|
|F13|真实时间/时区同步|外部待接入|FSM分钟与Unix setter已有；开机仍离线演示时间，夜间音量/亮度不代表真实本地时间。|
|F14|生活行程/心动/离家回家|未实现/外部待接入|仍硬编码演示行程与地点；App权威状态和30分钟回家窗口未实现。|
|F15|遇见UI→BLE确认→好友|未实现闭环|旧社交纯模块175项回归不证明UI接线；prompt/peer/确认生产闭环仍待。|
|F16|有效QR/校验/扫码亮度|外部待接入|生产停止伪QR，显示“扫码尚未接入”；[契约](<badge-app-session-contract.md>)明确发行与扫码验收。真实编码/扫描/云结果未实现。|
|F17|discover控制真实无线|部分接入/adapter主机验证|Round22 [adapter](<../main/net/app_link.c>)传原子开关至[link](<../main/net/net_link.c>)，关闭stop scan/adv、断开社交连接并拒绝晚到connect、回调重启遵循开关。新增2项组合断言只验证策略传递；真实GAP开关/重启/近场手机扫描仍待实机。未来App连接需独立分流，当前全部广播为社交。|
|F18|服饰同步与渲染|未实现|当前game/peer无对应新模型，渲染器未接服饰；旧库存不算完成。|
|F19|12字符名字与字体|未实现|当前13字节名字仍小于12汉字，存档升级和任意字形需要兼容设计；不擅改旧blob。|
|F20|60/30音量、250ms同音防重、200ms PA尾|本地接入/策略主机验证|[audio policy](<../main/hw/badge_audio_policy.c>)与实际队列原子线程；PA由ES8311关闭。示波器/声压/实时中断待实机。|
|R01|空闲不清整层、真实dirty传递|部分接入|inactive overlay一次擦除、face局部invalidate、cat空dirty不刷、同文案标签去重复。active comp仍全层，顶层样式仍可扩dirty；无DMA计数。|
|R02|跟手首帧快照不阻塞|风险未闭合|仍同步capture双466RGB565约868KB，教学每周期重复；暂无失败/耗时/内存预算强证据。|
|R03|节流与降帧有效、真实送屏FPS|部分接入|[frame clock](<../main/ui/badge_frame_clock.c>)保持降档/余量、100×10ms模拟30帧。PERF是策略/CPU成本，不是LCD呈现FPS。|
|R04|HTML PCAT/条带/233×2|替代待评审|保留既有cat3d，不替换引擎。10帧自身参考0差异仅自身golden，不是HTML renderer逐像素一致；半分辨率路径未启用。|

## 交付和放行门槛

1. 本地代码仍有未实现项（尤其F11/F15/F17），Goal不能仅凭矩阵存在即完成。
2. 当前可发布定位仅为开发固件：App绑定/扫码/语音不完整，不能当完整产品；未烧写、未Git操作、未换引擎。
3. 后续需设备验收：恢复出厂/绑定成功与失败、真实五步教学、全部手势边界与回拉、录屏与触摸延迟、30/12/6/0梯度、电流/SOC/USB/PA、flash断电重试。
4. 手机验收：认证与错误包、未认证不泄漏、下行权威快照/时区、断开撤权、重连去重/ACK、QR错误/过期/重复/错设备。
5. 渲染验收：两份HTML选择固定时间/动作/花色/相机截图，真实LCD或同一生产LVGL输出比较；测量flush次数/像素/完成时刻，不用策略fps替代。

## 最新验证记录

Round24全套`pwsh-2765`退出0，runtime249项0失败、paint884项0失败；固件`pwsh-2766`结果见进度记录。Round23固件`pwsh-2763`0、镜像0x2c8c40、8MiB app余65%。当前Goal revision2、active、roundsStarted24/max24：未标complete，未标blocked。尚有可独立实现项，自动轮次上限不是外部阻塞，也不是完成证据。下一批依赖顺序及实机/手机未执行模板见[剩余整改与验收清单](<firmware-remaining-acceptance-checklist.md>)。
