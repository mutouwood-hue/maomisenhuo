# 真实数据接入验收记录（2026-10-14）

## 结论与范围

依据官方 Notion PRD v1.9 开发版完成此前三端数据底座接入及主机集成验证。**不是线上部署或真机验收报告**；没有刷机、密钥注入或外部模型真实调用。

**最新范围变更**：用户已确认需要后台/锁屏行程定位，Android原生后台权限、location前台服务与本机持久队列正在改造；本表原有前台测试不证明新的后台行为通过，必须追加独立测试与真机锁屏采集验收。

- 后台：Node 24 + SQLite WAL 持久化；账号/Bearer、完整原作存档 CAS、分项授权与清除墓碑、七天摘要 TTL、埋点批次幂等、设备归属及签名、五照料原子结算、AI代理与场景缓存。
- 手机：保留只读原作 HTML；真实前台定位与本机聚类、Android原生累计计步差值；未知值显示为空，不生成日程/步数；API/CAS/outbox、BLE 分页签名中继、逐条文字发送授权及原作积木场景接线。
- 固件：实际 `BAJI_V2=ON` 入口；真实PMIC有效值、QMI8658加速度mg、照料输入、200事件NVS FIFO、uint64事件ID、challenge物理确认及signed grant/TIME/PET/LIFE/ACK。

## Lead亲自运行的验证

|验证层|结果|证明与限制|
|---|---|---|
|后台 + 手机 + 跨端 Node 联合回归|65项执行通过、0失败；其中1项后台fixture导入导致重复执行，64个独立test|真实模块与HTTP/SQLite；模型响应和无线依赖仍mock，不是硬件证明|
|后台原生队列导入专项|初始5/5通过；扩展至9项后当前7通过、2失败，正在修复|实际BackgroundLocation与LifeProvider + 明确mockNative：本地persist先于ACK、persist失败保留队列、ACK失败重试不重复visit、跨await账号改变拒旧回调、无session/撤权停采与旧checkbox不自启；已通过同visitID重载恢复与>5分钟缺口不桥接；失败项为mock隔断及隔断持久化后WebView重载，不能标后台验收通过；不是Android服务/锁屏GPS实测|
|后台定位云端隐私边界专项|1/1通过（新增后integration共11个）|真实HTTP拒绝伪后台consent布尔与顶层/嵌套原始coords/samples，拒绝内容不落库；合法摘要接受、撤回禁止重传。不是原生service或锁屏GPS实测|
|独立跨端 integration|此前10/10通过|独立HMAC/CRC向量、实际20B手机ObjectTransport、真实HTTP云存档/照料/ACK、隐私TTL与撤回、跨主人旧事件终态拒奖励/不泄旧save|
|真实原作HTML + SQLite HTTP浏览器|已亲自复跑通过；最终页面截图另见手机交付目录|注册、完整原作save入库、云改名import+重载、授权、无demo空态、埋点、逐条文字同意、无key OFFLINE、双独立15分钟测试stay→真实后端证据→recipe→原积木渲染。历史定位样本是明确TEST注入，不是真机|
|固件数据核心|1605 checks通过|Windows BCrypt真实HMAC及FIFO/counter/回放/跨日/空LIFE|
|实际NVS适配器主机测试|62 checks通过|直接包含生产save实现，模拟set失败及commit不确定结果，锁存关闭、重启恢复ID不复用；不等于实际flash掉电|
|整机固件构建|ESP-IDF5.5.5完整编译链接通过|最终NVS锁存补丁已重编译，无flash|

队友报告并提供脚本的其他通过项：原C core5296、transport1340、runtime24场景987断言；Android Java编译及lint退出0。Lead读取lint XML：**0 Error，31 Warning**，主要旧依赖/版本与API属性，不声称零警告。生产对象/font缺字检查通过。

### 最终固件

- 路径：`D:\orangecat-build\orange_cat_pet.bin`
- 大小：2939168 bytes（0x2cd920），8MiB应用分区余65%。
- SHA256：`BE531DC85C35EE96B459B9A29E308E3F1929550A2957AF0C80F70A7A3B703BC5`
- ASCII源镜像由Lead构建脚本维护，未操作真实串口。

## 收尾安全修复

1. 云save fingerprint保留HTTP在途游戏操作；CAS冲突保留备份。
2. 设备返回save持久import→signedACK→页面重载；GATT完成不是业务ACK。
3. 七天从最早真实采样保守整日TTL，不是dayEnd+7可能近八天；撤回墓碑覆盖life、scene、幂等摘要缓存；未知walkingSeconds保留null。
4. 换主人：boundAt限制旧事件，新owner独立terminal receipt，不覆盖原ledger、不奖励、不泄旧save；valid MAC旧队头可安全signedACK，badMAC不可ACK。
5. AI限流bucket跨分钟原位更新防active泄漏；响应流实际限64000 bytes；总14秒、最多2次尝试、每模型5并发/100rpm、无排队超限BUSY。
6. 手机scene请求捕获账号/consent revision/generation，每await复核；清除/撤回/登出清Map和render globals；渲染前再次GET确认，缓存校验TTL和授权。原作工坊公司key/model直连入口受adapter保护。
7. Lead截图发现原作闭包遗留假“公司/面馆/咖啡”常去卡，队友修复geo刷新及真实places门槛，最新截图仅实际记录常去地点；基础庭院/公园仍属于游戏基础场景，不是生活证据。
8. 任意NVS set/commit失败锁存禁止同boot继续mutation，防不确定持久结果复用ID；恢复实际blob而不重置损坏流。

## 本地启动与复跑

以下是操作步骤，**本次未部署常驻服务**。使用Node24，先在工作区根目录运行：

```powershell
$env:BAJI_DB_PATH = 'D:\黑客松\backend\data\baji.sqlite'
$env:BAJI_INVITE_CODE = '<自行设置非空试养邀请码>'
$env:BAJI_PORT = '8787'
node backend/src/main.mjs
```

实际手机不要填PC的127.0.0.1；需可达的后台域名、TLS和严格允许来源。只有确定局域网开发边界时才配置BAJI_HOST/放行防火墙，公网前置TLS、认证限流、数据库备份与恢复方案。

手机打开“云与设备”设置真实backend地址，注册/登录；显式选择本地存档迁移或拉云端。开启所需分项授权，保持前台采集；撤回或一键清除立即停止本机采集并清缓存。Android原生传感器不可用时保持未知，不用Web模拟计步补上。

```powershell
node --test backend/tests/*.test.mjs mobile-pet/tests/*.test.mjs tests/integration/*.test.mjs
# 在mobile-pet目录：
node scripts/build.mjs
node scripts/companion-real-http-smoke.mjs
# 在根目录：
.\firmware-v2\tools\test-data.ps1
```

### 上线/真机前必须完成

- 以外部安全渠道向每台NVS `baji_v2/device_key`写入独立随机32B，并与后台 `BAJI_DEVICE_KEYS_JSON` Base64映射一致；当前没有USB制造provision工具，没有默认key。未配置key私有同步失败关闭。不要用公开TEST向量key。
- 后台可选 `STEP_API_KEY`、`STEP_API_BASE_URL`、`STEP_CHAT_MODEL`、`STEP_SCENE_MODEL`只放服务器。无key始终OFFLINE；未测真实公司套餐性能/90%首轮配方通过率。
- 真机测Android权限拒绝/切后台/重启跨日步数、定位停留；BLE首次未校时配对、断连恢复、离线照料后重启补传、ACK掉电恢复、换主人旧队头、清除生活环；PMIC/IMU真实精度和LCD布局。
- SQLite是当前持久化技术，不是MySQL/分布式数据库合规部署；每模型限流及IP登录限流为单进程。
- 尚未完成：已确认的Q8后台定位（本次正在改造）、Q12正式版BYOK、麦克风/ASR、完整六品种与服饰素材、Fate/社交M2、没有证据的生活行动点奖励公式。不得把这些标为完成或编造奖励。

## 对照入口

- [三端HTTP/BLE契约](<real-data-contract.md>)
- [固件集成与provision边界](<../firmware-v2/docs/real-data-integration.md>)
- [真实原页面HTTP报告](<../mobile-pet/deliverables/companion-real-http-report.json>)
- [最新真实常去地点场景截图](<../mobile-pet/deliverables/companion-real-scene.png>)
