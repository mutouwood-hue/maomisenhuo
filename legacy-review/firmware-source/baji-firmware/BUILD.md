# 吧唧固件 构建说明（ESP32-S3-Touch-AMOLED-1.75C）

> **本包的验证状态**：由当前工作树快照生成（**不是**某一次 git 提交）。打包时完成了三项完整性检查：
> ① `managed_components/` 19 个组件与 `dependencies.lock` 一一对应且都带 `.component_hash`；
> ② `main/CMakeLists.txt` 列出的 33 个源文件与磁盘逐一对应，既无缺失也无未登记（`tools/check-cmake-sources.py` 通过）；
> ③ `firmware-v2/component.cmake` 引用的全部源文件、include 目录、`render/generated/*.c` 与 `main/ui/fonts/*` 均存在。
>
> **没有在本机重跑完整 `idf.py build`**（完整构建约 15 分钟/变体）。首次构建请按下面第 0–2 节执行；第 0 节的 ASCII 路径要求是最容易踩的坑。

本包是「吧唧」徽章固件的完整可构建源码快照，包含两套并存的固件实现：

| 路径 | 内容 | 何时编译 |
| --- | --- | --- |
| `main/` `components/` | 一版完整 badge UI 固件（规格驱动 UI + 3D 猫 + BLE/社交 + OTA） | 默认（不带 `BAJI_V2`） |
| `firmware-v2/` | V2 独立重做：手势/教学/页面合成/电源/PMIC/BLE transport/更新/社交策略 | `-DBAJI_V2=ON` |

`main/CMakeLists.txt` 第 1–4 行按 `BAJI_V2` 分流：置 ON 时整个 `main/` 让位给 `firmware-v2/component.cmake`，两者不会同时参与链接。

已验证的构建环境：**ESP-IDF v5.5.5、target `esp32s3`、NimBLE + LVGL 9.5.0**（`dependencies.lock` 锁定了 19 个托管组件）。

---

## 0. 两条硬性前提（不满足就一定失败）

### 0.1 项目路径必须是纯 ASCII

`ld` 与 `objdump` 在 Windows 上无法打开含非 ASCII 字符、且以正斜杠写出的路径（CMake 生成的每一条 link / custom command 都是正斜杠）。症状极具误导性：

- `ld: cannot find D:/<中文>/managed_components/espressif__esp_new_jpeg/lib/esp32s3/libesp_new_jpeg.a: Invalid argument`
  → 在 **2156/2158** 步、所有编译都成功后，link 阶段才炸。
- `objdump: D:/<中文>/build/esp-idf/xtensa/libxtensa.a: No such file or directory`
  → 在 **2109** 步炸掉 `sections.ld` 生成。

因此：**把本包解压到纯 ASCII 目录**，例如 `D:\baji-firmware`、`C:\work\baji`、`/opt/baji`。
不要解压到 `D:\黑客松\...`、`C:\Users\张三\...` 这类路径。

### 0.2 构建目录也必须是 ASCII，且在工程之外

`idf.py build -B <dir>` 的 `<dir>` 同样要纯 ASCII，并且不要放在工程目录内。
本工程原始宿主用 `D:\orangecat-build`（V2/M2 用 `D:\orangecat-m2-build`），可以直接沿用或换成任意 ASCII 路径。

Windows 上另外建议（原始宿主实测必需，避免 GBK 环境下 UTF-8 往返失败）：

```powershell
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
$env:LC_ALL = 'C.UTF-8'
Remove-Item Env:\IDF_CCACHE_ENABLE -ErrorAction SilentlyContinue   # ccache 开关型变量，置 0 也算开
```

若因故必须在非 ASCII 路径就地构建，请追加 `--no-ccache`：ccache 用 `std::filesystem`，在 Windows 上按 ANSI 代码页转换窄路径，遇到 UTF-8 中文路径会抛 `filesystem error: Cannot convert character sequence: Illegal byte sequence`，而 Ninja 只报 “build stopped: subcommand failed”，看不到真正原因。

---

## 1. 安装 ESP-IDF v5.5.5

官方安装方式二选一。**版本文本必须对齐 v5.5.5**（低版本可能缺少 `esp_lcd_co5300` / LVGL 9 adapter 所需 API）。

### 方式 A：ESP-IDF Installation Manager（原宿主用的就是它）

本包根目录保留了原始宿主的 `eim_config.toml`（含其本机绝对路径，仅作参照，不要照抄路径）：

```powershell
# Windows
winget install Espressif.EIM
eim install --idf-versions v5.5.5 --targets esp32s3
```

### 方式 B：git clone + 官方安装脚本

```bash
git clone -b v5.5.5 --recursive https://github.com/espressif/esp-idf.git
cd esp-idf
./install.sh esp32s3          # Linux / macOS
# .\install.ps1 esp32s3       # Windows PowerShell
. ./export.sh                 # Linux / macOS 激活环境
# . .\export.ps1              # Windows 激活环境
```

激活后自检：`idf.py --version` 应输出 `ESP-IDF v5.5.5`。

---

## 2. 构建

```powershell
cd D:\baji-firmware          # ← 必须是纯 ASCII 路径
$env:PYTHONUTF8 = '1'
idf.py -B D:\baji-build -DBAJI_V2=ON build
```

- `-B` 指定 ASCII 构建目录；不指定则默认落在工程内的 `build/`（工程路径 ASCII 时也可以）。
- `-DBAJI_V2=ON` 构建 V2 镜像；去掉它则构建经典 badge UI 固件。
- `target` 已在 `sdkconfig.defaults` 里写死 `CONFIG_IDF_TARGET="esp32s3"`；如遇提示再补 `idf.py set-target esp32s3`。
- 首次构建会依据 `dependencies.lock` 核对 `managed_components/`（见下节），随后编译约 2100+ 个编译单元。

产物：`<build-dir>/orange_cat_pet.bin`、`bootloader/bootloader.bin`、`partition_table/partition-table.bin`。
查看占用：`idf.py -B D:\baji-build size` 或 `size-components`。

### M2 变体（独立 sdkconfig + 独立 OTA 分区表）

```powershell
idf.py -B D:\baji-m2-build -DBAJI_V2=ON `
       -DSDKCONFIG=D:\baji-firmware\sdkconfig.m2 `
       -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;sdkconfig.m2.defaults" build
```

`SDKCONFIG` 与构建目录都必须在 ASCII 路径下。M2 的刷写属于单独评审过的有线迁移流程，不要直接 `flash`。

---

## 3. 烧录 / 监视（可选）

```powershell
idf.py -B D:\baji-build -p COM5 flash monitor     # Windows
idf.py -B D:\baji-build -p /dev/ttyUSB0 flash monitor   # Linux
```

> **PowerShell 陷阱**：`tools/build-firmware.ps1` 用 `[CmdletBinding()]`，PowerShell 会按前缀匹配公共参数，`-p COM5` 会被 `-PipelineVariable` 吞掉且不留痕迹，命令“成功”但端口丢失、烧到别处。该脚本已显式声明 `-p` / `-b` 覆盖（别名精确匹配优先于前缀匹配）。直接调 `idf.py` 时无此问题。

---

## 4. 关于 `managed_components/`（本包已内置，约 233 MB）

已按 `dependencies.lock` 逐一对齐（19 个组件，各自带 `.component_hash`），**因此构建不需要访问 ESP Component Registry，可离线编译**：

```
espressif/button  espressif/cmake_utilities  espressif/esp_codec_dev  espressif/esp_io_expander
espressif/esp_lcd_co5300  espressif/esp_lcd_panel_io_additions  espressif/esp_lcd_touch
espressif/esp_lv_decoder  espressif/esp_lv_fs  espressif/esp_lvgl_adapter  espressif/esp_mmap_assets
espressif/esp_new_jpeg  espressif/freetype  espressif/knob  espressif/libpng  espressif/zlib
lvgl/lvgl  waveshare/esp32_s3_touch_amoled_1_75c  waveshare/esp_lcd_touch_cst9217
```

- 想减小体积：删掉整个 `managed_components/`，联网状态下组件管理器会按 `dependencies.lock` 重新下载（版本不会漂移）。
- 若构建时报 “component version mismatch”，说明本目录被改动过，删除后联网重建即可。

---

## 5. 本包未包含的内容

| 未包含 | 原因 | 如需请自取 |
| --- | --- | --- |
| `build/` `dist/` | 构建产物与历史烧录镜像（`dist/orange_cat_pet.bin` 等） | 重新构建即可 |
| `_ref/`（约 398 MB） | 第三方参考（Waveshare 原厂示例、LVGL/ws-components）与规格快照、Notion/PRD 抓取 | 与固件编译无关；仅当**重新生成** `main/ui/badge_spec_data.c`、`main/ui/badge_assets_data.c`、`main/ui/fonts/*`、`firmware-v2/render/generated/*` 时才需要：`tools/gen-badge-ui.mjs`、`tools/gen-badge-assets.mjs`、`firmware-v2/tools/generate_font16.py` 会读 `_ref/baji-spec/吧唧交互规范/` |
| `backend/` | 云端后端（Node ESM + SQLite + `.aimeta` 契约产物），独立于固件 | 单独索取 |
| `mobile-pet/` | 安卓 App（Capacitor 8 + 原生 BLE/定位插件），见另一个包 | 见 `warm-paws-town-android` 包 |
| 信任根 PEM、设备私钥、`build/m2-device-private/` | 由产线在仓库之外提供；`firmware-v2/component.cmake` 对空值 fail-closed，不会隐式链接测试密钥 | 产线流程 |

生成的字体/资源 `.c` 文件（`main/ui/fonts/*`、`main/ui/badge_assets_data.c`、`firmware-v2/render/generated/*`）**已经包含在包内**，文件头注释里残留的是原始宿主的绝对路径，只出现在注释里，不影响编译。

---

## 6. 可选：工程自带的检查与测试

这些不是构建的必经步骤，且其中若干脚本按原宿主工具链绝对路径写死，换机后需要改路径。

```powershell
# 主机侧回归（MSVC / gcc）
tools\run-host-tests.cmd

# firmware-v2 纯 C 核心 + Xtensa 对象编译
firmware-v2\tools\test-core.ps1
firmware-v2\tools\test-m2.ps1
firmware-v2\tools\test-peer.ps1
firmware-v2\tools\test-transport.ps1

# 一致性门禁（Node / Python）
node tools\check-sdkconfig.mjs
node tools\check-font-coverage.mjs
python tools\check-cmake-sources.py
```

换机后需要改的硬编码路径：

- `tools/build-firmware.ps1`：第 95 行 `$profileScript = 'C:\Espressif\tools\Microsoft.v5.5.5.PowerShell_profile.ps1'`、第 135–136 行 `$python` / `$idfPy`。该脚本超出这两处之外的逻辑（ASCII 镜像暂存、`-p` 抢占、UTF-8 强制）在换机后依然有用。
- `firmware-v2/tools/test-core.ps1`、`test-m2.ps1`：`$firmwareCompiler = 'C:\Espressif\tools\xtensa-esp-elf\...\xtensa-esp32s3-elf-gcc.exe'`。
- `firmware-v2/tests/runtime-README.md`、`transport-README.md`：示例命令中的本机路径。

---

## 7. 目录速览

```
CMakeLists.txt              工程入口；在 project() 之前关掉 FreeType 的 PNG 编解码器
                            （否则 FindPNG → 嵌套 find_package(ZLIB) 会在本机 cmake.exe 里
                             以 0xC0000409 STATUS_STACK_BUFFER_OVERRUN 崩溃且不打印任何错误）
partitions.csv              经典分区表（32MB flash）
partitions-m2.csv           M2 分区表
sdkconfig.defaults          面板/PSRAM/240MHz/FreeRTOS 1000Hz/LVGL/BLE 等
sdkconfig.m2.defaults       M2 增补项
dependencies.lock           19 个托管组件的版本锁
main/                       经典固件入口与 UI/网络/硬件层
components/cat3d/           软件光栅化 3D 猫（含 6 套 128KB 贴图）
components/find-zlib-shim/  把 CMake 自带的 FindZLIB 重定向到 IDF zlib 组件
firmware-v2/                V2 独立重做（interaction/ render/ runtime/ tests/ tools/）
managed_components/         锁定的第三方组件（离线构建用）
docs/                       构建与验收文档（build-and-usage.md 最详细）
tests/                      host / integration 回归
tools/                      构建脚本、资源生成器、门禁检查
```
