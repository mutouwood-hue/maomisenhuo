# Encounter v1 transport 早期独审

## 结论

本轮只审 `encounter-transport.js` 与 `TRANSPORT-CONTRACT.json` rev1，**不构成完整协议、事件、迁移或设备放行**。独立重跑现有39组fixture通过；额外4个边界中发现下列两个P2修正项。待Root修正后做最小delta复核。

### E39-T01 / P2：身份校验未严格执行rev1

`encounter-transport.js:16` 使用不区分大小写的deviceId正则；`:89-98` HELLO与STATE的clientId只做ASCII校验，尽管`:17`已有UUID helper。

实际独立边界复现：HELLO `clientId:'owner-not-a-uuid'`、STATE同值、全大写deviceId，三者均`ready_local`并已发送hello/state。rev1要求小写32hex deviceId、null或UUID owner。合法性门应在ready前拒绝；HELLO非UUID至少应阻止state。新旧owner连续性设计尚未冻结，此处不推导任何自动owner迁移。

建议共用严格lowercase device validator与`clientId===null || uuid(clientId)`；STATE同样严格校验。未知/不合法身份应disconnect，无snapshot/events/ack。新增对应负控，不把当前测试中的`wrong device id='bad'`当作覆盖大小写/UUID边界。

### E39-T02 / P2：显式legacy路由返回误标wire family

`:169-179`允许显式legacy路由，成功结果恒加`wireFamily:'CFLOCAL3'`。实际`selectTransport('legacy')`返回nativeMode=legacy、requestedApplicationMode=legacy、wireFamily=CFLOCAL3，stage=disconnected。

这未让legacy就绪：scan/connect仍要求raw cflocal2，未发现自动回退；问题是结果语义混淆。可保留手动legacy入口用于显式切走原通道，但该结果的active/verified wireFamily应为null或明确legacy、另用`transportProtocolFamily:'CFLOCAL3'`表达本JS模块身份。尚无HELLO时也不可声称Native已验证CFLOCAL3。如果Root不需要跨家族路由，则公开API只接受cflocal3更简单；本审查不要求强制删掉显式退出入口。

## 已核严格家族/生命周期路径

- 导入与createControl不发Native RPC、不自动attach、不扫描/重连/导入journal。initialize只RPC可用性，权限与扫描/路由由明确调用触发。
- 公共选择只cflocal3或显式legacy；cflocal3到Native rawMode cflocal2仅UUID字节通道映射，HELLO另外核CFLOCAL3/v3/proof1/schema3/必需cap。旧CFLOCAL2模块未覆盖。
- 同时要求connect返回和subscribed事件的当前generation/真实选中address/四项Native证据；先hello、再state，二者通过才ready。这里Native全部为fixture，不是实际Java/CCCD验证。
- 一次单应用flight，20B有序write；app ACK不能早于最后GATT completion；GATT完成也不能替代app ACK。读取不能带owner序列，mutation只接受稳定id/UUID/seq；并无事件codec或durable journal作者，不能把传参称Native持久证明。
- generation/session失效、断连/dispose清partial line、pending wait和扫描选择；旧frame不能恢复ready。unknown mutation不自动重放，明确应用negative ACK与Native failure保持不同证据类别。
- strictJSON/UTF8/2048含LF、重复/转义重复key、NUL、unsafe/nonfinite等门已有定向覆盖。状态业务完整校验仍需未来契约/codec，不把partial stateData当完整proof验证。

## 测试证据与不足

`early-transport-owner-rerun.log`：现有39组全部重新执行。原026实际打包web的`local-v2-transport.js`确实require运行，20B碎片HELLO v2遇fixture返回v3拒绝，记录仅[[2,hello]]、零state/events/snapshot/ack。

**但拒绝方是JS Native/response fixture，不是039实际wire C。** 因而只证明原026面对这样的回复不会继续，不证明039 C在v2输入下零owner/seq/NVS变更。后续必须把同负控接生产039 wire/core+文件持久存储，读写前blob/owner/seq/FIFO精确对照；原026 journal/consumer也需包含在完整兼容性负控中。

目前仅transport，无自动事件消费、Native新allowlist、真实schema2迁移或39设备候选。本轮不需要新增权限，也不批准027连接039。027独立内存模拟与typed unavailable维持原声明。

未来实现仍需独立覆盖：真实C未知/旧version拒绝、序列owner连续性、completion原子事件/水位、所有send/commit边界重启及最后消息丢失、8192/200/32容量、实际Native durable receipt与migration/downgrade分叉。见DESIGN-INVARIANTS.json。

额外边界复现命令：`node tests/encounter039-review/early-transport-boundaries.cjs`，输出`early-transport-boundaries.json`。它复用owner Native fixture、用独立输入，不是独立Native实现或双射频测试。最初使用VM跨realm导致plain-object判定拒绝fixture，改为同realm执行后复现；此为夹具修正，不是候选超时缺陷。

所审源/契约/测试哈希在`early-transport-review-pins.json`。无设备/Git/删除/候选修改/联网。
