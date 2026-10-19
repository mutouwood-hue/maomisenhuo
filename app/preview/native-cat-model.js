/* Restricted rigid glTF reader for the supplied five cats and forty fits.
 * No network/GLB loader dependency. Original room actions keep the same API. */
(function(w){
 'use strict';
 const stageScale={kitten:.64,young:.82,adult:1};
 const fits={bandana:'01_thick_bib',bow:'02_bow',backpack:'03_mint_backpack',wings:'04_cream_wings',rain_hat:'05_rain_hat',scarf:'06_scarf',vest:'07_little_vest',star_collar:'08_star_collar'};
 const decode=encoded=>Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
 function reader(payload){
  const data=decode(payload.binary),graph=payload.graph,view=new DataView(data.buffer);
  const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  const types={5120:['getInt8',1],5121:['getUint8',1],5122:['getInt16',2],5123:['getUint16',2],5125:['getUint32',4],5126:['getFloat32',4]};
  const cache=new Map();
  function accessor(id){
   if(cache.has(id))return cache.get(id);
   const a=graph.accessors[id],b=graph.bufferViews[a.bufferView],type=types[a.componentType],width=widths[a.type];
   if(a.sparse||!type||!width)throw Error('Unsupported native cat accessor');
   const values=new Float32Array(a.count*width),stride=b.byteStride||width*type[1],start=(b.byteOffset||0)+(a.byteOffset||0);
   for(let i=0;i<a.count;i++)for(let j=0;j<width;j++)values[i*width+j]=view[type[0]](start+i*stride+j*type[1],true);
   cache.set(id,values);return values;
  }
  function image(index=0){const i=graph.images[index],b=graph.bufferViews[i.bufferView];let raw='';for(const value of data.subarray(b.byteOffset||0,(b.byteOffset||0)+b.byteLength))raw+=String.fromCharCode(value);return 'data:'+i.mimeType+';base64,'+btoa(raw);}
  return {graph,accessor,image};
 }
 function geometry(T,r,p,unit){
  if(p.mode!==undefined&&p.mode!==4)throw Error('Native cat requires triangle primitives');
  const g=new T.BufferGeometry();
  for(const [name,key,size]of [['position','POSITION',3],['normal','NORMAL',3],['uv','TEXCOORD_0',2]]){
   if(p.attributes[key]===undefined)continue;
   const values=new Float32Array(r.accessor(p.attributes[key]));
   if(size===3)for(let i=0;i<values.length;i+=3){values[i+2]*=-1;if(name==='position'){values[i]*=unit;values[i+1]*=unit;values[i+2]*=unit;}}
   g.setAttribute(name,new T.Attribute(values,size));
  }
  const indices=p.indices===undefined?Array.from({length:g.getAttribute('position').count},(_,i)=>i):Array.from(r.accessor(p.indices));
  for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  g.setIndex(indices);if(!g.getAttribute('normal'))g.computeVertexNormals();return g;
 }
 function build(T,r,unit,texture,edgeColor){
  const root=new T.Group(),bones=new Map(),materials=r.graph.materials.map(info=>{
   const p=info.pbrMetallicRoughness||{},m=new T.Material({roughness:p.roughnessFactor??1,metalness:p.metallicFactor??0,side:info.doubleSided?2:0,transparent:info.alphaMode==='BLEND',alphaTest:info.alphaMode==='MASK'?(info.alphaCutoff??.5):0});
   const color=p.baseColorFactor||[1,1,1,1];m.color.setRGB(color[0],color[1],color[2]);m.opacity=color[3];
   if(p.baseColorTexture)m.map=texture;
   if(edgeColor&&/Warm (orange edge|ear orange)/.test(info.name))m.color.setHex(edgeColor);
   return m;
  });
  const nodes=r.graph.nodes.map(info=>{
   const o=new T.Group();o.name=info.name||'';o.rotation.order='ZYX';
   if(info.matrix){
    o.matrix.fromArray(info.matrix);for(let i=0;i<16;i++)o.matrix.elements[i]*=(i%4===2?-1:1)*(Math.floor(i/4)===2?-1:1);
    o.matrix.decompose(o.position,o.quaternion,o.scale);o.position.multiplyScalar(unit);
   }else{
    const p=info.translation||[0,0,0],q=info.rotation||[0,0,0,1];
    o.position.set(p[0]*unit,p[1]*unit,-p[2]*unit);o.quaternion.set(-q[0],-q[1],q[2],q[3]);if(info.scale)o.scale.fromArray(info.scale);
   }
   o.userData={basePosition:o.position.toArray(),baseRotation:o.rotation.toArray().slice(0,3),baseScale:o.scale.toArray(),restQuaternion:o.quaternion.toArray()};bones.set(o.name,o);
   if(info.mesh!==undefined)for(const [i,p]of r.graph.meshes[info.mesh].primitives.entries()){
    const m=new T.Mesh(geometry(T,r,p,unit),materials[p.material]);m.name=o.name+':primitive:'+i;m.castShadow=m.receiveShadow=true;o.add(m);
   }
   return o;
  });
  r.graph.nodes.forEach((info,i)=>(info.children||[]).forEach(child=>nodes[i].add(nodes[child])));
  for(const index of r.graph.scenes[r.graph.scene||0].nodes)root.add(nodes[index]);
  root.updateWorldMatrix(true,true);
  const restInverse=new Map([...bones].map(([name,bone])=>[name,bone.matrixWorld.clone().invert()]));
  return {root,bones,nodes,materials,restInverse,reader:r};
 }
 function dispose(asset){asset.root.removeFromParent();asset.root.traverse(o=>o.geometry?.dispose());for(const m of asset.materials)m.dispose();}
 function frame(asset,name,time,unit){
  const clip=asset.reader.graph.animations?.find(a=>a.name===name)||asset.reader.graph.animations?.find(a=>a.name==='idle');
  for(const o of asset.nodes){o.position.fromArray(o.userData.basePosition);o.quaternion.fromArray(o.userData.restQuaternion);o.scale.fromArray(o.userData.baseScale);}
  if(!clip)return;
  let duration=0;for(const sampler of clip.samplers){const input=asset.reader.accessor(sampler.input);duration=Math.max(duration,input[input.length-1]);}
  const t=duration>0?time%duration:0;
  for(const channel of clip.channels){
   const sampler=clip.samplers[channel.sampler],times=asset.reader.accessor(sampler.input),values=asset.reader.accessor(sampler.output),o=asset.nodes[channel.target.node];
   let hi=0;while(hi<times.length-1&&times[hi]<=t)hi++;let lo=Math.max(0,hi-1);
   if(t>=times[times.length-1])lo=hi=times.length-1;
   const mix=sampler.interpolation==='STEP'||hi===lo?0:(t-times[lo])/(times[hi]-times[lo]);
   if(channel.target.path==='rotation'){
    const a=lo*4,b=hi*4;o.quaternion.set(-values[a],-values[a+1],values[a+2],values[a+3]);
    o.userData.nativeNextQuaternion??=o.quaternion.clone();o.userData.nativeNextQuaternion.set(-values[b],-values[b+1],values[b+2],values[b+3]);o.quaternion.slerp(o.userData.nativeNextQuaternion,mix);
   }else{
    const a=lo*3,b=hi*3,x=values[a]+(values[b]-values[a])*mix,y=values[a+1]+(values[b+1]-values[a+1])*mix,z=values[a+2]+(values[b+2]-values[a+2])*mix;
    if(channel.target.path==='translation')o.position.set(x*unit,y*unit,-z*unit);else if(channel.target.path==='scale')o.scale.set(x,y,z);
   }
  }
 }
 async function create({THREE:T,breed='orange',outfit='none',stage='adult',bodyShape='standard'}){
  const data=w.CatNativeAssetData;if(data?.format!==1)throw Error('原生小猫素材尚未载入。');
  const source=JSON.parse(new TextDecoder().decode(decode(w.__CAT_PROJECT_BASE64__)));
  const root=new T.Group(),bones=new Map(),model={elements:[]};let active=null,worn=null,currentStage=w.CatPetGrowth.normalize(stage),body=bodyShape,currentBreed=breed,currentOutfit=outfit,animation='idle',time=0,unit=20,activeKey='',texture=null;
  const imageCache=new Map(),textureCache=new Map();
  function key(){return currentStage==='kitten'?'01_kitten':currentStage==='young'?'02_young':body==='slim'?'03_adult_slim':body==='round'?'05_adult_round':'04_adult_standard';}
  // Three very small authored atlases, loaded once. GLB geometry is built only
  // for the selected stage/body, never for all forty wearable combinations.
  for(const k of ['01_kitten','02_young','04_adult_standard']){
   const r=reader(data.models[k]),image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('原生小猫贴图无法读取。'));img.src=r.image();});imageCache.set(k,image);
  }
  function paletteTexture(){
   const paletteKey=currentStage+':'+currentBreed;
   if(textureCache.has(paletteKey))return textureCache.get(paletteKey);
   const image=imageCache.get(currentStage==='adult'?'04_adult_standard':key()),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height);
   if(currentBreed!=='orange'){
    pixels.data.set(w.CatNativeBreedPaint(pixels.data,source,canvas.width,currentBreed));
    w.CatPetGrowth.tint(pixels.data,{elements:source.elements,width:canvas.width,stage:currentStage});
   }
   context.putImageData(pixels,0,0);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGB;map.magFilter=map.minFilter=T.Nearest;map.generateMipmaps=false;map.flipY=false;textureCache.set(paletteKey,map);return map;
  }
  function mountOutfit(){
   if(worn){dispose(worn);worn.mount?.removeFromParent();worn=null;}
   if(currentOutfit==='none')return;
   const id=fits[currentOutfit];
   if(id){
    const row=data.fits.find(f=>f.stage===activeKey&&f.accessory===id),bone=bones.get(row.parent_node);
    worn=build(T,reader(data.accessories[activeKey][id]),unit,null,null);
    const mount=new T.Group();mount.name='native-fit:'+currentOutfit;mount.matrix.copy(active.restInverse.get(row.parent_node));mount.matrixAutoUpdate=false;
    bone.add(mount);mount.add(worn.root);worn.mount=mount;
    worn.root.traverse(o=>{o.userData.accessory=true;o.userData.outfit=currentOutfit;o.userData.attachedBone=row.parent_node;});
   }else if(w.CatNativeLegacyOutfit){
    worn=w.CatNativeLegacyOutfit({THREE:T,source,bones,restInverse:active.restInverse,parameters:data.parameters[activeKey],stageScale:stageScale[currentStage],outfit:currentOutfit});
   }
  }
  function rebuild(){
   if(worn){dispose(worn);worn.mount?.removeFromParent();worn=null;}if(active)dispose(active);
   activeKey=key();unit=20/stageScale[currentStage];texture=paletteTexture();
   const edge=currentBreed==='orange'?null:w.CatNativeBreedColors?.[currentBreed]?.fur;
   active=build(T,reader(data.models[activeKey]),unit,texture,edge);bones.clear();for(const group of source.groups){const bone=active.bones.get(group.name);if(bone)bones.set(group.name,bone);}
   root.userData.nativeAssetKey=activeKey;
   root.userData.nativeAssetRevision=(root.userData.nativeAssetRevision||0)+1;
   model.elements.splice(0,model.elements.length,...active.reader.graph.nodes.filter(n=>n.mesh!==undefined));root.add(active.root);mountOutfit();applyAnimation(animation,time);
  }
  function applyAnimation(name,seconds){animation=name;time=seconds;frame(active,name,seconds,unit);setMouth(0);}
  function setMouth(amount=0){for(const name of ['white_chin','muzzle_left','muzzle_right']){const o=active.bones.get(name);if(o)o.position.y=o.userData.basePosition[1]-Math.max(0,Math.min(1,amount))*.42*data.parameters[activeKey].head/stageScale[currentStage];}}
  function state(){let parts=[];worn?.root.traverse(o=>{if(o.isMesh)parts.push({name:o.name,bone:o.userData.attachedBone});});return {animation,time,boneCount:14,elementCount:model.elements.length,animations:['idle','walk','paw'],breed:currentBreed,outfit:currentOutfit,growthStage:currentStage,bodyShape:body,effectiveBodyShape:currentStage==='adult'?body:'standard',assetKey:activeKey,assetSource:'authored-native-v3',accessoryMeshes:parts.length,accessoryParts:parts,texture:{width:texture.image.width,height:texture.image.height,nearest:true,original:currentBreed==='orange'}};}
  function setAppearance(value={}){
   const oldKey=key(),oldBreed=currentBreed;
   if(w.CatPetAppearance.breeds.includes(value.breed))currentBreed=value.breed;
   if(value.stage)currentStage=w.CatPetGrowth.normalize(value.stage);
   if(w.CatPetAppearance.bodies.includes(value.bodyShape))body=value.bodyShape;
   const changedOutfit=typeof value.outfit==='string'&&value.outfit!==currentOutfit;if(changedOutfit)currentOutfit=value.outfit;
   if(oldKey!==key()||oldBreed!==currentBreed)rebuild();else if(changedOutfit)mountOutfit();return state();
  }
  rebuild();return {root,bones,model,get texture(){return texture;},applyAnimation,setMouth,setAppearance,setStage:value=>setAppearance({stage:value}),fitAccessories(){},state,dispose(){if(worn){dispose(worn);worn.mount?.removeFromParent();}if(active)dispose(active);for(const map of textureCache.values())map.dispose();root.removeFromParent();}};
 }
 w.CatNativeModel=Object.freeze({create,reader,fits});
})(window);
