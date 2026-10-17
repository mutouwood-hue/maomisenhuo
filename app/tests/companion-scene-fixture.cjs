/* Actual original life-v5 data/UI closures + original pet store; inert canvas/sensors.
   All dates, storage, coordinator ports are isolated memory fixtures, never a phone. */
const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(root+'/'+f,'utf8');
function fixture({baseline=false,sync=true,demo=true,room=true,automaticWork=false}={}){
 const dom=new JSDOM(read('android/app/src/main/assets/index.html'),{url:'https://appassets.androidplatform.net/offline/index.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 let now=new Date(2026,9,16,10,0,0).getTime(),hidden=false,nextTimer=1;
 const timers=new Map(),requests=[],effects=[];const NativeDate=w.Date;
 w.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 Object.defineProperty(d,'hidden',{get:()=>hidden});Object.defineProperty(d,'visibilityState',{get:()=>hidden?'hidden':'visible'});
 w.setTimeout=(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,ms,interval:false});return id;};w.setInterval=(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,ms,interval:true});return id;};w.clearTimeout=w.clearInterval=id=>timers.delete(id);w.requestAnimationFrame=()=>0;
 w.matchMedia=()=>({matches:false});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 const canvas=new Proxy({measureText:s=>({width:s.length*7})},{get:(o,k)=>k in o?o[k]:()=>{}});w.HTMLCanvasElement.prototype.getContext=()=>canvas;
 const deny=name=>(()=>{requests.push(name);throw Error('Unexpected sensor/network request '+name);});
 Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition:deny('geo'),watchPosition:deny('geoWatch'),clearWatch(){}}});w.fetch=deny('fetch');Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:deny('media')}});Object.defineProperty(w.navigator,'onLine',{value:false});
 w.localStorage.setItem('pg-life-cfg',JSON.stringify({sync,demo,geo:false,motion:false,voice:false,scene:false}));
 if(automaticWork){const day=new NativeDate(now);day.setHours(0,0,0,0);const data=[];for(let m=60;m<=95;m+=5)data.push({t:day.getTime()+m*60000,lat:31.22,lon:121.44,acc:30});for(let m=540;m<=600;m+=5)data.push({t:day.getTime()+m*60000,lat:31.23,lon:121.47,acc:30});w.localStorage.setItem('pg-life-geo',JSON.stringify(data));} // Explicit memory samples, no real location or sensor.
 const main=read('android/app/src/main/assets/game-03.js');w.eval(main.slice(0,main.indexOf('/**'))+';window.__companionFixtureCreateStore=vu;})();');
 const store=w.__companionFixtureCreateStore({storage:w.localStorage,now:()=>now});store.flush();
 const raw={ready:true,busy:false,life:{view:'home'},room:{currentAction:null},mini:{running:false}};
 w.__petGame={state:()=>({...raw,pet:store.getState()}),store,setRoomActive(){},hostSuspend(){effects.push('suspend');},hostResume(){effects.push('resume');}};
 w.__pgRoom=room?{act:null,cat:{visible:true}}:null;w.__pgSocial={closeMeet(){},drawPet(){}};
 if(!d.getElementById('m-dock')){const dock=d.createElement('div');dock.id='m-dock';dock.innerHTML='<button type="button" data-action="feed">喂食</button>';d.body.append(dock);}
 const source=baseline?read('../../ui024/source/android/app/src/main/assets/game-06.js'):read('android/app/src/main/assets/game-06.js');const start=source.indexOf('/* 30-life-data.js */');if(start<0)throw Error('original life-v5 module anchor');w.eval(source.slice(start));
 w.eval(read('web/offline-scene-map.js'));
 const projection=()=>w.CatOfflineSceneMap.project(w.__petGame.state(),w.__pgLife.hostWorldEvent?.(),w.__pgLife.hostCompanionState?.());
 const deviceId='0123456789abcdef0123456789abcdef',context={deviceId,hasSnapshot:false};
 const mapped=()=>w.CatOfflineSceneMap.read(context);
 const syncNow=()=>{const task=[...timers.values()].find(t=>t.interval&&t.ms===5000);if(!task)throw Error('original5000ms life sync missing');task.fn();};
 const storage=()=>Object.fromEntries(Object.keys(w.localStorage).sort().map(k=>[k,w.localStorage.getItem(k)]));
 return{w,d,raw,store,timers,requests,effects,syncNow,projection,mapped,storage,context,
  time:()=>now,advance(ms){now+=ms;},setHour(h){const date=new NativeDate(now);date.setHours(h,0,0,0);now=date.getTime();},
  hidden(v){hidden=v;d.dispatchEvent(new w.Event('visibilitychange'));},
  apply(){syncNow();return mapped();},callback(){d.querySelector('#pg-away [data-back]').click();},care(){d.querySelector('#m-dock button').click();},
  close(){dom.window.close();}};
}
module.exports={fixture,root,read};
