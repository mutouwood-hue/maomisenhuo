"""Software layout illustration from real NPC UI copy; never an app screenshot."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,math
base=Path(__file__).resolve().parents[2]/'evidence/encounter';data=json.loads((base/'original-npc-copy.json').read_text());font=lambda n:ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',round(n));fg='#5b4632'
def lines(text,n,width):
 f=font(n);out=[];line=''
 for ch in text:
  if ch=='\n' or ImageDraw.Draw(Image.new('RGB',(1,1))).textlength(line+ch,font=f)>width:
   out.append(line);line='' if ch=='\n' else ch
  else:line+=ch
 if line:out.append(line)
 return out
reports=[]
for width,height,scale in [(360,640,1),(360,640,1.6),(390,844,1),(390,844,1.6)]:
 mw=width-24;inner=mw-28;header=math.ceil(66*max(1,scale*.85));top=42;bottom=height-28;vh=bottom-top-header-28
 body=Image.new('RGB',(inner,1800),'#fffaf2');b=ImageDraw.Draw(body);y=6
 tabs=data['tabs'];xx=0
 for text in tabs:
  tw=math.ceil(b.textlength(text,font=font(13*scale)))+22
  if xx+tw>inner:xx=0;y+=48
  b.rounded_rectangle((xx,y,xx+tw-4,y+44),radius=15,fill='#eee4d4');b.text((xx+10,y+10),text,font=font(13*scale),fill=fg);xx+=tw
 y+=56;cx=inner//2-7;cy=y+130;b.ellipse((cx-130,cy-130,cx+130,cy+130),fill='#e5d4b8');b.ellipse((cx-120,cy-120,cx+120,cy+120),fill='#282438');b.text((cx-65,cy-13),'原像素猫占位',font=font(15),fill='#fff4e0');b.text((cx-68,cy+15),'未替换原头像',font=font(13),fill='#d9cee5');b.rounded_rectangle((cx+100,cy-28,cx+148,cy+28),radius=10,fill='#d9c2a2');b.text((cx+114,cy-10),'键',font=font(14),fill=fg);y+=272
 for line in lines(data['hint'],13*scale,inner-10):b.text((4,y),line,font=font(13*scale),fill=fg);y+=math.ceil(21.45*scale)
 y+=10;bh=max(48,math.ceil(20*scale+24));b.rounded_rectangle((0,y,inner-1,y+bh),radius=14,fill='#f0e5d4');text=data['action'];b.text(((inner-b.textlength(text,font=font(13*scale)))/2,y+(bh-16*scale)/2),text,font=font(13*scale),fill=fg);y+=bh+10
 for line in lines(data['help'],13*scale,inner-8):b.text((4,y),line,font=font(13*scale),fill='#71614f');y+=math.ceil(21.45*scale)
 y+=12;contentHeight=y;body=body.crop((0,0,inner,contentHeight));overflow=max(0,contentHeight-vh)
 for pos,offset in [('top',0),('bottom',overflow)]:
  im=Image.new('RGB',(width,height),'#b6cac5');d=ImageDraw.Draw(im);d.text((8,8),f'017 软件示意 / NPC / {width}x{height} / {scale:g}x',font=font(11),fill='#334a3e');d.rounded_rectangle((12,top,width-12,bottom),radius=24,fill='#fffaf2');d.text((28,top+12),data['title'],font=font(15*scale),fill=fg);d.rounded_rectangle((width-76,top+8,width-28,top+56),radius=20,fill='#f1e7d6');d.text((width-61,top+17),'×',font=font(20),fill=fg)
  sub='本地试玩 · 官方小猫';d.text((28,top+20+int(22*scale)),sub,font=font(11*scale),fill='#71614f');cropped=body.crop((0,offset,inner,min(contentHeight,offset+vh)));im.paste(cropped,(26,top+header));
  if overflow:d.rounded_rectangle((width-22,top+header+4+(vh-35)*offset/max(1,overflow),width-19,top+header+34+(vh-35)*offset/max(1,overflow)),radius=2,fill='#a3b6a5')
  d.text((16,height-20),'非WebView截图 · '+('内容下段（滑动后）' if offset else '内容上段'),font=font(10),fill='#334a3e');im.save(base/f'npc-{width}-{int(scale*100)}-{pos}.png')
 reports.append({'width':width,'height':height,'textScale':scale,'contentHeightSoftware':contentHeight,'scrollViewportSoftware':vh,'overflowSoftware':overflow,'notCssOrDeviceMeasured':True})
# Two normal-sized and two enlarged-text bottom illustrations, actual source copy.
board=Image.new('RGB',(1620,920),'#e4eee7');d=ImageDraw.Draw(board);d.text((18,14),'017 真实 NPC 文案的软件布局示意 / 非 Android 或 WebView 截图',font=font(22),fill='#385448')
for i,(w,h,s,pos)in enumerate([(360,640,100,'top'),(360,640,160,'bottom'),(390,844,100,'top'),(390,844,160,'bottom')]):
 im=Image.open(base/f'npc-{w}-{s}-{pos}.png');board.paste(im,(12+i*402,55))
board.save(base/'npc-layout-board.png');(base/'software-layout-report.json').write_text(json.dumps({'kind':'schematic software panel layout; no actual CSS/browser geometry claim','profiles':reports,'source':'original-npc-copy.json'},indent=2)+'\n')

board=Image.new('RGB',(730,320),'#e4eee7');d=ImageDraw.Draw(board);d.text((14,12),'017 NPC 提醒软件布局示意 / 非实屏',font=font(19),fill='#385448')
for i,scale in enumerate([1,1.6]):
 x=14+i*360;w=272;d.text((x,46),f'360px 屏 / 文字 {scale:g}x',font=font(12),fill='#385448');y=70
 d.rounded_rectangle((x,y,x+w,y+190),radius=16,fill='#fffdf8');d.rounded_rectangle((x+8,y+8,x+48,y+48),radius=20,fill='#d4e1d9');d.text((x+12,y+19),'原头像',font=font(10),fill='#526a5b')
 body=Image.new('RGB',(200,500),'#fffdf8');dd=ImageDraw.Draw(body);yy=0
 for value,n,color in [(data['banner']['title'],13,fg),(data['banner']['copy'],12,'#71614f'),(data['banner']['mode'],11,'#71614f')]:
  for line in lines(value,n*scale,196):dd.text((0,yy),line,font=font(n*scale),fill=color);yy+=round(n*scale*1.6)
 if yy>104:dd.line((198,10,198,94),fill='#a3b6a5',width=2)
 board.paste(body.crop((0,0,200,min(104,yy))),(x+56,y+8))
 colors=data['banner']['primaryColors'];rgb=lambda value:tuple(map(int,value.removeprefix('rgb(').removesuffix(')').split(',')))
 d.rounded_rectangle((x+56,y+128,x+208,y+176),radius=13,fill=rgb(colors['background']));d.text((x+98,y+141),'去遇见',font=font(13),fill=rgb(colors['text']));d.rounded_rectangle((x+216,y+128,x+264,y+176),radius=13,fill='#f2e8d7');d.text((x+232,y+138),'×',font=font(22),fill=fg)
 d.text((x,y+198),'长文独立滚动，操作行保持可达（待实屏确认）',font=font(10),fill='#526a5b')
board.save(base/'npc-banner-board.png')
