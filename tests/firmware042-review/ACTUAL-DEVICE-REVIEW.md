# 042 实际设备独立复核

## 有限结论

**受控应用区更新、三次完整单帧计算、两张工程3D合成图与保留原状态的证据成立。** 无本轮新确认 P1/P2；自然动画/成品A/物理触摸或光学显示仍未通过。第三张合成图已回原I8，不记第三次3D显示成功。

Root最终70文件索引 SHA `c65512f51a7e76f0eed0f458e4989a9b7ae0d537342e7f02f3ce2adbf7b7943e` 全部独立重算。原软件451pins逐一复核不变。审查只读取既有文件、离线解码和比对，没有设备/串口/手机/上传动作。

## 应用与保护

实际APP 6635696B独立从`app-sector-readback.bin`比较，与已放行 `b0d1704032c1067455b4355617924dadc63efa20a4ec245189e75d75b99f8bcc` 全字节相等。ceil4KiB读回6639616B，余3920B全FF；8MiB expected slot余尾与原slot完全相等。实际write argv仅0x820000应用，最终163f/14e37/7a32执行源与gate摘要相符。

四段物理digest verify覆盖0..32MiB，日志4次`verify OK (digest matched)`与returncode0一致：prefix、OTA0、expected OTA1、assets tail。fresh physical read只有128KiB，组合镜像经写前全范围物理verify，不说成fresh全32MiB读回。写后保护verify在11:29:34.521Z完成、normal boot在后；证明维护阶段boot/table/NVS/phy/selector/其它应用和资源未变，不外推整个normal运行结束后所有NVS私有字节已再次读回。

正常日志实际版本为`0.4.2-exact3d`。这次138.554秒、16条命令，11:30:07.100Z开始、11:32:25.656Z结束；元数据记录一次显式normal reset成功返回，记录无未知/未完成命令。采集起点未包含ROM marker，不声称独立计数观测到了完整reset链。关闭依据是Root最终会话记录及已核助手finally收尾；reviewer未直接查询USB opener。

## 计算样本

|sample|总耗时ms|raster含yield ms|yield次数|RGB565 CRC32|
|---|---:|---:|---:|---|
|0|1484.841|1423.582|125|863a4d49|
|1|1301.495|1211.743|103|be209397|
|2|1393.561|1310.414|113|2629ef6e|

三次终态均valid/published/completeFrame，phase5、无partial/error；ROI、padded bbox、triangle/tested/inside/written及CRC均与冻结r2主机样本对应一致。这里是板端报告CRC/指标匹配，不等同直接读取整个目标context RGB/Z/owner并逐字比较。实际目标配置Freertos Hz1000；耗时包含合作yield/调度，不是纯CPU，也不是持续FPS。该完整exact路径约1.30–1.48秒一帧，不支持据此声称自然动画。

实际报告context431296B external PSRAM、PCAT205624B DROM。发布后PERF dmaFree71255（距65536为5719B）、largest31744、历史min35164，原双9320均DMAcapable，所有本轮capture保原64KiB门。PSRAM free8258380→7824200差434180B，不能将全部差额归给ctx，含allocator/同期UI等。USBtask最低剩余1924→1444B是任务累计高水位对应剩余，包含之前capture等，不是某一模型的独占栈耗。没有从这些有限读数外推长期无泄漏或压力安全。

## 三张合成图

独立严格解析capture BEGIN、id、连续不重复offset、base64、434312B、CRC及END；三份raw与Root解码raw逐字一致。亲看独立PNG：capture1/2是工程3D视口，capture3是旧I8回退。原UI标签/图标继续覆盖技术viewport，这不是最终A构图验收。

sample2的计算及当时published终态成功，与随后抓到I8并不互斥；未记录具体mode切换事件，不能补造卸图因果。结果与原PLAY→COMP/更新face会卸图的源码边界兼容，只作解释。三张均为运行LVGL object-tree composition，非屏摄/面板readback，不证明scanout、物理无撕裂或触摸性能。

初次独立PNG比对假设修正已保留：Root采用RGB565→8bit最近比例展开，独立解码采用bit replication，逐通道最大差1/255，原RGB565始终全同；已分别核Root转换公式和原字节，不把夹具断言误记设备故障。另TXT用read_text会规范CRLF，改按原字节解码核对，与raw的replacement decode一致。详见`actual/png-conversion-check-note.md`。

## 状态、错误与释放边界

STATE1、12、15所有字段一致：home/idle、revision41、seq50、ACK9、pending0、nextEvent10、clockfalse/offset0。没有新持久care事件/ACK/校时证据，不宣称手机Native ledger或奖励链本轮已重新验证。最终PERF pressedPolls0；Root未做触摸，本轮物理互动仍待验。

有限1825207B console内没有选定ESP `E (` 行；保留1条启动`CFDIAG ERROR COMMAND_INVALID_OR_TOO_LONG`，发生在第一条STATE前，不称零错误或解释为fatal。没有全面长期稳定性结论。

Root只上传原sample0/1 PNG至既有私人目录。本地记录显示owner-only、shared:false、父目录与size正确，local SHA匹配；这是离线metadata证据，未读取远端字节、不宣称远端SHA。本review没有上传动作。

043只完成设计门（`CACHE043-GATES.md`），不继承本轮放行，不改042运行源或原451证据。后续须独立冻结/相机与三平面精确/资源/生命周期审查及Root受控窗口。
