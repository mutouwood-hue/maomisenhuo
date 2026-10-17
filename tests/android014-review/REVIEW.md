# 014 独立 delta 复核

**结论：未发现已复现的 P1/P2 阻塞，可以由唯一设备负责人保留数据安装，进行自然睡眠、360/390短屏分页与回家实屏验收。** 未操作设备、安装、ADB、串口、蓝牙、权限或网络；未修改013/014源与冻结产物。新增证据仅本目录。

## 冻结与变更边界

- APK620719B，SHA256 `d495e1b35db32ec5f27a7144f6f2614a83dece3e70e5d5e066e5f067a833f10e`。
- ZIP101文件，SHA256 `3d5f9a19c2c46c865af792161253fb2ad4315de8788c6383e8ec22440c28c224`。
- SDK35 apksigner实际v2验证通过，证书SHA256 `3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82`；与013一致。见 `apk-signature.txt`。
- 014的101源哈希/ZIP逐文件、25个APK assets均一致；变更文件集合与ui-delta.json完全一致。013原91源仍全匹配。详见 `frozen-hashes.json`。
- 30个保护文件逐字与013相同：全部Java、Native存储/事务、事件/备份/身份、BLE adapter/transport及相应打包副本。durable adapter仍29273cd…88e5c。
- 实际生成game03的完整原store factory（包含care资格/计时/奖励/保存）和 `Ef` 游戏controller整体后缀与013字节相同。差异限定于床/睡眠表现、进出路线、坞显示/分页和提示文案/前后台世代；没有新的存档或BLE操作路径。

## 只读代码检查

- `scripts/build_assets.py:21–43`：新床、侧卧、进出床、逐帧胡须复位与坞observer注入；照料store/完整controller未变。
- `web/offline-room-bed.js`：只操作现有Three模型/几何，无store、经济、timer结算或transport调用。`ou`每帧清inner位置/角度，`reset`还原胡须；原cancel仍以false结束。
- `web/offline-layout.js:53–74`：更多按钮只scrollBy/scrollTo，保留原按钮顺序/handler；末端返回顶部。observer更新类/hidden/文案，不派发玩法点击或radio操作。
- `web/offline-host.css:63–69`：更多48px独立触控区；rail缩出48px，原hidden!important保留。原rail top=安全区+116与新max-height/更多bottom组合留间隙；实际触控/视口仍须真机验收。
- `web/offline-host.js:78–87,181–201`：旧基础控制结果仅当前foreground epoch覆盖提示；没有重发业务。scene-sync仅将最终提示再过中文映射。

## 本轮执行证据

- `ui-delta-independent.tap`：18/18通过，覆盖既有Host、新基础提示世代、实际bf整轮睡眠、24阶段/服饰几何、无累计pose、实际mobile坞同mutation turn恢复、短屏分页，以及新增原store/取消复位测试。
- `sleep-cancel-final.tap`：修正独立测试的Ef查找anchor后重新执行3/3通过（原store+实际Ef整体字节相同；kitten/adult分别9个睡眠phase逐点取消）。取消promise为false；下一帧currentAction=null、busy=false、inner.roll=0、回到原home，所有胡须position无残留。
- `rail-observer.tap`：独立1/1通过。1100px内容/240px视区，5次分页到真正末端；100次DOM变动+world/home过渡不派发玩法或BLE；只有实际点末端吧唧按钮才触发原handler；返回顶部正常。
- 已核交接205/205总证据和ui-delta6/6证据；本轮没有重复全部198项，也未启动构建。

新独立文件：`sleep-cancel.test.cjs`、`rail-observer.test.cjs`。测试调用冻结生产room/DOM源码；Three renderer、纹理载入、视口尺寸和scroll为明确软件fixture，不是WebGL/Android截图或真实触控证明。

## 唯一设备线程后续

保留现存013数据及before/after档后安装精确APK，按原规则自然睡一轮，录进床/侧卧/起身/归家；真机360×640、390×844核更多/最后手记和吧唧/六格坞触控，短屏真实出门回家复核。成年仅软件几何证据，不修改真档造状态。继承的Native真实fsync/kill恢复、CFLOCAL2实物事件与双方持久peer completion仍未验；本次UI delta放行不覆盖这些边界。
