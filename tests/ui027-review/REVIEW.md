# UI027 独立审查

## 结论

**可由唯一设备集成者安装独立 `com.catforest.worlddemo` 包，进行限定样段验收。** 无本轮确认的 P1/P2。此结论不是正式026替换、真实相遇消费者、双设备协议或完整世界验收。

- APK 1,065,138 B，SHA256 `8952dd53140106b309abce79688cf0cebfa89b7623c62002e5c7c69e27075e0a`；ZIP 180 文件，SHA256 `67a51e7ffc71fe62ea6b0083f8d2ebe53be5e83742ccb85452e24a1d093257cb`。
- 独立读取编译后 Manifest/badging：独立 applicationId、唯一 WorldDemoActivity 启动入口、无 uses-permission/sharedUserId/正式 MainActivity 注册。签名 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`，验证及对齐通过。
- 180 源文件、ZIP 全部源、APK 40 资产逐字一致；读后仍冻结。原 Java/Native authority、care-runtime、adapter、transport、durable/event/scene 源保护清单逐字026。
- 独立反向应用 manifest 声明的15个唯一锚点与一个仅演示入口导出，八段原游戏全部逐字回到026。

## 活动入口与数据边界

WorldDemoActivity 关闭 DOMStorage/file/content/地理权限与弹窗，无 JavaScriptInterface/WebMessage/Native bridge 或外部 Intent 路径；资源仅同独立 origin 的 `/offline/` 单文件白名单，CSP connect-none。真实 APK 内仍包含继承的旧代码/资产，不能表述为“包中没有任何桥代码”；这些不是本入口注册或加载的 Native 能力。

world-demo.html 最先执行内存 prelude，不加载正式 Host、Native、adapter、transport、durable、event 或 scene-sync。独立用例以会抛错的真实 Storage getter 验证零读取；新 window 不保留上次私有 Map。生产端口对含 native-looking peer_complete、gift、NPC 的输入均拒绝，不能把拒绝门当已实现持久去重/领奖/ACK。

模拟成长只作用渲染几何；原 completeMeet/worldGrow/NPC 提前阻断。街道入口不创建奖励 token，小花园仍用原内存规则。异步街道加载有 generation/foreground 检查，后台/迟到/失败不反跳；单 RAF、资源释放和返回路由有源码及定向测试支持，尚不是 Android 生命周期实测。

## 实际执行与证据

- `python3 tests/ui027-review/verify_readonly.py`：包/保护字节/签名/编译 Manifest，通过；细节和183个元数据/源 pins 在 readonly-report.json。
- `node --test tests/ui027-review/independent.test.cjs`：3/3，通过，无跳过。独立八脚本反向字节、活动加载图、恶意 Storage getter/新窗口/拒绝端口边界。
- 原候选 world-demo/world-renderer/street-scene 三套定向测试独立重跑：15/15，通过，无跳过；使用实际原 vu/Ef/房间函数及显式 DOM/GL 替身。
- Owner 全量315及360/390桌面 WebKit图只作为 owner 软件证据。本次未重跑315、未安装、未设备操作。

## 安装后必须另验

原屏/360布局和示例标签；模拟→跳引导→空间/窗景；街道实际点地→原花园→回家；加载中后台与返回；重复前后台不多循环；退出重开重置样例。正式026存档不读取/复制、不调用BLE。新房间无新增行走区/照料点、街店仅景观、完整新世界和真实端口仍未实现。当前软件测试不证明 Android GPU/FPS/触控、后台稳定或实际权限释放。
