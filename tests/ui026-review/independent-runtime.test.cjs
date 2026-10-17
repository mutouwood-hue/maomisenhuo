/* Independent production-source regressions. Memory Native/GATT and clock fixtures only. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const base=path.resolve(__dirname,'../../artifacts/html-offline-candidate');
const f=require(base+'/ui026/source/tests/care-runtime-fixture.cjs');
const old=require(base+'/ui025/source/tests/event-fixture.cjs');
const native=require(base+'/ui026/source/web/offline-durable-store.js');
const rt=h=>JSON.parse(JSON.stringify(h.store.hostReadCareRuntime()));
const records=[];function record(name,data){records.push({name,...data});fs.writeFileSync(__dirname+'/independent-results.json',JSON.stringify({kind:'virtual_fixture',actualOriginalVu:true,actualMountedSource:true,realNative:false,realGATT:false,records},null,2)+'\n');}
test('same-clock negative025 reproduces bypass, while026 defers before UUID/digest/WAL/seal/ACK',async()=>{
 const before=old.harness();assert.equal(before.store.hostDeviceCare('drink').ok,true);before.q.push(before.care('water'));await before.consumer.consume(()=>true);assert.equal(before.store.hostDeviceCare('drink').ok,true);assert.equal(before.store.getState().counts.drink,3);
 const h=f.mounted();try{
  h.store.hostDeviceCare('drink');h.q.push(h.care('water'));let uuid=0,digest=0,seal=0;
  const c=f.events.createConsumer({ports:h.ports,ledger:h.ledger,storage:h.io,source:h.source,durable:{...h.durable,seal:async()=>{seal++;}},uuid:()=>{uuid++;return 'forbidden';},digest:async()=>{digest++;return 'a'.repeat(64);},now:()=>f.NOW});
  const game=h.source.capture(),ledger=h.io.getItem(f.db.KEY),authority=JSON.stringify(h.io.nativeAuthority),keys=[...h.io.values.keys()];
  const result=await c.consume(()=>true);assert.equal(result.waiting,true);assert.equal(result.remainingMs,4000);assert.deepEqual([uuid,digest,seal,h.acks.length],[0,0,0,0]);assert.equal(h.io.getItem(f.db.KEY),ledger);assert.equal(h.source.capture(),game);assert.equal(JSON.stringify(h.io.nativeAuthority),authority);assert.deepEqual([...h.io.values.keys()],keys);assert.equal(h.q.length,1);assert.equal(h.store.hostCareRuntimeBusy(),false);
  record('025negative_vs026zero_transaction',{negative025DrinkCount:3,fixed026DrinkCount:h.store.getState().counts.drink,uuid,digest,seal,acks:h.acks.length,waitingMs:result.remainingMs});
 }finally{h.close();}
});
test('pre-bound original public aliases reject inside lease; getters and complete browser backup export stay read-only',async()=>{
 const h=f.mounted();try{
  const writers=Object.fromEntries(Object.entries(h.store).filter(([k,v])=>typeof v==='function'&&!['getState','exportSave'].includes(k)&&!k.startsWith('hostRead')&&!['hostCareRuntimeBusy','hostCareDelay','hostFreezeDeviceResult'].includes(k)).map(([k,v])=>[k,v.bind(h.store)]));assert.equal(Object.keys(writers).length,38);
  h.w.CatOfflineDeviceEvents=h.api;h.w.CatOfflineEventStore=f.db;
  vm.runInNewContext(fs.readFileSync(base+'/ui026/source/web/offline-device-backup.js','utf8'),{globalThis:h.w});
  h.store.hostDeviceCare('drink');const r=h.source.freeze(),before=h.source.capture(),writes=h.io.writes.length;
  for(const [name,fn]of Object.entries(writers)){const result=fn();assert.equal(result.code,'CARE_RUNTIME_BUSY',name);}
  assert.equal(h.store.getState().counts.drink,1);const exported=h.store.exportSave();assert.equal(JSON.parse(exported).__cflocal2Backup.schema,1);assert.equal(exported.includes('cooldowns'),false);
  const rejected=await h.store.importSave(exported);assert.equal(rejected.ok,false);assert.match(rejected.message,/结束互动/);assert.equal(h.source.capture(),before);assert.equal(h.io.writes.length,writes);
  r();assert.equal(h.store.hostCareRuntimeBusy(),false);assert.throws(()=>h.source.hydrate(exported,JSON.stringify(h.w.__pgSocial.D),undefined,r),/本次事务/);
  record('prebound_and_actual_backup_mount',{blockedAliases:38,backupReadOnly:true,importRejectedWhileOwned:true,noNewWrites:true});
 }finally{h.close();}
});
test('foreground cancellation during asynchronous digest releases gate with no decision or runtime publication',async()=>{
 const h=f.mounted();try{
  let resolve,started;const entered=new Promise(r=>started=r);let valid=true,seals=0;h.durable.seal=async()=>{seals++;};
  const c=h.makeConsumer({digest:async()=>{started();await new Promise(r=>resolve=r);return 'a'.repeat(64);}});const initial=rt(h);h.q.push(h.care('feed'));const pending=c.consume(()=>valid);await entered;valid=false;h.durable.foreground=false;resolve();const result=await pending;
  assert.equal(result.waiting,true);assert.equal(seals,0);assert.equal(h.acks.length,0);assert.equal(h.q.length,1);assert.deepEqual(rt(h),initial);assert.equal(h.store.getState().counts.feed,0);assert.equal(h.store.hostCareRuntimeBusy(),false);assert.equal(h.lifecycle.filter(x=>x==='resume').length,0);
  record('cancel_during_digest',{seals,acks:h.acks.length,queueRetained:true,noResume:true});
 }finally{h.close();}
});
test('actual Native client lost commit+read reply blocks same-page retry; cold recreation dedups without reseeding RAM',async()=>{
 const h=f.mounted();try{
  let authority={},revision=0,unavailable=false;
  const client=native.createClient({storage:h.io,rpc:async(op,args)=>{
   if(op==='read'){if(unavailable)throw Error('read unavailable');return {schema:1,revision,entries:authority,foreground:true};}
   assert.equal(op,'commit');assert.equal(args.expectedRevision,revision);authority={...authority,...args.updates};revision++;unavailable=true;throw Error('commit response lost');
  }});await client.initialize();h.w.CatOfflineDurable=client;const c=f.events.createConsumer({ports:h.ports,ledger:h.ledger,storage:h.io,source:h.source,durable:client,now:()=>f.NOW,digest:async x=>crypto.createHash('sha256').update(x).digest('hex')});h.q.push(h.care('feed'));const initial=rt(h);
  await assert.rejects(c.consume(()=>true),/未确认/);assert.equal(client.available,false);assert.equal(h.store.getState().counts.feed,0);assert.deepEqual(rt(h),initial);assert.equal(h.acks.length,0);assert.equal(h.store.hostCareRuntimeBusy(),false);assert.equal(client.transactionPaused,true);await assert.rejects(c.consume(()=>true),/未确认/);
  h.io.nativeAuthority.entries=authority;const recreated=f.harness({io:h.io});assert.equal(recreated.store.getState().counts.feed,1);assert.deepEqual(rt(recreated).cooldowns,{});recreated.q.push(recreated.care('feed'));await recreated.consumer.consume(()=>true);assert.equal(recreated.acks[0].status,'duplicate');assert.equal(recreated.store.getState().counts.feed,1);assert.deepEqual(rt(recreated).cooldowns,{});
  record('native_unknown_cold_recovery',{realClientMemoryRPC:true,liveBeforeRecoveryCount:0,recreatedCount:1,duplicateAck:true,ramRuntimeNotPersisted:true});
 }finally{h.close();}
});
test('timestamp-less FIFO waits only original per-action threshold; rejected care never advances old timestamp',async()=>{
 let now=f.NOW;const h=f.mounted({clock:()=>now});try{
  h.q.push(h.care('pet',1),h.care('pet',2));await h.consumer.consume(()=>true);const first=rt(h);now+=1999;assert.equal((await h.consumer.consume(()=>true)).remainingMs,1);assert.deepEqual(rt(h),first);now++;await h.consumer.consume(()=>true);assert.equal(h.store.getState().counts.pet,2);assert.deepEqual(h.acks.map(x=>x.status),['applied','applied']);
  const saved=JSON.parse(h.api.rawExport());saved.cats[0].stats.food=99;assert.equal(h.store.importSave(JSON.stringify(saved)).ok,true);h.store.hostDeviceCare('drink');const prior=rt(h);h.q.push(h.care('feed',3));await h.consumer.consume(()=>true);assert.equal(h.acks[2].status,'quarantined');assert.deepEqual(rt(h),prior);
  record('independent_original2s_and_quarantine',{boundaryMs:2000,petCount:2,quarantineDoesNotTouchPriorRuntime:true});
 }finally{h.close();}
});
