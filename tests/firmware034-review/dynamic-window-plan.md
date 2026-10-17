# Root 可执行：034 无刷写、无触摸注入的有界动态计时窗口

2026-10-16；固件所有者只读核对。**本文是执行计划，没有新增设备测量。** 034源103项SHA核对一致，未改运行源、命令、权限或待机门槛。root仍是唯一设备操作者。

## 先回答能测什么

1. **手机正常CFLOCAL2连接不能唤醒已绑定、已待机的HOME。** `badge_local2_facade.c:16–28`先memset view，设置connected/subscribed但不设pairing；`badge_pages.c:614–619`只更新连接文字。fresh snapshot在1167附近只更新context/action并announce；announce在526只显toast，不更新last_input。旧pairing触发PLAY分支在1174，但当前facade pairing为false，不能借它测量。
2. HOME最后真实输入后约10秒转COMP、40秒转AOD/OFF（1252–1256）。VIEW gate在1271拒绝AOD/OFF/非HOME/modal/gesture/settling/transition。它不唤醒、不更新last_input。
3. **VIEW成功也只是瞬时换逻辑表盘。** 1272直接 `face=target; update_face(); lv_obj_update_layout()`，不调用drag_apply、drag_update、drag_release或180/200ms ease-out。因此可测“瞬态换表盘引起的实际软件重绘/flush负载”，不能称“横滑跟手/回弹实机测试”。真正滑动路径在input_event/object_pressing→gesture→drag（793–837、929–977），需要实际触摸输入。
4. 现有STATE/PERF没有当前UI mode/page/last_input，也没有逐帧area/flip/TE计时。VIEW拒绝只证明awake-idle-HOME gate未满足，**不能凭拒绝唯一判定AOD**。VIEW成功也不能区分PLAY和COMP；窗口可能跨模式。不能做“同模式严格性能对照”的承诺。

## 会话前提（不为测量改设备状态）

- 明确无capture/未完成事件操作在途，手机原存档/奖励不改；不造care、peer或snapshot变化来“制造负载”。手机连接若恰已自然发生可保留，记录始末STATE的revision/seq/scene/action/pending变更作为干扰，不改业务以强行稳定样本。
- 复用root的独占物理USB端点权限；**不要复用旧 `diagnostic_session.py` 启动入口，它先调用esptool/hard_reset。** 新开口只作现有应用no-reset字节收发，不进入ROM、不改baud猜命令、不扫描其他端点。
- DTR/RTS=false不保证此硬件开口绝不复位（项目已有记录）。开口见boot/reset标记则记录意外复位，本窗口不能当原待机连续测量；停止而不自动复位/循环重试。不为此重新刷写或暗中wake。
- 单条响应上限2秒；整个窗口上限约15秒（含命令/等待，端口关闭另留至20秒硬上限）。错命令、UI_BUSY、超时/断连都原样保留并停止该分支，不能筛掉失败后无限补测。
- LF边界仅在明确无capture时发送：独立LF→等可选ERROR/静默，再发STATE。正常空LF无域动作；不把它当首次invalid命令原因已经查明。

## 最小命令顺序：先探测一次，再分支

所有命令带完整前缀 `CFDIAG `、LF结尾，每次等响应后再发下一条；设备STATE/PERF和host monotonic收发时刻完整保留。

```
CFDIAG STATE        # S0，核ready/storageError及rev/seq/pending
CFDIAG VIEW 0       # 唯一门槛探测；本身是明确标记的诊断UI选择
```

### A. VIEW拒绝：只测当前状态引擎，不冒充滑动

不再尝试其他VIEW，不做CAPTURE，不通过重连/新snapshot/改设置/触控注入绕过。执行只读计时即可：

```
CFDIAG PERF        # P0
[host等待5秒，不发任何命令]
CFDIAG PERF        # P1
[host等待5秒，不发任何命令]
CFDIAG PERF        # P2
CFDIAG STATE       # S1
[关闭本地会话]
```

这给两个有界5秒窗口的**实际软件引擎活跃/重绘统计**，模式不明、无真实手指。若某窗口rendered增量为0，就报“窗口内无有重绘的render周期”，不是故障/无撕裂/FPS通过。源代码所示待机机制仍成立，不能把手机connected当已唤醒证据。

### B. VIEW成功：只测即时表盘重绘负载，总等待约5.4秒

先等约0.4秒让原250ms业务UI tick完成；这不是画面呈现确认。随后：

```
CFDIAG PERF RESET  # 返回的是重置前旧值，单独保存，不拿它作新P0
CFDIAG PERF        # P0；此时sinceUs为新epoch
[host等待2秒，安静基线]
CFDIAG PERF        # P1
CFDIAG VIEW 1      # 需实际成功；否则本分支中止
[host等待1秒]
CFDIAG PERF        # P2
CFDIAG VIEW 2      # 需实际成功
[host等待1秒]
CFDIAG PERF        # P3
CFDIAG VIEW 0      # 需实际成功
[host等待1秒]
CFDIAG PERF        # P4
CFDIAG STATE       # S1
[关闭会话]
```

此为baseline2秒、三个1秒即时换face窗口，不是滑动动画；不作CAPTURE干扰。每次VIEW未成功即停止选择动作并保存截止PERF/STATE。最后VIEW0是本计划明确的瞬态终态；若root另有已知原face须恢复，恢复应在测量结束后、门槛允许时另列，不能当本窗口样本。

任意PHONE scene/revision/ACK、外来真实touch（pressedPolls增量>0）、启动标记或VIEW gate中途失败，均保留，并将该窗口标“受干扰/模式门槛变化”，不把它拿来严格比较buffer或单一渲染瓶颈。即便全部成功，PLAY/COMP不可观测，仍只能报该实际窗口负载，不能推因果提升。

## 计数差分：必须使用板上时间与同一个epoch

对每对相邻PERF `A→B`：

- 要求B.nowUs>A.nowUs、A.sinceUs=B.sinceUs且所有累计count/total不倒退；否则是重置/重启/混epoch，差分无效。
- `dt=(B.nowUs-A.nowUs)/1e6`。host sleep只是安排，**dt用设备真实monotonic差**。
- `Δrendered`、`ΔflushCount`、`ΔpixelsSubmitted`、`ΔinputPolls/pressedPolls`原样列。
- 每项metric `[count,totalUs,maxUs]`的窗口均值＝`ΔtotalUs/Δcount`；Δcount=0写无样本。render包括软件绘制及其中的提交/等待，不能再加flushWait当一帧耗时；`1/render均值`也不是物理FPS。
- `2*ΔpixelsSubmitted/dt`只能标“逻辑RGB565提交像素负载 bytes/s”，dirty rect可能重叠/过绘，不是完整画面数量、物理面板吞吐或光学scanout。
- `Δrendered/dt`如需要只能叫“软件有重绘render周期率”，不能简称FPS。VIEW ACK只代表UI选择函数返回，不代表该画面已经显示；现有数据不能给selection-to-photon延迟或逐帧jank/P95。
- maxUs是**本epoch累计最大值**，不能用B.max−A.max算窗口最大。若不另开reset epoch，不声称每段max；提供结束时累计max并注明起点。无逐次样本，不能造P95/P99或断言每帧稳定。
- DMA free/largest为采样时点；dmaMinimum是**自启动至今**低水位，不是PERF RESET窗口最低值，不能相减或声称它只属于本段。buf1/2 bytes/DMAcapability照实列。
- inputInterval/read是应用回调间隔/耗时，不是触摸芯片采样率、物理输入延迟或丢触摸证明。appUiTick也不是整个adapter handler。

## 无物理手指/相机时不能关闭的项

- drag跟手中间位移、松手ease-out/回弹的真实时间/连续性；仅VIEW没有该路径。
- 触摸采样/滤波、输入滞后与render队列的关系。
- CO5300面板实际扫出、水平tearline、滚动快门与光学双影的区分；当前TEAR_AVOID_NONE且无TE/GRAM/光学采样，render-ready还可早于最后DMA完成。
- 单一时刻LVGL CAPTURE再多也不覆盖上述动态；截图自身暂停45–70ms，不能一边抓屏一边报自然帧率。

**剩余最小条件是实际物理滑动输入及光学/面板同步证据，而不是新账号权限。** 用户已离家、没有可授权控制的真实触摸执行器/相机，本轮不能伪造触摸。root可以执行上述无刷写计时窗口；若VIEW不满足门槛，就只交当前引擎统计与明确blocked，不重做固件或绕gate。

## 今晚可诚实交付的最小指标

1. 新窗口原始STATE/PERF日志、host/设备时间、VIEW成功/拒绝和same-epoch差分表；明确“现状引擎”或“诊断瞬时表盘重绘”。
2. 既有034真实两个9320B DMAcapable、完整3帧CRC与软件布局有限通过单列。
3. 历史034窗口只作背景：自PERF reset约560.58秒、2364 render周期、累计165057535us/最大147577us，平均约69.82ms；pressedPolls=0，混合awake/standby/VIEW/CAPTURE，不作为本次新测或滑动FPS。精确出处及hash在 `dynamic-window-planning-basis.json`。
4. 光学撕裂/真实滑动表现仍open；用户此前肉眼逐帧感和JPEG水平错位保留为未关闭问题，不用静态合成替代。

## Root执行后更新（2026-10-16）

root实际尝试一次no-reset opener，0.082秒读到ROM/reset/boot标记，未发CFDIAG，立即关闭并保留原日志；该连续standby测量窗口无效，原因不能唯一归于open或close。不要按本计划继续自动重开/重启。当前clock/FIFO需下一真实025连接重新读回。

已改用旧034持续开放会话的command10→13同sinceUs区间做真实动态引擎有限观察：389.861443秒/1559render/平均68.203ms，窗口内无记录CAPTURE/VIEW/RESET，实际pressedPolls差0；独立复核见 `dynamic-engine-delta-owner-review.md/.json`。此为动态计数证据，不能代替真实滑动或光学撕裂验收；不为本次submission新增固件优化或刷写。
