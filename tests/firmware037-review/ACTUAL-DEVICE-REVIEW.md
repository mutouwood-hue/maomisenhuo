# 037 实际设备证据独立复核

## 限定结论

**保留数据写入/启动、实际可选PSRAM池启用、有限静置引擎窗口、真实026重新连接校时，以及已校时face2的真实LVGL合成图，在本轮保留证据范围内通过。** face2时间与唤醒提示已分开，phase不回显。此结论不扩为实体屏光学、物理唤醒/滑动、无撕裂、真实喂食或全视觉验收。

只读来源：

- `artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T0435Z-pool037/`
- `artifacts/device-integration/2026-10-16-firmware037-phone/`

复算命令：`python3 tests/firmware037-review/check_actual_evidence.py`。机器摘要与封存hash：`actual-evidence.json`，board70个文件、phone32个文件。最终状态可另置`FINAL-REVIEW-STATUS.json`；脚本排除该后置文件，不改原始记录。未操作设备、ADB、串口、上传、编译长测、Git或删除。

## 写入、最新存档及激活边界

- 冻结037 APP6398128B的SHA为`22392ed66544e517277550cb2facc4a2c8ea865641e8624e47eb73ab5b5cc9e9`；实际应用扇区回读6402048B的前段与APP逐字相同，其余3920B为FF。预期8MiB槽的写入范围精确回读，范围之外精确保留原槽尾，未假定整个槽都被擦除。
- 最新fresh physical128KiB前缀与激活前最后物理回读逐字相同。NVS只做范围SHA/相等比较，未解码私密内容；boot/partition/phy/NVS与selector恢复后的前缀均保持。selector copy1的临时清除仅0x13000..0x14000，恢复payload精确原副本。
- 32MiB备份由fresh前缀及此前已物理读取/验证的其它范围组成，重新拼接与保存摘要精确；不是本次重新物理读取全部32MiB。写前/写后四段覆盖全32MiB的saved esptool verify记录均digest matched、exit0。最新NVS保护结论限定于此次flash和激活前缀，之后真实运行的合法协议持久化另论。
- 本审查重新计算的是留存读回文件及校验日志；没有再执行设备verify或变动分区。

## 真实启动及池启用

正常会话记录417.797秒，15条连续编号诊断，一次预期reset marker。console可观察037版本及预期应用槽启动，选定ESP E级错误0，原始启动边界CFDIAG invalid-command错误1条保留。

实际boot中唯一启用行包含：`optional12 enabled; pool=20592 PSRAM bytes; legacy4 retained`。结合冻结实现的发布门槛，这证明实际ESP运行经过可选池启用分支；不是仅拿host宏或fallback启动代替启用。它仍不证明PSRAM延迟收益、所有负载最低heap或无OOM。

四份原始CAPTURE日志重新严格解码，ID/offset/长度/CRC全部通过，RGB565和PNG与留存文件逐字一致：

| 图 | CRC32 |
|---|---|
| cold-face0 | 916d195b |
| cold-face1 | fc360f83 |
| cold-face2 | 90043091 |
| calibrated-aod-face2 | fd61b203 |

每份434312B，metadata均为`lvgl-object-tree-composition`且`physicalScanout=false`。

## 校时与不同时间的读数

冷启动command1为clockfalse/now0/offset0，rev31/seq40，ACK9/pending0/nextEvent10。手机026实际显式扫描/选择新本地设备后，command10为clocktrue/+480、rev32/seq41。

手机诊断刷新XML（`diagnostics-fresh.xml`）在**04:47:57.394Z、generation5**读得**seq41/rev32/ACK9/pending0**。最后USB command15在稍后04:50:29.967198Z为**seq42/rev33、clocktrue/+480、ACK9/pending0/nextEvent10、away/idle**。这两个快照不同时，不能强说相等或由STATE单独推断seq42的触发来源。

独立夹具初版假设手机快照等于末USB而触发断言，按原XML读数定位并修正了夹具；raw/Root RESULT未改。这不是协议错误或遗失事件。BLE页面明确未提供clockValid/now，校时观察引用USB，不伪称BLE已读出时钟或完成精密对时。

## 静置引擎窗口

command13→14的sinceUs均为302868469，记录中二者之间没有其它诊断命令：

| 计数 | 差值 |
|---|---:|
| nowUs | 98962734（98.962734秒） |
| rendered | 396 |
| flushCount | 792 |
| pixelsSubmitted | 3383424 |
| render累计时间 | 1667377us |
| meanRenderUs | 4210.5479798 |
| pixels/render | 8544 |
| inputPolls / pressedPolls | 2998 / 0 |

前后DMA free71959、largest31744、minimum35700、PSRAM free8234824均不变。双buffer各9320B，DMA-capable均true。手机显式断开/Home的操作记录早于该窗口；没有新的care或物理触摸记录。

这是有限状态的引擎计数差分，render包含嵌套draw/submit/wait，不是纯CPU或光学扫出耗时。未做035严格匹配A/B，037同时改了AOD隐藏内容；不把4.210ms与035数字的差计算为缓存收益，不按396/98.96秒宣称物理FPS。CAPTURE/VIEW/RESET不在此差分窗口，不把合成图停顿算成滑动性能。

## face2实际合成图与待验视觉

**已亲看`calibrated-aod-face2.png`：12:47位于上方，唤醒提示位于下方，两者没有重叠，标题下phase区域不再回显。** 在这一实际运行设备的LVGL合成截点，035旧AOD face2问题已得到对应修复证据。

仍有严格边界：这不是实体屏拍照或物理触摸验收，不能证明亮度、电流、扫出、无撕裂或每次动态刷新均正确。其它两个face的AOD实际硬件画面本轮未覆盖，依旧只有此前软件矩阵；035继承的两例8像素partial边缘差仍open，不能称全视觉pass。

## 手机存档与释放

before/after authority的body SHA重新验证。Native revision89→93，仅`cat-cflocal2-journal-v1`字节变化；game/social/identity/ledger/commit marker保持相同，各journal pending均null。原ledger9条仍为**8applied+1quarantined**，24币/XP67、feed2/pet11/sleep3保持，未新增或重发奖。该相等只对应保存截点，不代表所有live stats在整个运行中静止。

保存actions及断开后的XML显示：实际点“断开连接”后页面为“新本地吧唧尚未连接”、旧读取标为过期，随后关闭面板/Home；`released-home.xml`为launcher，WM仍1200×2670/density520。**gatt-release.txt只有1B换行，无unregister日志，不能声称已观察到底层GATT注销。**

USB normalBoot有finished/closed记录；新增`usb-closed-readonly-observation.json`为04:52:52.915847Z的lsof exit1/stdout/stderr空，证明该时刻未列出占用进程。它不是早先04:50:34关闭后原工具观察的补造原文，本审查也没有执行lsof。

`logcat-after.txt`为全局历史日志，含2条旧UiAutomation FATAL（10-15 23:25、10-16 02:29），并非本次12:47窗口；不套为026崩溃，也不拿它宣称本次主PID零图形/JS错误。

## 剩余范围

真实三口喂食→手机收据→ACK、新care/gift、双机持久completion、掉电持久性、物理唤醒/滑动、光学scanout tearing、实际FPS和精密时钟仍待验。ACK9/pending0/next10是既有水位，不是新动作完成证明。036从未单刷，本轮实际版本为037，不能混称036单独设备验证或整个PRD通过。
