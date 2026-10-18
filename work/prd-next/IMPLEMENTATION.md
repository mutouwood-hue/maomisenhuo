# 非连接 PRD 缺口首批实施交接

## 基线与隔离

本批基于手机038（com.catforest.htmlcandidate，code29，0.3.8）与吧唧053（0.5.3）冻结源码；实施只在 work/prd-next/phone/source 与 work/prd-next/badge/source。没有编辑 lock-clean-fix、锁屏断联/重连恢复、BLE驱动、原游戏HTML、证书或安装设备；未操作git。不是已发布新版本，版本号未改。

## 已实施

1. 吧唧不同页面跟手：预构建页面对象实时移动，锁轴/方向/目标，无触摸中创建/重建/截图；松手达到原手势阈值后200ms完成再导航，未达到180ms回弹；presslost、导航、弹窗、待机和看门狗取消恢复位置及press-lock。参考上层main/ui的无输入期重建思路与本仓037预建页面方案。未改HOME横向双表盘120ms释放切换、CARE_ACTION、24小时环独占捕获、TE/缓冲驱动。
2. 手机今日环：透明命中轨道只盖实际内外环；中心/间隙/刻度不抢纵向滚动，切向意图6px后捕获；点按、方向键、回放、未来/过去和返回此刻保留。
3. 真实地点与静默历史：关闭demo无定位时返回真实空列表，不假装home/work真实采样，不残留出门页虚构按钮；未知地点中性画布无地图请求。归档继续保存但不主动弹昨天回顾。
4. 毕业纪念备份：schema2只增加受限游戏关联JPEG照片包，世界/毕业信保留原game/social已有结构；WAL5镜像，native同提交标记与字段/大小/hash校验，验证失败零写入、崩溃恢复、事件去重和legacy兼容。无定位/录音/生活历史/APIKey/对话私密副本。
5. 诊所/相册：腹部病症不再误报喷嚏治愈，保留既有3检查/1500ms/费用/奖励；只读毕业相册无当前毕业会话时仍可关闭。

6. 今日记录摘要：替换“每日总结”为“今日记录摘要 · 截至此刻 · 仅供主动查看”；仅汇总非推测/非虚构且已到当前时刻的生活段，不以无定位断言睡了多久/是否工作，不借主人行程虚构小猫目送、迎接。怪行为只统计已有记录。未改L.points、归档或推断算法；未新增周/远行调度。
7. I10源码已核实：运行时家庭标题既有“成年后的家庭计划 · 配对与育幼”，承接原付费NPC配对与未来幼猫，不是毕业猫再养。未重复改UI或修改Notion状态，用户理解待验收。

## 审查发现并修正

- 纪念包漂移不能触发旧Native游戏覆盖手机新进度。
- 不以exportSave自动生成的当前时间阻止闲置后的自备份恢复；用实际xp/照料、世界与毕业记录保护。
- 损坏本机游戏允许用户显式导入经验证的有效备份，去重/身份保护不绕过。
- Android JSONObject公开API兼容及slash/control/surrogate与JS字符串摘要一致。
- 核心标记一致但本机纪念包旧时保留本机照片删除；冷恢复先照片/包后核心标记，配额失败可重试。

## 已验证与未验证

- 最终八组定向回归75/75，含生产Java桥JVM测试14项和诚实生活摘要4项；既有六组57项仍通过。全部生成JS语法检查此前通过，摘要生成脚本另已检查。
- JVM测试使用显式JAVA_HOME与PRD_JSON_JAR，跨平台classpath及UTF-8私有RPC；生产Java提交/CAS/丢响应/重命名前后故障/恢复/照片摘要与非法字段拒绝全部通过。Android文件/目录sync为JVM stand-ins，不是手机真实fsync或掉电验收。
- 吧唧实际生产drag函数+gesture在LLVM-MinGW严格C11/-Wall/-Wextra/-Werror主机桩测试通过。不是完整LVGL/固件或硬件帧率验证。
- Android SDK35、JDK21、AGP8.7.3 `:app:compileDebugJavaWithJavac` BUILD SUCCESSFUL，使用 `-Pandroid.overridePathCheck=true`支持中文路径。首次离线缓存缺依赖，之后构建解析了固定AGP与Platform35；无新证书、APK签名或安装。
- 生产Java字符串canonical提取后真实javac/java对照JS通过，覆盖斜杠、控制字符、Unicode与代理对。
- 浏览器生成预览完成初始化；生活页面关闭演示后常去地点显示真实空态，截图检查布局可读。未申请位置/麦克风/收费API。真实触屏滚页、全页面移动端视觉及实机顺滑度仍待验收。
- 已补逐文件限时全套40文件检查：19文件pass、19fail、2timeout；运行器退出0只表示收集完成。选取12份非平台工具类失败与冻结038比较，24个候选失败名称均在冻结出现，但care-runtime/gameplay首阻断原因存在变化，不能只按同名断言完全相同。详见 REGRESSION-CLASSIFICATION.md；不修改旧断言、BLE或consumer来迎合全绿。

- 旧备份不能删除同存档新增领养猫及其照料；有效毕业转换保留，照片配额失败时直接断言核心标记未推进。
- 浏览器实读时间环SVG中心touch-action=pan-y，实际两轨none；真实鼠标中心拖动前后13:43不变，轨道切向拖动选中01:15，且注明只查看未改生活进度。不是触屏原生滚动证明。

- 浏览器新摘要实读：标题“今日记录摘要／截至此刻 · 仅供主动查看”；无定位显示“暂无可确认的生活记录…虚线…推测”，工作显示“不据此判断是否工作”，小猫只统计已记录怪行为。初次并行JVM运行时启动遮罩导致点击超时，之后观察遮罩消失再正常点击通过，未强制绕过。

## 下一批仍需确认/素材

- 20件GLB不在本机已调查路径，需原catalog/模型/许可证与hash，未用程序几何代替。
- 小镇毕业后团聚/探访、完整纪念档案与周边世界摆放尚未实现；需明确入口、摆放规则与频次后续实施。
- HOME横向表盘仍保留原方案；day返回HOME预览沿用原投影，不能称所有滑页30fps达标。
- 038/053已有成长、遮挡、家庭等不重复重写；本次没有对真实设备进行安装验收。

## 主要源码/复验入口

- phone/source/scripts/build_assets.py、scripts/prd_experience_patches.py 与 web/clinic-feedback.inc.js
- phone/source/web/life-navigation.js、life-companion.css
- phone/source/web/offline-device-backup.js、offline-event-store.js、offline-durable-store.js
- phone/source/android/app/src/main/java/com/catforest/htmlcandidate/EventDurableBridge.java
- badge/source/main/badge_pages.c、badge_gesture.c、badge_gesture.h
- phone/source/tests/{life-navigation-focused,prd-experience,memorial-backup-focused,native-canonical-focused,event-backup,event-browser-storage}.test.cjs
- badge/source/tests/host_live_drag/run.py

文中路径相对本交接目录。生成资源由build_assets产出，原HTML保持SHA256 `3e1b68b6dcef89ce6003961e0abb41354785443bd0427b83ed70f7589fd8af53`。
