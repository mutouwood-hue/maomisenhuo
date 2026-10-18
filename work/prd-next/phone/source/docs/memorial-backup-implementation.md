# 毕业纪念备份实施与边界

## 授权/栈

用户已明确实施授权；仅修改 web/offline-device-backup.js、web/offline-event-store.js、web/offline-durable-store.js、android/app/src/main/java/com/catforest/htmlcandidate/EventDurableBridge.java，新增本 focused 测试及文档。原 original/game.html 只读。原生 JS IIFE + Android Java：architecture 通用模块/事务规则、backend Java 防御性规则适用；frontend §1 按原生栈映射，React/Vue §2 不适用。本次没有 UI/样式改动，没有视觉或设备回归。

## 调查所得（不臆造完整资产）

- 原游戏毕业记录在 game.graduates，含 id/name/breed/sex/generation/joinedAt/graduatedAt/outfit/trait/letter/heir 等；游戏 journal、inventory、world 已在原 game JSON 内。
- `pet-grad-photo:<graduate.id>` 是原毕业流程生成的 320×240 JPEG data URL，独立 localStorage，先前没有备份。
- 社交 `pg-social-v1` 中既有 world.log/world.edit（世界装饰生成与编辑）已随现存 social 全量备份；没有扩展其数据源。
- `pg-life-cfg/geo/moments/names/claim`、`pg-life-act/hist` 属生活数据，geo 含 lat/lon，names 与 hist 含用户地点或推导地点，moments/geo/hist 有 keepDays 保留期；一律不增加备份、不复制到 native，不改变保留期限。
- `pg_bk_key` 是 API Key；`pg_bk_v1` 是 AI 小窝原型存储，无足够稳定资产契约。本次不备份。语音/原始定位/对话记忆/任意未知键同样不备份。

## 实现

完整备份 metadata schema 从 1 演进到 2，新增 `memorial:{schema:1,photos:[...]}`；外层 SHA-256 canonical(game + metadata) 同时绑定游戏/社交/去重/照片。

唯一额外 managed/native key 是 `cat-cflocal2-memorial-v1`；WAL 的最大镜像数由硬编码 4 改为 MANAGED.length（5）。从 game.graduates 推导允许 photo key，禁止扫描 localStorage。每项仅允许 key/type/graduateDigest/sha256/data；type 仅 JPEG，data 必须是 JPEG base64 data URL，单项最多160000字符，最多64张，整个包最多1200000字符。graduateDigest 是完整毕业记录 canonical SHA-256，绑定 id、外观、信件与继承关联。Native 重复执行字段/type/大小/hash/毕业记录/同token seal校验；native authority 原有总4MB明文/8MB编码上限不扩大。

restore 先在无副作用 original store 上试导入，再验证完整关联、去重冲突、身份/unknown pending、纪念冲突、所有WAL镜像与WAL预算，才 native 原子 seal，随后WAL投影；移除了导入验证前 source.flush，非法文件零写入。本机已有毕业记录必须在 incoming 中完全一致；同键不同照片不覆盖，本机新增照片合并保留。同存档已发生的 xp/照料计数回退（不把 exportSave 的当前时间当修订号）、世界 completed/collected 回退、社交 world.log 丢项或 world.edit 冲突均保守拒绝。schema1/game-only legacy 可读，但不得抹去本机新纪念。

普通设备 event seal 自动采集当前允许毕业照片，不要求消费者构造额外镜像，不修改其 ACK/去重/unknown pending 协议。启动 native recovery 在写任何投影前验证包关联与照片冲突；未完成 seal/WAL恢复时幂等补回缺失照片。先完成照片，再写bundle，避免照片投影中断却错误宣称完成。已匹配提交镜像时不自动恢复照片，保留普通本机进度及显式照片删除；生活清隐私操作不会留下本实现新增的生活副本。下一次设备seal从现有照片重新生成包，删除不复活。

## 测试与限制

当前最终集成的六组定向测试共57项全部通过（另含生活15项、诊所/相册4项及跨Java/JS字符串摘要1项）。核心 GAME/SOCIAL/ledger 投影判据与纪念包漂移完全分离；event成功核心标记一致而纪念包旧/缺时从现有本机照片重建本机包，不复活删除也不回滚手机新进度。冷恢复先写照片和包，再写核心标记；照片配额失败会保留未推进核心标记，下次启动重试。新增空闲后自备份恢复、损坏本机游戏显式恢复、真实照料回退拒绝、event后删除不复活测试。使用真实原游戏 engine、内存 Native fixture及已有jsdom浏览器存储测试；不宣称Android设备/fsync验证。

有意限制：没有新增完整世界资源格式/模型贴图备份，没有生活时刻归档，没有任意图片/PNG/SVG支持，没有 orphan photo key扫描。单张/数量/总大小超过上限失败保留原文，不静默丢图。SHA仅一致性防混合/篡改校验不是签名，不提供敌对备份来源真实性。系统I/O错误可能在native durable commit后返回未知/恢复中，而非回滚已提交权威结果；这不是验证失败，需重新启动完成事务。普通本机照片删除在native更新前不能保证authority物理擦除；没有修改原生清隐私接口或扩大生活保存。主代理使用既有JDK21与Android SDK35完成AGP8.7.3的 :app:compileDebugJavaWithJavac，BUILD SUCCESSFUL。Android字符串canonical改为与JSON.stringify一致的slash/control/surrogate处理，生产方法提取后真实javac/java与JS对比通过。没有签名、安装或设备/fsync验收。
