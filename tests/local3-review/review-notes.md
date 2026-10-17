# v3 独立审查准备记录

当前仅矩阵交付，尚无 v3 独立 pass，也没有编译/设备操作。

已读：root本轮要求、`artifacts/firmware-local-v3/docs/UI-SPEC-DELTA.md`、`INTEGRATION-STATUS.json`、当前 gesture/target/UI contract/scene 头接口。UI owner仍持续修改，未据此判断实现缺陷或冻结哈希。

## 已知交付缺口（不是本轮新bug）

- 冻结 snapshot 没有24小时双方日程区段和心动时间，双环可以恢复原几何，但真实环段/心动记录不能假填。B/C验收必须同时检查缺数据说明；future proposal不算已实现。
- 原 `guide_v1` 不能证明真实手势掌握；新偏好需区分，并保留 skip 与 completed 的事实差异。
- Android0.1.2模式与后台取消有parent既有实机证据，不属于本轮v3 UI验证；NPC banner daily6/6待实际条件触发。
- 当前 v3 preview属于in-progress主机离线fixture；Library首图不能成为最终完整手势/帧率/触摸/音频证据。

## 审查优先级

1. P0/P1：guide或拖动release透PET、取消/失败发成功、假造双边礼物完成、旧偏好直接冒充新掌握、写坏旧存档。
2. 布局阻断：完整hitbox超R212、registry漏真实可点控件、toast遮确认/关闭/skip、显示与命中不一致。
3. 交互阻断：错误手势推进、左右仅验证一个、无target越28、慢拖140不提交、跟指变成release-only、回弹/提交计时错或残留页面。
4. 表达/范围：B/C缺双环、无真实数据伪填时间段/心动、静态icon被称为真实事件、声称motor/NFC/未验音频成功。

等待 root 的稳定源码SHA和必要host验证窗口。后续结果必须保存源码哈希、输入坐标/时刻、实际调用计数和证据类型。
