# 双端虚拟激活验收

这是两个真实 `l2_peer_machine_t` 与真实 `l2_core_t` 的执行记录，消息通过测试驱动的双向队列传递，用户确认通过真实 `l2_peer_machine_confirm()` 进入。测试不赋值 `complete`，不绕过 nonce 检查，不给生产固件添加模拟成功开关。

## 重现与回放

```sh
python3 tests/local2-peer/run_virtual_encounter.py --fault all
python3 tests/local2-peer/run_virtual_encounter.py --fault loss
python3 tests/local2-peer/run_virtual_encounter.py --replay artifacts/firmware-local-v2/virtual-peer/none/trace.json
python3 tests/local2-peer/run.py
```

每次 CLI 使用一个临时 clang 可执行文件，链接实际 `local2_peer.c` 和 `local2_core.c`。默认证据目录为 `artifacts/firmware-local-v2/virtual-peer`，可用 `--out` 更改。故障参数为 `none`、`one-sided`、`loss`、`disconnect`、`persist-failure`、`restart-dedup`、`same-counter`、`pending-peer`。断言失败以非零退出，并保留已有 trace 和失败信息；不将预期拒绝伪装成成功交换。

## 证据结构

`latest-report.json` 包含实际编译源码、头文件、驱动和 CLI 的 SHA256，以及每种情景 trace 的 SHA256。每个情景含：

- `trace.json`：完整有序状态与输入记录，schema `catforest.virtual-peer.trace.v1`。
- `trace.jsonl`：驱动原始输出。
- `A.bin`、`B.bin`：core 真实编码的最终持久 blob；第三位朋友情景另有 `C.bin`。
- 重启情景另存 `*-before-restart.bin`，实际以持久 blob 调用 `l2_load()`。
- `endpoints.*.phone_events`：真实 core 待手机消费的事件队列，包含来源 peer、peer counter、事件 counter、flower kind、数量；为规范 JSON 计算 `event_digest_sha256`。
- `endpoints.*.blob`：存档长度和完整 SHA256。

这里的 store callback 为测试专用原子内存 blob：core 发出的实际编码字节成功后保留，失败时返回 false，不更新持久副本。**没有执行 ESP NVS 驱动，也没有手机真正消费这些事件**。

## 当前情景结果

| 情景 | 真实断言 |
|---|---|
| none | disabled→discovering→HELLO→双方确认→收据持久→ACK→DONE→双方 complete；各一个待手机 flower event |
| one-sided | 只有 A 的测试用户确认，双方不 complete，也没有礼物事件 |
| loss | 两端分别丢弃第一份 HELLO/CONFIRM/GIFT/ACK/DONE，重传后双方完成，事件仍各一个 |
| disconnect | 收据已经发生时断连，双方仍不 complete；保留的 pending 事件不等于完成动画 |
| persist-failure | A 收据持久失败，不保存 incoming、不 ACK，不显示双方完成；B 已保存的一份事件仍是 pending |
| restart-dedup | DONE 全丢失→双方加载真实 blob 重启→新 nonce→重新双方确认，可完成但不新增事件/counter，incoming_new=false |
| same-counter | A 和 C 向 B 都使用自身 counter1，B 仍保留两个不同来源事件，互不冒领 |
| pending-peer | B 的 A1 尚未 ACK→C/B 实际完整确认交换→A1仍 pending→返回 A/B 恢复原 counter，未增加首次奖励 |

## UI 回放映射

UI 使用 `trace[]` 中 `kind="state"` 的记录，按 `endpoint` 分两端。保持“**虚拟双端回放**”标记。`at_ms` 是测试单调时钟，不是实际无线延时或距离证明；画面可放慢回放，但必须保留原始 trace 时间供核对。

| phase / 字段 | 可呈现内容 | 完成门槛 |
|---|---|---|
| disabled | 附近发现关闭 | 无 |
| discovering | 等待另一端明确开启 | 不说明已经遇见 |
| hello | 正在核对当前会话 | 不提前确认 |
| confirm | 双端分别点确认；显示 local_confirmed/remote_confirmed | 单边不能成功 |
| exchanging / incoming_saved | 礼物收据已本地保存，等待对方 | 不播放成功收礼 |
| outgoing_acked / wait_done | 对方已保存，等待交换完成 | 仍等待 DONE |
| complete 上升且 complete_count 增加 | 当前会话完成动画 | incoming_new=true 才称首次收到野花；false 为再次遇见 |
| blocked | 显示 storage_status，对方等待/失败 | 不能替换成成功 |

历史挂载先基线 complete_count，不补播旧完成。真实生产 UI 已使用相同 view 字段；回放应通过独立 host harness 输入，不能往固件加入任意设完成接口。

## 尚未验证

实际 NimBLE GAP/GATT adapter、无线扫描/连接/20B传输、手机并发连接、真实按钮和功耗、NVS掉电/GC及两块硬件动画时序仍需真机验证。逻辑消息队列不模拟无线距离、射频争用或 GATT 时序。20B 生产分片函数在独立 host 回归中验证；该证据不代表实际无线链路已通过。本轮没有设备、串口、刷写或联网操作。
