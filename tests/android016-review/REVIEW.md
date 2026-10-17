# 016 独立 delta 复核

**未发现已复现的 P1/P2 阻塞，可由唯一设备线程保留数据安装，进行六图标与真实NPC文字/滚动实屏验收。** 未操作设备、浏览器、ADB、串口、BLE、权限或网络；未修改013/014/015/016源或候选。独立证据仅本目录。

## 冻结身份与不变范围

- APK615825B，SHA256 `444d7d57a5ae62e2b3f61fe927534c83ce0e38012f4ff074e608fc208b25d25f`。
- 源码ZIP115文件/1136364B，SHA256 `f5170d1600ac41d4254ecbe6cdbac096e614fb0f40fc44035322371cd976f8d7`。
- SDK35 apksigner实际v2验证通过，原证书 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`。见 `apk-signature.txt`。
- 115源及ZIP逐文件、28个APK assets逐字节一致。015原101源/APK/ZIP重新核对未变。见 `frozen-hashes.json`。
- 8个game、15个原有web、4个生产Java、原HTML均与015字节相同；Native/规则/身份/事务/备份/adapter/睡姿/既有分页和导航逻辑未改。新运行逻辑仅2个装饰脚本与1个CSS，build_assets只增加加载，未改变旧脚本的内容和相对顺序。

## 代码复核

- `offline-nav-icons.js`：六图标只替换原按钮的aria-hidden span内容，保留原文字节点、按钮对象、属性、顺序、handler。SVG装饰性且无focus/外链/嵌套交互对象；ID按实例分配避免重复。没有创建新导航业务或radio调用。
- `offline-ui-polish.css`：统一26px图形槽，原48px以上按钮min-height不缩小；disabled仍真实disabled，仅取消整按钮opacity以保留文字可读性，图形单独去色/淡化。右侧原键只增触控宽，不改1秒输入计时。
- `offline-encounter-ui.js:4–8,23–25`：仅NPC的三个exact固定介绍字符串简写，保留4–8下/1.2秒/5秒/15秒/1秒等数值；实际rUI写入的sc-rtxt不在装饰器覆盖选择器中。非NPC介绍和好友富文本不匹配替换表。
- `offline-encounter-ui.js:29–36`：结果用搬移原TextNode包flex，不重新解析HTML，不替换原按钮/像素猫节点；重复装饰幂等，空提示hidden按状态变化设置，observer收敛。
- NPC banner原正文区独立overflow滚动，原动作行在第二grid row；确认弹窗保留015标题关闭行与内容滚动。此为源代码布局检查，不能替代360/390实屏长文字几何验证。

## 本轮测试：13/13通过

- `ui-delta.tap` 11/11：现有6项图标/NPC UI测试、4项Native冷启动门禁、原分页1项。新脚本总数18且仍在权威恢复完成后加载，未放松Native门禁。
- `interaction-preservation.tap` 独立2/2：六图标反复装饰时所有按钮对象/labels/disabled保持；禁用按钮 `.click()` 不派发原handler，启用按钮仍正常；实际social-v7 rUI九种phase的sc-rtxt节点/内容均不变；原结果TextNode本身被保留，peer数据无写入。

```sh
node --test artifacts/html-offline-candidate/ui016/source/tests/ui-polish.test.cjs artifacts/html-offline-candidate/ui016/source/tests/native-bootstrap.test.cjs artifacts/html-offline-candidate/ui016/source/tests/rail-overflow.test.cjs > tests/android016-review/ui-delta.tap
node --test tests/android016-review/interaction-preservation.test.cjs > tests/android016-review/interaction-preservation.tap
```

没有重复未变的Native/BLE/睡姿整套。Node/JSDOM是软件fixture，原NPC UI函数与表实际被读取；不运行奖励事务、不修改手机档、不冒称真实触控或CSS像素布局通过。

## 唯一设备线程后续

先核015原档及稳定APK后保留数据更新。正常屏/360×640观察图标/文字并走原“遇见→附近NPC→确认弹窗”，核长玩法文案、关闭/原按钮/右侧键可达；无需领礼或完成交友。NPC banner只有自然实际触发才能单列验收；若仍6/6应记录未触发，不用确认弹窗/雨天替代。既有导航、睡姿、Native真实落盘、CFLOCAL2/双端peer完成各自保留原证据和未验边界。本轮所有进程已结束，无在途操作。
