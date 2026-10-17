# 035 实际设备证据独立复核

## 限定结论

**保留数据、实际035启动、4份LVGL逻辑合成、静态同epoch引擎窗口及随后真实手机校时/STATE记录，在本轮保留证据范围内通过。视觉不可判全部通过。** 已亲看校时后face2，时间与“轻点唤醒”重叠仍是明确开放缺陷；035相较034的8像素partial边缘残留也未关闭。

本审查只读取 `artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T0355Z-perf035`，没有连接USB、ADB、设备或重跑任何设备命令。证据重算：`python3 tests/firmware035-review/check_actual_evidence.py`；机器记录 `actual-evidence.json`。

## 包、备份与写后边界

- 本地冻结035 APP与实际保留的app-sector-readback前6396432B逐字相同，SHA `b5f06e3140b13162fa0baa4bed68bc5cf1ae4312b8fcced644ce44d8c2b9918f`。回读共6397952B，剩余1520B扇区尾为FF。
- fresh physical prefix为128KiB，含当时NVS/selector。32MiB备份由它及此前已物理读取/验证的其余区间组成；本审查重新拼接并匹配保存摘要。**不是此次重新物理读取全部32MiB。** 随后的saved current-protected-verify对四个完整范围均digest matched、进程exit0；写后protected-verify也四范围matched。
- selector copy1临时清除范围严格限于0x13000..0x14000；激活前最后128KiB物理回读精确fresh prefix，包括NVS/boot/table/selector。未解析NVS中的私钥或存档。
- expected OTA1的应用扇区前缀精确实际回读，扇区以外尾部精确保留原OTA1。独立脚本初版错误假设整个槽尾都应FF，实际352个非FF尾字节是原样保留；改为检查真实写入范围及未写尾部后通过。这是审查夹具假设纠正，不是设备写入失败。
- 以上是保存的设备回读文件和工具日志的离线复核，不是本审查再次执行flash verify。

## 正常会话与校时

`normal-boot.json`记录一次官方hard_reset，881.327秒会话、24条连续诊断编号1..24。保留console中只有1个reset marker，035版本与预期0x820000槽启动可观察；选定ESP E级日志0。启动边界有1条原始CFDIAG invalid-command错误，保留且未隐去。会话结束有finish记录；本审查没有现场探测串口占用。

初始STATE为clockfalse，rev27/seq36/ack9/pending0。随后手机025真实连接校时，末次command23（04:18:52.829854Z）为：clocktrue、utcOffsetMinutes480、rev31、seq40、ack9、pending0、nextEvent10、scene2/idle。手机026的04:18:13.331Z BLE读取也得到rev31/seq40/ack9/pending0/away；clock字段来自USB，BLE本身未提供，不能混合来源宣称BLE已读到时钟。

这证明有限时间点的时钟有效标记与偏移，不证明精密对时、跨重启RTC或物理事件发生时间。

## 引擎静态窗口重算

command19→20的sinceUs均为434875356：

| 项 | 原始counter差值 |
|---|---:|
| nowUs | 101285775，即101.285775秒 |
| rendered | 406 |
| flushCount | 812 |
| pixelsSubmitted | 3468864 |
| render累计时间 | 1971841us |
| meanRenderUs | 4856.7512315 |
| pixels/render | 8544 |
| inputPolls / pressedPolls | 3039 / 0 |

前后dmaFree72291、largest31744、minimum32732、PSRAM8255424均相同；两块9320B、double=true且各DMA-capable=true。实际记录编号19、20之间没有其他诊断命令；手机真实BLE选择连接发生在后续04:16:29，而非该窗口。

这是face2静置、无physical touch的有限引擎窗口。AOD mode未单独telemetry，不按原40s规则推断成独立观测事实。render统计定义仍为原LVGL事件区间，含其中嵌套flush等待，不是纯CPU绘制或光学帧间隔；不能拿406/101s当物理FPS，也不能将4.856ms称触摸延迟。与034非匹配状态严格A/B，不据此给加速倍率。

## Capture及视觉开放项

command4/6/8/14均从原始日志重新严格解码，offset/长度/ID/CRC通过；434312B RGB565及生成PNG与原文件逐字相同：

| 图 | CRC32 | 含义 |
|---|---|---|
| cold-face0 | e8fda3f7 | 冷启动逻辑合成 |
| cold-face1 | 5a72f13e | 冷启动逻辑合成 |
| cold-face2 | f15c3e02 | 冷启动逻辑合成 |
| calibrated-face2 | 5ce64a8e | 已校时逻辑合成 |

**已亲看calibrated-face2原PNG，唤醒文字覆盖12:07时间上部，属于未关闭的AOD布局可读性问题。** 其余capture本轮只做严格解码/字节关联，不外推所有元素视觉验收。此类图来自真实运行设备的LVGL object-tree composition，metadata明确physicalScanout=false；不是光学屏幕照片，不能证明扫出、无撕裂或物理滑动。

没有本地触摸、care/gift产生或新奖励；pending0/ack9是已有队列水位，不能当新照料完成。035的旧8像素partial残留仍open。036/037后续候选未混入此次035证据。
