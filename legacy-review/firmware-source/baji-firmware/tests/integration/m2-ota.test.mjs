import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { harness, digest, hmac } from './m2-helper.mjs';
import { ApiClient } from '../../mobile-pet/src/companion/api-client.js';
import { UpdateUploader, decodeUpdateStatus } from '../../mobile-pet/src/social/update-uploader.js';
async function release() {
 const dir=await mkdtemp(join(tmpdir(),'baji-m2-ota-')),artifactPath=join(dir,'TEST-only.bin');
 const bytes=Buffer.alloc(901);for(let i=0;i<bytes.length;i++)bytes[i]=(i*29+7)&255;
 const sha=digest(bytes),manifest=Buffer.alloc(74);manifest[0]=1;manifest[1]=1;Buffer.from('baji-s3-175c-v1').copy(manifest,2);manifest.writeUInt32LE(7,18);manifest.writeUInt32LE(bytes.length,22);sha.copy(manifest,26);sha.subarray(0,16).copy(manifest,58);
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const signature=sign('sha256',Buffer.concat([Buffer.from('BAJI-UPDATE-v1'),manifest]),privateKey);
 await writeFile(artifactPath,bytes);
 return {dir,bytes,sha,manifest,signature,id:sha.subarray(0,16).toString('hex'),config:{otaPublicKey:publicKey.export({type:'spki',format:'pem'}),otaReleases:{APP:{artifactPath,manifestBase64:manifest.toString('base64'),signatureBase64:signature.toString('base64')}}},publicKey,privateKey};
}
function body(encoded,u,kind) {
 const raw=Buffer.from(encoded,'base64');assert.ok(raw.length<=512);
 assert.equal(raw.subarray(0,16).toString('hex'),u.binding.sessionId.replaceAll('-',''));
 assert.deepEqual(raw.subarray(-32),hmac(u.key,'BAJI-SYNC-v1',Buffer.from(u.id,'hex'),Buffer.from([kind]),raw.subarray(0,-32)));
 return raw.subarray(20,-32);
}
const status=(r,state,received)=>{const bytes=Buffer.alloc(40);bytes[0]=1;bytes[1]=state;bytes[2]=1;Buffer.from(r.id,'hex').copy(bytes,4);bytes.writeUInt32LE(received,20);bytes.writeUInt32LE(r.bytes.length,24);bytes.writeUInt32LE(7,28);return bytes;};

test('M2 independent OTA HTTP P256 manifest, binary artifact, signed 20/21/22 envelopes and immutable counter retry',async()=>{
 const r=await release();let h;
 try{
  h=await harness(undefined,{config:r.config});const [a,b]=h.users;
  const query=`deviceId=${a.id}&sessionId=${a.binding.sessionId}`;
  const meta=await h.ok(a,`/ota-manifests/APP?${query}`);assert.equal(meta.sizeBytes,r.bytes.length);assert.equal(meta.releaseId,r.id);
  assert.equal(verify('sha256',Buffer.concat([Buffer.from('BAJI-UPDATE-v1'),Buffer.from(meta.manifestBase64,'base64')]),r.publicKey,Buffer.from(meta.signatureBase64,'base64')),true);
  const binary=await fetch(h.base+meta.artifactUrl,{headers:{Authorization:`Bearer ${a.token}`}});assert.equal(binary.status,200);assert.deepEqual(Buffer.from(await binary.arrayBuffer()),r.bytes);
  assert.notEqual((await h.request(b,`/ota-manifests/APP?${query}`)).code,200);
  const signed=(kind,offset,key)=>h.ok(a,`/devices/${a.id}/signed-objects`,'POST',{sessionId:a.binding.sessionId,kind,releaseId:r.id,...(offset===undefined?{}:{offset})},{key});
  const begin=await signed(20,undefined,'ota-begin-once'),again=await signed(20,undefined,'ota-begin-once');assert.deepEqual(again,begin,'same key returns same counter and envelope');
  const start=body(begin.envelopeBase64,a,20);assert.deepEqual(start.subarray(0,74),r.manifest);assert.equal(start.readUInt16LE(74),r.signature.length);assert.deepEqual(start.subarray(76),r.signature);
  for(const offset of [0,440,880]){const chunk=await signed(21,offset);const payload=body(chunk.envelopeBase64,a,21);assert.equal(payload.subarray(0,16).toString('hex'),r.id);assert.equal(payload.readUInt32LE(16),offset);assert.deepEqual(payload.subarray(20),r.bytes.subarray(offset,offset+440));}
  assert.deepEqual(body((await signed(22)).envelopeBase64,a,22),Buffer.from(r.id,'hex'));
  for(const offset of [-1,901,4294967296])assert.notEqual((await h.request(a,`/devices/${a.id}/signed-objects`,'POST',{sessionId:a.binding.sessionId,kind:21,releaseId:r.id,offset})).code,200);
  assert.notEqual((await h.request(a,`/devices/${a.id}/signed-objects`,'POST',{sessionId:a.binding.sessionId,kind:21,releaseId:r.id,offset:0,dataBase64:'attacker'})).code,200);
 }finally{await h?.close();assert.ok(r.dir.startsWith(join(tmpdir(),'baji-m2-ota-')));await rm(r.dir,{recursive:true,force:true});}
});
test('M2 real mobile OTA uploader relays independently verified HTTP envelopes and requires VERIFIED status',async()=>{
 const r=await release();let h;
 try{
  h=await harness(undefined,{config:r.config});const [a]=h.users;let received=0,committed=false;
  const transport={exclusive:work=>work(),async writeObject(kind,envelope){const payload=body(Buffer.from(envelope).toString('base64'),a,kind);if(kind===20){assert.deepEqual(payload.subarray(0,74),r.manifest);received=0;}else if(kind===21){assert.equal(payload.readUInt32LE(16),received);assert.deepEqual(payload.subarray(20),r.bytes.subarray(received,received+440));received+=payload.length-20;}else if(kind===22){assert.equal(received,r.bytes.length);committed=true;}else assert.fail('unexpected kind');},async readObject(kind){assert.equal(kind,23);return status(r,committed?2:1,received);}};
  const badge={session:{id:a.binding.sessionId},client:{generation:1},deviceId:()=>a.id,requireSession(){},transport};
  const api=new ApiClient({getEndpoint:()=>h.base,getToken:()=>a.token}),values=new Map();
  const uploader=new UpdateUploader({api,getBadge:()=>badge,getOwner:()=>a.userId,storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});
  const result=await uploader.run('APP');assert.equal(result.state,'VERIFIED');assert.equal(result.received,901);
  assert.ok([...values.values()].every(v=>Object.keys(JSON.parse(v)).join()==='id'));
 }finally{await h?.close();assert.ok(r.dir.startsWith(join(tmpdir(),'baji-m2-ota-')));await rm(r.dir,{recursive:true,force:true});}
});
for (const scenario of ['version-zero','empty-artifact','missing-key','missing-file']) test(`M2 OTA invalid configuration fails closed: ${scenario}`,async()=>{
 const r=await release();let h;
 try{
  if(scenario==='version-zero')r.manifest.writeUInt32LE(0,18);
  if(scenario==='empty-artifact') {const sha=digest(Buffer.alloc(0));r.manifest.writeUInt32LE(0,22);sha.copy(r.manifest,26);sha.subarray(0,16).copy(r.manifest,58);await writeFile(r.config.otaReleases.APP.artifactPath,Buffer.alloc(0));}
  if(scenario==='missing-key')delete r.config.otaPublicKey;
  if(scenario==='missing-file')r.config.otaReleases.APP.artifactPath=join(r.dir,'NONEXISTENT.bin');
  r.config.otaReleases.APP.manifestBase64=r.manifest.toString('base64');r.config.otaReleases.APP.signatureBase64=sign('sha256',Buffer.concat([Buffer.from('BAJI-UPDATE-v1'),r.manifest]),r.privateKey).toString('base64');
  h=await harness(undefined,{config:r.config});const [a]=h.users;
  const result=await h.request(a,`/ota-manifests/APP?deviceId=${a.id}&sessionId=${a.binding.sessionId}`);
  assert.equal(result.code,47000,'bad config must be explicit business UNCONFIGURED, not 200 or an unhandled 500');
 }finally{await h?.close();assert.ok(r.dir.startsWith(join(tmpdir(),'baji-m2-ota-')));await rm(r.dir,{recursive:true,force:true});}
});

test('M2 OTA status decoder handles sliced bytes and rejects progress overflow',()=>{
 const r={id:'ab'.repeat(16),bytes:Buffer.alloc(901)}, backing=Buffer.alloc(46);status(r,2,901).copy(backing,3);
 const decoded=decodeUpdateStatus(backing.subarray(3,43));assert.equal(decoded.releaseId,r.id);assert.equal(decoded.state,'VERIFIED');assert.equal(decoded.version,7);
 backing.writeUInt32LE(902,23);assert.throws(()=>decodeUpdateStatus(backing.subarray(3,43)));
});
test('M2 OTA unconfigured fails closed and tampered configured publisher signature is rejected',async()=>{
 const h=await harness();try{const [a]=h.users;const absent=await h.ok(a,`/ota-manifests/APP?deviceId=${a.id}&sessionId=${a.binding.sessionId}`);assert.equal(absent.isConfigured,false);}finally{await h.close();}
 const r=await release();let bad;
 try{r.config.otaReleases.APP.signatureBase64=Buffer.alloc(r.signature.length,1).toString('base64');bad=await harness(undefined,{config:r.config});const [a]=bad.users;assert.notEqual((await bad.request(a,`/ota-manifests/APP?deviceId=${a.id}&sessionId=${a.binding.sessionId}`)).code,200);}finally{await bad?.close();assert.ok(r.dir.startsWith(join(tmpdir(),'baji-m2-ota-')));await rm(r.dir,{recursive:true,force:true});}
});
