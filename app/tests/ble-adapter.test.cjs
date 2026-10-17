'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = require('../web/legacy-bj20-adapter.js');
const {codec} = api;
const actualDevice = {address:'7C:0C:5F:42:36:86',name:'OFFLINE TEST FIXTURE',rssi:-50,source:'native_scan'};
class FixtureBridge {
  constructor(options={}) { this.options=options;this.calls=[];this.frames=[];this.generation=1;this.face=0;this.revision=1;this.local=false;this.held=[]; }
  emit(event){this.receive(event);}
  result(request, result={}){this.emit({type:'result',requestId:request.requestId,ok:true,result});}
  postMessage(raw){const request=JSON.parse(raw);this.calls.push(request);queueMicrotask(()=>this.dispatch(request));}
  dispatch(r){
    if(r.method==='initialize'||r.method==='requestPermissions')return this.result(r,{available:true,bluetoothEnabled:true,granted:this.options.granted!==false});
    if(r.method==='scan'){this.emit({type:'device',generation:this.generation,...actualDevice});return this.result(r,{devices:[actualDevice],generation:this.generation});}
    if(r.method==='connect'){
      for(const state of ['connecting','discovering','subscribing'])this.emit({type:'connection',generation:this.generation,address:actualDevice.address,state});
      if(!this.options.noReady)this.emit({type:'connection',generation:this.generation,address:actualDevice.address,state:'ready',serviceVerified:this.options.missingEvidence!==true,rxVerified:true,txVerified:true,subscribed:true});
      return this.result(r,{generation:this.generation});
    }
    if(r.method==='write'){
      const frame=codec.decodeBase64(r.args.base64),op=frame[3],seq=frame[4]|frame[5]<<8;
      this.frames.push({op,seq,bytes:[...frame],generation:r.args.generation});
      let data=op===1?[1,this.options.badCaps?14:15,0x7c,0x0c,0x5f,0x42,0x36,0x84]:op===2?[this.local?2:1,0,0,this.local?5:0,this.face,255,0,255,this.revision&255,this.revision>>8]:[];
      if(op===3){this.local=true;this.revision++;}if(op===5){this.face=frame[8];this.revision++;}
      let ack=new Uint8Array(20);ack.set([66,74,1,128,seq&255,seq>>8,data.length+2,0,op,this.options.rejectMutation&&op>2?2:0,...data]);
      if(this.options.classic)ack=new Uint8Array([66,1,0]);
      const ackEvent={type:'frame',generation:r.args.generation,value:codec.encodeBase64(ack)};
      const write=()=>this.result(r,{generation:r.args.generation});
      const notify=()=>this.emit(ackEvent);
      if(this.options.dropMutation&&op>2){write();return;}
      if(this.options.wrongCorrelation&&op===1){ack[4]++;ackEvent.value=codec.encodeBase64(ack);}
      if(this.options.holdWrite&&op===1){notify();this.held.push(write);return;}
      if(this.options.ackBeforeWrite){notify();write();}else{write();notify();}
      return;
    }
    if(r.method==='disconnect'){this.emit({type:'connection',generation:this.generation,address:actualDevice.address,state:'disconnected',reason:'fixture disconnect'});return this.result(r);}
    this.result(r);
  }
}
async function setup(t, options={}){
 const bridge=new FixtureBridge(options);const control=api.createControl({bridge,commandTimeoutMs:40,nativeTimeoutMs:100,connectTimeoutMs:200});bridge.receive=e=>control.receive(e);
 t.after(async()=>{await control.dispose();});await control.initialize();return{bridge,control};
}
async function scanConnect(control){await control.scan({origin:'explicit_user_action',durationMs:1000});return control.connect(actualDevice,{origin:'explicit_user_action'});}
test('initialization registers only; no permissions, scan, connect or writes',async t=>{const{bridge,control}=await setup(t);assert.deepEqual(bridge.calls.map(x=>x.method),['initialize']);assert.equal(control.getState().stage,'disconnected');assert.equal(bridge.frames.length,0);});
test('codec rejects classic, corrupt padding, invalid hello/state, and outbound oversized payload',()=>{assert.throws(()=>codec.decodeFrame(new Uint8Array([66,1,0])));const f=new Uint8Array(20);f.set([66,74,1,128,1,0,2,0,1,0]);f[19]=1;assert.throws(()=>codec.decodeFrame(f));assert.throws(()=>codec.decodeHello([1,14,1,2,3,4,5,6]));assert.throws(()=>codec.decodeState([0,0,0,0,3,255,0,255,0,0]));assert.throws(()=>codec.encodeRequest(5,1,[3]));assert.throws(()=>codec.encodeRequest(4,1,new Array(11).fill(0)));});
test('scan/connect require explicit origin and selected real scan entry',async t=>{const{bridge,control}=await setup(t);await assert.rejects(control.scan({durationMs:1000}),/明确/);await assert.rejects(control.connect(actualDevice,{origin:'explicit_user_action'}),/实际扫描/);assert.equal(bridge.frames.length,0);});
test('strict handshake becomes local ready, without mutation or data/peer capability',async t=>{const{bridge,control}=await setup(t);const states=[];control.subscribe(s=>states.push(s.stage));const state=await scanConnect(control);assert.equal(state.stage,'ready_local');assert(states.includes('handshaking'));assert.deepEqual(bridge.frames.map(x=>x.op),[1,2]);assert.deepEqual(state.capabilities,{legacyControl:'verified',snapshotSync:'unavailable',durableEvents:'unavailable',peerEncounter:'unavailable'});assert.equal(state.device.battery,null);assert.equal(state.device.usb,null);});
test('ACK arriving before GATT write is handled only after both complete',async t=>{const{bridge,control}=await setup(t,{ackBeforeWrite:true,holdWrite:true});await control.scan({origin:'explicit_user_action',durationMs:1000});const promise=control.connect(actualDevice,{origin:'explicit_user_action'});await new Promise(r=>setTimeout(r,5));assert.equal(control.getState().stage,'handshaking');assert.equal(bridge.frames.length,1);bridge.held.shift()();await promise;assert.equal(control.getState().stage,'ready_local');});
test('classic same UUID variant rejects without START_LOCAL and cannot make ready',async t=>{const{bridge,control}=await setup(t,{classic:true});await assert.rejects(scanConnect(control));assert.equal(control.getState().stage,'error');assert.equal(control.getState().error.code,'UNSUPPORTED_PROTOCOL');assert(!bridge.frames.some(x=>x.op>2));});
test('wrong HELLO caps rejects and does not send GET_STATE or mutation',async t=>{const{bridge,control}=await setup(t,{badCaps:true});await assert.rejects(scanConnect(control));assert.equal(control.getState().stage,'error');assert.deepEqual(bridge.frames.map(x=>x.op),[1]);});
test('subscription callback with incomplete native evidence never makes ready',async t=>{const{control}=await setup(t,{missingEvidence:true});await assert.rejects(scanConnect(control));assert.equal(control.getState().stage,'error');});
test('wrong correlated ACK times out without mutation',async t=>{const{bridge,control}=await setup(t,{wrongCorrelation:true});await assert.rejects(scanConnect(control));assert.equal(control.getState().stage,'error');assert(!bridge.frames.some(x=>x.op>2));});
test('actual permission refusal is not fake granted',async t=>{const{bridge,control}=await setup(t,{granted:false});assert.equal(control.getState().stage,'permission_required');assert.deepEqual(await control.requestPermissions({origin:'explicit_user_action'}),{granted:false});assert(!bridge.calls.some(x=>x.method==='scan'));});
test('START_LOCAL requires valid explicit command and reads actual UI state afterward',async t=>{const{bridge,control}=await setup(t);await scanConnect(control);await assert.rejects(control.startLocal({origin:'explicit_user_action',generation:99,requestId:'x'}),/变化/);const result=await control.startLocal({origin:'explicit_user_action',generation:1,requestId:'user-start-1'});assert.equal(result.originalOpcode,3);assert.equal(result.gattWriteCompleted,true);assert.equal(control.getState().device.flags.local,true);assert.deepEqual(bridge.frames.map(x=>x.op),[1,2,3,2]);assert.equal(control.getState().capabilities.snapshotSync,'unavailable');});
test('set face validates and checks generation; readback is not pet sync',async t=>{const{bridge,control}=await setup(t);await scanConnect(control);await assert.rejects(control.setFace(3,{origin:'explicit_user_action',generation:1,requestId:'a'}));await control.setFace(2,{origin:'explicit_user_action',generation:1,requestId:'b'});assert.equal(control.getState().device.face,2);assert.deepEqual(bridge.frames.map(x=>x.op),[1,2,5,2]);});
test('mutation timeout remains unknown and is never replayed',async t=>{const{bridge,control}=await setup(t,{dropMutation:true});await scanConnect(control);await assert.rejects(control.startLocal({origin:'explicit_user_action',generation:1,requestId:'x'}));await new Promise(r=>setTimeout(r,5));assert.equal(control.getState().stage,'error');assert.equal(control.getState().error.code,'ACK_TIMEOUT_OUTCOME_UNKNOWN');assert.equal(bridge.frames.filter(x=>x.op===3).length,1);});
test('device semantic rejection stays distinct from persistence or timeout',async t=>{const{control}=await setup(t,{rejectMutation:true});await scanConnect(control);await assert.rejects(control.startLocal({origin:'explicit_user_action',generation:1,requestId:'x'}));assert.equal(control.getState().error.code,'DEVICE_REJECTED');});
test('disconnect prevents stale notification and does not replay control',async t=>{const{bridge,control}=await setup(t);await scanConnect(control);await control.disconnect();const raw=new Uint8Array(20);raw.set([66,74,1,129,0,0,10,0,2,0,0,1,1,100,1,1,5,0]);bridge.emit({type:'frame',generation:1,value:codec.encodeBase64(raw)});assert.equal(control.getState().stage,'disconnected');assert.deepEqual(bridge.frames.map(x=>x.op),[1,2]);});
