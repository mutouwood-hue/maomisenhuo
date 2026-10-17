import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {harness,hmac} from './m2-helper.mjs';
async function binding(h,a){const c=await h.ok(a,`/devices/${a.id}/binding-challenges`,'POST',{});a.binding=await h.ok(a,'/device-bindings','POST',{deviceId:a.id,challengeId:c.challengeId,proofBase64:hmac(a.key,'BAJI-BIND-v1',Buffer.from(a.id,'hex'),Buffer.from(c.challengeBase64,'base64')).toString('base64')});}
async function grant(h,a){const result=await h.ok(a,`/devices/${a.id}/signed-objects`,'POST',{sessionId:a.binding.sessionId,kind:11});const raw=Buffer.from(result.envelopeBase64,'base64');assert.equal(raw.length,62);assert.deepEqual(raw.subarray(-32),hmac(a.key,'BAJI-SYNC-v1',Buffer.from(a.id,'hex'),Buffer.from([11]),raw.subarray(0,-32)));const body=raw.subarray(20,-32);return {revision:body.readUInt32LE(1),allowed:body[5],expiry:body.readUInt32LE(6)};}
test('M2 HTTP durable explicit environment consent renews signed11 on fresh session without repeated PUT and never reopens revoked consent',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-env-renew-'));let h,bad=false;
 try{h=await harness(undefined,{dbPath:join(dir,'test.sqlite'),privacyEligibilityProvider:c=>({accountId:c.accountId,ageBand:bad?'UNKNOWN':'14_PLUS',guardianScopes:[],evidenceId:'TEST-renew-age',expiresAt:c.now+86400000})});const [a]=h.users;
  const initial=await h.ok(a,'/environment-consent');const saved=await h.ok(a,'/environment-consent','PUT',{baseRevision:initial.revision,isEnvironmentGranted:true});const first=await grant(h,a);assert.equal(first.allowed,1);assert.equal(first.revision,saved.revision);
  h.advance(901000);await h.restart();await binding(h,a);const renewed=await grant(h,a);assert.equal(renewed.allowed,1);assert.equal(renewed.revision,saved.revision);assert.ok(renewed.expiry>first.expiry);assert.deepEqual(await h.ok(a,'/environment-consent'),saved,'fresh session uses persistent first consent without another PUT or epoch increment');
  const stopped=await h.ok(a,'/environment-consent','PUT',{baseRevision:saved.revision,isEnvironmentGranted:false});await h.restart();await binding(h,a);assert.deepEqual(await h.ok(a,'/environment-consent'),stopped);assert.equal((await grant(h,a)).allowed,0,'STOP remains closed after restart/reconnect');
  const enabled=await h.ok(a,'/environment-consent','PUT',{baseRevision:stopped.revision,isEnvironmentGranted:true});bad=true;const closed=await grant(h,a);assert.equal(closed.allowed,0);assert.ok(closed.revision>enabled.revision);bad=false;await binding(h,a);assert.equal((await grant(h,a)).allowed,0,'eligibility recovery never auto-enables revoked consent');
 }finally{await h?.close();assert.ok(dir.startsWith(join(tmpdir(),'baji-m2-env-renew-')));await rm(dir,{recursive:true,force:true});}
});
