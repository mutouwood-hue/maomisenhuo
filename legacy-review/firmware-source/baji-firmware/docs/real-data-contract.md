# 真实数据接入契约 v1（PRD v1.9）

状态：HTTP核心与BLE扩展1已冻结；三端按本文并行实现。用户授权实现，不执行git提交/推送。

## 基线与适用范围

- Notion page `dabc209a-d67f-8338-af91-01d5810f7160`，v1.9 开发版，2026-10-12；官方ntn JSON `truncated=false`、`unknown_block_ids=[]`。
- 当前 `mobile-pet/original/game.html` 与最新「小橘电子宠物.html」SHA256完全一致：`C4F872D0BF8A899CF93A6AA877C13C5A5090E1F592729500BD2EF476205E9952`。保留原作只读；仅独立模块及构建接线改动。
- 手机为原生JS/CSS+Capacitor，前端规范React/Vue附录不适用；设计真源为原作已加载内联样式/:root。不换设计系统。
- 实际固件入口为firmware-v2，保留local-v1兼容。BLE连接不等于账号归属。
- 本轮实现：账号/云主存、分项授权、真实定位与Android计步、生活摘要、埋点持久化、吧唧触摸/PMIC/互动补传及下行时间/宠物/生活数据。IMU为真实三轴加速度mg采集，不冒称姿态角度或计步；原始音频/环境感知默认不做。
- **最新范围修正（用户确认）**：地理位置由仅前台改为可单独开启的后台/锁屏行程记录，原Q8后台定位不再待确认。Android采用原生location类型foreground service与持续通知，不依赖WebView后台执行；先前台定位授权，再独立申请后台权限（Android11+系统设置允许始终定位）。系统权限不等于永不间断，force-stop/省电/无GPS信号中断保持未记录，不补造轨迹。Web仍不支持后台定位；iOS尚无实现证据。后台运动计步范围没有随之扩展。
- 后台记录开关是本机能力设置，不把它拼入既有HTTP consent四布尔DTO。原始位置只本机持久队列，≤7天TTL；回前台导入本机LifeProvider并持久成功后确认队列。关闭/撤回/清除/logout停止服务并清待处理队列，旧generation不能复活；同一位置采集仅一个owner。详细街道地址逆地理编码服务商及隐私范围待确认，不擅自上传坐标给地图供应方。
- M2敲暗号/连点/Fate/礼物经济不擅自上线。AI后台代理和配方缓存有配置则真实调用，无配置明确OFFLINE/基础场景，不假装模型生成。

## 通用协议

- `/api`前缀，无URL版本。统一 `{code:200,msg:'success',data}`；业务失败HTTP200+稳定业务码；结构400、认证401、越权403、未找到404、未知异常500。
- ID字符串。报文时间 `yyyy-MM-dd HH:mm:ss`，统一Asia/Shanghai；日期 `yyyy-MM-dd`。内部时间用正规类型，不能从客户端时钟授予权限。
- Bearer账户session；令牌随机，服务器只存hash；密码scrypt。邀请码从环境变量读取，生产无邀请码关闭注册。密钥不进代码、日志或客户端。
- POST写要求 `Idempotency-Key`（账号登录不作经济副作用），批量逐条ACCEPTED/DUPLICATE/REJECTED和计数；相同ID不同内容拒绝，不静默覆盖。
- 服务端按session确定user，拒客户端伪造归属。SQLite真实持久化、参数化SQL、迁移、短事务、数据库不是进程数组。

## 冻结HTTP资源

|方法与路径|operationId|输入/输出|
|---|---|---|
|GET /api/health|system.health.get|健康，不泄露环境密钥|
|POST /api/accounts|identity.account.create|`{username,password,inviteCode}` -> `{userId,accessToken,expiresAt}`|
|POST /api/sessions|identity.session.create|`{username,password}` -> 同上|
|GET /api/sessions/current|identity.session.get|当前用户|
|DELETE /api/sessions/current|identity.session.delete|撤销session|
|GET /api/pet-saves/current|pet.save.get|无记录data=null；有记录`{revision,savedAt,save}`|
|PUT /api/pet-saves/current|pet.save.replace|`{baseRevision,save}`，save为原作version2家庭存档；版本CAS，冲突40901含serverRevision|
|GET /api/consents|life.consent.get|`{revision,isLifeSyncEnabled,isLocationGranted,isMotionGranted,isMicrophoneGranted,updatedAt}`|
|PUT /api/consents|life.consent.replace|上述四个布尔+baseRevision；初始全false；撤回立即阻止相关上传、清除相关派生数据|
|GET /api/life-days/{date}|life.day.get|当天摘要+revision+expiresAt+summary，无data=null|
|PUT /api/life-days/{date}|life.day.replace|下一节日摘要；整体CAS替换非累加|
|DELETE /api/life-data|life.data.delete|幂等清除全部生活数据/地点/派生缓存，并关闭生活同步、位置、运动|
|POST /api/telemetry-events|telemetry.event.batchcreate|`{events:[{id,name,occurredAt,properties}]}`；PRD事件字典/属性白名单，不触发玩法奖励|
|GET /api/telemetry-summary|telemetry.summary.get|当前用户计数，不能读取他人|
|GET /api/devices|device.device.list|当前用户已绑定设备|
|POST /api/devices/{deviceId}/binding-challenges|device.binding.challenge|`{}` -> `{challengeId,challengeBase64,expiresAt,displayCode}`，物理确认详见安全段|
|POST /api/device-bindings|device.binding.create|`{deviceId,challengeId,proofBase64}` -> `{deviceId,sessionId,authGrantBase64,expiresAt}`；无provision失败关闭|
|DELETE /api/device-bindings/{deviceId}|device.binding.delete|撤销归属，不能删宠物存档|
|POST /api/devices/{deviceId}/event-batches|device.event.batchcreate|下面设备事件事务，已认证且归属校验|
|GET /api/devices/{deviceId}/sync-state|device.state.get|`{serverTime,revision,save,lifeDay}`，由phone转BLE分页，不含坐标|
|POST /api/devices/{deviceId}/signed-objects|device.object.create|`{sessionId,kind,eventId?}` -> `{kind,envelopeBase64,counter}`，只后端权威body，ACK须已持久终态|
|POST /api/pet-messages|ai.message.create|`{catId,text,isTextCloudAllowed:true}` -> `{status,source,action,bubbleText,reply,model}`，每条文字单独同意；status MODEL/OFFLINE/BUSY|
|POST /api/places/{placeId}/scene-generations|ai.scene.create|`{styleHint?,isRegeneration?}` -> `{status,source,isCached,recipe,corrections,visitCount,model,expiresAt,consentRevision}`，有recipe时带证据到期时间与授权版本，至少两次合法十五分钟独立停留；status MODEL/CACHED/OFFLINE/NOT_READY/BUSY|
|GET /api/places/{placeId}/scene|ai.scene.get|现存仍有合法证据/授权的场景或null；使用原作BK.validate的c/at/color积木配方，不执行模型代码|

### 日摘要

```json
{
  "baseRevision": 0,
  "consentRevision": 1,
  "timeZone": "Asia/Shanghai",
  "source": "NATIVE",
  "segments": [{"id":"visit-a","startAt":"2026-10-14 08:00:00","endAt":"2026-10-14 08:30:00","type":"WORK","placeId":"place-a","placeAlias":"公司"}],
  "places": [{"id":"place-a","alias":"公司","type":"WORK","visitIds":["visit-a"]}],
  "motion": {"source":"ANDROID_STEP_COUNTER","stepCount":2300,"walkingSeconds":null,"vehicleSeconds":null,"coverageStartAt":"2026-10-14 08:00:00"},
  "moments": [{"id":"moment-1","occurredAt":"2026-10-14 08:31:00","type":"ARRIVE_HOME","heart":1}]
}
```

- motion未采集为null，不生成虚构全天步数；source只NATIVE/MANUAL，DEMO只留显式客户端新手体验且不上传。
- segment type为HOME/WORK/WALK/COMMUTE/CAFE/MEAL/PARK/OTHER/SLEEP；真实未识别不猜HOME/SLEEP。place type为HOME/WORK/CAFE/MEAL/PARK/OTHER。moment允许原PRD真实照料/怪行为/到家/语音/偶遇/毕业来源，枚举由后端文档进一步列出并兼容。
- 定位只本机150m聚类、15分钟停留识别；visitIds是独立到访，GPS采样点不是到访。达到2次才固定点位生成场景。
- 严格白名单拒lat/lon/latitude/longitude/coordinates/track/audio/API key，包括嵌套字段。无location同意不得接收行程/地点，无motion同意不得接收运动摘要。
- 保留7天按发生日期/时间，而非重新上传时间延长；查询滤除+定时物理purge，同时清除派生缓存。清除/撤回tombstone优先于旧outbox重传。

### 吧唧互动：持久化与原规则结算同事务

```json
{
  "sessionId": "ffeeddcc-bbaa-9988-7766-554433221100",
  "events": [{"eventId":"9007199254740993","eventBase64":"<48字节签名事件的Base64>"}]
}
```

- 类型PET/FEED/WATER/PLAY/SLEEP/CARE_CANCEL/VOICE_CMD/VOICE_FREE/QUIRK_CATCH/MEET/CALL_HOME/WAKE/FACE/SETTING对应原14类。8B(ts/type/a/b)不改；eventId64+HMAC由传输信封提供。
- 唯一键deviceId+eventId（内部stream固定v2）；重复内容返回DUPLICATE并原结算状态；同eventId异内容40902。
- **设备只记录事件，手机负责交互编排；App同一规则集由后端服务执行持久结算**：dedup + 五照料原规则 + 当前云save/revision更新同事务，响应带最新`{save,revision,results,acceptedCount,duplicateCount,rejectedCount}`。手机只应用返回save，不能再加一次奖励。此为云主存实施方式，不更改原照料数值。
- FEED/WATER必须完成3口，PLAY完成5扑；取消不扣钱、不加成长、不计次数。PET2秒/其它4秒冷却按可信事件上下文处理，离线时间未知不能伪造收益；校时前事件标识未知并保留，不猜时间。
- 所有完成/拒绝终态都写ledger，重传不再次结算；客户端收到持久终态并保存/应用云save后，才发送精确队头ACK。可恢复拒绝/网络异常不删除。
- 手机普通游戏继续原规则，不因埋点care_done触发二次结算；CAS防旧手机快照覆盖刚发生的吧唧事件。云主存并不声称全面反作弊。
- MEET单条不能直接加好友/结算礼物；未完成双方验证不得宣称真实社交完成。

## BLE待补充与安全部署

- local-v1现HELLO/GET_STATE/START_LOCAL/PING/SET_FACE不改；固定20B，能力协商新op；分页传输直到commit才原子应用。
- 校时每连接；宠物五指标/外观编号/成长阶段来自当前真实save；PMIC无有效读数为unknown，不用静态图数字冒充。
- NVS单调序号/持久epoch，队列200条；通知成功不能dequeue，仅已持久确认的精确队头ACK，丢失风险可见。
- 设备密钥NVS制造/USB provision，后端只环境配置对应每设备secret，客户端无法读取secret。未 provision可本地调试但不能获得云归属。不得用MAC/公开ID导出密钥。

## BLE扩展1（已冻结）

所有整数LE，固定20B BJ/v1 frame及零填充不变，原op1..5/HELLO capability15/STATE10B不变。手机与后端对64位事件序号使用BigInt/十进制字符串，不能转JS number。

### 命令与分页

- op6 CAPS ACK data10B=`extVersion1,featuresLE16,maxSegments24,maxHearts24,maxObjectLE16(512),eventIdBytes8,pageBytes9,reserved0`。feature bit0 SENSOR,1 EVENT,2 PET,3 LIFE,4 TIME,5 PROVISIONED_PROOF。未 provision bit5=0，不能获得云授权。
- op0x10 BEGIN payload9B=`kind1,transferIdLE16,lengthLE16,crc32LE32`。
- op0x11 PAGE payload=`transferIdLE16,pageIndex1,data<=9`；连续页；同页同字节幂等，异内容拒绝。
- op0x12 COMMIT payload=`transferIdLE16`；只允许完整连续长度/CRC通过后原子应用，断连清stage。
- op0x13 READ payload=`kind1,pageIndex1`。先READ page255元数据，ACK data=`lengthLE16+CRC32LE32`并冻结对象；length0明确EMPTY，不生成eventId0。再普通page ACK data=`pageIndex1,data<=9`；客户端验证长度及CRC后才消费。stage和读取冻结超时10秒；CRC32 IEEE init/final XOR FFFFFFFF。CRC只是完整性，不是认证。
- 不启用未签名的0x14 dequeue或0x15 TIME；ACK/TIME均走signed object kind8/9。

### 对象布局

|kind|对象|精确body|
|---|---|---|
|1|SENSOR只读29B|schema1,uptime4,validFlags1,battery1,usb1,charging1,ax/ay/az int16 mg各2,pmicFail4,imuFail4,pendingLE16,dropped4|
|2|EVENT只读48B|eventIdLE64+原PRD8B+HMAC32|
|3|PET signed body27B|schema1,cloudRevision4,catSlot2,breed1,outfit1,stage1,饱腹/心情/清洁/精力/健康各1,growth4,coins4,sourceUnix4|
|4|LIFE signed body13+5*S+3*H|schema1,cloudRevision4,dateYYYYMMDD4,tzMinutes int16,segmentCount1,heartCount1；每段startMinute2/endMinute2/kind1；每心动minute2/kind1|
|5|CHALLENGE写入56B|challengeUUIDraw16+nonce32+expiryUnix4+displayCode4|
|6|PROOF只读32B|物理显式确认显示code后生成HMAC|
|7|AUTH_GRANT写入69B|version1+sessionIdraw16+expiryUnix4+challengeUUIDraw16+HMAC32|
|8|signed EVENT_ACK body8B|精确head eventIdLE64，仅已持久终态后签发|
|9|signed TIME body6B|unixLE32+timezoneMinutes int16|

LIFE segment wire kind编号0 NONE,1 HOME,2 WORK,3 WALK,4 COMMUTE,5 CAFE,6 MEAL,7 PARK,8 OTHER,9 SLEEP；heart kind1 CARE,2 QUIRK,3 ARRIVE_HOME,4 VOICE,5 ENCOUNTER,6 GRADUATE,7 OTHER。PET breed按原作0orange/1silver/2tuxedo/3siamese/4ragdoll/5blue，outfit0无/1bandana/2bow/3cap/4raincoat/5backpack/6scarf，stage0幼/1少年/2成年。max24/24是设备预算，不是PRD业务上限，超限手机可明确压缩展示，不丢云原数据。

SENSOR invalidFlags无效字段为unknown sentinel（battery/usb/charging=255，accel=-32768），不得以静态图数字/0替代未知。validFlags bit0 PMIC bit1 IMU。

### 密钥、proof、grant与signed command

设备stable ID为HELLO MAC六字节，HTTP为小写12hex无冒号；它不是秘密。每设备独立随机32B密钥由制造/USB provision写NVS，后端环境注入对应映射，不能下发手机/公开ID导出。

- proof=`HMAC-SHA256(key, ASCII('BAJI-BIND-v1') || deviceIdRaw6 || challengeBody56)`。challenge由后端产生，绑定当前账号，短有效期，一次性；设备当前连接显示code由主人确认才生成proof，不能silent bind。
- grantMAC=`HMAC(key, ASCII('BAJI-GRANT-v1') || deviceRaw6 || grant前37B)`；grant session与当前物理确认challenge匹配且未过期才授予云sync，proof生成本身不代表服务端批准。
- signed对象envelope=`sessionRaw16 + counterLE32 + body + HMAC32`；MAC域`ASCII('BAJI-SYNC-v1') || deviceRaw6 || kind1 || sessionRaw16 || counterLE32 || body`。断连撤session；counter严格增，完全相同counter+payload幂等，其他拒绝。counter由后端数据库按同步session生成并签名，手机只是转发不可自签。
- eventMAC=`HMAC(key, ASCII('BAJI-EVENT-v1') || deviceRaw6 || event前16B)`；eventId NVS全局uint64不重用，HTTP streamId固定`v2`，sequence十进制字符串。事件body8B原版保持；后端验证签名才可入库/结算。
- 未provision保持本地模式及只读SENSOR/CAPS，但拒cloud PET/LIFE/TIME/ACK。不能为了演示把secret存手机或硬编码固件。

### HTTP设备安全补充（本节覆盖前文设备安全资源候选）

- deviceId统一MAC小写12hex无冒号（例如aabbccddeeff），手机HELLO的冒号形式转为12hex；非凭证。
- POST `/api/devices/{deviceId}/binding-challenges` (`device.binding.challenge`) `{}` -> `{challengeId,challengeBase64,expiresAt,displayCode}`，TTL60秒，绑定当前账号和设备。取代顶层device-binding-challenges候选。
- POST `/api/device-bindings`输入`{deviceId,challengeId,proofBase64}`；验证32B proof、一次性、当前账号、有效期、归属冲突后回`{deviceId,sessionId,authGrantBase64,expiresAt}`。已绑定同一账号重连仍走新challenge+物理确认+此接口发新grant；不另增sync-sessions候选。
- POST `/api/devices/{deviceId}/event-batches`输入`{sessionId,events:[{eventId:'u64十进制字符串',eventBase64:'48B签名事件'}]}`。后端从48B解析原8B；验证eventId与内容、MAC、已绑定归属及有效session，然后同事务去重+五照料结算+save revision。HTTP不依赖客户端occuredAt/type自报。时间0保留未知，不发虚构收益；回复`{save,revision,acceptedCount,duplicateCount,rejectedCount,results:[{eventId,status,code,msg,isTerminal}]}`。
- GET `/api/devices/{deviceId}/sync-state`回`{serverTime,revision,save,lifeDay}`。
- POST `/api/devices/{deviceId}/signed-objects` (`device.object.create`) 输入`{sessionId,kind,eventId?}`；kind3/4/9分别由后端当前save/day/time生成，kind8仅允许已持久终态的对应eventId，禁止任意客户端body签字；回`{kind,envelopeBase64,counter}`。counter持久递增并由backend分配，不让手机持有key或自行签名。
- 手机apply并持久保存event-batches返回save后，逐个请求已终态eventId的signed ACK，再按FIFO发设备。网络/apply失败保持队头；重传同eventID不两次结算。拒绝非终态不ACK。
- SENSOR物理读数可用于本地显示，但未获云grant不能读取私有EVENT对象；旧local调试连接只读普通STATE/SENSOR。

## 后续范围与验收

- 生活行动点奖励沿用原附件明确公式；尚未核对完整公式时不将上限12/20当固定奖励，不为无数据发奖励。
- AI模块配置白名单、5并发、有限retry、输出schema；无key返回明确OFFLINE。原始音频不存服务器，BYOK正式版仍待确认。
- 测试：重启持久化、账号隔离/401/403、CAS冲突不丢档、重复批/ID冲突、禁止坐标音频、撤权/7天清理、未知步数、BLE旧协议兼容/丢片原子性/未知结果、取消零结算/多次ACK无重复收益。
- 真机无线/计步/IMU、刷机、长期功耗与外部AI调用须单独实测，主机mock不当成通过。
