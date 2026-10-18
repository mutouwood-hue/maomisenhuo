"""Local SVG raster/size review, not a browser/WebView or Android screenshot."""
from pathlib import Path
import subprocess,json,hashlib,numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageOps
root=Path(__file__).resolve().parents[1];base=root.parent/'evidence/icons';base.mkdir(exist_ok=True)
keys=['meet','dex','life','world','wardrobe','family'];labels=['遇见：两只猫','图鉴：猫爪收藏册','生活：时钟与太阳','出门：背包','衣柜：衣架与衣服','家庭：小屋与猫爪'];fontpath='/System/Library/Fonts/Hiragino Sans GB.ttc';font=lambda n:ImageFont.truetype(fontpath,n)
subprocess.run(['node',str(root/'scripts/export_icons.cjs')],check=True)
subprocess.run(['swiftc',str(root/'scripts/render_ui_vectors.swift'),'-o','/tmp/cat-ui-svg-raster'],check=True)
board=Image.new('RGB',(1080,820),'#eef4ef');d=ImageDraw.Draw(board);d.text((28,22),'017 软件 SVG 样稿 / 非 Android 截图',font=font(25),fill='#385448');d.text((28,65),'原文字保留 · 轻微立体 · 实际 26px 图形槽 · 下排 24 / 26 / 32 / 48px 原尺寸',font=font(17),fill='#566b5d')
metrics=[]
for i,key in enumerate(keys):
 x=24+i%3*356;y=112+i//3*342
 d.rounded_rectangle((x,y,x+332,y+318),radius=20,fill='#fffaf2',outline='#d7e1d3');d.text((x+16,y+12),labels[i],font=font(17),fill='#415c4d')
 for n in [24,26,32,48,96]:subprocess.run(['/tmp/cat-ui-svg-raster',str(base/(key+'.svg')),str(base/f'{key}-{n}.png'),str(n)],check=True)
 icon=Image.open(base/f'{key}-96.png');board.paste(icon,(x+20,y+65),icon)
 for disabled,dx in [(False,160),(True,238)]:
  bx=x+dx;by=y+64;d.rounded_rectangle((bx,by,bx+50,by+52),radius=16,fill='#fffdf8',outline='white')
  glyph=Image.open(base/f'{key}-26.png')
  if disabled:
   alpha=glyph.getchannel('A').point(lambda v:int(v*.5));glyph=ImageOps.grayscale(glyph).convert('RGBA');glyph.putalpha(alpha)
  board.paste(glyph,(bx+12,by+4),glyph);label=labels[i].split('：')[0];d.text((bx+25-d.textlength(label,font=font(9))/2,by+33),label,font=font(9),fill='#66786b' if disabled else '#5a7063');d.text((bx-3,by+64),'禁用' if disabled else '默认',font=font(12),fill='#66786b')
 xx=x+20
 for n in [24,26,32,48]:
  g=Image.open(base/f'{key}-{n}.png');board.paste(g,(xx,y+224-n//2),g);d.text((xx,y+258),str(n)+'px',font=font(12),fill='#566b5d');xx+=70
 a=np.array(Image.open(base/f'{key}-26.png'))[:,:,3];ys,xs=np.where(a>100);metrics.append({'key':key,'actualSizePx':26,'solidBounds':[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)],'solidWidth':int(xs.max()-xs.min()+1),'solidHeight':int(ys.max()-ys.min()+1)})
board.save(base/'icon-board.png')
def lum(c):
 a=[int(c[k:k+2],16)/255 for k in [1,3,5]];a=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in a];return sum(v*k for v,k in zip(a,[.2126,.7152,.0722]))
def contrast(a,b):x,y=sorted([lum(a),lum(b)]);return (y+.05)/(x+.05)
report={'iconSourceSha256':hashlib.sha256((root/'web/offline-nav-icons.js').read_bytes()).hexdigest(),'kind':'AppKit rasterized local SVG software; no browser/device','sizesPx':[24,26,32,48],'labelsRetained':True,'metrics':metrics,'contrast':{'normalLabel':contrast('#5a7063','#fffdf8'),'disabledLabel':contrast('#66786b','#fffdf8'),'essentialOutline':contrast('#5b756c','#fffdf8')},'note':'colored fills decorative; dark outlines carry shape. Disabled sample retains full-opacity text, desaturates only icon.'}
(root/'tests/icon-size-reference.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(base/'small-size-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
