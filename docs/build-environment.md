# 本地构建环境

所有后续工具、构建输出和缓存以项目 `.tools/`、`logs/`、各工程 `build/` 为边界，均已忽略提交；没有要求全局安装 SDK、账号或付费服务。首次固件配置的组件管理器采用过默认用户缓存，后续脚本已固定为项目缓存。工具链不等于设备验收。

## Android

| 工具 | 固定版本/来源 | SHA-256（发行归档） |
|---|---|---|
| Temurin JDK | 21.0.12.1+1，macOS aarch64；Adoptium官方元数据、清华镜像相同字节 | `3623232f33a9c3baadf304480b2535f9a3cba8a58d42ecbb438ba267315d9998` |
| Gradle | 8.9 bin；官方SHA、华为镜像相同字节 | `d725d707bfabd4dfdc958c624003b3c80accc03f7037b5122c4b1d0ef15cecab` |
| Android cmdline tools | 官方mac_arm64 build15859902 | `835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e` |

SDK由官方sdkmanager安装：Android15/API35、platform revision2/extension13，build-tools35.0.0，platform-tools37.0.1。AGP8.7.3，Kotlin2.0.21；应用Java/Kotlin target17、minSdk26、target/compile35。无Compose/Room/第三方BLE库；Gradle最多2worker、1536MiB，Kotlin编译位于Gradle进程内。

```sh
bash scripts/build-android.sh
bash scripts/android-env.sh .tools/android-sdk/build-tools/35.0.0/apksigner verify --verbose app/android/app/build/outputs/apk/debug/app-debug.apk
bash scripts/android-env.sh python3 tests/protocol/run_regression.py --require-all
```

`android-env.sh`固定JAVA_HOME、ANDROID_HOME、ANDROID_USER_HOME、GRADLE_USER_HOME到项目。首次构建脚本在文件不存在时生成标准本地 Android debug 签名（CN=Android Debug，标准调试口令），不会覆盖已有签名。debug签名保留于`.tools/signing/catforest-debug.keystore`，便于后续本地升级；不上传密钥、不代表生产发行签名。SDK标准许可已用于本地构建，不登录开发者账号。

## ESP32-S3

ESP-IDF官方v5.5.5，commit `b774170ff46c393eeb5e495ea37936038d3f4f4f`，27个递归子模块均固定。GCC14.2.0（esp-14.2.0_20260121）、CMake3.30.2、Ninja1.12.1、Python3.13.3。下载工具归档10项SHA核验记录位于`.tools/idf-tools/installation-manifest.json`。

`firmware/main/idf_component.yml`与`firmware/dependencies.lock`锁定Waveshare BSP3.0.0、LVGL9.5.0及间接依赖。下载采用官方乐鑫中国存储域，组件内容hash仍由管理器严格检查，没有跳过TLS或校验。

```sh
bash scripts/setup-idf.sh --check
bash scripts/setup-idf.sh --exec idf.py -C firmware reconfigure
bash scripts/setup-idf.sh --exec ninja -C firmware/build -j2
```

脚本不会刷写、打开串口或擦除设备。两端重构建串行执行，不并行满核编译。首次写入另按[真机清单](hardware-acceptance.md)确认端口、备份和授权。

## 一次串行复跑与交付

```sh
python3 scripts/build_candidate.py
python3 scripts/package_candidate.py
```

串行脚本依次构建 Android/固件、验证 APK 签名、固件镜像、静态大小和完整主机回归，记录命令退出码、源码哈希及日志到 `logs/build-result.json`。打包脚本拒绝源码已改变或回归不完整的证据，复制当前产物、日志/许可，并生成无工具缓存/密钥的源代码 ZIP 与 SHA256SUMS。设备写入不是这些脚本的一部分。
