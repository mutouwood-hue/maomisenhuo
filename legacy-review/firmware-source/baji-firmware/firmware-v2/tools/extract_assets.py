"""Extract user HTML assets at build time; no pointer-down decompression."""
import base64, io, json, re, pathlib
from PIL import Image
source = pathlib.Path(r'C:\Users\admin\Downloads\吧唧触控引导与滑动动效.html')
root = pathlib.Path(__file__).resolve().parents[1]
text = source.read_text(encoding='utf-8')
match = re.search(r'const A=(\{.*?\});', text, re.S)
if not match:
    raise SystemExit('HTML asset map not found')
assets = json.loads(match.group(1))
output = root / 'render' / 'generated'
output.mkdir(parents=True, exist_ok=True)
header = ['/* Generated from user HTML. */', '#pragma once', '#include "lvgl.h"']
manifest = {}
for key, entry in assets.items():
    uri = entry if isinstance(entry, str) else entry['src']
    image = Image.open(io.BytesIO(base64.b64decode(uri.split(',', 1)[1]))).convert('RGBA' if isinstance(entry,dict) else 'RGB')
    w, h = image.size
    pixels = bytearray()
    for pixel in image.get_flattened_data():
        r,g,b = pixel[:3]
        if isinstance(entry,dict):
            pixels += bytes((b,g,r,pixel[3]))
        else:
            v = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
            pixels += bytes((v & 255, v >> 8))
    bpp = 4 if isinstance(entry,dict) else 2
    cf = 'ARGB8888' if bpp==4 else 'RGB565'
    name = 'bj_asset_' + key
    lines = ['/* Generated RGB565 asset. */', '#include "baji_assets.h"', f'static const uint8_t {name}_pixels[] = {{']
    lines += [','.join(str(v) for v in pixels[i:i+32])+',' for i in range(0,len(pixels),32)]
    lines += ['};',f'const lv_image_dsc_t {name} = {{',f' .header = {{.magic=LV_IMAGE_HEADER_MAGIC, .cf=LV_COLOR_FORMAT_{cf}, .w={w}, .h={h}, .stride={w*bpp}}},',f' .data_size={len(pixels)}, .data={name}_pixels', '};']
    (output / f'{key}.c').write_text('\n'.join(lines)+'\n', encoding='utf-8')
    header.append(f'extern const lv_image_dsc_t {name};')
    manifest[key] = {'width':w, 'height':h, 'bytes':len(pixels), **({k:v for k,v in entry.items() if k!='src'} if isinstance(entry,dict) else {})}
header += ['extern const lv_image_dsc_t bj_frames_catA[24];', 'extern const lv_image_dsc_t bj_frames_catB[24];']
(output / 'baji_assets.h').write_text('\n'.join(header)+'\n', encoding='utf-8')
(output / 'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False))
from pack_cat_frames import generate
(output / 'cat_frames.c').write_text(generate(), encoding='utf-8')
