'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../artifacts/html-offline-candidate/ui018/source');
const {fixture}=require(root+'/tests/encounter-ui-fixture.cjs');
function input(){
 const h=fixture({keyInput:true}),w=h.w;let now=10,id=0;const timers=new Map();w.Date.now=()=>now;w.setTimeout=(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;};w.clearTimeout=n=>timers.delete(n);w.setInterval=w.setTimeout;w.clearInterval=w.clearTimeout;
 const key=h.d.getElementById('sc-key');key.getBoundingClientRect=()=>({left:10,top:10,right:58,bottom:66});let capture=null;key.setPointerCapture=n=>capture=n;key.hasPointerCapture=n=>capture===n;key.releasePointerCapture=()=>capture=null;
 const fire=(type,extra={})=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:30,clientY:30,...extra});key.dispatchEvent(e);return e;};
 const advance=(ms,run=true)=>{now+=ms;if(run)for(const [n,t]of [...timers])if(t.at<=now){timers.delete(n);t.fn();}};
 h.open();return {...h,key,fire,advance,timers};
}
test('head module is definition-only while Native recovery is delayed',()=>{
 let reads=0,timers=0;const context={setTimeout(){timers++;},clearTimeout(){},addEventListener(){throw Error('must not bind before recovered game');}};
 Object.defineProperty(context,'document',{get(){reads++;throw Error('must not read game DOM during Native wait');}});
 vm.runInNewContext(fs.readFileSync(root+'/web/offline-meet-key.js','utf8'),context);
 assert.equal(typeof context.CatOfflineMeetKey.bind,'function');assert.equal(reads,0);assert.equal(timers,0);
});
test('actual Host suspend closes original modal and cancels a delayed key hold without later arming',()=>{
 const h=input();try{
  h.w.eval(fs.readFileSync(root+'/web/offline-host.js','utf8'));
  h.fire('pointerdown');h.advance(1100,false);assert.equal(h.w.__pgSocial.M.R.ph,'idle');
  h.w.CatOfflineHost.suspend();assert.equal(h.w.__pgSocial.M,null);assert.equal(h.key.classList.contains('down'),false);assert.equal(h.key.classList.contains('armed'),false);
  h.advance(2000);assert.equal(h.w.__pgSocial.M,null);assert.equal(h.timers.size,0);
  h.w.CatOfflineHost.resume();h.open();h.fire('pointerdown');h.advance(1000);assert.equal(h.w.__pgSocial.M.R.ph,'armed');
 }finally{h.close();}
});
test('timer-delayed outside release and cancelled pointer never invoke original arm; fresh release can',()=>{
 for(const type of ['pointerup','pointercancel','lostpointercapture']){
  const h=input();try{
   h.fire('pointerdown');h.advance(1100,false);h.fire(type,{clientX:90});h.advance(1000);
   assert.equal(h.w.__pgSocial.M.R.ph,'idle');assert.equal(h.timers.size,0);assert.equal(h.key.classList.contains('down'),false);
   h.fire('pointerdown');h.advance(1000,false);h.fire('pointerup');assert.equal(h.w.__pgSocial.M.R.ph,'armed');
  }finally{h.close();}
 }
});
