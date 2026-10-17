# 013 Native durability / 事件事务独立复核

## 放行范围

**本轮未发现可复现的 P1/P2 阻塞项。可以由唯一设备集成线程执行保留数据安装并开始真实验收。** 这不是落盘/进程终止/物理掉电验收通过，也不是 CFLOCAL2 真机事件或双机 peer 完成放行。本审查没有安装、设备、蓝牙、ADB、串口或网络操作。

只读审查冻结候选 `artifacts/html-offline-candidate`；新增内容仅在 `tests/android013-review/`。运行源、012、固件、协议与其他审查产物均未改。

## 冻结身份独立核对

- APK：858010B，SHA256 `528fe4bda291f2a416aaa82615dbc8fe4c18bbae5a30654a4683d70018aa9811`。
- 源码 ZIP：1093620B，SHA256 `521ae363c0fcccdafece881c71a2df7ff85c106c878ebd5f42edd4af7b19a6b0`。
- `source-hashes.json` 的91文件与当前源、ZIP逐项一致；APK的24个assets逐字节等于冻结源。见 `frozen-hash-verification.json`。
- SDK35 apksigner 实际验证 v2 签名通过，证书 SHA256 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`，与交接/012相同；见 `apk-signature.txt`。没有构建或签名新APK。
- durable adapter 仍为 `29273cd113b1d41c7d4b885212845c6f910cff6b8db827f803e2b8fa75a88e5c`；transport仍为 `ee656a4fd9ebe2012ca40898e686e43797bc719b806d349860eb6051a7c447a4`。

## 生产接线路径复核

1. `EventDurableBridge.java:48–74,148`：确切origin/path/slot、随机token私有主框架WebMessagePort；旧epoch/port不产出回执。`MainActivity.java:112–143` 接导航失效/attach，CSP禁止frame/object/base。没有新增JavascriptInterface暴露存储能力。
2. `EventDurableBridge.java:102–127,139–143`：单worker/全进程FILE_LOCK；严格CAS先于same判定；实际write/flush/FD.sync、finishWrite后目录fstat+fsync、authority readback核revision/内容，随后才certificate。后台拒绝新commit；已经进入决定的提交允许完成，不借read假装fsync成功。
3. `offline-durable-store.js:37–59`：JS串行CAS；原生回执丢失仅接受旧cache或精确own merged，重新以权威revision提交取得sync证书。foreign内容/持续I/O失败锁住；不盲合并、不降级WebStorage。SHA关联exact各原文UTF8。
4. `offline-durable-store.js:10–26,104–116` 与打包index：Native权威read/恢复先于game02..08/Host/adapter；journal/identity先恢复；marker、完整ledger/结果关联不符则整体投影。游戏后续普通进度在相同marker/receipt时保留。没有Native证据不会公布checkpoint、不会attach新设备adapter。
5. `offline-device-events.js:59–106`：source健康/身份、device lastAck全历史、实际read event、原store隔离计划、async digest后再核身份/before state；先Native seal完整game/social/ledger/marker/identity/journal，再local WAL/hydrate，再Native confirm receipt，最后ACK。后台后只完成已持久结果投影，不ACK。
6. `offline-device-events.js:53–57`、`offline-device-backup.js:62–99`：unknown ACK重试必须有同猫/同counter/digest的Native收据；备份缺任何本机已结算receipt在覆盖原game前拒绝；import恢复owner/seq/unknown pending，不删去重。
7. `offline-scene-sync.js:38–44,83–92`：同一Coordinator flight横跨事件read/计划/Native/投影/ACK和显式retry；500ms poll/observer不能发布半存镜像。`source.freeze`与build_assets注入暂停原互动/stat/social tick；结束后按真实前后台恢复。

## 本轮实际执行

**73项通过，0失败**，并非声称重跑交接全部198项。

- `native-production.tap`：15项。实际编译/反射调用冻结生产 Java read/commit +真实JS client；13个既有链路测试，加2项独立silent finish故障。所有classes/temp输出隔离在本目录。
- 独立新增 `silentBeforeRename`（模拟Android finishWrite只日志不throw）：已有base和首次base不存在两种情形均不能得到certificate；旧值/空revision保留，再次正常提交可成功。生产readback确实捕获silent finish，不依赖fixture主动throw。
- `event-host-bootstrap.tap`：58项。原store五care/flower、ledger各崩溃点/恢复、备份旧档、浏览器坏存储、source身份、coldboot/slot、实际Host+adapter+transport、Native和ACK等待期间100次DOM变化+500ms采样门禁。

复现命令：

```sh
node --test tests/android013-review/run-native-isolated.cjs > tests/android013-review/native-production.tap
node --test artifacts/html-offline-candidate/source/tests/event-transaction.test.cjs artifacts/html-offline-candidate/source/tests/event-backup.test.cjs artifacts/html-offline-candidate/source/tests/event-browser-storage.test.cjs artifacts/html-offline-candidate/source/tests/native-bootstrap.test.cjs artifacts/html-offline-candidate/source/tests/source-save-and-identity.test.cjs artifacts/html-offline-candidate/source/tests/v2-host-integration.test.cjs > tests/android013-review/event-host-bootstrap.tap
```

## 证据边界与安装后必验

JVM 的 AtomicFile/Os/Activity/WebView 均为明确替身；生产Java确实调用宿主FileDescriptor.sync，但不能据此声称Android实际目录fsync、WebMessagePort生命周期、物理掉电或GATT正确。独立silent故障也是替身注入，没有改生产源。

保留数据安装后须核首次空Native authority迁移不重置原存档、主frame端口/后台拒绝、Native提交/回执丢失/部分投影/ACK边界进程终止冷恢复，保留before/after档与APK回读。真实Android目录fsync错误不能降级。没有新固件实物收据时，不能声称CFLOCAL2事件端到端；peer_complete/双机持久双方完成仍未验且无放行。

本版本Native权威覆盖设备结果/恢复决定和通信journal；后续普通手机玩法仍为原localStorage，这个已明示范围保持不变。
