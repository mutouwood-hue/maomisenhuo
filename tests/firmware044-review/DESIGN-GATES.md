# 044 A 渲染服务设计审查门

## 范围与决定

只读以下设计：`design/PRODUCTION-LIFECYCLE.md`（WIP）及Root `044-FRONT-BUDGET-DECISION.json`。**方案可进入隔离实现，未审在途源码、不放行应用或设备动作。** 以下P1/P2是实现必须防住的后果分级，不是已确认产品缺陷。043实际计时尚待收敛，本文件不批准float、降分辨率或自然动画帧率结论。

资源授权明确：context431296 + 独立front131072 = **562368B SPIRAM**，高于旧512KiB目标38080B，新固定猫预算640KiB。PCAT205624与cache1085860 DROM另计；现有UI/decoder/cache/allocator/draw任务不能塞进上述数字隐去。零新task/stack/internal-DMA/fullscreen-RAM背景。

## 必须不变量及可验证场景

|门|必须成立|必要反例/正控|后果级别|
|---|---|---|---|
|G44-01 单写者与别名|只有USBtask写ctx/back/front；所有图像读者只读完成front，后台compute不能写任何已发布src|auto A→显式RENDER→LIVE→auto，及VIEW/CAPTURE/CLEAR往返；计算每个阶段front hash不变。**043原RENDER发布back，不能只说命令互斥就沿用该别名**；应统一发布front或LIVE前drain/detach所有back引用|P1内存/并发；P2半帧|
|G44-02 完整发布|同BSP锁及真实async-drain后，先验当前request/UI/domain，再drop旧decoder/cache、整copy、更新持久descriptor/位置、invalidate。失败不改front、也不先移动ROI|校验/复制/raster取消；publish锁超时；新revision/pet/动作/导航/power在计算中到达；拒绝前后front bytes/descriptor/ROI一致。接受时只在锁释放后看到全新一帧|P1所有权；P2错帧|
|G44-03 USB/parser连续性|一个RX reader；checkpoint最多保存首字节，先归还同parser再读后续；pending不被覆盖；半行不service；完整命令先hold，LIVE仅RAM恢复|在validation/copy/raster/idle等待边界送分片`CFDIAG STATE\n`，含首字母C，逐字相同且只执行一次；多命令同packet、CRLF、超长/非法/空行；slot已有字节不再read。明确诊断RENDER取消的首字节语义，LF cancel不变成第二个命令|P1双writer；P2命令丢/串行死锁|
|G44-04 诊断互斥与恢复|STATE/PERF/CAPTURE/VIEW/RENDER完整命令hold auto；未结束/unknown/error不自动重放。CAPTURE与计算/发布互斥，保持已完成front；LIVE不产生domain事件|auto中CAPTURE必须是单一完整source；RENDER中输入不会并发再入；完整命令hold后持续静置无新auto帧；LIVE才恢复。bad/partial命令后的策略与文档一致，不隐式恢复|P1重入；P2假完成|
|G44-05 内存与失败|显式SPIRAM两大块仅各一份，无每scene/front副本；背景直接读DROM color。unpublished资源失败可清理，已发布front只能drain后释放/切回；不降低64KiB guard或换globalallocator|ctx分配成功/front失败、front成功/ctx失败、错误cap、生命周期重复进出100次；无悬空decoder/src，无新增持久event，仍可原I8/UI操作。计实际object/descriptor/cache/allocator peak，不仅sizeof|P1OOM/UAF|
|G44-06 信任与3s动作|generic A只是中性装修；远端动作仍须原fresh+link gate，本地动作须原persist成功。采样时间来自原clip；服务完成不重设原started，不延长3s，不奖励|离线旧sleep/away不重放；断连前持久newrev后再断开不复播；真实local成功在离线fresh下保留；失败/存储忙/取消无成功cue；开始2.9s有效、计算结束已过3s必须拒旧action/转generic，不只比较revision|P1若产生事务；P2语义误播|
|G44-07 power/导航|same-face0 PLAY→COMP保A（不能沿旧update_face每次clear），AOD/OFF立即原时间/唤醒优先、停auto；离开home/gesture/modal先清或隐藏A，后台旧请求不得迟到覆盖|PLAY→COMP正在计算/已发布两态；AOD/OFF/wake、同毫秒导航往返、face0→1→0、gesture取消/回弹、gift/pairing/store error插入；wake后仅当前新完成帧，不闪旧care。I8安全过渡与A-aware手势优化分开声明|P2显示/输入抢占|
|G44-08 脏区与背景|旧/新投影ROI的LCD全局union，加bubble自身旧/新区域，先还原正确静态背景；front中的room slice与完整背景同相机/量化/key|连续步行/跳位、corner0/210、碗/垫/柱遮挡、各中间帧、bubble出现/过期/位移、导航回来；actual LVGL partial framebuffer逐帧对同一时刻full oracle。仅invalidate新ROI/仅猫bbox/错row负控要确有残影或差像素|P2残影/遮挡|
|G44-09 A基线与exact|新A房间是新输出基线，不能继承r2/043整帧CRC。固定A几何/材料/相机/cache FP及RGB/Z/owner联合有效；原PCAT/double部分可独立保真|cache-vs-full三平面；解析深度/相等Z `>=`/透明不写Z；真实scene遮挡；旧r3右缝负控与r4圆内coverage/真实ink。记录新A golden SHA/CRC；错相机/版本/plane必须拒绝或显式回退|P2错基线|
|G44-10 气泡仅呈现|icon来自真实成功/当前接受事件，不从意向点击或后台补播；低优先装饰不盖storage/modal/AOD/notice。位置用当前投影头部后代bounds，超界隐藏/合规调整；无新hitbox透传care|重复相同event、动作取消/打断/失败、延迟完成已失效、后台/wake、头偏转、face/COMP/遮挡；短寿命不重置、隐藏不吞真实控件，不把装饰当事实或奖励|P2误导/控件遮挡|

### G44-01/02 的具体线性化边界

- GUI锁保护LVGL读者，不能单凭CNT1说同步；沿042/043已审adapter整段timer_handler锁、refresh/snapshot draw_task_head drain链。
- front整copy前后必须仍是同一个完整request。锁内copy的实际耗时要测，不能因“仅memcpy”就称短锁；全131072B copy不等于物理LCD原子scanout。
- generation至少包含当前home/face/mode、输入、导航、pet/link/持久revision/care/gift、当前真实action及其到期时间、原clip/场景配置和新frame请求。到期时间不能仅靠下一次250ms poll变更来间接保护。domain的检查/发布线性化边界应明说，不宣称跨所有独立线程的绝对同时性。
- 后台不因每次state poll相同值而重建对象/重分配、整屏invalidate或重设动作时钟；仍须保原真实动画tick。若调度不足，丢旧视觉请求而非排无限队列，不丢事务/USB命令。

## 最小交审和设备验收

1. 实现稳定后独立source window，最终APP/ELF/ZIP/source pin；与043精确差异清单，core/store/wire/BLE/peer/gesture/partition/安全门逐字核同。任何新CFDIAG LIVE只调度RAM，无NVS/domain变化。
2. 静态对象/buffer/栈表（每实例×个数）和实际目标link/sections/DROM跨度；app仍严格小于8MiB且ceil-sector在槽内。新增一张背景image及decoder metadata的internal峰另算，不能只报562368。
3. 可复现actual production host fixture：单writer/USB parser、front immutable、取消/迟到/TTL、COMP/AOD/wake、modal/input routing、dirty/full逐中间帧。ASAN与故障替身明确不是FreeRTOS真并发或设备实证。
4. 单独新Root执行目录与审后hash，不复用043旧CRC/helper冒称A通过；当前独审release、新鲜backup/protected gate后才受控应用区动作。软件门不授权本reviewer碰设备。
5. Root实测cache cold/warm、pose/geometry/copy/raster、publish锁等待/持锁时间、GUI/flush/input、USB累计stack、PSRAM/DMA/largest/min/capture。count实际提交/丢弃的request，不从静置4ms或倒数单帧秒数报FPS；43尚未返回实测时不选分辨率。
6. 暂无物理触摸时只能演示有限状态/软件composition；不能以USB VIEW、合成gesture、录GIF或scene注入替代真实tap/slide/care。A美术、连续动画和人眼/物理互动各自待验。

设计文档已包含主要正向方案，以上是最终实现与测试必须落到实际代码的门；当前不记任何已确认044产品P1/P2。
