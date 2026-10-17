from pathlib import Path
from PIL import Image
import base64
import io
import re

root = Path(__file__).resolve().parents[1]
html = (root / 'original/game.html').read_text(encoding='utf-8')
match = re.search(r'<link rel="apple-touch-icon" href="data:image/png;base64,([^"]+)"', html)
if not match:
    raise RuntimeError('Original app icon missing')
source = Image.open(io.BytesIO(base64.b64decode(match.group(1)))).convert('RGBA')
res = root / 'android/app/src/main/res'
for bucket, size, fg in [('mdpi',48,108),('hdpi',72,162),('xhdpi',96,216),('xxhdpi',144,324),('xxxhdpi',192,432)]:
    dest = res / ('mipmap-' + bucket)
    dest.mkdir(parents=True, exist_ok=True)
    icon = source.resize((size,size),Image.Resampling.LANCZOS)
    icon.save(dest/'ic_launcher.png')
    icon.save(dest/'ic_launcher_round.png')
    canvas = Image.new('RGBA',(fg,fg),(0,0,0,0))
    inner = round(fg * 0.62)
    cat = source.resize((inner,inner),Image.Resampling.LANCZOS)
    canvas.alpha_composite(cat,((fg-inner)//2,(fg-inner)//2))
    canvas.save(dest/'ic_launcher_foreground.png')
print('Generated Android launcher icons from original HTML icon')
