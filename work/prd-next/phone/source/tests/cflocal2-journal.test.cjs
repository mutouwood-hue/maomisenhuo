'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../web/cflocal2-adapter.js','utf8');
const ID='0123456789abcdef0123456789abcdef',PEER='fedcba9876543210fedcba9876543210';
function harness({initial=null,writeFailure=false}={}){
  let raw=initial,failWrite=writeFailure,uid=0,seq=0,lastCommit=null;
  const state={stage:'ready_local',hello:{protocol:'CFLOCAL2',deviceId:ID,clientId:null,lastSeq:0},evidence:{generation:1},device:{snapshot:null}};
  const requests=[];let rejectNext=null,unknownNext=null;
  const control={getState:()=>JSON.parse(JSON.stringify(state)),receive(){},async request(op,data,extras){
    requests.push({op,data:structuredClone(data),extras:structuredClone(extras)});
    if(op==='events')return {data:{event:control.event??null}};
    if(rejectNext){const error=rejectNext;rejectNext=null;throw error;}
    if(unknownNext){const error=unknownNext;unknownNext=null;throw error;}
    const command={op,data:structuredClone(data),extras:structuredClone(extras)};let duplicate=false;if(extras.seq===seq){assert.deepEqual(command,lastCommit);duplicate=true;}else{assert.equal(extras.seq,seq+1);seq++;lastCommit=command;}control.afterCommit?.();return {data:{persisted:true,seq:extras.seq,revision:data.revision??0,duplicate},generation:state.evidence.generation,gattWriteCompleted:true};
  }};
  const storage={getItem:()=>raw,setItem(k,v){if(failWrite)throw Error('disk');raw=v;}};
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,require:()=>({createControl:()=>control}),TextEncoder,globalThis:{crypto:require('node:crypto').webcrypto},Map,Set,Number,JSON,Error,Object,Promise});
  const create=()=>module.exports.createPorts({bridge:{},storage,durableCheckpoint:async raw=>({persisted:true,journalSha256:require('node:crypto').createHash('sha256').update(raw).digest('hex')}),uuid:()=>`00000000-0000-4000-8000-${String(++uid).padStart(12,'0')}`});
  return {create,control,state,requests,storage,raw:()=>raw,setFailure:b=>{failWrite=b;},setReject:e=>{rejectNext=e;},setUnknown:e=>{unknownNext=e;}};
}
function scene(overrides={}){return {requestId:'scene-1',petId:'pet-1',revision:0,scene:'home',action:'idle',weather:'clear',pet:{name:'小橘',breed:'orange',food:70,mood:60,clean:80,energy:70,health:100,coins:30},epochMs:1792079999000,...overrides};}
test('journal persists before any mutation and preserves exact pending command',async()=>{
  const h=harness(),p=h.create();h.setUnknown(Object.assign(Error('timeout'),{outcome:'unknown'}));
  await assert.rejects(p.scenes.pushScene(scene()),/timeout/);const saved=JSON.parse(h.raw());assert.equal(saved.devices[ID].pending.seq,1);assert.equal(saved.devices[ID].pending.data.scene,'home');
  const first=structuredClone(h.requests[0]);await assert.rejects(p.scenes.pushScene(scene({scene:'away',requestId:'next'})),/上一条/);assert.equal(h.requests.length,1);
  await p.scenes.retryPending({origin:'explicit_user_action'});assert.deepEqual(h.requests[1],first);assert.equal(JSON.parse(h.raw()).devices[ID].nextSeq,2);
});
test('semantic coalescing prevents frame/epoch heartbeat NVS writes',async()=>{
  const h=harness(),p=h.create();await p.scenes.pushScene(scene());for(let i=0;i<100;i++)assert.equal((await p.scenes.pushScene(scene({requestId:'id-'+i,epochMs:1792080000000+i}))).duplicate,true);assert.equal(h.requests.length,1);
  h.state.evidence.generation=2;await p.scenes.pushScene(scene({requestId:'reconnect'}));assert.equal(h.requests.length,2);assert.equal(h.requests[1].data.revision,2);
});
test('local storage failure blocks radio mutation',async()=>{const h=harness(),p=h.create();h.setFailure(true);await assert.rejects(p.scenes.pushScene(scene()),/存档/);assert.equal(h.requests.length,0);});
test('corrupt journal is preserved, never reset',()=>{const h=harness({initial:'{bad'});assert.throws(h.create,/损坏/);assert.equal(h.raw(),'{bad');});
test('invalid stats, enum, name and unsafe integers are rejected',async()=>{
  const h=harness(),p=h.create();for(const s of [scene({scene:'cloud'}),scene({revision:2**53}),scene({epochMs:0}),scene({pet:{...scene().pet,food:101}}),scene({pet:{...scene().pet,name:'橘'.repeat(9)}})])await assert.rejects(p.scenes.pushScene(s));assert.equal(h.requests.length,0);
});
test('new client cannot overwrite existing owner',async()=>{const h=harness(),p=h.create();h.state.hello.clientId='other';await assert.rejects(p.scenes.pushScene(scene()),/另一份/);assert.equal(h.requests.length,0);});
test('explicit application rejection clears pending; Native no_change does not',async()=>{
  const h=harness(),p=h.create();h.setReject(Object.assign(Error('queue full'),{applicationRejected:true,outcome:'no_change'}));await assert.rejects(p.scenes.pushScene(scene()));assert.equal(JSON.parse(h.raw()).devices[ID].pending,null);
  h.setUnknown(Object.assign(Error('native'),{outcome:'no_change'}));await assert.rejects(p.scenes.pushScene(scene()));assert.notEqual(JSON.parse(h.raw()).devices[ID].pending,null);
});
test('pending exact command survives constructing another adapter',async()=>{
  const h=harness(),p=h.create();h.setUnknown(Error('lost'));await assert.rejects(p.scenes.pushScene(scene()));const before=h.raw(),p2=h.create();assert.equal(h.raw(),before);await p2.scenes.retryPending({origin:'explicit_user_action'});assert.equal(h.requests[0].extras.id,h.requests[1].extras.id);
});
test('durable receipt and actual read event required before ACK',async()=>{
  const h=harness(),p=h.create();h.control.event={source:'native_device',protocol:'CFLOCAL2',deviceId:ID,eventId:ID+':1',counter:1,petId:'pet-1',occurredAtMs:null,kind:'gift',peerId:PEER,peerCounter:1,giftId:'flower',quantity:1,peerComplete:false};
  const receipt={eventId:ID+':1',status:'applied',persisted:true,saveDigest:'sha256:test'};
  await assert.rejects(p.events.acknowledge(receipt));await p.events.readNext();await assert.rejects(p.events.acknowledge({...receipt,persisted:false}));await p.events.acknowledge(receipt);assert.equal(h.requests.at(-1).op,'ack');
});
test('cross-device event and malformed gift rejected without ACK',async()=>{
  const h=harness(),p=h.create();h.control.event={source:'native_device',protocol:'CFLOCAL2',deviceId:PEER,eventId:PEER+':1',counter:1,petId:'pet-1',occurredAtMs:null,kind:'care',action:'pet'};await assert.rejects(p.events.readNext());assert.equal(h.requests.filter(x=>x.op==='ack').length,0);
});
test('retries require explicit action and scene pet payload is normalized',async()=>{
  const h=harness(),p=h.create();await assert.rejects(p.scenes.retryPending({origin:'timer'}));const s=scene();s.pet.unrelated='ignored';await p.scenes.pushScene(s);assert.equal(h.requests[0].data.pet.unrelated,undefined);
});

test('phone journal failure after device commit retains exact command for duplicate recovery',async()=>{
 const h=harness(),p=h.create();h.control.afterCommit=()=>h.setFailure(true);await assert.rejects(p.scenes.pushScene(scene()),/存档/);assert.equal(JSON.parse(h.raw()).devices[ID].pending.seq,1);
 h.setFailure(false);h.control.afterCommit=null;const p2=h.create();const reply=await p2.scenes.retryPending({origin:'explicit_user_action'});assert.equal(reply.data.duplicate,true);assert.equal(JSON.parse(h.raw()).devices[ID].nextSeq,2);
});
test('timezone validation and phone offset are included in the retained command',async()=>{
 const h=harness(),p=h.create();await assert.rejects(p.scenes.pushScene(scene({utcOffsetMinutes:841})));await p.scenes.pushScene(scene({utcOffsetMinutes:480}));assert.equal(h.requests[0].data.utcOffsetMinutes,480);
});
test('lost ACK recovery never replaces a fresh clock after device and phone restart',async()=>{
 const h=harness(),p=h.create();h.control.afterCommit=()=>h.setFailure(true);
 await assert.rejects(p.scenes.pushScene(scene()),/存档/);
 const exact=structuredClone(h.requests[0]);h.setFailure(false);h.control.afterCommit=null;
 h.state.evidence.generation=2;const restored=h.create();
 const recovered=await restored.scenes.retryPending({origin:'explicit_user_action'});
 assert.equal(recovered.data.duplicate,true);assert.deepEqual(h.requests[1],exact);
 const now=1792080999000;await restored.scenes.pushScene(scene({requestId:'fresh-clock',epochMs:now}));
 assert.equal(h.requests.length,3);assert.equal(h.requests[2].extras.seq,2);
 assert.equal(h.requests[2].data.revision,2);assert.equal(h.requests[2].data.epochMs,now);
 for(let i=0;i<100;i++)await restored.scenes.pushScene(scene({requestId:'sample-'+i,epochMs:now+i}));
 assert.equal(h.requests.length,3);
});
test('same-instance explicit recovery also requires a current snapshot before coalescing',async()=>{
 const h=harness(),p=h.create();h.setUnknown(Error('lost ACK'));
 await assert.rejects(p.scenes.pushScene(scene()));const exact=structuredClone(h.requests[0]);
 await p.scenes.retryPending({origin:'explicit_user_action'});assert.deepEqual(h.requests[1],exact);
 await p.scenes.pushScene(scene({requestId:'current',epochMs:1792080000000}));
 assert.equal(h.requests.length,3);assert.equal(h.requests[2].extras.seq,2);
});
test('snapshot without epoch cannot suppress the first current clock in its generation',async()=>{
 const h=harness(),p=h.create();const noClock=scene();delete noClock.epochMs;noClock.utcOffsetMinutes=480;
 await p.scenes.pushScene(noClock);assert.equal(h.requests[0].data.epochMs,undefined);
 await p.scenes.pushScene(scene({requestId:'clock',utcOffsetMinutes:480}));assert.equal(h.requests.length,2);
 await p.scenes.pushScene(scene({requestId:'clock-again',utcOffsetMinutes:480,epochMs:1792080000000}));
 assert.equal(h.requests.length,2);
});
