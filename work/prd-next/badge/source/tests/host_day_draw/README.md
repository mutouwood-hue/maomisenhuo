# 今日环返回预览生产函数回归

运行：`python tests/host_day_draw/run.py`，仅需要已有 clang/gcc。

逐字提取生产 `main/badge_day_ui.inc` 中 day_project/day_arc/day_draw，以严格 C11、Wall/Wextra/Werror 编译。LVGL 绘制、校时和场景函数是显式内存桩，不连接设备。

覆盖：HOME 移动时弧中心跟随真实对象绝对坐标；CARE/STATUS 返回 HOME 的 preview 保留历史彩段、未来虚线和游标；无目标、取消、非 HOME 目标、face0、AOD/OFF 不绘制；preview 不执行 day_project；旧/新游标失效区域含真实 page 偏移且回到零偏移不累积。

这不证明完整 LVGL 事件顺序、圆屏裁剪、触摸采样、TE/局部刷新、实体帧率或功耗。绘制中心原已正确，不重复叠加 ui_drag offset。未改时间/事件/存档/连接逻辑。
