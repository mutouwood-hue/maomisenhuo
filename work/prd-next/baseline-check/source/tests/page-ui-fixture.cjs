/* Original page templates/functions with explicit memory data and inert sensors.
   No phone save, BLE, permissions, reward/meet completion or real friends. */
const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(root+'/'+f,'utf8');
function fixture(){
 const dom=new JSDOM(read('android/app/src/main/assets/index.html'),{url:'https://appassets.androidplatform.net/offline/index.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document,frames=[],calls=[];
 w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.setTimeout=w.setInterval=()=>1;w.clearTimeout=w.clearInterval=()=>{};w.BroadcastChannel=undefined;w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};w.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 const canvas=new Proxy({measureText:s=>({width:s.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});w.HTMLCanvasElement.prototype.getContext=()=>canvas;w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="78" height="78"><rect x="1" y="1" width="76" height="76" rx="8" fill="#eee8dc"/><text x="39" y="43" text-anchor="middle" font-size="13" fill="#62533f">夹具</text></svg>').toString('base64');
 const pet={id:'fixture-cat',name:'小橘',breed:'orange',stage:'kitten',sex:'male',cats:[],graduates:[],inventory:{fish:2,flower:1},stats:{health:100,food:61,mood:60,clean:90,energy:80},wardrobe:[],counts:{},world:{completed:{}},family:{},catalog:{breeds:[{id:'orange',name:'橘白田园猫'},{id:'siamese',name:'暹罗猫'}],outfits:[]}};
 const saved=new Map(),load=(k,fallback)=>saved.has(k)?structuredClone(saved.get(k)):structuredClone(fallback),save=(k,v)=>{saved.set(k,structuredClone(v));calls.push(k);};
 saved.set('pg-air-echo',[{id:'fixture-echo',owner:'npc-fixture',pet:'麻薯',breed:'ragdoll',outfit:'none',place:'home',msg:'今天也要开心喵',at:Date.now()-60000}]);
 w.__petGame={state:()=>({ready:true,pet,busy:false}),store:{},setRoomActive(){},hostSuspend(){},hostResume(){}};
 w.__pgLife={cfg:{minor:false,motion:false,env:false,geo:false,scene:false},store:{load,save},dayKey:()=> 'fixture-day',day:()=>new Date(),nowMin:()=>600,segAt:()=>({place:'home'}),place:()=>({id:'home',name:'家'}),on(){},emit(){},toast(){},places:[],regions:[],geoStop(){}};
 w.CatOfflineMeetKey=require('../web/offline-meet-key.js');w.CatOfflineIcons=require('../web/offline-nav-icons.js');
 w.eval(read('android/app/src/main/assets/game-08.js'));
 w.eval(read('web/offline-host.js'));w.eval(read('web/offline-layout.js'));w.CatOfflineIcons.install(d);
 const pg=read('android/app/src/main/assets/game-06.js').match(/think\.innerHTML=('.*?');/)[1],think=d.createElement('div');think.id='pg-think';think.innerHTML=Function('return '+pg)();think.querySelector('.pg-txt b').textContent='洗香香 · 0%';think.querySelector('.pg-txt span').textContent='前爪轻轻跨过盆沿，踩进水里';d.body.append(think);
 const source=read('android/app/src/main/assets/game-03.js'),start=source.indexOf('F.innerHTML=`<style>'),end=source.indexOf('`,i.append(F)',start);if(start<0||end<0)throw Error('world template anchor');const world=d.createElement('div');world.className='pet-world-ui';world.innerHTML=source.slice(start+'F.innerHTML=`'.length,end);d.body.append(world);
 const bagTemplate=source.match(/Ze\("world-bag"\)\.innerHTML=ei\.map\(ge=>`([^`]+)`\)\.join/)[1];d.getElementById('world-bag').innerHTML=Function('ge','O','py','z','return `'+bagTemplate+'`')({id:'flower',name:'野花',sellPrice:2},{inventory:{flower:2}},{flower:'❀'},false);
 const clinic=d.getElementById('clinic-panel');clinic.hidden=false;d.getElementById('clinic-condition').textContent='小橘今天很健康';d.getElementById('clinic-detail').textContent='健康100 / 100。也可以来做一次温柔的日常体检。';d.getElementById('visit-clinic').textContent='带小猫看医生 · 4 喵币';
 const mode=d.createElement('label');mode.className='offline-device-mode';mode.innerHTML='连接方式<select id="offline-device-mode"><option>现有固件 · 基础控制</option><option>新本地固件</option></select>';d.querySelector('.offline-device-body').insertBefore(mode,d.getElementById('offline-device-status'));
 const v2=d.createElement('section');v2.id='offline-v2-panel';const sync=read('web/offline-scene-sync.js'),template=sync.match(/panel\.innerHTML=('.*?');/)[1];v2.innerHTML=Function('return '+template)();d.querySelector('.offline-device-body').append(v2);
 const ui=require('../web/offline-page-icons.js');
 function open(tab='near'){w.__pgSocial.openHub(tab);ui.decorate(w);}
 const social=w.__pgSocial;social.peers.set('npc-pudding',{...social.NPCS[1],src:'npc',dist:2.5});
 function populate(){const D=social.D,n=Date.now();D.friends['fixture-friend']={fid:'fixture-friend',petName:'软件样例朋友',breed:'orange',stage:'kitten',sex:'female',src:'npc',firstAt:n-1000,lastAt:n,points:3,bond:0,cards:[]};D.gifts.inbox.push({id:'fixture-gift',from:'fixture-friend',fname:'软件样例朋友',at:n,open:false,g:{kind:'item',id:'flower',n:1,label:'野花'}});D.blocked['fixture-blocked']={name:'软件样例记录',at:n};}
 async function flush(){for(let i=0;i<6;i++){await new Promise(r=>setImmediate(r));for(const fn of frames.splice(0))fn();}}
 return{w,d,ui,pet,saved,calls,frames,open,populate,flush,close(){w.dispatchEvent(new w.Event('pagehide'));dom.window.close();}};
}
module.exports={root,read,fixture};
