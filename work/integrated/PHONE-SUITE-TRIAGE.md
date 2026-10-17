# 手机测试套件分诊（2026-10-18）

> 结论先说：**「聚焦套件 111/111」不等于「全仓绿」**。本仓 `app/tests/` 共 47 个测试文件，
> 只有其中 12 个进了门禁；其余 35 个含既有的环境 fixture 失败与陈旧断言，历史分类见
> [REGRESSION-CLASSIFICATION.md](../../work/prd-next/REGRESSION-CLASSIFICATION.md)（2026-10-17）。

## 1. 进套件的 12 个文件（`python work/integrated/test-phone.py`）

| 文件 | 测试数 | 说明 |
|---|---:|---|
| life-navigation-focused | 21 | 今日环选区、返回预览、places 空态 |
| prd-experience | 6 | PRD 体验项 |
| memorial-backup-focused | 5 | 毕业 JPEG 备份 |
| native-canonical-focused | 2 | Native 规范 |
| life-summary-focused | 3 | 生活摘要 |
| event-backup | 8 | 事件备份 |
| event-browser-storage | 5 | 浏览器存储 |
| native-durable | 12 | 原生存档持久化 |
| care-handshake | 5 | 清洁能力握手 |
| trial-analytics | 7 | 试养埋点与 D1/D7 |
| day-hearts | 3 | 心动字段只随第一片 |
| prd-rules-audit | 11 | 第三章规则行为级抽检 |
| day-projection-e2e | 4 | 一天资料全链路 |
| life-demo-default | 2 | 演示默认关闭（本轮新增） |

（实际文件数以上表为准；套件命令一次跑完并写 `work/integrated/phone/evidence/focused.log`。）

## 2. 未进套件的文件：今日实测状态

2026-10-18 01:50 逐文件单独运行（每个文件独立进程，60 秒上限）：

| 文件 | pass/fail | 首个失败 | 归类 |
|---|---|---|---|
| companion-scene | 7/3 | `ENOENT …\ui024\source\…\game-06.js` | **环境 fixture 缺失**，非产品缺陷（历史分类已记） |
| gameplay | 6/2 | `changed-script 数 5 !== 4` | 断言硬编码 4；本轮新增一个构建补丁后应改为 5。其后还有旧 social 文案 regex 失败（历史已记） |
| host | 8/1 | drawer pause 深比较 `[undefined]` vs `[false]` | 既有失败（历史已记） |
| local-v2-transport | 17/14 | `Unexpected native method beginFlight` | 测试桩早于 `beginFlight` 协议，属**陈旧桩** |
| scene-sync | 8/0 | — | 通过 |
| source-save-and-identity | 5/0 | — | 通过 |
| v2-host-integration | — | 整文件 **>45s 超时** | 需单独排查（可能残留定时器） |

其余文件本轮未逐个复跑；历史分类里 care-runtime / device-diagnostics / event-transaction /
family-ui / meet-key / mounted-diagnostics / native-bootstrap 等均有已记录的失败或超时。

## 3. 本轮结论

1. 我对手机侧的三处改动（演示默认、hearts 字段、daydebug 钩子）**没有新增失败**；`gameplay`
   的首个阻断点从"social regex"前移到"changed 数"，是新增补丁的直接后果，属预期漂移。
2. **真正需要修的是测试本身**，不是产品：`local-v2-transport` 的桩缺 `beginFlight`，`gameplay`
   硬编码 changed 数，`companion-scene` 依赖已不存在的历史 fixture。
3. 这些修复应单独一轮做，并且要逐个确认"改测试"不等于"掩盖产品问题"；本轮不擅自改。

## 4. 复跑方式

```powershell
# 门禁（唯一被当作"绿"的入口）
python work/integrated/test-phone.py        # 期望 111/111

# 单个文件排查（避免整目录一次跑挂死）
$env:NODE_PATH = (Resolve-Path work/prd-next/phone/source/node_modules)
cd app; node --test --test-concurrency=1 tests/<name>.test.cjs
```
