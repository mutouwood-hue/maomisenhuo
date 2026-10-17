import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {accompanyParents,harness,TEST_POLICY,challengeBody,proof,hmac} from './m2-helper.mjs';
async function meet(h){const[a,b]=h.users;for(const u of[a,b]){const s=await h.ok(u,'/social-settings');await h.ok(u,'/social-settings','PUT',{baseRevision:s.revision,isDiscoverable:true,venueId:'TEST-VENUE'});}const token=await h.ok(b,'/discovery-tokens','POST',{deviceId:b.id,sessionId:b.binding.sessionId});const e=await h.ok(a,'/encounters','POST',{deviceId:a.id,sessionId:a.binding.sessionId,peerToken:token.token,method:'QR'}),other=await h.ok(b,`/encounters/${e.id}`);for(const[u,c]of[[a,e],[b,other]])await h.ok(u,`/encounters/${e.id}/proofs`,'POST',{deviceId:u.id,sessionId:u.binding.sessionId,proofBase64:proof(challengeBody(c.ownChallengeBase64,u).body,u)});return h.ok(a,`/encounters/${e.id}`);}
async function care(h,u,id){h.advance(5000);const current=await h.ok(u,'/pet-saves/current');current.save.cats[0].stats={food:50,mood:50,clean:50,energy:50};await h.ok(u,'/pet-saves/current','PUT',{baseRevision:current.revision,save:current.save});const body=Buffer.alloc(16);body.writeBigUInt64LE(BigInt(id));body.writeUInt32LE(Math.floor(h.now()/1000),8);body[12]=1;const signed=Buffer.concat([body,hmac(u.key,'BAJI-EVENT-v1',Buffer.from(u.id,'hex'),body)]);const result=await h.ok(u,`/devices/${u.id}/event-batches`,'POST',{sessionId:u.binding.sessionId,events:[{eventId:String(id),eventBase64:signed.toString('base64')}]});assert.equal(result.results[0].isSettled,true);}
test('M2 HTTP historical paid asset missing flags uses original paid snapshot rather than changed current catalog',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-paid-asset-recovery-')),dbPath=join(dir,'test.sqlite'),policy=structuredClone(TEST_POLICY);let h,sex=0;
 try{h=await harness(policy,{dbPath,randomInt:max=>max===2?sex++%2:0});const[a,b]=h.users;for(const[index,u]of[a,b].entries())for(let i=0;i<54;i++)await care(h,u,9940000+index*1000+i);
  const e=await meet(h),paid=await h.ok(a,'/breedings','POST',{encounterId:e.id,friendshipId:e.friendshipId,parentCatId:'cat-1',peerParentCatId:'cat-1'});for(const u of[a,b])await h.ok(u,`/breedings/${paid.id}/consents`,'POST',{isAccepted:true});h.advance(61000);for(const[index,u]of[a,b].entries())for(let i=0;i<3;i++)await care(h,u,9950000+index*1000+i);await accompanyParents(h);await h.ok(a,`/breedings/${paid.id}/claim`,'POST',{});const asset=(await h.ok(a,'/assets?size=100')).list.find(v=>v.source==='PLAYER_BREEDING');assert.equal(asset.kind,'TRAIT');assert.equal(asset.rarity,3);
  await h.close();const db=new DatabaseSync(dbPath);try{const row=db.prepare('SELECT body FROM social_asset WHERE id=?').get(asset.assetId),v=JSON.parse(row.body);delete v.isGiftable;delete v.isExchangeable;db.prepare('UPDATE social_asset SET body=? WHERE id=?').run(JSON.stringify(v),asset.assetId);}finally{db.close();}
  policy.version='TEST-new-paid-asset-version';Object.assign(policy.catalog.find(v=>v.id==='test-rare'),{kind:'ITEM',rarity:1,isGiftable:true,isExchangeable:true});await h.restart();const next=await meet(h);const before=await h.ok(a,'/assets?size=100');assert.equal((await h.request(a,'/exchanges','POST',{encounterId:next.id,offeredAssetId:asset.assetId})).code,47002);assert.equal((await h.request(a,'/gifts','POST',{friendshipId:next.friendshipId,assetId:asset.assetId})).code,47006);assert.deepEqual(await h.ok(a,'/assets?size=100'),before,'original paid snapshot keeps non-transferable rights, without locking or moving asset');
 }finally{await h?.close();assert.ok(dir.startsWith(join(tmpdir(),'baji-m2-paid-asset-recovery-')));await rm(dir,{recursive:true,force:true});}
});

for(const recovery of ['SAME_VERSION','NO_MAPPING','TRUSTED_COMPAT','COMPAT_MISMATCH','SAME_VERSION_MISMATCH'])test(`M2 HTTP historical minted asset missing flags recovery ${recovery}`,async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-asset-recovery-')),dbPath=join(dir,'test.sqlite'),policy=structuredClone(TEST_POLICY),config={};let h;
 try{h=await harness(policy,{config,dbPath});const[a,b]=h.users;await meet(h);const asset=(await h.ok(a,'/assets?size=100')).list.find(v=>v.catalogId==='test-gift');
  await h.close();const db=new DatabaseSync(dbPath);try{const row=db.prepare('SELECT body FROM social_asset WHERE id=?').get(asset.assetId),v=JSON.parse(row.body);assert.equal(v.isExchangeable,true);delete v.isExchangeable;delete v.isGiftable;db.prepare('UPDATE social_asset SET body=? WHERE id=?').run(JSON.stringify(v),asset.assetId);}finally{db.close();}
  if(!recovery.startsWith('SAME_VERSION')){policy.version='TEST-new-asset-version';Object.assign(policy.catalog.find(v=>v.id==='test-gift'),{isExchangeable:false,isGiftable:false});}
  if(recovery==='TRUSTED_COMPAT'||recovery==='COMPAT_MISMATCH')config.breedingCompatibilityCatalog=[{...TEST_POLICY.catalog.find(v=>v.id==='test-gift'),sourceVersion:TEST_POLICY.version,evidenceId:'TEST-original-catalog-record'}];
  if(recovery==='COMPAT_MISMATCH')Object.assign(config.breedingCompatibilityCatalog[0],{kind:'TRAIT',rarity:3});
  if(recovery==='SAME_VERSION_MISMATCH')Object.assign(policy.catalog.find(v=>v.id==='test-gift'),{kind:'TRAIT',rarity:3});
  await h.restart();const e=await meet(h);const before=await h.ok(a,'/assets?size=100');const result=await h.request(a,'/exchanges','POST',{encounterId:e.id,offeredAssetId:asset.assetId});
  if(recovery==='NO_MAPPING'||recovery.endsWith('MISMATCH')){assert.equal(result.code,47000);assert.deepEqual(await h.ok(a,'/assets?size=100'),before,'failed evidence lookup never mutates ownership or lock');}
  else{assert.equal(result.code,200,JSON.stringify(result));const x=result.data;await h.ok(a,`/exchanges/${x.id}/confirm`,'POST',{});await h.ok(b,`/exchanges/${x.id}/confirm`,'POST',{});assert.ok((await h.ok(b,'/assets?size=100')).list.some(v=>v.assetId===asset.assetId));}
 }finally{await h?.close();assert.ok(dir.startsWith(join(tmpdir(),'baji-m2-asset-recovery-')));await rm(dir,{recursive:true,force:true});}
});
