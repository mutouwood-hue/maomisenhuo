import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, hmac } from './m2-helper.mjs';
test('M2 HTTP ROLE18 independently verifies initiator binding, exact 75 bytes and secure idempotent replay',async()=>{
 const h=await harness();
 try{
  const [a,b,c]=h.users;
  for(const u of [a,b]){const setting=await h.ok(u,'/social-settings');await h.ok(u,'/social-settings','PUT',{baseRevision:setting.revision,isDiscoverable:true,venueId:'TEST-VENUE'});}
  const token=await h.ok(b,'/discovery-tokens','POST',{deviceId:b.id,sessionId:b.binding.sessionId});
  const e=await h.ok(a,'/encounters','POST',{deviceId:a.id,sessionId:a.binding.sessionId,peerToken:token.token,method:'QR'});
  const dto=u=>({sessionId:u.binding.sessionId,kind:18,encounterId:e.id});
  for(const u of [a,b]){
   const signed=await h.ok(u,`/devices/${u.id}/signed-objects`,'POST',dto(u),{key:`role-${u.id}`});
   const raw=Buffer.from(signed.envelopeBase64,'base64');assert.equal(raw.length,75);assert.equal(raw.subarray(0,16).toString('hex'),u.binding.sessionId.replaceAll('-',''));
   assert.deepEqual(raw.subarray(43),hmac(u.key,'BAJI-SYNC-v1',Buffer.from(u.id,'hex'),Buffer.from([18]),raw.subarray(0,43)));
   assert.equal(raw[20],1);assert.equal(raw.subarray(21,37).toString('hex'),e.id.replaceAll('-',''));assert.equal(raw.subarray(37,43).toString('hex'),a.id,'initiator authoritative creation account, not MAC ordering or requesting side');
   assert.deepEqual(await h.ok(u,`/devices/${u.id}/signed-objects`,'POST',dto(u),{key:`role-${u.id}`}),signed);
  }
  assert.notEqual((await h.request(c,`/devices/${a.id}/signed-objects`,'POST',dto(a))).code,200);
  for(const field of ['initiatorMac','role','dataBase64','transcriptHash','eventId'])assert.notEqual((await h.request(a,`/devices/${a.id}/signed-objects`,'POST',{...dto(a),[field]:'attacker'})).code,200);
  assert.notEqual((await h.request(a,`/devices/${a.id}/signed-objects`,'POST',{...dto(a),sessionId:b.binding.sessionId})).code,200);
  await h.ok(a,`/encounters/${e.id}/cancel`,'POST',{});
  assert.notEqual((await h.request(a,`/devices/${a.id}/signed-objects`,'POST',dto(a),{key:`role-${a.id}`})).code,200,'even known idempotency receipt cannot replay stale cancelled role');
 }finally{await h.close();}
});
