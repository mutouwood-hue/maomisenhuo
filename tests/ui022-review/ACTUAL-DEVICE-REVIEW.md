# UI022 实屏增量独立复核

## 结论

**当前采集的原屏、名义360×640及390×844配置，在衣柜显示/滚动、家庭预览和原生品种select联动的有限范围通过；未见新增确认P1/P2。** 未改既有源码独审报告，未操作设备、安装、ADB、串口、购买或联网。

证据来源：根任务唯一设备线程 `artifacts/device-integration/2026-10-16-ui022/`。已亲看19张指定PNG并读相应XML；所有42张result索引PNG的大小/SHA重新核对。APK为0.2.2/code13，SHA `e2c0fc3cfafc7231dbb0bac96e69e54f2c3b3b02052cd7da72aa8a5c9a005d0f`。

## 亲看结果

| 范围 | 实际证据 | 有限结论 |
| --- | --- | --- |
| 六品种预览 | `normal-family-six-full`，另`short-family-previews`、`mid-family-previews`及表单滚动位 | 两列、原猫脸/完整名称；原屏六卡完整帧确含橘白/银虎斑/奶牛/暹罗/布偶/英短蓝 |
| 预览→表单 | `normal-preview-orange`、`normal-preview-silver` | 卡片选中背景/边框改变；XML中adopt-breed值分别为橘白田园猫、银虎斑 |
| 原生select→预览 | `normal-native-breed-options`、`normal-native-breed-selected`、`normal-selected-preview-readback` | 原生菜单保留六选项；选择布偶后，下拉值为布偶猫，布偶卡片选中，其余解除 |
| 家庭表单和末尾 | normal/short/mid family form/footer | 名字/品种/性别纵排，12币领养、30币配对按钮及最多6只规则可滚动读到；本轮未提交 |
| 衣柜入口 | `normal-wardrobe-top`及各末端XML | 小猫衣柜标题/服饰列表保留；各衣柜XML无“选择这个品种”入口 |
| 真正衣柜末端 | `normal-wardrobe-actual-end`、`short-wardrobe-end`、`mid-wardrobe-end` | 星星小王冠、夜空小斗篷及对应完整控件可见；不把normal-wardrobe-bottom或short-wardrobe-footer中途帧算末端 |
| 关闭 | `normal-closed-family`、`short-family-closed`、`mid-family-closed`及动作日志 | 固定×可达并退出抽屉；回到既有小橘出游覆盖画面，没有把关闭误当召回/领奖 |

所见原小橘卡仍为橘白田园猫/少年猫，屏幕币数24。五项状态随真实时间自然变化；未用“所有数值不变”代替正确性。XML的checked/selected字段不用于推断aria-pressed视觉状态，选中背景/边框以PNG为依据。未进行TalkBack或完整辅助功能验收。

## 安装与数据证据的精确计数

`install.json`记录保留数据安装成功、未清档/自动授权，安装APK回读SHA精确一致。本审查对两份tar中列出的文件流逐项算SHA：**022安装前后各13个记录文件，全部一致**。候选设备README写14项，应更正；021那次14项不应沿用到022。该计数差异不构成数据不一致或安装阻断。

`authority-final.json`原始文件SHA与安装前/后记录及post-check相同（`c7f7a4c7c8d53ad4374d972045e9f792ec18f32ed06c3f7f339bc905f94c0ac2`）；未解码或输出私人收据内容。revision59为根任务记录；原始字节相等已独立核对。

动作日志未出现购买、领养、配对、穿脱提交。不能只据静图币数24就宣称完整经济系统已实机验证。

`post-check.json`记录恢复物理1200×2670/density520、系统Home、code13、BLE断开。只读此记录，未重新查询或操作手机。

## 边界与交付

未验系统1.6字号、实际领养/经济/配对/穿脱、额外BLE/clock/FIFO或新模型；这些不由本次图形/表单验收推定通过。未读取/核验Drive共享流程，未进行任何上传。

支持记录 `actual-device-evidence.json`（19帧PNG/XML哈希、42张媒体索引回核、13文件归档比较、select读回）可由 `python3 tests/ui022-review/check_actual_evidence.py` 只读复核。前置候选源码/包/24项Node结论仍见原 `REVIEW.md`。
