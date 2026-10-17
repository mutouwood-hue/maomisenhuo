# M2 三端实施契约

状态：2026-10-14 开始实施。HTTP资源、安全约束及BLE kind10–15、20–23布局已冻结；实现与未验证状态逐条记入验收矩阵，变更须跨端协调。

## 需求基线

用户本轮指定 [当前 Notion PRD](https://app.notion.com/p/dabc209ad67f8338af9101d5810f7160?source=copy_link)，已使用 `ntn pages get dabc209a-d67f-8338-af91-01d5810f7160 --json` 成功读取 v1.9 开发版，`truncated=false`、`unknown_block_ids=[]`，正文见[当前抓取](<../_ref/prd-user-current-20261014.md>)。此前错误新链接404为历史记录，不再作为当前PRD阻塞。已有明确决策沿用，原PRD未定参数登记而非擅自批准。M2包括OTA、人格漂移与主动表达；不能默认移到M3。真实硬件、场景模型及外部服务另分证据等级。

## 分工和修改边界

- backend：backend/（路由、SQLite、领域服务、DTO、OAS、测试）。
- mobile：mobile-pet/（原生JS/CSS与Capacitor；保留已有后台定位工作）。
- firmware：firmware-v2/（生产runtime、策略、驱动和固件测试）。
- verification：docs/m2-requirements.md、docs/m2-verification.md、tests/integration/m2-*。
- audio-model：tools/environment-model/、docs/m2-environment-model.md（合法数据约束、DSP/训练/分组评估/导出工具；未训练模型不标分类验收）。
- Lead：本契约、根构建配置、统一集成与审查。所有范围外修改先协调。ASCII firmware staging只允许串行构建。用户本轮已明确授权自行安装 APK、烧录固件并验收，设备操作由 Lead 独占：核对型号/端口/现分区、备份私有状态、保留 NVS，不整片擦除或烧写 eFuse；历史禁止部署只描述此前授权边界。

## HTTP约定

保留既有接口与local-v1协议。新增接口/api前缀、Bearer身份、统一{code,msg,data}信封，code=200成功，结构错误400，鉴权401/403，业务失败HTTP200+稳定业务码。所有POST写要求Idempotency-Key，绑定当前账号、路由和规范化请求摘要；相同键不同内容冲突。ID字符串，时间Asia/Shanghai yyyy-MM-dd HH:mm:ss，枚举字符串，新增布尔isXxx，分页page/size且响应{list,total,page,size}。

### 已冻结资源

| 资源 | 操作 | 约束 |
|---|---|---|
| social-settings | GET/PUT | baseRevision,isDiscoverable,venueId可选；默认不发现 |
| discovery-tokens | POST | deviceId/sessionId；短期随机匿名token，不发明文MAC或真人身份 |
| encounters | POST/GET/GET:id/POST:id/proofs/POST:id/cancel | deviceId/sessionId/peerToken/method；仅参与者，双方设备证明才确认；GET?status=PENDING分页只读，自动发现本方会话，无需手填ID |
| friendships | GET/DELETE:id | 双向形成，支持24小时反悔；不直接暴露联系方式 |
| friendships/:id/contact-consent | PUT | 双同意才解锁各自授权联系方式 |
| blocks/:friendshipId | PUT | isBlocked；后续会话、送礼、交换均复核 |
| reports | POST | 当前关系与reason，举报数据不回传给被举报者 |
| collections/current | GET | breeds/goals/graduates/assets/lineage/skills；存档派生与权威实例分离 |
| assets | GET | 云端实例，客户端save不可铸造 |
| m2-policy | GET | 能力开关及缺失配置，不能把未配置称已开放 |
| encounters/:id/options | GET | 当前双方确认会话参与者的peerAssets/peerSkills/peerParents有限资格DTO；关系、归属epoch、动作时窗复核，不暴露全档或联系方式 |
| exchanges | GET/POST/POST:id/confirm/POST:id/cancel | encounterId/offeredAssetId/requestedAssetId可选；陌生RANDOM，好友DIRECTED；GET?status=PENDING分页参与者只读 |
| gift-options | GET | 必填query friendshipId；当前关系授权后仅返回PET_RANDOM候选聚合范围，禁止资产/seed/类别/稀有度筛选 |
| gifts | POST/GET/POST:id/cancel | 新POST严格{friendshipId,selectionMode:'PET_RANDOM'}；服务端一次随机锁定实际资产，assetId仅结果字段；下次新的真实双方遇见才送达 |
| skill-learnings | POST | encounterId/skillId；真实技能来源、关系门槛、唯一随机结果 |
| skills | GET | 权威持有技能 |
| breedings | GET/GET:id/POST/POST:id/consents/POST:id/claim/POST:id/cancel | 双父母与双方授权，冻结快照/成本/退款/两份唯一子代权益；参与者列表与单项状态供双方恢复 |
| environment-consent | GET/PUT | 独立baseRevision/isEnvironmentGranted，不修改旧四布尔语义 |
| environment-events | POST | 设备签名、当前授权revision、逐条终态回执；禁止原音频与谈话文本 |
| environment-days/:date | GET | 授权标签时间线；最早采样+七天TTL，撤回清除且去重墓碑防复活 |
| pets/:catId/personality | GET | 云端人格状态与明确可用性 |
| pets/:catId/personality-events | POST | 只允许引用服务端真实已结算事件，不接受任意奖励/漂移 |
| pet-diaries | GET/POST | Should；本机摘要/云文字分别标来源与逐次文字同意，无key不假装云成功 |

详细DTO由backend/docs/m2-http-draft.md逐项展开并向mobile同步；修改已冻结字段须全队协调。

## 双向遇见安全

1. 双方发现开启、两设备已绑定不同主人且同步session有效；匿名token有效。当前场地必须非空且通过可信短租校验，遇见创建、双方proof与后续经济动作均复核场地快照和归属session epoch；公开allowlist或客户端自填PILOT不证明物理在场。
2. 服务端生成共同encounter UUID/nonce32/15秒有效期，两个方向自/peer MAC反向。
3. kind10复用原session+counter+HMAC签名对象；主体66字节、proof64字节已冻结。HTTP ownChallengeBase64为118字节签名信封，rawChallengeBase64仅参考主体，不可直接写BLE。
4. 固件验证服务端签名、当前session、自设备ID、时间窗；仅本机已进入确认流程且真实输入匹配才签证明。不能提供手机任意指定hash的通用签名oracle。
5. transcript共同规范化摘要必须相同；两侧MAC排序，nonce与method域隔离，KNOCK不能各自浮点归一产生不同字节。QR也必须双端物理确认，不可服务端知道nonce就冒充设备证明。
6. 双证明+当前绑定/session复验后事务落地，单证明、重放、超时、取消、换主人失败关闭；同内容重试幂等，不同proof冲突。
7. 一设备并发会话互斥，BLE/RSSI并非安全测距；密码学不保证抵御物理无线中继攻击，报告真实限制。

## 经济和生蛋

资产实例独立于客户端完整save，来源与所有权可追溯。交换锁→双方确认→短事务所有权/账本→幂等回执，不能依赖内存完成。礼物运输触发必须新的双方确认遇见。用户已明确允许可配置试验默认值，非正式产品定案；缺必要配置仍失败关闭并解释NOT_CONFIGURED。用户已选择双方各获一个孩子：双方各有独立唯一子代权益、容量检查、claim及谱系，不共用一个可重复领取的子代。父母成年、健康、币、稀有资格必须从权威成长/账本读取，不信任客户端PUT save自报。测试fixture与试验参数应标明来源，后代云端生成且重试不重抽，legacy cat-N仅兼容展示。

## PET_RANDOM 赠礼增量冻结（2026-10-15 文档修正）

以[实际DTO](<../backend/src/m2/contracts.mjs#L17-L31>)和[实际赠礼服务](<../backend/src/economy/service.mjs#L73-L76>)为准，本节替代旧新建请求 `friendshipId/assetId`，不改变既有已运输财产权。

1. Bearer `GET /api/gift-options?friendshipId=...`，operationId `economy.giftoption.get`。仅此query键；先复验当前玩家有效关系/拉黑，再聚合自己所有AVAILABLE、原目录isGiftable、kind属于ITEM/OUTFIT且rarity≤giftMaxRarity的实际候选，不受默认20资产分页截断。data严格 `{selectionMode:'PET_RANDOM',candidateCount,eligibleKinds,maxRarity,isExperimental:true}`；eligibleKinds是当前实际候选类别（可为空），不是保证两类均存在。不得返回seed或可控精准候选选择器。
2. 明确向主人显示当前范围和“宠物决定”，确认后 `POST /api/gifts`，operationId `economy.gift.create`，严格body `{friendshipId,selectionMode:'PET_RANDOM'}`，带稳定Idempotency-Key。禁止assetId/seed/kind/rarity/filter额外输入；无候选47002，不明确PET_RANDOM或额外新结构字段HTTP400。携旧assetId的新提交先做关系授权，再47006要求刷新，不能先泄露第三人候选。
3. 预览只读、不预留、不锁定；与POST之间状态可能变化。POST事务当下重验候选/归属/权限/锁、一次随机选择并持久唯一asset锁+运输记录+幂等回执；相同key同body不得重抽，冲突key拒绝。范围不是精确资产承诺；禁止手机自抽/传seed/用其他请求筛选目标。
4. GiftVo `{id,status,friendshipId,assetId,createdAt,selectionMode?,deliveredAt?,deliveryEncounterId?}`，status `IN_TRANSIT/DELIVERED/CANCELLED`；新记录有selectionMode PET_RANDOM和初始deliveredAt null，deliveryEncounterId在实际交付后出现。GET /gifts按page/size参与者分页返回。assetId是服务器已选结果而非新POST输入；历史记录可无selectionMode，不擅重抽或删除。仅给予者可取消自己的未交付礼物，并仅释放当前该运输ID拥有的锁；已送达47004。
5. 无新遇见不邮件到账；只在新双向CONFIRMED遇见且礼物createdAt早于该遇见createdAt、关系/拉黑/原资产锁复验后转移实际所有权。当前双方确认HTTP是密码学测试层，仍不证明实体距离；双吧唧运输动效待实机。
6. 给予者奖励独立于交付：同无向friendship×encounter运输批次双方统一一次随机结果，每给予者每批至多一组目录奖励。持久gift_reward冻结概率/结果/批次与已奖owner；奖励不获或冷却不能阻止交付。试验默认 `giftRewards={decayPermille:[1000,250,0],dailyLimit:2,cooldownSeconds:60}` 可配置，终生批次衰减与上海日界计次/restart不重置；历史无批次交付按秒保守计入，不宣称生产数值定案。

## 最新明确决策与wire编号

- 用户允许团队提出可配置试验默认值，正式发布前审定。
- 玩家生蛋双方各获一个孩子；两侧独立权益与领取状态。
- ASR方案暂不定：不得启用云原音频上传；自由识别能力只做未启用适配，不能假装本机或云ASR通过。
- signed kind10：social challenge66入（ownChallengeBase64为118B签名信封，rawChallengeBase64仅66B参考）；kind11：ENV consent10入；kind12：SOCIAL_PROOF64读出；kind13：ENV_STATUS10读出；kind14：ENV_EVENT56读出；kind15：ENV_ACK signed入，body8 uint64事件ID。原kind8 care ACK不变。
- ENV_STATUS10：version@0、flags@1（granted1/active2/model4/fault8；其余位拒绝）、revisionLE4@2、label@6、confidenceLE2@7、reserved0@9。
- local OP_ENV_STOP=7：空payload、当前session身份校验、ACK originalOpcode7；只关不开，清RAM与pending标签，持久当前revision撤回墓碑。断连/expiry仅暂停，不写用户撤回墓碑；重连/重启不得恢复已撤回revision，新同意revision必须更大。持久失败仍停采且报错。
- challenge66：v1 u8、encounter UUID16、self MAC6、peer MAC6、共同nonce32、expiry Unix LE4、method u8（1QR/2KNOCK/3PATTERN）；外层session UUID16+counterLE4+HMAC32。
- proof64：transcriptHash32+HMAC32，签名domain BAJI-MEET-v1无NUL+selfMAC6+challenge66+hash32。hash=SHA256(BAJI-TRANSCRIPT-v1+encounterUUID16+sortedMAC12+nonce32+method1+canonicalPattern)。QR空、KNOCK=count u8+发起方intervalsLE16(count-1)、PATTERN=count u8+point bytes。双方用同一参考输入，本地先匹配才签。
- ENV授权10：v1 u8+consentRevisionLE4+granted u8+expiryUnixLE4。
- ENV事件56：body24（v1 u8+eventIdLE8+unixSecondsLE4+consentRevisionLE4+label1+confidencePermilleLE2+sampleSecondsLE2+flagsLE2=0）+HMAC32(BAJI-ENV-v1+selfMAC6+body24)。label0UNKNOWN/1QUIET/2CONVERSATION/3NOISY/4MUSIC；未知模型只状态UNKNOWN，不产生场景云事件。
- ACK15只对持久已终态事件签发；撤回删除敏感标签而保留安全墓碑/epoch去重摘要，旧事件不可复活。

## 环境感知

Q9已确认合规通过。独立用户同意、签名下发授权及revision/expiry，本地开关/可感知收音指示/低电停采/撤回即时清RAM仍要实现。音频仅端侧RAM处理，不存传原环境PCM、不转写/识别人。标签上传应有设备签名；旧EVENT16不得悄悄重定义。没有场景模型时UNKNOWN明确为未完成分类；provider及安全采集路径可以单独验收。场景混淆矩阵、功耗、真实环境录音均待实体样本，不用合成PCM证明准确率。

## 子代容量与恢复（2026-10-14用户确认）

新双边扣费准入：各方max(legacy家庭数量,权威宠物数量)+未领取已预留权益<6，原存档PUT不增加破坏性容量拒绝。用户明确选择保留固定子代，腾出位置后领取：不设强制领取期限、不重抽、不自动删猫或退费，不新增单边放弃接口。一侧已领取不能取消另一侧固定权益；maintenance不得过期清除已生成未领权益，重试与重启后仍可领取。满家返回明确可恢复提示，允许清理/毕业本地非权威猫后重试。

## OTA v1冻结（2026-10-14）

详细字节与状态机以[OTA wire](<../firmware-v2/docs/m2-update-wire-draft.md>)为准，kind20/21/22签名入、23只读出，不改现20B GATT封包/512B对象上限。

- BEGIN20 body：schema1@0、kind1APP/2ASSETS@1、target16@2（ASCII `baji-s3-175c-v1`实际15B，只补1个0）、versionLE4@18、sizeLE4@22、SHA25632@26、releaseId16@58（hash前16）、DER lengthLE2@74、signature8..80@76。
- 发布签名ECDSA secp256r1/P256 SHA256严格DER，签`BAJI-UPDATE-v1`无NUL+manifest前74B；外置可信PEM，不由请求带key，不生成生产私钥。不等于SecureBoot/eFuse硬件防回滚。
- CHUNK21 body=releaseId16+offsetLE4+1..440B数据，signed对象最大512；FINISH22 body=releaseId16。当前session绑定、顺序offset、已接区间flash相同才幂等；禁止错ID/部分重叠/任意覆盖，断连/expiry/低电abort且不跨session续传。
- STATUS23 40B：schema@0,state@1,packageKind@2,reason@3,releaseId16@4,receivedLE4@20,expectedSizeLE4@24,versionLE4@28,firmwareFloorLE4@32,assetFloorLE4@36。state0IDLE/1RECEIVING/2VERIFIED/3FAILED，reason0..12按wire文档；完成须VERIFIED，不仅COMMIT ACK。
- firmware只inactive写入、全镜像hash+ESP32-S3镜像校验后选boot槽，不自动重启。启动健康检查+floor持久读回后mark-valid，失败回滚；本地pending hash/slot固定的同version恢复例外不可降低floor。
- ASSETS为固定7MiB SPIFFS镜像，固定allowlist资源manifest含当前firmware兼容[min,max]与各文件hash；挂载不格式化。资源验证、缓存切换及active slot+floor原子NVS提交失败保旧，不能把嵌入图标当热更新验收。
- HTTP `GET /api/ota-manifests/{APP|ASSETS}?deviceId=...`仍信封；鉴权`GET /api/ota-artifacts/{releaseId}?deviceId=...`成功为binary例外，失败仍信封。仅同源固定服务端配置制品，size/hash/签名验证，无配置明确关闭。
- 既有signed-objects接口OTA DTO `{sessionId,kind,releaseId,offset?}`：20/22无offset，21必填uint32 offset；禁止请求提交任意data。后端从已验证制品生成body与设备session HMAC，不向手机泄露deviceKey；每POST有Idempotency-Key。
- 7MiB需约16682个chunk及HTTP签发和BLE分页，15分钟session可能不足；未实测吞吐，不延长普通session或假装续传来报告成功。实际签名根/挂载/render/设备升级断电测试仍独立门禁。

## 社交 peer 增量接口 v1冻结（2026-10-14）

新增16/17只读和18签名入，不改变10/12及其transcript。接口冻结不等于peer认证、NimBLE双角色或实体输入已完成；peer身份和传输协议仍须单独审查，缺可信身份配置失败关闭。

- STATUS16固定30B：schema1@0；capabilities@1（QR1/knockInput2/patternInput4/concurrentAuthenticatedPeer8）；state@2（0IDLE/1DISCOVERING/2REFERENCE/3FOLLOW/4MATCHED/5FAILED）；method@3；flags@4（peerReady1/referenceReady2/localMatched4/peerMatched8）；reason@5（0none/1timeout/2peerMismatch/3inputMismatch/4power/5sessionEnded/6transport/7untrustedPeer/8missingRole）；encounterUUID16@6；peerMAC6@22；count@28；reserved0@29。高四位及reserved拒绝。IDLE的method/ID/MAC/count/flags/reason为0；MATCHED须全部ready/matched位和有效reference。REFERENCE/FOLLOW须peerReady及role有效，未录完count允许0。FAILED须非0reason，不得输出proof。
- 发10前只检查对应input能力+concurrentAuthenticatedPeer能力，不能要求尚依赖challenge的peerReady。10成功后再18，可信peer握手完成后才进入参考/跟随输入和证明阶段。较小MAC只负责BLE central连接选举，与HTTP创建方录参考角色无关。
- REFERENCE17固定84B：schema1@0、method2/3@1、count@2、reserved0@3、encounterUUID16@4、payload64@20。KNOCK count4..8，前(count-1)*2字节为正uint16LE毫秒间隔；PATTERN count4..9，前count字节为0..8唯一点位；剩余payload必须0。canonical分别count u8+intervalsLE16（7..15B）或count u8+points（5..10B），追加包含实际method的既定base transcript，不能以QR method1作为base。手机仅读取同encounter/method参考计算公开摘要，不上传pattern/hash请求设备签名。
- ROLE18 body23B：schema1@0、encounterUUID16@1、initiatorMAC6@17；外层现session16+counterLE4+HMAC32，总75B。请求DTO严格`{sessionId,kind:18,encounterId}`，server从当前参与者且有效场地/归属/设备session绑定的权威encounter创建方解析MAC，禁止请求自带role/MAC/data。POST持续幂等；相同role不重新开始输入，不同role拒绝。固件只接受先10成功且精确匹配当前challenge的18，initiator恰为self或peer；缺role不采集暗号、不出proof。
- 16/17仅owner当前有效签名session可读；无参考17长度0。断连/expiry/换session/challenge/取消/低电清参考、match、proof及冻结读缓存，不能跨session复用；只读对象不得COMMIT。每侧只在本机真实输入和可信peer匹配成功后输出12。
- 设备证书外置P256可信根及设备身份、fresh随机握手和已认证消息密钥为实现候选，未配置不得设置authenticatedPeer能力或peerReady；共同公开nonce不是认证密钥。证书绑定MAC、握手/密钥派生/domain/重放/分片上限须审查和主机负向测试，不宣称抗无线relay。

## 年龄与监护隐私资格（2026-10-14）

旧PRD1759–1761：不满14周岁须监护人同意，儿童默认位置与环境感知关闭。`14_PLUS`不表示成年；不新增出生日期/身份证/监护联系方式收集，不把客户端年龄或勾选当可信证明。

- server-only DI `options.privacyEligibilityProvider({accountId,now})` 返回 `{accountId,ageBand,guardianScopes,evidenceId,expiresAt}`。ageBand枚举`UNDER_14/14_PLUS/UNKNOWN`；guardianScopes仅`LOCATION/ENVIRONMENT`；expiresAt内部finite safeinteger Unix毫秒且未来，evidenceId非空，账号须精确绑定。provider抛错、畸形、未知、过期都失败关闭；生产缺provider不默认注册账号为成人。
- Bearer `GET /api/privacy-eligibility`，operationId `privacyEligibility.get`，统一信封；data仅`{ageBand,status,isLocationEligible,isEnvironmentEligible,expiresAt}`。status为`ELIGIBLE/UNCONFIGURED/GUARDIAN_REQUIRED/UNKNOWN/EXPIRED/INVALID_PROVIDER`，expiresAt上海datetime或null，不出evidence/监护身份。资格不是用户授权，GET不能自动开启功能。
- `14_PLUS`仍需独立用户主动同意；`UNDER_14`每敏感scope同时须可信guardian scope与用户主动同意。资格无效41003、对应guardian scope缺失41004为HTTP200业务失败；鉴权401/归属403独立。基础游戏/关闭/删除/OTA不因资格缺失阻断。
- 位置写、环境授权/sign11/event、当前发现须当下复核。ENV授权expiry clip到provider与device session最小值。失效时持久撤回revision、清派生敏感数据再签granted0；不得throw导致外事务回滚撤回。恢复资格不自动恢复旧授权，离线STOP独立可用。
- Tests仅隔离显式账号allowlist DI正常资格；生产真实年龄/监护服务未连接，不宣称完成外部验证。原life敏感tests需明确注入fixture资格，不能生产绕过。

## 签名活跃片段 24/25（2026-10-14 增量冻结）

- 24只读队头固定71B：schema1 u8@0、eventId uint64LE@1（设备全局单调非0）、catAlias uint32LE@9（`cat-N`的N，非0）、fromUnix uint32LE@13、toUnix uint32LE@17、activeSeconds uint16LE@21、sessionUUID16@23；前39B后接HMAC-SHA25632，域为ASCII `BAJI-ACTIVE-v1` + selfMAC6 + body39。
- 25为当前owner/session/counter签名终态ACK，body8=eventId uint64LE。使用既有 `signed-objects`，DTO严格 `{sessionId,kind:25,eventId}`；未有对应terminal receipt不得签ACK。只读24不得commit，ACK应用后清冻结队头。
- 固件32条持久FIFO，不覆盖未ACK；满停计时并可见fault。仅有效authenticated owner、当前session/clock/当前显示父母非sleep时产生≤10秒真实单调计时片段；切猫/epoch/断连/到期立即停止，不累积离线墙钟。`1<=activeSeconds<=to-from<=10`，未完成零化片段不得跨会话延续；NVS失败锁存，eventId不复用。
- `POST /api/devices/{deviceId}/active-batches` DTO `{sessionId,events:[{eventId,signedEventBase64}]}`（每批1..32）；当前归属/session授权错误为403，逐项结果 `{eventId,status,code,msg,isTerminal,isSettled}`。仅终态后mobile取得signed25并ACK；网络/设备失败保留队头，账号epoch改变禁止旧上传/ACK。
- 后端验证精确长度/schema/签名/ID/session/父母所有权，`from>=可信session开始/bound/paid`、`to<=now+1s`及session expiry、禁止同session/cat重叠片段（不同ID也不准）、hash/设备ID持久去重；不存原签名字节，仅receipt/hash/范围。session起点显式clock写入，旧缺可信起点要求重绑，不从expiry减TTL猜测。
- 双方各自父母≥3次真实照料与≥60s片段才READY。历史paid固定child权益保留，READY需新真实active，不能追认墙钟；取消/领取仍唯一。
- **等价性限制**：当前PRD强调“页面活跃”；仅吧唧前台不能自动等价手机页面可见，当前连接硬件的保守实现须明确限制，手机不可用自制心跳造可信active。手机视图可见状态安全信号及产品等价性仍待核验；实现协议不是这项真机验收完成。

## 验收证据

逐条记录代码位置、host tests、真实HTTP两账号两设备签名联调、手机构建、固件编译、视觉核对、真机及外部服务缺口。自研PCB/NFC、实体按钮、无线scan并发、音频/耗电、OTA断电回滚、云ASR/LLM服务、现场D14/D28不具备证据时不得标完成。
