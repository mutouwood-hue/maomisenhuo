# M2 peer 增量契约候选（待Lead冻结）

不改kind10 challenge66/kind12 proof64。输入必须徽章本机IMU敲击或触摸九宫格，不接受手机上传参考或hash。较小MAC仅决定BLE central连接发起，HTTP initiator负责录参考，另一方跟随。

## 候选16 SOCIAL_STATUS readonly30B

0 schema1；1 capabilities bit0QR/bit1knockInput/bit2patternInput/bit3concurrentAuthenticatedPeer；2 state0IDLE/1DISCOVERING/2REFERENCE/3FOLLOW/4MATCHED/5FAILED；3 method；4 flags bit0peerReady/bit1referenceReady/bit2localMatched/bit3peerMatched；5 reason0none/1timeout/2peerMismatch/3inputMismatch/4power/5sessionEnded/6transport/7untrustedPeer/8missingRole；6 encounterId16；22 peerMAC6；28 count；29 reserved0。

IDLE ID/MAC/count/method全0。手机发10前检查input+concurrentAuthenticatedPeer能力，不要求peerReady，避免循环。peerReady仅双方同challenge可信身份握手后置位，作为录参考/跟随/proof前置。bits4..7及flags4..7保留0。

## 候选17 SOCIAL_REFERENCE readonly84B

0 schema1；1 method2/3；2 count；3 reserved0；4 encounterId16；20 payload64。

KNOCK count4..8，payload=count-1个interval uint16LE毫秒（2bytes），其余0；PATTERN count4..9，payload=count个位置0..8，禁止重复，其余0。transcript=base(BAJI-TRANSCRIPT-v1+encounter16+sortedMAC12+nonce32+method1)+canonical。canonical KNOCK=count1+intervalsLE2，长度7..15B；PATTERN=count1+positions，长度5..10B。双方用HTTP initiator相同参考，本地跟随匹配后才签。手机只读17并匹配encounter，不可写参考。

## 候选18 SOCIAL_ROLE signed body23B

0 schema1；1 encounterUUID16；17 initiatorMAC6。沿用当前session16+counterLE4+HMAC32外层，total75B。后台从权威encounter创建方deviceId解析initiatorMAC，不接受请求自填role/MAC。必须先kind10成功，再18；固件要求encounter精确当前challenge、initiator恰为self或peer。重复同role幂等，不同role拒绝；没有role不采集暗号、不输出证明。

16/17 snapshot只属owner当前有效signed session和challenge。断连/expiry/换session/challenge/取消/低电立即清参考、match、proof和冻结读缓存。无reference时17长度0；无有效session读取16/17拒绝。16/17不可COMMIT，手机不提交pattern/hash。

## 真实peer身份及传输候选

NimBLE central/peripheral并发owner+peer两连接；小MACcentral、大MACserver。peer专有UUID，消息包含encounter16/senderMAC6/nonce32/method/type，最大160B，分片序号+长度，超时丢弃。必须可信身份认证，不把shared nonce当peer身份。

建议设备工厂外置P256私钥+根签名设备证书（deviceMAC与publicKey绑定）；peer针对双方challenge及本地随机nonce签握手，验证外置可信根、peerMAC、当前encounter/nonce/session/expiry；参考及MATCH消息用已认证会话密钥HMAC，序号防重放。当前无该可信根/设备身份配置，因此生产peerReady与capability bit3必须failclosed；源码transport及验证路径和缺key门禁仍需实现/编译，不以硬件缺失掩盖未实现。

REFERENCE只能来自HTTP initiator本机输入；MATCH包含同参考canonical摘要，只有本地匹配和已认证peer MATCH相同摘要才输出proof。近场BLE/RSSI不保证抗无线relay，明确安全限制。

敲击：QMI8658模长突变实验阈值，去抖100ms，4..8 taps，结束1200ms；九宫格0..8本机点按/滑动4..9唯一位置。总会话15000ms/跟随5000ms。不能以确认按钮替代暗号输入。
