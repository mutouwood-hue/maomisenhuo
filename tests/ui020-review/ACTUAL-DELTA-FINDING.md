# UI020 实屏增量发现：底部两层提示重叠

## 结论与等级

**UI020-ACT-01 / P2，需修复后复验。** 普通屏和short屏的真实Android证据均显示：照料通知“洗香香…”与“双指拖动可以转视角”处在同一底部区域，后者白字在浅色通知层中不清楚。不是单个截图的偶然布局推测。

这是020新增CSS定位与原Host通知槽冲突。此前只读审查的“可进入保留数据安装验收”不是本轮实屏通过；现有0.2.0新增页面不能据旧结论宣称全通过。旧APK保持冻结，root可继续原定取证；本审查未改源或设备。

## 真实证据

已直接查看现有PNG并读取配套XML。PNG与XML为同checkpoint先后采集，动画进度文字可变；以下仅使用稳定的两层提示bounds，不把它们当同一毫秒动画帧。

| checkpoint | 双指提示XML bounds | Host“洗香香…”通知bounds | 相交 |
|---|---|---|---|
| normal-bath-start | `[39,2161][929,2242]` | `[39,2122][955,2242]` | 提示矩形100%落在通知矩形内，bottom同2242 |
| short-bath-start | `[36,1452][828,1524]` | `[36,1416][852,1524]` | 提示矩形100%落在通知矩形内，bottom同1524 |

- [普通屏PNG](../../artifacts/device-integration/2026-10-16-ui020/normal-bath-start.png)、[XML](../../artifacts/device-integration/2026-10-16-ui020/normal-bath-start.xml)
- [short屏PNG](../../artifacts/device-integration/2026-10-16-ui020/short-bath-start.png)、[XML](../../artifacts/device-integration/2026-10-16-ui020/short-bath-start.xml)
- [actual-delta-evidence.json](actual-delta-evidence.json)：四个文件SHA、矩形交集与来源文件SHA。

可见结果是底部通知上同时叠着白色双指提示，而非只有两个不可见DOM框相交。未获取运行时computed style或测定合成后的像素对比数值，因此不编造WCAG比值。

## Delta归因与定位

1. 新增 `ui020/source/web/offline-page-polish.css:37`，在`@media(max-width:600px)`强制：

   ```css
   #pg-think .pg-tip {
     left:12px!important; right:84px!important;
     top:auto!important;
     bottom:calc(var(--safe-area-inset-bottom,0px) + 96px)!important;
     transform:none;
   }
   ```

2. 未改的 `ui020/source/web/offline-host.css:23` 将 `#offline-notifications` 固定为相同 `bottom:safe+96px`。第25行将选中的通知放回槽内相对定位；第27行给message/action-status等浅色半透明背景和深色字。因此两层共享同一底边，缺少共存/互斥排布。
3. 019没有第1项新增override。原019/020的game-06.js逐字相同，`updThink()`仍每帧给真实`.pg-tip`写`left=(bx+bw/2)`、`top=(by-8)`，原CSS为`translate(-50%,-100%)`、深色背景`#3b2f45e6`和白字`#fff4e0`。020的`!important`加`top:auto`压掉了原动态坐标行为。
4. 原`#pg-think`在index中是z-index17，Host通知槽为25。新增位置重叠后，较高的浅色通知背景覆盖其下的原深色提示，符合实屏中白字被浅色层冲淡的现象。**定位冲突和可见性降低已由截图/XML确认；具体透明度合成数值未测，不把推导当computed style。**

受保护的Host CSS与game-06均与019字节相同，校验见JSON。020新增定位是本次确定引入点；不应通过重写原玩法/通知业务/存档来修布局。

## 具体修复建议（只建议，不改冻结020）

优先让两类提示具有明确的展示归属，下一隔离候选可选一种小范围呈现修复：

- **共享/互斥底槽：** 以现有Host selected通知状态为权威，Host通知可见时暂不显示双指提示；提示仍遵循原`.tip`/原4.5秒条件，不重置教程计时或写入“已学会”。通知退场且原提示窗口仍有效时再展示，保留原深底白字可读性。
- **分离布局：** 将双指提示作为照料进度浮层旁/内的独立辅助行，按真实浮层高度排布，并与Host槽、HUD和右rail保持明确间隔。若继续固定底部，应根据另一层的实际高度错开，而不是再给两层同一个96px基线。

不建议仅提高z-index：那只会换成双指提示盖住“洗香香…”，没有解决两条真实信息同时可读。也不应只改白字为深色后继续相交。

## 为什么33配置/978检查没有覆盖到

`source/tests/page-ui-fixture.cjs:13`将life.toast替换为空函数；第17行只抽原game-06的think模板并写两行进度，没有运行真实CAM/updThink过程或给think加`.tip`。`source/scripts/check_page_css.cjs:24`的bath专项检查仅验证pg-bub避开rail及在HUD下方，没有构造“双指提示可见 + Host选中照料通知”的同时态。

因此已有978检查支持其指定软件布局配置，不能证明这个动态共存状态，更不能覆盖本轮实屏反例。此前报告已说明其不是Android/完整3D，本次需新增明确共存反例才能关闭P2。

## 复验门槛

1. 使用真实的`#pg-think.tip .pg-tip`与Host选中通知节点，同时态在normal和short布局均验证：矩形无重叠，或按明确互斥规则只有一条可见；两条信息均有正确展示机会。
2. 覆盖新手提示首次出现、照料开始/通知替换/通知退场、原提示窗口到期、视角切换和“先休息”取消。取消后不残留提示、不改教程key/存档/奖励。
3. 检查深/浅场景下文字可读，正确使用真实safe-area/inset；不能只核按钮48px/图标对比或默认未显示tip的模板。
4. 保留原8game/Host/store/Java的既有字节边界，先软件真实节点共存反例，再由root唯一设备窗口复验下一APK。不得拿修后的fixture代替当前0.2.0真机结果。

本报告仅新增上述P2；不把root继续检查的五页/六tab其他内容提前标通过，也不重复将019已完成的滑出/重开/fresh长按补验列为pending。
