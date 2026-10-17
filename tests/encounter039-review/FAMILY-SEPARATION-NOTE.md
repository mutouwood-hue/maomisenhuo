# CFLOCAL3 严格家族分离：设计复核

当前为 Root 草稿方向的只读评估，尚无正式契约/实现可放行；038与116项实际证据不变。

## 可接受的最小方向

- 新 phone envelope v3、HELLO protocol `CFLOCAL3`、必需 `encounter_complete_v1`；039只accept v3，新adapter只accept v3，不自动回退026/CFLOCAL2。
- 旧026首次v2 HELLO应在任何持久owner/seq/counter/event/水位变更之前拒绝；同service仅为rawGatt字节载体，不能把UUID相同当协议兼容。
- journal独立新key，禁止把旧026未决命令换envelope、跳seq或重写request原bytes转发。未决v2只能保留原档，明确不可交给v3重试。
- B ui027的独立包名/会话内存档/无Native桥与权限、生产port typed unavailable，应继续明示模拟边界；不直连039，不代表真实Native消费已完成。

## 必须补上的迁移决策

038 schema2保存单owner的clientId、seq、request hash/result。若迁移原样保留owner，而新v3 journal生成全新clientId，首个写会OWNER_CONFLICT。若直接清owner/seq，则变成静默所有权/去重语义重置。Root契约须定义合法V3首次激活方式、旧owner档案/旧pending不可恢复的边界、V3是否独立序列域及如何不复用旧ID；独审不代替Root作迁移选择。

不同NVS key/namespace可保留旧schema2字节，但双key非原子、两个固件往返会分叉；不得因此称039新增事件/好友进度无损回退。覆盖原state成新schema则旧038严格拒绝load，也不是可运行无损回退。

## 后续必跑负控（当前未执行）

1. 原026完整transport，经真实生产039 wire的20B碎片HELLO拒绝，之后零snapshot/events/ack，设备blob/owner/seq/FIFO不变。
2. 新adapter收到v2 envelope、CFLOCAL2标签、缺cap、旧generation回复全部不可ready、不可发mutating request。
3. 旧journal pending存在时、新V3空journal与迁移设备旧owner组合，明确激活前零写，不自动rewrite/retry旧pending。
4. 未完成/已完成039遇到038启动后再回039：严格执行契约的阻断/保留/合并边界，不复用counter、不把旧gift变completion。

主清单：[DESIGN-INVARIANTS.json](DESIGN-INVARIANTS.json)。以上是必要门槛，不是软件或双射频通过记录。
