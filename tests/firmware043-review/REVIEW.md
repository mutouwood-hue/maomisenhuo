# 043 exact 静态房间缓存独立审查

## 决定与产物

**放行 Root 执行限定的 active-OTA1 application-only 更新，以及缓存冷/热单帧技术测量和两组合成图采样。** 本轮无剩余确认 P1/P2。不是成品A、持续FPS、自然动画、物理触摸/滑动/无撕裂或后续全时NVS保证。

|产物|实核摘要|
|---|---|
|APP 7723088B|905552f2f35dc56942b226e9d8558ae98bf31e0e07765ae0c1ba81ab32e88cc2|
|ELF|d7ebe539cba1b18ff6c6cf453b40a00c16304240b23eb391942876cce1f660b3|
|ZIP 2898268B / 158项|eba9862c0b5ce11010992d1067cc2503476b41b840605b4fcfa956f968152df5|
|manifest|8c3194776d0158badb76e39fb4b52c8d31d67d1b4c022cabb33545f6cb87d0e2|

119源码、38支持文件、97证据摘要与所有ZIP内容逐项匹配，260个不同候选文件pin。实际APP descriptor为0.4.3-exactcache / cat_forest_badge / v5.5.5，内嵌ELF SHA与实际ELF精确。相对042保106原源不变：runtime仅版本/CMake、exact C/h、panel，另4缓存输入及1构建verifier；host工具3处变化。core/store/BLE/wire/peer/gesture/font/BSP/config/分区和页面/场景/诊断门未改，没有040/float混入。

## 缓存、所有权与失败语义

缓存header80+RGB565434312+Z16434312+owner8217156=1085860B；实际目标符号落DROM且跨度精确，PCAT205624B另计。缓存承载固定466屏幕/相机/房间props、near35/far180、全局Z量化和源fingerprint。运行时联合核header/版本/尺寸/near/far/三个plane长度/完整payload CRC/FP，完成后才赋三个指针及valid。错误或非DROM缓存回原uncached full算法并明确roomCacheUsed:false；取消/超时直接失败，不借fallback掩盖中断。

actualROI每行恢复到**原有**color/depth/owner后，只绘cat；无额外PSRAM front/renderer/task/stack/DMA。只对props=true提供缓存API；原uncached API仍存在。全局ROI已由原r2边界检查限制0..210，copy全行有界。room先、cat后，保原`z>=depth`相等后绘获胜及透明texel不写Z/owner。cache descriptor仅内部单USB owner持有、输入DROM不变，不是对外不可信指针协议。

042已审的begin卸源/cache→锁外计算→锁内核UI/domain→只读发布链不变；实际LVGL异步barrier四文件与042逐字核同，不能用drawunit1声称同步。中断/失败不得取pixels/stats，下一次完整复制恢复，不显示半缓存。诊断不推进存档/ACK/时间/照料。

## 独立执行证据

- `cache_independent.c`：**实际冻结042 uncached C 对实际043 cached C**，ASAN/UBSAN，210 CHECK，26成功三平面case。含四个无猫corner tile覆盖全部466²静态缓存，以及动态pose/heading/位置和六个显式ROI；RGB/Z/owner/bbox/ROI逐字一致。另公共非法输入拒绝一致。13 header/plane破坏关闭并清空descriptor；故意错row的非法测试descriptor造成1173像素差，确认oracle能发现错映射。不是同cache fulloracle自证。
- `run_worker.py`：实际生产ESP分支panel/exact，用明示主机allocator/USB/clock/stack/DROM替身及host layout431880覆盖，13模式 ASAN/UBSAN通过。含cold/warm三样本、allocation/DMA/model-DROM/external错误，validation/copy/raster取消及deadline后同context恢复；坏payload CRC和非DROM缓存诚实fullfallback。三个CRC/ROI/bbox与r2参考一致，缓存实际tri/tested/inside/written与Root封存数学期望精确。完整JSON均可解析，最长约783B，未到1536B输出cap；不是ESP耗时或真实栈证据。
- 实际build verifier正常通过，独占复制输入的camera/material/header-FP三个负控都拒绝。r1→final仅verifier加header-FP精确检查，去掉这条新assert后源码SHA精确回r1；其余13窗口文件不变。
- 实际helper抽取handle（不导入/执行串口顶层）49正负控通过，包括sample0/1/2 CRC、fallback/DROM/尺寸/上下文/缺字段/坏JSON、PERF guard、重复boot/ready。精确队列cold0→warm0→1→2且每次后PERF，只在cold0和1后CAPTURE，不无限循环。

owner253原042-vs-cache、1540cache、220JS/30dirty、2916ROI、46716cached LVGL/42diag等均核封存摘要，**不冒称由本reviewer全重跑**。host LVGL provider已读确认实际cached API，普通host PCAT/cache文件heap明确不是target DROM/PSRAM证据。

## 构建与预算

实际SDK compile_commands核ESP_PLATFORM及exact -ffp-contract=off，未带host context宏。构建verifier可逆重构整个原042 exact C SHA118e622…；当前源/缓存blob/hash已独立核。新增静态cache Flash1085860B不是旧512KiB增量预算内的小资产，Root已明确授权此新预算。APP 7723088B，8MiB尚余665520B；ceil4KiB扇区7725056B，仍在应用槽内。

ctx仍431296B显式SPIRAM，新增target BSS24B、data/IRAM不变；目标PCAT与cache符号DROM跨度均独立核。`.ext_ram.dummy`地址padding不当作live allocation。目标compute96/report368/raster304等是各函数自己的静态帧，不能替代完整调用链/库/ISR或实际水位。042旧1444B累计任务余量不能直接当043通过；043实际heap/capture/USB栈待Root量测。

cacheValidateUs冷次包含校验/调度，warm重复显式次序可区分；ROI copy计入raster，不伪称单独测了copy耗时。tri/counter是实际省去room后的工作量，与042不同是预期。7轮Mac ratio不是S3结果/FPS；自然动画仍未验。

## Root 执行门

预备security/backup/verify-current记录已核完成，四段全32MiB物理digest在11:45:59.924Z成功。fresh128KiB含实际当前NVS，prefix与selector保原验证；最新组合镜像SHA1a92e6a73134b0aabb76a6f922596ed63a971851eab8ca0eb0625bfa00f96255。它仍是fresh prefix+历史范围经当前物理verify，不是fresh全32MiB读回。未解码NVS。

最终必须绑定：

|执行源|SHA256|
|---|---|
|run_stage.py|cb4f0303e0b87a127101770b7655ba4713388bef008e7cd0082bf8acaeb3afb9|
|esptool_no_write_retry.py|14e37af0c6f38c2f4792e0e80d068517b5826263d7bdb6d2a0fa80880fe9b4e4|
|diagnostic_session.py|f2463790452389c97ec7568b8a5ebc1103dbcc45174a96873f6504c93dda8426|

helper对生产fallback虽合理但本次benchmark会停止：必须valid/published/completeFrame、指定sample CRC、cacheUsed/DROM、1085860cache、431296external ctx、pcatDROM，之后新鲜PERF两9320/DMACap/double/dmaFree>=65536才继续抓屏。严格JSON/断连/重启停自动，无未知命令重放。读回/保护与不自动重试stage保持042；Root CANDIDATE/EXECUTION-PINS与独立worker数学期望已逐项核对。

仅Root写当前已核OTA1应用ceil4KiB扇区，独立APP/FF尾读回及所有保护range/untouched tail验证；不写selector/NVS/boot/其它slot。active-slot更新不保证断电原子性或自动回滚。实际冷/热时间、CRC、cache命中、PSRAM/DMA/stack和两软件composition按发生记录；原COMP/AOD可能卸图，published终态不保证随后capture仍是该图。任何不匹配/未知先停，不为提速降门，不把尚未采到的物理/连续动画/最终A写成通过。
