# 构建检查点

更新：2026-10-15 17:34 UTC+8。此为可恢复工作记录，不是完整产品验收结论。

## 当前确定证据

- 首版 APK/固件与哈希冻结在 `artifacts/2026-10-15-core-candidate/`，不覆盖。已发现存档静默提交失败仍 ACK 的 P1；旁侧 KNOWN-ISSUES 记录风险，首版只用于 UI/升级基线。
- v0.2 Android 已实际构建成功（23秒）；APK SHA256 `a7cead045cd729ec6fcab8d76a932f17ffa1a3bb8a3ea7f8de4ca492bda1ffb8`。原子存档读回/有效副本/本机恢复，原型衣柜、库存出售、Mf 出游与 Sf 诊所源码已汇合，待最终一致构建与运行证据。
- 固件第二轮目标构建通过，app.bin 2,005,056 B，SHA256 `0578681f37a23dd00981bfea6b4183aea4d4d0b3a5107151c72c408b13a82fef`。实际状态/设备/五点触控四页，21 项手势检查通过；并非完整 23 屏，未刷写。
- 协议生产主机回归实际通过 42 项、0 跳过；报告输入哈希全部与当前文件匹配。独立生命周期/存档故障恢复 4 项通过，另 world 迟到回应/取消 JS 2 项通过；原型生活规则生产 Kotlin helper 14 项通过。
- Tabbit 桌面原型真实 Mf 加载及 Sf 三工具操作通过，证据 `tests/visual-round2/`。原型图像与动作来自原件；并非 Android 或 BLE 验收。
- 唯一官方 AOSP API35 ARM64 模拟器已启动：CatForest_API35 / emulator-5556，2核/1536MB。首版 APK 已实际 install-r/start，真实存档校验通过，3D小屋与小猫截图已检查；附近权限未授予。证据 `tests/android-runtime/artifacts/v01-baseline/`。

## 正在执行

独立 QA 原位升级 v0.2、保留存档，运行照料/取消/20秒游戏/重启恢复及新原生流程。输出 `tests/android-runtime/artifacts/v02-core-and-native/`。不清数据、不授予权限、不用假分数或伪造 BLE。

执行服务偶发 transport disconnected；曾出现命令实际上完成但返回断连。后续操作必须先读回日志、文件或实际状态再决定是否重试，不能仅凭工具异常重新安装、下载或写入。

## 剩余闸门

- 最终一致构建、APK验签和新增 evidence 打包；初版目录不变。
- 吧唧实际活动场景需产品确认 `protocol/proposals/activity-feedback.md`，独立评审特别指出旧 NVS 迁移/降级风险与不存在真实返程中阶段不能补播。冻结 v1 未改。
- 完整 PRD 差距见 development-status；未获准删减。真实手机、BLE、吧唧屏触/掉电/功耗尚未验收。
- 硬件最早20:00 UTC+8。接入后先记录准确设备/串口/现有存档与恢复方案，取得明确写入授权；不擦 NVS、不自动授权。
