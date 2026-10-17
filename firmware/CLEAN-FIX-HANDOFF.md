# 053 清洁入口修复交接（仅源码，版本暂不改）

## 本轮边界与输入

- 只修改本目录 `source` 内源码及本说明，不修改 phone、根共享契约、显示驱动/BSP/adapter、分区、版本或冻结包。
- 已读 `README.md`、`UI-COVERAGE.md`、现有 UI 交接、上层 `badge/HANDOFF.md` / `badge/PROTOCOL.md` 和根 `protocol/2026-10-17-local-care-scenes.md`。较旧 README/UI-COVERAGE 的 v1/四页说明不代表053当前实现，以实际源码和本说明为准。
- 已加载 architecture-design-spec，适用其模块边界/契约先行原则；固件 C/LVGL 非 React/Vue、非 REST、非数据库迁移，未套用不适用栈技能。
- 未执行构建、技术测试、预览、性能实验、git、设备操作、刷写或清档。只进行源码阅读与静态交叉核对；不能据此称编译/真机/视觉验收通过。

## 实际改动文件

1. `main/badge_pages.c`：照料页增加真实可见“清洁”皂图标入口；保留喂食、喝水、逗猫、睡觉及主屏摸摸。五入口坐标与实际触摸目标一致；清洁进入既有动作页，轻点皂三次后调用原持久排队路径，可下滑取消，只有排队提交成功才显示已记录待手机确认。
2. `main/badge_ui_targets.h`：新增 HIT_BATH 与实际目标注册保持一致。
3. `main/local2_core.h`：仅增加非持久化的同 owner 清洁能力字段、当前投递会话标记、视图 bath_allowed 和最小能力接口；不改 l2_saved_t 或磁盘编码。
4. `main/local2_core.c`：care 白名单加入既有 L2_ACTION_BATH；在领域层检查同 owner 清洁授权，不能仅绕过 UI 入队；l2_confirm_bath 校验既有 owner/快照，l2_load 清除 RAM 授权。
5. `main/local2_wire.h`：内部处理接口增加 session 参数，新增 BLE 会话失效标记接口。
6. `main/local2_wire.c`：HELLO 广告 care_bath_v1；新增非 journal care_capabilities 确认命令；未确认会话遇 FIFO 头 bath 返回明确 blocked，不投递未知 care action。
7. `main/local2_ble.c`：复用 generation，在连接、断连、订阅变更、host reset 时更新原子会话标记；领域任务传入原帧 token。没有新增任务、计时器或显示机制。
8. `CLEAN-FIX-HANDOFF.md`：本中文交接。

## 与主代理确认后的精确契约

维持 CFLOCAL2 v2、既有 UUID、2048-byte NDJSON、单 mutation journal。新增能力与确认不占 seq、不写 NVS、不重新绑定、不修改快照/金币/成长。主代理负责手机端及共享契约同步。

HELLO `data.capabilities` 增加 `care_bath_v1`。固件字符串仍为 `0.5.3-day-startup`；其余版本不变。

手机完成 HELLO 身份核验、原 pending journal 恢复及必要首次/最新快照后，在 events 前串行发送：

```json
{"v":2,"id":"<requestId>","op":"care_capabilities","clientId":"<existing owner UUID>","data":{"careBathV1":true}}
```

不允许此命令携带 seq 或额外字段。需要 has_owner + has_snapshot；尚未建立时 not_ready，owner 不匹配时 owner_conflict，字段/值非法时 invalid。成功回复：

```json
{"v":2,"id":"<requestId>","op":"care_capabilities","ok":true,"data":{"careBathV1":true,"confirmed":true,"deviceId":"<32 lowercase hex>","clientId":"<existing owner UUID>"}}
```

当前会话未确认且 FIFO 头是 bath 时，events 成功返回但明确暂不投递：

```json
{"v":2,"id":"<requestId>","op":"events","ok":true,"data":{"event":null,"blocked":{"reason":"care_bath_confirmation_required","eventId":"<deviceId>:<counter>","counter":1,"action":"bath"}}}
```

blocked 是传输能力门禁，不是 receipt 终态，也不是队列为空。设备不跳 FIFO 头、不删除、不改 ID、不伪造 rejected/unsupported。新手机重新确认后获得原事件并使用原 receipt/ACK 路径；旧手机不会收到未知 bath care 事件。旧手机仍不能结算既有 bath：该头及后续事件会保留，需兼容手机恢复，而非冒称旧手机也能清洁或无损跳过。

HELLO 重新开始投递协商，因此心跳必须用 state，不能连续用 HELLO 清确认。断连、退订/重订、host reset、新连接都需要重新确认投递。state 心跳不会清确认。手机必须遵守单 command flight，并验证确认响应 deviceId/clientId/confirmed。

## 离线与重启：两层 RAM 能力

- 已核验 owner 的入队授权 `bath_allowed_owner` 在同次开机跨断连保留，每次使用仍比对持久 owner。握手后断网/断蓝牙可以离线新增 bath，原 FIFO 和 eventId 持久保存。
- 当前连接投递确认 `bath_confirmed_session` 必须匹配 BLE 原子 active_session 和原帧 generation；旧会话确认不能用于新连接投递。
- 重启/加载后只恢复原有 FIFO/身份/终态，不恢复 RAM 授权；未再连兼容手机前不新增 bath，已有 bath 保持原 ID 排队。未新增独立 NVS 元数据，不改变 schema3。
- UI始终可见“清洁”；未授权灰化图标并显示“清洁需兼容手机确认”，点击给相同明确提示；授权后显示“清洁可离线·重启再确认”。这是一项明确有限离线承诺，不是永久离线可清洁。

## 静态核对关键结论

- L2_ACTION_BATH 原本已占用枚举位置、快照 action 白名单、事件编码、场景和皂图标；本轮不调整枚举编号、存档编码或 schema。仍读取 schema2/3、写 schema3。
- 新 bath 沿原 l2_emit_care 路径：work=saved；counter=next_event++ 与事件追加在同一 work；commit 单个 NVS blob 后才更新 saved/care_change/成功提示。200事件满返回 queue_full，绝不覆盖旧事件。
- 设备没有新增扣币、成长、clean 数值加成或快照修改；显示数值仍来自手机权威快照。动作动画不等于手机结算成功。
- ACK 原实现未更改：终态 applied/rejected/quarantined、duplicate.originalStatus、reason/saveDigest 校验、原 request hash/seq、终态与 FIFO 头删除/lastAck 同 blob 提交均保留。receipt-less dequeue 仍禁止。
- owner/client/pet、deviceId、FIFO 顺序及 next_event 语义不变。新能力确认只读核验既有身份，重复确认不消费 seq。
- BLE 回调不拿 domain mutex、不写 NVS；领域 core 字段在既有 mutex 下更新与读取。主代理静态复核发现“检查 active_session 后再发布授权”存在 TOCTOU，已修复：wire 独立短 session_guard 同时互斥 BLE reset 和 `active_session==原帧token` 检查 + l2_confirm_bath 的有界 RAM 校验/发布。重置先发生则拒绝确认，不遗留新离线授权；确认先原子发布再断连则合法保留同次开机离线能力。短锁内不运行 JSON/NVS/radio/UI；BLE guard→session_guard、domain mutex→session_guard，无 session_guard→BLE/domain 的反向取锁。失效响应仍沿原 generation 核验丢弃，但不再依赖仅丢回复来防授权竞态。
- 五入口中心及半径：feed(90,306,30)、water(160,340,30)、play(306,340,30)、sleep(376,306,30)、bath(233,352,30)；可见圆按钮60×60，与 hit registry 相同。清洁三次轻点与其它已有照料共享成功持久化路径，不额外发摸摸。

## 本轮追加：连接与主机上下文（源码复核及普通构建尝试）

此节覆盖上文“未执行构建”的旧轮次说明；本轮用户允许普通编译，仍禁止设备/技术实验/循环业务运行/安装刷写/清档。未改phone、共享PROTOCOL、原冻结源、BSP/显示驱动、分区或版本。

- 已复核候选 local2_ble.c 没有45秒应用闲置断连；真实GAP断连仍invalidate并advertise，身份/NVS/FIFO/receipt保留。现有service_tick只是原BLE发送服务，不新增手机心跳依赖。
- HELLO已有mobile_context_v1；同owner care_capabilities的可选mobileContextV1:true沿既有无seq确认，成功响应明确mobileContextV1:true。不确认不发host_context。单pending、10秒超时释放但不踢连接、60秒低频；重复cap/HELLO后重新cap不能重置同GAP会话节流。
- 本轮精确源码修改：local2_wire.h增加纯RAM expires_mono_ms；local2_wire.c按epoch-captured扣除120秒TTL，防收到119秒旧位置后又可用120秒；计数达到JS_MAX停止发新请求不重用ID；reset清deadline；context接受及有界RAM校时同session_guard原子发布，阻止GAP reset先发生后的旧会话校时；HELLO重置协商在token检查短锁内发布，保留节流时间。未动saved/encode/decode/费用/快照结算。
- 清洁入口与domain gate/FIFO blocked/receipt路径只静态复核，未新增设备业务实验；圆屏布局、触摸、锁屏保持、真实广告恢复、离线重连去重依旧待人工实机验收。
- 普通Windows配置尝试：既有ESP-IDF5.5.5、Xtensa GCC14.2.0、CMake3.30.2、Ninja1.12.1。原失败configure后增加一次trace证据，再窄试候选FindZLIB，两次均exit3221226505（0xC0000409），未生成可用CMakeCache/build.ninja，未进入完整固件编译/链接，未生成新bin/elf。不能声称编译通过。
- configure-trace.log、configure-trace-console.log、configure-portable.log在badge目录；trace仅定位到libpng配置附近，未确定崩溃根因。候选cmake/portable/FindZLIB.cmake没有解决，CMakeLists.txt的MODULE_PATH接线已回退；文件保留并标为未启用诊断附件。不得把它作为已验证portable修复。
- 主代理接手最终源码验证/普通编译；本子代理停止再运行configure。所有已知构建job均完成，job_list无后台任务（恢复后旧job_output返回unknown id；日志为持久证据）。

手机需接入上述确认/blocked/重连顺序，并保留权威游戏清洁费用、幂等 receipt 与成长逻辑；设备不得代结算。根契约及 phone 契约由主代理维护。本次没有授权运行构建或验收：编译、中文字形/圆屏布局、触摸手感、断连后离线清洁、重启保留队列且需再确认、旧手机门禁、新手机按原 ID 解堵、队列满及终态拒绝均尚须后续明确授权/人工验收。没有修改或替换准确053冻结产物，也未升级版本。
