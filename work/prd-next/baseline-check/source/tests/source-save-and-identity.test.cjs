const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createCoordinator}=require('../web/offline-scene-sync.js');
const root=path.resolve(__dirname,'..'),DEVICE='0123456789abcdef0123456789abcdef';
const source=fs.readFileSync(root+'/original/game.html','utf8');
const main=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('function vu('));
const engine={};vm.runInNewContext(main.slice(0,main.indexOf('/**'))+';globalThis.createStore=vu;})();',engine);
function memory(){const values=new Map();let failure=false,readFailure=false;return {values,getItem(k){if(readFailure)throw Error('read');return values.get(k)??null;},setItem(k,v){if(failure)throw Error('full');values.set(k,v);},fail(v){failure=v;},failRead(v){readFailure=v;}};}
function mapper(storage,store){let uid=0;const w={localStorage:storage,crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++uid).padStart(12,'0')}`},__pgLife:{hostCompanionState:()=>({schema:1,source:'life-v5-applied',out:false,mode:'demo'})},__petGame:{state:()=>({ready:true,pet:store.getState(),life:{view:'home'},room:{currentAction:null}})}};
 vm.runInNewContext(fs.readFileSync(root+'/web/offline-scene-map.js','utf8'),{window:w});return w.CatOfflineSceneMap;
}
function coordinator(map){const sent=[],queue=[];const state={stage:'ready_local',evidence:{source:'native',generation:2,serviceVerified:true,rxVerified:true,txVerified:true,subscribed:true},hello:{protocol:'CFLOCAL2',deviceId:DEVICE,maxLine:2048,capabilities:['scene','snapshot']},capabilities:{scene:'declared',snapshot:'declared'},device:{deviceId:DEVICE,hasSnapshot:false,storageError:false}};
 const c=createCoordinator({ports:{control:{getState:()=>state,subscribe(fn){fn();return()=>{};}},scenes:{getPending:()=>null,async pushScene(s){sent.push(s);return {status:'device_persisted',revision:sent.length};}}},read:context=>map.read(context),uuid:()=>String(sent.length+1),schedule:fn=>{queue.push(fn);return fn;},cancel(){}});
 c.setEnabled(true);c.authorize();return {c,sent,async flush(){for(let i=0;queue.length&&i<8;i++){queue.shift()();await new Promise(r=>setImmediate(r));}}};
}
test('actual original store write failure cannot send changed memory or retain synced status',async()=>{
 const storage=memory(),identity=memory();const s=engine.createStore({storage,now:()=>2000000000000});s.flush();
 const initial=[...storage.values.entries()],h=coordinator(mapper(identity,s));await h.flush();assert.equal(h.c.getStatus().stage,'synced');assert.equal(h.sent.length,1);
 storage.fail(true);assert.equal(s.act('pet').ok,true);assert.ok(s.getState().storageIssue);assert.equal(s.getState().stats.mood,81);
 h.c.signal();await h.flush();assert.equal(h.sent.length,1);assert.equal(h.c.getStatus().stage,'error');assert.match(h.c.getStatus().message,/手机原存档/);
 const loaded=engine.createStore({storage,now:()=>2000000000001});assert.equal(loaded.getState().stats.mood,72);assert.equal(loaded.getState().xp,0);assert.deepEqual([...storage.values.entries()],initial);h.c.dispose();
});
test('initial original-save corruption and read exceptions block snapshots without replacing the data',async()=>{
 for(const kind of ['corrupt','read']){const storage=memory();if(kind==='corrupt')storage.getItem=()=>'{bad';else storage.failRead(true);
  const s=engine.createStore({storage,now:()=>2000000000000});assert.ok(s.getState().storageIssue);const h=coordinator(mapper(memory(),s));await h.flush();assert.equal(h.sent.length,0);assert.equal(h.c.getStatus().stage,'error');h.c.dispose();
 }
});
test('identity persistence failure or corrupt identity journal blocks radio and preserves old bytes',async()=>{
 const game=memory(),s=engine.createStore({storage:game,now:()=>2000000000000});s.flush();
 for(const corrupt of [false,true]){const ids=memory();if(corrupt)ids.values.set('cat-cflocal2-source-identities-v1','{bad');else ids.fail(true);
  const h=coordinator(mapper(ids,s));await h.flush();assert.equal(h.sent.length,0);assert.equal(h.c.getStatus().stage,'error');if(corrupt)assert.equal(ids.getItem('cat-cflocal2-source-identities-v1'),'{bad');h.c.dispose();
 }
});
test('original reset reuses cat-1 but stable wire identity blocks new generation and allows restoring the same save',()=>{
 let now=2000000000000;const game=memory(),ids=memory(),s=engine.createStore({storage:game,now:()=>now});s.flush();const saved=s.exportSave(),map=mapper(ids,s),context={deviceId:DEVICE,hasSnapshot:false};
 const first=map.read(context).petId,registry=ids.getItem(map.IDENTITY_KEY);assert.notEqual(first,'cat-1');now+=1000;s.reset();assert.equal(s.getState().id,'cat-1');
 assert.throws(()=>map.read(context),/重开、导入或换猫/);assert.equal(ids.getItem(map.IDENTITY_KEY),registry);
 assert.equal(s.importSave(saved).ok,true);assert.equal(map.read(context).petId,first);
 const reopened=mapper(ids,s);assert.equal(reopened.read(context).petId,first,'same slot/reload and restored save keep identity');
});
test('different family import, active family cat change, and missing identity against existing device all fail closed',()=>{
 const game=memory(),ids=memory(),s=engine.createStore({storage:game,now:()=>2000000000000});s.flush();const saved=s.exportSave(),map=mapper(ids,s),context={deviceId:DEVICE,hasSnapshot:false};map.read(context);
 const other=JSON.parse(saved);other.createdAt+=1000;other.lastSavedAt+=1000;other.cats[0].joinedAt+=1000;assert.equal(s.importSave(JSON.stringify(other)).ok,true);assert.throws(()=>map.read(context),/重开、导入或换猫/);
 const family=JSON.parse(saved);family.cats.push({...family.cats[0],id:'cat-2',joinedAt:family.createdAt+1});family.activeCatId='cat-2';assert.equal(s.importSave(JSON.stringify(family)).ok,true);assert.throws(()=>map.read(context),/重开、导入或换猫/);
 s.importSave(saved);const lost=mapper(memory(),s);assert.throws(()=>lost.read({...context,hasSnapshot:true,snapshotPetId:'cat-previous'}),/另一份宠物身份/);
});
