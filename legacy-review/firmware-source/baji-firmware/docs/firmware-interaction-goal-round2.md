# 新Goal Round2：触摸优先与批量清空

## 已执行

- [主循环](<../main/main.c>)按下期间及页面过渡期间跳过猫自主tick；仍更新低电/安全状态，不冻结FSM。按帧dt仍正常计算，恢复不补播累计时间。尚未实现后台轮询/存档让路。
- [绘制器](<../main/ui/badge_paint.c>)生产默认sink清空从217156次逐像素accessor改为按stride逐行memset透明ARGB，保留自定义sink/host原路径。主机测试不能证明生产直接缓冲分支逐字节等价，需补此分支专门测试。
- [UI](<../main/ui/badge_ui.c>)加入motion prepare_us/capture_us/build_other_us分段诊断；capture只计算snapshot调用，build_other包含所有其余工作，不能直接命名纯绘制耗时。尚未消除同步snapshot。

## 验证

pwsh-2966全套0，runtime263/paint884失败0；pwsh-2987真实编译0，镜像0x2cc2b0；pwsh-3039 COM3仅应用烧录0，2933424字节Hash verified，不擦NVS。

[35秒串口](<../build/motion-profile-round2.log>)pwsh-3068退出0；uptime23–53秒PAIR稳定，没有用户触摸进入教学，因此snap_us0不是性能达标，未获分段手势数据。前版3.06–3.48秒基线仍有效，不宣称批量清空消除了主要瓶颈。

## 下一步

1. 添加可受控执行的生产快照基准，或用户配合进入教学获得真实分段耗时，不能反复仅采PAIR空闲日志。
2. 检查LVGL snapshot及图像解码/全屏逐像素alpha路径，必要时替换UI合成后端为预生成RGB565缓存/轻量场景合成；不得在按下时启动秒级工作。
3. 教学返回目标预览仍映射主表盘，需修正；完善教学完成独立页/原生skip字号和arc动效。
4. 新Goal仍active，不完整、未调用complete/blocked。
