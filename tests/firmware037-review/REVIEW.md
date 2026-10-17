# 037 AOD 最小增量独立审查

## 结论

**放行Root在当时新鲜备份、真实当前分区及保护范围校验通过后，直接035→037做一次受控application验证。** 本轮两处037 UI增量未确认P1/P2阻断。036未曾单刷；037继承的私有PSRAM池仍须在该设备窗口验日志、cap/heap/同状态PERF。软件图通过不等于真实AOD/物理滑动/无撕裂或全视觉通过。

唯一对应冻结：

- APP6398128B，SHA `22392ed66544e517277550cb2facc4a2c8ea865641e8624e47eb73ab5b5cc9e9`。
- ELF SHA `c9d07eeb37d60d5afddc347973452388e13505fdbd890e6477dfbfa2f557c753`。
- ZIP2692003B、107源（134总entry），SHA `088e4cfae7583be7667344cc4cba46759df29b51ef669613885fe1e054aed2f7`。

机器结论 `decision.json`；包/编译关联 `frozen-verification.json`。

## 源码边界

精确撤销`main/badge_pages.c:791`提示位置表达式及`:1183`附近phase隐藏表达式后，整文件逐字等于036。无其它产品改动：

1. standby的face1/2提示中心y438，face0仍390。
2. refresh_state的face_phase隐藏条件保留原low&&face0，另加AOD/OFF。

其余50个main、私有mask、BSP、配置、协议、core/store/BLE、字体/资产、诊断等均逐字036。CMake仅版本036→037，preview仅出处metadata，已逐字逆变核对。`update_clock`、字体、时钟中心、唤醒HIT_WAKE、安全半径、输入释放及休眠阈值未改。

107源与ZIP每entry、APP/ELF及APP内ELF摘要、FROZEN/manifest/source-hashes都重新核对，前后稳定；036107源仍冻结。SDK实际compile_commands和封存命令一致：仅1私有mask TU、无host宏，archive恰1mask成员，公共11符号同036；真实参数重定位输出后-Wall/-Wextra/-Werror单TU复编成功。私有静态BSS仍347B，全ELF `.dram0.bss/.data`相比036不增，partition-table.bin精确036。未重复全target构建；owner完整SDK/其余回归仅关联冻结证据SHA。

## 实际独立执行

```text
python3 tests/firmware037-review/verify_frozen.py
python3 tests/firmware037-review/rerun_matrix.py
python3 tests/firmware037-review/run_independent.py
```

所有输出只在本review目录；未调用owner写冻结evidence的脚本。矩阵加载decoder时显式关闭bytecode写入。

- **96运行/10704检查**：实际036负控+037，各48=clockValid两态×三face×PLAY/COMP/AOD/OFF×正常/低状态。036face1/2重叠及refresh回显原负例真实复现；037反转/恢复clockValid、重复refresh隐藏门禁、原字体/时钟字符串/亮度替身均通过。全部PLAY/COMP原始framebuffer逐字036；只有预期standby组合改变。
- **新增6独立运行/7710检查**：三个face×clockValid两态，12次refresh保持phase隐藏；用“保留提示→仅隐藏提示”的同tick全帧差分检查实际墨迹，不只计算label尺寸。每例提示614个像素，face1/2墨迹bounds[201,430][264,444]，face0[201,382][264,396]。每个实际像素都在物理R233内且不占clock行。
- 真实字体的label line bounds为y429..447，已校时clock y382..413（15个空白布局行）；actual ink更窄。透明250px label容器没有全部在圆内的承诺，提示是视觉说明，不把它当全宽hitbox。
- 原production input路径合成触点：safe wake区外(233,465)不醒；新提示中心face1/2(233,438)、face0(233,390)可醒；第一次wake释放不透PET、不改变domain/present/bond/guide记录。状态/照料/设置页没有home_hint可见泄漏，回HOME正常PLAY后提示隐藏、phase恢复。

输出：`matrix-evidence.json`、`matrix-evidence/`全96图/原RGB565/日志，`independent-results.json`及各case日志。真实pages/renderer/定时器/输入代码执行，但clock/brightness/domain/PSRAM/input是明确主机替身，不是设备验收。

## 亲看与开放项

本审查亲看独立生成的036face2已校时负控、037face2已校时、037face1未校时、037face0已校时软件图。036提示确压时间且phase回显；037提示与时间分离，省电phase隐藏；face0保留390位置。OFF软件图只证明布局，实际面板亮度0不能据图声称用户看得见。

这关闭的是**软件候选的AOD重叠与refresh回显负例**。035真实校时face2的已知缺陷已在`tests/firmware035-review/ACTUAL-DEVICE-REVIEW.md`确认，尚须037真实设备新校时/重复refresh画面来关闭实际设备项。不能拿本次软件20:34代替手机新校时。

035相较034的两例各8像素partial边缘残留仍open；037不修该问题。036的20592B私有池实际启用/拒绝原因、真实PSRAM/Internal heap余量和同状态计时未验，原4极端OOM仍断言。物理唤醒/滑动、光学scanout tearing、实际care/奖励、精密时钟及整个PRD均未通过此报告。

本轮无设备/串口/ADB/复位/刷写、Git、删除、联网、冻结源或owner工具修改；独立编译窗口已释放。
