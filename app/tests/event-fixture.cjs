const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const native=require('../web/offline-durable-store.js');
const db=require('../web/offline-event-store.js'),events=require('../web/offline-device-events.js');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(root+'/original/game.html','utf8');
const main=fs.readFileSync(root+'/android/app/src/main/assets/game-03.js','utf8');
const sandbox={};vm.runInNewContext(main.slice(0,main.indexOf('/**'))+';globalThis.factory=vu;})();',sandbox);
const original=html.slice(html.indexOf('const DEF={'),html.indexOf('const D=Object.assign'));
const socialSandbox={uid:()=> 'fixture-id'};vm.runInNewContext(original+';globalThis.social=DEF;',socialSandbox);
const ID='0123456789abcdef0123456789abcdef',PEER='abcdef0123456789abcdef0123456789';
const NOW=2000000000000;
function memory(){const values=new Map(),writes=[];let fault=null;return {values,writes,getItem:k=>values.get(k)??null,setItem(k,v){fault?.(k,v,'before');values.set(k,String(v));writes.push(k);fault?.(k,v,'after');},setFault:f=>{fault=f;}};}
function harness({io=memory(),walFault=()=>{},consumerFault=()=>{},queue=null,clock=()=>NOW}={}){
 // Explicit in-memory Native authority fixture: no fsync/device claim.
 const authority=io.nativeAuthority||(io.nativeAuthority={entries:{}});native.recover(authority.entries,io);
 const durable={available:true,foreground:true,eventLocked:false,assertHealthy(){},async seal({game,social,ledger,token,extra={}}){
   Object.assign(authority.entries,{[db.GAME]:game,[db.SOCIAL]:social,[db.KEY]:JSON.stringify(ledger),[native.MARKER]:token,...extra});
   for(const key of [db.JOURNAL,db.IDENTITY])if(!Object.hasOwn(extra,key)&&io.getItem(key)!==null)authority.entries[key]=io.getItem(key);
 },confirm(record){assertReceipt(record);}};
 function assertReceipt(record){const r=JSON.parse(authority.entries[db.KEY]||'{"records":{}}').records[record.event.eventId];if(db.canonical(r)!==db.canonical(record))throw Error('Native receipt absent');}
 const ledger=db.createStore(io,{fault:walFault});ledger.recover();
 let store=sandbox.factory({storage:io,now:clock}),social;
 if(io.getItem(db.GAME)===null)store.flush();
 if(io.getItem(db.SOCIAL)===null)io.setItem(db.SOCIAL,JSON.stringify(socialSandbox.social));
 social=JSON.parse(io.getItem(db.SOCIAL));
 const window={localStorage:io,CatOfflineEventLedger:ledger,crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},__pgLife:{hostCompanionState:()=>({schema:1,source:'life-v5-applied',out:false,mode:'demo'})},__petGame:{state:()=>({ready:true,pet:store.getState(),room:{},life:{view:'home'}})}};
 vm.runInNewContext(fs.readFileSync(root+'/web/offline-scene-map.js','utf8'),{window});
 const state={hello:{deviceId:ID},device:{hasSnapshot:false}},context=()=>({deviceId:ID,hasSnapshot:false});
 const wire=window.CatOfflineSceneMap.read(context());
 const q=queue||[],acks=[],results=[];
 let busy=false,ackError=null,dropAck=false,hydrateError=false,activeFreeze=null;
 const source={busy:()=>busy||store.hostCareRuntimeBusy(),flush(owner){if(owner&&!activeFreeze)throw Error('Runtime owner released');if(activeFreeze){if(owner!==activeFreeze.release)throw Error('Wrong runtime owner');activeFreeze.lease.flush();}else store.flush();io.setItem(db.SOCIAL,JSON.stringify(social));},
  assertHealthy(){ledger.assertHealthy();if(store.getState().storageIssue||sandbox.factory({storage:{getItem:()=>io.getItem(db.GAME),setItem(){}}}).getState().storageIssue)throw Error('手机原存档');events.parseSocial(io.getItem(db.SOCIAL));if(db.canonical(JSON.parse(io.getItem(db.SOCIAL)))!==db.canonical(social))throw Error('社交未写入');},
  identity:()=>events.fingerprint(store.getState()),wire:()=>window.CatOfflineSceneMap.read(context()),createStore:o=>sandbox.factory(o),validateSocial:events.parseSocial,
  readCareRuntime:()=>store.hostReadCareRuntime(),
  capture(){const value=JSON.parse(store.exportSave());delete value.lastSavedAt;return db.canonical({game:value,runtime:store.hostReadCareRuntime()});},
  freeze(){if(activeFreeze)throw Error('Already frozen');const lease=store.hostFreezeDeviceResult();const release=()=>{if(activeFreeze?.release===release){lease.release();activeFreeze=null;}};release.busy=()=>busy;activeFreeze={release,lease};return release;},
  hydrate(game,raw,runtime,owner){if(!activeFreeze||owner!==activeFreeze.release)throw Error('Wrong runtime owner');if(hydrateError)throw Error('hydrate crash');const r=runtime===undefined?activeFreeze.lease.importSave(game):activeFreeze.lease.hydrateDevice(game,runtime);if(!r.ok)throw Error(r.message);social=JSON.parse(raw);}
 };
 const ports={control:{getState:()=>state},events:{readNext:async()=>q[0]||null,acknowledge:async r=>{
   ledger.assertHealthy();if(!ledger.find(q[0]))throw Error('ACK before ledger');
   acks.push(r);if(dropAck){q.shift();throw Error('ACK persisted response lost');}if(ackError)throw ackError;
   q.shift();return {status:'device_persisted',eventId:r.eventId};
 }}};
 const consumer=events.createConsumer({ports,ledger,storage:io,source,durable,now:clock,digest:async t=>crypto.createHash('sha256').update(t).digest('hex'),onResult:r=>results.push(r),fault:consumerFault});
 return {io,ledger,source,ports,durable,consumer,q,acks,results,wire,state,get store(){return store;},get social(){return social;},setBusy:b=>{busy=b;},setAckError:e=>{ackError=e;},loseAck:()=>{dropAck=true;},breakHydration:()=>{hydrateError=true;},
  care(action='pet',counter=1){return {source:'native_device',protocol:'CFLOCAL2',deviceId:ID,eventId:ID+':'+counter,counter,petId:wire.petId,occurredAtMs:null,kind:'care',action};},
  gift(counter=1){return {source:'native_device',protocol:'CFLOCAL2',deviceId:ID,eventId:ID+':'+counter,counter,petId:wire.petId,occurredAtMs:null,kind:'gift',peerId:PEER,peerCounter:1,giftId:'flower',quantity:1,peerComplete:false};}
 };
}
module.exports={harness,memory,db,events,ID,PEER,NOW,createStore:sandbox.factory,socialDefault:JSON.parse(JSON.stringify(socialSandbox.social))};
