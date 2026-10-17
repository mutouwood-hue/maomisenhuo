# 当前 local-v3 双方擦肩/礼物离线模拟审计

## 可交付结论

**已虚拟验证：** 当前037真实生产 peer FSM/core 的双方显式确认、持久礼物收据/发送保留与ACK、重传去重、断连、写失败、重启重连不重复首礼。正常虚拟A/B双方 complete=true，各只有一条gift FIFO事件。属于主机内存KV+排队虚拟无线链路，不是两只实体吧唧验证。

**没有验证/没有实现为持久证明：** 双方 complete/confirm/DONE 状态在 peer machine 的RAM中。双方礼物及outgoing ACK虽然持久，完整完成标志本身不在持久schema，重启后complete及complete_count归零且重新要求双方同意。当前FIFO只有care/gift，没有durable peer_complete；手机不能据此创建双方好友。当前手机026/code17的生产消费者边界已另行2/2复跑通过（下节），原025记录保留为历史。

没有USB、ADB、真实扫描、设备队列、实际奖励、Git或删除操作。所有持久输出均在tests/peer-simulation-audit；冻结源/UI/协议/固件没有修改。

## 来源是否过期

原tests/local2-peer/run.py、run_virtual_encounter.py及test_transport.py路径指向旧firmware-local-v2，不能仅凭旧latest-report提升当前版本结论。本轮重新将**037生产源码**编译进相同fixture；source-comparison.json核035/036/037/旧v2的local2_core.c/.h、local2_peer.c/.h、local2_wire.c五文件SHA分别逐字一致，report.json记录当前037编译输入SHA和执行前后稳定。

- peer.c SHA b44a779663229e51c7b6f37d65b3945f56ff52e42b1cda95867349f6199a7e16
- core.c SHA 1a2e22df6f16e93676727611bc3072d6803ed9e679dc41b9a0dce7cc9b4fe603
- wire.c SHA 48778300017ee9d458224dfd2e6b5a6324fd1f7b4a1069d8bfa7569c46c1edc3

## 实际执行证据

`python3 tests/peer-simulation-audit/run_current.py` exit0：

- 生产peer/core原C suite **11组通过**：双方同意；HELLO/CONFIRM/GIFT/ACK/DONE首包各丢失后重试；nonce/identity/未确认拒绝；确认中断；持久reserve失败；重启复用outbox counter；其他peer未确认不阻塞当前peer；接收持久失败不ACK；32peer上限；200事件FIFO满不推进；丢DONE双方重启重新同意后无重复首礼。详peer-suite.log。
- 新增 **1组完成后重启**通过：真实l2_load重载两端blob，重建machine后complete=false/complete_count=0/确认清空，但gift事件及peer_outgoing_acked保留；重新连接未同意不complete，再双方确认才complete且incoming_new=false，不新增gift。详reboot-after-complete.c/.log。
- **1组实际production 20B分帧函数**通过：碎片重组、相同重试、损坏/padding/顺序/seq/size/schema拒绝、未处理消息背压。仅从037抽取receive_frame/tx_frame/tx_advance，不编译/执行ESP NimBLE GATT调度。framing.log及transport-extractor-current.py记录来源。
- **8/8虚拟trace场景**通过：none、one-sided、loss、disconnect、persist-failure、restart-dedup、same-counter、pending-peer。每目录保存trace.jsonl及实际core编码的内存blob，report.json有SHA；fixture不清任何真实设备数据。
- `node --test --test-name-pattern='real flower|unsupported, forged' artifacts/html-offline-candidate/ui025/source/tests/event-transaction.test.cjs` **2/2通过**：原025生产消费者+原store/内存Native，gift只增加一朵野花及social原收据，不建friends/cards；同事件重放无第二奖励；伪peerComplete=true拒绝。详app-gift-boundary.tap。

## trace结果不能混淆

| 场景 | 结果 |
| --- | --- |
| 正常/首包丢失 | A/B双方运行时complete，各1条gift；持久回调先于GIFT发送和ACK |
| 只有一方确认 | 双方不complete，gift均0 |
| 交换后断连 | 两端仍可能各有1条已持久gift，但运行时complete为false；持久礼物不是双方完成证明 |
| 一端写失败 | A不保存/不complete；B可能已收到并持久1条gift，双方仍不complete；不可宣称分布式全有或全无 |
| 丢DONE后双方重启 | 新nonce、新双方同意后可complete，各仍1条gift、incoming_new=false |
| 不同peer同counter=1 | B保存不同peer的两条首礼，不错误合并为同一礼物 |
| 旧peer待ACK时遇见新peer | 新peer可完成；旧peeroutbox保留，重连完成且不再新增首礼 |

此实现按peer身份永久首礼去重；同peer更高counter只更新证明、不再发第二首礼事件（core.c:76–82），不是任意重复交换每次发奖。

## 持久性与好友边界的精确位置

- local2_peer.c:43–47本端显式confirm；:65–70对端confirm及两端确认门禁。
- :75–87接收GIFT先l2_receive_gift持久，成功才置incoming_saved/ack_pending；:88–97 ACK先持久outgoing ACK，DONE仅核双方counter+nonce。
- :121–123 complete由done_sent && done_seen && incoming_saved && outgoing_acked设置于m->view，并非core saved。:22–25 init memset清空machine；core.h:64–83持久字段无complete/confirm/DONE。
- core.c:72–93 gift首收据、FIFO及peer水位同一commit；:96–110首次outgoing保留；:113–128持久outgoing ACK。host回调只是内存原子blob复制，未执行ESP NVS驱动/真实断电。
- core.h:50 event kind仅CARE/GIFT；wire.c:121 **无条件peerComplete:false**。即使当时runtime state显示complete，也不把这种会话状态倒灌成持久event。
- 025 offline-device-events.js:17只接受gift peerComplete===false；:33–44发真实匿名野花收据/背包，不修改friends；原身份/原结果持久后才ACK。新好友完成链路仍缺持久peer_complete/双方匹配证明事件及其手机事务消费者。

## 明确未验

真实双射频发现/RSSI/距离、NimBLE连接与碎片GATT调度、手机/peer并发共存、圆屏双方确认触摸、真实NVS/掉电窗口、真实两设备完成提示与真实礼物回传均未由本次证明。HELLO能力声明、模拟链路ready及host complete不能升级为这些实机结论。单只真实设备没有被虚拟端连接，也未注入队列/奖励。无需新增功能；这些边界应留在本轮已知问题。

## 版本精确补验：当前手机026 / code17

2026-10-16以已冻结 **0.2.6-html-local / versionCode17** 重跑相同两项，**2/2通过，exit0**；没有全跑无关测试。命令：

`node --test --test-name-pattern='real flower|unsupported, forged' artifacts/html-offline-candidate/ui026/source/tests/event-transaction.test.cjs`

新增证据 `app026-gift-boundary.tap` 和 `app026-gift-boundary.json`；报告主JSON亦附 mobileGiftBoundary026。核对测试、fixture、实际web生产消费者/ledger/durable恢复/scene-map、实际打包game-03原vu store、原HTML及build.gradle.kts九项SHA精确匹配026 source-hashes；APK SHA也与FROZEN相同：`a780c0e48b9c2ac2c149e761171a6eb6e9098aee84507be5f6409a9527144ab8`。具体每项SHA在新增JSON，不改026冻结材料。

证明范围仍是主机隔离：Native为内存权威/恢复替身，事件ports为内存readNext/ACK回调，未经过Android Java持久化或任何GATT/射频。真实026消费者仍只提交一朵野花与匿名原收据、不建friends/cards；重复相同事件不再奖；伪peerComplete=true拒绝。025测试只保留025历史限定，不据旧025推称026已通过；此处026结论来自本轮实跑。
