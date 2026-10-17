import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, hmac, TEST_POLICY } from './m2-helper.mjs';
import { BizException } from '../../backend/src/shared/core.mjs';
function care(h,u,id){const raw=Buffer.alloc(16);raw.writeBigUInt64LE(BigInt(id));raw.writeUInt32LE(Math.floor(h.now()/1000),8);raw[12]=1;return {eventId:String(id),eventBase64:Buffer.concat([raw,hmac(u.key,'BAJI-EVENT-v1',Buffer.from(u.id,'hex'),raw)]).toString('base64')};}
test('M2 real HTTP care failure after all domain hooks rolls back wallet XP personality save receipt and next item succeeds',async()=>{
 let fail=true, mixedMode=false;
 const h=await harness(TEST_POLICY,{afterTrustedCare:()=>{if(fail){if(mixedMode)fail=false;throw new BizException(47000,'TEST-only post-domain failure');}}});
 try{
  const [a]=h.users;
  const state=async()=>({pet:await h.ok(a,'/social-pets'),personality:await h.ok(a,'/pets/cat-1/personality'),save:await h.ok(a,'/pet-saves/current'),skills:await h.ok(a,'/skills')});
  const before=await state(),event=care(h,a,9300001);
  const failed=await h.ok(a,`/devices/${a.id}/event-batches`,'POST',{sessionId:a.binding.sessionId,events:[event]});
  assert.equal(failed.results[0].isSettled,false);assert.equal(failed.results[0].isTerminal,false);assert.equal(failed.results[0].code,47000);
  assert.deepEqual(await state(),before,'no partial domain or local-save mutation survives post-hook exception');
  fail=false;
  const retried=await h.ok(a,`/devices/${a.id}/event-batches`,'POST',{sessionId:a.binding.sessionId,events:[event]});assert.equal(retried.results[0].isSettled,true,'failed receipt must not terminally consume signed event');
  const after=await state();assert.equal(after.pet.balanceCoins,before.pet.balanceCoins+1);assert.equal(after.pet.list[0].xp,before.pet.list[0].xp+3);assert.equal(after.personality.revision,before.personality.revision+1);
  await h.ok(a,`/devices/${a.id}/event-batches`,'POST',{sessionId:a.binding.sessionId,events:[event]});assert.deepEqual(await state(),after,'duplicate must not apply persona hook twice');
  h.advance(5000);fail=true;mixedMode=true;
  // First fails, next passes in the very same actual HTTP batch.
  const mixed=await h.ok(a,`/devices/${a.id}/event-batches`,'POST',{sessionId:a.binding.sessionId,events:[care(h,a,9300002),care(h,a,9300003)]});
  assert.equal(mixed.results[0].isTerminal,false);assert.equal(mixed.results[1].isSettled,true);
  const next=await state();assert.equal(next.pet.balanceCoins,after.pet.balanceCoins+1);assert.equal(next.personality.revision,after.personality.revision+1);
 }finally{await h.close();}
});
