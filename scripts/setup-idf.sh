#!/usr/bin/env bash
# All SDK downloads, Python packages, and tools remain under this project.
set -euo pipefail

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
export IDF_PATH="$PROJECT_ROOT/.tools/esp-idf"
export IDF_TOOLS_PATH="$PROJECT_ROOT/.tools/idf-tools"
export IDF_GITHUB_ASSETS="${IDF_GITHUB_ASSETS:-dl.espressif.cn/github_assets}"
export IDF_PIP_WHEELS_URL="${IDF_PIP_WHEELS_URL:-https://dl.espressif.cn/pypi}"
export SSL_CERT_FILE="${SSL_CERT_FILE:-/etc/ssl/cert.pem}"
export PIP_CERT="${PIP_CERT:-$SSL_CERT_FILE}"
export PIP_CACHE_DIR="$IDF_TOOLS_PATH/pip-cache"
export IDF_COMPONENT_CACHE_PATH="$IDF_TOOLS_PATH/component-cache"
# Official Espressif regional storage; dependency-lock hashes remain mandatory.
export IDF_COMPONENT_STORAGE_URL="${IDF_COMPONENT_STORAGE_URL:-https://components-file.espressif.cn/}"
IDF_COMMIT=b774170ff46c393eeb5e495ea37936038d3f4f4f

verify_sdk() {
  test -f "$IDF_PATH/tools/idf.py" || { echo 'ESP-IDF is absent; run --install.' >&2; exit 1; }
  test "$(git -C "$IDF_PATH" rev-parse HEAD)" = "$IDF_COMMIT" || {
    echo 'ESP-IDF checkout differs from the pinned v5.5.5 commit; refusing to change it.' >&2
    exit 1
  }
}

verify_submodules() {
  local status
  status=$(git -C "$IDF_PATH" submodule status --recursive)
  if printf '%s\n' "$status" | grep -Eq '^[+U-]'; then
    echo 'SDK submodules are incomplete or differ from their recorded commits:' >&2
    printf '%s\n' "$status" | grep -E '^[+U-]' >&2
    return 1
  fi
}

case "${1:---help}" in
  --install)
    mkdir -p "$IDF_TOOLS_PATH"
    if test ! -d "$IDF_PATH/.git"; then
      git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 clone --depth 1 --branch v5.5.5 --single-branch --filter=blob:none \
        https://github.com/espressif/esp-idf.git "$IDF_PATH"
    fi
    verify_sdk
    git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 -C "$IDF_PATH" submodule update --init --recursive --depth 1 --jobs 4
    "$IDF_PATH/install.sh" esp32s3
    python3 "$IDF_PATH/tools/idf_tools.py" install cmake ninja
    verify_submodules
    ;;
  --env)
    verify_sdk
    # Python quoting preserves UTF-8 project paths on macOS's Bash 3.2.
    python3 - <<'PY'
import os
import shlex
for key in ("IDF_PATH", "IDF_TOOLS_PATH", "SSL_CERT_FILE", "PIP_CERT", "PIP_CACHE_DIR",
            "IDF_COMPONENT_CACHE_PATH", "IDF_COMPONENT_STORAGE_URL"):
    print("export " + key + "=" + shlex.quote(os.environ[key]))
print(". " + shlex.quote(os.path.join(os.environ["IDF_PATH"], "export.sh")))
PY
    ;;
  --check|--exec)
    mode=$1
    shift
    verify_sdk
    verify_submodules
    # Official activation checks installed tools and Python requirements.
    . "$IDF_PATH/export.sh"
    if test "$mode" = --check; then
      idf.py --version
      xtensa-esp32s3-elf-gcc --version
      cmake --version
      ninja --version
    else
      test "$#" -gt 0 || { echo '--exec requires a command.' >&2; exit 2; }
      exec "$@"
    fi
    ;;
  *)
    cat <<'USAGE'
Usage: bash scripts/setup-idf.sh --install  # network required, project-local only
       bash scripts/setup-idf.sh --check
       eval "$(bash scripts/setup-idf.sh --env)"
       bash scripts/setup-idf.sh --exec idf.py -C firmware build
ESP-IDF v5.5.5; target esp32s3. This script never flashes or opens a device.
USAGE
    ;;
esac
