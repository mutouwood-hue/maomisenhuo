# 043 维护预备流程独审

**允许 Root 先执行 security → backup → verify-current；不放行 app-write。** 本审查无设备动作，未读取043在途实现。

新`run_stage.py` SHA `cb4f0303e0b87a127101770b7655ba4713388bef008e7cd0082bf8acaeb3afb9`。相对已审042 stage163f只将前驱基线切到已实际核验的042：前驱目录、composed-before、expected-ota1、fresh-prefix与042APP版本/SHA/变量名和对应注释。逆置上述明确替换后全文件逐字回到042，不存在额外stage/argv/门禁差异。完整diff见`stage-baseline-delta.diff`。

`diagnostic_session.py` SHA `7a32f845ea04d97bff56390702bac8a5bb73cdc7518666e865485f9849c9a5a2`、禁重试wrapper SHA `14e37af0c6f38c2f4792e0e80d068517b5826263d7bdb6d2a0fa80880fe9b4e4` 均与042逐字相同，继承其已审只读/严格终态/内存门与停止自动重放行为。

前驱042组合全镜像、expected slot、fresh prefix、APP sector readback和写后保护verify均对042最终70项索引核hash。脚本在新backup中实读fresh128KiB并带入最新NVS；boot/table/selector/phy等受保护范围必须与前驱一致，保持实际OTA1布局/selector验证。仅当随后对整个32MiB完成当前物理digest验证，才可称当前组合备份被验证，不能把前驱历史bytes或fresh128KiB冒充fresh全32MiB读回。

security阶段使用usb_reset进入ROM，会重置运行App/RAM；这里的‘只读预备’指没有flash写入，不是没有设备状态影响。其余新鲜USB序号、MAC/安全态、禁止不确定stage自动重复门均保持。候选未就绪时可停在ROM/stub，Root唯一操作者。

**后续写入门仍关闭。** 必须等待043正式封存、独立软件审查明确决定、APP/ELF/ZIP/source摘要与CANDIDATE精确绑定，gate核独立decision SHA和实际执行源SHA。任何设备/布局/selector/保护范围/结果不确定先停；不能由本预备许可替代产品release。

证据`preparation-checks.json`由纯AST/文件读取校验产生，没有导入/执行hardware脚本。初次辅助逆替换夹具对`P/`以外同名输出也作替换，以及未纳入注释措辞差异，断言曾失败；已将逆替换限制到实际前驱引用并核完整diff，属于测试归一化假设修正，不是候选额外行为。
