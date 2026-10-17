# 044 维护准备脚本独立审查

## 结论

仅允许Root在合适维护窗口按顺序进行 `security`、`backup`、`verify-current` 准备；**不放行app-write或044运行候选**。本审查只读源文件并运行自身离线校验，未导入执行脚本、未访问设备。准备时044无CANDIDATE、review-release或诊断helper，无阶段执行记录。

- `run_stage.py` SHA `63eefe77ea88a4bf85a970ffac9f8056d03070b7e4033280c23e00159e2a252d`。
- wrapper SHA `14e37af0c6f38c2f4792e0e80d068517b5826263d7bdb6d2a0fa80880fe9b4e4`，逐字同043。
- 相对043脚本仅改变前驱目录P、当前043应用变量/路径/固定SHA及注释；精确逆替换后全文同043，未扩大写地址、重试或解除gate。
- 043 FINAL-INDEX的59文件全部独立SHA/size复核精确；应用SHA、上轮app读回成功及完整保护verify元数据一致。

## 必须保留的界限

`security`使用USB reset进入ROM，会中断运行应用及RAM时钟；它没有flash写入，但不能称为完全无状态影响。backup只新读128KiB prefix，保留最新NVS并严格比较boot/table/selector/phy等保护区；历史组合槽先替换为已验证043应用槽。离线组合当前043整图SHA为`a85de6c2a7b62932ffe379829e2fc21b6fd811518d50fa9df14a37754ecd4387`，**不是本次fresh全Flash读取**。必须再成功进行物理全32MiB digest验证，才能建立后续写入基线。

所有阶段均先核USB序号，阶段记录存在时拒绝自动重试。app-write尚需最终044候选、独立decision及所有执行源的精确SHA gate；只能写当前OTA1应用范围，保留selector/NVS/另一槽/所有未触及tail，写后独立sector读回及全保护验证。当前准备结论不批准断电安全或自动回滚。

044新尺寸/缓存/生产LIVE指标须新helper重新审查，不能沿用043的1085860 cache、431296 ctx和旧CRC来宣布通过。后续源变化需另增delta记录。

## 复现与证据

`python3 tests/firmware044-review/check_preparation.py`

结果`preparation-checks.json`含6个源/证据pins与检查范围；`preparation-delta.diff`保留精确差异。无新confirmed P1/P2，范围仅限准备脚本及已冻结前驱证据。
