# 今晚联调交接（更新于2026-10-15 20:00 UTC+8）

## 可安装候选

目录 `artifacts/2026-10-15-v03-candidate/`，Android0.3.0/versionCode3，2,505,046字节；SHA256 `a73f7872fa9712a57e9a1f55e728067631e2e7d193055dc743d0af5878fa32a9`。固件工程版本0.1.0，第二轮app2,005,056字节；SHA256 `0578681f37a23dd00981bfea6b4183aea4d4d0b3a5107151c72c408b13a82fef`。boot41958b…、partition59c9be…，App实际偏移0x30000。完整摘要及布局见候选manifest和设备备份文档。

当前生产源码/派生资产与11:31UTC串行构建记录一致：10项构建与检查通过（42协议、8生命周期、20玩法、21手势、14反馈）；不可用先前旧passed记录替新源码出包。

## 实际运行证据

- 最终a73 `v03-final-acceptance`：升级/启动/诊所3pass；随后的散步首次探针未等异步提交而错报None，failurecapture实际已保存butterflycare。原失败原样保留。测试加真实存档轮询后，同APK在`v03-final-functional`自然rain真实scrub→三路标→回家结算、20秒接鱼score2、强停3pass。
- 最终a73 `v03-final-core`7pass：取消照料/游戏、后台、非法名字、无权限搜索拒绝、强停；未授予权限。
- 最终a73 `v03-final-feed`：真实食碗3次点击，完整回家后才40→37币、XP60→68，饱食约6.5→30.6，逐口未预奖。
- 最终a73补拍`v03-final-wipe-current`、`v03-final-wipe-actual-cancel`：猫脸可见/取消在右下；真实取消仍湿/choice空，再真实scrub才dry，未完成散步取消无奖励。演出层aria-hidden使取消按钮未进入无障碍树：已按真实截图坐标触摸验证，仍不算屏幕阅读器通过，P2保留在候选README。
- 中间b54录屏及精确时间帧独立确认短暂受惊姿态→既有树下→布随输入→眯眼/抖毛/回场；该版取消仍遮脸，不能将其录像当a73。视频逐文件来源在`v03-videos/provenance.json`；近似取帧重复首关键帧已排除，exact帧有actual CMTime。
- 先前v0.2的15项实际流程/独立复核仍保留；不混到最终APK的摘要下。完整事件9选项与8照料视觉矩阵尚未全实际跑完，映射/单元通过不能代替。

以上目录均在`tests/android-runtime/artifacts/`。首版0.1冻结候选有SilentAtomicFile P1，只作历史UI/升级基线，旁侧KNOWN-ISSUES不可移除。

## 唯一模拟器与工具现状

继续使用CatForest_API35 / emulator-5556、API35 ARM64 AOSP、720x1280、software GPU、2cores/1536MiB；保留原userdata。不另建AVD、不wipe/clear/uninstall、不重启ADB server。原猫UUID一直为`43df3fb2-da03-4950-89f6-949901c1a5b0`；当前已通过真实玩法成长到少年猫，状态不是最初30币/XP0。不要以初始数值覆盖。

此前exec-server/auto-review deadline间歇故障不等同安全拒绝，部分命令失败回执前实际已执行，重试前查日志/文件。当前短`login:false`工具及root ADB实际工作；没有证实GPU是根因。

## 用户设备接入

用户正在带设备回家，尚未确认实际连接/手机型号/板卡/端口。`scripts/identify-devices-readonly.py`与`docs/device-backup-recovery.md`已准备且未执行识别。只读OS列表不打开串口；esptool串口识别可能复位，需要针对该端口的明确授权。当前IDF5.5.5实际esptool4.12.0，不能套v5命令拼写。

确认实际32MiB和安全模式后，另获两次完整read_flash授权、校验长度/哈希/逐字节一致并报告恢复限制；**当前fullflash备份不存在**。备份完成后仍需展示准确候选/覆盖地址/旧NVS风险并取得该设备独立刷写授权。无erase、无eFuse操作，原设备NVS/配对/存档布局未知。手机调试/权限/配对弹窗由用户操作，任何签名冲突不得自动卸载清数据。

## 其他阻塞与后续

私人Library上传：用户已直接明确允许指定a7cead…的v0.2 APK和交接说明两个文件，授权保留。官方helper使用有效CA重试仍在prepare前报`Library prepare_uploads is not available`，没有传输确认/Library ID；不换隐藏接口绕过，不再索要同一授权。

活动字段提案`protocol/proposals/activity-feedback.md`仍待PM确认，冻结v1未改。当前原型没有真实‘返程中’阶段，不补播历史结果冒充实时。完整23屏/家庭毕业/多猫/好友与云AI等缺口继续见开发状态；独立GLB、导出工具、触控引导及旧固件仓仍缺。定位/环境/麦克风/儿童信息保持默认关闭，无付费API、凭据、推送或发布。

旧17:55工具阻塞交接保存在`docs/history/runtime-blocker-1755.md`，不再代表当前运行状态。
