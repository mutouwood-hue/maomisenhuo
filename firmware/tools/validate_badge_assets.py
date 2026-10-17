#!/usr/bin/env python3
"""Read-only consistency verification of offline original-renderer deliverables.

No target build, browser, ADB, serial, firmware or save mutation.
"""
from pathlib import Path
import hashlib
import json
import re
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/rendering/badge-v2"
manifest = json.loads((OUT / "provenance.json").read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
assert manifest["stage"] == "full", "Three preview images alone are not the full delivery"
assert sha((ROOT / manifest["source"]).read_bytes()) == manifest["sourceSha256"]
assert sha((OUT / manifest["pcat"]["file"]).read_bytes()) == manifest["pcat"]["sha256"]
assert (manifest["frame"]["width"], manifest["frame"]["height"], manifest["frame"]["anchor"]) == (192, 208, [96, 196])
assert manifest["verification"]["noPerFrameAutoCrop"]
fmt = manifest["lvglFormat"]
registry = (ROOT / "firmware/main/assets/game_assets.c").read_text()
assert "const badge_scene_assets_t *badge_game_assets(void)" in registry
parsed_c = {}
for name, expected in manifest["generatedC"].items():
    source = ROOT / "firmware/main/assets" / name
    data = source.read_bytes()
    assert sha(data) == expected, f"Generated C/header changed: {name}"
    if name in ("game_assets.c", "game_assets.h"):
        continue
    text = data.decode()
    for match in re.finditer(r"static const LV_ATTRIBUTE_MEM_ALIGN uint8_t (game_\w+)_data\[\] = \{(.*?)\n\};", text, re.S):
        parsed_c[match[1]] = bytes.fromhex("".join(re.findall(r"0x([0-9a-f]{2})", match[2])))

seen = {}
total = 0
for frame in manifest["frames"]:
    name = frame["id"]
    png = OUT / "frames" / f"{name}.png"
    data = (OUT / "encoded" / f"{name}.{fmt.lower()}").read_bytes()
    assert sha(png.read_bytes()) == frame["pngSha256"]
    assert sha(data) == frame["encodedSha256"] and len(data) == frame["encodedBytes"]
    assert parsed_c[name] == data, f"C array differs from encoded source: {name}"
    image = Image.open(png).convert("RGBA")
    assert image.size == (192, 208)
    assert list(image.getbbox()) == [frame["bounds"][0], frame["bounds"][1], frame["bounds"][2] + 1, frame["bounds"][3] + 1]
    x0, y0, x1, y1 = frame["bounds"]
    assert x0 > 0 and y0 > 0 and x1 < 191 and y1 < 207
    pixels = image.get_flattened_data()
    assert frame["coverage"] == sum(1 for *_, alpha in pixels if alpha)
    native565 = bytearray(); alphas = bytearray(); coverage_colors = set()
    for i, (red, green, blue, alpha) in enumerate(pixels):
        assert alpha in (0, 255)
        original = ((red >> 3) << 11) | ((green >> 2) << 5) | (blue >> 3)
        native565 += original.to_bytes(2, "little"); alphas.append(alpha)
        if fmt == "I8":
            index = data[1024 + i]
            b, g, r, a = data[index * 4:index * 4 + 4]
            decoded565 = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
            assert a == alpha and (not alpha or decoded565 == original)
            assert bool(index) == bool(alpha), "Opaque black must have a nonzero index"
            assert data[:4] == bytes(4), "Transparent index 0 palette must be BGRA 0"
        else:
            assert int.from_bytes(data[i * 2:i * 2 + 2], "little") == original
            assert data[192 * 208 * 2 + i] == alpha
        if alpha:
            coverage_colors.add(original)
    assert len(coverage_colors) == frame["colors"]
    assert sha(native565 + alphas) == frame["raw565AlphaSha256"]
    seen.setdefault(frame["clip"], []).append(frame)
    total += len(data)

for clip in manifest["plannedClips"]:
    frames = seen[clip["id"]]
    assert len(frames) == clip["count"] == clip["uniqueFrames"]
    assert len({f["raw565AlphaSha256"] for f in frames}) == clip["count"]
    assert [f["index"] for f in frames] == list(range(clip["count"]))
    assert all(f["changedPixelsFromPrevious"] > 0 for f in frames[1:])
    assert f'.count={clip["count"]},.cycle_ms={clip["cycleMs"]},.loop={str(clip["loop"]).lower()}' in registry
assert total == manifest["budget"]["totalPayloadBytes"] <= manifest["budget"]["original40FrameRGB565A8Budget"]
room = manifest.get("room", {})
if room.get("available"):
    source = ROOT / room["source"]
    assert sha(source.read_bytes()) == room["sourceSha256"]
    raw = (ROOT / room["raw"]).read_bytes()
    assert len(raw) == 233 * 233 * 2 and sha(raw) == room["rawSha256"]
    assert parsed_c["game_room"] == raw and ".room = &game_room" in registry
else:
    assert ".room = NULL" in registry
print(json.dumps({"result": "passed", "frames": len(manifest["frames"]), "format": fmt, "clips": {k: len(v) for k, v in seen.items()}, "encodedBytes": total, "roomRegistered": room.get("available", False), "scope": "Artifact PNG/binary/C/hash/alpha/anchor/layout consistency only; not target decoding, FPS or hardware acceptance."}, ensure_ascii=False, indent=2))
