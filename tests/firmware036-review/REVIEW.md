# 036 私有可选mask池独立审查

## 结论与精确候选

**放行Root唯一集成者做受控设备验证。** 限于当时新鲜备份、真实当前分区和既有保护范围校验通过后的application image验证。本轮私有mask池增量未确认P1/P2阻断；这不是滑动、无撕裂、全视觉或完整PRD验收。

- APP：6397888B，SHA256 `a34cfaafc09d8af59ddda076906b17eac1543d0f6b454bff70048d90a0c51ff7`。
- ELF：SHA256 `532a99e5ef1de5d2ad3334110408222b845b832fa649d1ab82001d6a861778fc`。
- ZIP：2700569B、107源、134总entry（含支持/测试文件），SHA256 `3e8ce0b488a068f8c32603ff263ac8f6d06a0bd001bc1cb9f2b9c2877e19ac34`。
- `FROZEN`关联manifest/source-hashes精确；APP内描述版本为0.3.6-local3，secureVersion0，嵌入ELF SHA与上述ELF精确相同。未推测或执行OTA地址。

机器结论：`decision.json`；包/编译关联：`frozen-verification.json`。

## 本轮独立执行

| 检查 | 实际结果 | 限制 |
|---|---|---|
| 107源、全ZIP entry、APP/ELF、035的103源 | 全部相符，前后保持冻结 | 只读包核对 |
| 原私有mask单元/生命周期/fallback | 22记录：19成功、3原4槽预期SIGABRT | 不能把3预期失败称为已修复OOM |
| 原/池/分配失败的正反半径栅格 | 470组hash精确 | 实际私有C，host分配能力替身 |
| 4线程栅格/cleanup | 2000次精确 | pthread替换原mutex调用点，非FreeRTOS |
| 新独立所有权用例 | 3例、79断言，ASAN/UBSAN通过 | 真实模块，host端口替身 |
| 全中间帧对照 | 11运行各1204帧，logical tick/数量/SHA逐项精确035 | 生产pages/scene与mask重编，host flush为内存复制 |
| 真实target flags强化编译 | 私有TU `-Wall -Wextra -Werror` exit0 | 单TU复编到自己目录；未重复全target build |

全帧序列SHA256：`e30741247bded2feee7b512988f2933412970c71910c609972271a3b9b138b8b`。

复现命令（均在项目根；只写本review目录，无清理步骤）：

```text
python3 tests/firmware036-review/verify_frozen.py
python3 tests/firmware036-review/rerun_unit.py
python3 tests/firmware036-review/run_independent.py
python3 tests/firmware036-review/rerun_frames.py
```

`unit-evidence/mask-unit-tests.json`、`independent-lifecycle.json`、`frame-evidence/all-render-frame-comparison.json`保留结果与原始日志/完整帧hash。复跑的owner测试只改输出/临时目录，未重写冻结evidence或owner工具。

## 源码与所有权核查

### 发布与预算

`source/private/lvgl_mask_pool/catforest_mask_pool.inc:119–140`：单块20592B，16对齐，显式SPIRAM|8BIT。分配前free至少2MiB+20592且largest至少20592；分配后核对alignment/external/allocated-size及free至少2MiB。全部检查成功后才写ready block，任意拒绝释放整块并不发布descriptor缓冲；未每帧重试。此2MiB是申请时前后校验，不是对后续整个App永久锁定内存的承诺。

独立复跑预算恰等/差1B、无支持、free不足、largest不足、NULL、错对齐、错cap、短size及分配后不足分支；全部走原4，无半启用。目标ESP分支无host宏。

### 持有者、释放与越界并存

- `inc:76–91` 仅逐个地址相等判断池descriptor，不对无关指针排序；引用汇总同时覆盖12池、旧4槽及原生临时descriptor。
- `inc:93–109` cleanup仅清未引用条目；活跃池片段不能释放；整pool至无池引用才释放。
- `lv_draw_sw_mask.c:132–158` 池slice不进`lv_free`，旧temporary沿原分配/释放路径并计数；free后清param.circle，重复free不重复递减。pending deinit期间保持mutex可用。
- `lv_draw_sw_mask.c:83–110` 活跃引用使deinit延迟；重复init不重置活跃数据；pending期间停止新池acquire，仍可用原4；后续干净deinit/init收尾。
- `inc:142–161` 半径1..233启用池；12个不同descriptor均被引用时新申请走旧4。半径234/300、合法池mask与超界旧mask能并存。

新增的3个独立用例比原正控再覆盖：

1. 同半径两个param共享descriptor，其他232半径反复构建、cleanup及deinit后旧param实际栅格仍相同；释放一份及重复释放不影响另一份，最后释放才回收。
2. 12池+4旧槽+1原生temporary同时存活，全部合法半径，cleanup/deinit后17份实际栅格不变；先temporary再旧槽再池反向释放，活跃slice不被提前回收。
3. 先释放池、仍保留旧4+temporary时，pending init不重新建池，现存temporary可继续栅格；再申请合法半径仍安全走旧temporary；全部释放后可干净重建。

完整LVGL engine init/deinit仍须遵守上游外部串行生命周期；本轮线程测试只证明模块锁调用点保护scratch/引用及与cleanup并发，不声称整个引擎可与销毁并发。

### 数学与像素

私有AA数值核心文本与固定上游精确相同，SHA `ea95edac75e260e26e74b3ca6fe509a74904e4d66e248456ad85dac28acc2b31`。改动只分派buffer/scratch及所有权，未改AA公式、半径、动画帧或像素格式。470组正反mask及11×1204全部中间渲染帧对照通过，不是只看终帧，也没有在采样间snapshot/强制全重绘。

## 编译、ABI及保护范围

- CMake SHA固定上游mask、private ABI header、global header、refresh cleanup调用源、CLIB allocator及两个私有文件；共享vendor实际hash相符，MIT许可逐字一致。
- 读取真实`build/compile_commands.json`，精确一个mask TU指向私有文件，无CATFOREST_MASK_POOL_HOST_TEST/CF_PRIVATE/CF_THREAD_TEST。与封存命令证据一致；真实target archive恰1个mask成员。
- 另用真实SDK编译参数、只重定位-o/-MF/-MT到review并加-Wall/-Wextra/-Werror，复编成功。11个公共函数符号同035；公共global struct与配置4槽未变。
- 独立nm/size得到私有静态符号347B，全ELF `.dram0.bss` 相比035增加344B；两者不能混为同一数字。
- 所有51个main源逐字035：core/store/BLE/wire/diagnostics/页面/scene/资产/字体/奖励均未变；BSP、sdkconfig/defaults、partition、依赖锁及保护cmake亦相同。实际生成partition-table.bin精确035。两9320内部DMA buffer、40MHz与64KiB CAPTURE guard保持原样。
- 本轮未再跑owner的48FULL/46416字体、diag34、decoder14、immutability59、5轮交错性能及全IDF构建；其冻结证据SHA全部独立核对。不能将这些记录冒称本审查全部重跑。

## 受控设备门槛与未关闭项

Root设备验证先确认真实启动日志明确`optional12 enabled`或具体拒绝原因；若回退原4，不能仅凭启动成功声称池启用。读取实际PSRAM/internal heap/free/largest/min、两buffer大小及DMAcap，并以同face/scene/时钟/连接/功耗模式做PERF差分，排除boot/CAPTURE/VIEW/RESET窗口。当前board的clock/FIFO/原9收据仍须以实际来源分别保留。

**以下保持open：**

- 035相较034的两例各8像素局部边缘残留；036帧精确035意味着继承，并未修复。
- 035校时后AOD face2“轻点唤醒”与时间重叠。main逐字035，036未修，不可称全视觉pass。
- 实际PSRAM延迟、capability、heap余量与同状态收益尚未验。host内存/flush模型不能换算ESP耗时或FPS；没有承诺滑动变快。
- 物理滑动、scanout tearing及光学结果待验；VIEW不是手势，合成capture不是光学扫出。
- 原4槽极端OOM的descriptor、mask buffer、AA scratch断言仍存在；可选池申请失败安全回退不等于修复所有LVGL OOM。

本审查没有设备/串口/ADB/复位/刷写、联网、Git、删除、缓存清理、冻结候选或owner工具写入。
