const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{fixture,root}=require('./encounter-ui-fixture.cjs');
function input(){
 const h=fixture({keyInput:true}),w=h.w;let time=100,id=0;const tasks=new Map();
 w.Date.now=()=>time;w.setTimeout=(fn,delay)=>{tasks.set(++id,{fn,at:time+delay});return id;};w.clearTimeout=id=>tasks.delete(id);w.setInterval=(fn,delay)=>{tasks.set(++id,{fn,at:time+delay,delay});return id;};w.clearInterval=w.clearTimeout;
 const key=h.d.getElementById('sc-key');key.getBoundingClientRect=()=>({left:10,top:10,right:58,bottom:66});let capture=null;key.setPointerCapture=n=>capture=n;key.hasPointerCapture=n=>capture===n;key.releasePointerCapture=()=>capture=null;
 const fire=(type,props={})=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:30,clientY:30,...props});key.dispatchEvent(e);return e;};
 function advance(ms,run=true){time+=ms;if(run)for(let n=0;n<200;n++){const next=[...tasks].find(([,v])=>v.at<=time);if(!next)break;const[k,v]=next;tasks.delete(k);v.fn();if(v.delay&&h.w.__pgSocial.M)tasks.set(k,{...v,at:time+v.delay});}}
 h.open();return{...h,key,fire,advance,tasks,get capture(){return capture}};
}
test('real packaged original arm runs once after1000ms hold, release preserves armed and original15s expiry',()=>{
 const h=input();try{const down=h.fire('pointerdown');assert.equal(down.defaultPrevented,true);h.advance(999);assert.equal(h.w.__pgSocial.M.R.ph,'idle');h.advance(1);assert.equal(h.w.__pgSocial.M.R.ph,'armed');const until=h.w.__pgSocial.M.R.until;assert.equal(until-h.w.Date.now(),15000);h.fire('pointerup');assert.equal(h.key.classList.contains('down'),false);assert.equal(h.key.classList.contains('armed'),true);assert.equal(h.capture,null);h.advance(100);assert.equal(h.w.__pgSocial.M.R.until,until);assert.equal(h.w.__unexpectedTaps,undefined);h.w.__pgSocial.closeMeet();assert.equal(h.tasks.size,0);assert.equal(h.key.classList.contains('armed'),false);}finally{h.close();}
});
test('short release never arms and a timer-delayed valid release uses elapsed1000ms fallback once',()=>{
 const h=input();try{h.fire('pointerdown');h.advance(999);h.fire('pointerup');h.advance(20);assert.equal(h.w.__pgSocial.M.R.ph,'idle');assert.equal(h.tasks.size,0);h.fire('pointerdown');h.advance(1000,false);h.fire('pointerup');assert.equal(h.w.__pgSocial.M.R.ph,'armed');assert.equal(h.tasks.size,1,'only original15s interval remains');}finally{h.close();}
});
for(const type of ['pointercancel','pointerleave','lostpointercapture'])test(type+' before threshold cancels without release-fallback activation',()=>{
 const h=input();try{h.fire('pointerdown');h.advance(700);h.fire(type);h.advance(1000);h.fire('pointerup');assert.equal(h.w.__pgSocial.M.R.ph,'idle');assert.equal(h.tasks.size,0);assert.equal(h.key.classList.contains('down'),false);h.fire('pointerdown');h.advance(1000);assert.equal(h.w.__pgSocial.M.R.ph,'armed','next fresh press recovers');}finally{h.close();}
});
test('pointer captured slide outside cancels; secondary fingers and foreign pointerup cannot complete',()=>{
 const h=input();try{h.fire('pointerdown',{isPrimary:false,pointerId:2});assert.equal(h.tasks.size,0);h.fire('pointerdown');h.fire('pointerup',{pointerId:2});assert.equal(h.key.classList.contains('down'),true);h.advance(800);h.fire('pointermove',{clientX:100});h.advance(1200);h.fire('pointerup');assert.equal(h.w.__pgSocial.M.R.ph,'idle');assert.equal(h.tasks.size,0);}finally{h.close();}
});
test('closing or resetting original modal cancels pending hold synchronously; reopen has no stale state',()=>{
 const h=input();try{for(const action of ['closeMeet','resetGame']){h.fire('pointerdown');h.advance(800);h.w.__pgSocial[action]();assert.equal(h.tasks.size,0);assert.equal(h.key.classList.contains('down'),false);h.advance(500);if(action==='closeMeet')h.open();assert.equal(h.w.__pgSocial.M.R.ph,'idle');}h.fire('pointerdown');h.advance(1000);assert.equal(h.w.__pgSocial.M.R.ph,'armed');h.d.querySelector('[data-mclose]').click();assert.equal(h.tasks.size,0);assert.equal(h.key.classList.contains('armed'),false);h.open();assert.equal(h.w.__pgSocial.M.R.ph,'idle');}finally{h.close();}
});
test('background, blur and pagehide cancel pending hold and cannot arm later',()=>{
 for(const kind of ['visibilitychange','blur','pagehide']){const h=input();try{h.fire('pointerdown');h.advance(800);if(kind==='visibilitychange'){Object.defineProperty(h.d,'hidden',{value:true,configurable:true});h.d.dispatchEvent(new h.w.Event(kind));}else h.w.dispatchEvent(new h.w.Event(kind));h.advance(500);assert.equal(h.w.__pgSocial.M.R.ph,'idle',kind);assert.equal(h.tasks.size,0,kind);assert.equal(h.key.classList.contains('down'),false);}finally{h.close();}}
});
test('selection/context menu suppression is key-scoped and CSS retains48px target',()=>{
 const h=input();try{for(const name of ['selectstart','contextmenu']){assert.equal(h.fire(name).defaultPrevented,true);const e=new h.w.Event(name,{bubbles:true,cancelable:true});h.d.getElementById('sc-hint').dispatchEvent(e);assert.equal(e.defaultPrevented,false);}const css=fs.readFileSync(root+'/web/offline-ui-polish.css','utf8');assert.match(css,/#sc-meet #sc-key[^}]*user-select:none[^}]*-webkit-user-select:none[^}]*touch-action:none/);assert.match(css,/\.sc-key[^}]*min-width:48px/);}finally{h.close();}
});
test('cancellation past1000ms with a delayed timer never uses successful-release fallback',()=>{
 for(const kind of ['pointercancel','pointerleave','lostpointercapture']){const h=input();try{h.fire('pointerdown');h.advance(1100,false);h.fire(kind);h.advance(1);assert.equal(h.w.__pgSocial.M.R.ph,'idle');assert.equal(h.tasks.size,0);}finally{h.close();}}
});
test('persisted pagehide cancels old hold but restored page accepts a fresh original hold',()=>{
 const h=input();try{h.fire('pointerdown');h.advance(800);const e=new h.w.Event('pagehide');Object.defineProperty(e,'persisted',{value:true});h.w.dispatchEvent(e);h.advance(500);assert.equal(h.w.__pgSocial.M.R.ph,'idle');h.fire('pointerdown');h.advance(1000);assert.equal(h.w.__pgSocial.M.R.ph,'armed');}finally{h.close();}
});
test('reversing only018 key hooks recreates frozen017 social script byte-for-byte, including all rules and awards',()=>{
 const original=fs.readFileSync(root+'/original/game.html','utf8');let js=fs.readFileSync(root+'/android/app/src/main/assets/game-08.js','utf8');const start=original.indexOf('let keyT=0,keyAt=0;'),end=original.indexOf("addEventListener('keydown'",start);
 js=js.replace('function closeMeet(){keyControl.cancel(true);','function closeMeet(){').replace('function resetGame(){keyControl.cancel(true);','function resetGame(){');const a=js.indexOf('const keyControl=window.CatOfflineMeetKey.bind('),b=js.indexOf("addEventListener('keydown'",a);assert.ok(a>0&&b>a);js=js.slice(0,a)+original.slice(start,end)+js.slice(b);assert.equal(require('node:crypto').createHash('sha256').update(js).digest('hex'),'b27cc4abf43825aa56957ba79707a2b2f1c54e7e687a4a8343e75773d536d83b');
 const html=fs.readFileSync(root+'/android/app/src/main/assets/index.html','utf8');assert.ok(html.indexOf('src="offline-meet-key.js"')<html.indexOf('data-offline-src="game-08.js"'),'input module precedes original social initialization');
});
