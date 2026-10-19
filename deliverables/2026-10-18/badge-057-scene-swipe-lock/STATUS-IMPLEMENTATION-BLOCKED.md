> 历史阶段记录：素材阻塞已通过用户授权的私有 Drive 中转解除，两图已在 Mac 实际查看，后续完整实现与烧录已完成。最终状态请读本目录 `DELIVERY.md` 和 `MANIFEST.json`；本文保留最初受阻时的事实，不再表示当前状态。

# 057 合批候选：参考图阻塞，未烧录

本批尚未交付完整 UI/锁屏，不应把候选镜像烧到设备。基线仍为 b8ca479 加已有未提交 056 hearts 重传修复。仅修改 firmware 和本目录；没有修改 app、提交、推送、reset 或清理。056 修复及其他任务的工作区改动保留。

## 当前阻塞

必须先看像素的两图为 `libfile_377af3fe0aac81919a07c42d10e2acd3`、`libfile_4abb67bab44481918212f5316e2e0d4c`。已读 Library 技能及 resolved-reference materialization 说明。当前执行上下文仅有 Library create/replace/prepare_uploads/finalize_uploads，没有 read、prepare_materialize、search、list，也没有工具搜索入口。因此没有受支持的路径把两图物化到 Mac；没有借其它权限路径下载、没有假装看图。

已及时在进度消息报告，并询问两图是否有 Mac 本地绝对路径。结束时仍未取得。需要上游提供合法物化后的真实文件路径，或恢复受支持的 Library 读取/物化能力，才能继续视觉实现。

## 静态根因与已完成的非视觉修改

- `badge_pages.c::drag_update` 原先对 HOME 水平手势直接 return，随后 `swipe` 在抬手后换 face；不是跟手滑页。旧 `build_home_peek` 是未使用的占位 HUD，没有真实一天进程。
- 现在在拖动起点，将真实源页及目标页一次性合成为 RGB565 整幅快照；两个缓冲显式放 PSRAM，466×466、按 LVGL stride/align 分配。跟手与 settle 只移动整幅图，背景、猫、HUD 同步。原页面保持 PRESS_LOCK 输入所有者，覆盖层不抢触摸。
- HOME 目标 face 只从已有 domain/day RAM 投影合成，未调用 core poll/ACK/nav。达到阈值在 settle 完成后提交，否则回弹。源猫姿态以 GUI checkpoint 保留，取消时恢复，未增加养成事件。快照分配失败时 HOME face 安全取消，其它页沿用完整对象平移回退。
- 把纯 HOME 投影提为 `project_home`，与 `refresh_state` 的收件/ACK/持久状态处理隔开。原有 touch/settle 期间 UI 延后机制和独立 BLE/存档任务保留。
- 删除普通快照同步成功 toast，以及 transient core busy 提示。断连持续 15 秒才显示小“离线”提示，恢复清除；待确认仍只来自持久 core 队列。ACK/保存失败结果保留。
- 圆环原已有从 DOWN 到 UP/cancel 的捕获；补充 swipe/drag_update/drag_release 的捕获 guard，避免其它路径误导航。未以技术测试声称已通过。
- 删除换 HOME face 时凭空播放 WALK 的表现。动作继续来自已保存本地事件/已接收快照。

显示端仍是固定 BSP 的 48 行 PARTIAL buffer，TE physical revision 未确认且配置关闭；原有 DMA/flush_ready/引脚/分区表均未改。本批减少滑动时每条带重复绘制世界/猫/文本的 CPU 工作，**不能据此声称硬件条带感、撕裂或帧率已解决**。

## 仍需实现，未冒充完成

- 先读取两图像素，再实现猫居中的主场景、顶部真实时间/天气小图标/连接、底部低对比名字、猫侧短气泡和真实睡眠姿态。
- 当前 `set_mode` 只切 dimmed，后续 `project_home` 仍可重新显示 heading；没有独立待机画面，所以“一天进程”及 world_draw 的孤立窗户/横条可能留在锁屏。当前 250ms 状态刷新也仍在待机调用样式写入，需要独立按需投影。此处尚未视觉修改。
- 现有 10 秒 COMP、累计 40 秒 AOD/OFF 策略和 AOD/OFF 首触消费未改；锁屏不发 SLEEP 的既有边界保留。
- 视觉完成后重建，重新读取实机分区表及 OTA 元数据，确认当前启动 app 分区，再只写该 app 镜像。不能使用本目录构建输出展示的通用 `idf.py flash` 命令，因其包含 bootloader/分区表/初始 otadata。

## 实际构建与设备边界

ESP-IDF 5.5.5、现有 frozen components/依赖锁、现有 `.build/badge-sdkconfig`。初次构建缺少 image cache 声明头，修复后构建成功；随后加入取消时姿态 checkpoint 并再次生产构建 exit 0。最终日志 `badge-build-3.log`，镜像及完整 hash/descriptor/source hashes 见 `MANIFEST.json`。构建内部容量检查为打包步骤。

候选为 `0.5.7-scene-swipe-lock` / 0x691150 字节，现有应用分区容量 0x800000。产物文件名明确标为 INCOMPLETE-NOT-FLASHED。

本批未打开串口，未读写设备、未重置、未烧录；仅看到 `/dev/cu.usbmodem1101` 节点存在。设备仍保留前批实际烧录的 056。未执行测试套件、技术测试、模拟操作、浏览器 QA、设备交互或手感验收。

`candidate-source.patch` 是相对 b8ca479 的 firmware 当前差异，包含原已有 056 修复及本批修改，供继续合批；不能当作只有本批新增的 patch。未纳入手机侧差异。
