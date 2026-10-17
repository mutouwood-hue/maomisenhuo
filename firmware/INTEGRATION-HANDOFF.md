# Badge 全量集成与实际验证

## 输入与集成

- 目标 `work/integrated/badge/source`，完整源码以 `artifacts/lock-clean-fix/badge/source` 为底直接覆盖，无备份、无哈希、无git、无设备操作；排除 build、build-*、__pycache__、.cache、.pytest_cache。
- 已读取邻居 CLEAN-FIX-HANDOFF、badge/PROTOCOL、lock-clean-fix/PROTOCOL，并加载architecture-design-spec；遵守UI→公开领域接口边界，不引入wire/领域对UI的反向依赖。
- 用053原ZIP `cat-forest-badge-0.5.3-day-startup-source.zip` 的原始 UTF-8 badge_pages 文本做三方比较。053→clean为95行unified diff，053→PRD为157行；将PRD的6个带3行上下文的非重叠hunk应用到clean pages，不以整份旧pages覆盖清洁。比较及hunk记录位于父目录。
- 合入PRD `main/badge_gesture.c/h`、`main/badge_day_ui.inc` 和 `tests/host_live_drag`、`tests/host_day_draw`。跟手只移动已建source/target PAGE，preview不navigate，提交完成后才运行生命周期；HOME横向faces保持053 release-only。
- 保留可见清洁皂入口、五个真实hit中心/r30、清洁三击和取消、bath_allowed灰化/明确提示、原持久FIFO/receipt成功路径。
- 邻居 `local2_core.c/h`、`local2_wire.c/h`、`local2_ble.c`、`badge_ui_targets.h` 与来源逐原字节直接相等，不计算hash。清洁领域gate、当前会话投递确认/FIFO blocked、owner离线RAM授权、host_context协商、session_guard/TTL均保持最新邻居实现。
- 仅同步host_live_drag README的一条已过时说明：已合入day_draw目标HOME preview修补，但仍不做preview新投影。

## 实际验证

1. `python source/tests/host_live_drag/run.py`：退出0，`PASS: production drag object lifecycle + gesture contract (pure host)`。
2. `python source/tests/host_day_draw/run.py`：退出0，`PASS: production day preview drawing + absolute cursor invalidation (host fixtures)`。
3. 普通syntax：借邻居成功configure已有compile_commands，换为integrated源/include路径，保留ESP-IDF/Xtensa真实宏和include，删除-c/-o，增加-fsyntax-only。badge_pages.c、badge_gesture.c、local2_core.c、local2_wire.c、local2_ble.c 5/5退出0，无诊断。badge_day_ui.inc随badge_pages真实include检查。

两host测试均编译逐字抽取的生产函数，使用明确内存LVGL/导航桩和已有clang，C11/Wall/Wextra/Werror。未补桩绕过生产清洁gate。日志位于父目录 `host-live-drag.log`、`host-day-draw.log`、`syntax.log`、`syntax-results.json`。

## 边界

本子代理不重复已知0xC0000409 configure，不跑完整固件build。主代理协调独立构建代理，并负责将最终integrated源码全量覆盖根firmware。未改phone/BSP/显示驱动/版本/存储schema；没有刷设备、git、哈希/备份解冻。host及syntax不等于完整固件编译/链接通过，更不等于真实LVGL事件顺序、圆屏裁剪、触摸手感、锁屏连接或清洁端到端验收。
