from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


OUT = Path(__file__).resolve().parent
PLAN = json.loads((OUT / "FLASH-PLAN.json").read_text())
RECEIPT = OUT / "FLASH-RECEIPT.json"
IMAGE = OUT / PLAN["image"]
EXPECTED_MAC = "7c:0c:5f:42:36:84"
if RECEIPT.exists():
    raise SystemExit("receipt already exists; inspect it before any further device write")
if (PLAN["selected"]["name"], PLAN["selected"]["offset"], PLAN["selected"]["size"]) != ("ota_1", 0x820000, 0x800000):
    raise SystemExit("refusing unexpected flash target")
if PLAN["currentApp"] != {"project": "cat_forest_badge", "version": "0.6.9-cat-interaction"}:
    raise SystemExit("refusing unexpected current app")
data = IMAGE.read_bytes()
digest = hashlib.sha256(data).hexdigest()
if digest != PLAN["sha256"] or len(data) != PLAN["bytes"] or len(data) > PLAN["selected"]["size"]:
    raise SystemExit("image no longer matches the reviewed flash plan")

command = [
    "/Users/zoumutou/coding/猫咪森活/.tools/idf-tools/python_env/idf5.5_py3.13_env/bin/python",
    "-m", "esptool", "--chip", "esp32s3", "-p", "/dev/cu.usbmodem1101", "-b", "460800",
    "--before", "default_reset", "--after", "hard_reset", "write_flash",
    "--flash_mode", "keep", "--flash_freq", "keep", "--flash_size", "keep",
    hex(PLAN["selected"]["offset"]), str(IMAGE.resolve()),
]
started = datetime.now(timezone.utc).isoformat()
receipt = {
    "startedAtUtc": started,
    "deviceMac": EXPECTED_MAC,
    "applicationOnly": True,
    "partition": PLAN["selected"]["name"],
    "offset": PLAN["selected"]["offset"],
    "capacity": PLAN["selected"]["size"],
    "file": IMAGE.name,
    "bytes": len(data),
    "sha256": digest,
    "command": command,
    "writesNvs": False,
    "writesOtadata": False,
    "writesPartitionTable": False,
    "writesBootloader": False,
    "writesAssetsPartitions": False,
    "eraseAll": False,
    "hardwareInteractionAcceptance": "not performed; awaiting user",
}
RECEIPT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
with (OUT / "badge-flash.log").open("w") as log:
    result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
log_text = (OUT / "badge-flash.log").read_text(errors="replace")
receipt.update({
    "finishedAtUtc": datetime.now(timezone.utc).isoformat(),
    "exitCode": result.returncode,
    "macConfirmedDuringWrite": f"MAC: {EXPECTED_MAC}" in log_text,
    "esptoolHashVerified": "Hash of data verified." in log_text,
    "deployed": result.returncode == 0 and f"MAC: {EXPECTED_MAC}" in log_text and "Hash of data verified." in log_text,
})
RECEIPT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({k: receipt[k] for k in ("partition", "offset", "bytes", "sha256", "exitCode", "macConfirmedDuringWrite", "esptoolHashVerified", "deployed")}, ensure_ascii=False))
if not receipt["deployed"]:
    raise SystemExit("app-only flash did not complete and verify; inspect receipt and log before any retry")
