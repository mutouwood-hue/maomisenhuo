# 手机—吧唧本地接口约定 draft1

此约定供独立手机候选直接接适配器使用。需求基线是修正HTML和用户“无云”说明。**它是手机内部API约定，不是已实施的新固件线协议，也不是设备验收报告。**

可直接引用的交付：`interface.d.ts` 定义端口/状态/结果；`contract.json` 给出状态转换、默认能力、实际就绪条件及持久化顺序。当前仅 legacyControl 有源码证据，新增快照/事件/peer 端口均须缺省不存在，不能 stub 成成功。本轮未运行这些接口，没有新增测试或设备操作。

## A. 第一阶段可直接接的旧控制端口

复用隔离旧源 `src/ble/protocol.js`、`src/ble/client.js`、BleLocalPlugin 的实际传输，避免重写或混接7b2e/NDJSON。使用 e7f1 三UUID、BJ20固定帧、应用ACK。原设备应用镜像中三个UUID均已找到，但页面枚举与扩展仍待旧固件源码核对。

| 内部方法 | 输入/前提 | 完成的定义 | 不能代表 |
|---|---|---|---|
| initialize | 注册监听，不申请权限/扫描/连接 | 生命周期监听安装完成 | 设备在线 |
| requestPermissions | 用户明确点击 | 系统返回真实附近设备权限状态 | 自动同意权限、开始定位 |
| scan | 用户点击，1000..10000ms | 本轮 native_scan 得到的设备列表 | NPC、随机信号或缓存是附近真机 |
| connect | 选择本轮扫描设备 | 先连接/发现/订阅，再HELLO+GET_STATE | 单个native ready回调就是宠物同步完成 |
| readDeviceState | ready_local，只有一个在途请求 | generation/seq/op匹配且GATT写完成、ACK0、10B状态合法 | 此revision等于宠物存档版本 |
| startLocal | 用户明确点击，保留当前generation | opcode3的实际应用ACK；随后读取状态 | 自动完成引导、账号绑定或宠物已同步 |
| setFace | 用户明确选择0/1/2 | opcode5实际ACK后读回状态 | 修改猫数据/发奖 |
| disconnect/dispose | 用户离开连接流程或生命周期结束 | 终止连接、取消在途、停止自动重连 | 擦配对/清宠物/清NVS |

控制操作不需要云地址、账号、accessToken、provision或服务器签名。不能伪造这些字段喂旧云层；应完全不装载云层。

### 实际状态映射

1. 首次进入显示 disconnected；监听安装不启动扫描/权限。
2. native `ready` 仅映射 **handshaking**（传输已订阅）。
3. 只有同一真实generation完成HELLO(version1/caps15/8B)和GET_STATE(10B)，两个请求均满足GATT写完成与同seq/op ACK0，才进入 **ready_local**（本地控制已就绪）。
4. `ready_local` 不能显示“宠物已同步/已绑定账号/好友确认”。`snapshotSync/durableEvents/peerEncounter` 初始均 unavailable。
5. 显示设备传回的 local/tutorial/suspended 等原始状态；暂不把 screen数字硬映射到23屏常量，等旧固件枚举。authenticated标志的具体含义同样待旧源，不能解释成云账号或Bluetooth加密证明。
6. START_LOCAL只有ACK仍不说明进入了哪个页面，需后续真实状态与旧固件分支对应；未知显示“指令已确认，等待设备状态”，不能造引导完成。

扫描发现的address、HELLO MAC、USB基MAC不是已经证明相同的一种标识。先保留各自来源，避免因ESP32多接口MAC差异自动选错设备或错误合并身份。

### 串行与断线约束

- 同一时刻只有一个应用请求；seq范围1..65535，同generation内不回绕；耗尽后结束会话重连。
- 同时等待GATT write completion与相同generation/sequence/originalOpcode的ACK。旧回调/旧连接回包直接丢弃。
- mutation超时结果是 **unknown**，UI保留提示，先读状态，不能自动重发START_LOCAL/SET_FACE。UI requestId只是本机追踪，不是旧固件的持久幂等键。
- 初次/启动不自动连接。原插件可保留原来由用户选中设备产生的有界前台重连lease，权限撤回/用户断开/离开应用后停止。每次重连新generation，只做HELLO+GET_STATE修复状态，不重放变更。
- ready状态下仍可发生离线/权限撤回，立刻退回真实连接状态，清pending，不以缓存继续显示在线。

## B. 数据扩展端口：现在不要接假实现

`LocalSnapshotPort` / `LocalDeviceEventPort` / `LocalRulePort` 是待旧固件核实后实施的本地契约。UI只在适配器明确提供且双方capability已验证时启用；否则显示该功能尚未连接，原本地游戏正常可玩。

不分配新opcode/object kind，不复用旧后台签名对象塞无签名内容，不移除旧验签。旧固件到达后对照现有cap6/对象验证/队列，协商明确版本。

### 手机本地结算顺序

```text
设备持久事件+单调ID
  -> 手机校验device/pet/type与当前关联
  -> 完整本地存档事务：原规则 + eventId去重 + 结果回执
  -> commit成功后发送applied/duplicate；语义拒绝则保留拒绝原因/设备隔离
  -> 设备持久确认后移队列（拒绝则保留隔离）
  -> 手机提交后的快照 -> 设备持久确认 -> 才显示宠物已同步
```

写盘失败Promise失败，**不发终态ACK**，设备继续保留可重传事件；不冒充语义拒绝。重复事件必须返回原持久结果，不再次奖励。先只允许有明确本地规则映射的pet，未来其他行为要增加契约，不能从数值变化猜喂食/出游。

事件sequence是规范十进制UInt64字符串，避免JS Number精度丢失。设备无可信时间则occurredAtMs=null，手机接收时间另存；不把当前时间伪装成设备历史事件时间。旧GET_STATE的16位UI revision与本地pet-save revision分开。

`CommittedPetView` 是设备所需子集；完整家庭存档仍以原HTML为准。不能用当前单猫PetStore覆盖整户猫/毕业/社交数据。跨多localStorage key须补可恢复事务日志，不能多次setItem后就当整体已提交。

## C. 遇见端口：体验来自HTML，真实确认来自实际证据

保持修正HTML `__pgSocial` 的遇见/暗号/九宫格/图鉴入口与原规则。不要装载旧后台表单，也不要将其局部localCollection替代原dex。

- NPC和BroadcastChannel双窗口继续属于明确的原型/NPC流程；它们不能生成 `PeerReceipt`。
- `PGM1`码解析与短hash通过本身也不足以生成 verified peer确认；需按真实场景完成对方交互/双向确认与本地持久记录。这个source字段只是证据分类，不因调用方写了字符串就成为可信证据。
- `PeerReceipt` 包含encounterId/双方ID/nonces/方法/实际输入与对端确认，adapter必须从真实设备或实际二维码交换流程构建。原结算以encounterId在本机只执行一次。
- 不可用、超时、取消、断连都没有完成回执，不调用真人遇见成功结算，不改朋友或发奖。真实对端未确认时显示待对方确认；不能将单侧写盘称双方原子完成。
- 节奏/九宫格的具体硬件输入与peer链路等旧固件能力到达后冻结，当前control连接不自动具备peerEncounter。

## D. 手机候选的接入边界

候选当前可做：按修正HTML复原原玩法；从构建入口去掉companion云装载；保留原本地store/社交；保留所需mobile/native适配；接上A的真实本地控制端口；B/C先保持明确不可用，而非编造结果。

不做：安装/连接设备以验证本草案、刷写、伪造云签名/eligibility、自动迁移或清除旧数据、索取账号/API key，或启用位置/环境/语音/儿童信息采集。只做模拟规划的入口应保留准确标识。原提示音/性格表达不是麦克风采集，不按voice关键词全部删掉。

更多依据：`docs/offline-local-architecture.md`、`legacy-review/cloud-dependency-map.json`、`legacy-review/android-device-protocol-comparison.json`、`legacy-review/original-device-ble-fingerprint.json`。
