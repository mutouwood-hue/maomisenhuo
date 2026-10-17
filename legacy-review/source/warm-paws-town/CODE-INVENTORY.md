# 代码清单 — D:\黑客松

一句话：这个工作区里放着**三套可交付代码**（吧唧固件、安卓 App、云端后端）+ 一套参考资料 + 构建产物。
本次打包只针对前两者中的**吧唧固件**与**安卓 App**。

---

## 1. 总览

| # | 模块 | 是什么 | 技术栈 | 规模（不含生成资源） | 本次打包 |
| --- | --- | --- | --- | --- | --- |
| 1 | 吧唧固件（根目录 + `main/` + `components/` + `firmware-v2/`） | ESP32-S3-Touch-AMOLED-1.75C 徽章固件；含一版规格驱动 UI 固件与一版 V2 独立重做 | C / ESP-IDF v5.5.5 / LVGL 9.5 / NimBLE / FreeRTOS | 手写 C/H 约 180 个文件、约 3 万行；生成字体与图片数据 22 个文件、17 MB | ✅ `baji-firmware-src.zip` |
| 2 | 安卓 App（`mobile-pet/`） | 「暖爪小镇」离线网页游戏 + Capacitor 8 容器 + 4 个自定义原生插件 | 原生 JS/CSS + esbuild + Capacitor 8 + Java（Android SDK 36 / JDK 21） | 网页源 34 文件约 1.9 千行；原生 Java 6 文件约 720 行；构建/测试脚本 30 文件 | ✅ `warm-paws-town-android-src.zip` |
| 3 | 云端后端（`backend/`） | 吧唧数据后端：宠物/经济/社交/环境/AI/OTA/设备配网 + OpenAPI 契约产物 | Node ≥24 ESM + SQLite（`node:sqlite`），无框架依赖 | 68 文件约 2.6 万行（含 `.aimeta` 契约与测试日志） | ❌ 未打包 |
| 4 | 参考资料（`_ref/`） | Waveshare 原厂示例与组件、吧唧交互规范/PRD 快照、Notion 抓取、猫模型与像素素材 | JSON/MD/图/第三方源码 | 约 2 380 文件、327 MB | ❌ 未打包（固件编译不需要） |
| 5 | 构建产物（`build/`、`dist/`） | 历史构建树、串口日志、烧录镜像、设备私有备份 | — | `build/` 57.6 MB、`dist/` 2 MB | ❌ 未打包 |

> 打包基于**当前工作树**，不是任何一次提交。仓库当前在 `docs/v1.3-gap-vs-firmware` 分支，相对 HEAD 有 174 项差异（18 删除 / 21 修改 / 135 未跟踪），`git ls-files` 只有 113 个文件——**用 git 归档会丢内容**。

---

## 2. 吧唧固件（ESP32-S3）

### 2.1 根目录（工程入口与配置）

| 路径 | 作用 |
| --- | --- |
| `CMakeLists.txt` | 工程入口。在 `project()` 之前 `set(FT_DISABLE_PNG ON)`：关掉 FreeType 的 PNG 编解码器，避免 FindPNG → 嵌套 `find_package(ZLIB)` 在本机 cmake.exe 里以 `0xC0000409 STATUS_STACK_BUFFER_OVERRUN` 静默崩溃 |
| `sdkconfig.defaults` / `sdkconfig.m2.defaults` | CO5300 466×466 AMOLED、8 MB OCT PSRAM 80 MHz、240 MHz CPU、FreeRTOS 1000 Hz、LVGL、BLE 配置；M2 为增补 |
| `partitions.csv` / `partitions-m2.csv` | 经典 / M2 分区表（32 MB flash） |
| `dependencies.lock` | 19 个托管组件版本锁 |
| `eim_config.toml` | 原始宿主的 ESP-IDF Installation Manager 配置（含其本机路径，仅作参照） |
| `lvgl_v9_api_reference.md` | LVGL 9 API 摘录 |
| `flow-nodes-snapshot.json` / `flow-edges-snapshot.json` | 交互流快照 |

### 2.2 `main/` — 规格驱动 UI 固件（默认构建）

64 个文件，其中手写 56 个 / 约 1.9 万行，生成 8 个 / 6 MB。

- **入口与存储**：`main.c`（27 KB）、`badge_runtime.c`、`badge_pet_store.c`、`badge_onboarding_store.c`
- **UI**：`ui/badge_ui.c`(104 KB)、`badge_fsm.c`(89 KB)、`badge_paint.c`(84 KB)、`badge_ui_plan.c`(40 KB)、`badge_cat.c`、`badge_geom.c`、`badge_motion.c`、`badge_overlay.c`、`badge_frame_clock.c`、`badge_tutorial_visual.c`、`ui/badge_onboarding.c`、`ui/cat_view.c`
- **规格词表（生成）**：`ui/badge_spec_data.c`(85 KB，由 `tools/gen-badge-ui.mjs` 从 `_ref/baji-spec/吧唧交互规范/badge_spec.json` 生成)、`ui/badge_assets_data.c`(332 KB，由 `tools/gen-badge-assets.mjs` 生成)
- **字体（生成）**：`ui/fonts/badge_f16.c`、`badge_f20.c`(4.9 MB)、`badge_f24.c`、`badge_n40.c`、`badge_n44.c`（Source Han Sans SC / Noto Sans SC 子集，4bpp 未压缩）
- **宠物内核**：`pet/badge_pet.c`（五种照料、拒绝规则、数值运算、告警优先级）、`pet/pet_state.c`
- **网络与上行**：`net/net_link.c`(40 KB)、`net/net_social.c`(61 KB)、`net/badge_events.c`(31 KB)、`net/net_proto.c`、`net/app_link.c`
- **硬件**：`hw/badge_hw.c`(25 KB)、`hw/badge_audio_policy.c`

`main/CMakeLists.txt` 第 1–4 行：`BAJI_V2` 为真时整体让位给 `firmware-v2/component.cmake`。
本模块与 `firmware-v2` 都开 `-Wall -Wextra -Werror`。

### 2.3 `firmware-v2/` — V2 独立重做（`-DBAJI_V2=ON`）

137 个文件：手写 C/H 与脚本 123 个 / 约 9 千行 + 生成资源 14 个 / 17.4 MB。

- `interaction/`：`baji_gesture`（轴锁/快滑/阻尼/提交决策）、`baji_scene`（教学与导航状态）、`baji_controller`（触摸→手势→双页帧计划）、`baji_power`（低电策略）、`baji_protocol` / `baji_link`（BLE 命令层）、`baji_pmic_decode`、`baji_env_model`、`baji_audio_policy`、`baji_social_policy`、`baji_update`、`baji_peer` / `baji_peer_auth`（对等认证）、`baji_data`（21 KB）
- `render/`：`baji_render.c`(20 KB) + `render/generated/`（背景三张、静止页、猫 24 帧 ping-pong、16/24/44 字体，共 17.4 MB 生成 C）
- `runtime/`：`baji_main.c`（V2 入口）、`baji_pmic.c`、`baji_ble.c`、`baji_peer_ble.c`、`baji_peer_crypto.c`、`baji_audio_runtime.c`、`baji_update_runtime.c`、`baji_asset_runtime.c`、`baji_data_runtime.c`
- `tests/`：13 个主机回归（`test_gesture` / `test_scene` / `test_controller` / `test_power` / `test_pmic_decode` / `test_link` / `test_protocol` / `test_active` / `test_data` / `test_data_storage` / `test_env_model` / `test_m2_policy` / `test_update` / `test_peer_auth`）+ `runtime-regression.c` 与 `transport-regression.c` 两套故障注入 + 各自的 mock SDK
- `tools/`：`test-core.ps1`、`test-m2.ps1`、`test-peer.ps1`、`test-transport.ps1`、`check_fonts.py`、`check_render.py`、`generate_font16.py`、`generate_data_fonts.py`、`pack_cat_frames.py`、`extract_assets.py`
- `component.cmake`：注册全部源；`BJ_UPDATE_PUBLIC_KEY_FILE` / `BJ_PEER_PUBLIC_KEY_FILE` 缺省为空且 fail-closed（不隐式链接测试密钥）

### 2.4 `components/` 与 `managed_components/`

- `components/cat3d/`：软件光栅化 3D 猫（`cat3d.c` 33 KB、`cat_model.h`、6 套 128 KB 贴图 `tex_*.bin`、`cat_assets_esp32.c`）
- `components/find-zlib-shim/`：把 CMake 自带 `FindZLIB` / 可选 `FindPNG` 重定向到 IDF 的 zlib / libpng 组件
- `managed_components/`：19 个锁定组件（LVGL 9.5.0、Waveshare BSP、CO5300 面板、CST9217 触摸、codec、freetype、libpng、zlib、NimBLE 相关等），233 MB，**已随包提供以支持离线构建**

### 2.5 `docs/`、`tests/`、`tools/`

- `docs/`：31 份文档（`build-and-usage.md` 47 KB 最详细、`render-route.md` 66 KB、`m2-*.md` 一整套 M2 契约与验收矩阵、`hardware-buttons.md`、`porting-notes.md`、`cmake-crash-evidence.md` 等）
- `tests/host/`、`tests/integration/`：主机侧回归（含 IDF stub 与 m2 配置测试）
- `tools/`（约 60 个文件）：`build-firmware.ps1`（构建/烧录包装，含 ASCII 镜像暂存）、资源与字体生成器（`gen-assets.mjs`、`gen-badge-assets.mjs`、`gen-badge-ui.mjs`、`prepare-*-fonts.cjs`）、门禁（`check-sdkconfig.mjs`、`check-font-coverage.mjs`、`check-badge-spec.mjs`、`check-cmake-sources.py`、`check-objective-counts.py`、`prebuild-size.py`）、真机/后端联调（`ble-runtime/`、`device-provision/`、`m2-live-backend.mjs`、`m2-phone-cdp.mjs`、`capture-serial.py` 等）

---

## 3. 安卓 App（`mobile-pet/`）

| 路径 | 内容 |
| --- | --- |
| `original/game.html` | 只读原作快照，1.3 MB / 6 415 行；构建脚本的唯一 HTML 输入 |
| `src/companion/` | 生活面板、云端存档 CAS、AI 适配、后台定位、设备上行、隐私资格（15 文件，`main.js` 29 KB） |
| `src/social/` | 近场社交面板与协议、二维码扫描、更新上传（8 文件，`panel.js` 25 KB） |
| `src/ble/` | 设备 BLE 客户端、协议、面板（4 文件） |
| `src/mobile/` | 移动端房间世界与生活面板适配层（4 文件） |
| `src/native/bridge.js` | 原生能力桥（文件分享/导入、定位、运动） |
| `scripts/` | `build.mjs`（esbuild + HTML 重写）、`build-android.ps1`、`setup-toolchain.ps1`、`setup-stable-sdk.ps1`、`web-smoke.mjs`、`ui-audit.mjs`(25 KB)、`device-ui-smoke.mjs`、`companion-*.mjs`、`m2-*.mjs`、`package-source.py`、`verify-apk.py`、`make-icons.py` |
| `tests/` | 15 个 `node --test` 回归 |
| `www/` | 构建产物（构建脚本生成，已随包提供） |
| `android/` | Capacitor 原生工程：`app/`、`gradlew`/wrapper 8.14.3、`variables.gradle`（SDK 版本）、`capacitor.settings.gradle`（指向 `node_modules/.pnpm/...`）、`capacitor-cordova-android-plugins/` |
| `android/app/src/main/java/com/warmpaws/town/` | `MainActivity.java`、`ble/BleLocalPlugin.java`(21 KB)、`location/NativeLocationPlugin.java`(9 KB) + `BackgroundLocationService.java`(7 KB) + `LocationQueue.java`、`motion/MotionPlugin.java` |
| `android/app/src/main/assets/public/` | Cap sync 拷贝进 APK 的网页资源（已随包提供） |
| `README.md` / `ANDROID-CHECKLIST.md` / `VALIDATION.md` | 范围与隐私边界、真机验收清单、验证口径 |
| `.toolchain/`（3 GB） | 本机 JDK 21 + Android cmdline-tools + SDK + Gradle 缓存，**未打包** |
| `deliverables/`（75 MB） | APK、真机截图、UI 体检截图与 JSON 报告、测试日志，**未打包** |

---

## 4. 云端后端（`backend/`，未打包）

`baji-data-backend`，Node ≥24 ESM，`node:sqlite`，无 Web 框架依赖。33 个源文件。

- 领域服务：`pet`、`economy`（21 KB）、`breeding`、`collection`、`social`（16 KB）、`environment`、`life`、`ai`（+ 配方参考 19 KB）、`ota`、`device`（配网/签名/时效）、`identity`（+ 隐私资格）、`telemetry`、`m2`（契约/策略/仓储/路由）
- `src/app.mjs`(16 KB) / `src/contracts.mjs` / `src/infrastructure/sqlite.mjs`
- `.aimeta/api/`：`openapi.json`(763 KB) + 15 份 `*.overlay.yaml` 语义覆盖 + `fingerprints.json`
- `tests/`：9 个测试文件；根目录另有 4 份测试日志

---

## 5. 参考资料与产物（未打包）

- `_ref/`：`waveshare-1.75C/`（原厂示例与 Arduino 库）、`ws-components/`、`baji-spec/`（吧唧交互规范 + 字体 + `badge_spec.json`）、`notion/`、`ring-golden/`、`current-assets-2026-10-14/`，以及 PRD/Notion 抓取（`prd-user-current-20261014.md` 179 KB、`notion-*.md`）、`pixel-cat.bbmodel`、`cat_model.json`、各类截图。**固件编译不需要**；只有重新生成规格数据/字体时才读 `_ref/baji-spec/吧唧交互规范/`。
- `build/`：历史构建树 + 串口/回归日志 + `m2-device-private/`、`pre-m2-*-private-*.bin` 等设备私有备份（含密钥类材料，**不应外发**）。
- `dist/`：`orange_cat_pet.bin`(2 MB)、`bootloader.bin`、`partition-table.bin` 与说明。
- `packages/`：本次输出（两个源码包 + 各一份 MANIFEST + 本清单 + 打包脚本）。

---

## 6. 需要你留意的几处

1. **`firmware-v2/runtime/baji_ble.hू`** — 文件名末尾多了一个天城文元音符号（U+0942），几乎肯定是误打。它会作为独立文件进入固件包；真正的头文件是 `baji_ble.h`。建议改名或删除后重新打包。
2. **工作树与 git 严重脱节** — 174 项未提交差异、135 个未跟踪文件；`components/pet_ring/`、`main/pet/pet_save.c`、`main/ui/pet_ui.c` 等在 git 里显示已删除但工作树里已不存在，说明 HEAD 停留在旧阶段。要不要提交由你定（我不会主动动 git）。
3. **两个 `_ref` 下的中文目录名**（`_ref/baji-spec/吧唧交互规范/`）是若干生成脚本的输入路径；如果你把 `_ref` 挪走，只有"重新生成资源"会失败，正常构建不受影响。
4. **`mobile-pet/android/local.properties` 记录了原宿主的 SDK 绝对路径**，已从包中剔除，换机需按 BUILD.md 重建。
5. **`build/` 里的 `*-private-*.bin` / `m2-device-private/`** 看起来是设备私有数据（NVS/分区备份），别随代码一起外发。
