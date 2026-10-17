# IR-03：历史 pending 恢复与当前校时独立复验

证据类型：`virtual_fixture`。未改产品源或手机 UI。仅在独占 `tests/local2-e2e/**` 中补回归，运行真实 JS transport/adapter、生产 C wire/core/cJSON。C CLI 是实际进程，持久回调使用真实 host 单 blob 文件；时钟为该进程中的易失 clock shim，不是 ESP facade/晶振或 Java/射频验证。

## 结果

**28/28 场景通过，其中 IR-03 新增 6 项；clang `-Wall -Wextra` 零警告；测试前后所有记录源码 hash 一致，测试后再次读回仍一致。**

- [report.json](report.json)：全命令、全 hash、场景结果和 trace。
- [integration.cjs](integration.cjs)：IR-03 断言标记段。
- [README.md](README.md)：复现入口及整个夹具的边界。

本轮实际源：

| 文件 | SHA256 |
|---|---|
| `cflocal2-adapter.js` | `cfaa4f95ce6484c82dcc3d80c1b519aa070d42c8aa52419bedb83c181763638f` |
| `local2_wire.c` | `48778300017ee9d458224dfd2e6b5a6324fd1f7b4a1069d8bfa7569c46c1edc3` |
| `local2_core.c` | `1a2e22df6f16e93676727611bc3072d6803ed9e679dc41b9a0dce7cc9b4fe603` |

## 实际执行的恢复序列

1. 真实 adapter 提交 `ir03-historic` snapshot，epoch 为 `1800000000000`；生产 C 已持久化，Native fixture 仅丢弃最终应用响应。JS 实际超时、journal 留下原命令。
2. 退出 C CLI，关闭旧 JS control，重新启动 C CLI 并创建新 adapter，均从各自真实 host 文件载入。断言新进程 clock 为 0，snapshot pending data 和历史命令相同，当前进程提交次数为 0。
3. 显式调用 `retryPending`。断言真实 JS 发出的 UTF-8 JSON 与历史请求完全一致，C 返回 `duplicate=true`，提交次数仍 0，clock 仍 0，journal pending 清空。这一步只证明历史持久结果，没有把旧 epoch 当作本启动当前时间。
4. 提交同语义 `ir03-current`，仅换 requestId/epoch 为 `1800000060000`。断言真实命令是历史 seq+1、revision+1，C 提交一次并将 clock 更新到当前 epoch/offset=480。
5. 连续 100 次相同语义输入，仅改变 requestId 和 epoch。断言每次 adapter 返回 duplicate，发出的协议命令数量、C commit、seq/revision 都不增加；clock 保持第4步校准值，没有不断发送时间 heartbeat。
6. 再退出/重启 C 并重建 JS，首次提交无 `epochMs` 的相同 home snapshot。确认 C 已持久、clock 仍0。随后同语义加 `epochMs=1800000120000`，确认仍发出下一 seq/revision 并校时，未被前一次无时钟确认抑制。

## 源码复读结论

`sendPending(id,{fresh=false})` 的恢复路径不设置本 generation 的 `confirmed`；恢复 snapshot 会删除旧 confirmation。新 `pushScene` 才通过 `{fresh:true}` 建立当前 generation 的确认，并记录该命令是否包含 epoch。抑制重复发送还要求：当前输入若需要 clock，之前确认必须确实含 clock。

因此本轮实测支持 root 对 IR-03 的修复：历史命令不改写，恢复完成后当前快照可以再次校时；完成当前确认后不增加心跳写盘。原始问题来自独立审查，本文只记录修复后复验，未冒充修复前已跑此新回归。

## 仍未证明

- 未执行真实 `badge_local2_facade.c` 的 portMUX/esp_timer 时钟实现，未验证设备屏幕时间或准确度。
- Native 端口、扫描/订阅和丢响应均是 fixture；没有 Java、GATT 或射频证据。
- 原游戏 durable event-consumer 尚未接入；本回归不声称原存档收礼/奖励闭环完成。
