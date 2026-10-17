import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { createApplication } from '../../backend/src/app.mjs';
import { ApiClient } from '../../mobile-pet/src/companion/api-client.js';
import { LifeProvider, dateKey } from '../../mobile-pet/src/companion/life-provider.js';
import { CloudSave } from '../../mobile-pet/src/companion/cloud-save.js';
import { TelemetryOutbox } from '../../mobile-pet/src/companion/outbox.js';
const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
function saveFixture(time){return{version:2,activeCatId:'cat-1',cats:[{id:'cat-1',name:'小橘',xp:0,stats:{food:50,mood:50,clean:50,energy:50},counts:{feed:0,bath:0,pet:0,play:0,sleep:0,climb:0,tease:0,drink:0},claimedGoals:[],breed:'orange',sex:'male',outfit:'none',health:100,healthIssue:null,joinedAt:time,adultAt:null,generation:1,heritage:null,gradCalledAt:null,gradDelayUntil:null}],coins:10,wardrobe:['none'],inventory:{fish:0,flower:0,shell:0,star:0},world:{completed:{walk:0,explore:0,fish:0},collected:{fish:0,flower:0,shell:0,star:0},claimedOrders:[],choices:0,lastLocation:'garden',nextSession:1},family:{pair:null,babiesBorn:0},journal:[],createdAt:time,lastSavedAt:time,graduates:[]};}
test('actual mobile modules use real HTTP backend: consent, summaries, CAS, signed care, ACK, clear',async()=>{
  let time=Date.parse('2026-10-14T10:00:00+08:00'),token=null;
  const deviceId='112233445566',key=randomBytes(32);
  const app=createApplication({config:{dbPath:':memory:',inviteCode:'integration-only',deviceKeys:{[deviceId]:key},origins:[]},clock:()=>new Date(time)});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const api=new ApiClient({getEndpoint:()=>`http://127.0.0.1:${app.server.address().port}`,getToken:()=>token});
  try{
    const account=await api.request('/api/accounts',{method:'POST',body:{username:'cross_stack',password:'test-only-password',inviteCode:'integration-only'}});token=account.accessToken;
    const storage=memory();let save=saveFixture(time),reloads=0;
    const game={exportSave:()=>JSON.stringify(save),importSave:raw=>{save=JSON.parse(raw);return{ok:true};}};
    const cloud=new CloudSave({api,game,storage,reload:()=>reloads++});
    await cloud.migrate();assert.equal(cloud.meta.revision,1);
    let consent=await api.request('/api/consents');assert.equal(consent.isLifeSyncEnabled,false);
    consent=await api.request('/api/consents',{method:'PUT',body:{baseRevision:consent.revision,isLifeSyncEnabled:true,isLocationGranted:true,isMotionGranted:true,isMicrophoneGranted:false}});
    const provider=new LifeProvider({storage,now:()=>time});provider.setConsent(consent);
    provider.addSteps({cumulativeSteps:1000,bootId:'test-boot',time});
    for(let i=0;i<16;i++){provider.addPosition({timestamp:time,coords:{latitude:31,longitude:121,accuracy:15}});time+=60000;}
    provider.addSteps({cumulativeSteps:1010,bootId:'test-boot',time});
    const summary=provider.summary();assert.equal(summary.motion.stepCount,10);assert.equal(summary.motion.walkingSeconds,null);
    assert.doesNotMatch(JSON.stringify(summary),/"(?:latitude|longitude|lat|lon|coords)"/);
    const day=await api.request(`/api/life-days/${dateKey(time)}`,{method:'PUT',body:{...summary,baseRevision:0,consentRevision:consent.revision}});
    assert.equal(day.places[0].visitIds.length,1);assert.equal(day.motion.stepCount,10);
    const outbox=new TelemetryOutbox({api,storage,key:'outbox',now:()=>time});outbox.track('care_done',{careType:'FEED',catId:'cat-1'});await outbox.flush();assert.equal(outbox.events.length,0);
    assert.equal((await cloud.pull()).save.coins,10,'telemetry must never settle care');
    const challenge=await api.request(`/api/devices/${deviceId}/binding-challenges`,{method:'POST',body:{}});
    const proof=createHmac('sha256',key).update('BAJI-BIND-v1').update(Buffer.from(deviceId,'hex')).update(Buffer.from(challenge.challengeBase64,'base64')).digest('base64');
    const binding=await api.request('/api/device-bindings',{method:'POST',body:{deviceId,challengeId:challenge.challengeId,proofBase64:proof}});
    const raw=Buffer.alloc(16);raw.writeBigUInt64LE(9007199254740993n);raw.writeUInt32LE(Math.floor(time/1000),8);raw[12]=2;raw[13]=3;
    const mac=createHmac('sha256',key).update('BAJI-EVENT-v1').update(Buffer.from(deviceId,'hex')).update(raw).digest();
    const body={sessionId:binding.sessionId,events:[{eventId:'9007199254740993',eventBase64:Buffer.concat([raw,mac]).toString('base64')}]};
    const accepted=await api.request(`/api/devices/${deviceId}/event-batches`,{method:'POST',body});assert.equal(accepted.revision,2);assert.equal(accepted.save.coins,7);
    await assert.rejects(cloud.push(),error=>error.code===40901);assert.ok(storage.getItem('companion-save-conflict-backup'));
    await cloud.acceptDeviceSave(accepted);assert.equal(reloads,0,'ACK must not be interrupted by navigation');assert.equal(save.cats[0].xp,8);assert.equal(cloud.meta.revision,2);
    const ack=await api.request(`/api/devices/${deviceId}/signed-objects`,{method:'POST',body:{sessionId:binding.sessionId,kind:8,eventId:body.events[0].eventId}});assert.equal(Buffer.from(ack.envelopeBase64,'base64').readBigUInt64LE(20),9007199254740993n);
    const duplicate=await api.request(`/api/devices/${deviceId}/event-batches`,{method:'POST',body});assert.equal(duplicate.duplicateCount,1);assert.equal(duplicate.save.coins,7);
    await api.request('/api/life-data',{method:'DELETE'});assert.equal(await api.request(`/api/life-days/${dateKey(time)}`),null);
    await assert.rejects(api.request(`/api/life-days/${dateKey(time)}`,{method:'PUT',body:{...summary,baseRevision:0,consentRevision:consent.revision}}),e=>e.status===403||e.code===41003);
    const empty=await api.request(`/api/devices/${deviceId}/signed-objects`,{method:'POST',body:{sessionId:binding.sessionId,kind:4}});const envelope=Buffer.from(empty.envelopeBase64,'base64');assert.equal(envelope[31],0);assert.equal(envelope[32],0);
    await api.request('/api/sessions/current',{method:'DELETE'});await assert.rejects(api.request('/api/sessions/current'),e=>e.status===401);
  }finally{await app.close();}
});
