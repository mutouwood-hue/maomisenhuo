# 042 r1 独立源码窗口审查（非最终产物放行）

## 当前结论

12源窗口 SHA `4b3d403f100b0b3af66917e342b8ca66d4aee3eee5d04385b06457a96208612c` 下未发现新的确定 P1/P2。尚无最终 APP/ELF/ZIP/全源封存绑定，因此本文件不授权写入。只审显式 USB 一次性技术样本，不是自动3D动画或触摸游戏交付。

## 独立执行

- `run_worker.py`：实际生产 exact+panel C，ASAN/UBSAN，10场景。三个样本、分配失败、超时、USB取消、DMA不足、错误DROM、非PSRAM，以及同context成功→取消→成功。失败后 pixels/stats 不可取；分配只一次。三个样本和恢复后样本的131072B、ROI/bbox/三角/计数/CRC与冻结r2参考完全一致。allocator、时钟、栈、USB为明确主机替身；431880仅host指针布局覆盖，不推为ESP测量。
- `run_ui_gate.py`：实际 pages/scene + LVGL，约29新增门断言；整体46450 CHECK含共用字体/布局基线。开始/发布正控，same-tick导航往返、模式往返、rev/care/gift/连接/订阅变化、无效结果、实际触摸、显式clear、错误face/AOD拒绝，发布→实际LVGL刷新→clear不发PET。像素源为显式buffer替身，非真实worker/线程射频联测。首次缺host hook链接失败保留，补的是独占测试fixture而非产品。
- `check_execution_scripts.py`：只AST抽取真实 `handle`，18终态/进度/失败/重启/ready边界，通过。没有import/执行串口顶层；外层transportloss停止路径另静态核对。

## 所有权与异步边界

新renderer只有一个SPIRAM context，内含RGB/Z/owner；PCAT205624B另在Flash。现有6144B诊断task复用，不新task/stack/frontbuffer/scene。六scene各增加32B目标payload=192B，另BSS448B（不含allocator/cache峰）。目标context431296B，实际当前DMA余量仍必须上板复核；主机替身5120B水位不能当真实栈余量。

开始在BSP锁下卸旧src+cache，锁外计算，锁下重新核UI epoch/domain并发布只读源。不能以drawunit=1推同步：本配置仍有SW draw线程。已读实际私有adapter1664..1666整段timer_handler锁，LVGL `lv_refr.c` draw_buf_flush等待draw_task_head；`lv_snapshot.c`及独立overlay capture也等待各layer任务清空，capture调用者全程同BSP锁。这样旧源读取先结束、再卸图复用；DMA读取的是drawbuf副本。可变RGB565未压缩descriptor走直接源，不新增131072B frontbuffer。此为源码论证，不是实际并发故障注入。

发布门检查连接/订阅布尔、revision/care/gift/pet及UI epoch；不声称真实BLE generation全链路证明。采样是技术pose，不能冒称当下猫动作。所有后续物理滑动/光学、target耗时/栈、capture及DMA余量仍待控窗证据。

## 目标构建及保护初核

实际compile_commands中exact TU有 ESP_PLATFORM、-ffp-contract=off、-fstack-usage，无host context宏。目标 `.su` pose1216、geometry624、panelcompute80、report320等是各函数静态帧，不能简单最大值当全链/库调用栈证明。SDK单位为bytes；Xtensa StackType_t为uint8，旧乘法不是已发生四倍高报。

core/store/wire/BLE/peer/gesture/capture/BSP/sdkconfig/partition及关键adapter/LVGL均与038逐字一致，记录 `target-and-protected-preseal.json`。最终全源/字体/资产和APP pin另核。

## Root 执行源门

最新仅静态/离线核对：stage `163f45ba26e7edae535036c45675136ab43c9af54444081fcbb3d84fb9957910`；禁重试wrapper `14e37af0c6f38c2f4792e0e80d068517b5826263d7bdb6d2a0fa80880fe9b4e4`；诊断助手 `1bc656367c4d3084fe39e8af3958f2f241f0b3373b423bb0c08fc5edbf7df187`。

初始esptool隐含整图/块重试问题已修并独立注入实际loader方法关闭；未改共享工具。最新stage每次核USB serial，写前核独审decision+executionArtifacts，绑定app与保护快照。助手BEGIN仅进度，JSON终态严格三个True+exact-int匹配sample；坏/缺/失败/断连/重复boot停自动，不补发未知命令，最多一次被动reopen。上板终态必须valid/published/completeFrame和本次sample均通过，才可继续抓屏。

activeOTA1 app-only流程条件已写REVIEW-GATES；无selector/NVS写。组合备份必须描述fresh128KiB+历史已知字节经全32MiB当前物理verify，非fresh全读；不承诺断电原子性/自动rollback。此流程评价不替代最终产品release。
