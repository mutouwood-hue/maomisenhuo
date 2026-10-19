/* Room-only geometry and supported side-rest pose. No store, rewards or transport. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CatOfflineBed=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const config=Object.freeze({center:[-12.4,13.65],mattress:[20.8,.85,15.8],surface:2.19,pillowTop:2.45,landing:[-11.9,2.19,13.65],sleepCenter:[-12.1,13.65],yaw:Math.PI/2});
 function build({group,box}){
  const [x,z]=config.center;group.name='offline-supported-bed';
  for(const dx of [-9.5,9.5])for(const dz of [-7.2,7.2])box(group,[.8,.8,.8],[x+dx,.48,z+dz],'#9a7460');
  const frame=box(group,[21.6,1.1,16.6],[x,.75,z],'#718f98');
  const mattress=box(group,config.mattress,[x,1.725,z],'#efcda9');
  const pillow=box(group,[6.9,.3,15.5],[x-5.85,2.30,z],'#f0efe0');
  const blanket=box(group,[12.8,.04,15.45],[x+3.8,2.17,z],'#d5a8a1');
  for(let i=0;i<5;i++)box(group,[.28,.006,15.3],[x-.9+i*2.3,2.187,z],'#efd3bb');
  box(group,[.55,3.1,16.6],[x-10.55,1.75,z],'#9a7460');
  box(group,[.5,1.65,16.6],[x+10.55,1.025,z],'#9a7460');
  for(const side of [-1,1])box(group,[20.8,1.3,.4],[x,.85,z+side*8.1],'#9a7460');
  for(const [name,mesh]of Object.entries({frame,mattress,pillow,blanket}))mesh.name='bed-'+name;
  return {frame,mattress,pillow,blanket};
 }
 const whiskerBases=new WeakMap();
 function reset(model){
  const key=model.root.userData.nativeAssetRevision||'legacy';let saved=whiskerBases.get(model.root),list=saved?.key===key?saved.list:null;if(!list){list=[];model.root.traverse(mesh=>{if(mesh.isMesh&&/^whisker_/.test(mesh.name))list.push([mesh,mesh.position.clone()]);});whiskerBases.set(model.root,{key,list});}
  for(const [mesh,position]of list)mesh.position.copy(position);
 }
 function pose({amount,bones,model,inner,root,scale,stage,Vector,Box}){
  const a=Math.max(0,Math.min(1,amount));reset(model);model.applyAnimation('idle',0);
  const body=bones.get('body'),head=bones.get('head');
  body.position.y-=3.4*a;
  for(const [i,name]of ['front_left','front_right','back_left','back_right'].entries()){
   const leg=bones.get(name);leg.scale.y*=1-.60*a;leg.position.y-=3.4*a;leg.rotation.x+=(i<2?-.35:.45)*a;
  }
  // Tuck the neck toward the resting torso, turn the face into the room and
  // counter-roll the head. Rolling a standing head with the body leaves its
  // 9-unit width vertical and its standing neck offset sideways (014's L).
  // Keep the original head dimensions; relax only the articulated ears.
  head.position.y-=2.8*a;head.position.z-=2.2*a;
  head.rotation.x-=.12*a;head.rotation.z-=Math.PI/2*a;head.rotation.y-=Math.PI/2*a;
  for(const [i,name]of ['ear_left','ear_right'].entries()){
   const ear=bones.get(name);ear.rotation.x-=1.1*a;
   ear.rotation.z+=(i===0?-.7:.7)*a;ear.scale.y=1-.25*a;
  }
  bones.get('tail_base').rotation.x-=.9*a;
  for(const name of ['eye_left','eye_right'])bones.get(name)?.scale.setY(1-.88*a);
  if(!model.root.userData.nativeAssetKey&&(stage==='kitten'||stage==='baby'))head.scale.multiplyScalar(1.065);
  inner.rotation.z=Math.PI/2*a;
  const allBones=new Set(bones.values());
  function bounds(bone,own=false,solid=false){
   root.updateWorldMatrix(true,true);const box=new Box();
   bone.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible||mesh.userData.accessory||solid&&/^whisker_/.test(mesh.name))return;let parent=mesh.parent;while(parent&&!allBones.has(parent))parent=parent.parent;if(own&&parent!==bone)return;box.union(new Box().setFromObject(mesh));});return box;
  }
  // Plant the torso on the mattress as it rolls onto its side. The old paw
  // correction assumed an upright local Y and cannot be used for a rolled cat.
  const torso=bounds(body,true);const torsoLift=config.surface-torso.min.y;inner.position.y+=torsoLift>0?torsoLift:torsoLift*a;
  function support(bone,height,solid=false,settle=0){
   const box=bounds(bone,false,solid),difference=height-box.min.y,lift=difference>0?difference:difference*settle;
   if(Math.abs(lift)>1e-10){const world=bone.getWorldPosition(new Vector());world.y+=lift;bone.position.copy(bone.parent.worldToLocal(world));}
  }
  // Settle downward as well as enforcing the lower contact plane. A lift-only
  // constraint can leave an adult's muzzle hanging above the pillow.
  support(head,config.pillowTop,true,a);
  for(const [mesh]of whiskerBases.get(model.root).list)support(mesh,config.pillowTop+.015);
  for(const name of ['front_left','front_right','back_left','back_right'])support(bones.get(name),config.surface);
  root.updateWorldMatrix(true,true);const box=bounds(root),center=box.getCenter(new Vector());
  const delta=new Vector(config.sleepCenter[0]-(1-scale)*3.5*a-center.x,0,config.sleepCenter[1]-center.z);
  const rotation=inner.parent.quaternion.clone().invert();delta.applyQuaternion(rotation);inner.position.x+=delta.x;inner.position.z+=delta.z;
  root.updateWorldMatrix(true,true);
  return {amount:a,roll:inner.rotation.z,bounds:bounds(root),torso:bounds(body,true),head:bounds(head,false,true),headCore:bounds(head,true,true)};
 }
 return {config,build,pose,reset};
});
