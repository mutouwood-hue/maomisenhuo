# 今日环、地点真实性与静默归档：隔离源码修正

## 范围与交接

仅修改本副本的 `web/life-navigation.js`、`web/life-companion.css`、`scripts/build_assets.py`；新增本 focused test 与本说明。`original/game.html` 保持只读。没有执行 `build_assets.py`，没有写生成资产、其他副本、BLE、设备、收费、安装或 git；备份与资产集成由主代理负责。

按主代理指示，构建入口已接线 `from prd_experience_patches import instrument_experience` 与 `js = instrument_experience(js, once, ROOT)`。该模块由主代理提供，本交付未修改其内容。

## 实际改动

1. **环形命中与手势意图**：构建通过唯一 `once` 锚点在完整今日环末尾加入透明外轨（`r=c-22`、宽16）与内轨（`r=c-44`、宽7）。迷你历史环不加入；命中范围严格对应绘制轨道，不包括中心、轨道之间、时刻文字及外围刻度。
   - `pointerdown` 只记录轨道候选，**不 capture、不 preventDefault、不改变选区**。
   - 起手中心即不登记候选，随后页面纵向滑动即使跨过轨道也不选择。
   - 运动超过6 CSS px，切向分量至少6 px且大于径向分量1.2倍时才确认为旋转，捕获并更新；径向意图则放弃选择。阈值为交互逻辑常量，非样式设计 token。
   - 轨道短点按在松手时选择；支持两条轨道、侧边纵向切向拖动、viewBox 缩放和留白、取消/失捕获清理。方向键每次15分钟、回放、回到此刻、未来与过去共用原 host 时间渲染路径。
   - **分区优先级**：真实轨道优先旋转，包括侧边纵向切向；中心、轨道间隙、刻度及外侧优先纵向页面滚动。不能把轨道侧边纵拖同时解释为滚页；用户要滚页从中心或轨道外起手。
2. **地点真实性**：`L.places()` 仅 `cfg.demo` 返回虚构地点，非demo始终调用 `realPlaces()`，包括空geo。地点页/出门页均按虚构或实际本机聚类结果显示来源，空结果有明确空态；有样本但尚无非家庭聚类与完全无记录分别说明。不新增地点，不改真实地段记录、推测规则或同步状态公式。
   - 同一次生活页render通知出门页刷新，demo关闭后不残留旧虚构地点按钮。
   - `drawStage` 与明信片不再借用work地点；`L.map(undefined)` 返回标注“暂无可确认的地点”的中性canvas，提前结束，不生成程序地图、不请求瓦片，不把未知地点编成生活。
3. **静默归档**：唯一锚点移除归档昨天后的延迟toast；保留归档定时、历史保存、bump、原统计事件及手动历史查看。

## 规范适用性（已读skill与完整正文）

目标为原生 JavaScript/CSS + HTML源码插桩，不是React/Vue。依 `frontend-code-style-spec` 的适用栈判定，**§2框架附录不适用**；§1.1函数/事件命名部分适用，§1.2组件props不适用，§1.3/1.4按本地函数/手动渲染映射，§1.5事件及捕获清理适用，§1.6按可读渲染分支适用（不存在框架key），§1.7样式作用域强适用，§1.8保留slider方向键与空态status，§1.9本副本为单语中文、按规范N/A，不擅自引入i18n架构，§1.10显式真实地点空态，§1.11中文注释说明意图，§1.12核对限制见下。

### 样式唯一入口与真源

打包入口为 `scripts/build_assets.py`：保留 `original/game.html` 的内联样式，并按extras顺序加载：

1. original-town.css
2. town-integration.css
3. town-courtyard-components.css
4. town-courtyard-layout.css
5. town-courtyard-sheet.css
6. town-guide-layout.css
7. life-panels.css
8. offline-host.css
9. offline-ui-polish.css
10. offline-page-polish.css
11. offline-family-ui.css
12. life-companion.css

调色板变量真源是 `original/game.html` 内联 `:root`；今日环尺寸/字体原样式也在该源码内联life样式。`life-panels.css` 已登记相同真源及存量token缺档。此次不新造、不合并token；CSS仅修改今日hero环的手势/光标声明，未改颜色、字号、布局或间距。原始SVG几何常量用于透明命中层，不用于扩大覆盖页面。

**未做视觉回归。** 依任务不跑构建，因此生成页面尚未包含这次透明命中层，打开旧preview不能证明改动已渲染。已做样式清单/选择器静态对账；最终集成后的真实浏览器检查必须由主代理完成。没有声称纯Node模拟验证了浏览器的native scrolling或touch-action实现。

人工/集成核对清单：
- 对相同最终资产核对字体、按钮、环布局无变化；透明层不盖住图形。
- 中心纵向滚页起手不改变选择，不停止回放；中心跨入轨道也不改变。
- 顶部/底部切向横拖与两侧切向纵拖均能旋转；径向位移不选择；两轨之间能滚页。
- 真轨道点按、方向键、未来气泡、空白过去、回放与回到此刻均正常。
- demo关闭且无geo时两处地点视图无虚构按钮；有真实样本但无非家聚类时空态准确；真实历史地段仍显示但未知位置是中性canvas。
- 归档昨天后不弹回顾提示，手动历史仍可打开。

## focused测试结果

执行：`node --test tests/life-navigation-focused.test.cjs`（现有 `C:\Program Files\nodejs\node.exe`，零依赖/零安装）。**15/15通过，退出码0。**

覆盖：13个新增once精确锚点及第6脚本JS语法；中心滚动穿轨不选择；空心/轨间/刻度/外侧拒绝；切向阈值后捕获；内环及侧边纵向旋转；径向放弃；点按/非主指针/右键/取消；viewBox缩放与留白；keyboard、未来/过去host委托、replay/restore；失捕获与隐藏清理；CSS分区；demo/真实空/真实非空选择；两处真实空态与来源；未知位置中性画布无地图生成；归档保存与bump但无toast timer、手动历史入口保留。

测试只读提取构建脚本的字面量once补丁并在内存应用原HTML，不导入/运行Python构建，不依赖旧generated资产。第一次运行14/15，失败为vm跨realm对象prototype比较，改为JSON规范化断言后复跑15/15。真实触摸、渲染、完整插桩与资产生成不在本次纯Node结论内。
