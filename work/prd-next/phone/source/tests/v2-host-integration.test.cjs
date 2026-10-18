const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),ID='0123456789abcdef0123456789abcdef';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(predicate){for(let n=0;n<200;n++){if(predicate())return;await wait(10);}assert.ok(predicate(),'bounded async fixture deadline');}
function harness({events=false,scanFailure=false,loseAckOnce=false}={}){
 const dom=new JSDOM(fs.readFileSync(root+'/android/app/src/main/assets/index.html','utf8'),{url:'https://appassets.androidplatform.net/offline/index.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,calls=[],commands=[],held=[],bytes=[];let generation=0,seq=0,snapshot=null,mode='off';
 w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
 Object.defineProperty(w.crypto,'subtle',{value:require('node:crypto').webcrypto.subtle});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){}});
 const raw={ready:true,pet:{id:'cat-1',createdAt:1792080000000,joinedAt:1792080000000,name:'小橘',breed:'orange',health:100,coins:30,stats:{food:65.4,mood:72,clean:68,energy:75}},room:{currentAction:null},mini:{running:false},life:{view:'home'}};
 w.__petGame={state:()=>raw,setRoomActive(){},hostSuspend(){},hostResume(){}};w.__pgLife={toast(){},cfg:{geo:false},hostCompanionState:()=>({schema:1,source:'life-v5-applied',out:false,mode:'demo'})};w.__pgSocial={drawPet(){},closeMeet(){}};
 if(events){
  const rules=require('./event-fixture.cjs');
  w.eval(fs.readFileSync(root+'/web/offline-event-store.js','utf8'));
  const store=rules.createStore({storage:w.localStorage,now:()=>Date.now()});store.flush();
  w.__petGame.store=store;w.__petGame.hostCreateStore=rules.createStore;w.__petGame.state=()=>({...raw,pet:store.getState()});
  w.__pgSocial.D=structuredClone(rules.socialDefault);w.__pgSocial.hostRefresh=()=>{};
  w.__pgSocial.saveD=()=>w.localStorage.setItem('pg-social-v1',JSON.stringify(w.__pgSocial.D));w.__pgSocial.saveD();
 }
 // Explicit Native RPC authority simulator, not Android durability evidence.
 const authority={schema:1,revision:0,entries:{},foreground:true};
 const durable=require('../web/offline-durable-store.js').createClient({storage:w.localStorage,rpc:async(op,args)=>{
   if(op==='read')return structuredClone(authority);
   const same=Object.entries(args.updates).every(([k,v])=>authority.entries[k]===v);
   if(!same){assert.equal(args.expectedRevision,authority.revision);Object.assign(authority.entries,args.updates);authority.revision++;}
   return {persisted:true,revision:authority.revision,foreground:true,hashes:Object.fromEntries(Object.entries(args.updates).map(([k,v])=>[k,require('node:crypto').createHash('sha256').update(v).digest('hex')]))};
 }});
 durable.required=true;w.CatOfflineDurable=durable;
 const nativeReady=durable.initialize();
 let eventSent=false,eventAcknowledged=false,ackWasLost=false;
 const send=event=>queueMicrotask(()=>w.CatLocalV2Adapter.receive(JSON.stringify(event)));
 const result=(r,data)=>send({type:'result',requestId:r.requestId,ok:true,result:data});
 w.CatLocalV2Native={postMessage(text){
  const r=JSON.parse(text);calls.push(r);
  const available={available:true,granted:true,bluetoothEnabled:true,mode,foreground:mode==='cflocal2',activityForeground:true,routingAvailable:true};
  if(r.method==='initialize'||r.method==='requestPermissions'){result(r,available);return;}
  if(r.method==='selectTransport'){mode=r.args.mode;result(r,{mode,foreground:mode==='cflocal2'});return;}
  if(r.method==='scan'){
   if(scanFailure){send({type:'result',requestId:r.requestId,ok:false,error:{code:'NOT_FOREGROUND',message:'App left foreground',outcome:'no_change'}});return;}
   const device={address:'AA:BB:CC:DD:EE:01',name:'Node fixture · 非真实设备',rssi:-40,source:'native_scan',generation:++generation};send({type:'device',...device});result(r,{generation,devices:[device]});return;}
  if(r.method==='connect'){
   generation++;const evidence={generation,address:r.args.address,serviceVerified:true,rxVerified:true,txVerified:true,subscribed:true};
   send({type:'connection',...evidence,state:'subscribed',reason:''});result(r,evidence);return;
  }
  if(r.method==='write'){
   const part=Buffer.from(r.args.base64,'base64');assert.ok(part.length<=20);bytes.push(...part);
   if(part.at(-1)!==10){result(r,{generation});return;}
   const command=JSON.parse(Buffer.from(bytes).toString('utf8'));bytes.length=0;commands.push(command);
   let data;
   if(command.op==='hello')data={protocol:'CFLOCAL2',deviceId:ID,capabilities:['scene','snapshot','events'],maxLine:2048,clientId:null,lastSeq:seq};
   else if(command.op==='state')data={deviceId:ID,hasSnapshot:Boolean(snapshot),storageError:false,pending:0,lastAck:0,lastSeq:seq,clientId:null,snapshot};
   else if(command.op==='snapshot'){
    const journal=JSON.parse(w.localStorage.getItem('cat-cflocal2-journal-v1'));
    assert.equal(journal.devices[ID].pending.id,command.id,'journal must precede actual Native write');
    assert.equal(journal.devices[ID].pending.seq,command.seq);seq=command.seq;snapshot=command.data;data={persisted:true,seq,revision:snapshot.revision};
   }else if(events&&command.op==='events'){
    const wire=w.CatOfflineSceneMap.read({deviceId:ID,hasSnapshot:false});
    data={event:eventAcknowledged?null:{source:'native_device',protocol:'CFLOCAL2',deviceId:ID,eventId:ID+':1',counter:1,petId:wire.petId,occurredAtMs:null,kind:'care',action:'pet'}};eventSent=true;
   }else if(events&&command.op==='ack'){
    assert.ok(eventSent);const ledger=w.CatOfflineEventLedger.snapshot();assert.equal(ledger.pending,null);assert.equal(ledger.records[ID+':1'].status,'applied');
    assert.equal(JSON.parse(w.localStorage.getItem('pixel-cat-pet-v1')).cats[0].counts.pet,1);
    assert.equal(JSON.parse(w.localStorage.getItem('pg-social-v1')).dex.deviceReceipts.length,1);
    assert.equal(command.data.receipt.saveDigest,ledger.records[ID+':1'].saveDigest);
    eventAcknowledged=true;seq=command.seq;data={persisted:true,seq};
   }else throw Error('Unexpected Host event command in scene-only fixture');
   const frame=Buffer.from(JSON.stringify({v:2,id:command.id,op:command.op,ok:true,data})+'\n');
   for(let i=0;i<frame.length;i+=20)send({type:'frame',generation,value:frame.subarray(i,i+20).toString('base64')});
   if(command.op==='ack'&&loseAckOnce&&!ackWasLost){ackWasLost=true;send({type:'result',requestId:r.requestId,ok:false,error:{code:'GATT_WRITE_FAILED',message:'Fixture final ACK write result lost',outcome:'unknown'}});return;}
   if(command.op==='snapshot'||command.op==='ack')held.push(()=>result(r,{generation}));else result(r,{generation});return;
  }
  if(['disconnect','dispose','stopScan'].includes(r.method)){result(r,{generation});return;}
  throw Error('Unexpected method '+r.method);
 }};
 nativeReady.then(()=>{for(const file of ['offline-host.js','offline-scene-map.js',...(events?['offline-device-events.js','offline-device-backup.js']:[]),'offline-device-diagnostics.js','offline-scene-sync.js','local-v2-transport.js','cflocal2-adapter.js'])w.eval(fs.readFileSync(root+'/web/'+file,'utf8'));});
 return {w,d,raw,calls,commands,held,authority,nativeReady,async close(){w.dispatchEvent(new w.Event('pagehide'));await wait(10);dom.window.close();}};
}
test('production Host + adapter + transport require explicit connect and both durable ACK and final GATT completion',async()=>{
 const h=harness();try{
  await wait(10);assert.deepEqual(h.calls.map(r=>r.method),['initialize']);assert.equal(h.commands.length,0);
  const mode=h.d.getElementById('offline-device-mode');mode.value='cflocal2';mode.dispatchEvent(new h.w.Event('change'));await wait(10);
  assert.equal(h.calls.filter(r=>r.method==='scan').length,0);assert.equal(h.d.getElementById('offline-v2-panel').hidden,false,h.d.getElementById('offline-route-status').textContent+' '+JSON.stringify(h.calls));
  h.d.getElementById('offline-v2-scan').click();await wait(10);
  h.d.querySelector('#offline-v2-list button').click();await wait(90);
  assert.deepEqual(h.commands.map(r=>r.op),['hello','state','snapshot']);assert.equal(h.commands[2].data.pet.food,65);
  assert.equal(h.w.CatOfflineSceneSync.status.stage,'sending');assert.doesNotMatch(h.d.getElementById('offline-v2-status').textContent,/已由吧唧持久保存/);
  h.held.shift()();await wait(20);assert.equal(h.w.CatOfflineSceneSync.status.stage,'synced');
  h.raw.life={view:'world',entering:false,world:{phase:'walking'}};await wait(600);
  assert.equal(h.commands.at(-1).data.scene,'away');assert.equal(h.commands.at(-1).data.action,'walk');h.held.shift()();await wait(20);
  const before=h.commands.length;h.w.CatOfflineHost.suspend();h.raw.life={view:'home'};h.w.CatOfflineHost.resume();await wait(600);assert.equal(h.commands.length,before,'resume must not send under stale ready or reconnect');
  assert.equal(h.commands.some(r=>r.op==='ack'||r.op==='events'),false);
 }finally{await h.close();}
});
test('native owner wiring keeps V2 off JavascriptInterface, denies frames, and stops transports before WebView pause',()=>{
 const java=fs.readFileSync(root+'/android/app/src/main/java/com/catforest/htmlcandidate/MainActivity.java','utf8');
 assert.doesNotMatch(java,/addJavascriptInterface\(localV2Ble/);assert.match(java,/frame-src 'none'; object-src 'none'; base-uri 'none'/);
 const pause=java.slice(java.indexOf('@Override protected void onPause()'),java.indexOf('@Override protected void onDestroy()'));
 assert.ok(pause.indexOf('localV2Ble.setForeground(false)')<pause.indexOf('web.onPause()'));
 const route=java.slice(java.indexOf('new LocalV2BleBridge'),java.indexOf('WebView.setWebContentsDebuggingEnabled'));
 assert.ok(route.indexOf('localBle.setForeground(false)')<route.indexOf('localBle.setForeground(active)'));
});
test('production event Host + original rules + durable ledger + real adapter/transport commits both stores before Native ACK',async()=>{
 const h=harness({events:true});try{
  await wait(10);assert.equal(h.commands.length,0);
  const mode=h.d.getElementById('offline-device-mode');mode.value='cflocal2';mode.dispatchEvent(new h.w.Event('change'));await wait(10);
  h.d.getElementById('offline-v2-scan').click();await wait(10);h.d.querySelector('#offline-v2-list button').click();await wait(120);
  assert.deepEqual(h.commands.map(r=>r.op),['hello','state','events','ack']);assert.equal(h.w.__petGame.store.getState().counts.pet,1);
  assert.equal(h.w.CatOfflineSceneSync.status.stage,'settling');assert.equal(JSON.parse(h.w.localStorage.getItem('cat-cflocal2-journal-v1')).devices[ID].pending.op,'ack');
  assert.equal(h.w.CatOfflineDeviceEvents.lastResult,null,'early device ACK alone must not finish the adapter command');
  for(let i=0;i<100;i++)h.d.body.dataset.fixtureMutation=String(i);await wait(650);assert.deepEqual(h.commands.map(r=>r.op),['hello','state','events','ack'],'poll and observer cannot sample during result/ACK flight');
  assert.ok(h.authority.entries['cat-cflocal2-event-ledger-v1']);assert.equal(JSON.parse(h.authority.entries['cat-cflocal2-journal-v1']).devices[ID].pending.op,'ack');
  h.held.shift()();await until(()=>h.commands.at(-1)?.op==='snapshot');assert.equal(h.commands.at(-1).op,'snapshot');assert.equal(h.commands.at(-1).data.pet.mood,81);assert.equal(h.w.CatOfflineDeviceEvents.lastResult.stage,'applied');
  h.held.shift()();await wait(20);assert.equal(h.w.CatOfflineSceneSync.status.stage,'synced');assert.equal(h.w.__petGame.store.getState().counts.pet,1);
  assert.match(h.d.getElementById('offline-v2-events').textContent,/已按原规则结算/);
 }finally{await h.close();}
});
test('foreground failure is localized once, and the route helper does not repeat stale operation text',async()=>{
 const h=harness({scanFailure:true});try{
  await wait(10);const mode=h.d.getElementById('offline-device-mode');mode.value='cflocal2';mode.dispatchEvent(new h.w.Event('change'));await wait(10);
  h.d.getElementById('offline-v2-scan').click();await wait(20);
  assert.doesNotMatch(h.d.getElementById('offline-v2-panel').textContent,/App left foreground/);
  assert.match(h.d.getElementById('offline-v2-status').textContent,/暂停连接/);
  assert.equal(h.d.getElementById('offline-route-status').textContent,'切换连接方式会断开当前设备。');
  h.w.CatOfflineHost.suspend();h.w.CatOfflineHost.resume();assert.doesNotMatch(h.d.getElementById('offline-route-status').textContent,/暂停|foreground/);
 }finally{await h.close();}
});
test('a blocked source export produces an explicitly labeled raw recovery backup including original social and dedup bytes',async()=>{
 const h=harness({events:true});try{
  await h.nativeReady;h.w.localStorage.setItem('pg-social-v1','{broken-social');h.w.CatOfflineEventStorageError=Error('source damaged');
  const backup=JSON.parse(h.w.__petGame.store.exportSave());assert.equal(backup.format,'catforest-recovery-v1');assert.equal(backup.raw['pg-social-v1'],'{broken-social');assert.ok(Object.hasOwn(backup.raw,'cat-cflocal2-event-ledger-v1'));
  assert.equal(h.commands.length,0);assert.equal(h.w.localStorage.getItem('pg-social-v1'),'{broken-social');
 }finally{await h.close();}
});
test('production adapter unknown ACK is journaled unchanged across reconnect and explicit recovery without a second game award',async()=>{
 const h=harness({events:true,loseAckOnce:true});try{
  await wait(10);const mode=h.d.getElementById('offline-device-mode');mode.value='cflocal2';mode.dispatchEvent(new h.w.Event('change'));await wait(10);
  const connect=async()=>{h.d.getElementById('offline-v2-scan').click();await wait(10);h.d.querySelector('#offline-v2-list button').click();await wait(100);};
  await connect();const first=h.commands.find(c=>c.op==='ack');assert.ok(first);assert.equal(h.w.__petGame.store.getState().counts.pet,1);
  const journal=()=>JSON.parse(h.w.localStorage.getItem('cat-cflocal2-journal-v1')).devices[ID];assert.equal(journal().pending.op,'ack');
  await connect();assert.equal(h.commands.filter(c=>c.op==='ack').length,1,'connect cannot auto-replay the unknown mutation');
  assert.equal(h.d.getElementById('offline-v2-retry').hidden,false);h.d.getElementById('offline-v2-retry').click();await wait(30);
  const retries=h.commands.filter(c=>c.op==='ack');assert.equal(retries.length,2);assert.deepEqual(retries[1],first,'exact id/seq/data bytes replay');
  h.held.shift()();await until(()=>h.commands.at(-1)?.op==='snapshot');assert.equal(h.commands.at(-1).op,'snapshot');assert.equal(h.commands.at(-1).seq,first.seq+1);h.held.shift()();await wait(20);
  assert.equal(h.w.__petGame.store.getState().counts.pet,1);assert.equal(h.w.CatOfflineEventLedger.snapshot().pending,null);assert.equal(journal().pending,null);
 }finally{await h.close();}
});
test('Native event fsync wait excludes original gameplay, observers, scene sampling and ACK until complete result projection',async()=>{
 const h=harness({events:true});try{
  await h.nativeReady;const durable=h.w.CatOfflineDurable,seal=durable.seal.bind(durable);let release,entered;
  const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});durable.seal=async value=>{await seal(value);entered();await gate;};
  const mode=h.d.getElementById('offline-device-mode');mode.value='cflocal2';mode.dispatchEvent(new h.w.Event('change'));await wait(10);
  h.d.getElementById('offline-v2-scan').click();await wait(10);h.d.querySelector('#offline-v2-list button').click();await started;
  assert.equal(durable.eventLocked,true);assert.equal(durable.transactionPaused,true);assert.equal(h.d.body.inert,true);assert.equal(h.w.__petGame.store.getState().counts.pet,0);
  assert.equal(JSON.parse(h.authority.entries['pixel-cat-pet-v1']).cats[0].counts.pet,1,'Native full redo precedes the original projection');
  assert.throws(()=>h.w.CatOfflineSceneMap.read({deviceId:ID,hasSnapshot:false}),/持久提交/);
  for(let i=0;i<100;i++)h.d.body.dataset.nativeWait=String(i);await wait(650);assert.deepEqual(h.commands.map(r=>r.op),['hello','state','events']);
  release();await until(()=>h.commands.at(-1)?.op==='ack');assert.equal(h.w.__petGame.store.getState().counts.pet,1);assert.equal(h.d.body.inert,undefined);assert.notEqual(durable.transactionPaused,true);
  h.held.shift()();await until(()=>h.commands.at(-1)?.op==='snapshot');h.held.shift()();
 }finally{await h.close();}
});
test('actual mounted diagnostics stays closed/listener-only, shares mutation lease, exports only real read and expires on Host pause',async()=>{
 const h=harness();try{
  await until(()=>h.w.CatOfflineSceneSync);const details=h.d.getElementById('offline-device-diagnostics');assert.ok(details);assert.equal(details.open,false);assert.equal(h.commands.length,0);
  const select=h.d.getElementById('offline-device-mode');select.value='cflocal2';select.dispatchEvent(new h.w.Event('change'));await wait(10);h.d.getElementById('offline-v2-scan').click();await until(()=>h.d.querySelector('#offline-v2-list button'));h.d.querySelector('#offline-v2-list button').click();await until(()=>h.held.length>0);
  const status=h.d.getElementById('offline-v2-status').textContent,before=h.commands.length;details.open=true;await wait(5);assert.equal(h.commands.length,before,'expanding details never reads');
  h.d.getElementById('offline-diag-refresh').click();await wait(10);assert.equal(h.commands.length,before,'in-flight mutation means zero diagnostic wire command');assert.match(details.textContent,/稍后手动刷新/);assert.equal(h.d.getElementById('offline-v2-status').textContent,status);
  h.held.shift()();await until(()=>h.w.CatOfflineSceneSync.status.stage==='synced');const journal=h.w.localStorage.getItem('cat-cflocal2-journal-v1'),authority=JSON.stringify(h.authority),coins=h.raw.pet.coins;
  h.d.getElementById('offline-diag-refresh').click();await until(()=>!h.d.getElementById('offline-diag-export').disabled);assert.equal(h.commands.at(-1).op,'state');assert.equal(h.commands.filter(c=>c.op==='state').length,2);assert.match(details.textContent,/真实新本地握手已核对/);assert.match(details.textContent,/clockValid \/ now/);assert.equal(h.w.localStorage.getItem('cat-cflocal2-journal-v1'),journal);assert.equal(JSON.stringify(h.authority),authority);assert.equal(h.raw.pet.coins,coins);assert.equal(h.d.getElementById('offline-v2-status').textContent,'当前场景已由吧唧持久保存。');
  const output=[];h.w.CatOfflineNative={exportSave:(filename,text)=>output.push({filename,report:JSON.parse(text)})};h.d.getElementById('offline-diag-export').click();assert.equal(output.length,1);const r=output[0].report;assert.equal(r.validity,'same_connection_observation');assert.equal(r.observation.device.pending,0);assert.equal(r.observation.device.snapshot.scene,'home');assert.equal(r.observation.device.snapshot.revision,1);assert.equal(r.observation.device.snapshot.pet,undefined);assert.doesNotMatch(JSON.stringify(r),/"journal"|"coins"|"name"|"localStorage"/);assert.match(details.textContent,/请求本机保存位置/);
  h.w.CatOfflineHost.suspend();assert.match(details.textContent,/后台.*过期/);h.d.getElementById('offline-diag-export').click();assert.equal(output[1].report.validity,'expired_connection_observation');assert.equal(output[1].report.currentConnection.verified,false);h.w.CatOfflineHost.resume();assert.match(details.textContent,/过期/);assert.match(details.textContent,/当前没有已核实/);assert.equal(h.d.getElementById('offline-diag-refresh').disabled,true);h.d.getElementById('offline-diag-export').click();assert.equal(output[2].report.currentConnection.verified,false,'stale ready_local after resume is not current authorization');
 }finally{await h.close();}
});
