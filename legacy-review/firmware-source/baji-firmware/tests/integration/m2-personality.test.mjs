import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { harness, challengeBody, proof } from './m2-helper.mjs';
async function meet(h){
 const [a,b]=h.users;
 for(const u of [a,b]){const s=await h.ok(u,'/social-settings');if(!s.isDiscoverable)await h.ok(u,'/social-settings','PUT',{baseRevision:s.revision,isDiscoverable:true,venueId:'TEST-VENUE'});}
 const token=await h.ok(b,'/discovery-tokens','POST',{deviceId:b.id,sessionId:b.binding.sessionId});
 const e=await h.ok(a,'/encounters','POST',{deviceId:a.id,sessionId:a.binding.sessionId,peerToken:token.token,method:'QR'});
 const requests=[];for(const u of [a,b]){const view=await h.ok(u,`/encounters/${e.id}`);const body={deviceId:u.id,sessionId:u.binding.sessionId,proofBase64:proof(challengeBody(view.ownChallengeBase64,u).body,u)};const key=`persona-proof-${e.id}-${u.id}`;await h.ok(u,`/encounters/${e.id}/proofs`,'POST',body,{key});requests.push({u,body,key});}
 return {e,requests};
}
test('M2 HTTP real social personality hooks are unique, persist across restart and obey expression cooldown',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-persona-'));let h;
 try{
  h=await harness(undefined,{dbPath:join(dir,'test.sqlite')});const [a,b]=h.users;
  const persona=()=>h.ok(a,'/pets/cat-1/personality');const initial=await persona();
  const {e,requests}=await meet(h),afterMeet=await persona();assert.equal(afterMeet.revision,initial.revision+1);assert.equal(afterMeet.expression.source,'CONFIRMED_MEET');
  for(const {u,body,key} of requests)await h.ok(u,`/encounters/${e.id}/proofs`,'POST',body,{key});
  assert.deepEqual(await persona(),afterMeet,'both proof retries cannot replay confirmed encounter hook');
  const asset=(await h.ok(a,'/assets?size=100')).list.find(r=>r.status==='AVAILABLE'&&r.kind!=='TRAIT');
  const x=await h.ok(a,'/exchanges','POST',{encounterId:e.id,offeredAssetId:asset.assetId});await h.ok(a,`/exchanges/${x.id}/confirm`,'POST',{});
  await h.ok(b,`/exchanges/${x.id}/confirm`,'POST',{},{key:'persona-exchange-complete'});const afterExchange=await persona();assert.equal(afterExchange.revision,afterMeet.revision+1);assert.deepEqual(afterExchange.expression,afterMeet.expression,'social event within cooldown drifts but does not replace bubble');
  await h.ok(b,`/exchanges/${x.id}/confirm`,'POST',{},{key:'persona-exchange-complete'});assert.deepEqual(await persona(),afterExchange);
  await h.restart();assert.deepEqual(await persona(),afterExchange,'true SQLite restart preserves drift and cooldown');
  h.advance(61000);assert.equal((await persona()).expression,null,'expired expression not reported active');
  const last=await persona();await meet(h);const next=await persona();assert.equal(next.revision,last.revision+1);assert.equal(next.expression.source,'CONFIRMED_MEET');assert.notEqual(next.expression.id,afterMeet.expression.id);
 }finally{await h?.close();assert.ok(dir.startsWith(join(tmpdir(),'baji-m2-persona-')));await rm(dir,{recursive:true,force:true});}
});
