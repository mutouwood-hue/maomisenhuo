# Native host_context 接续修正报告

## 范围与验证
- 已读取共享 PROTOCOL、原交接、相关 Native 桥/Activity/Service 与 Manifest。
- 本次仅修改 LocalV2BleBridge.java 和本交接；未修改 JS、Manifest、构建脚本、存档、绑定、结算、收据。
- 最终普通静态编译完成：JDK 21.0.12.1+1 javac，`-encoding UTF-8 -source 17 -target 17`，Android35 android.jar，全部7个Native Java + 已有生成 BuildConfig.java，退出码0。
- 编译输出：android/app/build/native-context-javac。仅 source17 系统模块路径与既有 deprecated API 提示，无编译错误。
- 未业务测试、设备测试、安装、刷写、清档或git。完整APK编译/签名由主代理安排；javac不代表设备验收。

## 已完成修正
1. 当前磁盘已不存在heartbeatTimer引用；替换旧pause心跳/租约分支，未新增周期state、45s应用租约、WakeLock或权限。
2. 完整出站care_capabilities记录该flight的clientId/mobileContextV1；仅同当前flight id/op成功回复、已核验deviceId、对应clientId、confirmed=true/mobileContextV1=true且出站明确支持，才开启Native host_context。hello/state非相关clientId不再冒充授权。
3. 单flight严格只有一条完整UTF-8 NDJSON行；LF须为末字节，完整命令不得续写第二行或部分尾行。唯一原GATT写通道不变。
4. 后台完整原reply与GATT完成后releaseObservedFlight保存releasedFlightId，清flight草稿并drain待处理request。迟到旧endFlight只消耗旧标记，不释放新flight；标记未消费前禁止复用同wire id。
5. host_context至多一pending/一写出；设备generation/counter安全整数、同连接generation稳定、counter单调。endConnection重置上下文generation/counter、pending、reply、flight草稿/释放标记及watchdog。
6. request排队35s后丢弃未提交request，不踢闲置连接；context写10s/GATT写10s；JS flight35s；等待begin10s；部分入站行35s；通知请求35s、FGS启动10s。均单次生命周期watchdog，非周期保活；完成/超时/断连有界清理。
7. 同一入站notify batch完成全部framing后才drain，避免完整request后紧邻部分行或原reply时交错写出。
8. 定位只读已有授权last-known：拒绝mock/无效坐标精度/未来时间，wall-clock及elapsed均严格<=120s。无后台位置授权后台在LocationManager调用前返回unavailable；不请求位置权限、不启动GPS。时间可后台响应。
9. user_stopped在连接已空的后续onPause/cleanup中保留，getConnectionState/lifecycle不丢显式停止证据；用户显式开启新retention才清reason。

## 不变项与验收边界
- Service不持有第二GATT，START_NOT_STICKY；任务移除/Activity销毁不承诺复活。
- Manifest无修改，已有定位/录音权限非本次新增；无ACCESS_BACKGROUND_LOCATION/WakeLock。
- 后台普通reply仅有界缓存供JS前台恢复；Native不ACK、不结算、不分配mutation seq，不动journal/NVS/绑定。
- JS主代理负责同connection generation一次能力确认、回前台getConnectionState evidence.generation校验、user_stopped禁自动恢复。
- 深睡Handler可能延迟；没有持续唤醒或45s应用租约要求。仅源码编译通过，不宣称锁屏或定位实机可靠性。
