import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { challengeBody, proof } from './m2-helper.mjs';
import { harness, environmentEvent, hmac } from './m2-helper.mjs';
for(const scenario of ['EXTREME_DATE','BLANK_EVIDENCE'])test(`M2 HTTP eligibility ${scenario} returns INVALID_PROVIDER rather than 500`,async()=>{
 const h=await harness(undefined,{privacyEligibilityProvider:c=>({accountId:c.accountId,ageBand:'14_PLUS',guardianScopes:[],evidenceId:scenario==='BLANK_EVIDENCE'?'   ':'test-date',expiresAt:scenario==='EXTREME_DATE'?Number.MAX_SAFE_INTEGER:c.now+60000})});
 try{const [a]=h.users;assert.equal((await h.ok(a,'/privacy-eligibility')).status,'INVALID_PROVIDER');assert.equal((await grant(h,a)).code,41003);}finally{await h.close();}
});

for(const stage of ['PROOF','CREATE','EXPIRED_TOKEN','INVALID_PEER_VENUE'])test(`M2 HTTP opposite participant request reconciles invalid peer eligibility and physically clears derived environment ${stage}`,async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-peer-eligibility-')),dbPath=join(dir,'test.sqlite');let h,badOwner=null,invalidVenueOwner=null;
 try{
  h=await harness(undefined,{dbPath,venueAuthorizer:c=>c.accountId===invalidVenueOwner?null:{accountId:c.accountId,deviceId:c.deviceId,sessionId:c.sessionId,venueId:c.venueId,expiresAt:c.now+60000,scope:'PILOT_MEMBERSHIP',evidenceId:'TEST-peer-venue'},privacyEligibilityProvider:c=>({accountId:c.accountId,ageBand:c.accountId===badOwner?'UNKNOWN':'14_PLUS',guardianScopes:[],evidenceId:'test-peer-age',expiresAt:c.now+60000})});const [a,b]=h.users;
  for(const u of [a,b]){const s=await h.ok(u,'/social-settings');await h.ok(u,'/social-settings','PUT',{baseRevision:s.revision,isDiscoverable:true,venueId:'TEST-VENUE'});}
  const lifeConsent=await h.ok(b,'/consents');await h.ok(b,'/consents','PUT',life(lifeConsent.revision));const enabled=await grant(h,b);assert.equal(enabled.code,200);
  h.advance(2000);await h.ok(b,'/environment-events','POST',{consentRevision:enabled.data.revision,events:[{id:'9800001',deviceId:b.id,signedEventBase64:environmentEvent(b,{id:'9800001',seconds:Math.floor(h.now()/1000),revision:enabled.data.revision})}]});
  const token=await h.ok(b,'/discovery-tokens','POST',{deviceId:b.id,sessionId:b.binding.sessionId});const e=stage==='PROOF'?await h.ok(a,'/encounters','POST',{deviceId:a.id,sessionId:a.binding.sessionId,peerToken:token.token,method:'QR'}):null;
  const count=()=>{const db=new DatabaseSync(dbPath,{readOnly:true});try{return db.prepare('SELECT count(*) n FROM environment_event WHERE account_id=?').get(b.userId).n;}finally{db.close();}};
  assert.equal(count(),1);badOwner=b.userId;
  // B never requests after its provider becomes invalid; A's peer-linked request must reconcile B before business validation.
  if(stage==='EXPIRED_TOKEN'||stage==='INVALID_PEER_VENUE'){
    if(stage==='EXPIRED_TOKEN')h.advance(61000);else invalidVenueOwner=b.userId;
    assert.notEqual((await h.request(a,'/encounters','POST',{deviceId:a.id,sessionId:a.binding.sessionId,peerToken:token.token,method:'QR'})).code,200);assert.equal(count(),1,'invalid peer venue or expired token cannot clear private rows');return;
   }
   if(stage==='CREATE'){const outsider=h.users[2];assert.notEqual((await h.request(outsider,'/encounters','POST',{deviceId:a.id,sessionId:a.binding.sessionId,peerToken:token.token,method:'QR'})).code,200);assert.equal(count(),1,'unauthorized third party cannot clear peer data');assert.notEqual((await h.request(a,'/encounters','POST',{deviceId:a.id,sessionId:b.binding.sessionId,peerToken:token.token,method:'QR'})).code,200);assert.equal(count(),1,'wrong caller session cannot clear peer data');}
   const rejected=stage==='CREATE'?await h.request(a,'/encounters','POST',{deviceId:a.id,sessionId:a.binding.sessionId,peerToken:token.token,method:'QR'}):await h.request(a,`/encounters/${e.id}/proofs`,'POST',{deviceId:a.id,sessionId:a.binding.sessionId,proofBase64:proof(challengeBody(e.ownChallengeBase64,a).body,a)});assert.notEqual(rejected.code,200);
  assert.equal(count(),0,'invalid peer private rows physically removed even though A operation fails');
  const db=new DatabaseSync(dbPath,{readOnly:true});try{const row=db.prepare('SELECT body FROM environment_consent WHERE account_id=?').get(b.userId);const consent=JSON.parse(row.body);assert.equal(consent.isEnvironmentGranted,false);assert.ok(consent.revision>enabled.data.revision);}finally{db.close();}
 }finally{await h?.close();assert.ok(dir.startsWith(join(tmpdir(),'baji-m2-peer-eligibility-')));await rm(dir,{recursive:true,force:true});}
});

const life=(revision,location=false)=>({baseRevision:revision,isLifeSyncEnabled:true,isLocationGranted:location,isMotionGranted:false,isMicrophoneGranted:false});
async function grant(h,u,allowed=true){const prior=await h.ok(u,'/environment-consent');return h.request(u,'/environment-consent','PUT',{baseRevision:prior.revision,isEnvironmentGranted:allowed});}
for(const scenario of ['UNCONFIGURED','UNKNOWN','EXPIRED','INVALID_PROVIDER'])test(`M2 HTTP privacy eligibility ${scenario} fails closed without blocking game or consent withdrawal`,async()=>{
 const provider=scenario==='UNCONFIGURED'?null:c=>({accountId:scenario==='INVALID_PROVIDER'?'wrong-account':c.accountId,ageBand:scenario==='UNKNOWN'?'UNKNOWN':'14_PLUS',guardianScopes:[],evidenceId:'test-age',expiresAt:c.now+(scenario==='EXPIRED'?-1000:60000)});
 const h=await harness(undefined,{privacyEligibilityProvider:provider});
 try{const [a]=h.users;const status=await h.ok(a,'/privacy-eligibility');assert.equal(status.status,scenario);assert.equal(status.isEnvironmentEligible,false);assert.equal(status.isLocationEligible,false);
  assert.equal((await grant(h,a)).code,41003);assert.equal((await grant(h,a,false)).code,200);
  const consent=await h.ok(a,'/consents');assert.equal((await h.request(a,'/consents','PUT',life(consent.revision,true))).code,41003);
  assert.equal((await h.request(a,'/consents','PUT',life(consent.revision,false))).code,200);
  assert.ok((await h.ok(a,'/pet-saves/current')).save);assert.equal((await h.ok(a,`/ota-manifests/APP?deviceId=${a.id}&sessionId=${a.binding.sessionId}`)).isConfigured,false);
 }finally{await h.close();}
});
test('M2 HTTP UNDER14 scoped guardian authorization is separate from user location/environment consent',async()=>{
 let scopes=[];const h=await harness(undefined,{privacyEligibilityProvider:c=>({accountId:c.accountId,ageBand:'UNDER_14',guardianScopes:scopes,evidenceId:'test-guardian',expiresAt:c.now+60000})});
 try{const [a]=h.users;assert.equal((await grant(h,a)).code,41004);let current=await h.ok(a,'/consents');assert.equal((await h.request(a,'/consents','PUT',life(current.revision,true))).code,41004);
  scopes=['LOCATION'];const locationOnly=await h.ok(a,'/privacy-eligibility');assert.equal(locationOnly.isLocationEligible,true);assert.equal(locationOnly.isEnvironmentEligible,false);assert.equal((await grant(h,a)).code,41004);
  await h.ok(a,'/consents','PUT',life(current.revision,true));assert.equal((await h.ok(a,'/environment-consent')).isEnvironmentGranted,false);
  scopes=['ENVIRONMENT'];const envOnly=await h.ok(a,'/privacy-eligibility');assert.equal(envOnly.isLocationEligible,false);assert.equal(envOnly.isEnvironmentEligible,true);
  assert.equal((await h.ok(a,'/consents')).isLocationGranted,false,'revoked guardian LOCATION scope reconciles former user grant');assert.equal((await h.ok(a,'/environment-consent')).isEnvironmentGranted,false,'new guardian scope never auto-enables collection');
  assert.equal((await grant(h,a)).code,200);
 }finally{await h.close();}
});
test('M2 HTTP eligibility expiry physically clears environment, signs closed11 even with old key and never auto-regrants',async()=>{
 let expires,valid=true;const h=await harness(undefined,{privacyEligibilityProvider:c=>({accountId:c.accountId,ageBand:valid?'14_PLUS':'UNKNOWN',guardianScopes:[],evidenceId:'test-age-expiry',expiresAt:expires??c.now+60000})});
 try{const [a]=h.users;expires=h.now()+10000;const consent=await h.ok(a,'/consents');await h.ok(a,'/consents','PUT',life(consent.revision));const enabled=await grant(h,a);assert.equal(enabled.code,200);
  const key='privacy-original-grant';const body={sessionId:a.binding.sessionId,kind:11};const signed=await h.ok(a,`/devices/${a.id}/signed-objects`,'POST',body,{key});let bytes=Buffer.from(signed.envelopeBase64,'base64');assert.equal(bytes[25],1);assert.ok(bytes.readUInt32LE(26)*1000<=expires);
  h.advance(2000);const event={id:'9500001',deviceId:a.id,signedEventBase64:environmentEvent(a,{id:'9500001',seconds:Math.floor(h.now()/1000),revision:enabled.data.revision})};await h.ok(a,'/environment-events','POST',{consentRevision:enabled.data.revision,events:[event]});
  assert.equal((await h.ok(a,'/environment-days/2026-10-14')).events.length,1);
  h.advance(9000);const expired=await h.ok(a,'/privacy-eligibility');assert.equal(expired.status,'EXPIRED');assert.equal((await h.ok(a,'/environment-days/2026-10-14')).events.length,0);
  const closed=await h.ok(a,`/devices/${a.id}/signed-objects`,'POST',body,{key});bytes=Buffer.from(closed.envelopeBase64,'base64');assert.equal(bytes[25],0);assert.ok(bytes.readUInt32LE(21)>enabled.data.revision);assert.deepEqual(bytes.subarray(30),hmac(a.key,'BAJI-SYNC-v1',Buffer.from(a.id,'hex'),Buffer.from([11]),bytes.subarray(0,30)));
  expires=h.now()+60000;assert.equal((await h.ok(a,'/privacy-eligibility')).status,'ELIGIBLE');assert.equal((await h.ok(a,'/environment-consent')).isEnvironmentGranted,false);
  assert.equal(Buffer.from((await h.ok(a,`/devices/${a.id}/signed-objects`,'POST',body,{key})).envelopeBase64,'base64')[25],0);
 }finally{await h.close();}
});
