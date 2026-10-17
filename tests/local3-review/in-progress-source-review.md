# v3 在途源码只读复审

证据：**SOURCE_ONLY / IN_PROGRESS**。未编译、未执行新增host case、未启动preview/GUI/浏览器/ADB/串口。root通知现有owner首轮209 assertions和classifier36项已过；这不是本人重新执行，也不是本报告发现路径的复测。后续需稳定SHA与唯一窗口再执行。

读取前哈希见 [read-start.json](read-start.json)，读取后阶段哈希见 [read-current.json](read-current.json)。本次发现定位基于 `badge_pages.c` SHA `5b05e49dc21be6bce8f185d1fa048d16e2bda5cf876c614861e781f1af670a54`。该读取阶段列出的文件没有变化；UI仍未冻结，因此不是最终候选审查结论。

## L3-01 / P1：礼物模态下照料特殊路由绕过禁用门控

文件：`artifacts/firmware-local-v3/source/main/badge_pages.c`。

- `ui_target()`449–455行知道gift overlay并禁用下层targets；`tap()`677–682行也只允许关闭礼物，这两处逻辑正确。
- 实际睡觉释放路径807–810行直接检查旧手势时长/距离/circle，未检查overlay或`target_hit`，继而`finish_care()`660–663→`emit_care()`631–640。
- 实际逗猫路径`object_pressing()`822–825行只检查care_action、ignore/transition，没有gift overlay检查，满足速度就`care_step()`，累计五次后同样真实emit。
- `update_peer()`1088–1100行可在任意当前page弹礼物，并仅清理当时的gesture；用户在弹层上发起的下一次press仍由790–797行建立新gesture。tick1200行已有overlay门控，不能覆盖release/pressing两个独立路由。

确定性复现条件（尚待actual LVGL执行）：

1. 在睡觉照料页，令真实peer完成条件满足以出现gift popup，保持当前`PAGE_CARE_ACTION`。
2. 在弹层上新按`(233,323)`超过1500ms后释放。tick不会执行sleep，但release满足807–810分支，会调用真实care。
3. 逗猫照料页同理：弹层上进行跨点快速划动，速度>900px/s且按700ms节奏累计五次，`object_pressing`会产生care。

应验：实际UI wrapper调用计数、core pending、当前care进度保持不变；只有gift close可响应。建议统一模态输入所有权，避免只在registry/tap门控。发现已立即发root及UI owner。

## L3-02 / P2：礼物模态下拖动可切换底层页/表盘

同一源：`drag_update()`917行缺gift overlay门控，之后根据current_page准备真实目标，`drag_release()`940–948行仍提交，`drag_done()`912行切页/face。弹礼物后新press并正常向上/横滑可在popup未关闭时切底层页，虽然点击registry显示已禁用。

应验：popup显示时各方向move/release不创建ui_drag、不切底层page/face；不只检查tap关闭。建议与L3-01共用统一modal gate。

模态出现时1099行已清`gesture.active`并设置`ignore_contact=true`，当时仍按住的旧release会在806行被吞，不会直接透PET。这部分门控存在。但没有立即`drag_cancel()`：若gift到达时`ui_drag.settling=true`，原提交动画仍可完成，`drag_done()`912行照常切底页/face；没有新的release可保证清理。因此还需覆盖“提交动画中到达gift”和“手指仍在拖时到达gift”两个边界，而不只测弹层后新手势。

## L3-03 / P2：固定toast与guide有效hitbox交叠

- `ui_target()`437行：步骤0和4 guide-practice圆心`(233,200)`、半径110，顶部y90。
- `build_layers()`1067–1070行与`announce()`523行：toast中心`(233,80)`、宽220、高40，固定bounds约`[123,60,343,100]`。
- 点`(233,95)`同时位于toast和guide有效圆形hitbox。重叠宽度不是靠label中心检查能发现。

确定性触发：guide0点击skip后NVS写失败，`save_guide()`569行announce错误并留在guide0；或引导中收到新snapshot由`refresh_state()`1139行announce。toast覆盖practice上沿10px，此时点该覆盖区仍可命中练习。

应验：实际toast完整bounds与enabled target做circle/rect相交检查；调整toast/练习区域或避让策略。不能把背景HOLD画布排除后就忽略真实guide practice。已立即报root。

## 静态核对未见新问题的范围（不是host pass）

- guide step3左右分别用mask1/2，任一方向重复不能代替两方向；timer示范不调用成功分支。
- `guide_v3`取值1=完成、2=跳过；旧`guide_v1`未被读取；skip/完成写失败不更新RAM完成事实。已掌握后重看并skip保留历史掌握事实，welcome当前文案由`guide_completed_now`另控。
- tap及多数hold/按钮路由确实通过同一`ui_target`/`target_hit`，不存在“registry完全独立假数据”的整体问题；L3-01/02是特殊路由漏门控，需补动态路由验证。
- 现有registry所列矩形/圆形使用完整范围R212检查；还需动态enabled/overlay/transition与真实handler验证，而非仅循环静态几何。
- gesture使用最大移动距离禁止出界再回来的tap/hold，轴锁、140px slow、200ms提交、180ms回弹、无target±28px已有明确实现；取消/边界仍留必要独立执行。
- B/C两条空track、灰heart及“待手机同步”文案明确，不伪填日程/心动数据。clock marker由`local2_clock_now`有效标志和offset驱动，无clock隐藏；不把历史snapshot当运行时校时。
- scene动画层未新增care/礼物事务，音频文本明确尚未验证。

## 待补实测

优先L3-01睡觉/逗猫模态、L3-02模态拖动、L3-03circle/rect toast碰撞。等owner修复/稳定SHA后再做必要独立host验证，勿把本轮静态推导写成已复现设备故障或已修通过。
