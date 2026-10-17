# 042 最终独立审查

## 决定

**放行 Root 进行限定的 active-OTA1 application-only 更新与一次性板上技术验证。** 不放行持续3D游戏、美术完成、性能/物理触摸/无撕裂结论；无剩余确认 P1/P2 阻断本次受控窗口。

- APP：6635696B，SHA `b0d1704032c1067455b4355617924dadc63efa20a4ec245189e75d75b99f8bcc`
- ELF：`1a7408b2b225b8ef1e513156925bd5ca940fbf1fffe4a8e39411502d44bb8ac4`
- ZIP：2733922B / 144项，SHA `5f24cdf1bf7bba7acd8d641b92f1c5f485aa829417e843bfedc8aaf6e6e0224d`
- manifest：`384b90a1581654f09334de67abf2f9816871435bb001faca57af9d5a62300f45`

独立重算114源码、29支持文件、269 evidence pins及全部ZIP entry内容，418个不同候选文件摘要匹配。APP实际descriptor为`0.4.2-exact3d / cat_forest_badge / v5.5.5`，内嵌ELF SHA与实际ELF一致；不只相信manifest声明。源相对038：97项原样，7项runtime修改、5项新增runtime（含PCAT）、3项host修改/2项host新增。核心/存储/协议/peer/手势/字体/驱动/两9320/64KiB守卫未改，无040/schema3/float混入。

## 证据与独立覆盖

`SOURCE-WINDOW-R1-REVIEW.md`说明所有权/GUI异步barrier、目标编译和测试限制。独立实际C worker 10场景 ASAN/UBSAN通过，三样本及取消后恢复与r2参考全131072B/ROI/bbox/计数/CRC精确。平台allocator/USB/时钟/栈为替身；不能将其当target数值。实际pages/scene+LVGL独立29新增CHECK通过，总46450含共用基线，零模拟PET；不是FreeRTOS并发压力测试。保留首次测试fixture缺hook链接失败记录。

最终12源窗口相对r1仅diagnostics.c的BEGIN字符串，反向替换该字符串后SHA精确回到r1，其他11项全同；因此继承对应独立worker/UI证据，非重新声称已跑全量。该文本明确15s只是raster checkpoint合作时限，load/pose/geometry不可抢占，未知超时不补发。owner新diag42和其它220/30/2916/4745等证据已封存核hash，不冒称均由独立reviewer重跑。

实际SDK compile_commands核ESP_PLATFORM、exact TU -ffp-contract=off/-fstack-usage，无host size替身宏。PCAT符号3c525378..3c5576b0为205624B DROM输入；目标context431296B显式SPIRAM，非每scene实例，无新task/stack/frontbuffer。APP比038 +233584B，低于512KiB；BSS+448、6scene payload+192，合640B不含allocator/cache/峰。上板前DMA67823仅余2287，不能以此预算宣称运行余量已经通过。

异步安全依据是实际adapter整段lv_timer_handler持同一recursive BSP锁、refresh/snapshot各layer等待draw_task_head完成；SW drawunit=1仍有异步线程。begin锁内卸源/cache后解锁计算、锁内按UI epoch/domain重新验收，已发布context只读，capture同USB task且同锁。此源码论证有边界：未来任何绕开该锁/源生命周期的writer或draw路径都需重审。

## 执行源与备份条件

仅 Root 操作设备。最终执行摘要：

|文件|SHA256|
|---|---|
|run_stage.py|163f45ba26e7edae535036c45675136ab43c9af54444081fcbb3d84fb9957910|
|esptool_no_write_retry.py|14e37af0c6f38c2f4792e0e80d068517b5826263d7bdb6d2a0fa80880fe9b4e4|
|diagnostic_session.py|7a32f845ea04d97bff56390702bac8a5bb73cdc7518666e865485f9849c9a5a2|

R42-PROC-01 初始esptool隐式重发已关闭：实际loader两种block方法注入无I/O失败，旧各3次→新各1次；整图尝试2→1另静态核，未真实重连/写入测试。旧报告/旧helper1bc证据保留，不冒充新7a32版本。

新助手抽取真实handle，33正负控通过；每RENDER后严格先PERF后CAPTURE。PERF要求dmaFree整数>=65536、两9320、double及DMAcapable；缺失/坏JSON/不足即停自动。RENDER必须valid/published/completeFrame三个true和exact-int匹配sample；BEGIN只是进度。重启/断连/未知结果停止自动，最多一次被动reopen，没有自动补发。

当前fresh128KiB selector已独立CRC/IDF选槽：copy1 seq2有效，OTA1 offset0x820000。Root此前security/backup/current全32MiB物理verify成功记录已读。备份是fresh prefix+历史已知不变范围经当前物理digest验证，**不是fresh全32MiB读回**。必须将本decision及上述执行源SHA写入gate，核当前设备/分区/安全态一致，应用仅ceil4KiB扇区更新，独立读回APP和扇区FF尾、所有保护区及untouched tail；不写selector/NVS/boot/其它槽。active-slot更新无断电原子性或自动rollback承诺，任何未知写结果立即停，保留038完整应用/ROM恢复资料。

## 板上待验门

1. 版本、clock/FIFO/原ACK9与next10按真实读数记录，任何新序号不猜触发来源。
2. 两9320、原mask pool/64KiB门、实际DMA/free/largest/min、PSRAM和USB栈最低剩余字节；主机5120水位是替身，不能引用为板上实测。
3. 仅awake HOME/face0/idle/无modal允许技术采样。每样本等待严格终态；未发布/失败/超时停止自动，不声称显示成功。目标CRC与独立golden比较，若不同保留差异，不悄切float或降标准。
4. 发布后新鲜PERF足够才抓屏，保留真正CRC和实际耗时（含yield/调度）。LVGL composition不是光学照片，capture暂停不是FPS。
5. 明确撤图/CLEAR/AOD/输入仍回原I8；当前显式单帧不等于持续3D或实际care动作完成。没有物理触摸、流畅性、光学无撕裂或成品A的通过结论。
