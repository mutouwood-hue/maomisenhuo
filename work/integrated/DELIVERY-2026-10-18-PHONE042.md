# 手机042交付：圆环拖动、小镇互动退出、名称图标

已向 StepX PZ261A 覆盖安装 `0.4.2-touch-town` / versionCode 33，ADB 返回 `Success` / exit 0。本批只交付手机；吧唧仍沿用上一批056，本次没有构建或刷写吧唧。完整身份与日志索引见 [MANIFEST](../../deliverables/2026-10-18/phone-042-touch-town/MANIFEST.json)。

## 静态确认的代码问题

1. 041 APK内相关资源与当前源码一致，排除了本次已读部分“只改源码未打包”的情况。圆环旧逻辑延迟捕获指针，初始位移未通过切向阈值即放弃；`hostSelectDayTime` 重建触摸命中的SVG子节点，而全局 `lostpointercapture` 只按pointerId清除拖动，不区分捕获元素。页面完整重建还会移除SVG本体，恢复选中画面不能恢复原捕获。
2. 原社交代码已有900ms NPC互动、主人互动硬截止、猫对冷却，不能说完全没有结束计时。实际缺口在结束后：只尝试直线散开，窄路/转角失败会丢掉路径；短暂离开计时结束后即使没分开也会返回自动社交分支，猫对冷却无法阻止轮流换伙伴。居民卡片又使用core模式，`town-guide-layout.css` 会隐藏包含“我来引导”的world-top。

这些是源码可确认的中断/重复路径；本批没有用运行测试宣称重现了每一步。四张Library截图未能从当前环境读取为本地文件，未查看像素，未据图作判断。

## 修复差异

- 从按下轨道起捕获稳定SVG根节点，只在实际捕获者失去捕获时结束；圆环区域由slider拥有手势，环外正文保持原滚动。移除首段方向淘汰，移动按一帧一笔更新，释放时提交最终坐标；页面整体重建延迟到释放后。
- 圆点、内外填色、时间与事件卡片继续由同一个 `hostSelectDayTime` 更新。未来时间仍是期待态，未借用历史事件；未改生活时钟、存档或同步来源。
- NPC互动结束后进入明确的离开状态，加上每只猫10秒冷却和猫对“已经分开”门槛；直线失败则使用同岸原道路图，对整段路线取样避开桥面及出入口。等待真实分开时不再接近即触发新互动，并按有限频率重选离开路径。
- 居民卡片不再隐藏引导；点“我来引导”或小路可结束互动并接管自己的移动。原剧情事件的阻塞语义保持，没有改奖励、好友存档或设备协议。

## 名称与图标

launcher/application label 为「猫咪森活」（`@string/app_name`），应用ID仍是 `com.catforest.htmlcandidate`。图标复用 `assets/rendering/cat-idle.png` 的透明小猫，裁切后确定性缩放；自适应图标为透明前景配 `#B8D3B3` 森林绿背景，并提供各密度普通/圆形fallback。没有小字、白色背景方块、下载素材或付费图像调用。

资源位于 `res/drawable-nodpi/ic_launcher_foreground.png`、`res/mipmap-anydpi-v26/ic_launcher*.xml`、`res/mipmap-*/ic_launcher*.png`、`res/values/strings.xml` 和 `colors.xml`；manifest改用这些资源。名称和图标没有另开版本。

## 实际产物与安装

- 文件：`deliverables/2026-10-18/phone-042-touch-town/catforest-0.4.2-touch-town-debug.apk`
- 类型：原证书签名的debug APK；版本 `0.4.2-touch-town` / code33；大小 992,097 B。
- 完整 SHA-256：`437eb707e1ae59902d3a500d4a4b150df510cc5af3ebc121fc041c6b35a67ce6`。
- 公开证书 SHA-256：`3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`，与原041交付和原038证书一致；未创建或输出凭据。
- 资源生成 exit0；离线 `:app:assembleDebug -x test -x lint` 构建 exit0。日志位于同一交付目录 `assets-build.log`、`phone-build.log`；签名/包名/标签元数据为 `package-identity.json`。
- 静态复查补齐整段路线的桥口保护后，在同一042版本完成最终构建和覆盖安装；初次日志保留为 `phone-build-initial.log`、`phone-install-initial.log`，上表SHA为最终包。
- `adb install --no-incremental -r` 返回 `Success` / exit0。设备从041/code32升为042/code33，appId仍为10191、首次安装时间仍为 `2026-10-15 23:14:25`。记录为 `phone-before.log`、`phone-install.log`、`phone-after.log`。没有卸载、清数据、重绑、读取游戏存档或启动应用验收。

## 用户最短验收

1. 在桌面确认名称「猫咪森活」和新的森林绿小猫图标，再打开原存档。
2. 今日环按住彩色轨道沿环拖动：观察圆点、填色、时间和事件卡片同向更新；拖到未来应显示期待态，松手后保留选区，“回到此刻”恢复实时。
3. 小镇观察一次居民互动结束后离开；未分开及冷却期间不应立即重开同一互动。互动中点“我来引导”或小路，应能直接结束并带路，桥口不应因社交停留。

本批没有运行技术测试、自动化套件、模拟交互、浏览器QA或设备交互验收。上述行为结果待用户确认。吧唧滑页与UI将留待后续同批调整，相遇双端流程也未在本包补齐。上轮修复和旧040/055、041/056产物均保留，main未改动，修改未提交/推送。
