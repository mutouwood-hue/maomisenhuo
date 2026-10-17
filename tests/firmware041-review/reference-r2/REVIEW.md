# 041 reference-r2 最终独立 delta 复核

## 结论

**E41-ROI/P2 在 reference-r2 主机定向复验关闭；仅放行 host software conformance / geometry reference。无新增确认 P1/P2。** 初始c18e03参考继续保持其失败结论与证据，不被回写。此结论不授权S3运行、固件App集成、设备部署、A美术或物理互动验收。

冻结C `a6b04f219b98aab3959b9b58d921ab4dc0f1bb8b4d7f7bece514073f8705252e`；header `fafee45dfc7923b099367ef3c7a96604852652b9dfa47717e6f7072f0d91e15c`。

独立核20个source/reference/tool/test/doc pins、38 evidence pins、manifest `22763433ba9717c9bbfa33fd7e1770658f7bb77bfc7e7cf458bd79abd7d6142e`。ZIP58185B SHA `4f7e30cea212aa860a0c11918a4838dc92bd90267ee1379bcb8d02875b1b671c`，实际21项=20内容+source-hashes索引，逐字读回相同。初始19 pins仍全部精确；没有扫float候选在途源。

## 最小修复及独立关闭证据

运行delta仅geometry尾：最终padded/screen-clipped bbox非空且宽高<=256；调整ROI完整包含它；最终再核ROI0..210与包含关系，无法满足返回false。不缩小bbox伪造完整覆盖，不改raster/深度/模型/动作/API/struct。

原准确参数 walk/.37/180°/wx16/wz-16/support2/props，在新公开API仍返回true，ROI=[210,126,256,256]，bbox原样[392,126,466,382]；bbox非法样本148→0。四full tile实际可见猫仍6663、ROI外cat ink仍0；本例没有以裁猫过关。`bounds-repro.json`。

独立新源 ASAN/UBSAN/float-cast-overflow 再验：

- 36边界参数仍26成功/10明确拒绝，所有成功cat_bounds完全位于ROI。
- 生产raster倾斜平面解析oracle，两顺序3600格/owner exact（2160蓝、1440红）。
- 8独立dirty跳位路径与四tile exact；只画新bbox负控仍68824残影。
- 8组实际C重新编译并与未改original JS RGB / coverage alpha逐字相同，含270°及head-look；无ROI外ink。

`independent-geometry.json`1718470计数主要为逐像素CHECK，不是171万个独立场景。`pose-oracle.json`为8实际独立输入；owner2916参数2264成功/652拒绝、220JS、30world、4745解析、216allocator以及target compile-only仅核原证据/来源，不冒称本轮全部独立执行。

## 未解除的门槛

原报告的资源/性能/来源边界全部沿用：host431880/target431296是renderer本体，另有PCAT205624；owner诊断65536没有删。源普通calloc并非显式PSRAM；目标softdouble/libm与任务栈、2×9320 DMA、64KiB抓屏guard、最终Flash链接均待集成实测。r2 .o text20489只是实际编译对象，不含未链接库，不是App或速度证明。

固定深度与dirty恢复的软件证据不等于真实屏滑动/FPS/无撕裂；技术房间/三道具/原idle-walk-paw不是新吃饭/睡姿、真实照料奖励或完整美术。源不含协议/存档业务。无设备动作、无Git、无源修改；后续float优化必须独立命名、全误差量化后再审，不能继承本参考的像素exact结论。
