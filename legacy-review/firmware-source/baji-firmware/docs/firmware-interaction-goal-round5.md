# 新Goal Round5：生产像素分支回归

## 新测试与证据

[生产分支测试](<../tests/host/test_badge_paint_production.c>)不定义BADGE_PAINT_HOST，真正执行生产默认像素写入、alpha读取、批次行缓存、整页memset清空分支。LVGL缓冲accessor用测试实现替代（不是实际LVGL合成器），行stride1880字节，含每行16字节填充和前后32字节哨兵。

151个规格元素×3组动态状态，分别对比原host绑定sink与生产无批次/有批次结果；逐行memcmp精确比对全部466×466像素；检查填充与边界哨兵不变；批次accessor调用数≤934，不随像素数增长。额外检查清空忽略局部clip。未覆盖真实LVGL线程并发、LCD展示、整树UI或文本，不将此测试称HTML整屏一致。

pwsh-3131测试首次编译失败，计数误用badge_el_count；读取生成表后改BADGE_EL_COUNT。pwsh-3132完整重跑退出0：新生产2267 checks/0 failures，原paint884/0、runtime263/0，其余全套通过。工具门禁已加入[paint阶段](<../tools/suite/03-paint.cmd>)，非一次性脚本。

## HTML视觉差异修正

重新读取触控HTML777–781：skip为cy420、f16、dim。UI改为f16/dim/top410（实际行高使中心约420，精确字体baseline仍待图像比对），原f20/accent/top404不再用。pwsh-3134真实固件0，0x2cc3c0；pwsh-3136应用2933696字节0x20000 Hash verified，保留NVS。此轮只获得烧录校验，未采到教学新照片，不声明视觉验收。

## 仍需优先实施

- 把ui_motion_begin里的同步目标重建和snapshot移出按下/拖动临界路径。目前仍未完成，不能靠像素加速和反复烧录当作目标达成。
- 比较可回退缓存合成方案：真实完整页面先在非触摸状态准备；手势路径只偏移ready图层；缓存未ready用即时源页跟手而非等待，但该fallback不能冒充双页HTML验收。
- 精确分段实机motion性能，教学return预览顶部标签（top layer不包含snapshot）、done独立页、手势指示样式仍有差异。
- Goal active，不complete/block。
