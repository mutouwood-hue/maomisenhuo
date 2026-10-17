# L3-01..03 修复后只读核对（未独立执行）

证据等级：SOURCE + 已有 OWNER_HOST_OUTPUT。未编译、未重跑316项、未启动preview/GUI/浏览器或设备操作。等待root冻结SHA及独立执行窗口。

本次读取的 `badge_pages.c` SHA 为 `59080848ffd4e384a31024e1a4d8a1122f276a4e7d0ae8fefe5ef4e68a86e375`；[modal-read-start.json](modal-read-start.json) 和 [modal-read-end.json](modal-read-end.json) 记录读取窗口哈希和变化。若owner在窗口内又修改，不能把读后源当成旧图/旧316项已测版本。

## 修复路径与用例核对

| 发现 | 源码修复观察 | 已有owner执行证据 | 本人状态 |
|---|---|---|---|
| L3-01 P1 sleep/play穿透 | `gift_modal()`统一判断；input RELEASED 808行在sleep/drag前结束路由，仅TAP可送gift-close；PRESSING 825行直接return；sleep改用真实`target_hit(HIT_CARE_ACTION)` | `input-v3-5/input_test.log`显示新增107、总316 assertions；preview.c349–356覆盖新按睡觉1.65s、旧按700ms中弹礼物再续1000ms、6次快划逗猫均无care | SOURCE修复已核对，待本人稳定SHA独立运行 |
| L3-02 P2 modal drag/settling | drag_update921与drag_release946增加gate；update_peer1104先`drag_cancel()`，删除settling动画并恢复页；按着时设置contact_cancelled，吞至实际release | preview.c358–361覆盖活动drag arrival、settling arrival、overlay swipe；断言当前page/face/care不变且drag清除 | SOURCE修复已核对，待独立运行 |
| L3-03 P2 toast盖guide | toast改180×40，中心(233,64)，实际bounds[143,44,322,83]；guide圆顶部90，至少6px间隔；toast_covers以保守[143..323,44..84]截获press并用contact_cancelled保持整个contact归属 | preview.c364–367核guide不命中toast点、700ms toast接触不推进、HOME从toast起拖不导航 | 旧几何问题源码/已有实际bounds可支持已避开；下述文字可读性仍有独立缺口 |

旧release锁检查：gift出现时gesture.active=false/ignore_contact=true，并在按着时设置contact_cancelled；release先清cancel并返回，不能执行底层sleep。新press在modal上允许建立手势只是为判断close tap，其pressing/release早退阻断照料；没有看到旧L3-01路径仍漏门控。

## L3-04 / P2：新toast确实省略关键状态文字

这是**已有同SHA实际LVGL输出**，不是依据字符串长度猜测：

- `final-ui-v3-1/manifest.json`记录 pages SHA `59080848...`。
- 同目录 `gift_pending.json` 和 `gift_complete.json`的toast字段：bounds `[143,44,322,83]`，font_line_height=23，missing_glyphs=[]，实际text为 **`礼物已保存，等...`**，原 announce 内容是 `礼物已保存，等待确认`。
- 复制证据：[gift_pending.json](modal-read-evidence/gift_pending.json)、[已有离线PNG](modal-read-evidence/gift_pending.png)，hash另存modal-read-end.json。已目视现有PNG：单行字形上下完整，没有看见半行垂直裁切；问题是省略“待确认”语义。

原因：height40、上下padding各8只余24px，字体lineheight23能放一行、不能放两行。当前 `LV_LABEL_LONG_MODE_DOTS` 会按实际宽度省略，且 `lv_label_get_text` 导出的已是dots后内容；glyph0只能证明剩余显示字符可绘制，不能证明原句完整。

建议owner用短文案完整保留成功/失败/待确认差异，并增加长错误提示的**实际可见字符串**断言（guide写失败、care存储失败/队满、礼物等待确认、未知结果）。不能只核registry不重叠或missingglyph0。未在本轮虚构其他错误toast的具体省略结果；这些需owner或后续独立窗口实际执行。

## Toast接触归属与registry的准确边界

`toast_covers()`432行是实际PRESSED入口的硬编码排除区，命中后通过contact_cancelled锁住整次接触，直到release；已有owner输入case确实验证这一点。当前 `ui_target`/`badge_ui_targets.h`没有toast项，导出hit_targets也没有toast或background区域扣除描述。

因此它不是“toast也共用单一target registry”。对于圆形全屏hold/guide swipe等背景手势域，实际有效域还要减去toast排除区。最终验收应明确导出这一ownership exclusion，或用统一几何来源避免下一次toast宽/高变化后拦截区漂移。当前180×40几何与实际入口是相符的（额外1px为保守吞接触），没有据此新增产品行为阻断。

## 后续

等待短toast修复/51场景稳定源冻结，优先独立运行modal三项与toast全字符串/几何/接触归属。B/C空环、灰heart和缺权威数据仍按空态端口缺口记录，未扩大为本轮实现bug；音频/物理屏幕/真实触摸继续待设备授权验收。
