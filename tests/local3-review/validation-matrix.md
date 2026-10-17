# v3 独立验收矩阵（等待稳定源）

状态：**仅准备验收，尚未执行 v3 独立构建、主机输入测试或设备操作。**

范围：root 转述的本轮用户 MD 要求；本地 [UI-SPEC-DELTA](../../artifacts/firmware-local-v3/docs/UI-SPEC-DELTA.md)、[INTEGRATION-STATUS](../../artifacts/firmware-local-v3/INTEGRATION-STATUS.json) 和当前公开接口只作追踪参考。原 MD 的 Library 文件 `libfile_1cc14e6642248191afef79af3f31f9dd` 已交 parent；本轮未读取该文件，不能声称完整独立读过其正文。

产出仅在 `tests/local3-review/**`。v2 冻结文件不改；UI owner 仍在修改 v3，当前 header/preview 不能代表稳定候选。等 root 发稳定源 SHA 后再对相应 SHA 执行必要轻量 host 验证，避免争用 host/target 编译窗口。

## 证据标记

| 标记 | 能证明 | 不能证明 |
|---|---|---|
| SOURCE | 该 SHA 的调用、状态门控、常量和数据来源 | 实际命中、渲染效果、设备帧率 |
| HOST_INPUT | 同 SHA 实际生产手势/页面代码收到输入后的结果，记录坐标/时刻/事件/真实 care 调用计数 | 物理触摸、无线、Flash 真实掉电 |
| HOST_FRAME | 同 SHA 的 C/LVGL 离线图，按帧核查布局、对象/控件 registry | 动画全程、手指跟随、屏幕真实亮度 |
| DEVICE_PENDING | 必须保留给后续授权的设备操作 | 不能拿静态截图或 mock 代替通过 |

所有矩阵项当前状态统一 **PENDING_STABLE_SOURCE**；本文件没有任何 v3 pass。`preview/keyframes-v1`、`keyframes-v2`、smoke 图的已有来源必须保留原 in-progress 标记，不能继承为最终验收。

## 1. 安全圆、完整控件与 toast

| ID | 验收断言 | 必要正例/反例与证据 |
|---|---|---|
| GEO01 | 所有可操作控件的**完整逻辑 hitbox 和可见边界**都在 R212 内 | SOURCE+HOST_INPUT+HOST_FRAME；收集每页每状态的控件，包含透明点击区、padding、父变换和圆形控件；不能只核 label 或中心 |
| GEO02 | 用同一个显示中心计算径向边界 | 以稳定源码实际显示中心为准；矩形四角均 `distance(center,corner)<=212`，圆形 `distance(center,controlCenter)+radius<=212`；旋转/变换后用屏幕坐标，不能只看本地位置 |
| GEO03 | 控件显示与命中 registry 一致且无漏项 | 遍历静态 registry 和实际 handler；可见可用按钮都有唯一映射，不把“不在 registry”当通过；不可用项明确不可用，无隐形旧 hitbox |
| GEO04 | R212 边界内能命中、外部不能命中该控件 | 四角/四边/圆周内外1px采样；被遮挡/禁用/不在当前页的控件不响应；全局手势画布应单独标识，不能借此隐藏能产生操作的超界按钮 |
| GEO05 | toast 从出现到消失不遮当前可操作控件 | 默认/长文/错误/忙/取消/成功/换页后遗留toast；核对实际文字与背景范围，不仅 toast anchor；重叠但仍能点不能算通过 |
| GEO06 | 初始、长按弹层、确认、来礼、错误与帮助态都纳入 | 默认页安全不代表弹层安全；确认/关闭/返回/skip/唤醒/设置滑块都必须列入 |

最低枚举种子来自当前 `badge_ui_targets.h`，仍需对稳定实现补全：guide、skip、连接帮助、home alert、cat、home hold、feed/water/play/sleep/care action、status gear、brightness/voice/discovery/AOD/version/device/guide review、sync help/pending/device guide/back、touch0..4、voice back、welcome、meet confirm/close/back、gift close、wake、reset unavailable。枚举存在并不等于覆盖实际 handlers。

## 2. A/B/C 表盘与真实数据

| ID | 验收断言 | 必要正例/反例与证据 |
|---|---|---|
| DIAL01 | A 保留猫和边缘状态，辅助 HUD 不遮猫/关键提示 | HOST_FRAME：新建、已绑定、未校时、无链路、忙、来礼、错误；数值来自真实 snapshot，不能凭空补满 |
| DIAL02 | B 显示24小时**双环**的原设计，区分两类轨迹 | SOURCE+HOST_FRAME：核查完整圆环与图例/时间语义；仅一个轨道、纯数字时钟或一个装饰环不满足双环 |
| DIAL03 | C 显示双环并有心动时刻表达 | 无真实心动数据时展示空轨/明确缺数据，不生成心形记录或编造时间；只有静态 heart icon 不代表真实心动列表已接入 |
| DIAL04 | 未获权威24小时区段时，不假填轨迹 | 当前冻结 snapshot 没有 owner/pet 日程段或 heart timestamps；区分空数据、缺数据与真实零活动；fixture演示必须标演示且不写生产 |
| DIAL05 | 当前时间只在本启动校准后显示为当前 | 启动无 epoch/历史持久 snapshot/新校时/offset±840；无clock时不拿旧 epoch 推导真实当前时间；跨午夜真实显示待设备/授权场景验 |
| DIAL06 | A/B/C 切换不修改经济、健康或事件队列 | HOST_INPUT：切换前后核心blob/真实care与gift计数相同；视觉播放不产交易 |
| DIAL07 | 未实现的数据扩展独立列缺口 | SOURCE：不能把 future lifeContext/completion proposal 当已接入；没有真实字段时保留“待数据”，不以fixture图写“完成” |

## 3. 真实手势引导与偏好

| ID | 验收断言 | 必要正例/反例与证据 |
|---|---|---|
| GUIDE01 | 每一步仅实际正确手势完成才推进 | HOST_INPUT：tap、up、down、left、right、hold逐个正例；左右分别记账，不能一个方向替代双方 |
| GUIDE02 | 错误手势给错误/中性反馈且停留原步骤 | 每步至少一个相反方向、短拖、过短hold；重复错误不能跳步或被“任意tap继续”绕过 |
| GUIDE03 | 自动手指演示不能自己完成练习 | 演示播放/循环后进度不变，无真实care；仅 renderer 计时或动画结束不能调用成功分支 |
| GUIDE04 | skip 明确退出，不能保存“已掌握” | skip前后持久值可区分 skipped/completed 或等价独立事实；从设置重看时正确起始，不能把跳过算六项熟练 |
| GUIDE05 | 新引导偏好与旧 `guide_v1` 区分 | 旧 key=true/false/缺失/读取失败；不能旧版任意tap完成就跳过新真实手势练习；失败不擦旧记录、不写“已完成” |
| GUIDE06 | 一次手势只完成一次，重入不多进 | holding阈值跨越+release、重复release、双指/新press、步骤切换时尚有旧输入；事件 generation 或等价清理 |
| GUIDE07 | guide 内完全不产生真实 care | tap猫、hold、wrong、skip、完成、返回、重新进入；实际 core care wrapper调用计数始终0，不只检查显示数值 |
| GUIDE08 | 中断与取消清理练习输入 | press后切页、取消、锁屏/省电/后台类宿主取消、对话框盖入；旧release不能完成新步骤或透到PET |

## 4. Follow-finger、提交、回弹、互斥

| ID | 验收断言 | 必要正例/反例与证据 |
|---|---|---|
| DRAG01 | 拖动过程中实时跟指，并显露真实目标页 | HOST_INPUT+多帧：press→多次move尚未release时有对应平移；不是release后fade，也不是新造与当前domain不同的预览数值 |
| DRAG02 | 轴锁定后不在对角线上反复切目标 | 12px附近、45°两侧、移动出去再回来；确认锁定依据和方向符号不反转为其他操作 |
| DRAG03 | 快速提交按规范阈值，慢拖达140px可提交 | 快速距离50px/时长500ms及±1边界；慢拖139/140/141px且>500ms；距离用相应锁定轴，不能斜向总距偷偷过阈值 |
| DRAG04 | 有目标提交动画全程≤220ms | HOST_INPUT/定时帧验证，包含ease终点和实际pagecommit时刻；header200ms仅源码证据，必须核最终位置和事件时序 |
| DRAG05 | 未达提交阈值在180ms回弹到原页 | 距离不足、取消、目标变不可用；末帧位置0、无残留临时页/可点击目标 |
| DRAG06 | 无目标拖动有阻尼且偏移不超过28px | 四方向极大拖动、慢拖、重复move；末端不能露出不存在的页面；release仍回弹且不触发tap/hold |
| DRAG07 | 取消、回弹、长按后的 release 都不透 PET | 用实际care入口计数验证：短拖后松手、140以下回弹、移出再回来、hold后松手、手势被取消后release均不产PET |
| DRAG08 | 长按与拖拽互斥 | hold前已越move阈值则不能hold；hold一旦生效本次不再导航/PET；长按确认弹层不能接收旧release为确认 |
| DRAG09 | 导航动画期间旧页/目标页控件不会误触 | start/中间/末帧点击，结束前新press；符合明确busy/取消策略，无双操作或隐形点击区 |
| DRAG10 | 坐标/计时边界安全 | clamp0..465、uint32计时wrap、release重复/无press、NULL/未active；边界测试不能造成状态跳变或整数溢出 |

## 5. 反馈、持久、原有能力边界

| ID | 验收断言 | 必要正例/反例与证据 |
|---|---|---|
| FB01 | 成功反馈只在对应真实成功后发生 | care存储成功/失败/队满、peer等待/拒绝/仅incomingSaved、取消；错误不播成功灯/完成动画 |
| FB02 | M1 使用可验证的视觉反馈，不捏造 motor/NFC | SOURCE：无电机/NFC路径；文案不暗示已振动/碰一碰完成；有光环也不算硬件震动通过 |
| FB03 | 音频硬件未验明确列待验 | 设置/静音文案与真实能力相符；host音频stub/图标不能算发声成功，目标I2S/音量/扬声器留 DEVICE_PENDING |
| PERSIST01 | 引导/设置失败不覆盖旧有效偏好或存档 | 主机存储双失败、读取失败、未知版本；写新guide命名不迁移/清旧core/配对记录 |
| PERSIST02 | guide/表盘/拖动只改UI，不动被冻结协议语义 | 源diff核对core/store/BLE/协议；视觉state无法令双边peer complete、mint礼物或ACK未持久事件 |
| SCOPE01 | Android0.1.2已有证据与新v3不混记 | parent已过模式/后台取消保留原APK SHA；NPC新banner因daily6/6仍待触发，不能改时钟/限流/存档假测通过 |
| SCOPE02 | 真机性能、安全圆触感和音频仍待实际验收 | 圆屏实体裁切、触摸边缘、PSRAM、帧率、长拖延迟、低亮度/AOD、声音；离线图只说明对应帧 |

## 稳定后执行顺序

1. root 给稳定源清单/SHA；只读核对本次变更范围和偏好key，不接受“当前latest”代替具体版本。
2. 审核所有实际 handler 与完整 hitbox registry，先报超界/漏控件/成功门控等确定阻断，再进行重用截图核对。
3. 在独占 `tests/local3-review/**` 编译必要纯手势 host harness，覆盖阈值/方向/slowdrag/wrap/取消互斥；需 LVGL 页面驱动时先与root约定唯一编译窗口，不借owner既有build冒充本轮独立执行。
4. 记录实际 care 调用计数与 page/guide状态，检查全路径不透 PET；截图不能替代调用计数。
5. 只对相应稳定SHA/输入轨迹标 HOST通过。将真实屏幕/触摸/音频与缺失数据明确留待验，不用 preview/浏览器/GUI/ADB/串口。
