# UI020 独立只读 delta 审查

> 后续实屏更新：normal/short均确认020新增提示重叠P2，详 [ACTUAL-DELTA-FINDING.md](ACTUAL-DELTA-FINDING.md)。以下是安装前只读delta结论，不代表020实屏验收通过。

## 结论

**本轮未发现阻止进入保留数据安装验收的新增P1/P2。可交父线程在已授权的唯一手机窗口安装020并做Android验收。** 这不是安装完成/真机通过结论，也不授权本审查线程操作设备。

本审查只读冻结文件、ZIP/APK与已有证据，并执行本地离线签名/对齐/包信息检查及纯SVG输出比对；未改源、构建、重跑237实现测试或33场景WebKit、连接设备、联网或上传。原019指定输入的滑出/取消后fresh长按/实际关闭重开补验已完成，未重复列为pending。

## 固定交付身份

| 项目 | 核对结果 |
|---|---|
| APK | `catforest-html-local-0.2.0-debug.apk`，623415B，SHA256 `991228214bb395311418a0260785b2678fea6f9344758a4a53eefa81fae15836` |
| Source ZIP | 131文件，1175446B，SHA256 `76fa7e8656750d3e1a8583c1cce30b8d7c83b1390386f0991177e0f68c928ee5` |
| 包/版本 | `com.catforest.htmlcandidate`，versionCode11 / `0.2.0-html-local`，由019的code10递增 |
| 实际APK证书 | 离线apksigner verify成功、v2=true，SHA256 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`，与019声明证书一致 |
| 对齐 | 独立 `zipalign -c -v 4` exit0 |
| 包信息 | 独立aapt2 dump核对包名与版本正确；未启动/安装应用 |

源码ZIP逐项回读131文件均与冻结source-hashes匹配，无路径越界项。APK的31个asset条目集合和每项字节与冻结assets完全一致。019原121源及旧APK/ZIP的SHA、长度也仍匹配，未被020覆盖。

机器证据：[readonly-report.json](readonly-report.json)、[artifact-preservation-readback.json](artifact-preservation-readback.json)、[signature.log](signature.log)、[alignment.log](alignment.log)、[badging.log](badging.log)。复现入口：[verify_readonly.py](verify_readonly.py)。

## Delta与受保护边界

三项运行变化与manifest一致：

- `web/offline-nav-icons.js`：扩展29个动作图案；原六图案固定prefix在18/24/26/32四尺寸共24份SVG输出，本人纯函数回读与019逐字一致，见[preserved-svg-readback.json](preserved-svg-readback.json)。没有DOM/原游戏运行或状态写入。
- `web/offline-page-icons.js`：在原按钮内部添加aria-hidden装饰span/SVG，保留按钮对象和原事件；仅受控selector映射，未调用store/权限/Native/奖励。图标容器pointer-events:none；MutationObserver合并到rAF，未为普通逐帧进度文本新增全页扫描。动态状态/禁用/放养文案仍由原逻辑决定，装饰不提交业务。
- `web/offline-page-polish.css`：改变动作布局、视觉与触摸尺寸；照料pg-bub右留84px，原生select/文字/价格保留。既有全局`[hidden]{display:none!important}`仍阻止新增display:inline-flex把隐藏操作意外显出；没有覆盖019 key相关selector或改其输入模块。

独立逐字核对32个受保护路径一致：8个原game脚本、4个Java类、18个其他既有web文件、原HTML与AndroidManifest。覆盖Host、adapter、durable/event store、Native恢复、睡姿、scene sync和019 key/CSS。完整清单在readonly-report。

`build_assets.py`仅在原deferred列表加入page-icons、增加第四CSS；Native boot调用与7个原deferred game的门禁保持相同。`build.gradle.kts`仅版本code/name变化，`build_android.py`仅交付文件名变化。实际变更/新增文件集合与ui-delta.json完全一致。

## 已有测试与页面证据的边界

| 证据 | 本人核查 | 不外推 |
|---|---|---|
| Node 237/237 | TAP真实summary237 pass、0fail、0skip；关联当前冻结源 | 本人没有重跑，也不是Android验收 |
| 页面33配置/978检查 | JSON逐项pass、当前4份web CSS和decorator hash对应；216次按钮测量height>=48、无已有记录的横向裁切、normal/disabled最小对比5.4847 | 原组件+内存数据的离屏WKWebView；不是Android/完整3D/真实存档/真实好友/权限 |
| 1.6倍文字 | 证据清楚说明为逐text-node放大fixture | 不称Android系统字体设置实测 |
| 019 key组合11项 | 输入模块/inlineIndex hash对应本次包；018负控也保留 | 不把其通用旧pending文字覆盖已完成的019实机补验；020新增页面仍待Android |
| 新图标识别线 | 证据最低3.4674，限定主要识别线/端点 | 不声称每个装饰高光或全App图形均达WCAG |
| 构建/lint | 已有SDK35 assembleDebug exit0；standalone lint真实AGP模型0error/6既有warning | 标准Gradle lint缺离线依赖未完成，未写成通过 |

页面CSS记录的life-panels hash来自`web/`源。打包器会将safe-area env写成Android变量fallback；页面夹具同时读取实际index内联style。此软件证据不证明Android真实非零system inset布局，已保留手机验证边界，未把源CSS hash冒充每份生成asset的相同字节。APK资产字节另由本轮ZIP回读独立核对。

本人目视已有bath、trip、meet-friends三张360×640软件PNG：照料浮层和右rail分开、图标/中文标签可见、行程抽屉与native select保留。未对全部33配置逐张人工目视；全量数字检查归已有软件引擎证据。

## 后续安装验收范围

父线程可在已授权手机窗口执行唯一保留数据升级与实际Android页面检查，当前delta审查不阻塞该步骤。五页/行程/六页签、动态按钮/浮层、Android真实inset与字体、原delegated动作仍需在该APK上验收；本轮没有执行它们。

019指定输入补验的三个证据文件SHA已核对`019-acceptance-correction.json`一致，历史seal/README旧pending文本按该更正和交接说明解释，不改冻结包。自然NPC banner daily6/6仍独立待触发；不绕限流/时钟/存档。成年人、非空Native fsync强杀恢复、CFLOCAL2真实双端完成等既有限制不外推。此审查没有批准或执行固件刷写。
