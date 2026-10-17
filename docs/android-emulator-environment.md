# Android 模拟器环境

准备日期：2026-10-15。此环境用于在真实 Android 系统镜像中安装和运行 APK；它不验证真实 BLE、吧唧输入、无线重连或板卡性能。准备阶段未启动模拟器，实际 APK 运行结果由集成验收记录另行保存。

## 固定官方软件

| 包 | 固定版本 | 下载大小 | 官方 SHA-1 |
| --- | --- | ---: | --- |
| `emulator`，macOS ARM64 | 37.2.12 / build 16428233 | 416,112,708 字节 | `3af4fe44ce82b3d88ae5678a53735f27ad729c15` |
| `system-images;android-35;default;arm64-v8a`，AOSP / Android 15 | r2 | 769,099,654 字节 | `2026a06409db630b56711afdbffb457c1dbaed49` |

下载仅使用 Google 官方地址：

- [Emulator 固定归档](https://dl.google.com/android/repository/emulator-darwin_aarch64-16428233.zip)
- [API 35 ARM64 AOSP 固定归档](https://dl.google.com/android/repository/sys-img/android/arm64-v8a-35_r02.zip)
- [Emulator 官方清单](https://dl.google.com/android/repository/repository2-3.xml)
- [AOSP 系统镜像官方清单](https://dl.google.com/android/repository/sys-img/android/sys-img2-5.xml)

两包完整大小和官方 SHA-1 均已核验，另记录本地 SHA-256。系统镜像为 AOSP，无 Play 商店，无需 Google 账号。两包使用的 `android-sdk-license` 正文哈希 `9002c006f4b8d9a16e715a9fa4df30ddb8abf9d9` 已在项目原有许可缓存中；准备过程未新增接受协议。

归档保留在 `.tools/downloads/`。官方元数据和校验记录保留在：

- `.tools/android-user/emulator-package-manifest.json`
- `.tools/android-user/emulator-archive-verification.json`
- `.tools/android-user/emulator-preparation-report.json`

SDKmanager 下载曾受慢连接和执行服务断连影响，后改为固定官方 URL 下载；镜像使用最多六个 HTTP Range 连接并按精确偏移续传，拼接后再次验证完整官方 SHA-1。已清理六个冗余分段文件，保留完整归档。安装以 `ditto` 保留执行位，`package.xml` 从对应官方 `remotePackage` 的原始字段生成，已由官方 `sdkmanager --list_installed` 正确识别。

## 项目内目录与 AVD

SDK 位于 `.tools/android-sdk/`；Java 和 SDK 环境使用 `scripts/android-env.sh`。模拟器状态单独放在项目中：

```text
ANDROID_USER_HOME=.tools/android-user
ANDROID_EMULATOR_HOME=.tools/android-user
ANDROID_AVD_HOME=.tools/android-user/avd
AVD=CatForest_API35
```

`CatForest_API35` 使用 `pixel_2` 设备配置、ARM64 AOSP API 35 镜像。已设置 2 核、1536 MB 内存、720×1280 / 320 dpi、2 GiB 持久数据盘。数据路径为 AVD 目录内的 `userdata-qemu.img`；摄像头、麦克风输入、SD 卡和快照均关闭。`avdmanager list avd` 已正确识别该 AVD。

安装的软件增量约为 Emulator 1.2 GiB、系统镜像 1.7 GiB，另保留约 1.10 GiB 官方归档。首次启动后数据盘另占空间，上限配置为 2 GiB。清理分段后的可用磁盘约 41 GiB，此数值随其他构建变化。

## 集成任务启动命令

由集成负责人在重构建完成后启动一个实例，端口固定为 5556：

```bash
ANDROID_AVD_HOME="$PWD/.tools/android-user/avd" \
ANDROID_EMULATOR_HOME="$PWD/.tools/android-user" \
bash scripts/android-env.sh .tools/android-sdk/emulator/emulator \
  -avd CatForest_API35 -port 5556 -cores 2 -memory 1536 \
  -no-audio -no-snapshot -no-boot-anim \
  -camera-back none -camera-front none -gpu host
```

需要无窗口运行时可加 `-no-window`。后续 ADB 操作明确选择 `-s emulator-5556`，避免操作其他设备；安装真实手机或测试真实 BLE 时须按对应授权另行进行。日常重启不使用 `-wipe-data`，以便验证应用存档和恢复。

离线准备脚本位于 `.tools/android-user/prepare-fixed-avd.py`，用于本次环境准备，已设置保护以拒绝覆盖现有 AVD 数据。不要把准备环境成功写成 APK 运行或真实硬件验收通过。

## 运行服务恢复记录

2026-10-15 首次启动后已在此 AVD 真实安装首版 APK 并取得有效存档/截图。随后临时 exec 服务断连时模拟器进程丢失，升级在安装前中止，失败报告保留。只读检查确认没有项目模拟器进程且原 userdata 仍存在后，使用 `python3 scripts/start-android-emulator.py` 恢复同一 AVD/端口；脚本分离临时执行会话、拒绝重复实例、禁止新建/清空数据盘。恢复后 sys.boot_completed=1。它不安装 APK、不操作权限，不代表升级或功能测试通过。

目前没有已知待用户确认的审批请求。执行连接故障、自动审查超时与明确权限拒绝必须分别报告，不应要求用户为连接故障修改权限。

## 附录：临时执行会话与 ADB server 的最小恢复做法

本附录于 2026-10-15 只读复核启动脚本、Platform-Tools 37.0.1 静态 help、AOSP 帮助和 Python 3.13 文档后补充。复核未执行 ADB，未启停模拟器/server，未修改 QA 进程。以下是建议，尚未实施服务变更。

现脚本的 `start_new_session=True`、`stdin=DEVNULL`、文件日志和默认开启的 `close_fds` 能减少对临时执行会话的依赖。它保留原数据盘、检查重复实例，并区分启动与 boot 完成。[Python 官方说明](https://docs.python.org/3.13/library/subprocess.html#subprocess.Popen)

`start_new_session` 在 POSIX 子进程中调用 `setsid()`，不能保证抵抗执行服务主动清理、宿主退出或系统重启。本次出现过 transport 断连、旧工具会话无法恢复和进程丢失，但没有证据确定退出信号或服务清理策略。工具连接失败也不能直接证明模拟器退出；恢复前仍须核对进程、端口归属、数据盘。PID 文件可能过期，不能单凭它启停进程。

**当前 QA 的 ADB 可用时，保留现有 server。** 不必为了统一形式迁移到 `nodaemon`。若之后确认只有 ADB server 丢失而模拟器仍在，可由集成负责人只恢复 server，保留 AVD、userdata 和测试数据。[AOSP 官方帮助](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/docs/user/adb.1.md)

建议由单一集成负责人按以下顺序处理，分别记录短日志：

1. 暂停 QA，确认 server 是否仍可达及 localhost:5037 的占用者。已有可用 server 就复用；归属不明时停止，不杀其他项目的 server。
2. 仅在 server 已消失且端口空闲时，通过项目 `scripts/android-env.sh` 用独立 `Popen` 运行 `adb -L tcp:localhost:5037 server nodaemon`。设置 `start_new_session=True`、`stdin=DEVNULL`、项目文件日志、`close_fds=True`，记录 PID、SDK 路径和 socket。前台 `nodaemon` 若用作长期服务，应像模拟器一样脱离临时工具会话；本附录未创建或执行启动代码。
3. 客户端保持同一 server 端口及 `-s emulator-5556`。先短查状态/boot，再恢复原测试。不因 ADB 断连重装 APK、清数据或重建 AVD。5556 是模拟器 console 端口，不能替代 server 的 5037。

保持 localhost 监听，不增加 `-a`，不在当前 QA 中切换端口。官方 `--one-device` 仅限制 USB 设备，不能当作模拟器隔离选项。不增加会在测试中自动重启服务的 watchdog，不自动删除 AVD 锁文件。

现启动脚本的重复检测属于先检查后启动，未设跨进程原子启动锁。本轮由一个负责人串行启动即可；未来开放并发自动化时再补独占锁及 PID/命令/socket 核验，不改动当前 QA 会话。

## 重启后软件渲染恢复（18:26 UTC+8 起）

用户重启后最小只读探针与交接读取恢复。核实无原 AVD 进程、原数据盘仍在，先恢复 host GPU 实例；随后执行通道再次断连。只按准确项目路径、AVD 与端口核验后 SIGTERM 该实例，保留数据盘；只读确认其已退出。内存检查约54%空闲，不能据此声称内存不足或确定故障根因。

当前官方 `emulator -help-gpu` 确认支持 `software`。脚本新增可选 `--gpu`，本轮用 `python3 scripts/start-android-emulator.py --gpu software` 启动同一 AVD，仍2核/1536MB、无相机音频、无快照、无数据清理。sys.boot_completed实际返回1；短只读与ADB恢复。此为恢复试验，不代表已证明host GPU导致执行服务故障。

实际v0.2安装字节核验、同猫存档、启动已通过；初始截图尚在加载，后续截图已由root与独立QA分别目视确认原始3D房间和橘猫正常显示。证据 `tests/android-runtime/artifacts/v02-software-launch/` 与 `v02-software-ready/`。后续业务与恢复用例仍按各自实际报告记录，不能把启动通过视为完整验收。
