# M2 独立验收记录

日期：2026-10-14。状态：进行中，不是整套M2完成声明。

## 需求与契约

- [逐条需求矩阵](<m2-requirements.md>)：基于用户选择的旧v1.9与Q9已通过；区分明确、初值、待确认、Should、Could、M1欠账与M3。
- [三端冻结契约](<m2-contract.md>)与[HTTP DTO/Wire](<../backend/docs/m2-http-draft.md>)。backend/firmware/mobile分scope施工；本角色不改业务端，不git/部署/刷机。
- 用户允许可配置试验默认值、双方各一只幼猫（Lead传达）；试验fixture概率/奖池/冷却不等于生产定案。ASR暂不定，不送云音频。权威cat资格/成长/币必须不受legacy save自报影响。
- kind方向冻结：10签名challenge入、11环境gate入、12社交proof64出、13环境status10出、14ENV event56出、15签名ACK body8入。

## 已执行证据

|检查|执行|结果|覆盖/未覆盖|
|---|---|---|---|
|M2分区预算/legacy迁移区别|`node --test tests/integration/m2-partitions.test.mjs`|2 pass / 0 fail，exit0|CSV非重叠、32MiB预算、app对齐、双槽与otadata；不是固件烧写或断电回滚|
|独立HTTP测试语法|`node --check tests/integration/m2-helper.mjs; node --check tests/integration/m2-http-security.test.mjs`|exit0|仅syntax；HTTP路由尚施工，未声称执行通过|
|既有三端基线|Lead本轮运行|75 pass / 0 fail（Lead传达）|包含新后台定位host测试；不是本角色重新跑，也不是实体定位/无线验收|
|mobile状态解码|`node --test --test-name-pattern='status decoder' tests/integration/m2-mobile-wire.test.mjs`|1 pass / 0 fail，exit0|实际decodeEnvironmentStatus、切片byteOffset、LE revision/confidence、保留字节/置信度越界；其余HTTP未在此命令执行|
|首次M2独立联合HTTP/authority/mobile/economy/partition|`node --test tests/integration/m2-http-security.test.mjs tests/integration/m2-authority.test.mjs tests/integration/m2-mobile-wire.test.mjs tests/integration/m2-economy.test.mjs tests/integration/m2-partitions.test.mjs`|14 tests，7 pass / 7 fail，exit1，15:17左右|真实移动ApiClient/QR双证明+118签名与续租、单边/过期/撤回/取消、换主人历史care拒绝等通过；其余红测试向owner报告，保留失败而不假联调|
|联合复验（含真实权威繁育）|`node --test tests/integration/m2-http-security.test.mjs tests/integration/m2-authority.test.mjs tests/integration/m2-mobile-wire.test.mjs tests/integration/m2-mobile-idempotency.test.mjs tests/integration/m2-economy.test.mjs tests/integration/m2-breeding.test.mjs tests/integration/m2-partitions.test.mjs`，job `pwsh-1306` 已完整收集|18 tests，17 pass / 1 fail，exit1|此前7项业务红均复验通过；唯一失败为测试FEED缺完成计数a=3，被正确拒绝42003；修fixture后技能专项1 pass / 0 fail。未把两次运行冒称一次18全绿|
|普通生活授权撤回隐私|`node --test tests/integration/m2-privacy.test.mjs`|0 pass / 1 fail，exit1|真实创建生活摘要与日记后PUT撤回lifeSync，日记仍1条；已报owner，旧key回放断言尚未执行到|
|稳定核心完整复验|上述联合命令增加`tests/integration/m2-privacy.test.mjs`，job `pwsh-1319` 已完整收集|19 tests / 19 pass / 0 fail，exit0，11.924s|包括普通consent撤回及旧日记key不可复活、claim旧key返回当前存档、删除legacy幼猫后下一合法子代ID不复用/旧权威profile仍在、未知ENV ID拒ACK与终态kind15独立签名；不是硬件验收|

|独立全量历史快照|`node --test tests/integration/m2-*.test.mjs`，job `pwsh-1475` 完整收集|43 tests / 43 pass / 0 fail，exit0，31.068s|含文件SQLite七天物理清除、混合容量与固定子代恢复、历史claim隐私迁移、年龄用途资格/监护人、逐care异常回滚、ROLE18、OTA失败关闭；不含实体peer/输入/OTA回滚及随后新增专项|
|最新独立全量|同上命令，job `pwsh-1494` 完整收集|49 tests / 49 pass / 0 fail，exit0，31.531s|新增extreme date/blank evidence稳定INVALID_PROVIDER、peer资格由对方请求触发实体清除、人格真实社交hook唯一/持久/冷却、到期锁GET纯读和POST释放、16/17字节oracle；实体硬件与活动同步新契约不在此证据内|

首轮失败：authority初bind无profile hook；旧exchange/gift取消能解新锁；换session仍用旧confirmed遇见交换；GET encounters query未传500；ENV batch嵌套事务500；kind11签名接口仍旧allowlist400。ENV正向测试随后补齐真实life独立授权与采样起点晚于boundAt，不放宽签名/TTL/归属要求。kind11 grant超session expiry另缺陷已在联合复验验证裁剪通过。

## 只读审查反馈（历史问题与当前复验）

- mobile旧默认永久按path+body复用POST key造成短期discovery续租旧token且敏感ENV/proof正文存储。已改explicit operationKey且仅存随机ID；账号namespace、实际HTTP续租及body-free记录已在独立全量复验。
- social旧view裸challenge66与mobile write10 signed118不符；创建时双侧冻结118、GET纯读及独立HMAC已复验通过。
- firmware同revision环境授权在正常断连/expiry后allowed=false被拒，无法新session恢复；已报owner区分撤回墓碑与断连状态，本角色尚未独立执行实体恢复测试。
- audio初始化codec/data分配失败未释放已创建I2S资源，后续重试不可恢复；已报firmware，本角色尚未独立复跑资源cleanup。
- legacy完整save自报coins/xp/成年不得成为稀有联姻资格；权威profile独立恶意PUT与真实签名care资格测试已通过。

## 分区审查

[新双槽布局](<../partitions-m2.csv>)：nvs0x9000/32KiB、phy0x11000/4KiB、otadata0x12000/8KiB，ota_0起0x20000与ota_1起0x820000均8MiB，assets_a/b各7MiB。结束0x1e20000=30.125MiB，32MiB余0x1e0000=1.875MiB。无重叠且app64KiB对齐。

[旧布局](<../partitions.csv>)只有factory8MiB和storage8MiB，**没有otadata与双OTA槽**。新[sdkconfig覆盖](<../sdkconfig.m2.defaults>)和新分区CSV仅可用于后续受控制造映像；不能将一份M2 app OTA到旧factory设备并宣称完成无损分区迁移。实际分区的NVS、esp-idf bootloader、签名根与模型/声音包位置/预算须另验。

独立编译产物证据：`Get-Item`读取[orange_cat_pet.bin](<D:/orangecat-m2-build/orange_cat_pet.bin>)大小2,993,616字节（0x2dadd0）。[实际ninja日志:255–263](<D:/orangecat-m2-build/log/idf_py_stdout_output_239652#L255-L263>)记录链接、创建ESP32-S3映像、最小app槽0x800000，余0x525230（64%）。[已生成配置:404](<D:/orangecat-m2-build/config/sdkconfig.h#L404>)启用rollback，[分区配置:472–476](<D:/orangecat-m2-build/config/sdkconfig.h#L472-L476>)确认custom partitions-m2.csv；SPIRAM/XIP宏亦存在。此前owner误指[配置日志](<D:/orangecat-m2-build/log/idf_py_stdout_output_34652>)仅CMake配置，已更正为ninja日志。此镜像不含随后新增全屏采集指示；未刷机，未测断电回滚。

尚未覆盖：语音模型是否挤入app/资产、OTA transport/API是否可达、包签名/制造可信根、拒坏包、更新半途断電、首次开机健康判定与回滚、资产与固件版本原子切换、旧存量设备迁移。仅`CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y`不等于完整OTA。

## 独立HTTP设计与待执行

[测试工具](<../tests/integration/m2-helper.mjs>)只导入createApplication启真实127.0.0.1 HTTP，全部身份注册、存档PUT、绑定挑战/证明经HTTP。设备key全为TEST常量，不访问生产key。测试oracle自行组合ASCII无NUL域、UUID16、MAC6、LE数值、SHA256/HMAC，不导入后台crypto/canonical或service结果绕行。

[安全用例](<../tests/integration/m2-http-security.test.mjs>)已在联合复验5例通过：
- 匿名发现默认关、opposite kind10 challenge独立BAJI-SYNC域与kind验证；双方相同共同transcript；两个真实主人和第三越权账号。
- 单边proof不建好友；错误key/method、过期、缺幂等key、同key不同内容失败；重复结果不重复关系。
- 联系人必须双方同意、撤回不再显示，第三账号隔离，拉黑后无法新遇见。
- kind11独立环境授权，不复用旧microphone布尔；ENV56B完整签名、uint64>JS安全数、重复终态、wrong owner/签名/flags与原音频附加字段拒绝。
- 最早sample起点七天TTL，不只检查结束时刻；撤回/regrant revision与id墓碑阻止复活；life-data清除同时撤回。

[权威资格](<../tests/integration/m2-authority.test.mjs>)2例通过：legacy PUT自报成年/币/新cat不能进权威profile；真实签名care单次推进、重放不双收益；解绑换主人旧事件无收益；切换伪造activecat重绑不造第二starter。

[经济](<../tests/integration/m2-economy.test.mjs>)3例通过：旧X取消不解新Y锁、礼包仅下一真实遇见投递一次、旧confirmed遇见换session不可再经济操作。[真实繁育/技能](<../tests/integration/m2-breeding.test.mjs>)通过两繁育例：每边54次真实签名care令xp162成年、双同意扣各30币、60s与双方各3care后各领唯一子代、rare不重抽、并发取消双方只退一次；技能需要签名feed完成计数a=3，fixture修正后专项通过。启动只注入随机provider稳定服务器性别/概率，所有成长/状态仍经HTTP，不直写DB。

已在19项完整回归验证：领取旧key不回放私密旧save，普通consent撤回日记且旧key不可复活，删除legacy cat后下一合法子代不复用权威ID，ENV终态kind15 ACK独立签名与未知ID拒签。其先前失败保留在历史证据表。

已新增专项：
- [SQLite保留期](<../tests/integration/m2-retention.test.mjs>)：HTTP写ENV/日记→同文件restart重放ENV返回DUPLICATE→跨七天restart，readOnly SQLite实体行ENV/diary均0，digest receipt仍1，无signedEventBase64与日记retry文本。与[经济测试](<../tests/integration/m2-economy.test.mjs>)并发confirm/cancel守恒合跑5 pass / 0 fail，exit0。
- [容量回归](<../tests/integration/m2-breeding.test.mjs>)：真实先孵化双方子代，解绑再绑子代并签名feed成年；legacy家庭5、权威2时一个已扣费待领子代占slot，第二双同意被拒且不部分扣费；取消第一后第二可恢复，专项1 pass / 0 fail。首试错误地仅续session没解绑仍喂旧猫被正确拒绝，修正真实绑定前置后通过。
- [场地授权](<../tests/integration/m2-venue.test.mjs>)：未配server authorizer即使场地allowlist也拒；未批准账号、过期lease、撤回后的valid proof、双方换场后旧token均拒，2 pass / 0 fail。普通helper只显式批准前两fixture账号的60s `PILOT_MEMBERSHIP`，第三账号不批准，**不是地理在场证据**。

- 场地新增快照回归首次3 tests / 2 pass / 1 fail，exit1，双侧同时切场原proof仍200；owner修快照后最新3 pass / 0 fail，exit0，双切场、双撤回重授、confirmed lease撤回经济均拒；新租约deviceId严格字段已同步。
- 固定子代满家恢复专项1 pass / 0 fail：真实双养成→A领子代、B随后legacy填6拒claim且不可cancel→七天后同文件restart/重新login→固定childId未丢且未领→去掉非权威cat6后领同childId/breed/sex，不重抽、不自动退费。
- [独立OTA](<../tests/integration/m2-ota.test.mjs>)：4 pass / 0 fail，exit0。TEST-only P256预签74B manifest与901B制品，真实HTTP信封/鉴权binary、20/21/22独立HMAC、分块offset0/440/880、same-key不增counter、错owner/offset/任意data拒、无配置/坏发布签名失败关闭；实际ApiClient与UpdateUploader连接HTTP+独立验签transport替身，STATUS23 VERIFIED才报告成功，status40切片和进度越界。不是实体ESP32 OTA或回滚证据。

新增OTA异常配置曾8 tests / 4 pass / 4 fail：version0/空制品仍200、缺key/file50000；owner修严格边界/缓存后本角色OTA8+ROLE1合跑9/9，exit0。ROLE18独立75B/HMAC/创建方MAC、strictDTO/owner/session/cancel旧key拒通过。

[资格专项](<../tests/integration/m2-eligibility.test.mjs>)6/6，未配置/UNKNOWN/过期/错账号返回稳定状态和41003，UNDER14分LOCATION/ENVIRONMENT监护人scope+用户独立同意41004，失效清ENV与旧key11关grant/TTL裁剪、恢复不自动开。[回滚专项](<../tests/integration/m2-care-rollback.test.mjs>)1/1，afterTrustedCare只抛BizException，不造DB态；wallet/xp/personality/save/skills全回滚、失败事件非terminal可重试，同批下一事件独立成功、重复persona不双增。Lead `pwsh-1476`另独立重跑资格6+回滚1+ROLE1为8/8，exit0，1.176s。

历史claim迁移专项1/1：Lead明确批准仅隔离TEST文件SQLite上为真实HTTP已claim receipt注入旧response.save/revision隐私字段，经济权益未造态；重启readOnly实体scrub，再同keyHTTP当前save且childId/wallet/profile不变。初次test doubleclose失败属fixture生命周期，修helper幂等close后通过。

新增persona社交hook专项1/1：真实双证明MEET与EXCHANGE各漂移一次，proof/confirm重放不重复；文件SQLite restart持久，cooldown内不换bubble，61s后expression为空及新遇见可重新表达。peer资格清理与该人格专项合跑8/8：B变UNKNOWN后不发请求，A valid proof被拒同时B environment_event实体0、consent关且revision增长。peer16/17独立字节专项1/1：LE16间隔257/1025/4097、canonical实际method2 SHA域、PATTERN唯一点、错encounter/保留位拒；不证明实体可信peer。

到期锁专项先0/1：GET纯读通过，POST confirm因同事务maintenance改EXPIRED再业务抛错回滚仍锁；owner修terminal EXPIRED可返回后1/1，GET只读实体snapshot不变，POST一次释放指定锁、终态重试不转移资产。

同步缺口独立只读证据：[mobile入口:99](<../mobile-pet/src/companion/main.js#L99>)游戏mutations仅250ms cloud.push，[117](<../mobile-pet/src/companion/main.js#L117>)手动设备按钮才synchronize，[123–124](<../mobile-pet/src/companion/main.js#L123-L124>)定时/后台仅CAS。后台[kind3:101–105](<../backend/src/device/service.mjs#L101-L105>)固定绑定cat而非activeCat，27B只有编号/外观/阶段/stats/health/xp/coins/time，无活动状态。此处是缺口证据，不擅自冻结新活动wire。

最新完整49/49已收集（见历史表）。随后好友peerPet修复追加真实HTTP断言与发现token.pet的name/breed/outfit一致，安全专项5/5 pass，exit0；不冒称全量49包含此后新增断言。

[日记真实gateway专项](<../tests/integration/m2-diary-gateway.test.mjs>)最新4/4 pass，exit0，1.605s：生产ModelGateway向本机HTTP模型fixture发送TEST key与模型白名单请求，明确文字同意才调用，无同意OFFLINE且零调用；输入仅真实date/count/types/personality，无坐标/地点名/raw音频。在HTTP模型await期间用户撤回/摘要变更/七天TTL过期均41001且不落日记。首跑3/4通过，TTL结果已41001但后验GET访问token过期401；补真实重新login后4/4。这是测试模型HTTP，不是公司外部模型服务验收，不冒称历史49包含随后新专项。

用户经Lead最终澄清为现实life地点跟随（猫陪去上班），不是游戏WORK或activity24。只读[kind4:107–113](<../backend/src/device/service.mjs#L107-L113>)是日期/revision/时区、历史segment起止/type与moments，不携带当前地点别名；[firmware显示:285–298](<../firmware-v2/render/baji_render.c#L285-L298>)仅当日rings/hearts，未根据当前minute匹配段派生WORK陪伴场景。[BadgeSync:34](<../mobile-pet/src/companion/badge-sync.js#L34>)仅手动发9/3/4；[scheduler草案](<../mobile-pet/src/companion/badge-sync-scheduler.js>)注明未挂载，不能当自动设备跟随完成。新24停止，后续只按现实life契约审校。

已扣费策略快照专项1/1 pass，exit0：真实HTTP养成/双同意扣费→仅修改TEST启动policy（careTarget99、incubation9999、rareCatalog空、refund0）→文件SQLite restart→按原60s与双方3care READY，领取原childId/breed且原test-rare奖励仍各侧一次。配置变化不是经济DB注入；专项晚于49历史全量。

最新追加目录metadata专项：`node --test --test-name-pattern='policy snapshot' tests/integration/m2-breeding.test.mjs`，job `pwsh-1525` 完整收集3/3 pass，exit0，16.326s。UNCHANGED/DELETED/CHANGED三场景在真实扣费后修改启动配置并重启，原TRAIT/rarity3奖励仍每侧恰一次。

[重复见面专项](<../tests/integration/m2-repeat-reward.test.mjs>)最新2/2 pass，exit0，2.988s：上海日界、按遇见批次而非两目录数量计3批上限、同key三并发证明重放、SQLite restart不丢上限；跨好友通过B解绑→已注册C真实绑定构造A-C，A-B耗尽不影响A-C，A累计2且B/C各1。首跑跳8h导致设备session过期42009属fixture，真实challenge/HMAC续会话后通过。

[LifeProvider/CAS/scheduler专项](<../tests/integration/m2-life-scheduler.test.mjs>)1/1 pass，exit0，0.868s：实际16定位样本形成15分钟WORK历史摘要，真实HTTP CAS白名单无坐标、确认标待办，实际scheduler签名9/3/4独立HMAC验真；模拟kind4 commit失败保留待办，5秒后成功清待办，重复摘要不PUT、新增CARE再CAS、pending-consent阻断。初跑15分钟会话过期属fixture，续绑定后通过。主入口已见挂载代码但本专项不证明浏览器定时器或实体BLE，早期未挂载描述保留为历史诊断。

旧paid缺metadata历史恢复：[繁育专项](<../tests/integration/m2-breeding.test.mjs>)3/3 pass，job `pwsh-42` 已收16.194s；真实paid后Lead授权仅删隔离TEST SQLite policySnapshot.rareCatalog，保留全部经济权益。同version trusted current回填原TRAIT3；不同version同ID改ITEM1无mapping失败47000并保持save/wallet/children；原version可信compat恢复原奖励、内部metadata不返VO。追加真实新paid断言1/1 pass证明compat-not-paid不会扩当前新paid rareCatalogIds。首跑job `pwsh-16` 0/3为末尾错误测试路由404，非核心恢复失败，已修复。

peer清理前置：[资格专项](<../tests/integration/m2-eligibility.test.mjs>)PROOF/CREATE/EXPIRED_TOKEN/INVALID_PEER_VENUE4/4 pass，exit0，1.971s。有效caller+token+双venue时，对方privacy UNKNOWN由请求触发实体ENV清0/epoch++，失败不会回滚；无权第三方、wrong caller session、过期token或无效peer venue均失败且实体仍1。Lead job53运行施工中的fixture CREATE null.id（25项24绿1红）已独立修复，不当业务缺陷或冒称该批全绿。

原mint资产目录变更：[经济专项](<../tests/integration/m2-economy.test.mjs>)DELETED/FLAGS_CHANGED2/2 pass，exit0，1.895s；HTTP真实starter资产/真实遇见后改配置并restart，原可交换资产双confirm仍转移，原稀有不可交换/不可gift资产不被新目录反转flags放开，失败不遗留锁。无资产DB造态；缺flags历史迁移尚未注入。

[环境长期同意续期专项](<../tests/integration/m2-environment-renewal.test.mjs>)1/1 pass，exit0，0.836s：首次独立PUT同意后901秒、SQLite restart与真实绑定新session，独立62B HMAC签名11仍grant1、expiry更新但consent全文/revision不变且不再次PUT；STOP后restart/rebind仍grant0；资格UNKNOWN清epoch后恢复仍关闭。只证明后端签名续期，不冒称手机自动挂接已验。

[历史资产缺flags恢复专项](<../tests/integration/m2-asset-recovery.test.mjs>)最新6/6 pass，exit0，前台8.808s，无后台job：同version可信目录与原version兼容记录恢复可交换资产；无mapping、compat kind/rarity不匹配、同version目录kind/rarity变更均47000且原资产不锁、不移。真实54care养成、双付费、3care孵化与claim得到稀有资产后，仅删除获批隔离TEST实体asset flags；部署目录变ITEM1并可转移，原paid snapshot仍拒交换/赠礼47002且资产保持。没有改kind/rarity/reference/ownership/ledger或新造权益。较早3项与5项绿为专项扩展历史，最新6项一次完成。

[非空HTTP响应契约专项](<../tests/integration/m2-response-contract.test.mjs>)2/2 pass，exit0，前台5.944s，无后台job。使用真实54care养成及双同意扣费链，递归核验create未付费/cancel/单侧同意/paid policySnapshot与双方children/READY/双方claim/CLAIMED/非空list；另一项核验真实非空OFFLINE日记create/list、签名ENV混合ACCEPTED/REJECTED批次、DUPLICATE重放与非空day。校验required/type/anyOf/additionalProperties/enum/min/max，对照服务端源schema；不造经济DB态，不把模型fixture或实体硬件当合同绿灯。

待补/复验：手机ENV signed11失败pending恢复与有效授权自动挂接、真实固件ENV队列ACK15应用、公司外部AI与真实分类模型、现实life设备自动跟随；满家庭后的付费子代固定权益规则遵循最新契约，不擅改legacy PUT。

Lead另传根分区checker 5 pass / 0 fail（job pwsh-1316），两份实际配置均1425 settings；非本角色重跑结果。Lead独立模型golden核验：exe输出5个unique FEATURE/60个finite值逐值误差tol0.0005全部pass，exit0，仅特征一致性，不是四场景准确率。backend owner报告本轮29 tests全通过；mobile owner报告58/58、browser空errors、Android构建48s；均是角色报告而非本角色独立执行，后续KNOCK/PATTERN施工仍会变更。

## 2026-10-15 当前迭代证据（backend角色，Lead授权追加）

- **旧繁育READY结论不覆盖ACTIVE门禁**：此前墙钟60秒+3care不能证明PRD“页面活跃”。当前READY另要求双方各累计60秒71B固件签名片段；旧已付固定child保留，但不能追认旧墙钟。当前严格固件前台路径不等于已验证手机页面visibility，仍需连接真实硬件及可见页面证据。
- 新图鉴完整权益：真实HTTP复现默认20分页丢第21–25条，修后图鉴/近场选项25条完整；资产列表本身分页保持。
- PET_RANDOM新gift-options与POST显式模式；禁止精确assetId/seed/filter，ITEM/OUTFIT低价值实际候选，一次抽取持久锁；旧运输财产权保留。给予者无向pair按运输批次衰减/日上限/冷却，每批每方至多一奖，交付不因奖励冷却阻断。
- `node --test backend/tests/m2-active.test.mjs backend/tests/m2-gift-rewards.test.mjs` 实际4/4 pass、exit0、6.111s：真实双账号54care成年/双同意扣费/3care后墙钟仍拒claim，签名ACTIVE双方60才READY并各领唯一child；错cat/重叠/第三owner/ACK25独立HMAC；PET_RANDOM并发同key唯一锁、双向批量每方一奖、冷却/restart第三批零奖。
- 最新第一轮完整 `node --test backend/tests/*.test.mjs tests/integration/m2-*.test.mjs`，job pwsh-302完整收集：95 tests/93 pass/2 fail、exit1、66.038s。新增ACTIVE文件restart墓碑、错签/未来/乱序、换session/解绑同key403均通过；两个红为旧gift fixture精确assetId及第二轮active fixture自然跨15分钟会话期限。已迁移为显式PET_RANDOM与真实binding-challenge签名重新物理授权fixture，未删期限校验；后续复验另记，不把93/95称全绿。
- 两红专项复验：job pwsh-307完整收集，13/13 pass、exit0、65.720s，含PET_RANDOM源DTO及全部真实付费恢复/隐私/满家庭/第二次子代重绑定+ACTIVE。
- **最新完整复验**：同全量命令，job pwsh-308完整收集，**95 tests / 95 pass / 0 fail，exit0，66.008s**。证据日志[完整服务端与M2回归](<../backend/m2-complete-regression.log>)。此次fixture只以独立TEST-ONLY设备密钥生成71B ACTIVE并走真实HTTP/SQLite，未直接改钱包/成长/child/活跃计数；不能代替实体BLE/页面visibility、模型准确率或外部资格provider验收。
- **Lead独立完整复验（2026-10-15，非backend重复运行）**：Lead实际执行同命令 `node --test backend/tests/*.test.mjs tests/integration/m2-*.test.mjs`，job pwsh-326，**95/95 pass、0 fail、exit0、65.612s**；[可读完整日志](<../build/m2-lead-full-regression-20261015-utf8.log#L96-L103>)由Lead读取末尾，本角色另grep核对tests95/pass95/fail0/duration_ms65612.1816。仍使用隔离TEST-ONLY签名HTTP/SQLite，不证明量产密钥provision、实体ACTIVE/双板peer/ENV、真实手机页面visibility或外部provider。此独立复验不抹除前轮fixture失败记录。
- 当前OAS由实际route/DTO生成3.1，结构指纹黄金向量自检通过；语义overlay只是本地草稿，未配置ACC发布，不是外部或物理验收。
- Lead传达固件第二轮构建仍有单payload编译错误，修复只读review No findings；**这是角色报告，未在本证据独立重建，亦不是设备烧录/真实active、音频或OTA断电验收**。

## 2026-10-15 03:06 实体恢复与无秘密探针（Lead实际操作，backend文档追加）

本节来自Lead已确认的设备操作结果；本角色仅编辑本文并读取公开日志，未操作设备、源码或private文件。保留全部先前失败记录，不把恢复基础链升级为M2功能验收。

- **此前恢复完整读回已确证**：job pwsh-353完整readback与生产app SHA256 `6F69FF1311C2624D017FB1C5D5A56EB09E4B6F71E16D20B8D02A3077B4472465`一致。job pwsh-357真实20秒boot采集；job pwsh-361手机恢复BLE连接，`ready=true / cap15 / auth=false`。这只证明该次生产映像恢复、启动窗口及未授权基础BLE连通，不证明设备密钥已注入、物理绑定、ACTIVE24/ACK25、peer、ENV或OTA断电回滚。
- job pwsh-359的**synthetic 2 PASS**仅合成测试证据，不是实体provision成功、真实serial帧兼容或密钥安全注入验收。
- **后续无秘密探针失败，job pwsh-366**：没有keyfile、没有SET命令、没有自动重试；Lead报告 `probeExit=3`。本角色读取[公开探针日志](<../build/m2-secret-free-probe-utf8.log#L9-L19>)核对：`READY_VALIDATE`在61ms失败，`BAD_MAGIC / may_have_written=False / confirmed_result=None / probe_ready=False / result=NONE / no automatic retry`。这不是READY成功；日志未显示秘密写入阶段，不能从此确认NVS全内容。公开文件首尾两行有编码乱码，exit3依据Lead收集的原执行结果，不从乱码自行推断。
- 此失败探针的`finally`生产flash恢复 **exit0**（Lead已确认），但截至本次消息，**job pwsh-369本次恢复后的完整readback仍在进行，不能先记hash一致或恢复全验证通过**。先前353成功是不同次操作，不能替代369。后续完整读回、真实boot与手机恢复结果由Lead另补。
- 仍未创建/读取/打印真实key，亦未用TEST-HMAC、成人/场地/已付父母fixture冒充实体授权。当前手机`auth=false`，设备授权、ACTIVE、双板peer、ENV继续待实机。

## 2026-10-15 03:19 后置读回完成（Lead已收集，追加不覆盖历史）

- job **pwsh-369已collect，exit0**：本次恢复后的app完整读回 **3134496字节**，SHA256与生产 `6F69FF1311C2624D017FB1C5D5A56EB09E4B6F71E16D20B8D02A3077B4472465`一致。上节“仍在进行”是03:06当时状态，保留原句，不改成当时已通过。
- Lead后置比对报告 **PASS**：partition table、NVS、otadata前后逐字节一致；otadata **VALID / seq=1 / state=2 / CRC正确**，选中 **ota0@0x20000**，otadata SHA前缀 `8ba3…`。这里只记录Lead给出的哈希前缀，不猜造完整值；本角色未读取private/NVS原始内容或复跑设备命令。
- 这完成本次生产flash恢复的读回与所列持久分区一致性核验，**不把失败探针366升级为成功，不证明新设备密钥已注入/绑定、实体ACTIVE/peer/ENV或OTA断电回滚通过**。后续boot与手机状态若有新采集仍由Lead另记，不以此前357/361替代本次后置采集。

## 2026-10-15 04:06 scanner修复门禁与新探针（Lead报告，待后置实机结果）

以下为Lead已收集结果，本角色未复跑设备、读取private备份或修改源码；仅追加本文，不覆盖前轮失败与当时进行中状态。

- **job pwsh-375已collect，exit0**：Lead独立11 tests通过，耗时0.010s；另dry-run两项PASS。peer fresh只读审查455/130为 **No findings，范围仅scanner**；不外推至全部provision、固件、peer认证或实机协议通过。task-6 revision4标记的仅为实现完成，不是实体授权验收。
- **job pwsh-376已collect，exit0**：本轮fresh private备份 **49152字节**；只记操作结果/长度，不公开原始private路径、内容或密钥。备份成功不是provision或恢复验收。
- **job pwsh-377断言失败**：helper expected hash人工抄写多一个`d`，门禁断言失败且**未部署**。保留此失败事实，不当作实体固件缺陷或成功部署。job pwsh-378实际核验后，job **pwsh-379修正门禁PASS**：table/NVS/otadata与post-probe基线一致，otadata VALID、seq1、CRC正确、选中ota0；helper和production完整hash与各自预期匹配。不同制品只与自己的完整预期比较，不猜造未提供hash，不把门禁PASS等同READY/provision成功。
- 截至本次消息，**job pwsh-380一次scanner无秘密probe + finally生产restore仍在执行**；未提前记录probe成功、restore成功或后置读回通过。其新serial/启动/手机及完整恢复证据须待Lead收集后另记，不能用369或379替代本次后置验证。
- 继续禁止TEST-HMAC/成人/场地/paid-parent fixture冒充实体。设备授权、ACTIVE24/ACK25、双板peer、ENV及OTA断电验收保持未覆盖；源码修复、dry-run、scanner只读No findings不能升级这些状态。

## 2026-10-15 04:16 本次无秘密probe与后置恢复完成（Lead已收集）

- **job pwsh-380已collect，exit0；probe exit0、finally生产restore exit0**。Lead完整读取本轮三份公开UTF-8日志；本角色只依据Lead已确认结果追加，不声称自己重跑或读取这些未给路径的日志。READY在 **77ms** 验证，scanner计数 **bytes=128 / noise=64 / candidate=1**；此次没有SET、没有key、没有自动重试。这是一次无秘密READY探针通过，**不是密钥写入或绑定成功**。
- **noise来源尚未证实**。本次scanner能处理噪声的结果不得回填为346/366旧失败的确定根因，不改旧失败结论或当时进行中句。
- **job pwsh-382已collect，exit0**：本次finally恢复后的生产app完整读回 **3134496字节**，SHA256 **`6F69FF1311C2624D017FB1C5D5A56EB09E4B6F71E16D20B8D02A3077B4472465`**。这是380之后的本次完整后置证据，不以353/369前轮读回替代。
- **job pwsh-383前台后置持久一致性核验PASS**：partition table / NVS / otadata前后逐字节一致，otadata **VALID / seq=1 / state=2 / CRC正确 / ota0**。本角色未读取private原始数据、公开路径或操作设备。
- 此次仅确认无秘密READY探针及所列生产恢复/持久一致性；**未执行安全provision/物理绑定，不能升级为实体ACTIVE24/ACK25、双板peer、ENV、手机页面visibility或OTA断电回滚验收**。新设备boot与手机连接若另有采集，须独立补证，不把前轮窗口当本次结果。

## 不能由绿host测试证明的M2边界

自研PCB/NFC、实体按键、真实双方BLE/RSSI与抵御relay能力、AMOLED常显3D/换装、真实I2S麦克风与语音模型、环境四类混淆矩阵、续航/温升/采样占空比、OTA断电回滚、公司AI套餐授权/真实外部服务、现场D14/D28、举报处置与未成年保护运营闭环仍须独立证据。provider或UNKNOWN安全路径不是环境模型完成；算法候选配置不是产品定案。
