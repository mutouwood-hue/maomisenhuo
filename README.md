# 猫咪森活

手机端与 ESP32-S3 AMOLED 电子吧唧结合的电子宠物项目。

## 当前阶段

今晚联调候选已输出到本地构建目录 `artifacts/2026-10-15-v03-candidate/`（该目录在 `.gitignore` 内，不入库，需本地构建生成）。Android 0.3.0 已在唯一API35模拟器完成真实雨天擦拭/散步、喂食、接鱼、诊所与取消/恢复验收；固件工程版本0.1.0仍未上板。当前设备连接、现有固件备份与真机/BLE状态均未确认。先看 [设备识别与备份恢复准备](docs/device-backup-recovery.md)，刷写需要针对准确设备的独立明确授权。

已取得并冻结本地原型与交互包，正在实现 Android 手机端、ESP-IDF 单板固件和 v1 BLE 协议。原始 3D 房间、小猫模型、接鱼游戏与照料交互复用自用户附件。当前实现状态和完整 PRD 缺口见 [开发状态](docs/development-status.md)。构建通过、主机测试通过和真机验收分别记录，不能互相代替。

## 工程边界

- `docs/`：需求、决策、追踪矩阵、验收计划与来源记录。
- `assets/prototype/`：手机端小橘原型；吧唧交互原型另归 `assets/rendering/`。目前原件保留在根目录，后续整理归档前先沿用 manifest 哈希追踪。
- `assets/models/`：`pixel-cat.bbmodel`、`.glb` 等模型源资产及导出说明。
- `assets/firmware-spec/`：板卡、LVGL、屏幕、触控、外设的规格/实测记录。
- `assets/rendering/`：吧唧渲染参考和工具包。
- `protocol/`：手机、固件、后续云服务间的版本化消息/同步契约。
- `app/`：Android 原生 Kotlin 平台 Views、原型 Three.js 渲染和真实前台 BLE。
- `firmware/`：ESP-IDF 5.5.5 / LVGL 9.5.0 / Waveshare BSP 3.0.0 固件；设备写入待明确授权。

首版候选已冻结于本地构建目录 `artifacts/2026-10-15-core-candidate/`（不入库），已发现存档 P1，见旁侧 KNOWN-ISSUES；仅作 UI/升级基线。v0.2 已修复并扩展原型衣柜、户外、背包和诊所，正在统一构建及 Android 模拟器验收。真实 BLE/屏触/掉电仍待授权后的硬件验收。

构建与回归：`python3 scripts/build_candidate.py`；打包：`python3 scripts/package_candidate.py`；[环境与工具链](docs/build-environment.md)、[测试说明](tests/README.md)。构建工具与缓存位于忽略提交的 `.tools/`。

## 起步阅读

1. [项目盘点](docs/project-inventory.md)
2. [需求追踪与首个闭环](docs/requirements-and-first-loop.md)
3. [来源与缺失清单](docs/source-and-gap-register.md)
4. [吧唧资产索引](docs/badge-assets-index.md)
5. [固件边界](docs/firmware-boundary.md)
6. [原始资料哈希清单](docs/source-manifest.md)
7. [Waveshare 硬件交叉核对](docs/hardware-cross-check.md)
8. [Demo 审阅与开发方案](docs/demo-review-and-development-plan.md)

## 授权边界

不刷写或擦除设备、不采集定位/环境/语音/儿童数据、不启用付费 API、不添加凭据或权限、不发布线上服务。代码主线推送目标为 GitHub 私有仓库 `mutouwood-hue/maomisenhuo`。
