# 034/035 滑动热点主机复核与下一步最小方案

状态：035 已冻结；本轮追加仅在 `tests/firmware035-worker/`。没有 036 源、设备/USB/串口/ADB/Git 写入、删除或公共 vendor 修改。以下测量不是 ESP CPU、QSPI、物理手势、FPS 或无撕裂证明。

## 1. 现有软件路径与物理边界

原生产 `input_event/object_pressing → drag_update → drag_apply → drag_release → lv_anim_path_ease_out → drag_done` 保留。主机以同一 40 组横向拖动/松手坐标、620 ms 逻辑推进/组运行，含原 peek 场景、原动画、反馈及状态轮询；NVS/数据/输入是固定替身，不触发照料事件。

`render-cycles/cycles.json` 使用实际 LV_EVENT_RENDER_START/READY 与软件 flush callback：

| 40 次操作链 | render 周期 | 整屏且恰 47 flush 的周期 | 总 flush | 总像素 |
|---|---:|---:|---:|---:|
| 034 | 600 | 501 | 27,252 | 125,658,136 |
| 035 | 600 | 500 | 27,208 | 125,447,016 |

这是整条带 settle/反馈的窗口，不是纯“手指移动中”样本。035 仍 83.3% 周期整屏绘制，不会靠省略空闲 poll 自动消除大面积移动的绘制/发送。

034 既有真机 68.203 ms 是 render wall time，含提交/部分等待，不能与 flush 嵌套耗时相加，不能当纯 CPU。主机 flush 只是同步 memcpy，未模拟 DMA/QSPI/面板扫出。真实 CPU/总线/scanout 的相对权重仍需后续设备同状态测量；本报告不能唯一归因 SPI。

## 2. 实际主机栈采样

`profile-steady/` 是 `/usr/bin/sample` 对我自己的 Mac 子进程运行 3 秒/1 ms，先等固定 fixture 初始化输出 READY 再采样，无新权限。默认 034 2255 个栈样本，035 2238；O3 部分小函数可能内联，因此叶占比不是完整 inclusive 成本。

035 collapsed leaf：

| 叶函数 | 样本 | 占 2238 |
|---|---:|---:|
| lv_draw_sw_blend_color_to_rgb565 | 360 | 16.09% |
| lv_draw_sw_mask_radius_init | 311 | 13.90% |
| lv_color_16_16_mix | 145 | 6.48% |
| get_prop_core | 121 | 5.41% |
| lv_bin_decoder_get_area | 64 | 2.86% |
| lv_font_get_bitmap_fmt_txt | 44 | 1.97% |
| set_frame | 9 | 0.40% |

先前 `profile/` 过早启动 sample，只有 dyld 启动栈，**不用于热点结论**；文件保留。主机 sample 可能扰动 wall time，因此不拿该 run 比较两版速度。

RGB565 混合仍是主项；圆弧遮罩有可量化的重复 AA 构建。I8 解码确实存在，但当前主机不是首要热点，不能先堆图片/整页缓存。

## 3. I8 / 圆弧缓存确切边界

固定 LVGL 9.5，SDK 与 host：image cache=0、header cache=0、BIN_DECODER_RAM_LOAD=false。I8 经 `lv_bin_decoder_get_area → decode_indexed_line` 按行转 palette，既有 3/4 缩小索引缓冲仅避免重复 resample，不是完整 decoded pixel cache。40 操作链 035：15,121 decoder open、148,122 get_area、134,420 indexed lines、16,701,672 indexed pixels。仅据主机占比，不建议先增加全图 ARGB 缓存。

实际圆弧代码每绘制条带会初始化内/外 circle mask；默认4条 circle cache。计数副本只增加计数，不改变几何：

- 034/035 radius misses **都为203,416**，035 没有优化这个热点。
- 035 radius init 686,247 / hit482,831 / miss203,416。
- 工作半径 2,3,4,9,197,203,209,210,218,223,227 共11种竞争4槽。
- `lv_refr.c:refr_finish` 每次调用 `lv_draw_sw_mask_cleanup`，释放全部 mask buf 并清元数据；当前不是跨帧永久缓存。40操作窗口620次 cleanup（包括没有 render 的 refresh请求），与600 render数不能混淆。

## 4. 主机容量敏感性 / 负控 / 多轮比值

只在 tests 复制 `lv_draw_sw_mask.c`，局部数组4/8/12/16，不修改共享源码或 LVGL 全局 ABI。其他生产路径、几何、样式、字体、帧、timer、输入逻辑相同。

| 槽数 | 40操作 misses | flush / pixels |
|---|---:|---:|
| 4 原行为/负控 | 203,416 | 27,208 / 125,447,016 |
| 8 | 40,339 | 相同 |
| 12 | 5,053 | 相同 |
| 16 | 5,053 | 相同 |

12槽 miss 少 **97.52%**，**不等于整体速度快97.52%**。剩余 miss 来自每轮 refresh 后的 cleanup/重建。16槽无额外命中收益。

`mask-workingset-paired/paired.json`：5轮交错顺序4/12/16、16/12/4、12/4/16、16/4/12、4/16/12；独立程序每轮40操作。每轮全部40个连续“操作结束”RGB565 FNV摘要一致（共15 runs）。不使用 snapshot/强制全绘；不证明所有中间帧像素一致。

| 槽数 | wall us 中位 | 范围us |
|---|---:|---:|
| 4 | 1,402,502 | 1,212,998–1,594,169 |
| 12 | 1,127,116 | 956,573–1,266,550 |
| 16 | 1,111,715 | 988,231–1,282,030 |

逐对12/4比值中位 **0.794489**，16/4 **0.802920**。Mac 有调度/后台负载，样本非正式统计检验；不套用成 ESP 的68ms降幅，不算硬件FPS。此前另一批固定顺序样本波动更大，原始记录全保留。

## 5. 内存真实落点 / 峰值 / 当前DMA余量

`mask-memory/` 对实际 allocation公式计数，而非仅把所有半径总9KiB作为预算。这里的峰值为 mask raw bytes，加临时圆周构建数组；**不含 malloc 元数据、descriptor、其他对象/线程/USB**。

| 槽数 | 同时 resident mask raw 峰B | raw+临时构建峰B | 相对4槽内部globalBSS增量B |
|---|---:|---:|---:|
| 4 | 5292 | 8876 | 0 |
| 8 | 9024 | 12162 | 112 |
| 12 | 9096 | 12240 | 224 |
| 16 | 9096 | 12240 | 336 |

12比4：resident峰+3804B、包含临时构建的峰+3364B（不同峰出现时刻，不能把两个差相加），另有224B globalBSS。8槽没有实质动态内存优势（比12仅少72–78B峰），16无命中收益且BSS更大。

使用**035真实SDK compile flags**编译 `target_memory_probe.c`，`_Static_assert(sizeof(circle_descriptor)==28)`通过；非只按64位Mac sizeof推导。034/035 `lv_global` 在 target map 的内部 `.bss` 地址0x3fcaa524。实际配置 CLIB malloc，`lv_malloc_core→malloc→heap_caps_malloc_default`；ALWAYSINTERNAL=16384，所以 mask 的6*r+6与临时(r+1)*16均优先内部，失败后才尝试默认可用区，**不能宣称已经放在PSRAM**。RESERVE_INTERNAL=32768也不保证任意任务间的可用DMA峰值。

Root既有034历史实际：dmaFree72347–72595，距64KiB capture guard仅6811–7059B；dmaLargest31744；minimum32944（boot累计最小，不是本窗口独立最低）。直接配置12槽的额外峰约3588B加allocator开销不能据此保证安全；其他BLE/USB/布局仍会并发。mask cleanup后动态buf会释放，额外global224B不释放。真实当前heap/clock未知，不能沿用旧值作保证。

两块9320 DMA内存、64KiB capture guard不得更改。

## 6. 分配失败与最小下一步方案（尚未实现/未获生产许可）

**不能只把SDK配置4改12后刷写。** 当前 `circ_calc_aa4` 先free旧buf，再申请 `6*r+6`；随后又申请 `(r+1)*16` 临时cir_x/cir_y。两处都只有LV_ASSERT_MALLOC；临时entry无空槽也会calloc。SDK启用了ASSERT_MALLOC，分配失败会走断言，不会优雅少缓存。仅减少cache槽不消除构建scratch需求；“现场即时计算无需内存”并非现有算法提供的安全退路。现在尚未做真实OOM注入或完成生产fallback，不能称通过。

推荐下一隔离范围优先评估：**保留配置4/公共LVGL ABI，私有受限12条mask工作区，而非全图/全页缓存。** 建议由独立候选只替代固定LVGL9.5的mask实现，不动共享vendor；源与许可证/构建边界需完整独审。

最小可审设计：

1. 固定466屏现有半径上界233（实际工作集最高227），可选一次性PSRAM池：12×(6×233+6)=16,848B mask capacity，加共享 `(233+1)*16=3744B` AA scratch，合 **20,592B+对齐**。8个额外descriptor内部BSS224B。此量是保守容量上界，不是当前9,096B实际resident峰；本次未声称已经实现。
2. 在首个渲染前，显式 `heap_caps_malloc(..., MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT)` 全有或全无；校验地址cap、大小/对齐和PSRAM预算。池不可用/分配失败则完整保留原4槽路径，不先free/重写原条目。不增加内部DMA draw buffer，不降低64KiB guard。配置保持4可避免改LVGL global布局，额外8条放私有模块。
3. 池启用且radius<=233时，mask与scratch全部从已分配容量取，无每次AA malloc；沿用原AA数学和逐字输出。原circle_cache_mutex内串行使用scratch，不能并发复用；render cleanup只清引用/元数据、把池片段归还，不对池内指针调用free；deinit且无引用时一次释放整池。禁用路径应逐字保持原分配/释放行为。
4. 不能把原4槽的极端OOM称已修：fallback仅保证可选优化申请失败不引入额外断言；原生极端OOM仍原有风险。超界radius、初始化中断、deinit/重复init、部分失败必须明确设计与测试，不能中途把pool指针交给旧free路径。没有资源时若需放弃一帧，现有partial flush可能已经提交，不能随意return渲染成功；此类通用“优雅降级”需另审，不在本方案冒充解决。
5. 需要先做 host pool申请失败/预算不足→原4行为完全一致、所有中间render时点hash/字体描边/雨雪/拖动/模态正负控、释放/重建/超界测试；再SDK编译核定BSS/PSRAM cap/所有权与最坏峰。最后才由Root独审决定是否上板做heapmin/largest与同状态动态测量。没有额外权限或领域命令。

为什么选这个路线：缓存工作集已量化为可重复热点；12/16命中相同，优先12；PSRAM小型mask池可避免把额外3–4KiB动压直接加到仅6.8KiB capture余量，同时解决“可选优化池申请失败回到4”的边界。它仍需验证PSRAM读取延迟可能抵消CPU收益，不保证真机更快或无撕裂。若完整安全实现超出最小范围，可先维持034/035基线，把此优化留下一轮，绝不直接调配置代替失败处理。

## 7. 仍开放

035仅降低未变化poll负载；8像素已知局部差异仍随其包披露。物理手指滑动、实际scanout tearing、同状态设备计时/heap、PSRAM优化真实收益都未通过。没有用静态capture关闭用户的一帧帧/撕裂反馈。
