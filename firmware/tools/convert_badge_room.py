#!/usr/bin/env python3
"""Convert a reviewed, project-local, opaque 233x233 PNG to little-endian RGB565.

No resizing, background replacement, modeling or browser rendering occurs here.
"""
from pathlib import Path
import hashlib
import json
import struct
import sys
from PIL import Image

source, destination = map(Path, sys.argv[1:])
image = Image.open(source)
if image.format != "PNG" or image.size != (233, 233):
    raise ValueError("Room source must be a reviewed 233x233 PNG; implicit resize is forbidden")
rgba = image.convert("RGBA")
if rgba.getextrema()[3] != (255, 255):
    raise ValueError("Room source must be fully opaque; no implicit background compositing")
raw = bytearray()
error = [0, 0, 0]
for r, g, b, _ in rgba.get_flattened_data():
    color = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
    raw += struct.pack("<H", color)
    decoded = [((color >> 11) << 3) | ((color >> 11) >> 2), (((color >> 5) & 63) << 2) | (((color >> 5) & 63) >> 4), ((color & 31) << 3) | ((color & 31) >> 2)]
    for i, value in enumerate((r, g, b)):
        error[i] = max(error[i], abs(value - decoded[i]))
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_bytes(raw)
print(json.dumps({"width": 233, "height": 233, "available": True, "format": "RGB565 little endian", "bytes": len(raw), "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "rawSha256": hashlib.sha256(raw).hexdigest(), "maxAbsChannelErrorRGB": error, "pillow": Image.__version__}))
