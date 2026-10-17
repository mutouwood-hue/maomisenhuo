# 给手机呈现线程的本地接口交接

目标线程：01a13fb0-0cdc-7687-a6dd-3dd5299cd0fa。主会话授权协调，root仅写接口/分析，未改UI。

请读取：

- `protocol/local/README.md`：可直接实施的接入顺序和边界。
- `protocol/local/interface.d.ts`：内部端口/状态/结果类型。
- `protocol/local/contract.json`：默认能力、就绪条件、状态转换与持久顺序。
- `docs/offline-local-architecture.md`、`legacy-review/cloud-dependency-map.json`：22项云依赖处理建议。

核心：实际native ready只映射handshaking；HELLO+GET_STATE及两次应用ACK/写完成后才ready_local。此时不代表宠物快照/好友/云绑定成功。只复用旧e7f1/BJ20控制；快照/持久事件/peer端口先缺省不存在。旧固件源码未到，不编造capabilities、签名、确认、好友/奖励，不混接新7b2e/NDJSON。

修正HTML已含social-v7，旧归档original缺这一版；请保留当前修正体验。云从构建入口/生命周期/provider/存档/协议依赖剥离，不能只隐藏登录面板。保留旧数据，不执行旧prelude中的删除key动作。

本轮未执行测试/构建/安装/连接/刷写，端口B/C为设计，不能声明已实现。
