# 038 独立软件审查准备（未执行）

状态：仅准备夹具/门槛，未读取在途038生产源、未编译/运行038或新baseline测试。037只读源码与已有034–037结果作参考。等worker稳定hash及Root编译窗口后再执行，不能把本文件视为通过记录。

## 建议实施边界

仅横向face有界猫/必要内容位移；固定scene满屏root、底图、环和HUD，提交后才更换face静态元素。透明满屏root仍会扩大dirty，不能只改透明。纵向与短sleep构图明确保留原路径，不暗称已优化。

保留12px axis、快滑50px/500ms、慢拖140px、无目标28px阻尼、200ms提交/180ms回弹、deadline、modal抢占、cancel/release不透PET。原动画tick不暂停；不用原frozen恢复（会清pending回base）。原foot anchor与新视觉offset必须独立，换动画帧不抹掉拖动offset。

## 执行前静态门

- core/store/BLE/wire/分区/业务规则逐字037；原I8猫与播放语义保留。唯一runtime差异限已授权视觉/UI状态门，版本/host fixture单列。
- 增量Flash/PSRAM各<=512KiB，新增存活internal目标<=4KiB，零新internalDMA；六个scene共存计算，不能按一个实例估算。
- 037实际DMAfree71959，距64KiB仅6423；小malloc<16KiB优先internal。root DRAW callbacks/静态描述复用，避免每scene堆装饰objects。
- 两9320B DMA、私有可选mask池、capture64KiB守卫、时钟来源及不可用信息不变。不得为通过而降guard、改globalallocator或伪TE枚举。

## 计划的生产代码软件case

1. horizontal commit/rebound，同时间采样、原动画换帧中跟手、双向/face0缩放与face1缩放、cancel/反向/无target。
2. vertical home→care/status与返回保留；不将仅横向收益扩写到纵向。
3. samecontext/idle、首次已知/未知、仅weather变化：不遗漏真实状态更新；poll改善不等于swipe改善。
4. 冷启动旧snapshot、中性未连接；本轮connected+subscribed新rev才live；同rev重复不重启短反应。断连/失订阅清RAM显示可信门，重连同rev保持中性。这是038有意区别037的显示门，单列负控，不伪装037原行为。
5. 原生产sleep成功1.5s hold→短3s显示→AOD→wake不重放/不多emit；失败/取消不成功；真实feed/pet仍由原成功来源触发。
6. modal在drag active/settling、AOD首次contact、release/cancel、队列满/保存失败，所有领域调用/NVS/receipts/ACK次数符合原路径。
7. 全部中间帧+同tick full composition oracle检查新残影；不只终帧。旧8px原样单列，不允许扩大容差掩盖新增差异。
8. dirty/flush计数同trace对037；推荐horizontal提交总pixels至少降20%、rebound不增才称本轮性能优化；启动/终帧全刷单列。若未纳入slide改动或不达门，保留原路并不称修好。

## 真实后置门（只能Root/用户）

- 真实pool enabled/fallback日志；六scene常驻+peek/guide/modal与capture压力下真实heap/min/largest；capture实际过64KiB guard。
- 实体手指tap/hold/四向滑/慢拖/回弹、modal打断、AOD第一触唤醒，期间PERF pressedPolls必须有真实样本；CAPTURE/VIEW不混入计时窗口。
- 物理视频/人眼判断第一跟手/持续掉帧/释放落点；光学撕裂另测。静置4.21ms、host memcpy都不是swipe FPS。
- 如无人触屏，演示仅为真实静置校时+明确VIEW选页+LVGL合成+标明host合成手势录像；不称物理滑动/喂食/无撕裂通过。
