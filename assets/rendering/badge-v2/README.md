# 原版吧唧小猫：离线动作素材

来源是项目内未修改的 `吧唧渲染参考V2照抄版.html`，不是 AI 生成、新模型或旧两图拉伸。HTML SHA-256：`352dff431d90289e278af1d09c089d8cf864ed963966c34f6badf0f60f7cdc64`。

`source/` 忠实提取原 script 0 的纯软件 `BadgeRenderer` 与原 script 1 内 `PCAT_B64` 字节。PCAT 为205624字节，SHA-256 `82520ca7f00eb28f005795cc970746150d73075083d4032119d795d19c2d0b4e`，含56方块、14骨骼、6种原始花色、6服装以及 idle/walk/paw 真骨骼动画。本批固定 orange/none；没有生成其他花色或服装来冒充同步完成。原件由用户提供并授权用于此项目；未从文件自行推定额外开源许可。

## 重现

```sh
node firmware/tools/render_badge_assets.mjs --samples
node firmware/tools/render_badge_assets.mjs --full
node firmware/tools/render_badge_assets.mjs --full --room assets/rendering/badge-v2/room/reviewed-room.png
python3 firmware/tools/validate_badge_assets.py
```

第一条只写3张样片、样片并排预览、原黑底参考场景与来源报告。为计算共同边界和颜色预算，它会在内存内渲染全部计划姿态，并逐帧核对原版RGB565一致性。第二条在样片目视确认后才生成全量 PNG、每帧 I8 二进制、`firmware/main/assets/game_*.c/h`。Node 使用本地源文件和纯 CPU 软件光栅化；没有浏览器、GPU、网络、设备或系统权限操作。

## 不变的帧空间与真实时间

所有帧192×208，固定共同脚底锚(96,196)。相机 yaw−28°/pitch14°/distance90、oy24；从所有姿态的同一个联合边界得出唯一变换，只做最近邻统一缩小，不逐帧裁剪、放大、挪脚或拉伸。原动画腿和身体的自然移动保留。透明背景不含原参考的地面圆盘；`samples/original-reference-scene.png` 单独展示原黑色AMOLED与原地面圆盘，不能视为手机房间。

| 素材 | 来源动作 | 帧数 | 完整周期 | 播放 |
|---|---|---:|---:|---|
| idle | 原 idle | 20 | 3200ms | 循环，6.25fps |
| pet | 原 paw | 24 | 2400ms | 单次，10fps |
| walk | 原 walk | 10 | 1000ms | 循环，10fps |
| attention | 原 idle + 原controller stare的head look(−32°,10°) | 12 | 3200ms | 循环，3.75fps；不是12种新表情 |

原 `BadgeRenderer.pose()` 的时间单位为秒，PCAT ANIM 也以秒解析。原 UI controller 把毫秒时间直接传入，存在单位不匹配；本离线导出按真实秒和完整周期取样，未沿用该controller错误或人为加快动作。

## 透明与无损格式

原光栅器新增的少量 coverage instrumentation 只在原不透明片元写入时标记 alpha，既不改几何、贴图、姿态、相机、光照，也不把黑色当透明。每帧都与未改原渲染器逐像素比较 RGB565；保留原黑眼/胡须，即使原RGB565值为0也能使用非透明索引。每帧渲染前清空 framebuffer/alpha/prevDirty，防止脏矩形历史污染。

当前全部66姿态最多17种原RGB565颜色，采用 LVGL9.5 `LV_COLOR_FORMAT_I8`，每帧独立256×4字节 BGRA8888 palette，然后192×208个8位索引；index0为透明，其他颜色索引alpha255。由RGB565位复制展开到8888，逐像素再解回RGB565和alpha，要求完全一致，无调色/量化误差。每帧40960字节，总2703360字节（约2.58MiB），比原40帧RGB565A8预算4792320字节小。

官方布局证据来自工程锁定的 LVGL9.5源码：`src/misc/lv_color.h` 的 `lv_color32_t` 字节顺序；`src/libs/bin_decoder/lv_bin_decoder.c` 的 `decode_indexed` 与 `decode_indexed_line`。两个文件的哈希写入 provenance。未来若颜色超255，会选择RGB565A8，且超过原预算时拒绝继续导出，需先调整帧数预算。

**运行时待验收**：I8软件解码可能将单帧展开为159744字节ARGB8888并进入缓存；Flash省空间不等于目标板解码性能、堆安全、实际帧率或屏幕已通过。根协调构建和真机测量。本工具没有编译固件或连接设备。

## 固件接入

`game_assets.c` 提供强符号 `const badge_scene_assets_t *badge_game_assets(void)`，按 `badge_scene.h` 注册 IDLE/PET/WALK/ATTENTION；各clip自带frames/count/cycle_ms/loop，room指针为NULL，交由scene/root负责真实场景组合。必须由root显式加入CMake，避免依赖weak archive解析。工具不改CMake、state/BLE/protocol/分区、页面或scene逻辑。

`--room` 可选择已审阅的项目内233×233完全不透明PNG，若存在则用现有Pillow转换为little-endian RGB565、输出 `game_room.c` 并在生成registry注册；不存在时明确记录NULL，不隐式造房间、不拉伸或合成透明背景。房间PNG及同目录provenance的哈希记录在总provenance；RGB888→565的通道误差另记，不与原猫I8无损校验混淆。房间文件由独立原几何渲染任务提供，此工具只负责格式转换。

完整来源、样片哈希、共同变换、逐帧alpha边界/覆盖/颜色数、相邻帧差异、原像素哈希与生成C哈希均见 `provenance.json`。样片阶段报告不会冒充已生成全量C，真实固件与屏幕验收也不由本报告替代。
