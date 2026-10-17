# 第二轮独立集成审查

日期：2026-10-15。范围：Android BLE 生命周期、权限拒绝、状态事务、事件幂等、断线恢复及固件通知分片。审查者未改产品源码，未运行 Android/ESP 重型构建、未打开真实蓝牙或操作设备/系统权限；稳定候选 `artifacts/2026-10-15-core-candidate` 未修改。

## IR-07 / P1：AtomicFile 正常返回不等于本次保存成功

原位置：`PetStore.persist()` 中 `file.finishWrite(output)` 返回后就交换内存状态，并向吧唧发送 applied ACK。Android 平台 AtomicFile 的 finishWrite 对部分 sync、close、rename 错误只记录日志，不向调用方抛出异常。现有 host adapter 会抛出 rename 错误，比实际平台的这条路径更强，原有通过结果没有覆盖静默提交失败。平台源码：[AOSP AtomicFile](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/master/core/java/android/util/AtomicFile.java)，finishWrite 及 rename 方法。

确认性轻量复现：编译生产 `PetStore.kt` 及其纯 Kotlin 依赖，只替换 Context/filesDir 和 AtomicFile。故障 adapter 在 finishWrite 正常返回但不执行 rename，模拟平台静默失败；一条合法 pet 事件得到：

```text
ack=applied, beforeRevision=0, memoryRevision=1, restartedRevision=0
```

若真实吧唧收到该 ACK 并删除队列，手机重启后会丢失已经确认的互动。这是具体故障路径，不是对正常成功保存的推测。

已交 Android 负责人修复，并独立复读当前实现：`PetStore.kt:305` 显式 `fd.sync()`；`:306` 标记 finish 阶段；`:309` 从 AtomicFile.openRead 读回、比较完整字节并 decode；只有验证成功才允许事务交换 RAM/返回 ACK。finish 后失败不再 failWrite 已提交的流，转为 blocked/StorageFailure；`:48` 的 retryRead 只读取磁盘校验后加载。上一份有效存档另行同步/校验保留，恢复操作有独立用户确认入口。

修复后同一轻量回归结果：

```text
ack=none, error=StorageFailure,
beforeRevision=0, memoryRevision=0, restartedRevision=0
```

`tests/lifecycle-review/test_atomic_finish.py` **通过**。这是生产 domain 在受控 host 故障下的验证，不是 Android 平台文件系统或真实 BLE 验收。

## IR-08 / P2：通知发到一半时分配失败会污染下一帧

原位置：`badge_ble.c` 的 notify_line，在已发送第一片后，下一片 `ble_hs_mbuf_from_flat()` 返回 NULL 时直接 false 返回。Android 保留的半条 UTF-8/JSON 会与同连接后续消息拼接，到 LF 才丢弃。持久事件可再次重试，但本次状态/第一条事件消息已被污染。

已交固件负责人修复。独立复读当前 `badge_ble.c:160` 后的发送循环：部分帧发生 mbuf/MTU/订阅/发送错误时中止连接；发送过程还检查 link_generation，避免旧连接的数据发送到新会话。

`tests/lifecycle-review/test_notify_abort.py` 从生产源码抽出 notify_line，用受控 mbuf/GATT 替身注入第二片分配失败。结果为 `firstSuccess=0, terminations=1`，只发送了第一片，后续帧未追加到该流；完整成功帧另有检查。

两项通知检查 **通过**。这验证生产发送函数的分支控制，不验证 NimBLE 调度/无线电、真实订阅和 Android 接收。

## 本轮测试与共享回归准备

执行命令：

```sh
python3 -m unittest discover -s tests/lifecycle-review -p 'test_*.py' -v
```

结果：**3 passed，0 skipped，7.727 秒**。没有 SDK 下载；只调用项目已有 JDK/Kotlin/JSON 和现有 C 编译器，产物在临时目录。工具曾发生 transport 中断和自动权限审核超时；核对已落盘补丁后按提示重试一次，以上结果是重试后的实际执行结果。

经 root 明确授权，还修改了下列共享 host 测试文件，供集成方统一串行回归：

- `tests/protocol/host/android/AtomicFile.kt`：增加平台式 openRead、一次性 silentFinishFailure，以及“rename 成功后下一次 read 失败”的 failReadAfterFinish 钩子。
- `tests/protocol/host/android/PetStoreHarness.kt`：增加 silent_finish_failure、fail_read_after_finish、retry_read 操作。
- `tests/protocol/test_android_state.py`：增加两项生产 PetStore 回归：静默提交失败后恢复旧盘并重试一次；已提交但读回失败后加载磁盘去重记录并返回 duplicate。编译依赖在存在时纳入 AppearanceCatalog.kt、LocalLifeRules.kt。

新增两项共享回归待 root 与完整套件一起执行；不能把本轮 3 项通过外推为它们或全套已经通过。

## 生命周期和权限边界复读

- 发现/连接入口先检查权限；拒绝附近设备权限时显示说明，本地照料与存档仍独立运行。没有自动确认系统授权或配对码。
- 用户断开会清 requested 并递增 generation；已关闭 GATT 的旧回调以对象身份过滤；已排队的重连还检查 generation/requested。每次 GATT 阶段有超时，连接故障最多自动重试三次后提示手动重连。
- onStop 主动断开当前前台链路，重新进入 App 需要用户重连；此行为须如实写在使用说明，不能声称后台常驻。
- 手机存储结果不确定时不发最终 ACK；固件队列保留原事件 ID，后续重传；手机确认磁盘状态后才继续结算。

在上述复读范围内，本轮两个确认问题均已看到修复并通过对应窄 host 检查。配对弹窗生命周期、实际权限拒绝/撤销、蓝牙开关、真实 GATT 重连和断电恢复，仍须 Android 平台/设备验收；不以替身结果代替。
