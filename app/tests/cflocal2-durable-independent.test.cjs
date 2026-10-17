'use strict';
// Independent adapter boundary tests. Native persistence and BLE are memory fixtures.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(__dirname+'/../web/cflocal2-adapter.js','utf8');
const ID='a'.repeat(32),OTHER='b'.repeat(32),CLIENT='00000000-0000-4000-8000-000000000001';
const scene=id=>({requestId:id,petId:'cat-a',revision:1,scene:'home',action:'idle',weather:'clear',utcOffsetMinutes:480,epochMs:1792080000000,pet:{name:'小橘',breed:'orange',food:50,mood:60,clean:70,energy:80,health:90,coins:12}});
function fixture({subtle=crypto.webcrypto.subtle}={}) {
  let local=null,native=null,checkpointNo=0,sequence=0,last=null,hook=null;
  const wires=[],checkpoints=[];
  const state={stage:'ready_local',hello:{protocol:'CFLOCAL2',deviceId:ID,clientId:null,lastSeq:0},evidence:{generation:1},device:{snapshot:null}};
  const control={getState:()=>structuredClone(state),receive(){},async request(op,data,extra){
    const wire=JSON.stringify({v:2,id:extra.id,op,data,clientId:extra.clientId,seq:extra.seq});wires.push(wire);
    const duplicate=extra.seq===sequence;
    if(duplicate)assert.equal(wire,last);else{assert.equal(extra.seq,sequence+1);sequence++;last=wire;}
    return {v:2,id:extra.id,op,ok:true,data:{persisted:true,seq:extra.seq,duplicate},generation:state.evidence.generation,gattWriteCompleted:true};
  }};
  const storage={getItem:()=>local,setItem(key,value){local=value;}};
  const persist=raw=>{native=raw;return {persisted:true,journalSha256:crypto.createHash('sha256').update(raw,'utf8').digest('hex')};};
  const module={exports:{}};
  vm.runInNewContext(source,{module,require:()=>({createControl:()=>control}),TextEncoder,globalThis:{crypto:{subtle}},Map,Set,Number,JSON,Error,Object,Promise});
  const ports=module.exports.createPorts({bridge:{},storage,uuid:()=>CLIENT,durableCheckpoint:async raw=>{
    checkpoints.push(raw);const number=++checkpointNo;return hook?hook({raw,number,persist}):persist(raw);
  }});
  return {ports,wires,checkpoints,state,hook(fn){hook=fn;},native:()=>native,local:()=>local};
}
test('pre-checkpoint persisted but response lost sends zero bytes; explicit retry retains exact command',async()=>{
  const f=fixture();f.hook(({raw,number,persist})=>{const result=persist(raw);if(number===1)throw Error('Native response lost');return result;});
  await assert.rejects(f.ports.scenes.pushScene(scene('pre-lost')),{code:'DURABLE_CHECKPOINT_FAILED',outcome:'unknown'});
  assert.equal(f.wires.length,0);const pending=JSON.parse(f.native()).devices[ID].pending;
  f.hook(null);await f.ports.scenes.retryPending({origin:'explicit_user_action'});
  const wire=JSON.parse(f.wires[0]);assert.equal(wire.id,pending.id);assert.deepEqual(wire.data,pending.data);assert.equal(wire.seq,pending.seq);
});
test('post-checkpoint committed but response lost: same instance explicit retry is byte-identical duplicate',async()=>{
  const f=fixture();f.hook(({raw,number,persist})=>{const result=persist(raw);if(number===2)throw Error('post response lost');return result;});
  await assert.rejects(f.ports.scenes.pushScene(scene('post-lost')),{code:'DURABLE_CHECKPOINT_FAILED'});
  assert.equal(JSON.parse(f.native()).devices[ID].pending,null);assert.equal(f.ports.scenes.getPending().seq,1);
  f.hook(null);const reply=await f.ports.scenes.retryPending({origin:'explicit_user_action'});
  assert.equal(reply.data.duplicate,true);assert.equal(f.wires[1],f.wires[0]);assert.equal(JSON.parse(f.native()).devices[ID].nextSeq,2);
  await f.ports.scenes.pushScene(scene('fresh-after-retry'));assert.equal(JSON.parse(f.wires[2]).seq,2);
});
test('cross-device switch even with reused generation blocks wire after checkpoint',async()=>{
  const f=fixture();f.hook(({raw,persist})=>{f.state.hello.deviceId=OTHER;return persist(raw);});
  await assert.rejects(f.ports.scenes.pushScene(scene('cross-device')),{code:'STALE_GENERATION',outcome:'unknown'});
  assert.equal(f.wires.length,0);assert.equal(JSON.parse(f.native()).devices[ID].pending.id,'cross-device');
});
test('post-ACK session switch retains durable success but never coalesces next session snapshot',async()=>{
  const f=fixture();f.hook(({raw,number,persist})=>{if(number===2)f.state.evidence.generation=2;return persist(raw);});
  assert.equal((await f.ports.scenes.pushScene(scene('old-session'))).status,'device_persisted');
  f.hook(null);await f.ports.scenes.pushScene(scene('new-session'));assert.equal(f.wires.length,2);assert.equal(JSON.parse(f.wires[1]).seq,2);
});
test('post-ACK wrong SHA blocks public success and next mutation without dropping original intent',async()=>{
  const f=fixture();f.hook(({raw,number,persist})=>number===2?{persisted:true,journalSha256:'f'.repeat(64)}:persist(raw));
  await assert.rejects(f.ports.scenes.pushScene(scene('sha-post')),{code:'DURABLE_CHECKPOINT_FAILED',outcome:'unknown'});
  assert.equal(f.wires.length,1);assert.equal(f.ports.scenes.getPending().id,'sha-post');
  await assert.rejects(f.ports.scenes.pushScene(scene('must-not-replace')),{code:'PENDING_UNKNOWN'});assert.equal(f.wires.length,1);
});
test('SHA covers exact Unicode UTF8 and formatting rather than equivalent parsed JSON',async()=>{
  const f=fixture();f.hook(({raw,persist})=>{persist(raw);return {persisted:true,journalSha256:crypto.createHash('sha256').update(JSON.stringify(JSON.parse(raw),null,2),'utf8').digest('hex')};});
  await assert.rejects(f.ports.scenes.pushScene(scene('raw-sha')),{code:'DURABLE_CHECKPOINT_FAILED'});assert.equal(f.wires.length,0);assert.ok(f.checkpoints[0].includes('小橘'));
});
test('missing WebCrypto never calls Native checkpoint or wire',async()=>{
  const f=fixture({subtle:{}});await assert.rejects(f.ports.scenes.pushScene(scene('no-crypto')),{code:'DURABLE_CHECKPOINT_FAILED'});
  assert.equal(f.checkpoints.length,0);assert.equal(f.wires.length,0);assert.equal(f.ports.scenes.getPending().id,'no-crypto');
});
