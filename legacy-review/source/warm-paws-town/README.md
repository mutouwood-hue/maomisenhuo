# 暖爪小镇移动应用

## 范围与架构

- 从用户提供的完整 HTML 迁移，不重新绘制、不删减原有游戏逻辑。
- 技术栈：原生 JavaScript / CSS + Capacitor 8，非 React/Vue。前端规范 §1 按原生事件、职责、错误态映射；§2 不适用；中文单语产品不引入国际化框架。
- 设计入口是原始 HTML 中已加载的内联样式及 `:root`；保留原作多阶段移动布局，不引入或合并 CDS token。
- `original/game.html` 是只读输入快照。构建拆分脚本并保留顺序，原生能力由独立 `src/native/bridge.js` 接入；UI 修复放在 `src/mobile/`，接线在所有原作样式和脚本之后，不改快照。
- 移动适配将房间信息分区排布，增加独立于户外抽屉的常驻回房间按钮；生活面板处理短屏标签、卡片对齐和时间环长文本省略，完整文本与生活数据保留。
- 构建仅在生成 CSS 中将安全区 `env()` 接到 Capacitor 注入的 `--safe-area-inset-*`（保留浏览器回退）；弹层视口统一避让手势区，不改变原作快照。
- `www/` 为离线网页资源；`android/` 为原生工程。未来可增加 Capacitor iOS 平台，仍需 macOS/Xcode 编译和签名。

## 本地构建

使用 Node 22+ 与 pnpm，先 `pnpm install`，再 `pnpm build`、`pnpm exec cap sync android`。

首次安卓工具链：依次运行 `scripts/setup-toolchain.ps1` 和 `scripts/setup-stable-sdk.ps1`（官方 JDK 21 和 Android command-line tools 19.0，验证下载校验值）。最新版命令行工具在本机遇到 Android CLI 解包故障，因此构建固定使用稳定 sdkmanager 19.0。工具只放在工程 `.toolchain/`，不修改全局 PATH。

运行 `scripts/build-android.ps1` 安装 SDK 36、构建 debug APK 并运行 Android lint。首次安装 SDK 时需在交互终端审阅并接受相关许可；当前工程环境已安装所需 SDK，后续构建直接复用。

测试：`pnpm test`；`node scripts/web-smoke.mjs`（需 `pnpm exec playwright install chromium`）。UI 体检：`node scripts/ui-audit.mjs --phase=regression`，覆盖三个手机尺寸、横屏与桌面，并输出独立报告和截图。`scripts/device-ui-smoke.mjs` 仅供用户授权后的已连接 debug WebView 真机回归；运行前需对目标 WebView socket 建立 ADB 端口转发，不清空或替换存档。

## 安装和保存

- APK 是本地试玩 debug 签名包，不是商店发布包。
- 同包名同签名覆盖安装应保留本机存档；卸载或清除应用数据会删除存档，请先通过存档菜单导出。
- 原有网页版存档不会自动迁移到 App，请在网页导出 JSON 后在 App 导入。
- 原游戏保持 localStorage 持久化；安卓关闭系统自动备份，避免生活定位与用户填写的 API 密钥被自动云备份。
- 游戏 JSON 导出和体验数据导出改走系统文件分享，导入保留系统文件选择器。

## 权限、隐私与联网边界

- 定位默认关闭。先授予前台粗略/精确位置，再独立同意后台记录：Android 10 单独权限弹窗，Android 11+ 到系统设置选“始终允许”；拒绝则仅前台，不伪造未记录时段。
- 后台由原生 LocationManager + location 类型前台服务拥有，不依赖 WebView 或 JS timer；常驻通知可停止并清除待处理位置。通知权限拒绝时系统可能只在任务管理器显示服务，UI 明确提示。
- 队列在 noBackup 私有目录原子持久化，绑定登录账号及 generation，最多七天 / 10080 条；溢出次数可见。WebView 恢复先验证会话归属，实际本机落盘后才确认删除原生样本。无会话、撤回、清除、注销停止服务并清空待处理坐标。
- 不自动开机启动，不在 force-stop 后自启；省电策略、系统回收、定位关闭可能造成真实未知缺口。再次启动需用户在前台明确开启；计步仍仅前台 TYPE_STEP_COUNTER 首读建基线，不把开机累计量当全天步数。
- 原作演示日程/地点/步数由独立 adapter 禁用；真实常去卡至少两次独立十五分钟停留，无数据为空态。原基础庭院、公园是游戏场景，不是实际到访证据。
- 麦克风独立授权，不后台收音；文字逐条明确同意发送，公司模型密钥仅后台环境变量。前端不接受/保存 provider 密钥，无配置明确 OFFLINE。
- 云端完整家庭存档 CAS，冲突本机备份；原始坐标与音频不上云/设备，生活数据仅白名单摘要。埋点仅登录后台、持久批次重试。
- AI 场景必须真实两次到访，当前授权、后台有效期均有效；清除/撤回/切账号立即失效异步结果与缓存。
- 验证：Node 回归、真实 HTML + SQLite HTTP、Android 编译/lint；这些不是实际无线/传感器/后台持久在线的真机证据。后台权限、通知停止、省电、force-stop 在 API 24/29/30/34/35 真机仍需用户授权验收。
- Android 官方权限说明：https://developer.android.com/develop/sensors-and-location/location/permissions/background

## 未完成的发布事项

正式分发还需要独立 release 签名、隐私政策、第三方引擎/资源许可核对、真实设备权限与性能回归。iOS 尚未构建。
