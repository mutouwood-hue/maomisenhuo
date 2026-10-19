# 原生小猫外观＋配饰交付候选

本批替代早期比例候选，不与旧 `appearance.patch` 叠加。交付完整源码差异与生产素材；没有编译 App/固件、镜像 preview/Android、安装或烧录，也没有运行技术测试、模拟交互或自行验收。父任务说明的062/048包不包含本批外观。

## 文件与合入方式

- 独立目录：`/Users/zoumutou/Documents/Codex/2026-10-18/task/cat-appearance-isolated`。
- 最终交接包：`cat-appearance-native-handoff.zip`。
- 完整差异：`patches/native-appearance.patch`；分端为 `native-phone-room.patch` 与 `native-badge-appearance.patch`。
- 文件载荷：`changed-files-native/`；逐文件前后哈希：`NATIVE-CHANGES.json`。
- 初始磁盘快照/哈希：`baseline/`、`BASELINE.json`，包含未提交更新，并非仅检出HEAD。
- 后续父任务相遇构建接点：`rebase-baseline/`、`NATIVE-REBASE.json`。保留新加的 `encounter_patches` 导入和 `instrument_encounters()`，没有修改相遇实现。
- 下载资产：`incoming/`，完整解压包：`native-assets/`；资源来源及哈希：`ASSETS-NATIVE.json`。

请按补丁合入或对照 `changed-files-native/` 合并，**不要用整份 source/ 覆盖主目录**。source/保留了旧快照中的未修改通信文件；本批协议变化由父任务现有接线承担，不从本目录复制这些旧文件。

## 手机房间

1. `native-cat-data.js` 由已授权原生ZIP封装，包含五体型实际网格、三阶段嵌入贴图、idle/walk/paw层级动画及8件×5体型的40套配饰。保留输入GLB哈希。没有重做模型或配饰，没有运行Blender制作/预览脚本。
2. `native-cat-model.js` 是针对这些刚性、无蒙皮GLB的本地读取/播放层。复用现有Three构造器，不新增网络依赖。按glTF节点/关键帧读取POSITION/NORMAL/UV/三角形、材质、LINEAR/STEP和四元数；转换到现有房间的Y向上、前方-Z坐标。
3. `1米=20房间单位`。导入时抵消房间原有阶段整体缩放，保留原生模型已制作的头/身/腿比例；同时取消原房间额外的幼猫头部增大，避免重复套阶段比例。阶段直接来自原 `pet.stage`，没有重新计算年龄或XP。
4. 原生橘猫使用原生三张实际调色图集，保留白嘴、白袜、绿眼与白尾尖。其他既有品种复用原调色/花纹函数，阶段只调整同品种毛色，不换身份。
5. 原生配饰按各型rest骨骼矩阵挂接：`B(t) × inverse(B0)`。口水巾、蝴蝶结、书包、小翅膀及另外四件源资产均可由读取层选取，不能重复套GLB根逆矩阵。已有其他装扮保留原几何，并按该体型的原生映射与骨骼挂点适配。
6. 房间保持原 `root/bones/model/texture/applyAnimation/setMouth/setAppearance/setStage/state/dispose` 接口。14个动作骨骼名称保留，既有房间照料和睡姿仍可调用；配饰随实际节点运动。换阶段/品种后，睡姿胡须缓存随资源版本更新，床面支撑/居中计算排除配饰。
7. 成年 `standard/slim/round` 三份实际资源已接好明确请求接口。当前没有历史胖瘦规则，默认standard，不读取食物/活动数值推算体型。幼年/少年使用各自的阶段资源。

原生配饰ID对应：bandana→01_thick_bib、bow→02_bow、backpack→03_mint_backpack、wings→04_cream_wings；读取层另支持rain_hat/scarf/vest/star_collar。不是把wings替换成cape。

## 用户批准的小翅膀商品

用户明确选择“沿用现有商店购买流程，新增小翅膀商品”。`build_assets.py` 向原Mi目录插入 `wings/奶油小翅膀`，价格沿用书包的32喵币；购买、扣币、拥有、装备、导入校验继续由原实现处理，没有新奖励或解锁算法。

新模型只从房间 `roomAppearance:true` 工厂进入。没有修改小镇runtime、地图、移动或底层结构。其他场景继续旧模型；本批不承诺小翅膀在小镇/接鱼中可见。

## 吧唧生产资源与运行路径

- `pack_native_cat.py` 将同一批实际GLB网格/贴图/三动作转换为5型×66帧的330张基础帧，以及优先4配饰×5型×66帧的1320张遮挡层。配饰投影使用同一动作时刻和真实骨骼矩阵，遮挡由同一基础帧深度决定，不再使用轮廓估算挂点。
- 66帧保持原4段数量/节奏：idle20/3.2s、paw24/2.4s、walk10/1s、attention12/3.2s。attention沿用原注视方向语义，叠加在原生idle上。没有新增动作流程或时钟。
- 生产数据为分层索引色RLE。`native_cat_data.c/.h` 是实际固件资源，原始编码文件 `native_cat.rle` 用于来源追溯，**不需要再同时嵌入Flash**。数据约4.1MB，精确字节和哈希见provenance/ASSETS。
- `pack_legacy_cat.py` 将现有66张I8 C帧无损转储为约391KB RLE，保留原符号、帧序和调色板/索引。外观未知时继续使用这些旧帧，不能虚构成年。原 `game_assets.c` 注册表不改。
- `badge_native_cat.c` 解码基础帧并合成对应原生配饰层。一个scene复用一个40,960字节I8工作区；compact仍输出144×156，标准输出192×208，足底锚点分别为(72,147)/(96,196)。ESP分配在PSRAM。
- `badge_appearance.c` 优先使用原生资源；其他品种按现有品种语义保留配色与辨识部位。吧唧复杂品种花纹是轻量调色适配，不能视为与手机逐像素一致。当前吧唧实际配饰层为蝴蝶结、口水巾、书包、小翅膀；其余ID保留，但不假装已完成全部40组合的吧唧展示。
- 睡眠继续既有原生蜷卧画法，沿用品种/阶段颜色和简化配饰；没有制作新的整套睡眠互动。该画法不是包内新增睡眠GLB动作。
- CMake新增原生资源/解码器，并用压缩版legacy源替换原四个巨大I8数组的链接，防止将旧2.7MB数组与压缩版重复链接。源文件未删除。
- `LV_COLOR_FORMAT_RAW` 仅作压缩旧帧的内部标记；`set_frame()`先解码成I8，才交给LVGL。解码/分配失败使用原cat_idle/cat_paw恢复素材，不把压缩流直接交给绘制器。

分区仍是父任务原8MiB应用分区；本线未改分区、启动项或OTA。素材字节预算不能证明最终镜像装得下，生产镜像大小与Flash/PSRAM实际表现待父任务构建及用户设备验收。

## 与父任务协议线对齐

已只读对齐 `deliverables/2026-10-18/appearance-wire-after062/DELIVERY.md` 和协议说明。本批不改 `local2_core/wire/peer`、`cflocal2-adapter`、scene-map/sync、按键或 `badge_pages.c`。

父任务现有 `project_snapshot_appearance()` 检测到完整renderer后自动启用，继续在原安全投影路径调用：

```c
badge_appearance_from_names(&appearance, growthStage, breed, outfit, bodyShape);
badge_scene_set_appearance(scene, &appearance);
```

接口签名保持一致。父任务已处理能力协商、wire身份/revision、持久格式与未知旧数据；本线不再分配字段或存储版本。`CatPetAppearance.project()`仅是本地只读元数据，不能将其本地cat-1直接当wire身份。

`badge_scene_appearance_ready()`表示资源解码/组合可用及配饰受支持，不表示用户视觉验收通过。换身份/清空仍传NULL。GUI延迟投影、接触/滑动/回弹/末帧交接保持父任务原路径，不从BLE线程操作LVGL。

## 已执行与未执行

已执行：Drive私有下载、ZIP解包、GLB/源文件静态读取、素材封装、生产帧投影与RLE转码、文件差异和SHA256记录。没有开放共享权限、登录、读凭据、新建授权或使用Safari。

没有执行：App/固件编译、语法检查器、技术测试、浏览器/引擎/固件运行、模拟交互、运行截图、视觉验收、性能基准、安装或烧录。素材转码是交付产物生成，不是模拟验收；没有据此宣布模型/配饰动态通过。

父任务下一步：仅合入本原生补丁，保留已完成的相遇与协议接线，统一构建/镜像资源、分配版本、安装和烧录。用户待验收：双端同猫同阶段、品种/毛色、三阶段比例、四件优先配饰可见性与穿模、idle/walk/paw及已有照料动作、睡姿、滑页/锁屏/compact、最终镜像与设备内存表现。原档案仅有限少年穿戴组合有源端预览，不能把全部40组合记为动态验收完成。
