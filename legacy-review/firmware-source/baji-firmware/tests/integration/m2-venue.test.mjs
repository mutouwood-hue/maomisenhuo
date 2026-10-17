import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, TEST_POLICY, challengeBody, proof } from './m2-helper.mjs';
async function enable(h,u,venueId='TEST-VENUE') { const s=await h.ok(u,'/social-settings'); await h.ok(u,'/social-settings','PUT',{baseRevision:s.revision,isDiscoverable:true,venueId}); }
test('M2 HTTP existing encounter cannot survive both venue switches, discovery regrant or confirmed lease revocation',async()=>{
 let revoked=false;
 const policy=structuredClone(TEST_POLICY);policy.venueIds.push('TEST-VENUE-2');
 const h=await harness(policy,{venueAuthorizer:c=>revoked?null:{accountId:c.accountId,deviceId:c.deviceId,sessionId:c.sessionId,venueId:c.venueId,expiresAt:c.now+60000,scope:'PILOT_MEMBERSHIP',evidenceId:'test-venue-snapshot'}});
 try{
  const [a,b]=h.users;
  const create=async()=>{const token=await h.ok(b,'/discovery-tokens','POST',identity(b));return h.ok(a,'/encounters','POST',{...identity(a),peerToken:token.token,method:'QR'});};
  const submit=async(u,e)=>{const vo=await h.ok(u,`/encounters/${e.id}`);return h.request(u,`/encounters/${e.id}/proofs`,'POST',{...identity(u),proofBase64:proof(challengeBody(vo.ownChallengeBase64,u).body,u)});};
  await enable(h,a);await enable(h,b);let e=await create();
  await enable(h,a,'TEST-VENUE-2');await enable(h,b,'TEST-VENUE-2');
  assert.notEqual((await submit(a,e)).code,200,'both simultaneous venue switches still invalidate original encounter');
  await h.ok(a,`/encounters/${e.id}/cancel`,'POST',{});e=await create();
  for(const u of [a,b]){const s=await h.ok(u,'/social-settings');await h.ok(u,'/social-settings','PUT',{baseRevision:s.revision,isDiscoverable:false,venueId:'TEST-VENUE-2'});await enable(h,u,'TEST-VENUE-2');}
  assert.notEqual((await submit(a,e)).code,200,'regrant cannot resurrect an old encounter epoch');
  await h.ok(a,`/encounters/${e.id}/cancel`,'POST',{});e=await create();assert.equal((await submit(a,e)).code,200);assert.equal((await submit(b,e)).code,200);
  revoked=true;const asset=(await h.ok(a,'/assets?size=100')).list.find(r=>r.status==='AVAILABLE');
  assert.notEqual((await h.request(a,'/exchanges','POST',{encounterId:e.id,offeredAssetId:asset.assetId})).code,200,'confirmed encounter economy must revalidate current venue lease');
 }finally{await h.close();}
});

const identity=u=>({deviceId:u.id,sessionId:u.binding.sessionId});
test('M2 HTTP configured venue ID cannot substitute for missing server authorization',async()=>{
 const h=await harness(TEST_POLICY,{venueAuthorizer:null});
 try{const [a]=h.users;await enable(h,a);const r=await h.request(a,'/discovery-tokens','POST',identity(a));assert.equal(r.code,46000);}finally{await h.close();}
});
test('M2 HTTP venue provider lease rejects unapproved account, expiry, revocation and token venue change',async()=>{
 let members=new Set(),expiry,revoked=false;
 const policy=structuredClone(TEST_POLICY);policy.venueIds.push('TEST-VENUE-2');
 const provider=c=>!revoked&&members.has(c.accountId)?{accountId:c.accountId,deviceId:c.deviceId,sessionId:c.sessionId,venueId:c.venueId,expiresAt:expiry,scope:'PILOT_MEMBERSHIP',evidenceId:'test-scoped-member'}:null;
 const h=await harness(policy,{venueAuthorizer:provider});
 try{
  const [a,b]=h.users;members.add(b.userId);expiry=h.now()+10000;await enable(h,a);await enable(h,b);
  assert.equal((await h.request(a,'/discovery-tokens','POST',identity(a))).code,46000,'device owner is not automatically a venue member');
  members.add(a.userId);let token=await h.ok(b,'/discovery-tokens','POST',identity(b));
  h.advance(11000);assert.equal((await h.request(a,'/discovery-tokens','POST',identity(a))).code,46000);
  assert.notEqual((await h.request(a,'/encounters','POST',{...identity(a),peerToken:token.token,method:'QR'})).code,200);
  expiry=h.now()+60000;token=await h.ok(b,'/discovery-tokens','POST',identity(b));
  const e=await h.ok(a,'/encounters','POST',{...identity(a),peerToken:token.token,method:'QR'});
  revoked=true;
  assert.notEqual((await h.request(a,`/encounters/${e.id}/proofs`,'POST',{...identity(a),proofBase64:proof(challengeBody(e.ownChallengeBase64,a).body,a)})).code,200,'valid device proof cannot override revoked venue lease');
  revoked=false;await h.ok(a,`/encounters/${e.id}/cancel`,'POST',{});
  token=await h.ok(b,'/discovery-tokens','POST',identity(b));
  await enable(h,a,'TEST-VENUE-2');await enable(h,b,'TEST-VENUE-2');
  assert.notEqual((await h.request(a,'/encounters','POST',{...identity(a),peerToken:token.token,method:'QR'})).code,200,'old venue token cannot migrate when both current settings change');
 }finally{await h.close();}
});
