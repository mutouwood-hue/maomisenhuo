"""Read-only physical BLE discovery/GATT inspection; never substitutes for two-device acceptance."""
import asyncio
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / "ble-runtime"))
from bleak import BleakScanner, BleakClient
TARGET = "7C:0C:5F:42:36:86"
SERVICE = "e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a00"
async def main():
    devices = await BleakScanner.discover(timeout=10, return_adv=True)
    matches = [(device, adv) for device, adv in devices.values() if device.address.upper() == TARGET]
    if not matches:
        print(json.dumps({"target": TARGET, "found": False, "scannedCount": len(devices), "isPhysicalBle": True}))
        raise SystemExit(2)
    device, adv = matches[0]
    print(json.dumps({"target": TARGET, "found": True, "name": device.name, "rssi": adv.rssi, "serviceUuids": adv.service_uuids, "isPhysicalBle": True}))
    async with BleakClient(device, timeout=15) as client:
        print(json.dumps({"connected": client.is_connected, "mtu": client.mtu_size, "services": [{"uuid": service.uuid, "characteristics": [{"uuid": ch.uuid, "properties": ch.properties} for ch in service.characteristics]} for service in client.services if service.uuid == SERVICE]}))
asyncio.run(main())
