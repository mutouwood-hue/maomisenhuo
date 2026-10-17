import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {createApplication} from '../../backend/src/app.mjs';
import {ApiClient} from '../../mobile-pet/src/companion/api-client.js';
const fixture=(now,name)=>({version:2,activeCatId:'cat-1',cats:[{id:'cat-1',name,xp:0,stats:{food:50,mood:50,clean:50,energy:50},counts:{feed:0,bath:0,pet:0,play:0,sleep:0,climb:0,tease:0,drink:0},claimedGoals:[],breed:'orange',sex:'male',outfit:'none',health:100,healthIssue:null,joinedAt:now,adultAt:null,generation:1,heritage:null,gradCalledAt:null,gradDelayUntil:null}],coins:10,wardrobe:['none'],inventory:{fish:0,flower:0,shell:0,star:0},world:{completed:{walk:0,explore:0,fish:0},collected:{fish:0,flower:0,shell:0,star:0},claimedOrders:[],choices:0,lastLocation:'garden',nextSession:1},family:{pair:null,babiesBorn:0},journal:[],createdAt:now,lastSavedAt:now,graduates:[]});
test('real HTTP owner transfer: immutable old ledger, terminal zero-reward receipt and authenticated ACK',async()=>{
 let now=Date.parse('2026-10-14T11:00:00+08:00'),token;
 const deviceId='334455667788',key=randomBytes(32),mac=(domain,body)=>createHmac('sha256',key).update(domain).update(Buffer.from(deviceId,'hex')).update(body).digest();
 const app=createApplication({config:{dbPath:':memory:',inviteCode:'test-only',deviceKeys:{[deviceId]:key},origins:[]},clock:()=>new Date(now)});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const api=new ApiClient({getEndpoint:()=>`http://127.0.0.1:${app.server.address().port}`,getToken:()=>token});
 const register=async(username,name)=>{const a=await api.request('/api/accounts',{method:'POST',body:{username,password:'test-only-password',inviteCode:'test-only'}});token=a.accessToken;await api.request('/api/pet-saves/current',{method:'PUT',body:{baseRevision:0,save:fixture(now,name)}});return token;};
 const bind=async()=>{const c=await api.request(`/api/devices/${deviceId}/binding-challenges`,{method:'POST',body:{}});return api.request('/api/device-bindings',{method:'POST',body:{deviceId,challengeId:c.challengeId,proofBase64:mac('BAJI-BIND-v1',Buffer.from(c.challengeBase64,'base64')).toString('base64')}});};
 const event=(id,time)=>{const raw=Buffer.alloc(16);raw.writeBigUInt64LE(BigInt(id));raw.writeUInt32LE(Math.floor(time/1000),8);raw[12]=2;raw[13]=3;return{eventId:id,eventBase64:Buffer.concat([raw,mac('BAJI-EVENT-v1',raw)]).toString('base64')};};
 const batch=(sessionId,entry)=>api.request(`/api/devices/${deviceId}/event-batches`,{method:'POST',body:{sessionId,events:[entry]}});
 const ack=(sessionId,eventId)=>api.request(`/api/devices/${deviceId}/signed-objects`,{method:'POST',body:{sessionId,kind:8,eventId}});
 try{
  const firstToken=await register('old_account','旧主人猫');const first=await bind();const old=event('9007199254740993',now);
  const settled=await batch(first.sessionId,old);assert.equal(settled.save.coins,7);assert.equal(settled.results[0].isSettled,true);
  await api.request(`/api/device-bindings/${deviceId}`,{method:'DELETE'});now+=120000;
  const secondToken=await register('new_account','新主人猫');const second=await bind();
  const foreign=await batch(second.sessionId,old);assert.equal(foreign.save.coins,10);assert.equal(foreign.save.cats[0].name,'新主人猫');assert.equal(foreign.results[0].isTerminal,true);assert.equal(foreign.results[0].isSettled,false);assert.equal(foreign.results[0].code,42018);assert.doesNotMatch(JSON.stringify(foreign),/旧主人猫/);
  const signed=await ack(second.sessionId,old.eventId);const bytes=Buffer.from(signed.envelopeBase64,'base64');assert.equal(bytes.readBigUInt64LE(20),9007199254740993n);assert.deepEqual(bytes.subarray(-32),mac('BAJI-SYNC-v1',Buffer.concat([Buffer.from([8]),bytes.subarray(0,-32)])));
  const repeat=await batch(second.sessionId,old);assert.equal(repeat.results[0].isTerminal,true);assert.equal(repeat.save.coins,10);
  const unseenOld=event('9007199254740994',now-60000);const rejected=await batch(second.sessionId,unseenOld);assert.equal(rejected.results[0].code,42018);assert.equal(rejected.results[0].isTerminal,true);await ack(second.sessionId,unseenOld.eventId);
  const tampered=event('9007199254740995',now);const bad=Buffer.from(tampered.eventBase64,'base64');bad[47]^=1;tampered.eventBase64=bad.toString('base64');const malformed=await batch(second.sessionId,tampered);assert.equal(malformed.results[0].isTerminal,false);await assert.rejects(ack(second.sessionId,tampered.eventId),e=>e.code===42016);
  token=firstToken;const oldSave=await api.request('/api/pet-saves/current');assert.equal(oldSave.save.coins,7);assert.equal(oldSave.save.cats[0].name,'旧主人猫');token=secondToken;assert.equal((await api.request('/api/pet-saves/current')).save.coins,10);
 }finally{await app.close();}
});
