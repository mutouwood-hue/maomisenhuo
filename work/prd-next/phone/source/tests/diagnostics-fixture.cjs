/* Production coordinator + frozen adapter + production transport; memory Native/GATT only. */
const crypto=require('node:crypto'),{createPorts}=require('../web/cflocal2-adapter.js'),{createCoordinator}=require('../web/offline-scene-sync.js');
const ID='0123456789abcdef0123456789abcdef',USER={origin:'explicit_user_action'},scene=()=>({petId:'cat-1',revision:0,scene:'home',action:'idle',weather:'clear',pet:{name:'小橘',breed:'orange',food:65,mood:72,clean:68,energy:75,health:100,coins:24}});
async function fixture(){
 let ports,generation=0,mode='off',uid=0,seq=0,snapshot=null,bytes=[],foreground=true,stateHold=false,snapshotHold=false,stateError=null,consumes=0,consumeImpl=null;
 const calls=[],commands=[],held=[],queue=[],changes=[],values=new Map(),checkpoints=[];
 const send=e=>ports.control.receive(e),result=(r,data)=>send({type:'result',requestId:r.requestId,ok:true,result:data});
 const native={postMessage(raw){const r=JSON.parse(raw);calls.push(r);switch(r.method){
 case'initialize':case'requestPermissions':result(r,{available:true,granted:true,bluetoothEnabled:true,mode,activityForeground:true,foreground:mode==='cflocal2'});return;
 case'selectTransport':mode=r.args.mode;result(r,{mode,foreground:mode==='cflocal2'});return;
 case'scan':{const device={address:'AA:BB:CC:DD:EE:01',name:'Fixture only',rssi:-40,source:'native_scan',generation:++generation};send({type:'device',...device});result(r,{generation,devices:[device]});return;}
 case'connect':{const evidence={generation:++generation,address:r.args.address,serviceVerified:true,rxVerified:true,txVerified:true,subscribed:true};send({type:'connection',...evidence,state:'subscribed',reason:''});result(r,evidence);return;}
 case'write':{const part=Buffer.from(r.args.base64,'base64');bytes.push(...part);if(part.at(-1)===10){const cmd=JSON.parse(Buffer.from(bytes).toString('utf8'));bytes=[];commands.push(cmd);const reply=()=>{let data;if(cmd.op==='hello')data={protocol:'CFLOCAL2',deviceId:ID,maxLine:2048,capabilities:['scene','snapshot','events'],lastSeq:seq,clientId:null};else if(cmd.op==='state')data={deviceId:ID,clientId:null,pending:0,lastAck:0,lastSeq:seq,storageError:false,hasSnapshot:!!snapshot,snapshot};else if(cmd.op==='snapshot'){seq=cmd.seq;snapshot=cmd.data;data={persisted:true,seq,revision:snapshot.revision};}else if(cmd.op==='events')data={event:null};else throw Error('unexpected mutation '+cmd.op);
 const response=cmd.op==='state'&&stateError?{v:2,id:cmd.id,op:cmd.op,ok:false,error:{code:stateError,message:stateError,outcome:'no_change'}}:{v:2,id:cmd.id,op:cmd.op,ok:true,data};const frame=Buffer.from(JSON.stringify(response)+'\n');for(let i=0;i<frame.length;i+=20)send({type:'frame',generation,value:frame.subarray(i,i+20).toString('base64')});};if(cmd.op==='state'&&stateHold||cmd.op==='snapshot'&&snapshotHold)held.push(reply);else reply();}result(r,{generation});return;}
 case'disconnect':case'dispose':case'stopScan':result(r,{generation});return;
 default:throw Error('unexpected native '+r.method);
 }}};
 ports=createPorts({bridge:native,storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},uuid:()=>`00000000-0000-4000-8000-${String(++uid).padStart(12,'0')}`,durableCheckpoint:async raw=>{checkpoints.push(raw);return{persisted:true,journalSha256:crypto.createHash('sha256').update(raw).digest('hex')};},commandTimeoutMs:1000,nativeTimeoutMs:1000});
 await ports.control.initialize();await ports.control.selectTransport('cflocal2',USER);const devices=await ports.control.scan({...USER,durationMs:1000});await ports.control.connect(devices[0],USER);
 const coordinator=createCoordinator({ports,read:scene,consumeEvent:async()=>{consumes++;return consumeImpl?consumeImpl():{processed:false};},uuid:()=>`scene-${++uid}`,now:()=>1792113600000,onChange:s=>changes.push(s),schedule:fn=>{queue.push(fn);return fn;},cancel:fn=>{let i=queue.indexOf(fn);if(i>=0)queue.splice(i,1);}});
 coordinator.setEnabled(true);coordinator.authorize();
 return{ports,coordinator,calls,commands,held,queue,changes,values,checkpoints,get consumes(){return consumes;},context:()=>({mode:'cflocal2',foreground,state:ports.control.getState(),verified:require('../web/offline-scene-sync.js').verifiedLink(ports.control.getState())}),setConsume:fn=>consumeImpl=fn,holdState:v=>stateHold=v,holdSnapshot:v=>snapshotHold=v,stateError:v=>stateError=v,background(){foreground=false;coordinator.setForeground(false);},async disconnect(){await ports.control.disconnect();},async flush(){for(let i=0;queue.length&&i<10;i++){queue.shift()();await new Promise(r=>setImmediate(r));}},async close(){coordinator.dispose();await ports.control.dispose();}};
}
module.exports={fixture,ID,scene};
