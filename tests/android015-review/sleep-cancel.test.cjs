'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'../../artifacts/html-offline-candidate/ui014');
const candidate=path.resolve(__dirname,'../../artifacts/html-offline-candidate/ui015/source');
const {actualRoom}=require(candidate+'/tests/room-animation-fixture.cjs');
const {actualRoom:referenceRoom}=require(base+'/source/tests/room-animation-fixture.cjs');
test('original entire store factory and care orchestrator prefix are byte-identical to 014',()=>{
 const old=fs.readFileSync(base+'/source/android/app/src/main/assets/game-03.js','utf8');
 const next=fs.readFileSync(candidate+'/android/app/src/main/assets/game-03.js','utf8');
 // Factory contains eligibility, care/play timing, reward, persistence, backup and event hook.
 assert.equal(next.slice(0,next.indexOf('/**')),old.slice(0,old.indexOf('/**')));
 const oldAt=old.indexOf('function Ef('),nextAt=next.indexOf('function Ef(');assert.ok(oldAt>0&&nextAt>0,'actual controller anchors exist');
 assert.equal(next.slice(nextAt),old.slice(oldAt),'game controller/commit timing unchanged');
});
for(const stage of ['kitten','adult'])test(stage+' cancel at each sleep transition resets roll, home position and whiskers without completing',async()=>{
 const h=await actualRoom(),reference=await referenceRoom();try{
  const step=()=>{const current=h.step();reference.step();return current;};
  h.room.setStage(stage);reference.room.setStage(stage);for(let i=0;i<180;i++)step();
  const baseline=new Map();h.inspect.model.root.traverse(m=>{if(m.isMesh&&/^whisker_/.test(m.name))baseline.set(m.name,m.position.toArray());});
  const phases=['走向床边','上床蓄力','轻轻上床','床上入睡','睡着','醒来起身','下床蓄力','轻轻下床','回家'];
  for(const phase of phases){
   const result=h.room.perform('sleep'),refResult=reference.room.perform('sleep');let reached=false;
   for(let i=0;i<1500;i++){const s=step();if(s.currentPhase===phase){if(phase==='睡着')for(let n=0;n<8;n++)step();reached=true;break;}if(i%60===0)await Promise.resolve();}
   assert.equal(reached,true,'reach '+phase);h.room.cancelInteraction();reference.room.cancelInteraction();assert.equal(await result,false,'no false completion '+phase);assert.equal(await refResult,false);
   const s=step();assert.equal(s.currentAction,null);assert.equal(s.busy,false);assert.equal(h.inspect.inner.rotation.z,0);assert.deepEqual(Array.from(s.catPosition),[0,.22,-3]);
   // Original idle is animated (including a nonzero head roll). Compare the
   // same-clock unchanged 014 machine, rather than requiring a static zero pose.
   for(const name of ['head','ear_left','ear_right']){
    const current=h.inspect.bones.get(name),expected=reference.inspect.bones.get(name);
    for(const field of ['position','rotation','scale'])assert.deepEqual(Array.from(current[field].toArray()),Array.from(expected[field].toArray()),name+' '+field+' residue after '+phase);
   }
   assert.deepEqual(Array.from(h.inspect.bones.get('head').scale.toArray()),Array(3).fill(stage==='kitten'?1.065:1));
   h.inspect.model.root.traverse(m=>{if(baseline.has(m.name))assert.deepEqual(m.position.toArray(),baseline.get(m.name),'no whisker residue '+phase);});
  }
 }finally{h.close();reference.close();}
});
