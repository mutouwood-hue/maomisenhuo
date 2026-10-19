# 手机045：仅修模式自动重置

已向 StepX PZ261A 保留数据覆盖安装 **0.4.5-sticky-guide / code36**，ADB返回`Success`/exit0。原证书、包ID、名称保留；appId仍为10191，首次安装时间仍为2026-10-15 23:14:25。没有卸载、清数据、启动应用或操作firmware/吧唧。

[APK](catforest-0.4.5-sticky-guide-debug.apk) · [完整记录](MANIFEST.json) · [构建日志](phone-build.log) · [安装日志](phone-install.log) · [安装前后元数据](install-result.json)

## 发现与最短修改

044仍有三个自动模式写入点：`finishOwnContact`恢复`saved.mode`，`updateAmbient`完成时写`free`，每次`begin`既写`free`又调用`setMode('free')`。本轮删除这些赋值，场景重进和动作结束只清理执行状态，保留用户模式。内部居民互动不再借用`setMode('guide')`临时阻止漫游，而是在已有free寻路条件中排除当前互动。

另外，044按钮在`mode==='guide'`时显示“自由活动”，表示下一步可切换的动作。开启引导立即看到这段文案，是确定的显示行为，却不等于内部模式已经回退。本轮统一为“**引导中 · 切回自由**”或“**自由中 · 我来引导**”，并同步可访问状态；未改CSS或视觉布局。

现在运行中的模式赋值只在`takePlayerControl`的显式模式参数入口。它默认不改模式；用户切换按钮和手动目标才传入模式。初始化、tick、结束回调均不再传入`free`。详见[修改前模式写入](mode-writers-before.json)、[修改后赋值点](mode-writers-after.json)和[相对044代码差异](045-mode-changes-vs-044.patch)。

未发现iframe/postMessage或原生场景回投写入该词法私有模式。小镇在同一WebView内直接创建；`show → begin`原本会重置。原生onResume调用Host.resume，不reload；场景projection只发布状态。没有找到每帧无条件写free，因此不能把所有用户反馈都断言为同一条回调已在手机重现。

**初始化边界：** 同一页面中的回家重进、前后台和动作结束保留模式。控制器首次创建仍默认自由；本轮没有新增偏好存档，若Android销毁整个WebView形成全新页面，会重新创建初始状态。

## 构建与范围

- 沿用原debug签名交付流程，APK933,051 B。
- SHA-256：`24df810674b69dc30de97f24e149107b9c892f272029a58b4cc8a2fd0a911d04`。
- applicationId：`com.catforest.htmlcandidate`；名称：猫咪森活。
- 公共证书SHA-256：`3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`。
- [资源生成](assets-build.log)、[离线Android打包](phone-build.log)均exit0，命令`:app:assembleDebug -x test -x lint`。
- [公共签名](phone-signature.log)、[包身份](phone-package.log)、[安装前](phone-before.log)、[安装后](phone-after.log)记录齐全。
- [范围记录](unchanged-scope.json)：圆环/今日生活源码、CSS、资源生成器未变。本轮不改寻路、让行、冷却、奖励和其他功能；[APK静态目录](apk-static-inventory.json)记录实际变化。

保留b8ca479隔离目录中的全部既有改动；只修改app与本独立交付目录。旧目录仅复用工具缓存及原签名，未取旧main源码。没有Git提交/push/reset/清理。

## 用户最短验收

1. 开启“我来引导”，确认按钮显示“引导中 · 切回自由”；等待并点地面换目标，观察是否保持。
2. 同一页面内回家再进小镇，或前后台后重新进入，确认仍为引导中；动作结束不能自动改成自由。
3. 主动点“切回自由”后，才应显示“自由中 · 我来引导”并恢复自由活动。

没有运行test、lint、技术测试、模拟/自动交互或浏览器QA，也未启动手机应用。实际模式保持表现交给用户验收。
