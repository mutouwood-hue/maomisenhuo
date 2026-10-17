# 018 独立输入 delta 审查

**未发现已复现的 P1/P2 阻塞，可由唯一设备线程保留数据安装，按既有NPC进行短按/长按/滑出/关闭重开实屏验收。** 本审查未改候选，未操作设备、ADB、串口、浏览器、BLE、权限或网络；新证据仅本目录。

## 冻结核对

- APK617633B，SHA256 `f4c683609533fa54d388065bee9a28c5d723bbead4da53fe90ff4aa02b5c0f17`。
- ZIP118文件/1143477B，SHA256 `e69b5fe656b7b9e32bdedf5ae7d5aa9c70e17e98f8a1f2eab482b9c349c25be9`。
- SDK35 apksigner实际v2验证通过，同证书 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`。见 `apk-signature.txt`。
- 118源及ZIP逐文件SHA、29个APK assets逐字节全部一致。017原115源/APK/ZIP重新核对未变；见 `frozen-hashes.json`。
- 其余17旧web、7game、4生产Java及原HTML与017字节相同。仅逆还原closeMeet/resetGame的cancel和原键事件段后，完整game-08逐字等于017，SHA `b27cc4abf43825aa56957ba79707a2b2f1c54e7e687a4a8343e75773d536d83b`。原arm/tap/有效期、判断/奖励/规则/事务未改变。

## 生产路径判断

- `offline-meet-key.js:2–4`：head只定义bind，不访问DOM、不注册输入、不起timer；实际bind仍在原game08经Native权威恢复之后才运行。原18个deferred游戏/Host/adapter加载顺序未改变。
- `:6–13`：当前原session、rhythm/idle、modal on、非hidden才接受按下；固定1000ms调用原arm一次。成功release fallback只在同pointer、仍在键内、elapsed>=1000且未完成时调用。move越界/cancel/leave/lostcapture走纯cancel，阈值已过但timer迟到也不套用成功释放分支。
- `:8,18–22`：cancel先清press/timer，再释放capture和样式；原closeMeet/resetGame先同步cancel(true)。hidden/blur/pagehide清未完成输入；persisted pagehide保留重新按的能力，真正离开dispose。
- 原Host suspend仍调用原social.closeMeet，新增hook同步取消，Native前后台通知经原Host路径不会让旧长按继续arm。原arm自身15秒规则不变。
- 新CSS仅作用原键选择/菜单/touch-action；原48px几何与其它长文滚动未改。浏览器真实选择柄/PointerCapture次序仍需实机确认。

## 本轮执行：19/19通过

```sh
node --test tests/android018-review/key-boundaries.test.cjs artifacts/html-offline-candidate/ui018/source/tests/meet-key.test.cjs artifacts/html-offline-candidate/ui018/source/tests/native-bootstrap.test.cjs > tests/android018-review/key-delta.tap
```

- 候选12项actual packaged arm/modal测试：999/1000ms、timer迟到正常释放、越阈cancel、滑出/多指/foreign up、lostcapture、close/reset/reopen、后台/blur/pagehide/BFCache、局部选择/菜单抑制、三hook逆还原完整SHA。
- 4项原Native bootstrap门禁：权威恢复前游戏/Host/adapter不执行，失败不降级，普通浏览器无durable设备能力，slot隔离。
- 独立3项：head定义在Native迟到时不读DOM/不起timer；实际原Host.suspend在1100ms但timer未执行时关闭原modal并清输入，恢复后新按仍可arm；timer迟到的越界pointerup/pointercancel/lostcapture均不arm，下一次正常释放仍可arm。

Node/JSDOM和模拟clock/pointer capture是明确软件fixture；实际原arm/modal/Host代码被执行，没有执行用户档、领奖或真实暗号完成。测试不等于Android选字冲突和真实PointerCapture验收。未重跑未变Native/BLE/睡姿/导航全套。

## 设备接续边界

root唯一保留原档更新，使用既有NPC：<1秒短按应idle；约1100ms长按应armed且无选择高亮/柄；关闭再开应idle；<1秒滑出释放仍idle，下一次长按可用。不得点先敲、敲屏、奖励或spawn替代输入验收，不改档/时钟。自然banner、Native实盘/强杀、CFLOCAL2、双端peer完成继续保留原待验状态。本轮进程全部结束，无在途操作。
