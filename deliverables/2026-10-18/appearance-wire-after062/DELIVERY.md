# 外观字段协议接线交接

**源码已就绪；没有重新构建/打包、镜像preview/Android资产、安装、烧录或验收。** 按父任务明确要求，本批先完成资产无关接线，统一打包/部署等待父任务协调。原062/手机048生产包原始字节未改，不包含本批新字段。

本批已改8个源码/协议文件，基于062相遇完成后的实际主目录快照生成 `appearance-wire-after062.patch` 和 source-before/after。主目录没有合入外观候选的模型、配饰、渲染或原生资产；`badge_scene.h/.c` 未改。没有 commit/push/reset/clean，没有跑技术测试、模拟、自行验收或语法检查器。

- 手机：原 `pet.stage`（baby→kitten）、既有outfit、可选bodyShape加入原scene投影；仍由read()调用原identities.resolve得到wire petId。适配器的字段白名单、成组校验、petView、semantic去重和pushScene均接好。能力 `pet_appearance_v1` 未声明时只发原八项pet字段；有能力时仅年龄/装扮变化也进入新revision。旧pending数据和序号不改。
- 固件：严格解析/回读新字段；独立growth/body枚举，不混相遇meet.stage。快照校验、canonical复制和同revision比较已覆盖新字段。CFL2写schema5，读2/3/4/5；旧数据外观未知，不推断成年。元数据在原内容末尾追加68字节，容量只为这部分从8192增至8260，NVS/分区和原事务方式不改。
- GUI：refresh_state中的现有安全路径预接 `badge_appearance_from_names` → `badge_scene_set_appearance`，接触/滑动/回弹/末帧交接/过渡期间延后。换身份先传NULL，清空/身份未知/映射失败传NULL。主目录尚无候选header/renderer，因此该绘制钩子条件关闭；完整合入候选接口及实现后启用，不用空壳冒充外观完成。
- 保护：PROTECTED-COMPARISON.json显示原scene、gesture、targets、peer相遇源码和手机identity registry函数文本均与本批前完全相同；这是静态证据，不是功能测试。

完整字段、兼容矩阵和GUI接线说明见 [协议说明](../../../protocol/2026-10-18-pet-appearance-wire.md)。

父任务下一步：协调外观候选和原生包，完整合入renderer后统一生成必要资产、分配新版本并生产构建；不能把此源码交接或原062/048包说成新外观已经打包/部署。生产部署仍需重新读取实际目标分区和OTA选择，仅写应用分区，手机原签名原位升级。真机视觉和双机相遇均交用户验收。
