'use strict';
// Run actual production Java + existing fixtures with all generated output isolated here.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const review=__dirname,source=path.resolve(review,'../../artifacts/html-offline-candidate/source');
const original=source+'/tests/native-durable.test.cjs';
let code=fs.readFileSync(original,'utf8');
code=code.replace("out=root+'/.build/native-durable-jvm'","out="+JSON.stringify(review+'/build-native-durable-jvm'));
code=code.replace("fs.mkdtempSync(root+'/.build/durable-case-')","fs.mkdtempSync("+JSON.stringify(review+'/durable-case-')+")");
// Same source platform stand-ins except the explicit AOSP-like silent finish injection below.
code=code.replace("...stubs,root+'/android", "...stubs.filter(p=>!p.endsWith('/android/util/AtomicFile.java')),"+JSON.stringify(review+'/stubs/android/util/AtomicFile.java')+",root+'/android");
code+=`\ntest('independent actual production readback catches silent finish rename failure and retry re-syncs',async()=>{
 const s=server();try{
  await s.rpc('commit',{expectedRevision:0,updates:{[key]:'previous'}});
  await assert.rejects(s.rpc('commit',{expectedRevision:1,updates:{[key]:'must-not-certify'},fixtureFailure:'silentBeforeRename'}),/readback mismatch/);
  assert.equal((await s.rpc('read')).entries[key],'previous');
  const result=await s.rpc('commit',{expectedRevision:1,updates:{[key]:'must-not-certify'}});
  assert.equal(result.persisted,true);assert.equal(result.revision,2);assert.equal(result.hashes[key],model.sha256('must-not-certify'));
 }finally{await s.close();}
});
test('independent first-ever silent finish failure cannot certify a missing base',async()=>{
 const s=server();try{
  await assert.rejects(s.rpc('commit',{expectedRevision:0,updates:{[key]:'first'},fixtureFailure:'silentBeforeRename'}),/readback mismatch/);
  assert.equal((await s.rpc('read')).revision,0);
  assert.equal((await s.rpc('commit',{expectedRevision:0,updates:{[key]:'first'}})).revision,1);
 }finally{await s.close();}
});\n`;
new Function('require','__dirname',code)(createRequire(original),path.dirname(original));
