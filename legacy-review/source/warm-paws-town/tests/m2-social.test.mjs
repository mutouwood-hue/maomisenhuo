import test from 'node:test';
import assert from 'node:assert/strict';
import { SocialClient, SocialDeviceBridge, decodeEnvironmentStatus } from '../src/social/client.js';
import { SocialController, localCollection } from '../src/social/controller.js';
import { QrScanner, parseDiscoveryQr, discoveryQr } from '../src/social/qr-scanner.js';
const storage = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map }; };
test('durable mutation keys are owner-isolated; lease rounds renew; corrupt record fails closed', async () => {
 const calls=[],store=storage();let owner='a',serial=0;
 const client=new SocialClient({api:{request:async(path,value)=>{calls.push({path,value});return{};}},storage:store,getOwner:()=>owner,createId:()=> 'test-idempotency-'+ ++serial});
 await client.gift({friendshipId:'f',assetId:'a'},{operationKey:'gift:a'});await client.gift({friendshipId:'f',assetId:'a'},{operationKey:'gift:a'});
 assert.equal(calls[0].value.idempotencyKey,calls[1].value.idempotencyKey);
 owner='b';await client.gift({friendshipId:'f',assetId:'a'},{operationKey:'gift:a'});assert.notEqual(calls[0].value.idempotencyKey,calls[2].value.idempotencyKey);
 await client.discovery({deviceId:'d',sessionId:'s'},{operationKey:'discover:1'});await client.discovery({deviceId:'d',sessionId:'s'},{operationKey:'discover:2'});assert.notEqual(calls[3].value.idempotencyKey,calls[4].value.idempotencyKey);
 store.setItem('m2-request:b:bad','broken');await assert.rejects(()=>client.gift({},{operationKey:'bad'}),/损坏/);
 assert.equal([...store.map.keys()].some(key=>key.includes('friendshipId')),false);
});
test('controller discards old owner responses',async()=>{
 let owner='a',finish;const pending=new Promise(resolve=>finish=resolve);const controller=new SocialController({adapter:{load:()=>pending},getOwner:()=>owner,getSave:()=>({cats:[]})});
 const run=controller.refresh();owner='b';controller.invalidate();finish({owner:'a'});await run;assert.equal(controller.state.data,null);assert.equal(controller.state.status,'idle');
});
test('local collection derives real IDs without mutating save',()=>{
 const save={cats:[{breed:'blue',claimedGoals:['real-goal']}],graduates:[{id:'g',breed:'silver'}]},before=JSON.stringify(save),value=localCollection(save);
 assert.equal(value.breeds.find(row=>row.id==='blue').isCollected,true);assert.equal(value.goals[0].id,'real-goal');assert.equal(JSON.stringify(save),before);
});
test('proof12 matches current challenge; no phone HMAC; reserved ENV bits rejected',async()=>{
 const reads=[],badge={client:{generation:1},requireSession(){},deviceId:()=> 'AABBCCDDEEFF',session:{id:'02020202-0202-0202-0202-020202020202'},transport:{read:async kind=>{reads.push(kind);const proof=new Uint8Array(64);proof.set(badge.m2Challenge.expectedHash);return proof;},write:async()=>{}}};
 const bridge=new SocialDeviceBridge({badge}),envelope=new Uint8Array(118);envelope[20]=1;envelope[85]=1;envelope.fill(2,0,16);envelope.fill(1,21,37);envelope.set([170,187,204,221,238,255],37);envelope.fill(3,43,49);new DataView(envelope.buffer).setUint32(81,Math.floor(Date.now()/1000)+300,true);
 await bridge.challenge({id:'01010101010101010101010101010101',method:'QR',ownChallengeBase64:Buffer.from(envelope).toString('base64')});const proof=await bridge.proof('01010101010101010101010101010101');assert.deepEqual(reads,[12]);assert.equal(Buffer.from(proof.proofBase64,'base64').length,64);await assert.rejects(()=>bridge.proof('old'));
 const raw=Uint8Array.from([1,5,1,0,0,0,0,0,0,0]);assert.equal(decodeEnvironmentStatus(raw).isModelAvailable,true);raw[1]=128;assert.throws(()=>decodeEnvironmentStatus(raw));
});
test('QR parses only local discovery URI; external URLs and arbitrary fields rejected',()=>{
 assert.equal(parseDiscoveryQr(discoveryQr('abcdefghi_token')),'abcdefghi_token');assert.throws(()=>parseDiscoveryQr('https://example.com'));assert.throws(()=>parseDiscoveryQr('baji://discover?token=abcdefghi&admin=true'));
});
test('camera stopped while permission pending disposes old stream',async()=>{
 let resolve,stopped=0;const video={pause(){},srcObject:null},scanner=new QrScanner({video,canvas:{},media:{getUserMedia:()=>new Promise(r=>resolve=r)},onValue(){},requestFrame(){},cancelFrame(){}});
 const start=scanner.start();scanner.stop();resolve({getTracks:()=>[{stop:()=>stopped++}]});await start;assert.equal(stopped,1);assert.equal(video.srcObject,null);
});
