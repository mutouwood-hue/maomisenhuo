# 038 最终实际证据独审

## 有限通过结论

038 本轮实际证据支持：保留当前存档的 application 更新、独立应用扇区读回及全区摘要保护、正常启动与可选 mask pool 启用、真实手机校时和 away→原召回→home 映射、运行 LVGL 合成图、手机既有数据保全、显式断连与 USB 释放。**不支持真实触屏滑动、物理照料、用户人眼或无撕裂验收通过。** 用户已答“暂时不方便看”，这些项目继续待验。未发现本轮新的 Confirmed P1/P2 阻断。

Root 设备目录：`artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T0802Z-visual038`；手机目录：`artifacts/device-integration/2026-10-16-firmware038-phone`。本审查只有离线读取与独审文件写入，没有设备、串口、ADB、上传或候选源码操作。

## 应用和存档保护

- 最终 APP6402112B，SHA `fcdd98ee3fdee872abd64737f83f4d3f1077ff0f991a3f55322ed5d5e173625b`；独立物理 sector 读回6406144B，APP前缀精确、尾4032B全FF。
- fresh128KiB、before prefix、恢复最终 selector 后 activation prefix 三者逐字相等。临时清除 selector copy1 的文件仅该4096B为FF，原副本保留并恢复。NVS只做哈希/字节比较，未解析其内容。
- 32MiB备份为 fresh128KiB物理前缀加先前验证不变区组成；写前和写后分别四完整范围 verify，exit0且各4条digest matched。**不是新物理读取整个32MiB。** 新app覆盖的sector之外，OTA1尾、OTA0和assets保持原值。未把准备时PLAN.notExecuted当执行状态；EXECUTION-STATUS明确它由本轮RESULT取代。
- 初审47个completed-file pins与最终记录全部仍精确相同，未修改这些证据。

## 正常启动与计数

正常USB会话 `08:17:20.815122Z` 至 `08:30:22.191435Z`，781.371秒、命令1..21连续、一个实际reset marker；版本0.3.8与OTA1启动记录符合。raw `.bin` 与 `.txt` **原始字节**完全一致，3179395B。一次原预期startup CFDIAG parser error保留；选定ESP `E (...)` 行0。只作此会话选定日志结论，不声称一切错误为零。

实际启动日志一次 `optional12 enabled`，20592B PSRAM mask pool，原legacy4保留。最终PERF双9320B且两buffer DMA capable，DMAfree71875/largest31744/min35808、PSRAMfree8234824。5次真实capture都跨过原64KiB guard，末free高于guard6339B。其余时刻/瞬时峰值不能单靠末计数保证。

STATE读数按时间分列，均ACK9/pending0/nextEvent10：

| 命令 | revision/seq | scene/action | clock |
|---|---|---|---|
| 1冷启 | 33/42 | away/idle（持久旧值） | false / offset0 |
| 11真实手机连接后 | 34/43 | away/idle | true / +480 |
| 14原“叫它回家”后 | 36/45 | home/idle | true / +480 |
| 19后续读数 | 37/46 | home/idle | true / +480 |
| 20最终 | 41/50 | home/idle | true / +480 |

只把真实原召回动作、手机UI和相应设备读数作为本轮映射证据；后续revision/seq增长未逐包建立触发因果，不据此猜具体自动更新来源，也未证明精密对时。

## 运行画面与待机窗口

生产decoder严格解码CAP4/6/8/12/15，五个RGB565及PNG逐字重建精确：冷中性face0/1/2，真实连接away face0 AOD，真实原召回home face0 AOD。CRC依次 `19907d94/a96ea3f3/62508592/39866514/fe1291d8`，以actual-evidence中实际decoder记录为准。独审已亲看：冷中性“需手机校时/上次状态”，校时away草地16:18，召回home窗边16:19，提示可读。这是**设备运行中的LVGL对象树合成**，不是光学面板照片；本轮没有校时face1/2真实抓屏、真实sleep构图或触摸检验。

PERF17→18原同epoch窗口重新计算：132.873119秒、532render、render总2409409μs、平均4528.964285714285μs；1064flush、3081640pixels、pressed0。DMA71883→71875（-8B），largest/minimum/PSRAM不变。末PERF21的pressed也为0。窗口没有夹杂记录的显式CLI/UI操作，但手机前台连接，自动BLE snapshot未排除；不能称radio quiescent/noBLE命令，不能称逐字heap稳定或充分泄漏长测，不能与037不同face/背景/连接状态作严格A/B百分比，不能换算真实swipe FPS/tearfree。

## 手机数据与释放

当前026/code17未安装新APK。Native authority前后body哈希自行重算有效；93→109，仅 `cat-cflocal2-journal-v1` 变化，其它4项entry字节完全相同。原ledger9条为8applied+1quarantined，pendingnull；金币24、活跃猫XP67，feed2/pet11/sleep3不变。journal各设备pending均null。本轮没有新增真实care/奖励、没有把隔离条目误称奖励成功。这里是before/after端点保全，不外推所有中间时刻或跨进程冷却/掉电持久能力。

Root记录一次原“叫它回家”，实际显式断连；释放XML显示“新本地吧唧尚未连接”，随后有HOME按键动作。**本轮没有单独launcher/foreground或GATT unregister日志**，因此不声称独审看到了unregister或独立桌面前台读回。USB于08:30:22Z会话关闭；08:31:24.646916Z lsof记录exit1且stdout/stderr空，证明该时点没有列出的opener，非持续监控。

私人Drive两张原PNG的已有回读元数据：6939B草地、6824B窗边；返回ID、原目录parent、sharedfalse且权限仅owner均匹配。独审仅检查本地保留的metadata与PNG尺寸，没有新联网或上传；不能把LVGL合成冒充物理照片。

## 保留问题与审查夹具校正

既有纵滑dirty/full残留218/50、035旧两处8像素边缘差、legacy4极端OOM、双方好友持久证明、Android掉电/跨重启冷却均未在本轮解决。此前软件release仅限受控设备验证，不提升为全产品验收。

初次独审断言曾因Python `read_text()`把4971个CR换行正规化，误把raw/text比较为不同；改为比较原始bytes后完全相等。另一断言初假定旧文案严格等于“尚未连接”，实际是“新本地吧唧尚未连接”，修正精确文本后通过。都是独审夹具假设修正，不是APP/设备故障；原始证据未改。

证据：`actual-evidence.json`（116文件pins，含board81+phone35）、`actual-decision.json`、`check_actual_evidence.py`及初审contact sheet。Root可另写FINAL-REVIEW-STATUS；不回写所pin的RESULT/raw。
