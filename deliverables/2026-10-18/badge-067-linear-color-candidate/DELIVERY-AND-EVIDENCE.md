# 手机050 / 吧唧067：原生素材颜色管线候选

手机050＋吧唧066的真实连接已由用户明确验收通过。本批只优化吧唧原生素材的生成/取色管线；手机050不改、不重建、不重装。新规则是待用户肉眼选择的候选，不能标为已完成视觉验收或正式PRD标准。

## 改动和来源

旧生成器把已经编码的sRGB直接乘0.64/0.82/1.0。现在贴图先解码到线性RGB，乘glTF线性材质系数及原三档线性光照，再用手机050内置Three r185的ACES曲线和曝光1.22处理，最后只编码一次sRGB。纯材质色直接作为线性输入。透明覆盖率、采样位置、源网格、姿势、相机、投影、脚锚和遮挡没有更改。

`firmware/tools/native_cat_color_profile.json`是参数源，包含输入空间、光照分级、曝光、完整ACES矩阵/拟合参数、sRGB传递函数、已有猫种角色/年龄调色语义和输出顺序。`native_cat_color.py`执行同一转换，`pack_native_cat.py --color-profile ...`输出全部生产资源，并保存配置、SHA256和输入来源。其他猫种替换色使用生成的完整RGB查表，不在设备上用编码RGB重新乘阴影；无需在运行时添加浮点色调映射或新任务。

这是保留现有固定三档漫反射的最小候选，不是对手机房间三盏灯、PBR高光/阴影、背景及屏幕的完整复现。原有其他猫种花纹/角色近似以及睡眠旧造型的边界不因本批改变。没有更改手机房间、全局设备亮度、身份/绑定、存档、协议、小镇或功能范围。

## 生产素材供用户选择

- `visuals/comparison-adult-poses.png`：成年标准橘猫＋口水巾，待机、抬爪、行走三个生产帧，左066、右067候选。
- `visuals/comparison-growth.png`：五种原生体型的同姿势对照。
- `visuals/`里的192×208透明PNG直接来自对应压缩生产资源，未调色、锐化或改变原始像素。对照图仅用同一中性底色、2倍最近邻展示，未经应用/固件执行；不是两端实机截图，不属于技术测试或自动验收。

## 可复用生成规则

规则ID：`native-linear-aces-v1-candidate`，候选状态。入口和精简PRD草稿在随附 `PRD-COLOR-RULES-CANDIDATE.md`，项目源位于 `protocol/2026-10-18-native-color-candidate.md`。

待用户选择后，将选定配置ID及SHA256、真实观感结论写入原PRD并标记正式版本。本次不提前把候选规则写成定稿。

## 生产构建与部署

- ESP-IDF 5.5.5生产构建成功（exit0），镜像内嵌版本 `0.6.7-linear-color`。固件 `cat_forest_badge-0.6.7-linear-color.bin` 共 **6179024字节**，SHA256 `4aa2929920c1cb4ec41c6c325f2bbd9edb1ae00378517c6833fde99d0c17c757`。
- 当前候选配置SHA256：`85cd904ac031a4edb21c899fde102643fb2f88787cba81c9d68eecbd07a01013`。1650层压缩资源共1531337字节，最大解码层仍为11112字节；源模型/配饰哈希、五体型、动作、相机和脚锚元数据保持。见 `ASSET-PROVENANCE-COMPARISON.json`、`production-resources/`。
- 部署前新读取实际分区表、OTA选择及当前应用头，确认原运行066，实际目标 **ota_1 @ 0x820000**，容量8388608字节，写入后余2209584字节。仅写这一个应用BIN；exit0、`Hash of data verified`，见 `FLASH-PLAN.json`、`FLASH-RECEIPT.json` 和 `flash-app-only.log`。没有擦除或写入NVS、绑定、分区表、bootloader、OTA元数据或资源分区。
- 正常复位后的被动启动输出已保存为 `production-startup.log`，包含067版本和从0x820000加载记录。没有发送STATE/PERF或主动扫描、连接、同步命令；启动后的正常业务日志不被当作用户视觉或连通验收。
- 默认沙箱首次在串口参数设置处报 `termios: Operation not permitted`。明确限定读分区和单应用写入范围的沙箱提权获准后完成部署，原失败记录保留为 `read-partition-table-sandbox-blocked.log`，不是电脑或设备不可用。
- `PROTECTED-SOURCE-COMPARISON.json`记录手机源码、其他固件源码及local2队列实现不变。`source-before/`、`source-after/`和 `066-to067-source.patch` 保存本批增量（大资源C完整放在源码目录，未塞进文本patch）。随包手机050 APK和安装回执仅归档沿用，没有重新安装。
- 完整包为 `catforest-050-067-color-candidate-delivery.zip`；外层 `PRODUCTION-PACKAGE.json`保存ZIP大小与哈希。最终规则与实际观感仍待用户选择。

## 用户验收

1. 保持手机050原猫与吧唧并排，在接近平常使用的亮度下比较同一只成年橘猫、口水巾和相近朝向。观察橘色亮度、条纹深浅、奶油色区域及配饰，直接选更接近手机的一版。
2. 可同时查看上述旧/新生产素材对照；它们只帮助定位变化，实机屏幕观感仍以用户观察为准。
3. 若新候选偏亮、泛白或颜色仍偏离，记录具体部位；保留候选配置再调整新版本，不直接覆盖正式规则。本批没有自行判定通过。

未运行技术测试、语法检查、模拟器、交互回放、主动连接诊断、性能基准或自动视觉验收。没有reset/clean、切旧main、commit/push或清空用户数据。066的PSRAM队列与解码暂存区修复保留，已验收滑动参数/末帧、主屏和圆环布局保持。
