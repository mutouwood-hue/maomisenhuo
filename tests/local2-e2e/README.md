# CFLOCAL2 跨语言虚拟集成

证据类型：**`virtual_fixture`**。这套测试直接运行真实手机 `local-v2-transport.js`、`cflocal2-adapter.js` 与生产 `local2_wire.c` / `local2_core.c` / 项目 cJSON。Native 端口、扫描/订阅、链路通知、Host 收据和照料/来礼输入由明确的测试 fixture 提供。它不是 Java、真实蓝牙、原游戏奖励、SDK NVS 或设备掉电测试。

## 复现

项目根目录运行：

```sh
python3 tests/local2-e2e/run.py
```

仅串行编译一个小型主机 CLI，再运行 Node；不会调用目标固件、preview build、ADB、串口或网络。需要 clang、Python 3、Node 22 及项目现有 cJSON 源码。Node 在 PATH 中查找，本机已有 nvm 路径作为后备。

入口与产物：

- [run.py](run.py)：编译命令、源码前后 SHA256、警告、退出状态汇总。
- [wire_cli.c](wire_cli.c)：生产 wire/core 的逐行 stdin/stdout 驱动；仅一份 blob 文件，以 temp + flush + fsync + rename + 目录 fsync 提交。文件不存在才新建，损坏或读取失败直接退出，不覆盖恢复。
- [integration.cjs](integration.cjs)：真实 JS 模块与 Native fixture、持久 journal、Host 收据 fixture。
- [report.json](report.json)：最终可机器读取的结果和全部生产源码 SHA256。
- [scenario-result.json](scenario-result.json)：场景结果、原始应用命令/生产响应、丢响应及 synthetic 注入 trace。
- [virtual-evidence/](virtual-evidence/)：最后的 synthetic blob、手机 journal 和 Host 收据；只包含固定测试猫/测试 ID。各文件长度和 SHA256 记录在报告。

C CLI 的 `!care` / `!gift` / `!inspect` 是独占测试驱动控制语句，**没有增加任何 CFLOCAL2 opcode**。care 调用实际 `l2_emit_care`，gift 调用实际 `l2_receive_gift`；两者输入来源均为 synthetic，不代表发生过真实擦肩。

## 最终实跑结果

**28 个场景通过，0 失败；clang `-std=c11 -Wall -Wextra` 零警告；测试前后源码 SHA256 相同。** 已等待 peer/core owner 的修复稳定信号后重跑，实际链接 core SHA 为 `1a2e22df6f16e93676727611bc3072d6803ed9e679dc41b9a0dce7cc9b4fe603`。完整 wire、JS、头文件、cJSON、夹具 SHA 以 [report.json](report.json) 为准。

| 范围 | 实际执行断言 |
|---|---|
| 连接与 schema | initialize → 显式选择 → fixture scan/订阅 → 真实 JS HELLO/state 握手；中文名字、owner、scene 状态在 C 落盘并可读回 |
| 场景语义 | home → departing → away/rain → returning/rain → home；保存同一份真实输入数值，不新造奖励；相同语义只变 requestId/epoch 不新增写盘 |
| 丢 snapshot 响应 | 最终写入后丢弃应用响应，真实 JS 超时并保留持久 pending；显式重连/重试使用完全相同 UTF-8 JSON 字节，生产 core 返回 duplicate，仅首次提交 |
| IR-03 时钟恢复 | 应用响应丢失后真实退出 C CLI 并重建 JS adapter；旧命令 byte-identical retry 返回 duplicate 且本启动 clock 仍为 0；同语义当前 epoch 使用下一 seq/revision 恢复校时；之后 100 次相同语义采样零命令、零额外提交；无 epoch 首次确认不能抑制后续带 epoch 校时 |
| 两端进程重启 | 退出 CLI 后从单 blob 载入，新建 JS adapter 从文件 journal 载入；owner、scene/revision/seq 延续，加载不提交新的 blob |
| 照料与礼物 schema | synthetic 设备 pet/water/feed/sleep 调用真实 core，经真实 wire 被 JS 校验；synthetic 来礼 receipt 得到 flower/quantity=1/peerId/peerCounter；`peerComplete=false`，不伪装双边完成 |
| Host 持久后 ACK | 没有 persisted receipt 时 JS 拒绝、不发 ACK、不删事件；独立 Host fixture fsync/读回后生成 digest，才允许真实 adapter ACK |
| ACK 丢失与重启 | core 已删除事件后丢 ACK 响应；重启 C 和 JS 两端，文件 journal 保留 ACK；显式重试 byte-identical，duplicate 且零新增提交 |
| Host 已保存、尚未 ACK | Host fixture 保存 receipt 后重启；同一事件 ID 再读到、fixture receipt 标 duplicate，随后 ACK；不新增 receipt 记录 |
| 去重与 FIFO | 同 peer/counter 来礼再次输入为 duplicate，不再入队；care/gift/care 混合 FIFO 逐个读取/提交 Host receipt/ACK；跨重启计数从 1、2、3 延续到 6，无复用 |
| 分片 | 真实 JS transport 生成每段最多 20 字节写入；fixture 将生产 C 响应重新切为最多 20 字节通知，真实 JS 完成 UTF-8/NDJSON 重组；双向各超过 100 个分片 |

IR-03 修复独立复验见 [IR-03-clock-recovery.md](IR-03-clock-recovery.md)，实际 adapter SHA 为 `cfaa4f95ce6484c82dcc3d80c1b519aa070d42c8aa52419bedb83c181763638f`。没有发现本轮真实 JS ↔ wire/core 范围的新 schema/字段阻断。首次开发夹具将超时设为 120ms，CLI 冷启动未完成造成握手超时；夹具增加显式进程就绪检查、采用 1000ms 超时后通过。这是测试驱动启动时序修正，不是修改产品或声称修复了产品故障。

## 验收边界及待接入项

1. Native fixture 通过测试端口主动声明权限/服务/CCCD 就绪；并未运行 Java WebMessagePort、Android 权限弹窗、GATT、射频扫描或真实 20-byte MTU。事件 `source:native_device` 来自生产 wire 输出，但本轮事件上游输入明确为 synthetic。
2. Host fixture 只保存 receipt 记录并生成 digest，**没有调用原游戏 save writer、实际经济/健康规则或发奖逻辑**。当前手机候选尚无 durable event-consumer 接入；不能据此称“手机已真实收礼入存档/已完成照料奖励”。
3. gift 的双边状态机和真正擦肩轨迹由独立 peer suite 负责，本套只验证 receipt→core FIFO→手机 schema→Host fixture 收据→ACK，不代替该 suite 或双设备实测。
4. 文件型 fsync/rename 不等价 ESP NVS；没有证明原 32KB / 8页 GC、Flash 磨损、突发断电或目标任务并发。
5. CommonCrypto 是主机 SHA256 shim；store 锁入口由单线程 CLI 串行化。目标 mbedtls、FreeRTOS mutex 与 radio worker 另验。
6. 这份结果是隔离候选的主机虚拟集成证据。没有改产品源码、手机候选或原资料，没有触碰设备、凭据及私人存档。
