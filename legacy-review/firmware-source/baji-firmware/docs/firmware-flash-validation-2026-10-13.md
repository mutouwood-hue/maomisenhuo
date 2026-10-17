# 授权烧录与启动记录（2026-10-13）

用户明确授权烧入当前固件。设备COM3，esptool检测ESP32-S3 QFN56 revision0.2、8MB PSRAM、USB Serial/JTAG。

## 实际执行

- 烧前镜像SHA256：BEEE86198C247647B8B48F02D33BB5CF0B43C11673AF6B20FC67E044FB6EE394。
- 先read_flash 0x8000长度0x9000备份[原分区表/NVS](<../build/preflash-partition-nvs-20261013.bin>)，任务pwsh-2778退出0。该备份包含私有设备状态，不公开分享。
- esptool写0x0 bootloader、0x8000 partition-table、0x20000应用2919488字节；DIO/80MHz/32MB；pwsh-2779退出0，三段Hash of data verified，自动复位。
- 实際擦写0x0–0x5fff、0x8000–0x8fff、0x20000–0x2e8fff，未整片擦除且未烧写NVS 0x9000–0x10fff。应用后续运行仍可能更新NVS；不声称原存档逐字节永不改变。

## 20秒启动/运行采样

[原始串口日志](<../build/postflash-serial-20261013.log>)由pwsh-2782采集，退出0。

- CST9217识别466×466，触摸IRQ注册成功；LVGL任务启动。
- QMI8658、AXP2101和ES8311初始化，硬件报告无马达/无NFC，IMU/PMIC/audio可用。
- BLE启动并进入advertising/discovery；app_main正常返回。
- 存档显示growth109/coins30；没有pending event queue。
- 7.98/12.99/17.99秒PERF：desk、screen21（PAIR）、fps0/cat_us0、heap102K、q0。PAIR等待可信绑定，不能把其无猫解释为渲染失败。
- 样本中未见panic/abort/watchdog/backtrace；只证明此次短时启动，无实际手动触摸、屏幕截图、手机认证或全部硬件验收。
- 警告：I2C pull-up通用警告需进一步检查；LVGL内置gesture关闭但工程使用自定义单点FSM手势。bat82日志不代表已标定SOC或确认电池有效采样。

## 后续：照片反馈与本地体验入口

用户确认深色底和方块修复生效。此前PAIR占位码`--- ---`用了仅数字/冒号的n40，现占位使用f24；透明画布父screen明确规范BG。亦修正新增UI将像素字号误当字体枚举的问题。pwsh-2796全套0，pwsh-2800构建0，pwsh-2805应用烧录哈希验证0。

用户授权本地体验：PAIR下方(133,350)200×48入口，由真实FSM tap触发GUIDE，屏幕标明“本地体验 · 未绑定”。会话标志和单独临时onboarding不改真实绑定/教学完成/技能记录，重启回PAIR，不授App身份。宠物互动仍按原逻辑影响宠物存档，并非所有状态均不持久化。runtime新增9项，覆盖真实点按入口、教学skip、主屏左右滑、真实onboarding逐字节不变、App未连接、重建回PAIR、低电拒绝。

pwsh-2823因测试缺string.h退出1，补头后pwsh-2825全套0，runtime258项0失败。pwsh-2827构建0，pwsh-2828烧录0。

但[初次体验版串口](<../build/local-experience-serial-20261013.log>)发现ble_hs_timer_exp assert/reboot。定位adapter start→social start→net_link_start后再次net_link_start，原实现重复创建host task。现在net_link_start以atomic_exchange幂等，仅创建一个host，创建失败撤销标志；没有宣称主机fake验证真实GAP并发。

pwsh-2833构建0，镜像0x2c9060（2920544字节）；pwsh-2835仅应用烧录0/Hash verified；[修复后25秒串口](<../build/local-experience-fixed-serial-20261013.log>)pwsh-2838退出0。观察uptime78–99秒，未见断言重启，screen21→22，GUIDE猫逻辑fps30、cat_us14、heap106K、audio codec打开。该fps非LCD实测展示帧率；屏幕变化证明已接受体验入口，但教学与全部触摸方向仍待用户反馈。不以单段日志声称启动竞态穷尽或整体整改完成。

## 状态

此前进度/矩阵“不烧写/未烧写”指各历史构建时点。本次新授权后已经烧录。整体整改Goal仍未完成：遇见桥接、全按钮、性能计数、App/ASR仍存在缺口。下一步需要观察实际屏幕并执行受控触摸测试，不能凭这段日志宣称整体验收通过。
