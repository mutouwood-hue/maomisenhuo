# 019 独立最小 delta 复核

**未发现已复现的 P1/P2 阻塞，可由唯一设备线程保留数据安装，按自然可达NPC完成最小真实短/长按流程。** 无候选编辑、ADB、设备、个人浏览器页面、存档或网络操作。新增证据及WK helper编译输出只在本目录；没有运行浏览器tab或窗口。

## 冻结身份

- APK616437B，SHA256 `75d2ca1c7bea8dc2741529f2f025ca4fd8802e6c8f381f8391d725dcdfe4881e`。
- ZIP121文件/1148538B，SHA256 `ea07aa34251cf1299b87a739b99b30e8548be4faf7f69e1eaf45352e25cdbd13`。
- SDK35 apksigner实际v2验证通过，原证书 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`。
- 当前121源/ZIP逐文件SHA、29个APK assets逐字节全匹配；018原118源/APK/ZIP核对未变。详见 `frozen-hashes.json`、`apk-signature.txt`。
- 运行web只追加一条键级CSS；其它旧web、全部8game/4Java/原HTML字节018。原018输入控制器、arm/tap、奖励/存档/节流不变；未扩测未变功能。

## CSS 与整合方法判断

新增 `#sc-meet #sc-key`、同对象`:active`和`.down`规则均固定 `translateY(-50%)`，transition仅背景/阴影。两个ID的specificity明确高于全局button活动态，保留原48×56 target而不改变布局声明。

独立读取并执行冻结 `scripts/check_key_css.cjs` + Swift helper，**只重定向输出/编译路径**到本目录。生产原index行内CSS、life-panels/Host/polish CSS、原openMeet/renderMeet模态节点、原rUI/arm和原输入模块均由冻结源载入；本次报告metadata中的CSS/input/index SHA与当前冻结文件一致。

`:active`镜像为属性选择器保留同specificity：伪类与属性各计一个class权重，`:not(:disabled)`参数、ID/type、逗号列表和媒体条件不变。镜像按原sheet顺序插入其后，未替换声明或写假矩形。原生合成PointerEvent不会可靠触发原生`:active`，因此此方法只证明相同级联条件下的真实CSS layout；它不能证明Android触控状态、capture时序或系统文字选择菜单。

## 本轮执行证据

- `production-css-input.json`：实际无窗口、非持久WKWebView **11/11检查通过**。normal/active/down/armed实际矩形均left275、top264.125、48×56 CSSpx，transform y=-28，transition仅background/box-shadow。
- 同一生产CSS+输入+原arm：999ms idle，1000ms静止中心长按armed；短按idle；pointercancel/leave/lostcapture和真实rect越界模型均idle。
- **018负例必现**：只移除019规则和其镜像，实际rect top264.125→293.125（+29px）；同一静止中心pointermove被原输入范围检查取消，1100ms后仍idle。负例没有换控制器、规则或布局模型；禁掉旧transform动画使终点几何确定，不掩盖旧错误。
- `input-boundaries.tap`：原018保留的12/12 actual arm/modal输入与生命周期测试通过。

复现：

```sh
node tests/android019-review/run-css-isolated.cjs > tests/android019-review/css-engine.log
node --test artifacts/html-offline-candidate/ui019/source/tests/meet-key.test.cjs > tests/android019-review/input-boundaries.tap
```

WK采用真实CSS cascade/layout/getBoundingClientRect；pointer、active属性态、时钟、NPC与原画是明确软件模型。未运行原存档/奖励，不能把上述检查冒称Android自然长按通过。没有重复Native/BLE/睡姿整套。

## 最小设备接续

只有既有NPC自然可达时，root保留原档安装精确APK，正常短按idle、约1100ms长按armed且无选择柄；关闭重开idle；不足1秒滑出取消后fresh长按可用。不点先敲/敲屏/奖励，不spawn/改档/时钟；NPC不可达则明确待验，不用合成证据代替。自然banner、Native物理持久、CFLOCAL2、双端completion等原边界不扩张。所有本轮进程已结束，无在途操作。
