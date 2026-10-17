// Production 025 consumer + actual original vu store; Native/BLE are memory fixtures.
// No Android, NVS, physical touch, fsync or real rewards are exercised.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,ID}=require('../../artifacts/html-offline-candidate/ui025/source/tests/event-fixture.cjs');

test('physical-source feed plans original cost/stats/xp/count then durable receipt and ACK',async()=>{
  const h=harness(),before=h.store.getState(),event=h.care('feed');
  h.q.push(event);const result=await h.consumer.consume(()=>true),after=h.store.getState();
  assert.equal(result.acknowledged,true);
  assert.equal(after.coins,before.coins-3);
  assert.equal(after.xp,before.xp+8);
  assert.equal(after.stats.food,Math.min(100,before.stats.food+25));
  assert.equal(after.stats.mood,Math.min(100,before.stats.mood+3));
  assert.equal(after.stats.clean,Math.max(0,before.stats.clean-2));
  assert.equal(after.counts.feed,before.counts.feed+1);
  assert.equal(h.acks.length,1);assert.equal(h.acks[0].persisted,true);
  assert.equal(h.acks[0].status,'applied');
  const record=h.ledger.find(event);assert.equal(record.status,'applied');
  assert.match(record.saveDigest,/^[0-9a-f]{64}$/);
  h.durable.confirm(record);
});

test('same feed event is duplicate ACK with no second cost or growth',async()=>{
  const h=harness(),event=h.care('feed');h.q.push(event);
  await h.consumer.consume(()=>true);const settled=h.store.getState();
  h.q.push(event);await h.consumer.consume(()=>true);const again=h.store.getState();
  for(const k of ['coins','xp'])assert.equal(again[k],settled[k]);
  assert.equal(again.stats.food,settled.stats.food);
  assert.equal(again.counts.feed,settled.counts.feed);
  assert.equal(h.acks[1].status,'duplicate');
  assert.equal(h.social.dex.deviceReceipts.length,1);
});

test('phone busy, wrong provenance, and missing acknowledged history cannot award or ACK feed',async()=>{
  const busy=harness();busy.q.push(busy.care('feed'));busy.setBusy(true);
  assert.equal((await busy.consumer.consume(()=>true)).waiting,true);
  assert.equal(busy.acks.length,0);assert.equal(busy.store.getState().counts.feed,0);
  const fake=harness();fake.q.push({...fake.care('feed'),source:'phone_snapshot'});
  await assert.rejects(fake.consumer.consume(()=>true),/来源或编号/);
  assert.equal(fake.acks.length,0);assert.equal(fake.store.getState().counts.feed,0);
  const missing=harness();missing.state.device.lastAck=1;
  missing.q.push(missing.care('feed',2));
  await assert.rejects(missing.consumer.consume(()=>true),/缺少设备已确认/);
  assert.equal(missing.acks.length,0);assert.equal(missing.store.getState().counts.feed,0);
  assert.equal(Object.keys(missing.ledger.snapshot().records).length,0);
});

test('same event ID with changed action is rejected after a settled feed',async()=>{
  const h=harness(),event=h.care('feed');h.q.push(event);
  await h.consumer.consume(()=>true);const before=h.store.getState();
  h.q.push({...event,action:'pet'});
  await assert.rejects(h.consumer.consume(()=>true),/编号内容/);
  assert.equal(h.acks.length,1);assert.equal(h.store.getState().coins,before.coins);
  assert.equal(h.store.getState().counts.pet,0);
  assert.equal(h.ledger.find(event).event.eventId,ID+':1');
});

test('original full-food or insufficient-coins eligibility makes a durable non-award receipt',async()=>{
  for(const kind of ['full','coins']){
    const h=harness(),raw=JSON.parse(h.store.exportSave());
    if(kind==='full')raw.cats[0].stats.food=95;else raw.coins=2;
    assert.equal(h.store.importSave(JSON.stringify(raw)).ok,true);
    const before=h.store.getState(),event=h.care('feed');h.q.push(event);
    await h.consumer.consume(()=>true);const after=h.store.getState();
    assert.equal(after.coins,before.coins);assert.equal(after.xp,before.xp);
    assert.equal(after.counts.feed,0);assert.equal(after.stats.food,before.stats.food);
    assert.equal(h.acks[0].status,'quarantined');
    assert.equal(h.ledger.find(event).status,'quarantined');
  }
});

test('risk characterization: distinct feed counters at identical fixture time do not share original closure cooldown',async()=>{
  const h=harness();h.q.push(h.care('feed',1));
  await h.consumer.consume(()=>true);
  h.q.push(h.care('feed',2));await h.consumer.consume(()=>true);
  assert.equal(h.store.getState().counts.feed,2);
  assert.equal(h.store.getState().coins,24);
  assert.equal(h.store.getState().xp,16);
  assert.equal(h.store.getState().stats.food,100);
  assert.deepEqual(h.acks.map(a=>a.status),['applied','applied']);
});
