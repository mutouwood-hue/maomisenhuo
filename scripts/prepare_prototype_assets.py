#!/usr/bin/env python3
"""Reproduce the original 3D room as a view-only Android asset.

Keep source gameplay UI/bootstrap out of this renderer. Native Kotlin owns care,
durable state and BLE. No network dependencies or newly authored geometry.
"""
from pathlib import Path
import base64
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / '小橘电子宠物.html'
html = source.read_text()
scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script>', html, re.I)
bundle = next(s for s in scripts if 'async function bf(' in s)
marker = 'var Xe=i=>document.getElementById(i),Tf='
assert bundle.count(marker) == 1, 'Original UI entry point changed; review before extraction'
model_script = next(s for s in scripts if 'window.__CAT_PROJECT_BASE64__' in s)
out = ROOT / 'app/android/app/src/main/assets'
out.mkdir(parents=True, exist_ok=True)
from prepare_phone_feedback import instrument_feedback
prefix = instrument_feedback(bundle[:bundle.index(marker)], out)
bootstrap = r'''
let nativeRoom=null, pendingState=null, careGeneration=0,roomFeedback=null;
window.__catFeedbackPose=(context,time,dt)=>{roomFeedback?.frame(context,time,false);window.CatImmersion?.frame(context)};
function callNative(name,...values){try{window.CatNative?.[name]?.(...values)}catch(e){console.error(e)}}
window.CatRenderer={
  ready:false,
  applyState(value){
    pendingState=typeof value==='string'?JSON.parse(value):value;
    if(!nativeRoom||!pendingState)return;
    const s=pendingState;
    nativeRoom.setStage(s.stage||'kitten');
    nativeRoom.setAppearance({breed:s.breed||'orange',outfit:s.outfit||'none',stage:s.stage||'kitten'});
    roomFeedback?.applyState(s);
  },
  feedback(value){return roomFeedback?.feedback(value)||false},
  clearFeedback(){roomFeedback?.clearFeedback()},
  act(action){return nativeRoom?.perform(action).catch(console.error)},
  perform(action){return this.act(action)},
  startInteraction(action){
    roomFeedback?.clearFeedback();
    const generation=++careGeneration;
    if(!nativeRoom){callNative('careFinished',String(action),false,0);return false}
    nativeRoom.startInteraction(action).then(result=>{
      if(generation!==careGeneration)return;
      callNative('careFinished',String(action),Boolean(result.ok&&result.completed),Number(result.score)||0);
    }).catch(error=>{if(generation===careGeneration)callNative('careFinished',String(action),false,0);console.error(error)});
    return true;
  },
  cancelInteraction(){careGeneration++;nativeRoom?.cancelInteraction()},
  resetView(){return window.CatImmersion?.reset()||false},
  setObscured(value){window.CatImmersion?.suspend(value);if(value)roomFeedback?.pause();else roomFeedback?.resume();nativeRoom?.setActive(!value)},
  pause(){window.CatImmersion?.suspend(true);roomFeedback?.pause();nativeRoom?.setActive(false)},
  resume(){window.CatImmersion?.suspend(false);roomFeedback?.resume();nativeRoom?.setActive(true)},
  async sprite(width=200,height=180,pose='idle',time=0){
    const renderer=new Ni({alpha:true,antialias:true,preserveDrawingBuffer:true});
    renderer.setPixelRatio(1);renderer.setSize(width,height);renderer.setClearColor(0,0);
    renderer.outputColorSpace=Zt;renderer.toneMapping=Ki;renderer.toneMappingExposure=1.22;
    renderer.domElement.id='sprite-canvas';
    const sc=new fi,model=await Ss();sc.add(model.root);
    model.applyAnimation(pose,time);model.root.updateMatrixWorld(true);
    sc.add(new mi('#fff8e8','#829d93',2.6));
    const sun=new Zn('#fff0d3',3.1);sun.position.set(-15,37,-23);sc.add(sun);
    const fill=new Zn('#d8f2ef',1.15);fill.position.set(22,19,8);sc.add(fill);
    const bounds=new Xt().setFromObject(model.root),center=bounds.getCenter(new L),size=bounds.getSize(new L);
    const camera=new an(35,width/height,.1,500),distance=Math.max(size.x/(width/height),size.y,size.z)*2.25;
    camera.position.copy(center).add(new L(distance*.35,distance*.22,-distance*.95));camera.lookAt(center);
    renderer.render(sc,camera);document.getElementById('sprite-canvas')?.remove();document.body.append(renderer.domElement);
    window.__sprite={renderer,model,scene:sc,camera};return renderer.domElement.toDataURL('image/png');
  }
};
bf({container:document.getElementById('room'),onPet:()=>callNative('action','pet'),onAction:a=>callNative('action',a),onProgress:p=>callNative('progress',String(p.action||''),p.completed?'动作完成，正在保存进度…':String(p.message||''),Number(p.progress)||0)})
 .then(room=>{nativeRoom=room;roomFeedback=window.CatFeedback.create(document.getElementById('room'),'room');window.CatRenderer.ready=true;window.CatRenderer.applyState(pendingState);document.getElementById('error').hidden=true;document.body.dataset.ready='true';callNative('ready')})
 .catch(e=>{document.getElementById('error').textContent='小猫房间暂未打开：'+e.message;callNative('rendererError',String(e.message));console.error(e)});
})();
'''
(out/'renderer-core.js').write_text(prefix + bootstrap)
mini_bootstrap = r'''
let activeMini=false,wasReady=false;
function miniNative(name,...args){try{window.CatNative?.[name]?.(...args)}catch(e){console.error(e)}}
const nativeMini=_f({canvas:document.getElementById('mini'),onStatus:s=>{
  window.__miniState=s;miniNative('miniStatus',JSON.stringify(s));
  if(s.ready&&!wasReady){wasReady=true;document.body.dataset.ready='true';miniNative('miniReady')}
},onFinish:r=>{if(activeMini){activeMini=false;miniNative('miniFinished',Math.trunc(Number(r)||0))}}});
window.CatMini={
  start(){activeMini=true;const started=nativeMini.start();if(!started)activeMini=false;return started},
  stop(){activeMini=false;nativeMini.stop()},
  applyState(value){const s=typeof value==='string'?JSON.parse(value):value;nativeMini.setStage(s.stage||'kitten');nativeMini.setAppearance({breed:s.breed||'orange',outfit:s.outfit||'none'})},
  state(){return nativeMini.state()},
  get ready(){return Boolean(window.__miniState?.ready)}
};
})();
'''
(out/'minigame-core.js').write_text(bundle[:bundle.index(marker)] + mini_bootstrap)
(out/'cat-source.js').write_text(model_script)
(out/'immersive-room.js').write_bytes((ROOT/'scripts/immersive-room.js').read_bytes())
(out/'renderer.html').write_text('''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'"><title>小橘的小家</title><link rel="stylesheet" href="phone-feedback.css"><style>html,body,#room{margin:0;width:100%;height:100%;overflow:hidden;background:#f8efdf}canvas{display:block;width:100%;height:100%}#error{position:absolute;bottom:8px;left:12px;right:12px;color:#4d6651;font:14px sans-serif;background:#fff4dc;padding:8px;border-radius:12px}#sprite-canvas{position:absolute;top:0;left:0;width:200px;height:180px}</style></head><body><div id="room"></div><div id="error" role="status">正在打开小橘的小家…</div><script src="cat-source.js"></script><script src="phone-feedback.js"></script><script src="immersive-room.js"></script><script src="renderer-core.js"></script></body></html>''')
(out/'minigame.html').write_text('''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'"><title>小猫接鱼</title><style>html,body,canvas{margin:0;width:100%;height:100%;overflow:hidden;background:#c3e4e4}canvas{display:block;touch-action:none}</style></head><body><canvas id="mini"></canvas><script src="cat-source.js"></script><script src="minigame-core.js"></script></body></html>''')
from prepare_life_assets import write_life_assets
write_life_assets(prefix, out)
manifest={'source':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'purpose':'Original Three.js room, minigame, outdoor and clinic views; native app owns durable state and transactions','outputs':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.iterdir()) if p.is_file() and p.name!='provenance.json'}}
(out/'provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
