# 锁屏连接与清洁照料兼容扩展（修复候选，未验收）

保持CFLOCAL2 v2、UUID、2048字节NDJSON、既有snapshot/ack唯一journal和NVS schema3。此文件描述新候选；不修改038/053冻结契约。

## 清洁
HELLO新增`care_bath_v1`。兼容手机在恢复原pending、确认当前同猫snapshot后，通过串行应用flight发送：
```json
{"v":2,"id":"<requestId>","op":"care_capabilities","clientId":"<原持久owner UUID>","data":{"careBathV1":true}}
```
无seq、不改journal/NVS/owner；设备核对原owner后返回：
```json
{"careBathV1":true,"confirmed":true,"deviceId":"<32hex>","clientId":"<原owner UUID>"}
```
新subscribe/HELLO重置当前会话的投递确认，旧手机未确认时不投递bath：events返回event:null及blocked（care_bath_confirmation_required/eventId/counter/action），保留FIFO头，不跳过不删除不制造终态。

兼容确认后，同次开机RAM记录同owner的bath新增许可；断连仍可离线入原FIFO。设备重启保留原queued bath，但新增许可重新确认后才恢复。不新增NVS元数据、不冒充重启后的无限离线能力。洗澡入口必须可见并明确未确认状态。

手机bath映射原hostDeviceCare('bath')，沿原费用/拦截/成长规则。原权威游戏与终态reason/digest保存后ACK；duplicate沿原终态，余额不足永久拒绝，不后补扣。

## 锁屏
用户已明确取消45秒应用命令闲置断连。BLE控制器连接事件可脉冲唤醒维持链路；真正链路丢失仍走GAP断连。手机不新增持续WakeLock、不依赖周期state命令保持应用租约。常驻通知仍用户可关闭，Activity/UI暂停不主动关闭已启用原连接。

## 主机时间与定位询问
HELLO新增mobile_context_v1；同owner的care_capabilities可选mobileContextV1:true声明手机支持，原bath确认不变。未明确确认时不发送新型device request，防旧手机严格响应解析失败。
设备至多一待处理询问，确认后/每60秒发送host_context请求，超时不踢连接、不反复堆积：
```json
{"v":2,"id":"badge-context-<generation>-<counter>","op":"host_context","request":true,"data":{"time":true,"location":true}}
```
手机Native原单通道回复同id/op的标准ok:true回执，data含epochMs、utcOffsetMinutes、foreground、location。location.status仅available/not_authorized/unavailable/stale；available包含capturedAtMs/accuracyMeters/latitude/longitude，其他不含坐标。仅已有授权且<=120s的新鲜有效last known；无背景位置权限不在后台读位置、不新增权限/主动开启GPS或录音。时间按手机wall clock/当前zone，设备校时沿原范围验证，原始定位仅RAM线索，不自动改游戏场景/NVS。

原JS完整flight begin/end与有界普通回执暂存保留，设备request/Native reply也使用同一完整行互斥，不分配mutation seq、游戏状态或收据。

## Native与前台恢复
用户显式启用且通知授权成功才启动connectedDevice前台服务；已有定位/录音权限不扩展。原Native桥仍唯一GATT所有者；后台不执行游戏结算、不发ACK、不新绑猫。

每个JS请求（含handshake）在首fragment前beginFlight({generation,id})，完整reply及GATT写完成后endFlight。Native可拦截已协商host_context并等待普通flight完整释放，再从原GATT分片回复；不能交错完整行。后台完整普通reply仅有界缓存，回前台交JS恢复。request超时放弃询问，不以闲置为由断连；部分行/实际GATT写超时可安全断开，保留原pending。

回前台先getConnectionState核对connected/evidence.generation；保留连接可重新授权协调器，失效则按保存地址扫描原deviceId并HELLO核验。恢复原pending→新鲜当前snapshot→同generation一次care_capabilities（含mobileContextV1:true且验证响应）→FIFO。通知停止及显式断开禁自动恢复。系统强制停止、任务移除或Activity销毁不承诺后台复活；重开应用恢复原设备，必须再次显式启用锁屏连接。

接口：requestBackgroundPermissions({origin:'explicit_user_action'})、setBackgroundRetention({enabled,generation,address,deviceId,origin})、getConnectionState({})。lifecycle用户停止reason=user_stopped须保留至用户新授权。

定位RAM有效期从capturedAtMs算起：设备按收到时剩余120s TTL过期，不再从收到时延长120s。此次Manifest无ACCESS_BACKGROUND_LOCATION；因此锁屏定位通常unavailable，不能声称后台定位已实现或持续新鲜。时间与询问只是无持久副作用线索，不自动触发游戏场景/奖励。

## 验证边界
仅源码修改与普通编译；禁止技术测试、性能实验、循环运行、清档、重绑或未授权刷写。两个候选成套交付，编译成功不等于锁屏/触摸/离线去重验收。
