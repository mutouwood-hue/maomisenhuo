const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCoordinator,verifiedLink}=require('../web/offline-scene-sync.js');
const ID='0123456789abcdef0123456789abcdef';
const scene=()=>({petId:'cat-1',scene:'home',action:'idle',weather:'clear',pet:{name:'小橘',breed:'orange',food:65,mood:72,clean:68,energy:75,health:100,coins:30}});
const link=()=>({stage:'ready_local',evidence:{source:'native',generation:2,serviceVerified:true,rxVerified:true,txVerified:true,subscribed:true},hello:{protocol:'CFLOCAL2',deviceId:ID,maxLine:2048,capabilities:['scene','snapshot','events']},capabilities:{scene:'declared',snapshot:'declared'},device:{deviceId:ID,storageError:false}});
function harness(){
 let current=scene(),state=link(),pending=null,handler=null,uid=0,sub,clock=1792080000000,readError=null;
 const queue=[],sent=[],statuses=[],retries=[];
 const ports={control:{getState:()=>state,subscribe(fn){sub=fn;fn(state);return()=>{};}},scenes:{
  getPending:()=>pending,
  async pushScene(input){sent.push(structuredClone(input));return handler?handler(input):{status:'device_persisted',revision:sent.length};},
  async retryPending(command){retries.push({command,pending:structuredClone(pending)});pending=null;}
 }};
 const c=createCoordinator({ports,read:()=>{if(readError)throw readError;return structuredClone(current);},onChange:s=>statuses.push(s),uuid:()=>`req-${++uid}`,now:()=>clock,offset:()=>480,schedule:fn=>{queue.push(fn);return fn;},cancel:fn=>{const i=queue.indexOf(fn);if(i>=0)queue.splice(i,1);}});
 return {c,ports,sent,statuses,retries,setScene:s=>{current=s;},setClock:t=>{clock=t;},setReadError:e=>{readError=e;},setPending:p=>{pending=p;},setHandler:h=>{handler=h;},state,emit:()=>sub(state),async flush(){for(let i=0;queue.length&&i<12;i++){queue.shift()();await new Promise(r=>setImmediate(r));}},arm(){c.setEnabled(true);c.authorize();}};
}
test('native evidence and CFLOCAL2 capability checks reject legacy or incomplete ready',()=>{
 assert.equal(verifiedLink(link()),true);for(const change of [s=>s.hello.protocol='BJ20',s=>s.evidence.subscribed=false,s=>s.capabilities.scene='unavailable',s=>s.device.deviceId='other']){const s=link();change(s);assert.equal(Boolean(verifiedLink(s)),false);}
});
test('no scene is sent on initialization or mode selection; explicit connection authorizes one semantic state',async()=>{
 const h=harness();h.c.setEnabled(true);h.c.signal();await h.flush();assert.equal(h.sent.length,0);
 h.c.authorize();await h.flush();assert.equal(h.sent.length,1);assert.equal(h.sent[0].revision,0);assert.equal(h.sent[0].utcOffsetMinutes,480);assert.equal(h.c.getStatus().stage,'synced');
 for(let i=0;i<100;i++)h.c.signal();await h.flush();assert.equal(h.sent.length,1);
 h.setScene({...scene(),scene:'away',action:'walk',weather:'rain'});h.c.signal();await h.flush();assert.equal(h.sent.length,2);assert.equal(h.sent[1].scene,'away');assert.notEqual(h.sent[0].requestId,h.sent[1].requestId);h.c.dispose();
});
test('unknown pending survives changing phone state and reconnect, and only explicit retry releases it',async()=>{
 const h=harness();h.setHandler(async input=>{h.setPending({id:input.requestId,scene:input.scene});throw Error('ACK timeout');});h.arm();await h.flush();
 assert.equal(h.c.getStatus().pending,true);h.setScene({...scene(),scene:'away'});h.c.signal();await h.flush();assert.equal(h.sent.length,1);
 h.state.evidence.generation++;h.emit();h.c.authorize();await h.flush();assert.equal(h.sent.length,1);assert.equal(h.retries.length,0);
 h.setHandler(null);await h.c.retry();await h.flush();assert.equal(h.retries[0].pending.id,'req-1');assert.equal(h.retries[0].command.origin,'explicit_user_action');assert.equal(h.sent[1].scene,'away');h.c.dispose();
});
test('pause invalidates connection authorization even if JS still holds a stale ready state',async()=>{
 const h=harness();h.arm();await h.flush();h.c.setForeground(false);h.setScene({...scene(),action:'feed'});h.c.setForeground(true);h.c.signal();await h.flush();assert.equal(h.sent.length,1);
 h.c.authorize();await h.flush();assert.equal(h.sent.length,2);h.c.dispose();
});
test('pending recovery always samples a fresh clock and sends the same semantic scene once before coalescing',async()=>{
 const h=harness();h.setHandler(async input=>{h.setPending({...input});throw Error('ACK timeout');});h.arm();await h.flush();const original=structuredClone(h.sent[0]);
 h.setClock(original.epochMs+60000);h.setHandler(null);await h.c.retry();assert.notEqual(h.c.getStatus().stage,'synced');await h.flush();
 assert.deepEqual(h.retries[0].pending,original);assert.equal(h.sent.length,2);assert.equal(h.sent[1].scene,original.scene);assert.equal(h.sent[1].epochMs,original.epochMs+60000);assert.notEqual(h.sent[1].requestId,original.requestId);
 for(let i=0;i<100;i++)h.c.signal();await h.flush();assert.equal(h.sent.length,2);assert.equal(h.c.getStatus().stage,'synced');h.c.dispose();
});
test('source identity or save errors also block explicit unknown retry without discarding its bytes',async()=>{
 const h=harness(),pending={requestId:'old',petId:'old-cat'};h.setPending(pending);h.arm();await h.flush();
 h.setReadError(Error('手机原存档未确认保存'));await assert.rejects(h.c.retry(),/原存档/);assert.equal(h.retries.length,0);assert.deepEqual(h.ports.scenes.getPending(),pending);assert.equal(h.c.getStatus().stage,'error');h.c.dispose();
});
test('old in-flight ACK cannot mark a newer scene synced; latest state is sent after completion',async()=>{
 const h=harness();let finish;h.setHandler(()=>new Promise(r=>finish=r));h.arm();await h.flush();assert.equal(h.c.getStatus().stage,'sending');
 h.setScene({...scene(),scene:'away'});h.c.signal();await h.flush();assert.equal(h.sent.length,1);
 h.setHandler(null);finish({status:'device_persisted',revision:1});await new Promise(r=>setImmediate(r));assert.notEqual(h.c.getStatus().stage,'synced');await h.flush();assert.equal(h.sent[1].scene,'away');assert.equal(h.c.getStatus().revision,2);h.c.dispose();
});
test('malformed persistence acknowledgement and device storage errors never become synced or repeat automatically',async()=>{
 const h=harness();h.setHandler(async()=>({status:'written',revision:1}));h.arm();await h.flush();assert.equal(h.c.getStatus().stage,'error');for(let i=0;i<5;i++)h.c.signal();await h.flush();assert.equal(h.sent.length,1);h.c.dispose();
 const j=harness();j.state.device.storageError=true;j.arm();await j.flush();assert.equal(j.sent.length,0);assert.equal(j.c.getStatus().stage,'error');j.c.dispose();
});
