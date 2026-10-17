# 本地匿名硬件联系完成事件提案

状态：**仅设计评估，尚未实施或验证，未执行迁移或刷写**。日期：2026-10-15T17:23:46.614196+00:00。

本文件不修改冻结 CFLOCAL2 v2、在途 UI v3、手机 012 或任何 core/wire/peer/存储布局，也不触发构建、设备连接、刷写、迁移、清理数据或权限请求。UI候选名称“v3”与下文未来存储schema编号没有对应关系。先完成 root 规定的 v3 UI + 手机012实机门禁，再决定是否冻结本扩展。

## 1. 当前缺口与目标

当前 `gift` 只证明本端接收并持久记录了一份真实野花收据。wire 的 `gift.peerComplete` 固定为false，peer的 `complete/complete_count` 只在RAM，因此**当前证据不足以让手机创建“真实双方已完成”的好友记录**。既有gift可以依原规则结算野花，不能顺带建好友，也不能因runtime动画补造完成事件。

提议新增明确协商的 `peer_completion` capability、新事件schema `peer-completion/1` 和新的持久布局。每个匿名peer首次完成只发布一次 `kind=peer_complete`。复用已有首次野花计数与去重；不再奖励第二朵花，不合成账号，不修改原游戏交友规则的其他分支。

可保证的是：在诚实实现、存储提交成功和实际匹配会话的前提下，本端观察了对端对同一tuple的耐久commit决定，并原子保存本端完成记录和唯一FIFO事件。**不承诺两台设备同时提交、永久网络分区时双方都完成、分布式原子事务、账号认证、硬件远程证明或防匿名ID伪造。**

## 2. 可复用现有机制与不能推导的事实

|现有机制|可复用|不能据此推导|
|---|---|---|
|随机16B本地device ID / hex32|匿名硬件身份、tuple排序|云账号、真实人名、不可伪造身份；重置身份仍可能成为新匿名peer|
|每peer `peer_first_outgoing` 与永久ACK位|本端首次发花counter；跨重启/新nonce复用|对方已保存双方完成、已建手机好友|
|`peers[i].counter` / receipt|最新入站watermark、同counter内容冲突防护|**首次**入站counter：它允许较高counter刷新，不能直接拿来固定encounterId|
|200事件FIFO、全局next_event、精确手机队头ACK|唯一设备事件ID、先提交后成功、重传去重|对端是否完成；手机是否已将联系人写入原存档|
|32-peer永久ledger、匹配peer+counter的出站ACK|保留首次关系证据，不受另一peer断连阻塞|完整交换已持久：当前DONE/complete仍是RAM|
|双方显式确认、完整nonce、分片generation|当前匹配会话和旧包隔离|账号签名、精确距离、持久完成proof|
|单blob CRC/NVS提交与写失败锁|本地原子状态替换及不确定提交恢复|实际掉电/碎片/耗损已验收|

新增必须单独持久 `first_in_counter`，与既有可变watermark分开。已有gift事件一旦被手机ACK即出队；全局last_gift也只留最近一笔，不能用它们重建所有peer的历史首次counter，更不能把历史ACK反推为完成proof。

## 3. 稳定encounterId与方向

设备ID必须不同、非零、固定16原始字节；外部统一小写hex32。counter必须为正的JS safe integer（在线上保持精确，内部LE64编码）。以原始字节序比较设备ID，令 `id0 < id1`：

- `c0`：id0向id1的**永久首次发花counter**。
- `c1`：id1向id0的永久首次发花counter。
- 排序的是设备ID与其对应发件counter这一对，不能把两个counter独立排序。

```text
T = ASCII("CFLOCAL/PEER_COMPLETE/1") || 0x00
    || id0Raw16 || LE64(c0) || id1Raw16 || LE64(c1)
encounterId = lowercaseHex(SHA256(T))
```

epoch、RSSI、nonce、连接generation、手机requestId均不进入encounterId。新nonce只能改变当前传输信封，不能生成新业务encounter。双方计算的encounterId必须完全相同；本端视角outCounter/inCounter在另一端反转。自遇见、零counter、方向错配、相同peer不同首次tuple都拒绝，不自动覆盖既有首次tuple。

未来peer握手需要交换并核对双方不可变首次收据引用；新生数据在首次接收时立即保存first_in_counter。旧schema只有最新watermark时不能猜first_in，见迁移章节。

## 4. 三个持久阶段，避免循环等待

“commit proof”必须明确为**已耐久的本地commit决定**，不能要求它证明对方已经发布最终完成，否则“双方都等对方先最终完成”会死锁。

|持久阶段|进入条件与原子写入|允许发出的消息 / UI|
|---|---|---|
|I：intent_saved|真实当前双方人工确认；已有同一peer的双方首次收据引用；T完整且无冲突。原子保存T引用与本端intent位|提交成功后才发INTENT_SAVED；UI“确认已保存，等待对方”|
|C：decision_committed|已有本端I；收到当前匹配会话中对同一T的对端I证据（或更强、同tuple的对端COMMIT_PROOF）。原子保存本端不可回滚commit决定|成功后才发COMMIT_PROOF；尚不宣称本端已入FIFO/手机好友已存|
|P：published|已有本端C，收到对端对同一T的COMMIT_PROOF，验证成功，且有真实本端pet绑定与FIFO空间。**一个blob事务**保存peer proof摘要、完成位、唯一completion event counter并追加一次FIFO|提交成功后可显示本端耐久完成；手机仍需消费事件并持久保存联系人|

I与C均须先提交后发消息。对端I可以在到达时立即推动C，双方各自发C证据，因此不需要任一端先得到最终P证据就能前进。收到peer C可以兼作peer I证据，但不能跳过本端I或本端C的耐久写入。发送成功、GATT ACK、收到旧DONE、动画播完都不是这些提交的替代。

C是不可撤销的本地决定：在正常恢复路径中不因超时/断连/取消发现而删除、重铸counter或换T；网络可停止，之后显式重连恢复原tuple。没有可信时钟时不猜过期。用户需要撤销关系/清除身份时，应走另行设计和授权的删除协议，不能借本提案隐式实现。

## 5. proof的含义、信封与版本

建议新peer子协议明确协商 `peer-completion/1`，对旧schema2 peer不发送新消息，也不将旧DONE升级为proof。可保留礼物兼容模式，但旧peer永远不具备此完成能力。

稳定commit摘要建议：

```text
commitDigest = SHA256(ASCII("CFLOCAL/PEER_COMMIT/1") || 0x00
                     || encounterIdRaw32 || issuerDeviceIdRaw16
                     || 0x01 /* durable-decision-committed */)
```

这个公开摘要用于绑定tuple、发送方角色和阶段；它**不是签名/HMAC，不提供身份不可伪造性，也无法从数学上证明远端真的写了NVS**。耐久性来自生产程序“只有保存成功才开放发proof”的代码门控及测试。不能称作云grant、账号认证或硬件attestation，不添加任何provision密钥。

实际proof消息还须带当前会话双方完整nonce、版本/消息类型，并核对已选中peer ID/generation。旧会话proof不能在新连接直接触发P；恢复时需双方显式重新开启发现、确认匹配，再用新nonce信封重发原稳定commit证据。业务T与证据不变。

一种直接可审查的COMMIT_PROOF载荷是 `encounterId32 + commitDigest32 + orderedCurrentNonces32 = 96B`，版本/阶段由已协商的消息type承担。当前peer最大消息64B不够，未来需显式升到96B或128B、更新长度上限/分片测试；不能只新增opcode而溢出现有缓冲。现有20B传输每片14B数据，96B需7片。若选96上限，现tx/rx/last_rx三个缓冲合计比64上限增加96B，另有临时消息缓冲增长；真实RAM/栈与late-callback压力仍需测量。不得悄悄复用旧DONE的48B含义。

## 6. 完成事件与原子发布

提议新的事件schema，以下为待冻结形状：

```ts
interface PeerCompletionEvent {
  source: 'native_device';
  protocol: 'CFLOCAL2';
  eventSchema: 'peer-completion/1';
  kind: 'peer_complete';
  deviceId: string;       // 本端匿名ID，hex32
  counter: number;        // 本端原事件流的持久单调counter
  eventId: string;        // `${deviceId}:${counter}`
  petId: string;          // 本端真实粘性绑定，不生成假petId
  peerId: string;         // 对端匿名ID，hex32
  encounterId: string;    // 上述SHA256，hex64
  outCounter: number;     // 本端永久首次发件counter
  inCounter: number;      // 对端永久首次发件counter
  occurredAtMs: number | null;
}
```

每个peer首次只允许一个completion event counter。礼物事件仍保留自己的eventId/奖励语义，永远不能因peer_complete再发一朵野花。重复proof、旧ACK、重启、重复手机拉取和新nonce重确认均只重放原记录/结果。手机ACK删除FIFO项后，per-peer completed/event-counter/acked位仍永久保留，不能再入队同一次完成。

petId以已有粘性绑定为准，绑定变更继续拒绝。如果两台尚未关联手机宠物：允许保存硬件intent/decision/proof-pending，但不发布带空petId的完成事件；待用户真实绑定并核对后才分配event counter/入队。UI显示“硬件确认已保存，等待手机关联”，不能创建默认猫来填空。历史epoch不作当前时间；无有效时钟occurredAtMs为null，手机另记receivedAt而不伪造发生时间。

## 7. FIFO满：先保proof，后原子排入事件

1. 已收到并验证peer C，但FIFO满时，可用现peer ledger槽将peerCommitSeen及proof摘要先持久化，形成 `publication_pending`；**不设completed、不分配event counter、不发送声称P成功的DONE**。
2. 该pending不需要额外200项队列；最多每个已存在peer一条，受32槽上限。保存pending失败则不确认耐久接收，保留上一状态并锁写，由重启读回决定实际提交结果。
3. 当手机精确ACK释放FIFO空间、首次真实pet绑定到位或开机恢复时，运行有界drainer。它在一个blob事务中将 `pending -> completed + event_counter + FIFO append`。若合入手机ACK事务，头删除、last_ack/request-result更新与新完成追加必须同成同败；也可在下一轮独立事务排入，但不可先设completed后另写FIFO。
4. event counter仅在实际原子入队时分配，避免pending占位形成事件流空洞。多个pending按固定peer槽/稳定排序一次处理一条，避免无界循环；连续重启不能跳过既有pending或重复分配。
5. completed但手机未ACK继续重传原FIFO头；手机ACK成功后只保ledger，不重新排队。任何协议错误都不跳过未知头去消费后面的care。

满队列可以使一端pending、另一端已发布，这是正常的非同时状态。两端都已作出可恢复的commit决定并不等于两端此刻都已发布P。只有各自收到peer C并完成本地P的端可发布自己的事件；整体是可重试、去重的本地推进，不能称全局同时atomic。永久存储损坏、身份重置、对端永不再连接均可能阻止另一端完成，需要明确可见状态。

## 8. 新存储布局与NVS预算（估算，未实现）

推荐在现32-peer ledger每槽新增如下数据，字段不使用native struct dump：

|新增字段|编码字节|用途|
|---|---:|---|
|first_in_counter|8|与可变最新incoming watermark分开，固定T|
|completion_flags|1|I、peer-I、C、peer-C、completed/enqueued、event-acked、upgrade-reconciled等；completed与enqueued由同一事务保证|
|completion_event_counter|8|一生一次的本端事件引用，ACK后仍保留|
|peer_commit_digest|32|持久保存已核对的对端稳定commit证据摘要|
|合计|49/peer|32槽新增1568B|

encounterId从两ID和两个首次counter重算，不重复存hex64字符串；本端commitDigest可由已保存C位+T重算，不重复存一份32B。petId由现粘性绑定恢复，当前不支持设备无痕换猫，不在每槽复制65B字符串。若未来改变此规则，预算必须重算。

FIFO可为新类型使用单独tag+peer槽引用，读取时从ledger重构完整tuple。建议编码为 `counter8 + epoch8 + completionTagWithPeerSlot1 = 17B`。当前care也是17B、gift25B；类型tag空间和schema版本须显式区分，新decoder必须拒绝不合法组合。不要在每条FIFO再存两个counter+hex encounterId而增加不必要的NVS耗损。

现schema2已测最大为5739B，公式：

```text
451 + 17*care + 25*gift + 42*peerSlots + 9*pendingOutgoing
care + gift <= 200; gift <= peerSlots <= 32; pendingOutgoing <= 32
```

未来共享FIFO保持200条，其中completion也17B，并限制每peer最多一条completion：

```text
451 + 17*(care + completion) + 25*gift
    + (42 + 49)*peerSlots + 9*pendingOutgoing
care + completion + gift <= 200
completion <= 32; gift <= 32
最大 = 5739 + 49*32 = 7307B
```

最大状态可同时包含32gift、32completion、136care、32peer、32待发原礼物。新增schema号复用现两字节schema字段，未加其他头；若实施时添加字段/改变编码则7307估计失效，必须由实际编码和decoder约束测试给新上界。现8192B scratch理论上可容纳；不代表真实NVS一定有空间。若采用数组追加，主机core估计从34104B增3136B到37240B（saved/work各1568），但目标ABI、队列、crypto/96B分片缓冲、栈都必须重测。

原32KiB NVS必须保留旧keys、bond和GC空间。仅两份7307B blob原始数据约14614B，还未计索引、chunk metadata、页状态与碎片。保守示例按32B entry估算：每份数据ceil(7307/32)=229项，另暂留8项metadata，双份约474项；8页理论1008 entries，至少留1页126项GC，再扣旧live L、bond/其他新增B，应满足 `474 + 126 + L + B < 1008` 并留余量。这个公式只作审核预算，**不是ESP-IDF实际分配保证或本机nvs stats**；真实实现要用已授权的离线镜像/统计夹具复核，再做专项掉电/碎片验收。

不得扩原分区、删旧key、擦NVS来满足容量。NO_FREE_PAGES/NOT_ENOUGH_SPACE/commit不确定都保持原数据并可见失败；若实测预算不足，先调整提案容量/编码并重新协商，不自动降低已存200条或淘汰peer。

每个新首次完成至少增加I/C/P三次语义写，FIFO满先存proof后排则至少四次；按上界约22–29KB逻辑blob替换/端，实际flash erase更多且依GC。重发proof、700ms轮询、动画帧和重复确认不可反复commit。仅真正持久阶段变化写一次；耗损与延迟必须列实测项。

## 9. 旧数据、旧peer与旧手机

- **不自动迁移**。未来若获授权，用独立的严格schema2 decoder保留deviceId、owner/lastSeq/hash/result、宠物、队列及所有既有event counter/ACK/首次发花和peer水位。新schema建议独立编号，不能借在途UI v3名义悄悄改schema2。
- 旧数据不能自动置I/C/P，不能把“曾收gift+曾ACK outgoing”当completion。first_in缺证据时设为待重核，而不是取latest watermark假装first。
- 推荐旧peer记录需一次实际新能力会话：双方当前显式确认、互报不可变first_outgoing、核对新T并持久升级来源标记；已有野花不再发第二次奖励。若旧peer不能提供新能力/引用冲突，保留gift-only，完成事件继续不可用。不可根据单端缓存重建对方proof。
- 迁移候选必须先纯内存构造和编码/解码比对，另保留已授权的旧blob导出。写新schema时继续单key原子替换，不能另写第三份临时blob却漏算NVS峰值。commit不确定则锁写，重启后只根据实际合法schema恢复；不回退到过时RAM副本继续复用ID，不擦除。成功后还须读回/校验，才声明新capability可用。
- 手机HELLO必须显式协商接受 `peer_completion` + `peer-completion/1`；只看到固件“支持”不代表旧client愿意接受。新客户端对缺capability保持现gift-only；旧peer/旧手机不能被新事件悄悄改变语义。
- 共享FIFO头为peer_complete而当前client不接受时返回明确 `upgrade_required/unsupported_event_schema` 并保留头，不能跳过、降格gift、把peerComplete改true，也不能接受旧客户端对未知kind的通用quarantined ACK删除它。需要新ACK回执绑定kind/schema/encounterId并校验本连接协商，防旧通用ACK误删。
- 旧客户端因此可能暂不能消费后续care；这是明确的fail-closed兼容代价，不伪装已同步。若产品不能接受阻塞，须另提独立completion outbox与ACK设计及预算，不能在本提案实现时临时改变FIFO排序。

## 10. 手机事务：匿名硬件联系，不合成账号

手机只消费合法、已协商的peer_complete，在同一原存档事务中完成事件dedup、匿名硬件联系人记录和保存回执。建议以peerId作为匿名硬件联系人主键，encounterId作首次相遇去重，保留观测端deviceId/petId/outCounter/inCounter/proof-scope来源。名称可为“硬件小伙伴”及用户本机备注；不创建userId、云账号、真实人名、地理位置、NPC账号或服务端好友关系。

如果同一手机先后读取两只设备对同一encounter的镜像事件：device eventId各自去重，encounterId合并为同一相遇，不能加两次联系人/礼物/奖励；各设备自己的FIFO仍分别ACK。peer_complete本身不额外铸野花、不重算care数值。原gift事件的奖励沿其现有真实持久事务处理，不能拿completion通知当第二条经济事件。

仅在联系人记录、原存档及事件dedup一起持久成功后，手机才回新schema的精确ACK；写失败/进程终止/结果不确定保留头重试。相同eventId异内容拒绝并可见保留，不创建联系人。读取前有gift或runtime动画都不能提前写“双方完成”。本地匿名proof不保证peer身份不可伪造，UI避免称“账号已认证”。

## 11. 测试矩阵与逐层门禁（尚未执行）

|层|场景|必须断言|
|---|---|---|
|tuple纯函数|两端方向反转、ID字节排序、counter大小不同|encounterId相同；不能独立排序counter|
|tuple纯函数|换epoch/nonce/generation、重启|ID不变；时间未知不补造|
|tuple纯函数|同ID、零/溢出counter、方向错配、不同tuple|拒绝且不改ledger/计数|
|schema|每字段边界/未知tag/重复peer completion记录/CRC有效语义坏值|严格拒绝，不清旧数据、不复用counter|
|I阶段|persist前失败/写入但commit回失败|不发I成功；本boot锁写；重启读实际blob|
|I阶段|一端I成功另一端失败/断连|没有P或手机好友；成功端保留pending且T不变|
|C阶段|两端只收到I、各自持久C再发proof|能推进，无互等最终P死锁|
|C阶段|commit失败前后/旧nonceproof/跨peerproof|不声称耐久C；错会话不推进P|
|proof|错encounterId/issuer/phase/digest/长度/一位破坏|不推进，错误可见，旧记录保留|
|P阶段|收到peer C，P提交失败或不确定|不先发成功；重启后完成位与FIFO同时存在或同时未发布|
|重复|同proof多次、丢GATT ACK、丢业务ACK、丢DONE|仅一个completion event counter；不再铸首次花|
|双重启|I后/C后/一端P后/双方P后分别断电|恢复原T/计数；不会补播历史成功；新nonce可恢复|
|首次规则|丢DONE后双方重启再人工确认|原first out/in、同encounterId、每端仅一个首次completion|
|多peer|A pending、B独立完成、乱序ACK与重启|B不被A阻塞；身份+counter不能交叉匹配|
|FIFO满|200满收到有效peer C|proof/pending可保存；不设P、不占counter、不丢旧头|
|释放空间|手机ACK空一槽与pending drainer同事务/后续事务失败|删除/追加及request结果一致；最终只入一次|
|ledger满|32peer后第33peer、新pending并发|明确full，不淘汰旧关系，不阻断已存peer恢复|
|无pet|尚未关联手机时完成硬件决定，随后真实首snapshot|pending不带空pet事件；真实绑定后才一次发布|
|宠物冲突|未决completion期间换petId或owner|拒绝覆盖，不自动将事件归给另一只猫|
|迁移|schema2无first-in、已有较高watermark/旧ACK|不推历史完成；实际重新核对引用，无第二礼物|
|迁移故障|旧/新blob、set/commit/readback失败、NVS空间不足|不自动erase/fallback；实际存档决定恢复，不复用ID|
|旧手机|不协商、未知kind、通用quarantined ACK|保留新事件/报升级，不当成gift或删头|
|手机事务|联系人/存档/dedup写失败或force-stop|无精确ACK；恢复后一次记录、一次终态|
|镜像事件|同手机读两端不同eventId同encounterId|一条匿名相遇/联系人，两个设备各自终态，不双奖励|
|真实无线|双方确认、重连/包乱序/代际回调/96B分片、重复两轮|原始帧+两端存储/手机回读可对应，不能由host夹具替代|
|真实NVS|满态、碎片、供电中断各写边界|旧keys/原分区保留；恢复一致、真实耗损/延迟记录|
|UI|待对方/待存储/待手机与已完成、重启历史|不能把I/C/gift/动画播完当P；成功仅由当前真实发布触发|

实施前先冻结字节布局、capability协商、proof消息与手机事务schema，并取得上述门禁的可审查测试计划。主机纯函数/SDK double、目标编译、两只实物、手机012安装与原存档持久事务分别记证据，不能互相替代。缺第二只真机时不宣称真实双吧唧验收通过。

## 12. 本提案待定项与建议决策

1. 建议采用I/C/P分层与17B completion FIFO引用编码；新类型明确协商，不复用gift.peerComplete。
2. 建议每peer新增49B，保持200事件/32peer上限；按实际新编码重新测最大字节，不以7307估算直接刷设备。
3. 建议旧关系仅在真实新能力重确认时建立完成T；旧schema没有proof，不补写历史好友。匿名身份重置/关系删除与账号社交另议。
4. 旧client头阻塞是本设计有意的fail-closed选择，需要产品确认；若不同意先评审独立outbox方案，不能临时跳头。
5. 网络完成不要求“双方同时P”；界面与验收以“本端已观察对端耐久commit决定并持久发布”为准，不能写分布式全局atomic承诺。

**下一步仍是 root 指定的 v3 UI + 手机012 实机门禁。此提案本身不授权开始生产实现、自动迁移或新增设备操作。**

## 13. 当前只读基线来源与版本

以下为写提案时读取的源字节哈希；不是对未来新schema的测试或对当前在途构建的全面验收。当前主机报告可能对应同逻辑的格式修订前源码；本任务未重跑测试或篡改其结果。

|来源|SHA256|
|---|---|
|`artifacts/firmware-local-v2/source/main/local2_core.h`|`de714f53212f772e0ca6ae668a8680c71e53b24e913fd979a10b8906c772bb75`|
|`artifacts/firmware-local-v2/source/main/local2_core.c`|`1a2e22df6f16e93676727611bc3072d6803ed9e679dc41b9a0dce7cc9b4fe603`|
|`artifacts/firmware-local-v2/source/main/local2_store.c`|`d0b3ffa1097888d26e27e4f8a2304735c4e84be14244c28af8d73e8911061610`|
|`artifacts/firmware-local-v2/source/main/local2_peer.h`|`3eb6e24ecdcb765839ce0785b87a2b31d958122734ec6ba6525a506f9fecc807`|
|`artifacts/firmware-local-v2/source/main/local2_peer.c`|`b44a779663229e51c7b6f37d65b3945f56ff52e42b1cda95867349f6199a7e16`|
|`artifacts/firmware-local-v2/source/main/local2_wire.c`|`48778300017ee9d458224dfd2e6b5a6324fd1f7b4a1069d8bfa7569c46c1edc3`|
|`protocol/local-v2/interface.d.ts`|`1f1eaa70a0a870e2fe241637f03490250ea4bae1914a34416962ad2a2d8bf31a`|
|`protocol/local-v2/README.md`|`6084646e45ae074ec04929e329384f69d60ea7c72f41a75cf2f197422f696147`|
|`tests/local2-core/report.json`|`9011ba3a08ac5aa80cfb7a8d524ef7d8f9b48741735a1195aa7c6c3369afb234`|
|`tests/local2-peer/latest-report.json`|`f4a488dc52f74ca45efd2549fd9a3764a2c51b6e12665aac06440367aa76f2c0`|
