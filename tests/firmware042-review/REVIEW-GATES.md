# 042 预审门槛（不是候选放行）

基线：已上板038 + 已独审041/reference-r2 exact C。042在途产物不得继承r2主机或038设备结论。只写独立审查目录，不操作设备/ADB/USB/串口、Git或运行阶段脚本。

## 源与业务边界

- 最终APP/ELF/ZIP/实际SDK编译TU/source manifest绑定同一冻结hash；运行差异仅明确列出的渲染/页面桥接/构建与只读指标。原038 core/store/wire/BLE/peer/分区、设备/pet/owner、FIFO/lastACK/seq、时钟、手势/照料持久规则全部逐字或逐项说明批准的差异，不能混入039/040 schema3。
- PCAT源原始205624B SHA82520ca7…，三动作/姿态/纹理与r2一致。没有原吃饭/睡眠动作就不能假称新增。UI中的feed/pet成功反馈必须仍源于实际本地持久成功，失败/取消/模态覆盖不产care；原fresh/断连/旧rev/3秒短反馈门不退。

## 内存与任务门

- 当前038新鲜读数DMA67823，距65536门槛仅2287B，不沿用旧71875。不能新建普通internal任务栈后猜余量足够。USB诊断现有任务栈6144B可复用的方案仍须证明最坏调用链、libm/softdouble/stdlib+串口嵌套栈；r2约2KiB只是自有链，不含库/调用者，不算完整证据。
- r2 renderer431296目标/431880host包含color131072、Z131072、诊断owner65536；PCAT额外只读Flash输入。若另加131072 front，562368已超过512KiB（若本轮沿用该增量预算）。须列真实所有存活buffer/场景实例/队列/cache/栈总账，不以单struct代替系统增量。只允许实际明确SPIRAM分配、失败关闭；不能把普通calloc或const指针当已落PSRAM/Flash证明。
- 不得6scene各建renderer；只活动实例或明确有界池。分配失败保原I8显示与存储/BLE操作能力，公开fallback状态，不能默默声称3D成功。
- 实机仍要求两9320内部DMA、原12slot pool、64KiB capture guard不变，fresh PERF/heap/栈水位+真CRC抓屏验证。主机预算/target sizeof不能替代当前内部heap证据。

## GUI/缓冲/生命周期门

- exact double光栅不可在LVGL DRAW、tick或BSP锁中整帧计算。短锁卸image并drop decoder/cache→锁外计算→短锁发布，仅在实际UI/domain generation仍有效时成功。必须核真实LVGL单/多draw-unit配置、flush是否仍持有旧PSRAM源引用；不能仅卸descriptor就推断无异步reader。
- 单buffer复用时，已发布源在CPU worker写入前必须从全部有效读者分离；descriptor/data lifetime必须跨绘制完成。旧snapshot、face、mode、导航、拖动、overlay、AOD/OFF、disconnect/failed render等中断后不得迟到发布旧画面，也不得控制原事务/时钟。
- 当前方案CFDIAG RENDER仅显式单次验证，不是自动动画或实际触控互动。指标应记录render duration、锁内耗时/阶段、generation接受/丢弃、成功/fallback；不能用静态一帧宣称流畅游戏。
- 公开成功ROI必须包含最终padded bbox。复用r2 P2原负控、旧新dirty/full/仅新bbox残影负控、解析深度平面与真实prop遮挡；同C fulloracle只证明dirty一致，不能替代独立深度oracle。
- 诊断只可读取/渲染临时呈现，不增加care/ACK/存档/配对/权限操作。长渲染期间USB不可接收命令需明确超时/QUIT语义，主机超时不自动补发。

## 部署流程初审

本轮严格app-only active-slot受控有线更新可采用，不默认切inactive/写selector。最新fresh128KiB必须核实际security/MAC、分区、双selectorCRC与IDF选槽，地址从本次证据确定；当前独立解析copy0 seq1/state2有效、copy1 seq2/stateFFFFFFFF有效，maxseq2→(2-1)%2=OTA1，布局offset0x820000。

备份明确为fresh128KiB+历史已知bytes经全32MiB当前物理verify的组合，不能叫fresh全读。写前再次绑定当前备份/APP/release决定SHA；只写应用ceil4KiB扇区，独立readback/末扇区FF与untouched tail/所有保护range精确，selector/NVS/boot/其它slot绝不写。rollback未启用，不宣称断电安全或自动回滚；失电或不确定结果停下，可能需ROM用038备份恢复。安全态/选槽/保护不符即停。

**R42-PROC-01/P1 已发现，app-write暂阻断**：初版run_stage.py虽标automaticRetry:false，实际esptool4.12 ESPLoader.WRITE_FLASH_ATTEMPTS=2，SerialException可自动重连/跑stub/整图重发；loader.WRITE_BLOCK_ATTEMPTS默认3，flash_block/flash_defl_block在FatalError重发。Root需独占wrapper显式将class整图和模块block尝试均置1，保共享工具库不改；新wrapper/脚本hash再审。security/backup只读阶段不因此成为已写应用。初版源码/hash与本次selector解析已独立保存initial-process-review.json。

## 最终门

目前仅门槛与流程问题，不对042在途hash放行。等待冻结候选后可做必要host/target静态/定向验证；root为唯一设备执行者，必须等明确产物release及上述流程关闭。实机GPU/屏幕/触控/帧时、A美术、物理互动按实际证据分别验收，23点冻结不把未验项写成通过。

### 流程问题修复复核（后续状态）

R42-PROC-01/P1在固定wrapper范围已关闭，042产品仍未放行。Root wrapper SHA `14e37af0c6f38c2f4792e0e80d068517b5826263d7bdb6d2a0fa80880fe9b4e4`，阶段脚本 SHA `e05e210b71f778434a66f172924c09af2e054bcb1696fd9673c8d9ec042be228`。本审查仅以非main方式加载wrapper、创建无port的测试对象，实际ESPLoader两种flash block方法注入写前FatalError，旧各3次调用→新各1次；整图attempts2→1及SerialException最后尝试raise路径另作静态核对，没有模拟真实闪存写或重连。

旧c732脚本仅工具完整读取；试保存时Root已修，所得e05e字节诚实保留为stage-script-postfix-e05e.py，并非旧源码byte snapshot。`initial-process-review.json`给出fresh selector两copy独立CRC/选槽与执行源pins；`retry-wrapper-results.json`是纯主机故障注入证据。最终release仍需绑定固定两执行hash、当次APP与独审决定，不能由流程修复提前放行在途产品。

### LVGL 生命周期论据修正

038虽 `CONFIG_LV_DRAW_SW_DRAW_UNIT_CNT=1`，但 `CONFIG_LV_OS_FREERTOS=y`。实际vendor `lv_draw_sw.c:92` 在LV_USE_OS下仍创建swdraw线程；dispatch走异步分支。因此单drawunit本身不是同步读取/无异步reader证明。应核实际 `lv_refr.c:1381` 等待全部draw_task_head、port对整个timer_handler/refresh持BSP锁以及snapshot结束路径；外部取得同锁后卸descriptor/cache，再锁外复用context，这条完整barrier链才是待审依据。此处为论证修正，尚未确认042产品有race。

Root另发现过stack水位单位表达式，随后已更正：该IDF接口返回bytes，而Xtensa StackType_t实际uint8，旧乘数在本目标为1，不能记成已发生四倍高报。候选已改直接字节时仍按实际SDK类型/运行水位审，不夸大旧风险。
