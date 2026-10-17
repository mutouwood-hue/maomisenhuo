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
  ['uppercase device identity',{hello:{deviceId:DEVICE.toUpperCase()},state:{deviceId:DEVICE.toUpperCase()}}]
 ]){
  const f=new Fixture(options);let result;
  try{const r=await f.ready();result={stage:r.stage,helloClient:r.hello.clientId,stateClient:r.device.clientId,deviceId:r.hello.deviceId,commands:f.commands.map(c=>c.op)};}
  catch(e){result={rejected:e.code,commands:f.commands.map(c=>c.op)};}
  rows.push({case:name,result});await f.close();
 }
 const f=new Fixture();await f.ready();const mode=await f.control.selectTransport('legacy',USER);rows.push({case:'explicit legacy route result',result:{nativeMode:mode.mode,requestedApplicationMode:mode.requestedApplicationMode,wireFamily:mode.wireFamily,stage:f.control.getState().stage}});await f.close();
 console.log(JSON.stringify({virtual_fixture:true,reusesOwnerNativeFixture:true,independentBoundaryCases:rows},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});`;
new Function('require',prefix+test)(createRequire(fixtureFile));
