# 038＋053 锁屏连接与清洁入口：源码准备及修复方案

> **接续更新（2026-10-17）**：以下保留为最初调查历史，不代表当前状态。准确候选源码已找到；本次已完成锁屏生命周期/自动恢复、清洁与低频手机时间/已有授权定位询问，取消45秒应用租约且不加持续WakeLock。手机未签名封包及ESP-IDF5.5.5完整固件编译均退出0，未安装、未刷写、未实机验收。最终状态、源码与产物哈希及实机边界见 [交付状态](../artifacts/lock-clean-fix/DELIVERY-STATUS.md)；Notion [修复候选](https://app.notion.com/p/3fcc209ad67f816dba75d53574ccfb2a)已读回。原手机升级签名仍未恢复，不能直接覆盖安装。

## 状态
本次为源码调查和方案准备，尚未修复、编译、安装或验收。用户已明确允许用户可关闭、带常驻通知的后台 BLE 连接。仅处理这两项，不扩展定位、录音、Wi-Fi感知或玩法。

## 已确认与证据边界
- Notion交付记录的当前对象为手机038（com.catforest.htmlcandidate / code29）和固件053（0.5.3-day-startup）。
- 当前Windows工作区只有旧Kotlin应用com.catforest.app及旧v1固件，没有找到对应LocalV2BleBridge.java、local2_core/ble源文件、ui038或053冻结目录。现有两个源码ZIP也未发现上述实现。
- 额外检查D:\黑客松、D:\workbuddy、D:\干活、D:\tmp、D:\build、D:\baji-v2-stage、D:\orangecat-m2及用户Desktop/Documents未找到目标文件；整盘/用户目录宽范围查找超时，不宣称全机不存在。
- 旧MainActivity.kt:1144在onStop明确断连，onResume:1142没有自动重连；这是旧工程事实，不是038的根因结论。
- 旧badge_pages.c:604–611只有四个照料图标，且注明需手机完成；不能据此声称053相同。
- 现有050共享契约只有pet/feed/water/play/sleep五种动作，没有bath。可见入口不是唯一缺口：清洁必须扩展两端白名单及能力协商，不能把water误当洗澡。
- 旧PetStore.kt:273的bath规则为clean+35/mood+4/energy-3，xp8/cost2/health+1，clean>=95拒绝。仅供核对线索，038实际原规则须读取准确源码，不直接移植旧数值。

## 修复设计（未实施）
### Android锁屏连接
1. 从准确038源分离连接所有权到connectedDevice前台服务；Activity暂停只停UI和未完成用户交互，不关闭服务GATT。显式关闭后台连接/断开则取消所有重试。
2. 在应用可见、用户启用时启动服务并显示常驻通知（状态、返回应用、停止连接）。声明适当FGS类型及权限，Bluetooth权限按现有授权检查，不自动开启蓝牙、不新增定位/录音，不以隐藏WebView常驻运行游戏。
3. 一个GATT所有者、一个串行命令flight；保留原12秒保活、45秒设备租约及HELLO身份校验。断连退避恢复原deviceId/clientId，同代回调校验；权限撤销、蓝牙关闭、所有权冲突明确停止并提示。不自动绑定其他设备。
4. 后台若无法安全调用现有权威结算链，只维持连接/读取或让设备保留队列，禁止先ACK后结算。回前台按原pending恢复→新鲜snapshot→FIFO顺序同步。后台结算必须先确认准确实现线程与持久语义。
5. 用户强制停止应用不承诺自动复活；重开恢复原设备。锁屏连接维持与系统杀进程恢复分别说明；FGS不是无限后台保障。

### 清洁入口
1. 在准确053照料页提供明确可见且圆屏安全区可触达的洗澡入口；核对触摸命中、滑页、提示和中文字体字形。保留原四动作及摸摸，不删除既有照料。
2. 增加bath动作和显式能力（建议care_bath_v1，最终名待两端源码核对），旧手机不支持时显示需匹配手机，不能发unknown动作造成队列头永久堵塞。
3. bath与eventId/counter/FIFO在同一NVS提交；只显示已记录/待手机结算，设备不修改clean、币或成长。
4. 手机按038实际原规则执行清洁，权威状态及完整原终态reason/digest落盘后ACK。余额不足永久拒绝，不等有钱补扣；重复沿原收据，不重算。
5. 新设备离线排队、重连消费；旧手机与新固件混用必须兼容门禁或明确阻止，不迁移/清空原绑定及存档。

## 已连接设备后的准确038调查
- 手机ADB serial ZYPZ261A01M65K0002A已授权可读；实际包com.catforest.htmlcandidate为code29 / 0.3.8-little-moments，firstInstallTime 2026-10-15 23:14:25不变。
- 仅复制公开安装APK，819895字节，SHA256 b25d2c457baed7eaae8323f996096afe4ecf4c125eb7b7c200eef520cce50897，与Notion冻结值完全一致。未读取私有存档、Key、配对密钥。
- APK及原始JS资产已恢复于artifacts/038-053-recovery/。这恢复了准确038的Web实现，不等于恢复原始Java源码或053固件源码。
- 准确038字节码证明：MainActivity.onPause调用LocalV2BleBridge.setForeground(false)；对应setForeground执行stopScan和endConnection，原消息为App left foreground; reconnect is disabled。故锁屏触发Activity暂停时应用主动断连，是已确认实现行为，不需假设系统首先杀进程。
- 精确JS证明：offline-host.suspend停止协调器；offline-scene-sync.setForeground(false)清授权/保活/重连计时器；回前台设置true才调度原设备恢复。实际恢复失败的全部原因尚未确认，不能说移除断连就能修全。
- 准确038 offline-device-events.js:11–15确实没有bath，未知清洁事件被保留并拒绝消费；cflocal2-adapter的snapshot动作允许bath，只代表显示快照，不代表照料结算支持。清洁需补真实事件白名单，不能仅改快照。
- 吧唧USB枚举MAC 7C:0C:5F:42:36:84、串口COM3，与历史设备相符；未打开串口、复位、读Flash或刷写，运行固件版本尚未现场读取。
- 找到既有Android SDK于D:\黑客松\mobile-pet\.toolchain\android-sdk；已使用其ADB/dexdump只读调查。该相邻工程不是038原始源码。
- Notion最新JSON返回交付记录in_trash=true/archived=true，markdown完整且unknown_block_ids为空；不擅自恢复回收站文档。后续完成后需确认可编辑的文档位置。

## 接续所需
准确038手机源码ZIP、053固件源码ZIP及FROZEN/HANDOFF（可提供现有本机路径）。若要原签名覆盖安装还需原构建环境中保留的签名能力，不生成新证书冒充升级。

## 验收边界
源码核对/普通编译不等于实机通过。实机最终分别确认：锁屏保持、解锁回前台、设备唤醒、蓝牙关闭后恢复、显式停止不重连、同设备身份；清洁在线/离线、余额不足、重复回执/重启不重复结算。不清档、不改系统时间、不强制生成奖励、不刷写设备。既有技术测试禁令本轮未扩大授权。

## 官方参考
- Android后台BLE：https://developer.android.com/develop/connectivity/bluetooth/ble/background
- Android前台服务类型：https://developer.android.com/develop/background-work/services/fgs/service-types?hl=en
官方页面已请求，但工具只返回截断导航，未据此宣称完整审核具体API细则；实施前需完整核对connectedDevice与目标SDK限制。
