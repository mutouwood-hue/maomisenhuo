# 构建、烧写与使用

## 0. 当前状态

固件已在真机（ESP32-S3-Touch-AMOLED-1.75C，COM3）上跑起来。**首次上板就暴露了两个宿主机测试和编译都看不见的缺陷**（栈溢出、GAP 事件无人接收），两者都已修复并复验，见 0.1。本文把"已验证"和"未验证"分开写清楚。

| 已验证（真机实测） | 证据 |
|---|---|
| 面板点亮、触控注册 | `panel 466x466`、`CST9217 ... Resolution X: 466, Y: 466`、`Backlight on` |
| PSRAM 与 240 MHz | `Found 8MB PSRAM device`、`Speed: 80MHz`、`cpu freq: 240000000 Hz` |
| 启动完整走通 | 当前固件的启动日志顺序：`badge_hw: QMI8658 ready at 0x6B` / `AXP2101 ready at 0x%02X` → `badge_hw: hardware: ...` → `cat_view: canvas 466x466, framebuffer 434312 bytes @0x…` → `net/proto/social` 各模块的自述 → `app: up: cat=<名字> breed=<n> growth=<g> coins=<c> screens=23 elements=151`。**这一栏是按 `main/main.c` 与各模块的日志语句读出来的格式**；`app: ready`、`circle_paint: ...`、`pet_ui: UI built ...`、`canvas 320x320` 这些字符串属于**已被删除的旧 UI**（`pet_ui.c` / `circle_paint.c`），当前固件不会再打印，本会话**没有重新上板**去逐字核对 |
| 存档写入与读回 | 擦 NVS 后首启 `app: no save: using the specification's defaults`（或 `no save yet (ESP_ERR_NVS_NOT_FOUND)`）→ 播种后按 4 s 去抖写入；再启 `app: restored 小橘: growth 86, coins 30`。存档是 **33 字节定长**（`BADGE_PET_SAVE_BYTES`，`main/pet/badge_pet.h`），带版本字节，长度或版本不符即拒绝并回到默认值 |
| **ATT MTU 协商 = 247** | `net_link: ATT MTU negotiated: 247 (max frame payload 244)`，远高于协议所需 ~66 |
| BLE 广播可被外部发现 | 手机侧扫到服务 UUID `e7f1a000-…7a00`，GAP 名 `OrangeCat-3E3A` |
| GATT 服务与特征 | 外部读到 RX(`…7a01`, write) / TX(`…7a02`, read+notify) 两个特征 |
| 断开后重新广播 | `disconnected (reason 531)` → `GAP procedure initiated: advertise` |
| 无重启、无 panic | 连续观察 150 s，`rst:` 仅 1 次（那次复位），无 `ERROR`/`CORRUPTED` |

| 未验证（仍需条件） | 风险 |
|---|---|
| **双机真实握手** | 只有一块板子。宿主机已跑完整轮会话，但那是模拟链路；真实 NimBLE 上的分片、丢包、连接参数与回调时序仍未跑过。上板后仍应搜 `HELLO not deliverable yet` |
| 实际帧率 | ~~未测~~ 旧 UI 上测过：矩形版式 `15ms 30fps 52k`、圆屏版式 `16–20ms 28fps 28–29k`。**当前固件未重新上板测量。**观测点现在是常驻日志行 `app: PERF mode=… fps=… cat_us=… dirty=… px heap=…K screen=… q=…`，每 5 s（`APP_PERF_MS`）一行，**没有编译开关**（旧的 `PET_UI_PERF_LOG` 随 `pet_ui.c` 一起删除）。字段含义与旧数字的适用范围见 [`frame-budget.md`](frame-budget.md) §7–§8 |
| RSSI 档位阈值 | 仍是经验值，未按真机标定 |
| 刷新的 DMA 重叠效果 | 见 [`render-route.md`](render-route.md) §6 #3 与 [`frame-budget.md`](frame-budget.md) §3，未测 |
| 音频（二期） | 未启用 |

### 0.1 首次上板抓到的两个缺陷

> 完整取证记录（板子身份、两个缺陷的定位过程与被推翻的假设、三个开发确认项的实测结论、I2C 总线清单的复现方法）见 [`m1-hardware-verification.md`](m1-hardware-verification.md)。下面只留结论。

记录在这里是因为**它们的共同特征是"宿主机全绿、编译干净、上板必炸"**，而它们正是本文档反复强调的那一类：只有真机能证伪的假设。

1. **`pet_save_load()` 的 8192 字节局部数组撑爆 main 任务栈。**（**历史条目**：那个模块与它的 74 项单测都已不在当前树里——`main/pet/pet_save.*`、`tests/host/test_pet_save.c` 随旧内核一起被替换；现在的存档是 `app_save_load()` + `badge_pet_serialize()`，缓冲区是 **33 字节**的 `uint8_t blob[BADGE_PET_SAVE_BYTES]`，不再有这个问题。留着这条是因为它示范了一类只有真机能证伪的缺陷。）反汇编显示其栈帧 `entry a1, 0x2030`（8240 字节），而 `CONFIG_ESP_MAIN_TASK_STACK_SIZE=3584`。栈指针在开机第一次调用时就冲出栈底，**报出来的却是隔壁任务的账**：

   ```
   I (2467) app: panel 466x466
   ***ERROR*** A stack overflow in task esp_timer has been detected.
   Backtrace: ... 0x403892ce:0xa5a5a5a5 |<-CORRUPTED
   Rebooting...
   ```

   有意思的是"受害者不是真凶"：损坏的是相邻任务的金丝雀，所以提示指向 `esp_timer`，而 `esp_timer` 的 tick 回调只做一次 `lv_tick_inc`，根本不可能溢出。定位靠的是 `xtensa-esp32s3-elf-objdump -d` 读函数序言的 `entry` 帧大小，再与任务栈比较。修法是把缓冲区提升为文件级 `static`（成本落进 `.bss`，不再占任务栈），并加 `_Static_assert` 把"缓冲区小于格式"变成编译失败。

   > **这类缺陷宿主机测试原理上看不见**：PC 上栈是以 MB 计的。当时 `pet_save` 那 74 项单测全绿，而这个数组就在被测文件里。
   >
   > 那个模块的 `pet_save_save()` 有同一个数组（帧 8224 字节），它还跑在 LVGL 任务的 8192 字节栈上，同样溢出。

2. **GAP 事件没有任何接收方，于是"会面过一次之后永久不再广播"。** `ble_gap_adv_start(..., NULL, NULL)` 和 `ble_gap_disc(..., NULL, NULL)` 都传了 NULL 回调，而 `gap_event` 只挂在 `ble_gap_connect` 上——所以本机作为 **peripheral**（两块板子碰面的常态）时，连接事件、MTU 事件、断开事件、扫描结果**全部无人接收**。实测证据很直白：手机连上来读完 GATT，串口里**一行相关日志都没有**；走 central 路径时（那条挂了回调）日志却正常。注册全局 `ble_gap_event_listener` 后立刻能看到 `connected as peripheral`、`ATT MTU negotiated: 247`、`disconnected (reason 531)`。

   另一半在断开路径上：`case BLE_GAP_EVENT_DISCONNECT` 里 `if (!s_link.advertising) start_advertising();`，而 `advertising` 在整个连接期间都是 `true`。原因值得记下来，因为直觉是错的：**NimBLE 在连接建立时并不会发 `BLE_GAP_EVENT_ADV_COMPLETE`**（读 `ble_gap.c` 确认，它只由显式停播、广播超时和扩展广播路径触发），所以那个标志没人清，重新广播的闸门永远不打开。

   复现与验证用的是同一套外部观测（PC 侧 BLE + 串口）：

   | | 连接前扫描 | 连接 | 断开后扫描 |
   |---|---|---|---|
   | 修复前 | FOUND `7C:0C:5F:42:36:86` | 成功，MTU 247 | **NOT FOUND**（304 个广播里没有它） |
   | 修复后 | FOUND | 成功，MTU 247 | **FOUND** |

   也就是修复前 **近场社交每开机只能用一次**，之后板子静默失联、屏幕上却一切正常。

   另外把 `ble_gap_connect` 的回调一并改为 NULL：NimBLE 对连接事件是先调全局监听器、再调该连接自己的回调，两处都挂 `gap_event` 会让每个事件执行两次（`on_link_state` 双发、`start_advertising()` 双调）。

---

## 1. 工具链

| 组件 | 版本 | 位置 |
|---|---|---|
| ESP-IDF | v5.5.5 | `D:\Espressif\v5.5.5\esp-idf` |
| 工具链 | `xtensa-esp-elf` 14.2.0 | `C:\Espressif\tools\xtensa-esp-elf\...` |
| CMake | 3.30.2 | `C:\Espressif\tools\cmake\3.30.2\bin\cmake.exe` |
| Ninja | 1.12.1 | `C:\Espressif\tools\ninja\1.12.1\ninja.exe` |
| Python venv | 3.11.15 | `C:\Espressif\tools\python\v5.5.5\venv` |
| 激活脚本 | EIM 生成 | `C:\Espressif\tools\Microsoft.v5.5.5.PowerShell_profile.ps1` |

用 EIM（Espressif Installation Manager）装 IDF 时，激活脚本会一并生成；上面的路径就是本次安装的结果。换机器时改 `tools/build-firmware.ps1` 开头那几行常量即可。

---

## 2. 构建

```powershell
tools\build-firmware.ps1 build
```

这条脚本不是简单包一层 `idf.py`，它处理了五个会让构建**无声失败**的坑。前四个是环境/配置，第五个是真正的链接错误：

### 2.1 项目路径里的非 ASCII 字符 —— 必须用 ASCII 路径构建

项目在 `D:\黑客松`，路径里有中文。**Xtensa 工具链里有两个程序打不开用正斜杠写的中文路径**，而 CMake 在链接命令和自定义命令里一律写正斜杠。两者都在本机单独复现过，同一个路径换成反斜杠就成功：

1. **`ld`，打在 `esp_new_jpeg` 预编译库上**。这个库在**源码树**里：

   ```
   ld: cannot find D:/黑客松/managed_components/espressif__esp_new_jpeg/lib/
       esp32s3/libesp_new_jpeg.a: Invalid argument
   ```

   它在**最后一步链接**（2156/2158）失败——所有编译都过了才炸。那一次的数字见下（当时还开着 `FAST_MEM_USE_IRAM`，现在已关）：

2. **`objdump`，被 ldgen 调用来列出各组件归档的段**。它读的是**构建树**：

   ```
   objdump: D:/黑客松/build/esp-idf/xtensa/libxtensa.a: No such file or directory
   ```

   它在 2109 步失败，`sections.ld` 生成不出来。

3. 另有 python 工具用本地编码（GBK）读回自己写的 UTF-8 中间文件：`UnicodeDecodeError: 'gbk' codec can't decode byte 0xae`。

**所以源码和构建目录都必须是 ASCII。** 脚本的做法是：项目路径本来就是 ASCII 就地构建；否则先把源码镜像到 ASCII 路径 `D:\orangecat`（`robocopy /MIR`，排除 `build`、`.git`、`_ref`），在镜像里构建。

镜像**是一次性的**，每次构建都从真实源码重新生成，不需要手工同步——但也**不要编辑镜像**，改了会在下次构建时被覆盖。用 `-StageDir` 可以换镜像位置。

> 试过但**不行**的两条路，别重试：
> - **目录联结（junction）**：`idf.py` 用 `os.path.realpath()` 规范化项目目录，Python 3.8 起它走 `GetFinalPathNameByHandle`，会把 junction 解析回真实路径，等于没换。
> - **`subst` 虚拟盘**：同样被 `realpath()` 解析掉。
>
> 只有**在 ASCII 位置上真的存在文件**才有效。

### 2.2 ccache

ESP-IDF 在启用 ccache 时会把编译命令变成 `ccache <gcc> ...`。ccache 是 C++ 程序，Windows 上 `std::filesystem` 用 ANSI 代码页（GBK）转换窄路径，而项目路径是 UTF-8、GBK 表示不了，于是：

```
terminate called after throwing an instance of 'std::filesystem::__cxx11::filesystem_error'
  what():  filesystem error: Cannot convert character sequence: Illegal byte sequence
```

ninja 只会报 `build stopped: subcommand failed`，**完全不提是哪个文件**，很难定位。脚本传 `--no-ccache` 关掉它。

> 注意 `IDF_CCACHE_ENABLE` 是 click 的 flag 环境变量，任何值（包括 `"0"`）都算"开"。要关只能把它从环境里删掉，或显式传 `--no-ccache`。

注意 ccache 的问题在镜像方案下也**顺带消失**了（镜像路径是 ASCII），但脚本仍然传 `--no-ccache`：两个独立的坑，各修各的，不互相依赖。

### 2.3 CMake 在 Windows 上的 host 探测崩溃

`idf.py build` 的 CMake 配置阶段会在 `cmake.exe` **进程内部**崩溃，退出码 `3221226505`（`0xC0000409`，`STATUS_STACK_BUFFER_OVERRUN`），**不打印任何错误信息**，`CMakeConfigureLog` 里也没有记录。两处诱因，都已在仓库内修掉：

1. **libpng 的 `find_package(ZLIB REQUIRED)`**（`managed_components/espressif__libpng/libpng/CMakeLists.txt:141`）会走到 CMake 自带的 `FindZLIB.cmake`，它去**宿主机**上找 zlib 安装：

   ```cmake
   FindZLIB.cmake(108): set(_ZLIB_SEARCH_NORMAL
                           PATHS "[HKEY_LOCAL_MACHINE\\SOFTWARE\\GnuWin32\\Zlib;InstallPath]"
                                 "$ENV{ProgramFiles}/zlib" ...)
   FindZLIB.cmake(125): find_path(ZLIB_INCLUDE_DIR NAMES zlib.h ${${search}} PATH_SUFFIXES include)
   ```

   第 125 行那次 `find_path` 在 cmake.exe 内部崩掉。仓库内的 `components/find-zlib-shim/` 提供自己的 `FindZLIB.cmake`，经 `project_include.cmake` 插到 `CMAKE_MODULE_PATH` 最前面（CMake 先搜 `CMAKE_MODULE_PATH`，再搜自己的 `Modules/`），于是宿主机探测根本不会执行。

2. **FreeType 的 PNG 编解码器**（`managed_components/espressif__freetype/freetype/CMakeLists.txt:296`）走 `find_package(PNG)` → `FindPNG.cmake:68` 又调一次 `find_package(ZLIB)`。**这一次挡不住**：`FindPNG.cmake` 已经从 CMake 自己的模块目录加载，嵌套的 `find_package(ZLIB)` 也在那个目录里解析，不会经过 `CMAKE_MODULE_PATH`。所以只能在源头消除——根 `CMakeLists.txt` 里设 `FT_DISABLE_PNG=ON`。

   Espressif 自己的 freetype 组件已经关掉了 HarfBuzz / BZip2 / Brotli 三个可选编解码器，只漏了 PNG；本固件的界面只用 LVGL 的思源黑体子集（不是位图字体），不需要 PNG 编解码，所以关掉它既是修复也是本来就该做的配置。

   > 如果**将来**真要重开 FreeType 的 PNG（比如二期要显示 PNG 图片），配置阶段会立刻再崩一次，因为那条路只能从源头消除。备用方案已经写好并验证过：`components/find-zlib-shim/optional-FindPNG.cmake`。文件头部有安装步骤和实测输出，**当前没有安装**——按"关掉不需要的依赖"而不是"想办法满足它"来修是本项目的选择。

定位这两个坑的工具是 `tools/trace-cmake.ps1`：它用 `cmake --trace` 跑一遍配置，把每条语句执行前的回显写进日志——进程崩溃前最后一行就是崩掉的那条语句。`--debug-output` 做不到这点，因为它对崩溃不输出任何东西。

`tools/revert-cmake-hostprobe-guard.mjs` 是把早期一个**改机器上 CMake 安装目录**的临时补丁还原用的。那个补丁是诊断过程中的产物，现在不需要了；保留脚本是为了能确认本机 cmake 是干净的：跑一下，输出 `clean` 就说明没有被改过。

### 2.4 IRAM 溢出打爆异常向量（真正的链接错误）

**这不是环境坑，是配置错误**，症状是链接阶段：

```
xtensa_vectors.S:466:(.DebugExceptionVector.text+0x3):
    dangerous relocation: j: cannot encode: xt_debugexception
```

调试异常向量用 Xtensa 的短跳转 `j` 跳向处理器，而 `j` 只能编码 **±128 KB** 的 PC 相对偏移。原因是 `CONFIG_LV_ATTRIBUTE_FAST_MEM_USE_IRAM=y` 让 LVGL 把**几百个** `LV_ATTRIBUTE_FAST_MEM` 函数（blend / color / math 路径）放进 IRAM，占掉 341 KB IRAM 里约 105 KB，把处理器推到了向量够不着的地方：

| | `_DebugExceptionVector` | `xt_debugexception` | 距离 | ±128 KB 内？ |
|---|---|---|---|---|
| `FAST_MEM_USE_IRAM=y` | `0x40378280` | `0x4039a4e8` | **139,880** | **否**，差约 9 KB |
| `FAST_MEM_USE_IRAM` 未设 | `0x40378280` | `0x40380be0` | **35,168** | 是 |

只差 9 KB——**削 IRAM 把它凑进 128 KB 是能过的，但那会留下一个任何后续改动都能悄悄打破的预算**。所以改成关掉这个选项，`sdkconfig.defaults` 里有完整数字。

代价是 LVGL 的混合/色彩运算稍微变慢。这不影响帧率预算：瓶颈是猫的光栅化器，不是 LVGL 合成器（见 `docs/frame-budget.md`），而且光栅化器自己的热状态是 `components/cat3d` 主动放进内部 SRAM 的，不走这个开关。

### 2.5 在 PowerShell 里传 `-p`（一个会静默丢参数的坑）

```
tools\build-firmware.ps1 -p COM5 flash monitor
```

`-p` 是 idf.py 的串口参数，但 **PowerShell 会把 `-p COM5` 匹配到自己的公共参数 `-PipelineVariable`**，把 COM5 吃掉，而且**从 `$IdfArgs`、`$MyInvocation.UnboundArguments` 里都找不回来**——命令还"成功"退出，只是没带串口，烧到错误的地方还没有任何提示。

脚本因此显式声明了 `-Port`（别名 `p`）和 `-Baud`（别名 `b`）：**精确匹配优先于前缀匹配**，所以 `-p COM5` 现在能正确转发。其他 idf.py 短选项（`-v`、`-o`、`-e`…）同样有被公共参数前缀吃掉的风险，需要用它们时走 `-IdfArgs`。

脚本自己的参数也踩过一次：`$BuildDir` 一度允许位置绑定，于是 `build-firmware.ps1 build` 把 `build` 当成 `BuildDir`（还是合法的相对 ASCII 路径，守卫发现不了），idf.py 一个动作都没收到，结果**在项目目录里构建**——正好是那个参数存在要避免的事。现在用 `PositionalBinding = $false` 把位置参数只留给 idf.py。

### 2.6 生成的配置在哪里

构建在镜像里跑，所以 `sdkconfig` 在 `D:\orangecat\sdkconfig`，`sdkconfig.h` 在 `D:\orangecat-build\config\sdkconfig.h`，**都不在源码树里**。脚本每次构建都会把实际路径写进 `tools/.last-build.json`，供其他工具读取。

这一点很要紧：`tools/check-sdkconfig.mjs` 原本只看 `<项目>/sdkconfig` 和 `<项目>/build/...`，在镜像构建下这两个路径**永远不存在**，于是它打印"尚未生成"然后**通过**——一个找不到输入就报成功的守卫比没有守卫更糟，因为看起来在检查。现在它读路径记录，并且一旦有构建记录就**把文件缺失当失败**。反向测试确认过：把 `sdkconfig` 里的 CJK 字体改回 `is not set`，守卫立刻以退出码 1 报出当初那个 bug。

（顺带一个细节：PowerShell 5.1 的 `-Encoding UTF8` 会写 BOM，而 `JSON.parse` 拒绝开头的 U+FEFF。脚本改用 `UTF8Encoding($false)` 写无 BOM 的 JSON，读取侧也顺手剥掉 BOM，两边都不依赖对方的写法。）

### 2.7 构建产物与内存占用

```powershell
tools\build-firmware.ps1 size
```

实测（`idf.py size`，从镜像构建产出）：

| 分区/区域 | 已用 | 占比 | 余量 |
|---|---|---|---|
| Flash Data（`.rodata`） | 1,162,784 B | — | 主要是 6 张 128 KB 贴图 + 中文字体子集 |
| Flash Code（`.text`） | 722,472 B | — | |
| **DIRAM** | **136,555 B** | **39.96%** | **205,205 B** |
| ├ `.iram0.text`（IRAM 代码） | 107,463 B | 31.4% | |
| ├ `.dram0.data` | 19,352 B | 5.7% | |
| ├ `.dram0.bss` | 8,712 B | 2.5% | |
| └ `.iram0.vectors` | 1,028 B | 0.3% | |

| 文件 | 大小 |
|---|---|
| `orange_cat_pet.bin` | 2,020,512 B（应用分区 8 MB，约占 24%） |
| `bootloader.bin` | 22,272 B |
| `partition-table.bin` | 3,072 B |

> **这些字节数每次构建都会变**（镜像更大或更小、以及 ESP-IDF 把编译时间戳写进 `esp_app_desc_t`），所以它们是某一次构建的快照，不是预算。上面这一组取自 `dist/README.md`（那份产物的构建）；本文早先记的 2,013,264 B 是更早的一次构建——两者**不同是正常的**，DIRAM 占用两次一致（136,555 B / 39.96%）。要当前数字就重跑 `tools\build-firmware.ps1 size`。

**IRAM 余 200 KB 是刻意留的**，不是浪费：2.4 节那个 `j: cannot encode` 的错误正是 IRAM 挤满时触发的。40% 的占用意味着再加东西不会一碰到就炸，而且余量远大于当时差的 9 KB。

贴图占 `.rodata` 的一大块（6 × 131,072 = 786,432 B，直接嵌在镜像里）。这是**故意**的：六种品种一次烧进去，运行时按存档里的 `breed` 选一张，不需要文件系统，也不需要解码器。

本次构建的三个 `.bin` 已复制到 `dist/`（含烧写地址和 SHA-256，见 `dist/README.md`）。**`dist/` 是构建输出，不是源码**：它被 gitignore，里面的 `README.md` 由脚本生成，**不要手改**，也不要把它当作与本文同级的"文档"。分区表用 `gen_esp32part.py` 反向解析核对过与 `partitions.csv` 一致。整条构建 **0 警告、0 错误**（`main/`、`components/cat3d/`、`components/find-zlib-shim/` 开了 `-Wall -Wextra`，无输出）。

---

## 3. 烧写

```powershell
tools\build-firmware.ps1 -p COM3 flash monitor
```

`-p` 指定串口（设备管理器里看；本项目实测的板子是 **COM3**）；`flash` 写镜像，`monitor` 开串口监视（`Ctrl+]` 退出）。

只烧不监视（`COM5` 只是占位示例；本项目实测的板子是 **COM3**）：

```powershell
tools\build-firmware.ps1 -p COM3 flash
```

完整擦除后重烧（改过分区表时必须）：

```powershell
tools\build-firmware.ps1 -p COM3 erase-flash flash
```

### 分区表

`partitions.csv`：

| 分区 | 偏移 | 大小 | 用途 |
|---|---|---|---|
| `nvs` | 0x9000 | 32 KB | 三个命名空间：`petgame`（33 字节存档，`main/main.c`）、`badge_evt`（上行事件环形队列，`main/net/badge_events.c`）、社交层的图鉴与相遇记录（`main/net/net_social.c`） |
| `phy_init` | 0x11000 | 4 KB | 射频校准 |
| `factory` | 0x20000 | 8 MB | 应用 |
| `storage` | 0x820000 | 8 MB | SPIFFS，**为二期的语音/模型资源预留** |

Flash 总共 32 MB，已用约 16 MB，剩下的一半留着。

---

## 4. 使用

### 4.1 界面

当前固件的界面**不是一张固定版式**，而是规范里的 **23 个屏幕**（`badge_spec.json` 的 `screens`，生成成 `badge_screens[]`），一次显示一个；每个元素的坐标、文字、颜色都由生成的 `badge_els[]` / `badge_strings[]` 决定，没有手写的第二份版式：

| 屏幕（spec key） | 标题 | 元素数 |
|---|---|---|
| `main_a` / `main_b` / `main_c` | 主表盘 A（只有小猫）/ B（24 小时时间环）/ C（时间环 + 心动） | 12 / 8 / 8 |
| `aod` | 待机常显 | 2 |
| `care_menu` | 照料轮盘 | 10 |
| `care_feed` / `care_water` / `care_play` / `care_sleep` | 喂食中 / 喝水中 / 逗猫中 / 哄睡 | 4 / 4 / 4 / 3 |
| `sleeping` | 睡着了 | 2 |
| `status` | 状态（最大的一屏） | **27** |
| `settings` | 设置 | 15 |
| `touch_test` | 触摸自检（开发用，5 个靶点） | 9 |
| `voice` | 按住说话 / 唤醒后在听 | 3 |
| `meet` / `meet_tap` / `meet_scan` / `meet_done` | 遇见：附近有小猫 / 碰一碰确认 / 扫码确认 / 成为朋友 | 5 各 |
| `away` | 生活同步：小猫在外面 | 5 |
| `lowbat` / `boot` / `pair` / `guide` | 电量不足 / 开机 / 配对 / 首次引导 | 3 / 3 / 4 / 5 |

（元素数取自 `badge_spec.json` 的 `screens.*.els`，本会话核对过总数 151 = `BADGE_EL_COUNT`。）

### 4.2 操作

- **手势阈值来自规范**：`tapMaxMs 300`、`tapMoveMax 12`、`longPressMs 600`、`swipeMinPx 50`、`swipeMaxMs 500`（`badge_spec.json` 的 `timing` → `badge_numbers`），判定全部在 `badge_fsm_release()` 里。`main.c` 的输入回调只把 LVGL 事件翻成一个动词（press/move/release），**不在这里重新实现阈值**——否则同一个规则会有两份，被测的那份反而不可达。
- **照料与设置**：规范的 `act` 有 `care:feed` / `care:water` / `care:play` / `care:sleep`（四项照料）与 `set:bright` / `set:wake` / `set:discover` / `set:aod`（设置里的四个开关），以及 `hold`（如哄睡的"按住月亮 1.5 秒"，`sleepHoldMs 1500`）。
- **拒绝与冷却**：不可用的按钮变暗；操作被拒时弹 toast 说明原因，时长 `toastMs 1800`。
- **逗猫屏的羽毛跟着手指**：`main.c` 在按下期间把坐标镜像给 `badge_ui_touch()`，并因此请求整帧重绘——一根会动的羽毛没法用"元素自己的盒子"来重绘。
- **抬腕唤醒**：只在 QMI8658 真的应答时可用（`main/hw/badge_hw.c` 直接驱动它，因为 BSP 不提供 IMU API）；读不到时两个 IMU 特性都恒为假，徽章照常工作。
- **地点**：生活同步屏显示的是规范三个地点里的第一个（`APP_PLACE 0` = 工作），因为 App 目前不下发地点，见 [`render-route.md`](render-route.md) §9.4。

---

## 5. 帧率

**这一节只留运行时要用的三个事实，完整的预算、实测与调优顺序在 [`frame-budget.md`](frame-budget.md)。**（两处曾经各写一份，数字会漂移；现在不重复。）

| 环节 | 数值 | 出处 |
|---|---|---|
| LVGL 刷新周期 | 15 ms | `CONFIG_LV_DEF_REFR_PERIOD`（`sdkconfig.defaults`） |
| 应用定时器 | **10 ms（100 Hz）** | `APP_TICK_MS`（`main/main.c`） |
| 猫的重绘 | 按模式：desk 30 / play 30（233 半分辨率）/ comp 12 / aod 不渲染 | `badge_fsm_fps()` → `badge_cat_layer_tick()` → `cat_view_set_target_fps()`；规范 `modes.*.fps` |
| 观测点 | 每 5 s 一行 `app: PERF mode=… fps=… cat_us=… dirty=… px heap=…K …` | `app_perf_line()`（`main/main.c`，`APP_PERF_MS`） |

`dirty` 是**像素数**，不是 KB（旧 UI 的读数才是 KB，那个观测点已经随 `pet_ui.c` 删除）。`fps` 是自适应之后的**实际**重绘率，不是 tick 频率。

`PET_TICK_MS`、`CAT_VIEW_SIZE`、`PET_UI_PERF_LOG`、屏幕右上角那个 `渲染ms 帧率 合成KB` 读数**都已经不存在了**——它们属于被替换掉的那套 UI。要调帧率就改 `badge_spec.json` 的 `modes.*.fps`（重新生成表）或 `main/ui/badge_cat.c` 里的 `BADGE_CAT_FPS_*` 兜底值，顺序见 [`frame-budget.md`](frame-budget.md) §6。

---

## 6. BLE 近场社交

### 6.1 怎么用

两块板子靠近（大约 1 米内）→ 各自弹出"附近有一只小猫，要认识一下吗"→ 双方都点"认识一下"→ 交换品种、阶段、名字和一句破冰语 → 相遇记录存进各自的图鉴。

### 6.2 设计要点

- **同意在近距离时询问。** 信号（RSSI）分四档：`TOUCHING / NEAR / FAR / NONE`，带滞回避免抖动。
- **发起不泄露信息。** 靠近时自动发出的是匿名设备 id + 随机数，不含任何宠物数据；**对方的宠物信息只在机主点了同意之后才发**。
- **重放防御。** HELLO 和 ACK 带 8 字节 HMAC-SHA256 截断标签，接收侧维护 8 个 nonce 的环形表，旧帧直接丢弃。
- **标签的密钥是双方各自从"发送方设备 id"推导出来的，不是随机密钥。** 这一条是必须写清楚的，因为它决定了标签**能**证明什么：设备 id 是明文广播的，所以密钥不是秘密，标签**只**能保证"id、两个 nonce、标签这四个字段是一起由本协议产生的"，抓得出被截断、被改坏、被手工拼出来的帧；它**不**能证明对方是谁。
  早期版本用的是首次开机随机生成、存在 NVS 里的 32 字节密钥，签名和验签都用它。那看起来更强，实际是致命的：A 用自己的密钥签，B 用自己那把**不同**的密钥验，于是每一帧带标签的帧都被拒，真机上整个握手的第一个字节就死了。症状是"两块板子互相看得见，然后什么都不发生"——没有报错，日志里也没有任何指向原因的线索。**没有密钥交换时，只有两端都能推导出来的密钥才能工作**；在代码里装作有秘密不会让安全性变成真的。这一类缺陷编译器看不见、单机也复现不出来，这正是 6.4 那套宿主测试存在的理由。
- **不带标签的帧另有闸门。** CONFIRM / SUMMARY / ICE / BYE 不带标签，只有在"对方回显过本机生成的 nonce"之后才受理。这不是可选优化：没有它，一个伪造的 CONFIRM(0) 就能让对端在机主从未点过同意的情况下把自己的宠物信息发出去。
- **一个会话只发起一次。** `net_social_request_meeting()` 在会话进行中返回 `ESP_ERR_INVALID_STATE`，**并且**在"机主正在确认对方的请求"时也拒绝——后一条不能只看状态，因为待确认期间状态仍然是 `SCANNING`。少了它，一次双击或自动发起就会重新生成自己的 nonce，把对端正等着机主回答的那个会话拆掉，最后以 15 秒超时收场。超时后链路被断开，两端各自回到发现状态，谁先靠近谁重新发起。
- **HELLO 发不出去时会被重试，而不是被当成已发。** 这条不是优化，是发起方能发起会面的前提：作为 central，`BLE_GAP_EVENT_CONNECT` 里先启动异步 GATT 发现、再同步调用状态回调，所以回调里 `send_hello()` 运行时对端的特征句柄必然是 0，`net_link_send()` 返回 `ESP_ERR_INVALID_STATE`。旧代码不管返回值就把 `helloSent` 置真，于是**没有任何重试**，发起方为他从未发出的帧干等满 15 秒。现在帧被暂存（`helloPending`），由 poll 路径在句柄就绪后补发；`send_frame()` 的返回值在 HELLO 和 CONFIRM 两条关键路径上都被检查，不再被忽略。日志里的 `HELLO not deliverable yet` 就是这条路径在起作用。
- **会话的所有标志只在一个函数里重置。** `end_session()` 是唯一的出口。此前 BYE、链路断开、poll 超时三处各有一份手工维护的清单，而它们漂移了：只有超时分支清了 `has_active`，于是通过链路断开感知到会话结束的那一方永远清不掉它，**开机后再也无法发起或接受会面**。三份手工同步就是它漂移的原因，所以改成一份。
- **对端消失时，等待机主确认的提示会被收回。** 链路断开会在 `on_link_state` 里清掉 `has_pending`：一个关于"已经离开的对端"的提问不该继续留在屏幕上。
- **威胁模型写在头文件里。** `main/net/net_social.h` 顶部的 SECURITY NOTE 明确写了它**不是**抗有决心的攻击者：密钥可以从明文 id 推出来，攻击者能算出合法标签，所以这个协议**不提供双向认证**，不抗中间人，也**不提供机密性**（帧在 2.4 GHz 上是明文）。它买到的是重放防御和会话内一致性——这是诚实的说法。（更早的版本把头文件写成"用我们自己的设备密钥签名"，那听起来像认证，已改正。）ECDH / 二维码带外确认是二期。
- **帧长有硬上限，MTU 必须够。** 协议帧最大 220 字节，但一次 ATT 写只带 `MTU-3` 字节。ACK 26 字节、ICE 约 63 字节，所以 MTU 低于约 66 时握手根本走不完。`main/net/net_link.c` 显式请求 247，在 `BLE_GAP_EVENT_MTU` 里记录实际协商值，并在 `net_link_send()` 里对超长帧返回错误而不是让写操作静默失败。`net_social_accept_meeting()` 会把 ACK 的发送失败**回传**给 UI，而不是先把状态推进到"已接受"再等一个对方根本没收到的帧。**开机日志里那行 `ATT MTU negotiated: N` 是上板后第一个要看的东西。**

### 6.3 纯逻辑的宿主测试

协议里"与硬件无关"的部分（帧长校验、重放窗口、就近档位与滞回、UTF-8 安全截断、破冰语对称性）抽到了 `main/net/net_proto.c`，因此可以在 PC 上直接测：

```
node / tools\run-host-tests.cmd
=== net proto (pure BLE social core) ===
162 checks, 0 failure(s)
```

这一层值得单独存在的理由很直接：握手需要两块板子，而"两块板子碰面时才发现"的缺陷恰恰是最没法调试的那种。抽出来之后，`handle_confirm` 里那个"接受方永远不记录自己的 nonce"的缺陷（会导致**每一次**握手都超时）就是被这类测试的思路逼出来的——它由独立的代码评审确认，也因此补上了注释与测试。

冰破语那条测试断言的是**对称性**：两台设备必须独立选出同一句话。最早的实现按到达顺序哈希双方摘要、还混入了本机心情值，两边会选出不同的话；现在两个 `(品种, 阶段)` 对先做规范化排序，只哈希双方都知道的数据。

### 6.4 一次完整握手的宿主测试（两个设备，一台 PC）

6.3 只覆盖了纯函数。协议真正的难点在状态机，而状态机只有在两个实例互发消息时才跑得起来——于是有了第六个测试阶段：**编译真正的 `main/net/net_social.c`**，只用 `-I tests/host/idf_stub` 把 ESP-IDF / FreeRTOS / NVS / mbedTLS / NimBLE 的头文件挡掉，两个实例通过一个模拟链路互发。

```
=== net social handshake (two devices, one PC) ===
175 checks, 0 failure(s)
```

刻意**不**把传输接口在测试里重述一遍：`tests/host/net_test_link.c` 直接 `#include` 真正的 `main/net/net_link.h`，所以测试用的是固件里那份签名。重述会让测试慢慢漂移成在验证一份已经不存在的接口。HMAC 也是真的（对着 FIPS 180-4 和 RFC 4231 的向量核对），因为如果 SHA-256 是假的，所有标签比较都会通过，整个握手测试就什么都没证明。

覆盖的场景：一轮完整会面及其帧序（HELLO → ACK → CONFIRM → SUMMARY → ICE）；机主未同意前对端一个字节都不发；伪造 CONFIRM 打不开会话；接受方在收到 CONFIRM 后能自己走完；会话超时后回到扫描、且两端都不会卡死；重放帧被丢；重复发起被拒；待确认期间本机不能再发起；**连续两次会面**；**HELLO 被传输层拒绝后自行补发**；**ICE 帧带终止符**；相遇记录经 NVS 往返；超出距离时连不上；MTU 小于 ACK 时发送被拒且不推进状态。

**它抓到的"握手永远完不成"：**

1. 接受方从不记录**自己**的 nonce，于是它自己发的 SUMMARY/ICE 被自己的闸门丢掉。
2. `handle_hello` 的准入条件里混进了 `net_link_connected()`，而 HELLO 必然是在已连接时到达的——**100%** 的 HELLO 被丢，接受方永远不会弹出提示。
3. ACK 的 HMAC 输入缓冲区声明了 22 字节、只写了 20 字节、却按 `sizeof` 哈希了 22 字节。两端各自哈希了 2 字节未初始化的栈内存，标签永远不匹配。现在缓冲区长度直接从字符串字面量推导（`+ sizeof("ACK")`），写多少就哈希多少，用构造保证两者相等。
4. **发起方（central）的 HELLO 在真机上从来发不出去。** 这一条本套测试原本看不见，是第二轮独立代码评审读 `net_link.c` 读出来的：`BLE_GAP_EVENT_CONNECT` 里先 `discover_peer()`（异步 GATT 发现）、**紧接着**同步调用状态回调，而回调里 `send_hello()` 就跑了——此时对端的特征句柄还是 0，`net_link_send()` 返回 `ESP_ERR_INVALID_STATE`。旧代码不管返回值，照样把 `helloSent` 置真，于是**没有任何东西会重试**：发起方为一个从未离开射頻的帧干等满 15 秒。现在 HELLO 只在真的发出去之后才算已发；发不出去就暂存，由 poll 路径在句柄就绪后补发（`helloPending`）。
5. **`has_active` 在对端断开时不清。** 同样是第二轮评审读出来的，同样是本套测试原本看不见的：它只在 poll 的超时分支里被清。而"没输掉超时竞争"的那一方是通过**链路断开回调**得知会话结束的，那条路径清了除 `has_active` 以外的所有标志、并且把截止时间清零——于是它再也没有机会被清。结果是一块板子**开机后再也无法发起会面、也无法接受会面**：两块板子在一起，恰好其中一块永远说不出"你好"。修法是把三份各自维护的重置清单合并成**一个** `end_session()`——三份手工同步正是它漂移的原因。
6. **ICE 帧从不带接收方要求的终止符。** 发送端按 `strlen` 发、不含 NUL，而 `handle_ice()` 要求最后一个字节是 NUL，于是这一帧**每一次都被丢**。今天看不出来，因为 `net_icebreaker()` 是双方输入的纯函数、两边本来就会显示同一句话；真正坏掉的是"对端那句话能替换本机这句话"的能力，而这正是这一帧存在的全部意义，也是二期接 LLM 的挂点。
7. **ACK 发送失败会留下一张看不见的提示。** 机主点"认识一下"时，`main.c` 已经先把对话框收了起来，而失败路径保留了 `has_pending`——于是一张既看不见、UI 也无法撤销的提示，静默挡住这个对端后续所有的 HELLO，直到对方 15 秒超时断开链路才恢复。既然一个字节都没发出去，正确的状态就是空闲：立刻可以再次被找到。

第 3、6、7 处都说明这套测试值：它们是纯 C 层面的一致性问题，编译器不报（`-Wall -Wextra` 干净），只有让两端的字节真正对上、或者直接在线上核对字节，才会暴露。

它还纠正了两条**测试自己写错的期望**——值得记下来，因为它们是"测试在替缺陷说话"的例子：

- 会话超时后重新发起的是**对端**，不是发起方。A 超时 → 断开 → 这个断开同时把 B 的待确认提示清掉（关于已经离开的对端，那个提问不该留着）→ B 回到空闲、A 仍在范围内 → **B** 的自动发起送出第二个 HELLO。两个方向都是对的；原来那条断言写死了"第二个 HELLO 来自 A"。
- 原来还断言"超时后 A 再调用 `net_social_request_meeting()` 应当成功"。它能通过，仅仅因为当时这个函数**没有任何状态闸门**、会直接重启一个进行中的会话——也就是说断言把缺陷本身当成了正确行为。现在断言的是可观测性质：线路上确实出现了一个新会话，且 A 没有卡在已放弃的那个会话里。

**测试自己也要被验证。** 第 4~7 处的测试全部做过**变异检验**：把修复分别改回缺陷（去掉 HELLO 的重试、去掉 `has_active` 的重置、ICE 少发一个字节、失败时保留 `has_pending`），确认对应测试**确实失败**，然后改回来。这不是形式主义——第二轮评审明确指出，这套 130 项测试对前三个缺陷**全盲**（三种变异下 130 项全绿）。一个不会失败的测试只是假装在验证。改回缺陷时的实测结果：分别触发 4、2、5、1 项失败。

**这套测试仍然证明不了什么**：它用的是模拟链路，所以真实 NimBLE 上的分片、丢包、连接参数与回调时序都没跑过；第 4 处（HELLO 的发现竞态）尤其只有真机才能最终确认——**上板后请在串口日志里搜 `HELLO not deliverable yet`**，出现就说明重试路径真的在工作。RSSI 阈值也仍是经验值。真机验证仍然是必须的（见第 0 节）。

### 6.5 单机测试

只有一块板子时，串口日志与一个普通手机的 BLE 扫描就能验证广播、GATT 与断开恢复。以下是**实测做过一遍**的记录，不是待办清单：

- 串口应出现 `GAP procedure initiated: advertise` 与 `... discovery`
- 自己的广播不会匹配自己（设备 id 过滤）
- **广播里没有设备名。** 这一点最初写错了：`net_link.c:225-273` 是手工拼的广播包，只有 flags + 厂商数据（`COMPANY_ID=0xFFFF`，内容是 `[device_id 8][breed][stage][猫名]`），scan response 里只有 128 位服务 UUID——从来没有放过 name AD type。所以手机侧看到的 **local name 是空的**，`OrangeCat-XXXX` 只存在于 GATT 的 GAP Device Name 特征（`0x2A00`）里。实测：

  | 位置 | 实测值 |
  |---|---|
  | 广播 local name | 空 |
  | 广播 service UUID | `e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a00` |
  | GAP Device Name (0x2A00) | `OrangeCat-3E3A` |
  | 板子 MAC | `7C:0C:5F:42:36:86`（与串口 `Bluetooth MAC` 一致） |

  > 顺带一个可以直接观察到的结果：**宠物名字是在广播里明文发出的**。用扫描器读 `manufacturer_data` 的 0xFFFF 项，第 10 字节起就是那只猫的名字。这与 6.2 节"发起不泄露信息"的设计并不矛盾（未同意前只发匿名 id + nonce 的那套是另一条路径），但"广播里带着名字"值得知道。
- 连上之后应看到 `ATT MTU negotiated: 247`（实测值），这一行顺便验证了 GATT 服务注册与 CCCD 路径；两个特征是 RX `…7a01`(write) / TX `…7a02`(read+notify)
- **断开后必须重新广播。** 实测 `disconnected (reason 531)` 紧跟 `GAP procedure initiated: advertise`。这条曾经不成立，见 0.1 第 2 条——它是单机就能测出来的，而且当时正是单机测试暴露的。

---

## 7. 二期接口（AI 语音 / LLM）

**二期才做**，一期只把位置留出来，不写实现。三处接口已经预留：

1. **`storage` 分区 8 MB**（`partitions.csv`）：放语音提示音、TTS 模型、或压缩后的 LLM 资源。现在完全空着。
2. **音频硬件已就位但未初始化**：ES8311 编解码 + ES7210 麦克风 + PA 使能脚 GPIO46，引脚定义见 BSP。一期没有调用任何音频 API。
3. **破冰语是纯函数**：`net_icebreaker(mine, peer_breed, peer_stage, out, out_len)`（`main/net/net_social.c`）目前从 8 条固定中文句子里选一条，输入是双方品种/阶段。二期要接 LLM 时，替换这一个函数即可——协议帧格式不用动，因为 ICE 帧本来就是变长字符串。

设计上刻意**不**现在做语音，是因为它会牵动三件事一起变：麦克风采集与 VAD、网络请求的失败与超时处理、以及界面上的对话状态机。这三件都会改 UI，而 UI 的帧率预算已经很紧。

---

## 8. 目录结构

```
D:\黑客松                          源码（真身，在这里编辑）
├── CMakeLists.txt              项目入口（含 FT_DISABLE_PNG 的说明）
├── partitions.csv              分区表
├── sdkconfig.defaults          构建配置（含 FAST_MEM 与 IRAM 的完整数字）
├── components
│   ├── cat3d/                  软件 3D 光栅化器 + 六种品种贴图
│   │   ├── include/            cat3d.h、cat3d_assets.h
│   │   ├── data/               cat_model.h + tex_*.bin
│   │   └── src/                cat3d.c、cat_assets_esp32.c
│   └── find-zlib-shim/         Windows 上 CMake 崩溃的仓库内修复
│       ├── FindZLIB.cmake              生效中
│       ├── project_include.cmake       生效中
│       └── optional-FindPNG.cmake      备用，未安装（只重开 PNG 时才需要）
├── main
│   ├── main.c                  启动顺序、输入翻译、tick 顺序、PERF 行
│   ├── pet/                    care 内核与状态序列化
│   │   ├── badge_pet.[ch]      五项照料、拒绝规则、成长/喵币算术、33 字节存档
│   │   └── pet_state.[ch]      只留给无线层的旧词汇（广播包要从 pet_game_t 取字段，
│   │                           app_link.c 维护一份与 badge_game_t 同步的影子记录）
│   ├── ui/                     LVGL 界面、几何、绘制、状态机、猫层
│   │   ├── badge_ui.[ch]       图层顺序、文本控件、合成层、过渡
│   │   ├── badge_ui_plan.[ch]  哪些盒子变了（宿主可测，无 LVGL）
│   │   ├── badge_paint.[ch]    把元素画进 ARGB8888 画布（宿主可测真实像素）
│   │   ├── badge_geom.[ch]     元素的盒子、安全圆、文本度量（无 LVGL）
│   │   ├── badge_fsm.[ch]      23 屏的状态机：手势、模式、照料、彩蛋、上行事件
│   │   ├── badge_cat.[ch]      猫层：全分辨率 + 互动态半分辨率两个渲染器
│   │   ├── badge_spec_data.[ch] GENERATED：规范的全部表（勿手改）
│   │   ├── badge_assets.*.[ch] GENERATED：图标、提示音、字体访问器
│   │   ├── fonts/badge_f{16,20,24}.c、badge_n40.c  四个生成的子集字体
│   │   └── cat_view.[ch]       cat3d 的 LVGL canvas 宿主（脏矩形、自适应降帧）
│   ├── net/                    BLE 传输层 + 社交协议 + App 链路
│   │   ├── net_link.[ch]       广播/扫描/连接，GATT 收发，peer 表
│   │   ├── net_proto.[ch]      协议纯逻辑：帧、nonce 环、档位、破冰语（可宿主机测试）
│   │   ├── net_social.[ch]     会话状态机、同意闸门、NVS 记录（可宿主机测试）
│   │   ├── badge_events.[ch]   8 字节上行事件的深度 200 环形队列（见 badge-uplink.md）
│   │   └── app_link.[ch]       App 链路：把 badge_game_t 的影子喂给旧无线层
│   └── hw/badge_hw.[ch]        非显示硬件：IMU、PMIC、触摸边缘夹紧、codec/提示音
├── tests/host/                 宿主机测试（每阶段的清单见 render-route.md §10）
├── docs/                       本目录（见下）
├── dist/                       可烧写产物（本次构建的三个 .bin，见 dist/README.md）
├── tools/                      构建与检查脚本
│   ├── build-firmware.ps1      唯一的构建入口（镜像 + 构建，记录路径）
│   ├── run-host-tests.cmd      6 个具名阶段 + 按序执行 tools/suite/*.cmd
│   ├── suite/                  分阶段宿主机测试（00-spec … 07-pet）
│   ├── gen-badge-ui.mjs        规范 JSON → badge_spec_data.[ch]（--check 校验是否最新）
│   ├── gen-badge-assets.mjs    PNG/WAV → badge_assets{,_data}.c（--check 同上）
│   ├── check-badge-spec.mjs    规范 JSON 自检（每个键都被建模）
│   ├── check-font-coverage.mjs 字体子集覆盖守卫（见 badge-assets-integration.md）
│   ├── check-sdkconfig.mjs     配置守卫（防 defaults 被 sdkconfig 静默覆盖）
│   ├── compare-render.mjs      光栅化器 vs JS 参考实现
│   ├── gen-assets.mjs          从 .bbmodel 生成 cat_model.h 与 tex_*.bin
│   ├── render-cat.mjs          渲染单帧（调姿势用）
│   ├── anim-strip.mjs          导出动画帧序列
│   ├── contact-sheet.mjs       把多帧拼成一张对照图
│   ├── trace-cmake.ps1         CMake 崩溃定位
│   └── .last-build.json        上次构建的路径记录（由脚本生成）
└── docs/
    ├── build-and-usage.md      本文
    ├── frame-budget.md         帧率预算、脏矩形实测与调优顺序
    ├── render-route.md         渲染路线决策记录 + 已知偏差 + 宿主测试覆盖边界
    ├── badge-assets-integration.md 图标/音效/字体如何接入，以及字体覆盖
    ├── badge-uplink.md         与 App 的 8 字节上行事件协议
    ├── m1-hardware-verification.md M1 板实测：身份、缺陷、I2C 清单
    ├── hardware-buttons.md     两个物理按键的通路/读法 + PMIC 状态位的读错
    ├── porting-notes.md        HTML 原型 → 固件的规则对照与取舍
    ├── cmake-crash-evidence.md CMake 配置崩溃的取证记录
    └── gap-vs-v1.3.md / gap-vs-v1.5.md  历史差距清单（不再更新，只作历史引用）

D:\orangecat                      构建镜像（一次性，勿编辑；约 250 MB）
D:\orangecat-build                构建树（镜像产物、elf、bin；约 250 MB）
```

源码留在中文路径上也能正常编辑；只有**构建**需要 ASCII 路径，脚本会自动镜像。
