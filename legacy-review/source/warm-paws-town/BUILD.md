# 暖爪小镇 安卓 App 构建说明（Capacitor 8 + 原生插件）

> **本包的验证状态**：由当前工作树快照生成（**不是**某一次 git 提交）。打包时核对了归档结构与排除项：`node_modules/`、`.toolchain/`、`deliverables/`、`android/local.properties`、Gradle 产物、签名文件均已剔除，全文检索无密钥类文本。关键构建输入齐备（`original/game.html`、`src/`、`www/`、`android/app/src/main/assets/public/`、gradle wrapper jar、`capacitor.build.gradle`、`capacitor.plugins.json`）。
>
> **没有在本机从零重跑 `pnpm install` → `gradlew assembleDebug`**。首次构建请按下面步骤执行；注意 §2 的第 ③ 步不能略过，且第一次 `pnpm install` 需访问 npm registry（视网络可能较慢）。

本包是「暖爪小镇」安卓 App 的完整可构建源码快照：离线网页游戏（从单文件 HTML 拆包而来）+ Capacitor 8 容器 + 4 个自定义原生插件。

| 层 | 路径 | 说明 |
| --- | --- | --- |
| 网页源 | `original/game.html` | **只读输入快照**（1.3 MB 单文件原作），构建脚本从它拆分出脚本序列 |
| 网页源 | `src/` | `companion/`（生活/云存档/AI）、`social/`（近场社交）、`ble/`（BLE 面板）、`mobile/`（移动布局）、`native/bridge.js` |
| 构建脚本 | `scripts/build.mjs` | esbuild 打包 + HTML 重写，产出 `www/` |
| 网页产物 | `www/` | 离线资源（**已包含在包内**，`pnpm build` 会重新生成） |
| 安卓工程 | `android/` | Capacitor 原生工程（Gradle 8.14.3 wrapper，AGP 8.13.0） |
| 原生插件 | `android/app/src/main/java/com/warmpaws/town/` | `ble/BleLocalPlugin.java`（BLE 中央/外设）、`location/NativeLocationPlugin.java` + `BackgroundLocationService.java` + `LocationQueue.java`（原生定位前台服务）、`motion/MotionPlugin.java`（计步） |
| 测试 | `tests/`、`scripts/*.mjs` | Node 回归、Web smoke、真机 UI smoke、UI 体检 |

`android/` 的版本：`applicationId com.warmpaws.town`、`minSdk 24`、`compileSdk 36`、`targetSdk 36`、`versionCode 1`、`versionName 0.1.0`。

---

## 1. 环境要求

| 组件 | 版本 | 备注 |
| --- | --- | --- |
| Node.js | 22+（原宿主 24.18.1 实测） | `pnpm build` 用到 `vm.Script`、esbuild、`node:crypto` |
| pnpm | 9/10 | 仓库是 pnpm workspace（`pnpm-lock.yaml` + `pnpm-workspace.yaml`） |
| JDK | **21** | `app/capacitor.build.gradle` 要求 `VERSION_21` |
| Android SDK | `platforms;android-36`、`build-tools;36.0.0` **和** `35.0.0`、`platform-tools` | 原宿主的 `scripts/build-android.ps1` 会同时校验 35 与 36 的 build-tools |
| Gradle | 8.14.3 | 由 wrapper 自动下载（`services.gradle.org`，约 200 MB，首次构建慢） |
| 网络 | npm registry + `google()` / `mavenCentral()` + Gradle 发行包 | 首次构建必须联网 |

> 路径可以含中文：`android/gradle.properties` 里已有 `android.overridePathCheck=true`。请勿删掉这一行。

---

## 2. 构建步骤

```bash
# ① 安装依赖（必须在 android/ 里构建之前完成，原因见下）
pnpm install --frozen-lockfile

# ② 生成 www/ 网页资源（包内已有 www/，此步用于确认源码可重建）
pnpm build

# ③ 生成 Capacitor 的安卓接线并拷贝网页资源进 android/app/src/main/assets/public/
pnpm exec cap sync android

# ④ 指定 Android SDK 位置（本包故意不含 local.properties，它记录的是原宿主路径）
#    macOS/Linux：
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
#    Windows PowerShell（注意反斜杠要写成 \: 转义形式，或直接用正斜杠）：
Set-Content android\local.properties "sdk.dir=D\:/Android/Sdk"
#    也可以不建该文件，改为设置环境变量 ANDROID_HOME / ANDROID_SDK_ROOT（Gradle 同样识别）

# ⑤ 构建 debug APK
cd android
./gradlew --no-daemon assembleDebug        # Windows: .\gradlew.bat --no-daemon assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

### 为什么 ③ 不能略过

`android/capacitor.settings.gradle` 是 Capacitor 生成的文件，里面把插件工程指向 **`../node_modules/.pnpm/...` 的带 hash 目录名**，例如：

```gradle
project(':capacitor-android').projectDir =
    new File('../node_modules/.pnpm/@capacitor+android@8.5.3_@capacitor+core@8.5.3/node_modules/@capacitor/android/capacitor')
```

这个 hash 目录名由 pnpm 的解析结果决定，**换一台机器、换一个 pnpm 版本就可能不同**。所以顺序固定为：先 `pnpm install`，再 `pnpm exec cap sync android`（它会用你本机的实际路径重新生成该文件），最后才 `gradlew`。跳过 ③ 直接 `gradlew` 会报找不到 `:capacitor-android` 工程。

### 只想改原生代码 / 无网快速重编

`www/` 与 `android/app/src/main/assets/public/` 都已随包提供，因此只要 `node_modules` 已装好（②③ 跑过一次），后续改 Java/资源只需重复 ⑤。

### lint

```bash
cd android && ./gradlew --no-daemon lintDebug
```

原宿主的 `scripts/build-android.ps1` 就是 `assembleDebug lintDebug` 一起跑，但它把 JDK/SDK/Gradle 缓存写死在工程的 `.toolchain/`（**本包未包含该目录**，约 3 GB 的本地工具链）。换机时二选一：

- 用上面的手写命令（推荐）；或
- 改 `scripts/build-android.ps1` 第 4–7 行，把 `$toolchain` 指向你本机的 JDK / Android SDK / Gradle 缓存目录。

---

## 3. 可选：测试与体检

```bash
pnpm test                                  # node --test tests/*.test.mjs
node scripts/web-smoke.mjs                 # 需先 pnpm exec playwright install chromium
node scripts/ui-audit.mjs --phase=regression   # 多尺寸 UI 体检，输出报告与截图
node scripts/companion-smoke.mjs           # 生活/伴侣层冒烟
```

`scripts/device-ui-smoke.mjs`、`scripts/m2-phone-cdp.mjs`、`scripts/m2-gift-real-http-smoke.mjs` 面向**已连接的真机 / 真后端**，且部分脚本按原宿主写死（ADB 端口转发、本机后端地址），换机后需要先改地址再跑。真机验收清单见 `ANDROID-CHECKLIST.md`。

---

## 4. 本包未包含的内容

| 未包含 | 原因 |
| --- | --- |
| `node_modules/`（71 MB） | `pnpm install --frozen-lockfile` 可完整还原（需 npm registry；离线请自带 pnpm store 或直接拷贝该目录） |
| `.toolchain/`（约 3 GB） | 原宿主的本地 JDK 21 + Android cmdline-tools 19.0 + SDK + Gradle 缓存；`scripts/setup-toolchain.ps1` / `setup-stable-sdk.ps1` 是它的下载脚本，但**不建议照抄**——直接装标准 JDK 21 + Android SDK 更省事 |
| `deliverables/`（75 MB） | 已构建的 APK、真机截图、UI 体检截图与 JSON 报告、测试日志（证据材料，非源码） |
| `artifacts/` | 各阶段测试日志 |
| `android/build/`、`android/app/build/`、`android/.gradle/`、`android/.kotlin/`、`android/capacitor-cordova-android-plugins/build/` | Gradle 产物与缓存 |
| `android/local.properties` | 记录原宿主 SDK 绝对路径；**必须按 §2 ④ 重建** |
| `*.jks` / `*.keystore` / `.env*` | 签名与密钥（如有） |

> 本工程目前只配置了 debug 签名，**没有正式 release 签名配置**：`android/app/build.gradle` 的 `release` 未声明 `signingConfig`，用 `assembleRelease` 只会得到未签名包。正式分发还需要独立 release 签名、隐私政策、第三方引擎/资源许可核对（见 `README.md` 末节与 `VALIDATION.md`）。

---

## 5. 真机构建备注

- 首次进入 App 不应自动申请定位/麦克风权限；权限在功能被使用时才申请。
- `AndroidManifest.xml` 已声明 BLE（含 `BLUETOOTH_SCAN neverForLocation`）、定位（含后台）、前台服务（location 类型）、通知、相机、录音、计步权限；`allowBackup="false"` 与 `dataExtractionRules` 用于避免存档与用户填写的内容被自动云备份。
- 真机安装：`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`。同包名同签名覆盖安装保留存档；卸载或清除数据会删除存档。
