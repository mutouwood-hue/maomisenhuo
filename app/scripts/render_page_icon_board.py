"""New local vector suite at real24px and enlarged96px, software only."""
from pathlib import Path
import subprocess,json,math
from PIL import Image,ImageDraw,ImageFont,ImageOps
root=Path(__file__).resolve().parents[1];out=root.parent/'evidence/icons/actions';out.mkdir(parents=True,exist_ok=True)
code="const fs=require('fs'),api=require('./web/offline-nav-icons');for(const k of Object.keys(api.actionLabels))fs.writeFileSync(process.argv[1]+'/'+k+'.svg',api.svg(k,48,'action-'+k));console.log(JSON.stringify(api.actionLabels));"
labels=json.loads(subprocess.check_output(['node','-e',code,str(out)],cwd=root));binary='/tmp/cat-page-svg-raster';subprocess.run(['swiftc',str(root/'scripts/render_ui_vectors.swift'),'-o',binary],check=True)
W,cellH=1280,176;cw=W//6;board=Image.new('RGB',(W,64+cellH*math.ceil(len(labels)/6)),'#edf3ec');d=ImageDraw.Draw(board);font=lambda n:ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',n)
d.text((18,12),'020 页面操作矢量套件 · 软件 SVG / 非 Android 截图',font=font(23),fill='#40584d');d.text((18,42),'每格含放大示意、实际24px图形与保留文字；原6图标保持',font=font(12),fill='#5b756c')
for i,(key,label)in enumerate(labels.items()):
 for size in [24,96]:subprocess.run([binary,str(out/(key+'.svg')),str(out/f'{key}-{size}.png'),str(size)],check=True)
 x=(i%6)*cw;y=64+(i//6)*cellH;d.rounded_rectangle((x+5,y+4,x+cw-5,y+cellH-4),radius=18,fill='#fffaf2');large=Image.open(out/f'{key}-96.png');board.paste(large,(x+12,y+18),large)
 small=Image.open(out/f'{key}-24.png');d.rounded_rectangle((x+120,y+30,x+148,y+58),radius=9,fill='#fffaf2');board.paste(small,(x+122,y+32),small);d.text((x+116,y+68),label,font=font(13),fill='#5b4632');d.text((x+14,y+131),key,font=font(12),fill='#71614f')
board.save(root.parent/'evidence/icons/page-action-board.png');print(len(labels),'icons rendered')
