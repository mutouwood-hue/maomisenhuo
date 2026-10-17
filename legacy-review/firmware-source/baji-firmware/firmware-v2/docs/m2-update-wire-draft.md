# M2 OTA wire v1 草案（待Lead正式冻结、未接生产）

## 传输与身份

不改20B GATT封包和512B对象上限。入站20/21/22为session16+counterLE4+body+HMAC32，沿用`BAJI-SYNC-v1`域及现设备MAC/kind签名规范。后端只为绑定账号的有效session和已配置签名release生成对象；不能给手机任意原始数据签名。断连、session到期、低电立即abort；不跨session续传，新BEGIN从0擦写inactive槽。同release的旧分片也不能越过新session计数器验证。

## 20 BEGIN（十进制kind）

| offset | 字段 | 长度 |
|---|---|---|
|0|schema=1|1|
|1|packageKind 1=firmware、2=assets|1|
|2|target：ASCII `baji-s3-175c-v1`补1个0|16|
|18|versionLE：非零递增release整数|4|
|22|sizeLE|4|
|26|artifact SHA256|32|
|58|releaseId：SHA256前16B，必须完全匹配|16|
|74|DER签名长度LE，8..80|2|
|76|ECDSA签名DER|8..80|

body76+signature≤156，signed object≤208。ECDSA secp256r1/P256、SHA256，严格ASN.1 DER；签名msg=`BAJI-UPDATE-v1`ASCII无NUL+body前74B。可信PEM通过发布配置外置，不由手机/manifest携带；缺key失败关闭。releaseId稳定可离线预签，不是手机随机UUID；签名不需要在线发布私钥。公钥验证需明确曲线P256。此包签名不是ESP SecureBoot/eFuse制造配置，不宣称硬件防回退完成。

version须大于每类型已确认版本floor。RECEIVING仅同session且相同完整manifest重BEGIN幂等，不擦写/不重置received；不同manifest拒绝busy。VERIFIED状态允许新的更高版本或另一类型BEGIN；同已VERIFIED manifest重BEGIN只能查询已完成状态，不触发重写。firmware待重启健康确认期间禁止其他firmwareBEGIN，避免覆盖待确认槽。

## 21 CHUNK

body=releaseId16+offsetLE4+data1..440，maxbody460，signed object512。必须当前session active release相同，offset==received才写。offset<received仅全部落在已写区域且flash逐字节相同允许幂等；部分重叠/越界/空数据/错误ID拒绝。不允许blind覆盖。写错误abort。只写inactive app/assets，不能写当前running app和active asset。

## 22 FINISH

body=releaseId16。received必须等于signed size，再从flash算全镜像SHA256对比。firmware `esp_ota_end`校验ESP32-S3应用镜像后才能选择boot槽；不自动重启。重复相同FINISH在VERIFIED且同session返回既有成功，不再次改boot选择。

assets是固定7MiB SPIFFS镜像，非tar；挂载`format_if_mount_failed=false`。镜像中的固定资源manifest必须包含支持firmware版本范围[min,max]、必需固定文件及各文件hash。激活前验证当前实际运行firmware版本落在范围内，所有路径严格固定allowlist、禁止`..`和绝对路径。SHA256覆盖整个镜像及manifest，因此compat已受签名保护。先校验实际资源并完成LVGL资源读/缓存切换，再持久切换槽；失败保旧槽与embedded fallback，不宣称仅分区已完成热换。

## 23 STATUS（只读，40B）

|offset|字段|长度|
|---|---|---|
|0|schema1|1|
|1|state：0IDLE、1RECEIVING、2VERIFIED、3FAILED|1|
|2|kind：0无、1firmware、2assets|1|
|3|reason枚举|1|
|4|releaseId16|16|
|20|receivedLE4|4|
|24|expectedSizeLE4|4|
|28|versionLE4|4|
|32|firmwareFloorLE4|4|
|36|assetFloorLE4|4|

reason：0NONE；1INVALID_MANIFEST；2UNTRUSTED_SIGNATURE；3TARGET_OR_VERSION；4BUSY；5ID_OR_OFFSET；6FLASH_IO；7CONTENT_HASH；8IMAGE_INVALID；9ASSET_INCOMPATIBLE；10STORAGE_FAILURE；11SESSION_ENDED；12LOW_POWER。

IDLE：kind/reason/releaseId/received/size/version全0。已配置floor始终有效，无已确认asset为0。RECEIVING/VERIFIED的ID、kind、size、version来自已验manifest；FAILED若BEGIN验证前失败，ID/kind/size/version/received全0，仅reason有效；若传输后失败保留已验manifest信息和最后安全received供诊断，但不存在可续传active handle。断连清session绑定/active，status可保留FAILED reason11供新连接读取，不能据此恢复。状态对象冻结沿用现read分页快照。

ACK沿用OP_COMMIT status：0accepted、1invalid、3temporary/storage/state、4auth/version。badoffset不推进received。业务完成需STATUS VERIFIED而非只收finish ACK。status reason是细化原因，不替换传输校验。

## 持久floor与回滚

固件BEGIN/FINISH只记录pending release和目标slot，不推进confirmed floor。新槽启动完成显示、必需资源、任务与存储健康检查后，先可靠写confirmed floor（读回核验），然后mark-valid；若NVS写失败不mark-valid并rollback。掉电发生在写floor后mark-valid前时，旧槽恢复运行仍允许原pending同version重试（只允许本地pending hash/slot一致的恢复例外，不能接受任意同version包）；floor永不降低。未达成此状态机不能称回滚完成。

资产资源/compat校验成功后持久提交active slot+asset floor为同一NVS blob，写失败不切换显示或旧slot指针。重启读取该blob并再次校验有效资源；异常回旧槽/embedded但不降低floor。已确认版本不能被上传旧版覆盖。

## 实施与证据边界

kind20/21/22/23尚待Lead正式冻结。纯C policy已有host适配器安全测试，但签名/flash mocks不证明真实OTA或掉电安全。生产需要外置可信key、双8MiB app槽、双7MiB assets、实际签名/hash/挂载/render接入及设备验证。缺配置返回失败关闭。手机须下载真实制品并验SHA256，上传后端签名对象；不得仅状态页替代uploader。
