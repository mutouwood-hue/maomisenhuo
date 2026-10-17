# 旧固件本地 BLE、数据与签名边界审查

审查时间：2026-10-15T14:58:31.789822+00:00。根目录：`legacy-review/firmware-source/baji-firmware`。

范围：只读 main 与 firmware-v2 的协议、链路、场景、数据及运行时接线，写此报告；未构建、运行测试、连接设备、读取NVS/Flash/日志密钥、执行provision或查看任何密钥文件内容。文中读取的 `device_key` 仅为源码里的键名和调用逻辑，未读取其值。旧文档的测试/刷写结论保留为历史陈述，不算本轮验证。

## 可立即用于手机桥的结论

1. **V2可在未provision、无云、无账号时进入本地玩法。** op3 `START_LOCAL` 只依赖控制器忙状态/未认证及PAIR入口，不检查制造密钥；从PAIR→五项实际手势教学→本地主表盘与照料。原固件配对页也有真实触摸本地入口。它不是设备归属、宠物绑定或云授权。
2. **HELLO caps=15只表示旧local-v1四项能力**：state/local/ping/face。GET_STATE是10字节设备UI/供电状态；没有宠物UUID、五状态、金币或XP。无云手机桥可以显示真实UI状态、公开SENSOR、引导用户本地操作和请求换表盘，不能据此结算宠物或排空互动队列。
3. **同一e7f1 UUID有两套不兼容的旧协议。** main社会层与V2共用service/RX/TX，但main用[type,len,payload]，V2用BJ固定20字节。必须以严格HELLO应答识别V2，不能仅靠服务或设备名判断；它们也都不是当前工程7b2e NDJSON v1。
4. **无provision时私有EVENT和PET/LIFE/TIME/ACK写入失败关闭。** 公共CAPS/SENSOR与local-v1可用；不能在手机生成假的grant、加入fallback key、读取设备secret或把MAC当凭证。
5. **V2事件确有耐久实现，main旧事件实现较弱。** V2保存64位全局ID+原8B事件，200满保旧条、CRC、精确签名ACK删队头；但事件读取/ACK仍需真实授权session。main事件没有稳定ID/应用ACK，5秒延迟保存、满丢最旧、发送成功即删，不能直接桥接成当前幂等协议。

## 1. 两条构建入口与实际变体识别

- [`main/CMakeLists.txt:1`](firmware-source/baji-firmware/main/CMakeLists.txt#L1)：`BAJI_V2=ON` 包含 `firmware-v2/component.cmake` 后return；否则链接main原状态机、实时cat3d、net_social/net_link/app_link/badge_events。源码目录包含两者不表示两者都在一份运行固件中。
- `firmware-v2/docs/real-data-integration.md` 写production入口为V2；这是该旧交付的文档，不能凭此断言眼前设备运行哪个binary。父任务应保留已获取原Flash/分区/版本证据后比较基线。本审查不刷写或选择覆盖。
- main [`main/net/net_link.c:74`](firmware-source/baji-firmware/main/net/net_link.c#L74) 与V2 [`firmware-v2/runtime/baji_ble.c:14`](firmware-source/baji-firmware/firmware-v2/runtime/baji_ble.c#L14) UUID相同。main借 `net_proto_parse` 解析一字节type、一字节payload长度；BJ HELLO的第二字节0x4A会被main视为长度74，对20字节帧不成立，不可把timeout解释为可悄悄换协议发送写指令。
- 旧V2广播名Baji-V2只作线索；peer模式可能把service放scan response，不总在主广播。手机桥应service discovery→TX订阅成功→唯一seq的HELLO→严格匹配ACK与version/capabilities，再开放本地控制。无正确应答显示不兼容/未确认，保留错误。
- V2 GATT RX仅WRITE、TX READ|NOTIFY，未声明ENC/AUTHEN属性，也没有在此transport设置BLE secure pairing。当地物理确认码属于云challenge流程，并非当前工程的系统BLE six-digit passkey认证；不要在UI称其已安全绑定。

## 2. local-v1固定20B线格式

| 字节 | 含义 |
|---|---|
|0..1|42 4A，ASCII BJ|
|2|version=1|
|3|opcode|
|4..5|sequence LE16，请求1..65535|
|6|payload长度0..12|
|7|reserved必须0|
|8..19|payload，所有未使用尾字节必须0|

编码/解码证据：[`firmware-v2/interaction/baji_protocol.c:3`](firmware-source/baji-firmware/firmware-v2/interaction/baji_protocol.c#L3)、[`firmware-v2/interaction/baji_protocol.c:16`](firmware-source/baji-firmware/firmware-v2/interaction/baji_protocol.c#L16)。帧必须恰好20字节，默认MTU23足够；不能NDJSON分片、拼包或附LF。解码前置失败不会进入业务/不会产生应用ACK；合法信封但请求形状不对返回BAD_FRAME。

| GATT | 完整UUID / 行为 |
|---|---|
|Service|`e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a00`|
|RX|`e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a01`，WRITE with response|
|TX|`e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a02`，READ/NOTIFY|

**后缀01/02在最后一组7a00上，不能误改成a001/a002。** V2必须当前connection已订阅TX notify才接受RX。初始TX READ在状态尚未生成时可UNLIKELY，不应以初始READ成功作为ready前提；CCCD完成后HELLO与GET_STATE恢复状态。

ACK opcode=0x80、seq回显，payload=`originalOpcode,status,data≤10`。status0 OK/1 BAD_FRAME/2 UNSUPPORTED/3 BUSY/4 DENIED；扩展update回调还可能返回6，手机不能将未知状态当成功。GATT onCharacteristicWrite成功只是入传输队列，不是应用ACK。必须同时匹配当前连接epoch、seq、原opcode；PING还校验echo。

### opcode1..5真实行为

|op|请求payload|成功data|前置与拒绝|
|---|---|---|---|
|1 HELLO|空|version1、caps15、identity6，共8B|不需要provision/session；MAC公开ID，不认证归属|
|2 GET_STATE|空|STATE10B|读取UI/供电；不读宠物存档|
|3 START_LOCAL|空|STATE10B|suspended/按下/transition/motion/VOICE→BUSY；authenticated→DENIED；首次要求PAIR且未authenticated。已经local重复调用是no-op，可读回状态|
|4 PING|0..10B|完全相同echo|无业务变更|
|5 SET_FACE|一个0..2|STATE10B|busy→BUSY；tutorial_active、非local或authenticated→DENIED。改变face，在主表盘时一并切MAIN_A+face；不导航其他页、不发宠物奖励|

业务证据：[`firmware-v2/interaction/baji_link.c:27`](firmware-source/baji-firmware/firmware-v2/interaction/baji_link.c#L27)。caps15=bit0 state、bit1 local、bit2 ping、bit3 face；**不表示扩展6可用、可绑定、可读事件、可写PET、可录音、可OTA或全23屏**。请求seq仅相关性字段，dispatcher没有seq去重数据库；1..5幂等程度由操作本身提供。

### STATE10B精确布局

|offset|字段/取值|
|---|---|
|0|screen enum：PAIR0 GUIDE1 MAIN_A2 MAIN_B3 MAIN_C4 CARE5 STATUS6 SETTINGS7 VOICE8 DONE9|
|1|tutorial step，0..4；完成推进可能>=5|
|2|guide phase：DO0 BACK1 OK2|
|3|flags：local1、authenticated2、tutorial4、suspended8；逐位判断，未知位不得凭空解释|
|4|face0..2|
|5|battery0..100，255 unknown|
|6|power0 unknown、1normal、2low|
|7|USB0 absent、1present、255unknown|
|8..9|revision LE16|

[`firmware-v2/interaction/baji_link.c:8`](firmware-source/baji-firmware/firmware-v2/interaction/baji_link.c#L8) 只在前8字节变化时revision++，首次也递增，可uint16回绕；它是RAM设备UI序列，不是宠物revision/云save version。状态通知opcode0x81、seq0、length10。重连必须重置接收epoch，再GET_STATE；同epoch若做序列比较用uint16半环/回绕规则，不能普通整数“越大越新”。设备重启也重置，不能沿用上次revision门槛。未知battery/USB要显示未知，不补0。

## 3. 无云本地模式到底能做什么

[`firmware-v2/interaction/baji_scene.c:12`](firmware-source/baji-firmware/firmware-v2/interaction/baji_scene.c#L12) + [`firmware-v2/runtime/baji_main.c:145`](firmware-source/baji-firmware/firmware-v2/runtime/baji_main.c#L145)：controller从RAM初始PAIR；无需制造secret即可op3或页面本地按钮开始。教学不是简单点五下，而是：点猫→上滑照料并反滑回→下滑状态并上滑回→左右切表盘再反滑回→长按/释放返回；成功显示900ms后下一项，结束DONE任意点进MAIN_A。教学下部跳过热区可直接退出，但SET_FACE仍在tutorial_active时拒绝。
- 未provision真实可做：本地教学、主页/轮盘/状态/设置的手势导航、猫反馈帧、设备供电状态显示、非教学care输入计数与本地事件缓存、HELLO/PING/GET_STATE/SET_FACE。能否实物顺畅需现binary/屏幕/无线验收。
- **不能当作完整离线宠物本地结算**：V2没有持久本地猫数值计算。render只有has_pet且authenticated才显示五指标；否则--，clock_valid前--:--；breed/outfit/stage亦未知。coarse LIFE环必须签名真实日期匹配才显示。
- scene/local_experience/教学进度/face/controller均无NVS存储接线；重启controller_init→PAIR。本地操作事件FIFO另行持久，但不等于教学和UI偏好恢复。
- 非教学实际输入路径见 [`firmware-v2/runtime/baji_main.c:30`](firmware-source/baji-firmware/firmware-v2/runtime/baji_main.c#L30) 与input：PET计一次；FEED/WATER各3次；PLAY5次；SLEEP当前一次列表tap记完成。输入队列16槽，worker每轮最多4条，NVS错误/队列丢弃有诊断。**不应声称这一V2入口已经复刻喂碗450ms、羽毛速度、月亮1500ms+睡6000ms的完整原过程**。
- V2教学期不记care事件；普通本地模式并未以authenticated/provisioned挡住care事件入队，所以无云下能积累真实动作记录，但无法从手机读取私有EVENT/ACK清除，最多200条后拒新记录并增drop。手机不能假装奖励到账。
- 本地输入generation只在当前BLE generation一致时进worker；CCCD变化/重连清care_count/care_last与确认press，跨generation旧输入不会应用到新连接。未连接时generation仍有值，普通本地事件可以保存；它不是必须连手机才可玩。
- 语音场景仅教学手势/显示，真实ASR不实现；不据local cap申请麦克风/位置/后台权限。当前项目要求敏感能力默认关闭继续成立。

## 4. opcode6能力与对象扩展

扩展核心 [`firmware-v2/interaction/baji_data.c:285`](firmware-source/baji-firmware/firmware-v2/interaction/baji_data.c#L285)；大部分在独立data worker处理，BLE只移动20B，不在spinlock做NVS/crypto。op6成功data10B：`extVersion1, featuresLE16, maxSegments24, maxHearts24, maxObjectLE16=512, eventIdBytes8, pageBytes9, reserved0`。features=31|(provisioned?32:0)：bit0 SENSOR、1EVENT、2PET、3LIFE、4TIME、5PROVISIONED_PROOF。前五位描述支持的对象，不等于当前有读取/写入授权。无密钥bit5=0。

|op|请求|语义与限制|
|---|---|---|
|6 CAPS|空|上述能力，无provision可读|
|7|空|仅已session_valid可撤环境授权，持久clear；不是事件队列清除或所有权撤销|
|0x10 BEGIN|kind1,transferIdLE16,lengthLE16,CRC32LE32（9B）|transfer/length非0，length<=512；未provision直接DENIED，包含CHALLENGE也不能走|
|0x11 PAGE|transferIdLE16,pageIndex1,data1..9|连续页，按index×9；重复页相同字节幂等，异内容拒绝；越过/缺页BUSY/错误|
|0x12 COMMIT|transferIdLE16（2B）|完整长度+CRC后才业务提交；成功data=transferId2+当前PET revision4|
|0x13 READ|kind1,pageIndex1|先page255元数据冻结lengthLE16+CRC4；再page0..N应答pageIndex+最多9B；length0是EMPTY，不制造ID0；stage/frozen超时>10秒，断连清理|

CRC32 IEEE init/final XOR FFFFFFFF仅防传输损坏，不授予信任。未实现未签名0x14 dequeue/0x15 TIME；不能用未知op绕授权。对READ不得拼接两次metadata冻结的不同快照；需核长度/CRC和当前epoch后消费。

|kind|对象/访问|无云无provision能否使用|
|---|---|---|
|1 SENSOR|READ29B：schema/uptime/validFlags/battery/USB/charging/三轴mg/PMICfail/IMUfail/pending/dropped|可以，只读公开设备数据；缺字段unknown|
|2 EVENT|READ48B：ID64+原8B+HMAC32；只冻结队头|拒绝，无session；不是op2 GET_STATE|
|3 PET|signed body27B：schema/cloudRev/slot/breed/outfit/stage/5stats/growth/coins/sourceUnix|拒绝|
|4 LIFE|signed body13+5S+3H：date/tz，<=24段/24心动；无坐标|拒绝|
|5 CHALLENGE|写56B：UUID16+nonce32+expiry4+displayCode4|BEGIN未provision即拒；有provision还须真实设备按下释放确认|
|6 PROOF|READ32B，确认当前challenge后生成|无provision/未确认拒绝；proof不等于owner session|
|7 AUTH_GRANT|写69B，版本/session/expiry/challenge/HMAC|必须真实签名匹配当前已确认challenge|
|8 EVENT_ACK|signed精确头ID64|拒绝；只有真实后端终态可签发|
|9 TIME|signed unixLE32/tz int16|拒绝；不能用手机普通clock替代签名|
|10/12/16/17/18|meet challenge、proof、status、reference、role对象|受session/真实peer/签名门控；local caps15未声明这些完成|
|11/13/14/15|环境授权、状态、签名事件、ACK|受session/逐项授权/expiry门控；本项目保持关闭|
|20/21/22/23|受签名update begin/chunk/finish与status|不是本地桥范围；还受可信根/供电检查；不调用|
|24/25|active事件与signed ACK|受session、active模块及耐久约束；不作本地bridge capability|

SENSOR字段offset：schema0，uptime1..4，validFlags5，battery6/USB7/charging8，ax9..10/ay11..12/az13..14 int16 mg，PMIC fail15..18、IMU fail19..22、pending23..24、dropped25..28。battery/usb/charging未知255，accel未知-32768；当前PMIC不提供charging，保持255，不拿USB=充电中。SENSOR pending/drop不能替代完整队列内容或每次耐久确认；其中drop不包含所有UI/input/storage诊断。

## 5. 云签名/所有权边界

证据：[`firmware-v2/interaction/baji_data.c:51`](firmware-source/baji-firmware/firmware-v2/interaction/baji_data.c#L51)、[`firmware-v2/interaction/baji_data.c:59`](firmware-source/baji-firmware/firmware-v2/interaction/baji_data.c#L59)、[`firmware-v2/interaction/baji_data.c:165`](firmware-source/baji-firmware/firmware-v2/interaction/baji_data.c#L165)、[`firmware-v2/runtime/baji_data_runtime.c:227`](firmware-source/baji-firmware/firmware-v2/runtime/baji_data_runtime.c#L227)。只读到源码如何查询NVS键名；未读取任何设备secret或provision包。

- 每设备独立随机32B secret由外部制造/USB provision写NVS baji_v2/device_key，真实后端安全配置同一secret；不存在从MAC推导或源码fallback的合法路线。手机仅转发，不能拿secret。
- challenge先从后端获取；设备用当前challenge UUID绑定真实按下/释放确认，60秒monotonic窗口，challenge替换/连接generation变化不能复用旧手指确认。确认生成BAJI-BIND-v1 proof，**不会**设置session_valid。
- grant须通过BAJI-GRANT-v1 HMAC，匹配当前已确认challenge/有效期才开当前session；断连/CCCD generation更改/900000ms monotonic上限/签名expiry到期撤销。新grant清旧PET/LIFE缓存，不能跨会话冒用私有数据。
- signed envelope=session16+counterLE32+body+HMAC32；BAJI-SYNC-v1域包含deviceId6与kind。counter必须正数并增大；只对完全相同kind/长度/字节的相同counter幂等，旧counter/同counter异内容拒绝。不是要求每次恰好+1。
- TIME安排在grant后签发，避免首次无时钟依赖；unsigned challenge wall time不直接校时。EVENT用BAJI-EVENT-v1签名ID64+原事件8B；手机无云不能自签、伪proof/grant、开一个本地counter规避。
- PEER/UPDATE可信根在构建时由外部公钥文件提供，空默认失败关闭；这些公钥也不应凭空替换为测试根。此审查没有打开任何外部可信根或密钥文件。
- 无云时可运行本地桥并明确“本地设备连接，尚未授权云同步”；不展示已账号绑定、不写PET/LIFE/TIME/ACK、不读EVENT、不启动环境/麦克风/升级。当前任务若未来需要脱云持久同步，需要用户认可的独立本地协议/安全设计，而不是绕现有签名；本报告不实施该改动。

## 6. 原事件持久化：必须分main与V2

### V2（baji_data + worker）

- [`firmware-v2/interaction/baji_data.c:124`](firmware-source/baji-firmware/firmware-v2/interaction/baji_data.c#L124)：BJD1，next_event64、count16、dropped32、last_ack64、count×16B records、CRC32；总30+16N，最大3230B。每record=ID64+timestampSeconds32+type8+a8+b16。没有当前NDJSON的petId UUID。
- [`firmware-v2/interaction/baji_data.c:130`](firmware-source/baji-firmware/firmware-v2/interaction/baji_data.c#L130) 验magic/长度/count<=200/CRC/ID非零且递增且last_ack<ID<next_event/type1..14；损坏不静默改ID。冷启动未校时事件timestamp=0；64位ID须手机BigInt/decimal string，不能JS Number。
- [`firmware-v2/interaction/baji_data.c:138`](firmware-source/baji-firmware/firmware-v2/interaction/baji_data.c#L138) 先追加/增ID再save，失败回滚RAM count/next；200满只durable增drop，不丢旧头。worker save任一set/commit失败锁storage_corrupt，该boot不再写，避免不确定commit后复用旧ID。启动重读实际blob；不自动擦坏NVS。
- [`firmware-v2/interaction/baji_data.c:147`](firmware-source/baji-firmware/firmware-v2/interaction/baji_data.c#L147) 只允许精确当前队头ID，重复last_ack幂等；先保存新队列+last_ack再RAM出队。READ/notify不删除。外部只可通过有效signed kind8调用，不能把0x80应用ACK与事件终态ACK混为一谈。
- [`firmware-v2/runtime/baji_data_runtime.c:170`](firmware-source/baji-firmware/firmware-v2/runtime/baji_data_runtime.c#L170) 不以provision/session挡普通care记录，只验generation；所以本地可以留事件，私有导出仍锁。UI调用runtime_event是void异步队列，瞬时动作显示不是NVS成功回执；桥不能以界面计数作为已耐久/已结算的证明。
- 相比文档“真实照料完成”表述，runtime当前只在列表输入完成3/3/5/1时发相应事件，没有原每口450ms、sleep1500+6000ms等全过程；两层scope需分开。当前`CARE_CANCEL.a=care_type`直接使用1..5，与原feed0/water1/play2/sleep3编号不同，后续和旧手机/后端decoder对照，不能盲结算。

### main（badge_events + app_link）

- [`main/net/badge_events.c:50`](firmware-source/baji-firmware/main/net/badge_events.c#L50)：badge_evt/queue、BEQ1头8B+N×8B，最多1608B；无稳定event ID、无CRC字段、未同步使用编译默认2026-10-10时间加uptime（不是未知0），与V2不同。
- [`main/net/badge_events.c:275`](firmware-source/baji-firmware/main/net/badge_events.c#L275)：200满丢最旧并计RAM drop；以5000ms保存窗口写NVS、失败重试；窗口内掉电可丢新条/复活已发条。header的ts参数注释已过时，真实push只有type/a/b。
- [`main/net/badge_events.c:598`](firmware-source/baji-firmware/main/net/badge_events.c#L598) net_link_send返回ESP_OK就从RAM出队，没有手机持久应用ACK；稍后NVS保存，重启可能重复发送。不能仅hash8B用作唯一ID，合法重复动作可能同秒同内容。
- [`main/net/app_link.c:188`](firmware-source/baji-firmware/main/net/app_link.c#L188) 当前固定false，app_link_poll不flush App事件；main只给peer社会层连接，未接App authenticator。共用GATT不意味着能获得event流或宠物快照。
- main的local_experience只隔离教学学习记录，照料仍用fsm->game原本地数值，pet_store以4秒观察保存；并非V2无私有值的行为。不能混用两版UI/事件/存档结论。
- main [`main/main.c:480`](firmware-source/baji-firmware/main/main.c#L480) 在NO_FREE_PAGES/NEW_VERSION_FOUND分支自动nvs_flash_erase；这是重要恢复边界，旧源能build不代表可直接运行覆盖现NVS。该分支未执行，本轮无设备动作。

## 7. 与当前项目契约的对照与最小桥范围

|项目|旧V2 local/object|当前项目 protocol/v1|桥接结论|
|---|---|---|---|
|GATT|e7f1...7a00/01/02|7b2e1000/1001/1002...|独立适配器，不能复用错误UUID|
|帧|固定BJ20B，uint16seq|UTF8 NDJSON <=2048含LF|不可透明转发/拼接|
|状态|STATE10B是UI/供电RAMrev16|snapshot是petId/revision/5stats/coins/time|不能从UIrev制造宠物快照|
|宠物身份|公开MAC6；PET slot2，無UUID|持久petId UUID|不能把MAC或slot当相同猫UUID|
|事件|14类型原8B+ID64+HMAC；私有READ|当前pet-only、有deviceId/eventId、ACK|不能无签名读取/结算；未来扩展另议|
|认证|local不授owner；对象HMAC云session|加密认证BLE pairing，本地App结算|不能继承或假装等价安全状态|
|耐久|V2 BJD1精确signed ACK；main BEQ1较弱|当前NVS/AtomicFile先持久再ACK|独立保存各stream与epoch；不能擅清旧缓存|

推荐手机桥本阶段仅做：服务发现/CCCD/严格HELLO识别、显示identity为“设备ID非绑定”、GET_STATE与0x81显示真实枚举/flags/未知供电值、PING、显式START_LOCAL、教学完成后SET_FACE、可选CAPS+SENSOR只读，并保留原宠物App存档。没有授权事件就不加奖励、不删队、不发完成假消息。需要设备测试时应逐步观察现固件，不假定历史COM3报告等于当前板卡。

最小真实验收（未执行）：发现服务→CCCD→HELLO严格匹配caps15/version1；GET_STATE修补订阅期间遗漏；START_LOCAL从PAIR进入教学、重复不重置；busy/tutorial SET_FACE拒绝不改scene；完成后真实换表盘；断连/重连epoch清理与rev回绕；无provision CAPS bit5=0、SENSOR未知不造数、私有对象明确DENIED；200缓存/坏存储只可在专门授权的测试环境验，不能清当前设备演示。

## 8. 剩余阻塞与证据边界

- 未知眼前设备实际是main、V2或其他binary，需父任务已保存版本/原Flash证据与真实HELLO；本轮无BLE调用，不报无线通过。
- 用户无云：provision状态未查询；即使设备曾provision，手机也没有合法后端grant，私有同步仍不可用。没有读key或设法绕过的计划。
- 旧docs基于PRD v1.9，不能替代当前v2.1全文；主任务的PRD连接器404缺口仍存在。
- 新旧基线比较以来源、接口与用户认为好的旧UI为准，不因某个内部候选构建成功要求重写。此报告不改源、协议、设备或外部账号。

## 9. 本轮只读来源哈希

|相对旧固件根目录路径|SHA256|
|---|---|
|`main/CMakeLists.txt`|`00cab64b3d7a65385348163375944d8e94b361371cc5af06e9b65ce0cb0a878e`|
|`main/main.c`|`5a88f81bfe41792a7591af3d55daddc8158f2a11f0267db9f513849e118fa777`|
|`main/badge_runtime.c`|`ce7a0e78bbcd941e08b29b425cc0aa4bede5d5537b4c5350c4525d6a8d05f0d0`|
|`main/badge_pet_store.c`|`4a1ff572708678194858b867a93a3f15cb548435db8bc799b95420904f3e63c3`|
|`main/ui/badge_fsm.c`|`5f7bd132e852b363da340c8e61df60c417d9b010d08ddff835da948766850d83`|
|`main/net/net_link.c`|`6ce740da98da869c7f07d4f2e722bea930e74f251906c6b0a9e77d487129c858`|
|`main/net/net_proto.h`|`4f3973105ebb4565a60b16a6dba66e3675a4f868cb6628e503c27e75b5754b75`|
|`main/net/net_proto.c`|`a6bc2e1d8edc7e2d0e2c9b5152079fabb9cc7f6f97f1d0ecf35b24ed322be822`|
|`main/net/app_link.c`|`a8cf0986fe9d11312ca9891887c857ec9160e628fb92ef2a6c8b8bbeff0007e5`|
|`main/net/badge_events.c`|`7218f6490f6cdc80d034cae58baae447251d83f4eb993378cf41b1cdb50f6684`|
|`firmware-v2/component.cmake`|`4265276c45e923cfddf1595673732c07ae4cb451cfcee905aa86ffccda70e4cd`|
|`firmware-v2/interaction/baji_protocol.h`|`61682685d8b264b76542960839eeff3411a8c7ceb7c8c27d8dbfd65d67b26374`|
|`firmware-v2/interaction/baji_protocol.c`|`9a2381d34b9dcc0adf985bfdb8b26a9a6107826f8bb7fd8363c6c95234c8e0ad`|
|`firmware-v2/interaction/baji_link.h`|`cbd6d70f82f3467ef7ed60291005201d478bbf7753f34128dc4647f11900ecb2`|
|`firmware-v2/interaction/baji_link.c`|`0abf33b2dec6e22581d5d4bbc43a1e1bb6d3ca0f1530e229f7e1a4669e2c0ceb`|
|`firmware-v2/interaction/baji_scene.c`|`16d1599b44eb8da774801cd03c95c43f31e8138810e60f95bbffee905069b589`|
|`firmware-v2/interaction/baji_scene.h`|`9dee73adb64f09c5928671d1380ef15ad58fcaa918d0346ff6c31908b61a1cd4`|
|`firmware-v2/interaction/baji_controller.c`|`599e5e107f1015d0609852814cd7a63ca2c4379230464096247fe0baee1d6a1d`|
|`firmware-v2/interaction/baji_data.h`|`8cbd4ffd6977fa1ac98e65d6711a178d26a8261120c593f33acc206f9a9958c2`|
|`firmware-v2/interaction/baji_data.c`|`35ca990d82dbb92c0539aa5bb3390f8730d0bc20316173428f03b9be580b8e6a`|
|`firmware-v2/runtime/baji_ble.c`|`abc1edf1db70c0df22f4ed89df7bec0017f980836868657dd3838225e0fb6b14`|
|`firmware-v2/runtime/baji_main.c`|`c15dc1208bc6d903b914a4ff3041e415dc8fd57e4f4392343002b37133ac6337`|
|`firmware-v2/runtime/baji_data_runtime.c`|`5dfb8ac3670436e3eb99c77aff67b341379ce7b80c1a4620de1cb443b6e6f579`|
|`firmware-v2/render/baji_render.c`|`3648cc15a7d38fa2b09f17bfcdec1afea8388446b92b5f8e21954c9867fd8455`|
|`firmware-v2/docs/ble-local-v1.md`|`b53d8210fddd3b27899c27b7a514a689f8ff1316e76d25d5bf888ff64702a928`|
|`firmware-v2/docs/real-data-integration.md`|`93a3d8f169c28dc1c41773c19b92a59ff74c66a08bafb8af20795c30f4a32717`|
|`docs/real-data-contract.md`|`56f7e0ab8466df46924cb0d9e1c098447e7ab91cb57f00582ee05b3a06df2167`|
