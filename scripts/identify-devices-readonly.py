#!/usr/bin/env python3
"""List OS serial names, USB registry metadata and existing ADB host inventory.

Never opens a serial port, starts ADB, or sends a command to an Android device.
USB serial identifiers may be sensitive: keep output local.
"""
import argparse
import datetime
import json
from pathlib import Path
import platform
import socket
import subprocess


def usb_metadata():
    if platform.system() != "Darwin":
        return {"status": "unsupported_os", "devices": []}
    try:
        completed = subprocess.run(
            ["/usr/sbin/system_profiler", "SPUSBDataType", "-json", "-detailLevel", "mini"],
            capture_output=True, text=True, timeout=20, check=True,
        )
        tree = json.loads(completed.stdout)
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        return {"status": "unavailable", "error": type(error).__name__, "devices": []}
    devices = []
    keys = ("_name", "manufacturer", "vendor_id", "product_id", "serial_num", "location_id", "speed")

    def visit(node):
        if isinstance(node, dict):
            selected = {key: node[key] for key in keys if key in node}
            if selected:
                devices.append(selected)
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)

    visit(tree)
    return {"status": "ok", "devices": devices}


def read_exact(connection, length):
    chunks = []
    while length:
        chunk = connection.recv(length)
        if not chunk:
            raise ValueError("ADB host response ended early")
        chunks.append(chunk)
        length -= len(chunk)
    return b"".join(chunks)


def adb_inventory(port):
    # The CLI `adb devices -l` can start a missing server. Query the identical
    # read-only host service directly so this script cannot create a daemon.
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=3) as connection:
            request = b"host:devices-l"
            connection.sendall(f"{len(request):04x}".encode("ascii") + request)
            status = read_exact(connection, 4)
            if status not in (b"OKAY", b"FAIL"):
                raise ValueError("Not an ADB host response")
            length = int(read_exact(connection, 4), 16)
            if length > 1024 * 1024:
                raise ValueError("Unexpectedly large ADB inventory")
            response = read_exact(connection, length).decode("utf-8", errors="replace")
            if status == b"FAIL":
                return {"status": "host_query_failed", "error": response, "devices": []}
            return {"status": "ok", "devices": response.splitlines()}
    except (OSError, ValueError) as error:
        return {"status": "server_unavailable_or_invalid", "error": type(error).__name__, "devices": []}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-adb", action="store_true", help="List OS metadata only")
    parser.add_argument("--adb-port", type=int, default=5037, help="Existing localhost ADB server port (default:5037)")
    args = parser.parse_args()
    if not 1 <= args.adb_port <= 65535:
        parser.error("ADB port must be in 1..65535")
    result = {
        "captured_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "os": {"system": platform.system(), "release": platform.release(), "machine": platform.machine()},
        "serial_port_names": sorted(str(path) for path in Path("/dev").glob("cu.*")),
        "usb": usb_metadata(),
        "adb_query": "existing localhost server host:devices-l; equivalent to adb devices -l",
        "adb": {"status": "skipped", "devices": []} if args.skip_adb else adb_inventory(args.adb_port),
        "limitations": "Metadata only. No serial port opened; no chip/flash/security state confirmed; no device permissions authorized.",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
