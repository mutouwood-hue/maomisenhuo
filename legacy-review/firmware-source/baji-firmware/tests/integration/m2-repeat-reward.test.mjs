import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {harness,TEST_POLICY,challengeBody,proof,hmac} from './m2-helper.mjs';
async function meet(h,a=h.users[0],b=h.users[1]){for(const u of [a,b]){const s=await h.ok(u,'/social-settings');await h.ok(u,'/social-settings','PUT',{baseRevision:s.revision,isDiscoverable:true,venueId:'TEST-VENUE'});}const token=await h.ok(b,'/discovery-tokens','POST',{deviceId:b.id,sessionId:b.binding.sessionId});const e=await h.ok(a,'/encounters','POST',{deviceId:a.id,sessionId:a.binding.sessionId,peerToken:token.token,method:'QR'}),other=await h.ok(b,`/encounters/${e.id}`);const dto=(u,c)=>({deviceId:u.id,sessionId:u.binding.sessionId,proofBase64:proof(challengeBody(c.ownChallengeBase64,u).body,u)});await h.ok(a,`/encounters/${e.id}/proofs`,'POST',dto(a,e));const key='repeat-final-'+e.id;const results=await Promise.all([1,2,3].map(()=>h.request(b,`/encounters/${e.id}/proofs`,'POST',dto(b,other),{key})));assert.ok(results.every(r=>r.code===200&&r.data.status==='CONFIRMED'));return e;}
test('M2 HTTP repeat reward cap is isolated per friendship after real device ownership transfer',async()=>{
 const policy=structuredClone(TEST_POLICY);policy.encounterRewards.repeatCatalogIds=['test-stamp'];policy.encounterRewards.repeatLimitPerDay=1;
 const h=await harness(policy,{privacyEligibilityProvider:c=>({accountId:c.accountId,ageBand:'14_PLUS',guardianScopes:[],evidenceId:'TEST-multi-friend-age',expiresAt:c.now+60000}),venueAuthorizer:c=>({accountId:c.accountId,deviceId:c.deviceId,sessionId:c.sessionId,venueId:c.venueId,expiresAt:c.now+60000,scope:'PILOT_MEMBERSHIP',evidenceId:'TEST-multi-friend-venue'})});
 try{const [a,b,c]=h.users;const count=async u=>(await h.ok(u,'/assets?size=100')).list.filter(v=>v.source==='ENCOUNTER_REPEAT').length;
  await meet(h);h.advance(61000);await meet(h);assert.equal(await count(a),1);h.advance(61000);await meet(h);assert.equal(await count(a),1);
  await h.ok(b,`/device-bindings/${b.id}`,'DELETE');c.id=b.id;c.key=b.key;const challenge=await h.ok(c,`/devices/${c.id}/binding-challenges`,'POST',{});c.binding=await h.ok(c,'/device-bindings','POST',{deviceId:c.id,challengeId:challenge.challengeId,proofBase64:hmac(c.key,'BAJI-BIND-v1',Buffer.from(c.id,'hex'),Buffer.from(challenge.challengeBase64,'base64')).toString('base64')});
  await meet(h,a,c);assert.equal(await count(a),1);h.advance(61000);await meet(h,a,c);assert.equal(await count(a),2,'friendship A-C has its own cap despite exhausted A-B');assert.equal(await count(c),1);assert.equal(await count(b),1);
 }finally{await h.close();}
});

test('M2 HTTP repeat reward batch daily cap survives concurrent proof retries restart and Shanghai midnight',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-repeat-'));let h;
 try{const policy=structuredClone(TEST_POLICY);policy.encounterRewards.repeatCatalogIds=['test-gift','test-stamp'];h=await harness(policy,{dbPath:join(dir,'test.sqlite')});
  h.advance(Date.parse('2026-10-14T23:55:00+08:00')-h.now());
  for(const u of h.users.slice(0,2)){const c=await h.ok(u,`/devices/${u.id}/binding-challenges`,'POST',{});u.binding=await h.ok(u,'/device-bindings','POST',{deviceId:u.id,challengeId:c.challengeId,proofBase64:hmac(u.key,'BAJI-BIND-v1',Buffer.from(u.id,'hex'),Buffer.from(c.challengeBase64,'base64')).toString('base64')});}
  const counts=async()=>Promise.all(h.users.slice(0,2).map(async u=>(await h.ok(u,'/assets?size=100')).list.filter(a=>a.source==='ENCOUNTER_REPEAT').length));
  await meet(h);assert.deepEqual(await counts(),[0,0]);
  for(let i=1;i<=3;i++){h.advance(61000);await meet(h);assert.deepEqual(await counts(),[i*2,i*2],'cap counts encounter batches, not two catalog entries');}
  await h.restart();h.advance(61000);await meet(h);assert.deepEqual(await counts(),[6,6],'persisted daily cap must survive restart and new confirmed encounter');
  h.advance(Date.parse('2026-10-15T00:00:01+08:00')-h.now());await meet(h);assert.deepEqual(await counts(),[8,8],'Shanghai day resets cap despite UTC still previous day');
  await meet(h);assert.deepEqual(await counts(),[8,8],'new day still retains repeat cooldown');
 }finally{await h?.close();assert.ok(dir.startsWith(join(tmpdir(),'baji-m2-repeat-')));await rm(dir,{recursive:true,force:true});}
});
