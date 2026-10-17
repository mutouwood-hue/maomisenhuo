# 039 contract rev1独立设计复核

## 结论

`protocol/local-encounter-v1/contract.json` rev1与内嵌proposal内容/原文件SHA均核对一致。当前未发现阻止**独立实现**的设计矛盾；**没有代码、NVS迁移、旧038可运行回退或设备部署放行**。10个038/026基线源pin保持，原038/116实际证据不变。

## 关键设计判断

- 最终语义是双方分别持久COMMITTED后，本端观察peer COMMIT并原子落自己的completion watermark+FIFO事件；没有声称双端同时持久、同时看见最后消息或两个手机同时结算。PREPARED/COMMITTED发送必须晚于对应持久成功；发送排队成功不能代替接收端commit。对端COMMIT先到/乱序、一次persist落盘但返回false，仍须在实现中保守阻断/重载验证。
- 8个full binding槽包含双方完整pet身份与阶段；32个永久ledger保留两counter、16B FP与完成位。PHONE ACK只释放对应full slot，不删completion水位。新event的pet/peerPet从绑定slot读取，禁止以当前snapshot偷换；event被消费后重连靠ledger compact COMMIT帮助另一端收敛，不能重造本端event或再奖励。
- compact发送/接收依然核当前HELLO身份与原不可变FP。远端尚未完成时必须保有full slot，并以完整tuple重算FP；双方都compact后可匹配ledger重发已持久证据，不引入新consent或新counter。改变pet/device/counter必须冲突而非重新绑定同encounter。
- inner `v:3`只要求peer_complete新事件，care/gift仍原shape加CFLOCAL3标签；outer固定v3。gift仍peerComplete:false，新peer_complete gift:false；旧gift、原RAM DONE和历史peer ACK绝不能补成新completion。
- canonical encounterId由排序device raw bytes及各自counter_u64LE组成，48原始字节转96hex加ec1:正好100ASCII；FP16为domain+method+带长度双方pet的SHA256截断，不是认证。实现需固定字节序、角色交换一致、拒绝余位/截断/错误长度，不能对JSON stringify内容临时hash替代。

## 容量核算的成立条件

`5739 +9 +32×33 +8×132 =7860`，剩332B；保留FIFO200、旧peer32。max certificate `3+2×(16+8+1+64)+32+4=217`；16页×14payload=224，20B帧留6B header后可容纳。数值无算术错误。

但前提是新event实际编码17B、每ledger33B、每fullslot132B，固定新增仅9B，CRC/原固定头不重复遗漏。new event和gift标记需无歧义并严格解码，不能直接把ABI sizeof当磁盘大小。7860上界目前**不是生产encoder实测**。必须构造最大32peer、200混合FIFO、8slot/最大pet、旧pending outgoing并验证encode/decode；不能只空blob测试。

32KiB NVS还含旧新blob generation/索引/namespace/GC和历史碎片。8page可容纳的设计预算不等于真实当前分区容量保证；剩余entries不足应storage_error/unknown，不擦除、不初始化新猫、不先发certificate。真实schema2分区本轮不升级，因此host编码和模拟GC不得冒充当前设备验证。

## 需在实现/界面中明确的边界

1. **8槽中断/取消**：full slots为OFFER/consent/commit及已完成待ACK共同占用。当前合同只定义phone ACK释放已完成slot，未完整定义未consent的OFFER关闭/恢复。可明确保留并defer直至原peer恢复；若要回收，需另定安全阶段和保留counter tombstone规则，不能隐式删除已consent/committed proof或复用counter。不能承诺无限接新peer。
2. **32永久peer**：scope为device pair首次完成；改变宠物不得把旧设备pair水位当新pet确认。该限制与不能自动换猫一起写清，不扩展成任意账号好友。
3. **owner连续性**：schema2纯转换完整保留owner/seq/hash。新v3 journal新client遇OWNER_CONFLICT是明确阻断；只有显式同owner host continuity fixture可下一seq。不导入旧pending，不改旧envelope重放，不自动接管。
4. **迁移/回退**：生产loader对schema2只MIGRATION_REQUIRED、不调用纯host converter；单authoritative旧key若真写schema3，038无法load。contract已明确不能只刷旧APP称回退无损；以后任何state恢复还须处理手机已结算ledger，避免回滚counter后重复效果。本轮不部署，此边界合理。
5. **证据**：仅一只真实硬件；两个生产core+文件持久存储是virtual_fixture、非双射频。按钮真实输入、双方硬件链路、身份UI与真NVS掉电都保留独立后续门。

## 后续审查必备证据

- 每commit/send前后故障、最后COMMIT丢失、重启和乱序重复：本地事件恰一次，双方可暂时不一致但不假报全局完成。
- 满FIFO/8槽/32peer、未知store字段/CRC/保留位、身份冲突、phoneACK释放slot后重启compact恢复与去重。
- 实际生产039 wire/core接原026完整transport，旧v2只hello且无owner/seq/NVS改变；反向v3拒v2/missing proof gates。
- 真正Native durable receipt+原游戏/社交幂等写入后才ACK；相同encounterId即使不同eventId也不重复world成长。新源必须正式freeze/hash交审，不能以本设计报告代替。

所审契约/proposal/早期transport及测试pin见design-and-transport-r3-pins.json。未编辑Root契约、adapter或固件源，未碰设备/旧存档。
