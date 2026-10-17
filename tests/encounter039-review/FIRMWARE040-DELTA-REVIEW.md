# Firmware040 冻结 delta 独立复核

## 决定

**039 的 E39-C01/P2、E39-C02/P1 已在040的主机定向复验关闭，可保留为软件候选；未授权部署或真实 schema2 迁移。** 本轮未确认第三项 P1/P2。039 原包及失败证据保持阻断，不被本结论覆盖。

最终 APP 6,410,960 B SHA256 `c3c9d73c0dd3aeb9bdefd21462dc6b36a769b4f1d3ee4eb3bf1ac6cda117addf`；ELF `741a477db43d66d8818b3b6d479383fe05f8b790001c23e0d738bab037aeef4a`；ZIP 2,528,976 B /137项/108源 SHA256 `8993c9733c775f5ee1d9d9ac546c9a48f85adbe5eacaeb517c5c4036cee1cf68`。独立全源/ZIP逐字、九源最终窗口、版本标识、FROZEN/manifest hashes相符；102源同039，六差异与声明精确一致。

## C01：回执64位小写十六进制门

实际040生产 wire/core CLI，复制实际双 FSM 完成 blob 到审查独占文件后执行原039负控：`x`、63/65位、64大写、64非十六进制，均响应失败，blob SHA、lastSeq1/FIFO1/fullslot1不变。合法64小写正控 ACK成功，seq2/FIFO0/fullslot0，永久完成 ledger 保留。原FSM输入没有改写。

命令 `python3 tests/encounter039-review/raw_digest_040.py`；证据 `raw-digest-040-negative.json`。文件名沿用原负控命名，内容是040修复后的拒绝结果。CLI为Root已编译、独立核源窗口的实际040C；CommonCrypto/cJSON/文件 fsync store替身，不是真NVS或Native消费者。

## C02：显示意图→按下→松手→队列→当前物理链路

静态确认 production peer API只复制调用者显示 token，不再点击时替换为最新 public_view；poll先同步物理链路，再核 current enabled/conn/generation/selected peer/HELLO/full绑定/双方counter/FP/current local pet 后持久 consent。pages在真实PRESSED保存 token，RELEASE仅同当前显示token才转交；RESET作废。

1. 独立目录重新抽取五个实际平台函数，编译真实core/FSM，`-Wall -Wextra -fsanitize=address,undefined`。正常确认1持久写；排队后断连、换对端、同对端新generation三类全部零写，reload后的 durable consent仍false且blob精确不变。原039 actualpoll负控保留。
2. 独立 actual LVGL fixture直接包含最终生产pages，新增按下后更换 peerId、generation、connection_handle、local_counter、remote_counter、fingerprint六组；旧松手均零确认，fresh press均精确转交新显示 token。另 valid=false拒绝。44个新增明确CHECK通过，无PET泄漏。
3. 同一最终pages重新执行原全输入fixture通过；报告计数46848包含公共字体/几何断言，不声称全部为新独立设计。新增狭义case46465同样包含46421公共检查。队列接缝为明确记录token的stub，真实平台队列另外由第1项覆盖，不能当成真实射频/硬件触摸。

命令 `python3 tests/encounter039-review/run_stale_consent_040.py`、`python3 tests/encounter039-review/run_pages_040.py`；证据 `stale-consent-independent-040.json`、`pages040-independent-report.json`及各编译/log/json/rgb565。平台fixture沿用本审查039原设计、040 owner适配版，重新独占抽取/编译运行；不是第二套独立设计所有平台stubs。

## 未扩展的结论

core/inc/store/BLE/scene/gesture/partition/config与已审039逐字相同，故沿用此前658条独立原子/满队列/迁移回退审查。没有再跑owner21821等全部套件；owner21821/2703/18/19/56/39及RootJS↔C10项仅作相应软件补充证据，不冒称独立全部复跑。

8中断offer占槽、32永久ledger/200FIFO/7860字节上限、8192 cap不变；没有自动 schema2 迁移/owner接管，也没有038无损读取schema3的回退。单台硬件、双射频、32KiB NVS真实GC/断电、原手机Native原子收据/游戏消费均未验或未接入。UI027 reject-all port仍不是生产消费者。本结论不得触发现有038升级或实际NVS写。
