# 043 实际设备独立复核

## 有限结论

**本轮受控应用区更新、四次缓存冷/热单帧计算和两张工程3D合成图的证据通过。** 无新增确认 P1/P2。暖缓存仍约0.665–0.908秒/帧，不能作为持续FPS、自然动画、成品A或物理触摸/无撕裂通过。044新233逻辑基线另审，不从此处继承466整帧exact。

Root59文件FINAL-INDEX SHA `6f5c491d2862426297daf117220c35a0e4822e34957a06a70c736597a7ded9b6` 全部独立核大小/摘要，原软件319pins逐项未变。reviewer仅读取既有文件、离线解码/比较，没有设备、串口、手机或上传动作。

## 更新与保护

实际APP sector读回7725056B：前7723088B与已放行APP `905552f2f35dc56942b226e9d8558ae98bf31e0e07765ae0c1ba81ab32e88cc2` 全字节相等，余1968B全FF；expected8MiB slot其后未触尾与原042 slot相等。write argv只向当前已核OTA1地址写应用。

写前/写后各4段whole32MiB物理digest verify日志与returncode0一致。NVS/selector/boot/table/phy/其它slot/assets在维护写入阶段保持原样。写后保护verify在normalboot前，不能据STATE相等外推整个运行结束后全部NVS私有字节再次被读回。备份是fresh128KiB prefix带最新NVS+历史范围经当前全32MiB物理digest验证，不是fresh全32MiB physical read；未解码NVS。

实际日志版本0.4.3-exactcache；一次显式normal reset记录成功返回，17条完整终态命令，55.311秒，12:03:32.717Z至12:04:28.029Z。最终元数据及已核助手finally表明会话收尾关闭；Root另报告lsof无opener，但本索引无独立lsof机器输出文件，不声称reviewer直接观察USB进程状态。

## 四次实际单帧

|顺序|sample|总耗时ms|cache校验ms|raster含copy/yield ms|yield次数|
|---|---:|---:|---:|---:|---:|
|同boot首次cold|0|909.605|102.486|752.377|81|
|warm重复同pose|0|907.726|0.003|859.452|80|
|warm|1|665.173|0.001|602.550|57|
|warm|2|817.543|0.003|764.573|69|

全部valid/published/completeFrame、cacheUsed/DROM、context external、PCAT DROM成立，无partial/error。ROI/bbox、实际执行tri/tested/inside/written、RGB565 CRC与独立核过的043冻结数学期望逐字段一致（CRC863a4d49、be209397、2629ef6e；sample0重复一致）。这是目标报告指标/CRC匹配，非直接读回整个target RGB/Z/owner三平面逐字比较。

cold校验与warm复用边界有据；但是cold0总909.605ms与warm0总907.726ms几乎相同，raster本身有调度/负载波动，不能只减去102.486ms就宣称等量整体收益。raster包含ROI恢复copy、原double猫光栅与合作yield/调度，尚无独立copy耗时。不能把yield次数直接当毫秒扣除估算纯CPU。四个不同样本/一次冷暖重复不是连续动画或严格匹配042 A/B实验，不报倒数FPS。

实际context431296B external PSRAM、cache1085860B DROM、PCAT205624B DROM。初次PSRAM free8258380→7824200差434180B，不能全部归给ctx；后续记录PSRAMfree7824200。最终PERF DMAfree71227、largest31744、boot累计min35136、两9320且DMAcapable。sample2 RENDER自身dmaAfter70783，后续PERF回71227，保留不同时间读数，不把它们写成全程同一余量或长期无泄漏证明。64KiB门是当次current-free门，不意味着历史min也始终>=64KiB。

USBtask累计最低剩余1928→1448B，包括此前capture等；不是某一模型独占栈成本，也不替代长期/极端压力验证。

## 两张软件合成图

独立从command5/10严格解析BEGIN、DATA id、无重叠连续offset、base64、434312B/CRC及END。raw与Root解码raw逐字一致；以RGB565最近比例展开得到的PNG像素与Root PNG一致。两张Root PNG文件又与042对应PNG**文件字节完全相同**。

亲看本次独立解码图：sample0正面、sample1转身/道具，均工程3D视口；原HUD仍覆盖视口，并非最终A。未计划给warm0或sample2单独图，不能把计算published字段扩写成它们的屏幕显示实证。以上是运行LVGL object-tree composition，不是光学屏摄/面板readback，不证明scanout或tear-free。

MEDIA-REUSE明确未重复上传；原042私人媒体索引SHA已核，保持原042命名与来源。复用说明基于本地PNG byte equality及旧已保存owner-only/sharedfalse metadata，不把旧链接当新043独立上传，也未下载远端字节验证remote SHA。本review无上传。

## 状态与错误

STATE1/13/16全部字段精确相同：home/idle，revision41、seq50、ACK9、pending0、nextEvent10、clockfalse/offset0。没有新持久care/ACK或校时变化；手机Native/reward链本轮未重验。最终PERF pressedPolls0，Root没有物理触摸，实际滑动/照料仍待验。

有限1223054B console含1条启动`CFDIAG ERROR COMMAND_INVALID_OR_TOO_LONG`，原样保留；选定ESP `E (`行0。不说零错误、全渲染稳定或所有异步路径已覆盖。正常任务结束/保护与有限技算通过，不提升为最终游戏验收。
