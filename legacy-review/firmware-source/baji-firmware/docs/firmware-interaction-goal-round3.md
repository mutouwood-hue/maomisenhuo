# 新Goal Round3：只读实机snapshot基准

新增临时badge_ui_profile_snapshot，开机空闲PAIR一次测RGB565全场景snapshot，不改变FSM/绑定/存档；结果保留motion_prepare_us供周期日志读取。下一版需移除默认开机基准，不能把诊断期间额外62ms阻塞留作产品特性。

## 验证与失败边界

pwsh-3111和3116真实编译0，镜像0x2cc3b0；pwsh-3113写入0。3114采样晚于启动窗口，未取得bench；3115 HardReset捕获未确认复位（日志仍旧uptime），不算有效基准。

pwsh-3117将烧录与采样串行同一命令，写应用2933680字节Hash verified退出0，随后[启动日志](<../build/snapshot-bench-final-round3.log>)明确：

- uptime7130：snapshot_bench us=62514 ok=1 screen21。
- uptime7886/12892：周期snap_us62514。
- BLE正常启动，未见assert/watchdog；NVS加载5条事件（先前本地交互事件），未修改绑定。

结论仅针对本版PAIR全场景RGB565单次snapshot：62.514ms。不能用它代表GUIDE/主表盘/两个snapshot的总耗时，也不能代表LCD展示帧率。

前版整个motion准备3.06–3.48秒仍不是snapshot纯耗时证据。目标重建、元素绘制、还原/布局或不同场景合成可能占主导。Round2批量清空与Round1禁止嵌套snapshot已改变生产路径，当前完整motion总耗时需重新测。

## 后续

- 移除默认开机基准，保留可配置诊断/测量。
- 真正分段build/refresh/cat/capture，不要将build_other都称渲染。
- 将目标页准备移出拖动开始；缓存完成后仅偏移图片、轻量组合，未ready立即跟手源页，禁止等同步准备。
- 新教学返回目标预览仍映射常规表盘，需修复。
- 真实直接ARGB批量清空分支专门回归，当前host仍只验证原host sink。
- Goal仍active，教学截图和连续触摸体验未验收。
