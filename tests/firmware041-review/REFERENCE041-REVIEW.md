# 041 初始冻结参考独立审查

## 决定

**初始 C `c18e03f46c6c57ed92e496840aeb57f21c0ae3850035ee6405c38ff015b39603` 保留 E41-ROI/P2 阻断；不能把220/30正控提升为该参考整体放行。** 初始19 pins、43 evidence pins、ZIP56917B SHA `c60681742f94916e58e42d12f9ae4be92c0262cf555b130df3162438d4590b51` 精确，旧材料均未修改。ZIP实际20项=19源/文档/参考+source-hashes索引。修复仅在独立reference-r2，另见其最终审查。

## 已确认 E41-ROI / P2

位置 `artifacts/firmware-visual-prototype041/source/renderer.c:58`（geometry末尾）。原投影extent<=252不能保证加margin、偶数对齐、屏内clamp后的公开cat_bounds完全位于256² ROI。

实际原PCAT，公开 `vr_world_frame(r,"walk",.37,180,0,0,16,-16,2,true,&stats)` 返回true：ROI=[210,124,256,256]，cat_bounds=[392,126,466,382]。底部超ROI底380两行；按公开框逐行复制会访问148个ROI分配外样本。现validate_world采用该复制约定，Python切片不足还可能缩短canvas。

独立 `bounds_repro.c` 只计算非法索引，不主动越界读取；ASAN/UBSAN链接实际公开API。四完整tile实际可见猫6663像素，原ROI外实际猫ink为0。故**本例是padding公开框越界，不能说已证实猫被裁**。`bounds-repro.json`保留原负控。初次审查测试先假设所有±16参数均成功，遇显式ROI拒绝后修正夹具假设；原失败输出保留，拒绝本身不列产品bug。

## 正确性与输入界的实际覆盖

- 新独立倾斜平面解析oracle：蓝平面z70→140与红平面z100交叉。两提交顺序各3600像素及owner逐点相同；解析2160蓝/1440红，无对角裂缝。此oracle实际调用生产raster，不依赖房间同C完整重画来证明深度。
- 新独立8组合法跳位/方向翻转：旧新bbox并集恢复与四完整tile exact；仅新bbox负控留下68824像素残影。该项证明此路径的脏区恢复，**同C full oracle不能证明所有深度关系**，后者另由解析oracle限定。
- 36个实际模型世界角点/朝向样本，26成功、10明确ROI guard拒绝；其中1个成功框复现P2。不是整个±16区域已成为可走区。拒绝时不应发布部分stats/旧帧为成功；公开bool必须被调用者遵守。
- 8组独立实际C与未改original JS颜色、coverage JS颜色/alpha逐字相同，包括270°与head-look；coverage与original RGB亦逐字相同。owner原220则核其来源/hash与结果，不冒称独立全220重跑。
- 原4745解析/截断/深度/负控/生命周期 ASAN/UBSAN测试独立重新编译运行；allocator失败关闭、216帧零framecalloc独立重跑。未知动作/非finite坐标/越界tile等拒绝及已画颜色保留另有独立测试。仅针对本次固定PCAT与受控参数，不是任意PCAT通用引擎容错证明。
- 独立边界像素CHECK总1718444主要来自owner图逐像素循环，不能写成171万不同测试场景。

## 算术/资源/来源

受控原模型下投影屏坐标guard±4096，使16倍坐标/边增量处在int32范围；面积及行边函数乘法使用int64，ROI索引循环裁到256²；palette/UV与固定骨骼/方块/轨道数量有界。上述是源码审阅+host sanitizer，不是ILP32设备执行证明。房间使用固定camera near35/far180共享inverse-Z；不复用单猫局部归一化深度。原骨骼pivot、TRS、贴图、三动画/head-look沿原JS移植；新122tri技术房间不是原完整房间或A美术还原。

目标sizeof431296、host431880，诊断owner map65536仍在；PCAT205624额外只读输入，目标Flash放置只是未来集成要求。若把PCAT复制RAM，目标合计636920，超480KiB。普通calloc没有PSRAM落点证明；帧无动态分配不等于整机零峰值。

目标编译.o text20333未链接数学/softdouble/IDF时钟分配等，且实际raster含double软件helper。自有栈约2KiB不含libm/libc/调用任务/ISR。Mac微秒、逻辑dirty面积不是S3 FPS、SPI/LVGL实耗或无撕裂证据。接入现固件前仍须显式PSRAM/失败关闭/栈/异步flush/预算实测，保持2×9320 DMA、64KiB capture guard；本目录没有可刷App，也没有协议/存档/奖励改动。
