# 最终 ea578 单行 delta 独立复核

**结论：本次单行变更通过必要的独立主机 delta 验证，可以交接目标构建。没有新增本范围P1/P2阻断；不代表设备验收或刷写授权。**

最终 `badge_pages.c` SHA256：`ea578da18502e72aa4a2aab0a22065523b3c69b51fbb7eb82a776a1050732e17`。

## 变更范围

独立读取旧完整页 `docs/prior-pages-b4f1cddb.c` 并确认其SHA就是历史已测b4f1版本；逐行比对新页确认文件行数相同且只有1239行一个差异，与 `docs/guide-phase-fix.diff` 相符：引导左右手指演示的位置，改用同一个2400ms往返相位，避免1600ms位置计算与2400ms方向计算不同步。

- guide真实手势接受、左右mask、掌握/跳过持久逻辑、modal/输入门控、表盘/clock、toast与事务路径没有产品改动。
- 新manifest较旧manifest额外记录了`badge_gesture.h`；它不是新源码变化。独立对照最早 [read-start.json](read-start.json) 的`a5eaf6b238e043eb4d4b6dc286108437108744801e111d9ec731e7a9ef9dc2ba`，与当前及新manifest相同。
- 其他原已追踪`source/main`文件hash均与b4f一致；测试前后新manifest记录文件hash均匹配。

## 本人实际执行

新建独占 delta runner，编译实际新pages，复用只读已冻结的scene/gesture/字体/猫资产对象及LVGL库；没有调用owner243或424断言函数。测试仍使用owner BSP/domain/pointer doubles，不是设备。

实际UI timer/layout运行两个2400ms周期，每20ms取样一次：

| 指标 | 结果 |
|---|---:|
| 实际采样 | 240 |
| 独立断言 | 724，通过 |
| 最大相邻位移 | 5px |
| 对应2400ms理论相位的最大位置误差 | 3px（断言容差5px） |
| 位置范围 | x157..292 |
| 自动推进guide / 累计LR练习mask / 发出care | 均无 |
| clang `-Wall -Wextra` | 零警告 |
| 测试前后记录源码/库/对象hash | 稳定 |

可复现命令：

```sh
python3 tests/local3-review/run_demo_delta.py
```

- [demo_delta_runner.c](demo_delta_runner.c)
- [demo-delta-report.json](demo-delta-report.json)：实际命令、全部hash、结果和替代层边界。
- [demo-delta-run.log](demo-delta-run.log)、[demo-delta-compile.log](demo-delta-compile.log)

## 已有owner证据的独立核对（没有重复冒称执行）

- `preview/verified-ui-v3/manifest.json`全部当前源hash匹配；76张PNG逐个文件hash等于新manifest，并且逐个与历史b4f图片hash相同。新帧是owner产物，本人未另渲染76张。
- owner实际timer的243断言报告位于 `preview/demo-measure-harness-fix/guide-demo-report.json`；已核对其pages SHA为ea578、harness SHA与当前 `preview.c` 相符。该243项归owner，本人新增独立724项另记。
- 新manifest历史副本：[verified-manifest-ea578.json](verified-manifest-ea578.json)。旧b4f独立10组/1873条、76图几何、25toast验证保留原 [independent-review-b4f1.md](independent-review-b4f1.md) 和 [matrix-results-b4f1.md](matrix-results-b4f1.md)，**没有重写为本轮全部重跑**。

因此旧范围已验证的行为加本次严格单行差异/实际演示复验，可支持新源交接目标构建；最终编译与设备结果应另挂ea578源对应镜像SHA。

## 保留限制

真实屏幕、触摸、帧率、音频、SDK NVS/掉电、Java/GATT及射频双peer均不在本次delta验证中。B/C日程与心动仍缺权威数据、保留空态；没有新造数据。未改生产、UI owner工具或手机候选，未操作设备/浏览器/GUI/ADB/串口。独立窗口已通知root释放。
