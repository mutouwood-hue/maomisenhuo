# Early transport r3 delta复验

所审 `encounter-transport.js` SHA `259d9f5dda96d3e93028422e7a51326f8542b8ea4665603ef195c0d2ab053bd2`。

原E39-T01/T02在此版本关闭：HELLO/STATE严格UUID或null且seq关系校验，deviceId只小写；公开selection只cflocal3，legacy/v2拒绝且零Native RPC。选择返回`requiredWireFamily`明确需求，而非假装已验证的wireFamily。原始失败源hash/39-suite记录和4条负控结果保留，不改旧报告历史结论。

独立复验原4边界：HELLO非UUID和大写deviceId仅发hello即拒绝；STATE非UUID在hello/state后拒绝，未ready；显式legacy BAD_REQUEST且额外RPC0。现有46组fixture全量独立重跑通过，见transport-r3-owner-rerun.log。边界输入复用owner Native fixture，不是独立Java或039 wire/core实测。

命令：`node tests/encounter039-review/transport-r3-boundaries.cjs`。夹具初次错误地要求非法STATE连state也不得请求，修正为合法HELLO后确实需要读STATE才能拒绝；产品未因此变化。

结论仅为**早期传输层两项P2已修复、家族分离设计与fixture范围可接受**。尚无event codec/adapter持久消费、Native provision、真实C wire旧026联测或迁移放行，不作完整候选/设备release。设计约束继续见DESIGN-CONTRACT-REVIEW.md与DESIGN-INVARIANTS.json。
