const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,memory,db,events,ID}=require('./event-fixture.cjs');
test('all five real physical cares use actual original rules, water=drink and play=tease without a game score',async()=>{
 for(const [action,count]of [['pet','pet'],['feed','feed'],['water','drink'],['play','tease'],['sleep','sleep']]){
  const h=harness();h.q.push(h.care(action));const before=h.store.getState();await h.consumer.consume(()=>true);
  const p=h.store.getState();assert.equal(p.counts[count],before.counts[count]+1,action);assert.equal(p.counts.play,0);assert.ok(p.xp>before.xp);assert.equal(h.acks[0].status,'applied');
  assert.equal(h.social.dex.deviceReceipts[0].eventId,ID+':1');assert.equal(h.ledger.snapshot().pending,null);
  if(action==='feed'){assert.equal(p.coins,before.coins-3);assert.equal(p.stats.food,before.stats.food+25);}
 }
});
test('real flower grants exactly one inventory item and original social receipt; no invented friend/profile/card',async()=>{
 const h=harness(),e=h.gift();h.q.push(e);const n=h.store.getState().inventory.flower;await h.consumer.consume(()=>true);
 assert.equal(h.store.getState().inventory.flower,n+1);assert.equal(h.social.gifts.inbox[0].open,true);assert.equal(h.social.gifts.inbox[0].source,'native_device');assert.deepEqual(h.social.friends,{});assert.deepEqual(h.social.dex.cards,{});
 const after=h.store.exportSave();h.q.push(e);await h.consumer.consume(()=>true);assert.equal(h.store.exportSave(),after);assert.equal(h.acks[1].status,'duplicate');assert.equal(h.social.gifts.inbox.length,1);
});
test('original eligibility rejection is explicit, durable, and never presented as an applied reward',async()=>{
 const h=harness(),full=JSON.parse(h.store.exportSave());full.cats[0].stats.food=99;h.store.importSave(JSON.stringify(full));h.q.push(h.care('feed'));
 await h.consumer.consume(()=>true);assert.equal(h.store.getState().counts.feed,0);assert.equal(h.acks[0].status,'quarantined');assert.match(h.results[0].message,/未获奖励/);assert.equal(h.ledger.snapshot().records[ID+':1'].status,'quarantined');
});
test('unsupported, forged, or cross-device events remain in FIFO and never produce a receipt or ACK',async()=>{
 for(const change of [e=>e.action='bath',e=>e.action='walk',e=>e.kind='unknown',e=>e.source='npc',e=>e.deviceId='bad',e=>e.eventId=ID+':2']){
  const h=harness(),e=h.care();change(e);h.q.push(e);await assert.rejects(h.consumer.consume(()=>true));assert.equal(h.acks.length,0);assert.equal(h.store.getState().counts.pet,0);assert.equal(h.q.length,1);
 }
 const h=harness(),e=h.gift();e.peerComplete=true;h.q.push(e);await assert.rejects(h.consumer.consume(()=>true));assert.deepEqual(h.social.friends,{});
});
test('old-cat and generation mismatch is durably isolated without clearing or acknowledging the queue',async()=>{
 const h=harness(),e=h.care();e.petId='cat-old';h.q.push(e);await assert.rejects(h.consumer.consume(()=>true),/另一只猫/);assert.equal(h.acks.length,0);assert.equal(h.ledger.snapshot().isolated[0].event.eventId,e.eventId);assert.equal(h.store.getState().counts.pet,0);
 const reset=harness(),old=reset.care();const game=JSON.parse(reset.store.exportSave());game.createdAt+=1000;game.lastSavedAt+=1000;game.cats[0].joinedAt+=1000;reset.store.importSave(JSON.stringify(game));reset.q.push(old);await assert.rejects(reset.consumer.consume(()=>true),/重开、导入或换猫/);assert.equal(reset.acks.length,0);assert.equal(reset.ledger.snapshot().isolated.length,1);
});
for(const phase of ['before-prepare','prepared','image:0','image:1','before-finalize','finalized','committed','hydrated','before-ack'])test('crash at '+phase+' recovers once; no ACK precedes complete game+social+dedup commit',async()=>{
 let hit=false;const fault=p=>{if(p===phase&&!hit){hit=true;throw Error('simulated process death');}};
 const h=harness({walFault:fault,consumerFault:fault}),e=h.care();h.q.push(e);await assert.rejects(h.consumer.consume(()=>true));assert.equal(h.acks.length,0);assert.equal(hit,true);
 const resumed=harness({io:h.io,queue:h.q});await resumed.consumer.consume(()=>true);assert.equal(resumed.store.getState().counts.pet,1);assert.equal(resumed.store.getState().xp,3);assert.equal(resumed.social.dex.deviceReceipts.length,1);assert.equal(resumed.acks.length,1);assert.equal(resumed.ledger.snapshot().pending,null);
});
test('write failure before/after durable decision or either original image does not ACK; restart rolls forward only a committed decision',async()=>{
 for(const key of [db.KEY,db.GAME,db.SOCIAL])for(const when of ['before','after']){
  const h=harness();h.q.push(h.care());let armed=false;
  h.io.setFault((k,v,stage)=>{if(k===db.KEY)armed=true;if(armed&&k===key&&stage===when)throw Error('disk full or uncertain write');});
  await assert.rejects(h.consumer.consume(()=>true));assert.equal(h.acks.length,0);h.io.setFault(null);
  const resumed=harness({io:h.io,queue:h.q});await resumed.consumer.consume(()=>true);assert.equal(resumed.store.getState().counts.pet,1);assert.equal(resumed.social.dex.deviceReceipts.length,1);
 }
});
test('ACK lost before or after device commit retries without a second award',async()=>{
 for(const after of [false,true]){
  const h=harness();h.q.push(h.care());if(after)h.loseAck();else h.setAckError(Error('ACK lost'));
  await assert.rejects(h.consumer.consume(()=>true));assert.equal(h.store.getState().counts.pet,1);
  const resumed=harness({io:h.io,queue:h.q});await resumed.consumer.consume(()=>true);assert.equal(resumed.store.getState().counts.pet,1);assert.equal(resumed.social.dex.deviceReceipts.length,1);assert.equal(resumed.acks.length,after?0:1);
 }
});
test('game/social read or write health failures are never converted into quarantined terminal ACKs',async()=>{
 for(const key of [db.GAME,db.SOCIAL]){
  const h=harness();h.q.push(h.care());h.io.values.set(key,'{bad');await assert.rejects(h.consumer.consume(()=>true));assert.equal(h.acks.length,0);assert.equal(Object.keys(h.ledger.snapshot().records).length,0);assert.equal(h.io.getItem(key),'{bad');
 }
 const h=harness();h.q.push(h.care());h.io.setFault(k=>{if(k===db.GAME)throw Error('full');});await assert.rejects(h.consumer.consume(()=>true));assert.equal(h.acks.length,0);
});
test('an event changing under the same eventId, an external recovery conflict, and a corrupt journal all fail closed',async()=>{
 const h=harness(),e=h.care();h.q.push(e);await h.consumer.consume(()=>true);h.q.push({...e,action:'feed'});await assert.rejects(h.consumer.consume(()=>true),/编号内容/);assert.equal(h.acks.length,1);
 const p=harness({walFault:phase=>{if(phase==='prepared')throw Error('crash');}});p.q.push(p.care());await assert.rejects(p.consumer.consume(()=>true));p.io.values.set(db.SOCIAL,'foreign write');assert.throws(()=>db.createStore(p.io).recover(),/其他窗口/);assert.equal(p.io.getItem(db.SOCIAL),'foreign write');
 const io=memory();io.values.set(db.KEY,'{bad');assert.throws(()=>db.createStore(io).recover(),/无法读取/);assert.equal(io.getItem(db.KEY),'{bad');
});
test('local mutation is explicitly rejected while hashing; pause or busy still cannot ACK',async()=>{
 const h=harness();h.q.push(h.care());h.setBusy(true);assert.equal((await h.consumer.consume(()=>true)).waiting,true);assert.equal(h.acks.length,0);
 h.setBusy(false);let valid=true;const c=events.createConsumer({ports:h.ports,ledger:h.ledger,storage:h.io,source:h.source,durable:h.durable,digest:async()=>{const result=h.store.act('feed');assert.equal(result.ok,false);assert.equal(result.code,'CARE_RUNTIME_BUSY');return 'a'.repeat(64);}});
 assert.equal((await c.consume(()=>valid)).acknowledged,true);assert.equal(h.store.getState().counts.pet,1);assert.equal(h.store.getState().counts.feed,0);assert.equal(h.acks.length,1);
 const j=harness();j.q.push(j.care());const paused=events.createConsumer({ports:j.ports,ledger:j.ledger,storage:j.io,source:j.source,durable:j.durable,digest:async()=>{valid=false;return 'a'.repeat(64);}});valid=true;await paused.consume(()=>valid);assert.equal(j.store.getState().counts.pet,0);assert.equal(j.acks.length,0);
});
test('fresh restore missing device lastAck history blocks any event read, award or ACK',async()=>{
 const h=harness();h.state.device.lastAck=2;h.q.push(h.care('feed',3));let reads=0;h.ports.events.readNext=async()=>{reads++;return h.q[0];};
 await assert.rejects(h.consumer.consume(()=>true),/缺少设备已确认/);assert.equal(reads,0);assert.equal(h.acks.length,0);assert.equal(h.store.getState().counts.feed,0);
});
test('pending ACK recovery requires matching durable result, digest and generation identity',async()=>{
 const h=harness(),event=h.care(),pending={op:'ack',data:{eventId:event.eventId,counter:event.counter,receipt:{persisted:true,status:'applied',saveDigest:'a'.repeat(64)}}};
 assert.throws(()=>h.consumer.assertPending(pending),/缺少匹配/);h.q.push(event);await h.consumer.consume(()=>true);pending.data.receipt.saveDigest=h.acks[0].saveDigest;assert.doesNotThrow(()=>h.consumer.assertPending(pending));
 assert.throws(()=>h.consumer.assertPending({...pending,data:{...pending.data,receipt:{...pending.data.receipt,saveDigest:'b'.repeat(64)}}}),/缺少匹配/);
});
test('actual scene map cannot sample partial original game/social images, and an ACK BUSY retains the durable result',async()=>{
 let h,checked=false;h=harness({walFault:phase=>{if(phase==='image:0'){assert.throws(()=>h.source.wire(),/尚未恢复/);checked=true;}}});h.q.push(h.care());h.setAckError(Object.assign(Error('BUSY'),{code:'BUSY'}));
 await assert.rejects(h.consumer.consume(()=>true),/BUSY/);assert.equal(checked,true);assert.equal(h.store.getState().counts.pet,1);assert.equal(h.ledger.snapshot().pending,null);assert.equal(h.source.wire().pet.mood,81);
 h.setAckError(null);await h.consumer.consume(()=>true);assert.equal(h.store.getState().counts.pet,1);assert.equal(h.acks[1].status,'duplicate');
});
test('synchronous backup/event SHA-256 matches independent Node crypto across Unicode, boundary and binary text',()=>{
 const crypto=require('node:crypto');for(const n of [0,1,31,55,56,63,64,65,119,120,127,128,1024,10000]){
  const text='猫咪🌼'+crypto.randomBytes(n).toString('base64');assert.equal(db.sha256(text),crypto.createHash('sha256').update(text).digest('hex'));
 }assert.equal(db.sha256(''),crypto.createHash('sha256').update('').digest('hex'));
});
test('Native pre-commit failure never changes original results or ACKs; uncertain committed decision is recovered once',async()=>{
 for(const committed of [false,true]){
  const h=harness(),seal=h.durable.seal;h.durable.seal=async input=>{if(committed)await seal(input);throw Error('Native result unknown');};h.q.push(h.care());
  await assert.rejects(h.consumer.consume(()=>true),/unknown/);assert.equal(h.acks.length,0);assert.equal(h.store.getState().counts.pet,0);
  const resumed=harness({io:h.io,queue:h.q});await resumed.consumer.consume(()=>true);assert.equal(resumed.store.getState().counts.pet,1);assert.equal(resumed.social.dex.deviceReceipts.length,1);
 }
});
test('pause after Native decision finishes result projection but leaves FIFO untouched until a fresh explicit connection',async()=>{
 const h=harness(),seal=h.durable.seal;let valid=true;h.durable.seal=async value=>{await seal(value);valid=false;};h.q.push(h.care());
 const result=await h.consumer.consume(()=>valid);assert.equal(result.acknowledged,false);assert.equal(h.store.getState().counts.pet,1);assert.equal(h.acks.length,0);assert.equal(h.q.length,1);
});
