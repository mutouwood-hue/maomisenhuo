# 运行验收恢复交接

时间：2026-10-15 17:55 UTC+8。完整 PRD 与 P0 实际闭环尚未验收完成。

## 已确认

- v0.2 APK 实际构建、v2 验签通过。1,987,370 B，SHA256 `a7cead045cd729ec6fcab8d76a932f17ffa1a3bb8a3ea7f8de4ca492bda1ffb8`。本地文件 `app/android/app/build/outputs/apk/debug/app-debug.apk`。
- root 在准确核实的 CatForest_API35 / emulator-5556 上唯一一次 `install -r -t` 返回 Success；没有 clear、uninstall、wipe 或权限授予。独立 QA 从模拟器读出的 installed-base.apk 与本地 APK 字节哈希完全一致。
- 独立 QA 校验升级后实际存档：SHA 有效，原 UUID `43df3fb2-da03-4950-89f6-949901c1a5b0`、revision0、coins30、xp0、照料计数与五项数值均保留。证据 `tests/android-runtime/artifacts/v02-manual/installed-apk-verification.json`。
- 首版真实启动与 3D 小屋/小猫截图已独立查看通过，证据 `tests/android-runtime/artifacts/v01-baseline/`。新版截图未能读取确认，不能借用首版结论。
- 最新串行日志读回：协议42项、生命周期/故障/桥接6项、原型生活规则14项、手势21项均通过；目标固件与 APK 构建、镜像/验签通过。对应 logs/*regression*。
- 固件第二轮 app.bin 2,005,056 B，SHA256 `0578681f37a23dd00981bfea6b4183aea4d4d0b3a5107151c72c408b13a82fef`。从未刷写。

## 工具阻塞，非待用户确认权限

最小只读 probe 多次实际成功；随后反复 `exec-server transport disconnected/closed`，最终连本地图片/文件读取也返回 initialize handshake 超时。部分自动审查另有 deadline 超时，回执不是安全性拒绝；没有已知待用户点击的审批。不要要求用户为连接问题修改权限。

root 短单条 ADB 调用曾成功，子任务大型脚本及最小启动命令均发生审查超时。`login:false` 的短只读命令曾恢复，但不是已证实的根因修复。

按用户授权尝试正式 Library batch 上传 APK+`docs/android-cloud-verification.md`，在读取第一个本机文件前被同一 exec-server handshake 超时拦截。无 library_file_id、无已确认上传，不得编造。

## 恢复后顺序

1. 最小只读 probe；先核对此前不确定命令的日志/文件，避免重复安装。实际新版已装好。
2. 明确 `-s emulator-5556` 核对同 AVD，保留数据盘；若进程确已丢失再用 `scripts/start-android-emulator.py`，禁止并发实例或 wipe。ADB 活着时不迁移/重启 server。
3. root 接管短 ADB 实际动作，QA 仅独立读取 PNG/XML/envelope 断言。待做新版启动画面、摸摸/取消/20秒接鱼、强停恢复、衣柜购买装备、背包出售、真实 garden 三节点结算与诊所三工具收费。清单 `tests/android-runtime/V02-ACCEPTANCE.md`。
4. 最终构建记录曾误将生成的 `firmware/tools/latest-gesture-report.json` 计入源码，导致检查结束后记录未更新；已修脚本排除此生成报告并在源码变化时落失败记录。修后复跑命令因连接故障未确认执行。必须重新运行 `scripts/build_candidate.py` 并核实新的 build-result.json；不能拿旧 passed 记录打新包。
5. 新证据完成后 package_candidate.py 输出独立 round2 目录。首版 frozen 目录不改，旁侧 KNOWN-ISSUES 已明确首版存档 P1，不作真实 BLE 验收。

## 产品/硬件闸门

实际出游/照料的吧唧活动字段提案与独立 NVS 迁移评审已写；冻结 v1 未改，需主产品负责人确认契约。当前原型无“返程中”真实阶段，不能补播完成态冒充实时返程。

硬件最早20:00 UTC+8；仍需准确手机/板卡/端口、备份与恢复方案及明确写入授权。完整23屏、家庭/毕业、多板社交、云AI等仍未完成；没有用户批准删除。缺失独立GLB、导出工具、触控引导、旧固件仓/历史报告仍以来源缺失表为准。
