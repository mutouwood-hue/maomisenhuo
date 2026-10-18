const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {harness,db,NOW}=require('./event-fixture.cjs');
const {createBridge}=require('../web/offline-device-backup.js');
const native=require('../web/offline-durable-store.js');
const PHOTO='data:image/jpeg;base64,/9j/2Q==';
const bridge=(h,options={})=>createBridge({storage:h.io,ledger:h.ledger,source:h.source,durable:h.durable,originalExport:()=>h.store.exportSave(),...options});
function graduate(h){const p=JSON.parse(h.store.exportSave());p.cats[0].xp=9999;p.cats[0].adultAt=NOW-30*864e5;p.cats[0].joinedAt=NOW-30*864e5;assert.equal(h.store.importSave(JSON.stringify(p)).ok,true);assert.equal(h.store.graduate('cat-1',{heirName:'下一代',heirSex:'female',letter:'纪念信'}).ok,true);h.io.setItem('pet-grad-photo:cat-1',PHOTO);}
function resign(p){const metadata={...p.__cflocal2Backup};delete metadata.binding;const game={...p};delete game.__cflocal2Backup;p.__cflocal2Backup.binding=db.sha256(db.canonical({game,metadata}));return JSON.stringify(p);}
test('v2 exports only game-linked JPEG; living/private/unknown keys are never read or exported',()=>{
 const h=harness();graduate(h);const privateKeys=['pg_bk_key','pg-life-geo','pg-life-moments','pg-life-hist','pg-life-names','cat-dialogue:private','pet-grad-photo:cat-999'];for(const key of privateKeys)h.io.setItem(key,'PRIVATE_SENTINEL');
 const get=h.io.getItem;h.io.getItem=key=>{assert.ok(!privateKeys.includes(key),'must not read '+key);return get(key);};const raw=bridge(h).exportData(),p=JSON.parse(raw);assert.ok(!raw.includes('PRIVATE_SENTINEL'));assert.equal(p.__cflocal2Backup.schema,2);assert.equal(p.__cflocal2Backup.memorial.photos[0].sha256,crypto.createHash('sha256').update(PHOTO).digest('hex'));assert.equal(p.graduates[0].letter,'纪念信');assert.ok(p.world);assert.ok(p.__cflocal2Backup.social.world);
});
test('restore atomically imports linked photos plus graduation records and retains local private bytes',async()=>{
 const from=harness();graduate(from);const into=harness();into.io.setItem('pg-life-geo','private geo');await bridge(into).restore(bridge(from).exportData());assert.equal(into.io.getItem('pet-grad-photo:cat-1'),PHOTO);assert.equal(JSON.parse(into.io.getItem(db.MEMORIAL)).photos.length,1);assert.equal(into.io.getItem('pg-life-geo'),'private geo');assert.equal(into.store.getState().graduates[0].letter,'纪念信');
});
test('allowlist/types/sizes/hash and graduation appearance reject even re-signed input without a single write',async()=>{
 const from=harness();graduate(from);const good=JSON.parse(bridge(from).exportData());for(const mutate of [p=>p.__cflocal2Backup.memorial.extra='private',p=>p.__cflocal2Backup.memorial.photos[0].key='pg_bk_key',p=>p.__cflocal2Backup.memorial.photos[0].type='image/svg+xml',p=>p.__cflocal2Backup.memorial.photos[0].sha256='a'.repeat(64),p=>p.graduates[0].outfit='cap',p=>p.__cflocal2Backup.memorial.photos[0].data='data:image/jpeg;base64,/9j/'+ 'A'.repeat(160000)]){
  const into=harness(),p=structuredClone(good);mutate(p);const before=[...into.io.values],writes=into.io.writes.length;await assert.rejects(bridge(into).restore(resign(p)));assert.deepEqual([...into.io.values],before);assert.equal(into.io.writes.length,writes);
 }
});
test('old game/world progress and existing social-world edits are not overwritten',async()=>{
 const h=harness(),old=bridge(h).exportData();let game=JSON.parse(h.store.exportSave());game.world.completed.walk=2;assert.equal(h.store.importSave(JSON.stringify(game)).ok,true);const before=[...h.io.values];await assert.rejects(bridge(h).restore(old),/世界进度/);assert.deepEqual([...h.io.values],before);
 const from=harness(),into=harness();into.social.world.log.push({fid:'local',day:'today',seed:7});into.source.flush();const unchanged=[...into.io.values];await assert.rejects(bridge(into).restore(bridge(from).exportData()),/世界纪念/);assert.deepEqual([...into.io.values],unchanged);
});
test('unchanged own backup remains restorable after export clock advances',async()=>{
  let time=NOW;const h=harness({clock:()=>time});const raw=bridge(h).exportData();time+=1000;
  assert.equal((await bridge(h).restore(raw)).ok,true);
});
test('new committed care progress is protected without using export timestamp',async()=>{
  const h=harness(),raw=bridge(h).exportData();assert.equal(h.store.act('pet').ok,true);
  const before=[...h.io.values];await assert.rejects(bridge(h).restore(raw),/养成进度|照料记录/);assert.deepEqual([...h.io.values],before);
});
test('old backup cannot erase a newly adopted companion and its care',async()=>{
 const h=harness(),raw=bridge(h).exportData();assert.equal(h.store.adoptCat({breed:'orange',name:'新伙伴',sex:'male'}).ok,true);assert.equal(h.store.act('pet').ok,true);
 const before=[...h.io.values];await assert.rejects(bridge(h).restore(raw),/已领养/);assert.deepEqual([...h.io.values],before);
});
test('older or conflicting local graduation/photo fails before Native seal and local writes',async()=>{
 const h=harness(),old=bridge(h).exportData();graduate(h);const before=[...h.io.values];await assert.rejects(bridge(h).restore(old),/毕业纪念/);assert.deepEqual([...h.io.values],before);
 const other=harness();graduate(other);other.io.setItem('pet-grad-photo:cat-1','data:image/jpeg;base64,/9j/AAAA');const conflict=[...other.io.values];await assert.rejects(bridge(other).restore(bridge(h).exportData()),/照片.*冲突/);assert.deepEqual([...other.io.values],conflict);
});
for(const phase of ['restore-prepared','image:0','image:1','image:2','image:3','before-finalize'])test('photo bundle import crash '+phase+' rolls forward at restart without another award',async()=>{
 const from=harness();graduate(from);let hit=false;const into=harness({walFault:p=>{if(p===phase&&!hit){hit=true;throw Error('crash');}}});await assert.rejects(bridge(into).restore(bridge(from).exportData()));assert.equal(hit,true);native.recover(into.io.nativeAuthority.entries,into.io);const resumed=db.createStore(into.io);resumed.recover();assert.equal(into.io.getItem('pet-grad-photo:cat-1'),PHOTO);assert.equal(resumed.snapshot().pending,null);assert.equal(JSON.parse(into.io.getItem(db.GAME)).graduates[0].outfit,'none');
});
test('Native seal auto-captures bundle for normal events and cold recovery restores it',async()=>{
 const h=harness();graduate(h);let entries={},revision=0;const rpc=async(op,args)=>op==='read'?{schema:1,revision,entries,foreground:true}:(entries={...entries,...args.updates},{persisted:true,revision:++revision,foreground:true,hashes:Object.fromEntries(Object.entries(args.updates).map(([k,v])=>[k,db.sha256(v)]))});const client=native.createClient({rpc,storage:h.io});await client.initialize();const token='00000000-0000-4000-8000-000000000001';await client.seal({game:native.stamped(h.store.exportSave(),token),social:native.stamped(h.io.getItem(db.SOCIAL),token),ledger:{...h.ledger.snapshot(),commitToken:token},token});assert.equal(JSON.parse(entries[db.MEMORIAL]).photos[0].data,PHOTO);const cold=harness().io;native.recover(entries,cold);assert.equal(cold.getItem('pet-grad-photo:cat-1'),PHOTO);
 // Matching committed projections retain phone updates/deletions, rather than reviving deleted photos.
 cold.values.delete('pet-grad-photo:cat-1');assert.equal(native.recover(entries,cold).projected,false);assert.equal(cold.getItem('pet-grad-photo:cat-1'),null);
});
test('event seal bundle-only drift never rolls back later phone care or social updates',async()=>{
 const h=harness();graduate(h);let entries={},revision=0;const client=native.createClient({storage:h.io,rpc:async(op,args)=>op==='read'?{schema:1,revision,entries,foreground:true}:(entries={...entries,...args.updates},{persisted:true,revision:++revision,foreground:true,hashes:Object.fromEntries(Object.entries(args.updates).map(([k,v])=>[k,db.sha256(v)]))})});await client.initialize();const token='00000000-0000-4000-8000-000000000001',game=native.stamped(h.store.exportSave(),token),social=native.stamped(h.io.getItem(db.SOCIAL),token),ledger={...h.ledger.snapshot(),commitToken:token};await client.seal({game,social,ledger,token});h.io.setItem(db.GAME,game);h.io.setItem(db.SOCIAL,social);h.io.setItem(db.KEY,JSON.stringify(ledger));
 const later={...JSON.parse(game),coins:99};later.cats[0].counts.pet+=1;h.io.setItem(db.GAME,JSON.stringify(later));h.io.setItem(db.SOCIAL,JSON.stringify({...JSON.parse(social),lastPhoneNote:'new'}));const gameBefore=h.io.getItem(db.GAME),socialBefore=h.io.getItem(db.SOCIAL);assert.equal(h.io.getItem(db.MEMORIAL),null);assert.equal(native.recover(entries,h.io).projected,false);assert.equal(h.io.getItem(db.GAME),gameBefore);assert.equal(h.io.getItem(db.SOCIAL),socialBefore);assert.equal(JSON.parse(h.io.getItem(db.MEMORIAL)).photos[0].data,PHOTO);
  h.io.values.delete(db.MEMORIAL);h.io.values.delete('pet-grad-photo:cat-1');assert.equal(native.recover(entries,h.io).projected,false);assert.equal(h.io.getItem('pet-grad-photo:cat-1'),null);assert.equal(h.io.getItem(db.GAME),gameBefore);
});
test('Native projection crash before photo retries even after all core tokens match',async()=>{
 const from=harness();graduate(from);const into=harness();await bridge(into).restore(bridge(from).exportData());const entries=into.io.nativeAuthority.entries,cold=harness().io;let crashed=false;cold.setFault((key)=>{if(key==='pet-grad-photo:cat-1'&&!crashed){crashed=true;throw Error('photo quota');}});assert.throws(()=>native.recover(entries,cold),/quota/);assert.equal(cold.getItem(db.MEMORIAL),null);assert.notEqual(JSON.parse(cold.getItem(db.GAME)).__cflocal2Commit,JSON.parse(entries[db.GAME]).__cflocal2Commit);assert.notEqual(JSON.parse(cold.getItem(db.SOCIAL)).__cflocal2Commit,JSON.parse(entries[db.SOCIAL]).__cflocal2Commit);assert.notEqual(JSON.parse(cold.getItem(db.KEY))?.commitToken,JSON.parse(entries[db.KEY]).commitToken);cold.setFault(null);native.recover(entries,cold);assert.equal(cold.getItem('pet-grad-photo:cat-1'),PHOTO);
});
test('five managed WAL images accepted, unknown sixth denied before seal',()=>{
 const h=harness();graduate(h);const token='00000000-0000-4000-8000-000000000001',game=h.store.exportSave(),images=[{key:db.GAME,before:h.io.getItem(db.GAME),after:game},{key:db.SOCIAL,before:h.io.getItem(db.SOCIAL),after:h.io.getItem(db.SOCIAL)},{key:db.IDENTITY,before:h.io.getItem(db.IDENTITY),after:h.io.getItem(db.IDENTITY)},{key:db.JOURNAL,before:null,after:JSON.stringify({schema:1,clientId:'test',devices:{}})},{key:db.MEMORIAL,before:null,after:JSON.stringify(db.collectMemorial(h.io,JSON.parse(game)))}];assert.doesNotThrow(()=>h.ledger.previewRestore({records:{},token,images}));assert.throws(()=>h.ledger.previewRestore({records:{},token,images:[...images,{key:'pg-life-geo',before:null,after:'{}'}]}),/恢复日志/);
});
test('valid explicit backups repair corrupt local game without resetting event protection',async()=>{
  const from=harness(),raw=bridge(from).exportData(),into=harness();into.io.setItem(db.GAME,'{broken');
  assert.equal((await bridge(into,{originalExport:()=>'{broken'}).restore(raw)).ok,true);
  assert.doesNotThrow(()=>JSON.parse(into.io.getItem(db.GAME)));
});
test('legacy schema1/game-only backups remain importable without claiming missing photo support',async()=>{
 const h=harness(),v2=JSON.parse(bridge(h).exportData());v2.__cflocal2Backup.schema=1;delete v2.__cflocal2Backup.memorial;assert.equal((await bridge(harness()).restore(resign(v2))).ok,true);assert.equal((await bridge(harness()).restore(h.store.exportSave())).ok,true);
});
