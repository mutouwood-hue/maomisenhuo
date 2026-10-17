# 原始资料清单与哈希

核验日期：2026-10-15。PRD：Notion「拓麻歌子」v2.1，初次完整读取并冻结的 MCP 页面更新时间 **2026-10-15T05:53:13.233Z**；后续已复读更新到 **2026-10-15T10:20:43.405Z** 的雨天/事件叙事要求，详见 [雨天来源复核](phone-rain-source-review.md)，不能把初始快照称为最新不变正文。本地文件由用户放入项目根目录；保留原件，没有改名、覆盖或解压到项目目录。Tabbit 独立任务页已确认 Notion 登录并显示当前 PRD；页面附件 embed 显示加载占位，因此当前不能从浏览器逐字节重新下载并与 Notion 服务器版本做哈希比较。以下哈希标识当前本地原件，不冒充服务器端哈希。

## 本地文件

| 文件 | 大小 | SHA-256 | Notion 来源/说明 |
|---|---:|---|---|
| `小橘电子宠物.html` | 1,566,723 B | `3e1b68b6dcef89ce6003961e0abb41354785443bd0427b83ed70f7589fd8af53` | 最新手机端 block `c9fef3e5-6528-4f90-b796-ec4005315d09`；file segment `cc70f777-86c5-49f1-a4eb-72b7a0710923`；用户确认此为刚更新下载件 |
| `吧唧渲染参考.html` | 1,560,500 B | `352dff431d90289e278af1d09c089d8cf864ed963966c34f6badf0f60f7cdc64` | 页面 embed block `21e04e14-e461-4b9c-89e2-1acd667b23f0`；HTML标题/界面为交互规范 v2 |
| `吧唧渲染参考V2照抄版.html` | 1,560,500 B | `352dff431d90289e278af1d09c089d8cf864ed963966c34f6badf0f60f7cdc64` | 与上一文件字节完全相同；属于本地重复副本，不是新版本 |
| `吧唧交互规范开发包.zip` | 2,685,315 B | `e69d4bb8b116c34101fdf2af332c58cbefde4ae7428b5613c4dbc4997124aa24` | Notion file block `c56e5802-eae9-468d-9a72-208990e3b98c`，页面还有重复引用 `3f5c209a-d67f-80d0-9dbc-c7f51f1ffd1b`；ZIP 含 82 项，主要内部时间戳为 2026-10-10 |
| `预览小猫.html` | 947,328 B | `e4c34f47cca80a1d9a8c23f69cd3f8f53bc76f8ce33b180d457ae1529ac518f2` | Notion embed `3f4c209a-d67f-80f0-a901-e7d2821db143` |

另经字节比较，ZIP 中的 `吧唧交互规范/吧唧渲染参考.html` 与项目根目录两份吧唧 HTML 的 SHA-256 完全相同。ZIP 原件未经修改；审阅解压副本仅放在系统临时目录。

## 页面中可见但当前未在项目找到的附件

| 附件 | Notion block | 页面显示大小 | 项目内检索 |
|---|---|---:|---|
| `pixel-cat.bbmodel` | `3f4c209a-d67f-8047-a54f-fa85588deb2d` | 275.6 KiB | 已从手机 HTML 内嵌 base64 恢复源模型；独立附件未下载/对照 |
| `pixel-cat.glb` | `3f4c209a-d67f-800f-865a-e8fc5c37e3ec` | 128 KiB | 未找到 |
| `吧唧渲染工具包.zip` | `9068f2e6-7fef-4418-8136-fea749711b37` | Tabbit 页面未显示文件大小 | 未找到 |
| `吧唧触控引导与滑动动效.html` | `f42a1a75-bb9d-4e96-8c88-10c9f515ba8f` | Tabbit embed 显示“正在加载…” | 未找到 |
| `使用说明.md` | `3f4c209a-d67f-8073-bc38-e00ec74cfeee` | 页面显示 2.3 KiB | 未找到 |

初次清点时项目没有独立模型文件，开发 ZIP 清单也没有这些模型格式。随后从未改动的手机 HTML `window.__CAT_PROJECT_BASE64__` 恢复 `assets/models/pixel-cat.embedded.bbmodel`：282216 B，SHA-256 `1c5f2352a0249b241acd55c1a8eef92641c66528a6283e58dd73148962ecec60`，56 元件、1 纹理、idle/walk/paw 三动画。该模型已用于原始 Three.js 渲染和吧唧派生精灵；没有重新建模。独立 Notion `.bbmodel` 未逐字节对照，`.glb`/`.pcat` 仍未取得。ZIP 的 `ref.js` 提供 PCAT 解析器，说明预期由 `.bbmodel` 经过 `pcat-export` 生成 PCAT，但本包没有模型或导出器。

## 来源与版本限制

初次与后续读取的 Notion 页面均标示 v2.1，更新时间与差异记录如上。小橘 HTML 本地文件系统修改时间为 `2026-10-15T14:05:50+08:00`；这能说明本地副本时间，但不能证明它与 Notion 当前 file block 的字节一致。用户确认文件是完成更新后下载的版本。将原件提交进代码仓前建议将这张 manifest 与所有资产共同冻结；上游变化后新建版本快照而不覆盖已用版本。


## 补充来源发现与当前访问限制（2026-10-15 21:50 UTC+8）

两份吧唧渲染HTML内嵌 PCAT_B64 可恢复出205,624B原模型容器，SHA256 `82520ca7f00eb28f005795cc970746150d73075083d4032119d795d19c2d0b4e`，包含56 cubes、14 bones、6 breeds和6 outfits。之前“外部pcat未取得”不再等同于“没有可用模型”；独立GLB/外部bbmodel/渲染工具包ZIP仍缺失。原渲染器与PCAT已直接用于离线66帧素材生成，见 `assets/rendering/badge-v2/provenance.json`，无重画猫模型。

当前Notion集成获取PRD返回404 object_not_found；历史manifest记录的已读摘要不能替代完整本地PRD正文快照。当前整轮可完整复读的来源是本地ZIP、HTML及其内嵌SPEC；PRD全文最新复读仍需主会话已有导出或恢复该页面授权。浏览器file://安全拒绝后未换HTTP/其他surface绕过读取，直接读取本地源码作为数据。


## 用户修正：无云的本地产品基线

用户最新明确“不需要所谓的云”，修正后的 HTML 和最新说明取代旧 PRD 的云主控/账号/云同步假设。后续不以未读到 PRD 全文为本地还原前置阻塞。原型源及旧源仍保留，详见 `docs/offline-local-architecture.md` 与 `legacy-review/cloud-dependency-map.json`。本轮仅完成分析，没有执行云剥离、删数据、改主工程、安装、权限或刷写。
