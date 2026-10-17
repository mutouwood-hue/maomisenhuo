# 猫咪森活

手机 WebView 原型＋ESP32-S3 AMOLED 电子吧唧。

## 当前集成入口

本轮按用户明确要求，接收隔壁完成的连接／清洁／主机上下文成果，与PRD非连接改善合成后，**全量替换**旧app和firmware目录，不备份、不哈希、不沿用旧Kotlin/v1主线。

- [移动端](<app/>)：038系原生Java桥＋原始Three.js HTML，资源入口为 `python app/scripts/build_assets.py`，Android工程在[android](<app/android/>)。
- [吧唧](<firmware/>)：053系ESP-IDF5.5.5/LVGL，加入不同页跟手、清洁能力协商与主机时间上下文；未改显示驱动。
- [成套共享契约](<protocol/integrated-care-context.md>)：CFLOCAL2 v2清洁、显式后台连接、同GATT完整flight、host_context。
- [本轮非连接修补说明](<work/prd-next/CONTINUATION-RESULT.md>)：今日环关闭清理、返回HOME彩段预览、真实地点空态、毕业JPEG备份等。

这次“覆盖”是项目源码目录替换，不代表已经在手机或吧唧安装／刷写，也不等于设备验收。成套集成进度与构建结果见[交付报告](<work/integrated/DELIVERY.md>)。

旧根 scripts/tests/docs仍是历史，不用其旧v1命令构建当前两端。未操作Git、付费API、设备刷写／安装或新建签名证书。
