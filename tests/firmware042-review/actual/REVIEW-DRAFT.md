# 042 实际设备审查草稿（待最终会话索引封存）

已只读复核完成命令1..13及application读回/保护verify。最终结论待Root闭合RESULT/FINAL-INDEX后另写，当前不pin增长中的raw/session。

实际设备三次一次性计算均valid/published/completeFrame，RGB565 CRC分别863a4d49/be209397/2629ef6e，ROI/bbox/tri/tested/inside/written全与冻结r2主机参考对应。这里是目标报告CRC/指标对照，不冒充直接读回整份renderer RGB/Z/owner逐字对照。

|sample|总耗时ms|raster含yield ms|yield次数|
|---|---:|---:|---:|
|0|1484.841|1423.582|125|
|1|1301.495|1211.743|103|
|2|1393.561|1310.414|113|

这是三个单帧技术样本，含调度/yield，不是持续动画FPS。三次诊断composition都独立严格校验BEGIN/DATA id/连续offset/base64/434312B/CRC/END；亲看capture1/2有工程3D viewport，capture3已经回I8，不能记第三次3D显示通过。没有捕获mode事件建立卸图因果；该结果与原10s COMP/更新face卸图源码边界兼容，仅作解释。

发布后PERF的dmaFree71255>=65536、largest31744、min35164，双9320且DMAcapable。实际renderer SPIRAM431296、PCAT DROM205624；PSRAM free8258380→7824200，差434180不能全归为ctx，包含allocator/并行UI状态。USBtask水位1924→1444B是截至各调用的累计最低剩余（含之前capture等），不是各sample独占栈成本。pressedPolls0，不据此声称物理滑动或人眼验收。

STATE1与12所有字段一致：revision41、seq50、ACK9、pending0、nextEvent10、home/idle、clockfalse；无新持久care事件/校时证据，不宣称clock或手机奖励链已验。APP独立readback与扇区FF尾精确、8MiB应用槽未触尾与原样一致；normalboot之前32MiB四段physical digest全部verify OK。这个保护证据不外推整个normal运行结束后所有NVS私有字节已再次物理读回。

软件候选原451pins保持不动；实际证据将单独封存。reviewer无设备操作/上传/源码修改。
