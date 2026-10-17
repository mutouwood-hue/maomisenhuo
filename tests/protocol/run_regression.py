"""Run all host protocol tests and save evidence with production-source hashes."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import sys
import time
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, default=HERE / "latest-report.json")
    parser.add_argument("--require-all", action="store_true", help="fail if any dependency-dependent tests are skipped")
    args = parser.parse_args()
    started = time.monotonic()
    suite = unittest.defaultTestLoader.discover(str(HERE), pattern="test_*.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    paths = [ROOT / "firmware/main" / name for name in ["badge.h", "badge_ble.c", "badge_state.c", "badge_wire.c", "badge_wire.h"]]
    paths += [ROOT / "app/android/app/src/main/java/com/catforest/app" / name for name in ["PetStore.kt", "BadgeBle.kt"]]
    paths += sorted((ROOT / "protocol/v1").rglob("*.json")) + [ROOT / "protocol/v1/README.md"]
    cjson = ROOT / ".tools/idf-tools/cjson-pinned"
    paths += [cjson / "cJSON.c", cjson / "cJSON.h"]
    evidence = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "runtime": {"python": platform.python_version(), "platform": platform.system(), "machine": platform.machine()},
        "scope": "Host execution and protocol oracle only; no Android device, real BLE, target NVS, touch, flash, pairing or power acceptance.",
        "testsRun": result.testsRun,
        "durationSeconds": round(time.monotonic() - started, 3),
        "status": "failed" if not result.wasSuccessful() else ("partial" if result.skipped else "passed"),
        "completeProductionHostCoverage": not result.skipped and result.wasSuccessful(),
        "success": result.wasSuccessful() and (not args.require_all or not result.skipped),
        "skipped": [{"test": str(test), "reason": reason} for test, reason in result.skipped],
        "failures": [{"test": str(test), "traceback": detail} for test, detail in result.failures],
        "errors": [{"test": str(test), "traceback": detail} for test, detail in result.errors],
        "inputSha256": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths if path.is_file()},
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
    print(f"Evidence: {args.report}")
    return 0 if evidence["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
