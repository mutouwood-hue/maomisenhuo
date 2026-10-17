/* virtual_fixture: no Java, radio, original-game rewards or product fake-success flag. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process'),readline=require('node:readline'),assert=require('node:assert/strict');
const {once}=require('node:events'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..');
const adapter=require(path.join(ROOT,'artifacts/local-ble-adapter/source/js/cflocal2-adapter.js'));
const out=path.join(__dirname,'scenario-result.json'),workspace=fs.mkdtempSync(path.join(os.tmpdir(),'cat-local2-e2e-'));
const blob=path.join(workspace,'state.blob');
const steps=[],trace=[];let cli,ports,fixture;
function check(name,fn){fn();steps.push({name,status:'passed',evidence:'virtual_fixture'});}
function durableWrite(filename,text){const temp=filename+'.tmp',fd=fs.openSync(temp,'w');try{fs.writeFileSync(fd,text);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,filename);const dir=fs.openSync(path.dirname(filename),'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}assert.equal(fs.readFileSync(filename,'utf8'),text);}
class DiskStorage{constructor(name){this.path=path.join(workspace,name);}getItem(key){const value=fs.existsSync(this.path)?JSON.parse(fs.readFileSync(this.path,'utf8')):{};return Object.hasOwn(value,key)?value[key]:null;}setItem(key,value){const obj=fs.existsSync(this.path)?JSON.parse(fs.readFileSync(this.path,'utf8')):{};obj[key]=value;durableWrite(this.path,JSON.stringify(obj));}}
class CLI{
 constructor(){this.pending=[];this.errors='';this.child=spawn(path.join(__dirname,'wire-cli'),[blob],{stdio:['pipe','pipe','pipe']});this.child.stderr.on('data',d=>this.errors+=d);readline.createInterface({input:this.child.stdout}).on('line',line=>{const p=this.pending.shift();if(!p)throw Error('unsolicited CLI response');try{const json=JSON.parse(line);if(/^!(care|gift) /.test(p.line))trace.push({fixture:'synthetic_driver_input',input:p.line,result:json});p.resolve({text:line,json});}catch(e){p.reject(e);}});this.child.on('exit',(code)=>{for(const p of this.pending.splice(0))p.reject(Error('CLI exited '+code+' '+this.errors));});}
 send(line){return new Promise((resolve,reject)=>{this.pending.push({resolve,reject,line});this.child.stdin.write(line+'\n');});}
 async close(){const end=once(this.child,'exit');this.child.stdin.end();await end;assert.equal(this.child.exitCode,0,this.errors);}
}
class NativeFixture{
 constructor(){this.mode='off';this.generation=0;this.input=Buffer.alloc(0);this.writes=[];this.requests=[];this.frames=[];this.dropOp=null;this.receiver=null;}
 result(id,result){this.receiver({type:'result',requestId:id,ok:true,result});}
 postMessage(raw){const req=JSON.parse(raw);queueMicrotask(()=>this.handle(req).catch(e=>{this.receiver({type:'result',requestId:req.requestId,ok:false,error:{code:'FIXTURE_ERROR',message:String(e),outcome:'unknown'}});}));}
 async handle({requestId,method,args}){
  if(method==='initialize')return this.result(requestId,{available:true,granted:true,bluetoothEnabled:true,mode:this.mode});
  if(method==='selectTransport'){this.mode=args.mode;return this.result(requestId,{mode:this.mode});}
  if(method==='scan'){this.generation++;return this.result(requestId,{generation:this.generation,devices:[{source:'native_scan',generation:this.generation,address:'AA:BB:CC:DD:EE:FF',name:'CFLOCAL2 virtual_fixture',rssi:-42}]});}
  if(method==='connect'){
   this.generation++;this.input=Buffer.alloc(0);const e={generation:this.generation,address:args.address,serviceVerified:true,rxVerified:true,txVerified:true,subscribed:true};
   this.result(requestId,e);this.receiver({type:'connection',state:'subscribed',...e});return;
  }
  if(['disconnect','dispose','stopScan'].includes(method)){this.input=Buffer.alloc(0);return this.result(requestId,{});}
  if(method!=='write')throw Error('unexpected fixture RPC '+method);
  assert.equal(args.generation,this.generation);const bytes=Buffer.from(args.base64,'base64');assert(bytes.length>=1&&bytes.length<=20);this.writes.push(bytes.length);this.input=Buffer.concat([this.input,bytes]);
  const at=this.input.indexOf(10);
  if(at!==-1){assert.equal(at,this.input.length-1);const line=this.input.subarray(0,at).toString('utf8');this.input=Buffer.alloc(0);const cmd=JSON.parse(line);this.requests.push({line,cmd});const response=await cli.send(line);trace.push({direction:'JS_to_C',op:cmd.op,id:cmd.id,seq:cmd.seq,response:response.json});
   if(cmd.op===this.dropOp){this.dropOp=null;trace.push({fixture:'dropped_application_response',op:cmd.op,id:cmd.id});}
   else{const reply=Buffer.from(response.text+'\n','utf8');for(let i=0;i<reply.length;i+=20){const frame=reply.subarray(i,i+20);this.frames.push(frame.length);this.receiver({type:'frame',generation:this.generation,value:frame.toString('base64')});}}
  }
  this.result(requestId,{generation:this.generation});
 }
}
const storage=new DiskStorage('phone-journal.json');let uuidCounter=0;
const uuid=()=>`11111111-1111-4111-8111-${String(++uuidCounter).padStart(12,'0')}`;
function makePorts(){ports=adapter.createPorts({bridge:fixture,storage,uuid,commandTimeoutMs:1000,nativeTimeoutMs:1000});fixture.receiver=input=>ports.control.receive(input);}
async function connect(){await ports.control.initialize();await ports.control.selectTransport('cflocal2',{origin:'explicit_user_action'});const devices=await ports.control.scan({origin:'explicit_user_action',durationMs:1000});return ports.control.connect(devices[0],{origin:'explicit_user_action'});}
const base={requestId:'scene-home',petId:'virtual-cat',revision:7,scene:'home',action:'idle',weather:'clear',epochMs:1800000000000,utcOffsetMinutes:480,pet:{name:'小橘',breed:'orange',food:70,mood:80,clean:90,energy:85,health:100,coins:12}};
async function state(){return (await ports.control.readDeviceState()).data;}
async function inspect(){return (await cli.send('!inspect')).json;}
function receipt(event,status='applied'){
 const p=path.join(workspace,'host-receipts.json');const receipts=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{};
 const existed=!!receipts[event.eventId];if(!existed)receipts[event.eventId]={kind:event.kind,petId:event.petId,source:'synthetic_Host_receipt_fixture',status};
 const text=JSON.stringify(receipts);durableWrite(p,text);
 return {eventId:event.eventId,status:existed?'duplicate':status,persisted:true,saveDigest:crypto.createHash('sha256').update(text).digest('hex')};
}
(async()=>{
 try{
  cli=new CLI();await cli.send('!inspect');fixture=new NativeFixture();makePorts();const ready=await connect();
  check('initialize → native-fixture scan/subscription → production HELLO/state',()=>{assert.equal(ready.stage,'ready_local');assert.equal(ready.hello.protocol,'CFLOCAL2');assert.equal(ready.device.hasSnapshot,false);});
  const first=await ports.scenes.pushScene(base);let s=await state();
  check('first owner scene survives JS schema and C persistence',()=>{assert.equal(first.status,'device_persisted');assert.equal(s.snapshot.scene,'home');assert.equal(s.snapshot.pet.name,'小橘');assert.equal(s.snapshot.revision,1);assert.match(s.clientId,/^11111111-/);});
  let before=await inspect();const same=await ports.scenes.pushScene({...base,requestId:'same-semantic',epochMs:1800000001000});let after=await inspect();
  check('same scene semantic projection does not write again',()=>{assert.equal(same.duplicate,true);assert.equal(before.commitsThisProcess,after.commitsThisProcess);});
  for(const [i,scene,action,weather] of [[1,'departing','walk','clear'],[2,'away','walk','rain'],[3,'returning','walk','rain'],[4,'home','idle','clear']]){
   await ports.scenes.pushScene({...base,requestId:'scene-'+i,scene,action,weather});s=await state();
   check('scene roundtrip '+scene+'/'+weather,()=>{assert.equal(s.snapshot.scene,scene);assert.equal(s.snapshot.action,action);assert.equal(s.snapshot.weather,weather);assert.equal(s.snapshot.pet.coins,12);});
  }
  before=await inspect();fixture.dropOp='snapshot';await assert.rejects(ports.scenes.pushScene({...base,requestId:'lost-scene',scene:'away',weather:'rain'}),e=>e.outcome==='unknown');
  const lost=fixture.requests.at(-1).line;await connect();const retry=await ports.scenes.retryPending({origin:'explicit_user_action'});after=await inspect();
  check('lost snapshot application ACK retains journal; explicit retry uses same bytes',()=>{assert.equal(fixture.requests.at(-1).line,lost);assert.equal(retry.data.duplicate,true);assert.equal(after.commitsThisProcess,before.commitsThisProcess+1);assert.equal(ports.scenes.getPending(),null);});
  await ports.control.dispose();const diskBefore=fs.readFileSync(blob);await cli.close();cli=new CLI();makePorts();await connect();s=await state();after=await inspect();
  check('CLI process restart + new JS adapter recover owner scene from one blob',()=>{assert.equal(s.snapshot.scene,'away');assert.equal(s.snapshot.weather,'rain');assert.equal(after.commitsThisProcess,0);assert.deepEqual(fs.readFileSync(blob),diskBefore);assert.equal(s.lastSeq,6);});
  let injected=await cli.send('!care 2');assert.equal(injected.json.status,0);let e=await ports.events.readNext();
  check('synthetic device driver → real core care → real wire → JS read',()=>{assert.equal(e.kind,'care');assert.equal(e.action,'pet');assert.equal(e.protocol,'CFLOCAL2');assert.equal(e.petId,'virtual-cat');assert.equal(e.counter,1);});
  before=await inspect();await assert.rejects(ports.events.acknowledge({eventId:e.eventId,persisted:false,status:'applied',saveDigest:'bad'}),err=>err.code==='DURABLE_RECEIPT_REQUIRED');after=await inspect();
  check('no Host durable receipt means no wire ACK or dequeue',()=>{assert.equal(after.pending,1);assert.equal(after.commitsThisProcess,before.commitsThisProcess);});
  const careReceipt=receipt(e);fixture.dropOp='ack';await assert.rejects(ports.events.acknowledge(careReceipt),err=>err.outcome==='unknown');const ackRaw=fixture.requests.at(-1).line;after=await inspect();assert.equal(after.pending,0);
  await ports.control.dispose();await cli.close();cli=new CLI();makePorts();await connect();const ackRetry=await ports.scenes.retryPending({origin:'explicit_user_action'});after=await inspect();
  check('durable Host receipt → ACK lost → both processes restart → byte-identical duplicate ACK',()=>{assert.equal(fixture.requests.at(-1).line,ackRaw);assert.equal(ackRetry.data.duplicate,true);assert.equal(after.commitsThisProcess,0);assert.equal(after.pending,0);assert.equal(ports.scenes.getPending(),null);});
  assert.equal(await ports.events.readNext(),null);
  const peer='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';injected=await cli.send('!gift '+peer+' 1');assert.equal(injected.json.status,0);e=await ports.events.readNext();
  check('synthetic peer receipt → real core gift → wire → JS event schema',()=>{assert.equal(e.kind,'gift');assert.equal(e.peerId,peer);assert.equal(e.peerCounter,1);assert.equal(e.giftId,'flower');assert.equal(e.quantity,1);assert.equal(e.counter,2);assert.equal(e.peerComplete,false);});
  const giftReceipt=receipt(e);await ports.events.acknowledge(giftReceipt);after=await inspect();
  check('Host fixture fsync/readback receipt precedes gift ACK',()=>{assert.equal(after.pending,0);assert.equal(after.seq,8);});
  injected=await cli.send('!gift '+peer+' 1');s=await state();
  check('same synthetic peer receipt remains duplicate after delivery; no second event',()=>{assert.equal(injected.json.status,1);assert.equal(s.pending,0);});
  injected=await cli.send('!care 4');assert.equal(injected.json.status,0);e=await ports.events.readNext();
  check('durable event counter after ACK/restart does not reuse IDs',()=>{assert.equal(e.counter,3);assert.equal(e.action,'water');});
  const waterEvent=e,waterReceipt=receipt(e);assert.equal(waterReceipt.status,'applied');
  await ports.control.dispose();await cli.close();cli=new CLI();makePorts();await connect();e=await ports.events.readNext();const duplicateReceipt=receipt(e);
  check('Host saved receipt then restart before ACK re-reads same event without reapplying',()=>{assert.deepEqual(e,waterEvent);assert.equal(duplicateReceipt.status,'duplicate');});
  await ports.events.acknowledge(duplicateReceipt);
  assert.equal((await cli.send('!care 3')).json.status,0);
  assert.equal((await cli.send('!gift '+('c'.repeat(32))+' 1')).json.status,0);
  assert.equal((await cli.send('!care 7')).json.status,0);
  for(const [counter,kind,action] of [[4,'care','feed'],[5,'gift',null],[6,'care','sleep']]){
   e=await ports.events.readNext();
   check('mixed FIFO event '+counter+' '+kind,()=>{assert.equal(e.counter,counter);assert.equal(e.kind,kind);if(action)assert.equal(e.action,action);});
   await ports.events.acknowledge(receipt(e));
  }
  check('mixed FIFO drains only after each Host durable receipt',()=>{assert.equal(JSON.parse(fs.readFileSync(path.join(workspace,'host-receipts.json'),'utf8'))['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:6'].kind,'care');});
  assert.equal(await ports.events.readNext(),null);
  // IR-03: committed old bytes must recover durability, never count as this boot's fresh clock.
  const historic={...base,requestId:'ir03-historic',scene:'home',epochMs:1800000000000};
  fixture.dropOp='snapshot';await assert.rejects(ports.scenes.pushScene(historic),err=>err.outcome==='unknown');
  const historicRaw=fixture.requests.at(-1).line,historicCommand=JSON.parse(historicRaw);
  after=await inspect();assert.equal(after.epoch,historic.epochMs);
  await ports.control.dispose();await cli.close();cli=new CLI();makePorts();await connect();after=await inspect();
  check('IR-03 real C process restart clears runtime clock while preserving lost-ACK pending',()=>{assert.equal(after.epoch,0);assert.equal(after.commitsThisProcess,0);assert.deepEqual(ports.scenes.getPending().data,historicCommand.data);});
  const recovered=await ports.scenes.retryPending({origin:'explicit_user_action'});after=await inspect();
  check('IR-03 explicit historical retry is exact bytes and durable duplicate, clock remains zero',()=>{assert.equal(fixture.requests.at(-1).line,historicRaw);assert.equal(recovered.data.duplicate,true);assert.equal(after.epoch,0);assert.equal(after.commitsThisProcess,0);assert.equal(ports.scenes.getPending(),null);});
  const current={...historic,requestId:'ir03-current',epochMs:1800000060000};
  const freshResult=await ports.scenes.pushScene(current);const freshCommand=fixture.requests.at(-1).cmd;after=await inspect();
  check('IR-03 same semantics current snapshot gets next seq/revision and restores runtime clock',()=>{assert.equal(freshResult.duplicate,false);assert.equal(freshCommand.seq,historicCommand.seq+1);assert.equal(freshCommand.data.revision,historicCommand.data.revision+1);assert.equal(freshCommand.data.epochMs,current.epochMs);assert.equal(after.epoch,current.epochMs);assert.equal(after.utcOffsetMinutes,480);assert.equal(after.commitsThisProcess,1);});
  before=after;const requestCount=fixture.requests.length;
  for(let i=1;i<=100;i++){const sampled=await ports.scenes.pushScene({...current,requestId:'ir03-sample-'+i,epochMs:current.epochMs+i*1000});assert.equal(sampled.duplicate,true);}
  after=await inspect();
  check('IR-03 100 same-semantic time samples emit no heartbeat or extra write',()=>{assert.equal(fixture.requests.length,requestCount);assert.equal(after.commitsThisProcess,before.commitsThisProcess);assert.equal(after.seq,before.seq);assert.equal(after.revision,before.revision);assert.equal(after.epoch,current.epochMs);});
  await ports.control.dispose();await cli.close();cli=new CLI();makePorts();await connect();
  const noEpoch={...base,requestId:'ir03-no-epoch',epochMs:undefined};
  await ports.scenes.pushScene(noEpoch);const noEpochCommand=fixture.requests.at(-1).cmd;after=await inspect();
  check('IR-03 first fresh no-epoch snapshot persists without claiming a clock',()=>{assert.equal(Object.hasOwn(noEpochCommand.data,'epochMs'),false);assert.equal(after.epoch,0);});
  await ports.scenes.pushScene({...noEpoch,requestId:'ir03-add-epoch',epochMs:1800000120000});const withEpochCommand=fixture.requests.at(-1).cmd;after=await inspect();
  check('IR-03 no-epoch confirmation cannot suppress same-semantic later clock calibration',()=>{assert.equal(withEpochCommand.seq,noEpochCommand.seq+1);assert.equal(withEpochCommand.data.revision,noEpochCommand.data.revision+1);assert.equal(after.epoch,1800000120000);assert.equal(after.commitsThisProcess,2);});
  check('actual transport writes and notification reassembly use <=20-byte chunks',()=>{assert(fixture.writes.length>100);assert(fixture.frames.length>100);assert.equal(Math.max(...fixture.writes),20);assert.equal(Math.max(...fixture.frames),20);});
  await ports.control.dispose();ports=null;await cli.close();cli=null;
  const evidenceDir=path.join(__dirname,'virtual-evidence');fs.mkdirSync(evidenceDir,{recursive:true});const persistedEvidence={};
  for(const name of ['state.blob','phone-journal.json','host-receipts.json']){const bytes=fs.readFileSync(path.join(workspace,name));fs.writeFileSync(path.join(evidenceDir,name),bytes);persistedEvidence[name]={source:'virtual_fixture_synthetic_data_only',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}
  fs.writeFileSync(out,JSON.stringify({evidence:'virtual_fixture',passed:steps.length,failed:0,steps,trace,persistedEvidence,limits:['Native result/subscription are fixture assertions, not Java/GATT evidence','Host receipt is synthetic disk consumer, not original game save writer/reward integration','File fsync/rename is host storage, not SDK NVS/real power cut','Gift input calls actual l2_receive_gift with synthetic peer source; real bilateral machine is separate peer suite']},null,2)+'\n');
  console.log('virtual_fixture '+steps.length+' scenarios passed');
 }catch(error){fs.writeFileSync(out,JSON.stringify({evidence:'virtual_fixture',passed:steps.length,failed:1,steps,error:error.stack,trace},null,2)+'\n');console.error(error);if(ports)await ports.control.dispose().catch(()=>{});if(cli)await cli.close().catch(()=>{});process.exitCode=1;}
 finally{fs.rmSync(workspace,{recursive:true,force:true});}
})();
