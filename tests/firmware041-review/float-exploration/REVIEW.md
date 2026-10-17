# Float探索封存与指标诚实性独立复核

## 结论

**封存与探索指标可交接；不通过pixel-exact，不放行production/固件集成或设备部署。** 本次限定范围无新增确认P1/P2。reference-r2继续为正确性oracle，既有026/038不受本结论影响。

C `3f68ae07029c239cb0a849649531fe5393e64c8d960fcdab5c95ed66ea70cff9`；manifest `24abd4a119a8859af307b67c4fb2f78c6ad9de565f744d7fa7c559b94c3aa8cb`；41内容pins索引SHA `2bc864efbae83504cd2a86d5bb2b80428e97c02355ba831d53ae5f5ef302e268`；ZIP180904B SHA `24383632907dcc1d3d50237f2f42350576048bd4c7e79999d42a92a57eef3211`，42项=41内容+索引。全部逐字读回；47封存evidence亦全部SHA相符，共92 pins。旧ROI探索明确在pre-roi-fix历史内，没有混为当前参考。r2的20pins仍精确。

运行源除raster函数外逐字同r2；header/geometry/pose/API不变。本次不重跑全220/2916，也不继承其为全部独立执行。

## 7组实际独立抽样

重新分别编译当前float与r2动态库，公开API输出65,536格RGB/depth/owner逐项比较。实际复算结果与封存行完全相符：

|实际输入|RGB差像素|最大RGB565通道阶差|written差|
|---|---:|---|---:|
|paw-h180-04|1|6/14/4|0|
|walk-h45-02|1|4/19/11|+1|
|walk-h180-00|1|2/15/12|-1|
|idle-h90-12|0|0/0/0|-1|
|idle-h0-00|0|0/0/0|0|
|world mat-04|1|5/10/2|0|
|world bowl-00|0|0/0/0|0|

这些样本coverage/owner差均0、覆盖内深度差<=1。实际三组模型色差分别复核了全量声明的红6/绿19/蓝12边界；明显不能称单LSB误差。idle-h90-12证明最终RGB相同仍可能不满足原written统计exact。

离线重算全部**已存储**逐行结果：220模型24RGB非exact帧、6 written差帧、并集28严格非exact；30world共4RGB非exact帧。严格工具exit1与失败日志保留。未对未采样姿态/材质/相机提供新保证，不能由coverage样本相同推出完整遮挡无误。

## 目标汇编声明

独立解析实际S3 `renderer-s3.s` 的完整raster body，核对全部静态call位置：无mul/add/divdf3；唯一subdf3位于相对行49，首triangle coordinate floorf行90。其它double转换与fmax/fmin在bbox设置；源码亦明确在三角循环、像素循环之外。

像素循环内仍有 `__floatdisf`（行619/627/635）及纹理倒数 `__divsf3`（行682）；另外设置/triangle也有divsf3。故只能称这一路线减少raster的double运算，不能说整个引擎无软件浮点、无除法或已满足S3实时性。静态call位置/次数不是动态次数或周期。

五轮已记录Mac计时重新按float/reference计算比值，中位 `0.9489152761754692` 精确；没有独立重跑benchmark。该数字不含PSRAM/LVGL/SPI/RTOS、不能转为S3收益或滑动FPS。目标.o未链接text20385也不是最终Flash改善证明。

## 保留边界

普通calloc尚未显式PSRAM；renderer target431296/host431880，诊断owner65536与额外只读PCAT205624分账不变；任务/库栈、软浮点成本、真实屏发送和现有DMA/capture保护门仍需未来独立集成验证。此包是数值路线探索，不是A美术、真实照料/睡姿/奖励、物理滑动或无撕裂验收。

复现：`python3 tests/firmware041-review/float-exploration/recheck.py`。所有构建/输出在独审目录；未改封存、未接设备、未Git、未联网。
