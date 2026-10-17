const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness,mounted,events,db,NOW}=require('/Users/zoumutou/coding/猫咪森活/artifacts/html-offline-candidate/ui026/source/tests/care-runtime-fixture.cjs');
const {createBridge}=require('/Users/zoumutou/coding/猫咪森活/artifacts/html-offline-candidate/ui026/source/web/offline-device-backup.js');
const out=path.resolve(__dirname,'owner-runtime-rerun');fs.mkdirSync(out,{recursive:true});const records=[];
const copy=x=>JSON.parse(JSON.stringify(x)),runtime=h=>copy(h.store.hostReadCareRuntime());
function counters(h){const p=h.store.getState();return {feed:p.counts.feed,drink:p.counts.drink,pet:p.counts.pet,xp:p.xp,coins:p.coins,food:p.stats.food,energy:p.stats.energy};}
function report(name,data){records.push({name,...data});fs.writeFileSync(out+'/production.json',JSON.stringify({softwareNotDevice:true,records},null,2)+'\n');}
test('local→device→local uses same original4s context; defer keeps FIFO with zero ledger/Native/ACK changes',async()=>{
 let now=NOW;const h=mounted({clock:()=>now});try{
  assert.equal(h.store.hostDeviceCare('drink').ok,true);const before=copy(runtime(h)),ledger=h.io.getItem(db.KEY),authority=JSON.stringify(h.io.nativeAuthority);let seals=0;const seal=h.durable.seal;h.durable.seal=async v=>{seals++;return seal(v);};h.q.push(h.care('water',1));
  const waiting=await h.consumer.consume(()=>true);assert.equal(waiting.waiting,true);assert.equal(waiting.remainingMs,4000);assert.equal(h.q.length,1);assert.equal(h.acks.length,0);assert.equal(seals,0);assert.equal(h.io.getItem(db.KEY),ledger);assert.equal(JSON.stringify(h.io.nativeAuthority),authority);assert.deepEqual(runtime(h),before);assert.equal(h.store.hostCareRuntimeBusy(),false);
  now+=3999;assert.equal((await h.consumer.consume(()=>true)).waiting,true);now++;assert.equal((await h.consumer.consume(()=>true)).acknowledged,true);assert.equal(h.store.getState().counts.drink,2);const local=h.store.hostDeviceCare('drink');assert.equal(local.ok,false);assert.match(local.message,/缓一缓/);now+=4000;assert.equal(h.store.hostDeviceCare('drink').ok,true);assert.equal(h.store.getState().counts.drink,3);
  report('local-device-local',{deferredBeforeBoundary:true,noDeferSealOrLedgerOrACK:true,deviceAtExactBoundary:true,localBlockedAfterDevice:true,final:counters(h)});
 }finally{h.close();}
});
test('distinct counters and legal timestamp-less backlog wait then replan latest state; no fabricated event time',async()=>{
 let now=NOW;const h=harness({clock:()=>now});h.q.push(h.care('feed',1),h.care('feed',2));assert.equal((await h.consumer.consume(()=>true)).acknowledged,true);const before=copy(runtime(h));assert.equal((await h.consumer.consume(()=>true)).waiting,true);assert.equal(h.acks.length,1);assert.equal(h.q.length,1);assert.equal(h.ledger.snapshot().records[h.q[0].eventId],undefined);assert.deepEqual(runtime(h),before);now+=4000;await h.consumer.consume(()=>true);assert.deepEqual(h.acks.map(a=>a.status),['applied','applied']);assert.deepEqual(counters(h),{feed:2,drink:0,pet:0,xp:16,coins:24,food:100,energy:75});assert.equal(Object.values(h.ledger.snapshot().records).every(r=>r.event.occurredAtMs===null),true);
 report('distinct-feed-backlog',{timestampSource:'phone processing only',waitedMs:4000,ackStatuses:h.acks.map(a=>a.status),final:counters(h)});
});
test('deferred head re-evaluates latest original eligibility, rather than caching a stale reward plan',async()=>{
 let now=NOW;const h=harness({clock:()=>now});assert.equal(h.store.hostDeviceCare('feed').ok,true);h.q.push(h.care('feed',1));assert.equal((await h.consumer.consume(()=>true)).waiting,true);now+=4000;assert.equal(h.store.hostDeviceCare('feed').ok,true);now+=4000;await h.consumer.consume(()=>true);assert.equal(h.acks[0].status,'quarantined');assert.equal(h.store.getState().counts.feed,2);assert.equal(h.store.getState().coins,24);
});
test('gift and quarantined events preserve every existing cooldown timestamp without refreshing it',async()=>{
 let now=NOW;const h=mounted({clock:()=>now});try{
  const save=JSON.parse(h.store.exportSave());save.cats[0].stats.food=99;assert.equal(h.store.importSave(JSON.stringify(save)).ok,true);assert.equal(h.store.hostDeviceCare('drink').ok,true);const initial=copy(runtime(h));now+=500;
  h.q.push(h.gift(1));await h.consumer.consume(()=>true);assert.deepEqual(runtime(h),initial);h.q.push(h.care('feed',2));await h.consumer.consume(()=>true);assert.equal(h.acks[1].status,'quarantined');assert.deepEqual(runtime(h),initial);assert.equal(h.store.hostDeviceCare('drink').ok,false);now=NOW+4000;assert.equal(h.store.hostDeviceCare('drink').ok,true);report('gift-quarantine',{preservedTimestamp:initial.cooldowns,notRefreshed:true});
 }finally{h.close();}
});
test('already settled duplicate and unknown ACK retry never seed or refresh cooldowns',async()=>{
 let now=NOW;const h=harness({clock:()=>now}),event=h.care('feed',1);h.q.push(event);h.setAckError(Error('ACK unknown'));await assert.rejects(h.consumer.consume(()=>true),/ACK unknown/);const first=copy(runtime(h));now+=1000;h.setAckError(null);await h.consumer.consume(()=>true);assert.deepEqual(runtime(h),first);assert.equal(h.acks[1].status,'duplicate');const after=counters(h);now+=5000;h.q.push(event);await h.consumer.consume(()=>true);assert.equal(h.acks[2].status,'duplicate');assert.deepEqual(runtime(h),first);assert.deepEqual(counters(h),after);
 report('duplicate-unknown-ack',{runtimeExact:true,ackStatuses:h.acks.map(a=>a.status),oneOriginalFeed:h.store.getState().counts.feed===1});
});
test('Native precommit failure and committed-but-lost response publish no speculative live runtime',async()=>{
 for(const committed of [false,true]){const h=harness(),initial=copy(runtime(h)),seal=h.durable.seal;h.q.push(h.care('feed'));h.durable.seal=async v=>{if(committed)await seal(v);throw Error('Native response unavailable');};await assert.rejects(h.consumer.consume(()=>true),/unavailable/);assert.deepEqual(runtime(h),initial);assert.equal(h.store.getState().counts.feed,0);assert.equal(h.acks.length,0);assert.equal(h.store.hostCareRuntimeBusy(),false);}
});
test('all public original writes really reject during Native await and commit→hydrate, including reentry and DOM clicks',async()=>{
 const h=mounted();try{
  let finish,entered;const wait=new Promise(r=>entered=r),seal=h.durable.seal;let blocked=0;
  const names=Object.keys(h.store).filter(k=>typeof h.store[k]==='function'&&!['getState','exportSave'].includes(k)&&!k.startsWith('hostRead')&&!['hostCareRuntimeBusy','hostCareDelay','hostFreezeDeviceResult'].includes(k));
  function rejectWrites(){const before=h.source.capture();for(const name of names){const r=h.store[name]();assert.equal(r.ok,false,name);assert.equal(r.code,'CARE_RUNTIME_BUSY',name);blocked++;}assert.equal(h.source.capture(),before);}
  let fakeSuccess=0;h.w.document.getElementById('write').addEventListener('click',()=>{h.store.reset();fakeSuccess++;});
  h.durable.seal=async value=>{rejectWrites();assert.throws(()=>h.source.flush(),/本次事务/);assert.throws(()=>h.source.hydrate(value.game,value.social,value.runtime),/本次事务/);h.w.document.getElementById('write').click();assert.equal(fakeSuccess,0);assert.match(h.messages.at(-1),/稍后/);entered();await new Promise(r=>finish=r);await seal(value);rejectWrites();};
  const consume=h.makeConsumer({fault:phase=>{if(phase==='committed')rejectWrites();}});h.q.push(h.care('feed'));const pending=consume.consume(()=>true);await wait;await assert.rejects(consume.consume(()=>true),/上一条/);assert.equal((await h.makeConsumer().consume(()=>true)).waiting,true);assert.throws(()=>h.source.freeze(),/正在保存/);finish();await pending;
  assert.equal(h.store.getState().counts.feed,1);assert.equal(h.store.getState().coins,27);assert.equal(h.store.hostCareRuntimeBusy(),false);assert.equal(h.w.document.body.inert,undefined);assert.equal(h.durable.transactionPaused,undefined);assert.equal(fakeSuccess,0);assert.ok(blocked>=names.length*3);h.w.document.getElementById('write').click();assert.equal(fakeSuccess,1,'only new explicit input after release executes');assert.deepEqual(runtime(h).cooldowns,{});
  report('native-flight-public-gate',{publicWriteMethods:names,blockedCalls:blocked,queuedReplay:false,clearAfterExplicitReset:true});
 }finally{h.close();}
});
test('capture detects runtime-only drift while hashing and aborts before Native/WAL/ACK',async()=>{
 const h=mounted();try{let changed=false,seals=0;const read=h.store.hostReadCareRuntime;h.store.hostReadCareRuntime=()=>{const value=read();if(changed)value.cooldowns[h.store.getState().id+':feed']=NOW;return value;};h.durable.seal=async()=>{seals++;};const consumer=h.makeConsumer({digest:async()=>{changed=true;return 'a'.repeat(64);}});h.q.push(h.care('feed'));const before=h.io.getItem(db.KEY);assert.equal((await consumer.consume(()=>true)).waiting,true);assert.equal(seals,0);assert.equal(h.acks.length,0);assert.equal(h.io.getItem(db.KEY),before);assert.equal(h.store.getState().counts.feed,0);h.store.hostReadCareRuntime=read;
 }finally{h.close();}
});
test('pause after successful Native commit finishes runtime+game projection but no ACK; explicit later retry is duplicate',async()=>{
 let now=NOW,valid=true;const h=mounted({clock:()=>now});try{const seal=h.durable.seal;h.durable.seal=async value=>{await seal(value);valid=false;h.durable.foreground=false;};h.q.push(h.care('feed'));const result=await h.consumer.consume(()=>valid);assert.equal(result.acknowledged,false);assert.equal(h.store.getState().counts.feed,1);const first=copy(runtime(h));assert.equal(first.cooldowns['cat-1:feed'],NOW);assert.equal(h.acks.length,0);assert.equal(h.store.hostCareRuntimeBusy(),false);assert.equal(h.lifecycle.filter(x=>x==='resume').length,0);now+=1000;valid=true;h.durable.foreground=true;await h.consumer.consume(()=>valid);assert.equal(h.acks[0].status,'duplicate');assert.deepEqual(runtime(h),first);
 }finally{h.close();}
});
test('normal import/reset retain original RAM clear; owner flush/hydrate closes on success and exceptions with no deadlock',async()=>{
 const h=mounted();try{assert.equal(h.store.hostDeviceCare('drink').ok,true);const raw=h.store.exportSave();assert.ok(Object.keys(runtime(h).cooldowns).length);assert.equal(h.store.importSave(raw).ok,true);assert.deepEqual(runtime(h).cooldowns,{});assert.equal(h.store.hostDeviceCare('drink').ok,true);h.store.reset();assert.deepEqual(runtime(h).cooldowns,{});
  const release=h.source.freeze();assert.throws(()=>h.source.flush(()=>{}),/本次事务/);assert.throws(()=>h.source.hydrate(raw,JSON.stringify(h.w.__pgSocial.D),undefined,()=>{}),/本次事务/);h.source.flush(release);release();release();assert.throws(()=>h.source.flush(release),/已释放/);assert.throws(()=>release.busy(),/本次事务/);assert.equal(h.store.hostCareRuntimeBusy(),false);assert.equal(h.store.hostDeviceCare('drink').ok,true);
  h.q.push(h.care('pet'));h.durable.seal=async()=>{throw Error('Native failure');};await assert.rejects(h.consumer.consume(()=>true));assert.equal(h.store.hostCareRuntimeBusy(),false);assert.equal(h.store.rename('新的名字').ok,true);
 }finally{h.close();}
});
test('actual durable backup ordinary import uses owned path and clears RAM while preserving unchanged format',async()=>{
 const h=mounted();try{h.store.hostDeviceCare('drink');let reloaded=0;const bridge=createBridge({storage:h.io,ledger:h.ledger,source:h.source,originalExport:h.store.exportSave,durable:h.durable,uuid:()=> 'restore-token',connected:()=>false,reload:()=>reloaded++});const exported=bridge.exportData();assert.equal(exported.includes('cooldowns'),false);assert.equal((await bridge.restore(exported)).ok,true);assert.equal(reloaded,1);assert.deepEqual(runtime(h).cooldowns,{});assert.equal(h.store.hostCareRuntimeBusy(),false);assert.equal(h.store.hostDeviceCare('drink').ok,true);
 }finally{h.close();}
});
test('crash/recreation keeps durable result and dedup but does not claim original RAM debounce survives process restart',async()=>{
 const h=harness();h.q.push(h.care('feed'));await h.consumer.consume(()=>true);assert.ok(Object.keys(runtime(h).cooldowns).length);const resumed=harness({io:h.io});assert.deepEqual(runtime(resumed).cooldowns,{});resumed.q.push(h.care('feed'));await resumed.consumer.consume(()=>true);assert.equal(resumed.acks[0].status,'duplicate');assert.deepEqual(runtime(resumed).cooldowns,{});assert.equal(resumed.store.getState().counts.feed,1);
});
test('runtime identity, original independent action thresholds and returned copies cannot silently clear or invent context',()=>{
 let now=NOW;const h=harness({clock:()=>now});assert.equal(h.store.hostDeviceCare('pet').ok,true);const first=h.store.hostReadCareRuntime();first.cooldowns['cat-1:pet']=0;assert.equal(h.store.hostCareDelay('pet'),2000);assert.equal(h.store.hostCareDelay('feed'),0);now+=2000;assert.equal(h.store.hostCareDelay('pet'),0);assert.equal(h.store.hostDeviceCare('pet').ok,true);const original=runtime(h);assert.throws(()=>h.source.createStore({storage:{getItem:()=>h.io.getItem(db.GAME),setItem(){}},now:()=>now,hostRuntime:{...original,identity:'other'}}),/上下文/);assert.throws(()=>h.source.createStore({storage:{getItem:()=>h.io.getItem(db.GAME),setItem(){}},now:()=>now,hostRuntime:{...original,cooldowns:{'other:pet':NOW}}}),/冷却/);assert.deepEqual(runtime(h),original);
});

test('generated original game differs from025 only by runtime constructor/install hooks, not reward rules or cooldown constants',()=>{
 const root='/Users/zoumutou/coding/猫咪森活/artifacts/html-offline-candidate/ui026/source',read=f=>fs.readFileSync(path.join(root,f),'utf8');let game=read('android/app/src/main/assets/game-03.js');const embedded=read('scripts/care-runtime.cjs').split('// END EMBEDDED INSTALL')[0];
 const tail='adoptCat:$e};'+embedded+'return __hostInstallCareRuntime(__hostApi,{identity:()=>JSON.stringify([o.createdAt,o.activeCatId,o.cats.map(C=>[C.id,C.joinedAt])]),read:()=>p,replace:value=>{p=value},clock:e,cooldowns:Hf,activeCatId:()=>o.activeCatId,keys:()=>o.cats.flatMap(C=>[...Bo,"clinic"].map(Y=>C.id+":"+Y)),hydrate:Ue,seed:hostRuntime});}/**';assert.ok(game.includes(tail));
 game=game.replace('function vu({storage:i,now:e=()=>Date.now(),onChange:t=()=>{},hostRuntime}={})','function vu({storage:i,now:e=()=>Date.now(),onChange:t=()=>{}}={})').replace('const __hostApi={hostDeviceCare:','return{hostDeviceCare:').replace(tail,'adoptCat:$e}}/**');assert.equal(game,read('../../ui025/source/android/app/src/main/assets/game-03.js'));
});

test('pending ACK validation and replay cannot seed or refresh already settled runtime',async()=>{
 let now=NOW;const h=harness({clock:()=>now}),event=h.care('feed');h.q.push(event);await h.consumer.consume(()=>true);const initial=runtime(h);now+=1000;const pending={op:'ack',data:{eventId:event.eventId,counter:event.counter,receipt:{persisted:true,status:'applied',saveDigest:h.acks[0].saveDigest}}};h.consumer.assertPending(pending);h.consumer.assertPending(pending);assert.deepEqual(runtime(h),initial);assert.equal(h.store.hostDeviceCare('feed').ok,false);
});
test('hydrate or digest exceptions release owned gate and inputs, without replaying a blocked write or rewarding twice',async()=>{
 for(const phase of ['digest','hydrate']){const h=mounted();try{h.q.push(h.care('feed'));if(phase==='hydrate')h.w.__pgSocial.hostRefresh=()=>{throw Error('UI hydration failed');};const c=h.makeConsumer({digest:async()=>{if(phase==='digest')throw Error('hash failure');return 'a'.repeat(64);}});await assert.rejects(c.consume(()=>true));assert.equal(h.store.hostCareRuntimeBusy(),false);assert.equal(h.w.document.body.inert,undefined);assert.equal(h.acks.length,0);assert.equal(h.store.getState().counts.feed,phase==='hydrate'?1:0);assert.equal(Object.keys(runtime(h).cooldowns).length,phase==='hydrate'?1:0);let reached=false;h.w.document.getElementById('write').addEventListener('click',()=>reached=true);h.w.document.getElementById('write').click();assert.equal(reached,true);assert.equal(h.store.rename('稍后操作').ok,true);}finally{h.close();}}
});

test('actual original clinic completion runtime survives gift/care hydration without inventing a clinic cooldown',async()=>{
 let now=NOW;const h=mounted({clock:()=>now});try{const visit=h.store.beginVisit();assert.equal(visit.ok,true);now+=1500;assert.equal(h.store.finishVisit(visit.token,{steps:3}).ok,true);const initial=runtime(h);assert.equal(initial.cooldowns['cat-1:clinic'],now);assert.equal(h.store.hostCareDelay('clinic'),0);h.q.push(h.gift(1));await h.consumer.consume(()=>true);assert.deepEqual(runtime(h),initial);h.q.push(h.care('water',2));await h.consumer.consume(()=>true);assert.equal(h.acks[1].status,'applied');assert.equal(runtime(h).cooldowns['cat-1:clinic'],initial.cooldowns['cat-1:clinic']);assert.equal(h.store.getState().coins,26);assert.equal(h.store.getState().counts.drink,1);assert.equal(h.store.hostCareDelay('clinic'),0);}finally{h.close();}
});
