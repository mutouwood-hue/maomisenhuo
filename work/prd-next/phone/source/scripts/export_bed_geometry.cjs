/* Actual model/pose and sleep machine exports. Renderer/DOM are fixtures, not Android. */
const fs=require('node:fs'),path=require('node:path'),{createModel}=require('../tests/room-geometry-fixture.cjs'),{actualRoom}=require('../tests/room-animation-fixture.cjs');
const dir=path.resolve(__dirname,'../../evidence/bed');fs.mkdirSync(dir,{recursive:true});
function snapshot({groups,Vector,camera,texture},name,metadata={}){
 const meshes=[];camera?.updateWorldMatrix(true,false);
 for(const group of groups){group.updateWorldMatrix(true,true);group.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible)return;
  let parent=mesh.parent;while(parent){if(!parent.visible)return;parent=parent.parent;}
  const g=mesh.geometry,positions=g.getAttribute('position'),uv=g.getAttribute('uv'),index=g.index,verts=[],projected=[];
  for(let i=0;i<positions.count;i++){const v=new Vector().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);verts.push(v.toArray());if(camera)projected.push(v.clone().project(camera).toArray());}
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material],triangles=[];
  for(const part of g.groups.length?g.groups:[{start:0,count:index?index.count:positions.count,materialIndex:0}]){
   const material=Array.isArray(mesh.material)?materials[part.materialIndex||0]:materials[0];if(!material?.visible)continue;
   for(let j=part.start;j<part.start+part.count;j+=3){const ids=[j,j+1,j+2].map(i=>index?index.getX(i):i);triangles.push({ids,color:material.color.toArray().map(v=>Math.round(Math.pow(v,1/2.2)*255)),texture:Boolean(material.map),uv:ids.map(i=>uv?[uv.getX(i),uv.getY(i)]:[0,0])});}
  }
  meshes.push({name:mesh.name,verts,projected,triangles});
 });}
 fs.writeFileSync(dir+'/'+name+'-meshes.json',JSON.stringify({...metadata,meshes,texture,camera:camera?{position:camera.position.toArray(),fov:camera.fov,aspect:camera.aspect}:null}));
}
(async()=>{
 const h=await createModel(),report=[];
 for(const stage of ['kitten','adult']){
  const r=await actualRoom();try{
   r.room.setStage(stage);for(let i=0;i<180;i++)r.step();
   const shared={Vector:h.T.Vector,camera:r.inspect.cam,texture:h.project.textures[0].source};
   const p=h.pose(stage,1);snapshot({...shared,groups:[h.bed,h.outer]},stage,{stage,phase:'settled'});
   report.push({stage,roll:p.roll,bounds:{min:p.bounds.min.toArray(),max:p.bounds.max.toArray()},torso:{min:p.torso.min.toArray(),max:p.torso.max.toArray()},headCore:{min:p.headCore.min.toArray(),max:p.headCore.max.toArray()},headMinY:p.head.min.y,headScale:h.model.bones.get('head').scale.toArray()});
   const wanted=[['床上入睡',.05,'lie-00'],['床上入睡',.2,'lie-25'],['床上入睡',.4,'lie-50'],['床上入睡',.6,'lie-75'],['睡着',.4,'sleep'],['醒来起身',.2,'wake-25'],['醒来起身',.4,'wake-50'],['醒来起身',.6,'wake-75'],['醒来起身',.8,'wake-100']],captured=new Set();
   r.room.perform('sleep');
   for(let i=0;i<1200&&captured.size<wanted.length;i++){
    const state=r.step();for(const [phase,time,label]of wanted)if(state.currentPhase===phase&&r.inspect.act.phaseTime>=time&&!captured.has(label)){
     snapshot({...shared,groups:[r.inspect.scene.getObjectByName('offline-supported-bed'),r.inspect.cat]},stage+'-'+label,{stage,phase,time:r.inspect.act.phaseTime,frame:i});captured.add(label);
    }
    if(i%60===0)await Promise.resolve();
   }
   if(captured.size!==wanted.length)throw new Error(stage+' incomplete actual phase export');
  }finally{r.close();}
 }
 fs.writeFileSync(dir+'/geometry-report.json',JSON.stringify({kind:'software geometry and actual machine / renderer substitutes; not Android',config:h.bedApi.config,poses:report},null,2));
})();
