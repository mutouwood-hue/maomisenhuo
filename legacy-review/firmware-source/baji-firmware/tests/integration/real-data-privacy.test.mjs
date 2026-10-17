import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplication } from '../../backend/src/app.mjs';
const DAY=86400000;
test('event-time TTL and consent tombstones reject stale summaries across midnight/reconsent',async()=>{
 let now=Date.parse('2026-10-14T12:00:00+08:00');
 const app=createApplication({config:{dbPath:':memory:',inviteCode:'privacy-only',deviceKeys:{},origins:[]},clock:()=>new Date(now)});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;let token;
 const call=async(method,path,body)=>{const r=await fetch(url+path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return{http:r.status,...await r.json()};};
 const enabled=baseRevision=>({baseRevision,isLifeSyncEnabled:true,isLocationGranted:true,isMotionGranted:true,isMicrophoneGranted:false});
 const day=(start,end,revision)=>({baseRevision:0,consentRevision:revision,timeZone:'Asia/Shanghai',source:'NATIVE',segments:[{id:'visit-1',startAt:start,endAt:end,type:'WORK',placeId:'work',placeAlias:'公司'}],places:[{id:'work',alias:'公司',type:'WORK',visitIds:['visit-1']}],motion:null,moments:[]});
 try{
  const account=await call('POST','/api/accounts',{username:'privacy_user',password:'test-only-password',inviteCode:'privacy-only'});assert.equal(account.code,200,JSON.stringify(account));token=account.data.accessToken;
  let consent=(await call('PUT','/api/consents',enabled(0))).data;
  const historical=day('2026-10-07 12:01:00','2026-10-07 12:31:00',consent.revision);
  assert.equal((await call('PUT','/api/life-days/2026-10-07',historical)).code,200);
  now+=61000;app.store.purge(now);
  assert.equal((await call('GET','/api/life-days/2026-10-07')).data,null,'expiry must be sample+7days, not dayEnd+7');
  const old=day('2026-10-14 10:00:00','2026-10-14 10:30:00',consent.revision);
  assert.equal((await call('PUT','/api/life-days/2026-10-14',old)).code,200);
  const cleared=await call('DELETE','/api/life-data');assert.equal(cleared.code,200);
  consent=(await call('PUT','/api/consents',enabled(cleared.data.revision))).data;
  assert.equal((await call('PUT','/api/life-days/2026-10-14',old)).code,41003,'old consent generation cannot resurrect');
  assert.equal((await call('PUT','/api/life-days/2026-10-14',{...old,consentRevision:consent.revision})).code,41003,'fresh consent cannot relabel old samples');
  const motion={...day('2026-10-14 12:02:00','2026-10-14 12:17:00',consent.revision),segments:[],places:[],motion:{source:'ANDROID_STEP_COUNTER',stepCount:999,walkingSeconds:null,vehicleSeconds:null,coverageStartAt:'2026-10-14 10:00:00'}};
  assert.equal((await call('PUT','/api/life-days/2026-10-14',motion)).code,41003);
  now=Date.parse('2026-10-14T13:00:00+08:00');
  const fresh=day('2026-10-14 12:02:00','2026-10-14 12:17:00',consent.revision);
  const spoof={...fresh,places:[{...fresh.places[0],visitIds:['visit-1','invented-second-visit']}]};
  assert.equal((await call('PUT','/api/life-days/2026-10-14',spoof)).http,400);
  assert.equal((await call('PUT','/api/life-days/2026-10-14',fresh)).code,200);
  const revoke=await call('PUT','/api/consents',{...enabled(consent.revision),isLocationGranted:false});assert.equal(revoke.code,200);
  assert.equal((await call('GET','/api/life-days/2026-10-14')).data,null);
  now+=8*DAY;app.store.purge(now);assert.equal(app.store.one('SELECT COUNT(*) AS n FROM life_day').n,0);
 }finally{await app.close();}
});
