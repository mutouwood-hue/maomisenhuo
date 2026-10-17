const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBridge,mergeJournal,mergeIdentity}=require('../web/offline-device-backup.js');
const {harness,db,ID}=require('./event-fixture.cjs');
function bridge(h,options={}){return createBridge({storage:h.io,ledger:h.ledger,source:h.source,durable:h.durable,originalExport:()=>h.store.exportSave(),...options});}
test('complete backup contains original game, social, stable wire identity and durable receipts; fresh restore does not grant again',async()=>{
 const h=harness(),e=h.gift();h.q.push(e);await h.consumer.consume(()=>true);const exported=bridge(h).exportData(),p=JSON.parse(exported);
 assert.equal(p.version,2);assert.equal(p.__cflocal2Backup.ledger.records[e.eventId].status,'applied');assert.equal(p.__cflocal2Backup.social.gifts.inbox[0].open,true);
 const fresh=harness();let reloaded=0;assert.equal((await bridge(fresh,{reload:()=>reloaded++}).restore(exported)).ok,true);assert.equal(reloaded,1);fresh.q.push(e);await fresh.consumer.consume(()=>true);
 assert.equal(fresh.store.getState().inventory.flower,1);assert.equal(fresh.social.gifts.inbox.length,1);assert.equal(fresh.acks[0].status,'duplicate');
});
test('same-generation old original import is blocked before real store rollback; applied reward and dedup both remain',async()=>{
 const h=harness(),old=h.store.exportSave(),e=h.care();h.q.push(e);await h.consumer.consume(()=>true);const before=[...h.io.values];
 await assert.rejects(()=>bridge(h).restore(old),/备份缺少本机已结算/);assert.deepEqual([...h.io.values],before);
 assert.equal(Object.keys(h.ledger.snapshot().records).length,1);h.q.push(e);await h.consumer.consume(()=>true);assert.equal(h.store.getState().counts.pet,1);assert.equal(h.acks.at(-1).status,'duplicate');
});
test('older complete backup unions receipt history and never rolls adapter sequences backward',async()=>{
 const h=harness();h.io.setItem(db.JOURNAL,JSON.stringify({schema:1,clientId:'owner',devices:{[ID]:{nextSeq:2,syncRevision:1,lastSemantic:null,pending:null}}}));
 h.q.push(h.care('pet',1));await h.consumer.consume(()=>true);const old=bridge(h).exportData();h.q.push(h.care('water',2));await h.consumer.consume(()=>true);
 const current=bridge(h).exportData(),advanced={schema:1,clientId:'owner',devices:{[ID]:{nextSeq:9,syncRevision:6,lastSemantic:'advanced',pending:null}}};h.io.setItem(db.JOURNAL,JSON.stringify(advanced));
 await assert.rejects(()=>bridge(h).restore(old),/备份缺少本机已结算/);assert.equal(h.store.getState().counts.drink,1);await bridge(h).restore(current);
 assert.equal(Object.keys(h.ledger.snapshot().records).length,2);assert.deepEqual(JSON.parse(h.io.getItem(db.JOURNAL)),advanced);h.q.push(h.care('water',2));await h.consumer.consume(()=>true);assert.equal(h.acks.at(-1).status,'duplicate');
});
test('backup association detects a same-cat game rollback mixed with newer receipts',async()=>{
 const h=harness(),old=JSON.parse(h.store.exportSave());h.q.push(h.care());await h.consumer.consume(()=>true);
 const complete=JSON.parse(bridge(h).exportData());complete.cats=old.cats;const before=[...h.io.values];
 await assert.rejects(()=>bridge(h).restore(JSON.stringify(complete)),/备份关联不符/);assert.deepEqual([...h.io.values],before);assert.equal(h.store.getState().counts.pet,1);
});
test('restore never overwrites conflicting receipts, malformed social metadata, an owner or unknown pending command',async()=>{
 const h=harness();h.q.push(h.care());await h.consumer.consume(()=>true);const good=JSON.parse(bridge(h).exportData());
 for(const change of [p=>p.__cflocal2Backup.ledger.records[ID+':1'].saveDigest='b'.repeat(64),p=>p.__cflocal2Backup.social={v:1},p=>p.__cflocal2Backup.ledger.pending={kind:'event'}]){
  const p=structuredClone(good);change(p);const before=[...h.io.values];await assert.rejects(()=>bridge(h).restore(JSON.stringify(p)));assert.deepEqual([...h.io.values],before);
 }
 const d={nextSeq:2,syncRevision:1,lastSemantic:null,pending:{id:'a',seq:2,op:'ack',data:{counter:1}}};const j={schema:1,clientId:'one',devices:{[ID]:d}};
 assert.throws(()=>mergeJournal(j,{...j,clientId:'two'}),/owner/);assert.throws(()=>mergeJournal(j,{...j,devices:{[ID]:{...d,pending:{...d.pending,id:'b'}}}}),/未知指令冲突/);
 assert.equal(mergeJournal(j,{...j,devices:{[ID]:{...d,pending:null}}}).devices[ID].pending.id,'a');
});
test('busy or connected import fails before any write; damaged original JSON preserves all bytes',async()=>{
 const h=harness(),raw=bridge(h).exportData(),before=[...h.io.values];await assert.rejects(()=>bridge(h,{connected:()=>true}).restore(raw),/断开/);h.setBusy(true);await assert.rejects(()=>bridge(h).restore(raw),/互动/);h.setBusy(false);await assert.rejects(()=>bridge(h).restore('{broken'));assert.deepEqual([...h.io.values],before);
});
for(const phase of ['restore-prepared','image:0','image:1','image:2','before-finalize'])test('backup crash at '+phase+' resumes all imported images and receipt history together',async()=>{
 const from=harness();from.q.push(from.gift());await from.consumer.consume(()=>true);const raw=bridge(from).exportData();let hit=false;
 const into=harness({walFault:p=>{if(p===phase&&!hit){hit=true;throw Error('crash');}}});await assert.rejects(()=>bridge(into).restore(raw));assert.equal(hit,true);
 const resumed=harness({io:into.io});assert.equal(resumed.store.getState().inventory.flower,1);assert.equal(resumed.social.gifts.inbox.length,1);assert.equal(Object.keys(resumed.ledger.snapshot().records).length,1);assert.equal(resumed.ledger.snapshot().pending,null);
});
test('identity merge cannot silently rebind another cat or assign one wire ID to two generations',()=>{
 const cat={fingerprint:'old',id:'cat-00000000-0000-4000-8000-000000000001'},local={schema:1,cats:[cat],bindings:{[ID]:'old'}};
 assert.throws(()=>mergeIdentity(local,{schema:1,cats:[{...cat,fingerprint:'new'}],bindings:{[ID]:'new'}}),/身份冲突/);
 assert.throws(()=>mergeIdentity(local,{schema:1,cats:[{fingerprint:'new',id:'cat-00000000-0000-4000-8000-000000000002'}],bindings:{[ID]:'new'}}),/另一只/);
});
test('import never reports success before Native confirmation; unknown committed full restore is authoritative at restart',async()=>{
 const from=harness();from.q.push(from.gift());await from.consumer.consume(()=>true);const raw=bridge(from).exportData();
 for(const committed of [false,true]){
  const into=harness(),seal=into.durable.seal;into.durable.seal=async value=>{if(committed)await seal(value);throw Error('Native unknown');};let reloads=0;
  await assert.rejects(bridge(into,{reload:()=>reloads++}).restore(raw),/unknown/);assert.equal(reloads,0);assert.equal(into.store.getState().inventory.flower,0);
  const restarted=harness({io:into.io});assert.equal(restarted.store.getState().inventory.flower,committed?1:0);assert.equal(Object.keys(restarted.ledger.snapshot().records).length,committed?1:0);
 }
});
