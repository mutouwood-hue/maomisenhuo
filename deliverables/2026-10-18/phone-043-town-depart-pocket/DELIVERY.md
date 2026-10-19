# 手机043交付

已在 StepX PZ261A（ZYPZ261A01M65K0002A）保留数据覆盖安装 **0.4.3-town-depart-pocket / code34**。ADB `install --no-incremental -r` 返回 `Success` / exit0。安装前042/code33，安装后043/code34；appId仍为10191，firstInstallTime仍为2026-10-15 23:14:25。没有卸载、清数据、启动应用或操作吧唧。

完整记录：[MANIFEST.json](MANIFEST.json)。

## 静态根因与修复

小镇主循环依次执行 `serviceBridge → serviceSocial → updateCats/moveNPC → player.update`，原互动计时器确实会结束，问题出在结束后的路线与路径优先级。042的离开规划以 `occupied(goal,c)` 扫掠“当前位置到目标”的整条直线，用这个条件筛掉了部分本应转角绕行的道路图路线，又要求图路线首步就增加与伙伴的距离；失败时保留socialDeparture却清空path。下一帧moveNPC因为socialDeparture直接进入move并return，既无路可走，也不会进入普通寻路；重试继续受同样的前置筛选限制。主人结束互动后还直接恢复saved.path，可能重新朝伙伴所在方向走。

043把碰撞判断抽成明确起点的occupiedFrom，供移动与离开规划共用。离开规划逐段搜索实际可走道路宽度，允许合法转角，保留建筑、河岸、桥口及猫咪碰撞限制；每次搜索有900节点和8单位范围上限。可先走可达的分离进展，遇阻后从新位置重选；真实分开后再恢复旧行程。离开时不让自由活动、庭院环境活动、剧情或普通避让抢走路径。原10秒冷却值未增加，手动引导仍能接管。物理完全堵塞时仍等待可行空间，没有瞬移或穿猫。

行程抽屉原本只创建进度文字与操作按钮，没有行程清单和口袋数据投影；本次明确创建独立内容区，接入现有store返回的nodes/activity，以及getState的pendingWorld.items、inventory、catalog.items。显示实际路标及已走到/下一站/待前往，分别显示本次待带回和家中口袋。打开时及进度变化时刷新；无数据时给清晰空态。原牵绳散步的itemId就是null，因此说明“不采集物品”，没有为填充界面虚构物品或修改结算奖励。CSS明确内容区的栅格、文字颜色和滚动高度，标题栏有独立兜底。没有通过UI执行宣称重现了先前空白的所有像素条件。

圆环按下时原来主动focus SVG，样式没有区别触摸与键盘。043标记指针焦点并关闭WebView触摸高亮，触摸期间不画外围框；键盘输入清除该标记，保留可见焦点、slider语义、Tab和左右方向键操作。上轮拖动捕获与延迟重建修复保留。

## 构建、签名、安装证据

- APK：[catforest-0.4.3-town-depart-pocket-debug.apk](catforest-0.4.3-town-depart-pocket-debug.apk)，930,659 B。
- SHA-256：`1c5c2ecb2a8944194c0fc0d4767a811525303c8562dacb35af9d22e2b1f962d6`。
- 类型：沿用原交付流程的debug签名APK；没有改成商店release签名。
- applicationId：`com.catforest.htmlcandidate`；应用名：猫咪森活。
- 公共证书SHA-256：`3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`，与042及原038一致。
- 资源生产构建：[assets-build.log](assets-build.log)，exit0。
- Android离线生产打包：[phone-build.log](phone-build.log)，exit0；命令`:app:assembleDebug -x test -x lint`。
- 首次构建因沙箱禁止Gradle本地daemon端口失败；所需执行权限获准后同一命令重试成功，原失败记录保留在[phone-build-sandbox-blocked.log](phone-build-sandbox-blocked.log)。
- 公共签名和包身份：[phone-signature.log](phone-signature.log)、[phone-package.log](phone-package.log)。
- 覆盖安装：[phone-install.log](phone-install.log)，安装前后包元数据：[phone-before.log](phone-before.log)、[phone-after.log](phone-after.log)；汇总：[install-result.json](install-result.json)。
- APK静态资源索引：[apk-static-inventory.json](apk-static-inventory.json)。APK条目无增删，业务资源变化为本批六个JS/CSS，另有版本manifest/BuildConfig dex。相对042已安装包资源的差异：[043-changes-vs-042.patch](043-changes-vs-042.patch)。

构建源码只取当前隔离工作目录，基线b8ca479及已有未提交修复保留。仅复用上轮JDK/Gradle/Android SDK缓存与原证书，没有取旧main源码。只修改app及本交付目录；build_town新增可选证据目录，本次将其输出定向到本批目录，没有覆盖共享交付记录。没有git提交、push、reset或清理，没有构建或刷写firmware。

## 最短用户验收

1. 打开原存档，进入小镇。与居民互动后点“结束互动，继续散步”，或等待本次互动结束，观察两只猫能否实际走开；在转角处也看一次。点小路或“我来引导”应能接管移动。
2. 打开“行程与口袋”：应看到真实路标、进度及口袋内容；零库存应有空态文字。牵绳散步显示不采集物品，走完路标后点“完成”按原规则结算。
3. 今日环手指按住拖动并松开：外围不应再有方形光标，圆点、填色、时间与事件卡片仍应同步；如有键盘，可用Tab和方向键确认可见焦点仍保留。

本批未运行test、lint、自动交互、浏览器QA，也未启动应用进行实机行为验收。以上三项实际表现待用户确认，安装元数据不能替代存档或行为验收。

两张Library图片`libfile_f046e45fa04c81919541aafbc3c3de5a`、`libfile_d32b2efc0978819180fe5d55b9b5523b`未能读取：已按当前Library技能检查消费端入口，此环境仅有写入/上传能力，未提供读取、搜索或prepare_materialize入口。因此没有物化到Mac或看过像素，也未猜测URL或绕过拒绝；本次排查依据用户文字、源码与APK静态内容。
