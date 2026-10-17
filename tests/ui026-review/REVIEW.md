# UI026 冻结增量独立审查

## 结论

**放行唯一集成者进行保留数据安装及受控真实验收。** 本轮审查的026冷却上下文、设备结算冻结、等待队头与备份owner增量，未确认P1/P2阻断。此结论不等于真实喂食完成，也不替代安装前后权威存储比较和实际APK回读。

对应唯一最终冻结：

- APK `catforest-html-local-0.2.6-debug.apk`，889633B，SHA256 `a780c0e48b9c2ac2c149e761171a6eb6e9098aee84507be5f6409a9527144ab8`。
- ZIP `catforest-html-local-0.2.6-source.zip`，159文件、1248030B，SHA256 `c422abdcf2fbad3c48c2ce966bf2da9e7b18c2cee6e7ab2bf0c5b70715549abd`。
- 包名 `com.catforest.htmlcandidate`，code17，`0.2.6-html-local`；签名SHA256 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`。

机器结论及全部源hash关联见 `decision.json`、`readonly-report.json`。只读源审查及测试前后159文件hash均保持冻结；025的155源也逐文件复核未变。

## 实际执行及证据等级

命令：`python3 tests/ui026-review/run_review.py`。

| 检查 | 独立执行结果 | 边界 |
|---|---|---|
| 冻结包、159源ZIP、34APK assets、36受保护路径 | 全部相符 | 字节、签名、zipalign、aapt2核对；无构建/安装 |
| 原生产vu + mounted source 的既有17定向 | 17/17，无skip | 用例另复制到本审查目录，只重定位输出及导入路径 |
| 本审查新增独立反例/边界 | 5/5，无skip | 实际生产原闭包/事件consumer/备份挂载/Native JS client；内存RPC/GATT/时间夹具 |
| owner298全量 | 记录298/298，0skip，读取证据 | 未由本审查重跑全部298；不能混称独立298 |

日志 `owner-runtime-isolated-rerun.log`、`independent-runtime.log`；独立数据 `independent-results.json`；复跑owner原17输出 `owner-runtime-rerun/production.json`。测试既不写候选源及其evidence，也不访问真实Java、设备、射频或文件持久化Native。

## 确认的修复及边界

1. **负控与等待零事务。** 实际025原实例同一时间“手机喝水→设备喝水→手机喝水”可使drink累计3；026相同前置状态返回4000ms waiting，FIFO头保留，UUID、digest、seal、ACK均为0，ledger、Native内存权威、源capture及key集合不变。`web/offline-device-events.js:89–91` 在token、异步摘要、preview和seal之前直接defer；finally仍释放owner。允许原普通flush，并未将它冒称零localStorage写。
2. **等待后重做原规则。** 原2s摸摸、4s喝水/喂食边界沿原Hf；独立1999/2000ms用例通过。等待期间进度变化后重新plan当前源，饱食原失败才形成明确未获奖收据；gift/quarantined保留此前p且不刷新。counter和nullable occurredAt不转换为虚构物理时间。
3. **原规则字节保护。** game03仅constructor seed、返回API名、嵌入runtime/install三处可逆hook；精确撤销后与025逐字相同。`scripts/build_assets.py:104–108` 引用原p/Hf/clock，包含原clinic键。17项中的真实诊疗三步→gift→water通过；未新增clinic阈值。
4. **真实公开入口门禁。** `scripts/care-runtime.cjs:14–17` 在原API创建处包装除getState/exportSave之外38公开写方法。17项复跑包含Native await、commit后、hydrate前114次拒绝。独立另取预先bind的38原方法别名，lease内仍全部拒绝；不是仅DOM代理屏蔽。capture包括runtime，异步digest后比较；取消不提交，不重放输入。
5. **lease与备份。** `offline-device-events.js:122–156` 所有权检查覆盖flush/hydrate；错误/已释放owner拒绝。`offline-device-backup.js:63–65,98–100` 将同owner贯穿原导入。独立实际浏览器备份挂载后，freeze期间完整export仍可读且不写；import被拒绝，不覆盖进度。导出不含cooldowns；普通成功import/reset依旧清RAM。
6. **Native结果及生命周期。** 原17覆盖precommit失败、seal成功后pause仍完成游戏/runtime投影但不ACK、重复/未知ACK重试不推进p。独立额外用真实`offline-durable-store.js` client模拟“commit完成但commit/read均丢响应”：client fail-closed、同页重试拒绝，未发布规划runtime；冷重建从权威恢复已结算一次并duplicate ACK，RAM保持原清零行为。是内存RPC，不是fsync/掉电实测。
7. **失败释放。** digest/hydrate异常、暂停、错误owner与重复release定向均通过。输入门禁结束后只有新显式输入生效；失败不播排队动作。已提交但hydrate失败为reload-required、不得ACK；不把所有hydrate异常表述为“从未发布已提交结果”。

## APK运行边界保护

- 所有4Java源、其AndroidManifest源、原HTML、其余7game、index、SceneMap/SceneSync/诊断、Host、Native durable/event store、adapter/transport、原019键及睡姿均与025保护字节一致。
- APK entry增量另保存在 `apk-entry-delta.json`。`classes.dex`等其余entry逐字一致；`classes2.dex`有变，通过实际dexdump完整反汇编比较确认仅BuildConfig code16→17/name025→026（除dump路径）。`classes2-delta.diff` 保留原差异。
- 编译AndroidManifest经aapt2树比较仅版本字段改变，无权限/组件增量；`compiled-manifest-delta.diff` 已规范versionName，剩余仅versionCode。4Java字节保护并非单独拿来证明DEX未变。
- 冻结manifest/FROZEN及父线程给定APK/ZIP hash相符；原17hook parity在执行中实际通过。没有使用作废临时seal。

## 真实验收仍需保留的限制

- 仅同会话RAM冷却保真；原进程重建继续清p。durable receipt负责重复事件去重，不证明物理动作间隔，也未新增跨重启防刷规则。
- Root保留数据更新时应回读安装APK，并比较原猫、游戏/社交/identity/ledger及原9收据（8applied+1quarantined）；journal合法连接推进应分开记。没有新事件的空FIFO不能记作真实照料通过。
- 真正喂食仍需硬件本地第三口成功emit；phone snapshot/USB VIEW/内存事件不可替代。真实新礼物/双机completion、掉电、射频、clock及物理滑动/撕裂/FPS均未由本审查新增验收。
- 原召回后工作pill日程文案遗留未变；本轮不将其说成修好。标准Gradle lint离线未完成，owner standalone lint证据为0error/6warning；实际系统1.6字号未补。

本轮仅写 `tests/ui026-review/**`。无Git、删除/清缓存、候选修改、设备、ADB、串口、联网或安装操作。
