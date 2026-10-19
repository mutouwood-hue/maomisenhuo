#!/usr/bin/env python3
"""Reuse the original courtyard stylesheet and original v5 event-effects body."""
from pathlib import Path
import re
r=Path(__file__).resolve().parents[1];s=(r/'original/game.html').read_text()
a=s.index('let F=document.createElement("div");F.className="pet-world-ui"');a=s.index('<style>',a)+7;b=s.index('</style>',a)
(r/'web/town-courtyard-components.css').write_text('/* Verbatim original Mf courtyard UI rules. */\n'+s[a:b])
sheetStart=s.index('  #m-sheet{display:flex;');sheetEnd=s.index('  .world-entry-status',sheetStart)
sheetCss=s[sheetStart:sheetEnd].replace('#m-sheet-body','#town-trip-sheet-body').replace('#m-sheet','#town-trip-sheet')
(r/'web/town-courtyard-sheet.css').write_text('/* Original mobile courtyard sheet rules, instance ID aliases only. */\n'+sheetCss)
a=s.index('/* 20-world.js */');b=s.index('/* 30-life-data.js */',a);fx=s[a:b]
fx=fx[fx.index('(()=>{')+6:fx.rfind('})();')]
def replace(old,new):
 global fx
 assert fx.count(old)==1,old[:100]
 fx=fx.replace(old,new,1)
replace('const Wd=()=>window.__pgWorld;','const Wd=()=>view;')
replace("const scene=document.getElementById('world-scene');",'const scene=parent;')
replace('const ev={type:null,t0:0,choice:null,tc:0,props:[],saved:null,bfFrom:null};','const ev={type:null,t0:0,choice:null,tc:0,props:[],saved:null,bfFrom:null};let captionText="";')
replace("cv.id='pg-wfx'","cv.className='town-world-fx'")
replace("emo.id='pg-wemo'","emo.className='town-world-emo'")
replace('function now(){return performance.now()/1000}','let clock=0;function now(){return clock}')
replace('window.__pgWorldEvt=type=>{','const start=type=>{')
a=fx.index("scene.addEventListener('click',e=>");b=fx.index('/* 蝴蝶：',a)
fx=fx[:a]+"""const choose=choice=>{if(!ev.type)return;ev.choice=choice;ev.tc=now();emo.textContent={butterfly:{care:'💗',safe:'🍃',coins:'💨'},'lost-pouch':{care:'💗',safe:'👀',coins:'✨'},rain:{safe:'🌳',care:'🧣',coins:'💦'}}[ev.type]?.[choice]||'💗';};
"""+fx[b:]
replace('window.__pgBf=','const moveButterfly=')
replace('window.__pgWorldPose=','const pose=')
replace('function frame(){\n  requestAnimationFrame(frame);','function frame(dt){\n  clock+=Math.min(.05,Math.max(0,dt));')
line="  if(!ev.choice&&ev.manual!==true&&w.ev.hidden&&now()-ev.t0>1.5){ev.choice='safe';ev.tc=now();setTimeout(()=>{if(ev.tc&&now()-ev.tc>=4.4)cleanup()},4600)}\n"
replace(line,'')
replace('requestAnimationFrame(frame);\nL.worldFx={state:()=>({type:ev.type,choice:ev.choice,props:ev.props.length})};',"return{start,choose,pose,moveButterfly,frame,cleanup,caption(text){captionText=typeof text==='string'?text:'';if(!ev.type){emo.textContent=captionText;emo.hidden=!captionText;}},dispose(){cleanup();cv.remove();emo.remove()},get active(){return !!ev.type},get type(){return ev.type}};")
# Same event presentation at the town's smaller world-unit scale; no rule changes.
for old,new in [ ('grp.scale.setScalar(2.1)','grp.scale.setScalar(.42)'),('addScaledVector(f,5.5).addScaledVector(side,3)','addScaledVector(f,1.4).addScaledVector(side,1)'),('ev.flower.position.y=0','ev.flower.position.y=c.y'),('addScaledVector(f,5).addScaledVector(side,-4.5)','addScaledVector(f,1.8).addScaledVector(side,-1.1)'),('ev.pouch.position.y=0','ev.pouch.position.y=c.y'),('top.y=4.4','top.y+=.9'),('head.y=5.5','head.y+=1.6'),('const a=C*2.2,r=2.6','const a=C*2.2,r=.8'),('k*Math.PI)*3','k*Math.PI)*.7'),('Math.abs(Math.sin(t*2))*.25','Math.abs(Math.sin(t*2))*.12'),('V3(C*7,C*C*2.5+C*2,-C*5)','V3(C*2,C*C*.7+C*.6,-C*1.5)'),('V3(C*2,C*2.2,C*1.2)','V3(C*.7,C*.8,C*.4)'),('head.y+=12','head.y+=2.4'),('ev.pouch.position.clone();pp.y=3.2','ev.pouch.position.clone();pp.y+=.9'),('ev.pouch.position.y=ev.choice?0:Math.abs(Math.sin(T*2.4))*.18','ev.pouch.position.y=w.cat.position.y+(ev.choice?0:Math.abs(Math.sin(T*2.4))*.12)'),('Math.max(.001,1-k)','Math.max(.001,.42*(1-k))'),('ev.flower.position.clone();fp.y=4.2','ev.flower.position.clone();fp.y+=.9'),("emo.className='pop'","emo.classList.add('pop')")]:
 fx=fx.replace(old,new)
# Original event moments are written only by original activity lifecycle, not presentation.
fx=re.sub(r"  L\.moment\?\.\(\{type:'world'.*?\);\n",'',fx)
# Original town uses a sky dome and has no scene.background Color. Its fog is the color carrier.
fx=fx.replace('w.scene.background.clone()','(w.scene.background||w.scene.fog.color).clone()').replace('w.scene.background.copy','(w.scene.background||w.scene.fog.color).copy').replace('||w.scene.background).clone()','||w.scene.background||w.scene.fog.color).clone()')
fx=fx.replace('w.scene.fog?.color.copy(w.scene.background)','w.scene.fog?.color.copy(w.scene.background||w.scene.fog.color)')
fx=fx.replace('if(cv.width!==Math.round(r.width*dpr))','if(cv.width!==Math.round(r.width*dpr)||cv.height!==Math.round(r.height*dpr))')
replace('ev.saved=null;ev.type=null;ev.choice=null;emo.hidden=true;drops.length=0;','ev.saved=null;ev.type=null;ev.choice=null;captionText="";emo.hidden=true;drops.length=0;')
replace('const w=Wd();if(!w||!ev.type)return;\n  if(w.canvas.hidden){cleanup();return}\n  const r=w.canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);','const w=Wd();if(!w)return;\n  if(w.canvas.hidden){cleanup();return}\n  const r=w.canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);\n  if(!ev.type){if(!captionText){emo.hidden=true;return}const head=w.cat.position.clone();head.y+=2.4;const hp=w.proj(head);emo.textContent=captionText;emo.style.left=(hp.x*r.width)+\'px\';emo.style.top=(hp.y*r.height)+\'px\';emo.hidden=false;return}')
fx=fx.replace("    while(drops.length<140*k)","    g.fillStyle='rgba(70,91,108,'+(.11*k)+')';g.fillRect(0,0,r.width,r.height);\n    while(drops.length<140*k)")
(r/'web/town-event-fx.js').write_text('/* Original v5 courtyard rain/props/poses adapted to the existing town scene; no own RAF or rewards. */\nwindow.CatTownEventFx={create({view,parent}){\n'+fx+'\n}};\n')
