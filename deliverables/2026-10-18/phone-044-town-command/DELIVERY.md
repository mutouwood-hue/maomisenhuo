# 手机044：最小范围的小镇控制修正

已向 StepX PZ261A 保留数据覆盖安装 **0.4.4-town-command / code35**。ADB返回`Success`/exit0；原证书、applicationId、名称保留。appId仍为10191，firstInstallTime仍为2026-10-15 23:14:25。未卸载、清数据、启动应用或操作firmware/吧唧。

[完整MANIFEST](MANIFEST.json) · [APK](catforest-0.4.4-town-command-debug.apk) · [构建日志](phone-build.log) · [安装日志](phone-install.log) · [安装前后元数据汇总](install-result.json)

## 明确的静态根因

1. **暂停的房间仍在接收小镇触摸。** 两者共用同一画布。原房间setActive(false)只取消RAF，未禁用原OrbitControls；hu/uu/du/fu输入监听没有检查活动标志vi，du仍能释放捕获并调用房间onPet/onAction，fu仍能触发onPet。修正为暂停时隔离这些输入、关闭原控制器和清除原指针候选，回家时恢复。原房间RAF有vi门控，不应把问题说成两个NPC移动循环同时运行。
2. **引导只改了部分行为优先级。** guide没有挡住9秒后的自动story和庭院环境活动；这些代码能清空路径、切回free或进入禁止地面点击的状态。输入处理又始终优先NPC命中，抽屉/事件打开时直接return。本轮让现有setMode/targetPoint共享手动接管入口：取消当前未完成动作、追随、弹窗及旧路径恢复点；以命令代数拒绝旧回调；引导点击直接设地面目标，自动活动只能在free且无手动目的地时启动，到庭院不退出guide。
3. **堵路被转换成新的互动。** move碰撞超过1秒会beginNpcContact，先使双方停下；之后缺少明确让行关系。现改为复用现有socialDeparture让行：玩家优先，NPC固定次序；外围堵路者沿同一让行权退开，并阻止相互等待链。没有更换原道路/离开寻路算法、减小碰撞半径或增加冷却。
4. **“绕过”没有取消分支。** 原所有choice都会先applyWorldChoice再reacting播放4.6秒，safe也继续pose/特效。本轮蝴蝶“安静绕过去”和钱袋“继续散步”立即清理演出，不进入reacting、不登记该次故事选择。其他正常动作完成后才登记原store，手动中断丢弃未完成选择；已完成并登记的合法状态不回滚。雨天“在树荫旁避雨”仍按原动作处理。

特效没有独立RAF或遗留定时器；真正需要取消的是主循环中的reacting、pendingEvent、旧路径和当前追随关系。修改只放在现有入口与状态内，没有增加另一套更新循环、UI视觉、新事件或功能。今日生活、圆环相关五个源码哈希与本轮修改前一致，见[范围记录](life-source-scope.json)；没有CSS变化。

## 构建与安装

- 沿用原交付的debug签名APK，933,003 B。
- SHA-256：`73954c685a1babcc49b4a4a9b2f2145b0c6fb468ac2b82552ad15307f29d200f`。
- 公共证书SHA-256：`3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`；包ID`com.catforest.htmlcandidate`，名称「猫咪森活」。
- [资源生成日志](assets-build.log)、[离线Android构建日志](phone-build.log)均exit0，命令`:app:assembleDebug -x test -x lint`。
- [公共签名](phone-signature.log)、[包身份](phone-package.log)、[安装前](phone-before.log)、[安装后](phone-after.log)记录齐全。
- [相对043的小镇代码差异](044-town-changes-vs-043.patch)、[共享画布输入的静态锚点](room-input-static.json)、[APK文件变化范围](apk-static-inventory.json)可供复核。这里只读取生产文件元数据，没有执行应用或测试。

源码来自当前隔离目录，保留b8ca479基线上的全部既有改动；只修改app和本批独立交付目录。未使用旧main源码，旧目录仅复用原工具缓存和证书。没有Git提交/push/reset/清理。

## 交给用户的最短验收

1. 开启“我来引导”，点空小路A，再在抵达前点B：脚印应切到B，小猫持续去B；保持引导超过9秒，自动剧情不能抢回目标。
2. 居民互动或演出中点弹窗外可通行的小路：应停止当前未完成动作，转向新脚印；聚集堵路时居民应让行，不能重新开始互动。
3. 再遇到蝴蝶弹窗时选“安静绕过去”：演出应立即结束并能继续引导，不再播放完整4.6秒或登记该次故事选择。

本轮没有运行test、lint、模拟/自动交互、浏览器QA，也没有启动手机应用验收。仅凭现有文字，尚不能断定043那次点击最终在哪一个冲突处分流；上述代码条件已明确修正，实际行为交给用户确认。若仍失败，最短补充现象是：**点无猫小路后有没有脚印/“已设下脚印”提示，以及猫是否先动一下再停。**

新截图`libfile_e658ed86af3c81918ce427343a273156`未查看：当前Library没有受支持的读取/物化入口，本轮未重复尝试或猜测URL。
