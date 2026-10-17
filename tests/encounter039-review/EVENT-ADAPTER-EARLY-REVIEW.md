# Encounter event/adapter 早期独审（r5）

## 结论与源范围

以下JS可继续做实际039 wire/core的跨语言主机联测。首轮确认两项P2，现均已定向复验关闭；当前未确认其它阻断。**不构成完整冻结候选、实际Native收据能力、schema2迁移或设备部署放行。** 本轮没有任何设备、GATT、NVS、Git或产品源码动作。

- event：`898218eafa5329ed355555c4b4c45ee8a740ca0ddd9dd1de37c68290a6486917`
- adapter初审：`bbb6e6c6bd3232e86ecedcc622e65551fc391e78e60d846f62f3927843eb113f`
- adapter r5修复：`b8624e3fea9092e8b0a6ff49a9f184c0e64f8754195f5b56e99ca10526222ecb`
- transport仍 `259d9f5dda96d3e93028422e7a51326f8542b8ea4665603ef195c0d2ab053bd2`
- 本轮契约rev3；初始/修复源pin及运行证据在event-adapter-r5-review-pins.json。WIP源快照保留，旧失败未删除。

## 确认问题与修复

### E39-A01 / P2（已关闭）：冲突事件第三次读取洗掉历史

初版adapter155-160只有readEvents一个map。每次重读先删除旧cap；第二次同eventId但不同payload正确拒绝，却同时丢掉唯一canonical，第三次便重新接受变体。

独立实际adapter+codec复现两组：care的pet→feed；以及peer_complete保持同eventId/encounterId、改peerPetId并重新计算**合法正确FP**。两者旧版本第二读MALFORMED_FRAME，第三读错误接受，并在显式Native verifier fixture返回verified后允许ACK请求。没有把fixture视作真实Native奖励或实际C设备接受。

r5将seen canonical/conflicted tombstone与read ACKcap分开，出现冲突后重复变体不能洗白；exact unknown ACK retry也检查冲突。独立重新运行上述两组，第二读MALFORMED_FRAME、第三读EVENT_CONFLICT，ACK0。seen上限6400到顶保守拒新，不静默evict。正常ACK和postcheckpoint成功后释放seen/cap；其后跨重启/历史防重依赖真实Native ledger，JS没有冒充永久防重。

证据：event-conflict-reacceptance.json、peer-proof-conflict-old-negative.json；修复event-conflict-r5.json、peer-proof-conflict-r5.json。

### E39-A02 / P2（已关闭）：同值JSON key顺序被误判冲突

初版canonical直接JSON.stringify(e)，契约没有要求响应对象key顺序。独立仅逆序相同care字段，第二读误拒MALFORMED_FRAME，第三读因A01又接受。

r5使用已严格验证的flat schema sorted-key canonical。相同逆序输入第二/第三读均成功，合法receipt可正常ACK1。原额外/缺失/冲突字段仍拒绝，未靠忽略字段修正。

证据：event-keyorder-conflict.json与event-keyorder-r5.json。

## 独立运行与校验

- 初版现有event/journal测试独立重跑74/74，无skip；r5重新跑76/76，无skip。它们包括首ACK/verifier缺失、未知ACK重试Native历史缺失、发送前checkpoint前后核验及完整eventId等；fixture源码与日志都pin，不冒称实际Native实现。
- 独立补上述3组（care真实冲突、peer proof真实冲突、仅key顺序）修复复验，旧peer proof负控直接加载独审保存的bbb6源，避免误用修后文件作旧版本证据。
- Python int.to_bytes/hashlib oracle：原2个向量加22个确定随机向量，覆盖最大安全counter-1、1/64字节pet及ASCII引号/反斜杠。两角色方向共48组，真实codec encounterId/原始binding bytes/SHA256前16B共144断言通过。它是独立字节/摘要oracle；尚非实际C双FSM或双射频联测。

复现：`python3 tests/encounter039-review/check_binding_oracles.py`；`node tests/encounter039-review/event-adapter-independent.cjs`及peer-proof-conflict-independent.cjs、event-keyorder-independent.cjs。旧源负控用REVIEW_ADAPTER_SOURCE指定独审WIP快照。现有suite可Node --test执行候选两个测试文件。

## 已读安全路径与边界

- peer_complete恰20字段：v3/CFLOCAL3/native_device、device:eventCounter、双方非零lowerhex设备、ASCII21..7e身份、独立counter、canonical100字符ec1、button/proofVersion1/mutual_durable_commit/peerComplete true/gift false；完整SHA域重算。kind care/gift采用各自精确字段，不补inner v3、gift仍false。证明只校验本地字节一致性，不能认证账号或恶意peer。
- codec在await digest前clone tuple；adapter在异步验证前后核当前native订阅证据、device及generation，读与mutation共享exclusive lease。不能将旧generation已读cap拿来ACK。
- 初次ACK要求当前已读exact event、64lowerhex digest、Native独立原结果/去重/当前存档身份verifier。未知ACK重试不单凭journal pending，要求完整eventId/counter对应并再次查真实历史；发送前的Native journal checkpoint前后都重新核验；设备ACK之后的postcheckpoint未另调用verifier，此处不声称它再验证原结果。verifier是必需注入函数，**当前未provision生产Native**，原样返回verified的fixture不能充当真实历史核验。
- mutation首次完整意图经Native journal checkpoint才发wire，设备持久ACK后Native postcheckpoint成功再清pending；unknown保存exact命令，明确用户重试，不换payload或重新分配seq。post失败保留旧pending；应用明确negative/no_change和Native失败类别保持区分。
- 场景语义coalescing不把旧epoch恢复当新连接已校时；新journal独立、不自动导入v2 pending/owner。schema2生产迁移和真实owner接管仍被禁止。

## 尚需下一门

1. 实际生产039 C wire/core与原026/v3完整transport联测，包括v2拒绝前零blob/owner/seq变化、真实FIFO顺序和持久回应。当前尚未在本报告执行。
2. Native verifier真实实现必须独立核原结果、event proof/identity与world去重；首发和恢复路径都不能仅相信pending、页面receipt或模拟B内存档。其异步业务写入/身份锁边界须随真实consumer再审。
3. 同encounterId不同eventCounter的世界成长/好友幂等，在实际B/original writer实现证明；本模块不写world、不建立好友，故纯codec通过不是结算通过。
4. 039持久顺序、8槽/32peer/200FIFO/8192、compact、迁移与重启故障、严格源码/APP/ELF/ZIP冻结绑定另审。当前027仍typed unavailable，不能接入真实Native或039设备。
