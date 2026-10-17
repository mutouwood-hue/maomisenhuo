import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { harness } from './m2-helper.mjs';
async function seed(h){const [a]=h.users;const old=await h.ok(a,'/consents');const consent=await h.ok(a,'/consents','PUT',{baseRevision:old.revision,isLifeSyncEnabled:true,isLocationGranted:false,isMotionGranted:false,isMicrophoneGranted:false});const summary={baseRevision:0,consentRevision:consent.revision,timeZone:'Asia/Shanghai',source:'MANUAL',segments:[],places:[],motion:null,moments:[{id:'diary-http-moment',occurredAt:'2026-10-14 14:59:59',type:'CARE',heart:20}]};await h.ok(a,'/life-days/2026-10-14','PUT',summary);return {a,consent,summary};}
async function model(){const requests=[];let handler;const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;requests.push({url:req.url,authorization:req.headers.authorization,body:JSON.parse(body)});if(handler)await handler();res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({text:'今天记录了一次真实照料。'})}}]}));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {requests,setHandler:fn=>{handler=fn;},config:{aiKey:'TEST-ONLY-diary-key',aiChatModel:'step-3.5-flash',aiBaseUrl:`http://127.0.0.1:${server.address().port}`},close:()=>new Promise(resolve=>server.close(resolve))};}
const dto={catId:'cat-1',date:'2026-10-14',isTextCloudAllowed:true};
test('M2 diary uses real production ModelGateway over HTTP only for explicit text consent and minimizes payload',async()=>{
 const m=await model();let h;
 try{h=await harness(undefined,{config:m.config});const {a}=await seed(h);
  const offline=await h.ok(a,'/pet-diaries','POST',{...dto,isTextCloudAllowed:false});assert.equal(offline.source,'OFFLINE');assert.equal(m.requests.length,0);
  const generated=await h.ok(a,'/pet-diaries','POST',dto);assert.equal(generated.source,'MODEL');assert.equal(generated.text,'今天记录了一次真实照料。');assert.equal(m.requests.length,1);
  const sent=m.requests[0];assert.equal(sent.url,'/chat/completions');assert.equal(sent.authorization,'Bearer TEST-ONLY-diary-key');const input=JSON.parse(sent.body.messages[1].content);assert.deepEqual(Object.keys(input).sort(),['date','momentCount','momentTypes','personality']);assert.equal(input.momentCount,1);assert.deepEqual(input.momentTypes,['CARE']);assert.ok(!JSON.stringify(input).match(/latitude|longitude|audio|placeId|alias|userId|token/i));
 }finally{await h?.close();await m.close();}
});
for(const scenario of ['CONSENT_REVOKED','SUMMARY_CHANGED','TTL_EXPIRED'])test(`M2 diary awaits real gateway then rejects ${scenario} without persisting private text`,async()=>{
 const m=await model();let h,release;
 try{h=await harness(undefined,{config:m.config});const {a,consent,summary}=await seed(h);let entered;const started=new Promise(resolve=>{entered=resolve;});const held=new Promise(resolve=>{release=resolve;});m.setHandler(async()=>{entered();await held;});
  const pending=h.request(a,'/pet-diaries','POST',dto,{key:'diary-race-original-key'});await started;
  if(scenario==='CONSENT_REVOKED')await h.ok(a,'/consents','PUT',{baseRevision:consent.revision,isLifeSyncEnabled:false,isLocationGranted:false,isMotionGranted:false,isMicrophoneGranted:false});
  if(scenario==='SUMMARY_CHANGED')await h.ok(a,'/life-days/2026-10-14','PUT',{...summary,baseRevision:1,moments:[]});
  if(scenario==='TTL_EXPIRED')h.advance(8*86400000);
  release();const result=await pending;assert.equal(result.code,41001);
  if(scenario==='TTL_EXPIRED'){const login=await h.ok(null,'/sessions','POST',{username:'m2user_0',password:'TEST-ONLY-password-24'});a.token=login.accessToken;}
  assert.equal((await h.ok(a,'/pet-diaries')).total,0,'late gateway cannot write private diary after revoked/changed/expired source');
 }finally{release?.();await h?.close();await m.close();}
});
