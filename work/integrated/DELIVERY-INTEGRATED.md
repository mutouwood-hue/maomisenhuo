# 历史归档：初次成套集成交付

本文保留初次集成时的产物大小和验证声明，表中数据不是当前 041/056 修复交付物。当前交付以 [修复交付记录](DELIVERY-2026-10-18-REPLAY-FIX.md) 和 [当前 MANIFEST](../../deliverables/2026-10-18/hearts-replay-fix/MANIFEST.json) 为准；040/055 旧实物的纠正身份见 [原始功能批次记录](DELIVERY-2026-10-18.md)。不将历史的 700,204 B / 6,884,208 B 改写成新产物数据。
生成脚本：[package-integrated.py](package-integrated.py)；两端合成过程见 [DELIVERY.md](DELIVERY.md)。

## 交付内容

| 文件 | 说明 |
| --- | --- |
| `catforest-integrated-full-source.zip` | `app/` + `firmware/` 全量项目源码，含 README、共享协议、集成脚本与验证日志 |
| `catforest-app-release-unsigned.apk` | 集成后移动端发布包（**未签名**，700,204 字节） |
| `cat_forest_badge.bin` | 集成后吧唧固件应用镜像（ESP32-S3，6,884,208 字节） |
| `focused.log` / `assets.log` | 手机侧：构建脚本与 8 组回归日志 |
| `host-live-drag.log` / `host-day-draw.log` | 吧唧侧：跟手拖动、今日环预览绘制主机测试 |
| `syntax.log` / `syntax-results.json` | 吧唧侧：Xtensa 生产 C 文件语法检查 |

源码归档按用户要求不做哈希核对、不生成备份；`firmware/managed_components/`（约 230 MB 的 ESP-IDF 组件缓存）与各 `build*/`、`.gradle/`、`node_modules/` 不进入归档，组件版本由 `firmware/dependencies.lock` 钉定，可离线复原。

## 原记录中的验证结果（历史声明）

| 项目 | 命令 | 结果 |
| --- | --- | --- |
| 手机全量聚焦回归 | `python work/integrated/test-phone.py` | **79/79 通过**（8 个 test 文件，exit 0，11.07 s） |
| 手机资源构建 | `python app/scripts/build_assets.py` | exit 0 |
| 吧唧跟手生命周期 | 主机测试（纯 C 生产函数） | `PASS: production drag object lifecycle + gesture contract` |
| 吧唧今日环预览绘制 | 主机测试（host fixtures） | `PASS: production day preview drawing + absolute cursor invalidation` |
| 吧唧语法检查 | `-fsyntax-only`，5 个生产 C 文件 | 5/5 exit 0（`badge_pages.c`、`badge_gesture.c`、`local2_core.c`、`local2_wire.c`、`local2_ble.c`） |
| 吧唧完整构建 | `build-badge-windows.py --source R:/firmware --build R:/work/integrated/badge/root-build` | 成功出镜像：`Successfully created esp32s3 image` |
| 固件分区余量 | `check_sizes.py` | 0x690b70 / 0x800000，**剩余 18%** |
| Android 发布打包 | `gradle :app:packageRelease -x lintVital*` | exit 0，产出 `app-release-unsigned.apk` |

吧唧构建使用隔离 SDK 环境（独立 PATH/PYTHONHOME，cmake 子进程 cwd 指向其 bin），绕开旧本机上 `configure` 崩溃（0xC0000409）的宿主环境问题；脚本见 [build-badge-windows.py](build-badge-windows.py)。

## 未完成 / 不算验收的部分

1. **APK 未签名**：需用原证书签名后安装；本次未新建签名证书。
2. **未刷写、未安装、未重绑**：手机与吧唧上的现有数据、绑定关系、存档均未被触碰。
3. **无实机结论**：实际触摸手感、帧率、功耗、双吧唧相遇、20GLB 原包使用、OEM 省电/锁屏行为都未验证，源码与主机测试不能替代。
4. **浏览器预览验收未完成**：预览打开与后续读取超时，未计入浏览器体验验收。
5. **跨仓/hardware 受限项**：上层黑客松参考项目的动效语义（vertical cover fade 等）与当前双页 push 属于设计差异，未擅自改动。
