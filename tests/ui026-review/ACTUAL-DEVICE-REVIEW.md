# UI026 实际设备证据独立复核

## 限定结论

**本轮保留数据安装、冷启动、原存档保留、真实显式CFLOCAL2连接/场景及只读诊断记录有限通过。** 026原RAM冷却与在途写门禁的软件独审结论不变；本轮没有真实硬件三口喂食或新care/gift，不能将其记为实际冷却/奖励验收通过。

只读证据目录：`artifacts/device-integration/2026-10-16-ui026`。重算命令：`python3 tests/ui026-review/check_actual_evidence.py`。结果/证据摘要：`actual-evidence.json`。本审查无ADB/USB、安装、触摸或源修改。

## 安装与保存重算

- 冻结0.2.6/code17本地APK SHA重新计算为`a780c0e48b9c2ac2c149e761171a6eb6e9098aee84507be5f6409a9527144ab8`，与保存的installedAPK设备回读结果及install.json一致。没有在本审查中重新pull安装APK或调用ADB。
- 保存的install命令为-r/-t，exit0/Success，无clear/grant。两个tar各79个普通文件；**安装阶段精确核对的是约定12映射文件，不把它扩写成79文件或所有时刻都不变。** 12个文件逐字相同，其SHA也匹配安装记录。
- tar中的Native authority包装body SHA都重新核验；安装前与安装后未启动时Native完整相同。继续真实连接后最终authority由87→89，仅journal entry字节变化；game/social/identity/ledger/commit marker字节保持相同。journal各device pending均null。
- ledger仍9条，**8applied +1quarantined**，不是9条全成功奖励；ledger pending为空。原游戏24币、XP67、feed2/pet11/sleep3原样；社交deviceReceipts9条。本轮没有清空、重发或新增结算证据。
- 该字节相等仅对应留存前后截点，不外推整个运行期间live stats完全静止。

## 真实连接与读取

actions/XML链记录打开吧唧→原生选择新本地模式→显式扫描→选择实际CatForest-Local2→握手/场景→显式诊断刷新。`ble-read-complete.xml`的实际读取时间为**2026-10-16T04:18:13.331Z**：generation2，seq40，rev31，ack9，pending0，away/idle/clear，属于本次连接（非实时）。

已亲看`ble-read-complete.png`，可见本次读取说明、UTC和generation；seq/rev/FIFO等更下方字段来自完整accessibility XML，不能说它们全在这张截图内可见。BLE页面明确“未提供clockValid/now”，所以clocktrue/offset480只引用独立035的USB command23。

`room-after.png`已亲看，保留原生活日程外出覆盖和底部工作pill，并显示24币；本轮没有执行原召回闭环，也没有藉026图推025完整away→home验收。此次技术away投影与原覆盖层一致，不能由此宣称所有日程/天气/动作分支全通过。

## 保留的异常与日志

- `host-transient-check-note.json`保留一次主机过严格预期synced、实际coordinator checking而退出的检查，以及之后一次无匹配tap查询的guard退出。不能抹掉这次中断，也不能把checking短暂态直接判为App失败。后续actions记录成功打开详情及真实刷新，形成独立后续证据；没有借前次失败制造确认成功。
- 冷启动观测选定主PID14353的408行保留日志重新计数：43次Shader compilation failed、43次Pipeline create failed、11次Invalid resource ID；选定FATAL EXCEPTION/Uncaught/TypeError/ReferenceError为0。**不能称零图形错误/所有渲染稳定。** 此处仅为选定日志窗口，不用不同版本/不同窗口的错误次数直接归因新回归，也没有有效FPS结论。
- 035 AOD时钟重叠是独立固件开放问题，不因手机026通过而关闭；原工作pill文案未在026修改。

## 释放与待验

留存记录为显式断连04:18:44、×关闭、04:18:51 Home；活动记录topResumed为QuickstepLauncher，保存物理WM1200×2670/density520；蓝牙日志有GATT unregister12:18:44及12:18:45.277 GATT_CH_CLOSE/locally initiated disconnect。只确认留存证据，本审查未现场探测当前设备。

真实三口喂食、FIFO等待跨原冷却边界、实际Native掉电/断电持久性、新礼物及双方completion、物理手势、时钟精度、图形性能均未新增验收。pending0是空队列，不是新动作完成。此前22项原生产软件夹具证据应继续与本轮真实连接记录分别陈述。
