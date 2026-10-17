# 薄 WebView 的独立 BLE 适配器边界

状态：仅桥接 ABI 与集成方案，尚无 native adapter 实现。核对对象为 `artifacts/html-offline-candidate/source/`；root没有修改候选UI/Host/Manifest，也未构建、安装、请求权限或扫描设备。

## 已核对的接入点

- `window.CatOfflineHost.attachPorts({control,...optionalPorts})` 与 local/interface.d.ts 对齐。initialize仅注册监听；未接adapter时显示待联调是正确状态。
- 当前 MainActivity 的 `CatOfflineNative` 只提供 exportSave/openPlayer；没有蓝牙扫描/GATT/权限/事件桥。
- 当前候选Manifest没有BLUETOOTH_SCAN/CONNECT等BLE声明。因此仅复制旧JS协议客户端不能在此薄容器上操作真实蓝牙；也不能调用不存在的Capacitor BleLocal插件后fallback成ready。
- 不改现有CatOfflineNative导出/双窗口职责。后续提交独立 `LocalBleBridge.java` + `legacy-bj20-adapter.js`；由唯一集成者在源码稳定窗口接入原生生命周期和加载顺序。UI/Host呈现仍由手机线程持有。

## 拟定原生桥 ABI

独立JavaScript接口名 `CatOfflineBleNative`（未占用现有CatOfflineNative）。所有入口异步，在Activity/UI线程串行执行；同步桥调用不承担GATT等待。外部网页/子框架不得使用此接口，延续候选只加载固定本机资产、禁止外部导航的约束。

JavaScript -> Native：`postMessage(json)`。请求结构 `{requestId,method,args}`，requestId为本页唯一短字符串，method只能是下列白名单，不能执行任意JS/URL/反射。

| method | args | 约束 |
|---|---|---|
| initialize | 空 | 安装监听/读取可用性，不申请权限/扫描/连接 |
| requestPermissions | 空 | 用户明确点击后才调用附近设备权限；无自动授权 |
| scan | durationMs | 1000..10000ms，清本轮列表，真实服务过滤e7f1；前台/权限/蓝牙开关均检查 |
| stopScan | 空 | 结束本轮扫描并返回当前实际列表 |
| connect | address | 只能选当前真实扫描列表，单连接；新generation |
| write | generation, base64 | 20B BJ20，基础控制opcode1..5白名单；同generation，仅WRITE_TYPE_DEFAULT，一次一个GATT操作 |
| disconnect | 空 | 停止扫描/重连、取消在途并关闭GATT，不清数据/配对 |
| dispose | 空 | 清监听与连接；幂等，无NVS/权限修改 |

`write`不是直接给产品UI调用的成功入口；JS层仍必须等待同seq/op应用ACK。固件扩展数据端口未证实前，不开放任意opcode16+的原始签名对象通道。

Native -> JavaScript：固定回调 `window.CatOfflineBleAdapter.receive(event)`。用JSON序列化封装参数，不能把原始设备字节/字符串拼成可执行JS。event分为：

- `result {requestId,ok,result|error}`：明确该bridge操作结果；GATT write成功只表示底层写完成。
- `device {generation,address,name,rssi,source:'native_scan'}`：本轮真实扫描来源，不补造RSSI或设备。
- `connection {generation,address,state,reason}`：connecting/discovering/subscribing/ready/disconnected等；此处ready只映射内部handshaking。
- `frame {generation,value}`：实际TX通知或read结果的base64，原样交给旧20B解析/关联器，不在Native声称游戏同步。

generation由Native连接上下文分配；所有旧callback校验当前BluetoothGatt实例和generation。JS pending以generation+seq+opcode关联，不能把迟到结果交新连接。

## 生命周期集成钩子（需后续稳定窗口由容器owner接入）

1. Activity创建WebView并锁定本机资源来源后注册独立bridge；构建脚本在offline-host.js之后加载adapter，adapter只attach控制端口。
2. `onRequestPermissionsResult` 中将独立requestCode的BLE结果转给bridge，不能与媒体/定位请求混用、互相grant；其余现有行为仍由owner审核。
3. `onPause` 在WebView暂停前直接调用native bridge.setForeground(false)：停止扫描、断开/废弃连接、撤销重连lease；不要依赖此时可能不运行的JS计时器。
4. `onResume` 只标记前台，不自动扫描/START_LOCAL，不因恢复页面显示ready。
5. `onDestroy` dispose并removeJavascriptInterface。桥事件发往已销毁/新页面时丢弃，不触发旧Promise。

Manifest加入BLE相关声明属于后续接入步骤，尚未修改。Android12+使用附近设备权限；Android11及更旧BLE扫描涉及系统位置门槛，与GPS采集分开处理。当前测试手机Android16无需以BLE为由调用geolocation。

## 安全与产品状态边界

- `ready_local`只有实际服务/RX/TX/CCCD成功及HELLO+GET_STATE两次有效应用ACK、GATT写完成后成立。旧固件screen枚举与START_LOCAL进入条件仍待源码。
- attach初始化不得连接/命令传输；真实扫描/连接要等明确点击与系统实际权限。无Native桥就不attach，不可把JS mock接产品入口。
- snapshots/events/rules/encounters继续缺省不存在。不得透传旧云授权、零签名或伪造好友回执。
- 当前候选保留了媒体/定位权限处理入口。用户本轮约束仍为位置/环境/语音/儿童信息默认关闭模拟规划；Native BLE权限路径不能顺带打开这些入口。后续发布前由owner核对这些旧HTML入口是否会真正请求采集；本轮没有实际触发，也没有要求增加/授予此类权限。

## 下一交付窗口

先等旧吧唧源码与手机候选稳定交接，确认控制语义、生命周期与权限门控，再在独立adapter目录实现。此文不是已提交可运行adapter的声明，不阻塞用户先检查不接真机的完整HTML候选。
