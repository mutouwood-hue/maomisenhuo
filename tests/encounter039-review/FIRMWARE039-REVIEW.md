# 039 冻结候选独审：阻断，不放行

## 结论

039保持冻结，不部署、不迁移。确认两个阻断：E39-C01/P2（ACK digest形状未按契约）与E39-C02/P1（排队按钮未绑定实际显示身份/连接，可在断连后保存consent）。其余本轮读到的core/peer/store路径未确认新增阻断；不表示真实NVS/双射频通过。修复另在040完成并独立交审，不能改039后继承本报告。

## 包与来源

APP6409968B SHA `275cd9610f0174662dfe9223289a024cead02da3eb2c1dd06f249606e19c5d96`；ELF `e6b15249911bafc25e7e28dbfcf94fb72e6edc8e3416ebff77f4116233566739`；ZIP2528824B/138项/108源 SHA `8f3b55632f9b7b319198ea702206d1084db20477c874c4a4dbdc3a4569a6221f`。独立重算、108源ZIP回读与APP内嵌ELF标识精确，99源逐字038，9delta列于firmware039-frozen-verification.json。r2窗口9源与最终source hashes匹配，manifest SHA5138ae60…1bb8。

## E39-C01 / P2：非法digest可删事件及full binding

r2 local2_wire.c154使用ascii(saveDigest,128)，而契约要求64lowerhex。raw v3 ACK的'x'、63位、65位、64位大写、64位非hex全部通过，进入l2_ack_event，seq1→2、pending1→0、binding1→0，blob哈希改变。64合法值为正控。

实际独立运行已有Root wire-cli-r2（生产wire/core+cJSON/CommonCrypto与host fsync文件持久替身），每个case仅复制实际FSM blob到本review目录写入；原blob逐字未动。raw请求与前后seq/FIFO/slot/sha见raw-digest-r2-negative.json，复现raw_digest_negative.py。这里是结构验证缺陷，不把任何digest字符串当可信Native历史或认证。

修复门：严格长度64及[0-9a-f]；所有非法值invalid/no_change、blob/seq/FIFO/fullslot不变。040当前owner证据不是本报告对修后最终源的独立放行。

## E39-C02 / P1：排队确认在实际断连/换peer后仍持久旧consent

r2 local2_peer.c228的API只排{confirm:true}，无显示时peer/tuple/link token。poll237-238先消费confirm，再245-254处理已经变化的实际link_gen。纯FSM只看尚未更新的machine.view.connected，因此会对旧peer持久确认。

独立夹具逐字提取actual local2_peer_confirm/local2_peer_poll，链接真实r2 core+pureFSM；队列/conn全局/clock/RNG/transport_poll/store锁为显式host替身。

- 正控：B待确认→按钮入队→连接不变→persist1、durableConsent true。
- 负控：同样按钮入队后，先发生B断连→下一production poll→仍persist1并将旧B consent保存；完成poll时machine已断连。重载blob仍true。
- 负控：同样按钮入队后实际切到C/new generation→下一poll→仍persist1为旧B保存consent，再切到新连接。

证据stale-consent-r2-negative.json；复现run_stale_consent.py、stale_consent_fixture.c、pinned-platform-functions.inc。不是整ESP/NimBLE/射频实测，但此生产poll顺序已实际执行，不只纸面推测。

修复必须绑定显示/按下时peer+完整tuple+physical generation/conn，并在处理前核当前连接与持久binding。不应只调顺序，把旧A按钮用来批准新B。还须实际LVGL按下A→画面换B→松手负控和全新按下正控；040最终源/接口另审。

## 其余core/迁移/容量：独立证据与边界

自有ASAN/UBSAN生产core夹具658断言通过（core_atomic_review.c、core-atomic-r2-report.json）：

- 实际7860B最大blob load→encode字节精确；32peer/200FIFO/8fullslot保持。不是NVS分区GC容量证明。
- schema2生产load为MIGRATION_REQUIRED、零persist、init-new拒绝。纯host converter零写，旧编码主体（除magic/version/CRC）逐字保留，owner seq/hash及原FIFO不变；新nextEncounterCounter1、无反补completion。
- synthetic precomplete由实际双FSM已完成blob导出：只撤本端event/完成位并保持真实phase63。用此明确测试输入检查最终原子transition，并不声称是新真实consent来源。
- persist落盘前失败：RAM/NV都无completion；落盘后返回false：RAM仍旧且锁写，重载NV获得恰一个completion事件和watermark，再advance duplicate零新写。
- FIFO200满时QUEUE_FULL、零额外persist，phase63保留且不complete；合法ACK腾一位后event+first_complete同work一次commit。完成事件未ACK前fullslot一直保留；ACK该事件同commit释放slot，永久ledger及重启后dedup仍保留。

静态代码复读：inc107为event+水位同commit；core82为ACK+slot清理同commit；未知写结果storage_error锁写；身份完整pet/FP绑定，wire peer_complete从full binding读pet、不会偷换为当前snapshot；compact后重连HELLO仍核当前身份/原FP。旧gift不反补新事件；旧026/v2 gate先于core取锁/变更。platform store沿038原单blob/无自动擦除，实际schema2不会调用host converter。

现有owner21821 core/peer、2703旧core、18store、19wire、56抽取frame、3UI软件glyph为owner证据，未冒称独审全量重跑。这些原suite未覆盖C01非法digest及C02实际poll排队竞态；正常64digest CJS10正例不能代替它们。

## 仍未证明

生产schema2迁移/owner续接未授权；038无法读schema3，不存在只刷APP即可无损回退。8个未完成OFFER可能占满，合同只保留defer、不暗删已consent记录。实际32KiB NVS GC/掉电、真实Native original-result verifier/原游戏社交consumer、双设备射频和物理按钮均未验。当前只有一只硬件，038/026仍原样运行，本线程无设备动作。
