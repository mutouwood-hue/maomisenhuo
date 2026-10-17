import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accompanyParents, harness, TEST_POLICY, hmac, challengeBody, proof } from './m2-helper.mjs';

async function care(h, u, id, type = 1) {
  h.advance(5000);
  // This PUT restores only legacy display needs. It never advances server-authoritative XP.
  const current = await h.ok(u, '/pet-saves/current');
  current.save.cats.find(cat => cat.id === current.save.activeCatId).stats = { food: 50, mood: 50, clean: 50, energy: 50 };
  await h.ok(u, '/pet-saves/current', 'PUT', { baseRevision: current.revision, save: current.save });
  const raw = Buffer.alloc(16); raw.writeBigUInt64LE(BigInt(id)); raw.writeUInt32LE(Math.floor(h.now() / 1000), 8); raw[12] = type; raw[13] = type === 2 || type === 3 ? 3 : type === 4 ? 5 : 0;
  const signed = Buffer.concat([raw, hmac(u.key, 'BAJI-EVENT-v1', Buffer.from(u.id, 'hex'), raw)]).toString('base64');
  const receipt = await h.ok(u, `/devices/${u.id}/event-batches`, 'POST', { sessionId: u.binding.sessionId, events: [{ eventId: String(id), eventBase64: signed }] });
  assert.equal(receipt.results[0].isSettled, true, JSON.stringify(receipt));
}
async function pair(h) {
  const [a, b] = h.users;
  for (const u of [a,b]) { const state = await h.ok(u, '/social-settings'); await h.ok(u, '/social-settings', 'PUT', { baseRevision: state.revision, isDiscoverable: true, venueId: 'TEST-VENUE' }); }
  const token = await h.ok(b, '/discovery-tokens', 'POST', { deviceId: b.id, sessionId: b.binding.sessionId });
  const e = await h.ok(a, '/encounters', 'POST', { deviceId: a.id, sessionId: a.binding.sessionId, peerToken: token.token, method: 'QR' });
  const peer = await h.ok(b, `/encounters/${e.id}`);
  for (const [u,vo] of [[a,e],[b,peer]]) await h.ok(u, `/encounters/${e.id}/proofs`, 'POST', { deviceId: u.id, sessionId: u.binding.sessionId, proofBase64: proof(challengeBody(vo.ownChallengeBase64,u).body,u) });
  return h.ok(a, `/encounters/${e.id}`);
}
async function mature(h) {
  for (const [index,u] of h.users.slice(0,2).entries()) {
    for (let i=0; i<54; i++) await care(h,u,8000000+index*1000+i);
    const pets = await h.ok(u,'/social-pets'); assert.equal(pets.list[0].isAdult,true); assert.equal(pets.list[0].xp,162);
  }
}
function deterministic() { let sexes=0; return max => max===2 ? sexes++%2 : 0; }
async function start(h,e) {
  const [a,b] = h.users;
  const request = { encounterId:e.id, friendshipId:e.friendshipId, parentCatId:'cat-1', peerParentCatId:'cat-1' };
  const created = await h.ok(a,'/breedings','POST',request);
  const first = await h.ok(a,`/breedings/${created.id}/consents`,'POST',{isAccepted:true}); assert.equal(first.status,'AWAITING_CONSENT');
  const final = await h.ok(b,`/breedings/${created.id}/consents`,'POST',{isAccepted:true}); assert.equal(final.status,'INCUBATING');
  return final;
}
for(const recovery of ['SAME_VERSION','UNTRUSTED_CHANGED_VERSION','TRUSTED_COMPAT'])test(`M2 HTTP historical paid missing metadata recovery ${recovery}`,async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-old-metadata-')),dbPath=join(dir,'test.sqlite');let h;const policy=structuredClone(TEST_POLICY),config={};
 try{
  h=await harness(policy,{config,randomInt:deterministic(),dbPath});const [a,b]=h.users;await mature(h);const paid=await start(h,await pair(h));const children=structuredClone(paid.children);
  // Lead-authorized isolated historical fixture: remove only metadata from an already HTTP-paid row.
  await h.close();const db=new DatabaseSync(dbPath);try{const row=db.prepare('SELECT body FROM player_breeding WHERE id=?').get(paid.id),value=JSON.parse(row.body);assert.equal(value.status,'INCUBATING');assert.ok(value.policySnapshot.rareCatalog.length);delete value.policySnapshot.rareCatalog;db.prepare('UPDATE player_breeding SET body=? WHERE id=?').run(JSON.stringify(value),paid.id);}finally{db.close();}
  if(recovery!=='SAME_VERSION'){policy.version='TEST-new-version';Object.assign(policy.catalog.find(v=>v.id==='test-rare'),{kind:'ITEM',rarity:1,isGiftable:true,isExchangeable:true});}
  if(recovery==='TRUSTED_COMPAT')config.breedingCompatibilityCatalog=[{...TEST_POLICY.catalog.find(v=>v.id==='test-rare'),sourceVersion:TEST_POLICY.version,evidenceId:'TEST-original-release-record'},{id:'compat-not-paid',kind:'TRAIT',rarity:5,isGiftable:false,isExchangeable:false,sourceVersion:TEST_POLICY.version,evidenceId:'TEST-extra-record'}];
  await h.restart();h.advance(61000);for(let i=0;i<3;i++){await care(h,a,9920000+i);await care(h,b,9930000+i);}
  await accompanyParents(h);
   if(recovery==='UNTRUSTED_CHANGED_VERSION'){
   const before=await h.ok(a,'/pet-saves/current'),wallet=await h.ok(a,'/social-pets');assert.equal((await h.request(a,`/breedings/${paid.id}/claim`,'POST',{})).code,47000);assert.deepEqual(await h.ok(a,'/pet-saves/current'),before);assert.deepEqual(await h.ok(a,'/social-pets'),wallet);assert.deepEqual((await h.ok(a,`/breedings/${paid.id}`)).children,children,'failed metadata lookup preserves fixed paid child');
  }else for(const u of [a,b]){const claim=await h.ok(u,`/breedings/${paid.id}/claim`,'POST',{});assert.equal(claim.child.childId,children.find(v=>v.ownerId===u.userId).childId);const rewards=(await h.ok(u,'/assets?size=100')).list.filter(v=>v.source==='PLAYER_BREEDING');assert.equal(rewards.length,1);assert.equal(rewards[0].catalogId,'test-rare');assert.equal(rewards[0].kind,'TRAIT');assert.equal(rewards[0].rarity,3);assert.equal(claim.breeding.policySnapshot.rareCatalog,undefined,'server compatibility metadata not exposed');}
  if(recovery==='TRUSTED_COMPAT'){
   h.advance(61000);const newlyPaid=await start(h,await pair(h));assert.deepEqual(newlyPaid.policySnapshot.rareCatalogIds,['test-rare']);assert.equal(newlyPaid.policySnapshot.version,'TEST-new-version');assert.ok(!JSON.stringify(newlyPaid).includes('compat-not-paid'),'compat records never expand new paid entitlement');
  }
  assert.equal(policy.catalog.some(v=>v.id==='compat-not-paid'),false,'compatibility does not extend live catalog');
  assert.equal(policy.breeding.rareCatalogIds.includes('compat-not-paid'),false,'compatibility does not extend new paid allowlist');
 }finally{await h?.close();assert.ok(dir.startsWith(join(tmpdir(),'baji-m2-old-metadata-')));await rm(dir,{recursive:true,force:true});}
});

for(const metadata of ['UNCHANGED','DELETED','CHANGED'])test(`M2 HTTP paid breeding policy snapshot survives config change and database restart ${metadata}`,async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-policy-snapshot-'));let h;
 const policy=structuredClone(TEST_POLICY);
 try{
  h=await harness(policy,{randomInt:deterministic(),dbPath:join(dir,'test.sqlite')});const [a,b]=h.users;
  await mature(h);const incubation=await start(h,await pair(h));
  assert.equal(incubation.policySnapshot.careTarget,3);
  const children=structuredClone(incubation.children);
  policy.breeding.careTarget=99;policy.breeding.incubationSeconds=9999;policy.breeding.rareCatalogIds=[];policy.breeding.cancelRefundCoins=0;
  if(metadata==='DELETED')policy.catalog=policy.catalog.filter(item=>item.id!=='test-rare');
  if(metadata==='CHANGED')Object.assign(policy.catalog.find(item=>item.id==='test-rare'),{kind:'ITEM',rarity:1,isGiftable:true,isExchangeable:true});
  await h.restart();h.advance(61000);
  for(let i=0;i<3;i++){await care(h,a,9900000+i);await care(h,b,9910000+i);}
  await accompanyParents(h);
   const ready=await h.ok(a,`/breedings/${incubation.id}`);assert.equal(ready.status,'READY');assert.equal(ready.policySnapshot.careTarget,3);
  for(const u of [a,b]){const expected=children.find(child=>child.ownerId===u.userId);const claim=await h.ok(u,`/breedings/${incubation.id}/claim`,'POST',{});assert.equal(claim.child.childId,expected.childId);assert.equal(claim.child.breed,expected.breed);const rewards=(await h.ok(u,'/assets?size=100')).list.filter(asset=>asset.catalogId==='test-rare');assert.equal(rewards.length,1,'exactly one original paid reward');assert.equal(rewards[0].kind,'TRAIT');assert.equal(rewards[0].rarity,3);}
 }finally{await h?.close();assert.ok(dir.startsWith(join(tmpdir(),'baji-m2-policy-snapshot-')));await rm(dir,{recursive:true,force:true});}
});

test('M2 real HTTP authoritative adult parents each receive one fixed offspring only after signed care and time', async () => {
  const h = await harness(TEST_POLICY,{randomInt:deterministic()});
  try {
    const [a,b,outside] = h.users;
    await mature(h); const e=await pair(h);
    const balances=await Promise.all([a,b].map(u=>h.ok(u,'/social-pets')));
    const incubation=await start(h,e);
    for (const [i,u] of [a,b].entries()) assert.equal((await h.ok(u,'/social-pets')).balanceCoins,balances[i].balanceCoins-30);
    assert.notEqual((await h.request(outside,`/breedings/${incubation.id}`)).code,200);
    assert.notEqual((await h.request(a,`/breedings/${incubation.id}/claim`,'POST',{})).code,200);
    h.advance(61000);
    assert.notEqual((await h.request(a,`/breedings/${incubation.id}/claim`,'POST',{})).code,200,'elapsed wall time alone is not signed care');
    for (let i=0;i<3;i++) { await care(h,a,8100000+i); await care(h,b,8200000+i); }
    await accompanyParents(h);
   const ready=await h.ok(a,`/breedings/${incubation.id}`); assert.equal(ready.status,'READY');
    const ca=await h.ok(a,`/breedings/${incubation.id}/claim`,'POST',{}, { key: 'claim-a-original-key' });
    const cb=await h.ok(b,`/breedings/${incubation.id}/claim`,'POST',{});
    assert.notEqual(ca.child.childId,cb.child.childId); assert.equal(ca.child.isRare,true); assert.equal(cb.child.isRare,true);
    for (const [u,result] of [[a,ca],[b,cb]]) {
      assert.equal(result.save.cats.length,2);
      const retried=await h.ok(u,`/breedings/${incubation.id}/claim`,'POST',{});
      assert.equal(retried.child.childId,result.child.childId);
      assert.equal((await h.ok(u,'/social-pets')).list.length,2);
      assert.equal((await h.ok(u,'/assets?size=100')).list.filter(asset=>asset.catalogId==='test-rare').length,1);
    }
    const updated = await h.ok(a, '/pet-saves/current'); updated.save.cats[0].name = '隐私已清除后的新名字';
    await h.ok(a, '/pet-saves/current', 'PUT', { baseRevision: updated.revision, save: updated.save });
    const oldKeyRetry = await h.ok(a, `/breedings/${incubation.id}/claim`, 'POST', {}, { key: 'claim-a-original-key' });
    if (oldKeyRetry.save) assert.equal(oldKeyRetry.save.cats[0].name, '隐私已清除后的新名字', 'claim idempotency must rebuild current save or omit it, never replay cached private snapshot');
    assert.notEqual((await h.request(a,`/breedings/${incubation.id}/cancel`,'POST',{})).code,200,'claimed offspring cannot be refunded');
    const deleted = await h.ok(a, '/pet-saves/current'); deleted.save.cats = deleted.save.cats.filter(cat => cat.id !== ca.child.catId);
    await h.ok(a, '/pet-saves/current', 'PUT', { baseRevision: deleted.revision, save: deleted.save });
    h.advance(61000);
    const e2 = await pair(h), pending2 = await start(h, e2);
    h.advance(61000);
    for (let i=0;i<3;i++) { await care(h,a,8400000+i); await care(h,b,8500000+i); }
    await accompanyParents(h);
     const nextChild = await h.ok(a, `/breedings/${pending2.id}/claim`, 'POST', {});
    assert.notEqual(nextChild.child.catId, ca.child.catId, 'deleting legacy cat cannot recycle a server-owned cat ID or overwrite its profile');
    const profiles = await h.ok(a, '/social-pets'); assert.equal(profiles.list.length, 3);
    assert.ok(profiles.list.some(profile => profile.childId === ca.child.childId));
  } finally { await h.close(); }
});
test('M2 real HTTP breeding cancellation refunds both authoritative wallets once with concurrent retries', async () => {
  const h=await harness(TEST_POLICY,{randomInt:deterministic()});
  try {
    const [a,b]=h.users; await mature(h); const e=await pair(h);
    const before=await Promise.all([a,b].map(u=>h.ok(u,'/social-pets'))), incubation=await start(h,e);
    const cancelled=await Promise.all([a,b].map(u=>h.request(u,`/breedings/${incubation.id}/cancel`,'POST',{})));
    assert.ok(cancelled.every(r=>r.code===200));
    await h.ok(a,`/breedings/${incubation.id}/cancel`,'POST',{});
    for (const [i,u] of [a,b].entries()) assert.equal((await h.ok(u,'/social-pets')).balanceCoins,before[i].balanceCoins);
    assert.notEqual((await h.request(a,`/breedings/${incubation.id}/claim`,'POST',{})).code,200);
  } finally {await h.close();}
});
test('M2 isolated historical claim receipt privacy migration scrubs old save and replays current HTTP save without minting a child',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-migration-')),dbPath=join(dir,'test.sqlite');let h;
 try{
  h=await harness(TEST_POLICY,{randomInt:deterministic(),dbPath});const [a,b]=h.users;
  await mature(h);const incubation=await start(h,await pair(h));h.advance(61000);for(let i=0;i<3;i++){await care(h,a,9600000+i);await care(h,b,9700000+i);}
  await accompanyParents(h);
   const key='historical-claim-migration';const claim=await h.ok(a,`/breedings/${incubation.id}/claim`,'POST',{},{key});
  const current=await h.ok(a,'/pet-saves/current');current.save.cats[0].name='当前安全昵称';await h.ok(a,'/pet-saves/current','PUT',{baseRevision:current.revision,save:current.save});
  const authority=await h.ok(a,'/social-pets');
  await h.close();
  // Explicit Lead-approved historical migration fixture only: existing HTTP-created receipt gets legacy privacy fields.
  // No wallet/profile/child/state/entitlement is injected or changed.
  const historical=new DatabaseSync(dbPath);
  try{const row=historical.prepare('SELECT id,body FROM m2_request WHERE account_id=?').all(a.userId).find(r=>JSON.parse(r.body).response?.child?.childId===claim.child.childId);assert.ok(row);
   const value=JSON.parse(row.body);value.response.save={privateMarker:'TEST-LEGACY-PRIVATE-SNAPSHOT'};value.response.revision=1;
   historical.prepare('UPDATE m2_request SET body=? WHERE id=?').run(JSON.stringify(value),row.id);
   assert.equal(historical.prepare('SELECT version FROM schema_migration WHERE version=4').get().version,4,'historical v4 schema marker preserved; same schema retained old fields');
  }finally{historical.close();}
  await h.restart();
  const readonly=new DatabaseSync(dbPath,{readOnly:true});try{const rows=readonly.prepare('SELECT body FROM m2_request').all();assert.ok(rows.every(r=>!r.body.includes('TEST-LEGACY-PRIVATE-SNAPSHOT')));assert.ok(rows.every(r=>!JSON.parse(r.body).response?.save));}finally{readonly.close();}
  const replay=await h.ok(a,`/breedings/${incubation.id}/claim`,'POST',{},{key});assert.equal(replay.child.childId,claim.child.childId);assert.equal(replay.save.cats[0].name,'当前安全昵称');assert.deepEqual(await h.ok(a,'/social-pets'),authority);
 }finally{await h?.close();assert.ok(dir.startsWith(join(tmpdir(),'baji-m2-migration-')));await rm(dir,{recursive:true,force:true});}
});

test('M2 HTTP paid child survives full household, seven days and restart after peer claims',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-child-'));let h;
 try{
  h=await harness(TEST_POLICY,{randomInt:deterministic(),dbPath:join(dir,'test.sqlite')});const [a,b]=h.users;
  await mature(h);const incubation=await start(h,await pair(h));
  h.advance(61000);for(let i=0;i<3;i++){await care(h,a,8900000+i);await care(h,b,9000000+i);}
  await accompanyParents(h);
   const original=await h.ok(b,`/breedings/${incubation.id}`),child=original.children.find(c=>c.ownerId===b.userId);
  await h.ok(a,`/breedings/${incubation.id}/claim`,'POST',{});
  const full=await h.ok(b,'/pet-saves/current');for(let i=2;i<=6;i++)full.save.cats.push({...structuredClone(full.save.cats[0]),id:`cat-${i}`,name:`本地展示${i}`});
  await h.ok(b,'/pet-saves/current','PUT',{baseRevision:full.revision,save:full.save});
  assert.notEqual((await h.request(b,`/breedings/${incubation.id}/claim`,'POST',{})).code,200);
  assert.notEqual((await h.request(b,`/breedings/${incubation.id}/cancel`,'POST',{})).code,200,'peer already claimed: fixed remaining child cannot be dropped');
  h.advance(7*86400000+1000);await h.restart();
  for(const u of [a,b]){const login=await h.ok(null,'/sessions','POST',{username:`m2user_${u===a?0:1}`,password:'TEST-ONLY-password-24'});u.token=login.accessToken;}
  const resumed=await h.ok(b,`/breedings/${incubation.id}`),preserved=resumed.children.find(c=>c.ownerId===b.userId);assert.equal(preserved.childId,child.childId);assert.equal(preserved.isClaimed,false);
  const freed=await h.ok(b,'/pet-saves/current');freed.save.cats=freed.save.cats.filter(c=>c.id!=='cat-6');
  await h.ok(b,'/pet-saves/current','PUT',{baseRevision:freed.revision,save:freed.save});
  const claimed=await h.ok(b,`/breedings/${incubation.id}/claim`,'POST',{});assert.equal(claimed.child.childId,child.childId);assert.equal(claimed.child.breed,child.breed);assert.equal(claimed.child.sex,child.sex);
 }finally{await h?.close();assert.ok(dir.startsWith(join(tmpdir(),'baji-m2-child-')));await rm(dir,{recursive:true,force:true});}
});

test('M2 HTTP legacy five cats plus paid pending child cannot overbook via a second trusted parent pair', async () => {
  let calls=0; const choices=[0,1,0,1,0,0];
  const h=await harness(TEST_POLICY,{randomInt:max=>max===2?(choices[calls++]??0):0});
  try {
    const [a,b]=h.users; await mature(h); const first=await start(h,await pair(h));
    h.advance(61000); for(let i=0;i<3;i++){await care(h,a,8600000+i);await care(h,b,8700000+i);}
    await accompanyParents(h);
     await h.ok(a,`/breedings/${first.id}/claim`,'POST',{});await h.ok(b,`/breedings/${first.id}/claim`,'POST',{});
    for(const [index,u] of [a,b].entries()) {
      const save=await h.ok(u,'/pet-saves/current');save.save.activeCatId='cat-2';
      await h.ok(u,'/pet-saves/current','PUT',{baseRevision:save.revision,save:save.save});
      await h.ok(u,`/device-bindings/${u.id}`,'DELETE');
      const c=await h.ok(u,`/devices/${u.id}/binding-challenges`,'POST',{});
      u.binding=await h.ok(u,'/device-bindings','POST',{deviceId:u.id,challengeId:c.challengeId,proofBase64:hmac(u.key,'BAJI-BIND-v1',Buffer.from(u.id,'hex'),Buffer.from(c.challengeBase64,'base64')).toString('base64')});
      for(let i=0;i<20;i++)await care(h,u,8800000+index*1000+i,2);
      const profile=(await h.ok(u,'/social-pets')).list.find(p=>p.catId==='cat-2');assert.equal(profile.isAdult,true);
      const current=await h.ok(u,'/pet-saves/current');
      for(let i=3;i<=5;i++) current.save.cats.push({...structuredClone(current.save.cats[0]),id:`cat-${i}`,name:`展示猫${i}`});
      await h.ok(u,'/pet-saves/current','PUT',{baseRevision:current.revision,save:current.save});
    }
    const pending=await start(h,await pair(h));
    const e=await pair(h),proposal=await h.ok(a,'/breedings','POST',{encounterId:e.id,friendshipId:e.friendshipId,parentCatId:'cat-2',peerParentCatId:'cat-2'});
    await h.ok(a,`/breedings/${proposal.id}/consents`,'POST',{isAccepted:true});
    const balances=await Promise.all([a,b].map(u=>h.ok(u,'/social-pets')));
    const refused=await h.request(b,`/breedings/${proposal.id}/consents`,'POST',{isAccepted:true});
    assert.notEqual(refused.code,200,'max(legacy five, trusted two) plus two reserved children exceeds six');
    for(const [i,u] of [a,b].entries())assert.equal((await h.ok(u,'/social-pets')).balanceCoins,balances[i].balanceCoins,'failed capacity cannot partially debit either owner');
    await h.ok(a,`/breedings/${pending.id}/cancel`,'POST',{});
    const retry=await h.ok(b,`/breedings/${proposal.id}/consents`,'POST',{isAccepted:true});assert.equal(retry.status,'INCUBATING','cancel releases capacity and proposed entitlement remains recoverable');
    await h.ok(a,`/breedings/${proposal.id}/cancel`,'POST',{});
  }finally{await h.close();}
});

test('M2 real HTTP skill learning requires trusted source skill and freezes one outcome per encounter', async()=>{
  const h=await harness(TEST_POLICY,{randomInt:deterministic()});
  try {
    const [a,b]=h.users;
    for(let i=0;i<5;i++) await care(h,b,8300000+i,2);
    assert.equal((await h.ok(b,'/skills')).list.find(s=>s.skillId==='test-cooking').isLearned,true);
    const e=await pair(h), body={encounterId:e.id,skillId:'test-cooking'};
    const first=await h.ok(a,'/skill-learnings','POST',body); assert.equal(first.status,'LEARNED');
    const next=await h.ok(a,'/skill-learnings','POST',body); assert.deepEqual(next,first);
    assert.equal((await h.ok(a,'/skills')).list.filter(s=>s.skillId==='test-cooking'&&s.isLearned).length,1);
  } finally {await h.close();}
});
