# 猫咪森活吧唧固件

当前 UI 为真实状态/设备同步/触摸自检四页子集，导航、基础触控阈值与原始 23 屏差距见 [UI-COVERAGE.md](UI-COVERAGE.md)。用户后续允许彩色场景，当前主屏渐变只由真实快照数值驱动；不据此推断出游或其它游戏动作。源码入口为 `main/badge_pages.c`，稳定产物更新由主集成在验证后单独完成。

目标型号仅为 Waveshare **ESP32-S3-Touch-AMOLED-1.75C**。官方 BSP 管理 CO5300 QSPI 屏幕和 CST9217 I²C 触摸，不在应用中重写引脚。依赖固定 BSP 3.0.0、LVGL 9.5.0，ESP-IDF 5.5.x（集成目标 5.5.5）。首次解析成功后应保留 `dependencies.lock`。

## 构建

在已安装并激活的 ESP-IDF 5.5.x 环境中：

```sh
cd firmware
idf.py set-target esp32s3
idf.py build
```

本 README 不执行刷写。首次写入前由用户确认具体板卡、端口、现有固件和存档备份/恢复方案。不要 `erase-flash`。应用遇到 NVS 满、版本错误或损坏时拒绝启动 BLE，不自动擦除存档。

## 运行闭环

- 通过官方 `bsp_display_start()` 创建真实屏幕与触摸，LVGL 点击调用 `badge_pet()`。
- 首次连接使用 BLE Secure Connections、MITM、DisplayOnly、bonding；吧唧显示随机六位码，用户在 Android 系统配对界面输入。不开启自动确认；旧 bond 冲突不会静默删除。
- 手机“忘记设备”后若吧唧保留旧 bond，点吧唧上方“配对管理”，阅读确认框并手动点“清除配对”。该动作在 BLE host 上只删除已配对 peer 的安全和 CCCD 记录，不清除猫咪绑定、快照或事件。随后在手机忘记旧记录并重新输入屏幕验证码。无需擦除 NVS 或重刷固件。
- GATT RX 必须加密并认证，TX 只向加密认证且订阅的连接发送。显示初始化失败时不启动 BLE，避免不可见验证码。
- App 完整快照经过范围、UUID、版本校验再写入 NVS。拒绝旧 revision、不同 petId、同 revision 不同状态；单板绑定不能通过新快照静默覆盖。
- 触摸产生 pet 事件，单调 counter 与事件队列在同一 NVS blob 原子提交后才显示“收到”。200 条满后禁用新互动并提示连接手机，不丢弃旧事件。
- 最旧未隔离事件每两秒重发，收到 `applied` / `duplicate` ACK 才持久移除；`rejected` 持久隔离并显示错误。用户处理手机问题后，可按界面提示长按小猫，将隔离事件按原 ID 重新排队；不删除记录或分配新 ID。长按不会同时产生新摸摸事件。状态显示只代表 App 最后确认快照，吧唧不擅自结算游戏数值。
- 断连重新广播，重连后重放未确认事件。NVS 保存绑定、快照、单调 counter 和队列，手机去重后消除“落库后未收到 ACK”的重放。
- v1 未定义独立时钟同步，timestampMs 为 0 表示未知。快照 updatedAtMs 是状态修改时间，不能假定为发送时刻；接收端记录接收时间，不伪造离线事件的实际墙钟时间。

服务 UUID：`7b2e1000-6a6d-4d8f-9c45-4f4d43415431`；RX `...1001...` Write With Response；TX `...1002...` Read/Notify。双方按 MTU 分片、串行发送、以换行结束 UTF-8 JSON，输入上限 2048 字节。超限丢弃至换行。半帧发送失败终止连接，避免重试拼接到旧帧。协议正文以项目 `protocol/` 为准。

## 资产与剩余验收

`main/assets/badge_f20.c` 原样取自用户本地 `吧唧交互规范开发包.zip`，用于真实中文排版。源 ZIP SHA-256：`e69d4bb8b116c34101fdf2af332c58cbefde4ae7428b5613c4dbc4997124aa24`。开发包的 650 字节中文字体许可说明提取到 `main/assets/FONT-PROVENANCE.txt`；完整 OFL 1.1 文本已保存为 `main/assets/OFL-1.1.txt`，来源为 [Noto CJK Sans 官方仓库](https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE)；保留原开发包中的来源说明。

原型恢复的真实 `pixel-cat`、原始 loader 和灯光生成的 `assets/rendering/cat-idle.png` / `cat-paw.png` 已接入点击区域。只有互动成功落入 NVS 时显示 650ms 抬爪反馈，游戏数值仍等待手机确认。两张静帧只覆盖当前闭环的站立/摸摸反馈，完整原型动画和 3D 交互尚未完成。

资源可重复生成：

```sh
python3 firmware/tools/convert_cat_sprites.py
python3 firmware/tools/convert_cat_sprites.py --check
```

脚本依赖 Pillow；共同 alpha 裁剪框和同一缩放/锚点保持两帧对齐，不重新画猫。输出固定 200×180，`RGB565A8` 为小端 RGB565 平面随后 A8 平面，RGB stride 400、alpha stride 200，不预乘；匹配 [LVGL 9.5 官方转换器](https://github.com/lvgl/lvgl/blob/v9.5.0/scripts/LVGLImage.py)。两帧数据共 216,000 字节，源图/输出 SHA-256、裁剪框、Pillow 版本在 `main/assets/cat-sprites-manifest.json`。无需运行时 PNG 解码器。

已实现源代码不等于构建或真机通过。集成方需记录以下结果：锁文件/ESP-IDF 精确版本；实际板卡存储与型号；BSP 启动和触摸坐标；手机扫码/权限/配对输入；认证读写；绑定与重连；断电重启保留事件；重复 ACK；队列满；NVS 错误；帧分片；真实帧率/内存/电池功耗。

尚未加入 OTA、双板遇见、麦克风、Wi-Fi、传感器采集、音效、马达、云端、自动遗忘或宠物绑定清除。使用官方 CO5300 亮度 API：活动 80%、30 秒无输入降至 35%、触摸或显示配对码恢复；只在状态变化时重画标签。此为基础降亮度策略，AOD/整机睡眠/电池功耗仍需目标板实测，不能据此称全天续航完成。

官方基线：[仓库](https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.75C)、[LVGL v9 示例](https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.75C/tree/main/examples/esp-idf/02_lvgl_demo_v9)。
