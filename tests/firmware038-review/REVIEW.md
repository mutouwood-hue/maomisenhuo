# 038 独立审查：限受控 application 验证放行

## 结论

最终 `0.3.8-local3` 软件候选可交 Root 在当前新鲜备份、分区/保护区校验后，仅对 application 槽位进行受控设备验证。**不是实际滑动、无撕裂、物理喂食或完整视觉验收通过。** 本轮没有执行设备、Git、删除、联网或候选修改。

最终源 pages `dd7e6efefa63e79b3639bb0d886eeb5976e892d031b53e82a0bd1fd4e726bc45`；scene `2c5723e423803fba96ae8982ad955125a34bd03717db776272747e152036fbc8`。独审快照 `source-r3/` 与正式包逐字匹配。初版 ee81 存在的三项显示来源 P2 已由 r2 修复；最终候选没有确认的新 P1/P2 阻断。

## 冻结与保护边界

- APP：6402112B，`fcdd98ee3fdee872abd64737f83f4d3f1077ff0f991a3f55322ed5d5e173625b`。
- ELF：`ad048342a5013792e5fff34b861acb79a8d66c8e9c0db2548e63b1b0dbd4c202`；APP 内嵌 ELF 哈希精确一致，版本、project、IDF v5.5.5 符合。
- 源 ZIP：2706890B，`b2106f4f4cf032b3162d23527ba245ff2e0c67dbf7a8f83b6fd642724f47e7d3`，144 个 ZIP 项中 107 个列明源文件均回读精确。
- 107 源文件实际哈希重算；仅 CMake 版本、pages、scene、scene header、host preview 五项不同于 037。其余 102 项包含 core/store/wire/BLE/peer/gesture/fonts/原资产/private mask/BSP/sdkconfig/partition 均精确一致。共享 vendor 未在本轮修改。
- 实际 SDK compile_commands 私有 mask TU 唯一，ESP_PLATFORM/Werror 存在，Host 测试宏不存在；与封存的实际命令一致。独审未重跑 SDK 构建。manifest 全部 15 项软件证据哈希逐项匹配。
- 独立 ELF32 section 读取确认 DRAM BSS +8B、data +0，APP +3984B。目标 sizeof scene 136→140、六实例 +24B 与两个 12B callback 是 owner 目标编译证据，不伪装独审设备测量。

复现包核对：`python3 tests/firmware038-review/verify_frozen.py`。

## 独立生产代码复验

### 来源信任回归

实际旧 ee81 生产 pages 的三条负控均复现错误 SLEEP：离线 new revision 回播远程动作；离线 new revision 覆盖本地已保存 PET；在线远程覆盖不清本地来源位，随后断连保留远程动作。旧日志、原始 RGB565 和旧源快照保留。

相同驱动针对 r2 实际生产源码重新编译执行，三例分别得到 IDLE / 本地 PET / IDLE，live 均 false，来源位与 emit 计数符合预期，12 个字段断言通过。r3 pages 与 r2 逐字相同，scene 仅床沿几何差异；r3 独立 trust/sleep 案例亦运行通过。文件 `trust-r2-assertions.json`、`trust-r2-negative.json`（沿用旧文件名不表示当前失败）。没有新奖励/域存储写入，Native/state/clock 都是明确 host fixture。

### 逻辑时序及重绘

`run_logical_trace.py` 独立编译 r3 和只把 `bounded_face=false` 的同 r3 测试副本，各运行 8 个 case，共 16 个成功进程：横 commit、横 rebound、上下纵滑、64 次同 context refresh、trust、真实生产睡眠 input、睡眠持久失败。

每个 case 新进程、手动 logical tick 10ms。相同坐标路径下，r3/旧 slide 负控的每个 RENDER_READY tick 逐个相等：横 commit 14 帧、rebound 7 帧，纵向各 11 帧。commit 像素 1093584 对 3032792（少约 63.94%）；rebound 640232 对 1343288。上下纵滑两边各 2170236 像素，显示优化没有扩到纵向。这里 held 点有对称显式 snapshot/refr 调用，数字只代表本夹具，不取代 owner 原三轮或实际 SPI/面板 FPS。

Owner 三轮在同一进程不同 logical 时刻，动画帧和 250ms poll 相位可能不同；轮间数值波动不能自动归因 Host wall 调度。独审通过相同逐帧 tick 证据缩窄此不确定性，不声称真实帧时延。

### dirty/full oracle 与既有残留

独立另起进程强制 full redraw，不与性能计数混用：r3 横 commit 全 8 个 held 点及 final、rebound held/final 全部 **0 像素差**；睡眠成功、3 秒后 AOD、wake 三个点也为 0。原竖滑末帧 up 218 / down 50 像素差在冻结 037、同 038 旧 slide 负控、最终 r3 均精确复现，列为**既有 partial 残留**，没有因本轮隐藏或宣称全视觉 pixel exact。原 035 相对 034 两处各 8 像素边缘差也仍开放。

横向根/环/HUD 固定，只有 home/peek 猫 offset；原动画 tick 保留，frame anchor 独立加 offset，commit 才切 face/HUD。短 SLEEP 横向以及纵向仍原整页 fallback。既有 classifier、modal/update_peer/input handler 源边界保持，完整 owner 输入证据不冒称独审重复执行全部断言。

### 像素可见性

最终 r3 已完成的 192-case 矩阵按 SHA 封存。独审亲看三 face home AOD 与三 face sleep awake 共六图 contact sheet。face1/2 AOD 20:34 完整，label 区域各 1001 个高亮实际 ink 像素，bounds [183,383,282,412]；face1/2 床底 375 与时钟区域 382..413 分开。face0 时钟当时被已有短同步通知覆盖，不能用该 ROI 的亮点宣称读到了时间。

这些为生产 LVGL 软件图，非光学屏照。先前未 pin 的 AOD 首次显示疑似几白点，随后同文件明确 SHA 重读完整；不认定产品缺陷，也不猜浏览/绘序原因。像素计数补强 bbox/glyph 门，但不等于 OCR 或全部 192 图独立人眼验收。

### 内存

独审把 owner allocation fixture 原样复制到自身路径，针对冻结 037/r3 实际源码各重新编译执行；这是**独立运行、非独立测试设计**。六 scene、home/rain/rest partial/full capture、双猫 drag 的 requested CLIB live 最大 +61B，draw 峰值相对 phase start 没增加。037 rest capture 与 partial 差 289 像素原样保留；r3 为 0。该统计不含 malloc 元数据、直接 scene calloc/显式池分配，不代表 ESP32 internal/DMA free。新背景仅 existing home root 两个 draw callbacks、零背景对象/bitmap/timer；draw rect 描述仍会产生动态任务，不能因零对象推零瞬时内存。

## 实际设备门槛与未完成项

1. Root 当前新鲜 NVS/prefix/分区及原保护区校验后，受控写 application；不沿用历史地址，不改协议/存档/OTA选择规则。
2. 实际 normal boot：版本精确、可选 12-slot pool 原日志/失败 fallback 如实，2×9320 internal DMA，capture guard 仍 64KiB。DMA free 必须 ≥64KiB 且保留余量；037 基线仅 6423B 余量，不靠 host +61B 推保证。观察 transient/largest/min 与真实 capture 成功。
3. 实际校时/断连/同 revision 重连/新 revision：旧快照中性，本地已持久反应不会被离线 fresh 覆盖；9 旧记录、pending/next/receipt 不重结算。
4. 人工真实触屏：横 commit/回弹、慢拖、取消、modal 中断、纵向旧路径、sleep→AOD→wake；无手触时只能演示明确 synthetic/USB VIEW 或静态构图，不能声称滑动修复。
5. 需用户人眼验真实显示、真实扫屏撕裂/亮度/延迟；静置 engine 平均 4.21ms 与 host flush 像素均不能换算 swipe FPS。这里不批准任何无撕裂、完整动作/好友或真实喂食成功声明。

## 主要证据

`frozen-verification.json`、`elf-budget-verification.json`、`logical-trace-report.json`、`dirty-oracle-report.json`、`memory-independent-report.json`、`r3-critical-ink.json`、`r3-critical-contact.png` 与 `review-evidence.json`。owner 57/state、192/4032、48 layout、46416 字形、11×1204 mask、34/14/56 为已核 pin 的 owner 证据，未冒称全量独立执行。
