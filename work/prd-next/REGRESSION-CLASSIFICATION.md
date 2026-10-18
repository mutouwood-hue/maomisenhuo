# 回归失败分类：候选 vs 冻结 0.3.8

## 结论

- **本次仅分类，不修改候选源码、旧测试断言、Git 或设备。**冻结 ZIP 的 `source/` 仅解压到新基线目录，未安装依赖；在基线目录建立了指向候选依赖的 junction。
- 指定 12 个测试文件全部运行：冻结基线 **11 fail、1 timeout**；timeout 是整文件 20 秒上限，不是产品失败判定。
- 候选日志中 **24 个失败测试名称全部在冻结基线输出中出现**，未发现候选独有的失败名称。**同名不等于同一失败原因**：care-runtime 字节断言和 gameplay 断言的首个阻断点有变化，详见下文。
- clinic 反馈、ring 命中层、毕业相册关闭等明确构建插桩会产生新字节，不应把旧“只允许历史 hooks / 固定 changed 数量”的断言当作新增业务回归。候选新增 CRLF 也会使严格字节锚点失败。
- **缺 ui021/ui024（以及 ui023/ui025）历史 fixture 是测试输入不完整，不是产品 bug。**没有用候选替代历史 fixture，也没有修旧断言让它们通过。
- 本分类不证明候选全量正确、不声称所有新增字节均无风险；仅说明已观测失败的来源和基线状态。native/swiftc 工具缺失类和其他未指定文件不在本次复跑范围。

## 输入与方法

- 冻结输入：[0.3.8 source ZIP](<../../artifacts/html-offline-candidate/ui038/deliverables/catforest-little-moments-0.3.8-source.zip>)。
- 候选：[care-runtime 测试](<phone/source/tests/care-runtime.test.cjs>)所在源码树；原结果保持不变：[regression-results.json](<regression-results.json>)。
- 首先 glob 确认 `baseline-check` 不存在（os error 2），随后只解压 ZIP 的 `source/` 条目。
- 基线运行等价于 `node --test --test-reporter=spec tests/<name>.test.cjs`；每文件独立启动，**20,000 ms** 到时终止该测试进程树，stdout/stderr 直接写文件。单文件串行执行，避免混淆挂起与用例失败。
- 候选结果使用既有日志；不重新执行候选，以避免这些测试在候选证据目录产生写入。
- 冻结测试可能在 `baseline-check/evidence` 写测试证据，均在隔离基线树中；无设备操作。
- 基线结果：[baseline-results.json](<baseline-check/logs/baseline-results.json>)；逐项失败名称：[failure-identity-comparison.json](<baseline-check/logs/failure-identity-comparison.json>)。
- 字节比较未用 Git：[原始差异](<baseline-check/logs/source-differences.json>)和[CRLF 归一化差异](<baseline-check/logs/normalized-source-differences.json>)。该清单从冻结文件集合出发，**不是候选新增文件的完整清单**。

## 逐文件分类

表中“通过/失败”是冻结副本实际输出；mounted 文件被上限截断，不能当作完整测试汇总。

| 测试 | 冻结结果 | 候选 vs 冻结身份及分类 |
|---|---:|---|
| care-runtime | 14/3 | 两条 `rejected` vs `quarantined` 一致，基线已失败。第三条整字节历史 parity 测试名称相同但原因不同：候选先失败于 `game.includes(tail)`；基线 tail 成功后因 ui025 fixture 缺失失败。 |
| cflocal2-durable-boundaries | 25/2 | receipt-required 用例及 uncertain-ACK 用例一致；后者实际 `DURABLE_RECEIPT_REQUIRED`、预期 `DURABLE_CHECKPOINT_FAILED`。基线已失败。 |
| cflocal2-journal | 15/1 | `durable receipt and actual read event required before ACK` 同为 `DURABLE_RECEIPT_REQUIRED`。基线已失败。 |
| companion-scene | 7/3 | 两条依赖 ui024 历史负控/字节比较，均 ENOENT；第三条构建负控实际遇到 `python3` Microsoft Store 占位提示，未到预期公式校验。环境/fixture，不是产品 bug。 |
| device-diagnostics | 9/2 | read-failure release 和 event-settlement release 同为 `0 !== 1`。基线已失败。 |
| event-transaction | 24/1 | original eligibility rejection 同为 `rejected` vs `quarantined`。基线已失败。 |
| family-ui | 3/4 | 相同四项：多出 6 个 undefined 预览项、节点引用不等、ui021 fixture ENOENT、异步安装 `12 !== 0`。前/后 UI 断言是基线已失败；fixture 项不是产品 bug。 |
| gameplay | 6/2 | 同名两失败但首阻断点不同：候选 changed-script 数 `5 !== 4`；冻结 changed 数是4，继续到旧 social 文案 regex 失败。包装测试冻结已有 markup/CSS 差异；候选 CRLF 会更早造成字节不等。 |
| host | 8/1 | drawer pause 同为 `[undefined]` vs `[false]`。基线已失败。 |
| meet-key | 11/1 | 仅018 hooks逆转后与冻结017旧 hash 不符，基线也不符。候选 game-08 归一化后与当前冻结0.3.8相同，不能归因于本次clinic/ring。 |
| mounted-diagnostics | timeout；已输出3通过/2失败 | 已观测相同 ui023负控失败及 event-pump失败名称；20秒终止前第五项通过，第六项未完成。候选完整日志第二失败是 `bounded async fixture deadline`。基线无尾部错误堆栈，故这里只确认相同失败名称，**不声称异常细节完全一致**。 |
| native-bootstrap | 2/2 | 同为最后 script `room-layout.js` vs旧 `cflocal2-adapter.js`，以及script数 `31 !== 21`。基线已失败，不是swiftc/native缺失。 |

所有行的原日志可从[基线结果索引](<baseline-check/logs/baseline-results.json>)与[候选结果索引](<regression-results.json>)对应读取。

## 新增源字节：明确插桩 vs 失败阻断点

### 1. clinic：明确反馈插桩，不是本次观察到的费用/门禁变化

[体验插桩定义](<phone/source/scripts/prd_experience_patches.py#L3-L9>)明确包含病种反馈 catalogue、start/journal/result 文案替换。

只读内存 LF 归一化比较 [game-03](<phone/source/android/app/src/main/assets/game-03.js>) 与冻结版本：共同前缀 **24,937** 字符、共同后缀 **723,242** 字符，全部实质差异被限定到原 **808** 字符→新 **1,762** 字符的 clinic 反馈范围。原费用 `issue ? 8 : 4`、`steps !== 3`、`elapsed < 1500`、余额检查、治疗清除及数值调用未改变。

但 care-runtime 当前日志的第三失败**并不是已经走到 clinic字节差异后的旧baseline比较**：它先在拼接的runtime tail锚点失败。只读内存验证显示：冻结 tail 通过；候选原字节 tail 失败，候选 LF 归一化后 tail 通过。[runtime 插桩文件](<phone/source/scripts/care-runtime.cjs>)与冻结完全相同，因此这个当前阻断点是 **CRLF/LF精确字符串契约**。继续做旧“仅runtime hooks”字节契约也必然遇到已声明clinic新字节，但本次没有修断言或假造ui025来执行后续路径。

### 2. ring：明确命中层差异；不要误认 changed-script 5≠4 的来源

[构建插桩](<phone/source/scripts/build_assets.py#L93-L119>)已有选中分钟、环形中心、回放共用时间渲染等 hooks；相对本次冻结清单新出现的 ring patch 是 **`manual-ring-track-only-hit-layer`**，在非 mini ring 添加透明轨道命中层。它属于[game-06](<phone/source/android/app/src/main/assets/game-06.js>)明确插桩字节差异，不能继续要求“只逆转历史hooks后字节完全原样”。本次 companion 的旧字节断言却先因 **ui024 缺失**阻断，没有运行到可比较这段新增字节的阶段。

**gameplay 的 `5 !== 4` 不应直接归因于 ring：**冻结和候选 game-06 均已被标记 changed；候选新增加入 changed 集合的是 **game-05**，源于[毕业相册只读关闭门禁补丁](<phone/source/scripts/prd_experience_patches.py#L10-L11>) `read-only-graduate-album-close-before-live-cat-guard`。集合从 `03/04/06/08` 变为 `03/04/05/06/08`。

### 3. CRLF、旧包装/脚本结构断言

候选[index.html](<phone/source/android/app/src/main/assets/index.html>) LF归一化后与冻结0.3.8 **完全一致**，原字节不同为CRLF。因此候选包装断言目前显示的行尾差异不能升级为新增产品markup/CSS错误；冻结本身对 original 的旧严格包装断言也已失败。大量生成 assets 仅行尾变化，不能把原始差异文件数当作语义改动数。

native-bootstrap 固定script尾项/总数，以及meet-key冻结017 hash等旧契约，在当前冻结0.3.8也不通过。它们需要未来独立的测试契约维护决策，本次明确**不修**。

## 分类边界与未覆盖

- 两条 care-runtime、event-transaction 的状态标签不等、ACK receipt断言、diagnostics release断言、family UI断言、host pause断言等均为**冻结已失败**，不是“新增候选回归”的证据；“基线已失败”也不代表它们自动合理或永远无需处理。
- ui021/ui024/ui023/ui025缺输入和 `python3` 别名问题单独归为测试环境/fixture问题；未安装工具、未引入历史源码、未改PATH或系统设置。
- 基线mounted整文件timeout限制了末项覆盖；不能把其3通过/2失败等同于完整6项结果。
- 其余候选timeout文件、native-durable、swiftc/CSS工具缺失测试未复跑。设备、iOS/Swift、真实无线与native硬件功能未验证。
- 本报告没有对所有候选新增源码完成全面审计，也没有用整套测试全绿作为发布结论。

## 作业收集与写入范围

- `pwsh-302`（workspace/Node检查）已完成并收集，exit 0。
- `pwsh-310`（12文件基线运行）已完成并收集，runner exit 0；逐测试exit及timeout保存在[基线结果](<baseline-check/logs/baseline-results.json>)。runner exit 0不代表测试全绿。
- 无未收集的本代理后台作业。仅新增本报告及隔离基线树/测试日志/证据；候选源码、既有结果JSON、既有回归日志、Git、设备均未修改。
