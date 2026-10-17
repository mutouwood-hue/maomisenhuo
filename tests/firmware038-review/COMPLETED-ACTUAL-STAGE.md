# 038 已完成设备阶段初审（非最终）

只读完成文件，未访问设备；仍开放的 normal-boot stream、phone actions/after-authority 未读取或封存。

已确认：最终 APP6402112B 与独立 sector6406144B 读回前缀精确、4032B sector 尾 FF；fresh128KiB=before=activation prefix；fresh prefix 与已验证历史不变区组成的32MiB在写前及写后分别四范围 digest verify 成功。并非重新物理读取整32MiB，未解析私人NVS。

5 capture 经本轮生产 decoder 严格CRC、原始RGB565与PNG重建均精确。已亲看三face cold neutral以及实际connected away草地16:18→原召回后home窗边16:19。此为运行中LVGL合成，非光学屏照/真实触屏证据。

STATE1 cold rev33/seq42 clockfalse；实际连接后11 rev34/seq43 clocktrue480；14 rev36/seq45 home；19 rev37/seq46。ACK9/pending0/next10均保留。19新版本的具体触发来源未逐包建立因果，不推断。

PERF17→18 same epoch132.873119s、532render、2409409us、平均4528.964285714285us、pressed0。DMA71883→71875（-8），largest31744/min35808，PSRAM8234824，两个9320B DMA capable。末DMA高于65536 guard6339B，5次capture已实际成功。窗口手机前台连接、自动snapshot未排除，不能称radio quiescent/no BLE commands，亦非匹配037 A/B或实际滑动FPS。

证据：`completed-actual-stage-evidence.json`（47个已完成文件hash）、`check_completed_actual_stage.py`、`completed-actual-captures-contact.png`。

仍待Root关闭串口、RESULT/最终日志与手机after-authority齐备，才出正式ACTUAL-DEVICE-REVIEW。当前不结论物理滑动/撕裂/本地照料或存储最终保全。
