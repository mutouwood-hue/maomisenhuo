'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'../../artifacts/html-offline-candidate');
const candidate=base+'/ui014/source';
const {actualRoom}=require(candidate+'/tests/room-animation-fixture.cjs');
test('original entire store factory and care orchestrator prefix are byte-identical to 013',()=>{
 const old=fs.readFileSync(base+'/source/android/app/src/main/assets/game-03.js','utf8');
 const next=fs.readFileSync(candidate+'/android/app/src/main/assets/game-03.js','utf8');
 // Factory contains eligibility, care/play timing, reward, persistence, backup and event hook.
 assert.equal(next.slice(0,next.indexOf('/**')),old.slice(0,old.indexOf('/**')));
 const oldAt=old.indexOf('function Ef('),nextAt=next.indexOf('function Ef(');assert.ok(oldAt>0&&nextAt>0,'actual controller anchors exist');
 assert.equal(next.slice(nextAt),old.slice(oldAt),'game controller/commit timing unchanged');
});
for(const stage of ['kitten','adult'])test(stage+' cancel at each sleep transition resets roll, home position and whiskers without completing',async()=>{
 const h=await actualRoom();try{
  h.room.setStage(stage);for(let i=0;i<180;i++)h.step();
  const baseline=new Map();h.inspect.model.root.traverse(m=>{if(m.isMesh&&/^whisker_/.test(m.name))baseline.set(m.name,m.position.toArray());});
  const phases=['走向床边','上床蓄力','轻轻上床','床上入睡','睡着','醒来起身','下床蓄力','轻轻下床','回家'];
  for(const phase of phases){
   const result=h.room.perform('sleep');let reached=false;
   for(let i=0;i<1500;i++){const s=h.step();if(s.currentPhase===phase){if(phase==='睡着')for(let n=0;n<8;n++)h.step();reached=true;break;}if(i%60===0)await Promise.resolve();}
   assert.equal(reached,true,'reach '+phase);h.room.cancelInteraction();assert.equal(await result,false,'no false completion '+phase);
   const s=h.step();assert.equal(s.currentAction,null);assert.equal(s.busy,false);assert.equal(h.inspect.inner.rotation.z,0);assert.deepEqual(Array.from(s.catPosition),[0,.22,-3]);
   h.inspect.model.root.traverse(m=>{if(baseline.has(m.name))assert.deepEqual(m.position.toArray(),baseline.get(m.name),'no whisker residue '+phase);});
  }
 }finally{h.close();}
});
