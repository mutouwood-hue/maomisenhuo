# 015 独立 delta 审查

**未发现已复现的 P1/P2 阻塞。可由唯一设备线程保留数据安装，使用当前幼猫按原规则自然完成一轮睡眠，确认真实观感。** 本审查没有设备、安装、ADB、串口、BLE、权限或网络操作；没有修改013/014/015。新增证据仅本目录。

## 冻结身份与范围

- 015 APK609174B，SHA256 `e860ae0c646c747b471f5cb198e4adb03f1ff07f664367790ddd084cdd849082`。
- ZIP101文件，SHA256 `a731af8e63aca85781c0198e8f708e88ee569bcd0eb8c09085fa99b366ec6d00`。
- APK v2签名实际验证通过；证书 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`，与014一致。
- 当前015的101源/ZIP逐文件哈希、25个APK assets逐字节全匹配。014原101源、APK和ZIP均重新核对未变。详见 `frozen-hashes.json`、`apk-signature.txt`。
- 相对014，运行web仅 `offline-room-bed.js` 与对应打包asset改变。53个保护文件（其余所有web、4个Java、其他全部assets与原HTML）逐字一致。完整原store factory与实际Ef游戏controller亦字节相同；规则、care计时/结算、Native/身份/事件/备份、adapter/transport不变。

## 实际姿态差异检查

`source/web/offline-room-bed.js:24–66` 仍每帧先调用原idle动画复位，再按amount施加躯干侧滚、头颈反滚/朝向与耳朵放松。头scale保留幼猫1.065/成年1；只有耳骨局部Y放松，不缩小头。新support允许头按amount向下落至更薄枕面；没有增加store、timer、成功回调或异步业务。床承托面/位置与上下床路线未变。

原生产ou每帧清inner变换和复位胡须，cancel仍false结束并恢复home/idle。新头颈修改没有独立残留缓存；通过同clock旧014动作机对照确认实际取消后头/耳position、rotation、scale与原idle精确相同。

## 必要测试：8/8通过

命令：

```sh
node --test tests/android015-review/sleep-cancel.test.cjs artifacts/html-offline-candidate/ui015/source/tests/room-bed.test.cjs artifacts/html-offline-candidate/ui015/source/tests/room-animation.test.cjs > tests/android015-review/sleep-delta.tap
```

- 新增头主体/背部相对高度、颈位、朝向、原头比例1项。
- 24种阶段/服饰支撑/床沿边界与重复姿态不累计2项。
- 实际bf/jt/Ot/lc幼/成年整轮2项：床/浴盆/猫爬架逐mesh AABB无阈值交叠；躺下/呼吸/醒来/进入跳跃的逐帧头位移门禁通过，醒后头scale恢复。
- 独立原store/Ef字节一致1项。
- 独立幼/成年各9个phase取消2项：false completion、busy/action清除、home位置/inner roll/胡须恢复；头颈与耳朵所有局部变换精确回到同clock的014原idle，无反滚/转脸/缩放残留。

首次独立测试误要求head.rotation.z严格零，尚未进床的原idle也存在小幅滚转，造成2个无效失败。已改为同clock014实际原idle对照并完整重跑8/8。旧记录保留在 `first-attempt-static-idle-assumption.tap`，不当作产品缺陷或通过证据。

本轮没有重跑205全套或导航。014的360/390实际导航可依据未变源码继承，但不能改称015实际点击过。

## 验收边界

动作机/Three几何实际源被执行，renderer/DOM/纹理和60Hz时钟为明确软件fixture。逐mesh AABB是保守几何检查，不是三角网格自碰撞或Android视觉证明；原大头风格与头颈观感最终以root当前幼猫自然完整一轮实屏确认。不要改档/时钟/姿态或伪造成年来验证。

继承的真实Native fsync/强杀恢复、新固件事件端到端、双端持久peer completion仍未验；本次床表现delta放行不覆盖这些边界。全部测试进程结束，无在途写操作。
