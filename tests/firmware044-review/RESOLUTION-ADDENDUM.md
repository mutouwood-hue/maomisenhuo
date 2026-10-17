# 044 逻辑尺寸阶梯补充门

这是对原`DESIGN-GATES.md`的追加，不修改原设计或其历史hash。原文的466/ROI256及资源预算是当时设计，**本补充按Root后续授权233/ROI128、128/ROI70、96/ROI52进行审查准备**，最终ROI不足时必须增大或拒绝，不能裁猫。044运行源仍在途；以下没有实现放行或已确认产品缺陷。

依据043实际4次one-shot计算665–910ms，选择尺寸阶梯是新的输出基线。既有PCAT和double数学可继续保留，不能继承原466整帧RGB/Z/owner exact结论，也不能从低分辨率Mac耗时推断S3可连续动画。

## 新资源账及显示路径

原233最近邻2x决定已读取：`artifacts/firmware-visual-plan/2026-10-16/selected-A/044-LOGICAL2X-DECISION.json`。后续Root升级尺寸阶梯方案为完整466 RGB565 DROM背景434312B、logical三平面cache、唯一physical front；LVGL不zoom。

|logical N|logical cache N²×5+80（含header）|建议ROI（待完整bbox证明）|
|---|---:|---|
|233|271525B|128|
|128|82000B|70|
|96|46160B|52|

每个被链接variant另计完整466背景434312B；实际若链接多个variant必须逐项累计，不能只报所选cache。PCAT205624B DROM另计。ctx期望185536B、physical front256²×2=131072B，若增至288²则165888B；是否适用于各尺寸须以真实SDK sizeof/跨度和分配为准，不能提前填作已测结果。ctx185536+front165888=351424B不含LVGL image/decoder/cache、背景descriptor及allocator峰。仍禁止新增task/stack/internalDMA/fullscreen RAM背景；双9320/64KiB守卫不变。

## 必要软件门及负控

1. **全局nearest映射一致。** DROM背景、ROI展开、猫投影、头部/气泡、dirty边界都使用同一个全局映射。禁止对ROI局部坐标从0起缩放。若采用`L=floor(P×N/466)`，logical区间`[a,b)`的完整physical preimage为`[ceil(a×466/N),ceil(b×466/N))`，应以实际选择的唯一映射为准。只复用浮点scale乘坐标不足以证明相位一致。
2. **穷尽四边与末行列。** 每个N核466²目标像素恰好取合法logical样本；0/465、每个ROI origin、边界空/非空、裁屏和最后一行列都有正控。ROI像素与完整背景同位置颜色逐字节相等。故意换为local起点映射必须产生可观察差异，否则负控没覆盖非整数相位。
3. **完整bbox。** padded bbox必须全部落入logical ROI及展开后的physical front；失败返回invalid或增ROI，不能截边但仍返回成功。复用r2已发现的极端walk/head/world偏移反例，确保新N下所有实际姿态也走真实公共API。验证bbox不是仅检查有色ink。
4. **独立三平面oracle。** 各N以无缓存真实C生成新RGB/Z/owner golden，与cached每tile/边角/遮挡姿态比较。保持global Z量化、room先cat后、`>=`tie、透明不写Z。错尺寸/版本/相机/header/payload任一必须joint invalid或明确安全回退。不能将同cached实现的full输出视为全部深度真值。
5. **physical front真实边界。** descriptor width/height/stride与分配容量一致，所有显示入口（包括诊断RENDER）只能引用immutable front，不能back或临时展开buffer。LVGL不zoom；固定DROM背景直接466输出，避免默认pivot、AA、decoder隐藏全图RAM副本。单writer/单ctx/单front必须在实际链接及故障生命周期证明。
6. **脏区oracle。** 全部中间帧、极端跳位、各方向导航、bubble到期和overlap都以同一logical时刻的完整composition作physical framebuffer比较。old/new physical ROI与bubble旧/新边界union，固定背景先正确恢复。只invalid新ROI、错stride和local映射三种负控应显式失败；不能只比较结束截图。
7. **生命周期门继续适用。** USB首字节保留/半行不service、诊断hold与LIVE恢复、context唯一writer、GUI锁+async drain后完整copy、同generation/域/link/UIepoch、3s真实动作TTL结束再次核验及失败不移动ROI，沿原G44-01..10。尺寸缩小不解除取消/失败/迟到/后台门。
8. **测量必须拆开。** 报logical render、global展开/copy、GUI等待/持锁、publish/丢帧、LVGL/flush/input、DMA/PSRAM/栈实际值。选1–2个可读variant才进入独立app封存与Root受控设备窗口；不能把每秒one-shot倒数称连续FPS。A美术、真屏、人眼与物理tap/slide/care另验。

## 最终交审清单

最终variant及宏/头文件/asset生成器/缓存FP/背景CRC/APP、ELF、ZIP、源pin；原协议/NVS/安全字体/输入保护精确差异；上述production host正负控；实际SDK内存与DROM跨度；新Root helper预期cache/ctx/ROI/CRC与LIVE字段。未满足前不放行app更新。本补充已直接发实现者与Root，不读取或修改其在途runtime。
