"""使用本机已有 ESP-IDF 工具进行离线 Windows 构建，不安装或刷写。"""

import argparse
import json
import os
from pathlib import Path
import subprocess

ESPRESSIF_ROOT = Path("C:/Espressif")
IDF_PATH = Path("D:/Espressif/v5.5.5/esp-idf")
PYTHON = ESPRESSIF_ROOT / "tools/python/v5.5.5/venv/Scripts/python.exe"
CMAKE = ESPRESSIF_ROOT / "tools/cmake/3.30.2/bin/cmake.exe"
NINJA = ESPRESSIF_ROOT / "tools/ninja/1.12.1/ninja.exe"
COMPILER_BIN = ESPRESSIF_ROOT / "tools/xtensa-esp-elf/esp-14.2.0_20260121/xtensa-esp-elf/bin"
ULP_BIN = ESPRESSIF_ROOT / "tools/esp32ulp-elf/2.38_20240113/esp32ulp-elf/bin"
DEFAULT_PARALLEL = 2


def build_environment() -> dict[str, str]:
    env = dict(os.environ)
    # 隔离宿主 Python 与乱码 PATH，避免加载非 SDK DLL；仅影响本次子进程。
    for name in ("PYTHONHOME", "PYTHONPATH", "CMAKE_PREFIX_PATH", "CMAKE_MODULE_PATH"):
        env.pop(name, None)
    system_root = Path(env.get("SystemRoot", "C:/Windows"))
    paths = (PYTHON.parent, CMAKE.parent, NINJA.parent, COMPILER_BIN,
             ULP_BIN, system_root / "System32", system_root,
             Path("C:/Program Files/Git/cmd"))
    env.update(IDF_PATH=str(IDF_PATH), IDF_TOOLS_PATH=str(ESPRESSIF_ROOT),
               IDF_COMPONENT_MANAGER="0", IDF_PYTHON_ENV_PATH=str(PYTHON.parent.parent),
               PYTHONUTF8="1", ESP_IDF_VERSION="5.5.5")
    env["PATH"] = os.pathsep.join(str(path) for path in paths)
    return env


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--build", type=Path, required=True)
    parser.add_argument("--log-dir", type=Path, required=True)
    parser.add_argument("--configure-only", action="store_true")
    parser.add_argument("--trace", action="store_true")
    args = parser.parse_args()
    if not (args.source / "CMakeLists.txt").is_file():
        parser.error("source 必须是已有完整 ESP-IDF 工程")
    for tool in (PYTHON, CMAKE, NINJA, COMPILER_BIN / "xtensa-esp32s3-elf-gcc.exe"):
        if not tool.is_file():
            parser.error(f"缺少本机工具，禁止自动安装：{tool}")
    # 保留调用者的短路径/盘符，不能 resolve 成包含空格的 ESP-IDF 工程路径。
    source = args.source.absolute()
    build = args.build.absolute()
    args.log_dir.mkdir(parents=True, exist_ok=True)
    configure = [str(CMAKE), "-S", str(source), "-B", str(build), "-G", "Ninja",
                 "-DIDF_TARGET=esp32s3", f"-DPYTHON={PYTHON}",
                 "-DPYTHON_DEPS_CHECKED=1", f"-DCMAKE_MAKE_PROGRAM={NINJA}"]
    if args.trace:
        configure += ["--trace-expand", f"--trace-redirect={args.log_dir / 'configure-trace.log'}",
                      f"--trace-source={source / 'managed_components/espressif__libpng/libpng/CMakeLists.txt'}",
                      f"--trace-source={CMAKE.parent.parent / 'share/cmake-3.30/Modules/FindZLIB.cmake'}"]
    commands = [("configure", configure)]
    if not args.configure_only:
        commands.append(("build", [str(CMAKE), "--build", str(build),
                                   "--parallel", str(DEFAULT_PARALLEL)]))
    records: list[dict[str, object]] = []
    for stage, command in commands:
        log_path = args.log_dir / f"{stage}.log"
        with log_path.open("w", encoding="utf-8") as output:
            result = subprocess.run(command, env=build_environment(), cwd=CMAKE.parent,
                                    stdout=output, stderr=subprocess.STDOUT, check=False)
        records.append({"stage": stage, "command": command,
                        "exitCode": result.returncode,
                        "exitHex": f"0x{result.returncode & 0xFFFFFFFF:08X}"})
        (args.log_dir / "windows-build.json").write_text(
            json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{stage}: exit={result.returncode} log={log_path}", flush=True)
        if result.returncode:
            return result.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
