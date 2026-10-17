'use strict';
/* 一天资料 · 心动标记（day_hearts_v1）：手机只在该能力被声明时随第一片发送 hearts，
   且不改变既有一段式校验、不写 NVS、不影响其他字段。 */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(__dirname+'/../web/cflocal2-adapter.js','utf8');
const ID='0123456789abcdef0123456789abcdef';

function harness({capabilities=['scene','snapshot','events','day_view']}={}){
  let raw=null,uid=0,seq=0,lastCommit=null,dayTotal=0;
  const state={stage:'ready_local',hello:{protocol:'CFLOCAL2',deviceId:ID,clientId:null,lastSeq:0,capabilities},evidence:{generation:1},device:{snapshot:null}};
  const requests=[];
  const control={getState:()=>JSON.parse(JSON.stringify(state)),receive(){},async request(op,data,extras){
    requests.push({op,data:structuredClone(data),extras});
    if(op==='day')return {data:{accepted:true,volatile:true,complete:data.part+1===data.parts,part:data.part,date:data.date,count:Math.min(dayTotal,(data.part+1)*16)}};
    if(op==='events')return {data:{event:null}};
    const command={op,data:structuredClone(data),extras:structuredClone(extras)};let duplicate=false;
    if(extras.seq===seq){assert.deepEqual(command,lastCommit);duplicate=true;}else{assert.equal(extras.seq,seq+1);seq++;lastCommit=command;}
    return {data:{persisted:true,seq:extras.seq,revision:data.revision??0,duplicate},generation:state.evidence.generation,gattWriteCompleted:true};
  }};
  const storage={getItem:()=>raw,setItem(k,v){raw=v;}};
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,require:()=>({createControl:()=>control}),TextEncoder,globalThis:{crypto:crypto.webcrypto},Map,Set,Number,JSON,Error,Object,Promise,Array});
  const create=()=>module.exports.createPorts({bridge:{},storage,durableCheckpoint:async r=>({persisted:true,journalSha256:crypto.createHash('sha256').update(r).digest('hex')}),uuid:()=>`00000000-0000-4000-8000-${String(++uid).padStart(12,'0')}`});
  return {create,control,state,requests,setDayTotal:n=>{dayTotal=n;}};
}

function scene(){return {requestId:'scene-1',petId:'pet-1',revision:0,scene:'home',action:'idle',weather:'clear',pet:{name:'Mikan',breed:'orange',food:70,mood:60,clean:80,energy:70,health:100,coins:30},epochMs:1792079999000};}
function day(overrides={}){return {schema:1,petId:'pet-1',date:'2026-10-17',zone:480,cutoff:600,mode:'automatic',segments:[[0,300,0,0,1],[300,600,3,0,2]],...overrides};}

async function ready(opts){
  const h=harness(opts),p=h.create();
  await p.scenes.pushScene(scene());
  return {h,p};
}

test('固件声明 day_hearts_v1 时，hearts 只随第一片发送',async()=>{
  const {h,p}=await ready({capabilities:['scene','snapshot','events','day_view','day_hearts_v1']});
  const many=Array.from({length:20},(_,i)=>[i*30,(i+1)*30,3,0,2]);
  const payload=day({segments:many,cutoff:600,hearts:[60,180,540]});h.setDayTotal(payload.segments.length);
  await p.display.pushDay(payload);
  const parts=h.requests.filter(r=>r.op==='day');
  assert.equal(parts.length,2);
  assert.deepEqual(parts[0].data.hearts,[60,180,540]);
  assert.equal(parts[1].data.hearts,undefined,'第二片不带 hearts');
});

test('未声明 day_hearts_v1 时即使传入也不发送',async()=>{
  const {h,p}=await ready();
  const payload=day({hearts:[60,180]});h.setDayTotal(payload.segments.length);
  await p.display.pushDay(payload);
  const parts=h.requests.filter(r=>r.op==='day');
  assert.equal(parts[0].data.hearts,undefined);
});

test('hearts 校验：越界、乱序、超过 12 个、非整数都被拒',async()=>{
  const {p}=await ready({capabilities:['scene','snapshot','events','day_view','day_hearts_v1']});
  for(const bad of [[601],[300,120],[0,1,2,3,4,5,6,7,8,9,10,11,12],[10.5],[ -1 ]]){
    await assert.rejects(p.display.pushDay(day({hearts:bad})),undefined,JSON.stringify(bad));
  }
});
