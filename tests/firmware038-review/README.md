# 038 独立审查夹具与结果

最终结论及范围见 [REVIEW.md](REVIEW.md)、[decision.json](decision.json)。实际仅 host 软件验证，无设备动作。

- `verify_frozen.py`：107源、ZIP、APP/ELF描述符、目标TU与封存证据核对。
- `run_trust_snapshot.py`：旧ee81三负控；`run_trust_r2.py`：r2三正控、12字段断言。旧文件名negative不代表当前失败。
- `run_logical_trace.py`：r3及仅bounded_face=false的同源副本各8case；实际production pages/scene、生产pointerhandler，手动logicaltick。
- `run_baseline_vertical.py`：冻结037竖向旧路径负控。
- `run_memory_independent.py`：owner allocation fixture原样复制、独立重跑037/r3；非独立测试设计，非target内存保证。
- `dirty-oracle-report.json`：另起进程REVIEW_FULL_ORACLE=1运行，各snapshot强制full重绘对照；不混性能数字。以相同case运行review-r3/review-legacy即可复现，旧037对照review-037。

所有构建/输出在本目录。`source-ee81`、`source-r2`、`source-r3`保留实际原快照；`source-r3-legacy`仅用于恢复旧横滑机制负控，非产品候选。Native/state/clock/pool为明确host ports；不把mock算设备。原先准备态已结束，本轮实际执行与证据pin见报告。
