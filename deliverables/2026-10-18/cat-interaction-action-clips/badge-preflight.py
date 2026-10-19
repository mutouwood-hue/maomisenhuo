from __future__ import annotations

import hashlib
import json
import struct
import subprocess
import sys
import zlib
from pathlib import Path


OUT = Path(__file__).resolve().parent
PORT = "/dev/cu.usbmodem1101"
EXPECTED_MAC = "7c:0c:5f:42:36:84"
PYTHON = Path("/Users/zoumutou/coding/猫咪森活/.tools/idf-tools/python_env/idf5.5_py3.13_env/bin/python")
IMAGE = OUT / "cat_forest_badge-0.7.0-cat-actions.bin"
BUILD_PARTITIONS = Path("/tmp/catforest-cat-actions-badge-070/partition_table/partition-table.bin")
BASE = [str(PYTHON), "-m", "esptool", "--chip", "esp32s3", "-p", PORT,
        "-b", "460800", "--before", "default_reset", "--after", "hard_reset"]


def read_flash(offset: int, size: int, name: str) -> bytes:
    output = OUT / f"{name}.bin"
    log_path = OUT / f"read-{name}.log"
    command = BASE + ["read_flash", hex(offset), hex(size), str(output)]
    with log_path.open("w") as log:
        result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
    log_text = log_path.read_text()
    if result.returncode or f"MAC: {EXPECTED_MAC}" not in log_text:
        raise SystemExit(f"read failed or unexpected badge; inspect {log_path.name}")
    return output.read_bytes()


partition_raw = read_flash(0x8000, 0x1000, "partition-table-before")
partitions = []
table_md5_valid = False
for offset in range(0, len(partition_raw), 32):
    row = partition_raw[offset:offset + 32]
    magic = struct.unpack_from("<H", row)[0]
    if magic == 0xEBEB:
        table_md5_valid = hashlib.md5(partition_raw[:offset]).digest() == row[16:32]
        break
    if magic == 0xFFFF:
        break
    if magic != 0x50AA:
        raise SystemExit(f"unknown partition table record at {offset:#x}")
    _, kind, subtype, start, size, label, flags = struct.unpack("<HBBII16sI", row)
    partitions.append({"name": label.split(b"\0")[0].decode(), "type": kind,
                       "subtype": subtype, "offset": start, "size": size, "flags": flags})
if not table_md5_valid:
    raise SystemExit("partition table MD5 did not validate")
if partition_raw != BUILD_PARTITIONS.read_bytes().ljust(0x1000, b"\xff"):
    raise SystemExit("device partition layout differs from production build")

otadata_part = next(p for p in partitions if p["type"] == 1 and p["subtype"] == 0)
otadata = read_flash(otadata_part["offset"], otadata_part["size"], "otadata-before")
ota_copies = []
for offset in (0, 4096):
    sequence = struct.unpack_from("<I", otadata, offset)[0]
    state, crc = struct.unpack_from("<II", otadata, offset + 24)
    expected_crc = zlib.crc32(otadata[offset:offset + 4], 0xFFFFFFFF) & 0xFFFFFFFF
    ota_copies.append({"sequence": sequence, "state": state, "crc": crc,
                       "expectedCrc": expected_crc,
                       "valid": sequence != 0xFFFFFFFF and state not in (3, 4) and crc == expected_crc})
valid = [record for record in ota_copies if record["valid"]]
if not valid:
    raise SystemExit("no valid OTA selection record")
apps = sorted((p for p in partitions if p["type"] == 0 and 16 <= p["subtype"] <= 31),
              key=lambda p: p["subtype"])
sequence = max(valid, key=lambda record: record["sequence"])["sequence"]
selected = apps[(sequence - 1) % len(apps)]
if selected["name"] != "ota_1" or selected["offset"] != 0x820000 or selected["size"] != 0x800000:
    raise SystemExit(f"unexpected active app partition: {selected}")

header = read_flash(selected["offset"], 0x1000, "app-header-before")
if header[0] != 0xE9 or struct.unpack_from("<I", header, 32)[0] != 0xABCD5432:
    raise SystemExit("invalid app descriptor in selected partition")
current_app = {"project": header[80:112].split(b"\0")[0].decode(),
               "version": header[48:80].split(b"\0")[0].decode()}
if current_app != {"project": "cat_forest_badge", "version": "0.6.9-cat-interaction"}:
    raise SystemExit(f"unexpected current app in selected partition: {current_app}")

image = IMAGE.read_bytes()
image_desc = {"project": image[80:112].split(b"\0")[0].decode(),
              "version": image[48:80].split(b"\0")[0].decode()}
if image_desc != {"project": "cat_forest_badge", "version": "0.7.0-cat-actions"}:
    raise SystemExit(f"unexpected new image descriptor: {image_desc}")
if len(image) > selected["size"]:
    raise SystemExit("new app image exceeds selected application partition")

plan = {"deviceMac": EXPECTED_MAC, "partitionTableMd5Valid": table_md5_valid,
        "matchesProductionBuild": True, "partitions": partitions,
        "otaCopies": ota_copies, "currentApp": current_app, "selected": selected,
        "image": IMAGE.name, "imageDescription": image_desc, "bytes": len(image),
        "freeBytes": selected["size"] - len(image),
        "sha256": hashlib.sha256(image).hexdigest(),
        "writeScope": "single selected ota_1 application partition only; no NVS, otadata, bootloader, partition table, assets, or erase-all"}
(OUT / "FLASH-PLAN.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"currentApp": current_app, "selected": selected,
                  "imageBytes": len(image), "freeBytes": plan["freeBytes"],
                  "sha256": plan["sha256"]}, ensure_ascii=False))
