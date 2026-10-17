"""Native bridges around the original Mf outdoors and Sf clinic renderers."""
from pathlib import Path


def write_life_assets(prefix: str, output: Path):
    world = r'''
let nativeWorld=null,worldProfile={},worldRequest=0,worldFeedback=null,encounterTimer=null,encounterGeneration=0;
const worldPending=new Map();
window.__pgWorldPose=(model,cat,time,walking)=>worldFeedback?.frame(window.__pgWorld,time,walking);
window.__pgWorldEvt=event=>{
 const token=nativeWorld?.state()?.token;
 if(token){
  const generation=++encounterGeneration, panel=window.__pgWorld?.ev;
  if(panel)panel.hidden=true;
  window.__catEncounterPending=true;
  worldEvent({type:'world-encounter',token,event}).then(result=>{
   if(generation!==encounterGeneration)return;
   encounterTimer=setTimeout(()=>{if(generation===encounterGeneration){window.__catEncounterPending=false;if(panel)panel.hidden=false}},result.ok===false?0:2200);
  });
 }
};
window.__catPrepareWorldChoice=async()=>{
 window.__catWipePending=true;
 const token=nativeWorld?.state()?.token;
 if(!token)return false;
 const ready=await worldEvent({type:'world-wipe-start',token});
 if(ready.ok===false)return false;
 return await worldFeedback?.beginWipe()||false;
};
function worldNative(name,...args){try{window.CatNative?.[name]?.(...args)}catch(error){console.error(error)}}
function worldEvent(event){return new Promise(resolve=>{
 const id=String(++worldRequest);
 worldPending.set(id,{resolve});worldNative('worldEvent',id,JSON.stringify(event));
})}
window.CatWorld={
 ready:false,
 applyState(value){worldProfile=typeof value==='string'?JSON.parse(value):value;worldFeedback?.applyState(worldProfile);if(nativeWorld){nativeWorld.setAppearance(worldProfile);nativeWorld.setStage(worldProfile.stage||'kitten')}},
 feedback(value){return worldFeedback?.feedback(value)||false},
 clearFeedback(){worldFeedback?.clearFeedback()},
 enter(location,value){if(!nativeWorld)return false;const data=typeof value==='string'?JSON.parse(value):value;nativeWorld.enter(String(location),data);nativeWorld.setActive(true);return true},
 resolve(id,value){const request=worldPending.get(String(id));if(!request)return false;worldPending.delete(String(id));request.resolve(typeof value==='string'?JSON.parse(value):value);return true},
 requestSettle(){return nativeWorld?.requestSettle()},
 state(){return nativeWorld?.state()},
 stop(){encounterGeneration++;clearTimeout(encounterTimer);worldFeedback?.pause();window.__catEncounterPending=false;window.__catWipePending=false;nativeWorld?.setActive(false);for(const request of worldPending.values()){request.resolve({ok:false,message:'活动已取消，没有结算。'})}worldPending.clear()}
};
Mf({container:document.getElementById('world'),profile:worldProfile,onEvent:worldEvent,onProgress:status=>worldNative('worldProgress',JSON.stringify(status))})
 .then(world=>{nativeWorld=world;worldFeedback=window.CatFeedback.create(document.getElementById('world'),'world');window.CatWorld.ready=true;window.CatWorld.applyState(worldProfile);document.getElementById('error').hidden=true;document.body.dataset.ready='true';worldNative('worldReady')})
 .catch(error=>{document.getElementById('error').textContent='户外场景暂未打开：'+error.message;worldNative('rendererError',String(error.message));console.error(error)});
})();
'''
    clinic = r'''
let nativeClinic=null,clinicGeneration=0;
function clinicNative(name,...args){try{window.CatNative?.[name]?.(...args)}catch(error){console.error(error)}}
window.CatClinic={
 ready:false,
 async open(value){
  const profile=typeof value==='string'?JSON.parse(value):value;
  const generation=++clinicGeneration;nativeClinic?.dispose();nativeClinic=null;this.ready=false;
  try{
   const clinic=await Sf({container:document.getElementById('clinic'),profile,onProgress:status=>{if(generation===clinicGeneration)clinicNative('clinicProgress',JSON.stringify(status))}});
   if(generation!==clinicGeneration){clinic.dispose();return false}
   nativeClinic=clinic;this.ready=true;document.getElementById('error').hidden=true;document.body.dataset.ready='true';clinicNative('clinicReady');return true;
  }catch(error){if(generation===clinicGeneration){document.getElementById('error').textContent='诊所暂未打开：'+error.message;clinicNative('rendererError',String(error.message))}return false}
 },
 setTool(value){return Number.isInteger(value)&&value>=0&&value<=2?nativeClinic?.setTool(value):false},
 state(){return nativeClinic?.state()},
 stop(){clinicGeneration++;this.ready=false;nativeClinic?.dispose();nativeClinic=null}
};
})();
'''
    for name, source in [('world', world), ('clinic', clinic)]:
        (output / f'{name}-core.js').write_text(prefix + source)
        title = '小猫出游' if name == 'world' else '小猫诊所'
        (output / f'{name}.html').write_text(f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'"><title>{title}</title><link rel="stylesheet" href="phone-feedback.css"><style>html,body,#{name}{{margin:0;width:100%;height:100%;overflow:hidden;background:#d9e7df;font-family:system-ui,sans-serif}}#{name}{{position:relative}}canvas{{display:block;width:100%;height:100%;touch-action:none}}#error{{position:absolute;left:12px;right:12px;bottom:12px;padding:8px;border-radius:10px;background:#fff8e7;color:#415b50;font-size:13px;pointer-events:none}}[hidden]{{display:none!important}}</style></head><body><div id="{name}"></div><div id="error" role="status">正在准备{title}…</div><script src="cat-source.js"></script><script src="phone-feedback.js"></script><script src="{name}-core.js"></script></body></html>''')
