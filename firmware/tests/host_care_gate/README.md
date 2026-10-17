# 清洁能力门禁与终态收据回归

运行：`python tests/host_care_gate/run.py`（只需已有 clang/gcc；不接 ESP-IDF、LVGL、设备或网络）。

直接编译生产 `main/local2_core.c`，宿主提供内存持久回调，覆盖：

- 仅建立 owner/快照不等于授权清洁；常规照料（feed）不受影响。
- 未确认时 `l2_emit_care(BATH)` 在领域层被拒（`L2_NOT_READY`），不靠 UI 限制。
- 确认必须来自原 owner 且会话号非 0；被拒的确认不留下任何 RAM 授权。
- 确认成功才写入同一次开机的 RAM 许可，且不写 NVS、不占 mutation seq。
- 重启（重新 `l2_load` 同一 blob）后 RAM 授权清空，但已入队 bath 的事件与 eventId 原样保留。
- 带终态收据的 ACK 才出队并前移 FIFO 水位；重复 ACK 沿原终态返回 duplicate；同一事件的不同终态被拒。

这不证明真机触摸、圆屏布局、BLE 会话切换、断电时序或功耗；也不覆盖手机侧的权威结算。
