# Android 备用验证交接说明

本机为优先路线。云端尚未确认具备可运行 Android 的虚拟化条件；没有把云电脑视为现成模拟器。本文不代表已上传 Library 或已在云端运行。

## 当前 APK

- 文件：`artifacts/2026-10-15-v02-runtime-baseline/catforest-android-0.2.0-debug.apk`
- 包名：`com.catforest.app`，Activity：`.MainActivity`
- 版本：0.2.0 / versionCode 2，debug 测试签名；最低 API 26。
- 已构建 SHA256：`a7cead045cd729ec6fcab8d76a932f17ffa1a3bb8a3ea7f8de4ca492bda1ffb8`。交接前必须重新核对实际文件。
- 本机唯一 API35 ARM64 AOSP 模拟器已原位安装成功；运行流程验收另见 `tests/android-runtime/artifacts/`。编译与安装不能代替功能通过。

## 云端若具备 Android 执行环境

1. 先确定唯一目标 serial、API、ABI 与实际启动状态；不能将 x86_64 主机和空 PATH 当成已具备模拟器。
2. 校验 APK 哈希后，以明确 serial 原位安装 `adb -s <已核实的目标> install -r -t <APK>`。已有数据不得 clear、uninstall 或 wipe。
3. 真实启动 `com.catforest.app/.MainActivity`。检查原始 3D 小屋/小猫、原生照料触摸、取消不扣费、20秒原始接鱼、强停后存档恢复及衣柜/背包/出游/诊所实际结算。
4. 不注入 JS 分数或修改私有存档，不接 mock BLE 冒充无线验收。保存实际截图、UI XML、日志、原始存档校验结果和准确 APK 哈希。
5. 不自动授予附近设备、位置、相机或麦克风权限，不连账号、不打开付费 API。云环境也不能替代真实手机/吧唧 BLE、屏触、掉电与功耗验收。

若本机确实无法继续运行，用户已允许通过正式 Library 工具上传 APK 和本说明。必须等上传工具确认返回 `library_file_id` 与实际摘要，再向主会话交接；不得以本地路径或预期 ID 声称上传完成。
