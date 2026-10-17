#!/usr/bin/env python3
"""Serial local builds and verification. Never installs or accesses devices."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
LOGS = ROOT / "logs"
EXCLUDED = {"build", "managed_components", ".gradle", "__pycache__"}
GENERATED_REPORTS = {"firmware/tools/latest-gesture-report.json"}


def inputs():
    paths = []
    for name in ["app", "firmware", "protocol"]:
        paths += [p for p in (ROOT / name).rglob("*") if p.is_file() and not EXCLUDED.intersection(p.relative_to(ROOT).parts) and p.name != "sdkconfig.old" and p.relative_to(ROOT).as_posix() not in GENERATED_REPORTS]
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)}


def main():
    LOGS.mkdir(exist_ok=True)
    initial = inputs()
    checks = [
        ("androidBuild", "android-build.log", ["bash", "scripts/build-android.sh", "--offline"]),
        ("firmwareTargetBuild", "firmware-build.log", ["bash", "scripts/setup-idf.sh", "--exec", "ninja", "-C", "firmware/build", "-j2"]),
        ("apkSignature", "apk-verification.txt", ["bash", "scripts/android-env.sh", ".tools/android-sdk/build-tools/35.0.0/apksigner", "verify", "--verbose", "--print-certs", "app/android/app/build/outputs/apk/debug/app-debug.apk"]),
        ("firmwareImage", "firmware-image-info.txt", ["bash", "scripts/setup-idf.sh", "--exec", "python", "-m", "esptool", "--chip", "esp32s3", "image_info", "firmware/build/cat_forest_badge.bin"]),
        ("firmwareSize", "firmware-size.txt", ["bash", "scripts/setup-idf.sh", "--exec", "idf.py", "-C", "firmware", "size"]),
        ("hostRegression", "host-regression.txt", ["bash", "scripts/android-env.sh", "python3", "tests/protocol/run_regression.py", "--require-all"]),
        ("storageAndBridgeFaults", "lifecycle-regression.txt", ["bash", "scripts/android-env.sh", "python3", "-m", "unittest", "discover", "-s", "tests/lifecycle-review", "-p", "test_*.py", "-v"]),
        ("originalLifeRules", "local-life-regression.txt", ["bash", "scripts/android-env.sh", "python3", "tests/local-life/run.py"]),
        ("badgeGestures", "gesture-regression.txt", ["python3", "firmware/tools/test_gesture.py"]),
        ("phoneFeedback", "phone-feedback-regression.txt", ["node", "tests/phone-feedback/test_feedback.cjs"]),
    ]
    result = {"startedAtUtc": datetime.now(timezone.utc).isoformat(), "sourceSha256": initial, "checks": [], "hardwareScope": "No install, flash, permissions, serial, BLE or real-device acceptance"}
    for name, filename, command in checks:
        print(name, "started", flush=True)
        started = time.monotonic()
        path = LOGS / filename
        if path.exists() and filename.endswith("-build.log"):
            path.rename(LOGS / (filename + ".previous"))
        with path.open("w") as log:
            run = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
        result["checks"].append({"name": name, "command": command, "exitCode": run.returncode, "durationSeconds": round(time.monotonic() - started, 3), "log": str(path.relative_to(ROOT))})
        print(name, "exit", run.returncode, flush=True)
        if run.returncode:
            print("\n".join(path.read_text(errors="replace").splitlines()[-25:]), flush=True)
            (LOGS / "build-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
            return run.returncode
    final = inputs()
    if final != initial:
        result['status'] = 'source_changed'
        result['changedInputs'] = sorted(name for name in initial.keys() | final.keys() if initial.get(name) != final.get(name))
        (LOGS / 'build-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
        print('Product inputs changed during serial verification:', result['changedInputs'], flush=True)
        return 1
    result["completedAtUtc"] = datetime.now(timezone.utc).isoformat()
    result["status"] = "passed"
    (LOGS / "build-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
