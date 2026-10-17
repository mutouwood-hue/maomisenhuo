const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('artifacts/html-offline-candidate/ui027/source'),old=path.resolve('artifacts/html-offline-candidate/ui026/source');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('reverse exactly declared demo transforms returns ALL eight actual026 script bytes',()=>{
 const patches=JSON.parse(read('android/app/src/main/assets/build-manifest.json')).demoPatches;const hits=new Map(patches.map(p=>[p.name,0]));
 for(let i=1;i<=8;i++){const file=`android/app/src/main/assets/game-${String(i).padStart(2,'0')}.js`;let text=read(file);
  for(const p of [...patches].reverse())if(text.includes(p.after)){assert.equal(text.split(p.after).length-1,1);text=text.replace(p.after,p.before);hits.set(p.name,hits.get(p.name)+1);}
  const hook='hostEnterDemoWorld:()=>Dr?.hostDemoEnter(),';if(text.includes(hook)){assert.equal(text.split(hook).length-1,1);text=text.replace(hook,'');}
  assert.equal(text,fs.readFileSync(path.join(old,file),'utf8'),file);
 }
 for(const [name,count]of hits)assert.equal(count,1,name);
});
test('actual demo entry graph loads memory provider first and no actual authority/transport scripts',()=>{
 const html=read('android/app/src/main/assets/world-demo.html');const scripts=[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m=>m[1]);assert.equal(scripts[0],'world-demo-prelude.js');
 assert(!scripts.some(s=>/adapter|transport|device-events|offline-host|offline-prelude|durable|scene-sync/.test(s)));
 const act=read('android/app/src/main/java/com/catforest/htmlcandidate/WorldDemoActivity.java');assert(!/addJavascriptInterface|createWebMessageChannel|postWebMessage|addWebMessageListener|LocalBleBridge|startActivity|requestPermissions/.test(act));
 assert(act.includes('setDomStorageEnabled(false)'));assert(act.includes('setAllowFileAccess(false)'));assert(act.includes('setAllowContentAccess(false)'));assert(act.includes('worlddemo.catforest.invalid'));
});
test('actual prelude shadows hostile persistent getters, zero reads, new window resets, all completion inputs fail closed',()=>{
 const vm=require('node:vm');function make(){let reads=0;const w={location:{protocol:'https:'},navigator:{}};for(const key of ['localStorage','sessionStorage'])Object.defineProperty(w,key,{configurable:true,get(){reads++;throw Error('persistent access');}});vm.runInNewContext(read('web/world-demo-prelude.js'),{window:w});return{w,reads:()=>reads};}
 const a=make();assert.equal(a.reads(),0);a.w.localStorage.setItem('formal-looking','secret');for(const e of [null,{}, {source:'native_device',kind:'peer_complete',peerComplete:true}, {source:'npc'}, {kind:'gift'}])assert.throws(()=>a.w.CatWorldProductionPort.consume(e),/UNAVAILABLE/);
 assert.equal(make().w.localStorage.getItem('formal-looking'),null);assert.equal(a.w.CatWorldProductionPort.available,false);assert.equal(a.w.CatWorldProductionPort.acknowledge,undefined);assert.equal(a.reads(),0);
});
