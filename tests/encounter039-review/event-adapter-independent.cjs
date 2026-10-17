'use strict';
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const base=path.resolve(__dirname,'../../artifacts/local-ble-adapter/versions/encounter-v1');
const file=base+'/test-encounter-journal.cjs';const s=fs.readFileSync(file,'utf8');let prefix=s.slice(0,s.indexOf("test('journal persists"));if(process.env.REVIEW_ADAPTER_SOURCE)prefix=prefix.replace("const source=fs.readFileSync(__dirname+'/encounter-adapter.js','utf8');","const source=fs.readFileSync("+JSON.stringify(process.env.REVIEW_ADAPTER_SOURCE)+",'utf8');");
const extra=`
(async()=>{
 const h=harness(),p=h.create();
 const e={source:'native_device',protocol:'CFLOCAL3',deviceId:ID,eventId:ID+':1',counter:1,petId:'pet-1',occurredAtMs:null,kind:'care',action:'pet'};
 h.control.event=e;await p.events.readNext();
 h.control.event={...e,action:'feed'};let conflict;
 try{await p.events.readNext();conflict='accepted';}catch(e){conflict=e.code;}
 let third;
 try{third=await p.events.readNext();}catch(e){third={rejected:e.code};}
 if(third.action)await p.events.acknowledge({eventId:e.eventId,status:'applied',persisted:true,saveDigest:'a'.repeat(64)});
 console.log(JSON.stringify({virtual_fixture:true,realAdapterAndEventCodec:true,originalAction:e.action,secondRead:conflict,thirdRead:third,wireAckCount:h.requests.filter(x=>x.op==='ack').length,verifier:'owner Native fixture verified=true; NOT actual Native history or reward writer'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});`;
new Function('require','__dirname',prefix+extra)(createRequire(file),base);
