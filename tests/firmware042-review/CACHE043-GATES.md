# 043 静态 exact 缓存设计门（未审在途实现，非放行）

## 路线与资源

Root确认拟采用const Flash三平面，不新增PSRAM front。466²×(RGB565 2 + Z16 2 + owner8 1)=1,085,780B 新增Flash；原431296B SPIRAM context及205624B PCAT另计。042APP6635696 +原始cache1085780=7721476B，8MiB仅余667132B，尚未计新代码/对齐/镜像元信息，必须实际link/app/ceil4KiB占用核验，不能当已满足旧512KiB增量预算。不能把const静态量口头当DROM，须目标符号地址/跨度、实际bytes/source hash、ELF/map对照。

运行应直接从固定Flash的每行区域恢复到已有color/depth/owner，不能另有整屏复制/额外front/task/internal栈；原两9320/pool/64KiB保持。Flash校验/读失败、错key/版本/大小、缺失任一平面必须整组无效，退原uncached exact或明确失败；不发布半缓存、不能用PSRAM隐式兜底后仍称零新增。

## 精确性

- 缓存key/契约必须固定真实view矩阵、投影FOV/焦点/屏幕原点、466尺寸、near/far和Z量化、房间几何/props/material/色阶及生成器版本。PCAT猫动作不污染静态底；有真实房间变化必须失效，不能靠调用方记得clear。
- 原042先room、后cat，实际比较是 **z>=depth**，相等深度后绘cat获胜；透明猫texel不写RGB/Z/owner。固定Z映射为65000/(1/35-1/180)，不得换回object-local min/max。缓存不能只带RGB而忽略遮挡Z和owner。
- 世界/ROI索引全局一致。任意tx/ty及猫移动造成的自动ROI变化须从全缓存正确切片，0/210角与非整对齐坐标，重叠道具边缘、coplanar tie及旧ROI跳转必须与042 uncached exact RGB/Z/owner全字节一致。
- 不能只以同cache full重新绘制当独立oracle。用冻结042/r2 uncached比较；旧local-Z/错ROI/错key/仅RGB或错误tie必须确实打破负控。保原解析平面oracle、透明texel和道具前后遮挡样例。
- warm path可少执行static工作，tested/inside/written/triangles必须说明实际执行计数与逻辑/继承计数的差别，不虚报跳过的room三角已经执行。冷构建/首次校验、Flash→ROI复制、猫pose/geometry/raster、GUI提交分开记录，计时含yield/调度边界明确。

## 生命周期与验收

沿042 begin卸源/cache→锁外计算→锁内核UI epoch/domain发布；context仅一个，published源只读，不能为了cache将整帧计算搬回GUI tick/DRAW。保所有pause/nav/mode/face/modal/输入/fresh/断连/真实反应旧负控，失败不产care/ACK/存档/时间推进。

最小软件门是冻结source/APP/ELF/ZIP、实际目标编译、随机/边界/原3技术样本对042三平面exact及明确缓存不匹配负控、内存/失败路径、同逻辑时间trace下dirty/full。再经Root新鲜backup/protected门受控上板测冷/热耗时/stack/heap/guard与软件capture；主机ratio不作S3 FPS，不把cache优化先称流畅。042实测三帧约1.30–1.48s，证明当前full exact路径不能据此宣称自然动画；043未经测量不预判收益。
