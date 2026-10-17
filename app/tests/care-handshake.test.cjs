'use strict';
/* 清洁照料握手：手机在读到设备事件前，必须用不带 seq 的 care_capabilities 确认同 owner 的
   care_bath_v1 / mobile_context_v1；确认未通过时不得结算或删除设备事件。 */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(__dirname+'/../web/cflocal2-adapter.js','utf8');
const ID='0123456789abcdef0123456789abcdef';

function harness({capabilities=['scene','snapshot','events','care_bath_v1'],confirm=true,echoClientId=true}={}){
  let raw=null,uid=0,seq=0,lastCommit=null;
  const state={stage:'ready_local',hello:{protocol:'CFLOCAL2',deviceId:ID,clientId:null,lastSeq:0,capabilities},evidence:{generation:1},device:{snapshot:null}};
  const requests=[];
  const control={getState:()=>JSON.parse(JSON.stringify(state)),receive(){},async request(op,data,extras){
    requests.push({op,data:structuredClone(data),extras:structuredClone(extras)});
    if(op==='care_capabilities'){
      const owner=raw?JSON.parse(raw).clientId??null:null;
      const payload={careBathV1:true,confirmed:confirm,deviceId:ID,clientId:echoClientId?owner:'deadbeef'};
      if(data.mobileContextV1)payload.mobileContextV1=true;
      return {data:payload};
    }
    if(op==='events')return {data:{event:null}};
    const command={op,data:structuredClone(data),extras:structuredClone(extras)};let duplicate=false;
    if(extras.seq===seq){assert.deepEqual(command,lastCommit);duplicate=true;}else{assert.equal(extras.seq,seq+1);seq++;lastCommit=command;}
    return {data:{persisted:true,seq:extras.seq,revision:data.revision??0,duplicate},generation:state.evidence.generation,gattWriteCompleted:true};
  }};
  const storage={getItem:()=>raw,setItem(k,v){raw=v;}};
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,require:()=>({createControl:()=>control}),TextEncoder,globalThis:{crypto:crypto.webcrypto},Map,Set,Number,JSON,Error,Object,Promise});
  const create=()=>module.exports.createPorts({bridge:{},storage,durableCheckpoint:async r=>({persisted:true,journalSha256:crypto.createHash('sha256').update(r).digest('hex')}),uuid:()=>`00000000-0000-4000-8000-${String(++uid).padStart(12,'0')}`});
  return {create,control,state,requests,raw:()=>raw};
}

test('care_capabilities confirmed without consuming a mutation seq before reading events',async()=>{
  const h=harness({capabilities:['scene','snapshot','events','care_bath_v1','mobile_context_v1']});
  const p=h.create();
  assert.equal(await p.events.readNext(),null);
  const confirmations=h.requests.filter(r=>r.op==='care_capabilities');
  assert.equal(confirmations.length,1);
  assert.equal(confirmations[0].extras.seq,undefined,'确认不得占用 mutation seq');
  assert.deepEqual(confirmations[0].data,{careBathV1:true,mobileContextV1:true});
  assert.equal(h.requests.filter(r=>r.op==='events').length,1);
});

test('second read in the same generation does not re-confirm',async()=>{
  const h=harness(),p=h.create();
  await p.events.readNext();await p.events.readNext();
  assert.equal(h.requests.filter(r=>r.op==='care_capabilities').length,1);
});

test('unconfirmed bath capability surfaces an explicit error and keeps the event',async()=>{
  const h=harness({confirm:false}),p=h.create();
  await assert.rejects(p.events.readNext(),/清洁与手机信息支持确认未通过/);
  assert.equal(h.requests.filter(r=>r.op==='events').length,0,'确认失败不得继续读事件');
});

test('owner mismatch in the confirmation is rejected',async()=>{
  const h=harness({echoClientId:false}),p=h.create();
  await assert.rejects(p.events.readNext(),/清洁与手机信息支持确认未通过/);
});

test('device without care_bath_v1 never sends the confirmation',async()=>{
  const h=harness({capabilities:['scene','snapshot','events']}),p=h.create();
  await p.events.readNext();
  assert.equal(h.requests.filter(r=>r.op==='care_capabilities').length,0);
});
