# 新Goal Round4：教学返回预览与绘制批次

## 修改

- 生产UI目标GUIDE不再将整个预览FSM目标改为MAIN_A/B/C。独立preview_guide选空元素教学场景；猫相机单独用MAIN_A。预览结束清标志，真实onboarding不变。教学标题是top layer，当前snapshot不包含top layer，返回滑动时标题出现时机仍待完善。
- 移除main开机自动snapshot基准；测量接口尚保留但默认不调用。
- badge_paint_batch_begin/end按行缓存ARGB指针仅限当前UI绘制批次，像素写入及alpha读取不再每次调用LVGL缓冲访问；全页/局部批次均end，host sink接口保持。

## 证据

pwsh-3125全套0，runtime263/paint884失败0。主机测试仍走HOST分支，不证明新增直接指针分支像素等价，需要专门生产分支回归。pwsh-3127真实固件0，镜像0x2cc3c0；pwsh-3129应用0x20000烧录2933696字节、Hash verified，随后[连续启动日志](<../build/batch-preview-round4.log>)正常到PAIR，IMU/PMIC/touch/LVGL/BLE初始化，5条事件存档保留，未见panic/watchdog，snap_us0说明基准未自动调用，不是手势性能达标。

## 未完成

同步目标preview rebuild/refresh和两个snapshot仍在ui_motion_begin；本轮仅优化内部逐像素开销，未实现页面缓存提前准备。需测当前motion总耗时，再实施非触摸临界路径的缓存准备与跟手源页 fallback。独立教学照片和视觉差异仍待实机验收；新Goal保持active。
