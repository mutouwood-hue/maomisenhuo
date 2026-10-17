# M2 逐项实施与验收矩阵

更新时间：2026-10-15 04:26（Asia/Shanghai）。基线为[需求追踪](<m2-requirements.md>)与用户当前指定Notion v1.9；这是**分层验收记录，不是M2全部完成声明**。

## 证据层级与本轮实际结果

- **HTTP95**：backend角色实际执行 `node --test backend/tests/*.test.mjs tests/integration/m2-*.test.mjs`，job pwsh-308完整收集，95/95 pass、exit0、66.008s；[完整日志](<../backend/m2-complete-regression.log>)、[详细验收](<m2-verification.md>)。测试用隔离账号及TEST-ONLY设备密钥走真实HTTP/SQLite；不是物理距离、量产密钥、模型准确率或外部监护认证证据。
- **Lead独立复验（2026-10-15）**：`node --test backend/tests/*.test.mjs tests/integration/m2-*.test.mjs`，pwsh-326 exit0，95/95、0 fail、65.612s；[可读完整日志](<../build/m2-lead-full-regression-20261015-utf8.log>)。独立CNG729 exit0见[密码学日志](<../build/m2-peer-lead-cng-20261015-utf8.log>)，不包含ESP-mbedTLS或双板无线验收。mobile角色84/84日志由Lead读取核对，见[手机测试日志](<../build/m2-mobile-final-tests-utf8.log>)，不是手机物理84项。
- **实体基础（Lead实际操作）**：[APK](<../mobile-pet/deliverables/warm-paws-town-0.1.0-debug.apk>) SHA256 `FBAA505DA6D469B6019D09A41D16602A66CC5A3E30E52E7FF391954F912731F6`，install -r Success且保留数据，原猫币24。[固件](<D:/orangecat-m2-build/orange_cat_pet.bin>) 3134496字节，SHA256 `6F69FF1311C2624D017FB1C5D5A56EB09E4B6F71E16D20B8D02A3077B4472465`。旧新NVS均0x9000/0x8000；重验物理32MB后，pwsh-313四区0/0x8000/0x12000/0x20000写入exit0，各数据hash验证，[烧录日志](<../build/m2-controlled-flash-20261015-utf8.log>)；未整片擦除、未写NVS/eFuse/ota1/资产区。pwsh-314 reset后20秒[串口启动记录](<../build/m2-postflash-serial-20261015.log>)显示LVGL/8MB PSRAM/NimBLE MAC 7c:0c:5f:42:36:86，无panic（只覆盖采集窗口，不是长期稳定性）。最新实体手机APK扫描RSSI -55，CCCD/HELLO/GET_STATE ready=true、cap15、authenticated=false，见[实际状态](<../build/m2-phone-new-firmware-handshake.json>)和[实机截图](<../build/m2-new-firmware-ble.png>)。
- **实体完整读回（pwsh-332）**：从0x20000读回3134496字节、exit0；[读回日志](<../build/m2-app-readback-20261015-utf8.log>)，SHA256 `6F69FF1311C2624D017FB1C5D5A56EB09E4B6F71E16D20B8D02A3077B4472465`与构建生产app完整一致。不是OTA/账号绑定验收。
- **一次性provision实际失败/待诊断（pwsh-346）**：隔离helper实际ESP编译exit0、185024字节、SHA256 `7C83CDD64CB9EF45AE48D960C121ECCFC5E347A839EE1F338F457A9A1211BCE3`，Lead独立核hash/dry-run，四项源码修复经独立限定范围review。执行前校验选中VALID ota0@0x20000，seq1/state2的CRC正确，分区表匹配生产；私有当前NVS已备份。仅app槽临时写入helper后host exit3、无成功RESULT；finally完整恢复生产app且flash hashverified。不能把工具构建/review称注入成功。pwsh-347实际只读备份显示table、NVS、otadata与尝试前逐字节一致；有效Full/Active页CRC正确、Written device_key条目0，末尾另有Empty/Invalid页不能称整个NVS有效。未重新生成密钥、未重试SET。pwsh-352恢复后完整读回在约88%收到损坏块、exit2，未通过；pwsh-353已collect exit0，低速完整读回3134496字节的SHA256 `6F69FF1311C2624D017FB1C5D5A56EB09E4B6F71E16D20B8D02A3077B4472465`与生产一致，见[低速读回记录](<../build/m2-restored-app-readback-slow.log>)；保留352传输失败历史。秘密及可能含凭据备份不附交付。
- **恢复后的独立实体复验**：pwsh-357实际采集20秒启动、exit0，[生产启动记录](<../build/m2-restored-production-boot-20261015.log>)含Loaded app@0x20000、32MB flash、8MB PSRAM、LVGL/touch/BLE MAC尾86，窗口内无panic；I2C pullup/gesture disabled警告保留。pwsh-360真实手机再次扫描RSSI -53，pwsh-361真实CCCD/HELLO/GET_STATE [握手记录](<../build/m2-phone-restored-firmware-handshake.json>) ready=true、cap15、authenticated=false、error空。仅证明恢复后基础链路，不证明绑定。
- **限界诊断改造**：[host客户端](<../tools/device-provision/provision.py>)新增固定阶段/白名单错误、SET前may_have_written及不被close覆盖的confirmed_result；probe-only禁止key-file/SET。peer角色只读全部397行+两组合成PASS且No findings限定host范围；Lead pwsh-359独立dry-run两组PASS。未新SET，旧346阶段不可补造。追加本次**无密钥实体探针（pwsh-366）**：不提供keyfile、不发送SET、不重试；OPEN0→HELLO_SEND31→READY_READ31→READY_VALIDATE61ms，`BAD_MAGIC`、exit3、`may_have_written=false`、`probe_ready=false`，见[阶段记录](<../build/m2-secret-free-probe-utf8.log>)。收到64字节但magic不符，来源未证；日志首尾编码损坏保留，不能归因为USB时钟或超时。finally生产restore flash exit0；pwsh-369完整3134496字节读回exit0，同生产SHA256 `6F69FF1311C2624D017FB1C5D5A56EB09E4B6F71E16D20B8D02A3077B4472465`。Lead随后对本次私有pre/post逐区域比对：table/NVS/otadata byte-identical，VALID seq1/state2 CRC仍正确、ota0@0x20000，otadata SHA256 `8ba3b110139f45443d4f268d1a3373ef99a1718b71d51664531b83ee2d4b91a3`。恢复通过不是probe、密钥注入或绑定通过。
- **有限READY扫描与本次实体探针**：Lead pwsh-375独立11项合成测试及dry-run两组PASS，独立只读审查仅scanner范围No findings。fresh备份与VALID门禁379通过后，380一次无密钥probe exit0：读取128B、丢弃64B、1候选，77ms严格READY通过，`probe_ready=true`、`may_have_written=false`，无key-file/SET/重发HELLO/重试，见[实机阶段日志](<../build/m2-scanner-secret-free-probe-utf8.log>)。丢弃字节来源未证，不追溯解释346/366。finally生产restore exit0且[flash hash verified](<../build/m2-postscanner-production-restore-utf8.log>)；382完整3134496字节读回exit0，与生产SHA256 `6F69FF1311C2624D017FB1C5D5A56EB09E4B6F71E16D20B8D02A3077B4472465`一致；383私有比对table/NVS/otadata byte-identical、VALID seq1/state2 CRC正确、ota0@0x20000。仅READY与安全恢复通过，未注入密钥、未绑定，各需求状态不升级。
- **实体基础不覆盖**：auth=false、尚未设备安全provision/绑定，不能证明PET授权同步、ACTIVE24/ACK25、双板peer/KNOCK/PATTERN/QR、ENV采集/ACK15或OTA实际回滚通过。矩阵中这些均保持待实机。
- 状态：**部分通过**=列出的实际测试层通过但需求仍有未覆盖；**未验收**=无充分运行证据；**条件未开放**=保留范围且安全关闭；**待实体**=接口/host层有证据但实体链未完成。源码存在或编译成功均不能独立升级为产品验收。

## H / N：硬件与近场安全

|ID|实施与实际证据|限制/下一验收|状态|
|---|---|---|---|
|H01|开发板固件已实际烧录并启动（实体基础）|无自研PCB/原理图/BOM/制造验证证据；开发板不是自研吧唧V1|未验收|
|H02|开发板可启动|58/75mm、佩戴结构、天线、温升/充电/续航未测|未验收|
|H03|实体启动含LVGL与PSRAM；原手机猫存档保留|未逐项比对6品种/动作/服饰与同源3D常显；无帧率/内存/延迟实测|部分通过|
|H04|HTTP95含QR双证明；不是NFC证明|无物理NFC器件/触碰验收；双设备QR物理确认仍待实机|待实体|
|H05|HTTP95账号隔离、解绑/重绑历史care不继承、存档与权威宠物分离通过|手机/吧唧真实挂失恢复与新机绑定未验|部分通过|
|H06|HTTP95含预签发布失败关闭/归属/错误拒绝；已flash新双槽基础映像|闪存烧录不是OTA；固件和资产签名更新、断电/坏包/回滚待实机|待实体|
|N01|HTTP95双证明及绑定复验通过；手机实际BLE RSSI -55连接|只有一条手机连接，不是两吧唧近场/测距证明；中继攻击未排除|待实体|
|N02|HTTP95匿名token有效期、发现撤回/设置revision边界通过|真实双板广播轮换、退出发现、拥挤扫描、3m迟滞/动效未测；无马达不称震动|待实体|
|N03|HTTP95可信venue provider缺失/伪自报/过期/换场拒绝通过|测试成员DI不是现场可信地理围栏；生产provider与定位边界待接入|部分通过|
|N04|HTTP95独立HMAC、nonce/期限/双方proof、取消/重放/换session/账号边界通过|实体auth=false；一机一密实际注入/授权、双板proof生成和输入匹配未验|待实体|
|N05|HTTP95联系人双同意+真实interaction后置、撤回/越权/拉黑通过|匿名破冰动作和真人信息UI完整链待两设备实体|部分通过|
|N06|HTTP95亲密成长与奖励分离、技能/交易/赠礼interaction通过|完整互访与共同任务内容/运营参数未验收，不把intimacy数字等同全关系养成|部分通过|

## C / F：暗号、连点、Fate

|ID|实施与实际证据|限制/下一验收|状态|
|---|---|---|---|
|C01|HTTP95含QR及社交契约；当前固件编译烧录成功|KNOCK/PATTERN菜单/策略不等于实际完整输入；双板暗号/连点/扫码兜底待实机，一起摇未验|待实体|
|C02|HTTP95 ROLE18方向/initiator鉴权独立验证通过|实体一人主敲一人跟随及延迟容错待双板|待实体|
|C03|15秒HTTP期限拒绝通过|实体长按999/1000ms、退出/换对手、1m范围、BOOT/PWR安全未验|待实体|
|C04|服务端方法域隔离/共同transcript签名通过|真实4–8敲、1.2s/5s、15%/30%边界及去抖/回绕未在本轮独立验收|待实体|
|C05|HTTP95关系持久/重复遇见奖励与新连接分离、撤回路径通过|友谊暗号实体保存/重遇识别及双端一致未验，24h实机UI未验|部分通过|
|C06|固件完成实际编译/启动|实体键优先、触摸备用及输入不抢照料/语音未测；Q14不擅定型|待实体|
|C07|权威交易/图鉴HTTP层通过|圆屏9点hitbox、序列一致/3–4点、印章真实图形来源与重启待实机|待实体|
|C08|需求保留合法序列匹配，不用自由画相似度|心形/星形特效与判定分离没有本轮实体证据|未验收|
|F01|条件功能保留，不因编译或接口存在称开启|Q15未定，默认关闭/撤回及实际功耗未测|条件未开放|
|F02|平台具备QMI方向传感基础，不认定磁朝向|真实佩戴静止角/倾斜样本与算法标定缺证据|未验收|
|F03|PRD初值保留|双机时序、8°/3°/300ms边界、误报漏报无实体证据|条件未开放|
|F04|未配置奖励应关闭，不能造Fate图鉴记录|好友排除、pair一次、日上限/奖励未冻结且未实测|条件未开放|
|F05|广播编码属于待确认技术方案|1字节量化、100–200ms广播、序号回绕/时间误差/续航未验|条件未开放|

## E / B / K：经济、繁育、收藏

|ID|实施与实际证据|限制/下一验收|状态|
|---|---|---|---|
|E01|HTTP95权威资产/账本与legacy save分离，恶意PUT不铸造通过|真实手机/设备获取显示链仍需授权；正式经济奖池非试验定案|部分通过|
|E02|可赠候选限定ITEM/OUTFIT，isGiftExclusive按原mint目录保留；HTTP真实两账号礼物转移通过|限定衣饰家具实际美术/装扮显示、商城不售完整UI待验|部分通过|
|E03|HTTP95可信care路线技能、来源技能/关系门槛、一次随机持久与学习通过|路线/概率为试验配置，实机动作/技能显示和产品定案待验|部分通过|
|E04|HTTP95实际交付后给予者批次奖励持久、并发重试唯一通过|奖励为可配置目录，不认定所有慷慨值/称号/回礼例子均实现|部分通过|
|E05|HTTP95 PET_RANDOM显式范围、禁assetId/seed/filter、并发同key一资产锁、取消通过|实际拆礼物惊喜与运送动效待两设备；候选变动后用户范围提示继续审校|部分通过|
|E06|HTTP95新/重复遇见奖励、日限/冷却/重启、亲密独立成长通过|当前曲线试验，不是正式经济平衡或真人留存验证|部分通过|
|E07|HTTP95无向pair运输批次衰减、反向冷却、每方每批最多一奖、restart第三批零奖、高价值转移冷却通过|一机当前归属通过，不等于运营防小号/真人年龄认证；上海日界赠礼专项未单独覆盖|部分通过|
|E08|HTTP95发起IN_TRANSIT不到账、新双方确认遇见才交付、重复/旧取消不解新锁通过|真实两吧唧见面运送和双端动效未验|待实体|
|B01|HTTP95真实两权威父母/双授权、快照、两份固定child、稀有权益/重启/重试通过|基因/稀有率是试验配置，美术遗传展示与实体领取待验|部分通过|
|B02|HTTP95可信成年、容量6只、双方扣费/退款/并发容量、恶意save不改资格通过|当前云health判断与原作≥65/无病完整继承不可视为已验；规则迁移仍待产品决策|部分通过|
|B03|HTTP95真实3care+双parent ACTIVE各60才READY；墙钟无效、固定权益恢复、一次退款通过|ACTIVE为TEST-ONLY签名HTTP；实体auth=false，硬件24/25未验；固件前台不证明手机原作页面visibility|待实体|
|K01|图鉴派生legacy愿望/成长，权威技能/资产HTTP读取通过|legacy条目标LEGACY_UNVERIFIED；孵化/纪念日全部事件唯一掉落未独立覆盖|部分通过|
|K02|HTTP图鉴只返回真实存档品种，新增25资产不截断回归通过|完整6品种统一条目/真实获得UI与资源实机逐项核对未验|部分通过|
|K03|HTTP95初次随机/好友定向、双方锁、confirm/cancel并发、双花/第三人/守恒通过|两吧唧实体确认/交易动画待验；试验抽样细则非正式定案|部分通过|
|K04|HTTP95世代固定child来源、legacy删除不复用alias、满家庭/restart谱系恢复通过|毕业信/照/日子与遗产完整UI无损迁移未逐项实测|部分通过|
|K05|成功遇见权威来源可追溯，失败不结算层通过|连点图形实体印章来源未验；Fate未开放不得造稀有印记|待实体|

## A / AI / S：音频、隐私、人格、运营

|ID|实施与实际证据|限制/下一验收|状态|
|---|---|---|---|
|A01|最新固件实际编译/启动，只能证明基础运行|真实双麦I2S、AEC/VAD/唤醒及30–50命令模型/识别率/延迟/功耗未验|未验收|
|A02|用户ASR暂不定，不允许云原音频；安全边界保留|本机自由ASR/BLE音频压缩流未完成，不能声称本机或云识别通过|条件未开放|
|A03|HTTP95签名环境事件、UNKNOWN拒绝、置信度/期限/归属/授权边界通过|非真实四场景分类模型证据；混淆矩阵/I2S/平滑/占空比与帧率共存待实测|待实体|
|A04|HTTP95独立environment consent、年龄scope/provider失败关闭、撤回清除、七天物理TTL与摘要墓碑通过|生产可信年龄/监护provider未接；真实麦克风停采/指示及备份清除运营未验|部分通过|
|A05|策略要求低电/设置/插电门禁不绕独立ENV授权|19/20%、未知PMIC、USB真实电流与误唤醒未验；默认开不等于模型存在|待实体|
|AI01|HTTP95每猫持久维度/可信care社交漂移、唯一hook/重启/冷却通过|候选维度/参数非最终人格设计；孵化基因人格与跨猫同事件表现全部未验|部分通过|
|AI02|HTTP95真实CONFIRMED_MEET/GIFT/EXCHANGE/CHILD触发与唯一/冷却通过|换装/冷落/遇见失败触发及真实设备气泡未全覆盖，不能称全部主动表达完成|部分通过|
|AI03|HTTP95真实授权摘要日记、明确OFFLINE/模型gateway路径、撤回/TTL/race及最小payload通过|测试gateway流量不等于公司外部AI授权；语音/周报/长期记忆未验，不延长敏感数据TTL|部分通过|
|AI04|Should/Could范围保留，不纳Must完成偷换|本地小游戏/线下PK本轮未独立实测，线上排行不应启用|未验收|
|S01|可信场景访问安全HTTP层通过|社团据点/活动内容、异步足迹回声与明示官方NPC空场兜底无完整运营验收|未验收|
|S02|HTTP95默认发现关闭、联系人后置、拉黑交易拒绝、举报RECEIVED持久隔离、敏感年龄scope失败关闭通过|举报处置流程/生产年龄监护服务/真人保护运营闭环未接，RECEIVED不是处理完成|部分通过|

- **本轮scanner恢复后手机链路**：实际连接并读取HELLO/GET_STATE，见[本轮握手](<../build/m2-phone-postscanner-handshake.json>)：ready=true、cap15、MAC 7c:0c:5f:42:36:86、authenticated=false、error为空。仅本轮恢复后本地BLE，不升级绑定、ACTIVE、peer或ENV状态。

## 2026-10-15 05:01 Lead独立READY与受限launcher复验

- **普通READY host验证**：Lead独立执行21 tests，全部OK、0.024s、exit0，见[READY独立测试日志](<../build/m2-ordinary-ready-lead-tests-utf8.log>)；另独立dry-run两项PASS（Lead已收集）。这是host/合成协议验证，不是实体KEY_READ、SET或物理绑定。
- **修复后受限launcher验证**：Lead独立执行27/27 pass、0 fail、0 skip、exit0、337.8843ms，完整35行已读取，见[launcher独立测试日志](<../build/m2-live-backend-fixed-lead-tests-utf8.log>)。覆盖合成文件校验、read/close异常缓冲清零、启动/取消/监听/关闭竞争及失败后保留DB；不把合成依赖测试当真实服务启动或安全设备密钥注入。
- **限定范围审查**：peer fresh169/120只读结论No findings，并报告27/27测试通过；只适用于本轮受限launcher修复范围，不外推全部后台、设备或M2产品验收。
- 截至本轮证据，**没有live后台启动、没有KEY_READ、没有SET、没有binding**。所有已有逐项需求状态、历史失败与设备授权/ACTIVE/peer/ENV限制保持，不因测试或审查通过升级。此节依据Lead独立收集报告追加，本角色未运行真实服务、读取private或操作设备。

## 待Lead补实体证据

优先：安全注入设备密钥及物理绑定 → 已授权PET/LIFE/ENV gate → ACTIVE24实际71B片段与ACK25持久队头 → 第二块吧唧双方发现/QR/KNOCK/PATTERN → 真实礼物运输/交换/繁育。单板启动、auth=false HELLO、编译、host review No findings均不提前替代这些验收。
