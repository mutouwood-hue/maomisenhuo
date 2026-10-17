# 第三轮独立集成审查

日期：2026-10-15。范围：最新本地恢复事务、纯 Kotlin 生活规则与原型来源、Android 本地出游/诊所 bridge、吧唧四页面/手势/反馈。审查者未修改产品源码，未运行目标/重型构建、未打开真实蓝牙或操作设备权限。新增检查只位于独占 `tests/lifecycle-review/`；两个正式存储测试经 root 再次明确授权补入并读回确认。

## IR-09 / P1：出游自动超时负结果与迟到的成功提交分叉

原路径：`scripts/prepare_life_assets.py` 的 worldEvent 在 15 秒后删除请求并自动 resolve `{ok:false}`。原型 Mf 会撤销本次节点的本地可见完成标记；若 Android 此后才完成原生持久化，迟到的成功 response 找不到请求，renderer 不再接收。下一次点该节点被业务规则以重复节点拒绝，当前场景无法补齐目标。choice 有同类问题；settle 真正成功后原生 token 已清空，renderer 却仍看到失败，继续重试也无法完成。慢磁盘/延迟原生回应即可进入此路径，无需无线电异常。

已向 root/Android 负责人报告。root 选择并实施的修复是移除自动 15 秒负结果：Promise 只由真实 Native resolve 或显式 stop 取消完成。它保持原规则的重复节点保护，没有通过重复发奖掩盖恢复问题。

独立执行 `tests/lifecycle-review/test_world_response.py`：**2 passed，0 skipped，0.338 秒**。测试执行实际生成器中的 bridge，并核对、执行 APK 内 `world-core.js` 的同一生成后缀，包含四个 source/artifact 子场景：

- 虚拟时钟经过 20 秒，原生还未响应时 Promise 仍 pending；迟到的成功被接受，实际 collected=1；同 response 第二次 resolve 被忽略。
- 用户显式 stop 后 pending 请求得到取消结果，旧成功回应不会重新生效。

这验证 JS 消息/Promise 生命周期，未运行 WebGL 渲染、Android JavascriptInterface、磁盘或实际手机。当前源码与生成资产的该修复一致。

## 存档与本机恢复事务

独立复读 `PetStore.persist()`、retryRead、restoreLocalRecovery 和 restore：

- 保存先写入、显式 fsync，再 finish；读回逐字节比较并 decode 后，还必须成功推进 last-verified 副本，才能交换权威 RAM 或返回事件 ACK。
- finish 后不确定结果转为 blocked/StorageFailure，不对已关闭/已提交的流调用 failWrite；旧 RAM 保留。retryRead 先校验真实主存档、修复有效副本，再加载 RAM/解除 blocked。
- hasVerifiedMemory 区分“仍有有效旧 RAM 的 blocked”与“损坏冷启动仅为显示创建的临时猫”。同猫恢复会合并有效去重记录并推进 revision，不把临时新猫当作已验证历史。
- 本地恢复需用户确认，保留被替换主文件；恢复读取副本后仍通过完整持久化流程。

本轮新增 `test_verified_recovery.py`，由 root 在串行生命周期套件中执行并报告 **4 项全部通过**，审查者未重复 Kotlin 编译。新增用例在 primary rename 成功后才阻塞 last-verified 临时文件，检查：无 ACK/旧 RAM 不变；未修复时 retryRead 仍不换 RAM；修复后读取磁盘去重；之后冷启动损坏主文件，从 latest verified 恢复仍是同猫、revision 前进、同事件 duplicate、心情不再增加。root 的这四项包含此前三项生命周期检查和本轮一项恢复检查。

另核查到 `test_android_state.py` 在核查时只有原七个方法，未包含第二轮报告所称两个正式方法；不能据旧 40 项结果宣称它们已覆盖。经 root 再授权，已重新补入并用 Python AST 读回确认当前 **9 个 test_ 方法**：包括 silent-finish failure 和 committed-but-unreadable finish/retryRead dedup。故障注入钩子与编译依赖均在。完整 protocol 套件由 root 后续统一执行，本报告不提前声称 42 项已通过。

## 本地生活规则与来源

本地原件 `小橘电子宠物.html` SHA-256 已重新读取，仍为 `3e1b68b6dcef89ce6003961e0abb41354785443bd0427b83ed70f7589fd8af53`。独立核对 `tests/local-life/source-rules.md` 的符号映射及原型实际 `vu.Le/he/Me/Ae/Be/ke`：

- 出游为原节点/目标/12 或 15 秒门槛，只有全部目标与时长满足才统一结算；story 选择原本即暂存到 session，完成时才影响心情、健康、库存与金币；取消不发临时收获。
- 诊所为无病 4 币/有病 8 币，原检查 3 步与最少 1500 毫秒，完成后才收费与清除病况；取消无费用。
- helper 先克隆候选、检查、变更并复验，只有成功才复制回候选；不会直接修改磁盘或 revision。库存出售不产生虚构库存；接鱼分数不等于背包鱼数量。
- pending 的 startedAtMs 不直接用于结算时长；Android 只用本次前台会话 monotonic elapsed，冷启动 pending 有明确收起入口，不能凭墙钟自动领奖。
- sniffles 阻止出游、爬架/逗猫等剧烈互动，但原接鱼仍可赚币；精力不足可免费睡眠/喝水，因而未确认“没钱治病又不能赚钱”的软锁。诊所与原有接鱼/照料的完整 UI 可达性仍需 Android 执行验收。

上游 `tests/local-life/latest-report.json` 的 14 项纯 helper 通过证据记录了来源哈希；本轮已核对其 production hash 与当前 helper 相同。此为该工作流的 host 证据，审查者没有重复运行。

## Android 会话与实际 bridge 复读

当前 MainActivity 的 world/clinic 都有每次 WebView 独立 generation、原生 token 与 active 检查；本次活动起始计时来自真实 renderer ready。world 消息先调用 PetStore 持久化，真实返回结果后才 resolve 原 Mf；clinic 原 Sf 三步完成后由原生按钮确认结算。onPause 关闭活动并尝试持久取消；若写失败，pending 不被假装清除，回到小屋后可先恢复存档、再显式收起。旧 WebView 的回调受 generation 过滤。

这些是源码结论。尚未据此声称世界/诊所画面、Android bridge 参数转换、所有手势或手机生命周期实际通过。

## 吧唧四页面与互斥手势

独立复读 `badge_pages.c`、badge_gesture.c/.h、badge_ui_contract.h 和当前 managed LVGL 的 indev 事件顺序：

- 当前为 Home、Status、Device、Touch 四页；不是全部 23 个原型页面。手势参数来自 ZIP v0.3.0：tap≤300ms 且最大移动<12px，hold≥600ms且移动<12px，swipe≥50px且≤500ms；最大移动保留“移出再移回”的历史，unsigned 时间差支持 timer wrap。
- 在所用 LVGL 源码中 indev RELEASED 先于对象 SHORT_CLICKED，发送时 indev 回调又先于对象回调；分类结果因此先于 pet/navigate 按钮门禁。切页/过渡、配对 modal 与触摸页会阻止摸摸；触摸自检没有 care 结算调用。
- acknowledged_events 只在匹配队列事件的 applied/duplicate ACK 删除成功持久化后递增；重复 ACK 找不到队列项不增加。snapshots_received 来自合法接受/幂等快照；不是虚构互动计数。
- ACK 到达时才触发手机确认反馈；本地点击反馈明确表示“已保存，等手机确认”。背景/状态条颜色只根据已保存快照的 energy/mood 等值，不捏造出游、连接或生命活动状态。

四页 LVGL 的真实视觉、安全区、触控方向、长按/滑动和配对弹窗仍需实物验证。当前没有经过产品审批的出游同步字段，本轮没有把手机出游映射成吧唧已实现能力。

## 当前结论

本轮新确认 IR-09 已由 root 修复并通过独立 JS 延迟/取消检查；上述恢复与规则复读未确认新的未修 P0/P1。Android/固件目标构建和完整回归由集成方统一记录，真实单板及系统权限仍是独立验收闸门。
