# Peer认证精确wire v0（待Lead审，未冻结/未实现）

不改owner kinds10/12/16/17/18。整数LE，域ASCII无NUL，ECDSA r/s大端low-S。根和工厂私钥外置，禁止用owner HMAC key或公开nonce作为peer key。

## 证书168B
schema1@0/rootKeyIdLE4@1/serial16@5/deviceMAC6@21/P256未压缩公钥65@27/notBeforeUnixLE4@92/notAfterUnixLE4@96/usageLE4@100（仅1=peer）/rootSignature64@104。验证ECDSA-SHA256(`BAJI-PEER-CERT-v1`+前104B)。拒未知根、无效点/无穷点、MAC不符、usage不符、时钟未知/过期、被撤销serial。根轮换及签名撤销名单配置待审；重复收到同一证书不等于serial冲突。

## HELLO305/AUTH66/FINISHED34
HELLO：schema1@0/type1@1/challengeDigest32@2/HTTP initiatorMAC6@34/cert168@40/freshRandom32@208/ephemeralP256public65@240。
challengeDigest=SHA256(`BAJI-PEER-CHALLENGE-v1`+encounter16+sortedMAC12+challengeNonce32+expiryLE4+method1)，须和当前owner批准10及18精确一致。
C=较小MAC连接central，P=较大MAC，不决定录参考角色。T=`BAJI-PEER-HANDSHAKE-v1`+helloC305+helloP305。
AUTH=schema1,type2,signature64；工厂私钥签SHA256(T+senderMAC6)。双AUTH验证且owner epoch仍有效后ECDH，IKM=X32；HKDF-SHA256 salt=SHA256(T)，info=`BAJI-PEER-KEYS-v1`+salt，输出96按K_CtoP32/K_PtoC32/K_confirm32切分。
FINISHED=schema1,type3,HMAC32(K_confirm,`BAJI-PEER-FINISHED-v1`+salt+senderMAC6)。本机发送且验证对端FINISHED后才peerReady。每步校验owner epoch/role/expiry；RNG/曲线/签名/派生失败关闭并擦除临时秘密。

## 应用消息header28+payload0..84+tag32
schema1@0/type@1（4REFERENCE/5MATCH/6CANCEL）/seqLE4@2/encounter16@6/senderMAC6@22/payload@28。
HMAC-SHA256(directionKey,`BAJI-PEER-MSG-v1`+salt+header+payload)。seq从1严格顺序、不回绕；完全相同上条重试只允许无副作用重ACK，其余旧序/篡改拒绝。
REFERENCE payload=frozen17 84B，只能18 HTTP initiator发送；MATCH payload=canonical transcriptHash32，只能真实本地输入匹配参考后发送；本地与可信peer MATCH一致才proof12。CANCEL payload空。手机无注入这些消息路径。流控ACK不表示应用MATCH成功。

## 分片及owner共存
候选专有service UUID 6e648201-5680-49cf-a6a9-27bf114aec10，RX尾ec11 write-response，TX尾ec12 indicate（UUID分配待审）。ATT8..20B：schema1@0/type@1（0DATA/1ACK）/messageIdLE2@2/totalLE2@4/offsetLE2@6/data0..12@8。DATA非空；完整对象max305B；每方向仅一个buffer；total固定、offset顺序、重复区段仅相同内容。ACK固定8B/offset下一个期望位置，只作非认证流控。ID从1不回绕，完整重试保留上一对象摘要和组装元数据直到下一ID，冲突/超限/超时失败。
组装1000ms/每片最多3次重试/握手5000ms且不越15s challenge deadline；不能延长session。NimBLE至少2连接：owner peripheral+peer elected central/peripheral；owner/peer独立conn epoch/订阅。owner断连/expiry/换代/低电/取消立刻断peer、擦key/reference/match/proof/frozen16/17。STOP/care FIFO优先，peer背压不阻塞owner；crypto/NVS仅sole worker，BLE callback不做重计算。

## 确切状态与失效（未冻结）
- 启动固定只读根/设备身份私钥/根签名撤销名单；缺任一配置或名单无效/过期/版本回退不声明认证能力。名单编码另待审；所有cert/AUTH验证1<=r<n、1<=s<=n/2，不仅签出low-S。
- IDLE→WAIT_ROLE（当前10成功）→HELLO_WAIT（18匹配）→AUTH_WAIT（唯一有效HELLO）→FINISHED_WAIT（验证AUTH）→READY（本机FINISHED已发送且peer FINISHED验证）。完全同字节HELLO/AUTH/FINISHED重传仅重发不可变缓存下一消息，不重新生random/key、不延长时限/重置序号；同阶段冲突字节失败。保留完整上一握手对象用于精确比较，而非只靠非认证CRC。
- 分片ACK仅接受inflight ID/total及已实际发送单片末offset。越界/跳片/其他ID忽略，3次异常失败。仅推进当前不可变对象发送游标，不推进认证/参考/match/proof；每对象3000ms、总握手5000ms单调限时，伪造ACK至多造成拒绝服务。认证状态只由实际收取并验证AUTH/FINISHED/MATCH推进；indication成功也不是应用成功。
- READY后initiator→REFERENCE_RECORD，follower→REFERENCE_WAIT。initiator仅本机真实输入录制reference，录完→REFERENCE_AVAILABLE并发送REFERENCE，localMatched表示有效真实录制（不需再录一次，语义待Lead确认）；发送MATCH(hash)。follower验证来源/角色/84B编码→FOLLOW_INPUT，必须另一侧真实本机输入匹配reference后localMatched并发送MATCH(hash)。不允许把接收到/回显参考当作输入。
- 对端MATCH可先缓存，不设置localMatched；sender必须另一MAC且hash等于本机从reference构造canonical。双方localMatched && peerMATCH && peerReady && referenceReady→MATCHED才proof12。方向key+sender检查阻止本机MATCH反射；initiator录制算localMatched仍待确认，未确认不接proof。
- 所有阶段遇到owner epoch/session/challenge/role变化、expiry/低电/取消/输入错误清key/input/reference/match/proof/frozen16/17并失败；新challenge必须新握手。
- 时钟bootstrap待审：现kind9无fresh请求nonce，收到签名时间不等于实时性。候选需要当前session可信时钟锚与最大往返界；不足则无认证能力。首次challenge锁定monotonic deadline=min(now+15s,可信expiry剩余)，后续wallclock回拨/新clock不能延长；未知时钟/超界跳变/撤销清单到期失败。不新增kind或默认冻结fresh clock方案。

## 撤销名单及根版本精确候选
名单=header23+16*N+signature64（N0..32，最大599B，仅外置配置，不走305B peer object）。schema1@0/rootKeyIdLE4@1/revisionLE4@5/notBeforeUnixLE4@9/notAfterUnixLE4@13/minCertSerialEpochLE4@17/countLE2@21/serial16列表@23/签名@23+16*N。serial列表严格字节排序、唯一；保留minCertSerialEpoch=0（证书没有serialEpoch字段，非0拒绝，不暗加证书字段）。根签ECDSA-SHA256(`BAJI-PEER-REVOKE-v1`+前23+16*N字节)。完整名单固定启动快照，rootId精确匹配、不允许请求提供根；rootId不是单调安全版本，另以signed OTA package version+持久floor控制配置回退。新root需要独立OTA签名根授权的受信资源，启动根集合不可被peer扩充；删除旧root必须显式受信发布。NVS软件floor不能宣称硬件防回滚。

## 时钟bootstrap精确候选（未赋kind）
仅靠现kind9不充分。候选专门的时钟认证object，需要Lead/backend/mobile共同审查，不先接生产：设备在有效owner session内生成nonce32并记录单调t0，owner只读请求候选schema1+session16+nonce32（49B）；后端只为当前device/session签发body=schema1@0/session16@1/nonce32@17/unixMillisLE8@49/timezoneLE2@57（59B），tag32=HMAC(deviceKey,`BAJI-CLOCK-FRESH-v1`+deviceMAC6+body)，总91B。不复用BAJI-SYNC域，不给手机deviceKey。唯一未决nonce，签名到达t1-t0<=2000ms，精确session及nonce匹配、timezone±840；一次消费nonce，重试仅同字节无副作用且不重置时钟。新nonce作废旧请求；重连/expiry擦请求及可信时钟。
设server签发毫秒S，接收时可信区间[S,S+RTT]；后续单调经过dt后区间[S+dt,S+RTT+dt]。证书/撤销清单notBefore要求区间下界>=边界，notAfter/挑战expiry要求区间上界<边界，避免延迟扩展有效期。wallclock更新不改变已经锁定的单调challenge deadline；新增clock超过旧区间允许漂移±250ms则终止peer重新bootstrap，不延长旧challenge。时钟锚最长60s，过期无认证能力；发送10前先fresh clock，但无需peerReady。完整请求/响应91B需额外只读/签名入编号，编号待审且不占kind24；不改既有9长度。

## 审查门禁
偏移长度独立核算、静态断言；根轮换/撤销策略；签名/ECDH/HKDF/HMAC独立golden；reflection/role互换/旧challenge/replay/fragment超时/owner换代负向。先审冻结再实现认证，源码双角色编译后再两设备无线及真实输入验证。BLE/RSSI不承诺抗relay。本候选没有生产认证源码或硬件验收证据。
