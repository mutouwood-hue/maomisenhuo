# CFLOCAL2 本地协议候选

本轮实现的独立协议；不复用旧 e7f1 BJ20、7b2e NDJSON 或旧签名私有通道。构建、主机测试、设备安装、固件刷写和真实双吧唧验收各自记录。未刷写前旧设备只有基础控制。

## 服务与帧

- 手机服务 `6f3d2000-8f4d-4b73-9ce5-43464c4f4332`，RX `2001`、TX `2002`（相同后缀）。peer 服务 `2100`，RX `2101`、TX `2102`。
- 手机线格式 UTF-8 NDJSON，最多 2048 字节（包含 LF），拒绝 NUL、非法 UTF-8、深层/非对象/重复关键字段、未知 op；有序 WRITE_DEFAULT 碎片最多 20 字节。通知也按20字节顺序拆分；整行重组后才解析。
- 每连接 generation 隔离、订阅 CCCD 成功后才 HELLO；GATT write 完成不代表持久成功。旧/不完整/不匹配响应均不能就绪。
- 一次只允许一个应用请求在途。基本请求 `{v:2,id,op,data?}`；响应 `{v:2,id,op,ok:true,data:{...}}` 或 `{v:2,id,op,ok:false,error:{code,outcome:'no_change'|'unknown'}}`。id 为 ASCII 1..64。
- `hello` 返回 protocol=`CFLOCAL2`、deviceId=32hex、capabilities、maxLine=2048、clientId/null、lastSeq。`state` 读取实际快照/队列；`events` 只读取 FIFO 头，不删除。

## 持久命令

`snapshot`、`ack` 增加 `clientId`（UUID）、`seq`（JS safe integer，1起步）。手机在首次发送前先持久保存 clientId、seq、完整 command。设备单 owner，seq 仅接受 last+1；同 seq/id/SHA256 原始 UTF-8 对象字节（不含 LF，含固定 key 顺序/空白）一致返回原结果，异内容冲突，低 seq 拒绝；异常不消耗 seq。未知结果只重发完全相同命令；不得跳序覆盖。所有变更先 NVS 单 blob commit 再响应。commit 不确定则锁写直到重载，不自动擦存储。

`snapshot.data` 为 interface.d.ts 的 SceneSnapshot，线上省略 requestId（由请求 id 承担）；petId 位于 data 顶层。五状态 0..100；coins/revision/epochMs 非负 JS safe integer；name 最多24 UTF-8字节、breed 最多16 ASCII、petId 最多64 ASCII。同 revision 必须同业务内容；场景或动作改变也需手机增加该同步流 revision（由 adapter 持久分配，保留手机原 save revision 来源记录）。不同 petId 拒绝，不擅自换猫。可选 utcOffsetMinutes（-840..840 整数，手机当前时区偏移）与 epochMs 仅用于本次启动校时；重启后历史 epoch 不能直接当当前时间。

`ack.data={counter,eventId,receipt:{status,persisted:true,saveDigest}}`：仅 FIFO 头且设备 id/counter/petId 对应；手机必须先原存档+去重标记持久提交，再确认。失败不删除。已确认 watermark 返回重复成功，未来/跨设备 id 拒绝。设备照料仅排事件，不自行另算手机数值；新快照由手机原规则结算后推回。

## 场景与真实遇见

手机真实状态映射为 home/departing/away/returning，动作 idle/walk/pet/feed/water/bath/play/sleep，天气 clear/rain/snow。天气取原游戏模拟值，不采集真实位置或环境。默认不开麦克风/定位/传感。

真实 peer 默认不可发现，双方显式开启，广播匿名本地 ID/nonce，经真实扫描、完整 nonce 挑战、双方确认，再先持久预约发件/记录收件后 ACK。礼物沿用原 HTML `flower=野花`，数量1；每个匿名 peer 的首次礼物只结算一次，后续匹配不重复铸造首次奖励。RSSI 不是精确距离，临近与本地匿名确认不是云账号认证。收到收据和双方闭环完成是不同状态；断连/未确认不得播放“双方匹配完成”。FIFO/peer/outbox 满时拒绝新事件，不覆盖未确认记录。手机 NPC、BroadcastChannel 和遇见码试玩不能算真实 peer。

## 所有权与验收

协议与 adapter：root 的 `protocol/local-v2/**`、`artifacts/local-ble-adapter/**`；固件仅 `artifacts/firmware-local-v2/**`；手机 UI/Host/构建仅呈现线程的 `artifacts/html-offline-candidate/**`。原始 HTML/旧源码/冻结候选/原 Flash 不改。新代码不自动刷写。真实双吧唧若缺第二只，主机夹具通过仍不能标记实物验收。
