'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..');const fixtureFile=path.join(root,'artifacts/local-ble-adapter/versions/encounter-v1/test-encounter-transport.cjs');
const source=fs.readFileSync(fixtureFile,'utf8');const prefix=source.slice(0,source.indexOf("test('initialize"));
const test=`
(async()=>{
 const rows=[];
 for(const [name,options] of [
  ['nonuuid hello owner',{hello:{clientId:'owner-not-a-uuid'}}],
  ['nonuuid state owner',{state:{clientId:'owner-not-a-uuid'}}],
  ['uppercase device identity',{hello:{deviceId:DEVICE.toUpperCase()},state:{deviceId:DEVICE.toUpperCase()}}],
 ['zero hello device',{hello:{deviceId:'0'.repeat(32)}}],
 ['zero state device',{state:{deviceId:'0'.repeat(32)}}]
 ]){
  const f=new Fixture(options);let result;
  try{const r=await f.ready();result={stage:r.stage,helloClient:r.hello.clientId,stateClient:r.device.clientId,deviceId:r.hello.deviceId,commands:f.commands.map(c=>c.op)};}
  catch(e){result={rejected:e.code,commands:f.commands.map(c=>c.op)};}
  rows.push({case:name,result});await f.close();
 }
 const f=new Fixture();await f.ready();const before=f.calls.length;try{await f.control.selectTransport('legacy',USER);throw new Error('legacy unexpectedly accepted');}catch(e){assert.equal(e.code,'BAD_REQUEST');assert.equal(f.calls.length,before);rows.push({case:'explicit legacy route result',result:{rejected:e.code,additionalNativeRPC:f.calls.length-before}});}await f.close();
 for(const r of rows.slice(0,5)){assert.equal(r.result.rejected,'UNSUPPORTED_PROTOCOL');assert.deepEqual(r.result.commands,['nonuuid state owner','zero state device'].includes(r.case)?['hello','state']:['hello']);} console.log(JSON.stringify({virtual_fixture:true,reusesOwnerNativeFixture:true,independentBoundaryCases:rows},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});`;
new Function('require',prefix+test)(createRequire(fixtureFile));
