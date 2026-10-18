const {test}=require('node:test'),assert=require('node:assert/strict');
const {actualRoom}=require('./room-animation-fixture.cjs');
for(const stage of ['kitten','adult'])test('actual '+stage+' sleep machine completes approach/lie/wake/hop/home with no bed or neighbor mesh penetration',async()=>{
 const h=await actualRoom();try{
  h.room.setStage(stage);for(let i=0;i<180;i++)h.step();
  const {Box}=h.types,bed=h.inspect.scene.getObjectByName('offline-supported-bed'),parts=[];
  h.inspect.scene.updateWorldMatrix(true,true);
  for(const mesh of bed.children)parts.push({name:'bed '+(mesh.name||'frame/leg'),box:new Box().setFromObject(mesh)});
  let bath,climb;h.inspect.scene.traverse(o=>{if(o.type==='Group'&&Math.abs(o.position.x+15.2)<.01&&Math.abs(o.position.z+4.5)<.01)bath=o;if(o.isMesh&&o.geometry.parameters?.width===20&&o.geometry.parameters?.height===.8&&o.geometry.parameters?.depth===14.5)climb=o.parent;});
  assert.ok(bath&&climb);for(const group of [bath,climb])group.traverse(mesh=>{if(mesh.isMesh&&!(mesh.material.opacity<1))parts.push({name:group===bath?'bath':'climb',box:new Box().setFromObject(mesh)});});
  const phases=new Set();let done=false,frames=0,meshChecks=0,lastHead=null,maxHeadStep=0;
  h.room.perform('sleep').then(()=>{done=true;});
  for(;frames<1400&&!done;frames++){
   const s=h.step();if(s.currentPhase)phases.add(s.currentPhase);
   h.inspect.scene.updateWorldMatrix(true,true);
   const head=h.inspect.bones.get('head').getWorldPosition(new h.types.Vector());
   if(lastHead&&['床上入睡','睡着','醒来起身','下床蓄力'].includes(s.currentPhase))maxHeadStep=Math.max(maxHeadStep,head.distanceTo(lastHead));
   lastHead=head;
   h.inspect.model.root.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.visible)return;const b=new Box().setFromObject(mesh);
    for(const part of parts){meshChecks++;const overlaps=['x','y','z'].map(k=>Math.min(b.max[k],part.box.max[k])-Math.max(b.min[k],part.box.min[k]));assert.ok(!overlaps.every(v=>v>.03),s.currentPhase+' '+mesh.name+' enters '+part.name+' '+overlaps);}
   });
   if(frames%60===0)await Promise.resolve();
  }
  assert.equal(done,true);for(const name of ['上床蓄力','轻轻上床','床上入睡','睡着','醒来起身','下床蓄力','轻轻下床','回家'])assert.ok(phases.has(name));
  assert.equal(h.room.state().currentAction,null);assert.deepEqual(Array.from(h.room.state().catPosition),[0,.22,-3]);assert.ok(meshChecks>10000);
  assert.ok(maxHeadStep<.6*(stage==='kitten'?.64:1),'head cannot pop when lying, breathing, waking or entering hop');
  const headBone=h.inspect.bones.get('head');assert.ok(Math.abs(headBone.rotation.y)<.1,'sleep neck turn is cleared before original idle look resumes');assert.deepEqual(Array.from(headBone.scale.toArray()),Array(3).fill(stage==='kitten'?1.065:1));
 }finally{h.close();}
});
