# M1 真机验证记录：首次上板的两个缺陷与三个硬件答疑

这份文档是**项目记忆**：记录 M1 板子第一次真正跑起来时发现的问题、判断依据，以及三个开发确认项的实测结论。它是证据记录，不是操作指南——怎么构建、怎么烧录见 `build-and-usage.md`。

留在这里的理由和 `cmake-crash-evidence.md` 一样：**"排除了什么"和"为什么是这个原因"比结论更耐用**，尤其是其中两条我一开始猜错、被测量推翻的假设。

> **当前已知偏差（有意保留）**：互动态（`play`）用 466 渲染器，不是规范 `modes.play.res == 233`。原因是 233 那套渲染器一建起来面板就画不出任何东西——证据、两个被推翻的错误结论、以及恢复它的前置条件都在 §0.1(b)。换来的是面板能画、且"猫很小"一并修掉。

---

## 0.1 用户看图报的三个缺陷（真机，已修）

用户拍屏报了三件事，都定位到根因并修好了。记在这里是因为三条都是**"照抄参考实现时抄错了层"**的同一类错误。

### (a) 小猫背后一直有一块方形亮斑

`cat3d` 的默认背景是一道近白色渐变（`#edf7f6 → #e4f0ee`，`cat3d.c:546-547`），移植时和光栅器一起从参考 HTML 抄了过来。但那道渐变是参考页面**网页本身**的背景——参考自己的 `.screen` 规则写的是 `background:#000`（`吧唧渲染参考.html:10`），猫的帧缓冲每次全量重绘都是 `R.fb.fill(0)`（同文件 `:395`）。规范里 `colors.bg` 也是 `#000000`。

而猫的帧缓冲是 **RGB565，根本没有 alpha 通道**，所以那块近白色是不透明的，直接盖住整块玻璃，底下的黑色背景永远透不出来。真机采样证实：表盘背景读出来是 `(218,214,239)`、`(232,215,223)` 这种近白，本该是黑。

修法：`cat_view_create()` 里显式 `cat3d_set_background(v->cat, 0x0000, 0x0000)`。黑色就是这里"透明"的正确替代——猫层是最底层，上面各层不画的地方本来就透，透出来的正是规范要求的黑。`cat_view.h` 里那句"猫周围的透明像素让后面的画面透出来"是错的（RGB565 没有透明），一并改掉了。

### (b) 那块方块"占满小猫本来的大小"，小猫本身变得很小

`modes.play.res == 233` 时固件渲染 233×233，`lv_obj_center()` 后 1:1 摆在 466 的玻璃正中：`cat_view` 的焦距按自己的视口算（`focal_length_px(res)`），所以 233 宽的渲染器把猫画成一半的像素，再接 1:1 显示，猫就成了半尺寸；而那块 233×233 的画布正好约等于猫的外接框，就是用户看到的"方块"。

参考实现说得非常明确：半分辨率开关的标签是 **"半分辨率 233→2×"**，`frame()` 里写着 `const sc=half?2:1`（`吧唧渲染参考.html:47, :261, :434`）。半分辨率省的是**像素填充量**（四分之一），不是把猫缩成四分之一大。

**但真正的缺陷比"没放大"更严重：互动态里第二套渲染器一建起来，面板就画不出任何东西了。**

这是本次唯一一个**只在某一个模式出现、因而绕过了先前所有测试**的缺陷。`.play` 用的是第二套 `cat_view`（233 渲染器 + 233 画布），而陪伴态/桌面态只用 466 那一套；先前每一份干净的 `PERF mode=desk fps=30` 日志都在证明"面板正常"，却没有一条来自互动态。

真机实测（`D:\orangecat-build` 构建、COM3 串口）：

| 时刻 | internal 空闲 | DMA 空闲 |
|---|---|---|
| 两个键初始化后 | 196,639 | 188,851 |
| 466 猫层建好后 | 175,467 | 167,679 |
| **233 猫层建好后** | **75,599** | **67,811** |

第二套渲染器建起来时内部 RAM 掉到 67,811 字节，然后**每一帧都失败**：

```
spi_master: setup_dma_priv_buffer(1214): Failed to allocate priv TX buffer
lcd_panel.io.spi: panel_io_spi_tx_color(405): spi transmit (queue) color failed
co5300_spi: panel_co5300_draw_bitmap(313): send color data failed
esp_lvgl:bridge_v9: Draw bitmap failed: ESP_ERR_NO_MEM
```

**先记下两个我一开始判断错、被测量推翻的结论**，因为它们比正确答案更能防止下一个人重走：

1. **"是 `lv_image_set_scale()` 用的 LVGL 图像变换通路太吃缓冲"——错。** 那一版是为了修"猫变小"加的 2× 缩放。第一次 A/B 看似支持这个结论（加缩放 474 个错误、去掉 0 个），但那次"去掉缩放"的运行**根本没进互动态**（mode 全是 desk，日志里连 `canvas 233x233` 都没有），所以它什么也没证明。把进入互动态的代码改成"每 tick 置一次、压在硬件轮询之后"（桌面态是粘性的，会被轮询改回来）之后重测：**已经去掉缩放的版本照样 472 个错误**，日志里 `canvas 233x233` 在。缩放从来不是原因。
2. **"第二个渲染器约 92 KB 的 `cat3d_t` 状态"——是把差值单独算的，那个差值实际还包含当时一起创建的整个 UI。** 页面在 233 渲染器建好后**才**创建 `badge_ui`（两份 434 KB 画布，此处在内部 RAM），两笔开销混在同一个差值里。哪一笔占多少没有分开测，**不要再引用那个 92 KB**。

**处置（已实施）**：`badge_cat.c` 的 `want_half_res()` 现在恒返回 false，互动态一律用 466 渲染器。代价写在函数上方的注释里，也记在这里：

- `modes.play.res == 233` **没有遵守**；
- `play.fps` 的 2× 倍率**没有尝试**（省不到那四分之三的像素填充）；
- 换来的是面板能画，并且**顺手修掉了"猫很小"**——因为 466 渲染器的焦距按 466 算，猫的大小回到规范相机 `dist=100` 的几何预期。

**实测确认**（强制进入互动态、且不带任何缩放）：`PERF mode=play fps=30`，`233canvas=0 dma_err=0 E-lines=0`。这是这块板子第一次在互动态画出画面。

**恢复这个模式的前置条件**：先腾出大约 30–90 KB 的 DMA 可用内部 RAM，并让 2× 在**渲染器自己的 blit 里**完成（参考就是这么做的：投影指向 233 视口，blit 把每个 texel 展开，不额外要缓冲），而不是在 LVGL 里放大。

留在这里的理由：**测量一旦做在错误的模式下，"修好了"和"更糟了"可以同时为真**——这也正是 §0.1(a)(b)(c) 三个缺陷的共同点。

### (c) 五种提示音一次都没响

`badge_fsm.c` 在 8 处往 `fsm->fx.sfx` 里累积提示音位（`BADGE_SFX_PET` / `CARE_DONE` / `MEET` / `WAKE` / `ERROR`），`badge_fsm.h:390` 也把 `badge_fsm_take_fx()` 写成取走这些效果的**唯一出口**。但**全工程没有一处调用它**，`badge_hw_audio_play()` 也只在 `badge_hw_test()` 里被 `(void)` 丢掉返回值。所以规范 `sounds` 里的五个音（pet/careDone/meet/wake/error）从来没在板子上响过一次；震动反馈也是跟着一起被丢掉的——也就是规范"没有马达 → 边缘光圈 + 提示音"这个兜底只剩一半。

修法：在 `main.c` 的 `app_tick_cb()` 每次 tick 调 `badge_fsm_take_fx()`，把 `sfx` 位映射成 `badge_hw_audio_play()`、把 `haptic` 交给 `badge_hw_haptic()`。放在 app 层是因为 `badge_hw` 拥有编解码器，而 `badge_ui.h` 的契约写明由 app 驱动；放在这里一次覆盖所有产生方（tick、手势、电台）。

**验证到什么程度**：调用链已接通、固件编译通过、真机 `hardware: ... audio=1` 表示编解码器初始化成功、`up:` 正常。但**是否真的出声没有耳朵验证过**——不要当成"已确认可听见"。

---

## 0. 板子身份（实测，非文档抄录）

| 项 | 实测值 | 怎么测的 |
|---|---|---|
| 串口 | **COM3**，`USB\VID_303A&PID_1001&MI_00`（原生 USB-Serial/JTAG） | 设备管理器 / esptool 连接成功 |
| 芯片 | ESP32-S3 (QFN56) rev v0.2 | `esptool flash_id` |
| Flash | GD **32 MB**，QIO | `esptool flash_id` |
| PSRAM | **8 MB** AP，80 MHz | 启动日志 `Found 8MB PSRAM device` |
| MAC | `7c:0c:5f:42:36:84`；BT MAC `7c:0c:5f:42:36:86` | 启动日志 |
| 出厂固件 | Waveshare `esp-brookesia` 手机演示（app 版本 `ac40993`，构建于 2026-01-14） | 首次上电日志 |

> 出厂固件在第一次整片 `erase_flash` 时被覆盖，**没有留备份**。当时提供过"先 dump 再刷"的选项，选择了直接刷。若要恢复，见 Waveshare 仓库 `Firmware/` 的工厂恢复镜像。

---

## 1. 首次上板抓到的两个缺陷

这两个缺陷的共同特征值得写在最前面：**宿主机测试全绿、编译零警告、上板必炸**。它们都属于"只有真机能证伪"的假设。

> **时代说明（2026-10-12 补）**：下面两个缺陷都发生在**已被替换掉的那套 UI** 上——`main/pet/pet_save.[ch]`、`main/ui/pet_ui.*`、`main/ui/circle_*.*`、`components/pet_ring/`、`tools/compare-ring.mjs`、`tools/ui-circle-*.py` 及 `tests/host/test_pet_save.c` / `test_pet_ring.c` / `test_pet_ui_geom.c` **都已不在当前树里**，被测文件本身也随之下线。**1.1 的结论仍然有效的是它的教训**（"栈帧大小只有反汇编/真机看得出"），不是那段代码；**1.2 的修复在当前 `main/net/net_link.c` 里仍然在位**（下面标注了对应行号）。本文保留原文，因为取证过程是项目记忆；引用时不要把它当成现固件的模块清单。

### 1.1 `pet_save_load()` 的 8192 字节局部数组撑爆 main 任务栈（历史模块）

**现象**——开机即重启循环，报出来的却是隔壁任务的账：

```
I (2467) app: panel 466x466
I (2467) pet_save: loaded ... (预期，但从未走到)
***ERROR*** A stack overflow in task esp_timer has been detected.
Backtrace: ... 0x403892ce:0xa5a5a5a5 |<-CORRUPTED
Rebooting...
```

**根因**——`pet_save_load()` 里有一个 `uint8_t buf[8192]`。反汇编它，函数序言是：

```
pet_save_load:      entry    a1, 0x2030     → 8240 字节栈帧
pet_save_save$part$0: entry  a1, 0x2020     → 8224 字节栈帧
```

而 `CONFIG_ESP_MAIN_TASK_STACK_SIZE` 在本仓是 **3584**。**编译器会在入口一次性分配整个帧**，与走哪条分支无关，所以栈指针在开机第一次调用时就冲出了栈底。

**为什么报的是 `esp_timer`**——受害者和真凶不是同一个任务。被踩坏的是相邻任务的栈金丝雀，于是提示指向了 `esp_timer`。而 `esp_timer` 的 tick 回调只做一次 `lv_tick_inc()`，本身不可能溢出——这条"显而易见的解释"是错的。

**为什么宿主机测试看不见**——PC 给测试进程以 MB 计的栈。`pet_save` 那 74 项单测全部通过，而那个数组就在被测文件里。

**修法**——把缓冲区提升为文件级 `static uint8_t s_blob[]`（成本落进 `.bss`，不再占任务栈），并用 `_Static_assert` 把"缓冲区小于格式"变成**编译失败**而不是运行时才发现。这不是"顺手加的护栏"：原来的写法是静默的，而这类缺陷的代价是开机就死。

**复验**——修复后 `pet_save_load` 的帧是 `entry a1, 48`，`pet_save_save` 无帧（用同款 `xtensa-esp32s3-elf-gcc` 对 HEAD 与当前版本分别 `-S` 取 `entry` 独立复现）。真机连续运行 150 s 只有 1 次复位（那次是我触发的），无 `ERROR`/`CORRUPTED`。

**顺带确认了尺寸模型**：擦掉 NVS 分区后首启打印 `pet_save: no save present`，重新播种；再启动打印 `pet_save: loaded 95 bytes` 并还原出同一只猫。`95 = 22 + 73`，与按 `pet_game_serialize()` 字段表独立推导的上界（固定 22 字节 + 每猫 73 字节）**分毫不差**，说明新加的 `PET_SAVE_MAX_BYTES` 与序列化器一致。

**现固件里这一类的状态**：存档改成了**定长 33 字节**（`BADGE_PET_SAVE_BYTES`，`main/pet/badge_pet.h`），`main/main.c` 的 `app_save_load()` 用的是一个小局部数组 + 版本字节校验，**再没有 8 KB 级的栈上缓冲**。也就是说 1.1 的隐患随模块一起消失了，不是被绕过。

### 1.2 GAP 事件没有任何接收方 → "会面过一次之后永久不再广播"（修复仍在当前代码里）

**现象**——手机连上来读完 GATT，串口里**一行相关日志都没有**；断开后板子**再也扫不到**。用 PC 侧 BLE 扫描复现得很干净：连接前能发现，连接后 20 秒内在 291/304/333 个广播设备里都找不到它。

**这一条比看上去严重**：修复前**近场社交每开机只能用一次**，之后板子静默失联，而屏幕上一切正常。

**两个独立原因叠在一起。**

**原因一：peripheral 路径上没有任何回调。** `ble_gap_adv_start(..., NULL, NULL)` 和 `ble_gap_disc(..., NULL, NULL)` 都传了 NULL 回调，而 `gap_event` 只挂在 `ble_gap_connect` 上。所以本机作为 **peripheral**（两块板子碰面的常态）时，连接事件、MTU 事件、断开事件、扫描结果**全部无人接收**。而走 central 路径（那条挂了回调）时日志正常——这正是"看起来没问题"的来源。

**原因二：断开路径的闸门永远打不开。** 断开处理是 `if (!s_link.advertising) start_advertising();`，但 `advertising` 在整个连接期间一直是 `true`。

这里**我的第一个假设是错的**：我原以为是 `BLE_GAP_EVENT_ADV_COMPLETE` 在连接时到达并漏处理。读 `ble_gap.c` 证实 **NimBLE 在连接建立时并不发这个事件**——`ble_gap_adv_finished()` 只由显式停播（2099/2105 行）、广播超时（3817 行）、3357 行和扩展广播（2617 行）触发。测量也支持这一点：加上监听器后事件如期到达，但广播依然没重启。

**正确的修法**——在 `BLE_GAP_EVENT_CONNECT` 成功分支里清掉 `s_link.advertising = false`，让断开时的闸门真的能打开。同时把 `ble_gap_connect` 的回调一并改为 NULL：NimBLE 对连接事件是先调全局监听器、再调该连接自己的回调，两处都挂同一个 `gap_event` 会让每个事件执行两次。

> **当前代码里的对应位置（本会话逐条核对过，修复仍在位）**：`main/net/net_link.c` 里 `ble_gap_adv_start(..., NULL, NULL)` 仍是 NULL 回调（第 310 行），但**全局监听器已注册**：`ble_gap_event_listener_register(&s_gap_listener, gap_event, NULL)` 在第 725 行，静态监听器变量在第 153 行；`s_link.advertising = false` 出现在 522 / 608 / 639 / 772 四处（连接建立、断开、停播、关闭各一条）。`ble_gap_connect()` 的调用点在第 914 行，其上方 907 行的注释正是"先调全局监听器、再调该连接自己的回调"这条理由。

**复验**——同一条外部观测链路，连跑两轮连接/断开：

| | 连接前 | 连接 | 断开后 |
|---|---|---|---|
| 修复前 | 可见 | MTU 247 | **NOT FOUND**（304 个广播里没有它） |
| 修复后 | 可见 | MTU 247 | **可见** |

串口侧出现了完整且成对的序列（两轮都是）：

```
I (27142) net_link: ATT MTU negotiated: 247 (max frame payload 244)
I (27203) net_link: connected as peripheral
I (35001) net_link: disconnected (reason 531)
I (35002) NimBLE: GAP procedure initiated: advertise;
```

`reason 531` = 对端（手机）主动断开的本地/远端用户终止。

---

## 2. 三个开发确认项（本次实测）

### 2.1 固件用 LVGL v9，不是 v8 —— 但依赖声明允许两者

**实测**：

| 证据 | 值 |
|---|---|
| `dependencies.lock` 锁定版本 | **`lvgl/lvgl` 9.5.0** |
| `managed_components/lvgl__lvgl/lv_version.h` | `LVGL_VERSION_MAJOR 9` / `MINOR 5` / `PATCH 0` |
| 构建树里**实际编译**的适配器桥 | 只有 `lvgl_bridge_v9.c.obj`（v8 的那个没被编） |

**但要指出的隐患**：`managed_components/…/idf_component.yml` 里写的是 `lvgl/lvgl: '>=8,<10'`。也就是说**依赖允许装上 v8**，而适配器会在编译期按实际装到的版本去挑 `bridge/v8/` 或 `bridge/v9/`。当前能跑是因为锁文件把它定在了 9.5.0；一旦有人升级/重解析依赖而落到 v8，桥会换成 v8，而我们的 UI 与 canvas 代码是照 v9 API 写的——**换掉会在编译期报错（好情况），或在造型/颜色格式上静默错位（坏情况）**。

**结论与建议**：M1 按 **LVGL v9** 开发；建议把依赖从 `>=8,<10` 收紧到 `9.*`，让"只能用 v9"变成构建期约束而不是口头约定。

### 2.2 触控坐标方向：由 BSP 默认配置 + 软件镜像决定，无标定

**配置（`bsp_display_start()` 的默认值，我们的固件直接用这个）**：

```c
.rotation = ESP_LV_ADAPTER_ROTATE_0,
.touch_flags = { .swap_xy = 0, .mirror_x = 1, .mirror_y = 1 }
x_max = BSP_LCD_H_RES = 466,  y_max = BSP_LCD_V_RES = 466
```

**方向是怎么生效的**：CST9217 驱动**没有**实现 `set_mirror_x`/`set_mirror_y`/`set_swap_xy`（驱动里只有 `read_data`），所以镜像由 `esp_lcd_touch` 核心用软件做：

```c
if (mirror_x && tp->set_mirror_x == NULL) x[i] = tp->config.x_max - x[i];
if (mirror_y && tp->set_mirror_y == NULL) y[i] = tp->config.y_max - y[i];
```

也就是**两个轴都翻转**，没有轴交换，旋转 0°。这解释了为什么原始面板方向需要翻转：驱动读到的坐标相对显示方向是镜像的。

**标定**：CST9217 是电容触摸，出厂完成，**没有也不需要运行时标定**，项目里也没有标定代码。`x_max/y_max` 只是告诉协议栈坐标量程，不是标定数据。

**一个诚实的缺口**：以上是**读代码得出**的，我**没有做"手指按左上角、看是不是左上角响应"的端到端确认**（那需要有人真去触摸）。方向结论的置信度很高（厂商默认配置 + 厂商例程同款），但它是推理不是测量。

**顺带发现的 1 像素边界问题（推理，未实测）**：镜像用的是 `x_max - x`，而 `x_max` 传的是 `466`（= `BSP_LCD_H_RES`）。若控制器上报范围是 `0..465`（惯例），镜像结果是 `1..466`——**多出 1 的越界值，且整体偏移 1 像素**。正确写法应是 `x_max - 1 - x`。视觉上察觉不到，但**圆形 UI 的贴边控件正好住在边界上**，所以值得记一笔。这是厂商 BSP 的既有行为，不是我们引入的，优先级低。

> **当前固件已经把它兜住了（本会话核对）**：`main/ui/badge_spec.h:93` 的 `badge_touch_clamp(int v)` 把坐标夹进 `0..465`（上界来自生成常量 `BADGE_TOUCH_MAX_SPEC 465`，`main/ui/badge_spec_data.h:115`），`main/main.c:258-259` 在把坐标交给状态机之前调用它，`main/ui/badge_fsm.c:205` 另有一份同语义的局部函数用于编辑/自检屏（984/1026/1064 行）。`main/hw/badge_hw.h:13` 也把这条写进了模块契约（"clamped to 0..465"）。也就是说：**BSP 仍可能返回 466，但固件不再把它当合法坐标**——对策在软件侧，而不是等厂商改 BSP。

### 2.3 震动马达 / 喇叭 / NFC：不能直接用，需外接

这三项没有靠文档推断，而是**在真板子上扫了 I2C 总线**（独立探针工程，只用 IDF 的 `i2c_master`，不经过 BSP，避免"BSP 没驱动"被误读成"硬件不存在"）：

| 地址（扫描实测） | 器件 | 结果 | `badge_hw.c` 里的 7 位地址 |
|---|---|---|---|
| `0x18` | **ES8311** 音频编解码器（喇叭通路） | ✅ 在总线上 | `0x30` |
| `0x34` | **AXP2101** 电源管理 | ✅ 在总线上 | `0x34` |
| `0x40` | **ES7210** 麦克风 ADC | ✅ 在总线上 | `0x80` |
| `0x5A` | **CST9217** 电容触摸 | ✅ 在总线上 | `0x5A`（BSP 持有） |
| `0x6B` | **QMI8658** 六轴 IMU | ✅ 在总线上 | `0x6B` |

（`0x18`/`0x40` 与 `0x30`/`0x80` 是同两个器件的不同地址形：`0x18 << 1 = 0x30`、`0x40 << 1 = 0x80`。扫描记录的原始应答值是实测；换算关系是解释。）

```
-- 5 device(s) responded --
ABSENT  0x41  ES7210 (alt addr)
ABSENT  0x6A  QMI8658 (addr 0x6A)
(none -- every responder is a part the BOM names)
=== probe done: 5 responded, 2 expected-missing, 0 unexpected ===
```

**0 个意外器件**——这条本身就是答案：总线上**没有** NFC 前端、没有触觉驱动、没有任何 BOM 之外的芯片。

**震动马达：不能用，必须外接。**
- 马达不可能挂在 I2C 上（要靠 GPIO / PWM / 触觉驱动），而总线扫描里也没有任何触觉驱动（DRV2605 之类）。
- 板卡 BSP 完全没有马达相关定义；厂商公开的硬件概览（屏 / 触摸 / 电源 / IMU / 音频）也不含马达。
- **一个误导线索要排除**：仓库里 vendored 的 `SensorLib` 在它的支持列表里列了 `DRV2605 Haptic Driver ✔️`。那是**该库通用支持的芯片清单**，不是这块板的 BOM——`README.md:30` 同一张表里还列着十几种这板上没有的芯片。差点据此判断"板载触觉驱动"。
- 结论：与企划一致（`notion-v1.5.md`："震动需外接马达，未加装前以动效 + 提示音替代"）。

**喇叭：音频通路齐全，而且当前固件已经接上了（这一点与早先记录不同）。**
- **测到的**：ES8311 在总线上应答；BSP 提供 `bsp_audio_codec_speaker_init()`，并以 **GPIO46 作为功放使能**（`pa_pin = BSP_POWER_AMP_IO`）；`BSP_CAPS_AUDIO_SPEAKER = 1`。
- **我们这边的状态（2026-10-12 核对 `main/hw/badge_hw.c`）**：**不再是"零调用"**。`badge_hw_init()` 调用 `bsp_audio_codec_speaker_init()`（第 306 行），起一个名为 `badge_audio` 的任务（栈 3072、优先级 4，第 309 行），`badge_hw_audio_play()` 通过 `esp_codec_dev_open/set_out_vol(80)/write` 播放规范里那 5 段 16 kHz 单声道提示音（`badge_pcm()` 取样本）。它失败时的降级是**静默而不是崩溃**：`{"no speaker codec; prompt sounds stay silent"}` / `"could not start the audio task; prompt sounds stay silent"`（第 308/310 行），`badge_hw_summary()` 里的 `audio=` 位会显示 0。**本文早先写的"`main/` 里对 `bsp_audio` / `esp_codec` / `i2s` 零调用"已过期**；`gap-vs-v1.5.md:72` 那条同样只作历史。
- **没测到的**：I2C 上看到一个编解码器**不能证明喇叭本体焊在板上**（换能器不是 I2C 器件）。厂商公开的硬件描述只提"双麦克风阵列"，没提扬声器；而企划文档写的是"板上只有喇叭焊盘，外接 8Ω 小喇叭"。**所以"是否需要自行加装喇叭"是机械问题，需要看板或问厂商确认，我不能从总线扫描里回答它。**（本会话也没有上板听声音。）
- 结论：**音频软件已实现**（驱动现成、引脚明确、提示音已接线），硬件上仍按"要外接喇叭"准备。

**一处需要统一的地址记法**：下一节 I2C 扫描表里写 ES8311 在 `0x18`、ES7210 在 `0x40`，而 `main/hw/badge_hw.c` 的注释写的是 ES8311 `0x30`、ES7210 `0x80`。两者不是冲突而是**同两个器件的不同地址形**——`0x18 << 1 = 0x30`、`0x40 << 1 = 0x80`（即 8 位写地址与 7 位地址的关系）。为避免下一次再被绕住，**本文档统一按 `badge_hw.c` 的 7 位地址记**：ES8311 `0x30`、ES7210 `0x80`、AXP2101 `0x34`、CST9217 `0x5A`、QMI8658 `0x6B`。（这是根据两组数字的换算关系做的解释，不是重新扫过总线；扫描记录的原始 5 个应答地址仍是实测。）

**NFC：不能用，必须外接。**
- I2C 总线上没有任何 NFC 前端（PN532 / NT3H / ST25 之类），0 个意外器件。
- 与企划一致（`notion-v1.5.md`："外接 I²C NFC 模块；未加装前以扫码配对兜底"）。**实测确认了"未加装"这个前提。**

**顺带纠正一个容易误判的地方：IMU 不是"没有"，而是"BSP 不管"——而且现在真的接了。**
- `BSP_CAPS_IMU = 0`，BSP 头文件里也没有 IMU API——很容易读成"这块板没有 IMU"。
- 实际上 **QMI8658 就在 `0x6B` 上应答**。厂商的 IMU 例程走的是**独立组件 `waveshare/qmi8658`**（见 `examples/esp-idf/04_Immersive_block/idf_component.yml`），不是 BSP。
- **我们这边的状态（2026-10-12 核对）**：`main/hw/badge_hw.c` **不走厂商组件**，而是用 `i2c_master` 直接读写 QMI8658：`WHO_AM_I` 必须是 `0x05`（`QMI_ADDR 0x6B`、`QMI_WHO_VALUE 0x05`），然后复位 + 加速度计 1 kHz / ±4 g + 低通。`az > 0.85 g` 判"平放"（desk 态触发），`az < 0.55 g` 判"被拿起"，且必须持续 `RAISE_HOLD_MS 400` ms 才算抬腕——否则挂在挂绳上的徽章走一步就唤醒一次。慢输入 500 ms 轮询一次（`POLL_MS`），避免在触摸控制器同一条总线上每秒发 60 次读。WHO_AM_I 不对就整块不用（打印 `QMI8658 WHO_AM_I says 0x%02X (expected 0x05); ignoring the IMU`），两个 IMU 特性恒为假、徽章照常工作。
- 也就是说：企划要的"抬起唤醒"**已经实现且会优雅降级**；"倾斜视差"不是这个模块做的（`badge_cat.c` 用 IMU 的话另说，本文未核）。

---

## 3. 仍未验证（不要当成已验证）

> 下面这一节的"未测"分成两类，**不要混读**：**（a）到今天仍未测的**（功耗、续航、温升、双机真实握手、机械问题、RSSI 标定、DMA 重叠）；**（b）在本文写作时未测、但后来已经改掉的**（帧率读数与观测点、以及"音频零实现"）。每条都直接标了属于哪一类。

- **双机真实 BLE 会面**：只有一块板子。宿主机 175 项握手测试用的是模拟链路；真实 NimBLE 上的分片、丢包、连接参数与回调时序仍未跑过。上板后首要观测点是 `HELLO not deliverable yet`。
- **实际帧率（属于 b）**：旧 UI 上测过（2026-10-10，就是这块板子）：矩形版式 `15ms 30fps 52k`、圆屏版式 `16–20ms 28fps 28–29k`；屏幕上那处 `渲染ms 帧率 合成KB` 观测点随状态栏一起被移除。**当前固件的观测点是 `app: PERF mode=… fps=… cat_us=… dirty=… px heap=…K screen=… q=…`**（每 5 s 一行，`main/main.c` 的 `app_perf_line()`，没有编译开关），**这套 UI 尚未在板上量过**。旧数字属于已删除的 `pet_ui.c` / `circle_paint.c`，适用范围与字段含义见 [`frame-budget.md`](frame-budget.md) §7–§8。仍未测的是**功耗/温升/续航**（属于 a）。
- **触摸方向的端到端确认**：见 2.2，需要真手指按一个已知角落（属于 a；但 1 像素越界已在软件侧夹住，见 2.2 末）。
- **2.2 的 1 像素越界是否真的会发生**：是代码推理，未在硬件上观察到（属于 a）。
- **喇叭是否板载**：见 2.3，机械问题（属于 a）。
- **RSSI 档位阈值**：仍是经验值，未按真机标定（属于 a）。
- **刷新的 DMA 重叠效果**：见 [`render-route.md`](render-route.md) §6 #3 与 [`frame-budget.md`](frame-budget.md) §3（属于 a）。
- **音频是否真的出声（属于 b 的一半）**：**软件已接**（`badge_hw_audio_play()` → ES8311，见 2.3），但本文写作时没有上板听；本会话也没有上板。**"接了"与"听到了"是两件事**，后者待验证。
- **NFC、马达**：仍是二期/外接，当前固件零实现（属于 a，且是刻意的：`BADGE_HW_MOTOR 0` / `BADGE_HW_NFC 0`，规范的回退路径是边环闪光 + 提示音，`badge_hw_haptic()` 里那个 motor 分支被编译掉）。

---

## 4. 怎么复现 I2C 清单

探针是一个**仓库外**的一次性工程（不改仓库、不进固件），只用 IDF 的 `i2c_master` 驱动：

- 位置：`D:\i2cscan`（ASCII 路径），构建树 `D:\i2cscan-build`
- 引脚取自 BSP：`BSP_I2C_SCL = GPIO14`、`BSP_I2C_SDA = GPIO15`
- 逻辑：遍历 `0x08..0x77` 用 `i2c_master_probe()` 逐个探测；再对 BOM 期望地址单独报一次 `ABSENT`（**"没应答"才是这里的重点**，只打印命中会读成"一切正常"）；最后列出所有**非预期**应答者

```
idf.py -B D:\i2cscan-build set-target esp32s3
idf.py -B D:\i2cscan-build -p COM3 flash monitor
```

跑完记得把项目固件刷回去（`dist/` 里那三个镜像）。探针的 `printf` 用的是 `printf` 而非 `ESP_LOGx`，所以不受日志级别影响。

---

## 5. 两个物理按钮

板子右侧有两个按键，**两个都能用，但走两条不同通路**：上键（表冠侧）接 AXP2101 的 PWRON、不占 GPIO；下键（椭圆）接 ESP32-S3 的 GPIO0（BOOT）。**长按上键会直接硬件断电**（实测：按住期间板子从 USB 上消失，阈值未测准，手册默认 6 s）。

**详见 [`hardware-buttons.md`](hardware-buttons.md)**——那里有通路归属的实测日志、寄存器位表（出自厂商数据手册）、长按/短按的判定时机、`badge_hw.c` 状态位读错的完整证据与修法，以及探针的复现命令。

> 本节只留指针，不再复述结论：同一组事实写两处必然漂移，而那两个文件里存的哈希与行号都只能对上一处。
>
> 一句必须留在这里的话，因为它已经修了：**`badge_hw_usb_present()` 曾经读 `0x49` bit3（电源键短按，`RW1C`），而不是 VBUS**——真机实测 USB 插着时该位为 0，一旦按下上键就被锁存成 1 且无人清除，而它直接喂 `badge_fsm_set_power()` 的桌面态判据。现在读 `0x00` STATUS1 bit5（电平），并且顺手把两个键接进了玩法。全部细节见 [`hardware-buttons.md`](hardware-buttons.md) §4.4 与 §6。
