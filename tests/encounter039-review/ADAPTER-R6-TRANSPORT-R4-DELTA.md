# JS encounter candidate：r6 / transport r4 最小复核

软件候选边界通过，无本轮新增确认P1/P2；不等于Native消费者或设备协议部署放行。

最终读取并复核不变的SHA256：

- adapter `ba33e3e926a9a17b17fc681fb00e935487d2c51ef402a8b68ecd1d018cbd57e6`
- event `898218eafa5329ed355555c4b4c45ee8a740ca0ddd9dd1de37c68290a6486917`
- transport `265a6d3ba7ec53736a3bf94193a0ec126e78aa44dccd85c67cd117fb98b1a3e4`

## 序号/日志

静态复核新建/持久client UUID形状、HELLO lastSeq必须<MAX、pending.seq必须<MAX，nextSeq==MAX允许只读但快照/ACK在journal/checkpoint/RPC之前拒绝。独立实际adapter、显式Native/wire替身六条边界通过：HELLO MAX零建行/零写；非法新UUID不建立journal；非法持久UUID保原字节；持久pending MAX拒绝不清；terminal nextSeq允许events读但不快照/ACK且零checkpoint；MAX-1最后一次合法mutation后持久nextSeq=MAX，后续停止而不溢出。最后一条wire reply为明确sequence模型stub，非真实C safe-number端到端。

`adapter-r6-boundaries.cjs`、`adapter-r6-boundaries-r2.json`。首次运行因审查夹具 new Function 未注入 __dirname 失败，原err保留；补夹具上下文后六项通过，不作为产品失败或删除记录。

## family/身份

transport严格非零lowercase设备ID保持HELLO与STATE一致检查；public仅cflocal3、无legacy/v2回退。独立原四条边界在最新源复跑通过，并新增全零HELLO/STATE为六边界（含legacy零NativeRPC），均在ready之前拒绝。

`transport-final-six-boundaries.cjs/json`。独立重跑owner完整transport实际48 fixture suites通过；Node TAP外层是1个脚本，不冒称48个Node test。独立重跑实际event+journal owner79/79通过、零跳过；不是新增79条独立设计。先前A01/A02的冲突tombstone/sorted-flat门继续由该套回归覆盖。

## 限制

无自动attach、无新Native provision；强制injected verifyDurableReceipt仍依赖未来实际Native原收据/身份核验实现。本轮没有修改026、UI027端口仍unavailable，没有真实游戏writer/奖励/seed/持久事件消费验证。Root最终040CJS10项是当前实际C wire/core+hostfsync/Native/GATT替身的补充证据，不是Java、双射频、NVS或实际双端同时完成。039仍阻断；040当前仅软件候选可继续，不授权真实schema迁移/升级。
