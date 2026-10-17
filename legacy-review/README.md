# 旧 Android 源码只读复核

阅读入口：[COMPARISON.md](COMPARISON.md)。需求以修正后的 `小橘电子宠物.html` 和用户“不需要云、仍需要真实吧唧连接”的最新说明为准。

原归档保留在项目根目录，隔离副本位于 `source/warm-paws-town`。本轮只写审查记录，未修改副本内容、主工程、设备或数据。

| 记录 | 内容 |
|---|---|
| [COMPARISON.md](COMPARISON.md) | 遇见、图鉴、设备界面的具体差异；去云边界；复用与迁移建议 |
| [archive-inspection.json](archive-inspection.json) | ZIP 路径/规模检查、原包摘要 |
| [source-comparison.json](source-comparison.json) | 旧/新 HTML 脚本摘要、生成资源一致性、工具目录核对 |
| [ui-source-audit.json](ui-source-audit.json) | 三个旧面板的静态控件统计、逐文件未修改证明 |
| [syntax-results.json](syntax-results.json) | 34 项 JS 语法检查通过 |
| [node-test-summary.json](node-test-summary.json) | 65 通过、4 失败，缺夹具或依赖 |
| [node-tests.tap](node-tests.tap) | 原始测试输出 |
| [build-input-audit.json](build-input-audit.json) | 缺失夹具与 Capacitor 工程引用 |
| [web-build-attempt.json](web-build-attempt.json) | Web 构建实际尝试：静态导入缺 esbuild |
| [android-device-protocol-comparison.json](android-device-protocol-comparison.json) | 另一集成线程补充的旧/新协议静态对照，不能混接 |

本轮未完成运行截图、干净 Android 构建、安装或 BLE 实连验证；旧包历史验证文档不是本轮验收结果。
