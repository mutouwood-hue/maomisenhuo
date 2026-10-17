"""Actual Android platform/UI harness. Never selects an implicit adb device.

Only CatForest_API35 at emulator-5556 is permitted. No permission grants,
app-data deletion, JS injection, mock transport or physical device operations.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import time
import uuid
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = "com.catforest.app"
SERIAL = "emulator-5556"
AVD = "CatForest_API35"
ACTIVITY = PACKAGE + "/.MainActivity"


class AdbHarness:
    def __init__(self, serial, output, adb=None):
        if serial != SERIAL:
            raise ValueError("Only the explicitly authorized emulator-5556 is permitted")
        executable = adb or shutil.which("adb") or str(ROOT / ".tools/android-sdk/platform-tools/adb")
        if not Path(executable).is_file():
            raise FileNotFoundError("Existing adb executable not found; this harness never installs SDKs")
        self.prefix = [executable, "-s", serial]
        self.output = Path(output)
        self.output.mkdir(parents=True, exist_ok=True)
        self.log = self.output / "commands.jsonl"
        self.sequence = 0
        self.metadata = {}

    def run(self, *arguments, timeout=30, binary=False):
        started = time.monotonic()
        result = subprocess.run(self.prefix + list(arguments), capture_output=True, timeout=timeout)
        record = {"atUtc": datetime.now(timezone.utc).isoformat(), "arguments": list(arguments), "returnCode": result.returncode, "seconds": round(time.monotonic() - started, 3), "stdoutBytes": len(result.stdout), "stderr": result.stderr.decode(errors="replace")[:1000]}
        with self.log.open("a") as stream:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
        if result.returncode:
            raise RuntimeError("adb command failed: " + " ".join(arguments) + "\n" + result.stderr.decode(errors="replace") + result.stdout.decode(errors="replace")[:1000])
        return result.stdout if binary else result.stdout.decode("utf-8", errors="strict").strip()

    def shell(self, *arguments, **kwargs):
        return self.run("shell", *arguments, **kwargs)

    def preflight(self):
        if self.run("get-state") != "device":
            raise RuntimeError("Specified emulator is not ready")
        qemu = [self.shell("getprop", key) for key in ("ro.kernel.qemu", "ro.boot.qemu")]
        name = self.run("emu", "avd", "name").splitlines()[0]
        sdk = self.shell("getprop", "ro.build.version.sdk")
        abi = self.shell("getprop", "ro.product.cpu.abi")
        if "1" not in qemu or name != AVD or sdk != "35" or abi != "arm64-v8a":
            raise RuntimeError(f"Refusing unexpected device: qemu={qemu}, avd={name}, API={sdk}, ABI={abi}")
        size = re.findall(r"(\d+)x(\d+)", self.shell("wm", "size"))[-1]
        self.width, self.height = map(int, size)
        self.metadata = {"serial": SERIAL, "avd": name, "api": sdk, "abi": abi, "screen": [self.width, self.height], "fingerprint": self.shell("getprop", "ro.build.fingerprint")}
        return self.metadata

    def install(self, apk):
        apk = Path(apk).resolve(strict=True)
        self.metadata["apk"] = str(apk.relative_to(ROOT)) if apk.is_relative_to(ROOT) else str(apk)
        self.metadata["apkSha256"] = hashlib.sha256(apk.read_bytes()).hexdigest()
        self.metadata.setdefault("installHistory", []).append({"apk": self.metadata["apk"], "sha256": self.metadata["apkSha256"], "atUtc": datetime.now(timezone.utc).isoformat()})
        # Replaces the APK in place, preserving actual application data.
        result = self.run("install", "-r", "-t", str(apk), timeout=60)
        if "Success" not in result:
            raise RuntimeError("APK installation did not report Success: " + result)
        return result

    def verify_existing_apk(self, apk):
        apk = Path(apk).resolve(strict=True)
        expected = hashlib.sha256(apk.read_bytes()).hexdigest()
        paths = [line.removeprefix("package:") for line in self.shell("pm", "path", PACKAGE).splitlines() if line.startswith("package:") and line.endswith("/base.apk")]
        if len(paths) != 1 or not re.fullmatch(r"/data/app/[A-Za-z0-9_./+=~-]+/base\.apk", paths[0]):
            raise AssertionError("Package manager did not expose one exact application base.apk path")
        actual = hashlib.sha256(self.run("exec-out", "cat", paths[0], binary=True)).hexdigest()
        if actual != expected:
            raise AssertionError(f"Installed APK differs from local candidate: actual={actual}, expected={expected}")
        self.metadata.update(apk=str(apk.relative_to(ROOT)) if apk.is_relative_to(ROOT) else str(apk), apkSha256=actual, installedApkPath=paths[0], installationMode="continued_existing_verified_installation")
        return actual

    def start(self):
        result = self.shell("am", "start", "-W", "-n", ACTIVITY)
        if "Error:" in result or "Exception" in result:
            raise RuntimeError(result)
        return result

    def stop(self):
        self.shell("am", "force-stop", PACKAGE)

    def key(self, name):
        self.shell("input", "keyevent", name)

    def tap(self, x, y):
        if not (0 < x < self.width and 0 < y < self.height):
            raise ValueError("Touch coordinates outside verified emulator screen")
        self.shell("input", "tap", str(int(x)), str(int(y)))

    def swipe(self, x1, y1, x2, y2, duration=400):
        for x, y in ((x1, y1), (x2, y2)):
            if not (0 < x < self.width and 0 < y < self.height):
                raise ValueError("Touch coordinates outside verified emulator screen")
        self.shell("input", "swipe", *map(lambda value: str(int(value)), (x1, y1, x2, y2, duration)))

    def dump(self):
        path = "/sdcard/catforest-qa-window.xml"
        self.shell("rm", "-f", path)
        self.shell("uiautomator", "dump", "--compressed", path, timeout=15)
        xml = self.run("exec-out", "cat", path)
        return ET.fromstring(xml), xml

    @staticmethod
    def bounds(node):
        values = list(map(int, re.findall(r"\d+", node.attrib.get("bounds", ""))))
        if len(values) != 4:
            raise ValueError("Node does not expose a valid screen rectangle")
        return values

    def find(self, label, tree=None, contains=False):
        tree = tree if tree is not None else self.dump()[0]
        found = []
        for node in tree.iter("node"):
            if node.attrib.get("package") != PACKAGE or node.attrib.get("enabled") != "true":
                continue
            values = (node.attrib.get("text", ""), node.attrib.get("content-desc", ""))
            if not any(label in value if contains else label == value for value in values):
                continue
            x1, y1, x2, y2 = self.bounds(node)
            # API35 edge-to-edge exposes partially clipped controls behind the
            # system navigation bar. Scroll those into the unobscured viewport;
            # their accessibility rectangle alone does not make them tappable.
            if x2 > x1 and y2 > y1 and 0 <= y1 < self.height and 0 < y2 <= self.height * .92:
                found.append(node)
        return found

    def tap_label(self, label, scroll=True, contains=False):
        for attempt in range(6 if scroll else 1):
            tree, _ = self.dump()
            found = self.find(label, tree=tree, contains=contains)
            if found:
                x1, y1, x2, y2 = self.bounds(found[0])
                self.tap((x1 + x2) // 2, (y1 + y2) // 2)
                time.sleep(.3)  # Input dispatch and AtomicFile completion are asynchronous.
                return
            if attempt < 5 and scroll:
                scrollables = [node for node in tree.iter("node") if node.attrib.get("package") == PACKAGE and node.attrib.get("scrollable") == "true"]
                if scrollables:
                    x1, y1, x2, y2 = self.bounds(scrollables[-1])
                    gutter = x1 + max(4, (x2 - x1) * .025)
                    self.swipe(gutter, y1 + (y2 - y1) * .85, gutter, y1 + (y2 - y1) * .25)
                else:
                    raise AssertionError("Control absent and no product ScrollView available: " + label)
        raise AssertionError("Visible product control not found: " + label)

    def scroll_top(self):
        for _ in range(3):
            self.swipe(self.width * .025, self.height * .30, self.width * .025, self.height * .86)

    def read_state(self):
        raw = self.run("exec-out", "run-as", PACKAGE, "cat", "files/pet-state.json")
        envelope = json.loads(raw)
        if envelope.get("format") != "catforest-save" or envelope.get("schemaVersion") != 1:
            raise AssertionError("Unexpected on-device save format")
        payload = envelope["payload"]
        if hashlib.sha256(payload.encode("utf-8")).hexdigest() != envelope["sha256"]:
            raise AssertionError("Actual on-device save checksum mismatch")
        state = json.loads(payload)
        uuid.UUID(state["petId"])
        if not isinstance(state["revision"], int) or state["revision"] < 0:
            raise AssertionError("Actual on-device revision invalid")
        return state

    def permissions(self):
        data = self.shell("dumpsys", "package", PACKAGE)
        result = {}
        for permission in ("BLUETOOTH_SCAN", "BLUETOOTH_CONNECT", "CAMERA", "RECORD_AUDIO", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"):
            match = re.search(r"android\.permission\." + permission + r": granted=(true|false)", data)
            result[permission] = match.group(1) == "true" if match else None
        return result

    def capture(self, name, include_state=True, include_ui=True):
        self.sequence += 1
        stem = f"{self.sequence:03d}-" + re.sub(r"[^A-Za-z0-9._-]", "_", name)
        png = self.run("exec-out", "screencap", "-p", binary=True)
        if not png.startswith(b"\x89PNG\r\n\x1a\n"):
            raise AssertionError("Screenshot output is not PNG")
        (self.output / (stem + ".png")).write_bytes(png)
        detail = {}
        if include_ui:
            try:
                _, xml = self.dump()
                (self.output / (stem + ".xml")).write_text(xml)
            except Exception as error:
                detail["uiDumpError"] = str(error)
        if include_state:
            try:
                state = self.read_state()
                (self.output / (stem + ".state.json")).write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n")
            except Exception as error:
                detail["stateReadError"] = str(error)
        if detail:
            (self.output / (stem + ".capture-errors.json")).write_text(json.dumps(detail, ensure_ascii=False, indent=2) + "\n")
        return stem
