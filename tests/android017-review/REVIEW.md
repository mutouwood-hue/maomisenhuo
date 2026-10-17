# 017 独立 delta 审查

**未发现已复现的 P1/P2 阻塞，可由唯一设备线程保留数据安装，验证两图标和NPC CTA实屏变化。** 未改016/017候选，未操作设备、ADB、串口、浏览器、蓝牙、权限或网络；新增证据仅本目录。

## 冻结核对

- APK614925B，SHA256 `395005eebd73abe1e997862a069d7026fd3983dc6f900549b71b25ba47c7dfba`。
- ZIP115文件/1137885B，SHA256 `80562b067c4dc231d9108b99e0782b606b829e765b9ef4d8ca66eed0b23f579c`。
- SDK35 apksigner实际v2签名通过，原证书 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`。见 `apk-signature.txt`。
- 115源、ZIP逐文件哈希、28个APK assets逐字节全匹配。016原115源/APK/ZIP核对未变。详见 `frozen-hashes.json`。
- 运行web仅 `offline-nav-icons.js`、`offline-ui-polish.css` 改变；其余16web、4生产Java、8game和原HTML逐字016。存档/规则/Native/身份/事务/adapter/睡姿/导航保持原字节，不重复其整套测试。

## 差异判断

`offline-nav-icons.js` 仅增加生活主钟盘半径/内盘、生活与衣柜组轮廓宽、衣柜1.07光学倍率。SVG输出仍width/height26、viewBox48；安装方法、原按钮/标签/disabled/目标/handler未改。其余遇见/图鉴/出门/家庭4个SVG在同prefix下跨016/017输出逐字相同。

`offline-ui-polish.css` 只追加原banner的 `[data-bmeet]` 两条正常/disabled样式：明确不透明背景/文字色、background-image:none、opacity1。选择器限于原notifications/banner的原去遇见按钮，不新建按钮，不改关闭/进入逻辑或disabled属性。旧48px min-height和滚动结构未变。

实际原index行内CSS + Host CSS + 017 polish CSS 的软件计算级联已独立检查：正常/禁用对比均>=4.5；颜色对应约5.58:1/5.48:1。按钮和全部静态祖先opacity均为1/默认1，文字及背景alpha不低于1；不能只用声明色对比掩盖整体淡化。正常 `.click()` 保留原handler，disabled阻止激活。

## 本轮必要测试：10/10通过

```sh
node --test tests/android017-review/optical-cta.test.cjs artifacts/html-offline-candidate/ui017/source/tests/ui-polish.test.cjs > tests/android017-review/delta-tests.tap
```

- 候选8项：原按钮/标签/装饰ARIA、原NPC文案/节点/实时提示、幂等装饰、尺寸来源、其余4图标SHA、CTA计算对比、observer收敛。
- 独立2项：跨版本4SVG直接字节对照、两图标明确变化而槽位/按钮/属性保留；完整原CSS+Host+polish级联、祖先opacity与正常/disabled真实按钮激活。

JSDOM仅为软件计算/DOM证据，不是Android实际像素取色、视觉大小或触控证明；没有重跑未变Native/BLE/睡姿。交接214总回归仍是候选方证据，本轮只执行必要10项。

## 实屏接续

root唯一核原档后保留数据安装，原屏/360×640观察生活/衣柜图标、文字与按钮位置；按原NPC入口验证真实长文/关闭/键可达。原banner仅自然触发才能验CTA，6/6或未出现则单列待验，不用弹窗/雨天代替，不改档/时钟/节流造结果。继承的Native实际落盘、CFLOCAL2、双端peer完成边界不扩张。全部测试进程已结束，无在途操作。
