# 成套集成交付

## 用户要求

接收隔壁已完成的吧唧与移动端连接稳定性/清洁成果，与本轮PRD缺口修补一起交付。按用户明确授权，全量替换本仓app和firmware源码，不做备份或哈希核对；不修改/安装手机与吧唧上的数据。

## 合成来源

- 移动端：work/prd-next/phone/source 的非连接功能 + artifacts/lock-clean-fix/phone/source 的12个真实文本差异；邻居build_assets、EventDurableBridge与备份存储模块没有业务冲突，保留PRD修补。不是12个文件拼成简化demo，是原完整038系应用。
- 吧唧：artifacts/lock-clean-fix/badge/source 的清洁/连接/host_context完整源码为底，合入work/prd-next的跟手滑动与返回HOME今日环自绘修补；共享main/badge_pages.c按文本差异合成，不拿旧整文件抹掉清洁入口。
- 共享契约：protocol/integrated-care-context.md。原NDJSON单GATT flight、能力确认、FIFO/receipt语义保留。

## 包含能力

锁屏连接显式启用/停止、真实断连恢复、原设备身份校验、同会话清洁协商、原权威游戏bath结算、吧唧清洁三次轻点、授权后同开机离线排队、同GATT主机时间/已有授权新鲜位置询问；不同页跟手与提交/回弹、返回今日环彩段自绘、今日环中心可纵向滚动、关闭即清拖动与动画、真实地点空态、诚实主动摘要、关联毕业JPEG备份、诊所准确病种反馈、只读毕业相册关闭。

## 当前结果（合成后已复验）

- 覆盖后手机聚焦回归 **79/79 通过**（`python work/integrated/test-phone.py`，exit 0）。
- 吧唧跟手生命周期、今日环预览绘制两项主机测试 PASS；5 个生产 C 文件 Xtensa `-fsyntax-only` 全部 exit 0。
- 吧唧完整构建成功出镜像（0x690b70 / 0x800000，余 18%）；Android `:app:packageRelease` 产出 `app-release-unsigned.apk`。
- 成套产物与逐项结果：见 [DELIVERY-INTEGRATED.md](DELIVERY-INTEGRATED.md)。

不把过往各分支单独通过当作合成通过：以上数字均在**覆盖后的本仓源码**上重新跑过。

## 仍不是设备验收

未刷写/安装/重绑/清设备档；未新建签名证书；未运行收费AI调用。锁屏/OEM省电、实际触摸/帧率/功耗、双吧唧相遇、20GLB原包使用、完整固件BIN分别记录，不能以源码、语法或JVM测试代替实机。

本次APK若未签名，须用原证书签名后安装；未缓存lint明确不声称通过。用户禁的是无意义核对/备份，既有业务收据/存档内容digest不是新增文件校验，不删除正常交易一致性逻辑。
