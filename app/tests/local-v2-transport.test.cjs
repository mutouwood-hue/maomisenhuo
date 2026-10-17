'use strict';
const assert = require('node:assert/strict');
const {createControl,codec} = require('../web/local-v2-transport.js');
const USER = {origin:'explicit_user_action'};
const DEVICE = '0123456789abcdef0123456789abcdef';
const CLIENT = '11111111-2222-4333-8444-555555555555';
const ADDRESS = 'AA:BB:CC:DD:EE:01';
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
const {test}=require('node:test');
class Fixture {
  constructor(options = {}) {
    this.options = options; this.calls = []; this.commands = []; this.rawCommands = []; this.fragments=[]; this.bytes=[]; this.generation=0; this.mode='off'; this.disconnected=0; this.held=[];
    this.flights=[];this.endedFlights=[];
    this.control = createControl({bridge:{postMessage:json=>this.post(JSON.parse(json))},commandTimeoutMs:options.timeout ?? 150,nativeTimeoutMs:options.nativeTimeout ?? 150});
  }
  send(event) { this.control.receive(event); }
  result(request,result = {}) { this.send({type:'result',requestId:request.requestId,ok:true,result}); }
  reject(request,code,outcome='no_change') { this.send({type:'result',requestId:request.requestId,ok:false,error:{code,message:code,outcome}}); }
  evidence() { return {generation:this.generation,address:ADDRESS,serviceVerified:true,rxVerified:true,txVerified:true,subscribed:true}; }
  availability() { return {available:true,granted:true,bluetoothEnabled:true,mode:this.mode,...this.options.availability}; }
  hello() { return {protocol:'CFLOCAL2',deviceId:DEVICE,capabilities:['scene','snapshot','events','peer'],maxLine:2048,clientId:null,lastSeq:0,...this.options.hello}; }
  state() { return {deviceId:DEVICE,hasSnapshot:true,storageError:false,pending:0,lastAck:0,lastSeq:0,clientId:null,snapshot:{petId:'cat-a',revision:3,pet:{name:'小橘🌸'}},...this.options.state}; }
  post(request) {
    this.calls.push(request);
    switch(request.method) {
      case 'initialize': return this.result(request,this.availability());
      case 'selectTransport':
        if(this.options.routeError)return this.reject(request,'NOT_READY','unknown');
        if(this.mode!==request.args.mode && this.generation>1)this.send({type:'connection',generation:this.generation,address:ADDRESS,state:'disconnected',reason:'route switch'});
        this.mode=request.args.mode;return this.result(request,{mode:this.mode,foreground:this.mode==='cflocal2'});
      case 'requestPermissions':return this.result(request,this.options.permission || this.availability());
      case 'scan': {
        const device={generation:++this.generation,address:ADDRESS,name:'真实fixture设备',rssi:-48,source:'native_scan'};
        this.send({type:'device',...device});return this.result(request,{generation:this.generation,devices:[device]});
      }
      case 'stopScan':return this.result(request,{devices:[],generation:this.generation});
      case 'connect': {
        ++this.generation;this.bytes=[];
        const evidence={...this.evidence(),...this.options.evidence};
        if(this.options.connectReplyFirst)this.result(request,evidence);
        for(const state of ['connecting','discovering','subscribing','subscribed'])this.send({type:'connection',...evidence,state,reason:''});
        if(!this.options.connectReplyFirst)this.result(request,evidence);return;
      }
      case 'write': {
        if(this.options.nativeWriteError)return this.reject(request,'WRITE_FAILED','unknown');
        const bytes=Buffer.from(request.args.base64,'base64');this.fragments.push(bytes);
        assert.ok(bytes.length>=1 && bytes.length<=20);assert.equal(request.args.generation,this.generation);
        this.bytes.push(...bytes);
        let command=null;
        if(bytes.at(-1)===10){const raw=Buffer.from(this.bytes).toString('utf8').trimEnd();this.rawCommands.push(raw);command=JSON.parse(raw);this.commands.push(command);this.bytes=[];}
        if(command && this.options.silent?.includes(command.op)){this.result(request,{generation:this.generation});return;}
        if(command && this.options.raw){this.frame(this.options.raw(command),this.options.frameGeneration ?? this.generation);this.result(request,{generation:this.generation});return;}
        if(command && this.options.ackFirst!==false)this.reply(command);
        if(command && this.options.holdLastWrite){this.held.push(()=>this.result(request,{generation:this.options.wrongWriteGeneration?this.generation+1:this.generation}));return;}
        this.result(request,{generation:this.options.wrongWriteGeneration?this.generation+1:this.generation});
        if(command && this.options.ackFirst===false)queueMicrotask(()=>this.reply(command));return;
      }
      case 'beginFlight': this.flights.push({id:request.args.id,generation:request.args.generation}); return this.result(request,{generation:this.generation});
      case 'endFlight': this.endedFlights.push(request.args.id); return this.result(request,{generation:this.generation});
      case 'disconnect':this.disconnected++;return this.result(request,{generation:this.generation});
      case 'dispose':return this.result(request,{});
      default:throw new Error('Unexpected native method '+request.method);
    }
  }
  reply(command) {
    let data=command.op==='hello'?this.hello():command.op==='state'?this.state():command.op==='events'?{event:null}:{persisted:true,seq:command.seq};
    const response={v:2,id:command.id,op:command.op,ok:true,data};
    if(this.options.appError?.op===command.op){response.ok=false;delete response.data;response.error=this.options.appError.error;}
    this.frame(JSON.stringify(this.options.response?this.options.response(response,command):response)+'\n',this.options.frameGeneration ?? this.generation);
  }
  frame(value,generation=this.generation) {
    const bytes=typeof value==='string'?Buffer.from(value):Buffer.from(value);
    const size=this.options.split ?? 20;
    for(let offset=0;offset<bytes.length;offset+=size)this.send({type:'frame',generation,value:bytes.subarray(offset,offset+size).toString('base64')});
  }
  async selected() { await this.control.initialize();await this.control.selectTransport('cflocal2',USER);const devices=await this.control.scan({...USER,durationMs:1000});return devices[0]; }
  async ready() { return this.control.connect(await this.selected(),USER); }
  async close() { await this.control.dispose(); }
}

test('initialize is listener-only; permissions precede unknown Bluetooth; explicit route required',async()=>{
  const f=new Fixture({availability:{granted:false,bluetoothEnabled:null}});
  await f.control.initialize();assert.deepEqual(f.calls.map(x=>x.method),['initialize']);assert.equal(f.control.getState().stage,'permission_required');
  await assert.rejects(f.control.scan({...USER,durationMs:1000}),{code:'NOT_READY'});
  await assert.rejects(f.control.selectTransport('cflocal2',{}),{code:'NOT_READY'});await f.close();
});
test('real subscribed evidence + HELLO/state; UTF8 split bytewise; peer only declared',async()=>{
  const f=new Fixture({split:1});const ready=await f.ready();assert.equal(ready.stage,'ready_local');assert.equal(ready.device.snapshot.pet.name,'小橘🌸');assert.equal(ready.capabilities.peer,'declared');
  assert.deepEqual(f.commands.map(x=>x.op),['hello','state']);assert.ok(f.fragments.every(x=>x.length<=20));await f.close();
});
test('connect result may precede subscribed event; writes may precede app ACK',async()=>{
  const f=new Fixture({connectReplyFirst:true,ackFirst:false});assert.equal((await f.ready()).stage,'ready_local');assert.equal((await f.control.readDeviceState()).gattWriteCompleted,true);await f.close();
});
test('early app ACK cannot settle before final GATT completion',async()=>{
  const f=new Fixture({holdLastWrite:true});let resolved=false;const ready=f.ready().then(v=>{resolved=true;return v;});await delay(5);assert.equal(resolved,false);assert.equal(f.commands[0].op,'hello');
  f.held.shift()();await delay(5);assert.equal(resolved,false);assert.equal(f.commands[1].op,'state');f.held.shift()();assert.equal((await ready).stage,'ready_local');await f.close();
});
test('mutation needs persisted identity, stable exact wire order, no native sequence allocation',async()=>{
  const f=new Fixture();await f.ready();const count=f.commands.length;
  await assert.rejects(f.control.request('snapshot',{petId:'cat-a'}),{code:'BAD_REQUEST'});assert.equal(f.commands.length,count);
  const data={petId:'cat-a',revision:3};const extras={id:'persisted-1',clientId:CLIENT,seq:8};const result=await f.control.request('snapshot',data,extras);
  assert.equal(result.data.persisted,true);assert.equal(result.generation,f.generation);assert.equal(result.gattWriteCompleted,true);
  assert.equal(f.rawCommands.at(-1),JSON.stringify({v:2,id:'persisted-1',op:'snapshot',data,clientId:CLIENT,seq:8}));
  await f.control.request('snapshot',data,extras);assert.equal(f.rawCommands.at(-1),f.rawCommands.at(-2));await f.close();
});
test('public operations/extras/oversize are rejected before any write',async()=>{
  const f=new Fixture();await f.ready();const count=f.fragments.length;
  await assert.rejects(f.control.request('grant',{}),{code:'UNSUPPORTED_PROTOCOL'});
  await assert.rejects(f.control.request('events',{}, {seq:1}),{code:'BAD_REQUEST'});
  await assert.rejects(f.control.request('snapshot',{text:'猫'.repeat(800)},{id:'big',clientId:CLIENT,seq:1}),{code:'MALFORMED_FRAME'});
  assert.equal(f.fragments.length,count);await f.close();
});
test('one app operation in flight; no automatic queue/replay',async()=>{
  const f=new Fixture();await f.ready();f.options.silent=['snapshot'];f.control.commandTimeoutMs=25;
  const pending=f.control.request('snapshot',{}, {id:'uncertain',clientId:CLIENT,seq:1});const rejected=assert.rejects(pending,{code:'ACK_TIMEOUT_OUTCOME_UNKNOWN',outcome:'unknown'});
  await assert.rejects(f.control.request('events'),{code:'BUSY'});await rejected;assert.equal(f.commands.filter(x=>x.id==='uncertain').length,1);assert.equal(f.control.getState().stage,'error');assert.ok(f.disconnected);await f.close();
});
for(const [name,options] of [
  ['missing native evidence',{evidence:{subscribed:false}}],
  ['wrong hello protocol',{hello:{protocol:'BJ20'}}],
  ['missing capabilities',{hello:{capabilities:['scene']}}],
  ['wrong device id',{hello:{deviceId:'bad'}}],
  ['unsafe hello seq',{hello:{lastSeq:Number.MAX_SAFE_INTEGER+1}}],
  ['wrong state device',{state:{deviceId:'f'.repeat(32)}}],
  ['legacy bytes',{raw:()=>Buffer.from('BJ\x01\x02')}],
  ['invalid UTF8',{raw:()=>Buffer.from([123,34,120,34,58,34,0xc0,0xaf,34,125,10])}],
  ['duplicate escaped key',{raw:c=>`{"v":2,"\\u0076":2,"id":"${c.id}","op":"hello","ok":true,"data":{}}\n`}],
  ['bad JSON',{raw:()=>'{bad}\n'}],
  ['oversized line',{raw:()=>'{'+ 'a'.repeat(2048)}],
  ['stale frame timeout',{frameGeneration:0,timeout:20}],
  ['stale write completion',{wrongWriteGeneration:true}],
  ['id/op mismatch',{response:(r,c)=>({...r,op:c.op==='hello'?'state':'hello'})}]
])test(name+' never ready and disconnects',async()=>{const f=new Fixture(options);await assert.rejects(f.ready());assert.equal(f.control.getState().stage,'error');assert.ok(f.disconnected);await f.close();});
test('wrong response id cannot settle request',async()=>{
  const f=new Fixture({response:r=>({...r,id:'unrelated'}),timeout:20});await assert.rejects(f.ready(),{code:'ACK_TIMEOUT_OUTCOME_UNKNOWN'});assert.equal(f.commands.length,1);await f.close();
});
test('negative app code/no_change passes through and does not replay',async()=>{
  const f=new Fixture();await f.ready();f.options.appError={op:'snapshot',error:{code:'sequence_gap',outcome:'no_change'}};
  await assert.rejects(f.control.request('snapshot',{}, {id:'reject',clientId:CLIENT,seq:2}),{code:'sequence_gap',outcome:'no_change',applicationRejected:true});assert.equal(f.control.getState().stage,'ready_local');await f.close();
});
test('storage unknown rejects and disconnects without retry',async()=>{
  const f=new Fixture();await f.ready();f.options.appError={op:'ack',error:{code:'storage_error',outcome:'unknown'}};
  await assert.rejects(f.control.request('ack',{}, {id:'save',clientId:CLIENT,seq:1}),{code:'storage_error',outcome:'unknown',applicationRejected:true});assert.equal(f.commands.filter(x=>x.id==='save').length,1);assert.equal(f.control.getState().stage,'error');await f.close();
});
test('native failure is never marked as an application rejection',async()=>{
  const f=new Fixture();await f.ready();f.options.nativeWriteError=true;
  await assert.rejects(f.control.request('ack',{}, {id:'native-fail',clientId:CLIENT,seq:1}),error=>error.code==='WRITE_FAILED' && error.outcome==='unknown' && error.applicationRejected===undefined);
  assert.equal(f.commands.filter(x=>x.id==='native-fail').length,0);await f.close();
});
test('public state response updates authoritative link data exactly once',async()=>{
  const f=new Fixture();await f.ready();const states=[];const unsubscribe=f.control.subscribe(state=>states.push(state));
  f.options.state={snapshot:{petId:'cat-a',revision:9,pet:{name:'小橘'}}};
  const reply=await f.control.request('state');assert.equal(reply.data.snapshot.revision,9);assert.equal(f.control.getState().device.snapshot.revision,9);
  assert.equal(states.filter(state=>state.device?.snapshot?.revision===9).length,1);unsubscribe();await f.close();
});
test('explicit route switches preserve switch RPC despite native disconnect; same route preserves ready',async()=>{
  const f=new Fixture();await f.ready();await f.control.selectTransport('cflocal2',USER);assert.equal(f.control.getState().stage,'ready_local');
  await f.control.selectTransport('legacy',USER);assert.equal(f.control.getState().stage,'disconnected');assert.equal(f.mode,'legacy');await assert.rejects(f.control.scan({...USER,durationMs:1000}),{code:'NOT_READY'});await f.close();
});
test('permission denial and native mode rollback failure remain honest',async()=>{
  const f=new Fixture({permission:{available:true,granted:false,bluetoothEnabled:null}});assert.deepEqual(await f.control.requestPermissions(USER),{granted:false});assert.equal(f.control.getState().stage,'permission_required');
  f.options.routeError=true;await assert.rejects(f.control.selectTransport('cflocal2',USER),{outcome:'unknown'});assert.equal(f.control.mode,'off');await f.close();
});
test('disconnect and stale events cannot revive readiness',async()=>{
  const f=new Fixture();await f.ready();const old=f.generation;await f.control.disconnect();f.send({type:'connection',...f.evidence(),state:'subscribed'});f.frame('{}\n',old);assert.equal(f.control.getState().stage,'disconnected');
  await assert.rejects(f.control.connect({address:ADDRESS,source:'native_scan'},USER),{code:'NOT_READY'});await f.close();
});
test('unexpected native disconnect requires a fresh scan selection',async()=>{
  const f=new Fixture();await f.ready();f.send({type:'connection',...f.evidence(),state:'disconnected',reason:'background'});
  assert.equal(f.control.getState().stage,'disconnected');await assert.rejects(f.control.connect({address:ADDRESS,source:'native_scan'},USER),{code:'NOT_READY'});
  assert.equal(f.calls.filter(call=>call.method==='connect').length,1);await f.close();
});
test('strict JSON rejects duplicate nested keys, depth, NUL, prototype keys safely and unsafe numbers',async()=>{
  for(const value of ['{"data":{"id":1,"id":2}}','{"v":2,"v":2}','{"x":"\\u0000"}','{"x":9007199254740992}','{"x":"\\ud800"}',JSON.stringify({x:1}).replace('1','1e999'),'['+ '{}'+']'])assert.throws(()=>codec.strictJSON(value));
  let value='{}';for(let i=0;i<18;i++)value='{"a":'+value+'}';assert.throws(()=>codec.strictJSON(value));
  const prototype=codec.strictJSON('{"__proto__":{"test":1}}');assert.equal({}.test,undefined);assert.equal(Object.hasOwn(prototype,'__proto__'),true);
});
