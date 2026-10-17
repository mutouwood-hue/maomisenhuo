import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../mobile-pet/src/companion/api-client.js';
import { LifeProvider } from '../../mobile-pet/src/companion/life-provider.js';
import { LifeSync } from '../../mobile-pet/src/companion/life-sync.js';
import { BadgeSyncScheduler } from '../../mobile-pet/src/companion/badge-sync-scheduler.js';
import { harness,hmac } from './m2-helper.mjs';
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
test('M2 production LifeProvider automatic CAS marks scheduler and relays authenticated kind4 without coordinates',async()=>{
 const h=await harness();try{const [a]=h.users,data=storage();const api=new ApiClient({getEndpoint:()=>h.base,getToken:()=>a.token});const original=api.request.bind(api),requests=[];api.request=async(path,options)=>{requests.push({path,options});return original(path,options);};
 const old=await h.ok(a,'/consents');const consent=await h.ok(a,'/consents','PUT',{baseRevision:old.revision,isLifeSyncEnabled:true,isLocationGranted:true,isMotionGranted:false,isMicrophoneGranted:false});
 const provider=new LifeProvider({storage:data,now:h.now});provider.setConsent(consent);for(let i=0;i<=15;i++){if(i)h.advance(60000);provider.addPosition({timestamp:h.now(),coords:{latitude:31.2304,longitude:121.4737,accuracy:20}});}provider.renamePlace(provider.places[0].id,'TEST-OFFICE','WORK');
 const challenge=await h.ok(a,`/devices/${a.id}/binding-challenges`,'POST',{});a.binding=await h.ok(a,'/device-bindings','POST',{deviceId:a.id,challengeId:challenge.challengeId,proofBase64:hmac(a.key,'BAJI-BIND-v1',Buffer.from(a.id,'hex'),Buffer.from(challenge.challengeBase64,'base64')).toString('base64')});
 const writes=[];let fail=true;const badge={session:{id:a.binding.sessionId},client:{generation:1},deviceId:()=>a.id,requireSession(){},api,transport:{pending:false,async exclusive(fn){this.pending=true;try{return await fn();}finally{this.pending=false;}},async writeObject(kind,raw){if(fail&&kind===4){fail=false;throw new Error('TEST lost kind4 commit');}const b=Buffer.from(raw);assert.deepEqual(b.subarray(-32),hmac(a.key,'BAJI-SYNC-v1',Buffer.from(a.id,'hex'),Buffer.from([kind]),b.subarray(0,-32)));writes.push({kind,body:b.subarray(20,-32)});}}};
 const scheduler=new BadgeSyncScheduler({getOwner:()=>a.userId,getBadge:()=>badge,storage:data,now:h.now});const sync=new LifeSync({api,getOwner:()=>a.userId,getStorage:()=>data,getProvider:()=>provider,getConsent:()=>consent,onConfirmed:()=>scheduler.mark()});
 assert.equal(await sync.flush(),true);assert.equal((await h.ok(a,'/life-days/2026-10-14')).segments[0].type,'WORK');const puts=requests.filter(r=>r.options?.method==='PUT'&&r.path.includes('/life-days/'));assert.equal(puts.length,1);assert.ok(!JSON.stringify(puts[0].options.body).match(/latitude|longitude|\"lat\"|\"lon\"/));
 assert.equal(await sync.flush(),false);assert.equal(await scheduler.flush(),false);assert.ok(data.getItem(scheduler.key(a.userId)),'failed BLE commit preserves pending');h.advance(5001);assert.equal(await scheduler.flush(),true);assert.equal(data.getItem(scheduler.key(a.userId)),null);assert.deepEqual(writes.map(w=>w.kind),[9,3,9,3,4]);const life=writes.at(-1).body;assert.equal(life[11],1);assert.equal(life[17],2,'kind4 keeps authoritative WORK segment enum');
 provider.addMoment({type:'CARE',heart:20});assert.equal(await sync.flush(),true);data.setItem('pending-consent','true');assert.equal(await sync.flush(),false);
 }finally{await h.close();}
});
